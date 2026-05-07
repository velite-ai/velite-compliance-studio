import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ScoreCircle from '../components/ScoreCircle'
import VerdictBadge from '../components/VerdictBadge'
import TrackBadge from '../components/TrackBadge'
import { format, parseISO } from 'date-fns'

export default function CheckDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const reportRef = useRef()

  const [check, setCheck] = useState(null)
  const [labelUrl, setLabelUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [approving, setApproving] = useState(false)
  const [activeTab, setActiveTab] = useState('issues')

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
      if (data.label_file_path) {
        const { data: urlData } = await supabase.storage.from('labels').createSignedUrl(data.label_file_path, 3600)
        if (urlData) setLabelUrl(urlData.signedUrl)
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

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')
    const el = reportRef.current
    const canvas = await html2canvas(el, { scale: 2, useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
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

  if (loading) return <div className="loading-page"><span className="spinner" /> Loading report…</div>
  if (!check) return <div className="loading-page">Check not found.</div>

  const items      = check.report_json || []
  const failItems  = items.filter(i => i.status === 'FAIL')
  const warnItems  = items.filter(i => i.status === 'WARNING')
  const passItems  = items.filter(i => i.status === 'PASS')

  return (
    <div>
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

      {/* Printable report area */}
      <div ref={reportRef} id="pdf-report">
        {/* Header */}
        <div className="result-header">
          <ScoreCircle score={check.score || 0} size={96} />
          <div className="result-meta">
            <div className="result-product">{check.product_name}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <VerdictBadge verdict={check.verdict} size="lg" />
              {check.track && <TrackBadge track={check.track} />}
              {check.product_category && <span className="badge badge-gray">{check.product_category}</span>}
              {check.is_approved && <span className="badge badge-pass">✓ Approved</span>}
            </div>
            <div className="result-summary">{check.summary}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
              <span>Checked by {check.profiles?.full_name || 'Unknown'}</span>
              <span>·</span>
              <span>{check.created_at ? format(parseISO(check.created_at), 'dd MMM yyyy, HH:mm') : ''}</span>
              {check.regulations_checked?.length > 0 && (
                <><span>·</span><span>Checked against {check.regulations_checked.join(', ')}</span></>
              )}
            </div>
          </div>
          {labelUrl && (
            <img src={labelUrl} alt="Label" className="label-preview" style={{ width: 120, height: 120 }} />
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
          <button className={`tab-btn${activeTab === 'notes' ? ' active' : ''}`} onClick={() => setActiveTab('notes')}>
            Notes
          </button>
        </div>

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
                      {failItems.map((item, i) => <IssueCard key={i} item={item} />)}
                    </div>
                  </div>
                )}
                {warnItems.length > 0 && (
                  <div className="issues-section">
                    <h3>⚠️ Warnings ({warnItems.length})</h3>
                    <div className="issue-list">
                      {warnItems.map((item, i) => <IssueCard key={i} item={item} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'passed' && (
          <div className="issue-list">
            {passItems.length === 0
              ? <div className="empty-state"><p>No passed checks to display.</p></div>
              : passItems.map((item, i) => <IssueCard key={i} item={item} />)
            }
          </div>
        )}

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
      </div>
    </div>
  )
}

function IssueCard({ item }) {
  return (
    <div className={`issue-card ${item.status}`}>
      <div className="issue-header">
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
