/**
 * RouteAnimationManager.js
 * Production-grade manager for route-based marker animation with GPS snapping
 * Integrates RouteGeometryManager, RouteProgressManager, GPSSnapper, and RouteMarkerRenderer
 */

import RouteGeometryManager from './RouteGeometryManager.js';
import RouteProgressManager from './RouteProgressManager.js';
import GPSSnapper from './GPSSnapper.js';
import RouteMarkerRenderer from './RouteMarkerRenderer.js';

class RouteAnimationManager {
  constructor(mapInstance, options = {}) {
    this.map = mapInstance;

    // Initialize core components
    this.geometryManager = new RouteGeometryManager();
    this.progressManager = new RouteProgressManager();
    this.gpsSnapper = new GPSSnapper(this.geometryManager);
    this.markerRenderer = new RouteMarkerRenderer(
      mapInstance,
      this.geometryManager,
      this.progressManager
    );

    // Configuration
    this.config = {
      maxSnapDistance: options.maxSnapDistance || 100, // meters
      gpsAccuracyThreshold: options.gpsAccuracyThreshold || 20, // meters
      animationFrameRate: options.animationFrameRate || 30, // FPS
      enableGPSSnapping: options.enableGPSSnapping !== false,
      enableAutoProgress: options.enableAutoProgress !== false,
      progressUpdateInterval: options.progressUpdateInterval || 1000, // ms
      ...options
    };

    // State management
    this.activeRoutes = new Map(); // routeId -> route state
    this.gpsSubscriptions = new Map(); // routeId -> GPS subscription
    this.animationLoop = null;
    this.progressUpdateTimer = null;

    // Performance monitoring
    this.performanceStats = {
      lastUpdate: Date.now(),
      frameCount: 0,
      averageFrameTime: 0,
      snapOperations: 0,
      positionUpdates: 0
    };

    // Bind methods
    this.updateProgressFromGPS = this.updateProgressFromGPS.bind(this);
    this.animationLoopCallback = this.animationLoopCallback.bind(this);
    this.startProgressUpdates = this.startProgressUpdates.bind(this);
  }

  /**
   * Process and register a route for animation
   * @param {Object} osrmRoute - OSRM route response
   * @param {string} routeId - Unique route identifier
   * @param {Object} options - Route options
   * @returns {Object} Processed route data
   */
  registerRoute(osrmRoute, routeId, options = {}) {
    try {
      console.log(`🛣️ Registering route for animation: ${routeId}`);

      // Process route geometry
      const processedRoute = this.geometryManager.processOSRMRoute(osrmRoute, routeId);

      // Initialize route state
      const routeState = {
        id: routeId,
        route: processedRoute,
        options: {
          vehicleType: options.vehicleType || 'default',
          autoStart: options.autoStart || false,
          duration: options.duration || 30000,
          speed: options.speed || 'normal',
          enableGPSSnapping: options.enableGPSSnapping !== false,
          ...options
        },
        progress: 0,
        isAnimating: false,
        isGPSActive: false,
        lastGPSUpdate: null,
        lastPosition: null,
        performance: {
          snapsPerSecond: 0,
          updatesPerSecond: 0,
          lastSnapTime: Date.now()
        }
      };

      this.activeRoutes.set(routeId, routeState);

      // Auto-start animation if requested
      if (routeState.options.autoStart) {
        this.startAnimation(routeId, routeState.options);
      }

      console.log(`✅ Route registered successfully: ${routeId}`, {
        totalDistance: processedRoute.totalDistance.toFixed(2) + 'km',
        segments: processedRoute.segments.length,
        autoStart: routeState.options.autoStart
      });

      return routeState;
    } catch (error) {
      console.error(`❌ Failed to register route ${routeId}:`, error);
      throw error;
    }
  }

