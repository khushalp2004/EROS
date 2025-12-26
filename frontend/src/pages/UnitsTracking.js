import React, { useEffect, useState, useRef } from "react";
import RealtimeMapView from "../components/RealtimeMapView";
import api, { unitAPI } from "../api";
import { useWebSocketManager, connectionManager } from "../hooks/useWebSocketManager";
import backendRouteManager from "../utils/BackendRouteManager";
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

const UnitsTracking = () => {
  const [units, setUnits] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [trackingMode, setTrackingMode] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulationStats, setSimulationStats] = useState({
    activeSimulations: 0,
    totalRoutes: 0,
    estimatedArrivals: []
  });
  const [routeFetchStatus, setRouteFetchStatus] = useState({});
  const [backendRoutes, setBackendRoutes] = useState([]);

  const { 
    isConnected, 
    unitLocations, 
    connectionError,
    reconnectAttempts,
    refreshUnitLocations,
    reconnect,
    getStats
  } = useWebSocketManager();

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/authority/units');
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
      const response = await api.get('/api/authority/emergencies');
      setEmergencies(response.data);
    } catch (err) {
      console.error('Error fetching emergencies:', err);
    }
  };

  useEffect(() => {
    fetchUnits();
    fetchEmergencies();
  }, []);

  useEffect(() => {
    if (isConnected) {
      console.log('✅ WebSocket connected - centralized real-time tracking enabled');
      refreshUnitLocations();
    }
  }, [isConnected, refreshUnitLocations]);

  useEffect(() => {
    if (!isConnected) return;
    
    const handleEmergencyCreated = (emergency) => {
      console.log('🆕 New emergency created (UnitsTracking):', emergency);
      setEmergencies(prev => {
        const exists = prev.some(e => e.request_id === emergency.request_id);
        if (!exists) {
          return [...prev, emergency];
        }
        return prev;
      });
    };

    const handleEmergencyUpdated = (data) => {
      console.log('📝 Emergency updated (UnitsTracking):', data);
      const { action, emergency } = data;
      
      setEmergencies(prev => {
        return prev.map(e => 
          e.request_id === emergency.request_id ? { ...e, ...emergency } : e
        );
      });
    };

    const handleUnitStatusUpdate = (data) => {
      console.log('📍 Unit status updated (UnitsTracking):', data);
      const { unit_id, status } = data;
      
      setUnits(prev => {
        return prev.map(u => 
          u.unit_id === unit_id ? { ...u, status } : u
        );
      });
    };

    const handleUnitLocationUpdateEnhanced = (data) => {
      console.log('📍 Enhanced unit location update with GPS snapping:', data);
      handleUnitLocationUpdate(data);
    };

    const unsubscribeEmergencyCreated = connectionManager.subscribe('emergency_created', handleEmergencyCreated);
    const unsubscribeEmergencyUpdated = connectionManager.subscribe('emergency_updated', handleEmergencyUpdated);
    const unsubscribeUnitStatusUpdate = connectionManager.subscribe('unit_status_update', handleUnitStatusUpdate);
    const unsubscribeUnitLocationUpdate = connectionManager.subscribe('unit_location_update', handleUnitLocationUpdateEnhanced);

    return () => {
      unsubscribeEmergencyCreated && unsubscribeEmergencyCreated();
      unsubscribeEmergencyUpdated && unsubscribeEmergencyUpdated();
      unsubscribeUnitStatusUpdate && unsubscribeUnitStatusUpdate();
      unsubscribeUnitLocationUpdate && unsubscribeUnitLocationUpdate();
    };
  }, [isConnected]);

  useEffect(() => {
    if (units.length > 0 || emergencies.length > 0) {
      calculateSimulationStats();
    }
  }, [units, emergencies, unitLocations]);

  // ✅ SIMPLIFIED: Use BackendRouteManager for route data
  useEffect(() => {
    const initializeBackendRoutes = async () => {
      try {
        console.log('🗄️ Initializing backend route manager...');
        
        // Start automatic updates from backend
        backendRouteManager.startAutoUpdates(2000); // Update every 2 seconds
        
        // Fetch initial data
        await backendRouteManager.fetchActiveRoutes();
        
        // Get initial routes
        const activeRoutes = backendRouteManager.getAllActiveRoutes();
        setBackendRoutes(activeRoutes);
        
        console.log(`✅ Backend route manager initialized with ${activeRoutes.length} active routes`);
        
      } catch (err) {
        console.error('❌ Failed to initialize backend route manager:', err);
        setError('Failed to initialize route system');
      }
    };
    
    // Initialize when we have data
    if (emergencies.length > 0 && units.length > 0) {
      initializeBackendRoutes();
    }
    
    // Cleanup on unmount
    return () => {
      backendRouteManager.stopAutoUpdates();
    };
  }, [emergencies, units]);

  // Update routes state when backend manager updates
  useEffect(() => {
    const updateInterval = setInterval(() => {
      const activeRoutes = backendRouteManager.getAllActiveRoutes();
      setBackendRoutes(activeRoutes);

      // Update fetch status
      const status = {};
      activeRoutes.forEach(route => {
        status[route.emergency_id] = {
          status: 'success',
          message: `Database route: ${route.route?.positions?.length || 0} waypoints`
        };
      });
      setRouteFetchStatus(status);
    }, 2000);

    return () => clearInterval(updateInterval);
  }, []);

  // Update backend routes with real-time progress from WebSocket
  useEffect(() => {
    // Update route progress in BackendRouteManager when WebSocket data arrives
    Object.entries(unitLocations).forEach(([unitId, locationData]) => {
      if (locationData.progress !== undefined) {
        // Update the progress in the backend route manager
        const routeData = backendRouteManager.getRouteData(unitId);
        if (routeData && routeData.route) {
          routeData.route.progress = locationData.progress;
          console.log(`📊 Updated progress for unit ${unitId}: ${locationData.progress}`);
        }
      }
    });
  }, [unitLocations]);

  const calculateSimulationStats = () => {
    const activeSims = Object.keys(unitLocations).length;
    const assignedEmergencies = emergencies.filter(e => e.status === 'ASSIGNED' && getAssignedUnit(e));
    const estimatedArrivals = assignedEmergencies.map(emergency => {
      const assignedUnitId = getAssignedUnit(emergency);
      const unit = units.find(u => u.unit_id === assignedUnitId);
      if (!unit) return null;
      
      const distance = calculateDistance(
        unit.latitude, unit.longitude,
        emergency.latitude, emergency.longitude
      );
      const estimatedMinutes = Math.ceil((distance / 30) * 60);
      
      return {
        unitId: assignedUnitId,
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
    const R = 6371;
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
    console.log(`🎯 Selected Unit ${unit.unit_id} for focused tracking`);
  };

  const handleShowAllUnits = () => {
    setSelectedUnit(null);
    setTrackingMode('all');
  };

  const handleToggleSimulation = () => {
    const newMode = trackingMode === 'simulated' ? 'all' : 'simulated';
    setTrackingMode(newMode);
    console.log(`${newMode === 'simulated' ? '🔴 Live' : '📊 All'} tracking mode enabled`);
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
      case 'AMBULANCE': return '';
      case 'FIRE_TRUCK': return '';
      case 'POLICE': return '';
      default: return '';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleTimeString();
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Error';
    }
  };

  const getRouteColor = (serviceType) => {
    if (!serviceType) return "#6c757d";
    switch (serviceType.toUpperCase()) {
      case "AMBULANCE": return "#dc3545";
      case "POLICE": return "#0d6efd";
      case "FIRE": return "#fd7e14";
      default: return "#6c757d";
    }
  };

  // ✅ ENHANCED: Build polylines using backend route data with real-time progress
  const realtimeRoutePolylines = React.useMemo(() => {
    const polylines = [];

    // Use backend route data directly
    backendRoutes.forEach(routeData => {
      const { unit_id, emergency_id, route, unit } = routeData;

      if (!route?.positions || !Array.isArray(route.positions) || route.positions.length === 0) {
        return; // Skip if no route data
      }

      // Get real-time progress from WebSocket data (backend-calculated)
      const realtimeLocation = unitLocations[unit_id];
      const realtimeProgress = realtimeLocation?.progress;

      // Use real-time progress if available, otherwise fallback to route progress
      const progress = (realtimeProgress !== undefined && realtimeProgress !== null)
        ? realtimeProgress
        : (route.progress || 0);

      // Create polyline with backend data and real-time progress
      polylines.push({
        id: `${unit_id}-${emergency_id}`,
        positions: route.positions,
        color: getRouteColor(unit?.service_type),
        unitId: unit_id,
        emergencyId: emergency_id,
        serviceType: unit?.service_type,
        isRealtime: true,
        progress: progress,
        isUsingRealtimeProgress: realtimeProgress !== undefined,
        isUsingCachedRoute: true,
        source: 'backend',
        totalDistance: route.total_distance,
        estimatedDuration: route.estimated_duration
      });
    });

    // Filter based on tracking mode
    let filteredPolylines = polylines;

    if (trackingMode === 'simulated') {
      filteredPolylines = polylines.filter(route => route.isRealtime);
    } else if (trackingMode === 'selected' && selectedUnit) {
      filteredPolylines = polylines.filter(route => route.unitId === selectedUnit.unit_id);
    }

    console.log(`🛣️ Backend routes: ${filteredPolylines.length} polylines, ${trackingMode} mode, real-time progress: ${filteredPolylines.some(p => p.isUsingRealtimeProgress)}`);

    return filteredPolylines;
  }, [backendRoutes, trackingMode, selectedUnit, unitLocations]);

  // ✅ SIMPLIFIED: Simple GPS update handling
  const handleUnitLocationUpdate = (data) => {
    console.log('📍 GPS data received:', data);
    
    // For now, just log the GPS data - backend handles route calculations
    if (data && data.unit_id) {
      console.log(`📍 Unit ${data.unit_id} GPS update:`, {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        status: data.status
      });
    }
  };

  const getTrackingModeIcon = () => {
    switch (trackingMode) {
      case 'selected': return '🎯';
      case 'simulated': return '🔴';
      default: return '📍';
    }
  };

  // ✅ SIMPLIFIED: Generate markers using backend route data
  const mapMarkers = React.useMemo(() => {
    const baseMarkers = selectedUnit ? [selectedUnit] : units;
    
    return baseMarkers.map(unit => {
      // Get backend route data for this unit
      const backendRoute = backendRoutes.find(route => route.unit_id === unit.unit_id);
      
      if (backendRoute?.route?.current_position) {
        // Use backend-calculated current position
        return {
          ...unit,
          latitude: backendRoute.route.current_position[0],
          longitude: backendRoute.route.current_position[1],
          isRealtime: true,
          isBackendCalculated: true,
          progress: backendRoute.route.progress,
          lastUpdate: Date.now()
        };
      } else if (unitLocations[unit.unit_id]) {
        // Fallback to real-time location
        return {
          ...unit,
          latitude: unitLocations[unit.unit_id].latitude,
          longitude: unitLocations[unit.unit_id].longitude,
          isRealtime: true,
          isBackendCalculated: false,
          lastUpdate: unitLocations[unit.unit_id].timestamp
        };
      } else {
        // Use original unit position
        return {
          ...unit,
          isRealtime: false,
          isBackendCalculated: false
        };
      }
    });
  }, [selectedUnit, units, unitLocations, backendRoutes]);

  if (loading) {
    return (
      <div className="tracking-layout">
        <div className="tracking-loading">
          <div className="spinner"></div>
          <div>Loading units...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tracking-layout">
        <div className="tracking-loading">
          <div style={{ color: 'var(--accent-red)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
          <button 
            onClick={fetchUnits}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tracking-layout">
      <div className="tracking-header">
        <div className="container">
          <h1 className="page-title">
            📍 Real-Time Unit Tracking
          </h1>
          <p className="page-subtitle">
            Monitor emergency response units with live tracking and route optimization
          </p>
        </div>
      </div>

      <div className="card" style={{ margin: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          gap: 'var(--space-6)',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-4)'
            }}>
              <div className="route-stat-item" style={{ textAlign: 'center' }}>
                <div className="stat-icon">📍</div>
                <div className="stat-value">{units.length}</div>
                <div className="stat-label">Total Units</div>
              </div>
              <div className="route-stat-item" style={{ textAlign: 'center' }}>
                <div className="stat-icon">🔴</div>
                <div className="stat-value">{simulationStats.activeSimulations}</div>
                <div className="stat-label">Live Simulations</div>
              </div>
              <div className="route-stat-item" style={{ textAlign: 'center' }}>
                <div className="stat-icon">🚨</div>
                <div className="stat-value">{simulationStats.totalRoutes}</div>
                <div className="stat-label">Assigned Routes</div>
              </div>
              <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                <div className="status-dot"></div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)' }}>WebSocket Status</div>
                </div>
              </div>
              <div className="route-stat-item" style={{ textAlign: 'center' }}>
                <div className="stat-icon">🎯</div>
                <div className="stat-value">Backend</div>
                <div className="stat-label">Route System</div>
              </div>
            </div>
            
            {connectionError && (
              <div style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--accent-red)',
                color: 'var(--text-inverse)',
                borderRadius: 'var(--radius-lg)',
                marginTop: 'var(--space-3)',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>Connection Error: {connectionError}</span>
                <button 
                  onClick={reconnect}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'var(--text-inverse)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: 'var(--text-xs)'
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            
            {reconnectAttempts > 0 && (
              <div style={{ 
                marginTop: 'var(--space-2)',
                fontSize: 'var(--text-xs)',
                color: 'var(--accent-red)',
                textAlign: 'center'
              }}>
                Reconnecting... {reconnectAttempts}/5
              </div>
            )}
          </div>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: 'var(--space-3)',
            minWidth: '200px'
          }}>
            <button
              onClick={handleToggleSimulation}
              className={`btn btn-lg ${trackingMode === 'simulated' ? 'btn-danger' : 'btn-primary'}`}
              style={{
                width: '100%',
                justifyContent: 'center',
                fontWeight: 'var(--font-semibold)'
              }}
            >
              {trackingMode === 'simulated' ? '🔴 Live Tracking' : '📊 All Routes'}
            </button>
            
            {selectedUnit && (
              <button
                onClick={handleShowAllUnits}
                className="btn btn-outline"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  borderColor: 'var(--gray-600)',
                  color: 'var(--gray-600)'
                }}
              >
                Show All Units
              </button>
            )}
            
            <button
              onClick={async () => {
                await fetchUnits();
                await fetchEmergencies();
                refreshUnitLocations();
              }}
              className="btn btn-success"
              style={{
                width: '100%',
                justifyContent: 'center'
              }}
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>
        
        {simulationStats.estimatedArrivals.length > 0 && (
          <div style={{
            marginTop: 'var(--space-6)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--gray-50)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--gray-200)'
          }}>
            <div style={{ 
              fontSize: 'var(--text-base)', 
              fontWeight: 'var(--font-semibold)', 
              marginBottom: 'var(--space-3)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              🚨 Active Routes & ETA
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--space-3)'
            }}>
              {simulationStats.estimatedArrivals.slice(0, 3).map((route, index) => (
                <div key={index} style={{ 
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--gray-200)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-2)',
                    fontWeight: 'var(--font-medium)',
                    marginBottom: 'var(--space-2)'
                  }}>
                    <span style={{ fontSize: 'var(--text-lg)' }}>
                      {getServiceEmoji(units.find(u => u.unit_id === route.unitId)?.service_type)}
                    </span>
                    <strong>Unit {route.unitId}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <strong>Emergency #{route.emergencyId}</strong>
                  </div>
                  <div style={{ 
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)'
                  }}>
                    <span>
                      📍 {route.distance}km
                    </span>
                    <span>
                      ⏱️ ETA: {route.etaMinutes}min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ 
        margin: 'var(--space-6)',
        marginBottom: 'var(--space-4)',
        overflow: 'hidden',
        flex: '1',
        minHeight: '60%'
      }}>
        <div className="map-container" style={{ 
          height: '500px',
          position: 'relative'
        }}>
          <RealtimeMapView
            key={`map-${trackingMode}-${selectedUnit?.unit_id || 'all'}`}
            markers={mapMarkers}
            polylines={realtimeRoutePolylines}
            showRealtimeData={true}
            animateRoutes={trackingMode !== 'all'}
            center={selectedUnit ? [selectedUnit.latitude, selectedUnit.longitude] : undefined}
          />
          
          <div className="map-legend">
            <div style={{ 
              fontWeight: 'var(--font-semibold)', 
              marginBottom: 'var(--space-3)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--gray-200)',
              paddingBottom: 'var(--space-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              {getTrackingModeIcon()} {selectedUnit ? `Tracking Unit ${selectedUnit.unit_id}` : `${trackingMode.charAt(0).toUpperCase() + trackingMode.slice(1)} Mode`}
            </div>
            <div style={{ 
              fontSize: 'var(--text-xs)', 
              color: 'var(--text-secondary)', 
              marginBottom: 'var(--space-2)',
              lineHeight: 1.5
            }}>
               Ambulance |  Fire Truck |  Police |  Other Units
            </div>
            
            {Object.keys(routeFetchStatus).length > 0 && (
              <div style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-2)',
                backgroundColor: 'var(--gray-50)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--gray-200)'
              }}>
                <div style={{ 
                  fontSize: 'var(--text-xs)', 
                  fontWeight: 'var(--font-semibold)',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)'
                }}>
                  🗄️ Database Route Status
                </div>
                {Object.entries(routeFetchStatus).map(([emergencyId, status]) => (
                  <div key={emergencyId} style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--text-xs)',
                    marginBottom: 'var(--space-1)',
                    padding: 'var(--space-1)',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 
                        status.status === 'fetching' ? '#ffc107' :
                        status.status === 'success' ? '#28a745' :
                        status.status === 'error' ? '#dc3545' :
                        '#6c757d',
                      flexShrink: 0
                    }}></span>
                    <span style={{ 
                      fontWeight: 'var(--font-medium)',
                      color: 'var(--text-primary)'
                    }}>
                      Emergency #{emergencyId}
                    </span>
                    <span style={{ 
                      color: 'var(--text-secondary)',
                      flex: 1
                    }}>
                      {status.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {trackingMode !== 'all' && (
              <div style={{ 
                fontSize: 'var(--text-xs)', 
                color: 'var(--primary-blue)', 
                marginTop: 'var(--space-2)',
                marginBottom: 'var(--space-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)'
              }}>
                🔴 Real-time simulation active
              </div>
            )}
            {realtimeRoutePolylines.length > 0 && (
              <div style={{ 
                fontSize: 'var(--text-xs)', 
                color: 'var(--secondary-green)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)'
              }}>
                📊 {realtimeRoutePolylines.length} route(s) visible
              </div>
            )}
          </div>
          
          <div style={{
            position: 'absolute',
            bottom: 'var(--space-4)',
            left: 'var(--space-4)',
            backgroundColor: 'var(--bg-overlay)',
            backdropFilter: 'blur(8px)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--gray-200)',
            zIndex: 1000
          }}>
            <div style={{ 
              fontSize: 'var(--text-xs)', 
              color: 'var(--text-secondary)', 
              marginBottom: 'var(--space-1)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)'
            }}>
              📍 Tracking Mode: <strong>{trackingMode}</strong>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {trackingMode === 'simulated' ? '🔴 Live tracking enabled' : 
               trackingMode === 'selected' ? '🎯 Focused tracking' : 
               '📊 All units displayed'}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{
        margin: 'var(--space-6)',
        marginTop: 'var(--space-4)',
        border: '1px solid var(--gray-200)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        maxHeight: '40%'
      }}>
        <div style={{ 
          padding: 'var(--space-6)',
          backgroundColor: 'var(--gray-50)',
          borderBottom: '1px solid var(--gray-200)'
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: 'var(--text-lg)',
            color: 'var(--text-primary)',
            fontWeight: 'var(--font-semibold)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)'
          }}>
            {getTrackingModeIcon()} Units Management
          </h2>
          <div style={{ 
            display: 'flex', 
            gap: 'var(--space-6)',
            marginTop: 'var(--space-3)', 
            fontSize: 'var(--text-sm)', 
            color: 'var(--text-secondary)',
            flexWrap: 'wrap'
          }}>
            {selectedUnit ? (
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <strong>{getServiceEmoji(selectedUnit.service_type)} Unit {selectedUnit.unit_id}</strong>
                <span className="badge" style={{ 
                  backgroundColor: 'var(--primary-blue)',
                  color: 'var(--text-inverse)',
                  fontSize: 'var(--text-xs)'
                }}>
                  🎯 Focused View
                </span>
              </div>
            ) : (
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <strong>{units.length} units</strong>
                <span className={`badge ${simulationStats.activeSimulations > 0 ? 'badge-danger' : 'badge-success'}`}>
                  {simulationStats.activeSimulations > 0 ? '🔴 Live Simulation' : '🟢 Static Display'}
                </span>
              </div>
            )}
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              <span className="badge badge-info">
                📊 {realtimeRoutePolylines.length} Active Routes
              </span>
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="enhanced-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Unit ID</th>
                <th>Service Type</th>
                <th>Status</th>
                <th>Location</th>
                <th>Last Update</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit, index) => (
                <tr
                  key={unit.unit_id}
                  className={`interactive-element ${selectedUnit?.unit_id === unit.unit_id ? 'selected' : ''}`}
                  onClick={() => handleUnitClick(unit)}
                >
                  <td>
                    <div className="unit-selector">
                      {selectedUnit?.unit_id === unit.unit_id ? '✓' : ''}
                    </div>
                  </td>
                  <td style={{ fontWeight: 'var(--font-semibold)' }}>
                    {getServiceEmoji(unit.service_type)} Unit {unit.unit_id}
                  </td>
                  <td>
                    <span className={`status-badge ${unit.status.toLowerCase()}`}>
                      {unit.service_type}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${unit.status.toLowerCase()}`}>
                      {unit.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                    {unit.latitude.toFixed(4)}, {unit.longitude.toFixed(4)}
                  </td>
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
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
