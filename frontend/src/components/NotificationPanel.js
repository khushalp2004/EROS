import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';

const NotificationPanel = ({ isOpen, onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    dismissNotification, 
    markAllAsRead,
    isConnected 
  } = useNotifications();

  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'emergency', 'unit', 'system'
  const panelRef = useRef(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Safety check: Only show panel for authority users (after all hooks)
  const shouldShowPanel = isAuthenticated && user?.role === 'authority';
  
  if (!shouldShowPanel) {
    return null;
  }

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.is_read;
    if (filter === 'emergency') return notification.type === 'emergency';
    if (filter === 'unit') return notification.type === 'unit';
    if (filter === 'system') return notification.type === 'system';
    return true;
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'normal': return '#3b82f6';
      case 'low': return '#6b7280';
      default: return '#3b82f6';
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
    
    onClose();
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 999,
          animation: 'fadeIn 0.3s ease-out forwards'
        }}
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '400px',
          height: '100vh',
          backgroundColor: 'white',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out forwards'
        }}
      >
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f9fafb'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Notifications</h3>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
            {unreadCount} unread • 
            <span style={{ 
              color: isConnected ? '#10b981' : '#ef4444',
              fontWeight: '500'
            }}>
              {isConnected ? ' Connected' : ' Disconnected'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: 'Unread' },
          { key: 'emergency', label: 'Emergency' },
          { key: 'unit', label: 'Unit' },
          { key: 'system', label: 'System' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              flex: 1,
              padding: '12px 8px',
              fontSize: '14px',
              backgroundColor: filter === tab.key ? '#ffffff' : 'transparent',
              border: 'none',
              borderBottom: filter === tab.key ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              color: filter === tab.key ? '#1f2937' : '#6b7280'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '16px' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p>No notifications found</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f3f4f6',
                cursor: 'pointer',
                backgroundColor: notification.is_read ? 'white' : '#f0f9ff',
                borderLeft: `4px solid ${getPriorityColor(notification.priority)}`,
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = notification.is_read ? '#f9fafb' : '#e0f2fe';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = notification.is_read ? 'white' : '#f0f9ff';
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <h4 style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: notification.is_read ? '500' : '600',
                  color: '#1f2937',
                  flex: 1
                }}>
                  {notification.title}
                </h4>
                <span style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginLeft: '12px',
                  flexShrink: 0
                }}>
                  {formatTimeAgo(notification.created_at)}
                </span>
              </div>
              
              <p style={{
                margin: '0 0 8px 0',
                fontSize: '13px',
                color: '#4b5563',
                lineHeight: '1.4'
              }}>
                {notification.message}
              </p>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '4px',
                    color: '#374151',
                    textTransform: 'uppercase',
                    fontWeight: '500'
                  }}>
                    {notification.type}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    backgroundColor: getPriorityColor(notification.priority) + '20',
                    borderRadius: '4px',
                    color: getPriorityColor(notification.priority),
                    textTransform: 'uppercase',
                    fontWeight: '500'
                  }}>
                    {notification.priority}
                  </span>
                </div>
                
                {!notification.is_read && (
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#3b82f6',
                      borderRadius: '50%'
                    }}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </>
  );
};

export default NotificationPanel;
