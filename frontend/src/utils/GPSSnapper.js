/**
 * GPSSnapper.js
 * Production-grade GPS snapping utility for emergency vehicle route following
 * Snaps raw GPS coordinates to the nearest point on planned routes
 */

class GPSSnapper {
  constructor(routeGeometryManager) {
    this.geometryManager = routeGeometryManager;
    this.snapCache = new Map(); // Cache for frequently snapped points
    this.config = {
      maxSnapDistance: 50, // Maximum distance to snap (meters)
      gpsAccuracyThreshold: 15, // GPS accuracy threshold for snapping (meters)
      cacheSize: 1000, // Number of cached snap results
      offRouteThreshold: 100 // Distance threshold to consider off-route (meters)
    };
  }

  /**
   * Snap GPS coordinate to nearest point on route
   * @param {number} lat - GPS latitude
   * @param {number} lng - GPS longitude  
   * @param {string} routeId - Route identifier
   * @param {Object} options - Snap options
   * @returns {Object} Snapped position and metadata
   */
  snapToRoute(lat, lng, routeId, options = {}) {
    const config = { ...this.config, ...options };
    const route = this.geometryManager.getRoute(routeId);
    
    if (!route) {
      console.warn(`⚠️ No route found for ${routeId}. Available routes:`, Array.from(this.geometryManager.pathCache.keys()));
      return {
        snappedPosition: [lat, lng],
        isSnapped: false,
        reason: 'no_route',
        distance: 0,
        accuracy: 'unknown'
      };
    }

    console.log(`🎯 GPS Snap attempt for ${routeId}:`, {
      GPS: [lat.toFixed(6), lng.toFixed(6)],
      routePoints: route.coordinates.length,
      totalDistance: route.totalDistance.toFixed(2) + 'km'
    });

    // Check cache first for performance
    const cacheKey = this.getCacheKey(lat, lng, routeId);
    const cached = this.snapCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    // Find nearest point on route
    const nearestResult = this.findNearestPointOnRoute([lat, lng], route);
    
    if (nearestResult.distance > config.maxSnapDistance) {
      // Too far from route, don't snap
      const result = {
        snappedPosition: [lat, lng],
        isSnapped: false,
        reason: 'too_far',
        distance: nearestResult.distance,
        accuracy: 'poor'
      };
      
      this.updateCache(cacheKey, result);
      return result;
    }

    // Snap to route
    const snappedPosition = [
      nearestResult.point[0],
      nearestResult.point[1]
    ];

    const result = {
      snappedPosition,
      isSnapped: true,
      originalPosition: [lat, lng],
      distance: nearestResult.distance,
      segmentIndex: nearestResult.segmentIndex,
      progressAlongSegment: nearestResult.progressAlongSegment,
      progressAlongRoute: this.calculateProgressAlongRoute(route, nearestResult),
      accuracy: 'good'
    };

    this.updateCache(cacheKey, result);
    return result;
  }

  /**
   * Find nearest point on route using efficient algorithm
   * @param {Array} point - [lat, lng] GPS coordinate
   * @param {Object} route - Route object with segments
   * @returns {Object} Nearest point information
   */
  findNearestPointOnRoute(point, route) {
    let minDistance = Infinity;
    let nearestPoint = null;
    let nearestSegmentIndex = 0;
    let nearestProgress = 0;

    route.segments.forEach((segment, index) => {
      const projection = this.projectPointToLineSegment(point, segment.startCoord, segment.endCoord);
      
      if (projection.distance < minDistance) {
        minDistance = projection.distance;
        nearestPoint = projection.point;
        nearestSegmentIndex = index;
        nearestProgress = projection.progress;
      }
    });

    return {
      point: nearestPoint,
      distance: minDistance,
      segmentIndex: nearestSegmentIndex,
      progressAlongSegment: nearestProgress
    };
  }

