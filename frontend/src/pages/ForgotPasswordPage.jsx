import { useState } from 'react';

import { useAuth } from '../context/AuthContext.jsx';
import TurnstileWidget from '../components/TurnstileWidget.jsx';

function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReset, setTurnstileReset] = useState(0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    setError('');
    setIsSubmitting(true);
    try {
      if (!turnstileToken) {
        setError('Complete the security check first.');
        return;
      }
      const response = await requestPasswordReset({ email, turnstileToken });
      setStatus({
        type: 'success',
        message:
          response?.message ??
          'If the email is registered, you will receive instructions to reset your password shortly.'
      });
    } catch (err) {
      setError(err.message || 'Unable to process password reset request.');
    } finally {
      setTurnstileReset((value) => value + 1);
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
          <TurnstileWidget
            action="password_reset"
            onVerify={setTurnstileToken}
            onError={setError}
            resetSignal={turnstileReset}
          />
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
