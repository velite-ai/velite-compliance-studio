const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

/**
 * Run a full label compliance analysis using Claude.
 * Returns structured JSON: { verdict, score, summary, items[], style_suggestions[] }
 *
 * @param {Object} opts
 * @param {string} opts.base64        - Base64-encoded image data
 * @param {string} opts.mimeType      - Image MIME type
 * @param {string} opts.productName   - Product name
 * @param {string} opts.productCategory - Product category
 * @param {string} opts.extraContext  - Additional notes from user
 * @param {Object} opts.regulations   - Active regulation toggle keys
 * @param {Array}  opts.styleRules    - Active style rules from DB
 * @param {string} opts.track         - 'cosmetic' | 'drug'
 */
export async function analyseLabel({
  base64,
  mimeType,
  productName,
  productCategory,
  extraContext,
  regulations,
  styleRules,
  track = 'cosmetic',
}) {
  const systemPrompt = track === 'drug'
    ? buildDrugPrompt({ regulations, styleRules, extraContext, productCategory })
    : buildCosmeticPrompt({ regulations, styleRules, extraContext, productCategory })

  const userContent = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    },
    {
      type: 'text',
      text: `Analyse this ${productCategory || (track === 'drug' ? 'drug' : 'cosmetic')} label${productName ? ` for "${productName}"` : ''}. Return only the JSON compliance report.`,
    },
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${err}`)
  }

  const data = await response.json()
  const raw = data.content?.[0]?.text || ''

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(cleaned)
}

// ── JSON SCHEMA (shared) ─────────────────────────────────────────────────
const JSON_SCHEMA = `
Return ONLY valid JSON matching this exact schema:
{
  "verdict": "PASS" | "FAIL" | "REVIEW_REQUIRED",
  "score": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "items": [
    {
      "field": "<label field name>",
      "regulation": "<regulation name>",
      "status": "PASS" | "FAIL" | "WARNING",
      "found": "<what was found on the label, or 'Not found'>",
      "issue": "<description of issue, or null if PASS>",
      "recommendation": "<actionable fix, or null if PASS>"
    }
  ],
  "style_suggestions": [
    {
      "category": "<category>",
      "title": "<rule title>",
      "description": "<what was learned from this label>"
    }
  ]
}

Score rubric: 100 = perfect, deduct 10 per FAIL item, 5 per WARNING item.
verdict = "PASS" if score >= 80 and no FAIL items, "FAIL" if any FAIL items or score < 60, otherwise "REVIEW_REQUIRED".`

// ── COSMETIC PROMPT ──────────────────────────────────────────────────────
function buildCosmeticPrompt({ regulations, styleRules, extraContext, productCategory }) {
  const regulationList = []
  if (regulations.cosmetics)
    regulationList.push('Cosmetics Rules 2020 (India) — all mandatory label declarations')
  if (regulations.weights)
    regulationList.push(
      'Legal Metrology (Packaged Commodities) Rules 2011 — net quantity, MRP format, font size requirements'
    )
  if (regulations.claims)
    regulationList.push(
      'Cosmetic vs therapeutic claim boundaries — flag any language implying drug/medicinal action'
    )
  if (regulations.ingredients)
    regulationList.push(
      'INCI nomenclature and ingredient list format as per Cosmetics Rules 2020'
    )

  const mandatoryChecklist = `
MANDATORY DECLARATIONS CHECKLIST (Cosmetics Rules 2020 + Legal Metrology):
1.  Product name — clearly displayed
2.  Ingredients list — INCI names, descending order of concentration
3.  Net weight / volume — with unit, correct font size (min 1mm for small packs)
4.  Manufacturer name & complete address (including PIN code)
5.  Country of manufacture (if imported: importer name + address)
6.  Cosmetic Manufacturing Licence (CML) number
7.  Batch / Lot number
8.  Date of manufacture (DOM) or best before / expiry date
9.  MRP — format: "MRP ₹XX (incl. all taxes)"
10. Consumer helpline / complaint address
11. Instructions for use (where applicable)
12. Warnings / cautions (product-category specific)
13. For imported products: "Imported by [name], [address]"`

  let styleSection = ''
  if (styleRules && styleRules.length > 0) {
    const grouped = styleRules.reduce((acc, r) => {
      ;(acc[r.category] = acc[r.category] || []).push(r)
      return acc
    }, {})
    styleSection = `\n\nVELITE INTERNAL STYLE STANDARDS\nIn addition to regulations, enforce these Velite-specific brand standards:\n`
    for (const [cat, rules] of Object.entries(grouped)) {
      styleSection += `\n[${cat.toUpperCase()}]\n`
      rules.forEach(r => {
        styleSection += `• ${r.title}: ${r.description}`
        if (r.example_correct) styleSection += `\n  Correct: ${r.example_correct}`
        if (r.example_incorrect) styleSection += `\n  Incorrect: ${r.example_incorrect}`
        styleSection += '\n'
      })
    }
  }

  return `You are a regulatory compliance expert specialising in Indian cosmetics packaging regulations.
