import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, resendVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      const redirectTarget = location.state?.from?.pathname || '/';
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setNotice({
          status: 'warning',
          message: 'Check your inbox for the verification email to finish activating your account.',
          email: email.trim().toLowerCase()
        });
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!notice?.email) {
      return;
    }

    setIsResending(true);
    setError('');

    try {
      const response = await resendVerification({ email: notice.email });
      setNotice({
        status: 'success',
        message: response?.message || 'Verification email sent.',
        email: notice.email
      });
    } catch (err) {
      setNotice({
        status: 'error',
        message: err.message || 'Failed to resend verification email.',
        email: notice.email
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Login</h1>
        <p>Access your dashboard and submission history.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Login'}
          </button>
          <p className="muted">
            Forgot your password? <Link to="/forgot-password">Reset it</Link>
          </p>
          {notice && (
            <div
              className={`form-message ${
                notice.status === 'error'
                  ? 'error'
                  : notice.status === 'success'
                  ? 'success'
                  : 'warning'
              }`}
            >
              <p>{notice.message}</p>
              {notice.status !== 'success' && (
                <button type="button" onClick={handleResend} disabled={isResending}>
                  {isResending ? 'Sending…' : 'Resend verification email'}
                </button>
              )}
            </div>
          )}
          {error && <div className="form-message error">{error}</div>}
        </form>
      </div>
    </section>
  );
}

export default LoginPage;
