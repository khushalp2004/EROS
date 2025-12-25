import React, { useEffect, useState, useRef } from "react";
import RealtimeMapView from "../components/RealtimeMapView";
import api from "../api";
import { useWebSocketManager, connectionManager } from "../hooks/useWebSocketManager";
import QuickGPSFix from "../utils/QuickGPSFix";
import RouteGeometryManager from "../utils/RouteGeometryManager";

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
  const [routeCache, setRouteCache] = useState({}); // request_id -> {coords}
  const [animationKey, setAnimationKey] = useState(0); // Force re-render for animations
  const [animationStartTime, setAnimationStartTime] = useState(null); // Track animation start for 0-100% progress
  const [routeFetchStatus, setRouteFetchStatus] = useState({}); // request_id -> {status, message}
  const [snappedUnitLocations, setSnappedUnitLocations] = useState({}); // Enhanced with GPS snapping

  // 🆕 NEW: GPS Snapping components
  const geometryManagerRef = useRef(new RouteGeometryManager());
  const gpsSnapperRef = useRef(QuickGPSFix);

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

  // Initial data fetching
  useEffect(() => {
    fetchUnits();
    fetchEmergencies();
  }, []);

  // WebSocket connection monitoring - centralized coordination
  useEffect(() => {
    if (isConnected) {
      console.log('✅ WebSocket connected - centralized real-time tracking enabled');
      
      // Initial unit locations refresh when WebSocket connects
      refreshUnitLocations();
    }
  }, [isConnected, refreshUnitLocations]);

  // Real-time event handlers for automatic updates
  useEffect(() => {
    if (!isConnected) return;
    
    const handleEmergencyCreated = (emergency) => {
      console.log('🆕 New emergency created (UnitsTracking):', emergency);
      // Add to emergencies list
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
      
      // Update emergency in the list
      setEmergencies(prev => {
        return prev.map(e => 
          e.request_id === emergency.request_id ? { ...e, ...emergency } : e
        );
      });
    };

    const handleUnitStatusUpdate = (data) => {
      console.log('📍 Unit status updated (UnitsTracking):', data);
      const { unit_id, status } = data;
      
      // Update unit in the list
      setUnits(prev => {
        return prev.map(u => 
          u.unit_id === unit_id ? { ...u, status } : u
        );
      });
    };

    // 🆕 CRITICAL: Enhanced unit location update handler with GPS snapping
    const handleUnitLocationUpdateEnhanced = (data) => {
      console.log('📍 Enhanced unit location update with GPS snapping:', data);
      
      // Apply GPS snapping to fix straight-line movement
      handleUnitLocationUpdate(data);
    };

    // Subscribe to real-time events via WebSocket manager
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

  // Calculate simulation stats whenever data changes
  useEffect(() => {
    if (units.length > 0 || emergencies.length > 0) {
      calculateSimulationStats();
    }
  }, [units, emergencies, unitLocations]);

  // REMOVED: Animation timer to prevent continuous re-rendering - UnitsTracking only

  // Fetch realistic route polyline for assigned emergencies (OSRM public demo) - ENHANCED
  const routeFetchCacheRef = React.useRef(new Set()); // Track what's being fetched to avoid duplicates

  useEffect(() => {
    const assigned = emergencies.filter((e) => e.status === "ASSIGNED" && e.assigned_unit);
    const unitById = Object.fromEntries(units.map((u) => [u.unit_id, u]));

    assigned.forEach((e) => {
      const cacheKey = `${e.request_id}-${e.assigned_unit}`;
      
      // Skip if we already have this route cached or are currently fetching it
      if (routeCache[e.request_id]?.coords?.length > 0) {
        console.log(`🗺️ Route already cached for Emergency ${e.request_id}`);
        routeFetchCacheRef.current.delete(cacheKey);
        return;
      }
      
      if (routeFetchCacheRef.current.has(cacheKey)) {
        console.log(`⏳ Route already being fetched for Emergency ${e.request_id}`);
        return;
      }
      
      const unit = unitById[e.assigned_unit];
      if (!unit) {
        console.warn(`⚠️ Unit ${e.assigned_unit} not found for Emergency ${e.request_id}`);
        return;
      }

      const fetchRoute = async () => {
        routeFetchCacheRef.current.add(cacheKey);
        setRouteFetchStatus(prev => ({ 
          ...prev, 
          [e.request_id]: { status: 'fetching', message: `Fetching route for Emergency #${e.request_id}...` }
        }));
        
        try {
          console.log(`🛣️ Fetching route for Emergency ${e.request_id}: Unit ${unit.unit_id} → Emergency location`);
          
          // Validate coordinates before making request
          const startLat = parseFloat(unit.latitude);
          const startLon = parseFloat(unit.longitude);
          const endLat = parseFloat(e.latitude);
          const endLon = parseFloat(e.longitude);
          
          if (isNaN(startLat) || isNaN(startLon) || isNaN(endLat) || isNaN(endLon)) {
            const errorMsg = 'Invalid coordinates';
            console.error(`❌ ${errorMsg} for Emergency ${e.request_id}:`, {
              unit: { lat: unit.latitude, lon: unit.longitude },
              emergency: { lat: e.latitude, lon: e.longitude }
            });
            setRouteCache((prev) => ({ ...prev, [e.request_id]: { coords: [], error: errorMsg } }));
            setRouteFetchStatus(prev => ({ 
              ...prev, 
              [e.request_id]: { status: 'error', message: errorMsg }
            }));
            return;
          }

          const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
          console.log(`🌐 OSRM Request URL: ${url}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const res = await fetch(url, { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'EROS-Emergency-Response-System/1.0'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            throw new Error(`OSRM API error: ${res.status} ${res.statusText}`);
          }
          
          const data = await res.json();
          console.log(`📊 OSRM Response for Emergency ${e.request_id}:`, data);
          
          if (data.code !== 'Ok') {
            throw new Error(`OSRM routing failed: ${data.code}`);
          }
          
          const coords = data?.routes?.[0]?.geometry?.coordinates || [];
          
          if (!Array.isArray(coords) || coords.length === 0) {
            throw new Error('No route coordinates returned from OSRM');
          }
          
          // coords from OSRM are [lon, lat]; convert to [lat, lon]
          const latlng = coords.map(([lon, lat]) => {
            if (isNaN(lat) || isNaN(lon)) {
              throw new Error('Invalid coordinate values in OSRM response');
            }
            return [lat, lon];
          });
          
          console.log(`✅ Route fetched successfully for Emergency ${e.request_id}: ${latlng.length} waypoints`);
          setRouteCache((prev) => ({ ...prev, [e.request_id]: { coords: latlng, timestamp: Date.now() } }));
          setRouteFetchStatus(prev => ({ 
            ...prev, 
            [e.request_id]: { status: 'success', message: `Route loaded: ${latlng.length} waypoints` }
          }));
          
        } catch (err) {
          console.error(`❌ Route fetch failed for Emergency ${e.request_id}:`, err.message);
          const errorMsg = err.message || 'Unknown error';
          // Store empty coords with error info for fallback tracking
          setRouteCache((prev) => ({ 
            ...prev, 
            [e.request_id]: { 
              coords: [], 
              error: errorMsg, 
              timestamp: Date.now() 
            } 
          }));
          setRouteFetchStatus(prev => ({ 
            ...prev, 
            [e.request_id]: { status: 'error', message: errorMsg }
          }));
        } finally {
          routeFetchCacheRef.current.delete(cacheKey);
        }
      };
      
      console.log(`🔄 Starting route fetch for Emergency ${e.request_id}`);
      fetchRoute();
    });
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencies, units]); // Removed routeCache dependency to prevent infinite loops

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
    // Start 0-100% animation when entering selected mode
    setAnimationStartTime(Date.now());
    console.log(`🎯 Selected Unit ${unit.unit_id} route animation started (0-100%)`);
  };

  const handleShowAllUnits = () => {
    setSelectedUnit(null);
    setTrackingMode('all');
  };

  const handleToggleSimulation = () => {
    const newMode = trackingMode === 'simulated' ? 'all' : 'simulated';
    setTrackingMode(newMode);
    // Force re-render for animation restart
    setAnimationKey(prev => prev + 1);
    
    // Start 0-100% animation when entering animated modes
    if (newMode === 'simulated' || newMode === 'selected') {
      setAnimationStartTime(Date.now());
      console.log(`${newMode === 'simulated' ? '🔴 Live' : '🎯 Selected'} route animation started (0-100%)`);
    } else {
      setAnimationStartTime(null);
      console.log('📊 All routes display mode enabled');
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
      // Handle both string timestamps and datetime objects
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleTimeString();
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Error';
    }
  };

  // 🆕 HELPER: Find route data for a unit (OSRM format)
  const findRouteDataForUnit = (unitId) => {
    // Look for assigned emergency for this unit
    const assignedEmergency = emergencies.find(e => 
      e.status === "ASSIGNED" && e.assigned_unit === unitId
    );
    
    if (assignedEmergency) {
      // Get cached route data for this emergency
      const cachedRoute = routeCache[assignedEmergency.request_id];
      if (cachedRoute && cachedRoute.coords && cachedRoute.coords.length > 0) {
        // Convert cached coords back to OSRM format [lon, lat]
        const coordinates = cachedRoute.coords.map(([lat, lon]) => [lon, lat]);
        
        return {
          geometry: {
            coordinates: coordinates
          },
          emergencyId: assignedEmergency.request_id,
          unitId: unitId
        };
      }
    }
    
    return null;
  };

  // 🆕 CRITICAL: Enhanced unit location handler with GPS snapping
  const handleUnitLocationUpdate = (data) => {
    console.log('📍 Raw GPS data received:', data);
    
    if (data && data.unit_id && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      // Find route data for this unit
      const routeData = findRouteDataForUnit(data.unit_id);
      
      // 🛠️ APPLY GPS SNAPPING - This fixes straight-line movement!
      const snappedPosition = gpsSnapperRef.current.updateMarkerPosition(
        data.unit_id,
        data.latitude,      // Raw GPS from vehicle
        data.longitude,     // Raw GPS from vehicle
        routeData           // OSRM route geometry
      );

      // Update with SNAPPED coordinates instead of raw GPS
      setSnappedUnitLocations(prev => ({
        ...prev,
        [data.unit_id]: {
          ...snappedPosition,  // ← Snapped to route!
          timestamp: data.timestamp,
          status: data.status,
          emergencyId: data.emergency_id
        }
      }));

      // Debug logging
      console.log(`🎯 Unit ${data.unit_id} GPS Snapping:`, {
        rawGPS: [data.latitude, data.longitude],
        snappedGPS: [snappedPosition.latitude, snappedPosition.longitude],
        isSnapped: snappedPosition.isSnapped,
        distance: `${snappedPosition.snapDistance?.toFixed(1)}m`
      });
    }
  };

  // ✅ Utility function: decide route color based on service type
  const getRouteColor = (serviceType) => {
  if (!serviceType) return "#6c757d";
  switch (serviceType.toUpperCase()) {
    case "AMBULANCE": return "#dc3545";
    case "POLICE": return "#0d6efd";
    case "FIRE": return "#fd7e14";
    default: return "#6c757d";
  }
};



  // Simplified route tracking - matches Dashboard approach with GPS snapping
  const routePolylines = React.useMemo(() => {
    const routes = [];
    
    emergencies
      .filter((e) => e.status === "ASSIGNED" && e.assigned_unit)
      .forEach((e) => {
        const unit = units.find((u) => u.unit_id === e.assigned_unit);
        if (!unit) return;
        
        // 🆕 PRIORITY: Use GPS-snapped location if available, otherwise use real-time, otherwise fallback to unit location
        const snappedLocation = snappedUnitLocations[unit.unit_id];
        const realtimeLocation = unitLocations[unit.unit_id];
        
        let unitLat, unitLon, isUsingSnappedGPS = false;
        
        if (snappedLocation && snappedLocation.isSnapped) {
          // Use GPS-snapped position for accurate route following
          unitLat = snappedLocation.latitude;
          unitLon = snappedLocation.longitude;
          isUsingSnappedGPS = true;
          console.log(`🎯 Using GPS-snapped position for Unit ${unit.unit_id}: ${unitLat.toFixed(5)}, ${unitLon.toFixed(5)}`);
        } else if (realtimeLocation) {
          // Fallback to real-time location
          unitLat = realtimeLocation.latitude;
          unitLon = realtimeLocation.longitude;
        } else {
          // Final fallback to unit's static location
          unitLat = unit.latitude;
          unitLon = unit.longitude;
        }
        
        routes.push({
          id: `${unit.unit_id}-${e.request_id}`,
          positions: [
            [unitLat, unitLon],
            [e.latitude, e.longitude]
          ],
          color: getRouteColor(unit.service_type),
          unitId: unit.unit_id,
          emergencyId: e.request_id,
          serviceType: unit.service_type,
          isRealtime: !!(snappedLocation || realtimeLocation),
          isUsingSnappedGPS: isUsingSnappedGPS,
          snapDistance: snappedLocation?.snapDistance || null
        });
      });
    
    return routes;
  }, [units, emergencies, unitLocations, snappedUnitLocations]);

  // Real-time route polylines with enhanced animation support - FIXED for realistic routes
  const realtimeRoutePolylines = React.useMemo(() => {
    const polylines = routePolylines.map(route => {
      // 🔧 FIXED: Proper route cache access with enhanced validation
      const routeData = routeCache[route.emergencyId];
      const cachedCoords = routeData?.coords;
      
      // Use cached realistic routes if available, otherwise fallback to straight line
      let positions = route.positions; // default fallback
      let isUsingCachedRoute = false;
      
      if (cachedCoords && Array.isArray(cachedCoords) && cachedCoords.length > 1) {
        positions = cachedCoords;
        isUsingCachedRoute = true;
        console.log(`🛣️ Using cached route for Emergency ${route.emergencyId}: ${cachedCoords.length} points`);
      } else {
        console.log(`📍 Using straight line fallback for Emergency ${route.emergencyId} (cached: ${cachedCoords ? cachedCoords.length : 'none'})`);
      }
      
      // Calculate animation progress based on tracking mode
      let progress = 1;
      let isAnimated = false;
      
      if (trackingMode === 'simulated' || trackingMode === 'selected') {
        // Animate routes in live/selected mode
        isAnimated = true;
        if (!route.isRealtime) {
          // 0-100% animation progress from animationStartTime
          if (animationStartTime) {
            const animationDuration = 30000; // 30 seconds total
            const elapsed = Date.now() - animationStartTime;
            progress = Math.min(1, Math.max(0, elapsed / animationDuration));
          } else {
            // Start animation when tracking mode changes
            progress = 0;
          }
        }
      }
      
      return {
        ...route,
        positions,
        originalPositions: positions,
        progress,
        color: route.color,
        isAnimated,
        isUsingCachedRoute,
        serviceType: route.serviceType,
        unitId: route.unitId
      };
    });
    
    // Filter routes based on tracking mode
    const filteredPolylines = trackingMode === 'all' ? polylines : 
      trackingMode === 'simulated' ? polylines.filter(route => route.isRealtime) :
      trackingMode === 'selected' && selectedUnit ? 
        polylines.filter(route => route.unitId === selectedUnit.unit_id) :
        polylines;
    
    // Enhanced debug logging with route type info
    if (filteredPolylines.length > 0) {
      const cachedCount = filteredPolylines.filter(p => p.isUsingCachedRoute).length;
      const straightCount = filteredPolylines.filter(p => !p.isUsingCachedRoute).length;
      console.log(`🛣️ UnitsTracking routes: ${filteredPolylines.length} total (${cachedCount} cached, ${straightCount} straight lines)`);
      filteredPolylines.forEach(route => {
        console.log(`  📍 Route ${route.emergencyId}: ${route.positions.length} points, ${route.isUsingCachedRoute ? 'REALISTIC' : 'STRAIGHT'}`);
      });
    }
    
    return filteredPolylines;
  }, [routePolylines, routeCache, trackingMode, selectedUnit, animationStartTime]);


  const getTrackingModeIcon = () => {
    switch (trackingMode) {
      case 'selected': return '🎯';
      case 'simulated': return '🔴';
      default: return '📍';
    }
  };

  // Prepare map markers - show all units or only selected unit with GPS snapping priority
  const mapMarkers = React.useMemo(() => {
    const baseMarkers = selectedUnit ? [selectedUnit] : units;
    
    return baseMarkers.map(unit => {
      // 🆕 PRIORITY: Use GPS-snapped location if available, otherwise use real-time, otherwise fallback to unit location
      const snappedLocation = snappedUnitLocations[unit.unit_id];
      const realtimeLocation = unitLocations[unit.unit_id];
      
      if (snappedLocation && snappedLocation.isSnapped) {
        // Return enhanced unit with GPS-snapped position
        return {
          ...unit,
          latitude: snappedLocation.latitude,
          longitude: snappedLocation.longitude,
          isRealtime: true,
          isSnapped: true,
          snapDistance: snappedLocation.snapDistance,
          snapReason: snappedLocation.snapReason,
          lastUpdate: snappedLocation.timestamp
        };
      } else if (realtimeLocation) {
        // Return enhanced unit with real-time position
        return {
          ...unit,
          latitude: realtimeLocation.latitude,
          longitude: realtimeLocation.longitude,
          isRealtime: true,
          isSnapped: false,
          lastUpdate: realtimeLocation.timestamp
        };
      } else {
        // Return static unit position
        return {
          ...unit,
          isRealtime: false,
          isSnapped: false
        };
      }
    });
  }, [selectedUnit, units, unitLocations, snappedUnitLocations]);

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
      {/* Page Header */}
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

      {/* Enhanced Controls Header */}
      <div className="card" style={{ margin: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          gap: 'var(--space-6)',
          flexWrap: 'wrap'
        }}>
          {/* Statistics */}
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
              {/* 🆕 GPS Snapping Status Indicator */}
              <div className="route-stat-item" style={{ textAlign: 'center' }}>
                <div className="stat-icon">{Object.keys(snappedUnitLocations).length > 0 ? '🎯' : '📍'}</div>
                <div className="stat-value">{Object.keys(snappedUnitLocations).length > 0 ? 'Active' : 'Inactive'}</div>
                <div className="stat-label">GPS Snapping</div>
              </div>
            </div>
            
            {/* Connection Error Display */}
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

          {/* Control Buttons */}
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
        
        {/* Route Statistics */}
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

      {/* Map Container */}
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
            key={`map-${animationKey}`}
            markers={mapMarkers}
            polylines={realtimeRoutePolylines}
            showRealtimeData={true}
            animateRoutes={trackingMode !== 'all'}
            center={selectedUnit ? [selectedUnit.latitude, selectedUnit.longitude] : undefined}
          />
          
          {/* Enhanced Map Legend */}
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
              🚑 Ambulance | 🚒 Fire Truck | 🚓 Police | 🚐 Other Units
            </div>
            
            {/* Route Status Indicators */}
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
                  🛣️ Route Status
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
          
          {/* Tracking Controls */}
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

      {/* Units Table */}
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
