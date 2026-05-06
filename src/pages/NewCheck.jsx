import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { analyseLabel } from '../lib/anthropic'
import { PRODUCT_CATEGORIES, REGULATION_TOGGLES } from '../lib/regulations'
import ScoreCircle from '../components/ScoreCircle'
import VerdictBadge from '../components/VerdictBadge'

export default function NewCheck() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [regs, setRegs] = useState({ cosmetics: true, weights: true, claims: true, ingredients: true })
  const [styleRules, setStyleRules] = useState([])

  const [analysing, setAnalysing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('style_rules').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setStyleRules(data)
    })
  }, [])

  function handleFile(f) {
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(f)
    setResult(null)
    setSavedId(null)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }

  async function runCheck() {
    if (!file) { setError('Please upload a label file first.'); return }
    if (!productName.trim()) { setError('Please enter a product name.'); return }
    setError('')
    setAnalysing(true)
    setResult(null)

    try {
      const base64 = await fileToBase64(file)
      const res = await analyseLabel({
        base64,
        mimeType: file.type,
        productName,
        productCategory: category,
        extraContext,
        regulations: regs,
        styleRules,
      })
      setResult(res)
    } catch (ex) {
      setError('Analysis failed: ' + ex.message)
    } finally {
      setAnalysing(false)
    }
  }

  async function saveCheck() {
    if (!result || !user) return
    setSaving(true)
    setError('')

    try {
      let filePath = null
      const ext = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${ext}`
      const { data: upData } = await supabase.storage.from('labels').upload(fileName, file, { contentType: file.type })
      if (upData) filePath = upData.path

      const { data: check, error: insErr } = await supabase.from('checks').insert({
        user_id: user.id,
        product_name: productName,
        product_category: category || null,
        verdict: result.verdict,
        score: result.score,
        summary: result.summary,
        report_json: result.items || [],
        regulations_checked: Object.keys(regs).filter(k => regs[k]),
        label_file_path: filePath,
        label_file_name: file.name,
        extra_context: extraContext || null,
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
        }))
        await supabase.from('style_rules').insert(rules)
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
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      }).eq('id', savedId)
      navigate(`/checks/${savedId}`)
    }
  }

  const failItems    = result?.items?.filter(i => i.status === 'FAIL')    || []
  const warnItems    = result?.items?.filter(i => i.status === 'WARNING') || []
  const passItems    = result?.items?.filter(i => i.status === 'PASS')    || []

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* LEFT: Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upload */}
          <div className="card">
            <div className="card-header"><span className="card-title">Label / Artwork</span></div>
            <div className="card-body">
              {!file ? (
                <div
                  className={`upload-zone${dragOver ? ' drag-over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current.click()}
                >
                  <div className="upload-icon">🖼️</div>
                  <h3>Drop label image here</h3>
                  <p>or click to browse · JPG, PNG, WEBP, PDF</p>
                  <input
                    ref={fileRef} type="file" hidden
                    accept="image/*"
                    onChange={e => handleFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <div>
                  <img src={preview} alt="Label preview" className="label-preview" />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', flex: 1 }}>
                      {file.name} · {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <button className="btn btn-sm" onClick={() => { setFile(null); setPreview(null); setResult(null) }}>
                      Change
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product details */}
          <div className="card">
            <div className="card-header"><span className="card-title">Product Details</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Velite ClearSkin Sunscreen SPF 50"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Product Category</label>
                <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">— Select category —</option>
                  {PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notes / Context</label>
                <textarea
                  className="form-textarea"
                  placeholder="Any specific Velite conventions, house style preferences, or brand standards the AI should enforce."
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
                {REGULATION_TOGGLES.map(({ key, label, sub, icon }) => (
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
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="btn btn-primary btn-lg"
            style={{ justifyContent: 'center' }}
            onClick={runCheck}
            disabled={analysing || !file}
          >
            {analysing
              ? <><span className="spinner" /> Analysing label…</>
              : '⚡ Run Compliance Check'}
          </button>
        </div>

        {/* RIGHT: Results */}
        <div>
          {!result && !analysing && (
            <div className="card">
              <div className="empty-state" style={{ padding: '48px 24px' }}>
                <div className="empty-icon">🔍</div>
                <h3>No report yet</h3>
                <p>Upload a label and click Run to analyse it against Indian cosmetic packaging regulations.</p>
              </div>
            </div>
          )}

          {analysing && (
            <div className="card">
              <div className="loading-page" style={{ flexDirection: 'column', padding: '48px 24px' }}>
                <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>
                  Claude is reviewing your label against Indian cosmetics regulations…<br />
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>This usually takes 10–20 seconds</span>
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
                  <div style={{ marginTop: 6 }}>
                    <VerdictBadge verdict={result.verdict} size="lg" />
                    {category && (
                      <span className="badge badge-gray" style={{ marginLeft: 6 }}>{category}</span>
                    )}
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
                  <button className="btn" onClick={() => { setResult(null); setFile(null); setPreview(null); setSavedId(null); setProductName(''); setCategory('') }}>
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
    reader.onload = () => {
      const result = reader.result
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
