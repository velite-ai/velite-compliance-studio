import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import VerdictBadge from '../components/VerdictBadge'
import { format, parseISO } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

export default function Dashboard() {
  const [checks, setChecks] = useState([])
  const [stats, setStats] = useState({ total: 0, pass: 0, fail: 0, review: 0, approved: 0, avgScore: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('checks')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setChecks(data)
      const total    = data.length
      const pass     = data.filter(c => c.verdict === 'PASS').length
      const fail     = data.filter(c => c.verdict === 'FAIL').length
      const review   = data.filter(c => c.verdict === 'REVIEW_REQUIRED').length
      const approved = data.filter(c => c.is_approved).length
      const avgScore = total ? Math.round(data.reduce((s, c) => s + (c.score || 0), 0) / total) : 0
      setStats({ total, pass, fail, review, approved, avgScore })
    }
    setLoading(false)
  }

  // Build last 7 checks chart data
  const chartData = [...checks]
    .slice(0, 7)
    .reverse()
    .map(c => ({
      name: c.product_name?.split(' ')[0] || 'Product',
      score: c.score || 0,
      verdict: c.verdict,
    }))

  const scoreColor = (v) =>
    v === 'PASS' ? '#10b981' : v === 'FAIL' ? '#ef4444' : '#8b5cf6'

  if (loading) return (
    <div className="loading-page"><span className="spinner" /> Loading dashboard…</div>
  )

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-label">Total Checks</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-label">Pass Rate</div>
          <div className="stat-value" style={{ color: 'var(--pass)' }}>
            {stats.total ? Math.round((stats.pass / stats.total) * 100) : 0}%
          </div>
          <div className="stat-sub">{stats.pass} of {stats.total} checks</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-label">Avg Score</div>
          <div className="stat-value" style={{
            color: stats.avgScore >= 80 ? 'var(--pass)' : stats.avgScore >= 60 ? 'var(--warn)' : 'var(--fail)'
          }}>
            {stats.avgScore}
          </div>
          <div className="stat-sub">Out of 100</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-label">Approved Labels</div>
          <div className="stat-value" style={{ color: 'var(--review)' }}>{stats.approved}</div>
          <div className="stat-sub">In style guide</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-label">Failed Checks</div>
          <div className="stat-value" style={{ color: 'var(--fail)' }}>{stats.fail}</div>
          <div className="stat-sub">Needs attention</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔍</div>
          <div className="stat-label">Review Pending</div>
          <div className="stat-value" style={{ color: 'var(--review)' }}>{stats.review}</div>
          <div className="stat-sub">Awaiting review</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
        {/* Score chart */}
        {chartData.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Check Scores</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Last {chartData.length} checks</span>
            </div>
            <div className="card-body" style={{ padding: '16px 8px' }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} barSize={28}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    formatter={(val) => [`${val}/100`, 'Score']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={scoreColor(entry.verdict)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Verdict breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Verdict Breakdown</span>
          </div>
          <div className="card-body">
            {[
              { label: 'Pass', value: stats.pass, color: 'var(--pass)', bg: 'var(--pass-bg)' },
              { label: 'Fail', value: stats.fail, color: 'var(--fail)', bg: 'var(--fail-bg)' },
              { label: 'Review Required', value: stats.review, color: 'var(--review)', bg: 'var(--review-bg)' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{label}</span>
                    <span style={{ color: 'var(--text-3)' }}>{value}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${stats.total ? (value / stats.total) * 100 : 0}%`,
                      background: color,
                      borderRadius: 3,
                      transition: 'width .5s ease',
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent checks table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Checks</span>
          <Link to="/history" className="btn btn-ghost btn-sm">View all →</Link>
        </div>
        {checks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧴</div>
            <h3>No checks yet</h3>
            <p>Run your first compliance check to see results here.</p>
            <Link to="/new-check" className="btn btn-primary" style={{ marginTop: 16 }}>
              ＋ Run first check
            </Link>
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
                  <th>Checked</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {checks.slice(0, 10).map(c => (
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
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
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
