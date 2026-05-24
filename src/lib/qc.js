// ── VELITE QC MODULE — shared constants & helpers ──────────────────────────
//
// Entity mapping (one shared system, filtered by track):
//   track 'cosmetic' → Velite Healthcare      (cosmetics)
//   track 'drug'     → Velite Pharmaceuticals  (drugs)

export const QC_ENTITIES = [
  { track: 'cosmetic', name: 'Velite Healthcare',      short: 'Healthcare', icon: '🧴', desc: 'Cosmetics' },
  { track: 'drug',     name: 'Velite Pharmaceuticals', short: 'Pharma',     icon: '💊', desc: 'Drugs' },
]

export function entityForTrack(track) {
  return QC_ENTITIES.find(e => e.track === track) || QC_ENTITIES[0]
}

// ── MATERIAL TYPES (the four QC stages) ────────────────────────────────────
export const MATERIAL_TYPES = [
  { value: 'raw_material',  label: 'Raw Material',       icon: '🧪', desc: 'Incoming actives, excipients, bulk ingredients' },
  { value: 'packaging',     label: 'Packaging Material', icon: '📦', desc: 'Cartons, labels, bottles, tubes, foils' },
  { value: 'in_process',    label: 'In-Process',         icon: '⚙️', desc: 'Checks during manufacturing' },
  { value: 'finished_good', label: 'Finished Good',      icon: '✅', desc: 'Final product before release' },
]

export function materialType(value) {
  return MATERIAL_TYPES.find(m => m.value === value) || MATERIAL_TYPES[3]
}

// ── PARAMETER TYPES ────────────────────────────────────────────────────────
export const PARAM_TYPES = [
  { value: 'numeric', label: 'Numeric range', hint: 'Result must fall within min–max' },
  { value: 'text',    label: 'Expected text', hint: 'Result must match an expected value' },
  { value: 'boolean', label: 'Pass / Fail',   hint: 'Simple visual / go-no-go check' },
]

// ── SEVERITY ───────────────────────────────────────────────────────────────
export const SEVERITIES = [
  { value: 'critical', label: 'Critical', color: 'var(--fail)',   badge: 'badge-fail' },
  { value: 'major',    label: 'Major',    color: 'var(--warn)',   badge: 'badge-warn' },
  { value: 'minor',    label: 'Minor',    color: 'var(--text-3)', badge: 'badge-gray' },
]

export function severity(value) {
  return SEVERITIES.find(s => s.value === value) || SEVERITIES[1]
}

// ── BATCH STATUS ───────────────────────────────────────────────────────────
export const BATCH_STATUSES = [
  { value: 'draft',      label: 'Draft',      badge: 'badge-gray',   icon: '📝' },
  { value: 'in_test',    label: 'In Testing', badge: 'badge-review', icon: '🔬' },
  { value: 'released',   label: 'Released',   badge: 'badge-pass',   icon: '✅' },
  { value: 'rejected',   label: 'Rejected',   badge: 'badge-fail',   icon: '⛔' },
  { value: 'quarantine', label: 'Quarantine', badge: 'badge-warn',   icon: '🚧' },
  { value: 'on_hold',    label: 'On Hold',    badge: 'badge-warn',   icon: '⏸️' },
]

export function batchStatus(value) {
  return BATCH_STATUSES.find(s => s.value === value) || BATCH_STATUSES[0]
}

// Disposition actions available from the Batch QC screen
export const DISPOSITIONS = [
  { value: 'released',   label: 'Release',    icon: '✅', desc: 'Approve batch for use / dispatch',  cls: 'btn-success' },
  { value: 'rejected',   label: 'Reject',     icon: '⛔', desc: 'Reject the batch',                  cls: '' },
  { value: 'quarantine', label: 'Quarantine', icon: '🚧', desc: 'Hold pending investigation',        cls: '' },
  { value: 'on_hold',    label: 'On Hold',    icon: '⏸️', desc: 'Pause — awaiting more information',  cls: '' },
]

// ── DEVIATION / CAPA STATUS ────────────────────────────────────────────────
export const DEVIATION_STATUSES = [
  { value: 'open',          label: 'Open',          badge: 'badge-fail' },
  { value: 'investigating', label: 'Investigating', badge: 'badge-warn' },
  { value: 'closed',        label: 'Closed',        badge: 'badge-pass' },
]

export const DEVIATION_SOURCES = [
  { value: 'qc_test',   label: 'QC Test Failure' },
  { value: 'manual',    label: 'Manual Entry' },
  { value: 'complaint', label: 'Customer Complaint' },
  { value: 'audit',     label: 'Audit Finding' },
]

export const CAPA_STATUSES = [
  { value: 'open',        label: 'Open',        badge: 'badge-gray' },
  { value: 'in_progress', label: 'In Progress', badge: 'badge-review' },
  { value: 'done',        label: 'Done',        badge: 'badge-pass' },
]

export const CAPA_ACTION_TYPES = [
  { value: 'corrective', label: 'Corrective', desc: 'Fix this occurrence' },
  { value: 'preventive', label: 'Preventive', desc: 'Stop it recurring' },
]

// ── RESULT EVALUATION ──────────────────────────────────────────────────────
// Returns true (pass), false (fail), or null (no result entered) for one param.
export function evalParam(param, rawValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') return null

  if (param.type === 'numeric') {
    const v = parseFloat(rawValue)
    if (Number.isNaN(v)) return null
    const hasMin = param.min !== '' && param.min !== null && param.min !== undefined
    const hasMax = param.max !== '' && param.max !== null && param.max !== undefined
    if (hasMin && v < parseFloat(param.min)) return false
    if (hasMax && v > parseFloat(param.max)) return false
    return true
  }

  if (param.type === 'boolean') {
    return String(rawValue).toLowerCase() === 'pass'
  }

  // text — case-insensitive exact match against expected
  const expected = (param.expected ?? '').toString().trim().toLowerCase()
  if (!expected) return true // no expected value defined → any entry passes
  return String(rawValue).trim().toLowerCase() === expected
}

// Human-readable expected value for a parameter, e.g. "5.5 – 7.0 pH"
export function expectedLabel(param) {
  if (param.type === 'numeric') {
    const min = param.min ?? ''
    const max = param.max ?? ''
    const range =
      min !== '' && max !== '' ? `${min} – ${max}` :
      min !== ''               ? `≥ ${min}` :
      max !== ''               ? `≤ ${max}` : 'any'
    return `${range}${param.unit ? ' ' + param.unit : ''}`
  }
  if (param.type === 'boolean') return 'Pass'
  return param.expected || 'any'
}

// Overall result from a set of evaluated rows: 'pass' | 'fail' | 'pending'
export function overallResult(rows) {
  if (!rows.length) return 'pending'
  if (rows.some(r => r.pass === null)) return 'pending'
  return rows.some(r => r.pass === false) ? 'fail' : 'pass'
}
