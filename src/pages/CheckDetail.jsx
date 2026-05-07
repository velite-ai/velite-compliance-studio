import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ScoreCircle from '../components/ScoreCircle'
import VerdictBadge from '../components/VerdictBadge'
import TrackBadge from '../components/TrackBadge'
import CheckTypeBadge from '../components/CheckTypeBadge'
import { format, parseISO } from 'date-fns'
import { generateCompliancePDF, generateDesignerBriefPDF, generateAnnotatedJPEG } from '../lib/reports'

export default function CheckDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const reportRef = useRef()
  const imgRef    = useRef()   // ref for the annotation image

  // ── Core state ────────────────────────────────────────────────────────
  const [check,    setCheck]    = useState(null)
  const [frontUrl, setFrontUrl] = useState(null)
  const [backUrl,  setBackUrl]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [notes,    setNotes]    = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [approving,   setApproving]   = useState(false)
  const [activeTab,   setActiveTab]   = useState('issues')

  // ── Annotation state ──────────────────────────────────────────────────
  // markers: [{ x, y, issue_index }]  x/y are 0-1 ratios within image
  const [markers,           setMarkers]           = useState([])
  const [selectedIssueIdx,  setSelectedIssueIdx]  = useState(null)
  const [savingAnnotations, setSavingAnnotations] = useState(false)
  const [annotationsSaved,  setAnnotationsSaved]  = useState(false)

  // ── Reports state ──────────────────────────────────────────────────────
  const [generatingReport, setGeneratingReport] = useState(null) // 'compliance' | 'brief' | 'jpeg' | null

  useEffect(() => { load() }, [id])

  async function load() {
    const { data } = await supabase
      .from('checks')
      .select('*, profiles!checks_user_id_fkey(full_name)')
      .eq('id', id)
      .single()

    if (data) {
      setCheck(data)
      setNotes(data.notes || '')
      if (data.annotation_markers?.length) setMarkers(data.annotation_markers)

      const frontPath = data.front_file_path || data.label_file_path
      if (frontPath) {
        const { data: fUrl } = await supabase.storage.from('labels').createSignedUrl(frontPath, 3600)
        if (fUrl) setFrontUrl(fUrl.signedUrl)
      }
      if (data.back_file_path) {
        const { data: bUrl } = await supabase.storage.from('labels').createSignedUrl(data.back_file_path, 3600)
        if (bUrl) setBackUrl(bUrl.signedUrl)
      }
    }
    setLoading(false)
  }

  async function approve() {
    setApproving(true)
    await supabase.from('checks').update({
      is_approved: true,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    }).eq('id', id)
    setCheck(c => ({ ...c, is_approved: true, approved_at: new Date().toISOString() }))
    setApproving(false)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await supabase.from('checks').update({ notes }).eq('id', id)
    setSavingNotes(false)
  }

  async function saveAnnotations() {
    setSavingAnnotations(true)
    await supabase.from('checks').update({ annotation_markers: markers }).eq('id', id)
    setAnnotationsSaved(true)
    setSavingAnnotations(false)
  }

  async function exportPDF() {
    const { default: jsPDF }      = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')
    const el     = reportRef.current
    const canvas = await html2canvas(el, { scale: 2, useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const w = pdf.internal.pageSize.getWidth()
    const h = (canvas.height * w) / canvas.width
    let y = 0
    const pageH = pdf.internal.pageSize.getHeight()
    while (y < h) {
      if (y > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, -y, w, h)
      y += pageH
    }
    pdf.save(`${check.product_name || 'compliance-report'}-${format(new Date(), 'yyyyMMdd')}.pdf`)
  }

  // ── Annotation handlers ───────────────────────────────────────────────
  function handleAnnotationClick(e) {
    if (selectedIssueIdx === null) return
    const img  = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const x = (e.clientX - rect.left)  / rect.width
    const y = (e.clientY - rect.top)   / rect.height

    setMarkers(prev => {
      const rest = prev.filter(m => m.issue_index !== selectedIssueIdx)
      return [...rest, { x, y, issue_index: selectedIssueIdx }]
    })
    setAnnotationsSaved(false)

    // Auto-advance to next unplaced issue
    const afterPlace = new Set(
      markers.filter(m => m.issue_index !== selectedIssueIdx).map(m => m.issue_index)
    )
    afterPlace.add(selectedIssueIdx)
    const next = annotateItems.findIndex((_, i) => !afterPlace.has(i))
    setSelectedIssueIdx(next === -1 ? null : next)
  }

  function removeMarker(issueIdx) {
    setMarkers(prev => prev.filter(m => m.issue_index !== issueIdx))
    setAnnotationsSaved(false)
  }

  function clearAllMarkers() {
    setMarkers([])
    setSelectedIssueIdx(null)
    setAnnotationsSaved(false)
  }

  // ── Report download handlers ───────────────────────────────────────────────
  async function downloadCompliancePDF() {
    setGeneratingReport('compliance')
    try {
      const doc = await generateCompliancePDF(check)
      doc.save(`${check.product_name || 'compliance'}-report-${format(new Date(), 'yyyyMMdd')}.pdf`)
    } catch(e) { console.error(e) }
    setGeneratingReport(null)
  }

  async function downloadDesignerBrief() {
    setGeneratingReport('brief')
    try {
      const doc = await generateDesignerBriefPDF(check)
      doc.save(`${check.product_name || 'designer'}-brief-${format(new Date(), 'yyyyMMdd')}.pdf`)
    } catch(e) { console.error(e) }
    setGeneratingReport(null)
  }

  async function downloadAnnotatedJPEG() {
    if (!frontUrl || markers.length === 0) return
    setGeneratingReport('jpeg')
    try {
      const blob = await generateAnnotatedJPEG(frontUrl, markers, annotateItems)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${check.product_name || 'annotated'}-label-${format(new Date(), 'yyyyMMdd')}.jpg`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e) { console.error(e) }
    setGeneratingReport(null)
  }

  // ── Derived data ──────────────────────────────────────────────────────
  if (loading) return <div className="loading-page"><span className="spinner" /> Loading report…</div>
  if (!check)  return <div className="loading-page">Check not found.</div>

  const items     = check.report_json || []
  const failItems = items.filter(i => i.status === 'FAIL')
  const warnItems = items.filter(i => i.status === 'WARNING')
  const passItems = items.filter(i => i.status === 'PASS')

  // Items eligible for annotation (FAIL + WARNING), in that order
  const annotateItems = [...failItems, ...warnItems]

  function markerForIssue(issueIdx) {
    return markers.find(m => m.issue_index === issueIdx)
  }

  function markerColor(issueIdx) {
    return annotateItems[issueIdx]?.status === 'FAIL' ? 'var(--fail)' : 'var(--warn)'
  }

  const hasAnnotatable = annotateItems.length > 0 && frontUrl

  return (
    <div>
      {/* Top action bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
        <div style={{ flex: 1 }} />
        {!check.is_approved && (
          <button className="btn btn-success" onClick={approve} disabled={approving}>
            {approving ? <><span className="spinner" /> Approving…</> : '✓ Approve Label'}
          </button>
        )}
        <button className="btn btn-primary" onClick={exportPDF}>⬇ Export PDF</button>
      </div>

      {check.is_approved && (
        <div className="approved-banner">
          ✓ Approved on {check.approved_at ? format(parseISO(check.approved_at), 'dd MMM yyyy') : ''}
          {check.notes && <span style={{ fontSize: 11, color: 'var(--pass)', marginLeft: 8 }}>· Notes saved</span>}
        </div>
      )}

      {/* Printable area */}
      <div ref={reportRef} id="pdf-report">

        {/* Result header */}
        <div className="result-header">
          <ScoreCircle score={check.score || 0} size={96} />
          <div className="result-meta">
            <div className="result-product">{check.product_name}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <VerdictBadge verdict={check.verdict} size="lg" />
              {check.track      && <TrackBadge     track={check.track}           />}
              {check.check_type && <CheckTypeBadge checkType={check.check_type} />}
              {check.product_category && <span className="badge badge-gray">{check.product_category}</span>}
              {check.is_approved && <span className="badge badge-pass">✓ Approved</span>}
              {markers.length > 0 && (
                <span className="badge badge-gray">📍 {markers.length} annotation{markers.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="result-summary">{check.summary}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text-3)', flexWrap: 'wrap' }}>
              <span>Checked by {check.profiles?.full_name || 'Unknown'}</span>
              <span>·</span>
              <span>{check.created_at ? format(parseISO(check.created_at), 'dd MMM yyyy, HH:mm') : ''}</span>
              {check.regulations_checked?.length > 0 && (
                <><span>·</span><span>Checked against {check.regulations_checked.join(', ')}</span></>
              )}
            </div>
          </div>
          {(frontUrl || backUrl) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {frontUrl && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Front</div>
                  <img src={frontUrl} alt="Label front" className="label-preview" style={{ width: 110, height: 110 }} />
                </div>
              )}
              {backUrl && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Back</div>
                  <img src={backUrl} alt="Label back" className="label-preview" style={{ width: 110, height: 110 }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn${activeTab === 'issues' ? ' active' : ''}`} onClick={() => setActiveTab('issues')}>
            Issues ({failItems.length + warnItems.length})
          </button>
          <button className={`tab-btn${activeTab === 'passed' ? ' active' : ''}`} onClick={() => setActiveTab('passed')}>
            Passed ({passItems.length})
          </button>
          {hasAnnotatable && (
            <button className={`tab-btn${activeTab === 'annotate' ? ' active' : ''}`} onClick={() => setActiveTab('annotate')}>
              📍 Annotate {markers.length > 0 ? `(${markers.length})` : ''}
            </button>
          )}
          <button className={`tab-btn${activeTab === 'notes' ? ' active' : ''}`} onClick={() => setActiveTab('notes')}>
            Notes
          </button>
          <button className={`tab-btn${activeTab === 'reports' ? ' active' : ''}`} onClick={() => setActiveTab('reports')}>
            📄 Reports
          </button>
        </div>

        {/* ── ISSUES TAB ── */}
        {activeTab === 'issues' && (
          <div>
            {failItems.length === 0 && warnItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎉</div>
                <h3>No issues found</h3>
                <p>All checks passed for this label.</p>
              </div>
            ) : (
              <>
                {failItems.length > 0 && (
                  <div className="issues-section">
                    <h3>❌ Failed ({failItems.length})</h3>
                    <div className="issue-list">
                      {failItems.map((item, i) => (
                        <IssueCard key={i} item={item} markerNum={markerForIssue(i) ? i + 1 : null} />
                      ))}
                    </div>
                  </div>
                )}
                {warnItems.length > 0 && (
                  <div className="issues-section">
                    <h3>⚠️ Warnings ({warnItems.length})</h3>
                    <div className="issue-list">
                      {warnItems.map((item, i) => {
                        const idx = failItems.length + i
                        return <IssueCard key={i} item={item} markerNum={markerForIssue(idx) ? idx + 1 : null} />
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── PASSED TAB ── */}
        {activeTab === 'passed' && (
          <div className="issue-list">
            {passItems.length === 0
              ? <div className="empty-state"><p>No passed checks to display.</p></div>
              : passItems.map((item, i) => <IssueCard key={i} item={item} />)
            }
          </div>
        )}

        {/* ── ANNOTATE TAB ── */}
        {activeTab === 'annotate' && (
          <div>
            {/* Instructions */}
            <div className="annotate-instructions">
              <span style={{ fontSize: 14 }}>📍</span>
              <div>
                <strong>How to annotate:</strong> Select an issue from the list, then click the label image to place its numbered marker.
                Click the same issue again to move its marker. Markers are saved separately from the report.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginTop: 16 }}>

              {/* Left: Issue selector */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                  Issues to annotate
                </div>
                <div className="annotate-issue-list">
                  {annotateItems.map((item, i) => {
                    const placed   = !!markerForIssue(i)
                    const selected = selectedIssueIdx === i
                    return (
                      <div
                        key={i}
                        className={`annotate-issue-row${selected ? ' selected' : ''}${placed ? ' placed' : ''}`}
                        onClick={() => setSelectedIssueIdx(selected ? null : i)}
                      >
                        <div
                          className="annotate-num"
                          style={{ background: item.status === 'FAIL' ? 'var(--fail)' : 'var(--warn)' }}
                        >
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{item.field}</div>
                          {item.issue && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.issue}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                          {placed && (
                            <button
                              className="btn btn-sm"
                              style={{ padding: '2px 7px', fontSize: 10 }}
                              onClick={e => { e.stopPropagation(); removeMarker(i) }}
                            >
                              ✕
                            </button>
                          )}
                          <span style={{ fontSize: 10, color: placed ? 'var(--pass)' : 'var(--text-3)' }}>
                            {placed ? '✓ placed' : 'click to select'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Save / Clear */}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={saveAnnotations}
                    disabled={savingAnnotations || markers.length === 0}
                  >
                    {savingAnnotations
                      ? <><span className="spinner" /> Saving…</>
                      : annotationsSaved ? '✓ Saved' : '💾 Save Annotations'}
                  </button>
                  {markers.length > 0 && (
                    <button className="btn" onClick={clearAllMarkers} style={{ padding: '8px 12px' }}>
                      Clear all
                    </button>
                  )}
                </div>

                {selectedIssueIdx !== null && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--accent-light)', borderRadius: 6, fontSize: 11, color: 'var(--accent-hover)', border: '1px solid var(--accent-muted)' }}>
                    <strong>#{selectedIssueIdx + 1} selected</strong> — click anywhere on the label image to place the marker
                  </div>
                )}
              </div>

              {/* Right: Annotated image */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                  Label image {selectedIssueIdx !== null ? '— click to place marker' : ''}
                </div>
                <div
                  className={`annotation-canvas${selectedIssueIdx !== null ? ' selecting' : ''}`}
                  onClick={handleAnnotationClick}
                >
                  <img
                    ref={imgRef}
                    src={frontUrl}
                    alt="Label front"
                    style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none', pointerEvents: 'none' }}
                    draggable={false}
                  />
                  {/* Overlay markers */}
                  {markers.map(m => {
                    const isSelected = selectedIssueIdx === m.issue_index
                    const status     = annotateItems[m.issue_index]?.status || 'FAIL'
                    return (
                      <div
                        key={m.issue_index}
                        className={`annotation-marker ${status}${isSelected ? ' selected' : ''}`}
                        style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedIssueIdx(prev => prev === m.issue_index ? null : m.issue_index)
                        }}
                      >
                        {m.issue_index + 1}
                      </div>
                    )
                  })}
                </div>
                {markers.length === 0 && selectedIssueIdx === null && (
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, textAlign: 'center' }}>
                    Select an issue on the left to begin placing markers on the image
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── NOTES TAB ── */}
        {activeTab === 'notes' && (
          <div className="notes-area">
            <label className="form-label">Internal Notes</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={6}
              placeholder="Add reviewer notes, action items, or follow-up tasks…"
            />
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 10 }}
              onClick={saveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? <><span className="spinner" /> Saving…</> : 'Save Notes'}
            </button>
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {activeTab === 'reports' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
              Download structured reports for compliance review, design revisions, or packaging records.
            </p>
            <div className="reports-grid">

              {/* Compliance PDF */}
              <div className="report-card">
                <div className="report-card-icon green">📋</div>
                <div className="report-card-content">
                  <div className="report-card-title">Compliance Report PDF</div>
                  <div className="report-card-desc">Full structured report with all issues, scores, and recommendations.</div>
                  <ul className="report-card-includes">
                    <li>Verdict badge &amp; compliance score</li>
                    <li>All FAIL and WARNING items</li>
                    <li>Passed checks &amp; logo/mark checks</li>
                    <li>Style suggestions (if any)</li>
                  </ul>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={downloadCompliancePDF}
                  disabled={generatingReport === 'compliance'}
                >
                  {generatingReport === 'compliance'
                    ? <><span className="spinner" /> Generating…</>
                    : '⬇ Download PDF'}
                </button>
              </div>

              {/* Designer Brief PDF */}
              <div className="report-card">
                <div className="report-card-icon amber">✏️</div>
                <div className="report-card-content">
                  <div className="report-card-title">Designer Brief PDF</div>
                  <div className="report-card-desc">Concise action list for the packaging designer — share directly.</div>
                  <ul className="report-card-includes">
                    <li>Numbered FIX / REVIEW items only</li>
                    <li>Specific recommendations per item</li>
                    <li>Approval &amp; sign-off section</li>
                  </ul>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={downloadDesignerBrief}
                  disabled={generatingReport === 'brief'}
                >
                  {generatingReport === 'brief'
                    ? <><span className="spinner" /> Generating…</>
                    : '⬇ Download Brief'}
                </button>
              </div>

              {/* Annotated JPEG */}
              <div className={`report-card${!frontUrl || markers.length === 0 ? ' report-card-disabled' : ''}`}>
                <div className="report-card-icon purple">📍</div>
                <div className="report-card-content">
                  <div className="report-card-title">Annotated Label Image</div>
                  <div className="report-card-desc">
                    {!frontUrl
                      ? 'No label image uploaded for this check.'
                      : markers.length === 0
                        ? 'Add annotation markers on the Annotate tab first.'
                        : `Label image with ${markers.length} numbered issue marker${markers.length !== 1 ? 's' : ''}.`
                    }
                  </div>
                  <ul className="report-card-includes">
                    <li>Numbered circles on label image</li>
                    <li>Red = FAIL · Amber = WARNING</li>
                    <li>High-quality JPEG export</li>
                  </ul>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={downloadAnnotatedJPEG}
                  disabled={!frontUrl || markers.length === 0 || generatingReport === 'jpeg'}
                >
                  {generatingReport === 'jpeg'
                    ? <><span className="spinner" /> Generating…</>
                    : '⬇ Download JPEG'}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function IssueCard({ item, markerNum = null }) {
  return (
    <div className={`issue-card ${item.status}`}>
      <div className="issue-header">
        {markerNum !== null && (
          <div
            className="annotate-num"
            style={{
              background: item.status === 'FAIL' ? 'var(--fail)' : 'var(--warn)',
              width: 20, height: 20, fontSize: 10, flexShrink: 0,
            }}
          >
            {markerNum}
          </div>
        )}
        <span className="issue-field">{item.field}</span>
        {item.regulation && <span className="issue-reg">{item.regulation}</span>}
      </div>
      {item.found && item.status !== 'PASS' && (
        <div className="issue-detail">Found: {item.found}</div>
      )}
      {item.issue && <div className="issue-detail" style={{ marginTop: 3 }}>{item.issue}</div>}
      {item.recommendation && <div className="issue-rec">💡 {item.recommendation}</div>}
    </div>
  )
}
