import Button from './Button.jsx';

export default function EmptyState({ icon = '◌', title, body, action }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action && (
        <div style={{ marginTop: '1rem' }}>
          {typeof action === 'string' ? null : action}
        </div>
      )}
    </div>
  );
}

export function EmptyAction({ to, onClick, label, variant = 'secondary' }) {
  if (to) {
    return (
      <a href={to} className={`btn btn-${variant}`} onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <Button variant={variant} onClick={onClick}>
      {label}
    </Button>
  );
}
