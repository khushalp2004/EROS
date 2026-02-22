import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import '../styles/verify-email.css';

export default function EmailVerification() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [verificationStep, setVerificationStep] = useState('Initializing...');

  const verifyEmail = useCallback(async () => {
    setLoading(true);
    setStatus('verifying');
    setMessage('');
    setVerificationStep('Validating token...');

    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      setVerificationStep('Invalid token');
      setLoading(false);
      return;
    }

    try {
      setVerificationStep('Contacting verification server...');
      const response = await authAPI.verifyEmail(token);
      setVerificationStep('Processing verification result...');

      if (response.data?.success === true) {
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');
        setVerificationStep('Verification completed successfully!');
        setLoading(false);

        setTimeout(() => {
          navigate('/?openLogin=true&verified=true');
        }, 1200);
        return;
      }

      setStatus('error');
      setMessage(response.data?.message || 'Email verification failed. Please try again.');
      setVerificationStep('Verification failed');
    } catch (error) {
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.response) {
        errorMessage = error.response.data?.message || 'Verification failed. Please try again.';
      } else if (error.request) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      setStatus('error');
      setMessage(errorMessage);
      setVerificationStep('Verification failed');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    verifyEmail();
  }, [verifyEmail]);

  const handleLoginRedirect = () => {
    navigate('/?openLogin=true&verified=true');
  };

  const handleRetry = () => {
    verifyEmail();
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
        return '⏳';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📧';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'verifying':
        return 'var(--warning-bg)';
      case 'success':
        return 'var(--success-bg)';
      case 'error':
        return 'var(--error-bg)';
      default:
        return 'var(--bg-primary)';
    }
  };

  const getTextColor = () => {
    switch (status) {
      case 'verifying':
        return 'var(--warning-text)';
      case 'success':
        return 'var(--success-text)';
      case 'error':
        return 'var(--error-text)';
      default:
        return 'var(--text-primary)';
    }
  };

  return (
    <div className="verify-email-page">
      <div className="verify-email-card">
        <div className="verify-email-head">
          <div className={`verify-email-icon ${loading && status === 'verifying' ? 'loading' : ''}`}>
            {getStatusIcon()}
          </div>
          <h1 className="verify-email-title">
          {status === 'verifying' && 'Verifying Email...'}
          {status === 'success' && 'Email Verified!'}
          {status === 'error' && 'Verification Failed'}
          </h1>
          <p className="verify-email-subtitle">
            {status === 'success'
              ? 'Your account is now verified. You can continue to login.'
              : 'We are validating your verification link securely.'}
          </p>
        </div>

        <div
          className="verify-email-message"
          style={{
            backgroundColor: getStatusColor(),
            color: getTextColor()
          }}
        >
          {loading && status === 'verifying' && (
            <div>
              <p className="verify-email-message-text">
                Please wait while we verify your email address...
              </p>
              {verificationStep && (
                <div className="verify-email-step">
                  {verificationStep}
                </div>
              )}
            </div>
          )}
          
          {message && (
            <p className="verify-email-message-text">{message}</p>
          )}
        </div>

        <div className="verify-email-actions">
          {status === 'success' && (
            <>
              <button
                onClick={handleLoginRedirect}
                className="verify-email-btn primary"
              >
                Go to Login
              </button>
              
              <div className="verify-email-hint">
                Redirecting to login shortly...
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <button
                onClick={handleRetry}
                disabled={loading}
                className="verify-email-btn primary"
              >
                {loading ? 'Retrying...' : 'Try Again'}
              </button>
              
              <button
                onClick={() => navigate('/signup')}
                className="verify-email-btn secondary"
              >
                Sign Up Again
              </button>
            </>
          )}

          {status === 'verifying' && !loading && (
            <div className="verify-email-processing">
              Processing verification...
            </div>
          )}
        </div>

        <div className="verify-email-foot">
          <p className="verify-email-foot-title">
            Having trouble?
          </p>
          <p className="verify-email-foot-text">
            Check that you clicked the latest link from your inbox. Verification links expire after 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
