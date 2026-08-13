// One-shot CSV export of a compliance check's findings.
// The team pastes this into a spreadsheet or attaches to an email to the
// designer / printer. Deliberately verbose: every actionable field lands
// as its own column so a non-technical reader can sort / filter / assign.

const COLUMNS = [
  { key: 'number',            header: '#'             },
  { key: 'status',            header: 'Status'        },
  { key: 'severity',          header: 'Severity'      },
  { key: 'source',            header: 'Source'        },
  { key: 'field',             header: 'Field'         },
  { key: 'regulation',        header: 'Regulation'    },
  { key: 'regulation_section',header: 'Section'       },
  { key: 'evidence_quote',    header: 'Claude saw'    },
  { key: 'issue',             header: 'Issue'         },
  { key: 'required_text',     header: 'Required text' },
  { key: 'required_placement',header: 'Placement'     },
  { key: 'recommendation',    header: 'Recommendation'},
]

function csvCell(v) {
  if (v == null) return ''
  const s = String(v)
  // Escape per RFC 4180: wrap in quotes if it contains a quote, comma, or newline.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildFindingsCSV(check) {
  const items = check?.report_json || []

  const meta = [
    ['Product',       check?.product_name || ''],
    ['Track',         check?.track === 'drug' ? 'Drug' : 'Cosmetic'],
    ['Check type',    check?.check_type || ''],
    ['Verdict',       check?.verdict || ''],
    ['Score',         check?.score ?? ''],
    ['Checked at',    check?.created_at || ''],
    ['Reviewer',      check?.reviewer_signed_name || ''],
    ['QA',            check?.qa_signed_name || ''],
    ['Fully approved',check?.is_fully_approved ? 'YES' : 'no'],
  ]

  const metaRows = meta.map(([k, v]) => `${csvCell(k)},${csvCell(v)}`).join('\r\n')
  const header   = COLUMNS.map(c => csvCell(c.header)).join(',')

  const rows = items.map((it, i) => COLUMNS.map(c => {
    if (c.key === 'number') return csvCell(i + 1)
    if (c.key === 'source') return csvCell(it.source || 'regulation')
    return csvCell(it[c.key])
  }).join(',')).join('\r\n')

  // Blank line separates metadata block from the findings table so Excel /
  // Numbers / Sheets all render both cleanly.
  return metaRows + '\r\n\r\n' + header + '\r\n' + rows + '\r\n'
}

export function downloadFindingsCSV(check) {
  const csv  = buildFindingsCSV(check)
  const stamp = new Date().toISOString().slice(0, 10)
  const name  = `${(check?.product_name || 'compliance').replace(/[^a-zA-Z0-9-]+/g, '-')}-findings-${stamp}.csv`
  // UTF-8 BOM so Excel opens ₹ and non-ASCII correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
