export default function Badge({ variant = 'neutral', children, className = '' }) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const map = {
    queued: 'neutral',
    processing: 'info',
    completed: 'success',
    failed: 'danger',
    cancelled: 'neutral',
  };
  return <Badge variant={map[status] || 'neutral'}>{status}</Badge>;
}

export function RiskBadge({ risk }) {
  const map = { low: 'success', medium: 'accent', high: 'danger' };
  return <Badge variant={map[risk] || 'neutral'}>{risk} risk</Badge>;
}
