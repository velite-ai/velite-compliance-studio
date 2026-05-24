import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { MATERIAL_TYPES, PARAM_TYPES, SEVERITIES } from '../../lib/qc'

const BLANK_PARAM = { name: '', method: '', type: 'numeric', min: '', max: '', unit: '', expected: '', severity: 'major' }

export default function NewSpecification() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')

  const [form, setForm] = useState({
    name: '', track: 'cosmetic', material_type: 'finished_good', description: '',
  })
  const [rows, setRows]     = useState([{ ...BLANK_PARAM }])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [loaded, setLoaded] = useState(!editId)

  useEffect(() => {
    if (!editId) return
    ;(async () => {
      const { data } = await supabase.from('qc_specifications').select('*').eq('id', editId).single()
      if (data) {
        setForm({ name: data.name, track: data.track, material_type: data.material_type, description: data.description || '' })
        setRows(data.parameters?.length ? data.parameters.map(p => ({ ...BLANK_PARAM, ...p })) : [{ ...BLANK_PARAM }])
      }
      setLoaded(true)
    })()
  }, [editId])

  const set = (f, v) => setForm(s => ({ ...s, [f]: v }))
  const setRow = (i, f, v) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [f]: v } : r))
  const addRow = () => setRows(rs => [...rs, { ...BLANK_PARAM }])
  const delRow = (i) => setRows(rs => rs.filter((_, idx) => idx !== i))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Specification name is required.'); return }
    const clean = rows.filter(r => r.name.trim())
    if (clean.length === 0) { setError('Add at least one parameter.'); return }
    setError(''); setSaving(true)

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      track: form.track,
      material_type: form.material_type,
      description: form.description.trim() || null,
      parameters: clean,
    }

    const q = editId
      ? supabase.from('qc_specifications').update(payload).eq('id', editId)
      : supabase.from('qc_specifications').insert(payload)
    const { error: err } = await q
    if (err) { setError(err.message); setSaving(false); return }
    navigate('/qc/specs')
  }

  async function handleDelete() {
    if (!editId) return
    if (!confirm('Deactivate this specification? Existing batches keep their recorded results.')) return
    await supabase.from('qc_specifications').update({ is_active: false }).eq('id', editId)
    navigate('/qc/specs')
  }

  if (!loaded) return <div className="loading-page"><span className="spinner" /> Loading…</div>

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/qc/specs')}>← Back to Specifications</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Specification Details</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Specification Name *</label>
              <input className="form-input" placeholder="e.g. Vitamin C Serum 20% — Finished Goods Spec"
                value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Entity / Track</label>
                <select className="form-select" value={form.track} onChange={e => set('track', e.target.value)}>
                  <option value="cosmetic">🧴 Velite Healthcare (Cosmetic)</option>
                  <option value="drug">💊 Velite Pharmaceuticals (Drug)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Material Type</label>
                <select className="form-select" value={form.material_type} onChange={e => set('material_type', e.target.value)}>
                  {MATERIAL_TYPES.map(m => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input className="form-input" placeholder="What this spec applies to"
                value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Test Parameters</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>What QC measures and the acceptance limits</span>
          </div>
          <div className="card-body">
            {rows.map((r, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 12, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div className="grid-2" style={{ gap: 10 }}>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label className="form-label">Parameter *</label>
                        <input className="form-input" placeholder="e.g. pH, Assay, Appearance"
                          value={r.name} onChange={e => setRow(i, 'name', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label className="form-label">Test Method (optional)</label>
                        <input className="form-input" placeholder="e.g. IP, In-house SOP-12"
                          value={r.method} onChange={e => setRow(i, 'method', e.target.value)} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
                        <label className="form-label">Type</label>
                        <select className="form-select" value={r.type} onChange={e => setRow(i, 'type', e.target.value)}>
                          {PARAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      {r.type === 'numeric' && (
                        <>
                          <div className="form-group" style={{ marginBottom: 0, width: 90 }}>
                            <label className="form-label">Min</label>
                            <input className="form-input" type="number" step="any" value={r.min} onChange={e => setRow(i, 'min', e.target.value)} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0, width: 90 }}>
                            <label className="form-label">Max</label>
                            <input className="form-input" type="number" step="any" value={r.max} onChange={e => setRow(i, 'max', e.target.value)} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0, width: 100 }}>
                            <label className="form-label">Unit</label>
                            <input className="form-input" placeholder="g, %, cps" value={r.unit} onChange={e => setRow(i, 'unit', e.target.value)} />
                          </div>
                        </>
                      )}

                      {r.type === 'text' && (
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                          <label className="form-label">Expected Value</label>
                          <input className="form-input" placeholder="e.g. Clear amber liquid"
                            value={r.expected} onChange={e => setRow(i, 'expected', e.target.value)} />
                        </div>
                      )}

                      {r.type === 'boolean' && (
                        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Recorded as Pass / Fail at test time.</span>
                        </div>
                      )}

                      <div className="form-group" style={{ marginBottom: 0, width: 130 }}>
                        <label className="form-label">Severity</label>
                        <select className="form-select" value={r.severity} onChange={e => setRow(i, 'severity', e.target.value)}>
                          {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => delRow(i)}
                    style={{ color: 'var(--fail)' }} title="Remove parameter">✕</button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={addRow}>＋ Add parameter</button>
          </div>
        </div>

        {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : (editId ? 'Save Changes' : '＋ Create Specification')}
          </button>
          <button type="button" className="btn btn-lg" onClick={() => navigate('/qc/specs')}>Cancel</button>
          {editId && (
            <button type="button" className="btn btn-lg" onClick={handleDelete} style={{ marginLeft: 'auto', color: 'var(--fail)' }}>
              Deactivate
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
