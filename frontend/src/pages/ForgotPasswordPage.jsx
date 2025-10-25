import { useState } from 'react';

import { useAuth } from '../context/AuthContext.jsx';

function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    setError('');
    setIsSubmitting(true);
    try {
      const response = await requestPasswordReset({ email });
      setStatus({
        type: 'success',
        message:
          response?.message ??
          'If the email is registered, you will receive instructions to reset your password shortly.'
      });
    } catch (err) {
      setError(err.message || 'Unable to process password reset request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Forgot Password</h1>
        <p>Enter your email address and we&apos;ll send you a reset link.</p>
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
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
          {status && <div className={`form-message ${status.type}`}>{status.message}</div>}
          {error && <div className="form-message error">{error}</div>}
        </form>
      </div>
    </section>
  );
}

export default ForgotPasswordPage;
