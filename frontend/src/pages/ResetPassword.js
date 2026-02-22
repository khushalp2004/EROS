import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ResetPasswordModal from '../components/ResetPasswordModal';
import { authAPI } from '../api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [tokenValid, setTokenValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Validate token on component mount
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Simple token format validation (backend does the actual validation)
      if (!token || token.length < 10) {
        setTokenValid(false);
        setLoading(false);
        return;
      }

      // If we can call the reset password API with empty password, 
      // it will validate the token (this is a simple way to check)
      // But for now, let's just show the modal and let the backend validate
      setTokenValid(true);
      setShowModal(true);
    } catch (error) {
      console.error('Token validation error:', error);
      setTokenValid(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSuccess = () => {
    // Redirect home and auto-open login modal after successful password reset
    navigate('/?openLogin=true&passwordReset=true');
  };

  const handleClose = () => {
    setShowModal(false);
    // Redirect to home or login if modal is closed
    navigate('/');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-secondary)',
        padding: 'var(--space-6)'
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            margin: '0 auto var(--space-4)',
            border: '4px solid var(--gray-200)',
            borderTop: '4px solid var(--primary-blue)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <h2 style={{
            margin: '0 0 var(--space-2) 0',
            fontSize: 'var(--text-xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)'
          }}>
            Validating Reset Token
          </h2>
          <p style={{
            margin: 0,
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)'
          }}>
            Please wait while we verify your password reset request...
          </p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-secondary)',
        padding: 'var(--space-6)'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--gray-200)'
        }}>
          <div style={{
            fontSize: 'var(--text-4xl)',
            marginBottom: 'var(--space-4)'
          }}>
            ❌
          </div>
          <h1 style={{
            margin: '0 0 var(--space-2) 0',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--text-primary)'
          }}>
            Invalid Reset Link
          </h1>
          <p style={{
            margin: '0 0 var(--space-6) 0',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-base)',
            lineHeight: 1.5
          }}>
            This password reset link is invalid or has expired. Password reset links expire after 1 hour for security reasons.
          </p>
          
          <div style={{
            display: 'flex',
            gap: 'var(--space-3)',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => navigate('/')}
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
              Go Home
            </button>
            <button
              onClick={() => navigate('/forgot-password')}
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
              Request New Link
            </button>
          </div>

          <div style={{
            marginTop: 'var(--space-6)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--info-bg)',
            color: 'var(--info-text)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)'
          }}>
            <strong>💡 Need Help?</strong><br />
            If you're still having trouble, please contact support or try requesting a new password reset link.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 220px)' }}>
      <ResetPasswordModal 
        isOpen={showModal}
        token={token}
        onClose={handleClose}
        onSuccess={handleResetSuccess}
      />
    </div>
  );
}
