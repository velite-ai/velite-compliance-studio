// Deterministic post-checks that run in the browser on the text Claude
// transcribed from the label. Zero API cost, catches things vision can miss,
// and gives QA a second source of truth. Findings from here are appended
// to the AI's items[] array using the same schema shape (see anthropic.js).
//
// This module is intentionally strict: only regex/lookup rules with clear
// legal grounding. If a rule is fuzzy, leave it to Claude.

import { INGREDIENT_FLAGS } from './regulations'

// Rough MRP format per Legal Metrology (Packaged Commodities) Rules 2011.
// Accepted spelling variants covered: MRP / M.R.P., Rs / ₹, incl / inclusive,
// tax / taxes, dot vs. no dot in "incl.".
const MRP_ACCEPTED_RE = /(M\.?R\.?P\.?)\s*(₹|Rs\.?)?\s*\d+(\.\d{1,2})?\s*\(\s*Incl(usive|\.)?\s*(of\s+all\s+taxes|\.?\s*taxes?)\s*\)/i

// Just an MRP number without the "(Incl. of all taxes)" clause
const MRP_NUMBER_RE = /(M\.?R\.?P\.?|Rs\.?|₹)\s*\d+(\.\d{1,2})?/i

// Mfg. Date, Exp. Date, Batch No. patterns
const MFG_RE   = /(Mfg\.?\s*Date|Manufacturing\s*Date|Date\s*of\s*Mfg)\s*[:.]?\s*[\d/-]+/i
const EXP_RE   = /(Exp\.?\s*Date|Use\s*Before|Expiry)\s*[:.]?\s*[\d/-]+/i
const BATCH_RE = /(Batch|Lot)\s*(No\.?|Number)?\s*[:.]?\s*[A-Z0-9-]+/i

// "Best Before" on a drug label is wrong — drugs must say "Exp. Date"
const BEST_BEFORE_RE = /Best\s*Before/i

// "For external use only" for topical cosmetics
const EXTERNAL_USE_RE = /For\s+external\s+use\s+only/i

// "Keep out of reach of children" — mandatory on drugs
const KOOR_CHILDREN_RE = /Keep\s+out\s+of\s+(the\s+)?reach\s+of\s+children/i

