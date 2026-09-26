import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { auth, errMsg } from '../api/client.js';
import Card from '../components/Card.jsx';
import Input, { Field } from '../components/Input.jsx';
import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setPending(true);
    try {
      await auth.forgotPassword(email.trim());
      setSent(true);
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
          <h2 style={{ fontSize: '1.6rem', textAlign: 'center' }}>Reset password</h2>
          {sent ? (
            <div className="info-box" role="status">
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
              Check your inbox (and spam folder).
            </div>
          ) : (
            <>
              <p className="text-muted small" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                Enter your account email and we'll send you a reset link.
              </p>
              <form onSubmit={submit} noValidate>
                <Field label="Email" error={error} htmlFor="fp-email">
                  <Input
                    id="fp-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={error}
                    placeholder="you@example.com"
                  />
                </Field>
                <Button type="submit" block disabled={pending}>
                  {pending ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
            </>
          )}
          <p className="auth-alt">
            <Link to="/login">Back to sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