  /**
   * Start route animation with progress-based movement
   * @param {string} routeId - Route identifier
   * @param {Object} options - Animation options
   */
  startAnimation(routeId, options = {}) {
    const routeState = this.activeRoutes.get(routeId);
    if (!routeState) {
      throw new Error(`Route ${routeId} not found. Register route first.`);
    }

    try {
      console.log(`🎬 Starting route animation: ${routeId}`);

      // Start progress animation
      this.progressManager.startRouteAnimationWithCallback(
        routeId,
        options.duration || routeState.options.duration,
        options.speed || routeState.options.speed,
        (id, status) => {
          console.log(`🏁 Animation completed for route ${id}`);
          this.stopAnimation(id);
        }
      );

      routeState.isAnimating = true;
      routeState.progress = 0;

      // Start animation loop if not running
      this.startAnimationLoop();

      // Start progress updates
      this.startProgressUpdates();

      console.log(`✅ Animation started for route ${routeId}`);
    } catch (error) {
      console.error(`❌ Failed to start animation for route ${routeId}:`, error);
      throw error;
    }
  }

  /**
   * Update marker position based on current route progress
   * @param {string} routeId - Route identifier
   * @param {number} progress - Progress (0-1)
   */
  updateMarkerAtProgress(routeId, progress) {
    const routeState = this.activeRoutes.get(routeId);
    if (!routeState) return;

    try {
      // Clamp progress to valid range
      const clampedProgress = Math.max(0, Math.min(1, progress));
      routeState.progress = clampedProgress;

      // Calculate target distance along route
      const targetDistance = routeState.route.totalDistance * clampedProgress;

      // Get position at distance
      const position = this.geometryManager.getPositionAtDistance(routeId, targetDistance);
      if (!position) {
        console.warn(`⚠️ Could not calculate position for route ${routeId} at progress ${clampedProgress}`);
        return;
      }

      // Get heading for marker rotation
      const heading = this.geometryManager.getHeadingAtDistance(routeId, targetDistance);

      // Update marker position and rotation
      const marker = this.markerRenderer.getMarker(routeId);
      if (marker) {
        marker.setLatLng(position);

        // Update marker rotation if supported
        if (marker.setRotationAngle) {
          marker.setRotationAngle(heading);
        }

        // Update tooltip with progress info
        this.markerRenderer.updateMarkerTooltip(marker, routeId, clampedProgress, targetDistance);

        routeState.lastPosition = position;
        this.performanceStats.positionUpdates++;
      }
    } catch (error) {
      console.error(`❌ Error updating marker position for route ${routeId}:`, error);
    }
  }

  /**
   * Update route progress from GPS coordinates with snapping
   * @param {string} routeId - Route identifier
   * @param {number} lat - GPS latitude
   * @param {number} lng - GPS longitude
   * @param {Object} gpsData - Additional GPS data (accuracy, timestamp, etc.)
   */
  updateProgressFromGPS(routeId, lat, lng, gpsData = {}) {
    const routeState = this.activeRoutes.get(routeId);
    if (!routeState || !routeState.options.enableGPSSnapping) return;

    try {
      const startTime = Date.now();

      // Snap GPS coordinate to route
      const snapResult = this.gpsSnapper.snapToRoute(lat, lng, routeId, {
        maxSnapDistance: this.config.maxSnapDistance,
        gpsAccuracyThreshold: this.config.gpsAccuracyThreshold
      });

      // Decide whether to use snapped position
      const decision = this.gpsSnapper.shouldUseSnappedPosition(
        { accuracy: gpsData.accuracy },
        snapResult
      );

      if (decision.useSnapped && snapResult.isSnapped) {
        // Update progress based on snapped position
        const newProgress = snapResult.progressAlongRoute;
        this.updateMarkerAtProgress(routeId, newProgress);

        routeState.lastGPSUpdate = Date.now();

        // Update performance stats
        const snapTime = Date.now() - startTime;
        routeState.performance.snapsPerSecond = 1000 / snapTime;
        this.performanceStats.snapOperations++;

        console.log(`📍 GPS snapped for route ${routeId}:`, {
          original: [lat, lng],
          snapped: snapResult.snappedPosition,
          progress: newProgress.toFixed(3),
          distance: snapResult.distance.toFixed(1) + 'm',
          reason: decision.reason
        });
      } else {
        console.log(`📍 GPS not snapped for route ${routeId}: ${decision.reason}`);
      }
    } catch (error) {
      console.error(`❌ Error processing GPS update for route ${routeId}:`, error);
    }
  }

