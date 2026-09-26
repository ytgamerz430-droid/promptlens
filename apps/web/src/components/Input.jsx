import { useId } from 'react';

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && !error && <div className="field-hint">{hint}</div>}
      {error && <div className="field-error" role="alert">{error}</div>}
    </div>
  );
}

export default function Input({ error, id, ...rest }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <input
      id={inputId}
      className={`input${error ? ' input-error' : ''}`}
      aria-invalid={!!error}
      {...rest}
    />
  );
}

export function Textarea({ error, ...rest }) {
  return <textarea className={`input${error ? ' input-error' : ''}`} aria-invalid={!!error} {...rest} />;
}

export function Select({ error, children, ...rest }) {
  return (
    <select className={`select${error ? ' input-error' : ''}`} aria-invalid={!!error} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ label, sub, checked, onChange, name }) {
  return (
    <div className="toggle-row">
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{label}</div>
        {sub && <div className="small text-muted">{sub}</div>}
      </div>
      <label className="switch">
        <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
        <span className="switch-track">
          <span className="switch-thumb" />
        </span>
      </label>
    </div>
  );
}
