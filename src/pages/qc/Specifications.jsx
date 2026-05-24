import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import TrackBadge from '../../components/TrackBadge'
import { MATERIAL_TYPES, materialType } from '../../lib/qc'

export default function Specifications() {
  const [specs, setSpecs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [track, setTrack]   = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('qc_specifications')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
    setSpecs(data || [])
    setLoading(false)
  }

  const filtered = specs.filter(s => track === 'all' || s.track === track)

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading specifications…</div>

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div className="track-toggle">
          <button className={`track-btn${track === 'all' ? ' cosmetic active' : ''}`} onClick={() => setTrack('all')}>All</button>
          <button className={`track-btn drug${track === 'drug' ? ' active' : ''}`} onClick={() => setTrack('drug')}>💊 Pharma</button>
          <button className={`track-btn cosmetic${track === 'cosmetic' ? ' active' : ''}`} onClick={() => setTrack('cosmetic')}>🧴 Healthcare</button>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {filtered.length} spec{filtered.length !== 1 ? 's' : ''}
        </span>
        <Link to="/qc/specs/new" className="btn btn-primary">＋ New Specification</Link>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📐</div>
            <h3>No specifications yet</h3>
            <p>Define the parameters a material or product must meet before you can test a batch against it.</p>
            <Link to="/qc/specs/new" className="btn btn-primary" style={{ marginTop: 16 }}>＋ Create first spec</Link>
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {filtered.map(s => {
            const mt = materialType(s.material_type)
            return (
              <Link key={s.id} to={`/qc/specs/new?edit=${s.id}`} className="project-card">
                <div className="project-card-header">
                  <div>
                    <div className="project-card-name">{s.name}</div>
                    <div className="project-card-meta">
                      <TrackBadge track={s.track} />
                      <span className="pkg-badge">{mt.icon} {mt.label}</span>
                    </div>
                  </div>
                  <span className="version-tag">{(s.parameters || []).length} params</span>
                </div>
                {s.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0', lineHeight: 1.5 }}>
                    {s.description.length > 90 ? s.description.slice(0, 90) + '…' : s.description}
                  </p>
                )}
                <div className="project-card-footer">
                  <span>{(s.parameters || []).length} parameter{(s.parameters || []).length !== 1 ? 's' : ''}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Edit →</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16 }}>
        Material types: {MATERIAL_TYPES.map(m => `${m.icon} ${m.label}`).join('  ·  ')}
      </p>
    </div>
  )
}
