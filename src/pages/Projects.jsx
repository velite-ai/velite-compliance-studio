import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TrackBadge from '../components/TrackBadge'
import VerdictBadge from '../components/VerdictBadge'
import { format, parseISO } from 'date-fns'

const PKG_ICONS = {
  carton: '📦', label: '🏷️', tube: '🧴', insert: '📄', other: '📋',
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [trackFilter, setTrackFilter] = useState('all')
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    // Use the project_latest view — one row per project with latest version info
    const { data, error } = await supabase
      .from('project_latest')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      // Fallback: view not ready yet, query projects directly
      const { data: fallback } = await supabase
        .from('projects')
        .select('*')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })
      setProjects(fallback || [])
    } else {
      setProjects(data || [])
    }
    setLoading(false)
  }

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    if (q && !p.product_name?.toLowerCase().includes(q) && !(p.category || '').toLowerCase().includes(q)) return false
    if (trackFilter !== 'all' && p.track !== trackFilter) return false
    return true
  })

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading projects…</div>

  return (
    <div>
      {/* Filter bar */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <input
          className="form-input"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <div className="track-toggle">
          <button
            className={`track-btn${trackFilter === 'all' ? ' cosmetic active' : ''}`}
            onClick={() => setTrackFilter('all')}
          >
            All tracks
          </button>
          <button
            className={`track-btn drug${trackFilter === 'drug' ? ' active' : ''}`}
            onClick={() => setTrackFilter('drug')}
          >
            💊 Drug
          </button>
          <button
            className={`track-btn cosmetic${trackFilter === 'cosmetic' ? ' active' : ''}`}
            onClick={() => setTrackFilter('cosmetic')}
          >
            🧴 Cosmetic
          </button>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
        </span>
        <Link to="/projects/new" className="btn btn-primary">
          ＋ New Project
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>No projects yet</h3>
            <p>Create your first product project to start tracking compliance versions.</p>
            <Link to="/projects/new" className="btn btn-primary" style={{ marginTop: 16 }}>
              ＋ Create first project
            </Link>
          </div>
        </div>
      ) : (
        <div className="projects-grid">
          {filtered.map(p => (
            <ProjectCard key={p.project_id || p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project: p }) {
  const id            = p.project_id || p.id
  const version       = p.latest_version
  const verdict       = p.verdict
  const lastCheck     = p.last_check_at
  const isFinal       = p.is_final

  return (
    <Link to={`/projects/${id}`} className="project-card">
      <div className="project-card-header">
        <div>
          <div className="project-card-name">{p.product_name}</div>
          <div className="project-card-meta">
            <TrackBadge track={p.track} />
            <span className="pkg-badge">
              {PKG_ICONS[p.packaging_type] || '📋'} {p.packaging_type}
            </span>
            {p.category && (
              <span className="badge badge-gray">{p.category}</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {version ? (
            <span className={`version-tag${isFinal ? ' final' : ''}`}>
              v{version}{isFinal ? ' ✓' : ''}
            </span>
          ) : (
            <span className="version-tag">No checks</span>
          )}
        </div>
      </div>

      {verdict && (
        <div style={{ marginBottom: 8 }}>
          <VerdictBadge verdict={verdict} />
        </div>
      )}

      {p.description && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, lineHeight: 1.5 }}>
          {p.description.length > 90 ? p.description.slice(0, 90) + '…' : p.description}
        </p>
      )}

      <div className="project-card-footer">
        <span>
          {lastCheck
            ? `Last check ${format(parseISO(lastCheck), 'dd MMM yyyy')}`
            : 'No checks yet'}
        </span>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>View →</span>
      </div>
    </Link>
  )
}
