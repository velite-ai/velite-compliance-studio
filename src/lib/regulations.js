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
