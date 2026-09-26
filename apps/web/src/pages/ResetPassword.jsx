import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { auth, errMsg } from '../api/client.js';
import Card from '../components/Card.jsx';
import Input, { Field } from '../components/Input.jsx';
import Button from '../components/Button.jsx';
import Logo from '../components/Logo.jsx';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (password.length < 8) errs.password = 'Use at least 8 characters.';
    if (confirm !== password) errs.confirm = 'Passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      await auth.resetPassword(token, password);
      toast.success('Password updated — please sign in.');
      navigate('/login', { replace: true });
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
          <h2 style={{ fontSize: '1.6rem', textAlign: 'center' }}>Choose a new password</h2>
          {!token ? (
            <div className="warn-box" role="alert" style={{ marginTop: '1rem' }}>
              This reset link is missing its token. Please request a new one from the{' '}
              <Link to="/forgot-password">forgot password</Link> page.
            </div>
          ) : (
            <form onSubmit={submit} noValidate style={{ marginTop: '1.5rem' }}>
              <Field label="New password" error={errors.password} htmlFor="rp-password">
                <Input
                  id="rp-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  placeholder="••••••••"
                />
              </Field>
              <Field label="Confirm password" error={errors.confirm} htmlFor="rp-confirm">
                <Input
                  id="rp-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  error={errors.confirm}
                  placeholder="••••••••"
                />
              </Field>
              <Button type="submit" block disabled={pending}>
                {pending ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
          <p className="auth-alt">
            <Link to="/login">Back to sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
