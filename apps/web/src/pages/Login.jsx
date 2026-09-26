import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { auth, errMsg } from '../api/client.js';
import { useStore } from '../store.js';
import Card from '../components/Card.jsx';
import Input, { Field } from '../components/Input.jsx';
import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const setAuth = useStore((s) => s.setAuth);
  const token = useStore((s) => s.token);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  // Google OAuth callback: /login?token=...
  useEffect(() => {
    const t = params.get('token');
    if (t && !token) {
      localStorage.setItem('promptlens_token', t);
      auth
        .me()
        .then((d) => {
          setAuth(d.user, t);
          toast.success('Signed in with Google.');
          navigate('/dashboard', { replace: true });
        })
        .catch(() => {
          localStorage.removeItem('promptlens_token');
          toast.error('Google sign-in failed. Please try again.');
        });
    }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  // Google button only when the backend has OAuth configured (hide on 501)
  const google = useQuery({
    queryKey: ['google-url'],
    queryFn: auth.googleUrl,
    retry: false,
    staleTime: 60_000,
  });

  if (token) {
    navigate(location.state?.from || '/dashboard', { replace: true });
    return null;
  }

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      const d = await auth.login(email.trim(), password);
      setAuth(d.user, d.token);
      toast.success(`Welcome back, ${d.user.name || 'friend'}.`);
      navigate(location.state?.from || '/dashboard', { replace: true });
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
          <h2 style={{ fontSize: '1.6rem', textAlign: 'center' }}>Sign in</h2>
          <p className="text-muted small" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            Pick up where you left off.
          </p>
          <form onSubmit={submit} noValidate>
            <Field label="Email" error={errors.email} htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" error={errors.password} htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                placeholder="••••••••"
              />
            </Field>
            <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
              <Link to="/forgot-password" className="small">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" block disabled={pending}>
              {pending ? 'Signing in…' : 'Sign in'}
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
            New here? <Link to="/register">Create a free account</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
