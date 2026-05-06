/**
 * TrackBadge — shows the regulatory track (Drug / Cosmetic) with distinct colours.
 * Drug   → amber  (Drugs & Cosmetics Act 1940)
 * Cosmetic → green (Cosmetics Rules 2020)
 */
export default function TrackBadge({ track, size = 'sm' }) {
  const isDrug = track === 'drug'
  return (
    <span
      className={`track-badge ${isDrug ? 'drug' : 'cosmetic'}`}
      style={size === 'lg' ? { fontSize: 13, padding: '5px 14px' } : {}}
    >
      {isDrug ? '💊' : '🧴'} {isDrug ? 'Drug' : 'Cosmetic'}
    </span>
  )
}
