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
  openIssues  = [],   // [{issue_title, field, original_finding, regulation}] — product memory
  guidelines  = [],   // [{title, full_content, summary, category}] — internal guidelines
}) {
  const hasBack = Boolean(backBase64 && backMimeType)

  // Build logo section from active toggles
  const activeLogoToggles = logoTogglesDefs.filter(t => logoChecks[t.key])
  const logoSection = buildLogoSection(activeLogoToggles)

  const systemPrompt = track === 'drug'
    ? buildDrugPrompt({ regulations, styleRules, extraContext, productCategory, hasBack, logoSection, checkType, openIssues, guidelines })
    : buildCosmeticPrompt({ regulations, styleRules, extraContext, productCategory, hasBack, logoSection, checkType, openIssues, guidelines })

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
      model: MODEL_ANALYSE,
      max_tokens: 4096,
      // Prompt caching on the shared regulatory system prompt.
      // Anthropic caches the block for ~5 min, so a burst of checks in one
      // session pays for the big regulatory context once, not per check.
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      ],
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

// Model defaults — Sonnet is ~5× cheaper than Opus and more than sharp enough
// for structured JSON compliance checks. Callers stay unchanged.
const MODEL_ANALYSE   = 'claude-sonnet-4-5'
const MODEL_UTILITY   = 'claude-sonnet-4-5'

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
      model: MODEL_UTILITY,
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
// Actionable schema: every finding is a copy-pasteable fix, citable, and severity-weighted.
// A designer should be able to execute the entire report without leaving this app.
const JSON_SCHEMA = `
Return ONLY valid JSON matching this exact schema:
{
  "verdict": "PASS" | "FAIL" | "REVIEW_REQUIRED",
  "counts": { "blockers": <int>, "majors": <int>, "advisories": <int> },
  "summary": "<2-3 sentence overall assessment for the reviewer>",
  "extracted_text": "<the FULL text you see on the label — verbatim, all faces combined, preserving line breaks with \\n. This is used for deterministic post-checks (MRP format, banned-ingredient lookup, mandatory-phrase presence). Do NOT paraphrase or summarise. Empty string if the image is unreadable.>",
  "items": [
    {
      "field": "<short label field name, e.g. 'MRP', 'Storage Instructions'>",
      "regulation": "<regulation name, e.g. 'Cosmetics Rules 2020'>",
      "regulation_section": "<specific section/rule/article number, e.g. 'Rule 45(f)' — or empty string if none>",
      "source": "regulation" | "velite_internal",
      "status": "PASS" | "FAIL" | "WARNING",
      "severity": "blocker" | "major" | "advisory",
      "evidence_quote": "<the exact text or visual element you saw on the label that this finding refers to, verbatim in quotes — or 'Not present on label' if missing. Never invent; if you cannot cite, mark REVIEW.>",
      "issue": "<one-sentence description of the problem, or null if PASS>",
      "required_text": "<the EXACT text the designer should place on the label to fix this — copy-pasteable, correctly formatted, INCLUDING punctuation, units, ₹ symbol etc. Use [PLACEHOLDER] only for values you genuinely cannot know (e.g. batch number). Empty string if the fix is not a text change (e.g. placement/typography).>",
      "required_placement": "<where on the label the fix must appear: 'PDP (front panel)' | 'back panel' | 'side panel' | 'inside flap' | 'any panel' | '' if not applicable>",
      "recommendation": "<if the fix is not a simple text insertion, describe the corrective action in one sentence — otherwise empty string>"
    }
  ]
}

SEVERITY RULES — apply strictly:
- "blocker" = cannot legally ship without this fix (missing DLN, missing Schedule H warning, missing MRP, missing net qty, missing manufacturer name, missing CML for cosmetics, missing "Keep out of reach of children" for drugs, drug/therapeutic claim on a cosmetic, wrong Schedule declaration text).
- "major" = regulatory non-conformance that must be fixed before mass production but is not a shipping blocker on its own (wrong format of an existing declaration, missing consumer helpline, incorrect ingredient list order, imported product without importer details).
- "advisory" = brand/style / best-practice / soft warning where you are uncertain from the image alone.

VERDICT RULES:
- verdict = "FAIL"             if counts.blockers > 0
- verdict = "REVIEW_REQUIRED"  if counts.blockers == 0 AND counts.majors > 0
- verdict = "PASS"             if counts.blockers == 0 AND counts.majors == 0

EVIDENCE RULE (critical): For every PASS/FAIL/WARNING you MUST quote what you actually saw on the label in "evidence_quote". If a required declaration is absent, quote "Not present on label". Never fabricate text. If you cannot clearly see the artwork, set status="WARNING" severity="advisory" and evidence_quote="Not clearly visible in image".

DO NOT emit findings about font size in mm, area-percentage of a panel, or exact colour Pantone values — you cannot verify these from a scaleless image. Only flag typography where the text is CLEARLY too small to read in the image itself.

SOURCE RULES:
- source="velite_internal" ONLY when the finding is driven by a rule that appears in the INTERNAL VELITE GUIDELINES section of this prompt (Velite's own SOPs / brand standards).
- source="regulation" for everything else (Cosmetics Rules 2020, D&C Rules 1945, Legal Metrology, logo/mark checks).
- When a finding is driven by BOTH a legal reg AND a Velite guideline, tag it "velite_internal" and cite the Velite SOP name in "regulation_section".`

