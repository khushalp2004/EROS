import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';

export default function EmailVerification() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [verificationStep, setVerificationStep] = useState('Initializing...');

  useEffect(() => {
    const verifyEmail = async () => {
      console.log('EmailVerification: Starting verification with token:', token);
      
      if (!token) {
        console.log('EmailVerification: No token provided');
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        setLoading(false); // Only stop loading if no token
        setVerificationStep('No token provided');
        return;
      }

      setVerificationStep('Validating token...');

      try {
        console.log('EmailVerification: Making API call to verify email');
        setVerificationStep('Contacting verification server...');
        
        const response = await authAPI.verifyEmail(token);
        
        console.log('EmailVerification: API Response received:', response);
        console.log('EmailVerification: Response data:', response.data);
        console.log('EmailVerification: Response status:', response.status);
        
        setVerificationStep('Processing verification result...');
        
        // Check if the response indicates success
        if (response.data && response.data.success === true) {
          console.log('EmailVerification: Verification successful');
          setStatus('success');
          setMessage(response.data.message || 'Email verified successfully!');
          setLoading(false); // Only stop loading on success
          setVerificationStep('Verification completed successfully!');
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login?verified=true');
          }, 3000);
        } else {
          console.log('EmailVerification: Verification failed - response indicates failure');
          setStatus('error');
          setMessage(response.data?.message || 'Email verification failed. Please try again.');
          setVerificationStep('Verification failed - ready for retry');
          // Keep loading true for retry functionality
        }
      } catch (error) {
        console.error('EmailVerification: API Error:', error);
        console.log('EmailVerification: Error response:', error.response);
        console.log('EmailVerification: Error data:', error.response?.data);
        
        setVerificationStep('Network error detected');
        
        let errorMessage = 'An unexpected error occurred. Please try again.';
        
        if (error.response) {
          // Server responded with error status
          console.log('EmailVerification: Server error with status:', error.response.status);
          errorMessage = error.response.data?.message || 'Verification failed. Please try again.';
        } else if (error.request) {
          // Network error
          console.log('EmailVerification: Network error');
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        setStatus('error');
        setMessage(errorMessage);
        // Keep loading true for retry functionality
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
    setVerificationStep('Retrying verification...');
    
    // Re-run the verification
    const verifyEmail = async () => {
      try {
        console.log('EmailVerification: Retrying verification with token:', token);
        setVerificationStep('Retrying verification...');
        
        const response = await authAPI.verifyEmail(token);
        
        console.log('EmailVerification: Retry API Response:', response);
        
        setVerificationStep('Processing retry result...');
        
        if (response.data && response.data.success === true) {
          setStatus('success');
          setMessage(response.data.message || 'Email verified successfully!');
          setLoading(false);
          setVerificationStep('Verification completed successfully!');
          
          setTimeout(() => {
            navigate('/login?verified=true');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(response.data?.message || 'Email verification failed. Please try again.');
          setVerificationStep('Retry failed - ready for another attempt');
          // Keep loading true for retry functionality
        }
      } catch (error) {
        console.error('EmailVerification: Retry error:', error);
        setStatus('error');
        setMessage('Verification failed. Please try again.');
        setVerificationStep('Retry failed due to error');
        // Keep loading true for retry functionality
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
          opacity: loading && status === 'verifying' ? '0.9' : '1',
          animation: loading && status === 'verifying' ? 'spin 2s linear infinite' : 'none',
          transition: 'all 0.3s ease'
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
            <div>
              <p style={{ margin: '0 0 var(--space-2) 0' }}>
                Please wait while we verify your email address...
              </p>
              {verificationStep && (
                <div style={{
                  padding: 'var(--space-2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-medium)',
                  textAlign: 'center',
                  marginTop: 'var(--space-2)'
                }}>
                  {verificationStep}
                </div>
              )}
            </div>
          )}
          
          {message && !loading && (
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
