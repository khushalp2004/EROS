import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AuthorityProtectedRoute({ children }) {
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
        <span>Verifying authority access...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login for unauthenticated users
    return <Navigate to="/" replace />;
  }

  // Check if user has authority role
  if (user?.role !== 'authority') {
    // User is authenticated but doesn't have authority role
    if (user?.role === 'admin') {
      // Admin users should go to admin dashboard
      return <Navigate to="/admin" replace />;
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
