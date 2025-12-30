import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

const IncidentTimeline = () => {
  const { user } = useAuth();
  const [selectedEmergency, setSelectedEmergency] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emergencies, setEmergencies] = useState([]);
  const [timelineForm, setTimelineForm] = useState({
    emergency_id: '',
    event_type: 'STATUS_UPDATE',
    event_description: '',
    event_data: {},
    actor_role: user?.role || 'user',
    impact_level: 'MEDIUM',
    outcome: ''
  });

  const eventTypes = [
    { type: 'DECISION', label: 'Decision', icon: '⚖️', color: '#7c3aed' },
    { type: 'RESOURCE_ASSIGNMENT', label: 'Resource Assignment', icon: '🚚', color: '#f59e0b' },
    { type: 'STATUS_UPDATE', label: 'Status Update', icon: '📊', color: '#3b82f6' },
    { type: 'ESCALATION', label: 'Escalation', icon: '⚡', color: '#dc2626' },
    { type: 'COMMUNICATION', label: 'Communication', icon: '💬', color: '#059669' },
    { type: 'ARRIVAL', label: 'Unit Arrival', icon: '🚨', color: '#16a34a' },
    { type: 'COMPLETION', label: 'Completion', icon: '✅', color: '#16a34a' },
    { type: 'CANCELLATION', label: 'Cancellation', icon: '❌', color: '#dc2626' }
  ];

  const impactLevels = [
    { level: 'LOW', label: 'Low Impact', color: '#16a34a' },
    { level: 'MEDIUM', label: 'Medium Impact', color: '#eab308' },
    { level: 'HIGH', label: 'High Impact', color: '#ea580c' },
    { level: 'CRITICAL', label: 'Critical Impact', color: '#dc2626' }
  ];

  useEffect(() => {
    loadEmergencies();
  }, []);

  useEffect(() => {
    if (selectedEmergency) {
      loadTimeline();
    }
  }, [selectedEmergency]);

  const loadEmergencies = async () => {
    try {
      // For demo purposes, use mock data
      setEmergencies(getMockEmergencies());
    } catch (error) {
      console.error('Error loading emergencies:', error);
      setEmergencies(getMockEmergencies());
    }
  };

  const getMockEmergencies = () => [
    { id: 1, request_id: 'EMG-2024-001', emergency_type: 'Structure Fire', location: '123 Main Street' },
    { id: 2, request_id: 'EMG-2024-002', emergency_type: 'Medical Emergency', location: '456 Oak Avenue' },
    { id: 3, request_id: 'EMG-2024-003', emergency_type: 'Traffic Accident', location: 'Highway 101' }
  ];

  const loadTimeline = async () => {
    try {
      const response = await api.get(`/communication/timeline/${selectedEmergency}`);
      setTimeline(response.data.timeline || getMockTimeline(selectedEmergency));
    } catch (error) {
      console.error('Error loading timeline:', error);
      setTimeline(getMockTimeline(selectedEmergency));
    }
  };

  const getMockTimeline = (emergencyId) => {
    const mockTimelines = {
      '1': [
        {
          id: 1,
          emergency_id: 1,
          incident_id: 'TL-2024-001-001',
          event_type: 'DECISION',
          event_description: 'Declared Code Red - Structure Fire with possible entrapment',
          event_data: { decision_maker: 'Fire Chief Johnson', rationale: 'Visible flames and smoke reported' },
          actor_name: 'Fire Chief Johnson',
          actor_role: 'authority',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          impact_level: 'CRITICAL',
          outcome: 'Immediate dispatch of all available units'
        },
        {
          id: 2,
          emergency_id: 1,
          incident_id: 'TL-2024-001-002',
          event_type: 'RESOURCE_ASSIGNMENT',
          event_description: 'Engine 1, Engine 2, and Truck 1 dispatched to scene',
          event_data: { units_assigned: ['Engine 1', 'Engine 2', 'Truck 1'], eta: '4 minutes' },
          actor_name: 'Dispatch',
          actor_role: 'dispatcher',
          timestamp: new Date(Date.now() - 1750000).toISOString(),
          impact_level: 'HIGH',
          outcome: 'All units en route'
        },
        {
          id: 3,
          emergency_id: 1,
          incident_id: 'TL-2024-001-003',
          event_type: 'COMMUNICATION',
          event_description: 'Received update - civilians trapped on second floor',
          event_data: { source: '911 caller', urgency: 'high' },
          actor_name: '911 Operator',
          actor_role: 'dispatcher',
          timestamp: new Date(Date.now() - 1700000).toISOString(),
          impact_level: 'HIGH',
          outcome: 'Escalated response priority'
        },
        {
          id: 4,
          emergency_id: 1,
          incident_id: 'TL-2024-001-004',
          event_type: 'ARRIVAL',
          event_description: 'Engine 1 arrived on scene - fire showing from rear of structure',
          event_data: { unit: 'Engine 1', arrival_time: new Date(Date.now() - 1500000).toISOString() },
          actor_name: 'Engine 1 Captain',
          actor_role: 'authority',
          timestamp: new Date(Date.now() - 1500000).toISOString(),
          impact_level: 'HIGH',
          outcome: 'Fire attack initiated'
        },
        {
          id: 5,
          emergency_id: 1,
          incident_id: 'TL-2024-001-005',
          event_type: 'STATUS_UPDATE',
          event_description: 'Fire knocked down, search and rescue operations ongoing',
          event_data: { fire_status: 'controlled', operations: 'search_and_rescue' },
          actor_name: 'Incident Commander',
          actor_role: 'authority',
          timestamp: new Date(Date.now() - 1200000).toISOString(),
          impact_level: 'MEDIUM',
          outcome: 'Transition to rescue operations'
        }
      ]
    };

    return mockTimelines[emergencyId] || [];
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/communication/timeline', timelineForm);
      
      if (response.data.event_id) {
        setShowEventModal(false);
        setTimelineForm({
          emergency_id: selectedEmergency,
          event_type: 'STATUS_UPDATE',
          event_description: '',
          event_data: {},
          actor_role: user?.role || 'user',
          impact_level: 'MEDIUM',
          outcome: ''
        });
        loadTimeline();
        
        showNotification('Timeline event added successfully!', 'success');
      }
    } catch (error) {
      console.error('Error adding timeline event:', error);
      showNotification('Failed to add timeline event', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type) => {
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const getEventTypeInfo = (type) => {
    return eventTypes.find(et => et.type === type) || eventTypes[0];
  };

  const getImpactLevelColor = (level) => {
    const impact = impactLevels.find(i => i.level === level);
    return impact ? impact.color : '#6b7280';
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupEventsByDate = (events) => {
    const grouped = {};
    events.forEach(event => {
      const date = formatDate(event.timestamp);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    });
    return grouped;
  };

  const getTimeFromStart = (timestamp) => {
    const start = timeline.length > 0 ? new Date(timeline[0].timestamp) : new Date(timestamp);
    const current = new Date(timestamp);
    const diffMs = current - start;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffSeconds = Math.floor((diffMs % 60000) / 1000);
    return `${diffMinutes}:${diffSeconds.toString().padStart(2, '0')}`;
  };

  const groupedEvents = groupEventsByDate(timeline);

  const canAddEvent = user?.role && ['authority', 'admin', 'super_admin'].includes(user.role);

  return (
    <div className="incident-timeline">
      <div className="panel-header">
        <h2>
          📋 Incident Timeline
        </h2>
        <p>Chronological event tracking and decision log</p>
        
        <div className="header-controls">
          <select
            value={selectedEmergency}
            onChange={(e) => setSelectedEmergency(e.target.value)}
            className="emergency-selector"
          >
            <option value="">Select Emergency</option>
            {emergencies.map((emergency) => (
              <option key={emergency.id} value={emergency.id}>
                {emergency.request_id} - {emergency.emergency_type} ({emergency.location})
              </option>
            ))}
          </select>
          
          {canAddEvent && selectedEmergency && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                setTimelineForm(prev => ({ ...prev, emergency_id: selectedEmergency }));
                setShowEventModal(true);
              }}
            >
              ➕ Add Event
            </button>
          )}
        </div>
      </div>

      {selectedEmergency ? (
        <div className="timeline-container">
          {Object.keys(groupedEvents).length === 0 ? (
            <div className="empty-timeline">
              <div className="empty-icon">📋</div>
              <p>No events recorded for this incident</p>
              {canAddEvent && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setTimelineForm(prev => ({ ...prev, emergency_id: selectedEmergency }));
                    setShowEventModal(true);
                  }}
                >
                  Add First Event
                </button>
              )}
            </div>
          ) : (
            <div className="timeline-content">
              <div className="timeline-header">
                <h3>
                  Timeline for Emergency: {
                    emergencies.find(e => e.id.toString() === selectedEmergency)?.request_id
                  }
                </h3>
                <div className="timeline-stats">
                  <span className="stat">
                    📊 {timeline.length} Events
                  </span>
                  <span className="stat">
                    ⏱️ Duration: {
                      timeline.length > 0 
                        ? getTimeFromStart(timeline[timeline.length - 1].timestamp)
                        : '0:00'
                    }
                  </span>
                </div>
              </div>

              <div className="timeline-visual">
                {Object.entries(groupedEvents).map(([date, dateEvents]) => (
                  <div key={date} className="timeline-day">
                    <div className="timeline-date-header">
                      <span className="date-label">{date}</span>
                    </div>
                    
                    <div className="timeline-events">
                      {dateEvents.map((event, index) => {
                        const eventTypeInfo = getEventTypeInfo(event.event_type);
                        return (
                          <div 
                            key={event.id} 
                            className={`timeline-event impact-${event.impact_level.toLowerCase()}`}
                            onClick={() => setSelectedEvent(event)}
                          >
                            <div className="timeline-marker">
                              <div 
                                className="event-icon"
                                style={{ backgroundColor: eventTypeInfo.color }}
                              >
                                {eventTypeInfo.icon}
                              </div>
                              <div className="timeline-line" />
                            </div>
                            
                            <div className="timeline-content">
                              <div className="event-header">
                                <div className="event-meta">
                                  <span className="event-time">
                                    {formatTime(event.timestamp)}
                                  </span>
                                  <span className="event-elapsed">
                                    +{getTimeFromStart(event.timestamp)}
                                  </span>
                                  <span 
                                    className="impact-badge"
                                    style={{ backgroundColor: getImpactLevelColor(event.impact_level) }}
                                  >
                                    {event.impact_level}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="event-body">
                                <h4 className="event-title">
                                  <span 
                                    className="event-type-icon"
                                    style={{ color: eventTypeInfo.color }}
                                  >
                                    {eventTypeInfo.icon}
                                  </span>
                                  {eventTypeInfo.label}
                                </h4>
                                
                                <p className="event-description">
                                  {event.event_description}
                                </p>
                                
                                <div className="event-actor">
                                  <span className="actor-info">
                                    👤 {event.actor_name} ({event.actor_role})
                                  </span>
                                </div>
                                
                                {event.outcome && (
                                  <div className="event-outcome">
                                    <strong>Outcome:</strong> {event.outcome}
                                  </div>
                                )}
                                
                                {event.event_data && Object.keys(event.event_data).length > 0 && (
                                  <div className="event-data">
                                    <details>
                                      <summary>Additional Details</summary>
                                      <div className="event-data-content">
                                        {Object.entries(event.event_data).map(([key, value]) => (
                                          <div key={key} className="data-item">
                                            <span className="data-key">{key.replace(/_/g, ' ')}:</span>
                                            <span className="data-value">
                                              {typeof value === 'object' ? JSON.stringify(value) : value}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="timeline-placeholder">
          <div className="placeholder-icon">📋</div>
          <h3>Select an Emergency</h3>
          <p>Choose an emergency from the dropdown above to view its incident timeline</p>
        </div>
      )}

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add Timeline Event</h2>
              <button 
                className="close-btn"
                onClick={() => setShowEventModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEventSubmit} className="timeline-event-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Event Type</label>
                  <select
                    value={timelineForm.event_type}
                    onChange={(e) => setTimelineForm({...timelineForm, event_type: e.target.value})}
                    required
                  >
                    {eventTypes.map((type) => (
                      <option key={type.type} value={type.type}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Impact Level</label>
                  <select
                    value={timelineForm.impact_level}
                    onChange={(e) => setTimelineForm({...timelineForm, impact_level: e.target.value})}
                    required
                  >
                    {impactLevels.map((level) => (
                      <option key={level.level} value={level.level}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Event Description</label>
                <textarea
                  value={timelineForm.event_description}
                  onChange={(e) => setTimelineForm({...timelineForm, event_description: e.target.value})}
                  placeholder="Detailed description of what happened..."
                  rows="3"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Your Role</label>
                  <input
                    type="text"
                    value={timelineForm.actor_role}
                    onChange={(e) => setTimelineForm({...timelineForm, actor_role: e.target.value})}
                    placeholder="Your role at time of event"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Outcome/Result</label>
                  <input
                    type="text"
                    value={timelineForm.outcome}
                    onChange={(e) => setTimelineForm({...timelineForm, outcome: e.target.value})}
                    placeholder="Result or consequence of this event"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Additional Data (JSON)</label>
                <textarea
                  value={JSON.stringify(timelineForm.event_data, null, 2)}
                  onChange={(e) => {
                    try {
                      const data = JSON.parse(e.target.value);
                      setTimelineForm({...timelineForm, event_data: data});
                    } catch (error) {
                      // Invalid JSON, ignore for now
                    }
                  }}
                  placeholder='{"key": "value", "another_key": "another_value"}'
                  rows="4"
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowEventModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Adding...' : '➕ Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-content event-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Event Details</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedEvent(null)}
              >
                ✕
              </button>
            </div>

            <div className="event-detail-content">
              <div className="event-header-detail">
                <div className="event-type-detail">
                  <span 
                    className="event-icon-detail"
                    style={{ backgroundColor: getEventTypeInfo(selectedEvent.event_type).color }}
                  >
                    {getEventTypeInfo(selectedEvent.event_type).icon}
                  </span>
                  <div>
                    <h3>{getEventTypeInfo(selectedEvent.event_type).label}</h3>
                    <p>{formatTime(selectedEvent.timestamp)} (+{getTimeFromStart(selectedEvent.timestamp)})</p>
                  </div>
                </div>
                
                <span 
                  className="impact-badge-detail"
                  style={{ backgroundColor: getImpactLevelColor(selectedEvent.impact_level) }}
                >
                  {selectedEvent.impact_level} IMPACT
                </span>
              </div>

              <div className="event-description-detail">
                <h4>Description</h4>
                <p>{selectedEvent.event_description}</p>
              </div>

              <div className="event-actor-detail">
                <h4>Actor Information</h4>
                <div className="actor-details">
                  <div className="actor-item">
                    <span className="actor-label">Name:</span>
                    <span className="actor-value">{selectedEvent.actor_name}</span>
                  </div>
                  <div className="actor-item">
                    <span className="actor-label">Role:</span>
                    <span className="actor-value">{selectedEvent.actor_role}</span>
                  </div>
                </div>
              </div>

              {selectedEvent.outcome && (
                <div className="event-outcome-detail">
                  <h4>Outcome</h4>
                  <p>{selectedEvent.outcome}</p>
                </div>
              )}

              {selectedEvent.event_data && Object.keys(selectedEvent.event_data).length > 0 && (
                <div className="event-data-detail">
                  <h4>Additional Data</h4>
                  <div className="data-grid">
                    {Object.entries(selectedEvent.event_data).map(([key, value]) => (
                      <div key={key} className="data-item-detail">
                        <span className="data-key">{key.replace(/_/g, ' ')}</span>
                        <span className="data-value">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setSelectedEvent(null)}
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

export default IncidentTimeline;
