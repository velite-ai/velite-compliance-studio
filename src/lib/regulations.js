// ── COSMETIC ──────────────────────────────────────────────────────────────
export const PRODUCT_CATEGORIES = [
  'Sunscreen / Sun care',
  'Anti-acne',
  'Moisturiser',
  'Face wash / Cleanser',
  'Serum / Concentrate',
  'Hair care',
  'Scalp care',
  'Body lotion',
  'Baby / Mother care',
  'Lip care',
  'Eye care',
  'Nail care',
  'Deodorant / Antiperspirant',
  'Fragrance / Perfume',
  'Other',
]

// ── DRUG ──────────────────────────────────────────────────────────────────
export const DRUG_PRODUCT_CATEGORIES = [
  'Tablet / Capsule',
  'Syrup / Suspension / Elixir',
  'Topical Cream / Ointment',
  'Topical Gel / Lotion',
  'Eye / Ear / Nasal Drops',
  'Nasal Spray / Inhalation',
  'Injection / IV / Ampoule',
  'Dry Powder Inhaler (DPI)',
  'Patch / Transdermal',
  'Suppository / Pessary',
  'OTC Antacid / Digestive Aid',
  'Vitamins / Minerals / Supplements',
  'Herbal / Ayurvedic / Unani',
  'Dental / Oral Rinse',
  'Surgical Dressing / Antiseptic',
  'Diagnostic / Reagent Kit',
  'Other Drug',
]

export const DRUG_SCHEDULE_TYPES = [
  'Schedule H',
  'Schedule H1',
  'Schedule X',
  'Schedule G',
  'OTC (No Schedule)',
]

export const DRUG_REGULATION_TOGGLES = [
  {
    key: 'drug_act',
    label: 'D&C Rules 1945 — Rule 96',
    sub: 'All mandatory drug label declarations',
    icon: '💊',
  },
  {
    key: 'schedule',
    label: 'Schedule Declaration',
    sub: 'Schedule H / H1 / X / G warnings & Rx symbol',
    icon: '📋',
  },
  {
    key: 'weights',
    label: 'Legal Metrology 2011',
    sub: 'Net qty, font size, MRP format',
    icon: '⚖️',
  },
  {
    key: 'composition',
    label: 'Composition Disclosure',
    sub: 'Active ingredients, strength & excipients listing',
    icon: '🧪',
  },
]

export const DRUG_REGULATION_DEFAULTS = {
  drug_act: true,
  schedule: true,
  weights: true,
  composition: true,
}

// ── LOGO & MARK CHECKS ────────────────────────────────────────────────────
// These control visual detection prompts sent to Claude.
// Each check asks Claude to visually look for a specific symbol/mark on the label image.

