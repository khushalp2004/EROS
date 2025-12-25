/**
 * GPS_SNAPPING_INTEGRATION_GUIDE.js
 * Shows the EXACT minimal changes needed to fix straight-line marker movement
 * This focuses on the core WebSocket handler modification
 */

import React, { useEffect, useRef, useState } from "react";
import { useWebSocketManager } from "../hooks/useWebSocketManager";
import QuickGPSFix from "../utils/QuickGPSFix";
import RouteGeometryManager from "../utils/RouteGeometryManager";

const GPS_SNAPPING_INTEGRATION_GUIDE = () => {
  const [units, setUnits] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  
  // 🆕 NEW: GPS Snapping components
  const geometryManagerRef = useRef(new RouteGeometryManager());
  const gpsSnapperRef = useRef(new QuickGPSFix());
  
  // Existing WebSocket connection
  const { 
    isConnected, 
    unitLocations,  // This gets enhanced with GPS snapping
    connectionError,
    refreshUnitLocations,
    reconnect
  } = useWebSocketManager();

  // 🆕 CRITICAL: Enhanced unit location handler with GPS snapping
  useEffect(() => {
    if (!isConnected) return;
    
    // Listen for unit location updates
    const handleUnitLocationUpdate = (data) => {
      console.log('📍 Raw GPS data received:', data);
      
      if (data && data.unit_id && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        // Find route data for this unit (customize this for your system)
        const routeData = findRouteDataForUnit(data.unit_id);
        
        // 🛠️ APPLY GPS SNAPPING - This fixes straight-line movement!
        const snappedPosition = gpsSnapperRef.current.updateMarkerPosition(
          data.unit_id,
          data.latitude,      // Raw GPS from vehicle
          data.longitude,     // Raw GPS from vehicle
          routeData           // OSRM route geometry
        );

        // Update with SNAPPED coordinates instead of raw GPS
        setUnitLocations(prev => ({
          ...prev,
          [data.unit_id]: {
            ...snappedPosition,  // ← Snapped to route!
            timestamp: data.timestamp,
            status: data.status
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

    // Subscribe to the event (adjust based on your WebSocket setup)
    // This might be: connectionManager.subscribe('unit_location_update', handleUnitLocationUpdate)
    // Or: socket.on('unit_location_update', handleUnitLocationUpdate)
    
    return () => {
      // Unsubscribe when component unmounts
      // connectionManager.unsubscribe('unit_location_update', handleUnitLocationUpdate)
    };
  }, [isConnected]);

  // 🆕 Helper: Find route data for a unit
  const findRouteDataForUnit = (unitId) => {
    // Look for assigned emergency for this unit
    const assignedEmergency = emergencies.find(e => 
      e.status === "ASSIGNED" && e.assigned_unit === unitId
    );
    
    if (assignedEmergency) {
      // Return OSRM route data format
      // You might get this from your route cache or API
      return {
        geometry: {
          coordinates: [
            [-74.0060, 40.7128], // [lon, lat] format for OSRM
            [-74.0065, 40.7138],
            [-74.0070, 40.7148],
            [-74.0075, 40.7158]
          ]
        }
      };
    }
    
    return null;
  };

  // Example: Process OSRM route when you get it
  const processOSRMRoute = (osrmResponse, unitId) => {
    const routeId = `route-${unitId}`;
    const processedRoute = geometryManagerRef.current.processOSRMRoute(
      osrmResponse, 
      routeId
    );
    
    console.log(`🛣️ Route processed for unit ${unitId}:`, {
      id: routeId,
      points: processedRoute.coordinates.length,
      distance: `${processedRoute.totalDistance}m`
    });
    
    return processedRoute;
  };

  // Example: Animate vehicle along route (0-1 progress)
  const animateVehicleAlongRoute = (unitId, duration = 30000) => {
    const routeId = gpsSnapperRef.current.getRouteIdForUnit(unitId);
    if (!routeId) {
      console.warn(`⚠️ No route found for unit ${unitId}`);
      return;
    }

    const startTime = Date.now();
    
    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      
      // Get marker for this unit (you'll need to implement this)
      const marker = getMarkerForUnit(unitId);
      if (marker) {
        gpsSnapperRef.current.animateAlongRoute(routeId, progress, marker);
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  };

  // Placeholder: Get marker for unit (implement based on your map setup)
  const getMarkerForUnit = (unitId) => {
    // Return the Leaflet marker for this unit
    // This depends on how you're managing markers in your map
    return null;
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>🎯 GPS Snapping Integration Guide</h2>
      
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>📍 Real-Time Unit Locations</h3>
        <p>Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
        <p>Units with GPS snapping: {Object.keys(unitLocations).length}</p>
        
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {Object.entries(unitLocations).map(([unitId, location]) => (
            <div key={unitId} style={{ 
              padding: '10px', 
              margin: '5px 0',
              backgroundColor: location.isSnapped ? '#d4edda' : '#fff3cd',
              borderRadius: '4px'
            }}>
              <strong>Unit {unitId}</strong>
              <br />
              Position: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              <br />
              Status: {location.isSnapped ? '🛣️ Snapped to route' : '📍 Raw GPS'}
              {location.snapDistance && (
                <span style={{ color: '#666' }}>
                  {' '}({location.snapDistance.toFixed(1)}m from route)
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ 
        backgroundColor: '#e7f3ff', 
        padding: '20px', 
        borderRadius: '8px'
      }}>
        <h3>🔧 Key Changes Made</h3>
        <ol>
          <li><strong>Added GPS Snapper:</strong> <code>QuickGPSFix</code> and <code>RouteGeometryManager</code></li>
          <li><strong>Enhanced WebSocket Handler:</strong> Raw GPS → Snapped coordinates</li>
          <li><strong>Route Processing:</strong> OSRM routes enable GPS snapping</li>
          <li><strong>Animation Support:</strong> Move markers along routes using progress (0-1)</li>
        </ol>
      </div>
    </div>
  );
};

export default GPS_SNAPPING_INTEGRATION_GUIDE;

/**
 * 🎯 MINIMAL IMPLEMENTATION STEPS:
 * 
 * 1. ADD IMPORTS to your existing UnitsTracking.js:
 * 
 * import QuickGPSFix from "../utils/QuickGPSFix";
 * import RouteGeometryManager from "../utils/RouteGeometryManager";
 * 
 * 2. ADD TO YOUR COMPONENT:
 * 
 * const geometryManagerRef = useRef(new RouteGeometryManager());
 * const gpsSnapperRef = useRef(new QuickGPSFix());
 * 
 * 3. FIND YOUR UNIT LOCATION UPDATE HANDLER and REPLACE:
 * 
 * // OLD CODE (causes straight lines):
 * setUnitLocations(prev => ({
 *   ...prev,
 *   [data.unit_id]: {
 *     latitude: data.latitude,     // ← Raw GPS
 *     longitude: data.longitude,  // ← Raw GPS
 *     timestamp: data.timestamp
 *   }
 * }));
 * 
 * // NEW CODE (snaps to routes):
 * const snappedPosition = gpsSnapperRef.current.updateMarkerPosition(
 *   data.unit_id,
 *   data.latitude,
 *   data.longitude,
 *   findRouteDataForUnit(data.unit_id) // Your route data
 * );
 * 
 * setUnitLocations(prev => ({
 *   ...prev,
 *   [data.unit_id]: {
 *     ...snappedPosition,  // ← Snapped coordinates!
 *     timestamp: data.timestamp
 *   }
 * }));
 * 
 * 4. ADD HELPER FUNCTION:
 * 
 * const findRouteDataForUnit = (unitId) => {
 *   // Return OSRM route data for this unit
 *   // Format: { geometry: { coordinates: [[lon, lat], ...] } }
 *   // Return null if no route found
 * };
 * 
 * THAT'S IT! Your markers will now follow routes instead of straight lines.
 * 
 * 🎬 FOR ANIMATION (Optional):
 * 
 * const animateUnit = (unitId) => {
 *   const routeId = gpsSnapperRef.current.getRouteIdForUnit(unitId);
 *   const marker = getMarkerForUnit(unitId);
 *   
 *   let progress = 0;
 *   const animate = () => {
 *     progress += 0.01; // Increment progress
 *     gpsSnapperRef.current.animateAlongRoute(routeId, progress, marker);
 *     
 *     if (progress < 1) {
 *       requestAnimationFrame(animate);
 *     }
 *   };
 *   animate();
 * };
 */
