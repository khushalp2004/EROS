import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();

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
    return <Navigate to="/" replace />;
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
