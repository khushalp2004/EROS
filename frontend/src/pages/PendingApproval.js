
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function PendingApproval() {
  const { user, logout, login } = useAuth();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [checkingInterval, setCheckingInterval] = useState(null);

  // Calculate time elapsed since registration
  useEffect(() => {
    if (user && user.created_at) {
      const createdDate = new Date(user.created_at);
      setTimeElapsed(Math.floor((new Date() - createdDate) / 1000));
    }
  }, [user]);

  // Format time elapsed
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Auto-refresh time elapsed
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check approval status periodically
  const checkApprovalStatus = async () => {
    if (!user?.email || checkingStatus) return;

    setCheckingStatus(true);
    setLastCheckTime(new Date());

    try {
      const response = await fetch('/api/auth/check-approval-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: user.email })
      });

      const data = await response.json();

      if (data.success && data.approved && data.verified) {
        // User has been approved! Auto-login and redirect
        setAutoCheckEnabled(false);
        
        // Clear any existing intervals
        if (checkingInterval) {
          clearInterval(checkingInterval);
          setCheckingInterval(null);
        }
        
        // Show success message
        if (window.showSuccessToast) {
          window.showSuccessToast('Congratulations! Your account has been approved. Redirecting to dashboard...');
        }

        // Small delay for user feedback, then redirect
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
        
        return;
      }

      if (data.success && data.approved && !data.verified) {
        // User approved but not verified - this shouldn't happen but handle it
        console.log('User approved but not verified - possible data inconsistency');
      }

    } catch (error) {
      console.error('Error checking approval status:', error);
      // Don't show error to user for status checks - silent failure
    } finally {
      setCheckingStatus(false);
    }
  };

  // Auto-check approval status every 30 seconds
  useEffect(() => {
    if (!autoCheckEnabled) return;

    // Check immediately on mount
    checkApprovalStatus();

    // Set up periodic checks
    const interval = setInterval(() => {
      checkApprovalStatus();
    }, 30000); // Check every 30 seconds

    setCheckingInterval(interval);

    return () => {
      clearInterval(interval);
    };
  }, [user?.email, autoCheckEnabled]);

  const handleManualRefresh = () => {
    checkApprovalStatus();
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const handleSupportClick = () => {
    if (window.showToast) {
      window.showToast({
        message: "Contact your administrator or system support for assistance.",
        type: "info",
        duration: 8000
      });
    }
  };

  if (!user) {
    return (
      <div className="min-vh-100" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-12 text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3">Loading your information...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-8)',
        maxWidth: '600px',
        width: '100%',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--gray-200)',
        textAlign: 'center'
      }}>
        {/* Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto var(--space-6)',
          backgroundColor: 'var(--warning-bg)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--text-3xl)',
          position: 'relative'
        }}>
          ⏳
          {checkingStatus && (
            <div style={{
              position: 'absolute',
              top: -5,
              right: -5,
              width: '20px',
              height: '20px',
              backgroundColor: 'var(--success-bg)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              animation: 'pulse 1.5s infinite'
            }}>
              ✓
            </div>
          )}
        </div>

        {/* Title */}
        <h1 style={{
          margin: '0 0 var(--space-4) 0',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--text-primary)',
          lineHeight: '1.2'
        }}>
          Account Pending Approval
        </h1>

        {/* Dynamic Status Indicator */}
        <div style={{
          backgroundColor: checkingStatus ? 'var(--info-bg)' : 'var(--warning-bg)',
          border: `1px solid ${checkingStatus ? 'var(--info-border)' : 'var(--warning-border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          textAlign: 'left'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)'
          }}>
            <span style={{ fontSize: 'var(--text-base)' }}>
              {checkingStatus ? '🔄' : '⏳'}
            </span>
            <h3 style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: checkingStatus ? 'var(--info-text)' : 'var(--warning-text)'
            }}>
              {checkingStatus ? 'Checking approval status...' : 'Waiting for approval'}
            </h3>
          </div>
          <p style={{
            margin: 'var(--space-2) 0 0 0',
            fontSize: 'var(--text-sm)',
            color: checkingStatus ? 'var(--info-text)' : 'var(--warning-text)',
            lineHeight: '1.5'
          }}>
            {checkingStatus 
              ? `Last checked: ${lastCheckTime ? lastCheckTime.toLocaleTimeString() : 'Just now'}`
              : `Time waiting: ${formatTime(timeElapsed)}`
            }
          </p>
        </div>

        {/* Description */}
        <p style={{
          margin: '0 0 var(--space-6) 0',
          fontSize: 'var(--text-base)',
          color: 'var(--text-secondary)',
          lineHeight: '1.6'
        }}>
          Thank you for registering with EROS. Your account has been successfully created and your email has been verified. 
          However, your account is currently pending approval from our administration team.
        </p>

        {/* User Info */}
        {user && (
          <div style={{
            backgroundColor: 'var(--info-bg)',
            border: '1px solid var(--info-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
            textAlign: 'left'
          }}>
            <h3 style={{
              margin: '0 0 var(--space-3) 0',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--info-text)'
            }}>
              Account Information
            </h3>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--info-text)',
              lineHeight: '1.5'
            }}>
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <strong>Email:</strong> {user.email}
              </div>
              {user.first_name && user.last_name && (
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>Name:</strong> {user.first_name} {user.last_name}
                </div>
              )}
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <strong>Role:</strong> {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </div>
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <strong>Status:</strong> 
                <span style={{
                  display: 'inline-block',
                  marginLeft: 'var(--space-2)',
                  padding: '2px 8px',
                  backgroundColor: checkingStatus ? 'var(--success-bg)' : 'var(--warning-bg)',
                  color: checkingStatus ? 'var(--success-text)' : 'var(--warning-text)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-medium)'
                }}>
                  {checkingStatus ? 'Checking...' : 'Pending Approval'}
                </span>
              </div>
              <div>
                <strong>Registration Date:</strong> {new Date(user.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        {/* Important Notes */}
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--gray-300)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          textAlign: 'left'
        }}>
          <h3 style={{
            margin: '0 0 var(--space-3) 0',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}>
            <span style={{ fontSize: 'var(--text-base)' }}>ℹ️</span>
            What happens next?
          </h3>
          <ul style={{
            margin: 0,
            paddingLeft: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            lineHeight: '1.5'
          }}>
            <li style={{ marginBottom: 'var(--space-2)' }}>
              Our administration team will review your account details
            </li>
            <li style={{ marginBottom: 'var(--space-2)' }}>
              You will receive an email notification once your account is approved
            </li>
            <li style={{ marginBottom: 'var(--space-2)' }}>
              The approval process typically takes 1-2 business days
            </li>
            <li style={{ marginBottom: 'var(--space-2)' }}>
              <strong>Auto-refresh:</strong> This page automatically checks for approval every 30 seconds
            </li>
            <li>
              Once approved, you will be automatically logged in and redirected to the dashboard
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          alignItems: 'center'
        }}>
          <button
            onClick={handleManualRefresh}
            disabled={checkingStatus}
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: checkingStatus ? 'var(--gray-300)' : 'var(--primary-blue)',
              color: checkingStatus ? 'var(--text-muted)' : 'var(--text-inverse)',
              border: `1px solid ${checkingStatus ? 'var(--gray-300)' : 'var(--primary-blue)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              cursor: checkingStatus ? 'not-allowed' : 'pointer',
              transition: 'all var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)'
            }}
            onMouseOver={(e) => {
              if (!checkingStatus) {
                e.target.style.backgroundColor = 'var(--primary-blue-dark)';
                e.target.style.borderColor = 'var(--primary-blue-dark)';
              }
            }}
            onMouseOut={(e) => {
              if (!checkingStatus) {
                e.target.style.backgroundColor = 'var(--primary-blue)';
                e.target.style.borderColor = 'var(--primary-blue)';
              }
            }}
          >
            {checkingStatus ? (
              <>
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Checking...</span>
                </div>
                Checking...
              </>
            ) : (
              <>
                🔄 Check Now
              </>
            )}
          </button>

          <button
            onClick={handleSupportClick}
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--info-bg)',
              color: 'var(--info-text)',
              border: '1px solid var(--info-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = 'var(--info-border)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'var(--info-bg)';
            }}
          >
            Contact Support
          </button>

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = 'var(--gray-100)';
              e.target.style.borderColor = 'var(--gray-400)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.borderColor = 'var(--gray-300)';
            }}
          >
            Logout
          </button>
        </div>

        {/* Footer Note */}
        <div style={{
          marginTop: 'var(--space-6)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--gray-200)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          lineHeight: '1.4'
        }}>
          <p style={{ margin: 0 }}>
            <strong>EROS</strong> - Emergency Response Operations System
          </p>
          <p style={{ margin: 'var(--space-1) 0 0 0' }}>
            This page will automatically redirect you when approved. Keep it open in the background.
          </p>
        </div>
      </div>
    </div>
  );
}

