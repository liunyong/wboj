import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

function RegisterPage() {
  const { register, resendVerification } = useAuth();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [verificationInfo, setVerificationInfo] = useState(null);
  const [resendStatus, setResendStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const fieldRefs = {
    username: usernameRef,
    email: emailRef,
    password: passwordRef,
    confirmPassword: confirmPasswordRef
  };

  const focusField = (field) => {
    const ref = fieldRefs[field];
    if (ref?.current) {
      ref.current.focus();
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const clearFieldErrors = (field) => {
    setValidationErrors((prev) => prev.filter((detail) => detail.path !== field));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    clearFieldErrors(name);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setValidationErrors([]);
    setResendStatus(null);
    if (form.password !== form.confirmPassword) {
      setValidationErrors([{ path: 'confirmPassword', message: 'Passwords must match.' }]);
      focusField('confirmPassword');
      return;
    }
    setIsSubmitting(true);
    try {
      const data = await register(form);
      setVerificationInfo({
        email: data?.user?.email ?? form.email,
        message:
          data?.message ||
          'We sent a verification link to your email. Please verify to continue.',
        username: data?.user?.username ?? form.username
      });
      setValidationErrors([]);
      setForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details) && err.details.length) {
        setValidationErrors(err.details);
        const firstField = err.details.find((detail) => fieldRefs[detail.path]);
        if (firstField?.path) {
          focusField(firstField.path);
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        setError(err.message || 'Registration failed');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!verificationInfo?.email) {
      return;
    }

    setIsResending(true);
    setResendStatus(null);

    try {
      const response = await resendVerification({ email: verificationInfo.email });
      setResendStatus({
        status: 'success',
        message: response?.message || 'Verification email sent.'
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

  const fieldErrors = (field) => validationErrors.filter((detail) => detail.path === field);
  const generalValidationErrors = validationErrors.filter((detail) => !fieldRefs[detail.path]);

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p>Sign up to track submissions and earn progress.</p>
        {verificationInfo ? (
          <div className="auth-form">
            <div className="form-message success">
              <p>{verificationInfo.message}</p>
              <p>
                Sent to <strong>{verificationInfo.email}</strong>.
              </p>
            </div>
            <button type="button" onClick={handleResend} disabled={isResending}>
              {isResending ? 'Sending…' : 'Resend verification email'}
            </button>
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
            <p>
              Ready to login? <Link to="/login">Go to login</Link>
            </p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Username
              <input
                type="text"
                name="username"
                value={form.username}
                ref={usernameRef}
                onChange={handleChange}
                required
                autoComplete="username"
              />
              {fieldErrors('username').map((detail, index) => (
                <div key={`username-error-${index}`} className="form-message error">
                  {detail.message}
                </div>
              ))}
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                ref={emailRef}
                onChange={handleChange}
                required
                autoComplete="email"
              />
              {fieldErrors('email').map((detail, index) => (
                <div key={`email-error-${index}`} className="form-message error">
                  {detail.message}
                </div>
              ))}
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                value={form.password}
                ref={passwordRef}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              {fieldErrors('password').map((detail, index) => (
                <div key={`password-error-${index}`} className="form-message error">
                  {detail.message}
                </div>
              ))}
            </label>
            <label>
              Confirm Password
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                ref={confirmPasswordRef}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              {fieldErrors('confirmPassword').map((detail, index) => (
                <div key={`confirmPassword-error-${index}`} className="form-message error">
                  {detail.message}
                </div>
              ))}
            </label>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Register'}
            </button>
            {generalValidationErrors.length > 0 && (
              <ul className="form-message error">
                {generalValidationErrors.map((detail, index) => (
                  <li key={`general-error-${index}`}>{detail.message}</li>
                ))}
              </ul>
            )}
            {error && <div className="form-message error">{error}</div>}
          </form>
        )}
      </div>
    </section>
  );
}

export default RegisterPage;