// ─────────────────────────────────────────────────────────────────────────
// Public entry: returns [Item] to append to the AI's items[] array.
// text: single string of everything Claude transcribed from the label
// (concatenated evidence quotes + any extracted_text field on the result)
// ─────────────────────────────────────────────────────────────────────────
export function runDeterministicChecks({ track, text }) {
  if (!text || typeof text !== 'string' || text.trim().length < 5) return []

  const T        = text
  const findings = []

  // ── MRP format ────────────────────────────────────────────────────────
  const hasMrpNumber   = MRP_NUMBER_RE.test(T)
  const hasMrpAccepted = MRP_ACCEPTED_RE.test(T)
  if (!hasMrpNumber) {
    findings.push(mkItem({
      field: 'MRP (deterministic)',
      status: 'FAIL',
      severity: 'blocker',
      regulation: 'Legal Metrology (Packaged Commodities) Rules 2011',
      regulation_section: 'Rule 6',
      evidence: 'No MRP value detected in label text',
      issue: 'MRP is a mandatory Legal Metrology declaration and could not be found on the label.',
      requiredText: 'MRP ₹<amount> (Incl. of all taxes)',
    }))
  } else if (!hasMrpAccepted) {
    findings.push(mkItem({
      field: 'MRP format (deterministic)',
      status: 'WARNING',
      severity: 'major',
      regulation: 'Legal Metrology (Packaged Commodities) Rules 2011',
      regulation_section: 'Rule 6',
      evidence: matchAround(T, MRP_NUMBER_RE),
      issue: 'MRP appears present but does not include the "(Incl. of all taxes)" clause required by Legal Metrology.',
      requiredText: 'MRP ₹<amount> (Incl. of all taxes)',
    }))
  }

  // ── Batch / Mfg / Exp ─────────────────────────────────────────────────
  const hasBatch = BATCH_RE.test(T)
  const hasMfg   = MFG_RE.test(T)
  const hasExp   = EXP_RE.test(T)

  if (!hasBatch) {
    findings.push(mkItem({
      field: 'Batch Number (deterministic)',
      status: 'FAIL',
      severity: 'major',
      regulation: track === 'drug' ? 'D&C Rules 1945 Rule 96' : 'Cosmetics Rules 2020',
      evidence: 'No batch/lot number pattern detected',
      issue: 'Batch or Lot number is a mandatory declaration.',
      requiredText: 'Batch No.: ___',
      placement: 'back panel',
    }))
  }
  if (!hasMfg) {
    findings.push(mkItem({
      field: 'Manufacturing Date (deterministic)',
      status: 'FAIL',
      severity: 'major',
      regulation: track === 'drug' ? 'D&C Rules 1945 Rule 96' : 'Legal Metrology 2011',
      evidence: 'No manufacturing-date pattern detected',
      issue: 'Manufacturing date declaration is mandatory.',
      requiredText: 'Mfg. Date: MM/YYYY',
    }))
  }
  if (!hasExp) {
    findings.push(mkItem({
      field: 'Expiry / Best-Before Date (deterministic)',
      status: 'FAIL',
      severity: track === 'drug' ? 'blocker' : 'major',
      regulation: track === 'drug' ? 'D&C Rules 1945 Rule 96' : 'Cosmetics Rules 2020',
      evidence: 'No expiry / use-before pattern detected',
      issue: track === 'drug'
        ? 'Drug label must declare "Exp. Date" — mandatory Rule 96 declaration.'
        : 'Best-Before / Use-Before date is required.',
      requiredText: track === 'drug' ? 'Exp. Date: MM/YYYY' : 'Best Before: MM/YYYY',
    }))
  }

  // ── Drug: Exp. Date NOT Best Before ───────────────────────────────────
  if (track === 'drug' && BEST_BEFORE_RE.test(T) && !EXP_RE.test(T)) {
    findings.push(mkItem({
      field: 'Expiry terminology (deterministic)',
      status: 'FAIL',
      severity: 'blocker',
      regulation: 'D&C Rules 1945 Rule 96',
      evidence: matchAround(T, BEST_BEFORE_RE),
      issue: '"Best Before" is cosmetics terminology. Drugs must use "Exp. Date" or "Use before".',
      requiredText: 'Exp. Date: MM/YYYY',
    }))
  }

  // ── Drug: Keep out of reach of children ───────────────────────────────
  if (track === 'drug' && !KOOR_CHILDREN_RE.test(T)) {
    findings.push(mkItem({
      field: 'Child-safety warning (deterministic)',
      status: 'FAIL',
      severity: 'blocker',
      regulation: 'D&C Rules 1945 Rule 96',
      evidence: '"Keep out of reach of children" not detected in label text',
      issue: 'Every drug label must include a "Keep out of reach of children" warning.',
      requiredText: 'Keep out of reach of children.',
    }))
  }

  // ── Cosmetic topical: For external use only ───────────────────────────
  if (track === 'cosmetic' && !EXTERNAL_USE_RE.test(T)) {
    findings.push(mkItem({
      field: '"For external use only" (deterministic)',
      status: 'WARNING',
      severity: 'advisory',
      regulation: 'Cosmetics best practice',
      evidence: '"For external use only" not detected',
      issue: 'Most topical cosmetics should declare "For external use only" as a safety statement.',
      requiredText: 'For external use only.',
    }))
  }

  // ── Ingredient banned / restricted list ───────────────────────────────
  // We check the label text for names from INGREDIENT_FLAGS. Simple contains
  // check, case-insensitive. False positives are possible — that's why the
  // status is WARNING with severity=major rather than blocker.
  const lowered = T.toLowerCase()
  for (const flag of INGREDIENT_FLAGS) {
    // Extract the base name before any percentage qualifier
    const baseName = flag.name.split(/[<>]/)[0].trim()
    const parts    = baseName.split(/[(,]/)[0].trim().toLowerCase()
    if (parts.length < 5) continue // skip too-short tokens
    if (lowered.includes(parts)) {
      findings.push(mkItem({
        field: `Restricted ingredient: ${baseName}`,
        status: 'WARNING',
        severity: flag.status === 'banned' ? 'blocker' : 'major',
        regulation: 'Cosmetics Rules 2020',
        evidence: `Detected substring "${parts}" in label ingredient list`,
        issue: `${flag.name} — ${flag.reason}`,
        requiredText: '',
        recommendation: flag.status === 'banned'
          ? 'Remove this ingredient — it is banned in Indian cosmetics.'
          : `Verify the concentration and any restriction: ${flag.reason}`,
      }))
    }
  }

  return findings
}

// Extract a short snippet of context around a regex match so the evidence
// quote in the UI reads naturally.
function matchAround(text, re, pad = 30) {
  const m = re.exec(text)
  if (!m) return ''
  const start = Math.max(0, m.index - pad)
  const end   = Math.min(text.length, m.index + m[0].length + pad)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

// Build a finding in the same shape the AI schema uses.
function mkItem({ field, status, severity, regulation, regulation_section = '', evidence, issue, requiredText = '', placement = '', recommendation = '' }) {
  return {
    field,
    regulation,
    regulation_section,
    status,
    severity,
    evidence_quote: evidence || 'Not present on label',
    issue,
    required_text: requiredText,
    required_placement: placement,
    recommendation,
    source: 'deterministic', // marker: not from Claude
  }
}
