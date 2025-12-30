import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

const MultiAgencyCoordination = () => {
  const { user } = useAuth();
  const [showCoordinationModal, setShowCoordinationModal] = useState(false);
  const [coordinations, setCoordinations] = useState([]);
  const [selectedCoordination, setSelectedCoordination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [coordinationForm, setCoordinationForm] = useState({
    incident_id: '',
    incident_type: '',
    description: '',
    location: '',
    lead_agency: '',
    participating_agencies: [],
    coordination_level: 'BASIC',
    priority: 'MEDIUM'
  });

  const incidentTypes = [
    'Mass Casualty Event',
    'Multi-Vehicle Accident',
    'Structure Fire',
    'Hazardous Materials',
    'Natural Disaster',
    'Terrorism/Security',
    'Search and Rescue',
    'Public Health Emergency',
    'Utility Emergency',
    'Other'
  ];

  const agencies = [
    'Fire Department',
    'Police Department',
    'EMS/Ambulance',
    'Public Works',
    'Health Department',
    'Emergency Management',
    'Red Cross',
    'Salvation Army',
    'National Guard',
    'Federal Agencies'
  ];

  const coordinationLevels = [
    { level: 'BASIC', label: 'Basic Coordination', desc: 'Standard information sharing' },
    { level: 'ADVANCED', label: 'Advanced Coordination', desc: 'Shared command structure' },
    { level: 'COMMAND', label: 'Unified Command', desc: 'Joint incident command' }
  ];

  const priorityLevels = [
    { level: 'LOW', label: 'Low', color: '#16a34a' },
    { level: 'MEDIUM', label: 'Medium', color: '#eab308' },
    { level: 'HIGH', label: 'High', color: '#ea580c' },
    { level: 'CRITICAL', label: 'Critical', color: '#dc2626' }
  ];

  useEffect(() => {
    fetchCoordinations();
  }, []);

  const fetchCoordinations = async () => {
    try {
      // This would be a new endpoint to get all active coordinations
      const response = await api.get('/communication/coordinations');
      setCoordinations(response.data.coordinations || []);
    } catch (error) {
      console.error('Error fetching coordinations:', error);
      // For demo purposes, use mock data
      setCoordinations(getMockCoordinations());
    }
  };

  const getMockCoordinations = () => [
    {
      id: 1,
      incident_id: 'INC-2024-001',
      incident_type: 'Mass Casualty Event',
      description: 'Multi-vehicle accident on Highway 101 with multiple injuries',
      location: 'Highway 101, Mile Marker 45',
      lead_agency: 'Fire Department',
      participating_agencies: ['Fire Department', 'Police Department', 'EMS/Ambulance'],
      coordination_level: 'ADVANCED',
      status: 'ACTIVE',
      priority: 'CRITICAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      incident_id: 'INC-2024-002',
      incident_type: 'Structure Fire',
      description: 'Commercial building fire with potential hazmat concerns',
      location: '123 Main Street, Downtown',
      lead_agency: 'Fire Department',
      participating_agencies: ['Fire Department', 'Police Department', 'Public Works'],
      coordination_level: 'COMMAND',
      status: 'ACTIVE',
      priority: 'HIGH',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString()
    }
  ];

  const handleCoordinationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/communication/coordination', coordinationForm);
      
      if (response.data.coordination_id) {
        setShowCoordinationModal(false);
        setCoordinationForm({
          incident_id: '',
          incident_type: '',
          description: '',
          location: '',
          lead_agency: '',
          participating_agencies: [],
          coordination_level: 'BASIC',
          priority: 'MEDIUM'
        });
        fetchCoordinations();
        
        showNotification('Agency coordination created successfully!', 'success');
      }
    } catch (error) {
      console.error('Error creating coordination:', error);
      showNotification('Failed to create agency coordination', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateCoordinationStatus = async (incidentId, newStatus) => {
    try {
      await api.put(`/communication/coordination/${incidentId}/update`, { status: newStatus });
      fetchCoordinations();
      showNotification(`Coordination status updated to ${newStatus}`, 'success');
    } catch (error) {
      console.error('Error updating coordination:', error);
      showNotification('Failed to update coordination status', 'error');
    }
  };

  const showNotification = (message, type) => {
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const generateIncidentId = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = String(date.getTime()).slice(-6);
    return `INC-${year}${month}${day}-${time}`;
  };

  const getPriorityColor = (priority) => {
    const priorityObj = priorityLevels.find(p => p.level === priority);
    return priorityObj ? priorityObj.color : '#6b7280';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return '#16a34a';
      case 'STANDBY': return '#eab308';
      case 'COMPLETED': return '#6b7280';
      case 'CANCELLED': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const canCreateCoordination = user?.role && ['authority', 'admin', 'super_admin'].includes(user.role);

  return (
    <div className="multi-agency-coordination">
      <div className="panel-header">
        <h2>
          🤝 Multi-Agency Coordination
        </h2>
        <p>Coordinate emergency response across multiple agencies</p>
        
        {canCreateCoordination && (
          <button 
            className="btn btn-primary"
            onClick={() => {
              setCoordinationForm(prev => ({ ...prev, incident_id: generateIncidentId() }));
              setShowCoordinationModal(true);
            }}
          >
            🔗 Create Coordination
          </button>
        )}
      </div>

      <div className="coordinations-overview">
        <div className="overview-stats">
          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-content">
              <div className="stat-value">{coordinations.filter(c => c.status === 'ACTIVE').length}</div>
              <div className="stat-label">Active Coordinations</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-content">
              <div className="stat-value">{coordinations.filter(c => c.priority === 'CRITICAL').length}</div>
              <div className="stat-label">Critical Priority</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🏢</div>
            <div className="stat-content">
              <div className="stat-value">
                {new Set(coordinations.flatMap(c => c.participating_agencies || [])).size}
              </div>
              <div className="stat-label">Agencies Involved</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <div className="stat-value">
                {coordinations.filter(c => c.coordination_level === 'COMMAND').length}
              </div>
              <div className="stat-label">Unified Commands</div>
            </div>
          </div>
        </div>
      </div>

      <div className="coordinations-list">
        <h3>Active Coordinations</h3>
        
        {coordinations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤝</div>
            <p>No active agency coordinations</p>
            {canCreateCoordination && (
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setCoordinationForm(prev => ({ ...prev, incident_id: generateIncidentId() }));
                  setShowCoordinationModal(true);
                }}
              >
                Create First Coordination
              </button>
            )}
          </div>
        ) : (
          <div className="coordinations-grid">
            {coordinations.map((coordination) => (
              <div 
                key={coordination.id} 
                className="coordination-card"
                onClick={() => setSelectedCoordination(coordination)}
              >
                <div className="coordination-header">
                  <div className="incident-id">{coordination.incident_id}</div>
                  
                  <div className="coordination-badges">
                    <span 
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(coordination.priority) }}
                    >
                      {coordination.priority}
                    </span>
                    
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(coordination.status) }}
                    >
                      {coordination.status}
                    </span>
                  </div>
                </div>

                <div className="coordination-content">
                  <h4 className="incident-type">{coordination.incident_type}</h4>
                  <p className="incident-description">{coordination.description}</p>
                  
                  <div className="incident-location">
                    📍 {coordination.location}
                  </div>

                  <div className="coordination-meta">
                    <div className="meta-item">
                      <span className="meta-label">Lead Agency:</span>
                      <span className="meta-value">{coordination.lead_agency}</span>
                    </div>
                    
                    <div className="meta-item">
                      <span className="meta-label">Coordination Level:</span>
                      <span className="meta-value">{coordination.coordination_level}</span>
                    </div>
                    
                    <div className="meta-item">
                      <span className="meta-label">Updated:</span>
                      <span className="meta-value">
                        {new Date(coordination.updated_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="participating-agencies">
                    <span className="agencies-label">Participating Agencies:</span>
                    <div className="agencies-list">
                      {(coordination.participating_agencies || []).map((agency, index) => (
                        <span key={index} className="agency-tag">{agency}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="coordination-actions">
                  {coordination.status === 'ACTIVE' && (
                    <>
                      <button 
                        className="btn btn-warning btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateCoordinationStatus(coordination.incident_id, 'STANDBY');
                        }}
                      >
                        ⏸️ Standby
                      </button>
                      
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateCoordinationStatus(coordination.incident_id, 'COMPLETED');
                        }}
                      >
                        ✅ Complete
                      </button>
                    </>
                  )}
                  
                  {coordination.status === 'STANDBY' && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCoordinationStatus(coordination.incident_id, 'ACTIVE');
                      }}
                    >
                      ▶️ Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Coordination Modal */}
      {showCoordinationModal && (
        <div className="modal-overlay" onClick={() => setShowCoordinationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔗 Create Multi-Agency Coordination</h2>
              <button 
                className="close-btn"
                onClick={() => setShowCoordinationModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCoordinationSubmit} className="coordination-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Incident ID</label>
                  <input
                    type="text"
                    value={coordinationForm.incident_id}
                    onChange={(e) => setCoordinationForm({...coordinationForm, incident_id: e.target.value})}
                    placeholder="Auto-generated"
                    required
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Priority Level</label>
                  <select
                    value={coordinationForm.priority}
                    onChange={(e) => setCoordinationForm({...coordinationForm, priority: e.target.value})}
                    required
                  >
                    {priorityLevels.map((priority) => (
                      <option key={priority.level} value={priority.level}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Incident Type</label>
                <select
                  value={coordinationForm.incident_type}
                  onChange={(e) => setCoordinationForm({...coordinationForm, incident_type: e.target.value})}
                  required
                >
                  <option value="">Select incident type</option>
                  {incidentTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={coordinationForm.description}
                  onChange={(e) => setCoordinationForm({...coordinationForm, description: e.target.value})}
                  placeholder="Detailed description of the incident and coordination needs"
                  rows="3"
                  required
                />
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={coordinationForm.location}
                  onChange={(e) => setCoordinationForm({...coordinationForm, location: e.target.value})}
                  placeholder="Incident location or address"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Lead Agency</label>
                  <select
                    value={coordinationForm.lead_agency}
                    onChange={(e) => setCoordinationForm({...coordinationForm, lead_agency: e.target.value})}
                    required
                  >
                    <option value="">Select lead agency</option>
                    {agencies.map((agency) => (
                      <option key={agency} value={agency}>{agency}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Coordination Level</label>
                  <select
                    value={coordinationForm.coordination_level}
                    onChange={(e) => setCoordinationForm({...coordinationForm, coordination_level: e.target.value})}
                    required
                  >
                    {coordinationLevels.map((level) => (
                      <option key={level.level} value={level.level}>
                        {level.label} - {level.desc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Participating Agencies</label>
                <div className="agencies-checkboxes">
                  {agencies.map((agency) => (
                    <label key={agency} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={coordinationForm.participating_agencies.includes(agency)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCoordinationForm({
                              ...coordinationForm,
                              participating_agencies: [...coordinationForm.participating_agencies, agency]
                            });
                          } else {
                            setCoordinationForm({
                              ...coordinationForm,
                              participating_agencies: coordinationForm.participating_agencies.filter(a => a !== agency)
                            });
                          }
                        }}
                      />
                      {agency}
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCoordinationModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : '🔗 Create Coordination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coordination Detail Modal */}
      {selectedCoordination && (
        <div className="modal-overlay" onClick={() => setSelectedCoordination(null)}>
          <div className="modal-content coordination-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Coordination Details - {selectedCoordination.incident_id}</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedCoordination(null)}
              >
                ✕
              </button>
            </div>

            <div className="coordination-detail-content">
              <div className="detail-section">
                <h3>Incident Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{selectedCoordination.incident_type}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Priority:</span>
                    <span 
                      className="detail-value priority-badge"
                      style={{ backgroundColor: getPriorityColor(selectedCoordination.priority) }}
                    >
                      {selectedCoordination.priority}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span 
                      className="detail-value status-badge"
                      style={{ backgroundColor: getStatusColor(selectedCoordination.status) }}
                    >
                      {selectedCoordination.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Location:</span>
                    <span className="detail-value">{selectedCoordination.location}</span>
                  </div>
                </div>
                
                <div className="detail-description">
                  <span className="detail-label">Description:</span>
                  <p>{selectedCoordination.description}</p>
                </div>
              </div>

              <div className="detail-section">
                <h3>Coordination Details</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Lead Agency:</span>
                    <span className="detail-value">{selectedCoordination.lead_agency}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Coordination Level:</span>
                    <span className="detail-value">{selectedCoordination.coordination_level}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Participating Agencies</h3>
                <div className="agencies-detail-list">
                  {(selectedCoordination.participating_agencies || []).map((agency, index) => (
                    <div key={index} className="agency-detail-item">
                      <span className="agency-name">{agency}</span>
                      <span className="agency-status active">Active</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setSelectedCoordination(null)}
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

export default MultiAgencyCoordination;
