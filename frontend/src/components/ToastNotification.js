import React, { useState } from 'react';

const ToastNotification = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose(toast.id);
    }, 300);
  };

  const getTypeStyles = (type) => {
    switch (type) {
      case 'error':
        return {
          backgroundColor: '#fef2f2',
          borderColor: '#fecaca',
          color: '#dc2626',
          icon: '❌'
        };
      case 'warning':
        return {
          backgroundColor: '#fffbeb',
          borderColor: '#fed7aa',
          color: '#d97706',
          icon: '⚠️'
        };
      case 'success':
        return {
          backgroundColor: '#f0fdf4',
          borderColor: '#bbf7d0',
          color: '#16a34a',
          icon: '✅'
        };
      default:
        return {
          backgroundColor: '#eff6ff',
          borderColor: '#bfdbfe',
          color: '#2563eb',
          icon: 'ℹ️'
        };
    }
  };

  const styles = getTypeStyles(toast.type);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        maxWidth: '400px',
        backgroundColor: styles.backgroundColor,
        border: `1px solid ${styles.borderColor}`,
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        zIndex: 9999,
        transform: isExiting ? 'translateX(100%)' : 'translateX(0)',
        transition: 'transform 0.3s ease-in-out',
        overflow: 'hidden'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '16px',
        gap: '12px'
      }}>
        {/* Icon */}
        <div style={{
          fontSize: '20px',
          lineHeight: '20px',
          marginTop: '2px'
        }}>
          {styles.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {toast.title && (
            <h4 style={{
              margin: '0 0 4px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: styles.color
            }}>
              {toast.title}
            </h4>
          )}
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: styles.color,
            lineHeight: '1.4'
          }}>
            {toast.message}
          </p>
          
          {toast.actionUrl && (
            <button
              onClick={() => window.location.href = toast.actionUrl}
              style={{
                marginTop: '8px',
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: 'transparent',
                border: `1px solid ${styles.borderColor}`,
                borderRadius: '4px',
                color: styles.color,
                cursor: 'pointer'
              }}
            >
              View Details
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            padding: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: styles.color,
            fontSize: '18px',
            lineHeight: '1',
            marginTop: '-4px'
          }}
        >
          ×
        </button>
      </div>

      {/* Progress Bar for Auto-dismiss */}
      {toast.duration > 0 && (
        <div
          style={{
            height: '3px',
            backgroundColor: styles.color,
            animation: `toastProgress ${toast.duration}ms linear forwards`
          }}
        />
      )}
    </div>
  );
};

// Global toast manager
class ToastManager {
  constructor() {
    this.toasts = [];
    this.listeners = [];
  }

  addToast(toast) {
    const id = Date.now() + Math.random();
    const newToast = { ...toast, id };
    this.toasts = [newToast, ...this.toasts];
    this.notifyListeners();
    
    // Auto remove after duration
    if (toast.duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, toast.duration);
    }
    
    return id;
  }

  removeToast(id) {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.toasts));
  }
}

// Create global toast manager
export const toastManager = new ToastManager();

// Toast component that renders all active toasts
export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  React.useEffect(() => {
    return toastManager.subscribe(setToasts);
  }, []);

  const handleClose = (id) => {
    toastManager.removeToast(id);
  };

  return (
    <>
      {toasts.map(toast => (
        <ToastNotification
          key={toast.id}
          toast={toast}
          onClose={handleClose}
        />
      ))}
      <style jsx>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
};

// Utility functions for creating different types of toasts
export const showToast = (message, type = 'info', options = {}) => {
  return toastManager.addToast({
    message,
    type,
    duration: options.duration || 5000,
    title: options.title,
    actionUrl: options.actionUrl
  });
};

export const showErrorToast = (message, options = {}) => {
  return showToast(message, 'error', { duration: 0, ...options }); // Errors don't auto-dismiss
};

export const showSuccessToast = (message, options = {}) => {
  return showToast(message, 'success', { duration: 3000, ...options });
};

export const showWarningToast = (message, options = {}) => {
  return showToast(message, 'warning', { duration: 5000, ...options });
};

export default ToastNotification;
