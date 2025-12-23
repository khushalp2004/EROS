import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [unitLocations, setUnitLocations] = useState({});
  const [connectionError, setConnectionError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
      
      // Join the unit tracking room
      socket.emit('join_tracking_room');
      
      // Request current unit locations
      socket.emit('get_unit_locations');
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Unit location update handler
    socket.on('unit_location_update', (data) => {
      console.log('Unit location update:', data);
      setUnitLocations(prev => ({
        ...prev,
        [data.unit_id]: {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp,
          status: data.status
        }
      }));
    });

    // Unit locations response handler
    socket.on('unit_locations_response', (data) => {
      console.log('Received unit locations:', data.locations);
      setUnitLocations(data.locations || {});
    });

    // Unit history response handler
    socket.on('unit_history_response', (data) => {
      console.log('Unit history received:', data);
      // Handle unit location history if needed
    });

    // Connection status handler
    socket.on('connection_status', (data) => {
      console.log('Connection status:', data);
    });

    // Room joined handler
    socket.on('room_joined', (data) => {
      console.log('Joined room:', data.room);
    });

    // Emergency update handler
    socket.on('emergency_update', (data) => {
      console.log('Emergency update received:', data);
      // Handle emergency updates if needed
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Function to update unit location manually
  const updateUnitLocation = (unitId, latitude, longitude, status = 'ENROUTE') => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('update_unit_location', {
        unit_id: unitId,
        latitude,
        longitude,
        status
      });
    }
  };

  // Function to get unit history
  const getUnitHistory = (unitId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('get_unit_history', { unit_id: unitId });
    }
  };

  // Function to emit emergency events
  const emitEmergencyEvent = (action, emergencyData) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(`emergency_${action}`, emergencyData);
    }
  };

  return {
    isConnected,
    unitLocations,
    connectionError,
    updateUnitLocation,
    getUnitHistory,
    emitEmergencyEvent,
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
