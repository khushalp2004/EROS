import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

const EmergencyBroadcastPanel = () => {
  const { user } = useAuth();
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    emergency_code: '',
    priority_level: 'URGENT',
    title: '',
    message: '',
    location: '',
    auto_escalate: false,
    escalation_timeout: 300
  });

  const emergencyCodes = [
    { code: 'Code Red', label: 'Fire Emergency', color: '#dc2626', icon: '🔥' },
    { code: 'Code Blue', label: 'Medical Emergency', color: '#2563eb', icon: '🚑' },
    { code: 'Code Black', label: 'Security Threat', color: '#000000', icon: '🚨' },
    { code: 'Code Yellow', label: 'Evacuation', color: '#eab308', icon: '⚠️' },
    { code: 'Code Orange', label: 'Mass Casualty', color: '#ea580c', icon: '🏥' },
    { code: 'Code Green', label: 'All Clear', color: '#16a34a', icon: '✅' }
  ];

  const priorityLevels = [
    { level: 'CRITICAL', label: 'Critical', color: '#dc2626' },
    { level: 'URGENT', label: 'Urgent', color: '#ea580c' },
    { level: 'IMPORTANT', label: 'Important', color: '#eab308' },
    { level: 'ROUTINE', label: 'Routine', color: '#16a34a' }
  ];

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const fetchBroadcasts = async () => {
    try {
      const response = await api.get('/communication/broadcasts?limit=10');
      setBroadcasts(response.data.broadcasts || []);
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    }
  };

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/communication/broadcast', broadcastForm);
      
      if (response.data.broadcast_id) {
        setShowBroadcastModal(false);
        setBroadcastForm({
          emergency_code: '',
          priority_level: 'URGENT',
          title: '',
          message: '',
          location: '',
          auto_escalate: false,
          escalation_timeout: 300
        });
        fetchBroadcasts();
        
        // Show success notification
        showNotification('Emergency broadcast sent successfully!', 'success');
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      showNotification('Failed to send emergency broadcast', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (broadcastId, response = '') => {
    try {
      await api.post(`/communication/broadcast/${broadcastId}/acknowledge`, { response });
      fetchBroadcasts();
      showNotification('Broadcast acknowledged', 'success');
    } catch (error) {
      console.error('Error acknowledging broadcast:', error);
      showNotification('Failed to acknowledge broadcast', 'error');
    }
  };

  const showNotification = (message, type) => {
    // This would integrate with your notification system
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const getBroadcastIcon = (code) => {
    const emergencyCode = emergencyCodes.find(ec => ec.code === code);
    return emergencyCode ? emergencyCode.icon : '📢';
  };

  const getBroadcastColor = (code, priority) => {
    const emergencyCode = emergencyCodes.find(ec => ec.code === code);
    if (emergencyCode) return emergencyCode.color;
    
    const priorityObj = priorityLevels.find(p => p.level === priority);
    return priorityObj ? priorityObj.color : '#6b7280';
  };

  const canBroadcast = user?.role && ['authority', 'admin', 'super_admin'].includes(user.role);

  return (
    <div className="emergency-broadcast-panel">
      <div className="panel-header">
        <h2>
          📢 Emergency Broadcast System
        </h2>
        <p>Send critical alerts to all units instantly</p>
        
        {canBroadcast && (
          <button 
            className="btn btn-primary emergency-broadcast-btn"
            onClick={() => setShowBroadcastModal(true)}
          >
            🚨 Send Emergency Broadcast
          </button>
        )}
      </div>

      <div className="broadcasts-list">
        <h3>Recent Broadcasts</h3>
        
        {broadcasts.length === 0 ? (
          <div className="no-broadcasts">
            <div className="empty-state">
              <div className="empty-icon">📡</div>
              <p>No emergency broadcasts sent yet</p>
            </div>
          </div>
        ) : (
          <div className="broadcasts-grid">
            {broadcasts.map((broadcast) => (
              <div 
                key={broadcast.id} 
                className={`broadcast-card priority-${broadcast.priority_level.toLowerCase()}`}
                style={{ borderLeftColor: getBroadcastColor(broadcast.emergency_code, broadcast.priority_level) }}
              >
                <div className="broadcast-header">
                  <div className="broadcast-code">
                    <span className="broadcast-icon">
                      {getBroadcastIcon(broadcast.emergency_code)}
                    </span>
                    <span className="code-text">{broadcast.emergency_code}</span>
                  </div>
                  
                  <div className={`priority-badge ${broadcast.priority_level.toLowerCase()}`}>
                    {broadcast.priority_level}
                  </div>
                </div>

                <div className="broadcast-content">
                  <h4 className="broadcast-title">{broadcast.title}</h4>
                  <p className="broadcast-message">{broadcast.message}</p>
                  
                  {broadcast.location && (
                    <div className="broadcast-location">
                      📍 {broadcast.location}
                    </div>
                  )}
                  
                  <div className="broadcast-meta">
                    <span className="broadcast-time">
                      {new Date(broadcast.created_at).toLocaleString()}
                    </span>
                    <span className="broadcast-status">{broadcast.status}</span>
                  </div>

                  {broadcast.acknowledgment_stats && (
                    <div className="acknowledgment-stats">
                      <div className="stat">
                        <span className="stat-value">{broadcast.acknowledgment_stats.acknowledged}</span>
                        <span className="stat-label">Acknowledged</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{broadcast.acknowledgment_stats.total}</span>
                        <span className="stat-label">Total</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{broadcast.acknowledgment_stats.percentage}%</span>
                        <span className="stat-label">Rate</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="broadcast-actions">
                  {broadcast.status === 'SENT' && !broadcast.acknowledgments?.[user?.unit_id] && (
                    <div className="ack-buttons">
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={() => handleAcknowledge(broadcast.id, 'Acknowledged - proceeding to scene')}
                      >
                        ✅ Acknowledge
                      </button>
                      <button 
                        className="btn btn-warning btn-sm"
                        onClick={() => handleAcknowledge(broadcast.id, 'Acknowledged - need clarification')}
                      >
                        ❓ Need Info
                      </button>
                    </div>
                  )}
                  
                  {broadcast.auto_escalate && (
                    <div className="escalation-indicator">
                      ⏰ Auto-escalation enabled ({Math.floor(broadcast.escalation_timeout / 60)}min)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Broadcast Modal */}
      {showBroadcastModal && (
        <div className="modal-overlay" onClick={() => setShowBroadcastModal(false)}>
          <div className="modal-content emergency-broadcast-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🚨 Send Emergency Broadcast</h2>
              <button 
                className="close-btn"
                onClick={() => setShowBroadcastModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBroadcastSubmit} className="broadcast-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Emergency Code</label>
                  <select
                    value={broadcastForm.emergency_code}
                    onChange={(e) => setBroadcastForm({...broadcastForm, emergency_code: e.target.value})}
                    required
                  >
                    <option value="">Select emergency code</option>
                    {emergencyCodes.map((code) => (
                      <option key={code.code} value={code.code}>
                        {code.icon} {code.code} - {code.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority Level</label>
                  <select
                    value={broadcastForm.priority_level}
                    onChange={(e) => setBroadcastForm({...broadcastForm, priority_level: e.target.value})}
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
                <label>Broadcast Title</label>
                <input
                  type="text"
                  value={broadcastForm.title}
                  onChange={(e) => setBroadcastForm({...broadcastForm, title: e.target.value})}
                  placeholder="Brief description of the emergency"
                  required
                />
              </div>

              <div className="form-group">
                <label>Detailed Message</label>
                <textarea
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm({...broadcastForm, message: e.target.value})}
                  placeholder="Detailed information about the emergency, instructions, etc."
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label>Location (Optional)</label>
                <input
                  type="text"
                  value={broadcastForm.location}
                  onChange={(e) => setBroadcastForm({...broadcastForm, location: e.target.value})}
                  placeholder="Emergency location or address"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={broadcastForm.auto_escalate}
                      onChange={(e) => setBroadcastForm({...broadcastForm, auto_escalate: e.target.checked})}
                    />
                    Enable Auto-Escalation
                  </label>
                </div>

                {broadcastForm.auto_escalate && (
                  <div className="form-group">
                    <label>Escalation Timeout (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={Math.floor(broadcastForm.escalation_timeout / 60)}
                      onChange={(e) => setBroadcastForm({
                        ...broadcastForm, 
                        escalation_timeout: parseInt(e.target.value) * 60
                      })}
                    />
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowBroadcastModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-danger"
                  disabled={loading || !broadcastForm.emergency_code || !broadcastForm.title || !broadcastForm.message}
                >
                  {loading ? 'Sending...' : '📢 Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyBroadcastPanel;
