/**
 * CheckTypeBadge — shows whether a check was pre-print (design proof)
 * or post-print (physical printed label verification).
 *
 * Pre-Print  → purple  (still in review / draft stage)
 * Post-Print → green   (final printed product)
 */
export default function CheckTypeBadge({ checkType, size = 'sm' }) {
  const isPre = checkType === 'pre-print'
  return (
    <span
      className={`badge ${isPre ? 'badge-review' : 'badge-pass'}`}
      style={size === 'lg' ? { fontSize: 12, padding: '4px 12px' } : {}}
    >
      {isPre ? '📐 Pre-Print' : '🖨️ Post-Print'}
    </span>
  )
}
