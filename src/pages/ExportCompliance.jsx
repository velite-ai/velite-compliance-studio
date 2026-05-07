import { useState } from 'react'
import { analyseExportCompliance } from '../lib/anthropic'
import { DRUG_SCHEDULE_TYPES } from '../lib/regulations'

// ── MARKET DEFINITIONS ──────────────────────────────────────────────────
const COSMETIC_MARKETS = [
  {
    key: 'eu_cosmetic', flag: '🇪🇺', country: 'European Union', country_code: 'EU',
    regulation: 'EU Cosmetics Regulation No. 1223/2009',
    note: 'CPNP notification + EU Responsible Person required',
  },
  {
    key: 'us_cosmetic', flag: '🇺🇸', country: 'United States', country_code: 'US',
    regulation: 'FDA Cosmetics (MoCRA 2022)',
    note: 'FDA registration + safety substantiation',
  },
  {
    key: 'uk_cosmetic', flag: '🇬🇧', country: 'United Kingdom', country_code: 'UK',
    regulation: 'UK Cosmetics Regulation (retained GB 2020)',
    note: 'SCPN notification + UK Responsible Person',
  },
  {
    key: 'uae_cosmetic', flag: '🇦🇪', country: 'UAE / GCC', country_code: 'UAE',
    regulation: 'GSO 1943 / ESMA Cosmetics Standard',
    note: 'Arabic language mandatory; Halal considerations',
  },
  {
    key: 'sg_cosmetic', flag: '🇸🇬', country: 'Singapore', country_code: 'SG',
    regulation: 'HSA Cosmetics Regulations 2007',
    note: 'Pre-market notification via HSA PRISM',
  },
  {
    key: 'my_cosmetic', flag: '🇲🇾', country: 'Malaysia', country_code: 'MY',
    regulation: 'NPRA Cosmetics Control Order 2008',
    note: 'Notification + Bahasa Melayu requirements',
  },
  {
    key: 'ca_cosmetic', flag: '🇨🇦', country: 'Canada', country_code: 'CA',
    regulation: 'Health Canada Cosmetics Regulations (CPA)',
    note: 'Bilingual (EN + FR) mandatory',
  },
  {
    key: 'au_cosmetic', flag: '🇦🇺', country: 'Australia', country_code: 'AU',
    regulation: 'AICIS Industrial Chemicals Act 2019',
    note: 'Australian Cosmetics Standard + AICIS notification',
  },
]

const DRUG_MARKETS = [
  {
    key: 'eu_drug', flag: '🇪🇺', country: 'European Union', country_code: 'EU',
    regulation: 'EU Directive 2001/83/EC + Reg 726/2004',
    note: 'EMA / national MA required; local language label',
  },
  {
    key: 'us_drug', flag: '🇺🇸', country: 'United States', country_code: 'US',
    regulation: 'FDA 21 CFR Part 201 (Drug Labelling)',
    note: 'NDA/ANDA/510(k) + FDA-approved label required',
  },
  {
    key: 'uk_drug', flag: '🇬🇧', country: 'United Kingdom', country_code: 'UK',
    regulation: 'UK Human Medicines Regulations 2012',
    note: 'MHRA MA required; English-only UK label',
  },
  {
    key: 'uae_drug', flag: '🇦🇪', country: 'UAE / GCC', country_code: 'UAE',
    regulation: 'UAE Drug Control Law + MOHAP Requirements',
    note: 'Arabic + English dual label; MOHAP registration',
  },
  {
    key: 'sg_drug', flag: '🇸🇬', country: 'Singapore', country_code: 'SG',
    regulation: 'HSA Therapeutic Products Regulations 2016',
    note: 'Product Registration (PR) with HSA required',
  },
  {
    key: 'my_drug', flag: '🇲🇾', country: 'Malaysia', country_code: 'MY',
    regulation: 'NPRA Drug Registration + Control of Drugs Act',
    note: 'Bahasa Melayu + English; MAL number on label',
  },
  {
    key: 'ca_drug', flag: '🇨🇦', country: 'Canada', country_code: 'CA',
    regulation: 'Health Canada Food & Drug Regulations (C.01)',
    note: 'DIN required; bilingual (EN + FR) labelling',
  },
  {
    key: 'au_drug', flag: '🇦🇺', country: 'Australia', country_code: 'AU',
    regulation: 'TGA Therapeutic Goods (Labelling) Orders',
    note: 'ARTG number; TGA-approved PI / CMI',
  },
]

