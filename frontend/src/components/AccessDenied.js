import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function AccessDenied({ requiredRole = 'authority', showLogin = true }) {
  const { user, logout } = useAuth();

  const getMessage = () => {
    if (!user) {
      return {
        title: 'Authentication Required',
        message: 'Please log in to access this page.',
        icon: '🔐',
        actionText: 'Login',
        actionUrl: '/'
      };
    }

    switch (requiredRole) {
      case 'authority':
        return {
          title: 'Authority Access Required',
          message: 'This page requires authority-level permissions. Authority users can access unit tracking and dashboard features.',
          icon: '👮',
          actionText: 'Go to Dashboard',
          actionUrl: '/dashboard'
        };
      case 'admin':
        return {
          title: 'Admin Access Required',
          message: 'This page requires administrator permissions. Only admin users can access administrative functions.',
          icon: '🛡️',
          actionText: 'Go to Admin Dashboard',
          actionUrl: '/admin'
        };
      default:
        return {
          title: 'Insufficient Permissions',
          message: 'You do not have the required permissions to access this page.',
          icon: '❌',
          actionText: 'Go Home',
          actionUrl: '/'
        };
    }
  };

  const { title, message, icon, actionText, actionUrl } = getMessage();

  const handleAction = () => {
    if (actionUrl === '/' && !user) {
      // If user is not logged in and trying to access protected route, trigger login modal
      window.showToast({
        message: 'Please use the login button above to authenticate',
        type: 'info'
      });
    } else {
      window.location.href = actionUrl;
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      padding: 'var(--space-6)'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--gray-200)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-8)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: 'var(--space-4)',
          opacity: 0.8
        }}>
          {icon}
        </div>
        
        <h1 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-3)',
          lineHeight: 1.2
        }}>
          {title}
        </h1>
        
        <p style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-6)',
          lineHeight: 1.5
        }}>
          {message}
        </p>

        {user && (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--gray-300)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
            textAlign: 'left'
          }}>
            <h4 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Current User Info
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                <div style={{ fontWeight: 'var(--font-medium)', color: 'var(--text-primary)' }}>
                  {user.email}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Role:</span>
                <div style={{ 
                  fontWeight: 'var(--font-medium)', 
                  color: user.role === 'admin' ? 'var(--primary-red)' : 
                         user.role === 'authority' ? 'var(--primary-blue)' : 
                         'var(--text-secondary)',
                  textTransform: 'capitalize'
                }}>
                  {user.role}
                </div>
              </div>
              {user.first_name && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Name:</span>
                  <div style={{ fontWeight: 'var(--font-medium)', color: 'var(--text-primary)' }}>
                    {user.first_name} {user.last_name || ''}
                  </div>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <div style={{ 
                  fontWeight: 'var(--font-medium)', 
                  color: user.is_approved ? 'var(--success-green)' : 'var(--warning-orange)'
                }}>
                  {user.is_approved ? 'Approved' : 'Pending Approval'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div style={{
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleAction}
            style={{
              backgroundColor: 'var(--primary-blue)',
              color: 'var(--text-inverse)',
              border: 'none',
              padding: 'var(--space-3) var(--space-6)',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-medium)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--primary-blue-dark)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'var(--primary-blue)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {actionText}
          </button>
          
          {user && (
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--gray-300)',
                padding: 'var(--space-3) var(--space-6)',
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-medium)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'var(--gray-100)';
                e.target.style.borderColor = 'var(--gray-400)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.borderColor = 'var(--gray-300)';
              }}
            >
              🚪 Logout
            </button>
          )}
        </div>
        
        <div style={{
          marginTop: 'var(--space-6)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--gray-200)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)'
        }}>
          <p>
            Need help? Contact your system administrator or check your user permissions.
          </p>
        </div>
      </div>
    </div>
  );
}
