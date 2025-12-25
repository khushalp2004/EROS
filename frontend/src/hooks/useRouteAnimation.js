/**
 * useRouteAnimation.js
 * React hook for route-based marker animation
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import RouteGeometryManager from '../utils/RouteGeometryManager';
import RouteProgressManager from '../utils/RouteProgressManager';
import RouteMarkerRenderer from '../utils/RouteMarkerRenderer';

export const useRouteAnimation = (map, options = {}) => {
  const {
    defaultSpeed = 'normal',
    defaultDuration = 30000,
    enableAutoStart = false,
    onAnimationComplete,
    onAnimationStart,
    onAnimationError
  } = options;

  // Initialize managers
  const geometryManagerRef = useRef(new RouteGeometryManager());
  const progressManagerRef = useRef(new RouteProgressManager());
  const markerRendererRef = useRef(null);
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeAnimations, setActiveAnimations] = useState(new Map());
  const [animationStats, setAnimationStats] = useState({});

  // Initialize marker renderer when map is available
  useEffect(() => {
    if (map && !markerRendererRef.current) {
      markerRendererRef.current = new RouteMarkerRenderer(
        map,
        geometryManagerRef.current,
        progressManagerRef.current
      );
      setIsInitialized(true);
      console.log('🎬 Route animation system initialized');
    }
  }, [map]);

  // Animation loop management
  useEffect(() => {
    if (!isInitialized || !markerRendererRef.current) return;

    const updateAnimationStats = () => {
      const stats = {};
      activeAnimations.forEach((_, routeId) => {
        const status = progressManagerRef.current.getAnimationStatus(routeId);
        if (status) {
          stats[routeId] = status;
        }
      });
      setAnimationStats(stats);
    };

    // Update stats every 500ms
    const statsInterval = setInterval(updateAnimationStats, 500);

    return () => clearInterval(statsInterval);
  }, [isInitialized, activeAnimations]);

  // Process OSRM route and prepare for animation
  const processRoute = useCallback((osrmRoute, routeId, vehicleType = 'default') => {
    try {
      const processedRoute = geometryManagerRef.current.processOSRMRoute(osrmRoute, routeId);
      processedRoute.vehicleType = vehicleType;
      
      console.log(`🛣️ Route processed and ready for animation: ${routeId}`);
      return processedRoute;
    } catch (error) {
      console.error(`❌ Error processing route ${routeId}:`, error);
      onAnimationError?.(routeId, error);
      throw error;
    }
  }, [onAnimationError]);

  // Start route animation
  const startAnimation = useCallback((routeId, options = {}) => {
    if (!isInitialized) {
      console.warn('⚠️ Route animation system not initialized');
      return null;
    }

    const {
      duration = defaultDuration,
      speed = defaultSpeed,
      onComplete,
      autoStart = enableAutoStart
    } = options;

    try {
      // Check if route exists
      const route = geometryManagerRef.current.getRoute(routeId);
      if (!route) {
        throw new Error(`Route ${routeId} not found. Process route first.`);
      }

      // Start animation
      const animation = progressManagerRef.current.startRouteAnimationWithCallback(
        routeId,
        duration,
        speed,
        (id, status) => {
          setActiveAnimations(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
          });
          onAnimationComplete?.(id, status);
        }
      );

      setActiveAnimations(prev => new Map(prev).set(routeId, animation));
      onAnimationStart?.(routeId, animation);

      // Start animation loop if not already running
      markerRendererRef.current?.startAnimationLoop();

      console.log(`🎬 Started animation for route ${routeId}: ${duration}ms, ${speed} speed`);
      return animation;
    } catch (error) {
      console.error(`❌ Error starting animation for ${routeId}:`, error);
      onAnimationError?.(routeId, error);
      return null;
    }
  }, [isInitialized, defaultDuration, defaultSpeed, enableAutoStart, onAnimationComplete, onAnimationStart, onAnimationError]);

  // Stop animation
  const stopAnimation = useCallback((routeId) => {
    progressManagerRef.current.stopAnimation(routeId);
    markerRendererRef.current?.removeMarker(routeId);
    
    setActiveAnimations(prev => {
      const newMap = new Map(prev);
      newMap.delete(routeId);
      return newMap;
    });
    
    console.log(`⏹️ Stopped animation for route ${routeId}`);
  }, []);

  // Pause animation
  const pauseAnimation = useCallback((routeId) => {
    progressManagerRef.current.pauseAnimation(routeId);
    console.log(`⏸️ Paused animation for route ${routeId}`);
  }, []);

  // Resume animation
  const resumeAnimation = useCallback((routeId) => {
    progressManagerRef.current.resumeAnimation(routeId);
    console.log(`▶️ Resumed animation for route ${routeId}`);
  }, []);

  // Set animation speed
  const setSpeed = useCallback((routeId, multiplier) => {
    progressManagerRef.current.setSpeedMultiplier(routeId, multiplier);
    console.log(`⚡ Set speed multiplier for ${routeId}: ${multiplier}x`);
  }, []);

  // Get animation status
  const getStatus = useCallback((routeId) => {
    return progressManagerRef.current.getAnimationStatus(routeId);
  }, []);

  // Get all active animations
  const getActiveAnimations = useCallback(() => {
    return progressManagerRef.current.getActiveAnimations();
  }, []);

  // Remove route
  const removeRoute = useCallback((routeId) => {
    // Stop any active animation
    if (activeAnimations.has(routeId)) {
      stopAnimation(routeId);
    }
    
    // Remove route data
    geometryManagerRef.current.removeRoute(routeId);
    
    console.log(`🗑️ Removed route ${routeId}`);
  }, [activeAnimations, stopAnimation]);

  // Clear all routes and animations
  const clearAll = useCallback(() => {
    // Stop all animations
    progressManagerRef.current.resetAllAnimations();
    
    // Clear markers
    markerRendererRef.current?.clearAllMarkers();
    
    // Clear routes
    geometryManagerRef.current.clearRoutes();
    
    // Clear state
    setActiveAnimations(new Map());
    setAnimationStats({});
    
    console.log('🧹 Cleared all route animations');
  }, []);

  // Highlight marker temporarily
  const highlightMarker = useCallback((routeId, duration = 2000) => {
    markerRendererRef.current?.highlightMarker(routeId, duration);
  }, []);

  // Calculate position at progress
  const getPositionAtProgress = useCallback((routeId, progress) => {
    const route = geometryManagerRef.current.getRoute(routeId);
    if (!route) return null;
    
    const distance = route.totalDistance * progress;
    return geometryManagerRef.current.getPositionAtDistance(routeId, distance);
  }, []);

  // Calculate heading at progress
  const getHeadingAtProgress = useCallback((routeId, progress) => {
    const route = geometryManagerRef.current.getRoute(routeId);
    if (!route) return 0;
    
    const distance = route.totalDistance * progress;
    return geometryManagerRef.current.getHeadingAtDistance(routeId, distance);
  }, []);

  // Manual position update (for GPS integration)
  const updateMarkerPosition = useCallback((routeId, progress) => {
    if (!markerRendererRef.current) return;
    
    const route = geometryManagerRef.current.getRoute(routeId);
    if (!route) return;
    
    const targetDistance = route.totalDistance * progress;
    const snappedPosition = geometryManagerRef.current.getPositionAtDistance(routeId, targetDistance);
    
    if (snappedPosition) {
      const marker = markerRendererRef.current.getMarker(routeId);
      if (marker) {
        marker.setLatLng(snappedPosition);
        
        // Update heading
        const heading = geometryManagerRef.current.getHeadingAtDistance(routeId, targetDistance);
        if (marker.setRotationAngle) {
          marker.setRotationAngle(heading);
        }
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markerRendererRef.current?.stopAnimationLoop();
      clearAll();
    };
  }, [clearAll]);

  return {
    // State
    isInitialized,
    activeAnimations: Array.from(activeAnimations.keys()),
    animationStats,
    
    // Core methods
    processRoute,
    startAnimation,
    stopAnimation,
    pauseAnimation,
    resumeAnimation,
    
    // Control methods
    setSpeed,
    getStatus,
    getActiveAnimations,
    removeRoute,
    clearAll,
    
    // Utility methods
    highlightMarker,
    getPositionAtProgress,
    getHeadingAtProgress,
    updateMarkerPosition,
    
    // Managers (for advanced usage)
    geometryManager: geometryManagerRef.current,
    progressManager: progressManagerRef.current,
    markerRenderer: markerRendererRef.current
  };
};

export default useRouteAnimation;
