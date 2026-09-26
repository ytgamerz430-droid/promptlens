import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { auth, errMsg } from '../api/client.js';
import { useStore } from '../store.js';
import Card from '../components/Card.jsx';
import Input, { Field } from '../components/Input.jsx';
import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setAuth = useStore((s) => s.setAuth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  const google = useQuery({
    queryKey: ['google-url'],
    queryFn: auth.googleUrl,
    retry: false,
    staleTime: 60_000,
  });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = 'Enter your name.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (password.length < 8) errs.password = 'Use at least 8 characters.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      const d = await auth.register(name.trim(), email.trim(), password, params.get('ref'));
      setAuth(d.user, d.token);
      toast.success('Account created — welcome aboard.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Link to="/" aria-label="PromptLens home" style={{ color: 'var(--accent)' }}>
            <Logo size={40} />
          </Link>
        </div>
        <Card>
          <h2 style={{ fontSize: '1.6rem', textAlign: 'center' }}>Get started free</h2>
          <p className="text-muted small" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            Free credits every day. No card required.
          </p>
          <form onSubmit={submit} noValidate>
            <Field label="Name" error={errors.name} htmlFor="reg-name">
              <Input
                id="reg-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Email" error={errors.email} htmlFor="reg-email">
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Password"
              error={errors.password}
              hint="At least 8 characters."
              htmlFor="reg-password"
            >
              <Input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                placeholder="••••••••"
              />
            </Field>
            <Button type="submit" block disabled={pending}>
              {pending ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
          {google.data?.url && (
            <>
              <div className="row" style={{ margin: '1.25rem 0' }}>
                <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
                <span className="tiny text-faint">OR</span>
                <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
              </div>
              <Button variant="secondary" block onClick={() => (window.location.href = google.data.url)}>
                Continue with Google
              </Button>
            </>
          )}
          <p className="auth-alt">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
