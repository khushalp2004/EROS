import React, { useState, useEffect } from 'react';
import { authAPI } from '../api';
import '../styles/signup-modal.css';

export default function SignupModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    organization: '',
    role: 'authority'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [canResend, setCanResend] = useState(true);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    let interval;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setVerificationPending(false);
      setSuccess(false);
      setError('');
      setResendMessage('');
      setCanResend(true);
      setResendCountdown(0);
      setLoading(false);
      setResendLoading(false);
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.register({
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        organization: formData.organization,
        role: formData.role
      });

      if (response.data && response.data.success) {
        // Signup successful - show verification pending state
        setSuccess(true);
        setVerificationPending(true);
        setError('');
        // Don't auto-close - keep popup open for verification
      } else {
        // Signup failed
        setError(response.data?.message || 'Signup failed. Please try again.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      // Handle different types of errors
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else if (err.response && err.response.status === 400) {
        setError('Invalid request. Please check your input and try again.');
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!canResend || !formData.email) return;
    
    setResendLoading(true);
    setResendMessage('');
    setCanResend(false);
    setResendCountdown(60); // 60 second cooldown
    
    try {
      const response = await authAPI.resendVerificationUnauth(formData.email);
      
      if (response.data && response.data.success) {
        setResendMessage('Verification email sent successfully!');
      } else {
        setResendMessage(response.data?.message || 'Failed to resend verification email.');
        setCanResend(true); // Re-enable on error
        setResendCountdown(0);
      }
    } catch (err) {
      console.error('Resend verification error:', err);
      setResendMessage('Failed to resend verification email. Please try again.');
      setCanResend(true); // Re-enable on error
      setResendCountdown(0);
    } finally {
      setResendLoading(false);
    }
  };

  const handleCloseModal = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      phone: '',
      organization: '',
      role: 'authority'
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="signup-modal-overlay">
      <div className="signup-modal-card" role="dialog" aria-modal="true" aria-labelledby="signup-modal-title">
        <div className="signup-modal-head">
          <h2 id="signup-modal-title" className="signup-modal-title">
            <span className="signup-modal-title-icon" aria-hidden="true">👤</span>
            Admin Signup
          </h2>
          <p className="signup-modal-subtitle">
            Create an admin account to access the authority dashboard.
          </p>
        </div>

        {verificationPending ? (
          <div className="signup-modal-verification">
            <div className="signup-modal-alert info center">
              <h3 className="signup-modal-block-title">📧 Verification Email Sent!</h3>
              <p className="signup-modal-block-text">
                We've sent a verification link to <strong>{formData.email}</strong>. 
                Please check your email and click the verification link to complete your registration.
              </p>
            </div>

            {/* Resend Verification Section */}
            <div className="signup-modal-resend-box">
              <h4 className="signup-modal-resend-title">
                Didn't receive the email?
              </h4>
              
              <button
                onClick={handleResendVerification}
                disabled={!canResend || resendLoading}
                className="signup-modal-btn primary full"
              >
                {resendLoading ? 'Sending...' : canResend ? 'Resend Verification Email' : `Resend in ${resendCountdown}s`}
              </button>

              {resendMessage && (
                <div className={`signup-modal-alert compact ${resendMessage.includes('success') ? 'success' : 'warning'}`}>
                  {resendMessage}
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="signup-modal-instructions">
              <h4 className="signup-modal-instructions-title">
                Instructions:
              </h4>
              <ul>
                <li>Check your email inbox (and spam folder)</li>
                <li>Click the verification link in the email</li>
                <li>The link expires after 24 hours</li>
                <li>After verification, you can log in to your account</li>
              </ul>
            </div>

            {/* Manual Close Option */}
            <div className="signup-modal-actions center">
              <button
                onClick={handleCloseModal}
                className="signup-modal-btn secondary"
              >
                Close Modal
              </button>
            </div>
          </div>
        ) : success ? (
          <div className="signup-modal-alert success center">
            <h3 className="signup-modal-block-title">✅ Signup Successful!</h3>
            <p className="signup-modal-block-text">
              Account created successfully.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="signup-modal-form">
            <div className="signup-modal-grid two">
              <div className="signup-modal-field">
                <label className="signup-modal-label">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                  className="signup-modal-input"
                  required
                />
              </div>

              <div className="signup-modal-field">
                <label className="signup-modal-label">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                  className="signup-modal-input"
                  required
                />
              </div>
            </div>

            <div className="signup-modal-field">
              <label className="signup-modal-label">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                className="signup-modal-input"
                required
              />
            </div>

            <div className="signup-modal-grid two">
              <div className="signup-modal-field">
                <label className="signup-modal-label">
                  Password *
                </label>
                <div className="signup-modal-password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter password"
                    className="signup-modal-input signup-modal-password-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="signup-modal-showpass-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="signup-modal-field">
                <label className="signup-modal-label">
                  Confirm Password *
                </label>
                <div className="signup-modal-password-wrap">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm password"
                    className="signup-modal-input signup-modal-password-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="signup-modal-showpass-btn"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>

            <div className="signup-modal-grid two">
              <div className="signup-modal-field">
                <label className="signup-modal-label">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                  className="signup-modal-input"
                />
              </div>

              <div className="signup-modal-field">
                <label className="signup-modal-label">
                  {formData.role === 'unit' ? 'Unit ID' : 'Organization'}
                </label>
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                  placeholder={formData.role === 'unit' ? "(e.g., UNIT_ID:7)" : "Enter organization"}
                  className="signup-modal-input"
                />
              </div>
            </div>

            {formData.role === 'unit' && (
              <div className="signup-modal-note">
                For Unit role, enter linked unit in organization as <code>UNIT_ID:&lt;id&gt;</code>.
              </div>
            )}

            <div className="signup-modal-field">
              <label className="signup-modal-label">
                Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="signup-modal-input"
              >
                <option value="authority">Authority</option>
                <option value="admin">Admin</option>
                <option value="unit">Unit</option>
              </select>
            </div>

            {error && (
              <div className="signup-modal-alert error" role="alert">
                {error}
              </div>
            )}

            <div className="signup-modal-actions">
              <button
                type="button"
                onClick={handleCloseModal}
                className="signup-modal-btn secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="signup-modal-btn primary"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
