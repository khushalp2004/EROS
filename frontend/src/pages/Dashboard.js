import React, { useEffect, useState, useMemo } from "react";
import api from "../api";
import RealtimeMapView from "../components/RealtimeMapView";
import EmergencyList from "../components/EmergencyList";
import { useWebSocketManager, connectionManager } from "../hooks/useWebSocketManager";
import RouteMovementController from "../utils/RouteMovementController";
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

function Dashboard() {
  const [units, setUnits] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // {type, message}
  const [routeCache, setRouteCache] = useState({}); // request_id -> {coords}
  const [trackingMode, setTrackingMode] = useState('all'); // 'all', 'selected', 'simulated'
  const [animationKey, setAnimationKey] = useState(0); // Force re-render for animations
  const [simulationStats, setSimulationStats] = useState({
    activeSimulations: 0,
    totalRoutes: 0,
    estimatedArrivals: []
  });
  
  // Initialize RouteMovementController for handling unit route animations
  const routeMovementController = useMemo(() => new RouteMovementController(), []);
  
  // Real-time unit tracking integration - using centralized WebSocket manager
  const { 
    isConnected: wsConnected, 
    unitLocations, 
    connectionError,
    reconnectAttempts,
    refreshUnitLocations,
    reconnect,
    getStats
  } = useWebSocketManager();

  // Real-time event handlers for automatic updates
  useEffect(() => {
    if (!wsConnected) return;
    
    const handleEmergencyCreated = (emergency) => {
      console.log('🆕 New emergency created:', emergency);
      // Add to emergencies list
      setEmergencies(prev => {
        const exists = prev.some(e => e.request_id === emergency.request_id);
        if (!exists) {
          return [...prev, emergency];
        }
        return prev;
      });
      
      // Enhanced notification for new emergency with location info
      const locationInfo = emergency.latitude && emergency.longitude 
        ? ` at (${emergency.latitude.toFixed(3)}, ${emergency.longitude.toFixed(3)})`
        : '';
      showToast(`New ${emergency.emergency_type} emergency #${emergency.request_id} reported${locationInfo}!`, 'info', 5000);
    };

    const handleEmergencyUpdated = (data) => {
      console.log('📝 Emergency updated:', data);
      const { action, emergency, unit, route_info, route_progress_reset } = data;
      
      // 🔧 CRITICAL: Handle fresh start route reset for new dispatch
      if (route_progress_reset?.fresh_start) {
        console.log(`🚀 Fresh dispatch detected for Unit ${route_progress_reset.unit_id} - Emergency ${route_progress_reset.emergency_id}`);
        
        // Reset route movement state for fresh start
        routeMovementController.resetUnitForNewEmergency(route_progress_reset.unit_id.toString());
        
        // Clear route cache for the new emergency
        setRouteCache(prev => {
          const newCache = { ...prev };
          delete newCache[route_progress_reset.emergency_id];
          return newCache;
        });
        
        // Force animation restart for fresh progress calculation
        setAnimationKey(prev => prev + 1);
      }
      
      // Update emergency in the list
      setEmergencies(prev => {
        return prev.map(e => 
          e.request_id === emergency.request_id ? { ...e, ...emergency } : e
        );
      });

      // Update assigned unit if present
      if (unit) {
        setUnits(prev => {
          return prev.map(u => 
            u.unit_id === unit.unit_id ? { ...u, ...unit } : u
          );
        });
      }

      // Update route cache for the emergency
      if (route_info?.positions && emergency.request_id) {
        setRouteCache(prev => ({
          ...prev,
          [emergency.request_id]: route_info.positions
        }));
      }

      if (action === 'assigned') {
        const message = route_progress_reset?.fresh_start 
          ? `Emergency #${emergency.request_id} assigned to Unit ${unit?.unit_id} - fresh start at 0%`
          : `Emergency #${emergency.request_id} assigned to Unit ${unit?.unit_id}`;
        showToast(message, 'info', 3000);
      } else if (action === 'completed') {
        // Enhanced completion handling with route reset info
        if (data.route_reset_info) {
          const { routes_cleared } = data.route_reset_info;
          showToast(`Emergency #${emergency.request_id} completed - ${routes_cleared} routes cleared`, 'success', 3000);
        } else {
          showToast(`Emergency #${emergency.request_id} completed`, 'success', 2000);
        }
      }
    };

    const handleUnitStatusUpdate = (data) => {
      console.log('📍 Unit status updated:', data);
      const { unit_id, status, emergency_id, route_reset_info, route_progress_reset } = data;
      
      // 🔧 CRITICAL: Handle fresh start route reset for new dispatch
      if (route_progress_reset?.fresh_start) {
        console.log(`🚀 Fresh unit status: Unit ${unit_id} dispatched to Emergency ${route_progress_reset.emergency_id} - route progress reset to 0%`);
        
        // Reset route movement state for fresh start
        routeMovementController.resetUnitForNewEmergency(unit_id.toString());
        
        // Clear route cache for the new emergency
        setRouteCache(prev => {
          const newCache = { ...prev };
          delete newCache[route_progress_reset.emergency_id];
          return newCache;
        });
        
        // Force animation restart for fresh progress calculation
        setAnimationKey(prev => prev + 1);
      }
      
      // Update unit in the list
      setUnits(prev => {
        return prev.map(u => 
          u.unit_id === unit_id ? { ...u, status } : u
        );
      });

      if (status === 'DISPATCHED') {
        const message = route_progress_reset?.fresh_start 
          ? `Unit ${unit_id} dispatched to Emergency #${emergency_id} - fresh start at 0%`
          : `Unit ${unit_id} dispatched to Emergency #${emergency_id}`;
        showToast(message, 'info', 3000);
      } else if (status === 'AVAILABLE') {
        // Enhanced message if route was reset
        if (route_reset_info) {
          showToast(`Unit ${unit_id} is now available - route progress reset (${route_reset_info.routes_cleared} routes cleared)`, 'success', 3000);
        } else {
          showToast(`Unit ${unit_id} is now available`, 'success', 2000);
        }
      }
    };

    // 🔧 NEW: Handle route progress reset events
    const handleRouteProgressReset = (data) => {
      console.log('🔄 Route progress reset event received:', data);
      const { unit_id, emergency_id, routes_cleared, ready_for_new_assignment, reset_reason, fresh_start } = data;
      
      if (reset_reason === 'emergency_completed' && ready_for_new_assignment) {
        // Handle completion reset
        routeMovementController.resetUnitForNewEmergency(unit_id.toString());
        
        // Clear route cache for the completed emergency
        setRouteCache(prev => {
          const newCache = { ...prev };
          delete newCache[emergency_id];
          return newCache;
        });
        
        // Force animation restart by updating animation key
        setAnimationKey(prev => prev + 1);
        
        console.log(`✅ Route progress reset completed for Unit ${unit_id}: ${routes_cleared} routes cleared`);
      } else if (reset_reason === 'new_emergency_dispatch' && fresh_start) {
        // 🔧 CRITICAL: Handle new dispatch reset - force fresh start at 0%
        console.log(`🚀 Fresh start: Unit ${unit_id} dispatched to Emergency ${emergency_id} - resetting route progress to 0%`);
        
        // Reset the unit's route movement state for fresh start
        routeMovementController.resetUnitForNewEmergency(unit_id.toString());
        
        // Clear any existing route cache for this unit/emergency
        setRouteCache(prev => {
          const newCache = { ...prev };
          delete newCache[emergency_id];
          return newCache;
        });
        
        // Force animation restart to ensure fresh progress calculation
        setAnimationKey(prev => prev + 1);
        
        console.log(`🎯 Route progress reset to 0% for fresh start - Unit ${unit_id} to Emergency ${emergency_id}`);
      }
    };

    // Subscribe to real-time events via WebSocket manager
    const unsubscribeEmergencyCreated = connectionManager.subscribe('emergency_created', handleEmergencyCreated);
    const unsubscribeEmergencyUpdated = connectionManager.subscribe('emergency_updated', handleEmergencyUpdated);
    const unsubscribeUnitStatusUpdate = connectionManager.subscribe('unit_status_update', handleUnitStatusUpdate);
    const unsubscribeRouteProgressReset = connectionManager.subscribe('route_progress_reset', handleRouteProgressReset);

    return () => {
      unsubscribeEmergencyCreated && unsubscribeEmergencyCreated();
      unsubscribeEmergencyUpdated && unsubscribeEmergencyUpdated();
      unsubscribeUnitStatusUpdate && unsubscribeUnitStatusUpdate();
      unsubscribeRouteProgressReset && unsubscribeRouteProgressReset();
    };
  }, [wsConnected]);

  const showToast = (message, type = "info", duration = 3500) => {
    setToast({ message, type });
    if (duration) {
      setTimeout(() => setToast(null), duration);
    }
  };

  // Utility functions matching UnitsTracking
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

  const calculateSimulationStats = () => {
    const activeSims = Object.keys(unitLocations).length;
    const assignedEmergencies = emergencies.filter(e => e.status === 'ASSIGNED');
    const estimatedArrivals = assignedEmergencies.map(emergency => {
      // Validate emergency object
      const emergencyValidation = validateEmergency(emergency);
      if (!emergencyValidation.isValid) {
        logDataError('Dashboard.calculateSimulationStats', emergency, 'process emergency');
        return null;
      }
      
      // Safely get assigned unit ID
      const assignedUnitId = getAssignedUnit(emergency);
      if (!assignedUnitId) {
        console.warn('⚠️ No assigned unit for emergency:', emergency.request_id);
        return null;
      }
      
      // Find the unit with proper validation
      const unit = units.find(u => {
        const unitValidation = validateUnit(u);
        if (!unitValidation.isValid) {
          logDataError('Dashboard.calculateSimulationStats', u, 'validate unit');
          return false;
        }
        return u.unit_id === assignedUnitId;
      });
      
      if (!unit) {
        console.warn(`⚠️ Unit ${assignedUnitId} not found for emergency ${emergency.request_id}`);
        return null;
      }
      
      // Validate unit has required coordinates
      if (unit.latitude === undefined || unit.longitude === undefined) {
        logDataError('Dashboard.calculateSimulationStats', unit, 'unit missing coordinates');
        return null;
      }
      
      if (emergency.latitude === undefined || emergency.longitude === undefined) {
        logDataError('Dashboard.calculateSimulationStats', emergency, 'emergency missing coordinates');
        return null;
      }
      
      const distance = calculateDistance(
        unit.latitude, unit.longitude,
        emergency.latitude, emergency.longitude
      );
      // Rough estimation: 30 km/h average speed in city
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

  // Animation control functions
  const handleToggleSimulation = () => {
    const newMode = trackingMode === 'simulated' ? 'all' : 'simulated';
    setTrackingMode(newMode);
    // Force re-render for animation restart
    setAnimationKey(prev => prev + 1);
    if (newMode !== 'all') {
      showToast(`${newMode === 'simulated' ? '🔴 Live' : '📊 All'} route animation enabled`, 'info', 2000);
    }
  };

  const getTrackingModeIcon = () => {
    switch (trackingMode) {
      case 'selected': return '🎯';
      case 'simulated': return '🔴';
      default: return '📍';
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resUnits, resEmergencies] = await Promise.all([
        api.get("/api/authority/units"),
        api.get("/api/authority/emergencies"),
      ]);
      setUnits(resUnits.data);
      setEmergencies(resEmergencies.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // WebSocket connection monitoring - centralized coordination
  useEffect(() => {
    if (wsConnected) {
      console.log('✅ WebSocket connected - centralized real-time tracking enabled');
      
      // Initial data refresh when WebSocket connects
      refreshUnitLocations();
    }
  }, [wsConnected, refreshUnitLocations]);

  // Calculate simulation stats whenever data changes
  useEffect(() => {
    if (units.length > 0 || emergencies.length > 0) {
      calculateSimulationStats();
    }
  }, [units, emergencies, unitLocations]);

  // Force periodic updates for animation progress when in animated modes
  useEffect(() => {
    if (trackingMode === 'simulated' || trackingMode === 'selected') {
      const interval = setInterval(() => {
        setAnimationKey(prev => prev + 1);
      }, 1000); // Update every second for smooth animation

      return () => clearInterval(interval);
    }
  }, [trackingMode]);

  const filteredEmergencies =
    statusFilter === "ALL"
      ? emergencies
      : emergencies.filter((e) => (e.status || "").toUpperCase() === statusFilter);

  // If current selection is filtered out, clear it
  const isSelectedVisible =
    selectedEmergency &&
    filteredEmergencies.some((e) => e.request_id === selectedEmergency.request_id);
  const activeSelection = isSelectedVisible ? selectedEmergency : null;

  const availableByType = units.reduce((acc, u) => {
    if (u.status === "AVAILABLE") {
      acc[u.service_type] = (acc[u.service_type] || 0) + 1;
    }
    return acc;
  }, {});

  // Utility function: decide route color based on service type (matches UnitsTracking)
  const getRouteColor = (serviceType) => {
    if (!serviceType) return "#6c757d";
    switch (serviceType.toUpperCase()) {
      case "AMBULANCE": return "#dc3545";
      case "POLICE": return "#0d6efd";
      case "FIRE": return "#fd7e14";
      default: return "#6c757d";
    }
  };

  // Simplified route tracking - matches UnitsTracking approach
  const routePolylines = useMemo(() => {
    const routes = [];
    
    emergencies
      .filter((e) => {
        // Validate emergency and check it's assigned
        const emergencyValidation = validateEmergency(e);
        if (!emergencyValidation.isValid) {
          logDataError('Dashboard.routePolylines', e, 'filter emergency');
          return false;
        }
        return e.status === "ASSIGNED" && getAssignedUnit(e);
      })
      .forEach((emergency) => {
        // Safely get assigned unit ID
        const assignedUnitId = getAssignedUnit(emergency);
        if (!assignedUnitId) {
          console.warn('⚠️ No assigned unit for emergency in routePolylines:', emergency.request_id);
          return;
        }
        
        // Find unit with validation
        const unit = units.find((u) => {
          const unitValidation = validateUnit(u);
          if (!unitValidation.isValid) {
            logDataError('Dashboard.routePolylines', u, 'validate unit');
            return false;
          }
          return u.unit_id === assignedUnitId;
        });
        
        if (!unit) {
          console.warn(`⚠️ Unit ${assignedUnitId} not found for emergency ${emergency.request_id}`);
          return;
        }
        
        // Validate coordinates
        if (unit.latitude === undefined || unit.longitude === undefined) {
          logDataError('Dashboard.routePolylines', unit, 'unit missing coordinates');
          return;
        }
        
        if (emergency.latitude === undefined || emergency.longitude === undefined) {
          logDataError('Dashboard.routePolylines', emergency, 'emergency missing coordinates');
          return;
        }
        
        // Use real-time location if available, otherwise use unit's current location
        const realtimeLocation = unitLocations[unit.unit_id];
        const unitLat = realtimeLocation ? realtimeLocation.latitude : unit.latitude;
        const unitLon = realtimeLocation ? realtimeLocation.longitude : unit.longitude;
        
        routes.push({
          id: `${unit.unit_id}-${emergency.request_id}`,
          positions: [
            [unitLat, unitLon],
            [emergency.latitude, emergency.longitude]
          ],
          color: getRouteColor(unit.service_type),
          unitId: unit.unit_id,
          emergencyId: emergency.request_id,
          serviceType: unit.service_type,
          isRealtime: !!realtimeLocation
        });
      });
    
    return routes;
  }, [units, emergencies, unitLocations]);

  // Real-time route polylines with enhanced animation support - MOVED BEFORE useEffect
  const realtimeRoutePolylines = useMemo(() => {
    // Use the routePolylines we calculated earlier, but enhance with routeCache for realistic routes
    const polylines = routePolylines.map(route => {
      const routeData = routeCache[route.emergencyId]?.coords;
      const positions = routeData && routeData.length > 1 ? routeData : route.positions;
      
      // 🔧 ENHANCED: Get complete OSRM route data for accurate positioning
      const osrmRouteData = routeCache[route.emergencyId]?.osrmData;
      
      // Calculate animation progress based on tracking mode
      let progress = 1;
      let isAnimated = false;
      
      if (trackingMode === 'simulated' || trackingMode === 'selected') {
        // Animate routes in live/selected mode
        isAnimated = true;
        if (!route.isRealtime) {
          // Simulate progress for non-realtime routes
          const startTime = Date.now() - (route.emergencyId * 1000); // Stagger animations
          const animationDuration = 30000; // 30 seconds
          const elapsed = Date.now() - startTime;
          progress = Math.min(1, elapsed / animationDuration);
        }
      }
      
      return {
        ...route,
        positions,
        originalPositions: positions,
        progress,
        color: route.color,
        isAnimated,
        serviceType: route.serviceType,
        unitId: route.unitId,
        // 🔧 ENHANCED: Pass complete OSRM route data
        osrmRouteData,
        routeGeometry: osrmRouteData ? { coordinates: positions.map(([lat, lon]) => [lon, lat]) } : null,
        routeDistance: osrmRouteData?.distance,
        routeDuration: osrmRouteData?.duration
      };
    });
    
    // Filter routes based on tracking mode (matching UnitsTracking logic)
    const filteredPolylines = trackingMode === 'all' ? polylines : 
      trackingMode === 'simulated' ? polylines.filter(route => route.isRealtime) :
      trackingMode === 'selected' && selectedEmergency ? 
        polylines.filter(route => route.emergencyId === selectedEmergency.request_id) :
        polylines;
    
    // Debug logging
    if (filteredPolylines.length > 0) {
      console.log('🛣️ Real-time route polylines:', filteredPolylines);
    }
    
    return filteredPolylines;
  }, [routePolylines, routeCache, trackingMode, selectedEmergency]);

  // Fetch cached route polyline from database for assigned emergencies
  useEffect(() => {
    const assigned = emergencies.filter((e) => {
      // Validate emergency
      const emergencyValidation = validateEmergency(e);
      if (!emergencyValidation.isValid) {
        logDataError('Dashboard.routeCache', e, 'filter assigned emergencies');
        return false;
      }
      return e.status === "ASSIGNED" && getAssignedUnit(e);
    });

    assigned.forEach((emergency) => {
      if (routeCache[emergency.request_id]) return;

      // Safely get assigned unit ID
      const assignedUnitId = getAssignedUnit(emergency);
      if (!assignedUnitId) {
        console.warn('⚠️ No assigned unit for emergency in route cache:', emergency.request_id);
        return;
      }

      const fetchCachedRoute = async () => {
        try {
          // Fetch cached route data from database via unit-routes endpoint
          const response = await api.get(`/api/units/unit-routes/${assignedUnitId}`);
          const routeData = response.data;

          if (routeData?.route?.positions && routeData.route.positions.length > 1) {
            // Use cached polyline_positions from database
            const coords = routeData.route.positions; // Already [lat, lng] format

            // Create OSRM-like data structure for compatibility
            const osrmRouteData = {
              geometry: { coordinates: coords.map(([lat, lng]) => [lng, lat]) }, // Convert to [lon, lat] for RouteGeometryManager
              distance: routeData.route.total_distance || 0,
              duration: routeData.route.estimated_duration || 0,
              legs: [],
              weight: 0,
              weight_name: 'routability'
            };

            setRouteCache((prev) => ({
              ...prev,
              [emergency.request_id]: {
                coords: coords,
                osrmData: osrmRouteData
              }
            }));

            console.log(`🛣️ Cached route loaded for Emergency ${emergency.request_id}:`, {
              distance: `${(routeData.route.total_distance / 1000).toFixed(1)}km`,
              duration: `${Math.round(routeData.route.estimated_duration / 60)}min`,
              coordinates: coords.length,
              source: 'database'
            });
          } else {
            throw new Error('No cached route positions found');
          }
        } catch (err) {
          console.warn(`⚠️ Failed to fetch cached route for emergency ${emergency.request_id}:`, err);
          // Fallback: fetch fresh OSRM route
          try {
            const unit = units.find(u => u.unit_id === assignedUnitId);
            if (!unit || unit.longitude === undefined || unit.latitude === undefined ||
                emergency.longitude === undefined || emergency.latitude === undefined) {
              setRouteCache((prev) => ({ ...prev, [emergency.request_id]: { coords: [], osrmData: null } }));
              return;
            }

            const url = `https://router.project-osrm.org/route/v1/driving/${unit.longitude},${unit.latitude};${emergency.longitude},${emergency.latitude}?overview=full&geometries=geojson&steps=false`;
            const res = await fetch(url);
            const data = await res.json();

            if (data?.routes?.[0]) {
              const route = data.routes[0];
              const coords = route.geometry?.coordinates || [];
              const latlng = coords.map(([lon, lat]) => [lat, lon]);

              const osrmRouteData = {
                geometry: { coordinates: coords },
                distance: route.distance,
                duration: route.duration,
                legs: route.legs,
                weight: route.weight,
                weight_name: route.weight_name
              };

              setRouteCache((prev) => ({
                ...prev,
                [emergency.request_id]: {
                  coords: latlng,
                  osrmData: osrmRouteData
                }
              }));

              console.log(`🛣️ Fallback OSRM route fetched for Emergency ${emergency.request_id}:`, {
                distance: `${(route.distance / 1000).toFixed(1)}km`,
                duration: `${Math.round(route.duration / 60)}min`,
                coordinates: coords.length,
                source: 'osrm_fallback'
              });
            } else {
              throw new Error('No routes found in OSRM response');
            }
          } catch (fallbackErr) {
            console.warn(`⚠️ Fallback OSRM failed for emergency ${emergency.request_id}:`, fallbackErr);
            setRouteCache((prev) => ({ ...prev, [emergency.request_id]: { coords: [], osrmData: null } }));
          }
        }
      };
      fetchCachedRoute();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencies, units, routeCache]);

  // Filter markers based on tracking mode
  const mapMarkers = useMemo(() => {
    if (trackingMode === 'selected' && selectedEmergency) {
      return [{ ...selectedEmergency, type: selectedEmergency.emergency_type }];
    }
    return filteredEmergencies.map((e) => ({ ...e, type: e.emergency_type }));
  }, [trackingMode, selectedEmergency, filteredEmergencies]);

  const handleDispatch = async (emergency) => {
    try {
      await api.post(`/api/authority/dispatch/${emergency.request_id}`);
      showToast("Emergency approved & dispatched", "success");
      await fetchData();
    } catch (err) {
      console.error("Dispatch error:", err);
      const msg =
        err?.response?.data?.error ||
        "No ambulance available for this emergency (within 50 km).";
      showToast(msg, "error");
    }
  };

  const handleComplete = async (emergency) => {
    try {
      // Get the assigned unit before marking as complete
      const assignedUnitId = getAssignedUnit(emergency);
      
      await api.post(`/api/authority/complete/${emergency.request_id}`);
      
      // 🔧 ENHANCED: Route reset is now handled automatically via WebSocket events
      // No need for manual route reset - backend will send route_progress_reset event
      if (assignedUnitId) {
        console.log(`📤 Marking emergency ${emergency.request_id} complete - route reset will be handled via WebSocket`);
      }
      
      showToast("Marked complete; unit is now available and ready for new emergency", "success");
      await fetchData();
    } catch (err) {
      console.error("Complete error:", err);
      const msg = err?.response?.data?.error || "Unable to mark complete.";
      showToast(msg, "error");
    }
  };

  const cardStyle = {
    background: "#fff",
    borderRadius: "12px",
    padding: "12px",
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
    border: "1px solid #eaeaea",
  };

  const sectionTitleStyle = { margin: "0 0 8px 0" };

  return (
    <div className="tracking-layout">
      {/* Toast Container */}
      <div className="toast-container">
        {toast && (
          <div className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>

      {/* Page Header */}
      <div className="tracking-header">
        <div className="container">
          <h1 className="page-title">
            📊 Authority Dashboard
          </h1>
          <p className="page-subtitle">
            Real-time emergency response management and monitoring
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
                <div className="stat-icon">🚨</div>
                <div className="stat-value">{emergencies.length}</div>
                <div className="stat-label">Active Emergencies</div>
              </div>
              <div className="route-stat-item" style={{ textAlign: 'center' }}>
                <div className="stat-icon">🔴</div>
                <div className="stat-value">{simulationStats.activeSimulations}</div>
                <div className="stat-label">Live Simulations</div>
              </div>
              <div className={`connection-status ${wsConnected ? 'connected' : 'disconnected'}`}>
                <div className="status-dot"></div>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
                    {wsConnected ? 'Connected' : 'Disconnected'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)' }}>WebSocket Status</div>
                </div>
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
            
            <button
              onClick={async () => {
                await fetchData();
                refreshUnitLocations();
              }}
              className="btn btn-outline"
              style={{
                width: '100%',
                justifyContent: 'center',
                borderColor: 'var(--primary-blue)',
                color: 'var(--primary-blue)'
              }}
            >
              🔄 Refresh Data
            </button>
          </div>
        </div>
        
        
        {/* Route Statistics Display */}
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

      <div style={{ display: "flex", gap: "var(--space-6)", alignItems: "stretch", marginBottom: 'var(--space-6)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ 
            height: "100%", 
            border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden'
          }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              gap: "var(--space-4)",
              padding: 'var(--space-6)',
              backgroundColor: 'var(--gray-50)',
              borderBottom: '1px solid var(--gray-200)'
            }}>
              <h3 style={{ 
                ...sectionTitleStyle,
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {getTrackingModeIcon()} Emergencies & Routes
                <span style={{ 
                  marginLeft: 'var(--space-2)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  fontWeight: 'var(--font-normal)'
                }}>
                  ({trackingMode.charAt(0).toUpperCase() + trackingMode.slice(1)} Mode)
                </span>
              </h3>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "var(--space-3)", 
                fontSize: "var(--text-sm)",
                flexWrap: 'wrap'
              }}>
                <label style={{ 
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-secondary)'
                }}>
                  Status Filter:
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-control"
                  style={{ 
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--text-sm)',
                    borderRadius: 'var(--radius-md)',
                    minWidth: '120px'
                  }}
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="COMPLETED">Completed</option>
                </select>
                <span style={{ 
                  color: "var(--text-muted)",
                  fontWeight: 'var(--font-medium)'
                }}>
                  Showing {filteredEmergencies.length} / {emergencies.length}
                </span>
                {trackingMode === 'simulated' && (
                  <span className="badge" style={{ 
                    backgroundColor: 'var(--accent-red)',
                    color: 'var(--text-inverse)',
                    fontSize: 'var(--text-xs)',
                    padding: 'var(--space-1) var(--space-2)'
                  }}>
                    🔴 Live Animation
                  </span>
                )}
              </div>
            </div>
            {/* Map Container */}
            <div className="map-container" style={{ 
              height: '500px',
              position: 'relative'
            }}>
              <RealtimeMapView
                key={`map-${animationKey}`}
                markers={
                  activeSelection
                    ? [{ ...activeSelection, type: activeSelection.emergency_type }]
                    : mapMarkers
                }
                polylines={
                  activeSelection
                    ? realtimeRoutePolylines.filter((p) => p.emergencyId === activeSelection.request_id)
                    : realtimeRoutePolylines
                }
                showRealtimeData={true}
                animateRoutes={trackingMode !== 'all'}
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
                  {getTrackingModeIcon()} {trackingMode.charAt(0).toUpperCase() + trackingMode.slice(1)} Mode
                </div>
                <div style={{ 
                  fontSize: 'var(--text-xs)', 
                  color: 'var(--text-secondary)', 
                  marginBottom: 'var(--space-2)',
                  lineHeight: 1.5
                }}>
                   Ambulance |  Fire Truck |  Police |  Other Units
                </div>
                {trackingMode !== 'all' && (
                  <div style={{ 
                    fontSize: 'var(--text-xs)', 
                    color: 'var(--primary-blue)', 
                    marginBottom: 'var(--space-1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)'
                  }}>
                    🔴 Real-time animation active
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
            </div>
          </div>
        </div>
      </div>

      {/* Emergency List Section */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <div className="card" style={{ 
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: 'var(--space-6)',
            backgroundColor: 'var(--gray-50)',
            borderBottom: '1px solid var(--gray-200)'
          }}>
            <h3 style={{ 
              ...sectionTitleStyle,
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              🚨 Emergency Management
            </h3>
          </div>
          <div style={{ padding: 'var(--space-6)' }}>
            <EmergencyList
              emergencies={filteredEmergencies}
              onSelect={setSelectedEmergency}
              selectedId={activeSelection?.request_id}
              onDispatch={handleDispatch}
              onComplete={handleComplete}
              availableByType={availableByType}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
