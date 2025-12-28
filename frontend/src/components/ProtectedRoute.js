import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AccessDenied from './AccessDenied';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { isAuthenticated, user, loading } = useAuth();

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
        <span>Verifying authentication...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // If a specific role is required, check it
  if (requiredRole && user?.role !== requiredRole) {
    return <AccessDenied requiredRole={requiredRole} />;
  }

  return children;
}
