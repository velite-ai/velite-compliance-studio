export default function VerdictBadge({ verdict, size = 'normal' }) {
  const map = {
    PASS:             { cls: 'badge-pass',   icon: '✓', label: 'Pass' },
    FAIL:             { cls: 'badge-fail',   icon: '✗', label: 'Fail' },
    REVIEW_REQUIRED:  { cls: 'badge-review', icon: '!', label: 'Review Required' },
    WARNING:          { cls: 'badge-warn',   icon: '⚠', label: 'Warning' },
  }
  const { cls, icon, label } = map[verdict] || { cls: 'badge-gray', icon: '?', label: verdict }

  return (
    <span className={`badge ${cls}`} style={size === 'lg' ? { fontSize: 13, padding: '4px 12px' } : {}}>
      {icon} {label}
    </span>
  )
}