export const COSMETIC_LOGO_TOGGLES = [
  {
    key: 'green_dot',
    label: 'Green Dot (Vegetarian)',
    sub: 'Filled green circle inside green square — vegetarian mark',
    icon: '🟢',
    prompt: 'Green dot mark (vegetarian indicator): Look for a filled green circle inside a green square on the label. This is required for vegetarian cosmetic/personal care products. Report PASS if present and clearly legible, FAIL if absent on a product marketed as vegetarian, WARNING if present but unclear/too small.',
  },
  {
    key: 'brown_dot',
    label: 'Brown Dot (Non-Vegetarian)',
    sub: 'Filled brown/dark circle inside brown square',
    icon: '🟤',
    prompt: 'Brown dot mark (non-vegetarian indicator): Look for a filled brown/dark circle inside a brown square. Required for non-vegetarian products (those containing animal-derived ingredients). Report PASS if present when applicable, WARNING if absent and product may contain animal derivatives.',
  },
  {
    key: 'recycling',
    label: 'Recycling / Plastic Code',
    sub: 'Möbius loop + resin code (1–7) — Plastic Waste Management Rules',
    icon: '♻️',
    prompt: 'Recycling symbol and plastic resin identification code: Look for the triangular Möbius loop (chasing arrows recycling symbol) with a number (1–7) inside or below it indicating the plastic type (e.g. 1=PET, 2=HDPE, 5=PP). Required under Plastic Waste Management Rules 2016 for all plastic packaging. Report PASS if present and legible, FAIL if absent on plastic packaging, WARNING if symbol is present but resin code is missing or unclear.',
  },
  {
    key: 'cruelty_free',
    label: 'Cruelty-Free Mark',
    sub: 'PETA / Leaping Bunny logo if claiming cruelty-free',
    icon: '🐰',
    prompt: 'Cruelty-free certification mark: Look for a "PETA Cruelty Free" bunny logo, "Leaping Bunny" (CCIC) logo, or similar cruelty-free certification mark. If the label claims "not tested on animals", "cruelty-free", or similar, check if an appropriate certification logo is present. Report PASS if claim and logo are consistent, WARNING if claim is present but no recognisable certification logo, PASS (neutral) if no such claim is made.',
  },
  {
    key: 'organic_cert',
    label: 'Organic / Natural Certification',
    sub: 'COSMOS, ECOCERT, USDA Organic, Natrue — if making natural claims',
    icon: '🌿',
    prompt: 'Organic/natural certification mark: Look for COSMOS Organic, ECOCERT, USDA Organic, Natrue, or similar certification logos. If the label makes "organic", "natural", "bio", or "certified" claims, verify a recognised certification mark is present and identifiable. Report PASS if claim and certification logo align, WARNING if claim is made without a visible certification mark, PASS (neutral) if no natural/organic claims are made.',
  },
  {
    key: 'derma_tested',
    label: 'Dermatologist Tested Claim',
    sub: 'If claiming dermatologically tested — verify claim is substantiated',
    icon: '🔬',
    prompt: 'Dermatologist tested / clinically tested claim: Look for text or logos claiming "Dermatologist Tested", "Clinically Tested", "Hypoallergenic tested by dermatologists", or similar. Report WARNING if such a claim appears without any qualifying text (e.g., % of dermatologists, study size) or certification mark, PASS if the claim is qualified or no such claim is made.',
  },
]

export const COSMETIC_LOGO_DEFAULTS = {
  green_dot:    true,
  brown_dot:    false,
  recycling:    true,
  cruelty_free: false,
  organic_cert: false,
  derma_tested: false,
}

export const DRUG_LOGO_TOGGLES = [
  {
    key: 'rx_symbol',
    label: 'Rx Symbol',
    sub: 'Required in a box on all Schedule H / H1 / X drug labels',
    icon: '℞',
    prompt: 'Rx symbol: Look for the "Rx" or "℞" symbol, typically displayed prominently in a box or bordered element on the principal display panel. This is mandatory on all Schedule H, H1, and X prescription drug labels. Report PASS if clearly visible and boxed, FAIL if absent on a prescription drug label, WARNING if present but not boxed or difficult to read.',
  },
  {
    key: 'red_stripe',
    label: 'Red Band / Red Stripe',
    sub: 'Horizontal red stripe on Schedule H outer carton packaging',
    icon: '🔴',
    prompt: 'Red band / red stripe: Look for a horizontal red stripe or band across the label or carton, typically printed at the top or bottom. Under D&C Rules, Schedule H drug outer cartons should carry a red band. Report PASS if present and clearly red, WARNING if present but faint/unclear colour, FAIL if absent on Schedule H outer packaging.',
  },
  {
    key: 'ayush_mark',
    label: 'Ayush Mark',
    sub: 'Government AYUSH certification mark for Ayurvedic / Unani / Siddha products',
    icon: '🌿',
    prompt: 'Ayush mark: Look for the official AYUSH Department certification mark/logo (the stylised Ayush government emblem). Required for products registered under the Ministry of Ayush (Ayurvedic, Unani, Siddha, Homeopathy). Report PASS if present and legible, FAIL if absent on a product claiming Ayurvedic/Herbal/Unani origin, PASS (neutral) if product is allopathic.',
  },
  {
    key: 'gmp_mark',
    label: 'GMP / WHO-GMP Mark',
    sub: 'WHO-GMP or Schedule M compliance mark if claimed',
    icon: '🏭',
    prompt: 'GMP certification mark: Look for a WHO-GMP, Schedule M GMP, or other Good Manufacturing Practice certification logo/text. If the label claims GMP certification, verify a recognisable mark is present. Report WARNING if GMP is claimed without a visible certification mark, PASS if a mark is present or no GMP claim is made.',
  },
  {
    key: 'recycling',
    label: 'Recycling / Plastic Code',
    sub: 'Möbius loop + resin code (1–7) — Plastic Waste Management Rules',
    icon: '♻️',
    prompt: 'Recycling symbol and plastic resin identification code: Look for the triangular Möbius loop with a resin code number (1–7) inside or below it on any plastic blister, strip, or outer carton. Required under Plastic Waste Management Rules 2016. Report PASS if present and legible, FAIL if absent on plastic packaging, WARNING if symbol present but resin code missing.',
  },
]

