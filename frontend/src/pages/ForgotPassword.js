import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const handleClose = () => {
    setShowModal(false);
    // Redirect to home or login after closing
    navigate('/');
  };

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
          🔑
        </div>
        <h1 style={{
          margin: '0 0 var(--space-2) 0',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--text-primary)'
        }}>
          Forgot Your Password?
        </h1>
        <p style={{
          margin: '0 0 var(--space-6) 0',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-base)',
          lineHeight: 1.5
        }}>
          No worries! Enter your email address and we'll send you a secure link to reset your password.
        </p>
        
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'center',
          marginBottom: 'var(--space-6)'
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
            onClick={() => setShowModal(true)}
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
            Send Reset Link
          </button>
        </div>

        <div style={{
          padding: 'var(--space-4)',
          backgroundColor: 'var(--info-bg)',
          color: 'var(--info-text)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)'
        }}>
          <strong>💡 How it works:</strong><br />
          1. Enter your email address<br />
          2. Check your email for a reset link<br />
          3. Click the link and set a new password<br />
          4. Log in with your new password
        </div>

        <div style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-4)',
          backgroundColor: 'var(--warning-bg)',
          color: 'var(--warning-text)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)'
        }}>
          <strong>🔐 Security Note:</strong><br />
          Password reset links expire after 1 hour for your security. If you didn't request this reset, please ignore the email.
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal 
        isOpen={showModal}
        onClose={handleClose}
        onSwitchToReset={() => {
          setShowModal(false);
        }}
      />
    </div>
  );
}