const STATUS_CONFIG = {
  COMPLIANT:        { label: 'Compliant',       cls: 'export-status-pass',   icon: '✓' },
  GAPS_FOUND:       { label: 'Gaps Found',       cls: 'export-status-fail',   icon: '✗' },
  REVIEW_REQUIRED:  { label: 'Review Required',  cls: 'export-status-review', icon: '⚠' },
}

const GAP_STATUS_CONFIG = {
  PASS:    { cls: 'badge-pass',   label: 'Pass'    },
  FAIL:    { cls: 'badge-fail',   label: 'Gap'     },
  WARNING: { cls: 'badge-warn',   label: 'Review'  },
}

// ── COMPONENT ────────────────────────────────────────────────────────────
export default function ExportCompliance() {
  const [track, setTrack]       = useState('cosmetic')
  const [form, setForm]         = useState({
    productName: '', productCategory: '', ingredients: '', claims: '', schedule: 'OTC (No Schedule)',
  })
  const [selectedKeys, setSelectedKeys] = useState([])
  const [loading, setLoading]   = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [results, setResults]   = useState(null)
  const [error, setError]       = useState(null)
  const [expandedMarkets, setExpandedMarkets] = useState({})

  const markets = track === 'drug' ? DRUG_MARKETS : COSMETIC_MARKETS
  const selectedMarkets = markets.filter(m => selectedKeys.includes(m.key))

  function setTrackAndClear(t) {
    setTrack(t)
    setSelectedKeys([])
    setResults(null)
    setError(null)
  }

  function toggleMarket(key) {
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function toggleExpand(code) {
    setExpandedMarkets(prev => ({ ...prev, [code]: !prev[code] }))
  }

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canAnalyse = form.productName.trim() && selectedKeys.length > 0 && !loading

  async function handleAnalyse() {
    if (!canAnalyse) return
    setLoading(true)
    setError(null)
    setResults(null)
    setExpandedMarkets({})
    try {
      setLoadingMsg(`Analysing ${selectedMarkets.length} market${selectedMarkets.length > 1 ? 's' : ''}…`)
      const result = await analyseExportCompliance({
        track,
        ...form,
        selectedMarkets,
      })
      setResults(result)
      // Auto-expand markets with gaps
      const expanded = {}
      result.markets.forEach(m => {
        if (m.overall_status !== 'COMPLIANT') expanded[m.country_code] = true
      })
      setExpandedMarkets(expanded)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }

  const totalGaps = results
    ? results.markets.reduce((sum, m) => sum + (m.gap_count || 0), 0)
    : 0

  return (
    <div className="export-page">
      {/* ── Track Selector ── */}
      <div className="track-selector-card" style={{ marginBottom: 16 }}>
        <div className="track-selector-label">Product Track</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="track-toggle">
            <button
              className={`track-btn cosmetic${track === 'cosmetic' ? ' active' : ''}`}
              onClick={() => setTrackAndClear('cosmetic')}
            >
              🧴 Cosmetic
            </button>
            <button
              className={`track-btn drug${track === 'drug' ? ' active' : ''}`}
              onClick={() => setTrackAndClear('drug')}
            >
              💊 Drug / Pharma
            </button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Checking against: {track === 'drug'
              ? 'D&C Rules 1945 (Rule 96) baseline'
              : 'Cosmetics Rules 2020 baseline'}
          </span>
        </div>
      </div>

      {/* ── 2-col layout ── */}
      <div className="export-layout">

        {/* LEFT — Product + Market selection */}
        <div className="export-left">

          {/* Product Details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Product Details</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Product Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Velite Hydra Glow Face Cream"
                  value={form.productName}
                  onChange={e => updateForm('productName', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">
                  {track === 'drug' ? 'Dosage Form / Category' : 'Product Category'}
                </label>
                <input
                  className="form-input"
                  placeholder={track === 'drug' ? 'e.g. Tablet, Syrup, Cream' : 'e.g. Face Cream, Shampoo'}
                  value={form.productCategory}
                  onChange={e => updateForm('productCategory', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">
                  {track === 'drug' ? 'Active Ingredients (INN + strength)' : 'Key INCI Ingredients'}
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder={track === 'drug'
                    ? 'e.g. Paracetamol IP 500mg, Ibuprofen IP 200mg'
                    : 'e.g. Niacinamide, Hyaluronic Acid, Aloe Barbadensis Leaf Extract'}
                  value={form.ingredients}
                  onChange={e => updateForm('ingredients', e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label className="form-label">
                  {track === 'drug' ? 'Therapeutic Indications' : 'Key Claims / Benefits'}
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder={track === 'drug'
                    ? 'e.g. Relief of mild to moderate pain and fever'
                    : 'e.g. Brightening, anti-aging, deep hydration for 24 hours'}
                  value={form.claims}
                  onChange={e => updateForm('claims', e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
              {track === 'drug' && (
                <div>
                  <label className="form-label">Drug Schedule (India)</label>
                  <select
                    className="form-select"
                    value={form.schedule}
                    onChange={e => updateForm('schedule', e.target.value)}
                  >
                    {DRUG_SCHEDULE_TYPES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Market Selector */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Select Export Markets</span>
              {selectedKeys.length > 0 && (
                <span className="badge badge-review" style={{ fontSize: 11 }}>
                  {selectedKeys.length} selected
                </span>
              )}
            </div>
            <div className="card-body">
              <div className="export-market-grid">
                {markets.map(m => {
                  const isSelected = selectedKeys.includes(m.key)
                  return (
                    <button
                      key={m.key}
                      className={`export-market-card${isSelected ? ' selected' : ''}`}
                      onClick={() => toggleMarket(m.key)}
                    >
                      <div className="export-market-flag">{m.flag}</div>
                      <div className="export-market-info">
                        <div className="export-market-country">{m.country}</div>
                        <div className="export-market-reg">{m.regulation}</div>
                      </div>
                      <div className={`export-market-check${isSelected ? ' checked' : ''}`}>
                        {isSelected ? '✓' : ''}
                      </div>
                    </button>
                  )
                })}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 16, opacity: canAnalyse ? 1 : .5 }}
                disabled={!canAnalyse}
                onClick={handleAnalyse}
              >
                {loading ? (
                  <><span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />{loadingMsg}</>
                ) : (
                  `🌍 Analyse ${selectedKeys.length > 0 ? `${selectedKeys.length} Market${selectedKeys.length > 1 ? 's' : ''}` : 'Markets'}`
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Results */}
        <div className="export-right">
          {error && (
            <div className="export-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {!results && !loading && !error && (
            <div className="export-empty">
              <div className="export-empty-icon">🌍</div>
              <div className="export-empty-title">Export Gap Analysis</div>
              <div className="export-empty-body">
                Fill in your product details, select one or more target markets, and click Analyse.
                Claude will compare your Indian label against each market's labelling requirements
                and identify the gaps you need to close before export.
              </div>
            </div>
          )}

          {loading && (
            <div className="export-loading">
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{loadingMsg}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Claude is consulting regulatory databases for each market…
              </div>
            </div>
          )}

          {results && (
            <>
              {/* Summary bar */}
              <div className="export-summary-bar">
                <div className="export-summary-stat">
                  <div className="export-summary-num">{results.markets.length}</div>
                  <div className="export-summary-label">Markets Analysed</div>
                </div>
                <div className="export-summary-stat">
                  <div className="export-summary-num" style={{ color: totalGaps > 0 ? 'var(--fail)' : 'var(--pass)' }}>
                    {totalGaps}
                  </div>
                  <div className="export-summary-label">Total Gaps</div>
                </div>
                <div className="export-summary-stat">
                  <div className="export-summary-num" style={{ color: 'var(--pass)' }}>
                    {results.markets.filter(m => m.overall_status === 'COMPLIANT').length}
                  </div>
                  <div className="export-summary-label">Compliant</div>
                </div>
                <div className="export-summary-stat">
                  <div className="export-summary-num" style={{ color: 'var(--fail)' }}>
                    {results.markets.filter(m => m.overall_status === 'GAPS_FOUND').length}
                  </div>
                  <div className="export-summary-label">Has Gaps</div>
                </div>
              </div>

              {/* Per-market result cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {results.markets.map(market => {
                  const status = STATUS_CONFIG[market.overall_status] || STATUS_CONFIG.REVIEW_REQUIRED
                  const isExpanded = expandedMarkets[market.country_code] ?? false
                  const failGaps = (market.gaps || []).filter(g => g.status === 'FAIL')
                  const warnGaps = (market.gaps || []).filter(g => g.status === 'WARNING')
                  const passGaps = (market.gaps || []).filter(g => g.status === 'PASS')

                  return (
                    <div key={market.country_code} className="export-result-card">
                      {/* Market header — always visible */}
                      <button
                        className="export-result-header"
                        onClick={() => toggleExpand(market.country_code)}
                      >
                        <div className="export-result-flag">{market.flag}</div>
                        <div className="export-result-meta">
                          <div className="export-result-country">{market.country}</div>
                          <div className="export-result-reg">{market.regulation}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {market.gap_count > 0 && (
                            <span className="export-gap-count">{market.gap_count} gap{market.gap_count !== 1 ? 's' : ''}</span>
                          )}
                          <span className={`export-status-badge ${status.cls}`}>
                            {status.icon} {status.label}
                          </span>
                          <span className="export-chevron" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                            ▾
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="export-result-body">
                          {/* Summary */}
                          {market.summary && (
                            <p className="export-market-summary">{market.summary}</p>
                          )}

                          {/* Gap items grouped by status */}
                          {failGaps.length > 0 && (
                            <GapGroup title="Gaps to Address" gaps={failGaps} />
                          )}
                          {warnGaps.length > 0 && (
                            <GapGroup title="Review Required" gaps={warnGaps} />
                          )}
                          {passGaps.length > 0 && (
                            <GapGroup title="Already Covered" gaps={passGaps} />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── GAP GROUP ─────────────────────────────────────────────────────────────
function GapGroup({ title, gaps }) {
  return (
    <div className="export-gap-group">
      <div className="export-gap-group-title">{title}</div>
      {gaps.map((gap, i) => {
        const cfg = GAP_STATUS_CONFIG[gap.status] || GAP_STATUS_CONFIG.WARNING
        return (
          <div key={i} className={`export-gap-item export-gap-${gap.status}`}>
            <div className="export-gap-header">
              <span className={`badge ${cfg.cls}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                {cfg.label}
              </span>
              <span className="export-gap-field">{gap.field}</span>
            </div>
            {gap.status !== 'PASS' && (
              <div className="export-gap-comparison">
                <div className="export-gap-side">
                  <div className="export-gap-side-label">🇮🇳 Indian Requirement</div>
                  <div className="export-gap-side-value">{gap.indian_requirement}</div>
                </div>
                <div className="export-gap-arrow">→</div>
                <div className="export-gap-side">
                  <div className="export-gap-side-label">🌍 Target Requirement</div>
                  <div className="export-gap-side-value">{gap.target_requirement}</div>
                </div>
              </div>
            )}
            {gap.issue && gap.status !== 'PASS' && (
              <div className="export-gap-issue">
                <strong>Gap:</strong> {gap.issue}
              </div>
            )}
            {gap.recommendation && (
              <div className="export-gap-recommendation">
                <strong>Action:</strong> {gap.recommendation}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
