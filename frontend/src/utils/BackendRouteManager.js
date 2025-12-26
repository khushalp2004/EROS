/**
 * BackendRouteManager.js
 * Simplified manager for backend-driven route animation
 * Uses database polylines_position and backend-calculated progress
 */

import api from '../api';

class BackendRouteManager {
  constructor() {
    this.activeRoutes = new Map(); // unitId -> route data
    this.routeUpdateInterval = null;
    this.subscribers = new Map(); // unitId -> callback functions
  }

  /**
   * Fetch all active routes from backend
   * @returns {Promise<Object>} Active routes data
   */
  async fetchActiveRoutes() {
    try {
      console.log('🗄️ Fetching active routes from backend...');
      const response = await api.get('/api/active-unit-routes');
      const { active_routes } = response.data;
      
      console.log(`📊 Backend response: ${active_routes.length} active routes`);
      
      // Update active routes cache
      active_routes.forEach(routeData => {
        this.activeRoutes.set(routeData.unit_id, routeData);
      });
      
      // Notify subscribers
      this.notifySubscribers();
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch active routes:', error);
      throw error;
    }
  }

  /**
   * Get route data for specific unit
   * @param {string|number} unitId - Unit identifier
   * @returns {Object|null} Route data or null
   */
  getRouteData(unitId) {
    return this.activeRoutes.get(unitId) || null;
  }

  /**
   * Get current progress for unit
   * @param {string|number} unitId - Unit identifier
   * @returns {number} Progress (0.0 to 1.0)
   */
  getProgress(unitId) {
    const routeData = this.getRouteData(unitId);
    return routeData?.route?.progress || 0;
  }

  /**
   * Get current position for unit (from backend calculation)
   * @param {string|number} unitId - Unit identifier
   * @returns {Array|null} [lat, lng] position or null
   */
  getCurrentPosition(unitId) {
    const routeData = this.getRouteData(unitId);
    return routeData?.route?.current_position || null;
  }

  /**
   * Get full route positions for polyline rendering
   * @param {string|number} unitId - Unit identifier
   * @returns {Array|null} Array of [lat, lng] positions
   */
  getRoutePositions(unitId) {
    const routeData = this.getRouteData(unitId);
    return routeData?.route?.positions || null;
  }

  /**
   * Subscribe to route updates for a unit
   * @param {string|number} unitId - Unit identifier
   * @param {Function} callback - Callback function (routeData) => void
   * @returns {Function} Unsubscribe function
   */
  subscribeToRoute(unitId, callback) {
    if (!this.subscribers.has(unitId)) {
      this.subscribers.set(unitId, new Set());
    }
    
    this.subscribers.get(unitId).add(callback);
    
    // Return unsubscribe function
    return () => {
      const unitSubscribers = this.subscribers.get(unitId);
      if (unitSubscribers) {
        unitSubscribers.delete(callback);
        if (unitSubscribers.size === 0) {
          this.subscribers.delete(unitId);
        }
      }
    };
  }

  /**
   * Notify all subscribers of route updates
   */
  notifySubscribers() {
    this.subscribers.forEach((callbacks, unitId) => {
      const routeData = this.getRouteData(unitId);
      callbacks.forEach(callback => {
        try {
          callback(routeData);
        } catch (error) {
          console.error(`❌ Error in route subscriber callback for unit ${unitId}:`, error);
        }
      });
    });
  }

  /**
   * Start automatic route updates
   * @param {number} intervalMs - Update interval in milliseconds (default: 2000)
   */
  startAutoUpdates(intervalMs = 2000) {
    if (this.routeUpdateInterval) {
      console.log('⚠️ Auto updates already running');
      return;
    }

    console.log(`🔄 Starting automatic route updates (${intervalMs}ms interval)`);

    const updateLoop = async () => {
      try {
        await this.fetchActiveRoutes();
      } catch (error) {
        console.error('❌ Error in auto update loop:', error);
      }
    };

    this.routeUpdateInterval = setInterval(updateLoop, intervalMs);
    
    // Initial fetch
    updateLoop();
  }

  /**
   * Stop automatic route updates
   */
  stopAutoUpdates() {
    if (this.routeUpdateInterval) {
      clearInterval(this.routeUpdateInterval);
      this.routeUpdateInterval = null;
      console.log('⏹️ Stopped automatic route updates');
    }
  }

  /**
   * Get all active routes
   * @returns {Array} Array of route data objects
   */
  getAllActiveRoutes() {
    return Array.from(this.activeRoutes.values());
  }

  /**
   * Get route statistics
   * @returns {Object} Route statistics
   */
  getRouteStats() {
    const routes = this.getAllActiveRoutes();
    const activeRoutes = routes.filter(r => r.route?.progress < 1.0);
    const completedRoutes = routes.filter(r => r.route?.progress >= 1.0);

    return {
      total: routes.length,
      active: activeRoutes.length,
      completed: completedRoutes.length,
      averageProgress: routes.length > 0 
        ? routes.reduce((sum, r) => sum + (r.route?.progress || 0), 0) / routes.length
        : 0
    };
  }

  /**
   * Check if a unit has an active route
   * @param {string|number} unitId - Unit identifier
   * @returns {boolean} True if unit has active route
   */
  hasActiveRoute(unitId) {
    const routeData = this.getRouteData(unitId);
    return routeData && routeData.route?.progress < 1.0;
  }

  /**
   * Get estimated time of arrival for unit
   * @param {string|number} unitId - Unit identifier
   * @returns {number|null} ETA in minutes or null
   */
  getETA(unitId) {
    const routeData = this.getRouteData(unitId);
    if (!routeData || !routeData.route) return null;

    const { progress, estimated_duration } = routeData.route;
    if (progress >= 1.0) return 0;

    const remainingDuration = estimated_duration * (1 - progress);
    return Math.ceil(remainingDuration / 60); // Convert to minutes
  }

  /**
   * Clear all route data
   */
  clearAllRoutes() {
    this.activeRoutes.clear();
    this.subscribers.clear();
    console.log('🧹 Cleared all route data');
  }

  /**
   * Remove specific route
   * @param {string|number} unitId - Unit identifier
   */
  removeRoute(unitId) {
    this.activeRoutes.delete(unitId);
    this.subscribers.delete(unitId);
    console.log(`🗑️ Removed route for unit ${unitId}`);
  }

  /**
   * Get enhanced route information for UI
   * @param {string|number} unitId - Unit identifier
   * @returns {Object|null} Enhanced route info
   */
  getEnhancedRouteInfo(unitId) {
    const routeData = this.getRouteData(unitId);
    if (!routeData) return null;

    return {
      unitId: routeData.unit_id,
      emergencyId: routeData.emergency_id,
      progress: routeData.route?.progress || 0,
      currentPosition: routeData.route?.current_position,
      totalDistance: routeData.route?.total_distance,
      estimatedDuration: routeData.route?.estimated_duration,
      elapsedSeconds: routeData.route?.elapsed_seconds,
      waypointCount: routeData.route?.waypoint_count,
      serviceType: routeData.unit?.service_type,
      unitStatus: routeData.unit?.status,
      emergency: routeData.emergency,
      isActive: this.hasActiveRoute(unitId),
      eta: this.getETA(unitId)
    };
  }
}

// Export singleton instance
const backendRouteManager = new BackendRouteManager();
export default backendRouteManager;
