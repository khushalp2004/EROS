import React from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';

const NotificationBadge = ({ className = '', showText = false, onClick }) => {
  const { unreadCount, isConnected } = useNotifications();
  const { user, isAuthenticated } = useAuth();

  // Role-based visibility: Show for admin and authority users
  // Reporter users should not see any notification bell
  const shouldShowBadge = isAuthenticated && (user?.role === 'admin' || user?.role === 'authority');

  // Don't render anything for reporter users
  if (!shouldShowBadge) {
    return null;
  }

  return (
    <div 
      className={`notification-badge ${className}`}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '50%',
        backgroundColor: '#f3f4f6',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#e5e7eb';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#f3f4f6';
      }}
    >
      {/* Bell Icon */}
      <svg 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={{ color: '#374151' }}
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {/* Connection Status Indicator */}
      <div 
        style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: isConnected ? '#10b981' : '#ef4444',
          border: '2px solid white'
        }}
        title={isConnected ? 'Connected' : 'Disconnected'}
      />

      {/* Unread Count Badge */}
      {unreadCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            minWidth: '20px'
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      )}

      {/* Optional text */}
      {showText && (
        <span style={{ marginLeft: '8px', fontSize: '14px', color: '#374151' }}>
          Notifications ({unreadCount})
        </span>
      )}
    </div>
  );
};

export default NotificationBadge;
