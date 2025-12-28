import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../api';

export default function LoginModal({ isOpen, onClose }) {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login } = useAuth();

  // Check for verification success message
  useEffect(() => {
    if (location.search.includes('verified=true')) {
      setSuccess('Email verified successfully! You can now log in.');
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login({
        email: email,
        password: password,
      });

      if (response.data && response.data.success) {
        // Login successful
        login(response.data.user, response.data.access_token);
        onClose();

        // Reset form
        setEmail('');
        setPassword('');

        // Show success message
        if (window.showSuccessToast) {
          window.showSuccessToast('Login successful!');
        }
      } else {
        // Login failed
        setError(response.data?.message || 'Invalid email or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
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
      zIndex: 1000
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
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{
            margin: '0 0 var(--space-2) 0',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}>
            🔐 Admin Login
          </h2>
          <p style={{
            margin: 0,
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)'
          }}>
            Please enter your credentials to access the authority dashboard
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
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
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
            />
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--text-primary)'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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
            />
          </div>

          {success && (
            <div style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)'
            }}>
              {success}
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
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                border: '1px solid var(--gray-300)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                border: '1px solid var(--primary-blue)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: loading ? 'var(--gray-300)' : 'var(--primary-blue)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
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
          💡 <strong>Demo Credentials:</strong><br />
          Email: demo@eros.com<br />
          Password: DemoPass123!
        </div>
      </div>
    </div>
  );
}
