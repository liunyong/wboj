import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

function VerifyEmailPage() {
  const { verifyEmail, resendVerification } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('Checking your verification link…');
  const [resendStatus, setResendStatus] = useState(null);
  const [isResending, setIsResending] = useState(false);

  const email = useMemo(() => searchParams.get('email')?.trim().toLowerCase() ?? '', [searchParams]);
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);

  useEffect(() => {
    let active = true;

    const execute = async () => {
      if (!email || !token) {
        if (active) {
          setStatus('invalid');
          setMessage('Verification link is missing required information.');
        }
        return;
      }

      try {
        const response = await verifyEmail({ email, token });
        if (!active) {
          return;
        }
        setStatus('success');
        setMessage(response?.message || 'Your email has been verified. You can now login.');
      } catch (err) {
        if (!active) {
          return;
        }
        if (err.code === 'TOKEN_EXPIRED') {
          setStatus('expired');
          setMessage('This verification link has expired. Request a new one below.');
        } else if (err.code === 'TOKEN_INVALID') {
          setStatus('invalid');
          setMessage('This verification link is invalid. Request a new one below.');
        } else if (err.code === 'USER_NOT_FOUND') {
          setStatus('error');
          setMessage('We could not find an account for this email.');
        } else {
          setStatus('error');
          setMessage(err.message || 'Unable to verify your email right now.');
        }
      }
    };

    execute();

    return () => {
      active = false;
    };
  }, [email, token, verifyEmail]);

  const handleResend = async () => {
    if (!email) {
      return;
    }

    setIsResending(true);
    setResendStatus(null);

    try {
      const response = await resendVerification({ email });
      setResendStatus({
        status: 'success',
        message: response?.message || 'We sent you a new verification email.'
      });
    } catch (err) {
      setResendStatus({
        status: err.code === 'EMAIL_RESEND_RATE_LIMITED' ? 'warning' : 'error',
        message: err.message || 'Unable to resend verification email.'
      });
    } finally {
      setIsResending(false);
    }
  };

  const canResend = email && status !== 'success' && status !== 'pending';

  const noticeClass =
    status === 'success' ? 'success' : status === 'error' ? 'error' : status === 'pending' ? '' : 'warning';

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Email Verification</h1>
        <div className={`form-message ${noticeClass || 'info'}`}>
          <p>{message}</p>
          {status === 'success' && (
            <p>
              Proceed to <Link to="/login">login</Link> and start using your account.
            </p>
          )}
        </div>
        {canResend && (
          <button type="button" onClick={handleResend} disabled={isResending}>
            {isResending ? 'Sending…' : 'Resend verification email'}
          </button>
        )}
        {resendStatus && (
          <div
            className={`form-message ${
              resendStatus.status === 'success'
                ? 'success'
                : resendStatus.status === 'warning'
                ? 'warning'
                : 'error'
            }`}
          >
            {resendStatus.message}
          </div>
        )}
        {status !== 'pending' && !email && (
          <p>
            Return to <Link to="/register">registration</Link> to request a new verification email.
          </p>
        )}
      </div>
    </section>
  );
}

export default VerifyEmailPage;
