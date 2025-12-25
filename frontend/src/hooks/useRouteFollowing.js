/**
 * useRouteFollowing.js
 * React hook for production-grade route-based marker animation with GPS snapping
 * Provides clean separation between route geometry, animation progress, and marker rendering
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import RouteAnimationManager from '../utils/RouteAnimationManager.js';

export const useRouteFollowing = (map, options = {}) => {
  // Initialize RouteAnimationManager
  const animationManagerRef = useRef(null);
  const gpsSubscriptionsRef = useRef(new Map());

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
        setIsInitialized(true);
        console.log('🎬 Route following system initialized');
      } catch (error) {
        console.error('❌ Failed to initialize route following system:', error);
      }
    }

    // Cleanup on unmount
    return () => {
      if (animationManagerRef.current) {
        animationManagerRef.current.destroy();
        animationManagerRef.current = null;
        setIsInitialized(false);
      }
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
    return routeStatuses[routeId] || null;
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

    // Utility functions
    getRouteStatus,
    getPositionAtProgress,
    getHeadingAtProgress,

    // Emergency controls
    emergencyStop,

    // Managers (for advanced usage)
    animationManager: animationManagerRef.current
  };
};

export default useRouteFollowing;
