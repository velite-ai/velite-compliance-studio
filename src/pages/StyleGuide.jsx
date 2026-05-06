import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['general', 'ingredients', 'claims', 'layout', 'typography', 'brand']

export default function StyleGuide() {
  const { user } = useAuth()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [catFilter, setCatFilter] = useState('all')
  const [srcFilter, setSrcFilter] = useState('all')
  const [form, setForm] = useState({
    category: 'general', title: '', description: '',
    example_correct: '', example_incorrect: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('style_rules').select('*').order('created_at', { ascending: false })
    if (data) setRules(data)
    setLoading(false)
  }

  async function saveRule(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('style_rules')
      .insert({ ...form, source: 'manual', is_active: true, created_by: user.id })
      .select().single()
    if (data) {
      setRules(r => [data, ...r])
      setForm({ category: 'general', title: '', description: '', example_correct: '', example_incorrect: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function toggleRule(rule) {
    await supabase.from('style_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    setRules(r => r.map(x => x.id === rule.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function deleteRule(id) {
    if (!confirm('Delete this rule?')) return
    await supabase.from('style_rules').delete().eq('id', id)
    setRules(r => r.filter(x => x.id !== id))
  }

  const filtered = rules.filter(r => {
    if (catFilter !== 'all' && r.category !== catFilter) return false
    if (srcFilter !== 'all' && r.source !== srcFilter) return false
    return true
  })

  const autoLearned = rules.filter(r => r.source === 'auto-learned').length
  const manual      = rules.filter(r => r.source === 'manual').length

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading style guide…</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span className="badge badge-review">{autoLearned} Auto-learned</span>
            <span className="badge badge-gray">{manual} Manual</span>
            <span className="badge badge-pass">{rules.filter(r => r.is_active).length} Active</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
            Standards that AI learns from your approved labels are added here automatically.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(s => !s)}
        >
          {showForm ? '✕ Cancel' : '＋ Add manual style rule'}
        </button>
      </div>

      {/* Add rule form */}
      {showForm && (
        <div className="card mb-16" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">New Style Rule</span></div>
          <div className="card-body">
            <form onSubmit={saveRule}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rule Title *</label>
                  <input
                    className="form-input" placeholder="e.g. MRP must include tax note"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-textarea" rows={2}
                  placeholder="Describe the rule in detail…"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Correct example</label>
                  <input
                    className="form-input" placeholder="e.g. MRP ₹249 (Incl. all taxes)"
                    value={form.example_correct} onChange={e => setForm(f => ({ ...f, example_correct: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Incorrect example</label>
                  <input
                    className="form-input" placeholder="e.g. MRP Rs. 249/-"
                    value={form.example_incorrect} onChange={e => setForm(f => ({ ...f, example_incorrect: e.target.value }))}
                  />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : 'Save Rule'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <select className="form-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="form-select" value={srcFilter} onChange={e => setSrcFilter(e.target.value)}>
          <option value="all">All sources</option>
          <option value="manual">Manual only</option>
          <option value="auto-learned">Auto-learned only</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {filtered.length} rule{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Rules list */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">◉</div>
            <h3>No rules yet</h3>
            <p>
              Every time you approve a label, Velite standards will be applied automatically.<br />
              Or add manual style rules above.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(rule => (
            <div key={rule.id} className={`rule-card${rule.is_active ? '' : ' inactive'}`}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span className="rule-title">{rule.title}</span>
                  <span className="badge badge-gray" style={{ fontSize: 10, textTransform: 'capitalize' }}>
                    {rule.category}
                  </span>
                  {rule.source === 'auto-learned' && (
                    <span className="badge badge-review" style={{ fontSize: 10 }}>Auto-learned</span>
                  )}
                  {!rule.is_active && (
                    <span className="badge badge-gray" style={{ fontSize: 10 }}>Inactive</span>
                  )}
                </div>
                <div className="rule-desc">{rule.description}</div>
                {rule.example_correct && (
                  <div className="rule-example" style={{ color: 'var(--pass)' }}>
                    ✓ {rule.example_correct}
                  </div>
                )}
                {rule.example_incorrect && (
                  <div className="rule-example" style={{ color: 'var(--fail)' }}>
                    ✗ {rule.example_incorrect}
                  </div>
                )}
              </div>
              <div className="rule-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => toggleRule(rule)}
                  title={rule.is_active ? 'Deactivate' : 'Activate'}
                >
                  {rule.is_active ? '⏸' : '▶'}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => deleteRule(rule.id)}
                  style={{ color: 'var(--fail)' }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12, color: 'var(--text-3)', border: '1px solid var(--border)' }}>
        <strong style={{ color: 'var(--text-2)' }}>How the learning layer works:</strong>{' '}
        After completing the compliance check, if you approve a label, AI uses these standards to flag deviations.
        On your next check, Velite conventions, house style preferences, or brand standards the AI should enforce will be applied automatically.
      </div>
    </div>
  )
}
