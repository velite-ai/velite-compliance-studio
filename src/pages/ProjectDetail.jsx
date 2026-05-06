import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TrackBadge from '../components/TrackBadge'
import VerdictBadge from '../components/VerdictBadge'
import ScoreCircle from '../components/ScoreCircle'
import { format, parseISO } from 'date-fns'

const PKG_ICONS = { carton:'📦', label:'🏷️', tube:'🧴', insert:'📄', other:'📋' }

export default function ProjectDetail() {
  const { id }     = useParams()
  const { user }   = useAuth()
  const navigate   = useNavigate()

  const [project,  setProject]  = useState(null)
  const [versions, setVersions] = useState([])
  const [memory,   setMemory]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('versions')

  // Comparison state
  const [compareA, setCompareA] = useState(null)
  const [compareB, setCompareB] = useState(null)
  const [showCompare, setShowCompare] = useState(false)

  // Edit project inline
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: proj }, { data: vers }, { data: mem }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase
        .from('project_versions')
        .select('*, checks(*)')
        .eq('project_id', id)
        .order('version_number', { ascending: false }),
      supabase
        .from('product_memory')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false }),
    ])

    if (proj) { setProject(proj); setEditForm({ product_name: proj.product_name, description: proj.description || '', category: proj.category || '' }) }
    setVersions(vers || [])
    setMemory(mem || [])
    setLoading(false)
  }

  async function markFinal(versionId) {
    if (!confirm('Mark this version as FINAL? This cannot be undone.')) return
    // Clear any existing final first
    await supabase.from('project_versions').update({ is_final: false }).eq('project_id', id)
    await supabase.from('project_versions').update({ is_final: true  }).eq('id', versionId)
    await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function saveEdit() {
    setSaving(true)
    await supabase.from('projects').update({
      product_name: editForm.product_name,
      description:  editForm.description || null,
      category:     editForm.category    || null,
    }).eq('id', id)
    setProject(p => ({ ...p, ...editForm }))
    setEditMode(false)
    setSaving(false)
  }

  async function archiveProject() {
    if (!confirm('Archive this project? It will be hidden from the Projects list.')) return
    await supabase.from('projects').update({ is_archived: true }).eq('id', id)
    navigate('/projects')
  }

  // Compare: diff two versions' report_json items
  function buildDiff(verA, verB) {
    const itemsA = verA?.checks?.report_json || []
    const itemsB = verB?.checks?.report_json || []
    const mapA   = Object.fromEntries(itemsA.map(i => [i.field, i]))
    const mapB   = Object.fromEntries(itemsB.map(i => [i.field, i]))
    const allFields = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])]

    return allFields.map(field => {
      const a = mapA[field]
      const b = mapB[field]
      let changeType = 'same'
      if (!a)                           changeType = 'new'      // appeared in B
      else if (!b)                      changeType = 'removed'  // gone in B
      else if (a.status !== b.status)   changeType = 'changed'
      return { field, a, b, changeType }
    }).filter(d => d.changeType !== 'same')
  }

  const finalVersion   = versions.find(v => v.is_final)
  const latestVersion  = versions[0]
  const diff           = compareA && compareB ? buildDiff(compareA, compareB) : []

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading project…</div>
  if (!project) return <div className="loading-page">Project not found.</div>

  return (
    <div>
      {/* Back */}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')} style={{ marginBottom: 16 }}>
        ← All Projects
      </button>

      {/* Final banner */}
      {finalVersion && (
        <div className="final-banner">
          ✅ v{finalVersion.version_number} is the FINAL approved version
          <Link to={`/checks/${finalVersion.check_id}`} className="btn btn-sm" style={{ marginLeft: 'auto', background: 'var(--pass)', color: '#fff', borderColor: 'var(--pass)' }}>
            View Final Report →
          </Link>
        </div>
      )}

      {/* Project header */}
      <div className="project-detail-header" style={{ marginBottom: 20 }}>
        {!editMode ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div className="project-detail-name">{project.product_name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <TrackBadge track={project.track} size="lg" />
                <span className="pkg-badge">
                  {PKG_ICONS[project.packaging_type]} {project.packaging_type}
                </span>
                {project.category && <span className="badge badge-gray">{project.category}</span>}
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Created {format(parseISO(project.created_at), 'dd MMM yyyy')}
                </span>
              </div>
              {project.description && (
                <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  {project.description}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-sm" onClick={() => setEditMode(true)}>✏️ Edit</button>
              <Link
                to={`/new-check?project_id=${id}&track=${project.track}`}
                className="btn btn-primary btn-sm"
              >
                ＋ New Version Check
              </Link>
              <button className="btn btn-sm btn-ghost" onClick={archiveProject} style={{ color: 'var(--text-3)' }}>
                Archive
              </button>
            </div>
          </div>
        ) : (
          // Inline edit form
          <div>
            <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
              <div>
                <label className="form-label">Product Name</label>
                <input className="form-input" value={editForm.product_name}
                  onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Category</label>
                <input className="form-input" value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Moisturiser" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Description</label>
              <textarea className="form-textarea" rows={2} value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn${tab === 'versions' ? ' active' : ''}`} onClick={() => setTab('versions')}>
          Version History ({versions.length})
        </button>
        <button className={`tab-btn${tab === 'compare' ? ' active' : ''}`} onClick={() => setTab('compare')}>
          Compare Versions
        </button>
        <button className={`tab-btn${tab === 'memory' ? ' active' : ''}`} onClick={() => setTab('memory')}>
          Issue Memory ({memory.filter(m => !m.is_resolved).length} open)
        </button>
        <button className={`tab-btn${tab === 'assets' ? ' active' : ''}`} onClick={() => setTab('assets')}>
          Assets
        </button>
      </div>

      {/* VERSION HISTORY TAB */}
      {tab === 'versions' && (
        <div>
          {versions.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No compliance checks yet</h3>
                <p>Run the first compliance check to create v1.</p>
                <Link
                  to={`/new-check?project_id=${id}&track=${project.track}`}
                  className="btn btn-primary"
                  style={{ marginTop: 16 }}
                >
                  ⚡ Run First Check
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {versions.map(v => (
                <VersionRow
                  key={v.id}
                  version={v}
                  onMarkFinal={() => markFinal(v.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* COMPARE TAB */}
      {tab === 'compare' && (
        <div>
          {versions.length < 2 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">⚖️</div>
                <h3>Need at least 2 versions to compare</h3>
                <p>Run another compliance check to enable version comparison.</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Compare Version A (older)</label>
                      <select
                        className="form-select"
                        value={compareA?.id || ''}
                        onChange={e => setCompareA(versions.find(v => v.id === e.target.value) || null)}
                      >
                        <option value="">— select version —</option>
                        {versions.map(v => (
                          <option key={v.id} value={v.id}>v{v.version_number} — {v.checks?.verdict || 'no result'} · {format(parseISO(v.created_at), 'dd MMM yyyy')}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ paddingBottom: 8, fontSize: 18, color: 'var(--text-3)' }}>→</div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Version B (newer)</label>
                      <select
                        className="form-select"
                        value={compareB?.id || ''}
                        onChange={e => setCompareB(versions.find(v => v.id === e.target.value) || null)}
                      >
                        <option value="">— select version —</option>
                        {versions.map(v => (
                          <option key={v.id} value={v.id}>v{v.version_number} — {v.checks?.verdict || 'no result'} · {format(parseISO(v.created_at), 'dd MMM yyyy')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {compareA && compareB && (
                diff.length === 0 ? (
                  <div className="card">
                    <div className="empty-state">
                      <div className="empty-icon">✅</div>
                      <h3>No differences found</h3>
                      <p>All checked fields have the same status in both versions.</p>
                    </div>
                  </div>
                ) : (
                  <div className="compare-panel">
                    <div className="compare-col">
                      <div className="compare-col-header">
                        <span className="version-tag">v{compareA.version_number}</span>
                        <VerdictBadge verdict={compareA.checks?.verdict} />
                        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                          Score: {compareA.checks?.score ?? '—'}
                        </span>
                      </div>
                      {diff.map((d, i) => (
                        <div
                          key={i}
                          className={`compare-item ${d.changeType === 'new' ? '' : d.changeType}`}
                        >
                          <span style={{ fontSize: 10, marginTop: 2 }}>
                            {d.a ? (d.a.status === 'FAIL' ? '❌' : d.a.status === 'WARNING' ? '⚠️' : '✅') : '—'}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{d.field}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {d.a?.issue || d.a?.status || 'Not present'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="compare-col">
                      <div className="compare-col-header">
                        <span className="version-tag">v{compareB.version_number}</span>
                        <VerdictBadge verdict={compareB.checks?.verdict} />
                        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                          Score: {compareB.checks?.score ?? '—'}
                        </span>
                      </div>
                      {diff.map((d, i) => (
                        <div
                          key={i}
                          className={`compare-item ${d.changeType === 'resolved' ? 'resolved' : d.changeType === 'new' ? 'new' : 'changed'}`}
                        >
                          <span style={{ fontSize: 10, marginTop: 2 }}>
                            {d.b ? (d.b.status === 'FAIL' ? '❌' : d.b.status === 'WARNING' ? '⚠️' : '✅') : '—'}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{d.field}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {d.b?.issue || d.b?.status || 'Not present'}
                            </div>
                            {d.changeType === 'resolved' && (
                              <div style={{ fontSize: 10, color: 'var(--pass)', fontWeight: 600, marginTop: 2 }}>
                                ✓ Resolved
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* ISSUE MEMORY TAB */}
      {tab === 'memory' && (
        <div>
          {memory.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🧠</div>
                <h3>No memory yet</h3>
                <p>Issue history will appear here after compliance checks are run. Claude uses this to verify previous issues are resolved.</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Correction History</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {memory.filter(m => !m.is_resolved).length} open · {memory.filter(m => m.is_resolved).length} resolved
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Regulation</th>
                      <th>Field</th>
                      <th>Raised (v)</th>
                      <th>Resolved (v)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memory.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500, maxWidth: 220 }}>{m.issue_title}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.regulation || '—'}</td>
                        <td style={{ fontSize: 12 }}>{m.field || '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {m.version_raised ? `v${m.version_raised}` : '—'}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {m.version_resolved ? `v${m.version_resolved}` : '—'}
                        </td>
                        <td>
                          {m.is_resolved
                            ? <span className="badge badge-pass">✓ Resolved</span>
                            : <span className="badge badge-fail">Open</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ASSETS TAB — placeholder for Module 5 */}
      {tab === 'assets' && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <h3>Asset Library</h3>
            <p>Upload artwork, CDR files, 3D renders, and inserts here.<br />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Coming in Module 5</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Version row component ── */
function VersionRow({ version: v, onMarkFinal }) {
  const check = v.checks
  const score = check?.score ?? null

  return (
    <div className={`version-row${v.is_final ? ' is-final' : ''}`}>
      {/* Version number badge */}
      <div className={`version-number-badge${v.is_final ? ' final' : ''}`}>
        v{v.version_number}
      </div>

      {/* Score circle (small) */}
      {score !== null && (
        <ScoreCircle score={score} size={52} />
      )}

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {check?.verdict && <VerdictBadge verdict={check.verdict} />}
          <span className={`version-tag ${v.version_type}`}>{v.version_type}</span>
          {v.is_final && <span className="badge badge-pass">⭐ Final</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {format(parseISO(v.created_at), 'dd MMM yyyy, HH:mm')}
          {check?.report_json?.length > 0 && (
            <> · {check.report_json.filter(i => i.status === 'FAIL').length} fails,{' '}
            {check.report_json.filter(i => i.status === 'WARNING').length} warnings,{' '}
            {check.report_json.filter(i => i.status === 'PASS').length} passed</>
          )}
        </div>
        {v.notes && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3, fontStyle: 'italic' }}>
            {v.notes}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {check?.id && (
          <Link to={`/checks/${check.id}`} className="btn btn-sm">View Report</Link>
        )}
        {!v.is_final && check?.verdict === 'PASS' && (
          <button
            className="btn btn-sm btn-success"
            onClick={e => { e.preventDefault(); onMarkFinal() }}
          >
            Mark Final
          </button>
        )}
      </div>
    </div>
  )
}
