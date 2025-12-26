/**
 * useRouteFollowing.js
 * React hook for production-grade route-based marker animation with GPS snapping
 * Provides clean separation between route geometry, animation progress, and marker rendering
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import RouteAnimationManager from '../utils/RouteAnimationManager.js';
import RouteMovementController from '../utils/RouteMovementController.js';

export const useRouteFollowing = (map, options = {}) => {
  // Initialize RouteAnimationManager
  const animationManagerRef = useRef(null);
  const gpsSubscriptionsRef = useRef(new Map());
  const routeMovementControllerRef = useRef(null);

  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeRoutes, setActiveRoutes] = useState(new Map());
  const [performanceStats, setPerformanceStats] = useState({});
  const [routeStatuses, setRouteStatuses] = useState({});

  // Configuration
  const config = useMemo(() => ({
    enableGPSSnapping: true,
    maxSnapDistance: 100,
    gpsAccuracyThreshold: 20,
    animationFrameRate: 30,
    enableAutoProgress: true,
    progressUpdateInterval: 1000,
    ...options
  }), [options]);

  // Initialize animation manager when map is available
  useEffect(() => {
    if (map && !animationManagerRef.current) {
      try {
        animationManagerRef.current = new RouteAnimationManager(map, config);
        
        // 🔧 ENHANCED: Initialize RouteMovementController for WebSocket integration
        routeMovementControllerRef.current = new RouteMovementController();
        
        setIsInitialized(true);
        console.log('🎬 Route following system initialized with WebSocket integration');
      } catch (error) {
        console.error('❌ Failed to initialize route following system:', error);
      }
    }

    // Cleanup on unmount
    return () => {
      if (animationManagerRef.current) {
        animationManagerRef.current.destroy();
        animationManagerRef.current = null;
      }
      
      // 🔧 ENHANCED: Cleanup RouteMovementController
      if (routeMovementControllerRef.current) {
        routeMovementControllerRef.current.cleanupWebSocketIntegration();
        routeMovementControllerRef.current = null;
      }
      
      setIsInitialized(false);
    };
  }, [map, config]);

  // Update performance stats periodically
  useEffect(() => {
    if (!isInitialized) return;

    const updateStats = () => {
      const stats = animationManagerRef.current.getPerformanceStats();
      setPerformanceStats(stats);
    };

    const statsInterval = setInterval(updateStats, 2000);
    return () => clearInterval(statsInterval);
  }, [isInitialized]);

  // Update route statuses periodically
  useEffect(() => {
    if (!isInitialized) return;

    const updateStatuses = () => {
      const statuses = {};
      activeRoutes.forEach((_, routeId) => {
        const status = animationManagerRef.current.getAnimationStatus(routeId);
        if (status) {
          statuses[routeId] = status;
        }
      });
      setRouteStatuses(statuses);
    };

    const statusInterval = setInterval(updateStatuses, 500);
    return () => clearInterval(statusInterval);
  }, [isInitialized, activeRoutes]);

  /**
   * Register a route for animation
   * @param {Object} osrmRoute - OSRM route response
   * @param {string} routeId - Unique route identifier
   * @param {Object} options - Route options
   */
  const registerRoute = useCallback((osrmRoute, routeId, options = {}) => {
    if (!isInitialized || !animationManagerRef.current) {
      throw new Error('Route following system not initialized');
    }

    try {
      const routeState = animationManagerRef.current.registerRoute(osrmRoute, routeId, options);
      setActiveRoutes(prev => new Map(prev).set(routeId, routeState));

      return routeState;
    } catch (error) {
      console.error(`❌ Failed to register route ${routeId}:`, error);
      throw error;
    }
  }, [isInitialized]);

  /**
   * Start route animation
   * @param {string} routeId - Route identifier
   * @param {Object} options - Animation options
   */
  const startAnimation = useCallback((routeId, options = {}) => {
    if (!isInitialized || !animationManagerRef.current) return;

    try {
      animationManagerRef.current.startAnimation(routeId, options);
      setActiveRoutes(prev => {
        const newMap = new Map(prev);
        const routeState = newMap.get(routeId);
        if (routeState) {
          routeState.isAnimating = true;
          newMap.set(routeId, routeState);
        }
        return newMap;
      });
    } catch (error) {
      console.error(`❌ Failed to start animation for route ${routeId}:`, error);
      throw error;
    }
  }, [isInitialized]);

  /**
   * Stop route animation
   * @param {string} routeId - Route identifier
   */
  const stopAnimation = useCallback((routeId) => {
    if (!isInitialized || !animationManagerRef.current) return;

    animationManagerRef.current.stopAnimation(routeId);
    setActiveRoutes(prev => {
      const newMap = new Map(prev);
      const routeState = newMap.get(routeId);
      if (routeState) {
        routeState.isAnimating = false;
        routeState.isGPSActive = false;
      }
      return newMap;
    });
  }, [isInitialized]);

  /**
   * Update marker position at specific progress
   * @param {string} routeId - Route identifier
   * @param {number} progress - Progress (0-1)
   */
  const updateProgress = useCallback((routeId, progress) => {
    if (!isInitialized || !animationManagerRef.current) return;

    animationManagerRef.current.updateMarkerAtProgress(routeId, progress);
  }, [isInitialized]);

  /**
   * Subscribe to GPS updates for route following
   * @param {string} routeId - Route identifier
   * @param {Function} gpsCallback - GPS callback function
   * @returns {Function} Unsubscribe function
   */
  const subscribeToGPS = useCallback((routeId, gpsCallback) => {
    if (!isInitialized || !animationManagerRef.current) return null;

    const wrappedCallback = animationManagerRef.current.subscribeToGPS(routeId, gpsCallback);

    gpsSubscriptionsRef.current.set(routeId, wrappedCallback);

    // Update route state
    setActiveRoutes(prev => {
      const newMap = new Map(prev);
      const routeState = newMap.get(routeId);
      if (routeState) {
        routeState.isGPSActive = true;
        newMap.set(routeId, routeState);
      }
      return newMap;
    });

    // Return unsubscribe function
    return () => {
      if (animationManagerRef.current) {
        animationManagerRef.current.unsubscribeFromGPS(routeId);
      }
      gpsSubscriptionsRef.current.delete(routeId);

      setActiveRoutes(prev => {
        const newMap = new Map(prev);
        const routeState = newMap.get(routeId);
        if (routeState) {
          routeState.isGPSActive = false;
        }
        return newMap;
      });
    };
  }, [isInitialized]);

  /**
   * Update route progress from GPS coordinates
   * @param {string} routeId - Route identifier
   * @param {number} lat - GPS latitude
   * @param {number} lng - GPS longitude
   * @param {Object} gpsData - GPS metadata
   */
  const updateFromGPS = useCallback((routeId, lat, lng, gpsData = {}) => {
    if (!isInitialized || !animationManagerRef.current) return;

    animationManagerRef.current.updateProgressFromGPS(routeId, lat, lng, gpsData);
  }, [isInitialized]);

  /**
   * Pause route animation
   * @param {string} routeId - Route identifier
   */
  const pauseAnimation = useCallback((routeId) => {
    if (!isInitialized || !animationManagerRef.current) return;
    animationManagerRef.current.pauseAnimation(routeId);
  }, [isInitialized]);

  /**
   * Resume route animation
   * @param {string} routeId - Route identifier
   */
  const resumeAnimation = useCallback((routeId) => {
    if (!isInitialized || !animationManagerRef.current) return;
    animationManagerRef.current.resumeAnimation(routeId);
  }, [isInitialized]);

  /**
   * Set animation speed multiplier
   * @param {string} routeId - Route identifier
   * @param {number} multiplier - Speed multiplier
   */
  const setSpeed = useCallback((routeId, multiplier) => {
    if (!isInitialized || !animationManagerRef.current) return;
    animationManagerRef.current.setSpeed(routeId, multiplier);
  }, [isInitialized]);

  /**
   * Get route status
   * @param {string} routeId - Route identifier
   * @returns {Object} Route status
   */
  const getRouteStatus = useCallback((routeId) => {
    const status = routeStatuses[routeId] || null;
    
    // Enhanced status with position information
    if (status && status.lastPosition) {
      return {
        ...status,
        hasPosition: true,
        position: status.lastPosition
      };
    }
    
    // If no status but route exists, try to get position directly
    if (!status && animationManagerRef.current) {
      const routeState = animationManagerRef.current.activeRoutes.get(routeId);
      if (routeState && routeState.lastPosition) {
        return {
          routeId,
          lastPosition: routeState.lastPosition,
          hasPosition: true,
          position: routeState.lastPosition,
          isAnimating: routeState.isAnimating,
          progress: routeState.progress
        };
      }
    }
    
    return status;
  }, [routeStatuses]);

  /**
   * Remove route
   * @param {string} routeId - Route identifier
   */
  const removeRoute = useCallback((routeId) => {
    if (!isInitialized || !animationManagerRef.current) return;

    animationManagerRef.current.removeRoute(routeId);
    setActiveRoutes(prev => {
      const newMap = new Map(prev);
      newMap.delete(routeId);
      return newMap;
    });
    gpsSubscriptionsRef.current.delete(routeId);
  }, [isInitialized]);

  /**
   * Clear all routes and animations
   */
  const clearAll = useCallback(() => {
    if (!isInitialized || !animationManagerRef.current) return;

    animationManagerRef.current.clearAll();
    setActiveRoutes(new Map());
    setRouteStatuses({});
    gpsSubscriptionsRef.current.clear();
  }, [isInitialized]);

  /**
   * Emergency stop all animations
   */
  const emergencyStop = useCallback(() => {
    if (!isInitialized || !animationManagerRef.current) return;
    animationManagerRef.current.emergencyStop();
  }, [isInitialized]);

  /**
   * Get position at progress (utility function)
   * @param {string} routeId - Route identifier
   * @param {number} progress - Progress (0-1)
   * @returns {Array} [lat, lng] position
   */
  const getPositionAtProgress = useCallback((routeId, progress) => {
    if (!isInitialized || !animationManagerRef.current) return null;
    return animationManagerRef.current.geometryManager.getPositionAtDistance(
      routeId,
      animationManagerRef.current.activeRoutes.get(routeId)?.route?.totalDistance * progress
    );
  }, [isInitialized]);

  /**
   * Get heading at progress (utility function)
   * @param {string} routeId - Route identifier
   * @param {number} progress - Progress (0-1)
   * @returns {number} Heading in degrees
   */
  const getHeadingAtProgress = useCallback((routeId, progress) => {
    if (!isInitialized || !animationManagerRef.current) return 0;
    return animationManagerRef.current.geometryManager.getHeadingAtDistance(
      routeId,
      animationManagerRef.current.activeRoutes.get(routeId)?.route?.totalDistance * progress
    );
  }, [isInitialized]);

  /**
   * 🔧 ENHANCED: Handle WebSocket location update with OSRM integration
   * @param {Object} locationUpdate - WebSocket location update data
   */
  const handleWebSocketUpdate = useCallback((locationUpdate) => {
    try {
      const { unit_id, latitude, longitude, progress, route_data, emergency_id, route_geometry, osrm_route_id } = locationUpdate;
      
      if (!unit_id) {
        console.warn('⚠️ Cannot process WebSocket update: missing unitId');
        return;
      }

      const routeId = `route-${unit_id}`;
      
      // 🔧 ENHANCED: Use RouteMovementController for better OSRM integration
      if (routeMovementControllerRef.current) {
        const movementResult = routeMovementControllerRef.current.handleWebSocketUpdate(locationUpdate);
        
        if (movementResult) {
          console.log(`📡 WebSocket update processed for Unit ${unit_id}:`, {
            progress: (movementResult.progress * 100).toFixed(1) + '%',
            hasOSRMData: movementResult.hasOSRMData,
            osrmRouteId: movementResult.osrmRouteId,
            source: movementResult.source
          });
        }
      }
      
      // 🔧 ENHANCED: Use OSRM data directly if available
      let routeDataToUse = null;
      if (route_geometry) {
        // Use full OSRM geometry
        routeDataToUse = {
          geometry: JSON.parse(route_geometry),
          distance: locationUpdate.route_distance,
          duration: locationUpdate.route_duration
        };
        console.log(`🎯 Using direct OSRM geometry for Unit ${unit_id}`);
      } else if (route_data) {
        // Fallback to route_data format
        routeDataToUse = route_data;
        console.log(`🎯 Using route_data for Unit ${unit_id}`);
      }
      
      // Update progress tracking with enhanced data
      updateProgress(routeId, progress || 0);
      
      // Register route if not already registered and route data is available
      if (routeDataToUse && !activeRoutes.has(routeId)) {
        try {
          registerRoute(routeDataToUse, routeId, {
            vehicleType: 'AMBULANCE',
            autoStart: true,
            enableGPSSnapping: true,
            useDirectOSRM: !!route_geometry,
            osrmRouteId: osrm_route_id,
            source: 'websocket'
          });
          
          console.log(`🛣️ Route registered from WebSocket update: ${routeId}`, {
            hasOSRMData: !!route_geometry,
            osrmRouteId: osrm_route_id
          });
        } catch (error) {
          console.error(`❌ Failed to register route from WebSocket: ${routeId}`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket update:', error);
    }
  }, [activeRoutes, registerRoute, updateProgress]);

  /**
   * 🔧 ENHANCED: Get polyline data from RouteMovementController
   * @returns {Array} Array of polyline data objects
   */
  const getAllPolylineData = useCallback(() => {
    if (!routeMovementControllerRef.current) {
      console.warn('⚠️ RouteMovementController not available for polyline data');
      return [];
    }
    
    const polylineData = routeMovementControllerRef.current.getAllPolylineData();
    console.log(`📊 Generated ${polylineData.length} polyline data objects from WebSocket integration`);
    return polylineData;
  }, []);

  /**
   * 🔧 ENHANCED: Get enhanced route status
   * @param {string} unitId - Unit identifier
   * @returns {Object|null} Enhanced route status
   */
  const getEnhancedRouteStatus = useCallback((unitId) => {
    if (!routeMovementControllerRef.current) {
      return null;
    }
    
    return routeMovementControllerRef.current.getEnhancedRouteStatus(unitId);
  }, []);

  // API surface
  return {
    // State
    isInitialized,
    activeRoutes: Array.from(activeRoutes.keys()),
    routeStatuses,
    performanceStats,

    // Core route management
    registerRoute,
    removeRoute,
    clearAll,

    // Animation control
    startAnimation,
    stopAnimation,
    pauseAnimation,
    resumeAnimation,
    setSpeed,

    // Progress control
    updateProgress,

    // GPS integration
    subscribeToGPS,
    updateFromGPS,

    // 🔧 ENHANCED: WebSocket integration
    handleWebSocketUpdate,
    getAllPolylineData,
    getEnhancedRouteStatus,

    // Utility functions
    getRouteStatus,
    getPositionAtProgress,
    getHeadingAtProgress,

    // Emergency controls
    emergencyStop,

    // Managers (for advanced usage)
    animationManager: animationManagerRef.current,
    routeMovementController: routeMovementControllerRef.current
  };
};

export default useRouteFollowing;
