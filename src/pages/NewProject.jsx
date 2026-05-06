import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { PRODUCT_CATEGORIES } from '../lib/regulations'

const PACKAGING_TYPES = [
  { value: 'label',  icon: '🏷️', label: 'Label',  desc: 'Adhesive label on bottle / jar' },
  { value: 'carton', icon: '📦', label: 'Carton', desc: 'Folding outer carton / box' },
  { value: 'tube',   icon: '🧴', label: 'Tube',   desc: 'Laminate / aluminium tube' },
  { value: 'insert', icon: '📄', label: 'Insert', desc: 'Leaflet / product insert inside pack' },
  { value: 'other',  icon: '📋', label: 'Other',  desc: 'Any other packaging type' },
]

export default function NewProject() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    product_name:   '',
    category:       '',
    track:          'cosmetic',   // default — most products will be cosmetic
    packaging_type: 'label',
    description:    '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.product_name.trim()) { setError('Product name is required.'); return }
    setError('')
    setSaving(true)

    const { data, error: err } = await supabase
      .from('projects')
      .insert({
        user_id:        user.id,
        product_name:   form.product_name.trim(),
        category:       form.category || null,
        track:          form.track,
        packaging_type: form.packaging_type,
        description:    form.description.trim() || null,
      })
      .select()
      .single()

    if (err) { setError(err.message); setSaving(false); return }
    navigate(`/projects/${data.id}`)
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>
          ← Back to Projects
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Product name */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Product Details</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Product / SKU Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Velite ClearSkin Sunscreen SPF 50"
                value={form.product_name}
                onChange={e => set('product_name', e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Product Category</label>
                <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">— Select category —</option>
                  {PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input
                  className="form-input"
                  placeholder="Brief note about this SKU"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Regulatory track — most important decision */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Regulatory Track</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              This determines which regulations are checked
            </span>
          </div>
          <div className="card-body">
            <div className="grid-2" style={{ gap: 12 }}>
              {[
                {
                  value: 'cosmetic',
                  icon: '🧴',
                  title: 'Cosmetic / Cosmeceutical',
                  regs: ['Cosmetics Rules 2020', 'Legal Metrology Rules 2011', 'INCI Nomenclature', 'Claim boundaries'],
                  color: 'var(--cosmetic)',
                  bg:    'var(--cosmetic-bg)',
                  border:'var(--cosmetic-border)',
                },
                {
                  value: 'drug',
                  icon: '💊',
                  title: 'Drug (External Application)',
                  regs: ['Drugs & Cosmetics Act 1940', 'Rules 1945 (Schedule P/FF)', 'Legal Metrology Rules 2011', 'Drug licence & composition'],
                  color: 'var(--drug)',
                  bg:    'var(--drug-bg)',
                  border:'var(--drug-border)',
                },
              ].map(t => (
                <div
                  key={t.value}
                  onClick={() => set('track', t.value)}
                  style={{
                    padding: '16px',
                    borderRadius: 10,
                    border: `2px solid ${form.track === t.value ? t.color : 'var(--border)'}`,
                    background: form.track === t.value ? t.bg : 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{t.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: form.track === t.value ? t.color : 'var(--text)' }}>
                      {t.title}
                    </span>
                    {form.track === t.value && (
                      <span style={{ marginLeft: 'auto', color: t.color, fontWeight: 700 }}>✓</span>
                    )}
                  </div>
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {t.regs.map(r => (
                      <li key={r} style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>{r}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Packaging type */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Packaging Type</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PACKAGING_TYPES.map(pt => (
                <div
                  key={pt.value}
                  onClick={() => set('packaging_type', pt.value)}
                  style={{
                    flex: '1 1 120px',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: `1.5px solid ${form.packaging_type === pt.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.packaging_type === pt.value ? 'var(--accent-light)' : 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{pt.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: form.packaging_type === pt.value ? 'var(--accent)' : 'var(--text)' }}>
                    {pt.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{pt.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? <><span className="spinner" /> Creating project…</> : '＋ Create Project'}
          </button>
          <button type="button" className="btn btn-lg" onClick={() => navigate('/projects')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
