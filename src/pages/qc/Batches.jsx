import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import TrackBadge from '../../components/TrackBadge'
import QCStatusBadge from '../../components/QCStatusBadge'
import { BATCH_STATUSES, materialType } from '../../lib/qc'
import { format, parseISO } from 'date-fns'

export default function Batches() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [track, setTrack]     = useState('all')
  const [status, setStatus]   = useState('all')
  const [search, setSearch]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase
      .from('qc_batch_overview')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      const { data: fb } = await supabase.from('qc_batches').select('*').order('created_at', { ascending: false })
      setBatches(fb || [])
    } else {
      setBatches(data || [])
    }
    setLoading(false)
  }

  const filtered = batches.filter(b => {
    if (track !== 'all' && b.track !== track) return false
    if (status !== 'all' && b.status !== status) return false
    const q = search.toLowerCase()
    if (q && !b.product_name?.toLowerCase().includes(q) && !b.batch_no?.toLowerCase().includes(q)) return false
    return true
  })

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading batches…</div>

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="form-input" placeholder="Search batch no. or product…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
        <div className="track-toggle">
          <button className={`track-btn${track === 'all' ? ' cosmetic active' : ''}`} onClick={() => setTrack('all')}>All</button>
          <button className={`track-btn drug${track === 'drug' ? ' active' : ''}`} onClick={() => setTrack('drug')}>💊 Pharma</button>
          <button className={`track-btn cosmetic${track === 'cosmetic' ? ' active' : ''}`} onClick={() => setTrack('cosmetic')}>🧴 Healthcare</button>
        </div>
        <Link to="/qc/batches/new" className="btn btn-primary" style={{ marginLeft: 'auto' }}>＋ New Batch</Link>
      </div>

      <div className="filter-bar" style={{ marginBottom: 20, gap: 6 }}>
        <button className={`btn btn-sm${status === 'all' ? ' btn-primary' : ''}`} onClick={() => setStatus('all')}>All statuses</button>
        {BATCH_STATUSES.map(s => (
          <button key={s.value} className={`btn btn-sm${status === s.value ? ' btn-primary' : ''}`} onClick={() => setStatus(s.value)}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🧫</div>
            <h3>No batches</h3>
            <p>Create a batch to record QC test results against a specification.</p>
            <Link to="/qc/batches/new" className="btn btn-primary" style={{ marginTop: 16 }}>＋ Create first batch</Link>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Batch No.</th>
                  <th>Product / Material</th>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Result</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const mt = materialType(b.material_type)
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.batch_no}</td>
                      <td>{b.product_name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{mt.icon} {mt.label}</td>
                      <td><TrackBadge track={b.track} /></td>
                      <td>
                        {b.latest_result === 'pass' ? <span className="badge badge-pass">✓ Pass</span>
                          : b.latest_result === 'fail' ? <span className="badge badge-fail">✗ Fail</span>
                          : <span className="badge badge-gray">—</span>}
                        {b.open_deviations > 0 && (
                          <span className="badge badge-warn" style={{ marginLeft: 4 }}>{b.open_deviations} dev</span>
                        )}
                      </td>
                      <td><QCStatusBadge status={b.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {b.created_at ? format(parseISO(b.created_at), 'dd MMM yyyy') : '—'}
                      </td>
                      <td><Link to={`/qc/batches/${b.id}`} className="btn btn-sm">Open</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
