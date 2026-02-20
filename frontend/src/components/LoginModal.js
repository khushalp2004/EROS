import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../api';
import ForgotPasswordModal from './ForgotPasswordModal';

export default function LoginModal({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const { login } = useAuth();

  // Check for verification success message
  useEffect(() => {
    if (location.search.includes('verified=true')) {
      setSuccess('Email verified successfully! You can now log in.');
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  // Reset redirecting state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setRedirecting(false);
    }
  }, [isOpen]);

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
        const { status, user, access_token } = response.data;
        
        if (status === 'success') {
          // Full login successful
          login(user, access_token, 'success');
          
          // Reset form
          setEmail('');
          setPassword('');
          
          // Show success message
          if (window.showSuccessToast) {
            window.showSuccessToast('Login successful!');
          }
          
          // Close modal and handle redirection
          onClose();
          
          // Add a small delay before redirection to show success message
          setTimeout(() => {
            setRedirecting(true);
            
            // Role-based redirection
            if (user.role === 'admin') {
              navigate('/admin');
            } else if (user.role === 'authority') {
              navigate('/dashboard');
            } else if (user.role === 'unit') {
              navigate('/unit');
            }
            // For other roles (like reporter), no redirection needed
            
            setRedirecting(false);
          }, 1000); // 1 second delay to show success message
          
        } else if (status === 'pending_approval') {
          // User is verified but not approved - set as pending approval
          login(user, null, 'pending_approval');
          onClose();
          
          // Reset form
          setEmail('');
          setPassword('');
          
          // Navigate to pending approval page
          window.location.href = '/pending-approval';
        }
        // Other statuses will not reach here due to success: false
      } else {
        // Handle different error statuses
        const { status, message } = response.data || {};
        
        if (status === 'invalid_credentials') {
          // Show error message for invalid credentials and keep modal open
          setError('Invalid email or password');
          // Don't reset the form or close the modal
        } else if (status === 'not_verified') {
          setError('Please verify your email address before logging in.');
        } else if (status === 'account_locked') {
          setError('Account is temporarily locked. Please try again later.');
        } else if (status === 'account_deactivated') {
          setError('Account is deactivated. Please contact administrator.');
        } else {
          // Generic error for other cases
          setError(message || 'Login failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      // For network errors, show generic message
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
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  paddingRight: 'var(--space-10)',
                  border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 'var(--space-3)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 'var(--space-1)',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--text-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color var(--transition-fast)'
                }}
                onMouseOver={(e) => e.target.style.color = 'var(--text-primary)'}
                onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {/* Forgot Password Link */}
            <div style={{
              marginTop: 'var(--space-2)',
              textAlign: 'right'
            }}>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-blue)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  transition: 'color var(--transition-fast)'
                }}
                onMouseOver={(e) => e.target.style.color = 'var(--primary-blue-dark)'}
                onMouseOut={(e) => e.target.style.color = 'var(--primary-blue)'}
              >
                Forgot Password?
              </button>
            </div>
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

          {redirecting && (
            <div style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--info-bg)',
              color: 'var(--info-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--info-text)',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Redirecting to your dashboard...
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
              disabled={loading || redirecting}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                border: '1px solid var(--primary-blue)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: (loading || redirecting) ? 'var(--gray-300)' : 'var(--primary-blue)',
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                cursor: (loading || redirecting) ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              {loading ? 'Logging in...' : redirecting ? 'Redirecting...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Forgot Password Modal */}
      <ForgotPasswordModal 
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        onSwitchToReset={() => {
          setShowForgotPassword(false);
          setEmail('');
          setPassword('');
        }}
      />
    </div>
  );
}
// make this login modal better
