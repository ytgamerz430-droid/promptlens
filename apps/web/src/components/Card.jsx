export default function Card({ className = '', children, ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, action }) {
  return (
    <div className="row-between" style={{ marginBottom: '1rem' }}>
      <div>
        {title && <h3 className="card-title">{title}</h3>}
        {sub && <p className="card-sub">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
