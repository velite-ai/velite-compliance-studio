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
