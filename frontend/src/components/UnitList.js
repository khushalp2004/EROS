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

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'AVAILABLE': return 'var(--secondary-green)';
      case 'ENROUTE': return 'var(--primary-blue)';
      case 'ARRIVED': return 'var(--warning-yellow, #ffc107)';
      case 'DEPARTED': return 'var(--gray-600)';
      case 'BUSY': return 'var(--accent-red)';
      case 'DISPATCHED': return 'var(--primary-blue)';
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
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: '15%', textAlign: 'left' }}>Unit ID</th>
            <th style={{ width: '20%', textAlign: 'left' }}>Vehicle Number</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Service Type</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Status</th>
            <th style={{ width: '18%', textAlign: 'center' }}>Location</th>
            <th style={{ width: '15%', textAlign: 'right' }}>Last Update</th>
            <th style={{ width: '8%', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit, index) => (
            <tr
              key={unit.unit_id}
              onClick={() => {
                console.log('🖱️ Unit row clicked:', unit.unit_id);
                if (onSelect) {
                  console.log('✅ Calling onSelect handler...');
                  onSelect(unit);
                } else {
                  console.error('❌ onSelect handler is not available!');
                }
                if (onCenterMap && unit.latitude && unit.longitude) {
                  console.log('📍 Centering map on unit:', unit.unit_id);
                  onCenterMap(unit.latitude, unit.longitude);
                }
              }}
              style={{
                cursor: onSelect || onCenterMap ? "pointer" : "default",
                background: selectedId === unit.unit_id ? "var(--primary-blue-light)" : 
                           index % 2 === 0 ? "transparent" : "var(--gray-50)",
                transition: "all var(--transition-fast)"
              }}
              onMouseEnter={(e) => {
                if (selectedId !== unit.unit_id) {
                  e.target.style.backgroundColor = "var(--gray-100)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedId !== unit.unit_id) {
                  e.target.style.backgroundColor = index % 2 === 0 ? "transparent" : "var(--gray-50)";
                }
              }}
            >
              <td style={{ textAlign: 'left', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
                {getServiceTypeIcon(unit.service_type)} Unit {unit.unit_id}
              </td>
              <td style={{ textAlign: 'left' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)'
                }}>
                  {unit.unit_vehicle_number || 'N/A'}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className="badge" style={{
                  backgroundColor: getStatusColor(unit.status),
                  color: 'var(--text-inverse)',
                  fontSize: 'var(--text-xs)',
                  padding: 'var(--space-1) var(--space-3)'
                }}>
                  {unit.service_type}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className="badge" style={{
                  backgroundColor: getStatusColor(unit.status),
                  color: 'var(--text-inverse)',
                  fontSize: 'var(--text-xs)',
                  padding: 'var(--space-1) var(--space-3)'
                }}>
                  {unit.status}
                </span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)'
                }}>
                  {unit.latitude?.toFixed(4)}, {unit.longitude?.toFixed(4)}
                </div>
              </td>
              <td style={{
                textAlign: 'right',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap'
              }}>
                {formatTime(unit.last_updated)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <div className="btn-group" style={{ 
                  justifyContent: 'center',
                  gap: 'var(--space-2)'
                }}>
                  {selectedId === unit.unit_id ? (
                    <span style={{ 
                      color: "var(--primary-blue)", 
                      fontSize: "var(--text-xs)",
                      fontWeight: 'var(--font-medium)'
                    }}>
                      ✓ Selected
                    </span>
                  ) : (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        console.log('🖱️ Select button clicked for unit:', unit.unit_id);
                        if (onSelect) {
                          console.log('✅ Calling onSelect handler...');
                          onSelect(unit);
                        } else {
                          console.error('❌ onSelect handler is not available!');
                        }
                        if (onCenterMap && unit.latitude && unit.longitude) {
                          console.log('📍 Centering map on unit:', unit.unit_id);
                          onCenterMap(unit.latitude, unit.longitude);
                        }
                      }}
                      className="btn btn-primary btn-sm"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--text-xs)',
                        backgroundColor: 'var(--primary-blue)'
                      }}
                    >
                      📍 Track
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

