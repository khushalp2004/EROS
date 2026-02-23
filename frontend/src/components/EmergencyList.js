import React from "react";
import { getAssignedUnit } from "../utils/DataValidationUtils";

function EmergencyList({
  emergencies = [],
  onSelect,
  onCenterMap,
  selectedId,
  onDispatch,
  onComplete,
  availableByType = {},
  dispatchingEmergencyId = null,
}) {
  const normalizeEmergencyType = (type) => String(type || "").toUpperCase();

  const getEmergencyTypeIcon = (type) => {
    switch (normalizeEmergencyType(type)) {
      case "AMBULANCE": return "🚑";
      case "FIRE_TRUCK": return "🚒";
      case "POLICE": return "🚓";
      default: return "🚨";
    }
  };

  const getEmergencyTypeClass = (type) => `emergency-type-${normalizeEmergencyType(type).toLowerCase().replaceAll("_", "-")}`;
  const getEmergencyStatusClass = (status) => `emergency-status-${String(status || "unknown").toLowerCase()}`;
  const formatEmergencyType = (type) => String(type || "UNKNOWN").replaceAll("_", " ");

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
    <div className="table-container emergency-table-container">
      <table className="table emergency-table">
        <thead>
          <tr>
            <th style={{ width: '12%' }}>Request ID</th>
            <th style={{ width: '17%', textAlign: 'center' }}>Emergency Type</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Status</th>
            <th style={{ width: '17%', textAlign: 'center' }}>Location</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Assigned Unit</th>
            <th style={{ width: '13%' }}>Approved By</th>
            <th style={{ width: '12%', textAlign: 'right' }}>Created At</th>
            <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {emergencies.map((emergency) => {
            const normalizedType = normalizeEmergencyType(emergency.emergency_type);
            const availableForType =
              availableByType[emergency.emergency_type] ??
              availableByType[normalizedType] ??
              0;
            const isDispatching = dispatchingEmergencyId === emergency.request_id;

            return (
              <tr
              key={emergency.request_id}
              className={`emergency-row ${selectedId === emergency.request_id ? "selected" : ""}`}
              onClick={() => {
                onSelect && onSelect(emergency);
                if (onCenterMap && emergency.latitude && emergency.longitude) {
                  onCenterMap(emergency.latitude, emergency.longitude);
                }
              }}
            >
              <td className="emergency-id-cell">
                <span className="emergency-id-chip">🚨 #{emergency.request_id}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className={`emergency-badge emergency-type ${getEmergencyTypeClass(emergency.emergency_type)}`}>
                  <span className="emergency-badge-icon">
                    {getEmergencyTypeIcon(emergency.emergency_type)}
                  </span>
                  {formatEmergencyType(emergency.emergency_type)}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className={`emergency-badge emergency-status ${getEmergencyStatusClass(emergency.status)}`}>
                  {emergency.status}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <div className="emergency-location-cell">
                  {emergency.latitude?.toFixed(4)}, {emergency.longitude?.toFixed(4)}
                </div>
              </td>
              <td style={{ textAlign: 'center' }}>
                <div className={`emergency-assigned-cell ${getAssignedUnit(emergency) ? "assigned" : "unassigned"}`}>
                  {getAssignedUnit(emergency) ? (
                    <span className="emergency-assigned-chip">Unit {getAssignedUnit(emergency)}</span>
                  ) : (
                    '—'
                  )}
                </div>
              </td>
              <td>
                <span className={`emergency-approved-cell ${emergency.approved_by ? "has-value" : "empty"}`}>
                  {emergency.approved_by ?? '—'}
                </span>
              </td>
              <td className="emergency-time-cell" style={{ textAlign: 'right' }}>
                {formatTime(emergency.created_at)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <div className="btn-group emergency-actions-cell">
                  {emergency.status === "PENDING" && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        console.log('🟡 Dispatch button clicked for emergency:', emergency.request_id);
                        console.log('Available units for type:', emergency.emergency_type, availableForType);
                        if (onDispatch) {
                          console.log('✅ Calling onDispatch handler...');
                          onDispatch(emergency);
                        } else {
                          console.error('❌ onDispatch handler is not available!');
                        }
                      }}
                      disabled={availableForType === 0 || isDispatching}
                      className={`emergency-action-btn approve ${(availableForType === 0 || isDispatching) ? "disabled" : ""}`}
                    >
                      {isDispatching ? 'Dispatching...' : (availableForType ? 'Approve' : 'No Unit')}
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
                      className="emergency-action-btn complete"
                    >
                      Complete
                    </button>
                  )}
                  {emergency.status !== "PENDING" && emergency.status !== "ASSIGNED" && (
                    <span className="emergency-action-muted">
                      {emergency.status === 'COMPLETED' ? '✅ Completed' : '—'}
                    </span>
                  )}
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default EmergencyList;
