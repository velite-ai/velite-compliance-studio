/**
 * Velite Compliance Studio v2 — Report Generators
 *
 * generateCompliancePDF(check)            → jsPDF doc  (full report)
 * generateDesignerBriefPDF(check)         → jsPDF doc  (action items only)
 * generateAnnotatedJPEG(url, markers, items) → Blob (JPEG)
 */

// ── COLOUR PALETTE ────────────────────────────────────────────────────────
const C = {
  green:   [29,  107, 74],   // #1D6B4A  Velite brand
  amber:   [180, 83,  9],    // #b45309  drug track
  red:     [220, 38,  38],   // #dc2626  FAIL
  warn:    [217, 119, 6],    // #d97706  WARNING
  pass:    [22,  163, 74],   // #16a34a  PASS
  purple:  [124, 58,  237],  // #7c3aed  REVIEW / logo
  dark:    [15,  31,  22],   // text
  mid:     [61,  90,  74],   // text-2
  gray:    [122, 158, 140],  // text-3
  surface: [248, 250, 249],  // surface-2
  white:   [255, 255, 255],
}

const W  = 210   // A4 width  (mm)
const H  = 297   // A4 height (mm)
const M  = 15    // page margin
const CW = W - M * 2  // content width

// ── HELPERS ───────────────────────────────────────────────────────────────
function statusColor(s) {
  return { FAIL: C.red, WARNING: C.warn, PASS: C.pass }[s] || C.gray
}

function trackColor(track) {
  return track === 'drug' ? C.amber : C.green
}

/** Adds page number footer to every page. */
function addFooter(doc) {
  const n = doc.getNumberOfPages()
  for (let p = 1; p <= n; p++) {
    doc.setPage(p)
    doc.setFillColor(...C.surface)
    doc.rect(0, H - 10, W, 10, 'F')
    doc.setTextColor(...C.gray)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.text('Velite Compliance Studio v2 · Velite Healthcare · Confidential', M, H - 4)
    doc.text(`${p} / ${n}`, W - M, H - 4, { align: 'right' })
  }
}

/** Returns y, adding a new page if content would overflow. */
function cy(doc, y, needed = 20) {
  if (y + needed > H - 14) {
    doc.addPage()
    return M
  }
  return y
}

// ── COMPLIANCE PDF ────────────────────────────────────────────────────────
/**
 * Full compliance report: verdict, score, all items (FAIL / WARNING / PASS),
 * logo checks, style suggestions.
 */
