/**
 * useWebSocketWithGPSSnapping.js
 * Enhanced WebSocket hook with GPS route snapping for emergency vehicle tracking
 * Snaps raw GPS coordinates to nearest route points to fix straight-line movement
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import GPSSnapper from '../utils/GPSSnapper';
import RouteGeometryManager from '../utils/RouteGeometryManager';

const SOCKET_URL = 'http://127.0.0.1:5001';

export const useWebSocketWithGPSSnapping = (routeGeometryManager = null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [unitLocations, setUnitLocations] = useState({});
  const [connectionError, setConnectionError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastConnectedTime, setLastConnectedTime] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  
  // GPS Snapping components
  const geometryManagerRef = useRef(routeGeometryManager || new RouteGeometryManager());
  const gpsSnapperRef = useRef(null);

  // Initialize GPS snapper when geometry manager is ready
  useEffect(() => {
    if (geometryManagerRef.current && !gpsSnapperRef.current) {
      gpsSnapperRef.current = new GPSSnapper(geometryManagerRef.current);
      console.log('🎯 GPS Snapper initialized for route-following');
    }
  }, []);

  // Enhanced connection with automatic reconnection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    console.log('🔌 Connecting WebSocket with GPS snapping enabled...');
    
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ WebSocket connected with GPS snapping');
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempts(0);
      setLastConnectedTime(Date.now());
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      socket.emit('join_tracking_room');
      socket.emit('get_unit_locations');
      socket.emit('get_emergency_updates');
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
      
      if (reason !== 'io client disconnect') {
        attemptReconnection();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('🔴 WebSocket connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
      attemptReconnection();
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
      setReconnectAttempts(0);
    });

    socket.on('reconnect_error', (error) => {
      console.error('🔴 WebSocket reconnection failed:', error);
      setReconnectAttempts(prev => prev + 1);
    });

    socket.on('reconnect_failed', () => {
      console.error('🔴 WebSocket reconnection failed permanently');
      setConnectionError('Failed to reconnect to server');
    });

    // 🚀 ENHANCED: Unit location update handler with GPS snapping
    socket.on('unit_location_update', (data) => {
      console.log('📍 Unit location update received:', data);
      
      // Validate data structure
      if (data && data.unit_id && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        // 🛠️ CRITICAL FIX: Snap GPS to route if we have route data
        const snappedResult = snapGPSIfNeeded(data);
        
        // Update unit locations with snapped position
        setUnitLocations(prev => ({
          ...prev,
          [data.unit_id]: {
            latitude: snappedResult.position[0],
            longitude: snappedResult.position[1],
            timestamp: data.timestamp,
            status: data.status,
            progress: data.progress,
            emergencyId: data.emergency_id,
            // Include original GPS data for debugging
            originalGPS: [data.latitude, data.longitude],
            isSnapped: snappedResult.isSnapped,
            snapDistance: snappedResult.distance,
            snapReason: snappedResult.reason,
            ...data
          }
        }));
      } else {
        console.warn('⚠️ Invalid unit location data received:', data);
      }
    });

    // Batch unit locations response with GPS snapping
    socket.on('unit_locations_response', (data) => {
      console.log('📊 Received unit locations batch with GPS snapping');
      if (data.locations && typeof data.locations === 'object') {
        const snappedLocations = {};
        
        Object.entries(data.locations).forEach(([unitId, location]) => {
          if (location.latitude && location.longitude) {
            const snappedResult = snapGPSIfNeeded({
              unit_id: unitId,
              latitude: location.latitude,
              longitude: location.longitude,
              timestamp: location.timestamp,
              status: location.status
            });
            
            snappedLocations[unitId] = {
              ...location,
              latitude: snappedResult.position[0],
              longitude: snappedResult.position[1],
              originalGPS: [location.latitude, location.longitude],
              isSnapped: snappedResult.isSnapped,
              snapDistance: snappedResult.distance,
              snapReason: snappedResult.reason
            };
          } else {
            snappedLocations[unitId] = location;
          }
        });
        
        setUnitLocations(snappedLocations);
      }
    });

    // Emergency update handler
    socket.on('emergency_update', (data) => {
      console.log('🚨 Emergency update received:', data);
      // Could be used to trigger route recalculation
    });

    // Room joined handler
    socket.on('room_joined', (data) => {
      console.log('🚪 Joined room:', data.room);
    });

    // Error handler
    socket.on('error', (error) => {
      console.error('🚫 WebSocket error:', error);
    });

  }, []);

  /**
   * 🛠️ CRITICAL FUNCTION: Snap GPS to route if we have route data
   * This is the key fix for straight-line movement
   */
  const snapGPSIfNeeded = (gpsData) => {
    if (!gpsSnapperRef.current) {
      // No GPS snapper available, return original position
      return {
        position: [gpsData.latitude, gpsData.longitude],
        isSnapped: false,
        reason: 'no_snapper',
        distance: 0
      };
    }

    // Try to find a route for this unit
    const routeId = findRouteForUnit(gpsData.unit_id);
    
    if (!routeId) {
      // No route found, return original position
      return {
        position: [gpsData.latitude, gpsData.longitude],
        isSnapped: false,
        reason: 'no_route',
        distance: 0
      };
    }

    // Snap GPS to route
    const snapResult = gpsSnapperRef.current.snapToRoute(
      gpsData.latitude, 
      gpsData.longitude, 
      routeId,
      {
        maxSnapDistance: 100, // Allow snapping up to 100m away
        gpsAccuracyThreshold: 20, // Snap if GPS accuracy > 20m
        offRouteThreshold: 50 // Consider off-route if > 50m away
      }
    );

    // Log snapping decision for debugging
    console.log(`🎯 GPS Snap Decision for Unit ${gpsData.unit_id}:`, {
      original: [gpsData.latitude, gpsData.longitude],
      snapped: snapResult.snappedPosition,
      distance: snapResult.distance.toFixed(1) + 'm',
      snapped: snapResult.isSnapped,
      reason: snapResult.reason
    });

    return {
      position: snapResult.snappedPosition,
      isSnapped: snapResult.isSnapped,
      reason: snapResult.reason,
      distance: snapResult.distance
    };
  };

  /**
   * Find route ID for a unit (emergency response system specific)
   */
  const findRouteForUnit = (unitId) => {
    // Look for active routes in the geometry manager
    const routes = geometryManagerRef.current.pathCache;
    
    // Try to match unit to route (you may need to adjust this logic)
    for (const [routeId, routeData] of routes.entries()) {
      // Check if this route belongs to this unit
      if (routeData.unitId === unitId || routeData.id === unitId) {
        return routeId;
      }
    }

    // Alternative: Look for routes with this unit ID pattern
    for (const [routeId] of routes.entries()) {
      if (routeId.includes(unitId)) {
        return routeId;
      }
    }

    return null;
  };

  // Reconnection logic with exponential backoff
  const attemptReconnection = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      return;
    }

    const maxAttempts = 5;
    const baseDelay = 1000;
    
    if (reconnectAttempts < maxAttempts) {
      const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), 10000);
      
      console.log(`🔄 Scheduling reconnection attempt ${reconnectAttempts + 1}/${maxAttempts} in ${delay}ms`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        setReconnectAttempts(prev => prev + 1);
        connect();
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      setConnectionError('Unable to connect to real-time server');
    }
  }, [reconnectAttempts, connect]);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [connect]);

  // Manual reconnection function
  const reconnect = useCallback(() => {
    console.log('🔄 Manual reconnection requested');
    setReconnectAttempts(0);
    setConnectionError(null);
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    connect();
  }, [connect]);

  // Force refresh unit locations
  const refreshUnitLocations = useCallback(() => {
    if (socketRef.current && isConnected) {
      console.log('🔄 Refreshing unit locations via WebSocket');
      socketRef.current.emit('get_unit_locations');
    }
  }, [isConnected]);

  // Function to update unit location manually (with GPS snapping)
  const updateUnitLocation = useCallback((unitId, latitude, longitude, status = 'ENROUTE') => {
    if (socketRef.current && isConnected) {
      // Apply GPS snapping before sending
      const snapResult = snapGPSIfNeeded({
        unit_id: unitId,
        latitude,
        longitude,
        status
      });

      socketRef.current.emit('update_unit_location', {
        unit_id: unitId,
        latitude: snapResult.position[0],
        longitude: snapResult.position[1],
        status
      });
      
      console.log(`📤 Updated unit ${unitId} location (${snapResult.isSnapped ? 'snapped' : 'raw'})`);
      return true;
    }
    return false;
  }, [isConnected]);

  // Get connection statistics
  const getConnectionStats = useCallback(() => {
    return {
      isConnected,
      reconnectAttempts,
      lastConnectedTime,
      hasError: !!connectionError,
      error: connectionError,
      unitCount: Object.keys(unitLocations).length,
      socketId: socketRef.current?.id,
      gpsSnapper: gpsSnapperRef.current ? 'enabled' : 'disabled'
    };
  }, [isConnected, reconnectAttempts, lastConnectedTime, connectionError, unitLocations]);

  return {
    isConnected,
    unitLocations,
    connectionError,
    reconnectAttempts,
    lastConnectedTime,
    updateUnitLocation,
    reconnect,
    refreshUnitLocations,
    getConnectionStats,
    socket: socketRef.current,
    geometryManager: geometryManagerRef.current,
    gpsSnapper: gpsSnapperRef.current
  };
};

// Enhanced hook for real-time unit markers with GPS snapping
export const useRealtimeUnitMarkersWithSnapping = (baseMarkers = [], routeGeometryManager = null) => {
  const { unitLocations, isConnected, geometryManager } = useWebSocketWithGPSSnapping(routeGeometryManager);
  
  const realtimeMarkers = baseMarkers.map(baseMarker => {
    const realtimeData = unitLocations[baseMarker.unit_id];
    
    if (realtimeData && isConnected) {
      return {
        ...baseMarker,
        latitude: realtimeData.latitude,
        longitude: realtimeData.longitude,
        status: realtimeData.status,
        isRealtime: true,
        lastUpdate: realtimeData.timestamp,
        // Include GPS snapping metadata
        isSnapped: realtimeData.isSnapped,
        snapDistance: realtimeData.snapDistance,
        snapReason: realtimeData.snapReason,
        originalGPS: realtimeData.originalGPS
      };
    }
    
    return {
      ...baseMarker,
      isRealtime: false
    };
  });

  return {
    markers: realtimeMarkers,
    isConnected,
    hasRealtimeData: Object.keys(unitLocations).length > 0,
    geometryManager
  };
};
