import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { analyseLabel } from '../lib/anthropic'
import {
  PRODUCT_CATEGORIES,
  REGULATION_TOGGLES,
  DRUG_PRODUCT_CATEGORIES,
  DRUG_REGULATION_TOGGLES,
  DRUG_REGULATION_DEFAULTS,
  COSMETIC_LOGO_TOGGLES,
  COSMETIC_LOGO_DEFAULTS,
  DRUG_LOGO_TOGGLES,
  DRUG_LOGO_DEFAULTS,
} from '../lib/regulations'
import ScoreCircle from '../components/ScoreCircle'
import VerdictBadge from '../components/VerdictBadge'
import TrackBadge from '../components/TrackBadge'
import CheckTypeBadge from '../components/CheckTypeBadge'

const COSMETIC_REG_DEFAULTS = { cosmetics: true, weights: true, claims: true, ingredients: true }

export default function NewCheck() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const frontRef = useRef()
  const backRef  = useRef()

  // ── Track & check type ────────────────────────────────────────────────
  const [track,     setTrack]     = useState('cosmetic')
  const [checkType, setCheckType] = useState('pre-print')

  // ── Dual file upload ──────────────────────────────────────────────────
  const [frontFile,    setFrontFile]    = useState(null)
  const [frontPreview, setFrontPreview] = useState(null)
  const [backFile,     setBackFile]     = useState(null)
  const [backPreview,  setBackPreview]  = useState(null)
  const [frontDrag,    setFrontDrag]    = useState(false)
  const [backDrag,     setBackDrag]     = useState(false)

  // ── Form state ────────────────────────────────────────────────────────
  const [productName,  setProductName]  = useState('')
  const [category,     setCategory]     = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [regs,         setRegs]         = useState(COSMETIC_REG_DEFAULTS)
  const [logoChecks,   setLogoChecks]   = useState(COSMETIC_LOGO_DEFAULTS)
  const [styleRules,   setStyleRules]   = useState([])

  // ── Project & memory state ────────────────────────────────────────────
  const [projects,          setProjects]          = useState([])
  const [projectId,         setProjectId]         = useState(null)
  const [openMemoryIssues,  setOpenMemoryIssues]  = useState([])
  const [activeGuidelines,  setActiveGuidelines]  = useState([])

  // ── Async state ───────────────────────────────────────────────────────
  const [analysing, setAnalysing] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [result,    setResult]    = useState(null)
  const [savedId,   setSavedId]   = useState(null)
  const [error,     setError]     = useState('')

  useEffect(() => {
    // Load active style rules
    supabase.from('style_rules').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setStyleRules(data)
    })
    // Load user projects for the selector
    supabase.from('projects').select('id, product_name, track, category').eq('is_archived', false)
      .order('updated_at', { ascending: false }).then(({ data }) => {
      if (data) setProjects(data)
    })
    // Load active internal guidelines
    supabase.from('internal_guidelines').select('title, summary, full_content, category, applies_to_track')
      .eq('is_active', true).then(({ data }) => {
      if (data) setActiveGuidelines(data)
    })
  }, [])

  // Load product memory when project changes
  useEffect(() => {
    if (!projectId) { setOpenMemoryIssues([]); return }
    supabase.from('product_memory').select('*').eq('project_id', projectId).eq('is_resolved', false)
      .then(({ data }) => { setOpenMemoryIssues(data || []) })
  }, [projectId])

  // Reset category + regs when track changes
  function switchTrack(newTrack) {
    setTrack(newTrack)
    setCategory('')
    setRegs(newTrack === 'drug' ? DRUG_REGULATION_DEFAULTS : COSMETIC_REG_DEFAULTS)
    setLogoChecks(newTrack === 'drug' ? DRUG_LOGO_DEFAULTS : COSMETIC_LOGO_DEFAULTS)
    setResult(null)
    setSavedId(null)
  }

  const categories    = track === 'drug' ? DRUG_PRODUCT_CATEGORIES : PRODUCT_CATEGORIES
  const regToggles    = track === 'drug' ? DRUG_REGULATION_TOGGLES : REGULATION_TOGGLES
  const logoToggles   = track === 'drug' ? DRUG_LOGO_TOGGLES : COSMETIC_LOGO_TOGGLES
  const isDrug        = track === 'drug'
  const activeLogoCount = Object.values(logoChecks).filter(Boolean).length

  // ── File helpers ──────────────────────────────────────────────────────
  function loadFile(f, setFile, setPreview) {
    if (!f || !f.type.startsWith('image/')) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(f)
    setResult(null)
    setSavedId(null)
  }

  function clearFront() {
    setFrontFile(null); setFrontPreview(null)
    setResult(null); setSavedId(null)
  }

  function clearBack() {
    setBackFile(null); setBackPreview(null)
    setResult(null); setSavedId(null)
  }

  // ── Run check ─────────────────────────────────────────────────────────
  async function runCheck() {
    if (!frontFile)         { setError('Please upload the front face of the label.'); return }
    if (!productName.trim()) { setError('Please enter a product name.'); return }
    setError('')
    setAnalysing(true)
    setResult(null)

    try {
      const frontBase64 = await fileToBase64(frontFile)
      const backBase64  = backFile ? await fileToBase64(backFile) : null

      // Filter guidelines relevant to this track
      const relevantGuidelines = activeGuidelines.filter(
        g => g.applies_to_track === 'both' || g.applies_to_track === track
      )

      const res = await analyseLabel({
        base64:      frontBase64,
        mimeType:    frontFile.type,
        backBase64,
        backMimeType:    backFile?.type || null,
        productName,
        productCategory: category,
        extraContext,
        regulations:     regs,
        styleRules,
        track,
        logoChecks,
        logoTogglesDefs: logoToggles,
        checkType,
        openIssues:  openMemoryIssues,
        guidelines:  relevantGuidelines,
      })
      setResult(res)
    } catch (ex) {
      setError('Analysis failed: ' + ex.message)
    } finally {
      setAnalysing(false)
    }
  }

  // ── Save check ────────────────────────────────────────────────────────
  async function saveCheck() {
    if (!result || !user) return
    setSaving(true)
    setError('')

    try {
      // Upload front
      const frontExt  = frontFile.name.split('.').pop()
      const frontName = `${user.id}/${Date.now()}-front.${frontExt}`
      const { data: frontUp } = await supabase.storage.from('labels').upload(frontName, frontFile, { contentType: frontFile.type })
      const frontPath = frontUp?.path || null

      // Upload back (optional)
      let backPath = null
      if (backFile) {
        const backExt  = backFile.name.split('.').pop()
        const backName = `${user.id}/${Date.now()}-back.${backExt}`
        const { data: backUp } = await supabase.storage.from('labels').upload(backName, backFile, { contentType: backFile.type })
        backPath = backUp?.path || null
      }

      const { data: check, error: insErr } = await supabase.from('checks').insert({
        user_id:            user.id,
        product_name:       productName,
        product_category:   category || null,
        track,
        check_type:         checkType,
        verdict:            result.verdict,
        score:              result.score,
        summary:            result.summary,
        report_json:        result.items || [],
        regulations_checked: Object.keys(regs).filter(k => regs[k]),
        // Dual upload fields
        front_file_path:    frontPath,
        back_file_path:     backPath,
        back_file_name:     backFile?.name || null,
        // Backward compat: label_file_path = front
        label_file_path:    frontPath,
        label_file_name:    frontFile.name,
        extra_context:      extraContext || null,
        // Project link
        project_id:         projectId || null,
      }).select().single()

      if (insErr) throw insErr

      // Auto-save style suggestions
      if (result.style_suggestions?.length && check) {
        const rules = result.style_suggestions.map(s => ({
          category: s.category || 'general',
          title: s.title,
          description: s.description,
          source: 'auto-learned',
          is_active: true,
          created_by: user.id,
          check_id: check.id,
          project_id: projectId || null,
        }))
        await supabase.from('style_rules').insert(rules)
      }

      // ── Product memory update ────────────────────────────────────────
      if (projectId && result.items?.length) {
        const passFields = result.items.filter(i => i.status === 'PASS').map(i => i.field)
        const failFields = result.items.filter(i => i.status === 'FAIL').map(i => i.field)

        // Auto-resolve memory issues that now pass
        const toResolve = openMemoryIssues.filter(m => passFields.includes(m.field))
        if (toResolve.length) {
          await supabase.from('product_memory')
            .update({ is_resolved: true })
            .in('id', toResolve.map(m => m.id))
        }

        // Add new FAIL items not already in memory
        const trackedFields = openMemoryIssues.map(m => m.field)
        const newFails = result.items.filter(
          i => i.status === 'FAIL' && !trackedFields.includes(i.field)
        )
        if (newFails.length) {
          await supabase.from('product_memory').insert(newFails.map(item => ({
            project_id:      projectId,
            issue_title:     item.field,
            regulation:      item.regulation || null,
            field:           item.field,
            original_finding: item.issue || item.found || '',
            is_resolved:     false,
          })))
        }
      }

      setSavedId(check.id)
    } catch (ex) {
      setError('Save failed: ' + ex.message)
    } finally {
      setSaving(false)
    }
  }

  async function approveAndSave() {
    await saveCheck()
    if (savedId) {
      await supabase.from('checks').update({
        is_approved:  true,
        approved_at:  new Date().toISOString(),
        approved_by:  user.id,
      }).eq('id', savedId)
      navigate(`/checks/${savedId}`)
    }
  }

  const allItems  = result?.items || []
  const logoItems = allItems.filter(i => i.regulation === 'Logo / Mark Check')
  const regItems  = allItems.filter(i => i.regulation !== 'Logo / Mark Check')
  const failItems = regItems.filter(i => i.status === 'FAIL')
  const warnItems = regItems.filter(i => i.status === 'WARNING')
  const passItems = regItems.filter(i => i.status === 'PASS')
  const logoFail  = logoItems.filter(i => i.status === 'FAIL')
  const logoWarn  = logoItems.filter(i => i.status === 'WARNING')
  const logoPass  = logoItems.filter(i => i.status === 'PASS')

  return (
    <div>

      {/* ── TRACK SELECTOR — most prominent UI element ── */}
      <div
        className="track-selector-card"
        style={{
          background: isDrug ? 'var(--drug-bg)' : 'var(--cosmetic-bg)',
          borderColor: isDrug ? 'var(--drug-border)' : 'var(--cosmetic-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="track-selector-label">Regulatory Track</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {isDrug
                ? 'Checking against Drugs & Cosmetics Rules 1945 (Drug labelling requirements)'
                : 'Checking against Cosmetics Rules 2020 (Cosmetic label declarations)'}
            </div>
          </div>
          <div className="track-toggle">
            <button
              className={`track-btn cosmetic${!isDrug ? ' active' : ''}`}
              onClick={() => switchTrack('cosmetic')}
            >
              🧴 Cosmetic
            </button>
            <button
              className={`track-btn drug${isDrug ? ' active' : ''}`}
              onClick={() => switchTrack('drug')}
            >
              💊 Drug / OTC
            </button>
          </div>
        </div>
      </div>

      {/* ── CHECK TYPE SELECTOR ── */}
      <div className="check-type-card">
        <div>
          <div className="track-selector-label">Check Type</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {checkType === 'pre-print'
              ? 'Pre-print: reviewing design proof or digital artwork before printing'
              : 'Post-print: verifying a physically printed label or carton scan'}
          </div>
        </div>
        <div className="track-toggle">
          <button
            className={`track-btn pre-print${checkType === 'pre-print' ? ' active' : ''}`}
            onClick={() => setCheckType('pre-print')}
          >
            📐 Pre-Print
          </button>
          <button
            className={`track-btn post-print${checkType === 'post-print' ? ' active' : ''}`}
            onClick={() => setCheckType('post-print')}
          >
            🖨️ Post-Print
          </button>
        </div>
      </div>

      {/* ── PROJECT LINK ── */}
      <div className="check-type-card" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="track-selector-label">Link to Project</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {projectId
              ? openMemoryIssues.length > 0
                ? `🧠 ${openMemoryIssues.length} open issue${openMemoryIssues.length !== 1 ? 's' : ''} from previous versions will be verified`
                : '✓ No unresolved issues from previous versions'
              : 'Optional — link this check to a project to enable product memory and version tracking'}
          </div>
        </div>
        <select
          className="form-select"
          value={projectId || ''}
          onChange={e => setProjectId(e.target.value || null)}
          style={{ minWidth: 220, maxWidth: 320 }}
        >
          <option value="">— No project (standalone check) —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.product_name}{p.category ? ` · ${p.category}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* ── MAIN 2-COL GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT: Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── DUAL UPLOAD ── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Label / Artwork</span>
              {frontFile && backFile && (
                <span style={{ fontSize: 11, color: 'var(--pass)', fontWeight: 600 }}>✓ Both faces uploaded</span>
              )}
              {frontFile && !backFile && (
                <span style={{ fontSize: 11, color: 'var(--warn)' }}>Front only — add back face for full check</span>
              )}
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              {/* Front Face */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Front Face <span style={{ color: 'var(--fail)' }}>*</span>
                </div>
                {!frontFile ? (
                  <div
                    className={`upload-zone${frontDrag ? ' drag-over' : ''}`}
                    style={{ padding: '24px 12px' }}
                    onDragOver={e => { e.preventDefault(); setFrontDrag(true) }}
                    onDragLeave={() => setFrontDrag(false)}
                    onDrop={e => { e.preventDefault(); setFrontDrag(false); loadFile(e.dataTransfer.files[0], setFrontFile, setFrontPreview) }}
                    onClick={() => frontRef.current.click()}
                  >
                    <div className="upload-icon" style={{ fontSize: 24 }}>🖼️</div>
                    <p style={{ fontSize: 11 }}>Drop or click to upload</p>
                    <input ref={frontRef} type="file" hidden accept="image/*"
                      onChange={e => loadFile(e.target.files[0], setFrontFile, setFrontPreview)} />
                  </div>
                ) : (
                  <div>
                    <img src={frontPreview} alt="Front" className="label-preview" style={{ maxHeight: 160 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {frontFile.name}
                      </span>
                      <button className="btn btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={clearFront}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Back Face */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Back Face <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span>
                </div>
                {!backFile ? (
                  <div
                    className={`upload-zone${backDrag ? ' drag-over' : ''}`}
                    style={{ padding: '24px 12px', borderStyle: 'dashed', opacity: .8 }}
                    onDragOver={e => { e.preventDefault(); setBackDrag(true) }}
                    onDragLeave={() => setBackDrag(false)}
                    onDrop={e => { e.preventDefault(); setBackDrag(false); loadFile(e.dataTransfer.files[0], setBackFile, setBackPreview) }}
                    onClick={() => backRef.current.click()}
                  >
                    <div className="upload-icon" style={{ fontSize: 24 }}>🖼️</div>
                    <p style={{ fontSize: 11 }}>Drop or click to upload</p>
                    <input ref={backRef} type="file" hidden accept="image/*"
                      onChange={e => loadFile(e.target.files[0], setBackFile, setBackPreview)} />
                  </div>
                ) : (
                  <div>
                    <img src={backPreview} alt="Back" className="label-preview" style={{ maxHeight: 160 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {backFile.name}
                      </span>
                      <button className="btn btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={clearBack}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Product details */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Product Details</span>
              <TrackBadge track={track} />
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  className="form-input"
                  placeholder={isDrug
                    ? 'e.g. Velite Paracetamol Tablets IP 500 mg'
                    : 'e.g. Velite ClearSkin Sunscreen SPF 50'}
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{isDrug ? 'Dosage Form / Category' : 'Product Category'}</label>
                <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">— Select —</option>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notes / Context</label>
                <textarea
                  className="form-textarea"
                  placeholder={isDrug
                    ? 'e.g., This is a Schedule H drug. Verify Schedule H warning text and Rx symbol placement.'
                    : 'Any specific Velite conventions, house style preferences, or brand standards the AI should enforce.'}
                  value={extraContext}
                  onChange={e => setExtraContext(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Regulation toggles */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Regulations to Check</span>
            </div>
            <div className="card-body">
              <div className="toggle-group">
                {regToggles.map(({ key, label, sub, icon }) => (
                  <div
                    key={key}
                    className={`toggle-row${regs[key] ? ' active' : ''}`}
                    onClick={() => setRegs(r => ({ ...r, [key]: !r[key] }))}
                  >
                    <div className="toggle-info">
                      <span className="toggle-icon">{icon}</span>
                      <div>
                        <div className="toggle-label">{label}</div>
                        <div className="toggle-sub">{sub}</div>
                      </div>
                    </div>
                    <div className={`toggle-switch${regs[key] ? ' on' : ''}`} />
                  </div>
                ))}
              </div>
              {styleRules.length > 0 && (
                <p style={{ fontSize: 11, color: 'var(--pass)', marginTop: 10 }}>
                  ✓ {styleRules.length} Velite style rule{styleRules.length !== 1 ? 's' : ''} will also be applied
                </p>
              )}
              {activeGuidelines.filter(g => g.applies_to_track === 'both' || g.applies_to_track === track).length > 0 && (
                <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                  📚 {activeGuidelines.filter(g => g.applies_to_track === 'both' || g.applies_to_track === track).length} internal guideline{activeGuidelines.filter(g => g.applies_to_track === 'both' || g.applies_to_track === track).length !== 1 ? 's' : ''} injected
                </p>
              )}
            </div>
          </div>

          {/* Logo & Mark Checks */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Logo & Mark Checks</span>
              {activeLogoCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{activeLogoCount} active</span>
              )}
            </div>
            <div className="card-body">
              <div className="toggle-group">
                {logoToggles.map(({ key, label, sub, icon }) => (
                  <div
                    key={key}
                    className={`toggle-row${logoChecks[key] ? ' active' : ''}`}
                    onClick={() => setLogoChecks(l => ({ ...l, [key]: !l[key] }))}
                  >
                    <div className="toggle-info">
                      <span className="toggle-icon">{icon}</span>
                      <div>
                        <div className="toggle-label">{label}</div>
                        <div className="toggle-sub">{sub}</div>
                      </div>
                    </div>
                    <div className={`toggle-switch${logoChecks[key] ? ' on' : ''}`} />
                  </div>
                ))}
              </div>
              {activeLogoCount === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                  No logo checks active — enable toggles above to check for marks and symbols
                </p>
              )}
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="btn btn-primary btn-lg"
            style={{
              justifyContent: 'center',
              background: isDrug ? 'var(--drug)' : undefined,
              borderColor: isDrug ? 'var(--drug)' : undefined,
            }}
            onClick={runCheck}
            disabled={analysing || !frontFile}
          >
            {analysing
              ? <><span className="spinner" /> Analysing {backFile ? 'both faces' : 'label'}…</>
              : `⚡ Run ${isDrug ? 'Drug' : 'Cosmetic'} Compliance Check${backFile ? ' (Front + Back)' : ''}`}
          </button>
        </div>

        {/* RIGHT: Results */}
        <div>
          {!result && !analysing && (
            <div className="card">
              <div className="empty-state" style={{ padding: '48px 24px' }}>
                <div className="empty-icon">{isDrug ? '💊' : '🔍'}</div>
                <h3>No report yet</h3>
                <p>Upload the front face of the label (back face optional) and click Run to analyse against Indian {isDrug ? 'D&C Rules 1945' : 'Cosmetics Rules 2020'}.</p>
                <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
                  Uploading both faces gives a more complete check
                </p>
              </div>
            </div>
          )}

          {analysing && (
            <div className="card">
              <div className="loading-page" style={{ flexDirection: 'column', padding: '48px 24px' }}>
                <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>
                  Claude is reviewing {backFile ? 'both faces of' : 'the'} {isDrug ? 'drug' : 'cosmetic'} label…<br />
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>This usually takes 10–30 seconds</span>
                </p>
              </div>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Result header */}
              <div className="result-header">
                <ScoreCircle score={result.score || 0} size={96} />
                <div className="result-meta">
                  <div className="result-product">{productName}</div>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <VerdictBadge verdict={result.verdict} size="lg" />
                    <TrackBadge track={track} size="sm" />
                    <CheckTypeBadge checkType={checkType} />
                    {backFile && <span className="badge badge-gray">Front + Back</span>}
                    {category && <span className="badge badge-gray">{category}</span>}
                  </div>
                  <div className="result-summary">{result.summary}</div>
                </div>
              </div>

              {/* Issues */}
              {failItems.length > 0 && (
                <div className="issues-section">
                  <h3>❌ Failed ({failItems.length})</h3>
                  <div className="issue-list">
                    {failItems.map((item, i) => <IssueCard key={i} item={item} />)}
                  </div>
                </div>
              )}

              {warnItems.length > 0 && (
                <div className="issues-section">
                  <h3>⚠️ Warnings ({warnItems.length})</h3>
                  <div className="issue-list">
                    {warnItems.map((item, i) => <IssueCard key={i} item={item} />)}
                  </div>
                </div>
              )}

              {passItems.length > 0 && (
                <div className="issues-section">
                  <h3>✅ Passed ({passItems.length})</h3>
                  <div className="issue-list">
                    {passItems.map((item, i) => <IssueCard key={i} item={item} />)}
                  </div>
                </div>
              )}

              {/* Logo & Mark results */}
              {logoItems.length > 0 && (
                <div className="issues-section">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🔍 Logo & Mark Checks ({logoItems.length})</span>
                    {logoFail.length > 0 && <span className="badge badge-fail" style={{ fontSize: 10 }}>{logoFail.length} failed</span>}
                    {logoWarn.length > 0 && <span className="badge badge-warn" style={{ fontSize: 10 }}>{logoWarn.length} warn</span>}
                    {logoPass.length > 0 && <span className="badge badge-pass" style={{ fontSize: 10 }}>{logoPass.length} pass</span>}
                  </h3>
                  <div className="issue-list">
                    {logoItems.map((item, i) => <IssueCard key={i} item={item} />)}
                  </div>
                </div>
              )}

              {/* Actions */}
              {!savedId ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={saveCheck} disabled={saving}>
                    {saving ? <><span className="spinner" /> Saving…</> : '💾 Save Report'}
                  </button>
                  <button className="btn btn-success" onClick={approveAndSave} disabled={saving}>
                    ✓ Save & Approve Label
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={() => navigate(`/checks/${savedId}`)}>
                    View Full Report →
                  </button>
                  <button className="btn" onClick={() => {
                    setResult(null); setFrontFile(null); setFrontPreview(null)
                    setBackFile(null); setBackPreview(null)
                    setSavedId(null); setProductName(''); setCategory('')
                  }}>
                    New Check
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function IssueCard({ item }) {
  return (
    <div className={`issue-card ${item.status}`}>
      <div className="issue-header">
        <span className="issue-field">{item.field}</span>
        {item.regulation && <span className="issue-reg">{item.regulation}</span>}
      </div>
      {item.found && item.status !== 'PASS' && (
        <div className="issue-detail">Found: {item.found}</div>
      )}
      {item.issue && (
        <div className="issue-detail" style={{ marginTop: 3 }}>{item.issue}</div>
      )}
      {item.recommendation && (
        <div className="issue-rec">💡 {item.recommendation}</div>
      )}
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
