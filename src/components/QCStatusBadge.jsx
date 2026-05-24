import { batchStatus } from '../lib/qc'

/** Shows a QC batch status with its colour + icon. */
export default function QCStatusBadge({ status, size = 'normal' }) {
  const s = batchStatus(status)
  return (
    <span className={`badge ${s.badge}`} style={size === 'lg' ? { fontSize: 13, padding: '4px 12px' } : {}}>
      {s.icon} {s.label}
    </span>
  )
}
