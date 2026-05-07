const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

/**
 * Run a full label compliance analysis using Claude.
 * Returns structured JSON: { verdict, score, summary, items[], style_suggestions[] }
 *
 * @param {Object} opts
 * @param {string} opts.base64        - Base64-encoded front image data (required)
 * @param {string} opts.mimeType      - Front image MIME type
 * @param {string} [opts.backBase64]  - Base64-encoded back image data (optional)
 * @param {string} [opts.backMimeType]- Back image MIME type
 * @param {string} opts.productName   - Product name
 * @param {string} opts.productCategory - Product category
 * @param {string} opts.extraContext  - Additional notes from user
 * @param {Object} opts.regulations   - Active regulation toggle keys
 * @param {Array}  opts.styleRules    - Active style rules from DB
 * @param {string} opts.track         - 'cosmetic' | 'drug'
 * @param {Object} [opts.logoChecks]     - Active logo/mark check keys (optional)
 * @param {Array}  [opts.logoTogglesDefs] - Full logo toggle definitions for enabled keys
 * @param {string} [opts.checkType]       - 'pre-print' | 'post-print' (default: 'pre-print')
 */
export async function analyseLabel({
  base64,
  mimeType,
  backBase64 = null,
  backMimeType = null,
  productName,
  productCategory,
  extraContext,
  regulations,
  styleRules,
  track = 'cosmetic',
  logoChecks = {},
  logoTogglesDefs = [],
  checkType = 'pre-print',
}) {
  const hasBack = Boolean(backBase64 && backMimeType)

  // Build logo section from active toggles
  const activeLogoToggles = logoTogglesDefs.filter(t => logoChecks[t.key])
  const logoSection = buildLogoSection(activeLogoToggles)

  const systemPrompt = track === 'drug'
    ? buildDrugPrompt({ regulations, styleRules, extraContext, productCategory, hasBack, logoSection, checkType })
    : buildCosmeticPrompt({ regulations, styleRules, extraContext, productCategory, hasBack, logoSection, checkType })

  // Build content array — front face always first, back face appended when available
  const userContent = []

  if (hasBack) {
    userContent.push(
      { type: 'text', text: '── FRONT FACE of the label / carton ──' },
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
      { type: 'text', text: '── BACK FACE of the label / carton ──' },
      { type: 'image', source: { type: 'base64', media_type: backMimeType, data: backBase64 } },
      {
        type: 'text',
        text: `Both faces of this ${productCategory || (track === 'drug' ? 'drug' : 'cosmetic')} label${productName ? ` for "${productName}"` : ''} are shown above. Check all mandatory declarations across both faces. Return only the JSON compliance report.`,
      },
    )
  } else {
    userContent.push(
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
      {
        type: 'text',
        text: `Analyse this ${productCategory || (track === 'drug' ? 'drug' : 'cosmetic')} label${productName ? ` for "${productName}"` : ''} (front face only — no back face provided). Return only the JSON compliance report.`,
      },
    )
  }

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

// ── TEXT GENERATOR ──────────────────────────────────────────────────────
/**
 * Generate complete regulation-compliant label text from product details.
 * Returns { sections: [{ id, title, content }], regulatory_notes: [] }
 *
 * @param {Object} opts
 * @param {string} opts.track       - 'cosmetic' | 'drug'
 * @param {Object} opts.details     - All form fields
 */
export async function generateLabelText({ track, details }) {
  const isDrug = track === 'drug'

  const systemPrompt = isDrug ? buildDrugGeneratorPrompt(details) : buildCosmeticGeneratorPrompt(details)

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
      messages: [{ role: 'user', content: 'Generate the complete label text now. Return only the JSON.' }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${err}`)
  }

  const data = await response.json()
  const raw  = data.content?.[0]?.text || ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(cleaned)
}

const GENERATOR_SCHEMA = `
Return ONLY valid JSON — no prose, no markdown — matching this exact schema:
{
  "sections": [
    {
      "id": "<snake_case_id>",
      "title": "<display title>",
      "content": "<the exact label text for this section, ready to paste onto the label>"
    }
  ],
  "regulatory_notes": [
    "<important note or reminder for the packaging designer>"
  ]
}`

function buildCosmeticGeneratorPrompt(d) {
  return `You are a regulatory packaging expert specialising in Indian cosmetics labelling (Cosmetics Rules 2020 + Legal Metrology 2011).
Generate complete, print-ready label text for the product below. Every mandatory declaration must be present and correctly formatted.

PRODUCT DETAILS:
Product Name: ${d.productName || '(not provided)'}
${d.tagline ? `Tagline: ${d.tagline}` : ''}
Category: ${d.category || '(not provided)'}
${d.claims ? `Key Claims / Benefits:\n${d.claims}` : ''}
Ingredients (INCI): ${d.ingredients || '(not provided)'}
Net Content: ${d.netContent || '(not provided)'}
Manufacturer Name: ${d.manufacturerName || '(not provided)'}
Manufacturer Address: ${d.manufacturerAddress || '(not provided)'}
City / State / PIN: ${d.cityStatePIN || '(not provided)'}
CML Number: ${d.licenceNumber || '(leave placeholder [CML No.])'}
Country of Origin: ${d.countryOfOrigin || 'India'}
Consumer Helpline: ${d.helpline || '(leave placeholder)'}
MRP: ${d.mrp ? `₹${d.mrp}` : '(leave placeholder)'}
Usage Instructions: ${d.usageInstructions || ''}
Special Warnings: ${d.warnings || ''}

Generate these sections (include ALL, even if some fields are placeholders):
1. product_name — brand name + any variant/descriptor
2. tagline — if applicable
3. net_content — formatted: "Net Content: XX g" (Legal Metrology compliant)
4. ingredients — "Ingredients: [INCI list in descending order of concentration]"
5. claims — key claims/benefits in cosmetic-safe language (no therapeutic claims)
6. manufacturer — full "Manufactured by:" block with name, address, city, state, PIN, country
7. cml_number — "CML No.: [number]"
8. batch_info — template with blanks: "Batch No.: ___  |  Mfg. Date: MM/YYYY  |  Use Before: MM/YYYY"
9. mrp — "MRP ₹___ (Incl. of all taxes)" format
10. consumer_helpline — "Consumer Complaints: [contact]"
11. warnings — all applicable warnings (e.g., "For external use only. Keep out of reach of children. Avoid contact with eyes.")
12. usage_instructions — "How to use:" block

RULES:
- Use only cosmetic-safe claim language — no drug/therapeutic claims
- INCI names must be in descending concentration order
- Ingredients must say "Ingredients:" not "Formula:"
- MRP must follow Legal Metrology format exactly
- Use [PLACEHOLDER] style for missing values
${GENERATOR_SCHEMA}`
}

function buildDrugGeneratorPrompt(d) {
  const scheduleText = {
    'Schedule H':  'Schedule H Drug — To be sold by retail on the prescription of a Registered Medical Practitioner only.',
    'Schedule H1': 'Schedule H1 Drug\nWARNING: It is dangerous to take this preparation except under medical supervision.\nTo be sold by retail on the prescription of a Registered Medical Practitioner only.',
    'Schedule X':  'Schedule X Drug — To be sold by retail on the prescription of a Registered Medical Practitioner only.\n[Controlled Substance — maintain records as per Drugs & Cosmetics Rules]',
    'Schedule G':  'Caution: It is dangerous to take this preparation except under medical supervision.',
    'OTC (No Schedule)': '',
  }[d.schedule] || ''

  return `You are a regulatory packaging expert specialising in Indian drug labelling under Drugs & Cosmetics Act 1940 and Drugs & Cosmetics Rules 1945 (Rule 96).
Generate complete, print-ready drug label text for the product below. Every mandatory Rule 96 declaration must be present and correctly formatted.

PRODUCT DETAILS:
Brand Name: ${d.productName || '(not provided)'}
Active Ingredients (INN + strength): ${d.activeIngredients || '(not provided)'}
Excipients: ${d.excipients || '(not listed — write "q.s." or leave for designer)'}
Dosage Form / Category: ${d.category || '(not provided)'}
Schedule: ${d.schedule || 'OTC (No Schedule)'}
Net Contents: ${d.netContent || '(not provided)'}
Manufacturer Name: ${d.manufacturerName || '(not provided)'}
Manufacturer Address: ${d.manufacturerAddress || '(not provided)'}
City / State / PIN: ${d.cityStatePIN || '(not provided)'}
Drugs Licence Number: ${d.licenceNumber || '(leave placeholder [DLN])'}
Country of Origin: ${d.countryOfOrigin || 'India'}
MRP: ${d.mrp ? `₹${d.mrp}` : '(leave placeholder)'}
Storage Conditions: ${d.storageConditions || 'Store below 25°C in a cool, dry place. Protect from light and moisture.'}
Dosage / Directions for Use: ${d.dosageDirections || ''}
Special Warnings: ${d.warnings || ''}

${scheduleText ? `SCHEDULE DECLARATION (use this verbatim):\n${scheduleText}` : ''}

Generate these sections (ALL mandatory — use [PLACEHOLDER] for missing values):
1. product_name — brand name prominently + generic INN name below
2. composition — "Each [tablet/capsule/5 ml] contains:" with active ingredients + INN + strength; excipients
3. net_contents — e.g., "10 Tablets" or "60 ml" with per-strip / per-pack breakdown
4. schedule_declaration — full schedule text verbatim (if applicable); Rx symbol instruction
5. manufacturer_dln — "Manufactured by: [Name]\\n[Address]\\nMfg. Lic. No.: [DLN]"
6. batch_info — "Batch No.: ___ | Mfg. Date: MM/YYYY | Exp. Date: MM/YYYY" (NOTE: must say "Exp. Date", NOT "Best Before")
7. mrp — "MRP ₹___ (Incl. of all taxes)"
8. storage — complete storage conditions text
9. keep_out_of_reach — "Keep out of reach of children."
10. dosage_directions — directions for use / dosage regimen
11. warnings — all applicable warnings

RULES:
- Expiry field must say "Exp. Date" or "Use before" — NEVER "Best Before" (that is cosmetics terminology)
- Active ingredient names must be INN / Pharmacopoeial (IP/BP/USP), not brand/trade names
- Schedule declaration text must be used verbatim — paraphrasing is non-compliant
- DLN is mandatory — absence is a regulatory failure
${GENERATOR_SCHEMA}`
}

// ── JSON SCHEMA (shared for compliance checker) ────────────────────────
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

// ── CHECK TYPE SECTION BUILDER ────────────────────────────────────────────
function buildCheckTypeSection(checkType) {
  if (checkType === 'post-print') {
    return `
CHECK TYPE: POST-PRINT — Physical Printed Label / Carton Verification
You are reviewing a PHYSICALLY PRINTED LABEL or carton that has already been produced.
Apply the following additional criteria on top of the standard compliance checks:
- LEGIBILITY: All mandatory text must be clearly readable — not smudged, faded, misaligned, or too small. Flag illegible text as FAIL.
- FONT SIZE: Minimum legal font sizes must be visibly met as ACTUALLY PRINTED (e.g., net quantity min 1mm for small packs). Flag apparent undersized text as FAIL.
- PRINT QUALITY: Logos, marks (Rx, green dot, recycling symbol) must be clearly printed and not degraded by ink bleed, fading, or poor contrast. Flag poor-quality marks as WARNING (readable) or FAIL (not identifiable).
- MRP, BATCH NUMBER, EXPIRY DATE must be clearly legible — if they appear to use variable-data printing and are present but unclear, flag as WARNING.
- COLOUR: Where colour is regulatory (e.g., red band on Schedule H, green/brown dot marks), verify the colour appears correct and not faded.
- Placeholder fields (blank batch/date areas) are FAIL in post-print — these MUST be filled on a printed label.
- Barcode / QR code (if present): assess if it appears clearly printed and scannable.`
  }
  return `
CHECK TYPE: PRE-PRINT — Design Proof / Digital Artwork
You are reviewing a DIGITAL DESIGN FILE or ARTWORK PROOF before it goes to print.
Apply the following criteria:
- Focus on whether all mandatory declarations are PRESENT and correctly formatted.
- Check text accuracy: INCI names, regulatory text, licence numbers, addresses.
- For font sizes: assess from the design whether sizes appear to meet minimum legal requirements — flag as WARNING if uncertain.
- Do NOT penalise for print quality issues — this is a digital file.
- Blank placeholder fields (e.g., "Batch No.: ___", "Exp. Date: ___") are expected — flag as WARNING (not FAIL) since they will be filled at the time of printing.
- Concentrate on compliance of the designed text content, layout completeness, and presence of all required marks.`
}

// ── LOGO SECTION BUILDER ─────────────────────────────────────────────────
function buildLogoSection(activeToggles) {
  if (!activeToggles || activeToggles.length === 0) return ''
  const lines = activeToggles.map((t, i) => `${i + 1}. ${t.prompt}`).join('\n\n')
  return `

LOGO & MARK CHECKS — VISUAL INSPECTION REQUIRED
For each item below, carefully examine the label image(s) and check for the presence, legibility, and correctness of the specified mark or symbol. Generate a separate item entry in the JSON "items" array for each logo check, using "Logo / Mark Check" as the regulation field.

${lines}`
}

// ── COSMETIC PROMPT ──────────────────────────────────────────────────────
function buildCosmeticPrompt({ regulations, styleRules, extraContext, productCategory, hasBack, logoSection = '', checkType = 'pre-print' }) {
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

  const faceNote = hasBack
    ? 'Both the FRONT and BACK faces of the label/carton have been provided. Check mandatory declarations across BOTH faces — a field is compliant if it appears on either face.'
    : 'Only the FRONT face of the label has been provided. Note any fields that are typically on the back face as "Not visible — back face not uploaded" (WARNING, not FAIL).'

  return `You are a regulatory compliance expert specialising in Indian cosmetics packaging regulations.
Analyse the label image(s) provided and produce a structured compliance report in valid JSON only — no markdown, no prose outside the JSON.

TRACK: COSMETIC — regulated under Cosmetics Rules 2020 & Legal Metrology Rules 2011.
FACES PROVIDED: ${hasBack ? 'Front + Back' : 'Front only'}
${faceNote}
${buildCheckTypeSection(checkType)}

REGULATIONS TO CHECK:
${regulationList.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${mandatoryChecklist}
${styleSection}
${extraContext ? `\nADDITIONAL CONTEXT FROM USER:\n${extraContext}` : ''}
${logoSection}
${JSON_SCHEMA}`
}

// ── EXPORT COMPLIANCE ────────────────────────────────────────────────────
/**
 * Analyse labelling & regulatory gaps for an Indian product entering export markets.
 *
 * @param {Object}  opts
 * @param {string}  opts.track            - 'cosmetic' | 'drug'
 * @param {string}  opts.productName      - Product name
 * @param {string}  opts.productCategory  - Product category
 * @param {string}  opts.ingredients      - INCI / active ingredient list
 * @param {string}  opts.claims           - Key claims (cosmetic) or therapeutic indications (drug)
 * @param {string}  [opts.schedule]       - Drug schedule (drug track only)
 * @param {Array}   opts.selectedMarkets  - Market objects: { country, country_code, flag, regulation }
 *
 * Returns: { markets: [{ country, country_code, flag, regulation, overall_status, gap_count, summary, gaps[] }] }
 */
export async function analyseExportCompliance({
  track,
  productName,
  productCategory,
  ingredients,
  claims,
  schedule,
  selectedMarkets,
}) {
  const systemPrompt = buildExportPrompt({ track, productName, productCategory, ingredients, claims, schedule, selectedMarkets })

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
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Analyse export compliance gaps now. Return only the JSON.' }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${err}`)
  }

  const data = await response.json()
  const raw = data.content?.[0]?.text || ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(cleaned)
}

function buildExportPrompt({ track, productName, productCategory, ingredients, claims, schedule, selectedMarkets }) {
  const isDrug = track === 'drug'
  const indianRegs = isDrug
    ? 'Drugs & Cosmetics Act 1940 + Drugs & Cosmetics Rules 1945 (Rule 96) + Legal Metrology (Packaged Commodities) Rules 2011'
    : 'Cosmetics Rules 2020 (India) + Legal Metrology (Packaged Commodities) Rules 2011'

  const marketList = selectedMarkets
    .map((m, i) =>
      `${i + 1}. ${m.flag} ${m.country} — ${m.regulation} (country_code: "${m.country_code}", flag: "${m.flag}")`
    )
    .join('\n')

  const productInfo = `
PRODUCT INFORMATION:
Product Name: ${productName || '(not provided)'}
Category / Dosage Form: ${productCategory || '(not provided)'}
Type: ${isDrug ? 'Pharmaceutical Drug' : 'Cosmetic'}
${isDrug ? `Drug Schedule (Indian): ${schedule || 'OTC (No Schedule)'}` : ''}
${isDrug ? 'Active Ingredients:' : 'INCI / Ingredients:'} ${ingredients || '(not provided)'}
${isDrug ? 'Therapeutic Indications:' : 'Key Claims / Benefits:'} ${claims || '(not provided)'}
Current Indian Regulations: ${indianRegs}`

  const exportSchema = `
Return ONLY valid JSON matching this exact schema (no markdown, no prose):
{
  "markets": [
    {
      "country": "<country/region name>",
      "country_code": "<as provided>",
      "flag": "<emoji as provided>",
      "regulation": "<regulation name>",
      "overall_status": "COMPLIANT" | "GAPS_FOUND" | "REVIEW_REQUIRED",
      "gap_count": <integer — count of FAIL + WARNING items>,
      "summary": "<2-sentence overview of the export compliance picture for this market>",
      "gaps": [
        {
          "field": "<label field or regulatory requirement>",
          "status": "FAIL" | "WARNING" | "PASS",
          "indian_requirement": "<what Indian regulations already require on the label>",
          "target_requirement": "<what the target market requires — be specific, cite the regulation/article>",
          "issue": "<the gap, difference, or risk>",
          "recommendation": "<specific action needed to bridge this gap>"
        }
      ]
    }
  ]
}

Scoring rules:
- overall_status = "COMPLIANT" if all gaps are PASS
- overall_status = "GAPS_FOUND" if any gap is FAIL
- overall_status = "REVIEW_REQUIRED" if only WARNINGs (no FAIL)
- gap_count = count of FAIL + WARNING items only
- Include PASS items only for the 3–4 most critical requirements to confirm they are already met`

  return `You are a global regulatory affairs expert specialising in cosmetic and pharmaceutical labelling for Indian products exported internationally.

Your task: For each target export market listed, identify the labelling and regulatory GAPS between what an Indian ${isDrug ? 'drug' : 'cosmetic'} product already includes (compliant with Indian regulations) and what is ADDITIONALLY required or DIFFERENT in that target market.

Scope: Focus exclusively on LABELLING requirements — mandatory declarations, language, format, ingredient naming conventions, warning statements, registration/notification marks that affect the label, claims that are restricted, and any symbols/marks required.
${productInfo}

TARGET EXPORT MARKETS:
${marketList}

For each market, systematically analyse these areas:
1. LANGUAGE — must the label be in the local language? Is English alone accepted?
2. MANDATORY DECLARATIONS — any Indian declarations that differ in format or content in the target market
3. ADDITIONAL DECLARATIONS — required by the target market but absent from Indian regs (e.g., CPNP notification number in EU, Responsible Person details)
4. INGREDIENT RESTRICTIONS — any commonly restricted/banned substances relevant to this product category (flag as WARNING to verify against actual ingredient list)
5. CLAIMS — any claims acceptable in India that are restricted, illegal, or require substantiation in the target market
6. REGISTRATION / NOTIFICATION — requirements that generate a number or statement that must appear on the label
7. FORMAT & TYPOGRAPHY — minimum font sizes, label language area %, any typographic requirements different from India
8. MARKET-SPECIFIC MARKS/SYMBOLS — recycling symbols, language-specific icons, conformity marks

Be specific — name the regulation article / directive / CFR section wherever possible.
${exportSchema}`
}

// ── DRUG PROMPT ──────────────────────────────────────────────────────────
function buildDrugPrompt({ regulations, styleRules, extraContext, productCategory, hasBack, logoSection = '', checkType = 'pre-print' }) {
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

  const faceNote = hasBack
    ? 'Both the FRONT and BACK faces of the drug carton/label have been provided. Check mandatory declarations across BOTH faces — a field is compliant if it appears on either face.'
    : 'Only the FRONT face of the label has been provided. Note any fields typically on the back/side panels as "Not visible — back face not uploaded" (WARNING, not FAIL).'

  return `You are a regulatory compliance expert specialising in Indian pharmaceutical drug packaging regulations.
Analyse the drug label image(s) provided and produce a structured compliance report in valid JSON only — no markdown, no prose outside the JSON.

TRACK: DRUG — regulated under Drugs & Cosmetics Act 1940 and Drugs & Cosmetics Rules 1945.
FACES PROVIDED: ${hasBack ? 'Front + Back' : 'Front only'}
${faceNote}
${buildCheckTypeSection(checkType)}

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
${logoSection}
${JSON_SCHEMA}`
}
