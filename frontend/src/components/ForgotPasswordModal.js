import React, { useState } from 'react';
import { authAPI } from '../api';

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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6)',
        maxWidth: '400px',
        width: '90%',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--gray-200)'
      }}>
        <div style={{ marginBottom: 'var(--space-10)' }}>
          <h2 style={{
            margin: '0 0 var(--space-2) 0',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}>
            🔑 Forgot Password
          </h2>
          <p style={{
            margin: 0,
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)'
          }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--text-primary)'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--gray-300)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box'
              }}
              required
              disabled={loading || success}
            />
          </div>

          {success && (
            <div style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              ✅ {success}
            </div>
          )}

          {error && (
            <div style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--error-bg)',
              color: 'var(--error-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)'
            }}>
              ❌ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading || success}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                border: '1px solid var(--gray-300)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                cursor: loading || success ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)',
                opacity: loading || success ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success || !email}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                border: '1px solid var(--primary-blue)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: loading || success || !email ? 'var(--gray-300)' : 'var(--primary-blue)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                cursor: loading || success || !email ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>

        <div style={{
          marginTop: 'var(--space-4)',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--info-bg)',
          color: 'var(--info-text)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-xs)'
        }}>
          💡 <strong>Security Note:</strong> The password reset link will expire in 1 hour for security reasons.
        </div>
      </div>
    </div>
  );
}
