import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

const EmergencyEscalationManager = () => {
  const { user } = useAuth();
  const [escalations, setEscalations] = useState([]);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [escalationForm, setEscalationForm] = useState({
    escalation_type: 'TIME_BASED',
    emergency_id: '',
    trigger_conditions: '',
    escalation_targets: [],
    escalation_steps: [
      {
        step: 1,
        action: 'Notify supervisor',
        message: 'Emergency requires supervisor attention',
        delay: 300
      }
    ]
  });

  const escalationTypes = [
    { type: 'TIME_BASED', label: 'Time-Based', desc: 'Escalate after specific time period' },
    { type: 'THRESHOLD_BASED', label: 'Threshold-Based', desc: 'Escalate when thresholds are met' },
    { type: 'MANUAL', label: 'Manual', desc: 'Manual escalation by operator' }
  ];

  const emergencyTypes = [
    'Fire Emergency',
    'Medical Emergency',
    'Security Threat',
    'Natural Disaster',
    'Mass Casualty',
    'Hazardous Materials',
    'Structure Collapse',
    'Vehicle Accident'
  ];

  const escalationTargets = [
    { type: 'user', label: 'Specific User', icon: '👤' },
    { type: 'role', label: 'Role-Based', icon: '🎭' },
    { type: 'agency', label: 'External Agency', icon: '🏢' },
    { type: 'system', label: 'System Alert', icon: '🚨' }
  ];

  useEffect(() => {
    fetchEscalations();
  }, []);

  const fetchEscalations = async () => {
    try {
      // For demo purposes, use mock data
      setEscalations(getMockEscalations());
    } catch (error) {
      console.error('Error fetching escalations:', error);
      setEscalations(getMockEscalations());
    }
  };

  const getMockEscalations = () => [
    {
      id: 1,
      escalation_type: 'TIME_BASED',
      emergency_id: 'EMG-2024-001',
      trigger_conditions: { time_threshold: 600, no_response: true },
      escalation_targets: [
        { type: 'user', id: 2, name: 'Supervisor Smith' },
        { type: 'role', name: 'admin' }
      ],
      escalation_steps: [
        {
          step: 1,
          action: 'Notify Supervisor',
          message: 'Emergency requires immediate supervisor attention',
          delay: 300,
          executed: true,
          executed_at: new Date(Date.now() - 300000).toISOString()
        },
        {
          step: 2,
          action: 'Notify Admin',
          message: 'Emergency escalated to administrative level',
          delay: 600,
          executed: true,
          executed_at: new Date(Date.now() - 120000).toISOString()
        }
      ],
      current_step: 3,
      status: 'ACTIVE',
      triggered_at: new Date(Date.now() - 600000).toISOString(),
      created_by: 'Command Center'
    },
    {
      id: 2,
      escalation_type: 'THRESHOLD_BASED',
      emergency_id: 'EMG-2024-002',
      trigger_conditions: { casualties_threshold: 5, resources_exhausted: true },
      escalation_targets: [
        { type: 'agency', name: 'State Emergency Management' },
        { type: 'system', alert: 'mass_casualty' }
      ],
      escalation_steps: [
        {
          step: 1,
          action: 'External Agency Alert',
          message: 'Mass casualty event requires state resources',
          delay: 0,
          executed: true,
          executed_at: new Date(Date.now() - 180000).toISOString()
        }
      ],
      current_step: 2,
      status: 'ACTIVE',
      triggered_at: new Date(Date.now() - 300000).toISOString(),
      created_by: 'Fire Chief Johnson'
    }
  ];

  const handleEscalationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/communication/escalation', escalationForm);
      
      if (response.data.escalation_id) {
        setShowEscalationModal(false);
        setEscalationForm({
          escalation_type: 'TIME_BASED',
          emergency_id: '',
          trigger_conditions: '',
          escalation_targets: [],
          escalation_steps: [
            {
              step: 1,
              action: 'Notify supervisor',
              message: 'Emergency requires supervisor attention',
              delay: 300
            }
          ]
        });
        fetchEscalations();
        
        showNotification('Emergency escalation created successfully!', 'success');
      }
    } catch (error) {
      console.error('Error creating escalation:', error);
      showNotification('Failed to create escalation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const executeEscalationStep = async (escalationId) => {
    try {
      const response = await api.post(`/communication/escalation/${escalationId}/execute`);
      
      if (response.data.message) {
        fetchEscalations();
        showNotification(response.data.message, 'success');
      }
    } catch (error) {
      console.error('Error executing escalation step:', error);
      showNotification('Failed to execute escalation step', 'error');
    }
  };

  const addEscalationStep = () => {
    const newStep = {
      step: escalationForm.escalation_steps.length + 1,
      action: '',
      message: '',
      delay: 300
    };
    
    setEscalationForm({
      ...escalationForm,
      escalation_steps: [...escalationForm.escalation_steps, newStep]
    });
  };

  const updateEscalationStep = (index, field, value) => {
    const updatedSteps = escalationForm.escalation_steps.map((step, i) => 
      i === index ? { ...step, [field]: value } : step
    );
    
    setEscalationForm({
      ...escalationForm,
      escalation_steps: updatedSteps
    });
  };

  const removeEscalationStep = (index) => {
    const updatedSteps = escalationForm.escalation_steps.filter((_, i) => i !== index);
    setEscalationForm({
      ...escalationForm,
      escalation_steps: updatedSteps
    });
  };

  const showNotification = (message, type) => {
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const getEscalationTypeColor = (type) => {
    switch (type) {
      case 'TIME_BASED': return '#3b82f6';
      case 'THRESHOLD_BASED': return '#f59e0b';
      case 'MANUAL': return '#7c3aed';
      default: return '#6b7280';
    }
  };

  const getEscalationStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return '#16a34a';
      case 'COMPLETED': return '#6b7280';
      case 'CANCELLED': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStepStatus = (step) => {
    if (step.executed) return 'COMPLETED';
    if (step.in_progress) return 'IN_PROGRESS';
    return 'PENDING';
  };

  const getStepStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return '#16a34a';
      case 'IN_PROGRESS': return '#f59e0b';
      case 'PENDING': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const canCreateEscalation = user?.role && ['authority', 'admin', 'super_admin'].includes(user.role);

  return (
    <div className="emergency-escalation-manager">
      <div className="panel-header">
        <h2>
          ⚡ Emergency Escalation Manager
        </h2>
        <p>Automate emergency escalation protocols and notifications</p>
        
        {canCreateEscalation && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowEscalationModal(true)}
          >
            ⚡ Create Escalation
          </button>
        )}
      </div>

      <div className="escalations-overview">
        <div className="overview-stats">
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-content">
              <div className="stat-value">{escalations.filter(e => e.status === 'ACTIVE').length}</div>
              <div className="stat-label">Active Escalations</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-content">
              <div className="stat-value">{escalations.filter(e => e.escalation_type === 'TIME_BASED').length}</div>
              <div className="stat-label">Time-Based</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <div className="stat-value">{escalations.filter(e => e.escalation_type === 'THRESHOLD_BASED').length}</div>
              <div className="stat-label">Threshold-Based</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-value">{escalations.filter(e => e.status === 'COMPLETED').length}</div>
              <div className="stat-label">Completed</div>
            </div>
          </div>
        </div>
      </div>

      <div className="escalations-list">
        <h3>Active Escalations</h3>
        
        {escalations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⚡</div>
            <p>No emergency escalations configured</p>
            {canCreateEscalation && (
              <button 
                className="btn btn-primary"
                onClick={() => setShowEscalationModal(true)}
              >
                Create First Escalation
              </button>
            )}
          </div>
        ) : (
          <div className="escalations-grid">
            {escalations.map((escalation) => (
              <div 
                key={escalation.id} 
                className="escalation-card"
                onClick={() => setSelectedEscalation(escalation)}
              >
                <div className="escalation-header">
                  <div className="escalation-id">ESC-{escalation.id}</div>
                  
                  <div className="escalation-badges">
                    <span 
                      className="type-badge"
                      style={{ backgroundColor: getEscalationTypeColor(escalation.escalation_type) }}
                    >
                      {escalation.escalation_type.replace('_', ' ')}
                    </span>
                    
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getEscalationStatusColor(escalation.status) }}
                    >
                      {escalation.status}
                    </span>
                  </div>
                </div>

                <div className="escalation-content">
                  <h4 className="emergency-id">Emergency: {escalation.emergency_id}</h4>
                  
                  <div className="escalation-meta">
                    <div className="meta-item">
                      <span className="meta-label">Created by:</span>
                      <span className="meta-value">{escalation.created_by}</span>
                    </div>
                    
                    <div className="meta-item">
                      <span className="meta-label">Current Step:</span>
                      <span className="meta-value">{escalation.current_step} of {escalation.escalation_steps.length}</span>
                    </div>
                    
                    <div className="meta-item">
                      <span className="meta-label">Triggered:</span>
                      <span className="meta-value">
                        {new Date(escalation.triggered_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="escalation-progress">
                    <div className="progress-label">Progress</div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${(escalation.escalation_steps.filter(s => s.executed).length / escalation.escalation_steps.length) * 100}%` 
                        }}
                      />
                    </div>
                    <div className="progress-text">
                      {escalation.escalation_steps.filter(s => s.executed).length} of {escalation.escalation_steps.length} steps completed
                    </div>
                  </div>

                  <div className="escalation-steps-preview">
                    <div className="steps-label">Next Steps:</div>
                    <div className="steps-preview">
                      {escalation.escalation_steps
                        .filter((_, index) => index >= escalation.current_step - 1)
                        .slice(0, 2)
                        .map((step, index) => (
                          <div key={index} className="step-preview">
                            <span className="step-number">{step.step}</span>
                            <span className="step-action">{step.action}</span>
                            {step.delay > 0 && (
                              <span className="step-delay">({Math.floor(step.delay / 60)}min)</span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="escalation-actions">
                  {escalation.status === 'ACTIVE' && escalation.current_step <= escalation.escalation_steps.length && (
                    <button 
                      className="btn btn-warning btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        executeEscalationStep(escalation.id);
                      }}
                    >
                      ▶️ Execute Step {escalation.current_step}
                    </button>
                  )}
                  
                  {escalation.status === 'COMPLETED' && (
                    <span className="completion-badge">✅ Completed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Escalation Modal */}
      {showEscalationModal && (
        <div className="modal-overlay" onClick={() => setShowEscalationModal(false)}>
          <div className="modal-content escalation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚡ Create Emergency Escalation</h2>
              <button 
                className="close-btn"
                onClick={() => setShowEscalationModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEscalationSubmit} className="escalation-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Escalation Type</label>
                  <select
                    value={escalationForm.escalation_type}
                    onChange={(e) => setEscalationForm({...escalationForm, escalation_type: e.target.value})}
                    required
                  >
                    {escalationTypes.map((type) => (
                      <option key={type.type} value={type.type}>
                        {type.label} - {type.desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Emergency ID</label>
                  <input
                    type="text"
                    value={escalationForm.emergency_id}
                    onChange={(e) => setEscalationForm({...escalationForm, emergency_id: e.target.value})}
                    placeholder="Emergency reference ID"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Trigger Conditions</label>
                <textarea
                  value={escalationForm.trigger_conditions}
                  onChange={(e) => setEscalationForm({...escalationForm, trigger_conditions: e.target.value})}
                  placeholder="Describe the conditions that will trigger this escalation (e.g., 'No response after 10 minutes', 'More than 5 casualties')"
                  rows="2"
                  required
                />
              </div>

              <div className="escalation-steps-section">
                <div className="section-header">
                  <h3>Escalation Steps</h3>
                  <button 
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addEscalationStep}
                  >
                    ➕ Add Step
                  </button>
                </div>

                <div className="escalation-steps-list">
                  {escalationForm.escalation_steps.map((step, index) => (
                    <div key={index} className="escalation-step-item">
                      <div className="step-header">
                        <span className="step-number">Step {step.step}</span>
                        {escalationForm.escalation_steps.length > 1 && (
                          <button 
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeEscalationStep(index)}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      
                      <div className="step-fields">
                        <div className="form-group">
                          <label>Action</label>
                          <input
                            type="text"
                            value={step.action}
                            onChange={(e) => updateEscalationStep(index, 'action', e.target.value)}
                            placeholder="e.g., Notify supervisor, Call external agency"
                            required
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Message</label>
                          <input
                            type="text"
                            value={step.message}
                            onChange={(e) => updateEscalationStep(index, 'message', e.target.value)}
                            placeholder="Message to send"
                            required
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Delay (seconds)</label>
                          <input
                            type="number"
                            min="0"
                            value={step.delay}
                            onChange={(e) => updateEscalationStep(index, 'delay', parseInt(e.target.value) || 0)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowEscalationModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : '⚡ Create Escalation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Escalation Detail Modal */}
      {selectedEscalation && (
        <div className="modal-overlay" onClick={() => setSelectedEscalation(null)}>
          <div className="modal-content escalation-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Escalation Details - ESC-{selectedEscalation.id}</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedEscalation(null)}
              >
                ✕
              </button>
            </div>

            <div className="escalation-detail-content">
              <div className="detail-section">
                <h3>Escalation Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Type:</span>
                    <span 
                      className="detail-value type-badge"
                      style={{ backgroundColor: getEscalationTypeColor(selectedEscalation.escalation_type) }}
                    >
                      {selectedEscalation.escalation_type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Emergency:</span>
                    <span className="detail-value">{selectedEscalation.emergency_id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span 
                      className="detail-value status-badge"
                      style={{ backgroundColor: getEscalationStatusColor(selectedEscalation.status) }}
                    >
                      {selectedEscalation.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Current Step:</span>
                    <span className="detail-value">{selectedEscalation.current_step} of {selectedEscalation.escalation_steps.length}</span>
                  </div>
                </div>
                
                <div className="detail-description">
                  <span className="detail-label">Trigger Conditions:</span>
                  <p>{selectedEscalation.trigger_conditions}</p>
                </div>
              </div>

              <div className="detail-section">
                <h3>Escalation Steps</h3>
                <div className="escalation-steps-detail">
                  {selectedEscalation.escalation_steps.map((step, index) => (
                    <div key={index} className={`escalation-step-detail ${getStepStatus(step).toLowerCase()}`}>
                      <div className="step-header-detail">
                        <span className="step-number-detail">Step {step.step}</span>
                        <span 
                          className="step-status-badge"
                          style={{ backgroundColor: getStepStatusColor(getStepStatus(step)) }}
                        >
                          {getStepStatus(step)}
                        </span>
                      </div>
                      
                      <div className="step-content-detail">
                        <div className="step-action-detail">
                          <strong>Action:</strong> {step.action}
                        </div>
                        <div className="step-message-detail">
                          <strong>Message:</strong> {step.message}
                        </div>
                        <div className="step-timing-detail">
                          <strong>Delay:</strong> {step.delay} seconds
                          {step.delay > 0 && (
                            <span className="delay-text">({Math.floor(step.delay / 60)} minutes)</span>
                          )}
                        </div>
                        
                        {step.executed && step.executed_at && (
                          <div className="step-executed-detail">
                            <strong>Executed:</strong> {new Date(step.executed_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Targets</h3>
                <div className="targets-list">
                  {selectedEscalation.escalation_targets.map((target, index) => (
                    <div key={index} className="target-item">
                      <span className="target-icon">
                        {escalationTargets.find(t => t.type === target.type)?.icon}
                      </span>
                      <span className="target-info">
                        {target.type === 'user' ? target.name : 
                         target.type === 'role' ? `Role: ${target.name}` :
                         target.type === 'agency' ? target.name :
                         `System: ${target.alert}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              {selectedEscalation.status === 'ACTIVE' && selectedEscalation.current_step <= selectedEscalation.escalation_steps.length && (
                <button 
                  className="btn btn-warning"
                  onClick={() => {
                    executeEscalationStep(selectedEscalation.id);
                    setSelectedEscalation(null);
                  }}
                >
                  ▶️ Execute Step {selectedEscalation.current_step}
                </button>
              )}
              <button 
                className="btn btn-secondary"
                onClick={() => setSelectedEscalation(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyEscalationManager;