export const DRUG_LOGO_DEFAULTS = {
  rx_symbol:  true,
  red_stripe: true,
  ayush_mark: false,
  gmp_mark:   false,
  recycling:  true,
}

// ── COSMETIC ──────────────────────────────────────────────────────────────
export const REGULATION_TOGGLES = [
  {
    key: 'cosmetics',
    label: 'Cosmetics Rules 2020',
    sub: 'Mandatory label declarations',
    icon: '📋',
  },
  {
    key: 'weights',
    label: 'Legal Metrology 2011',
    sub: 'Net qty, font size, MRP format',
    icon: '⚖️',
  },
  {
    key: 'claims',
    label: 'Therapeutic Claims',
    sub: 'Drug-action language detection',
    icon: '🚫',
  },
  {
    key: 'ingredients',
    label: 'INCI Nomenclature',
    sub: 'Ingredient list format check',
    icon: '🧪',
  },
]

export const REGULATION_LIBRARY = [
  {
    id: 'cosmetics-rules-2020',
    title: 'Cosmetics Rules 2020 (India)',
    authority: 'CDSCO / Ministry of Health',
    summary:
      'Governs the manufacture, import, export, and sale of cosmetics in India. Defines mandatory label declarations.',
    mandatoryFields: [
      { field: 'Product Name', requirement: 'Clearly displayed on the principal display panel' },
      {
        field: 'Ingredients List',
        requirement: 'INCI names in descending order of concentration; below 1% can be in any order',
      },
      {
        field: 'Net Quantity',
        requirement: 'Weight or volume in metric units; font size min 1mm for packs < 60ml',
      },
      {
        field: 'Manufacturer Details',
        requirement: 'Full name and complete address including PIN code',
      },
      { field: 'CML Number', requirement: 'Cosmetic Manufacturing Licence number must appear on label' },
      { field: 'Batch / Lot Number', requirement: 'For traceability; mandatory on all packs' },
      {
        field: 'Date of Manufacture',
        requirement: 'DOM or best-before date; format: MM/YYYY or DD/MM/YYYY',
      },
      {
        field: 'Country of Origin',
        requirement: 'Required for imported products; "Made in [Country]"',
      },
      {
        field: 'Importer Details',
        requirement: 'For imported goods: importer name and Indian address',
      },
      {
        field: 'Warnings / Cautions',
        requirement: 'Category-specific warnings (e.g. sunscreen SPF claims, baby products)',
      },
      { field: 'Instructions for Use', requirement: 'Where necessary for safe and effective use' },
      { field: 'Consumer Helpline', requirement: 'Contact for consumer complaints' },
    ],
    bannedClaims: [
      'Cures / treats / heals',
      'Reduces / eliminates acne permanently',
      'Repairs damaged hair (implying drug action)',
      'Anti-bacterial / anti-fungal (as primary claim)',
      'Whitens / lightens skin tone (specific medical language)',
    ],
    reference: 'https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/cosmetics/Cosmetics_Rules_2020.pdf',
  },
  {
    id: 'legal-metrology-2011',
    title: 'Legal Metrology (Packaged Commodities) Rules 2011',
    authority: 'Ministry of Consumer Affairs',
    summary:
      'Mandates how net quantity, MRP, and other measurements must appear on packaged goods sold in India.',
    mandatoryFields: [
      {
        field: 'MRP Format',
        requirement: '"MRP ₹XX.XX (Incl. of all taxes)" — slashed-out old MRP if revised',
      },
      {
        field: 'Net Weight Font Size',
        requirement: 'Min 1mm for packs ≤ 60g/ml; 2mm for 60–200g/ml; 4mm for > 200g/ml',
      },
      { field: 'Unit of Measure', requirement: 'Must use metric system (g, ml, kg, L)' },
      { field: 'Manufacturer Month & Year', requirement: 'Month and year of packing / manufacture' },
    ],
    reference:
      'https://consumeraffairs.nic.in/sites/default/files/file-uploads/legalmetrology/PCRules2011.pdf',
  },
  {
    id: 'inci-nomenclature',
    title: 'INCI Nomenclature Standard',
    authority: 'PCPC / EU Cosmetics Regulation (adopted by India)',
    summary:
      'International Nomenclature for Cosmetic Ingredients — standardised ingredient naming system used globally.',
    mandatoryFields: [
      { field: 'INCI Names', requirement: 'Ingredients listed using INCI names, not brand/trade names' },
      {
        field: 'Descending Order',
        requirement: 'Listed from highest to lowest concentration; below 1% can be in any order',
      },
      {
        field: 'Colourants',
        requirement: 'Listed by Colour Index (CI) number at the end of the ingredient list',
      },
      {
        field: 'Fragrance',
        requirement: '"Parfum" or "Fragrance" acceptable as collective term; allergens must be declared separately if > threshold',
      },
    ],
    reference: 'https://www.pcpcatalog.com/ingredient-search',
  },
  {
    id: 'therapeutic-claims',
    title: 'Cosmetic vs Drug Boundary (India)',
    authority: 'CDSCO / Drugs & Cosmetics Act 1940',
    summary:
      'Products making therapeutic/medicinal claims are regulated as drugs, not cosmetics. This boundary is critical.',
    allowedClaims: [
      'Moisturises skin',
      'Cleanses hair',
      'Conditions hair',
      'Provides sun protection (SPF claim)',
      'Deodorises',
      'Improves appearance of skin',
      'Refreshes skin',
    ],
    prohibitedClaims: [
      'Treats acne / cures pimples',
      'Kills bacteria / fungus',
      'Heals wounds',
      'Reduces wrinkles permanently (medical claim)',
      'Stimulates hair growth (drug action)',
      'Lightens pigmentation as treatment',
      'Anti-inflammatory action',
      'Repairs skin barrier (if phrased as drug action)',
    ],
    reference:
      'https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/cosmetics/Borderline_Products_Guidelines.pdf',
  },
]

