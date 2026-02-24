import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import SignupModal from './SignupModal';

// Enhanced Navigation with improved UX for emergency response scenarios
export default function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState('online');
  const [activeEmergencies, setActiveEmergencies] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Enhanced system status monitoring with better error handling
  const checkSystemStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate API call with better error handling
      await new Promise(resolve => setTimeout(resolve, 500));
      const status = Math.random() > 0.1 ? 'online' : 'warning';
      setSystemStatus(status);
      
      // Simulate active emergencies count
      const emergencyCount = Math.floor(Math.random() * 5);
      setActiveEmergencies(emergencyCount);
    } catch (error) {
      console.warn('System status check failed:', error);
      setSystemStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 30000);
    return () => clearInterval(interval);
  }, [checkSystemStatus]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      if (window.showSuccessToast) {
        window.showSuccessToast("Logged out successfully");
      }
    }
  };

  const handleKeyDown = (event) => {
    // Enhanced keyboard navigation
    const navigationItems = document.querySelectorAll('[role="menuitem"]');
    const currentIndex = Array.from(navigationItems).indexOf(event.target);
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex((currentIndex + 1) % navigationItems.length);
        navigationItems[(currentIndex + 1) % navigationItems.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(currentIndex === 0 ? navigationItems.length - 1 : currentIndex - 1);
        navigationItems[currentIndex === 0 ? navigationItems.length - 1 : currentIndex - 1]?.focus();
        break;
      case 'Escape':
        setMobileMenuOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  // Enhanced System Status Indicator with loading states
  const SystemStatusIndicator = () => (
    <div 
      className="system-status-indicator"
      role="status"
      aria-live="polite"
      aria-label={`System status: ${systemStatus}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: 
          systemStatus === 'online' ? '#10B981' : 
          systemStatus === 'warning' ? '#F59E0B' : 
          '#EF4444',
        color: 'white',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
        minHeight: '44px', // Touch-friendly
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      {isLoading ? (
        <div 
          className="spinner"
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid transparent',
            borderTop: '2px solid currentColor',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
      ) : (
        <div 
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            animation: systemStatus === 'online' ? 'pulse 2s infinite' : 'none'
          }}
        />
      )}
      <span>
        {isLoading ? 'CHECKING...' : 
         systemStatus === 'online' ? 'ONLINE' : 
         systemStatus === 'warning' ? 'WARNING' : 
         'ERROR'}
      </span>
    </div>
  );

  // Enhanced Emergency Counter with better visual hierarchy
  const ActiveEmergenciesCounter = () => (
    <div 
      className="emergency-counter"
      role="status"
      aria-live="polite"
      aria-label={`${activeEmergencies} active emergencies`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: activeEmergencies > 0 ? '#EF4444' : '#6B7280',
        color: 'white',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '700',
        minHeight: '44px',
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        animation: activeEmergencies > 0 ? 'pulse 1.5s infinite' : 'none'
      }}
    >
      <span style={{ fontSize: '14px' }}>🚨</span>
      <span>{activeEmergencies} ACTIVE</span>
    </div>
  );

  // Enhanced Navigation Item with better accessibility and animations
  const EmergencyNavItem = ({ to, children, isActive, priority = 'normal', onClick, ...props }) => {
    const baseStyles = {
      textDecoration: 'none',
      fontWeight: priority === 'critical' ? '700' : '600',
      padding: '12px 16px',
      borderRadius: '12px',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '14px',
      minHeight: '44px', // Touch-friendly
      border: '2px solid transparent',
      outline: 'none',
      cursor: 'pointer'
    };

    const activeStyles = isActive ? {
      backgroundColor: '#DC2626', // Emergency red
      color: 'white',
      borderColor: '#DC2626',
      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
      transform: 'translateY(-1px)'
    } : {
      color: '#6B7280',
      backgroundColor: 'transparent',
      borderColor: 'transparent'
    };

    const hoverStyles = {
      backgroundColor: isActive ? '#B91C1C' : '#F3F4F6',
      color: isActive ? 'white' : '#374151',
      transform: 'translateY(-1px)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    };

    return (
      <Link
        to={to}
        role="menuitem"
        style={{ ...baseStyles, ...activeStyles }}
        onMouseEnter={(e) => {
          if (!isActive) Object.assign(e.target.style, hoverStyles);
        }}
        onMouseLeave={(e) => {
          if (!isActive) Object.assign(e.target.style, activeStyles);
        }}
        onFocus={(e) => {
          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)';
          e.target.style.transform = 'translateY(-1px)';
        }}
        onBlur={(e) => {
          e.target.style.boxShadow = isActive ? '0 4px 12px rgba(220, 38, 38, 0.3)' : 'none';
          e.target.style.transform = isActive ? 'translateY(-1px)' : 'translateY(0)';
        }}
        tabIndex={0}
        onClick={() => setMobileMenuOpen(false)}
        {...props}
      >
        {children}
      </Link>
    );
  };

  // Emergency Quick Action Button
  const EmergencyQuickAction = () => (
    <button
      className="emergency-quick-action"
      onClick={() => window.location.href = '/'}
      style={{
        backgroundColor: '#DC2626',
        color: 'white',
        fontWeight: '700',
        padding: '12px 20px',
        borderRadius: '12px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        minHeight: '44px',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
        animation: 'pulse 2s infinite'
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = '#B91C1C';
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = '#DC2626';
        e.target.style.transform = 'translateY(0)';
        e.target.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
      }}
      aria-label="Quick Emergency Reporting"
    >
      <span>🚨</span>
      <span>EMERGENCY</span>
    </button>
  );

  return (
    <>
      {/* Enhanced Navigation Container */}
      <nav 
        className="enhanced-navigation"
        role="navigation"
        aria-label="Main navigation"
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 24px',
          backgroundColor: 'white',
          borderBottom: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          position: 'relative'
        }}
      >
        {/* Left Section - Core Navigation */}
        <div 
          className="nav-left"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flex: '1'
          }}
        >
          {/* Emergency Quick Action - Always Visible */}
          <EmergencyQuickAction />

          {/* Authority-specific Navigation */}
          {isAuthenticated && user?.role === 'authority' && (
            <div 
              className="authority-nav"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginLeft: '16px'
              }}
            >
              <EmergencyNavItem 
                to="/dashboard" 
                isActive={location.pathname === '/dashboard'}
                priority="critical"
              >
                📊 Dashboard
              </EmergencyNavItem>
              <EmergencyNavItem 
                to="/units-tracking" 
                isActive={location.pathname === '/units-tracking'}
                priority="critical"
              >
                📍 Units Tracking
              </EmergencyNavItem>
            </div>
          )}
        </div>

        {/* Center Section - System Status (Authority users) */}
        {isAuthenticated && user?.role === 'authority' && (
          <div 
            className="nav-center"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flex: '1',
              justifyContent: 'center'
            }}
          >
            <SystemStatusIndicator />
            <ActiveEmergenciesCounter />
          </div>
        )}

        {/* Right Section - User Actions */}
        <div 
          className="nav-right"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flex: '1',
            justifyContent: 'flex-end'
          }}
        >
          {/* Admin Access */}
          {isAuthenticated && user?.role === 'admin' && (
            <>
              <EmergencyNavItem 
                to="/admin" 
                isActive={location.pathname === '/admin'}
                priority="critical"
              >
                🛡️ Admin
              </EmergencyNavItem>
              <EmergencyNavItem 
                to="/admin/traffic" 
                isActive={location.pathname === '/admin/traffic'}
                priority="critical"
              >
                🚦 Traffic
              </EmergencyNavItem>
            </>
          )}

          {/* User Info & Logout */}
          {isAuthenticated ? (
            <div 
              className="user-info"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: '#DC2626',
                color: 'white',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                minHeight: '44px'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>👤</span>
                <span>{user?.name || 'User'}</span>
                <span 
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'white',
                    color: '#DC2626',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  {user?.role || 'user'}
                </span>
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  opacity: 0.9,
                  transition: 'opacity 0.2s ease',
                  fontWeight: '500',
                  minHeight: '32px'
                }}
                onMouseEnter={(e) => e.target.style.opacity = 1}
                onMouseLeave={(e) => e.target.style.opacity = 0.9}
                title="Logout from EROS"
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
          ) : (
            /* Authentication Buttons */
            <div 
              className="auth-buttons"
              style={{ display: 'flex', gap: '12px' }}
            >
              <button
                onClick={() => setSignupModalOpen(true)}
                style={{
                  backgroundColor: '#10B981',
                  color: 'white',
                  fontWeight: '600',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#059669';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#10B981';
                  e.target.style.transform = 'translateY(0)';
                }}
                aria-label="Admin Signup"
              >
                👤 Admin Signup
              </button>
              <button
                onClick={() => setLoginModalOpen(true)}
                style={{
                  backgroundColor: '#DC2626',
                  color: 'white',
                  fontWeight: '700',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#B91C1C';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#DC2626';
                  e.target.style.transform = 'translateY(0)';
                }}
                aria-label="Admin Login"
              >
                🔐 Admin Login
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Enhanced Modals */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSwitchToSignup={() => {
          setLoginModalOpen(false);
          setSignupModalOpen(true);
        }}
      />

      <SignupModal
        isOpen={signupModalOpen}
        onClose={() => setSignupModalOpen(false)}
        onSwitchToLogin={() => {
          setSignupModalOpen(false);
          setLoginModalOpen(true);
        }}
      />

      {/* Enhanced CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        /* Focus management for accessibility */
        .enhanced-navigation [role="menuitem"]:focus {
          outline: 3px solid #3B82F6;
          outline-offset: 2px;
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .enhanced-navigation {
            flex-direction: column;
            padding: 12px 16px;
          }
          
          .nav-left, .nav-center, .nav-right {
            width: 100%;
            justify-content: center;
          }
          
          .authority-nav {
            margin-left: 0;
            margin-top: 8px;
          }
          
          .auth-buttons {
            flex-direction: column;
            width: 100%;
          }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .system-status-indicator,
          .emergency-counter,
          .emergency-quick-action {
            border: 2px solid currentColor;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .emergency-quick-action,
          .spinner,
          [role="menuitem"] {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </>
  );
}