// ── CHECK TYPE SECTION BUILDER ────────────────────────────────────────────
function buildCheckTypeSection(checkType) {
  if (checkType === 'post-print') {
    return `
CHECK TYPE: POST-PRINT — Physical Printed Label / Carton Verification
You are reviewing a PHYSICALLY PRINTED label/carton.
- LEGIBILITY: Flag CLEARLY illegible text (smudged, faded, misaligned) as major.
- PRINT QUALITY of regulatory marks (Rx box, green dot, recycling): if not identifiable → major; readable but degraded → advisory.
- MRP / Batch / Expiry: if present but visually unclear → advisory; if genuinely absent from a printed label → blocker.
- COLOUR of regulatory bands (red Schedule H band, green/brown vegetarian dot): flag missing/incorrect colour as major.
- Placeholder blanks on a printed label are a blocker (must be filled).
- Do NOT judge font sizes in millimetres — the image has no known scale. Only call out text that is CLEARLY too small to read in the image.`
  }
  return `
CHECK TYPE: PRE-PRINT — Design Proof / Digital Artwork
You are reviewing a DIGITAL ARTWORK PROOF, not a printed label.
- Focus on PRESENCE and CORRECT FORMAT of every mandatory declaration.
- Check regulatory text is exact (INCI names, Schedule warnings verbatim, licence-number format).
- Do NOT penalise print quality — this is a digital file.
- Blank placeholders like "Batch No.: ___" are expected — advisory only.
- Do NOT judge font sizes in millimetres — the image has no known scale.`
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
function buildCosmeticPrompt({ regulations, styleRules, extraContext, productCategory, hasBack, logoSection = '', checkType = 'pre-print', openIssues = [], guidelines = [] }) {
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
MANDATORY DECLARATIONS CHECKLIST (Cosmetics Rules 2020 + Legal Metrology).
For each, provide the exact "required_text" the designer must place on the label:
1.  Product name — must be clearly displayed on PDP
2.  Ingredients list — INCI names, descending order of concentration (prefix "Ingredients:")
3.  Net weight / volume — format: "Net Content: <n> g" or "<n> ml"
4.  Manufacturer name & complete address including PIN code (prefix "Manufactured by:")
5.  Country of manufacture (if imported: importer name + address, prefix "Imported by:")
6.  Cosmetic Manufacturing Licence (CML) number — format: "CML No.: <number>"
7.  Batch / Lot number — format: "Batch No.: <blank on pre-print>"
8.  Date of manufacture (DOM) and/or best before date — format: "Mfg. Date: MM/YYYY  |  Best Before: MM/YYYY"
9.  MRP — format: "MRP ₹<amount> (Incl. of all taxes)"
10. Consumer helpline / complaint address (a phone number or email is required)
11. Instructions for use (where applicable to product category)
12. Warnings / cautions (product-category specific — e.g. "For external use only", "Avoid contact with eyes")
13. For imported products: "Imported by <name>, <address>"`

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

  // ── Internal guidelines section ───────────────────────────────────────
  let guidelinesSection = ''
  if (guidelines && guidelines.length > 0) {
    guidelinesSection = `\n\nINTERNAL VELITE GUIDELINES — MUST BE ENFORCED\nThe following are Velite Healthcare's internal packaging SOPs and brand standards. Treat any deviations as compliance issues:\n`
    guidelines.forEach((g, i) => {
      guidelinesSection += `\n[Guideline ${i + 1}: ${g.title}]\n${g.full_content || g.summary || ''}\n`
    })
  }

  // ── Product memory section ─────────────────────────────────────────────
  let memorySection = ''
  if (openIssues && openIssues.length > 0) {
    memorySection = `\n\nPRODUCT MEMORY — VERIFY THESE PREVIOUSLY IDENTIFIED ISSUES\nThe following issues were found in prior versions of this product's label. For EACH, explicitly check whether it has been fixed — if resolved use PASS, if still present use FAIL:\n`
    openIssues.forEach((issue, i) => {
      memorySection += `${i + 1}. Field: "${issue.field || issue.issue_title}" — Previous finding: "${issue.original_finding || ''}" [Regulation: ${issue.regulation || 'General'}]\n`
    })
  }

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
${guidelinesSection}
${memorySection}
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
      model: MODEL_UTILITY,
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
function buildDrugPrompt({ regulations, styleRules, extraContext, productCategory, hasBack, logoSection = '', checkType = 'pre-print', openIssues = [], guidelines = [] }) {
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
MANDATORY DECLARATIONS CHECKLIST (D&C Rules 1945 Rule 96 + Legal Metrology).
For each, provide the EXACT "required_text" a designer can paste onto the label:
1.  Drug name — brand name + generic (INN) name prominently displayed on PDP
2.  Rx symbol — in a box on PDP for prescription drugs (Schedule H/H1/X)
3.  Schedule declaration — required_text must be VERBATIM:
      Schedule H:  "Schedule H Drug — Warning: To be sold by retail on the prescription of a Registered Medical Practitioner only."
      Schedule H1: "Schedule H1 Drug\\nWARNING: It is dangerous to take this preparation except under medical supervision.\\nTo be sold by retail on the prescription of a Registered Medical Practitioner only."
      Schedule X:  "Schedule X Drug — To be sold by retail on the prescription of a Registered Medical Practitioner only."
4.  Composition — "Each <dosage unit> contains: <INN> IP <strength>" (INN names, pharmacopoeial suffix, per-dose quantity)
5.  Net contents — number of tablets / capsules / volume (ml) / weight (g)
6.  Drugs Licence Number — "Mfg. Lic. No.: <state-code/number>"
7.  Manufacturer name & complete address including PIN code (prefix "Manufactured by:")
8.  Batch / Lot number — "Batch No.: <blank on pre-print>"
9.  Date of manufacture — "Mfg. Date: MM/YYYY"
10. Expiry date — "Exp. Date: MM/YYYY" (MUST be "Exp. Date" not "Best Before")
11. MRP — "MRP ₹<amount> (Incl. of all taxes)"
12. Storage conditions — e.g. "Store below 25°C in a cool, dry place. Protect from light and moisture."
13. "Keep out of reach of children." — verbatim, mandatory
14. Directions for use / dosage regimen (where applicable)
15. For imported drugs: "Imported by <name>, <address>" and Import Licence Number`

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
${(() => {
  let guidelinesSection = ''
  if (guidelines && guidelines.length > 0) {
    guidelinesSection = `\n\nINTERNAL VELITE GUIDELINES — MUST BE ENFORCED\nThe following are Velite Healthcare's internal packaging SOPs and brand standards. Treat any deviations as compliance issues:\n`
    guidelines.forEach((g, i) => {
      guidelinesSection += `\n[Guideline ${i + 1}: ${g.title}]\n${g.full_content || g.summary || ''}\n`
    })
  }
  return guidelinesSection
})()}
${(() => {
  let memorySection = ''
  if (openIssues && openIssues.length > 0) {
    memorySection = `\n\nPRODUCT MEMORY — VERIFY THESE PREVIOUSLY IDENTIFIED ISSUES\nThe following issues were found in prior versions of this product's label. For EACH, explicitly check whether it has been fixed — if resolved use PASS, if still present use FAIL:\n`
    openIssues.forEach((issue, i) => {
      memorySection += `${i + 1}. Field: "${issue.field || issue.issue_title}" — Previous finding: "${issue.original_finding || ''}" [Regulation: ${issue.regulation || 'General'}]\n`
    })
  }
  return memorySection
})()}
${logoSection}
${JSON_SCHEMA}`
}

// ── INTERNAL GUIDELINES EXTRACTOR ────────────────────────────────────────
/**
 * Extract a structured summary from an internal guideline document.
 * Works from pasted text content and/or an image of the document.
 *
 * @param {Object}  opts
 * @param {string}  opts.title       - User-provided title
 * @param {string}  opts.category    - 'general' | 'brand' | 'regulatory' | 'sop'
 * @param {string}  opts.track       - 'drug' | 'cosmetic' | 'both'
 * @param {string|null} opts.content - Pasted text content (may be null)
 * @param {string|null} opts.base64  - Base64 image data (may be null)
 * @param {string|null} opts.mimeType - Image MIME type (may be null)
 *
 * Returns: { suggested_title, summary, full_content }
 */
export async function extractGuidelineSummary({ title, category, track, content, base64, mimeType }) {
  const trackLabel = { both: 'cosmetic and drug', cosmetic: 'cosmetic', drug: 'drug' }[track] || track
  const catLabel   = { general: 'general', brand: 'brand standards', regulatory: 'regulatory', sop: 'SOP/procedure' }[category] || category

  const systemPrompt = `You are a packaging compliance expert for Velite Healthcare (India).