Analyse the label image provided and produce a structured compliance report in valid JSON only — no markdown, no prose outside the JSON.

TRACK: COSMETIC — regulated under Cosmetics Rules 2020 & Legal Metrology Rules 2011.

REGULATIONS TO CHECK:
${regulationList.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${mandatoryChecklist}
${styleSection}
${extraContext ? `\nADDITIONAL CONTEXT FROM USER:\n${extraContext}` : ''}
${JSON_SCHEMA}`
}

// ── DRUG PROMPT ──────────────────────────────────────────────────────────
function buildDrugPrompt({ regulations, styleRules, extraContext, productCategory }) {
  const regulationList = []
  if (regulations.drug_act)
    regulationList.push(
      'Drugs & Cosmetics Rules 1945 — Rule 96: all mandatory drug label declarations'
    )
  if (regulations.schedule)
    regulationList.push(
      'Schedule declaration: Rx symbol, Schedule H / H1 / X / G warning text as applicable'
    )
  if (regulations.weights)
    regulationList.push(
      'Legal Metrology (Packaged Commodities) Rules 2011 — net quantity, MRP format, font size'
    )
  if (regulations.composition)
    regulationList.push(
      'Composition disclosure: active ingredients with INN names and strength; excipients where required'
    )

  const mandatoryChecklist = `
MANDATORY DECLARATIONS CHECKLIST (D&C Rules 1945 Rule 96 + Legal Metrology):
1.  Drug name — brand name + generic (INN) name prominently displayed
2.  Rx symbol — in a box on principal display panel (for prescription drugs)
3.  Schedule declaration — e.g., "Schedule H Drug — To be sold by retail on the prescription of a Registered Medical Practitioner only"
       Schedule H1: add "WARNING: It is dangerous to take this preparation except under medical supervision"
       Schedule X: "Schedule X Drug" declaration
4.  Composition — each active ingredient with INN name and quantity per dosage unit (e.g., "Paracetamol IP 500 mg")
5.  Net contents — number of tablets/capsules, volume (ml), weight (g); per strip AND per carton
6.  Drugs Licence Number — "Mfg. Lic. No. [State code/number]"
7.  Manufacturer name & complete address — including city, state, PIN code
8.  Batch / Lot number — "Batch No." or "Lot No."
9.  Date of manufacture — "Mfg. Date: MM/YYYY"
10. Expiry date — "Exp. Date: MM/YYYY" or "Use before: MM/YYYY" (must be EXPIRY, not "best before")
11. MRP — "MRP ₹XX.XX (Incl. of all taxes)"
12. Storage conditions — e.g., "Store below 25°C, in a cool dry place, protect from light and moisture"
13. "Keep out of reach of children" — mandatory
14. Instructions for use / dosage direction (where applicable)
15. For imported drugs: importer name, address, and Import Licence Number`

  let styleSection = ''
  if (styleRules && styleRules.length > 0) {
    const grouped = styleRules.reduce((acc, r) => {
      ;(acc[r.category] = acc[r.category] || []).push(r)
      return acc
    }, {})
    styleSection = `\n\nVELITE INTERNAL STANDARDS\nAlso enforce these Velite-specific standards:\n`
    for (const [cat, rules] of Object.entries(grouped)) {
      styleSection += `\n[${cat.toUpperCase()}]\n`
      rules.forEach(r => {
        styleSection += `• ${r.title}: ${r.description}\n`
      })
    }
  }

  return `You are a regulatory compliance expert specialising in Indian pharmaceutical drug packaging regulations.
Analyse the drug label image provided and produce a structured compliance report in valid JSON only — no markdown, no prose outside the JSON.

TRACK: DRUG — regulated under Drugs & Cosmetics Act 1940 and Drugs & Cosmetics Rules 1945.

REGULATIONS TO CHECK:
${regulationList.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${mandatoryChecklist}
${styleSection}
${extraContext ? `\nADDITIONAL CONTEXT FROM USER:\n${extraContext}` : ''}

IMPORTANT DRUG-SPECIFIC RULES:
- Expiry date must say "Exp. Date" or "Use before", NOT "Best Before" (which is cosmetics terminology)
- Composition must use INN (International Nonproprietary Name) / Pharmacopoeial name, not brand/trade ingredient names
- If drug is Schedule H, H1, or X, the declaration text must appear verbatim as per Rules — paraphrasing is a FAIL
- MRP must follow Legal Metrology format exactly
- DLN (Drugs Licence Number) is mandatory — absence is a FAIL
${JSON_SCHEMA}`
}
