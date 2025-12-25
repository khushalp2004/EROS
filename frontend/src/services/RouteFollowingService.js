/**
 * RouteFollowingService.js
 * Production-grade service for emergency vehicle route following with GPS integration
 * Provides high-level API for real-time vehicle tracking and route snapping
 */

import RouteAnimationManager from '../utils/RouteAnimationManager.js';

class RouteFollowingService {
  constructor(mapInstance, options = {}) {
    this.map = mapInstance;
    this.animationManager = new RouteAnimationManager(mapInstance, {
      maxSnapDistance: options.maxSnapDistance || 100,
      gpsAccuracyThreshold: options.gpsAccuracyThreshold || 20,
      enableGPSSnapping: options.enableGPSSnapping !== false,
      ...options
    });

    this.activeRoutes = new Map(); // routeId -> route metadata
    this.vehicleSubscriptions = new Map(); // vehicleId -> GPS subscription cleanup
    this.routeCache = new Map(); // routeId -> OSRM route data

    // Emergency response configuration
    this.config = {
      emergencyPriority: options.emergencyPriority || 'HIGH',
      autoStartRoutes: options.autoStartRoutes !== false,
      gpsTimeoutMs: options.gpsTimeoutMs || 30000, // 30 seconds
      routeUpdateInterval: options.routeUpdateInterval || 5000, // 5 seconds
      maxRouteAge: options.maxRouteAge || 3600000, // 1 hour
      ...options
    };

    // Performance monitoring
    this.performanceStats = {
      totalRoutes: 0,
      activeRoutes: 0,
      gpsUpdatesProcessed: 0,
      routeSnapsPerformed: 0,
      averageSnapTime: 0,
      lastUpdate: Date.now()
    };

    console.log('🚨 RouteFollowingService initialized for emergency response');
  }

  /**
   * Register an emergency response route
   * @param {string} emergencyId - Emergency request ID
   * @param {string} vehicleId - Responding vehicle ID
   * @param {Object} osrmRoute - OSRM route data
   * @param {Object} metadata - Additional route metadata
   * @returns {Object} Route registration result
   */
  async registerEmergencyRoute(emergencyId, vehicleId, osrmRoute, metadata = {}) {
    const routeId = `emergency-${emergencyId}-vehicle-${vehicleId}`;

    try {
      console.log(`🚨 Registering emergency route: ${routeId}`);

      // Cache the route data
      this.routeCache.set(routeId, {
        osrmRoute,
        metadata,
        registeredAt: Date.now(),
        lastUsed: Date.now()
      });

      // Register with animation manager
      const routeState = this.animationManager.registerRoute(osrmRoute, routeId, {
        vehicleType: metadata.vehicleType || 'AMBULANCE',
        autoStart: this.config.autoStartRoutes,
        duration: metadata.estimatedDuration || 300000, // 5 minutes default
        emergencyId,
        vehicleId
      });

      // Store route metadata
      this.activeRoutes.set(routeId, {
        ...routeState,
        emergencyId,
        vehicleId,
        metadata,
        status: 'REGISTERED',
        lastGPSUpdate: null,
        gpsActive: false,
        priority: metadata.priority || 'NORMAL'
      });

      this.performanceStats.totalRoutes++;
      this.performanceStats.activeRoutes = this.activeRoutes.size;

      console.log(`✅ Emergency route registered: ${routeId}`, {
        distance: routeState.route.totalDistance.toFixed(2) + 'km',
        segments: routeState.route.segments.length,
        priority: metadata.priority || 'NORMAL'
      });

      return {
        success: true,
        routeId,
        routeState,
        estimatedDuration: metadata.estimatedDuration
      };

    } catch (error) {
      console.error(`❌ Failed to register emergency route ${routeId}:`, error);
      return {
        success: false,
        routeId,
        error: error.message
      };
    }
  }

