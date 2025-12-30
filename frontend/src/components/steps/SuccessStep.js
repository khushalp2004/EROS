import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

const EMERGENCY_TYPE_INFO = {
  'Ambulance': {
    icon: '🚑',
    color: 'var(--accent-red)',
    responseTeam: 'Medical Team',
    estimatedArrival: '8-12 minutes'
  },
  'Fire': {
    icon: '🔥',
    color: 'var(--accent-orange)',
    responseTeam: 'Fire Department',
    estimatedArrival: '6-10 minutes'
  },
  'Police': {
    icon: '🚓',
    color: 'var(--primary-blue)',
    responseTeam: 'Police Department',
    estimatedArrival: '5-15 minutes'
  }
};

function SuccessStep({ data, onStartNew, onClose }) {
  const { user } = useAuth();
  const [isAnimated, setIsAnimated] = useState(false);
  const [confirmationCallTimer, setConfirmationCallTimer] = useState(120); // 2 minutes
  const [emergencyId] = useState(() => `ER${Date.now().toString().slice(-6)}`);

  const emergencyInfo = EMERGENCY_TYPE_INFO[data.emergencyType] || {};
  const isReporter = !user || user.role === 'reporter';

  useEffect(() => {
    // Start success animation
    setIsAnimated(true);

    // Start confirmation call countdown
    const timer = setInterval(() => {
      setConfirmationCallTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLocation = (location) => {
    if (!location) return 'Not specified';
    return `${location[0].toFixed(6)}, ${location[1].toFixed(6)}`;
  };

  const handleStartNewReport = () => {
    onStartNew();
  };

  const handleGoHome = () => {
    onClose();
  };

  return (
    <div className={`success-step ${isAnimated ? 'animated' : ''}`}>
      <div className="success-container">
        {/* Success Animation */}
        <div className="success-animation">
          <div className="success-icon">
            <div className="checkmark">✓</div>
          </div>
          <h1 className="success-title">Emergency Reported Successfully!</h1>
          <p className="success-subtitle">
            Your emergency has been received and the response team has been dispatched
          </p>
        </div>

        {/* Emergency Details Card */}
        <div className="success-details">
          <div className="detail-header">
            <h3 className="detail-title">📋 Emergency Details</h3>
            <div className="emergency-id">Report ID: {emergencyId}</div>
          </div>

          <div className="detail-grid">
            <div className="detail-card">
              <div className="card-icon" style={{ color: emergencyInfo.color }}>
                {emergencyInfo.icon}
              </div>
              <div className="card-content">
                <div className="card-label">Emergency Type</div>
                <div className="card-value">{data.emergencyType}</div>
                <div className="card-description">
                  {emergencyInfo.responseTeam} • {emergencyInfo.estimatedArrival}
                </div>
              </div>
            </div>

            <div className="detail-card">
              <div className="card-icon" style={{ color: 'var(--primary-blue)' }}>
                📍
              </div>
              <div className="card-content">
                <div className="card-label">Location</div>
                <div className="card-value mono">{formatLocation(data.location)}</div>
                {data.locationDescription && (
                  <div className="card-description">{data.locationDescription}</div>
                )}
              </div>
            </div>

            <div className="detail-card">
              <div className="card-icon" style={{ color: 'var(--secondary-green)' }}>
                🎯
              </div>
              <div className="card-content">
                <div className="card-label">Severity</div>
                <div className="card-value">{data.severity} Priority</div>
                <div className="card-description">Response team dispatched</div>
              </div>
            </div>
          </div>
        </div>

        {/* Response Timeline */}
        <div className="response-timeline">
          <h3 className="timeline-title">📞 What Happens Next</h3>
          <div className="timeline-steps">
            <div className={`timeline-step ${confirmationCallTimer > 0 ? 'active' : 'completed'}`}>
              <div className="step-indicator">
                <div className="step-number">1</div>
                <div className="step-status">
                  {confirmationCallTimer > 0 ? '🔄' : '✅'}
                </div>
              </div>
              <div className="step-content">
                <div className="step-title">Confirmation Call</div>
                <div className="step-description">
                  {confirmationCallTimer > 0 ? (
                    <>
                      You should receive a call within <strong>{formatTimer(confirmationCallTimer)}</strong>
                    </>
                  ) : (
                    'Confirmation call completed'
                  )}
                </div>
              </div>
            </div>

            <div className="timeline-step">
              <div className="step-indicator">
                <div className="step-number">2</div>
                <div className="step-status">🚑</div>
              </div>
              <div className="step-content">
                <div className="step-title">Response Team En Route</div>
                <div className="step-description">
                  {emergencyInfo.responseTeam} will arrive within {emergencyInfo.estimatedArrival}
                </div>
              </div>
            </div>

            <div className="timeline-step">
              <div className="step-indicator">
                <div className="step-number">3</div>
                <div className="step-status">📱</div>
              </div>
              <div className="step-content">
                <div className="step-title">Updates & Tracking</div>
                <div className="step-description">
                  Receive real-time updates on response team location and ETA
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Important Information */}
        <div className="important-info">
          <h3 className="info-title">⚠️ Important Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-icon">📱</div>
              <div className="info-content">
                <div className="info-label">Keep Your Phone Available</div>
                <div className="info-description">
                  Our dispatch team will call you to confirm details and provide additional guidance
                </div>
              </div>
            </div>
            
            <div className="info-item">
              <div className="info-icon">🚗</div>
              <div className="info-content">
                <div className="info-label">Clear Emergency Access</div>
                <div className="info-description">
                  If safe to do so, move vehicles or obstacles that might block emergency vehicle access
                </div>
              </div>
            </div>
            
            <div className="info-item">
              <div className="info-icon">🆘</div>
              <div className="info-content">
                <div className="info-label">Direct Emergency Line</div>
                <div className="info-description">
                  For immediate life-threatening situations, also call 911 directly
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="success-actions">
          {isReporter && (
            <div className="reporter-actions">
              <p className="action-description">
                Would you like to report another emergency or return to the main page?
              </p>
              <div className="action-buttons">
                <button
                  onClick={handleStartNewReport}
                  className="btn btn-primary"
                >
                  🚨 Report Another Emergency
                </button>
                <button
                  onClick={handleGoHome}
                  className="btn btn-outline"
                >
                  🏠 Go to Home
                </button>
              </div>
            </div>
          )}

          {!isReporter && (
            <div className="authority-actions">
              <p className="action-description">
                Emergency has been successfully logged into the system. You can monitor the response through the dashboard.
              </p>
              <div className="action-buttons">
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="btn btn-primary"
                >
                  📊 View Dashboard
                </button>
                <button
                  onClick={handleGoHome}
                  className="btn btn-outline"
                >
                  🏠 Go to Home
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Emergency Reference */}
        <div className="emergency-reference">
          <div className="reference-card">
            <div className="reference-icon">🆔</div>
            <div className="reference-content">
              <div className="reference-label">Emergency Reference</div>
              <div className="reference-value">{emergencyId}</div>
              <div className="reference-description">
                Save this reference number for tracking your emergency
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuccessStep;
