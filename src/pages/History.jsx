import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import VerdictBadge from '../components/VerdictBadge'
import { format, parseISO } from 'date-fns'

export default function History() {
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [verdictFilter, setVerdictFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [approvedOnly, setApprovedOnly] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('checks')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
    if (data) setChecks(data)
    setLoading(false)
  }

  const categories = ['All', ...new Set(checks.map(c => c.product_category).filter(Boolean))]

  const filtered = checks.filter(c => {
    const q = search.toLowerCase()
    if (q && !c.product_name?.toLowerCase().includes(q) && !(c.product_category || '').toLowerCase().includes(q)) return false
    if (verdictFilter !== 'All' && c.verdict !== verdictFilter) return false
    if (categoryFilter !== 'All' && c.product_category !== categoryFilter) return false
    if (approvedOnly && !c.is_approved) return false
    return true
  })

  function exportCSV() {
    const headers = ['Product', 'Category', 'Score', 'Verdict', 'Approved', 'Date', 'Checked By']
    const rows = filtered.map(c => [
      c.product_name || '',
      c.product_category || '',
      c.score ?? '',
      c.verdict || '',
      c.is_approved ? 'Yes' : 'No',
      c.created_at ? format(parseISO(c.created_at), 'dd/MM/yyyy') : '',
      c.profiles?.full_name || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `velite-compliance-history-${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading history…</div>

  return (
    <div>
      <div className="filter-bar">
        <input
          className="form-input"
          placeholder="Search product…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 260 }}
        />
        <select className="form-select" value={verdictFilter} onChange={e => setVerdictFilter(e.target.value)}>
          <option>All</option>
          <option value="PASS">Pass</option>
          <option value="FAIL">Fail</option>
          <option value="REVIEW_REQUIRED">Review Required</option>
        </select>
        <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-2)' }}>
          <input type="checkbox" checked={approvedOnly} onChange={e => setApprovedOnly(e.target.checked)} />
          Approved only
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)', alignSelf: 'center' }}>
            {filtered.length} results
          </span>
          <button className="btn btn-sm" onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No results</h3>
            <p>Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Score</th>
                  <th>Verdict</th>
                  <th>Checked by</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.product_name || '—'}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{c.product_category || '—'}</td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: (c.score || 0) >= 80 ? 'var(--pass)' : (c.score || 0) >= 60 ? 'var(--warn)' : 'var(--fail)'
                      }}>
                        {c.score ?? '—'}
                      </span>
                    </td>
                    <td><VerdictBadge verdict={c.verdict} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {c.profiles?.full_name || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {c.created_at ? format(parseISO(c.created_at), 'dd MMM yyyy') : '—'}
                    </td>
                    <td>
                      {c.is_approved
                        ? <span className="badge badge-pass">✓ Approved</span>
                        : <span className="badge badge-gray">Pending</span>}
                    </td>
                    <td>
                      <Link to={`/checks/${c.id}`} className="btn btn-sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
