import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>404</h1>
        <p className="text-muted">This page wandered off. Let's get you back on track.</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <Link to="/" className="btn btn-secondary">Home</Link>
          <Link to="/dashboard" className="btn btn-primary">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}

