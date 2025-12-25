/**
 * UnitsTracking_WITH_GPS_SNAPPING.js
 * This shows EXACTLY how to modify your existing UnitsTracking.js to fix straight-line movement
 * Compare this with your current UnitsTracking.js to see the minimal changes needed
 */

import React, { useEffect, useState, useRef } from "react";
import RealtimeMapView from "../components/RealtimeMapView";
import api from "../api";
import { useWebSocketManager, connectionManager } from "../hooks/useWebSocketManager";

// 🆕 NEW: Import GPS snapping utilities
import QuickGPSFix from "../utils/QuickGPSFix";
import RouteGeometryManager from "../utils/RouteGeometryManager";

const UnitsTracking_WITH_GPS_SNAPPING = () => {
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
  const [routeCache, setRouteCache] = useState({});
  const [animationKey, setAnimationKey] = useState(0);
  const [animationStartTime, setAnimationStartTime] = useState(null);
  const [routeFetchStatus, setRouteFetchStatus] = useState({});

  // 🆕 NEW: Initialize GPS snapping components
  const geometryManagerRef = useRef(new RouteGeometryManager());
  const gpsSnapperRef = useRef(new QuickGPSFix());

  // ✅ SAME: WebSocket connection
  const { 
    isConnected, 
    unitLocations, 
    connectionError,
    reconnectAttempts,
    refreshUnitLocations,
    reconnect,
    getStats
  } = useWebSocketManager();

  // ... (keep all your existing functions: fetchUnits, fetchEmergencies, etc.)

  // 🆕 ENHANCED: Real-time event handlers with GPS snapping
  useEffect(() => {
    if (!isConnected) return;
    
    const handleEmergencyCreated = (emergency) => {
      console.log('🆕 New emergency created:', emergency);
      setEmergencies(prev => {
        const exists = prev.some(e => e.request_id === emergency.request_id);
        if (!exists) {
          return [...prev, emergency];
        }
        return prev;
      });
    };

    // 🚀 CRITICAL FIX: Enhanced unit location update with GPS snapping
    const handleUnitLocationUpdate = (data) => {
      console.log('📍 Unit location update with GPS snapping:', data);
      
      if (data && data.unit_id && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        // Find route data for this unit
        const routeData = findRouteDataForUnit(data.unit_id);
        
        // 🛠️ APPLY GPS SNAPPING HERE - This fixes straight-line movement!
        const snappedPosition = gpsSnapperRef.current.updateMarkerPosition(
          data.unit_id,
          data.latitude, // Raw GPS latitude
          data.longitude, // Raw GPS longitude  
          routeData // OSRM route data
        );

        // Update unit locations with SNAPPED position instead of raw GPS
        setUnitLocations(prev => ({
          ...prev,
          [data.unit_id]: {
            ...snappedPosition, // ← Uses snapped coordinates!
            timestamp: data.timestamp,
            status: data.status,
            progress: data.progress,
            emergencyId: data.emergency_id
          }
        }));

        console.log(`🎯 Unit ${data.unit_id} position snapped:`, {
          rawGPS: [data.latitude, data.longitude],
          snappedGPS: [snappedPosition.latitude, snappedPosition.longitude],
          isSnapped: snappedPosition.isSnapped
        });
      }
    };

    const handleEmergencyUpdated = (data) => {
      console.log('📝 Emergency updated:', data);
      const { action, emergency } = data;
      
      setEmergencies(prev => {
        return prev.map(e => 
          e.request_id === emergency.request_id ? { ...e, ...emergency } : e
        );
      });
    };

    const handleUnitStatusUpdate = (data) => {
      console.log('📍 Unit status updated:', data);
      const { unit_id, status } = data;
      
      setUnits(prev => {
        return prev.map(u => 
          u.unit_id === unit_id ? { ...u, status } : u
        );
      });
    };

    // Subscribe to real-time events
    const unsubscribeEmergencyCreated = connectionManager.subscribe('emergency_created', handleEmergencyCreated);
    const unsubscribeUnitLocationUpdate = connectionManager.subscribe('unit_location_update', handleUnitLocationUpdate); // 🆕 Enhanced handler
    const unsubscribeEmergencyUpdated = connectionManager.subscribe('emergency_updated', handleEmergencyUpdated);
    const unsubscribeUnitStatusUpdate = connectionManager.subscribe('unit_status_update', handleUnitStatusUpdate);

    return () => {
      unsubscribeEmergencyCreated && unsubscribeEmergencyCreated();
      unsubscribeUnitLocationUpdate && unsubscribeUnitLocationUpdate(); // 🆕 Enhanced handler
      unsubscribeEmergencyUpdated && unsubscribeEmergencyUpdated();
      unsubscribeUnitStatusUpdate && unsubscribeUnitStatusUpdate();
    };
  }, [isConnected]);

  // 🆕 NEW: Helper function to find route data for unit
  const findRouteDataForUnit = (unitId) => {
    // Look for active emergency assignments for this unit
    const assignedEmergency = emergencies.find(e => 
      e.status === "ASSIGNED" && e.assigned_unit === unitId
    );
    
    if (assignedEmergency && routeCache[assignedEmergency.request_id]?.coords) {
      // Convert cached coordinates back to OSRM format
      return {
        geometry: {
          coordinates: routeCache[assignedEmergency.request_id].coords.map(([lat, lon]) => [lon, lat])
        }
      };
    }
    
    return null;
  };

  // ... (keep all your existing route fetching and other functions)

  // Enhanced route polylines with GPS snapping status
  const realtimeRoutePolylines = React.useMemo(() => {
    const polylines = routePolylines.map(route => {
      const routeData = routeCache[route.emergencyId];
      const cachedCoords = routeData?.coords;
      
      let positions = route.positions;
      let isUsingCachedRoute = false;
      
      if (cachedCoords && Array.isArray(cachedCoords) && cachedCoords.length > 1) {
        positions = cachedCoords;
        isUsingCachedRoute = true;
      }
      
      let progress = 1;
      let isAnimated = false;
      
      if (trackingMode === 'simulated' || trackingMode === 'selected') {
        isAnimated = true;
        if (!route.isRealtime) {
          if (animationStartTime) {
            const animationDuration = 30000;
            const elapsed = Date.now() - animationStartTime;
            progress = Math.min(1, Math.max(0, elapsed / animationDuration));
          } else {
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
    
    const filteredPolylines = trackingMode === 'all' ? polylines : 
      trackingMode === 'simulated' ? polylines.filter(route => route.isRealtime) :
      trackingMode === 'selected' && selectedUnit ? 
        polylines.filter(route => route.unitId === selectedUnit.unit_id) :
        polylines;
    
    return filteredPolylines;
  }, [routePolylines, routeCache, trackingMode, selectedUnit, animationStartTime]);

  // ... (keep all your existing JSX and rendering)

  return (
    <div className="tracking-layout">
      {/* Your existing JSX remains exactly the same */}
      {/* The only change is in the data flow - GPS snapping happens behind the scenes */}
      
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
          
          {/* Enhanced Map Legend with GPS Snapping Status */}
          <div className="map-legend">
            <div style={{ 
              fontWeight: 'var(--font-semibold)', 
              marginBottom: 'var(--space-3)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)'
            }}>
              🎯 GPS Route Snapping Enabled
            </div>
            <div style={{ 
              fontSize: 'var(--text-xs)', 
              color: 'var(--text-secondary)', 
              marginBottom: 'var(--space-2)'
            }}>
              ✅ Raw GPS coordinates are automatically snapped to planned routes
            </div>
            <div style={{ 
              fontSize: 'var(--text-xs)', 
              color: 'var(--primary-blue)', 
              marginBottom: 'var(--space-1)'
            }}>
              🚗 Vehicles now follow roads instead of moving in straight lines
            </div>
            {Object.keys(unitLocations).length > 0 && (
              <div style={{ 
                fontSize: 'var(--text-xs)', 
                color: 'var(--secondary-green)'
              }}>
                📊 {Object.keys(unitLocations).length} units with GPS snapping active
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rest of your existing JSX... */}
    </div>
  );
};

export default UnitsTracking_WITH_GPS_SNAPPING;

/**
 * 🔧 MINIMAL CHANGES NEEDED IN YOUR EXISTING UnitsTracking.js:
 * 
 * 1. ADD IMPORTS at the top:
 * import QuickGPSFix from "../utils/QuickGPSFix";
 * import RouteGeometryManager from "../utils/RouteGeometryManager";
 * 
 * 2. ADD STATE/REFS:
 * const geometryManagerRef = useRef(new RouteGeometryManager());
 * const gpsSnapperRef = useRef(new QuickGPSFix());
 * 
 * 3. FIND YOUR UNIT LOCATION UPDATE HANDLER (usually in WebSocket effect):
 * 
 * OLD CODE (causes straight lines):
 * setUnitLocations(prev => ({
 *   ...prev,
 *   [data.unit_id]: {
 *     latitude: data.latitude,    // ← Raw GPS causes straight lines
 *     longitude: data.longitude,  // ← Raw GPS causes straight lines
 *     timestamp: data.timestamp,
 *     status: data.status
 *   }
 * }));
 * 
 * NEW CODE (snaps to routes):
 * const snappedPosition = gpsSnapperRef.current.updateMarkerPosition(
 *   data.unit_id,
 *   data.latitude,
 *   data.longitude,
 *   findRouteDataForUnit(data.unit_id) // Your OSRM route data
 * );
 * 
 * setUnitLocations(prev => ({
 *   ...prev,
 *   [data.unit_id]: {
 *     ...snappedPosition,  // ← Snapped coordinates follow routes!
 *     timestamp: data.timestamp,
 *     status: data.status
 *   }
 * }));
 * 
 * 4. ADD HELPER FUNCTION:
 * const findRouteDataForUnit = (unitId) => {
 *   // Find OSRM route data for this unit
 *   // Return route data in OSRM format { geometry: { coordinates: [...] } }
 *   // Return null if no route found
 * };
 * 
 * THAT'S IT! Your markers will now follow routes instead of moving in straight lines.
 */