// ── DRUG REGULATION LIBRARY ───────────────────────────────────────────────
export const DRUG_REGULATION_LIBRARY = [
  {
    id: 'dc-rules-rule96',
    title: 'Drugs & Cosmetics Rules 1945 — Rule 96',
    authority: 'CDSCO / Ministry of Health & Family Welfare',
    summary:
      'Governs mandatory label information for all drugs manufactured, imported, or sold in India. Every pack must carry all Rule 96 declarations.',
    mandatoryFields: [
      { field: 'Drug Name', requirement: 'Brand name + generic (INN) name on principal display panel' },
      { field: 'Rx / OTC Status', requirement: '"Rx" symbol for prescription drugs; "For retail without prescription" for OTC' },
      { field: 'Schedule Declaration', requirement: 'Schedule H: "To be sold by retail on prescription of a RMP only"; H1: additional WARNING text; X: Schedule X declaration' },
      { field: 'Composition', requirement: 'Each active ingredient with quantity per dosage unit (e.g., "Paracetamol IP 500 mg"); excipients where relevant' },
      { field: 'Net Contents', requirement: 'Number of tablets/capsules, volume in ml, weight in g; per strip and per box' },
      { field: 'Drugs Licence Number', requirement: 'DLN of manufacturer (e.g., "Mfg. Lic. No. MH/…")' },
      { field: 'Manufacturer Name & Address', requirement: 'Full name and complete address including PIN code of manufacturer' },
      { field: 'Batch / Lot Number', requirement: 'Batch No. / Lot No. for traceability' },
      { field: 'Date of Manufacture', requirement: 'Mfg. Date: MM/YYYY format' },
      { field: 'Expiry Date', requirement: 'Exp. Date / Use before: MM/YYYY — must be expiry, not "best before"' },
      { field: 'MRP', requirement: '"MRP ₹XX.XX (Incl. of all taxes)" — Legal Metrology format' },
      { field: 'Storage Conditions', requirement: 'e.g., "Store below 25°C, in a cool dry place, protect from light"' },
      { field: 'Keep out of reach', requirement: '"Keep out of reach of children" — mandatory on all drug labels' },
      { field: 'Instructions for Use', requirement: 'Dosage/directions where applicable' },
    ],
    reference: 'https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/forms/form-27c.pdf',
  },
  {
    id: 'schedule-h',
    title: 'Schedule H — Prescription Drug Declaration',
    authority: 'CDSCO / Drugs & Cosmetics Rules 1945',
    summary:
      'Schedule H drugs require a prescription. The label must carry the specific Schedule H warning text and the Rx symbol.',
    mandatoryFields: [
      { field: 'Schedule H Text', requirement: '"Schedule H Drug — To be sold by retail on the prescription of a Registered Medical Practitioner only"' },
      { field: 'Rx Symbol', requirement: 'Rx symbol in a box on the principal display panel' },
    ],
    reference: 'https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/drugs/Schedule%20H.pdf',
  },
  {
    id: 'schedule-h1',
    title: 'Schedule H1 — Controlled Prescription Drug',
    authority: 'CDSCO / Drugs & Cosmetics Rules 1945',
    summary:
      'Schedule H1 drugs (antibiotics, anti-TB, psychotropics) have stricter labelling. The WARNING text is mandatory.',
    mandatoryFields: [
      { field: 'WARNING Text', requirement: '"WARNING: It is dangerous to take this preparation except under medical supervision"' },
      { field: 'Schedule H1 Declaration', requirement: '"Schedule H1 Drug" on the label' },
      { field: 'Rx Symbol', requirement: 'Rx symbol with Schedule H1 designation' },
    ],
    reference: 'https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/drugs/ScheduleH1.pdf',
  },
]