  /**
   * Project point onto line segment and find closest point
   * @param {Array} point - [lat, lng] point to project
   * @param {Array} lineStart - [lat, lng] start of line segment
   * @param {Array} lineEnd - [lat, lng] end of line segment
   * @returns {Object} Projection result
   */
  projectPointToLineSegment(point, lineStart, lineEnd) {
    const A = point[0] - lineStart[0];
    const B = point[1] - lineStart[1];
    const C = lineEnd[0] - lineStart[0];
    const D = lineEnd[1] - lineStart[1];

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // Line segment is a point
      return {
        point: lineStart,
        distance: this.haversineDistance(point[0], point[1], lineStart[0], lineStart[1]),
        progress: 0
      };
    }
    
    let param = dot / lenSq;

    // Clamp parameter to segment bounds
    param = Math.max(0, Math.min(1, param));

    const projX = lineStart[0] + param * C;
    const projY = lineStart[1] + param * D;
    
    const distance = this.haversineDistance(point[0], point[1], projX, projY);

    return {
      point: [projX, projY],
      distance,
      progress: param
    };
  }

  /**
   * Calculate progress along entire route
   * @param {Object} route - Route object
   * @param {Object} nearestResult - Nearest point result
   * @returns {number} Progress along route (0-1)
   */
  calculateProgressAlongRoute(route, nearestResult) {
    const segment = route.segments[nearestResult.segmentIndex];
    if (!segment) return 0;

    const distanceToPoint = segment.startDistance + (segment.distance * nearestResult.progressAlongSegment);
    return distanceToPoint / route.totalDistance;
  }

  /**
   * Haversine distance calculation in meters
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Check if vehicle should use snapped position vs raw GPS
   * @param {Object} gpsData - GPS data with accuracy
   * @param {Object} snapResult - Snap result
   * @param {Object} options - Decision options
   * @returns {Object} Decision result
   */
  shouldUseSnappedPosition(gpsData, snapResult, options = {}) {
    const config = { ...this.config, ...options };
    
    // Always use snapped position if GPS accuracy is poor
    if (gpsData.accuracy && gpsData.accuracy > config.gpsAccuracyThreshold) {
      return {
        useSnapped: true,
        reason: 'poor_gps_accuracy',
        confidence: 0.9
      };
    }

    // Use snapped position if GPS is far from route
    if (snapResult.distance > config.offRouteThreshold) {
      return {
        useSnapped: true,
        reason: 'off_route',
        confidence: 0.8
      };
    }

    // Use raw GPS if close to route and good accuracy
    return {
      useSnapped: false,
      reason: 'good_gps_close_to_route',
      confidence: 0.7
    };
  }

  /**
   * Get cache key for GPS coordinate
   */
  getCacheKey(lat, lng, routeId) {
    // Quantize coordinates to reduce cache size while maintaining precision
    const quantizedLat = Math.round(lat * 10000) / 10000; // ~1m precision
    const quantizedLng = Math.round(lng * 10000) / 10000;
    return `${routeId}_${quantizedLat}_${quantizedLng}`;
  }

  /**
   * Check if cached result is still valid
   */
  isCacheValid(cached) {
    return Date.now() - cached.timestamp < 30000; // 30 second cache
  }

  /**
   * Update cache with new snap result
   */
  updateCache(key, result) {
    if (this.snapCache.size >= this.config.cacheSize) {
      // Remove oldest entry
      const firstKey = this.snapCache.keys().next().value;
      this.snapCache.delete(firstKey);
    }
    
    this.snapCache.set({
      ...result,
      timestamp: Date.now()
    });
  }

  /**
   * Batch snap multiple GPS points for efficiency
   * @param {Array} gpsPoints - Array of {lat, lng, routeId} objects
   * @param {Object} options - Snap options
   * @returns {Array} Array of snap results
   */
  batchSnap(gpsPoints, options = {}) {
    return gpsPoints.map(gpsPoint => 
      this.snapToRoute(gpsPoint.lat, gpsPoint.lng, gpsPoint.routeId, options)
    );
  }

  /**
   * Clear snap cache
   */
  clearCache() {
    this.snapCache.clear();
    console.log('🗑️ GPS snap cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.snapCache.size,
      maxSize: this.config.cacheSize,
      hitRate: this.snapCache.size / this.config.cacheSize
    };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ GPS Snapper config updated:', this.config);
  }
}

export default GPSSnapper;
