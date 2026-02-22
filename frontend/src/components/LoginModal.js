import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../api';
import ForgotPasswordModal from './ForgotPasswordModal';
import '../styles/login-modal.css';

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
    } else if (location.search.includes('passwordReset=true')) {
      setSuccess('Password reset successful! You can now log in.');
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (location.search.includes('openLogin=true')) {
      // Clean up helper query param when no status message is needed.
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
      const responseStatus = err?.response?.status;
      const responseData = err?.response?.data || {};
      const responseCode = responseData?.status;
      const responseMessage = responseData?.message;

      // Handle backend-auth errors first (most common).
      if (responseStatus === 401 || responseCode === 'invalid_credentials') {
        setError('Invalid email or password');
      } else if (responseCode === 'not_verified') {
        setError('Please verify your email address before logging in.');
      } else if (responseCode === 'account_locked') {
        setError('Account is temporarily locked. Please try again later.');
      } else if (responseCode === 'account_deactivated') {
        setError('Account is deactivated. Please contact administrator.');
      } else if (responseMessage) {
        setError(responseMessage);
      } else if (!err?.response) {
        // Truly no response received from server (network/DNS/CORS issues).
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (showForgotPassword) {
    return (
      <ForgotPasswordModal 
        isOpen={true}
        onClose={() => setShowForgotPassword(false)}
        onSwitchToReset={() => {
          setShowForgotPassword(false);
          setEmail('');
          setPassword('');
        }}
      />
    );
  }

  return (
    <div className="login-modal-overlay">
      <div className="login-modal-card" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
        <div className="login-modal-head">
          <h2 id="login-modal-title" className="login-modal-title">
            <span className="login-modal-title-icon" aria-hidden="true">🔐</span>
            Admin Login
          </h2>
          <p className="login-modal-subtitle">
            Please enter your credentials to access the authority dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-modal-form">
          <div className="login-modal-field">
            <label className="login-modal-label">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="login-modal-input"
              required
            />
          </div>

          <div className="login-modal-field">
            <label className="login-modal-label">
              Password
            </label>
            <div className="login-modal-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="login-modal-input login-modal-password-input"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="login-modal-showpass-btn"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {/* Forgot Password Link */}
            <div className="login-modal-forgot-row">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="login-modal-forgot-btn"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          {success && (
            <div className="login-modal-alert success" role="status">
              {success}
            </div>
          )}

          {error && (
            <div className="login-modal-alert error" role="alert">
              {error}
            </div>
          )}

          {redirecting && (
            <div className="login-modal-alert info login-modal-redirecting">
              <div className="login-modal-spinner"></div>
              Redirecting to your dashboard...
            </div>
          )}

          <div className="login-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="login-modal-btn secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || redirecting}
              className="login-modal-btn primary"
            >
              {loading ? 'Logging in...' : redirecting ? 'Redirecting...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
      
    </div>
  );
}
