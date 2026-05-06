import { useState } from 'react'
import { REGULATION_LIBRARY, INGREDIENT_FLAGS } from '../lib/regulations'

export default function Regulations() {
  const [activeTab, setActiveTab] = useState('library')

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn${activeTab === 'library' ? ' active' : ''}`} onClick={() => setActiveTab('library')}>
          Regulation Library
        </button>
        <button className={`tab-btn${activeTab === 'ingredients' ? ' active' : ''}`} onClick={() => setActiveTab('ingredients')}>
          Banned / Restricted Ingredients
        </button>
        <button className={`tab-btn${activeTab === 'claims' ? ' active' : ''}`} onClick={() => setActiveTab('claims')}>
          Claims Guide
        </button>
      </div>

      {activeTab === 'library' && (
        <div>
          {REGULATION_LIBRARY.map(reg => (
            <div key={reg.id} className="reg-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <h3>{reg.title}</h3>
                <a
                  href={reg.reference}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11 }}
                >
                  Official PDF →
                </a>
              </div>
              <div className="reg-auth">Authority: {reg.authority}</div>
              <div className="reg-summary">{reg.summary}</div>

              {reg.mandatoryFields && (
                <>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Mandatory Declarations
                  </h4>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Field</th><th>Requirement</th></tr>
                      </thead>
                      <tbody>
                        {reg.mandatoryFields.map(({ field, requirement }) => (
                          <tr key={field}>
                            <td style={{ fontWeight: 600, width: '30%' }}>{field}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{requirement}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {reg.bannedClaims && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--fail)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Banned / Prohibited Claims
                  </h4>
                  <ul style={{ paddingLeft: 16 }}>
                    {reg.bannedClaims.map(c => (
                      <li key={c} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                        <span style={{ color: 'var(--fail)', marginRight: 6 }}>✗</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'ingredients' && (
        <div>
          <div style={{ padding: '12px 16px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
            ⚠️ This list covers common banned and restricted cosmetic ingredients in India. Always verify against the latest CDSCO gazette notifications.
          </div>
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {INGREDIENT_FLAGS.map(({ name, status, reason }) => (
                    <tr key={name}>
                      <td style={{ fontWeight: 500 }}>{name}</td>
                      <td>
                        <span className={`badge ${status === 'banned' ? 'badge-fail' : 'badge-warn'}`}>
                          {status === 'banned' ? '🚫 Banned' : '⚠️ Restricted'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'claims' && (
        <div>
          {REGULATION_LIBRARY.filter(r => r.allowedClaims || r.prohibitedClaims).map(reg => (
            <div key={reg.id} className="reg-card">
              <h3>{reg.title}</h3>
              <div className="reg-auth">{reg.authority}</div>
              <div className="reg-summary">{reg.summary}</div>

              <div className="grid-2" style={{ gap: 20, marginTop: 12 }}>
                {reg.allowedClaims && (
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--pass)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      Allowed Claims
                    </h4>
                    <ul style={{ paddingLeft: 16 }}>
                      {reg.allowedClaims.map(c => (
                        <li key={c} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                          <span style={{ color: 'var(--pass)', marginRight: 6 }}>✓</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {reg.prohibitedClaims && (
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--fail)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      Prohibited Claims
                    </h4>
                    <ul style={{ paddingLeft: 16 }}>
                      {reg.prohibitedClaims.map(c => (
                        <li key={c} style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                          <span style={{ color: 'var(--fail)', marginRight: 6 }}>✗</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