Your task is to extract and structure the key rules from an internal Velite guideline document.

DOCUMENT METADATA:
- Title provided by user: "${title}"
- Category: ${catLabel}
- Applies to: ${trackLabel} products

INSTRUCTIONS:
1. Read all provided content (text and/or image).
2. Extract ALL specific rules, requirements, measurements, fonts, colours, spacing, wording — anything actionable.
3. Return ONLY valid JSON — no markdown, no prose outside the JSON.

Return this exact schema:
{
  "suggested_title": "<concise professional title, ≤ 60 chars>",
  "summary": "<2-4 sentence summary of what this guideline covers and why it matters for label compliance. Max 300 chars.>",
  "full_content": "<complete structured extraction of all rules and requirements from the document, formatted as plain text with clear sections. This is injected verbatim into AI compliance checks.>"
}`

  const userContent = []

  if (base64 && mimeType) {
    userContent.push(
      { type: 'text', text: 'Here is the guideline document image:' },
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
    )
  }

  if (content && content.trim()) {
    userContent.push({
      type: 'text',
      text: `Here is the document text content:\n\n${content.trim()}`,
    })
  }

  if (userContent.length === 0) {
    // No content at all — generate a placeholder from title + category
    userContent.push({
      type: 'text',
      text: `No document content was provided. Generate a placeholder structure for a ${catLabel} guideline titled "${title}" for ${trackLabel} packaging. Indicate in full_content that the actual rules need to be filled in manually.`,
    })
  }

  userContent.push({
    type: 'text',
    text: 'Extract the guideline structure now. Return only the JSON.',
  })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL_UTILITY,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${err}`)
  }

  const data    = await response.json()
  const raw     = data.content?.[0]?.text || ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(cleaned)
}

