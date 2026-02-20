import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';

export default function AuthorityProtectedRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '50vh',
        fontSize: 'var(--text-lg)',
        color: 'var(--text-muted)',
        flexDirection: 'column',
        gap: 'var(--space-3)'
      }}>
        <div className="spinner"></div>
        <span>Verifying authority access...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Show login modal for unauthenticated users instead of redirecting
    return (
      <>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 'var(--space-6)',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '500px',
            marginBottom: 'var(--space-6)'
          }}>
            <h2 style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-3)'
            }}>
              🔐 Authentication Required
            </h2>
            <p style={{
              fontSize: 'var(--text-lg)',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-4)',
              lineHeight: 1.6
            }}>
              You need to log in to access the Authority Dashboard. Please enter your credentials below.
            </p>
            <button
              onClick={() => setShowLoginModal(true)}
              style={{
                padding: 'var(--space-3) var(--space-6)',
                backgroundColor: 'var(--primary-blue)',
                color: 'var(--text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-medium)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: 'var(--shadow-md)'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = 'var(--primary-blue-dark)'}
              onMouseOut={(e) => e.target.style.backgroundColor = 'var(--primary-blue)'}
            >
              Log In to Continue
            </button>
          </div>
        </div>
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      </>
    );
  }

  // Check if user has authority role
  if (user?.role !== 'authority') {
    // User is authenticated but doesn't have authority role
    if (user?.role === 'admin') {
      // Admin users should go to admin dashboard
      return <Navigate to="/admin" replace />;
    } else if (user?.role === 'unit') {
      return <Navigate to="/unit" replace />;
    } else if (user?.role === 'reporter') {
      // Reporter users should stay on the reporter page
      return <Navigate to="/" replace />;
    } else {
      // Unknown role or no role - redirect to pending approval
      return <Navigate to="/pending-approval" replace />;
    }
  }

  return children;
}
