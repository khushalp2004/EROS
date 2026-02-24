import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../api';
import '../styles/signup-modal.css';
import '../styles/pending-approval.css';

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, logout, clearPendingApproval } = useAuth();
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [isRejected, setIsRejected] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [needsRelogin, setNeedsRelogin] = useState(false);
  const [requestingAgain, setRequestingAgain] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (user?.created_at) {
      const createdDate = new Date(user.created_at);
      setTimeElapsed(Math.floor((new Date() - createdDate) / 1000));
    }
  }, [user]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const checkApprovalStatus = async () => {
    if (checkingStatus) return;

    // Auth context hydrates user asynchronously from localStorage.
    // Do not mark session expired until user has been loaded.
    if (!user) {
      return;
    }

    if (!user.email) {
      setAutoCheckEnabled(false);
      setNeedsRelogin(true);
      setStatusMessage('Session email is missing. Please log in again.');
      return;
    }

    setCheckingStatus(true);
    setLastCheckTime(new Date());

    try {
      const response = await authAPI.checkApprovalStatus(user.email, user.pending_token || null);
      const data = response.data || {};

      if (data.success && data.approved && data.verified && !data.rejected) {
        setAutoCheckEnabled(false);
        setIsRejected(false);
        setNeedsRelogin(false);
        setIsApproved(true);
        setStatusMessage(data.message || 'Your account has been approved. You can login now.');
        if (window.showSuccessToast) {
          window.showSuccessToast('Approved. You can login now.');
        }
        return;
      }

      if (data.success && data.rejected) {
        setAutoCheckEnabled(false);
        setIsApproved(false);
        setNeedsRelogin(false);
        setIsRejected(true);
        setStatusMessage(data.message || 'Your account request was rejected by administrator.');
      }
    } catch (error) {
      console.error('Error checking approval status:', error);
      const backendMessage = error?.response?.data?.message;
      if (error?.response?.status === 401 && user?.pending_token) {
        try {
          const retryResponse = await authAPI.checkApprovalStatus(user.email, null);
          const retryData = retryResponse.data || {};
          if (retryData.success && retryData.approved && retryData.verified && !retryData.rejected) {
            setAutoCheckEnabled(false);
            setIsRejected(false);
            setNeedsRelogin(false);
            setIsApproved(true);
            setStatusMessage(retryData.message || 'Your account has been approved. You can login now.');
            return;
          }
          if (retryData.success && retryData.rejected) {
            setAutoCheckEnabled(false);
            setIsApproved(false);
            setNeedsRelogin(false);
            setIsRejected(true);
            setStatusMessage(retryData.message || 'Your account request was rejected by administrator.');
            return;
          }
        } catch (retryError) {
          const retryMessage = retryError?.response?.data?.message;
          setAutoCheckEnabled(false);
          setNeedsRelogin(true);
          setStatusMessage(retryMessage || backendMessage || 'Session expired. Please log in again.');
          return;
        }
      } else if (error?.response?.status === 401) {
        setAutoCheckEnabled(false);
        setNeedsRelogin(true);
      }
      if (backendMessage) {
        setStatusMessage(backendMessage);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (!autoCheckEnabled) return;
    if (!user) return;

    checkApprovalStatus();

    const interval = setInterval(() => {
      checkApprovalStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, user?.email, user?.pending_token, autoCheckEnabled]);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const handleGoToLogin = () => {
    clearPendingApproval();
    navigate('/', { replace: true });
  };

  const handleSupportClick = () => {
    if (window.showToast) {
      window.showToast({
        message: 'Contact your administrator or system support for assistance.',
        type: 'info',
        duration: 8000
      });
    }
  };

  const handleRequestAgain = async () => {
    if (!user?.email || requestingAgain) return;
    try {
      setRequestingAgain(true);
      const response = await authAPI.requestApprovalAgain(user.email);
      const data = response.data || {};
      if (data.success) {
        setIsRejected(false);
        setNeedsRelogin(false);
        setIsApproved(false);
        setAutoCheckEnabled(true);
        setStatusMessage(data.message || 'Request submitted again. Please wait for admin approval.');
        if (window.showSuccessToast) {
          window.showSuccessToast('Request submitted again.');
        }
      } else {
        setStatusMessage(data.message || 'Failed to request approval again.');
      }
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      setStatusMessage(backendMessage || 'Failed to request approval again.');
    } finally {
      setRequestingAgain(false);
    }
  };

  const statusType = isApproved ? 'success' : isRejected || needsRelogin ? 'error' : checkingStatus ? 'info' : 'warning';
  const statusTitle = needsRelogin
    ? 'Session Expired'
    : isApproved
    ? 'Approved'
    : isRejected
    ? 'Request Rejected'
    : checkingStatus
    ? 'Checking Approval Status...'
    : 'Waiting For Approval';
  const statusText = needsRelogin
    ? (statusMessage || 'Pending approval session expired. Please log in again.')
    : isApproved
    ? (statusMessage || 'Your account has been approved. You can login now.')
    : isRejected
    ? (statusMessage || 'Your account request was rejected by administrator. Please contact support.')
    : checkingStatus
    ? `Last checked: ${lastCheckTime ? lastCheckTime.toLocaleTimeString() : 'Just now'}`
    : (statusMessage || `Time waiting: ${formatTime(timeElapsed)}`);
  const roleLabel = user?.role
    ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`
    : 'User';

  if (!user) {
    return (
      <div className="pending-approval-page">
        <div className="signup-modal-card pending-approval-card">
          <div className="signup-modal-alert info center">Loading your information...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pending-approval-page">
      <div className="signup-modal-card pending-approval-card" role="region" aria-labelledby="pending-approval-title">
        <div className="signup-modal-head">
          <h2 id="pending-approval-title" className="signup-modal-title">
            <span className="signup-modal-title-icon" aria-hidden="true">⏳</span>
            Account Pending Approval
          </h2>
          <p className="signup-modal-subtitle">
            Your email is verified and your registration is complete. An administrator must approve your account before access is granted.
          </p>
        </div>

        <div className={`signup-modal-alert ${statusType}`}>
          <h3 className="signup-modal-block-title pending-approval-status-title">{statusTitle}</h3>
          <p className="signup-modal-block-text">{statusText}</p>
        </div>

        <div className="signup-modal-resend-box">
          <h4 className="signup-modal-resend-title">Account Information</h4>
          <div className="pending-approval-info-grid">
            <div><strong>Email:</strong> {user.email}</div>
            {(user.first_name || user.last_name) && (
              <div><strong>Name:</strong> {[user.first_name, user.last_name].filter(Boolean).join(' ')}</div>
            )}
            <div><strong>Role:</strong> {roleLabel}</div>
            <div><strong>Registered:</strong> {new Date(user.created_at).toLocaleDateString()}</div>
          </div>
          <div className="pending-approval-status-chip-wrap">
            <span className={`pending-approval-status-chip ${
              needsRelogin ? 'relogin' : isApproved ? 'approved' : isRejected ? 'rejected' : checkingStatus ? 'checking' : 'pending'
            }`}>
              {needsRelogin ? 'Login Required' : isApproved ? 'Approved' : isRejected ? 'Rejected' : checkingStatus ? 'Checking...' : 'Pending Approval'}
            </span>
          </div>
        </div>

        <div className="signup-modal-instructions">
          <h4 className="signup-modal-instructions-title">What Happens Next</h4>
          <ul>
            <li>The administration team reviews your account details.</li>
            <li>You receive an email once the approval decision is made.</li>
            <li>This page checks automatically every 30 seconds.</li>
            <li>After approval, click "Go To Login" and sign in.</li>
          </ul>
        </div>

        <div className="signup-modal-actions pending-approval-actions">
          <button
            type="button"
            onClick={checkApprovalStatus}
            disabled={checkingStatus || isRejected || isApproved || needsRelogin}
            className="signup-modal-btn primary"
          >
            {checkingStatus ? 'Checking...' : isApproved ? 'Already Approved' : 'Check Now'}
          </button>
          {isApproved || needsRelogin ? (
            <button
              type="button"
              onClick={handleGoToLogin}
              className="signup-modal-btn secondary"
            >
              Go To Login
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="signup-modal-btn secondary"
            >
              Logout
            </button>
          )}
        </div>

        {isRejected && (
          <button
            type="button"
            onClick={handleRequestAgain}
            disabled={requestingAgain}
            className="signup-modal-btn primary full pending-approval-support-btn"
          >
            {requestingAgain ? 'Submitting...' : 'Request Again'}
          </button>
        )}

        <button
          type="button"
          onClick={handleSupportClick}
          className="signup-modal-btn secondary full pending-approval-support-btn"
        >
          Contact Support
        </button>

        <p className="signup-modal-note pending-approval-footer-note">
          Keep this page open and use "Check Now" anytime to refresh approval status.
        </p>
      </div>
    </div>
  );
}
