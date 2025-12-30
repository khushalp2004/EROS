import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';

export default function AdminProtectedRoute({ children }) {
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
        color: 'var(--text-muted)'
      }}>
        Loading...
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
              You need to log in to access the Admin Dashboard. Please enter your credentials below.
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

  // Check if user has admin role
  if (user?.role !== 'admin') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '60vh',
        padding: 'var(--space-6)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 'var(--text-4xl)',
          marginBottom: 'var(--space-4)',
          color: 'var(--primary-red)'
        }}>
          🚫
        </div>
        <h1 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--text-primary)',
          margin: '0 0 var(--space-2) 0'
        }}>
          Access Denied
        </h1>
        <p style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-muted)',
          margin: '0 0 var(--space-4) 0',
          maxWidth: '400px'
        }}>
          You don't have permission to access the admin dashboard. Only administrators can view this page.
        </p>
        <button
          onClick={() => window.history.back()}
          style={{
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: 'var(--primary-blue)',
            color: 'var(--text-inverse)',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return children;
}