  /**
   * Start emergency response for a registered route
   * @param {string} routeId - Route identifier
   * @param {Object} options - Start options
   */
  startEmergencyResponse(routeId, options = {}) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) {
      throw new Error(`Emergency route ${routeId} not found`);
    }

    try {
      console.log(`🚨 Starting emergency response for route: ${routeId}`);

      // Start route animation
      this.animationManager.startAnimation(routeId, {
        duration: options.duration || routeData.options.duration,
        speed: options.speed || 'normal'
      });

      // Update route status
      routeData.status = 'ACTIVE';
      routeData.startedAt = Date.now();

      console.log(`✅ Emergency response started: ${routeId}`);
    } catch (error) {
      console.error(`❌ Failed to start emergency response for ${routeId}:`, error);
      routeData.status = 'ERROR';
      routeData.error = error.message;
      throw error;
    }
  }

  /**
   * Subscribe vehicle to GPS updates for route following
   * @param {string} routeId - Route identifier
   * @param {Function} gpsCallback - GPS data callback (lat, lng, accuracy, timestamp) => void
   * @returns {Function} Unsubscribe function
   */
  subscribeVehicleGPS(routeId, gpsCallback) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) {
      throw new Error(`Route ${routeId} not found`);
    }

    // Enhanced GPS callback with route snapping
    const enhancedGPSCallback = (lat, lng, accuracy, timestamp) => {
      try {
        // Call user's callback first
        gpsCallback(lat, lng, accuracy, timestamp);

        // Update route progress with GPS snapping
        this.animationManager.updateProgressFromGPS(routeId, lat, lng, {
          accuracy,
          timestamp
        });

        // Update route metadata
        routeData.lastGPSUpdate = Date.now();
        routeData.gpsActive = true;
        this.performanceStats.gpsUpdatesProcessed++;

      } catch (error) {
        console.error(`❌ GPS processing error for route ${routeId}:`, error);
      }
    };

    // Subscribe to GPS updates
    const unsubscribe = this.animationManager.subscribeToGPS(routeId, enhancedGPSCallback);

    // Store subscription for cleanup
    this.vehicleSubscriptions.set(routeId, unsubscribe);

    routeData.gpsActive = true;
    console.log(`📡 GPS subscription active for emergency route: ${routeId}`);

    return unsubscribe;
  }

  /**
   * Update vehicle position manually (for testing or fallback)
   * @param {string} routeId - Route identifier
   * @param {number} progress - Progress along route (0-1)
   */
  updateVehicleProgress(routeId, progress) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) return;

    try {
      this.animationManager.updateMarkerAtProgress(routeId, Math.max(0, Math.min(1, progress)));
      routeData.lastManualUpdate = Date.now();

      console.log(`📍 Manual progress update for ${routeId}: ${(progress * 100).toFixed(1)}%`);
    } catch (error) {
      console.error(`❌ Manual progress update failed for ${routeId}:`, error);
    }
  }

  /**
   * Handle vehicle arrival at emergency location
   * @param {string} routeId - Route identifier
   */
  vehicleArrived(routeId) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) return;

    try {
      console.log(`🏥 Vehicle arrived for emergency route: ${routeId}`);

      // Stop animation and GPS updates
      this.animationManager.stopAnimation(routeId);

      // Update route status
      routeData.status = 'ARRIVED';
      routeData.arrivedAt = Date.now();
      routeData.gpsActive = false;

      // Clean up GPS subscription
      const unsubscribe = this.vehicleSubscriptions.get(routeId);
      if (unsubscribe) {
        unsubscribe();
        this.vehicleSubscriptions.delete(routeId);
      }

    } catch (error) {
      console.error(`❌ Arrival handling failed for ${routeId}:`, error);
    }
  }

  /**
   * Get emergency route status
   * @param {string} routeId - Route identifier
   * @returns {Object} Route status
   */
  getEmergencyStatus(routeId) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) return null;

    const animationStatus = this.animationManager.getAnimationStatus(routeId);

    return {
      routeId,
      emergencyId: routeData.emergencyId,
      vehicleId: routeData.vehicleId,
      status: routeData.status,
      progress: animationStatus?.progress || 0,
      isGPSActive: routeData.gpsActive,
      lastGPSUpdate: routeData.lastGPSUpdate,
      startedAt: routeData.startedAt,
      arrivedAt: routeData.arrivedAt,
      priority: routeData.priority,
      vehicleType: routeData.options.vehicleType,
      estimatedDuration: routeData.options.duration,
      actualDuration: routeData.arrivedAt ? routeData.arrivedAt - routeData.startedAt : null,
      metadata: routeData.metadata
    };
  }

  /**
   * Get all active emergency routes
   * @returns {Array} Array of route statuses
   */
  getActiveEmergencies() {
    return Array.from(this.activeRoutes.keys())
      .map(routeId => this.getEmergencyStatus(routeId))
      .filter(status => status && status.status === 'ACTIVE');
  }

  /**
   * Pause emergency response (e.g., for traffic conditions)
   * @param {string} routeId - Route identifier
   */
  pauseEmergencyResponse(routeId) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) return;

    this.animationManager.pauseAnimation(routeId);
    routeData.status = 'PAUSED';
    console.log(`⏸️ Emergency response paused: ${routeId}`);
  }

  /**
   * Resume emergency response
   * @param {string} routeId - Route identifier
   */
  resumeEmergencyResponse(routeId) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) return;

    this.animationManager.resumeAnimation(routeId);
    routeData.status = 'ACTIVE';
    console.log(`▶️ Emergency response resumed: ${routeId}`);
  }

  /**
   * Emergency stop - immediately halt all responses
   * @param {string} reason - Reason for emergency stop
   */
  emergencyStopAll(reason = 'EMERGENCY_STOP') {
    console.log(`🚨 Emergency stop initiated: ${reason}`);

    // Stop all animations
    for (const routeId of this.activeRoutes.keys()) {
      this.vehicleArrived(routeId);
    }

    // Clear all subscriptions
    for (const unsubscribe of this.vehicleSubscriptions.values()) {
      unsubscribe();
    }
    this.vehicleSubscriptions.clear();

    console.log(`✅ All emergency responses stopped`);
  }

  /**
   * Reroute emergency vehicle (e.g., due to traffic or new conditions)
   * @param {string} routeId - Current route identifier
   * @param {Object} newOSRMRoute - New OSRM route data
   * @param {Object} options - Reroute options
   */
  async rerouteEmergency(routeId, newOSRMRoute, options = {}) {
    const routeData = this.activeRoutes.get(routeId);
    if (!routeData) {
      throw new Error(`Route ${routeId} not found`);
    }

    try {
      console.log(`🔄 Rerouting emergency: ${routeId}`);

      // Stop current animation
      this.animationManager.stopAnimation(routeId);

      // Update route cache
      this.routeCache.set(routeId, {
        ...this.routeCache.get(routeId),
        osrmRoute: newOSRMRoute,
        lastUsed: Date.now()
      });

      // Re-register route with new geometry
      const newRouteState = this.animationManager.registerRoute(newOSRMRoute, routeId, {
        ...routeData.options,
        ...options
      });

      // Resume animation from current progress
      this.animationManager.startAnimation(routeId, {
        duration: options.newDuration || routeData.options.duration
      });

      console.log(`✅ Emergency rerouted successfully: ${routeId}`);
    } catch (error) {
      console.error(`❌ Rerouting failed for ${routeId}:`, error);
      throw error;
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getPerformanceStats() {
    const animationStats = this.animationManager.getPerformanceStats();
    const now = Date.now();
    const timeElapsed = now - this.performanceStats.lastUpdate;

    return {
      ...this.performanceStats,
      ...animationStats,
      timeElapsed,
      routesPerSecond: this.performanceStats.totalRoutes / (timeElapsed / 1000),
      gpsUpdatesPerSecond: this.performanceStats.gpsUpdatesProcessed / (timeElapsed / 1000),
      activeEmergencies: this.getActiveEmergencies().length
    };
  }

  /**
   * Clean up old routes and resources
   */
  cleanup() {
    const now = Date.now();
    const maxAge = this.config.maxRouteAge;

    // Remove old cached routes
    for (const [routeId, routeData] of this.routeCache) {
      if (now - routeData.lastUsed > maxAge) {
        this.routeCache.delete(routeId);
        console.log(`🗑️ Cleaned up old route cache: ${routeId}`);
      }
    }

    // Remove completed/inactive routes
    for (const [routeId, routeData] of this.activeRoutes) {
      if (routeData.status === 'ARRIVED' || routeData.status === 'COMPLETED') {
        const timeSinceCompletion = now - (routeData.arrivedAt || routeData.startedAt);
        if (timeSinceCompletion > 3600000) { // 1 hour
          this.activeRoutes.delete(routeId);
          this.animationManager.removeRoute(routeId);
          console.log(`🗑️ Cleaned up completed route: ${routeId}`);
        }
      }
    }
  }

  /**
   * Destroy service and clean up all resources
   */
  destroy() {
    console.log('💥 Destroying RouteFollowingService');

    // Emergency stop all responses
    this.emergencyStopAll('SERVICE_SHUTDOWN');

    // Clean up animation manager
    this.animationManager.destroy();

    // Clear all state
    this.activeRoutes.clear();
    this.vehicleSubscriptions.clear();
    this.routeCache.clear();
  }
}

export default RouteFollowingService;
