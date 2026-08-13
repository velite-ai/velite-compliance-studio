// Small line-level diff. Used to compare `extracted_text` between two label
// versions so packaging teams can see exactly which lines changed — the
// "MRP dropped a decimal" case that regex checks alone would miss.
//
// Not a full Myers diff, but LCS-based and correct for short label text
// (typically 20-200 lines). Runs in the browser, zero dependencies.

/**
 * Diff two strings by lines.
 * @param {string} a - "before" text
 * @param {string} b - "after" text
 * @returns {Array<{kind:'equal'|'remove'|'add', line:string}>}
 */
export function diffLines(a = '', b = '') {
  const A = normalise(a).split('\n')
  const B = normalise(b).split('\n')
  const N = A.length
  const M = B.length

  // Build LCS length table
  const lcs = Array.from({ length: N + 1 }, () => new Uint16Array(M + 1))
  for (let i = N - 1; i >= 0; i--) {
    for (let j = M - 1; j >= 0; j--) {
      if (A[i] === B[j]) lcs[i][j] = lcs[i + 1][j + 1] + 1
      else               lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  // Walk to produce the ordered diff
  const out = []
  let i = 0, j = 0
  while (i < N && j < M) {
    if (A[i] === B[j]) {
      out.push({ kind: 'equal',  line: A[i] })
      i++; j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: 'remove', line: A[i] })
      i++
    } else {
      out.push({ kind: 'add',    line: B[j] })
      j++
    }
  }
  while (i < N) out.push({ kind: 'remove', line: A[i++] })
  while (j < M) out.push({ kind: 'add',    line: B[j++] })
  return out
}

/**
 * Summary counts for a diff. Handy for a header widget.
 */
export function diffSummary(diff) {
  let added = 0, removed = 0, unchanged = 0
  for (const d of diff) {
    if (d.kind === 'add')    added++
    else if (d.kind === 'remove') removed++
    else                     unchanged++
  }
  return { added, removed, unchanged, changed: added + removed }
}

// Collapse runs of whitespace inside a line so trivial reflow doesn't
// register as a change. Preserves line breaks — those matter for labels.
function normalise(s) {
  return String(s || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .join('\n')
}