// ── QC ASSIST: ROOT CAUSE + CAPA SUGGESTION ───────────────────────────────
/**
 * Given a failed QC batch, suggest a root-cause hypothesis, CAPA actions, and
 * a disposition recommendation. Used on the Batch QC and Deviation screens.
 *
 * @param {Object}  opts
 * @param {string}  opts.track          - 'cosmetic' | 'drug'
 * @param {string}  opts.productName    - Product / material name
 * @param {string}  opts.materialType   - raw_material | packaging | in_process | finished_good
 * @param {string}  opts.batchNo        - Batch / lot number
 * @param {Array}   opts.failedParams   - [{ name, expected, result, severity, note }]
 * @param {Array}   [opts.pastIssues]   - [{ title, root_cause }] prior deviations for context
 *
 * Returns: { root_cause, capa: [{ action_type, description }], disposition, disposition_reason }
 */
export async function suggestQCAnalysis({ track, productName, materialType, batchNo, failedParams, pastIssues = [] }) {
  const isDrug = track === 'drug'
  const regContext = isDrug
    ? 'Indian pharmaceutical GMP (Drugs & Cosmetics Act 1940, revised Schedule M). A QC unit must be independent of production and may reject batches.'
    : 'Indian cosmetics GMP (Cosmetics Rules 2020) and Legal Metrology requirements.'

  const failList = (failedParams || [])
    .map((p, i) => `${i + 1}. ${p.name} — expected ${p.expected}, got "${p.result}" [severity: ${p.severity || 'major'}]${p.note ? ` (note: ${p.note})` : ''}`)
    .join('\n')

  const pastList = (pastIssues || []).length
    ? `\nPRIOR DEVIATIONS ON THIS PRODUCT (for context):\n${pastIssues.map((d, i) => `${i + 1}. ${d.title}${d.root_cause ? ` — root cause: ${d.root_cause}` : ''}`).join('\n')}`
    : ''

  const systemPrompt = `You are a Quality Control expert for Velite, a small-scale ${isDrug ? 'pharmaceutical' : 'cosmetics'} manufacturer in India.
Context: ${regContext}
A batch has FAILED one or more QC specifications. Provide a concise, practical analysis suitable for a small production house — no generic filler.

Return ONLY valid JSON — no markdown, no prose outside the JSON — matching this exact schema:
{
  "root_cause": "<the single most likely root cause, 1-2 sentences, specific to the failed parameters>",
  "capa": [
    { "action_type": "corrective" | "preventive", "description": "<a specific, actionable step>" }
  ],
  "disposition": "rejected" | "quarantine" | "on_hold",
  "disposition_reason": "<1 sentence justifying the recommended disposition>"
}
Provide 2-4 CAPA actions (mix of corrective and preventive). A critical failure should normally lead to "rejected"; a borderline or investigable failure to "quarantine".`

  const userMsg = `PRODUCT / MATERIAL: ${productName || '(unnamed)'}
TYPE: ${materialType || 'finished_good'}
BATCH No.: ${batchNo || '(none)'}

FAILED PARAMETERS:
${failList || '(none provided)'}
${pastList}

Analyse now. Return only the JSON.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL_UTILITY,
      max_tokens: 1536,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${err}`)
  }

  const data    = await response.json()
  const raw     = data.content?.[0]?.text || ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(cleaned)
}

