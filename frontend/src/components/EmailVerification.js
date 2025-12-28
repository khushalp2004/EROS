import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';

export default function EmailVerification() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        setLoading(false);
        return;
      }

      try {
        console.log('Verifying email with token:', token);
        
        const response = await authAPI.verifyEmail(token);
        
        if (response.data && response.data.success) {
          setStatus('success');
          setMessage(response.data.message || 'Email verified successfully!');
          
          // Show success message for 3 seconds before redirecting
          setTimeout(() => {
            navigate('/login?verified=true');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(response.data?.message || 'Email verification failed. Please try again.');
        }
      } catch (error) {
        console.error('Email verification error:', error);
        
        if (error.response) {
          // Server responded with error status
          const errorMessage = error.response.data?.message || 'Verification failed. Please try again.';
          setStatus('error');
          setMessage(errorMessage);
        } else if (error.request) {
          // Network error
          setStatus('error');
          setMessage('Network error. Please check your connection and try again.');
        } else {
          // Other error
          setStatus('error');
          setMessage('An unexpected error occurred. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token, navigate]);

  const handleLoginRedirect = () => {
    navigate('/login?verified=true');
  };

  const handleRetry = () => {
    setLoading(true);
    setStatus('verifying');
    setMessage('');
    
    // Re-run the verification
    const verifyEmail = async () => {
      try {
        const response = await authAPI.verifyEmail(token);
        
        if (response.data && response.data.success) {
          setStatus('success');
          setMessage(response.data.message || 'Email verified successfully!');
          
          setTimeout(() => {
            navigate('/login?verified=true');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(response.data?.message || 'Email verification failed. Please try again.');
        }
      } catch (error) {
        console.error('Email verification error:', error);
        setStatus('error');
        setMessage('Verification failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
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
    <div style={{
      minHeight: 'calc(100vh - 200px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-8)',
        maxWidth: '500px',
        width: '100%',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--gray-200)',
        textAlign: 'center'
      }}>
        {/* Status Icon */}
        <div style={{
          fontSize: '4rem',
          marginBottom: 'var(--space-4)',
          opacity: loading && status === 'verifying' ? '0.7' : '1',
          animation: loading && status === 'verifying' ? 'spin 2s linear infinite' : 'none'
        }}>
          {getStatusIcon()}
        </div>

        {/* Title */}
        <h1 style={{
          margin: '0 0 var(--space-4) 0',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--text-primary)',
          lineHeight: 1.2
        }}>
          {status === 'verifying' && 'Verifying Email...'}
          {status === 'success' && 'Email Verified!'}
          {status === 'error' && 'Verification Failed'}
        </h1>

        {/* Message */}
        <div style={{
          padding: 'var(--space-4)',
          backgroundColor: getStatusColor(),
          color: getTextColor(),
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.5
        }}>
          {loading && status === 'verifying' && (
            <p style={{ margin: 0 }}>
              Please wait while we verify your email address...
            </p>
          )}
          
          {message && (
            <p style={{ margin: 0 }}>{message}</p>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {status === 'success' && (
            <>
              <button
                onClick={handleLoginRedirect}
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  border: '1px solid var(--primary-blue)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-blue)',
                  color: 'var(--text-inverse)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Go to Login
              </button>
              
              <div style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--info-bg)',
                color: 'var(--info-text)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                maxWidth: '200px'
              }}>
                Redirecting to login in 3 seconds...
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <button
                onClick={handleRetry}
                disabled={loading}
                style={{
                  padding: 'var(--space-3) var(--space-6)',
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
                {loading ? 'Retrying...' : 'Try Again'}
              </button>
              
              <button
                onClick={() => navigate('/signup')}
                style={{
                  padding: 'var(--space-3) var(--space-6)',
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
                Sign Up Again
              </button>
            </>
          )}

          {status === 'verifying' && !loading && (
            <div style={{
              padding: 'var(--space-2)',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-xs)'
            }}>
              Processing verification...
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div style={{
          marginTop: 'var(--space-6)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--gray-200)',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-xs)',
          lineHeight: 1.4
        }}>
          <p style={{ margin: '0 0 var(--space-2) 0' }}>
            <strong>Having trouble?</strong>
          </p>
          <p style={{ margin: 0 }}>
            • Check that you clicked the link from your email<br/>
            • The verification link expires after 24 hours<br/>
            • Contact support if you continue having issues
          </p>
        </div>
      </div>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
