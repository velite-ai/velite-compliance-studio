import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import TrackBadge from '../../components/TrackBadge'
import QCStatusBadge from '../../components/QCStatusBadge'
import {
  DISPOSITIONS, materialType, entityForTrack, severity,
  evalParam, expectedLabel, overallResult,
} from '../../lib/qc'
import { suggestQCAnalysis } from '../../lib/anthropic'
import { generateCOAPDF } from '../../lib/reports'
import { format, parseISO } from 'date-fns'

export default function BatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [batch, setBatch]   = useState(null)
  const [spec, setSpec]     = useState(null)
  const [tests, setTests]   = useState([])
  const [loading, setLoading] = useState(true)

  const [inputs, setInputs] = useState({})   // { idx: { result, note } }
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  const [allSpecs, setAllSpecs] = useState([])
  const [ai, setAi] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data: b } = await supabase.from('qc_batches').select('*').eq('id', id).single()
    setBatch(b)
    if (b?.spec_id) {
      const { data: s } = await supabase.from('qc_specifications').select('*').eq('id', b.spec_id).single()
      setSpec(s)
    } else {
      setSpec(null)
      const { data: list } = await supabase.from('qc_specifications').select('id, name, track, material_type, parameters')
        .eq('is_active', true).eq('track', b?.track || 'cosmetic')
      setAllSpecs(list || [])
    }
    const { data: t } = await supabase.from('qc_tests').select('*').eq('batch_id', id).order('tested_at', { ascending: false })
    setTests(t || [])

    // Prefill inputs from the latest test
    if (t && t.length) {
      const seed = {}
      t[0].results.forEach((r, i) => { seed[i] = { result: r.result ?? '', note: r.note ?? '' } })
      setInputs(seed)
    }
    setLoading(false)
  }

  const params = spec?.parameters || []
  const setInput = (i, field, v) => setInputs(s => ({ ...s, [i]: { ...(s[i] || {}), [field]: v } }))

  // Live-evaluated rows
  const rows = params.map((p, i) => {
    const result = inputs[i]?.result ?? ''
    return { ...p, idx: i, result, note: inputs[i]?.note ?? '', pass: evalParam(p, result) }
  })
  const liveOverall = overallResult(rows)
  const failedRows = rows.filter(r => r.pass === false)
  const latestTest = tests[0]

  async function attachSpec(specId) {
    if (!specId) return
    await supabase.from('qc_batches').update({ spec_id: specId }).eq('id', id)
    load()
  }

  async function saveResults() {
    setSaving(true); setSavedMsg('')
    const results = rows.map(r => ({
      name: r.name, method: r.method || '', expected: expectedLabel(r),
      unit: r.unit || '', severity: r.severity || 'major', result: r.result, pass: r.pass, note: r.note,
    }))
    const overall = overallResult(rows)
    const summary = overall === 'fail'
      ? `${failedRows.length} of ${rows.length} parameters out of specification.`
      : overall === 'pass'
        ? `All ${rows.length} parameters within specification.`
        : `${rows.filter(r => r.pass === null).length} parameter(s) pending result.`

    const { error: err } = await supabase.from('qc_tests').insert({
      batch_id: id, results, overall_result: overall, summary, tested_by: user.id,
    })
    if (err) { setSavedMsg('Error: ' + err.message); setSaving(false); return }

    // Move a draft batch into testing once results exist
    if (batch.status === 'draft') {
      await supabase.from('qc_batches').update({ status: 'in_test' }).eq('id', id)
    }
    setSavedMsg('Results saved.')
    setSaving(false)
    setAi(null)
    load()
  }

  async function runAI() {
    setAiLoading(true); setAi(null)
    try {
      const { data: past } = await supabase.from('qc_deviations')
        .select('title, root_cause')
        .eq('batch_id', id).limit(5)
      const out = await suggestQCAnalysis({
        track: batch.track,
        productName: batch.product_name,
        materialType: batch.material_type,
        batchNo: batch.batch_no,
        failedParams: failedRows.map(r => ({ name: r.name, expected: expectedLabel(r), result: r.result, severity: r.severity, note: r.note })),
        pastIssues: past || [],
      })
      setAi(out)
    } catch (e) {
      setAi({ error: e.message })
    }
    setAiLoading(false)
  }

  async function raiseDeviation() {
    const title = `Out-of-spec: ${failedRows.map(r => r.name).join(', ')}`.slice(0, 120)
    const sev = failedRows.some(r => r.severity === 'critical') ? 'critical'
      : failedRows.some(r => r.severity === 'major') ? 'major' : 'minor'
    const description = failedRows.map(r => `${r.name}: expected ${expectedLabel(r)}, got "${r.result}"`).join('\n')
    const { data: dev, error: err } = await supabase.from('qc_deviations').insert({
      user_id: user.id, batch_id: id, title, description, severity: sev, source: 'qc_test',
      root_cause: ai?.root_cause || null, status: 'open', raised_by: user.id,
    }).select().single()
    if (err) { alert('Error: ' + err.message); return }

    // Seed CAPA from AI suggestions if present
    if (ai?.capa?.length) {
      await supabase.from('qc_capa').insert(
        ai.capa.map(c => ({
          user_id: user.id, deviation_id: dev.id,
          action_type: c.action_type === 'preventive' ? 'preventive' : 'corrective',
          description: c.description, status: 'open',
        }))
      )
    }
    navigate('/qc/deviations')
  }

  async function disposition(value) {
    const action = DISPOSITIONS.find(d => d.value === value)
    const notes = prompt(`${action.label} batch ${batch.batch_no}.\nAdd a disposition note (optional):`, '')
    if (notes === null) return // cancelled
    await supabase.from('qc_batches').update({
      status: value, disposition_notes: notes || null, disposition_by: user.id, disposition_at: new Date().toISOString(),
    }).eq('id', id)
    load()
  }

  async function exportCOA() {
    if (!latestTest) return
    const doc = await generateCOAPDF(batch, latestTest, {
      specName: spec?.name || '—',
      entityName: entityForTrack(batch.track).name,
      testedByName: profile?.full_name || '',
    })
    doc.save(`COA-${batch.batch_no}.pdf`)
  }

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading batch…</div>
  if (!batch) return <div className="card"><div className="empty-state"><h3>Batch not found</h3><Link to="/qc/batches" className="btn">← Back</Link></div></div>

  const mt = materialType(batch.material_type)
  const ent = entityForTrack(batch.track)
  const canDisposition = batch.status !== 'released' && batch.status !== 'rejected'

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/qc/batches')}>← Back to Batches</button>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <h2 style={{ margin: 0 }}>{batch.product_name}</h2>
                <QCStatusBadge status={batch.status} size="lg" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-gray">Batch {batch.batch_no}</span>
                <TrackBadge track={batch.track} />
                <span className="pkg-badge">{mt.icon} {mt.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{ent.name}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-3)' }}>
              {batch.supplier && <div>Supplier: <b style={{ color: 'var(--text-2)' }}>{batch.supplier}</b></div>}
              {batch.quantity != null && <div>Qty: <b style={{ color: 'var(--text-2)' }}>{batch.quantity} {batch.uom}</b></div>}
              {batch.mfg_date && <div>Mfg: {batch.mfg_date}</div>}
              {batch.expiry_date && <div>Exp: {batch.expiry_date}</div>}
            </div>
          </div>
          {batch.disposition_at && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
              Disposition recorded {format(parseISO(batch.disposition_at), 'dd MMM yyyy, HH:mm')}
              {batch.disposition_notes ? ` — ${batch.disposition_notes}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* No spec attached */}
      {!spec && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Attach a Specification</span></div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 10 }}>
              This batch has no specification yet. Attach one to record test results against defined limits.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <select className="form-select" style={{ maxWidth: 380 }} defaultValue="" onChange={e => attachSpec(e.target.value)}>
                <option value="" disabled>— Select a specification —</option>
                {allSpecs.map(s => <option key={s.id} value={s.id}>{s.name} · {(s.parameters || []).length} params</option>)}
              </select>
              <Link to="/qc/specs/new" className="btn">＋ Create a spec</Link>
            </div>
          </div>
        </div>
      )}

      {/* Results entry */}
      {spec && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">QC Test — {spec.name}</span>
            <span className={`badge ${liveOverall === 'pass' ? 'badge-pass' : liveOverall === 'fail' ? 'badge-fail' : 'badge-gray'}`}>
              {liveOverall === 'pass' ? '✓ Within spec' : liveOverall === 'fail' ? `✗ ${failedRows.length} out of spec` : 'Pending'}
            </span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Specification</th>
                    <th style={{ width: 180 }}>Result</th>
                    <th style={{ width: 160 }}>Note</th>
                    <th style={{ width: 70 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const sev = severity(r.severity)
                    return (
                      <tr key={r.idx}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {r.method ? `${r.method} · ` : ''}<span className={`badge ${sev.badge}`} style={{ padding: '0 6px' }}>{sev.label}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{expectedLabel(r)}</td>
                        <td>
                          {r.type === 'boolean' ? (
                            <select className="form-select" value={r.result} onChange={e => setInput(r.idx, 'result', e.target.value)}>
                              <option value="">—</option>
                              <option value="pass">Pass</option>
                              <option value="fail">Fail</option>
                            </select>
                          ) : (
                            <input className="form-input" placeholder="Enter result"
                              value={r.result} onChange={e => setInput(r.idx, 'result', e.target.value)} />
                          )}
                        </td>
                        <td>
                          <input className="form-input" placeholder="optional"
                            value={r.note} onChange={e => setInput(r.idx, 'note', e.target.value)} />
                        </td>
                        <td>
                          {r.pass === true ? <span className="badge badge-pass">✓</span>
                            : r.pass === false ? <span className="badge badge-fail">✗</span>
                            : <span className="badge badge-gray">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={saveResults} disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : '💾 Save Results'}
              </button>
              {failedRows.length > 0 && (
                <button className="btn" onClick={runAI} disabled={aiLoading}>
                  {aiLoading ? <><span className="spinner" /> Analysing…</> : '✨ AI: root cause & CAPA'}
                </button>
              )}
              {savedMsg && <span style={{ fontSize: 13, color: savedMsg.startsWith('Error') ? 'var(--fail)' : 'var(--pass)' }}>{savedMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {/* AI assist output */}
      {ai && !ai.error && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--review)' }}>
          <div className="card-header"><span className="card-title">✨ AI Analysis</span></div>
          <div className="card-body">
            <p style={{ fontSize: 13, marginBottom: 8 }}><b>Likely root cause:</b> {ai.root_cause}</p>
            {ai.disposition && (
              <p style={{ fontSize: 13, marginBottom: 10 }}>
                <b>Suggested disposition:</b> <span className="badge badge-warn">{ai.disposition}</span> — {ai.disposition_reason}
              </p>
            )}
            {ai.capa?.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>SUGGESTED CAPA</div>
                {ai.capa.map((c, i) => (
                  <div key={i} className="issue-card" style={{ marginBottom: 6 }}>
                    <span className="badge badge-gray" style={{ marginRight: 6 }}>{c.action_type}</span>
                    <span style={{ fontSize: 13 }}>{c.description}</span>
                  </div>
                ))}
              </>
            )}
            <button className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={raiseDeviation}>
              ⚠ Raise deviation with these CAPAs
            </button>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>AI suggestions are advisory — verify before acting.</p>
          </div>
        </div>
      )}
      {ai?.error && <div className="error-msg" style={{ marginBottom: 16 }}>AI error: {ai.error}</div>}

      {/* Actions: deviation (manual) + disposition + COA */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Disposition & Output</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: failedRows.length || latestTest ? 14 : 0 }}>
            {canDisposition
              ? DISPOSITIONS.map(d => (
                  <button key={d.value} className={`btn ${d.cls}`} onClick={() => disposition(d.value)} title={d.desc}>
                    {d.icon} {d.label}
                  </button>
                ))
              : <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Batch is {batch.status}. Disposition is locked.</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {failedRows.length > 0 && (
              <button className="btn" onClick={raiseDeviation} style={{ color: 'var(--fail)' }}>⚠ Raise Deviation</button>
            )}
            {latestTest && <button className="btn" onClick={exportCOA}>📄 Download COA (PDF)</button>}
          </div>
        </div>
      </div>

      {/* Test history */}
      {tests.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Test History</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tested</th><th>Result</th><th>Summary</th></tr></thead>
              <tbody>
                {tests.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {t.tested_at ? format(parseISO(t.tested_at), 'dd MMM yyyy, HH:mm') : '—'}
                    </td>
                    <td>
                      {t.overall_result === 'pass' ? <span className="badge badge-pass">✓ Pass</span>
                        : t.overall_result === 'fail' ? <span className="badge badge-fail">✗ Fail</span>
                        : <span className="badge badge-gray">Pending</span>}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{t.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
