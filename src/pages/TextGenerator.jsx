import { useState } from 'react'
import { generateLabelText } from '../lib/anthropic'
import {
  PRODUCT_CATEGORIES,
  DRUG_PRODUCT_CATEGORIES,
  DRUG_SCHEDULE_TYPES,
} from '../lib/regulations'
import TrackBadge from '../components/TrackBadge'

// ── Field helpers ────────────────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
        {required && <span style={{ color: 'var(--fail)', marginLeft: 2 }}>*</span>}
        {hint && <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Section({ label }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
      color: 'var(--text-3)', borderBottom: '1px solid var(--border)',
      paddingBottom: 6, marginBottom: 14, marginTop: 4,
    }}>{label}</div>
  )
}

// ── Copy helper ──────────────────────────────────────────────────────────
function CopyBtn({ text, size = 'sm' }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button className={`btn btn-${size}`} onClick={copy} style={{ flexShrink: 0 }}>
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────────────
export default function TextGenerator() {
  const [track,      setTrack]      = useState('cosmetic')
  const [generating, setGenerating] = useState(false)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState('')

  // ── Cosmetic form state ────────────────────────────────────────────────
  const [productName,       setProductName]       = useState('')
  const [tagline,           setTagline]           = useState('')
  const [category,          setCategory]          = useState('')
  const [claims,            setClaims]            = useState('')
  const [ingredients,       setIngredients]       = useState('')
  const [netContent,        setNetContent]        = useState('')
  const [manufacturerName,  setManufacturerName]  = useState('')
  const [manufacturerAddr,  setManufacturerAddr]  = useState('')
  const [cityStatePIN,      setCityStatePIN]      = useState('')
  const [licenceNumber,     setLicenceNumber]     = useState('')
  const [countryOfOrigin,   setCountryOfOrigin]   = useState('India')
  const [helpline,          setHelpline]          = useState('')
  const [mrp,               setMrp]               = useState('')
  const [usageInstructions, setUsageInstructions] = useState('')
  const [warnings,          setWarnings]          = useState('')

  // ── Drug-specific state ────────────────────────────────────────────────
  const [activeIngredients, setActiveIngredients] = useState('')
  const [excipients,        setExcipients]        = useState('')
  const [schedule,          setSchedule]          = useState('Schedule H')
  const [storageConditions, setStorageConditions] = useState('Store below 25°C in a cool, dry place. Protect from light and moisture.')
  const [dosageDirections,  setDosageDirections]  = useState('')

  const isDrug = track === 'drug'

  function switchTrack(t) {
    setTrack(t)
    setCategory('')
    setResult(null)
    setError('')
  }

  function collectDetails() {
    if (isDrug) {
      return {
        productName, category, activeIngredients, excipients, schedule,
        netContent, manufacturerName, manufacturerAddress: manufacturerAddr,
        cityStatePIN, licenceNumber, countryOfOrigin, mrp,
        storageConditions, dosageDirections, warnings,
      }
    }
    return {
      productName, tagline, category, claims, ingredients, netContent,
      manufacturerName, manufacturerAddress: manufacturerAddr, cityStatePIN,
      licenceNumber, countryOfOrigin, helpline, mrp, usageInstructions, warnings,
    }
  }

  async function generate() {
    if (!productName.trim()) { setError('Product name is required.'); return }
    if (isDrug && !activeIngredients.trim()) { setError('Active ingredients are required.'); return }
    if (!isDrug && !ingredients.trim()) { setError('Ingredients (INCI) are required.'); return }
    setError('')
    setGenerating(true)
    setResult(null)
    try {
      const res = await generateLabelText({ track, details: collectDetails() })
      setResult(res)
    } catch (ex) {
      setError('Generation failed: ' + ex.message)
    } finally {
      setGenerating(false)
    }
  }

  const allText = result?.sections?.map(s => `${s.title.toUpperCase()}\n${s.content}`).join('\n\n') || ''

  const categories = isDrug ? DRUG_PRODUCT_CATEGORIES : PRODUCT_CATEGORIES

  return (
    <div>

      {/* ── TRACK SELECTOR ── */}
      <div
        className="track-selector-card"
        style={{
          background: isDrug ? 'var(--drug-bg)' : 'var(--cosmetic-bg)',
          borderColor: isDrug ? 'var(--drug-border)' : 'var(--cosmetic-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="track-selector-label">Regulatory Track</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {isDrug
                ? 'Generates drug label text per Drugs & Cosmetics Rules 1945 (Rule 96)'
                : 'Generates cosmetic label text per Cosmetics Rules 2020 + Legal Metrology 2011'}
            </div>
          </div>
          <div className="track-toggle">
            <button className={`track-btn cosmetic${!isDrug ? ' active' : ''}`} onClick={() => switchTrack('cosmetic')}>
              🧴 Cosmetic
            </button>
            <button className={`track-btn drug${isDrug ? ' active' : ''}`} onClick={() => switchTrack('drug')}>
              💊 Drug / OTC
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT: Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── PRODUCT ── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Product Details</span>
              <TrackBadge track={track} />
            </div>
            <div className="card-body">
              <Section label="Identity" />
              <Field label="Product / Brand Name" required>
                <input className="form-input" value={productName} onChange={e => setProductName(e.target.value)}
                  placeholder={isDrug ? 'e.g. Velite Paracetamol Tablets IP 500 mg' : 'e.g. Velite ClearSkin Sunscreen SPF 50'} />
              </Field>
              {!isDrug && (
                <Field label="Tagline / Sub-description" hint="(optional)">
                  <input className="form-input" value={tagline} onChange={e => setTagline(e.target.value)}
                    placeholder="e.g. Non-greasy · Dermatologist Tested" />
                </Field>
              )}
              <Field label={isDrug ? 'Dosage Form / Category' : 'Product Category'}>
                <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">— Select —</option>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>

              {isDrug ? (
                <>
                  <Section label="Composition" />
                  <Field label="Active Ingredients" required hint="INN/pharmacopoeial name + strength per dose unit">
                    <textarea className="form-textarea" rows={4} value={activeIngredients}
                      onChange={e => setActiveIngredients(e.target.value)}
                      placeholder={'Each tablet contains:\nParacetamol IP ................ 500 mg\nCaffeine IP .................... 30 mg'} />
                  </Field>
                  <Field label="Excipients" hint="(optional)">
                    <input className="form-input" value={excipients} onChange={e => setExcipients(e.target.value)}
                      placeholder="Microcrystalline Cellulose, Magnesium Stearate, Starch q.s." />
                  </Field>
                  <Section label="Regulatory" />
                  <Field label="Schedule Type" required>
                    <select className="form-select" value={schedule} onChange={e => setSchedule(e.target.value)}>
                      {DRUG_SCHEDULE_TYPES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                </>
              ) : (
                <>
                  <Section label="Formula" />
                  <Field label="Ingredients — INCI Names" required hint="descending order of concentration">
                    <textarea className="form-textarea" rows={5} value={ingredients}
                      onChange={e => setIngredients(e.target.value)}
                      placeholder={'Aqua, Zinc Oxide, Glycerin, Caprylic/Capric Triglyceride,\nTocopheryl Acetate, Allantoin, Phenoxyethanol...'} />
                  </Field>
                  <Field label="Key Claims / Benefits" hint="(optional — one per line)">
                    <textarea className="form-textarea" rows={3} value={claims}
                      onChange={e => setClaims(e.target.value)}
                      placeholder={'Broad spectrum UV protection\nNon-comedogenic\nSuitable for sensitive skin'} />
                  </Field>
                </>
              )}
            </div>
          </div>

          {/* ── PACKAGING ── */}
          <div className="card">
            <div className="card-header"><span className="card-title">Packaging & Commercial</span></div>
            <div className="card-body">
              <Section label="Contents & Pricing" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label={isDrug ? 'Net Contents' : 'Net Weight / Volume'} required>
                  <input className="form-input" value={netContent} onChange={e => setNetContent(e.target.value)}
                    placeholder={isDrug ? '10 Tablets / 30 Capsules / 60 ml' : '50 g / 100 ml'} />
                </Field>
                <Field label="MRP (₹)" hint="numbers only">
                  <input className="form-input" type="number" value={mrp} onChange={e => setMrp(e.target.value)}
                    placeholder="299" />
                </Field>
              </div>

              <Section label="Manufacturer" />
              <Field label="Manufacturer Name" required>
                <input className="form-input" value={manufacturerName} onChange={e => setManufacturerName(e.target.value)}
                  placeholder="Velite Healthcare Pvt. Ltd." />
              </Field>
              <Field label="Address (Street / Area)" required>
                <input className="form-input" value={manufacturerAddr} onChange={e => setManufacturerAddr(e.target.value)}
                  placeholder="Plot No. 12, Phase II, MIDC Industrial Area" />
              </Field>
              <Field label="City, State, PIN Code" required>
                <input className="form-input" value={cityStatePIN} onChange={e => setCityStatePIN(e.target.value)}
                  placeholder="Pune – 411 018, Maharashtra, India" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label={isDrug ? 'Drugs Licence No. (DLN)' : 'CML Number'}>
                  <input className="form-input" value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)}
                    placeholder={isDrug ? 'MH/____/____' : 'CML-____'} />
                </Field>
                <Field label="Country of Origin">
                  <input className="form-input" value={countryOfOrigin} onChange={e => setCountryOfOrigin(e.target.value)}
                    placeholder="India" />
                </Field>
              </div>
            </div>
          </div>

          {/* ── USAGE & SAFETY ── */}
          <div className="card">
            <div className="card-header"><span className="card-title">Usage & Safety</span></div>
            <div className="card-body">
              {isDrug ? (
                <>
                  <Field label="Storage Conditions">
                    <textarea className="form-textarea" rows={2} value={storageConditions}
                      onChange={e => setStorageConditions(e.target.value)} />
                  </Field>
                  <Field label="Dosage / Directions for Use" hint="(optional)">
                    <textarea className="form-textarea" rows={3} value={dosageDirections}
                      onChange={e => setDosageDirections(e.target.value)}
                      placeholder={'Adults: 1–2 tablets every 4–6 hours as required.\nMax. 8 tablets in 24 hours.\nNot recommended for children under 12 years.'} />
                  </Field>
                </>
              ) : (
                <Field label="Instructions for Use" hint="(optional)">
                  <textarea className="form-textarea" rows={3} value={usageInstructions}
                    onChange={e => setUsageInstructions(e.target.value)}
                    placeholder={'Apply liberally to face and exposed areas 20 minutes before sun exposure.\nReapply every 2 hours.'} />
                </Field>
              )}
              <Field label="Additional Warnings" hint="(optional — Claude adds standard ones automatically)">
                <textarea className="form-textarea" rows={2} value={warnings}
                  onChange={e => setWarnings(e.target.value)}
                  placeholder={isDrug
                    ? 'e.g., Not to be taken on empty stomach.'
                    : 'e.g., Discontinue use if irritation occurs.'} />
              </Field>
              {!isDrug && (
                <Field label="Consumer Helpline" hint="(optional)">
                  <input className="form-input" value={helpline} onChange={e => setHelpline(e.target.value)}
                    placeholder="customercare@velitehealthcare.com | 1800-XXX-XXXX" />
                </Field>
              )}
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="btn btn-primary btn-lg"
            style={{
              justifyContent: 'center',
              background: isDrug ? 'var(--drug)' : undefined,
              borderColor:  isDrug ? 'var(--drug)' : undefined,
            }}
            onClick={generate}
            disabled={generating}
          >
            {generating
              ? <><span className="spinner" /> Generating label text…</>
              : `✏️ Generate ${isDrug ? 'Drug' : 'Cosmetic'} Label Text`}
          </button>
        </div>

        {/* RIGHT: Output */}
        <div>
          {!result && !generating && (
            <div className="card">
              <div className="empty-state" style={{ padding: '56px 24px' }}>
                <div className="empty-icon">✏️</div>
                <h3>Ready to generate</h3>
                <p>Fill in the product details and click Generate.<br />Claude will write complete, regulation-compliant label text for every mandatory section.</p>
                <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8 }}>
                  {isDrug
                    ? 'Covers: Composition · Schedule declaration · Rx symbol · Manufacturer & DLN · Batch info · Storage · Dosage · Warnings'
                    : 'Covers: Product name · INCI ingredients · Net content · Manufacturer block · CML · Batch info · MRP · Helpline · Warnings · Usage'}
                </div>
              </div>
            </div>
          )}

          {generating && (
            <div className="card">
              <div className="loading-page" style={{ flexDirection: 'column', padding: '56px 24px' }}>
                <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>
                  Claude is drafting your {isDrug ? 'drug' : 'cosmetic'} label text…<br />
                  <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Checking all mandatory declarations · Usually 10–20 seconds</span>
                </p>
              </div>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Copy All + header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{productName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 8 }}>
                    <TrackBadge track={track} />
                    <span>{result.sections?.length} sections generated</span>
                  </div>
                </div>
                <CopyBtn text={allText} size="sm" />
              </div>

              {/* Regulatory notes */}
              {result.regulatory_notes?.length > 0 && (
                <div style={{
                  background: 'var(--warn-bg)', border: '1px solid var(--warn-border)',
                  borderRadius: 8, padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    ⚠️ Regulatory Notes
                  </div>
                  {result.regulatory_notes.map((n, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>• {n}</div>
                  ))}
                </div>
              )}

              {/* Section cards */}
              {result.sections?.map(section => (
                <div key={section.id} className="tg-section">
                  <div className="tg-section-header">
                    <span className="tg-section-title">{section.title}</span>
                    <CopyBtn text={section.content} />
                  </div>
                  <div className="tg-section-body">{section.content}</div>
                </div>
              ))}

              {/* Regenerate */}
              <button className="btn" style={{ justifyContent: 'center' }} onClick={generate} disabled={generating}>
                ↺ Regenerate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
