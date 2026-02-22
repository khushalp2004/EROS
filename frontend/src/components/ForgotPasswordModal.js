import React, { useState } from 'react';
import { authAPI } from '../api';
import '../styles/forgot-password-modal.css';

export default function ForgotPasswordModal({ isOpen, onClose, onSwitchToReset }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authAPI.forgotPassword(email);

      if (response.data && response.data.success) {
        setSuccess('Password reset instructions have been sent to your email address.');
        // Auto close after 3 seconds
        setTimeout(() => {
          onClose();
          setSuccess('');
          setEmail('');
        }, 3000);
      } else {
        setError(response.data?.message || 'Failed to send reset email. Please try again.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="forgot-modal-overlay">
      <div className="forgot-modal-card" role="dialog" aria-modal="true" aria-labelledby="forgot-modal-title">
        <div className="forgot-modal-head">
          <h2 id="forgot-modal-title" className="forgot-modal-title">
            <span className="forgot-modal-title-icon" aria-hidden="true">🔑</span>
            Forgot Password
          </h2>
          <p className="forgot-modal-subtitle">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="forgot-modal-form">
          <div className="forgot-modal-field">
            <label className="forgot-modal-label">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="forgot-modal-input"
              required
              disabled={loading || success}
            />
          </div>

          {success && (
            <div className="forgot-modal-alert success" role="status">
              {success}
            </div>
          )}

          {error && (
            <div className="forgot-modal-alert error" role="alert">
              {error}
            </div>
          )}

          <div className="forgot-modal-actions">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || success}
              className="forgot-modal-btn secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success || !email}
              className="forgot-modal-btn primary"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>

        <div className="forgot-modal-alert info forgot-modal-note">
          <strong>Security Note:</strong> The password reset link will expire in 1 hour for security reasons.
        </div>
      </div>
    </div>
  );
}