// ── AUTO-LEARN STYLE RULES FROM APPROVED LABEL ────────────────────────────
/**
 * Analyse an approved label image and extract reusable Velite style rules.
 * Called automatically after a check is approved.
 *
 * @param {Object}  opts
 * @param {Object}  opts.check              - The check record
 * @param {string}  opts.base64             - Base64 image of approved label
 * @param {string}  opts.mimeType           - Image MIME type
 * @param {Array}   opts.existingRuleTitles - Titles of already-saved rules (to avoid dupes)
 *
 * Returns: { rules: [{ category, title, description, example_correct, example_incorrect }] }
 */
export async function learnStyleRulesFromLabel({ check, base64, mimeType, existingRuleTitles = [] }) {
  const existingList = existingRuleTitles.length
    ? `\nAlready-saved rules (do NOT duplicate these):\n${existingRuleTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : ''

  const systemPrompt = `You are a packaging style analyst for Velite Healthcare (India).
This is a label that has been APPROVED as fully compliant. Your task is to extract 3–7 reusable Velite brand style rules from the patterns you observe on this label.

FOCUS ON EXTRACTING:
- Typography conventions (font hierarchy, size patterns, weight usage)
- Colour usage (brand green/amber, background colours)
- Layout conventions (element placement, spacing, section order)
- Text formatting patterns (how MRP, dates, addresses are formatted)
- Claims and tone conventions
- Ingredient list formatting style

DO NOT extract:
- Rules that just restate a regulation (e.g. "INCI names required") — those are already enforced
- Rules about specific product details (batch numbers, specific ingredients)
- Generic rules already implied by regulation compliance
${existingList}

IMPORTANT: Return 0 rules if nothing genuinely distinctive is visible beyond regulatory compliance.

Return ONLY valid JSON:
{
  "rules": [
    {
      "category": "typography" | "layout" | "claims" | "ingredients" | "brand" | "general",
      "title": "<concise rule title, max 60 chars>",
      "description": "<clear description of the standard to enforce, max 200 chars>",
      "example_correct": "<what correct looks like on this label, or empty string>",
      "example_incorrect": "<what to avoid, or empty string>"
    }
  ]
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL_UTILITY,
      max_tokens: 1536,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: `Extract style rules from this approved ${check.track || 'cosmetic'} label for "${check.product_name || 'product'}". Return only the JSON.` },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${response.status} — ${err}`)
  }

  const data    = await response.json()
  const raw     = data.content?.[0]?.text || ''
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(cleaned)
}
