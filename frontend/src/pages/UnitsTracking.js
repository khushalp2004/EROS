import React, { useEffect, useState } from "react";
import RealtimeMapView from "../components/RealtimeMapView";
import api from "../api";
import { useWebSocket } from "../hooks/useWebSocket";

const UnitsTracking = () => {
  const [units, setUnits] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [trackingMode, setTrackingMode] = useState('all'); // 'all', 'selected', 'simulated'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulationStats, setSimulationStats] = useState({
    activeSimulations: 0,
    totalRoutes: 0,
    estimatedArrivals: []
  });

  const { isConnected, unitLocations } = useWebSocket();

  useEffect(() => {
  fetchUnits();
  fetchEmergencies();

  const interval = setInterval(() => {
    fetchUnits();
    fetchEmergencies();
  }, 5000);

  return () => clearInterval(interval);
}, []);


  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = await api.get('/authority/units');
      setUnits(response.data);
    } catch (err) {
      setError('Failed to fetch units');
      console.error('Error fetching units:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmergencies = async () => {
    try {
      const response = await api.get('/authority/emergencies');
      setEmergencies(response.data);
    } catch (err) {
      console.error('Error fetching emergencies:', err);
    }
  };

  const calculateSimulationStats = () => {
    const activeSims = Object.keys(unitLocations).length;
    const assignedEmergencies = emergencies.filter(e => e.status === 'ASSIGNED');
    const estimatedArrivals = assignedEmergencies.map(emergency => {
      const unit = units.find(u => u.unit_id === emergency.assigned_unit);
      if (!unit) return null;
      
      const distance = calculateDistance(
        unit.latitude, unit.longitude,
        emergency.latitude, emergency.longitude
      );
      // Rough estimation: 30 km/h average speed in city
      const estimatedMinutes = Math.ceil((distance / 30) * 60);
      
      return {
        unitId: emergency.assigned_unit,
        emergencyId: emergency.request_id,
        distance: distance.toFixed(1),
        etaMinutes: estimatedMinutes
      };
    }).filter(Boolean);

    setSimulationStats({
      activeSimulations: activeSims,
      totalRoutes: assignedEmergencies.length,
      estimatedArrivals
    });
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleUnitClick = (unit) => {
    setSelectedUnit(unit);
    setTrackingMode('selected');
  };

  const handleShowAllUnits = () => {
    setSelectedUnit(null);
    setTrackingMode('all');
  };

  const handleToggleSimulation = () => {
    setTrackingMode(trackingMode === 'simulated' ? 'all' : 'simulated');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'AVAILABLE': return '#28a745';
      case 'ENROUTE': return '#007bff';
      case 'ARRIVED': return '#ffc107';
      case 'DEPARTED': return '#6c757d';
      case 'BUSY': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getServiceEmoji = (serviceType) => {
    switch (serviceType) {
      case 'AMBULANCE': return '🚑';
      case 'FIRE_TRUCK': return '🚒';
      case 'POLICE': return '🚓';
      default: return '🚐';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      // Handle both string timestamps and datetime objects
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleTimeString();
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Error';
    }
  };

  // ✅ Utility function: decide route color based on service type
// 🔹 Utility functions FIRST
const getRouteColor = (serviceType) => {
  if (!serviceType) return "#6c757d";
  switch (serviceType.toUpperCase()) {
    case "AMBULANCE": return "#dc3545";
    case "POLICE": return "#0d6efd";
    case "FIRE": return "#fd7e14";
    default: return "#6c757d";
  }
};



  // Prepare route data for visualization
  const routePolylines = React.useMemo(() => {
    const routes = [];
    
    // Get assigned emergencies for route visualization
    const assignedEmergencies = emergencies.filter(e => e.status === 'ASSIGNED');
    
    assignedEmergencies.forEach(emergency => {
      const unit = units.find(u => u.unit_id === emergency.assigned_unit);
      if (unit) {
        // Use real-time location if available, otherwise use unit's current location
        const realtimeLocation = unitLocations[unit.unit_id];
        const unitLat = realtimeLocation ? realtimeLocation.latitude : unit.latitude;
        const unitLon = realtimeLocation ? realtimeLocation.longitude : unit.longitude;
        
        const emergencyLat = emergency.latitude;
        const emergencyLon = emergency.longitude;
        
        routes.push({
          id: `${unit.unit_id}-${emergency.request_id}`,
          positions: [
            [unitLat, unitLon],
            [emergencyLat, emergencyLon]
          ],
          color: getRouteColor(unit.service_type),
          unitId: unit.unit_id,
          emergencyId: emergency.request_id,
          serviceType: unit.service_type,
          isRealtime: !!realtimeLocation
        });
      }
    });
    
    return routes;
  }, [units, emergencies, unitLocations, trackingMode]);

  // Filter routes based on tracking mode
  const filteredRoutes = React.useMemo(() => {
    if (trackingMode === 'all') return routePolylines;
    if (trackingMode === 'selected' && selectedUnit) {
      return routePolylines.filter(route => route.unitId === selectedUnit.unit_id);
    }
    if (trackingMode === 'simulated') {
      return routePolylines.filter(route => route.isRealtime);
    }
    return routePolylines;
  }, [routePolylines, trackingMode, selectedUnit]);


  const getTrackingModeIcon = () => {
    switch (trackingMode) {
      case 'selected': return '🎯';
      case 'simulated': return '🔴';
      default: return '📍';
    }
  };

  // Prepare map markers - show all units or only selected unit
  const mapMarkers = selectedUnit ? [selectedUnit] : units;

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div style={{ fontSize: '18px' }}>Loading units...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'red'
      }}>
        <div>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>{error}</div>
          <button 
            onClick={fetchUnits}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
        padding: '15px 20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              color: '#2c3e50',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              {getTrackingModeIcon()} Real-Time Unit Tracking
            </h1>
            <div style={{ 
              display: 'flex', 
              gap: '20px', 
              marginTop: '5px',
              fontSize: '14px',
              color: '#666'
            }}>
              <span>📍 Total Units: <strong>{units.length}</strong></span>
              <span>🔴 Active Simulations: <strong>{simulationStats.activeSimulations}</strong></span>
              <span>🚨 Assigned Routes: <strong>{simulationStats.totalRoutes}</strong></span>
              <span style={{ 
                color: isConnected ? '#28a745' : '#dc3545',
                fontWeight: 'bold'
              }}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleToggleSimulation}
              style={{
                padding: '8px 16px',
                backgroundColor: trackingMode === 'simulated' ? '#dc3545' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {trackingMode === 'simulated' ? '🔴 Live Tracking' : '📊 All Routes'}
            </button>
            {selectedUnit && (
              <button
                onClick={handleShowAllUnits}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Show All Units
              </button>
            )}
          </div>
        </div>
        
        {/* Route Statistics */}
        {simulationStats.estimatedArrivals.length > 0 && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 'bold', 
              marginBottom: '8px',
              color: '#495057'
            }}>
              🚨 Active Routes & ETA
            </div>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '15px',
              fontSize: '12px'
            }}>
              {simulationStats.estimatedArrivals.slice(0, 3).map((route, index) => (
                <div key={index} style={{ 
                  padding: '4px 8px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  <strong>{getServiceEmoji(units.find(u => u.unit_id === route.unitId)?.service_type)} Unit {route.unitId}</strong>
                  {' → '}
                  <strong>Emergency #{route.emergencyId}</strong>
                  {' | '}
                  <span style={{ color: '#666' }}>
                    {route.distance}km • ETA: {route.etaMinutes}min
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div style={{ 
        flex: '1',
        position: 'relative',
        minHeight: '60%'
      }}>
        <RealtimeMapView
          markers={mapMarkers}
          polylines={filteredRoutes}
          showRealtimeData={true}
          animateRoutes={trackingMode !== 'all'}
          center={selectedUnit ? [selectedUnit.latitude, selectedUnit.longitude] : undefined}
        />
        
        {/* Enhanced Map Legend */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1000,
          minWidth: '200px'
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '8px',
            fontSize: '12px',
            color: '#333',
            borderBottom: '1px solid #eee',
            paddingBottom: '4px'
          }}>
            {getTrackingModeIcon()} {selectedUnit ? `Tracking Unit ${selectedUnit.unit_id}` : `${trackingMode.charAt(0).toUpperCase() + trackingMode.slice(1)} Mode`}
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
            🚑 Ambulance | 🚒 Fire Truck | 🚓 Police | 🚐 Other
          </div>
          {trackingMode !== 'all' && (
            <div style={{ fontSize: '11px', color: '#007bff', marginBottom: '4px' }}>
              🔴 Real-time simulation active
            </div>
          )}
          {filteredRoutes.length > 0 && (
            <div style={{ fontSize: '11px', color: '#28a745' }}>
              📊 {filteredRoutes.length} route(s) visible
            </div>
          )}
        </div>
        
        {/* Tracking Controls */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '8px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1000
        }}>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
            📍 Tracking Mode: <strong>{trackingMode}</strong>
          </div>
          <div style={{ fontSize: '10px', color: '#999' }}>
            {trackingMode === 'simulated' ? '🔴 Live tracking enabled' : 
             trackingMode === 'selected' ? '🎯 Focused tracking' : 
             '📊 All units displayed'}
          </div>
        </div>
      </div>

      {/* Units Table */}
      <div style={{
        backgroundColor: '#fff',
        borderTop: '1px solid #e0e0e0',
        padding: '0',
        maxHeight: '40%',
        overflow: 'auto'
      }}>
        <div style={{ 
          padding: '15px 20px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#f8f9fa'
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '18px',
            color: '#2c3e50',
            fontWeight: '600'
          }}>
            {getTrackingModeIcon()} Units List
          </h2>
          <div style={{ 
            display: 'flex', 
            gap: '20px',
            marginTop: '5px', 
            fontSize: '14px', 
            color: '#666' 
          }}>
            {selectedUnit ? (
              <div>
                Tracking: <strong>{getServiceEmoji(selectedUnit.service_type)} Unit {selectedUnit.unit_id}</strong>
                {' | '}
                <span style={{ color: '#007bff' }}>🎯 Focused View</span>
              </div>
            ) : (
              <div>
                Showing: <strong>{units.length} units</strong>
                {' | '}
                <span style={{ color: simulationStats.activeSimulations > 0 ? '#dc3545' : '#28a745' }}>
                  {simulationStats.activeSimulations > 0 ? '🔴 Live Simulation Active' : '🟢 Static Display'}
                </span>
              </div>
            )}
            {' | '}
            <span style={{ color: '#28a745' }}>
              📊 {filteredRoutes.length} Active Routes
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead style={{ 
              backgroundColor: '#f8f9fa',
              borderBottom: '2px solid #dee2e6'
            }}>
              <tr>
                <th style={{ 
                  padding: '12px 15px', 
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#495057',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  Select
                </th>
                <th style={{ 
                  padding: '12px 15px', 
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#495057',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  Unit ID
                </th>
                <th style={{ 
                  padding: '12px 15px', 
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#495057',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  Service Type
                </th>
                <th style={{ 
                  padding: '12px 15px', 
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#495057',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  Status
                </th>
                <th style={{ 
                  padding: '12px 15px', 
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#495057',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  Location
                </th>
                <th style={{ 
                  padding: '12px 15px', 
                  textAlign: 'left',
                  fontWeight: '600',
                  color: '#495057',
                  borderBottom: '1px solid #dee2e6'
                }}>
                  Last Update
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit, index) => (
                <tr
                  key={unit.unit_id}
                  onClick={() => handleUnitClick(unit)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedUnit?.unit_id === unit.unit_id ? '#e3f2fd' : index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                    borderBottom: '1px solid #dee2e6'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedUnit?.unit_id !== unit.unit_id) {
                      e.target.style.backgroundColor = '#e9ecef';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedUnit?.unit_id !== unit.unit_id) {
                      e.target.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
                    }
                  }}
                >
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: selectedUnit?.unit_id === unit.unit_id ? '#007bff' : '#dee2e6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '12px'
                    }}>
                      {selectedUnit?.unit_id === unit.unit_id ? '✓' : ''}
                    </div>
                  </td>
                  <td style={{ padding: '12px 15px', fontWeight: '600' }}>
                    {getServiceEmoji(unit.service_type)} Unit {unit.unit_id}
                  </td>
                  <td style={{ padding: '12px 15px' }}>
                    {unit.service_type}
                  </td>
                  <td style={{ padding: '12px 15px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'white',
                      backgroundColor: getStatusColor(unit.status)
                    }}>
                      {unit.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 15px', fontFamily: 'monospace' }}>
                    {unit.latitude.toFixed(4)}, {unit.longitude.toFixed(4)}
                  </td>
                  <td style={{ padding: '12px 15px', fontSize: '12px', color: '#666' }}>
                    {formatTime(unit.last_updated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UnitsTracking;