  /**
   * Subscribe to real-time GPS updates for a route
   * @param {string} routeId - Route identifier
   * @param {Function} gpsCallback - GPS data callback (lat, lng, data) => void
   */
  subscribeToGPS(routeId, gpsCallback) {
    const routeState = this.activeRoutes.get(routeId);
    if (!routeState) return null;

    // Wrap GPS callback to include route snapping
    const wrappedCallback = (lat, lng, gpsData) => {
      // First call user's callback
      gpsCallback(lat, lng, gpsData);

      // Then update our route progress
      this.updateProgressFromGPS(routeId, lat, lng, gpsData);
    };

    routeState.isGPSActive = true;
    this.gpsSubscriptions.set(routeId, wrappedCallback);

    console.log(`📡 GPS subscription active for route ${routeId}`);
    return wrappedCallback;
  }

  /**
   * Unsubscribe from GPS updates
   * @param {string} routeId - Route identifier
   */
  unsubscribeFromGPS(routeId) {
    const routeState = this.activeRoutes.get(routeId);
    if (routeState) {
      routeState.isGPSActive = false;
    }
    this.gpsSubscriptions.delete(routeId);
    console.log(`📡 GPS subscription removed for route ${routeId}`);
  }

  /**
   * Start the animation loop
   */
  startAnimationLoop() {
    if (this.animationLoop) return; // Already running

    console.log('🎭 Starting animation loop');

    const frameInterval = 1000 / this.config.animationFrameRate;
    let lastFrameTime = Date.now();

    const loop = () => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastFrameTime;

      if (deltaTime >= frameInterval) {
        this.animationLoopCallback(deltaTime);
        lastFrameTime = currentTime;
        this.performanceStats.frameCount++;
      }

      this.animationLoop = requestAnimationFrame(loop);
    };