export async function generateCompliancePDF(check) {
  const { default: jsPDF } = await import('jspdf')
  const doc     = new jsPDF({ unit: 'mm', format: 'a4' })
  const tColor  = trackColor(check.track)

  const items     = check.report_json || []
  const failItems = items.filter(i => i.status === 'FAIL'    && i.regulation !== 'Logo / Mark Check')
  const warnItems = items.filter(i => i.status === 'WARNING' && i.regulation !== 'Logo / Mark Check')
  const passItems = items.filter(i => i.status === 'PASS'    && i.regulation !== 'Logo / Mark Check')
  const logoItems = items.filter(i => i.regulation === 'Logo / Mark Check')

  // ── Header bar ──────────────────────────────────────────────────────────
  doc.setFillColor(...tColor)
  doc.rect(0, 0, W, 20, 'F')
  doc.setTextColor(...C.white)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('VELITE COMPLIANCE STUDIO', M, 8)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  const trackLabel = check.track === 'drug' ? 'Drug Track' : 'Cosmetic Track'
  const typeLabel  = check.check_type === 'post-print' ? 'Post-Print Verification' : 'Pre-Print Check'
  doc.text(`${trackLabel}  ·  ${typeLabel}`, M, 14)
  const dateStr = check.created_at
    ? new Date(check.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  doc.text(dateStr, W - M, 14, { align: 'right' })

  let y = 30

  // ── Product name ────────────────────────────────────────────────────────
  doc.setTextColor(...C.dark)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  const nameLines = doc.splitTextToSize(check.product_name || 'Compliance Report', CW - 50)
  doc.text(nameLines, M, y)
  y += nameLines.length * 7 + 2

  if (check.product_category) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(check.product_category, M, y)
    y += 6
  }

  // ── Verdict badge + Score ────────────────────────────────────────────────
  const vText  = { PASS: 'PASS', FAIL: 'FAIL', REVIEW_REQUIRED: 'REVIEW REQUIRED' }[check.verdict] || (check.verdict || '—')
  const vColor = { PASS: C.pass, FAIL: C.red,  REVIEW_REQUIRED: C.purple }[check.verdict] || C.gray
  doc.setFillColor(...vColor)
  doc.roundedRect(M, y, 38, 11, 2, 2, 'F')
  doc.setTextColor(...C.white)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(vText, M + 19, y + 7.2, { align: 'center' })

  doc.setTextColor(...C.dark)
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text(String(check.score ?? '—'), M + 50, y + 9.5)
  doc.setFontSize(9)
  doc.setTextColor(...C.gray)
  doc.setFont('helvetica', 'normal')
  doc.text('/ 100', M + 67, y + 9.5)

  // Fail / warn counts
  const sx = M + 88
  doc.setFontSize(8)
  doc.setFillColor(...C.red)
  doc.circle(sx + 2.5, y + 4, 2, 'F')
  doc.setTextColor(...C.dark)
  doc.text(`${failItems.length} fail${failItems.length !== 1 ? 's' : ''}`, sx + 6, y + 5)
  doc.setFillColor(...C.warn)
  doc.circle(sx + 2.5, y + 9, 2, 'F')
  doc.text(`${warnItems.length} warning${warnItems.length !== 1 ? 's' : ''}`, sx + 6, y + 10)
  y += 17

  // ── Summary box ──────────────────────────────────────────────────────────
  if (check.summary) {
    y = cy(doc, y, 20)
    const sumLines = doc.splitTextToSize(check.summary, CW - 8)
    const boxH     = sumLines.length * 4.5 + 8
    doc.setFillColor(...C.surface)
    doc.roundedRect(M, y, CW, boxH, 2, 2, 'F')
    doc.setDrawColor(...tColor)
    doc.setLineWidth(0.8)
    doc.line(M, y, M, y + boxH)
    doc.setTextColor(...C.mid)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(sumLines, M + 5, y + 5)
    y += boxH + 8
  }

  // ── Section helper ────────────────────────────────────────────────────────
  function addSection(title, sItems, secColor) {
    if (!sItems.length) return
    y = cy(doc, y, 14)

    doc.setFillColor(...secColor)
    doc.rect(M, y, CW, 7.5, 'F')
    doc.setTextColor(...C.white)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text(`${title}  (${sItems.length})`, M + 3, y + 5.2)
    y += 9.5

    sItems.forEach((item, idx) => {
      const issueLines = item.issue          ? doc.splitTextToSize(item.issue,          CW - 28) : []
      const recLines   = item.recommendation ? doc.splitTextToSize(item.recommendation, CW - 28) : []
      const rowH = 8 + (issueLines.length + recLines.length) * 3.8 + 4
      y = cy(doc, y, rowH)

      doc.setFillColor(...(idx % 2 === 0 ? C.white : C.surface))
      doc.rect(M, y, CW, rowH, 'F')

      // Status badge
      const sc = statusColor(item.status)
      doc.setFillColor(...sc)
      doc.roundedRect(W - M - 19, y + 2.5, 17, 5, 1, 1, 'F')
      doc.setTextColor(...C.white)
      doc.setFontSize(6)
      doc.setFont('helvetica', 'bold')
      doc.text(item.status === 'WARNING' ? 'WARN' : (item.status || ''), W - M - 10.5, y + 6, { align: 'center' })

      // Field
      doc.setTextColor(...C.dark)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      const maxFieldW = CW - 25
      const fieldStr  = doc.splitTextToSize(item.field || '—', maxFieldW)[0]
      doc.text(fieldStr, M + 3, y + 6)

      // Regulation
      if (item.regulation) {
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...C.gray)
        doc.text(item.regulation, M + 3, y + 10)
      }

      let iy = y + 13.5
      if (issueLines.length) {
        doc.setFontSize(7)
        doc.setTextColor(...C.mid)
        doc.setFont('helvetica', 'normal')
        doc.text(issueLines, M + 3, iy)
        iy += issueLines.length * 3.8
      }
      if (recLines.length) {
        doc.setFontSize(7)
        doc.setTextColor(...C.green)
        doc.setFont('helvetica', 'bold')
        doc.text(`→ ${recLines[0]}`, M + 3, iy)
      }
      y += rowH
    })
    y += 6
  }

  addSection('FAILS',              failItems, C.red)
  addSection('WARNINGS',           warnItems, C.warn)
  addSection('PASSED',             passItems, C.pass)
  addSection('LOGO & MARK CHECKS', logoItems, C.purple)

  // Style suggestions
  const sugg = check.style_suggestions || []
  if (sugg.length) {
    y = cy(doc, y, 14)
    doc.setFillColor(...C.purple)
    doc.rect(M, y, CW, 7.5, 'F')
    doc.setTextColor(...C.white)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text(`STYLE SUGGESTIONS  (${sugg.length})`, M + 3, y + 5.2)
    y += 9.5
    sugg.forEach((s, idx) => {
      const dLines = s.description ? doc.splitTextToSize(s.description, CW - 6) : []
      const rowH   = 8 + dLines.length * 3.5
      y = cy(doc, y, rowH)
      doc.setFillColor(...(idx % 2 === 0 ? C.white : C.surface))
      doc.rect(M, y, CW, rowH, 'F')
      doc.setTextColor(...C.dark)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(s.title || '—', M + 3, y + 6)
      if (dLines.length) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...C.mid)
        doc.text(dLines[0], M + 3, y + 11)
      }
      y += rowH
    })
  }

  addFooter(doc)
  return doc
}

