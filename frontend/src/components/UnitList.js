import React from "react";

function UnitList({
  units = [],
  onSelect,
  selectedId,
  onCenterMap,
}) {
  const getServiceTypeIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'AMBULANCE': return '🚑';
      case 'FIRE_TRUCK': return '🚒';
      case 'POLICE': return '🚓';
      default: return '🚐';
    }
  };

  const getStatusClass = (status) => `status-${(status || "unknown").toLowerCase()}`;
  const getServiceClass = (serviceType) => `service-${(serviceType || "other").toLowerCase().replace("_", "-")}`;
  const formatServiceType = (serviceType) => (serviceType || "OTHER").replaceAll("_", " ");

  const formatTime = (timestamp) => {
    if (!timestamp) return '—';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return '—';
    }
  };

  if (!units.length) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🚐</div>
        <h3 className="empty-state-title">No Units Found</h3>
        <p className="empty-state-description">
          No emergency response units have been registered yet. Add new units to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="table-container unit-table-container">
      <table className="table unit-table">
        <thead>
          <tr>
            <th style={{ width: '15%' }}>Unit ID</th>
            <th style={{ width: '20%' }}>Vehicle Number</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Service Type</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Status</th>
            <th style={{ width: '18%', textAlign: 'center' }}>Location</th>
            <th style={{ width: '15%', textAlign: 'right' }}>Last Update</th>
            <th style={{ width: '8%', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <tr
              key={unit.unit_id}
              className={`unit-row ${selectedId === unit.unit_id ? "selected" : ""}`}
              onClick={() => {
                if (onSelect) {
                  onSelect(unit);
                }
                if (onCenterMap && unit.latitude && unit.longitude) {
                  onCenterMap(unit.latitude, unit.longitude);
                }
              }}
            >
              <td className="unit-id-cell">
                <span className="unit-id-chip">{getServiceTypeIcon(unit.service_type)} Unit {unit.unit_id}</span>
              </td>
              <td>
                <span className="unit-vehicle-number">{unit.unit_vehicle_number || 'N/A'}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className={`unit-badge service ${getServiceClass(unit.service_type)}`}>
                  {formatServiceType(unit.service_type)}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className={`unit-badge status ${getStatusClass(unit.status)}`}>
                  {unit.status}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <div className="unit-location-cell">
                  {unit.latitude?.toFixed(4)}, {unit.longitude?.toFixed(4)}
                </div>
              </td>
              <td className="unit-time-cell" style={{ textAlign: 'right' }}>
                {formatTime(unit.last_updated)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <div className="btn-group unit-actions-cell">
                  {selectedId === unit.unit_id ? (
                    <span className="unit-selected-label">
                      ✓ Selected
                    </span>
                  ) : (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        if (onSelect) {
                          onSelect(unit);
                        }
                        if (onCenterMap && unit.latitude && unit.longitude) {
                          onCenterMap(unit.latitude, unit.longitude);
                        }
                      }}
                      className="emergency-action-btn complete unit-track-btn"
                    >
                      Track
                    </button>
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

export default UnitList;
