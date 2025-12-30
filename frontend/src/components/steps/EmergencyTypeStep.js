import React from 'react';

const EMERGENCY_TYPES = [
  {
    id: 'Ambulance',
    label: 'Ambulance',
    subtitle: 'Medical Emergency',
    icon: '🚑',
    color: 'var(--accent-red)',
    description: 'Medical emergencies, injuries, health crises',
    responseTime: '8-12 minutes',
    examples: ['Heart attack', 'Injury', 'Allergic reaction', 'Unconscious person']
  },
  {
    id: 'Fire',
    label: 'Fire',
    subtitle: 'Fire Emergency',
    icon: '🔥',
    color: 'var(--accent-orange)',
    description: 'Fire emergencies, explosions, smoke',
    responseTime: '6-10 minutes',
    examples: ['Building fire', 'Vehicle fire', 'Chemical spill', 'Explosion']
  },
  {
    id: 'Police',
    label: 'Police',
    subtitle: 'Security Emergency',
    icon: '🚓',
    color: 'var(--primary-blue)',
    description: 'Security threats, crimes, violence',
    responseTime: '5-15 minutes',
    examples: ['Assault', 'Robbery', 'Domestic violence', 'Suspicious activity']
  }
];

const SEVERITY_LEVELS = [
  {
    id: 'low',
    label: 'Low Priority',
    description: 'Non-urgent situation, no immediate danger',
    icon: '🟢',
    color: 'var(--secondary-green)'
  },
  {
    id: 'medium',
    label: 'Medium Priority',
    description: 'Serious situation requiring prompt attention',
    icon: '🟡',
    color: 'var(--accent-orange)'
  },
  {
    id: 'high',
    label: 'High Priority',
    description: 'Life-threatening situation, immediate response required',
    icon: '🔴',
    color: 'var(--accent-red)'
  }
];

function EmergencyTypeStep({ data, onUpdate, errors }) {
  const handleEmergencyTypeSelect = (type) => {
    onUpdate({ emergencyType: type });
  };

  const handleSeveritySelect = (severity) => {
    onUpdate({ severity });
  };

  const handleDescriptionChange = (description) => {
    onUpdate({ description });
  };

  return (
    <div className="emergency-type-step">
      <div className="form-section">
        <h2 className="form-section-title">
          🆔 What type of emergency are you reporting?
        </h2>
        <p className="form-help">
          Select the most appropriate emergency type to ensure the right response team is dispatched
        </p>

        {/* Emergency Type Selection */}
        <div className="emergency-type-grid">
          {EMERGENCY_TYPES.map((type) => (
            <div
              key={type.id}
              className={`emergency-type-card ${
                data.emergencyType === type.id ? 'selected' : ''
              }`}
              onClick={() => handleEmergencyTypeSelect(type.id)}
              style={{
                '--card-color': type.color,
                '--card-icon': `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${encodeURIComponent(type.color)}'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='16'%3E${encodeURIComponent(type.icon)}%3C/text%3E%3C/svg%3E")`
              }}
            >
              <div className="emergency-type-icon">
                {type.icon}
              </div>
              <div className="emergency-type-content">
                <h3 className="emergency-type-title">{type.label}</h3>
                <p className="emergency-type-subtitle">{type.subtitle}</p>
                <p className="emergency-type-description">{type.description}</p>
                
                <div className="emergency-type-details">
                  <div className="detail-item">
                    <span className="detail-icon">⏱️</span>
                    <span className="detail-text">Response: {type.responseTime}</span>
                  </div>
                </div>
                
                <div className="emergency-examples">
                  <span className="examples-label">Examples:</span>
                  <span className="examples-list">{type.examples.join(', ')}</span>
                </div>
              </div>
              
              <div className="emergency-type-indicator">
                {data.emergencyType === type.id ? '✓' : ''}
              </div>
            </div>
          ))}
        </div>

        {errors.emergencyType && (
          <div className="form-error">
            {errors.emergencyType}
          </div>
        )}
      </div>

      {/* Severity Assessment */}
      <div className="form-section">
        <h3 className="form-section-title">
          🎯 How urgent is this emergency?
        </h3>
        <p className="form-help">
          This helps us prioritize the response and allocate appropriate resources
        </p>

        <div className="severity-grid">
          {SEVERITY_LEVELS.map((severity) => (
            <div
              key={severity.id}
              className={`severity-card ${
                data.severity === severity.id ? 'selected' : ''
              }`}
              onClick={() => handleSeveritySelect(severity.id)}
              style={{ '--severity-color': severity.color }}
            >
              <div className="severity-icon">{severity.icon}</div>
              <div className="severity-content">
                <h4 className="severity-title">{severity.label}</h4>
                <p className="severity-description">{severity.description}</p>
              </div>
              <div className="severity-indicator">
                {data.severity === severity.id ? '✓' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Description */}
      <div className="form-section">
        <h3 className="form-section-title">
          📝 Additional Information (Optional)
        </h3>
        <p className="form-help">
          Any additional details that might help the response team
        </p>

        <div className="form-group">
          <label className="form-label" htmlFor="emergency-description">
            Description
          </label>
          <textarea
            id="emergency-description"
            className="form-control"
            rows={4}
            value={data.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Provide any additional details about the emergency (number of people involved, specific conditions, etc.)"
            style={{
              resize: 'vertical',
              minHeight: '100px'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default EmergencyTypeStep;
