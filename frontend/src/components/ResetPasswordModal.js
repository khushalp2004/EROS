import React, { useState } from 'react';
import { authAPI } from '../api';
import '../styles/reset-password-modal.css';

export default function ResetPasswordModal({ isOpen, token, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password validation
  const validatePassword = (pwd) => {
    const minLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    
    return {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial
    };
  };

  const passwordValidation = validatePassword(password);
  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate passwords
    if (!passwordValidation.isValid) {
      setError('Password does not meet security requirements.');
      setLoading(false);
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.resetPassword(token, {
        new_password: password
      });

      if (response.data && response.data.success) {
        setSuccess('Password reset successfully! You can now log in with your new password.');
        
        // Auto close after 2 seconds and call success callback
        setTimeout(() => {
          setSuccess('');
          setPassword('');
          setConfirmPassword('');
          onClose();
          if (onSuccess) {
            onSuccess();
          }
        }, 2000);
      } else {
        setError(response.data?.message || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="reset-modal-overlay">
      <div className="reset-modal-card" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
        <div className="reset-modal-head">
          <h2 id="reset-modal-title" className="reset-modal-title">
            <span className="reset-modal-title-icon" aria-hidden="true">🔒</span>
            Reset Password
          </h2>
          <p className="reset-modal-subtitle">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="reset-modal-form">
          {/* Password Field */}
          <div className="reset-modal-field">
            <label className="reset-modal-label">
              New Password
            </label>
            <div className="reset-modal-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password"
                className={`reset-modal-input reset-modal-password-input ${password && !passwordValidation.isValid ? 'invalid' : ''}`}
                required
                disabled={loading || success}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="reset-modal-showpass-btn"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {/* Password Requirements */}
            {password && (
              <div className="reset-modal-requirements">
                <div className="reset-modal-req-title">Password Requirements</div>
                <div className="reset-modal-req-grid">
                  <div className={passwordValidation.minLength ? 'ok' : ''}>At least 8 characters</div>
                  <div className={passwordValidation.hasUpper ? 'ok' : ''}>Uppercase letter</div>
                  <div className={passwordValidation.hasLower ? 'ok' : ''}>Lowercase letter</div>
                  <div className={passwordValidation.hasNumber ? 'ok' : ''}>Number</div>
                  <div className={passwordValidation.hasSpecial ? 'ok' : ''}>Special character</div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="reset-modal-field">
            <label className="reset-modal-label">
              Confirm New Password
            </label>
            <div className="reset-modal-password-wrap">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className={`reset-modal-input reset-modal-password-input ${confirmPassword && !passwordsMatch ? 'invalid' : ''}`}
                required
                disabled={loading || success}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="reset-modal-showpass-btn"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {/* Password Match Indicator */}
            {confirmPassword && (
              <div className={`reset-modal-match ${passwordsMatch ? 'ok' : 'error'}`}>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </div>
            )}
          </div>

          {success && (
            <div className="reset-modal-alert success" role="status">
              {success}
            </div>
          )}

          {error && (
            <div className="reset-modal-alert error" role="alert">
              {error}
            </div>
          )}

          <div className="reset-modal-actions">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || success}
              className="reset-modal-btn secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading || 
                success || 
                !password || 
                !confirmPassword ||
                !passwordValidation.isValid ||
                !passwordsMatch
              }
              className="reset-modal-btn primary"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
