import React, { useEffect, useState, useRef } from "react";
import "../styles/dashboard-styles.css";
import RealtimeMapView from "../components/RealtimeMapView";
import AddUnit from "../components/AddUnit";
import DeleteUnit from "../components/DeleteUnit";
import UnitList from "../components/UnitList";
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
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showDeleteUnit, setShowDeleteUnit] = useState(false);

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
      
      if (response.data.length === 0) {
        if (window.showToast) {
          window.showToast({
            message: 'No units found. Add new units to start tracking.',
            type: 'info',
            duration: 4000
          });
        }
      } else {
        if (window.showSuccessToast) {
          window.showSuccessToast(`Loaded ${response.data.length} units successfully`);
        }
      }
    } catch (err) {
      setError('Failed to fetch units');
      console.error('Error fetching units:', err);
      
      if (window.showErrorToast) {
        window.showErrorToast('Failed to load units', {
          description: 'Please check your connection and try again.'
        });
      }
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
      
      if (window.showSuccessToast) {
        window.showSuccessToast('WebSocket connected', {
          description: 'Real-time unit tracking is now active'
        });
      }
    } else {
      if (window.showToast && !loading) {
        window.showToast({
          message: 'WebSocket disconnected',
          description: 'Real-time tracking temporarily unavailable',
          type: 'warning',
          duration: 4000
        });
      }
    }
  }, [isConnected, refreshUnitLocations, loading]);

  useEffect(() => {
    if (connectionError && window.showErrorToast) {
      window.showErrorToast('Connection error', {
        description: connectionError
      });
    }
  }, [connectionError]);

  useEffect(() => {
    if (reconnectAttempts > 0 && reconnectAttempts <= 5 && window.showToast) {
      window.showToast({
        message: `Reconnecting... (${reconnectAttempts}/5)`,
        description: 'Attempting to restore real-time connection',
        type: 'info',
        duration: 2000
      });
    }
  }, [reconnectAttempts]);

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
    
    if (window.showToast) {
      window.showToast({
        message: `🎯 Tracking Unit ${unit.unit_id}`,
        description: `${getServiceEmoji(unit.service_type)} ${unit.service_type} - Focused view enabled`,
        type: 'info',
        duration: 3000
      });
    }
  };

  const handleShowAllUnits = () => {
    setSelectedUnit(null);
    setTrackingMode('all');
    
    if (window.showToast) {
      window.showToast({
        message: '👁️ Showing all units',
        description: 'Switched to comprehensive view of all tracked units',
        type: 'info',
        duration: 3000
      });
    }
  };

  const handleUnitAdded = (newUnit) => {
    console.log('✅ New unit added:', newUnit);
    setUnits(prev => [...prev, newUnit]);
    setShowAddUnit(false);
    
    if (window.showSuccessToast) {
      window.showSuccessToast(`Unit ${newUnit.unit_vehicle_number} added successfully`, {
        description: 'The new unit is now available for dispatch and tracking.'
      });
    }
    
    // Optionally refresh to get updated data
    setTimeout(() => fetchUnits(), 1000);
  };

  const handleUnitDeleted = (deletedUnit) => {
    console.log('✅ Unit deleted:', deletedUnit);
    setUnits(prev => prev.filter(u => u.unit_id !== deletedUnit.unit_id));
    setShowDeleteUnit(false);
    
    if (window.showSuccessToast) {
      window.showSuccessToast(`Unit ${deletedUnit.unit_vehicle_number} deleted successfully`, {
        description: 'The unit has been removed from the tracking system.'
      });
    }
    
    // Refresh data to get updated stats
    setTimeout(() => fetchUnits(), 1000);
  };

  const handleToggleSimulation = () => {
    const newMode = trackingMode === 'simulated' ? 'all' : 'simulated';
    setTrackingMode(newMode);
    console.log(`${newMode === 'simulated' ? '🔴 Live' : '📊 All'} tracking mode enabled`);
    
    if (window.showToast) {
      if (newMode === 'simulated') {
        window.showToast({
          message: '🔴 Live tracking enabled',
          description: 'Real-time unit tracking and route animation active',
          type: 'info',
          duration: 3000
        });
      } else {
        window.showToast({
          message: '📊 All routes mode enabled',
          description: 'Displaying all units and routes in static view',
          type: 'info',
          duration: 3000
        });
      }
    }
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

      // ✅ FIXED: Better progress integration from backend
      const realtimeLocation = unitLocations[unit_id];
      const realtimeProgress = realtimeLocation?.progress;

      // ✅ FIXED: Prefer backend route progress over WebSocket data for route animation
      // Backend calculates more accurate progress using GPS + time
      const backendProgress = route.progress || 0;
      const progress = backendProgress;

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

  // ✅ FIXED: Enhanced GPS update handling with progress integration
  const handleUnitLocationUpdate = (data) => {
    console.log('📍 GPS data received:', data);
    
    if (data && data.unit_id) {
      // ✅ FIXED: Update backend route manager with GPS progress
      const backendRoute = backendRoutes.find(route => route.unit_id === data.unit_id);
      
      if (backendRoute?.route) {
        // Calculate current position based on GPS and route
        const currentPosition = calculatePositionFromGPS(
          data.latitude, 
          data.longitude, 
          backendRoute.route.positions || []
        );
        
        // Update route progress in backend manager
        if (backendRouteManager.getRouteData(data.unit_id)) {
          const routeData = backendRouteManager.getRouteData(data.unit_id);
          if (routeData.route) {
            // Add GPS-based progress calculation
            const gpsProgress = calculateGPSProgress(
              data.latitude, 
              data.longitude, 
              backendRoute.route.positions || []
            );
            
            // Use GPS progress if available, otherwise keep backend progress
            if (gpsProgress !== null) {
              routeData.route.progress = gpsProgress;
              routeData.route.current_position = currentPosition;
              routeData.route.lastGPSUpdate = Date.now();
              
              console.log(`📍 Updated GPS progress for Unit ${data.unit_id}:`, {
                progress: gpsProgress,
                position: currentPosition,
                source: 'GPS'
              });
            }
          }
        }
      }
      
      console.log(`📍 Unit ${data.unit_id} GPS update:`, {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        status: data.status,
        hasRoute: !!backendRoute
      });
    }
  };

  // ✅ FIXED: Calculate position along route from GPS coordinates
  const calculatePositionFromGPS = (lat, lng, routePositions) => {
    if (!routePositions || routePositions.length === 0) {
      return [lat, lng];
    }
    
    let closestPoint = null;
    let minDistance = Infinity;
    
    // Find closest point on route
    for (let i = 0; i < routePositions.length - 1; i++) {
      const segmentStart = routePositions[i];
      const segmentEnd = routePositions[i + 1];
      
      const closest = findClosestPointOnSegment([lat, lng], segmentStart, segmentEnd);
      if (closest.distance < minDistance) {
        minDistance = closest.distance;
        closestPoint = closest.position;
      }
    }
    
    return closestPoint || [lat, lng];
  };

  // ✅ FIXED: Calculate progress based on GPS position along route
  const calculateGPSProgress = (lat, lng, routePositions) => {
    if (!routePositions || routePositions.length < 2) {
      return null;
    }
    
    let totalDistance = 0;
    let distanceToPoint = 0;
    
    // Calculate total route distance and distance to current position
    for (let i = 0; i < routePositions.length - 1; i++) {
      const segmentStart = routePositions[i];
      const segmentEnd = routePositions[i + 1];
      
      const segmentDistance = calculateDistance(
        segmentStart[0], segmentStart[1],
        segmentEnd[0], segmentEnd[1]
      );
      totalDistance += segmentDistance;
      
      // Check if current position is along this segment
      const closest = findClosestPointOnSegment([lat, lng], segmentStart, segmentEnd);
      if (closest.projection >= 0 && closest.projection <= 1) {
        distanceToPoint += closest.projection * segmentDistance;
        break;
      } else {
        distanceToPoint += segmentDistance;
      }
    }
    
    // Return progress as percentage
    return totalDistance > 0 ? Math.min(distanceToPoint / totalDistance, 1.0) : 0;
  };

  // ✅ FIXED: Find closest point on line segment
  const findClosestPointOnSegment = (point, segmentStart, segmentEnd) => {
    const [px, py] = point;
    const [x1, y1] = segmentStart;
    const [x2, y2] = segmentEnd;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      return {
        position: segmentStart,
        distance: calculateDistance(px, py, x1, y1),
        projection: 0
      };
    }
    
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    
    return {
      position: [closestX, closestY],
      distance: calculateDistance(px, py, closestX, closestY),
      projection: t
    };
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
            onClick={() => {
              if (window.showToast) {
                window.showToast({
                  message: 'Retrying connection...',
                  description: 'Attempting to reconnect and reload units',
                  type: 'info',
                  duration: 2000
                });
              }
              fetchUnits();
            }}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <h1 className="dashboard-title">
            📍 Real-Time Unit Tracking
          </h1>
          <p className="dashboard-subtitle">
            Monitor emergency response units with live tracking and route optimization
          </p>
        </div>
      </div>

      <div className="dashboard-main">
        <div className="dashboard-stats-grid-balanced">
          <div className="dashboard-stat-card-balanced available">
            <div className="dashboard-stat-icon">📍</div>
            <div className="dashboard-stat-value">
              {units.length}
            </div>
            <div className="dashboard-stat-label">Total Units</div>
          </div>

          <div className="dashboard-stat-card-balanced active">
            <div className="dashboard-stat-icon">🔴</div>
            <div className="dashboard-stat-value">
              {simulationStats.activeSimulations}
            </div>
            <div className="dashboard-stat-label">Live Simulations</div>
          </div>

          <div className="dashboard-stat-card-balanced pending">
            <div className="dashboard-stat-icon">🚨</div>
            <div className="dashboard-stat-value">
              {simulationStats.totalRoutes}
            </div>
            <div className="dashboard-stat-label">Assigned Routes</div>
          </div>

          <div className={`dashboard-stat-card-balanced status ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="dashboard-stat-icon">{isConnected ? '🟢' : '🔴'}</div>
            <div className="dashboard-stat-value">
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </div>
            <div className="dashboard-stat-label">System Status</div>
          </div>
        </div>

        {connectionError && (
          <div className="connection-error-enhanced">
            <span>Connection Error: {connectionError}</span>
            <button
              onClick={() => {
                if (window.showToast) {
                  window.showToast({
                    message: 'Reconnecting to WebSocket...',
                    description: 'Attempting to restore real-time connection',
                    type: 'info',
                    duration: 2000
                  });
                }
                reconnect();
              }}
              className="btn-retry-enhanced"
            >
              Retry
            </button>
          </div>
        )}

        {reconnectAttempts > 0 && (
          <div className="reconnect-attempts-enhanced">
            Reconnecting... {reconnectAttempts}/5
          </div>
        )}

        <div className="dashboard-content-grid">
          {/* Map Section */}
          <div className="dashboard-map-section">
            <div className="dashboard-map-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="dashboard-map-title">
                  🗺️ Unit Tracking Map
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={trackingMode === 'simulated'}
                      onChange={handleToggleSimulation}
                      style={{ transform: 'scale(1.1)' }}
                    />
                    <span>📊 Show Routes</span>
                  </label>
                </div>
              </div>
              {selectedUnit && (
                <div style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--primary-blue)',
                  fontWeight: 'var(--font-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-1)'
                }}>
                  <span>🎯 Showing:</span>
                  <span>Unit {selectedUnit.unit_id}</span>
                  {selectedUnit.service_type && (
                    <span style={{ color: 'var(--secondary-green)' }}>
                      ({selectedUnit.service_type})
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="dashboard-map-container">
              <RealtimeMapView
                key={`map-${trackingMode}-${selectedUnit?.unit_id || 'all'}`}
                markers={mapMarkers}
                polylines={realtimeRoutePolylines}
                showRealtimeData={true}
                animateRoutes={trackingMode !== 'all'}
                center={selectedUnit ? [selectedUnit.latitude, selectedUnit.longitude] : undefined}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-actions-section">
            <h3 className="dashboard-actions-title">
              ⚡ Quick Actions
            </h3>

            <div className="dashboard-actions-grid">
              <button
                onClick={() => setShowAddUnit(true)}
                className="dashboard-btn dashboard-btn-secondary "
              >
                🚛 Add New Unit
              </button>

              <button
                onClick={() => setShowDeleteUnit(true)}
                className="dashboard-btn dashboard-btn-primary"
              >
                🗑️ Delete Vehicle
              </button>

              <button
                onClick={async () => {
                  if (window.showToast) {
                    window.showToast({
                      message: 'Refreshing data...',
                      description: 'Updating units, emergencies and real-time locations',
                      type: 'info',
                      duration: 2000
                    });
                  }

                  try {
                    await fetchUnits();
                    await fetchEmergencies();
                    refreshUnitLocations();

                    if (window.showSuccessToast) {
                      window.showSuccessToast('Data refreshed successfully', {
                        description: 'All units and emergencies have been updated'
                      });
                    }
                  } catch (err) {
                    if (window.showErrorToast) {
                      window.showErrorToast('Failed to refresh data', {
                        description: 'Please check your connection and try again'
                      });
                    }
                  }
                }}
                className="dashboard-btn "
              >
                🔄 Refresh Data
              </button>
            </div>

            {/* Unit Status Summary */}
            <div className="dashboard-actions-summary">
              <h4 className="dashboard-summary-title">
                📊 Unit Status
              </h4>
              <div className="dashboard-summary-grid">
                <div className="dashboard-summary-row">
                  <span className="dashboard-summary-label">Available:</span>
                  <span className="dashboard-summary-value available">
                    {units.filter(u => u.status === 'AVAILABLE').length}
                  </span>
                </div>
                <div className="dashboard-summary-row">
                  <span className="dashboard-summary-label">Busy:</span>
                  <span className="dashboard-summary-value busy">
                    {units.filter(u => ['DISPATCHED', 'ENROUTE'].includes(u.status)).length}
                  </span>
                </div>
                <div className="dashboard-summary-row">
                  <span className="dashboard-summary-label">Total:</span>
                  <span className="dashboard-summary-value">
                    {units.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Units List Section - Full Width */}
        <div className="units-list-section">
          <div className="units-list-header">
            <h3 className="units-list-title">
              {getTrackingModeIcon()} Units Management
            </h3>
            <span className="units-list-count">
              {units.length} total units
            </span>
            <div className="units-table-info">
              {selectedUnit ? (
                <div className="units-selected-unit-info">
                  <strong>{getServiceEmoji(selectedUnit.service_type)} Unit {selectedUnit.unit_id}</strong>
                  <span className="units-focused-view-badge">
                    🎯 Focused View
                  </span>
                </div>
              ) : (
                <div className="units-all-units-info">
                  <strong>{units.length} units</strong>
                  <span className={`units-simulation-badge ${simulationStats.activeSimulations > 0 ? 'active' : 'inactive'}`}>
                    {simulationStats.activeSimulations > 0 ? '🔴 Live Simulation' : '🟢 Static Display'}
                  </span>
                </div>
              )}
              <div className="units-active-routes-info">
                <span className="units-active-routes-badge">
                  📊 {realtimeRoutePolylines.length} Active Routes
                </span>
              </div>
            </div>
          </div>

          <UnitList
            units={units}
            onSelect={handleUnitClick}
            selectedId={selectedUnit?.unit_id}
            onCenterMap={(lat, lng) => {
              // Update map center when unit is selected
              setSelectedUnit(prev => prev ? { ...prev, latitude: lat, longitude: lng } : null);
            }}
          />
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="dashboard-loading">
            <div className="dashboard-spinner"></div>
            <span>Loading...</span>
          </div>
        )}
      </div>

      {/* Add Unit Modal */}
      <AddUnit
        isOpen={showAddUnit}
        onClose={() => setShowAddUnit(false)}
        onUnitAdded={handleUnitAdded}
      />

      {/* Delete Unit Modal */}
      <DeleteUnit
        isOpen={showDeleteUnit}
        onClose={() => setShowDeleteUnit(false)}
        onUnitDeleted={handleUnitDeleted}
      />
    </div>
  );
};

export default UnitsTracking;