// ── COSMETIC REGULATION LIBRARY ───────────────────────────────────────────
// Common restricted / banned cosmetic ingredients in India
export const INGREDIENT_FLAGS = [
  { name: 'Mercury compounds', status: 'banned', reason: 'Banned under Cosmetics Rules 2020' },
  { name: 'Hydroquinone > 2%', status: 'restricted', reason: 'Restricted to ≤2%; prescription above' },
  { name: 'Retinoic acid (Tretinoin)', status: 'banned', reason: 'Classified as drug, not cosmetic' },
  { name: 'Steroids (e.g. Betamethasone)', status: 'banned', reason: 'Drug ingredient, not permitted in cosmetics' },
  { name: 'Lead acetate', status: 'banned', reason: 'Toxic heavy metal — banned' },
  { name: 'Formaldehyde > 0.2%', status: 'restricted', reason: 'Restricted to 0.2% as preservative' },
  { name: 'Dibutyl phthalate (DBP)', status: 'banned', reason: 'Endocrine disruptor — EU & India banned' },
  { name: 'Triclosan > 0.3%', status: 'restricted', reason: 'Restricted to 0.3% in specific applications' },
  {
    name: 'Chloroform',
    status: 'banned',
    reason: 'Potential carcinogen — prohibited in cosmetics',
  },
  { name: 'Bithionol', status: 'banned', reason: 'Banned sensitizer' },
  { name: 'Chlorofluorocarbons', status: 'banned', reason: 'Environmental — banned as propellant' },
]
