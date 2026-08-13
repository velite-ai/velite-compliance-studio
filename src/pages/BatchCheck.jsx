import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { analyseLabel } from '../lib/anthropic'
import { runDeterministicChecks } from '../lib/preChecks'
import {
  COSMETIC_LOGO_DEFAULTS,
  DRUG_LOGO_DEFAULTS,
  COSMETIC_LOGO_TOGGLES,
  DRUG_LOGO_TOGGLES,
  DRUG_REGULATION_DEFAULTS,
} from '../lib/regulations'

const COSMETIC_REG_DEFAULTS = { cosmetics: true, weights: true, claims: true, ingredients: true }

// Concurrency limit: max parallel Claude requests. Keeps us well under the
// Anthropic per-minute rate limit even if the user uploads 30 files.
const MAX_CONCURRENT = 3

export default function BatchCheck() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const inputRef   = useRef()

  const [track,      setTrack]      = useState('cosmetic')
  const [checkType,  setCheckType]  = useState('pre-print')
  const [projects,   setProjects]   = useState([])
  const [projectId,  setProjectId]  = useState(null)
  const [batchName,  setBatchName]  = useState('')
  const [items,      setItems]      = useState([])  // {file, preview, status, result, error, savedCheckId}
  const [running,    setRunning]    = useState(false)
  const [batchId,    setBatchId]    = useState(null)
  const [error,      setError]      = useState('')

  const isDrug = track === 'drug'

  useEffect(() => {
    supabase.from('projects').select('id, product_name, track')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setProjects(data || []))
  }, [])

  function onFilesPicked(files) {
    const list = Array.from(files || []).filter(f => f.type.startsWith('image/'))
    setItems(list.map(f => ({
      file:    f,
      preview: URL.createObjectURL(f),
      status:  'queued',    // queued | running | done | error
      result:  null,
      error:   null,
      savedCheckId: null,
    })))
    setBatchId(null)
    setError('')
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function clearAll() {
    items.forEach(it => it.preview && URL.revokeObjectURL(it.preview))
    setItems([])
    setBatchId(null)
    setError('')
  }

  // ── Run one file through Claude + deterministic checks ─────────────────
  async function runOne(itemIdx) {
    setItems(prev => prev.map((it, i) => i === itemIdx ? { ...it, status: 'running', error: null } : it))
    const it = items[itemIdx]
    try {
      const base64 = await fileToBase64(it.file)
      const productName = it.file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()

      const res = await analyseLabel({
        base64,
        mimeType:        it.file.type,
        productName,
        productCategory: '',
        extraContext:    '',
        regulations:     isDrug ? DRUG_REGULATION_DEFAULTS : COSMETIC_REG_DEFAULTS,
        styleRules:      [],
        track,
        logoChecks:      isDrug ? DRUG_LOGO_DEFAULTS : COSMETIC_LOGO_DEFAULTS,
        logoTogglesDefs: isDrug ? DRUG_LOGO_TOGGLES  : COSMETIC_LOGO_TOGGLES,
        checkType,
        openIssues:      [],
        guidelines:      [],
      })

      // Deterministic post-checks (zero-cost)
      const aiFieldsLc  = new Set((res.items || []).map(i => (i.field || '').toLowerCase()))
      const detFindings = runDeterministicChecks({ track, text: res.extracted_text || '' })
        .filter(f => !aiFieldsLc.has((f.field || '').toLowerCase().replace(/ \(deterministic\)$/, '')))
      if (detFindings.length) {
        res.items = [...(res.items || []), ...detFindings]
        const b = res.items.filter(i => i.severity === 'blocker' || (!i.severity && i.status === 'FAIL')).length
        const m = res.items.filter(i => i.severity === 'major').length
        const a = res.items.filter(i => i.severity === 'advisory' || (!i.severity && i.status === 'WARNING')).length
        res.counts  = { blockers: b, majors: m, advisories: a }
        res.verdict = b > 0 ? 'FAIL' : m > 0 ? 'REVIEW_REQUIRED' : (res.verdict || 'PASS')
      }

      setItems(prev => prev.map((x, i) => i === itemIdx ? { ...x, status: 'done', result: res } : x))
    } catch (ex) {
      setItems(prev => prev.map((x, i) => i === itemIdx ? { ...x, status: 'error', error: ex.message } : x))
    }
  }

  // ── Run all with concurrency limit ─────────────────────────────────────
  async function runAll() {
    if (!items.length) { setError('Add at least one label image.'); return }
    setError('')
    setRunning(true)

    // Kick off a rolling window of MAX_CONCURRENT
    const queue = items.map((_, i) => i)
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, () => worker())
    async function worker() {
      while (queue.length) {
        const idx = queue.shift()
        await runOne(idx)
      }
    }
    await Promise.all(workers)
    setRunning(false)
  }

  // ── Save all completed results as N checks + one check_batches row ─────
  async function saveAll() {
    const done = items.filter(it => it.status === 'done' && it.result)
    if (!done.length) { setError('No successful results to save.'); return }
    setRunning(true)
    setError('')

    try {
      // Create the batch row first
      const { data: batchRow, error: bErr } = await supabase.from('check_batches').insert({
        user_id:    user.id,
        project_id: projectId || null,
        batch_name: batchName.trim() || `Batch of ${done.length} · ${new Date().toLocaleDateString()}`,
        track,
        check_type: checkType,
        total:      items.length,
        completed:  done.length,
        failed:     items.filter(it => it.status === 'error').length,
      }).select().single()
      if (bErr) throw bErr
      setBatchId(batchRow.id)

      // Upload each label + insert a check row, in parallel
      await Promise.all(items.map(async (it, idx) => {
        if (it.status !== 'done' || !it.result) return
        const ext      = it.file.name.split('.').pop()
        const path     = `${user.id}/batch-${batchRow.id}/${idx}-${Date.now()}.${ext}`
        const { data: up, error: upErr } = await supabase.storage.from('labels').upload(path, it.file, { contentType: it.file.type })
        if (upErr) throw upErr

        const r      = it.result
        const items_ = r.items || []
        const b = items_.filter(i => i.severity === 'blocker' || (!i.severity && i.status === 'FAIL')).length
        const m = items_.filter(i => i.severity === 'major').length
        const a = items_.filter(i => i.severity === 'advisory' || (!i.severity && i.status === 'WARNING')).length
        const derivedScore = Math.max(0, 100 - (b * 30 + m * 10 + a * 2))

        const { data: check, error: insErr } = await supabase.from('checks').insert({
          user_id:          user.id,
          product_name:     it.file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(),
          track,
          check_type:       checkType,
          verdict:          r.verdict,
          score:            r.score ?? derivedScore,
          summary:          r.summary,
          report_json:      items_,
          front_file_path:  up?.path,
          label_file_path:  up?.path,   // backward compat
          label_file_name:  it.file.name,
          project_id:       projectId || null,
          batch_id:         batchRow.id,
        }).select().single()
        if (insErr) throw insErr

        setItems(prev => prev.map((x, i) => i === idx ? { ...x, savedCheckId: check.id } : x))
      }))
    } catch (ex) {
      setError('Save failed: ' + ex.message)
    } finally {
      setRunning(false)
    }
  }

  const doneCount    = items.filter(it => it.status === 'done').length
  const errorCount   = items.filter(it => it.status === 'error').length
  const anySaved     = items.some(it => it.savedCheckId)
  const canSave      = doneCount > 0 && !running && !anySaved

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Header ── */}
      <div className="track-selector-card" style={{
        background: isDrug ? 'var(--drug-bg)' : 'var(--cosmetic-bg)',
        borderColor: isDrug ? 'var(--drug-border)' : 'var(--cosmetic-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="track-selector-label">Batch Compliance Check</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Upload multiple SKU artworks. Each runs through the same {isDrug ? 'Drug' : 'Cosmetic'} track rules, results in one place.
            </div>
          </div>
          <div className="track-toggle">
            <button className={`track-btn cosmetic${!isDrug ? ' active' : ''}`} onClick={() => setTrack('cosmetic')}>🧴 Cosmetic</button>
            <button className={`track-btn drug${isDrug ? ' active' : ''}`}       onClick={() => setTrack('drug')}>💊 Drug / OTC</button>
          </div>
        </div>
      </div>

      {/* ── Batch config ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label">Batch name (optional)</label>
            <input className="form-input" placeholder={`e.g. Q3 Sunscreen Range`}
              value={batchName} onChange={e => setBatchName(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Link to project (optional)</label>
            <select className="form-select" value={projectId || ''} onChange={e => setProjectId(e.target.value || null)}>
              <option value="">— No project —</option>
              {projects.filter(p => !p.track || p.track === track).map(p => (
                <option key={p.id} value={p.id}>{p.product_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Check type</label>
            <select className="form-select" value={checkType} onChange={e => setCheckType(e.target.value)}>
              <option value="pre-print">Pre-Print (digital artwork)</option>
              <option value="post-print">Post-Print (physical scan)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── File upload ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Label artworks — {items.length} file{items.length !== 1 ? 's' : ''}</span>
          {items.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={clearAll} disabled={running}>Clear all</button>
          )}
        </div>
        <div className="card-body">
          <div
            className="upload-zone"
            style={{ padding: 32, cursor: running ? 'not-allowed' : 'pointer', opacity: running ? .5 : 1 }}
            onClick={() => !running && inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (!running) onFilesPicked(e.dataTransfer.files) }}
          >
            <div className="upload-icon" style={{ fontSize: 32 }}>📥</div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Drop label images here or click to browse</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Add all SKUs of a range at once. Each is one Claude API call — max {MAX_CONCURRENT} run in parallel.
            </p>
            <input ref={inputRef} type="file" multiple hidden accept="image/*"
              onChange={e => onFilesPicked(e.target.files)} />
          </div>

          {error && <div className="error-msg" style={{ marginTop: 10 }}>{error}</div>}

          {items.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={runAll}
                disabled={running || items.every(it => it.status === 'done')}
              >
                {running
                  ? <><span className="spinner" /> Running… ({doneCount}/{items.length} done{errorCount > 0 ? `, ${errorCount} failed` : ''})</>
                  : `⚡ Run ${items.length} Check${items.length !== 1 ? 's' : ''}`}
              </button>
              {canSave && (
                <button className="btn btn-success btn-lg" onClick={saveAll}>
                  💾 Save {doneCount} to History
                </button>
              )}
              {anySaved && batchId && (
                <button className="btn" onClick={() => navigate(`/history`)}>
                  View in History →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Results grid ── */}
      {items.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Results</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {doneCount} done · {items.filter(it => it.status === 'running').length} running · {items.filter(it => it.status === 'queued').length} queued · {errorCount} failed
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Thumb</th>
                  <th>SKU / File</th>
                  <th style={{ width: 100 }}>Verdict</th>
                  <th style={{ width: 220 }}>Severity</th>
                  <th style={{ width: 140 }}>Summary</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => <BatchRow key={idx} it={it} onRemove={() => removeItem(idx)} running={running} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function BatchRow({ it, onRemove, running }) {
  const r      = it.result
  const items_ = r?.items || []
  const b = items_.filter(i => i.severity === 'blocker' || (!i.severity && i.status === 'FAIL')).length
  const m = items_.filter(i => i.severity === 'major').length
  const a = items_.filter(i => i.severity === 'advisory' || (!i.severity && i.status === 'WARNING')).length

  return (
    <tr>
      <td>
        {it.preview && <img src={it.preview} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />}
      </td>
      <td style={{ fontSize: 12, wordBreak: 'break-word' }}>
        {it.file.name}
        {it.savedCheckId && (
          <div style={{ fontSize: 10, color: 'var(--pass)', marginTop: 2 }}>
            ✓ Saved · <a href={`/checks/${it.savedCheckId}`} style={{ color: 'var(--accent)' }}>view report</a>
          </div>
        )}
      </td>
      <td>
        {it.status === 'queued'  && <span className="badge badge-gray">Queued</span>}
        {it.status === 'running' && <span className="badge badge-gray"><span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Running</span>}
        {it.status === 'error'   && <span className="badge badge-fail">Error</span>}
        {it.status === 'done'    && (
          r?.verdict === 'PASS' ? <span className="badge badge-pass">PASS</span>
          : r?.verdict === 'FAIL' ? <span className="badge badge-fail">FAIL</span>
          : <span className="badge badge-warn">REVIEW</span>
        )}
      </td>
      <td>
        {it.status === 'done' ? (
          <div style={{ display: 'flex', gap: 4, fontSize: 11 }}>
            <span style={{ color: b > 0 ? '#b91c1c' : 'var(--text-3)', fontWeight: b > 0 ? 700 : 400 }}>{b} blockers</span>
            <span style={{ color: 'var(--text-3)' }}>·</span>
            <span style={{ color: m > 0 ? '#b45309' : 'var(--text-3)', fontWeight: m > 0 ? 700 : 400 }}>{m} majors</span>
            <span style={{ color: 'var(--text-3)' }}>·</span>
            <span style={{ color: 'var(--text-3)' }}>{a} advisories</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>
        )}
      </td>
      <td style={{ fontSize: 11, color: 'var(--text-3)' }}>
        {it.status === 'error' ? <span style={{ color: 'var(--fail)' }}>{it.error}</span>
         : it.status === 'done' ? (r?.summary || '').slice(0, 80) + ((r?.summary || '').length > 80 ? '…' : '')
         : ''}
      </td>
      <td>
        {!running && !it.savedCheckId && (
          <button className="btn btn-sm btn-ghost" onClick={onRemove} title="Remove">✕</button>
        )}
      </td>
    </tr>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
