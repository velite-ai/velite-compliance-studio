import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import TrackBadge from '../../components/TrackBadge'
import QCStatusBadge from '../../components/QCStatusBadge'
import { QC_ENTITIES, BATCH_STATUSES, materialType } from '../../lib/qc'
import { format, parseISO } from 'date-fns'

export default function QCDashboard() {
  const [batches, setBatches] = useState([])
  const [openDevs, setOpenDevs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [entity, setEntity] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: b } = await supabase.from('qc_batch_overview').select('*').order('created_at', { ascending: false })
    setBatches(b || [])
    const { count } = await supabase.from('qc_deviations').select('id', { count: 'exact', head: true }).neq('status', 'closed')
    setOpenDevs(count || 0)
    setLoading(false)
  }

  const scoped = batches.filter(b => entity === 'all' || b.track === entity)
  const awaiting  = scoped.filter(b => b.status === 'draft' || b.status === 'in_test')
  const released  = scoped.filter(b => b.status === 'released')
  const rejected  = scoped.filter(b => b.status === 'rejected' || b.status === 'quarantine')
  const total     = scoped.length
  const passRate  = released.length + rejected.length > 0
    ? Math.round((released.length / (released.length + rejected.length)) * 100) : 0

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading QC dashboard…</div>

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div className="track-toggle">
          <button className={`track-btn${entity === 'all' ? ' cosmetic active' : ''}`} onClick={() => setEntity('all')}>All entities</button>
          {QC_ENTITIES.map(e => (
            <button key={e.track} className={`track-btn ${e.track === 'drug' ? 'drug' : 'cosmetic'}${entity === e.track ? ' active' : ''}`}
              onClick={() => setEntity(e.track)}>{e.icon} {e.short}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link to="/qc/specs/new" className="btn">＋ Spec</Link>
          <Link to="/qc/batches/new" className="btn btn-primary">＋ New Batch</Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🧫</div>
          <div className="stat-label">Total Batches</div>
          <div className="stat-value">{total}</div>
          <div className="stat-sub">{entity === 'all' ? 'All entities' : QC_ENTITIES.find(e => e.track === entity)?.name}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔬</div>
          <div className="stat-label">Awaiting QC</div>
          <div className="stat-value" style={{ color: 'var(--review)' }}>{awaiting.length}</div>
          <div className="stat-sub">Draft or in testing</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-label">Released</div>
          <div className="stat-value" style={{ color: 'var(--pass)' }}>{released.length}</div>
          <div className="stat-sub">Pass rate {passRate}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⛔</div>
          <div className="stat-label">Rejected / Quarantine</div>
          <div className="stat-value" style={{ color: 'var(--fail)' }}>{rejected.length}</div>
          <div className="stat-sub">Held back</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-label">Open Deviations</div>
          <div className="stat-value" style={{ color: openDevs ? 'var(--warn)' : 'var(--text-3)' }}>{openDevs}</div>
          <div className="stat-sub"><Link to="/qc/deviations" style={{ color: 'var(--accent)' }}>View all →</Link></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 4 }}>
        <div className="card-header">
          <span className="card-title">Batches Awaiting QC</span>
          <Link to="/qc/batches" className="btn btn-ghost btn-sm">All batches →</Link>
        </div>
        {awaiting.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎉</div>
            <h3>Nothing pending</h3>
            <p>No batches are waiting for QC. Create a batch to get started.</p>
            <Link to="/qc/batches/new" className="btn btn-primary" style={{ marginTop: 16 }}>＋ New Batch</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Batch No.</th><th>Product</th><th>Type</th><th>Entity</th><th>Status</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {awaiting.map(b => {
                  const mt = materialType(b.material_type)
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.batch_no}</td>
                      <td>{b.product_name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{mt.icon} {mt.label}</td>
                      <td><TrackBadge track={b.track} /></td>
                      <td><QCStatusBadge status={b.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{b.created_at ? format(parseISO(b.created_at), 'dd MMM') : '—'}</td>
                      <td><Link to={`/qc/batches/${b.id}`} className="btn btn-sm btn-primary">Test →</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 14 }}>
        QC flow: define a <Link to="/qc/specs" style={{ color: 'var(--accent)' }}>Specification</Link> →
        create a <Link to="/qc/batches" style={{ color: 'var(--accent)' }}>Batch</Link> →
        record results → release / reject → log <Link to="/qc/deviations" style={{ color: 'var(--accent)' }}>Deviations</Link> & CAPA.
        Statuses: {BATCH_STATUSES.map(s => `${s.icon} ${s.label}`).join('  ·  ')}
      </p>
    </div>
  )
}
