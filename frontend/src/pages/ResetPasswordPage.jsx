import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const email = useMemo(() => searchParams.get('email')?.trim().toLowerCase() ?? '', [searchParams]);
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);

  const [form, setForm] = useState({
    password: '',
    confirmPassword: ''
  });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setValidationErrors((prev) => prev.filter((detail) => detail.path !== name));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    setError('');
    setValidationErrors([]);

    if (!email || !token) {
      setError('Reset link is missing required information.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setValidationErrors([{ path: 'confirmPassword', message: 'Passwords must match.' }]);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await resetPassword({
        email,
        token,
        password: form.password,
        confirmPassword: form.confirmPassword
      });
      setStatus({
        type: 'success',
        message: response?.message || 'Password reset successfully. You can now login.'
      });
      setForm({ password: '', confirmPassword: '' });
    } catch (err) {
      if (err.code === 'WEAK_PASSWORD' && Array.isArray(err.details) && err.details.length) {
        setValidationErrors(err.details);
      } else if (err.code === 'TOKEN_EXPIRED') {
        setStatus({
          type: 'warning',
          message: 'This reset link has expired. Request a new one below.'
        });
      } else if (err.code === 'TOKEN_INVALID') {
        setStatus({
          type: 'error',
          message: 'This reset link is invalid. Request a new one below.'
        });
      } else {
        setError(err.message || 'Unable to reset password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Reset Password</h1>
        <p>Choose a new password for your account.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            New Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
            {validationErrors
              .filter((detail) => detail.path === 'password')
              .map((detail, index) => (
                <div key={`password-error-${index}`} className="form-message error">
                  {detail.message}
                </div>
              ))}
          </label>
          <label>
            Confirm New Password
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
            {validationErrors
              .filter((detail) => detail.path === 'confirmPassword')
              .map((detail, index) => (
                <div key={`confirmPassword-error-${index}`} className="form-message error">
                  {detail.message}
                </div>
              ))}
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating…' : 'Reset password'}
          </button>
          {status && <div className={`form-message ${status.type}`}>{status.message}</div>}
          {error && <div className="form-message error">{error}</div>}
        </form>
        <div className="form-actions">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </section>
  );
}

export default ResetPasswordPage;