    this.animationLoop = requestAnimationFrame(loop);
  }

  /**
   * Animation loop callback
   * @param {number} deltaTime - Time since last frame in milliseconds
   */
  animationLoopCallback(deltaTime) {
    try {
      // Update performance stats
      this.performanceStats.averageFrameTime =
        (this.performanceStats.averageFrameTime + deltaTime) / 2;

      // Update all active animations
      for (const [routeId, routeState] of this.activeRoutes) {
        if (routeState.isAnimating) {
          // Get current progress from progress manager
          const status = this.progressManager.getAnimationStatus(routeId);
          if (status) {
            this.updateMarkerAtProgress(routeId, status.progress);
          }
        }
      }
    } catch (error) {
      console.error('❌ Animation loop error:', error);
    }
  }

  /**
   * Start progress update timer
   */
  startProgressUpdates() {
    if (this.progressUpdateTimer) return; // Already running

    console.log('⏰ Starting progress update timer');

    this.progressUpdateTimer = setInterval(() => {
      // Force progress updates for routes with GPS data
      for (const [routeId, routeState] of this.activeRoutes) {
        if (routeState.isGPSActive && routeState.lastGPSUpdate) {
          const timeSinceLastGPS = Date.now() - routeState.lastGPSUpdate;
          // If no GPS update for 5 seconds, stop GPS mode
          if (timeSinceLastGPS > 5000) {
            console.log(`⚠️ GPS timeout for route ${routeId}, falling back to animation`);
            routeState.isGPSActive = false;
          }
        }
      }
    }, this.config.progressUpdateInterval);
  }

  /**
   * Stop animation for a route
   * @param {string} routeId - Route identifier
   */
  stopAnimation(routeId) {
    const routeState = this.activeRoutes.get(routeId);
    if (!routeState) return;

    console.log(`⏹️ Stopping animation for route ${routeId}`);

    this.progressManager.stopAnimation(routeId);
    this.markerRenderer.removeMarker(routeId);
    this.unsubscribeFromGPS(routeId);

    routeState.isAnimating = false;
    routeState.isGPSActive = false;
  }

  /**
   * Pause animation
   * @param {string} routeId - Route identifier
   */
  pauseAnimation(routeId) {
    this.progressManager.pauseAnimation(routeId);
    console.log(`⏸️ Paused animation for route ${routeId}`);
  }

  /**
   * Resume animation
   * @param {string} routeId - Route identifier
   */
  resumeAnimation(routeId) {
    this.progressManager.resumeAnimation(routeId);
    console.log(`▶️ Resumed animation for route ${routeId}`);
  }

  /**
   * Set animation speed multiplier
   * @param {string} routeId - Route identifier
   * @param {number} multiplier - Speed multiplier
   */
  setSpeed(routeId, multiplier) {
    this.progressManager.setSpeedMultiplier(routeId, multiplier);
    console.log(`⚡ Set speed multiplier for route ${routeId}: ${multiplier}x`);
  }

  /**
   * Get route animation status
   * @param {string} routeId - Route identifier
   * @returns {Object} Animation status
   */
  getAnimationStatus(routeId) {
    const routeState = this.activeRoutes.get(routeId);
    if (!routeState) return null;

    const progressStatus = this.progressManager.getAnimationStatus(routeId);

    return {
      ...routeState,
      ...progressStatus,
      isGPSActive: routeState.isGPSActive,
      lastGPSUpdate: routeState.lastGPSUpdate,
      performance: routeState.performance
    };
  }

  /**
   * Remove route and clean up resources
   * @param {string} routeId - Route identifier
   */
  removeRoute(routeId) {
    this.stopAnimation(routeId);
    this.geometryManager.removeRoute(routeId);
    this.activeRoutes.delete(routeId);
    console.log(`🗑️ Removed route ${routeId}`);
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getPerformanceStats() {
    const now = Date.now();
    const timeElapsed = now - this.performanceStats.lastUpdate;

    return {
      ...this.performanceStats,
      fps: this.performanceStats.frameCount / (timeElapsed / 1000),
      averageFrameTime: this.performanceStats.averageFrameTime,
      activeRoutes: this.activeRoutes.size,
      gpsSubscriptions: this.gpsSubscriptions.size,
      cacheStats: this.gpsSnapper.getCacheStats()
    };
  }

  /**
   * Clear all routes and animations
   */
  clearAll() {
    console.log('🧹 Clearing all route animations');

    // Stop all animations
    for (const routeId of this.activeRoutes.keys()) {
      this.stopAnimation(routeId);
    }

    // Clear managers
    this.progressManager.resetAllAnimations();
    this.markerRenderer.clearAllMarkers();
    this.geometryManager.clearRoutes();
    this.gpsSnapper.clearCache();

    // Clear state
    this.activeRoutes.clear();
    this.gpsSubscriptions.clear();

    // Stop timers
    if (this.animationLoop) {
      cancelAnimationFrame(this.animationLoop);
      this.animationLoop = null;
    }

    if (this.progressUpdateTimer) {
      clearInterval(this.progressUpdateTimer);
      this.progressUpdateTimer = null;
    }
  }

  /**
   * Emergency stop - immediately halt all animations
   */
  emergencyStop() {
    console.log('🚨 Emergency stop triggered');

    // Cancel animation loop
    if (this.animationLoop) {
      cancelAnimationFrame(this.animationLoop);
      this.animationLoop = null;
    }

    // Clear all timers
    if (this.progressUpdateTimer) {
      clearInterval(this.progressUpdateTimer);
      this.progressUpdateTimer = null;
    }

    // Stop all progress animations
    this.progressManager.resetAllAnimations();

    // Mark all routes as stopped
    for (const routeState of this.activeRoutes.values()) {
      routeState.isAnimating = false;
      routeState.isGPSActive = false;
    }
  }

  /**
   * Cleanup on destruction
   */
  destroy() {
    console.log('💥 Destroying RouteAnimationManager');
    this.clearAll();
  }
}

export default RouteAnimationManager;
