/**
 * QuickGPSFix.js
 * Minimal implementation to fix straight-line marker movement
 * Drop-in replacement for your existing marker position updates
 */

import GPSSnapper from '../utils/GPSSnapper';
import RouteGeometryManager from '../utils/RouteGeometryManager';

class QuickGPSFix {
  constructor() {
    this.geometryManager = new RouteGeometryManager();
    this.gpsSnapper = new GPSSnapper(this.geometryManager);
    this.routeCache = new Map(); // Cache processed routes
  }

  /**
   * CRITICAL: Replace your existing marker position updates with this
   * @param {string} unitId - Unit identifier  
   * @param {number} gpsLat - Raw GPS latitude
   * @param {number} gpsLng - Raw GPS longitude
   * @param {Object} routeData - OSRM route data for this unit
   * @returns {Object} Snapped position and metadata
   */
  updateMarkerPosition(unitId, gpsLat, gpsLng, routeData) {
    // Step 1: Process route if not already done
    let routeId = this.getRouteIdForUnit(unitId);
    if (!routeId && routeData) {
      routeId = `route-${unitId}`;
      const processedRoute = this.geometryManager.processOSRMRoute(routeData, routeId);
      this.routeCache.set(routeId, processedRoute);
      console.log(`🛣️ Route processed for unit ${unitId}`);
    }

    // Step 2: Snap GPS to route
    const snapResult = this.gpsSnapper.snapToRoute(gpsLat, gpsLng, routeId, {
      maxSnapDistance: 100, // Snap if within 100m of route
      gpsAccuracyThreshold: 20, // Snap if GPS accuracy > 20m
      offRouteThreshold: 50 // Consider off-route if > 50m away
    });

    // Step 3: Log the decision for debugging
    console.log(`📍 GPS Snap for Unit ${unitId}:`, {
      original: [gpsLat, gpsLng],
      snapped: snapResult.snappedPosition,
      isSnapped: snapResult.isSnapped,
      distance: `${snapResult.distance.toFixed(1)}m`,
      reason: snapResult.reason
    });

    return {
      // Use snapped position instead of raw GPS
      latitude: snapResult.snappedPosition[0],
      longitude: snapResult.snappedPosition[1],
      
      // Metadata for debugging/UI
      isSnapped: snapResult.isSnapped,
      snapDistance: snapResult.distance,
      snapReason: snapResult.reason,
      originalGPS: [gpsLat, gpsLng]
    };
  }

  /**
   * Find route ID for unit (customize this for your system)
   */
  getRouteIdForUnit(unitId) {
    // Look for existing processed route
    for (const [routeId, routeData] of this.routeCache.entries()) {
      if (routeData.unitId === unitId || routeId.includes(unitId)) {
        return routeId;
      }
    }
    return null;
  }

  /**
   * Simple route-following animation using progress (0-1)
   */
  animateAlongRoute(routeId, progress, marker) {
    const route = this.routeCache.get(routeId);
    if (!route) return;

    // Calculate position at progress point
    const targetDistance = route.totalDistance * progress;
    const position = this.geometryManager.getPositionAtDistance(routeId, targetDistance);
    
    if (position) {
      marker.setLatLng(position);
      
      // Optional: Update marker rotation based on heading
      const heading = this.geometryManager.getHeadingAtDistance(routeId, targetDistance);
      if (marker.setRotationAngle) {
        marker.setRotationAngle(heading);
      }
    }
  }
}

// Export singleton instance
const quickGPSFix = new QuickGPSFix();
export default quickGPSFix;

/**
 * USAGE EXAMPLES:
 * 
 * 1. In your WebSocket handler (UnitsTracking.js):
 * 
 * import quickGPSFix from '../utils/QuickGPSFix';
 * 
 * socket.on('unit_location_update', (data) => {
 *   const snappedPosition = quickGPSFix.updateMarkerPosition(
 *     data.unit_id,
 *     data.latitude, 
 *     data.longitude,
 *     routeData // Your OSRM route data for this unit
 *   );
 *   
 *   // Use snapped position instead of raw GPS
 *   setUnitLocations(prev => ({
 *     ...prev,
 *     [data.unit_id]: {
 *       ...snappedPosition,
 *       timestamp: data.timestamp,
 *       status: data.status
 *     }
 *   }));
 * });
 * 
 * 2. For manual route animation:
 * 
 * const animateUnit = (unitId, duration = 30000) => {
 *   const startTime = Date.now();
 *   const routeId = quickGPSFix.getRouteIdForUnit(unitId);
 *   
 *   const animate = () => {
 *     const progress = Math.min((Date.now() - startTime) / duration, 1);
 *     const marker = getMarkerForUnit(unitId);
 *     
 *     quickGPSFix.animateAlongRoute(routeId, progress, marker);
 *     
 *     if (progress < 1) {
 *       requestAnimationFrame(animate);
 *     }
 *   };
 *   
 *   animate();
 * };
 */
