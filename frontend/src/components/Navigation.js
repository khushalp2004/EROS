import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import SignupModal from './SignupModal';

export default function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [signupModalOpen, setSignupModalOpen] = useState(false);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      // Optionally show a success message
      if (window.showSuccessToast) {
        window.showSuccessToast("Logged out successfully");
      }
    }
  };

  return (
    <>
      <nav style={{ 
        display: 'flex', 
        gap: 'var(--space-2)', 
        alignItems: 'center',
        backgroundColor: 'var(--gray-50)',
        padding: 'var(--space-2)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--gray-200)'
      }}>
        {/* Always show Reporter link */}
        <Link 
          to="/" 
          className="nav-link"
          style={{
            textDecoration: 'none',
            color: 'var(--text-secondary)',
            fontWeight: 'var(--font-medium)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            transition: 'all var(--transition-fast)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-sm)'
          }}
        >
          📝 Reporter
        </Link>

        {/* Conditional navigation based on authentication and role */}
        {isAuthenticated ? (
          <>
            {/* Dashboard and Units Tracking - only for authority users */}
            {user?.role === 'authority' && (
              <>
                <Link 
                  to="/dashboard" 
                  className="nav-link"
                  style={{
                    textDecoration: 'none',
                    color: 'var(--text-secondary)',
                    fontWeight: 'var(--font-medium)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-sm)'
                  }}
                >
                  📊 Dashboard
                </Link>
                <Link 
                  to="/units-tracking" 
                  className="nav-link"
                  style={{
                    textDecoration: 'none',
                    color: 'var(--text-secondary)',
                    fontWeight: 'var(--font-medium)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-sm)'
                  }}
                >
                  📍 Units Tracking
                </Link>
              </>
            )}
            
            {/* Admin link - only visible to admin users */}
            {user?.role === 'admin' && (
              <Link 
                to="/admin" 
                className="nav-link"
                style={{
                  textDecoration: 'none',
                  color: 'var(--primary-red)',
                  fontWeight: 'var(--font-bold)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '2px solid var(--primary-red)'
                }}
              >
                🛡️ Admin
              </Link>
            )}
            
            {/* User info and logout */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'var(--primary-blue)',
              color: 'var(--text-inverse)',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-medium)'
            }}>
              <span>👤 {user?.name || 'User'}</span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-inverse)',
                  cursor: 'pointer',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  opacity: 0.8,
                  transition: 'opacity var(--transition-fast)',
                  fontWeight: 'var(--font-medium)'
                }}
                onMouseEnter={(e) => e.target.style.opacity = 1}
                onMouseLeave={(e) => e.target.style.opacity = 0.8}
                title="Logout"
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          /* Show Admin Login and Signup when not authenticated */
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={() => setSignupModalOpen(true)}
              style={{
                textDecoration: 'none',
                backgroundColor: 'var(--success-green)',
                color: 'var(--text-inverse)',
                fontWeight: 'var(--font-medium)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              👤 Admin Signup
            </button>
            <button
              onClick={() => setLoginModalOpen(true)}
              style={{
                textDecoration: 'none',
                backgroundColor: 'var(--primary-blue)',
                color: 'var(--text-inverse)',
                fontWeight: 'var(--font-medium)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              🔐 Admin Login
            </button>
          </div>
        )}
      </nav>

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      {/* Signup Modal */}
      <SignupModal
        isOpen={signupModalOpen}
        onClose={() => setSignupModalOpen(false)}
      />
    </>
  );
}
