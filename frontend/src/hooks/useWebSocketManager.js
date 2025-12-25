import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

// Centralized WebSocket manager with request coordination
const SOCKET_URL = 'http://127.0.0.1:5001';

// Global connection instance
let globalSocket = null;
let globalConnectionState = {
  isConnected: false,
  connectionError: null,
  reconnectAttempts: 0,
  subscribers: new Map(),
  requestQueue: [],
  lastConnectionTime: null,
  isConnecting: false
};

// Request types for prioritization
const REQUEST_TYPES = {
  CRITICAL: 1,    // Connection events, initial data
  NORMAL: 2,      // Regular updates
  LOW: 3          // Refresh requests, history
};

// Connection manager class
class WebSocketConnectionManager {
  constructor() {
    this.subscribers = new Map();
    this.requestQueue = [];
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeoutRef = null;
  }

  // Initialize or get existing connection
  getConnection() {
    if (globalSocket?.connected) {
      return globalSocket;
    }

    if (this.isConnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return globalSocket;
    }

    this.isConnecting = true;
    console.log('🔌 Creating centralized WebSocket connection...');
    
    globalSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true
    });

    this.setupEventHandlers();
    return globalSocket;
  }

  setupEventHandlers() {
    const socket = globalSocket;

    socket.on('connect', () => {
      console.log('✅ Centralized WebSocket connected successfully');
      globalConnectionState.isConnected = true;
      globalConnectionState.connectionError = null;
      globalConnectionState.reconnectAttempts = 0;
      globalConnectionState.lastConnectedTime = Date.now();
      this.isConnecting = false;
      
      // Clear any pending reconnection timeout
      if (this.reconnectTimeoutRef) {
        clearTimeout(this.reconnectTimeoutRef);
        this.reconnectTimeoutRef = null;
      }
      
      // Join tracking room
      socket.emit('join_tracking_room');
      
      // Process queued requests
      this.processRequestQueue();
      
      // Notify all subscribers
      this.notifySubscribers('connection', { status: 'connected' });
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Centralized WebSocket disconnected:', reason);
      globalConnectionState.isConnected = false;
      
      // Notify all subscribers
      this.notifySubscribers('connection', { status: 'disconnected', reason });
      
      // Attempt reconnection if not intentional
      if (reason !== 'io client disconnect') {
        this.attemptReconnection();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('🔴 Centralized WebSocket connection error:', error);
      globalConnectionState.connectionError = error.message;
      globalConnectionState.isConnected = false;
      this.isConnecting = false;
      
      this.attemptReconnection();
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Centralized WebSocket reconnected after', attemptNumber, 'attempts');
      globalConnectionState.reconnectAttempts = 0;
      this.notifySubscribers('connection', { status: 'reconnected', attempts: attemptNumber });
    });

    socket.on('reconnect_error', (error) => {
      console.error('🔴 Centralized WebSocket reconnection failed:', error);
      globalConnectionState.reconnectAttempts++;
      this.notifySubscribers('connection', { 
        status: 'reconnect_error', 
        attempts: globalConnectionState.reconnectAttempts 
      });
    });

    socket.on('reconnect_failed', () => {
      console.error('🔴 Centralized WebSocket reconnection failed permanently');
      globalConnectionState.connectionError = 'Failed to reconnect to server';
      this.notifySubscribers('connection', { status: 'reconnect_failed' });
    });

    // Data event handlers
    socket.on('unit_location_update', (data) => {
      console.log('📍 Centralized unit location update received:', data);
      this.notifySubscribers('unit_location_update', data);
    });

    socket.on('unit_locations_response', (data) => {
      console.log('📊 Centralized unit locations batch received:', data);
      this.notifySubscribers('unit_locations_response', data);
    });

    socket.on('emergency_update', (data) => {
      console.log('🚨 Centralized emergency update received:', data);
      this.notifySubscribers('emergency_update', data);
    });

    socket.on('emergency_created', (data) => {
      console.log('🆕 Centralized emergency created received:', data);
      this.notifySubscribers('emergency_created', data);
    });

    socket.on('emergency_updated', (data) => {
      console.log('📝 Centralized emergency updated received:', data);
      this.notifySubscribers('emergency_updated', data);
    });

    socket.on('unit_status_update', (data) => {
      console.log('📍 Centralized unit status update received:', data);
      this.notifySubscribers('unit_status_update', data);
    });

    socket.on('unit_history_response', (data) => {
      console.log('📈 Centralized unit history received:', data);
      this.notifySubscribers('unit_history_response', data);
    });

    socket.on('error', (error) => {
      console.error('🚫 Centralized WebSocket error:', error);
      this.notifySubscribers('error', error);
    });
  }

  attemptReconnection() {
    if (this.reconnectTimeoutRef || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const baseDelay = 1000;
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), 10000);
    
    console.log(`🔄 Scheduling centralized reconnection attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeoutRef = setTimeout(() => {
      this.reconnectTimeoutRef = null;
      this.reconnectAttempts++;
      this.getConnection();
    }, delay);
  }

  // Add subscriber for specific events
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);

    // Return unsubscribe function
    return () => {
      const eventSubscribers = this.subscribers.get(eventType);
      if (eventSubscribers) {
        eventSubscribers.delete(callback);
        if (eventSubscribers.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  // Notify all subscribers of an event
  notifySubscribers(eventType, data) {
    const eventSubscribers = this.subscribers.get(eventType);
    if (eventSubscribers) {
      eventSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket subscriber callback:', error);
        }
      });
    }
  }

  // Queue a request with priority
  queueRequest(event, data, priority = REQUEST_TYPES.NORMAL) {
    const request = {
      id: Date.now() + Math.random(),
      event,
      data,
      priority,
      timestamp: Date.now()
    };

    // Insert request in priority order
    const insertIndex = this.requestQueue.findIndex(req => req.priority > priority);
    if (insertIndex === -1) {
      this.requestQueue.push(request);
    } else {
      this.requestQueue.splice(insertIndex, 0, request);
    }

    return request.id;
  }

  // Process queued requests
  processRequestQueue() {
    if (!globalSocket?.connected || this.requestQueue.length === 0) {
      return;
    }

    console.log(`📤 Processing ${this.requestQueue.length} queued requests`);
    
    // Process requests with small delays to prevent bursts
    this.requestQueue.forEach((request, index) => {
      setTimeout(() => {
        if (globalSocket?.connected) {
          console.log(`📤 Processing queued request: ${request.event}`);
          globalSocket.emit(request.event, request.data);
        }
      }, index * 100); // 100ms delay between requests
    });

    this.requestQueue = [];
  }

  // Send event with request coordination
  emit(event, data = {}, priority = REQUEST_TYPES.NORMAL, immediate = false) {
    if (!globalSocket) {
      this.getConnection();
    }

    if (globalSocket?.connected && immediate) {
      console.log(`📤 Immediate emit: ${event}`);
      globalSocket.emit(event, data);
      return true;
    }

    // Queue the request
    const requestId = this.queueRequest(event, data, priority);
    console.log(`📥 Queued request: ${event} (ID: ${requestId})`);
    
    // If connected, process queue
    if (globalSocket?.connected) {
      this.processRequestQueue();
    }

    return requestId;
  }

  // Get connection statistics
  getStats() {
    return {
      isConnected: globalConnectionState.isConnected,
      connectionError: globalConnectionState.connectionError,
      reconnectAttempts: globalConnectionState.reconnectAttempts,
      lastConnectedTime: globalConnectionState.lastConnectedTime,
      subscriberCount: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
      queuedRequests: this.requestQueue.length,
      isConnecting: this.isConnecting
    };
  }

  // Manual reconnection
  reconnect() {
    console.log('🔄 Manual reconnection requested');
    globalConnectionState.reconnectAttempts = 0;
    globalConnectionState.connectionError = null;
    
    if (globalSocket) {
      globalSocket.disconnect();
    }
    
    this.getConnection();
  }

  // Cleanup
  disconnect() {
    if (this.reconnectTimeoutRef) {
      clearTimeout(this.reconnectTimeoutRef);
    }
    if (globalSocket) {
      globalSocket.disconnect();
    }
    this.subscribers.clear();
    this.requestQueue = [];
  }
}

// Global instance
export const connectionManager = new WebSocketConnectionManager();

// React hook for components to use
export const useWebSocketManager = () => {
  const [connectionState, setConnectionState] = useState({
    isConnected: globalConnectionState.isConnected,
    connectionError: globalConnectionState.connectionError,
    reconnectAttempts: globalConnectionState.reconnectAttempts,
    lastConnectedTime: globalConnectionState.lastConnectedTime
  });

  const [unitLocations, setUnitLocations] = useState({});
  const subscribersRef = useRef([]);

  // Initialize connection on first use
  useEffect(() => {
    const socket = connectionManager.getConnection();
    
    // Subscribe to connection state changes
    const unsubscribeConnection = connectionManager.subscribe('connection', (data) => {
      setConnectionState(prev => ({
        ...prev,
        isConnected: data.status === 'connected' || data.status === 'reconnected',
        connectionError: data.status === 'reconnect_failed' ? 'Failed to reconnect' : null,
        reconnectAttempts: data.attempts || 0,
        lastConnectedTime: data.status === 'connected' ? Date.now() : prev.lastConnectedTime
      }));
    });

    // Subscribe to unit location updates
    const unsubscribeUnitLocations = connectionManager.subscribe('unit_location_update', (data) => {
      if (data && data.unit_id && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        setUnitLocations(prev => ({
          ...prev,
          [data.unit_id]: {
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: data.timestamp,
            status: data.status,
            progress: data.progress,
            emergencyId: data.emergency_id,
            ...data
          }
        }));
      }
    });

    // Subscribe to batch unit location responses
    const unsubscribeUnitLocationsResponse = connectionManager.subscribe('unit_locations_response', (data) => {
      if (data.locations && typeof data.locations === 'object') {
        setUnitLocations(data.locations);
      }
    });

    subscribersRef.current = [unsubscribeConnection, unsubscribeUnitLocations, unsubscribeUnitLocationsResponse];

    return () => {
      subscribersRef.current.forEach(unsub => unsub && unsub());
    };
  }, []);

  // Define callbacks
  const emit = useCallback((event, data = {}, priority = REQUEST_TYPES.NORMAL, immediate = false) => {
    return connectionManager.emit(event, data, priority, immediate);
  }, []);

  const refreshUnitLocations = useCallback(() => {
    return connectionManager.emit('get_unit_locations', {}, REQUEST_TYPES.CRITICAL, true);
  }, []);

  const updateUnitLocation = useCallback((unitId, latitude, longitude, status = 'ENROUTE') => {
    return connectionManager.emit('update_unit_location', {
      unit_id: unitId,
      latitude,
      longitude,
      status
    }, REQUEST_TYPES.NORMAL);
  }, []);

  const getUnitHistory = useCallback((unitId) => {
    return connectionManager.emit('get_unit_history', { unit_id: unitId }, REQUEST_TYPES.LOW);
  }, []);

  const emitEmergencyEvent = useCallback((action, emergencyData) => {
    return connectionManager.emit(`emergency_${action}`, emergencyData, REQUEST_TYPES.NORMAL);
  }, []);

  const reconnect = useCallback(() => {
    connectionManager.reconnect();
  }, []);

  const getStats = useCallback(() => {
    return {
      ...connectionManager.getStats(),
      ...connectionState
    };
  }, [connectionState]);

  // Memoized API
  const api = useMemo(() => ({
    // Connection management
    isConnected: connectionState.isConnected,
    connectionError: connectionState.connectionError,
    reconnectAttempts: connectionState.reconnectAttempts,

    // Data access
    unitLocations,

    // Actions
    emit,
    refreshUnitLocations,
    updateUnitLocation,
    getUnitHistory,
    emitEmergencyEvent,
    reconnect,
    getStats
  }), [connectionState, unitLocations, emit, refreshUnitLocations, updateUnitLocation, getUnitHistory, emitEmergencyEvent, reconnect, getStats]);

  return api;
};

// Export for backward compatibility
export { REQUEST_TYPES };

// Enhanced hook for real-time unit markers
export const useRealtimeUnitMarkers = (baseMarkers = []) => {
  const { unitLocations, isConnected } = useWebSocketManager();
  
  const realtimeMarkers = useMemo(() => {
    return baseMarkers.map(baseMarker => {
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
  }, [baseMarkers, unitLocations, isConnected]);

  return {
    markers: realtimeMarkers,
    isConnected,
    hasRealtimeData: Object.keys(unitLocations).length > 0
  };
};
