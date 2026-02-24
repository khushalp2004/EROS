import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:5001';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [unitLocations, setUnitLocations] = useState({});
  const [connectionError, setConnectionError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastConnectedTime, setLastConnectedTime] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Enhanced connection with automatic reconnection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    console.log('🔌 Attempting WebSocket connection...');
    
    const authToken = localStorage.getItem('authToken');
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
      auth: authToken ? { token: authToken } : undefined
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ WebSocket connected successfully');
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempts(0);
      setLastConnectedTime(Date.now());
      
      // Clear any pending reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Join the unit tracking room
      socket.emit('join_tracking_room');
      
      // Request current unit locations
      socket.emit('get_unit_locations');
      
      // Request emergency updates
      socket.emit('get_emergency_updates');
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
      
      // Attempt reconnection if not intentional
      if (reason !== 'io client disconnect') {
        attemptReconnection();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('🔴 WebSocket connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
      
      // Attempt reconnection with exponential backoff
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

    // Unit location update handler with route progress integration
    socket.on('unit_location_update', (data) => {
      console.log('📍 Unit location update received:', data);
      
      // Validate data structure
      if (data && data.unit_id && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const locationData = {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp,
          status: data.status,
          progress: data.progress || 0,
          emergencyId: data.emergency_id,
          routeData: data.route_data,
          ...data
        };
        
        setUnitLocations(prev => ({
          ...prev,
          [data.unit_id]: locationData
        }));
        
        // 🆕 INTEGRATE: RouteMovementController for route-constrained updates
        if (data.route_data && data.progress !== undefined) {
          try {
            // This would integrate with the RouteMovementController
            // For now, we'll emit a custom event that components can listen to
            window.dispatchEvent(new CustomEvent('unitLocationUpdate', {
              detail: {
                unitId: data.unit_id,
                latitude: data.latitude,
                longitude: data.longitude,
                progress: data.progress,
                routeData: data.route_data,
                emergencyId: data.emergency_id,
                rawData: data
              }
            }));
          } catch (error) {
            console.error('Error dispatching unit location update event:', error);
          }
        }
      } else {
        console.warn('⚠️ Invalid unit location data received:', data);
      }
    });

    // Unit locations response handler
    socket.on('unit_locations_response', (data) => {
      console.log('📊 Received unit locations batch:', data.locations);
      if (data.locations && typeof data.locations === 'object') {
        setUnitLocations(data.locations);
      }
    });

    // Emergency update handler
    socket.on('emergency_update', (data) => {
      console.log('🚨 Emergency update received:', data);
      // Handle emergency updates - could be used to trigger state updates
    });

    // Unit history response handler
    socket.on('unit_history_response', (data) => {
      console.log('📈 Unit history received:', data);
    });

    // Connection status handler
    socket.on('connection_status', (data) => {
      console.log('📡 Connection status:', data);
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

  // Reconnection logic with exponential backoff
  const attemptReconnection = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      return; // Already attempting reconnection
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

    // Cleanup function
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

  // Function to update unit location manually
  const updateUnitLocation = useCallback((unitId, latitude, longitude, status = 'ENROUTE') => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('update_unit_location', {
        unit_id: unitId,
        latitude,
        longitude,
        status
      });
      return true;
    }
    return false;
  }, [isConnected]);

  // Function to get unit history
  const getUnitHistory = useCallback((unitId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('get_unit_history', { unit_id: unitId });
      return true;
    }
    return false;
  }, [isConnected]);

  // Function to emit emergency events
  const emitEmergencyEvent = useCallback((action, emergencyData) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(`emergency_${action}`, emergencyData);
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
      socketId: socketRef.current?.id
    };
  }, [isConnected, reconnectAttempts, lastConnectedTime, connectionError, unitLocations]);

  return {
    isConnected,
    unitLocations,
    connectionError,
    reconnectAttempts,
    lastConnectedTime,
    updateUnitLocation,
    getUnitHistory,
    emitEmergencyEvent,
    reconnect,
    refreshUnitLocations,
    getConnectionStats,
    socket: socketRef.current
  };
};

// Hook for real-time unit markers
export const useRealtimeUnitMarkers = (baseMarkers = []) => {
  const { unitLocations, isConnected } = useWebSocket();
  
  const realtimeMarkers = baseMarkers.map(baseMarker => {
    const realtimeData = unitLocations[baseMarker.unit_id];
    
    if (realtimeData && isConnected) {
      return {
        ...baseMarker,
        latitude: realtimeData.latitude,
        longitude: realtimeData.longitude,
        status: realtimeData.status,
        isRealtime: true,
        lastUpdate: realtimeData.timestamp
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
    hasRealtimeData: Object.keys(unitLocations).length > 0
  };
};
