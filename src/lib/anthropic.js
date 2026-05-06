const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

/**
 * Run a full cosmetic label compliance analysis using Claude.
 * Returns structured JSON: { verdict, score, summary, items[], style_suggestions[] }
 */
export async function analyseLabel({
  base64,
  mimeType,
  productName,
  productCategory,
  extraContext,
  regulations,
  styleRules,
}) {
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

  let styleSection = ''
  if (styleRules && styleRules.length > 0) {
    const grouped = styleRules.reduce((acc, r) => {
      ;(acc[r.category] = acc[r.category] || []).push(r)
      return acc
    }, {})
    styleSection = `\n\nVELITE INTERNAL STYLE STANDARDS\nIn addition to regulations, enforce these Velite-specific brand standards:\n`
    for (const [cat, rules] of Object.entries(grouped)) {
      styleSection += `\n[${cat.toUpperCase()}]\n`
      rules.forEach((r) => {
        styleSection += `• ${r.title}: ${r.description}`
        if (r.example_correct) styleSection += `\n  Correct: ${r.example_correct}`
        if (r.example_incorrect) styleSection += `\n  Incorrect: ${r.example_incorrect}`
        styleSection += '\n'
      })
    }
  }

  const mandatoryChecklist = `
MANDATORY DECLARATIONS CHECKLIST (Cosmetics Rules 2020 + Legal Metrology):
1. Product name — clearly displayed
2. Ingredients list — INCI names, descending order of concentration
3. Net weight / volume — with unit, correct font size (min 1mm for small packs)
4. Manufacturer name & complete address (including PIN code)
5. Country of manufacture (if imported: importer name + address)
6. Cosmetic Manufacturing Licence (CML) number
7. Batch / Lot number
8. Date of manufacture (DOM) or best before / expiry date
9. MRP — format: "MRP ₹XX (incl. all taxes)"
10. Consumer helpline / complaint address
11. Instructions for use (where applicable)
12. Warnings / cautions (product-category specific)
13. For imported products: "Imported by [name], [address]"`

  const systemPrompt = `You are a regulatory compliance expert specialising in Indian cosmetics packaging regulations.
Analyse the label image provided and produce a structured compliance report in valid JSON only — no markdown, no prose outside the JSON.

REGULATIONS TO CHECK:
${regulationList.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${mandatoryChecklist}
${styleSection}
${extraContext ? `\nADDITIONAL CONTEXT FROM USER:\n${extraContext}` : ''}

Return ONLY valid JSON matching this exact schema:
{
  "verdict": "PASS" | "FAIL" | "REVIEW_REQUIRED",
  "score": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "items": [
    {
      "field": "<label field name>",
      "regulation": "<regulation name or 'Velite Style'>",
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

  const userContent = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    },
    {
      type: 'text',
      text: `Analyse this ${productCategory || 'cosmetic'} label${productName ? ` for "${productName}"` : ''}. Return only the JSON compliance report.`,
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
