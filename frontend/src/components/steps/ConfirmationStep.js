import React from 'react';

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

const SEVERITY_INFO = {
  'low': {
    icon: '🟢',
    color: 'var(--secondary-green)',
    description: 'Non-urgent, routine response'
  },
  'medium': {
    icon: '🟡',
    color: 'var(--accent-orange)',
    description: 'Urgent, prompt response required'
  },
  'high': {
    icon: '🔴',
    color: 'var(--accent-red)',
    description: 'Critical, immediate response required'
  }
};

function ConfirmationStep({ data, onUpdate, onSubmit, isSubmitting, errors }) {
  const emergencyInfo = EMERGENCY_TYPE_INFO[data.emergencyType] || {};
  const severityInfo = SEVERITY_INFO[data.severity] || {};

  const formatLocation = (location) => {
    if (!location) return 'Not specified';
    return `${location[0].toFixed(6)}, ${location[1].toFixed(6)}`;
  };

  const getEditAction = (field) => {
    // In a real app, this would navigate back to the specific step
    console.log(`Edit ${field}`);
  };

  return (
    <div className="confirmation-step">
      <div className="form-section">
        <h2 className="form-section-title">
          📋 Review Your Emergency Report
        </h2>
        <p className="form-help">
          Please review all information carefully before submitting. You can edit any section if needed.
        </p>

        {/* Emergency Summary Cards */}
        <div className="confirmation-summary">
          <div className="summary-grid">
            {/* Emergency Type Card */}
            <div className="summary-card emergency-type">
              <div className="card-header">
                <div className="card-icon" style={{ color: emergencyInfo.color }}>
                  {emergencyInfo.icon}
                </div>
                <div className="card-title">Emergency Type</div>
                <button 
                  className="edit-btn"
                  onClick={() => getEditAction('emergencyType')}
                >
                  ✏️ Edit
                </button>
              </div>
              <div className="card-content">
                <div className="info-item">
                  <span className="info-label">Type:</span>
                  <span className="info-value">{data.emergencyType}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Severity:</span>
                  <span className="info-value">
                    <span style={{ color: severityInfo.color }}>
                      {severityInfo.icon} {data.severity} Priority
                    </span>
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Response Team:</span>
                  <span className="info-value">{emergencyInfo.responseTeam}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Est. Arrival:</span>
                  <span className="info-value">{emergencyInfo.estimatedArrival}</span>
                </div>
              </div>
            </div>

            {/* Location Card */}
            <div className="summary-card location">
              <div className="card-header">
                <div className="card-icon" style={{ color: 'var(--primary-blue)' }}>
                  📍
                </div>
                <div className="card-title">Emergency Location</div>
                <button 
                  className="edit-btn"
                  onClick={() => getEditAction('location')}
                >
                  ✏️ Edit
                </button>
              </div>
              <div className="card-content">
                <div className="info-item">
                  <span className="info-label">Coordinates:</span>
                  <span className="info-value mono">{formatLocation(data.location)}</span>
                </div>
                {data.locationDescription && (
                  <div className="info-item">
                    <span className="info-label">Description:</span>
                    <span className="info-value">{data.locationDescription}</span>
                  </div>
                )}
                <div className="info-item">
                  <span className="info-label">Map View:</span>
                  <span className="info-value">📍 Location confirmed</span>
                </div>
              </div>
            </div>

            {/* Additional Information Card */}
            {(data.description || data.contactInfo.name || data.contactInfo.phone) && (
              <div className="summary-card additional">
                <div className="card-header">
                  <div className="card-icon" style={{ color: 'var(--secondary-green)' }}>
                    📝
                  </div>
                  <div className="card-title">Additional Information</div>
                  <button 
                    className="edit-btn"
                    onClick={() => getEditAction('description')}
                  >
                    ✏️ Edit
                  </button>
                </div>
                <div className="card-content">
                  {data.description && (
                    <div className="info-item">
                      <span className="info-label">Description:</span>
                      <span className="info-value">{data.description}</span>
                    </div>
                  )}
                  {data.contactInfo.name && (
                    <div className="info-item">
                      <span className="info-label">Contact Name:</span>
                      <span className="info-value">{data.contactInfo.name}</span>
                    </div>
                  )}
                  {data.contactInfo.phone && (
                    <div className="info-item">
                      <span className="info-label">Phone:</span>
                      <span className="info-value">{data.contactInfo.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Response Information */}
        <div className="response-info">
          <h3 className="info-section-title">🚨 What Happens Next?</h3>
          <div className="response-steps">
            <div className="response-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <div className="step-title">Immediate Dispatch</div>
                <div className="step-description">
                  Our dispatch team will receive your report immediately and dispatch the appropriate response team.
                </div>
              </div>
            </div>
            
            <div className="response-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <div className="step-title">Contact Confirmation</div>
                <div className="step-description">
                  You should receive a confirmation call within 2 minutes to verify details and provide additional guidance.
                </div>
              </div>
            </div>
            
            <div className="response-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <div className="step-title">Response Team En Route</div>
                <div className="step-description">
                  The {emergencyInfo.responseTeam.toLowerCase()} will be dispatched and should arrive within {emergencyInfo.estimatedArrival}.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Important Reminders */}
        <div className="important-reminders">
          <h3 className="reminders-title">⚠️ Important Reminders</h3>
          <ul className="reminders-list">
            <li>Stay at the location if it is safe to do so</li>
            <li>Keep your phone available for the confirmation call</li>
            <li>Clear the area for emergency vehicle access if possible</li>
            <li>For life-threatening situations, also call 911 directly</li>
          </ul>
        </div>

        {/* Submission Confirmation */}
        <div className="submission-confirmation">
          <div className="confirmation-checkbox">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={data.confirmed}
                onChange={(e) => onUpdate({ confirmed: e.target.checked })}
                className="checkbox-input"
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">
                I confirm that all information provided is accurate and I understand the response process
              </span>
            </label>
          </div>

          {errors.general && (
            <div className="form-error">
              {errors.general}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfirmationStep;
