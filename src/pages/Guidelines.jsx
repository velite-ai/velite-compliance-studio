import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { extractGuidelineSummary } from '../lib/anthropic'

const CATEGORIES = [
  { value: 'general',    label: 'General',    icon: '📄' },
  { value: 'brand',      label: 'Brand',      icon: '🎨' },
  { value: 'regulatory', label: 'Regulatory', icon: '📋' },
  { value: 'sop',        label: 'SOP',        icon: '🔧' },
]

const TRACKS = [
  { value: 'both',      label: 'Both tracks'     },
  { value: 'cosmetic',  label: 'Cosmetic only'   },
  { value: 'drug',      label: 'Drug only'       },
]

function categoryMeta(cat) {
  return CATEGORIES.find(c => c.value === cat) || { label: cat, icon: '📄' }
}

function fmtSize(b) {
  if (!b) return ''
  if (b < 1024)        return `${b} B`
  if (b < 1024 * 1024) return `${(b/1024).toFixed(1)} KB`
  return `${(b/(1024*1024)).toFixed(1)} MB`
}

export default function Guidelines() {
  const { user } = useAuth()

  // ── List state ──────────────────────────────────────────────────────────
  const [guidelines, setGuidelines] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [filterTrack, setFilterTrack] = useState('all')

  // ── Upload / form state ─────────────────────────────────────────────────
  const [title,       setTitle]      = useState('')
  const [category,    setCategory]   = useState('general')
  const [track,       setTrack]      = useState('both')
  const [file,        setFile]       = useState(null)
  const [textContent, setTextContent] = useState('')
  const [uploading,   setUploading]  = useState(false)
  const [uploadErr,   setUploadErr]  = useState(null)
  const [expandForm,  setExpandForm] = useState(false)
  const fileRef = useRef()

  // ── Inline edit state ───────────────────────────────────────────────────
  const [editingId,      setEditingId]      = useState(null)
  const [editTitle,      setEditTitle]      = useState('')
  const [editCategory,   setEditCategory]   = useState('general')
  const [editTrack,      setEditTrack]      = useState('both')
  const [editSummary,    setEditSummary]    = useState('')
  const [savingEdit,     setSavingEdit]     = useState(false)

  useEffect(() => { loadGuidelines() }, [])

  async function loadGuidelines() {
    setLoadingList(true)
    const { data } = await supabase
      .from('internal_guidelines')
      .select('*')
      .order('created_at', { ascending: false })
    setGuidelines(data || [])
    setLoadingList(false)
  }

  // ── Upload + AI extract ─────────────────────────────────────────────────
  async function handleUpload(e) {
    e.preventDefault()
    if (!file && !textContent.trim()) {
      setUploadErr('Please upload a file or paste text content.')
      return
    }
    if (!title.trim()) {
      setUploadErr('Please enter a title for this guideline.')
      return
    }
    setUploading(true)
    setUploadErr(null)

    try {
      let filePath   = null
      let fileName   = null
      let fileSize   = null
      let base64     = null
      let mimeType   = null

      // ── Upload file to storage ──────────────────────────────────────────
      if (file) {
        const uid      = crypto.randomUUID()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        filePath = `${uid}/${safeName}`
        fileName = file.name
        fileSize = file.size

        const { error: uploadError } = await supabase.storage
          .from('guidelines')
          .upload(filePath, file, { contentType: file.type, upsert: false })
        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

        // If image — read as base64 for Claude vision
        if (file.type.startsWith('image/')) {
          base64   = await fileToBase64(file)
          mimeType = file.type
        }
      }

      // ── AI extraction ───────────────────────────────────────────────────
      const { summary, full_content, suggested_title } = await extractGuidelineSummary({
        title:      title.trim(),
        category,
        track,
        content:    textContent.trim() || null,
        base64:     base64 || null,
        mimeType:   mimeType || null,
      })

      // ── Save to database ────────────────────────────────────────────────
      const { error: dbError } = await supabase
        .from('internal_guidelines')
        .insert({
          file_name:       fileName || `${title.trim()}.txt`,
          file_path:       filePath || '',
          title:           suggested_title || title.trim(),
          summary,
          full_content,
          category,
          is_active:       true,
          applies_to_track: track,
          uploaded_by:     user?.id,
        })
      if (dbError) throw new Error(`Database insert failed: ${dbError.message}`)

      // Reset form
      setTitle('')
      setCategory('general')
      setTrack('both')
      setFile(null)
      setTextContent('')
      setExpandForm(false)
      if (fileRef.current) fileRef.current.value = ''
      await loadGuidelines()
    } catch(err) {
      console.error(err)
      setUploadErr(err.message)
    }
    setUploading(false)
  }

  function fileToBase64(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(f)
    })
  }

  // ── Toggle active ───────────────────────────────────────────────────────
  async function toggleActive(id, current) {
    setGuidelines(prev => prev.map(g => g.id === id ? { ...g, is_active: !current } : g))
    await supabase.from('internal_guidelines').update({ is_active: !current }).eq('id', id)
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  async function deleteGuideline(id, filePath) {
    if (!window.confirm('Delete this guideline? This cannot be undone.')) return
    if (filePath) {
      await supabase.storage.from('guidelines').remove([filePath])
    }
    await supabase.from('internal_guidelines').delete().eq('id', id)
    setGuidelines(prev => prev.filter(g => g.id !== id))
  }

  // ── Inline edit ─────────────────────────────────────────────────────────
  function startEdit(g) {
    setEditingId(g.id)
    setEditTitle(g.title || '')
    setEditCategory(g.category || 'general')
    setEditTrack(g.applies_to_track || 'both')
    setEditSummary(g.summary || '')
  }

  async function saveEdit(id) {
    setSavingEdit(true)
    await supabase.from('internal_guidelines').update({
      title:            editTitle,
      category:         editCategory,
      applies_to_track: editTrack,
      summary:          editSummary,
    }).eq('id', id)
    setGuidelines(prev => prev.map(g => g.id === id ? {
      ...g,
      title:            editTitle,
      category:         editCategory,
      applies_to_track: editTrack,
      summary:          editSummary,
    } : g))
    setEditingId(null)
    setSavingEdit(false)
  }

  // ── Derived ─────────────────────────────────────────────────────────────
  const filtered = guidelines.filter(g =>
    filterTrack === 'all' ||
    g.applies_to_track === filterTrack ||
    g.applies_to_track === 'both'
  )

  const activeCount = guidelines.filter(g => g.is_active).length

  return (
    <div>
      {/* ── Stats banner ── */}
      <div className="guideline-banner">
        <div className="guideline-banner-icon">📚</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            {activeCount} active guideline{activeCount !== 1 ? 's' : ''} injected into every compliance check
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            Upload Velite's internal SOPs, brand standards, and packaging guidelines. Active ones are automatically included in every AI check.
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          onClick={() => setExpandForm(v => !v)}
        >
          {expandForm ? '✕ Cancel' : '＋ Add Guideline'}
        </button>
      </div>

      {/* ── Upload form ── */}
      {expandForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text)' }}>
            Add New Guideline
          </div>
          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Label Font Minimum Size SOP"
                  required
                />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Applies to track</label>
                <select className="form-select" value={track} onChange={e => setTrack(e.target.value)}>
                  {TRACKS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label className="form-label">Upload file (PDF, image, or doc)</label>
                <input
                  ref={fileRef}
                  type="file"
                  className="form-input"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx"
                  onChange={e => setFile(e.target.files[0] || null)}
                  style={{ padding: '7px 10px', cursor: 'pointer' }}
                />
                {file && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    {file.name} · {fmtSize(file.size)}
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">
                  Text content
                  <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 4 }}>
                    — paste for AI extraction (required for PDFs)
                  </span>
                </label>
                <textarea
                  className="form-textarea"
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  rows={4}
                  placeholder="Paste key rules or the full text content of the document here. Claude will extract a structured summary…"
                />
              </div>
            </div>

            {uploadErr && (
              <div className="form-error" style={{ marginBottom: 12 }}>{uploadErr}</div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn btn-primary" type="submit" disabled={uploading}>
                {uploading
                  ? <><span className="spinner" /> Uploading &amp; extracting…</>
                  : '✨ Upload &amp; AI Extract'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Claude will summarise the content and make it available to all future checks.
              </span>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter chips ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Show:</span>
        {['all', 'cosmetic', 'drug'].map(t => (
          <button
            key={t}
            className={`filter-chip${filterTrack === t ? ' active' : ''}`}
            onClick={() => setFilterTrack(t)}
          >
            {t === 'all' ? `All (${guidelines.length})` : t === 'cosmetic' ? '🌿 Cosmetic' : '💊 Drug'}
          </button>
        ))}
      </div>

      {/* ── Guidelines list ── */}
      {loadingList ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>
          <span className="spinner" /> Loading guidelines…
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>No guidelines yet</h3>
          <p>Upload your internal SOPs, brand standards, or packaging guidelines. Claude will extract and use them in every compliance check.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setExpandForm(true)}>
            ＋ Add First Guideline
          </button>
        </div>
      ) : (
        <div className="guideline-list">
          {filtered.map(g => (
            <GuidelineCard
              key={g.id}
              g={g}
              isEditing={editingId === g.id}
              editTitle={editTitle}        setEditTitle={setEditTitle}
              editCategory={editCategory}  setEditCategory={setEditCategory}
              editTrack={editTrack}        setEditTrack={setEditTrack}
              editSummary={editSummary}    setEditSummary={setEditSummary}
              savingEdit={savingEdit}
              onToggle={() => toggleActive(g.id, g.is_active)}
              onEdit={() => startEdit(g)}
              onSaveEdit={() => saveEdit(g.id)}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => deleteGuideline(g.id, g.file_path)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GuidelineCard({
  g,
  isEditing,
  editTitle, setEditTitle,
  editCategory, setEditCategory,
  editTrack, setEditTrack,
  editSummary, setEditSummary,
  savingEdit,
  onToggle, onEdit, onSaveEdit, onCancelEdit, onDelete,
}) {
  const cm = categoryMeta(g.category)
  const trackColors = {
    both:     { bg: 'var(--surface-3)',  color: 'var(--text-2)' },
    cosmetic: { bg: 'var(--accent-light)', color: 'var(--accent)' },
    drug:     { bg: 'var(--drug-bg)',    color: 'var(--drug)'   },
  }
  const tc = trackColors[g.applies_to_track] || trackColors.both

  return (
    <div className={`guideline-card${g.is_active ? ' active' : ''}`}>
      {/* Active indicator bar */}
      {g.is_active && <div className="guideline-active-bar" />}

      {isEditing ? (
        /* ── Edit mode ── */
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Title</label>
              <input className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Category</label>
              <select className="form-select" value={editCategory} onChange={e => setEditCategory(e.target.value)} style={{ fontSize: 13 }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 10 }}>Track</label>
              <select className="form-select" value={editTrack} onChange={e => setEditTrack(e.target.value)} style={{ fontSize: 13 }}>
                {TRACKS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <label className="form-label" style={{ fontSize: 10 }}>Summary (shown in checks)</label>
          <textarea
            className="form-textarea"
            value={editSummary}
            onChange={e => setEditSummary(e.target.value)}
            rows={3}
            style={{ fontSize: 12, marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={onSaveEdit} disabled={savingEdit}>
              {savingEdit ? <><span className="spinner" /> Saving…</> : '✓ Save'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onCancelEdit}>Cancel</button>
          </div>
        </div>
      ) : (
        /* ── View mode ── */
        <div style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Category icon */}
          <div className="guideline-icon">{cm.icon}</div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                {g.title || g.file_name}
              </span>
              <span className="badge" style={{ background: tc.bg, color: tc.color, fontSize: 10 }}>
                {g.applies_to_track === 'both' ? 'All tracks' : g.applies_to_track}
              </span>
              <span className="badge badge-gray" style={{ fontSize: 10 }}>{cm.label}</span>
              {g.is_active
                ? <span className="badge badge-pass" style={{ fontSize: 10 }}>✓ Active</span>
                : <span className="badge" style={{ fontSize: 10, background: 'var(--surface-3)', color: 'var(--text-3)' }}>Inactive</span>
              }
            </div>

            {g.summary && (
              <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 6px', lineHeight: 1.55 }}>
                {g.summary}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-3)', flexWrap: 'wrap' }}>
              {g.file_name && (
                <span>📎 {g.file_name}{g.file_size_bytes ? ` · ${fmtSize(g.file_size_bytes)}` : ''}</span>
              )}
              <span>{new Date(g.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            {/* Active toggle */}
            <button
              className={`guideline-toggle${g.is_active ? ' on' : ''}`}
              onClick={onToggle}
              title={g.is_active ? 'Deactivate' : 'Activate'}
            >
              <span className="guideline-toggle-knob" />
            </button>

            <button className="btn btn-ghost btn-sm" onClick={onEdit} style={{ padding: '4px 9px' }}>
              ✏️
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onDelete}
              style={{ padding: '4px 9px', color: 'var(--fail)' }}
            >
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
