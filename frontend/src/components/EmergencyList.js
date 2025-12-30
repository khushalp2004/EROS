import React from "react";
import { 
  isEmergency, 
  isUnit, 
  getAssignedUnit, 
  getUnitId, 
  safeGet, 
  validateEmergency,
  validateUnit,
  logDataError
} from "../utils/DataValidationUtils";

function EmergencyList({
  emergencies = [],
  onSelect,
  onCenterMap,
  selectedId,
  onDispatch,
  onComplete,
  availableByType = {},
}) {
  const getEmergencyTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'ambulance': return '';
      case 'fire': return '';
      case 'police': return '';
      default: return '🚨';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': return 'var(--status-pending)';
      case 'APPROVED': return 'var(--primary-blue)';
      case 'ASSIGNED': return 'var(--status-assigned)';
      case 'COMPLETED': return 'var(--status-completed)';
      default: return 'var(--gray-600)';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '—';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return '—';
    }
  };

  if (!emergencies.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🚨</div>
        <h3 className="empty-state-title">No Emergency Requests</h3>
        <p className="empty-state-description">
          No emergency requests have been reported yet. This is good news!
        </p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Emergency Type</th>
            <th>Status</th>
            <th>Location</th>
            <th>Assigned Unit</th>
            <th>Approved By</th>
            <th>Created At</th>
            <th style={{ textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {emergencies.map((emergency, index) => (
            <tr
              key={emergency.request_id}
              onClick={() => {
                onSelect && onSelect(emergency);
                if (onCenterMap && emergency.latitude && emergency.longitude) {
                  onCenterMap(emergency.latitude, emergency.longitude);
                }
              }}
              style={{
                cursor: onSelect || onCenterMap ? "pointer" : "default",
                background: selectedId === emergency.request_id ? "var(--primary-blue-light)" : 
                           index % 2 === 0 ? "transparent" : "var(--gray-50)",
                transition: "all var(--transition-fast)"
              }}
              onMouseEnter={(e) => {
                if (selectedId !== emergency.request_id) {
                  e.target.style.backgroundColor = "var(--gray-100)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedId !== emergency.request_id) {
                  e.target.style.backgroundColor = index % 2 === 0 ? "transparent" : "var(--gray-50)";
                }
              }}
            >
              <td style={{ fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                #{emergency.request_id}
              </td>
              <td>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--space-2)',
                  fontWeight: 'var(--font-medium)'
                }}>
                  <span style={{ fontSize: 'var(--text-lg)' }}>
                    {getEmergencyTypeIcon(emergency.emergency_type)}
                  </span>
                  <span>{emergency.emergency_type}</span>
                </div>
              </td>
              <td>
                <span className="badge" style={{ 
                  backgroundColor: getStatusColor(emergency.status),
                  color: 'var(--text-inverse)',
                  fontSize: 'var(--text-xs)',
                  padding: 'var(--space-1) var(--space-3)'
                }}>
                  {emergency.status}
                </span>
              </td>
              <td>
                <div style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)'
                }}>
                  {emergency.latitude?.toFixed(4)}, {emergency.longitude?.toFixed(4)}
                </div>
              </td>
              <td>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--space-1)',
                  fontWeight: 'var(--font-medium)',
                  color: getAssignedUnit(emergency) ? 'var(--text-primary)' : 'var(--text-muted)'
                }}>
                  {getAssignedUnit(emergency) ? (
                    <>
                       Unit {getAssignedUnit(emergency)}
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </td>
              <td>
                <span style={{ 
                  color: emergency.approved_by ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: emergency.approved_by ? 'var(--font-medium)' : 'var(--font-normal)'
                }}>
                  {emergency.approved_by ?? '—'}
                </span>
              </td>
              <td style={{ 
                fontSize: 'var(--text-sm)', 
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap'
              }}>
                {formatTime(emergency.created_at)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <div className="btn-group" style={{ 
                  justifyContent: 'center',
                  gap: 'var(--space-2)'
                }}>
                  {emergency.status === "PENDING" && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        console.log('🟡 Dispatch button clicked for emergency:', emergency.request_id);
                        console.log('Available units for type:', emergency.emergency_type, availableByType[emergency.emergency_type] || 0);
                        if (onDispatch) {
                          console.log('✅ Calling onDispatch handler...');
                          onDispatch(emergency);
                        } else {
                          console.error('❌ onDispatch handler is not available!');
                        }
                      }}
                      disabled={(availableByType[emergency.emergency_type] || 0) === 0}
                      className="btn btn-success btn-sm"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        backgroundColor: (availableByType[emergency.emergency_type] || 0) === 0 ? 
                          'var(--gray-400)' : 'var(--secondary-green)',
                        cursor: (availableByType[emergency.emergency_type] || 0) === 0 ? 
                          'not-allowed' : 'pointer',
                        opacity: (availableByType[emergency.emergency_type] || 0) === 0 ? 0.6 : 1
                      }}
                    >
                      {availableByType[emergency.emergency_type] ? 
                        '✅ Approve & Dispatch' : 
                        '⏳ No Units Available'
                      }
                    </button>
                  )}
                  {emergency.status === "ASSIGNED" && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        console.log('🟡 Complete button clicked for emergency:', emergency.request_id);
                        if (onComplete) {
                          console.log('✅ Calling onComplete handler...');
                          onComplete(emergency);
                        } else {
                          console.error('❌ onComplete handler is not available!');
                        }
                      }}
                      className="btn btn-primary btn-sm"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        backgroundColor: 'var(--primary-blue)'
                      }}
                    >
                      ✅ Mark Complete
                    </button>
                  )}
                  {emergency.status !== "PENDING" && emergency.status !== "ASSIGNED" && (
                    <span style={{ 
                      color: "var(--text-muted)", 
                      fontSize: "var(--text-xs)",
                      fontStyle: 'italic'
                    }}>
                      {emergency.status === 'COMPLETED' ? '✅ Completed' : '—'}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EmergencyList;

