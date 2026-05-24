import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  DEVIATION_STATUSES, DEVIATION_SOURCES, CAPA_STATUSES, CAPA_ACTION_TYPES, SEVERITIES, severity,
} from '../../lib/qc'
import { format, parseISO } from 'date-fns'

export default function Deviations() {
  const { user } = useAuth()
  const [devs, setDevs]   = useState([])
  const [capas, setCapas] = useState({})       // { deviation_id: [capa, …] }
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [open, setOpen]   = useState(null)     // expanded deviation id
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: d } = await supabase.from('qc_deviations')
      .select('*, qc_batches(batch_no, product_name)')
      .order('created_at', { ascending: false })
    setDevs(d || [])
    const { data: c } = await supabase.from('qc_capa').select('*').order('created_at', { ascending: true })
    const grouped = {}
    ;(c || []).forEach(x => { (grouped[x.deviation_id] = grouped[x.deviation_id] || []).push(x) })
    setCapas(grouped)
    setLoading(false)
  }

  const filtered = devs.filter(d =>
    filter === 'all' ? true : filter === 'open' ? d.status !== 'closed' : d.status === filter
  )

  async function setStatus(dev, status) {
    await supabase.from('qc_deviations').update({
      status, closed_at: status === 'closed' ? new Date().toISOString() : null,
    }).eq('id', dev.id)
    load()
  }

  async function saveRootCause(dev, root_cause) {
    await supabase.from('qc_deviations').update({ root_cause }).eq('id', dev.id)
    load()
  }

  async function addCapa(dev, payload) {
    await supabase.from('qc_capa').insert({ user_id: user.id, deviation_id: dev.id, ...payload })
    load()
  }

  async function setCapaStatus(capa, status) {
    await supabase.from('qc_capa').update({ status }).eq('id', capa.id)
    load()
  }

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading deviations…</div>

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: 20, gap: 6 }}>
        {['open', 'all', 'investigating', 'closed'].map(f => (
          <button key={f} className={`btn btn-sm${filter === f ? ' btn-primary' : ''}`} onClick={() => setFilter(f)}>
            {f === 'open' ? 'Open + Investigating' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowNew(true)}>＋ Log Deviation</button>
      </div>

      {showNew && <NewDeviationForm user={user} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />}

      {filtered.length === 0 ? (
        <div className="card"><div className="empty-state">
          <div className="empty-icon">📋</div><h3>No deviations</h3>
          <p>Failed QC tests can raise a deviation automatically, or log one manually.</p>
        </div></div>
      ) : filtered.map(dev => {
        const sev = severity(dev.severity)
        const st  = DEVIATION_STATUSES.find(s => s.value === dev.status) || DEVIATION_STATUSES[0]
        const list = capas[dev.id] || []
        const isOpen = open === dev.id
        return (
          <div key={dev.id} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${sev.color}` }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}
                onClick={() => setOpen(isOpen ? null : dev.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span className={`badge ${sev.badge}`}>{sev.label}</span>
                    <span className={`badge ${st.badge}`}>{st.label}</span>
                    <b>{dev.title}</b>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {dev.qc_batches ? `Batch ${dev.qc_batches.batch_no} · ${dev.qc_batches.product_name} · ` : ''}
                    {(DEVIATION_SOURCES.find(s => s.value === dev.source) || {}).label}
                    {dev.created_at ? ` · ${format(parseISO(dev.created_at), 'dd MMM yyyy')}` : ''}
                    {list.length ? ` · ${list.filter(c => c.status === 'done').length}/${list.length} CAPA done` : ''}
                  </div>
                </div>
                <span style={{ color: 'var(--text-3)' }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  {dev.description && (
                    <p style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap', marginBottom: 12 }}>{dev.description}</p>
                  )}

                  <div className="form-group">
                    <label className="form-label">Root Cause</label>
                    <RootCauseEditor value={dev.root_cause || ''} onSave={v => saveRootCause(dev, v)} />
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', margin: '12px 0 6px' }}>CAPA ACTIONS</div>
                  {list.map(c => {
                    const cst = CAPA_STATUSES.find(s => s.value === c.status) || CAPA_STATUSES[0]
                    return (
                      <div key={c.id} className="issue-card" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge badge-gray">{c.action_type}</span>
                        <span style={{ flex: 1, fontSize: 13 }}>{c.description}{c.owner ? ` — ${c.owner}` : ''}{c.due_date ? ` (due ${c.due_date})` : ''}</span>
                        <select className="form-select" style={{ width: 130 }} value={c.status} onChange={e => setCapaStatus(c, e.target.value)}>
                          {CAPA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    )
                  })}
                  <AddCapaForm onAdd={p => addCapa(dev, p)} />

                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {dev.status !== 'investigating' && <button className="btn btn-sm" onClick={() => setStatus(dev, 'investigating')}>Mark Investigating</button>}
                    {dev.status !== 'closed'
                      ? <button className="btn btn-sm btn-success" onClick={() => setStatus(dev, 'closed')}>✓ Close Deviation</button>
                      : <button className="btn btn-sm" onClick={() => setStatus(dev, 'open')}>Re-open</button>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RootCauseEditor({ value, onSave }) {
  const [v, setV] = useState(value)
  const [dirty, setDirty] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <textarea className="form-textarea" style={{ minHeight: 56 }} value={v}
        onChange={e => { setV(e.target.value); setDirty(true) }} placeholder="Document the root cause…" />
      <button className="btn btn-sm" disabled={!dirty} onClick={() => { onSave(v); setDirty(false) }}>Save</button>
    </div>
  )
}

function AddCapaForm({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ action_type: 'corrective', description: '', owner: '', due_date: '' })
  if (!open) return <button className="btn btn-sm" onClick={() => setOpen(true)} style={{ marginTop: 4 }}>＋ Add CAPA</button>
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <select className="form-select" style={{ width: 140 }} value={f.action_type} onChange={e => setF({ ...f, action_type: e.target.value })}>
          {CAPA_ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input className="form-input" style={{ flex: 1, minWidth: 180 }} placeholder="Action description"
          value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ width: 160 }} placeholder="Owner" value={f.owner} onChange={e => setF({ ...f, owner: e.target.value })} />
        <input className="form-input" type="date" style={{ width: 160 }} value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} />
        <button className="btn btn-sm btn-primary" disabled={!f.description.trim()}
          onClick={() => { onAdd({ ...f, due_date: f.due_date || null }); setF({ action_type: 'corrective', description: '', owner: '', due_date: '' }); setOpen(false) }}>Add</button>
        <button className="btn btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

function NewDeviationForm({ user, onClose, onSaved }) {
  const [f, setF] = useState({ title: '', description: '', severity: 'major', source: 'manual' })
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!f.title.trim()) return
    setSaving(true)
    await supabase.from('qc_deviations').insert({
      user_id: user.id, title: f.title.trim(), description: f.description.trim() || null,
      severity: f.severity, source: f.source, status: 'open', raised_by: user.id,
    })
    setSaving(false); onSaved()
  }
  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
      <div className="card-header"><span className="card-title">Log Deviation</span></div>
      <div className="card-body">
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Severity</label>
            <select className="form-select" value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })}>
              {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Source</label>
            <select className="form-select" value={f.source} onChange={e => setF({ ...f, source: e.target.value })}>
              {DEVIATION_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving || !f.title.trim()}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Save Deviation'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