// ── DESIGNER BRIEF PDF ────────────────────────────────────────────────────
/**
 * Action-only brief: numbered FAIL + WARNING items with recommendations.
 * Designed to be shared with the packaging designer.
 */
export async function generateDesignerBriefPDF(check) {
  const { default: jsPDF } = await import('jspdf')
  const doc    = new jsPDF({ unit: 'mm', format: 'a4' })
  const tColor = trackColor(check.track)

  const items       = check.report_json || []
  const actionItems = [
    ...items.filter(i => i.status === 'FAIL'),
    ...items.filter(i => i.status === 'WARNING'),
  ]

  // ── Header ───────────────────────────────────────────────────────────────
  doc.setFillColor(...tColor)
  doc.rect(0, 0, W, 20, 'F')
  doc.setTextColor(...C.white)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('DESIGNER ACTION BRIEF', M, 8)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Velite Compliance Studio v2 · Velite Healthcare', M, 14)
  const dateStr = check.created_at
    ? new Date(check.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''
  doc.text(dateStr, W - M, 14, { align: 'right' })

  let y = 30

  // ── Product name ──────────────────────────────────────────────────────────
  doc.setTextColor(...C.dark)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  const nameLines = doc.splitTextToSize(check.product_name || 'Action Brief', CW)
  doc.text(nameLines, M, y)
  y += nameLines.length * 6 + 3

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.mid)
  doc.text('Please review and address ALL items below before proceeding to the next print run.', M, y)
  y += 8

  // Summary strip
  const failCount = actionItems.filter(i => i.status === 'FAIL').length
  const warnCount = actionItems.filter(i => i.status === 'WARNING').length
  doc.setFillColor(...C.surface)
  doc.roundedRect(M, y, CW, 9, 2, 2, 'F')
  doc.setTextColor(...C.dark)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Score: ${check.score ?? '—'}/100  ·  ${failCount} item${failCount !== 1 ? 's' : ''} to FIX  ·  ${warnCount} item${warnCount !== 1 ? 's' : ''} to REVIEW`,
    M + 4, y + 6
  )
  y += 14

  // ── Action items ──────────────────────────────────────────────────────────
  if (actionItems.length === 0) {
    y = cy(doc, y, 16)
    doc.setFillColor(240, 253, 244)
    doc.roundedRect(M, y, CW, 14, 2, 2, 'F')
    doc.setTextColor(...C.pass)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('✓  No action items — label is fully compliant!', W / 2, y + 9, { align: 'center' })
    y += 18
  } else {
    actionItems.forEach((item, i) => {
      const isFail     = item.status === 'FAIL'
      const bColor     = isFail ? C.red : C.warn
      const issueLines = item.issue          ? doc.splitTextToSize(item.issue,          CW - 26) : []
      const recLines   = item.recommendation ? doc.splitTextToSize(item.recommendation, CW - 26) : []
      const boxH = 11 + (issueLines.length + recLines.length) * 4 + 4

      y = cy(doc, y, boxH + 4)

      // Border rect
      doc.setDrawColor(...bColor)
      doc.setLineWidth(0.4)
      doc.roundedRect(M, y, CW, boxH, 2, 2, 'S')

      // Left accent bar
      doc.setFillColor(...bColor)
      doc.roundedRect(M, y, 3, boxH, 1, 1, 'F')

      // Circle number
      doc.setFillColor(...bColor)
      doc.circle(M + 11, y + 7.5, 5, 'F')
      doc.setTextColor(...C.white)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.text(String(i + 1), M + 11, y + 10, { align: 'center' })

      // FIX / REVIEW badge
      doc.setFillColor(...bColor)
      doc.roundedRect(W - M - 17, y + 3, 15, 5.5, 1, 1, 'F')
      doc.setTextColor(...C.white)
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.text(isFail ? 'FIX' : 'REVIEW', W - M - 9.5, y + 7.2, { align: 'center' })

      // Field
      doc.setTextColor(...C.dark)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(item.field || '—', M + 19, y + 7.5)

      // Regulation
      if (item.regulation) {
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...C.gray)
        doc.text(item.regulation, M + 19, y + 12)
      }

      let iy = y + 16
      if (issueLines.length) {
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...C.mid)
        doc.text(issueLines, M + 5, iy)
        iy += issueLines.length * 4
      }
      if (recLines.length) {
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...C.green)
        doc.text(`→ ${recLines[0]}`, M + 5, iy)
      }

      y += boxH + 4
    })
  }

  // ── Approval section ───────────────────────────────────────────────────────
  y = cy(doc, y, 32)
  y += 6
  doc.setDrawColor(...C.gray)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 8

  doc.setTextColor(...C.gray)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('APPROVAL & SIGN-OFF', M, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Reviewed by: _______________________________', M, y)
  doc.text('Date: ____________________', M + 108, y)
  y += 8
  doc.text('Signature: ___________________________________', M, y)

  addFooter(doc)
  return doc
}

// ── ANNOTATED JPEG ────────────────────────────────────────────────────────
/**
 * Renders the label image with numbered annotation circles and returns a JPEG Blob.
 * @param {string} imageUrl      - Signed URL for the label image
 * @param {Array}  markers       - [{ x, y, issue_index }]  (0–1 ratios)
 * @param {Array}  annotateItems - [item, …] in annotate order (FAIL then WARNING)
 * @returns {Promise<Blob>}
 */
export function generateAnnotatedJPEG(imageUrl, markers, annotateItems) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const iW = img.naturalWidth
      const iH = img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width  = iW
      canvas.height = iH
      const ctx = canvas.getContext('2d')

      // Draw original label
      ctx.drawImage(img, 0, 0)

      // Sort markers by issue_index so numbers are consistent with the report
      const sorted = [...markers].sort((a, b) => a.issue_index - b.issue_index)

      sorted.forEach((m, num) => {
        const item = annotateItems[m.issue_index]
        if (!item) return

        const cx   = m.x * iW
        const cy_  = m.y * iH
        const r    = Math.max(16, Math.min(iW, iH) * 0.028)
        const fill = item.status === 'FAIL' ? '#dc2626' : '#d97706'

        // Drop shadow
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,.5)'
        ctx.shadowBlur  = r * 0.5

        // Filled circle
        ctx.beginPath()
        ctx.arc(cx, cy_, r, 0, 2 * Math.PI)
        ctx.fillStyle = fill
        ctx.fill()

        // White ring
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth   = Math.max(1.5, r * 0.13)
        ctx.stroke()
        ctx.restore()

        // Number text
        ctx.fillStyle    = '#ffffff'
        ctx.font         = `bold ${Math.round(r * 1.1)}px Arial, sans-serif`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(num + 1), cx, cy_ + 0.5)
      })

      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
        'image/jpeg',
        0.93
      )
    }

    img.onerror = () => reject(new Error('Failed to load label image for annotation export'))
    img.src = imageUrl
  })
}
