import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { MATERIAL_TYPES } from '../../lib/qc'

export default function NewBatch() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    batch_no: '', product_name: '', track: 'cosmetic', material_type: 'finished_good',
    spec_id: '', supplier: '', mfg_date: '', expiry_date: '', quantity: '', uom: '',
  })
  const [specs, setSpecs]   = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('qc_specifications').select('id, name, track, material_type, parameters').eq('is_active', true)
    setSpecs(data || [])
  }

  const set = (f, v) => setForm(s => ({ ...s, [f]: v }))

  // Specs that match the selected track + material type (best matches first)
  const matchingSpecs = specs
    .filter(s => s.track === form.track)
    .sort((a, b) => (a.material_type === form.material_type ? -1 : 1) - (b.material_type === form.material_type ? -1 : 1))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.batch_no.trim()) { setError('Batch / lot number is required.'); return }
    if (!form.product_name.trim()) { setError('Product / material name is required.'); return }
    setError(''); setSaving(true)

    const { data, error: err } = await supabase
      .from('qc_batches')
      .insert({
        user_id: user.id,
        batch_no: form.batch_no.trim(),
        product_name: form.product_name.trim(),
        track: form.track,
        material_type: form.material_type,
        spec_id: form.spec_id || null,
        supplier: form.supplier.trim() || null,
        mfg_date: form.mfg_date || null,
        expiry_date: form.expiry_date || null,
        quantity: form.quantity === '' ? null : Number(form.quantity),
        uom: form.uom.trim() || null,
        status: 'draft',
      })
      .select()
      .single()

    if (err) { setError(err.message); setSaving(false); return }
    navigate(`/qc/batches/${data.id}`)
  }

  const isIncoming = form.material_type === 'raw_material' || form.material_type === 'packaging'

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/qc/batches')}>← Back to Batches</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Batch Details</span></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Batch / Lot No. *</label>
                <input className="form-input" placeholder="e.g. VH-2405-018" value={form.batch_no}
                  onChange={e => set('batch_no', e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Product / Material Name *</label>
                <input className="form-input" placeholder="e.g. Vitamin C Serum 20%" value={form.product_name}
                  onChange={e => set('product_name', e.target.value)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Entity / Track</label>
                <select className="form-select" value={form.track} onChange={e => { set('track', e.target.value); set('spec_id', '') }}>
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
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Specification</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>The parameter list this batch is tested against</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Apply Specification</label>
              <select className="form-select" value={form.spec_id} onChange={e => set('spec_id', e.target.value)}>
                <option value="">— No spec (record results free-form later) —</option>
                {matchingSpecs.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {(s.parameters || []).length} params{s.material_type !== form.material_type ? ' (other type)' : ''}
                  </option>
                ))}
              </select>
              {matchingSpecs.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                  No specs for this entity yet. You can still create the batch and add a spec on the batch screen.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Batch Info</span></div>
          <div className="card-body">
            {isIncoming && (
              <div className="form-group">
                <label className="form-label">Supplier / Vendor</label>
                <input className="form-input" placeholder="Vendor name (for CoA reliance)" value={form.supplier}
                  onChange={e => set('supplier', e.target.value)} />
              </div>
            )}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{isIncoming ? 'Received / Mfg. Date' : 'Mfg. Date'}</label>
                <input className="form-input" type="date" value={form.mfg_date} onChange={e => set('mfg_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Expiry / Retest Date</label>
                <input className="form-input" type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" step="any" placeholder="e.g. 500" value={form.quantity}
                  onChange={e => set('quantity', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit of Measure</label>
                <input className="form-input" placeholder="kg, L, pcs, units" value={form.uom}
                  onChange={e => set('uom', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? <><span className="spinner" /> Creating…</> : '＋ Create Batch'}
          </button>
          <button type="button" className="btn btn-lg" onClick={() => navigate('/qc/batches')}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
