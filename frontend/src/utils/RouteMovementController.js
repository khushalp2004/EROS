/**
 * RouteMovementController.js
 * Redesigned movement logic for route-constrained vehicle tracking
 * 
 * Core Features:
 * - Route progress tracking with interpolation
 * - Smooth movement between GPS updates
 * - Continuous route following without straight-line shortcuts
 * - Real-time position calculation along route geometry
 */

import RouteGeometryManager from './RouteGeometryManager';
import { 
  isEmergency, 
  isUnit, 
  getAssignedUnit, 
  getUnitId, 
  safeGet, 
  validateEmergency,
  validateUnit,
  logDataError
} from './DataValidationUtils.js';

class RouteMovementController {
  constructor() {
    this.geometryManager = new RouteGeometryManager();
    this.activeMovements = new Map(); // unitId -> movementState
    this.routeProgressCache = new Map(); // unitId -> progress data
    this.interpolationFrame = null;
    this.isInterpolating = false;
    
    // Configuration
    this.config = {
      interpolationInterval: 100, // 100ms between interpolation updates
      maxSnapDistance: 100, // Maximum distance to snap to route (meters)
      smoothingFactor: 0.8, // Interpolation smoothing (0-1)
      minProgressDelta: 0.001, // Minimum progress change to update position
      routeCacheTimeout: 300000, // 5 minutes
      maxInterpolationHistory: 10 // Maximum number of interpolation points to keep
    };
  }

  /**
   * Initialize route movement for a unit
   * @param {string} unitId - Unit identifier
   * @param {Object} osrmRouteData - OSRM route geometry
   * @param {Object} options - Configuration options
   */
  initializeUnitRoute(unitId, osrmRouteData, options = {}) {
    try {
      console.log(`🛣️ Initializing route movement for Unit ${unitId}`);
      
      // Process route with geometry manager
      const routeId = `route-${unitId}`;
      const processedRoute = this.geometryManager.processOSRMRoute(osrmRouteData, routeId);
      
      // Initialize movement state
      const movementState = {
        unitId: unitId,
        routeId: routeId,
        routeData: processedRoute,
        currentProgress: 0,
        lastUpdateTime: Date.now(),
        lastPosition: null,
        velocity: 0,
        targetPosition: null,
        isActive: true,
        interpolationHistory: [],
        lastGPSUpdate: null,
        snapToRoute: options.snapToRoute !== false,
        maxSpeed: options.maxSpeed || 30, // m/s
        ...options
      };
      
      this.activeMovements.set(unitId, movementState);
      console.log(`✅ Route movement initialized for Unit ${unitId}: ${processedRoute.totalDistance.toFixed(2)}km`);
      
      return {
        success: true,
        routeId: routeId,
        totalDistance: processedRoute.totalDistance,
        segments: processedRoute.segments.length
      };
      
    } catch (error) {
      console.error(`❌ Failed to initialize route movement for Unit ${unitId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update unit position with GPS data and route constraints
   * @param {string} unitId - Unit identifier
   * @param {number} gpsLat - Raw GPS latitude
   * @param {number} gpsLng - Raw GPS longitude
   * @param {Object} gpsMetadata - GPS metadata (accuracy, timestamp, etc.)
   */
  updateUnitPosition(unitId, gpsLat, gpsLng, gpsMetadata = {}) {
    const movementState = this.activeMovements.get(unitId);
    if (!movementState || !movementState.isActive) {
      console.warn(`⚠️ No active route movement for Unit ${unitId}`);
      return null;
    }

    const currentTime = Date.now();
    const timeDelta = currentTime - movementState.lastUpdateTime;
    
    try {
      // Step 1: Calculate progress along route from GPS position
      const progressData = this.calculateRouteProgress(
        movementState.routeData,
        [gpsLat, gpsLng]
      );
      
      if (!progressData) {
        console.warn(`⚠️ Could not calculate progress for Unit ${unitId}`);
        return this.getCurrentPosition(unitId);
      }

      // Step 2: Update movement state
      const newProgress = progressData.progress;
      const distanceAlongRoute = progressData.distanceAlongRoute;
      const snapDistance = progressData.snapDistance;
      
      // Calculate velocity if we have enough data
      let velocity = 0;
      if (movementState.currentProgress > 0 && timeDelta > 0) {
        const progressDelta = newProgress - movementState.currentProgress;
        const distanceDelta = movementState.routeData.totalDistance * progressDelta;
        velocity = (distanceDelta * 1000) / (timeDelta / 1000); // m/s
      }

      // Step 3: Update movement state
      movementState.currentProgress = newProgress;
      movementState.lastUpdateTime = currentTime;
      movementState.lastGPSUpdate = {
        latitude: gpsLat,
        longitude: gpsLng,
        accuracy: gpsMetadata.accuracy || 0,
        timestamp: gpsMetadata.timestamp || currentTime,
        progress: newProgress,
        distanceAlongRoute: distanceAlongRoute,
        snapDistance: snapDistance
      };
      
      // Store velocity with smoothing
      movementState.velocity = movementState.velocity * this.config.smoothingFactor + 
                              velocity * (1 - this.config.smoothingFactor);

      // Step 4: Calculate target position along route
      const targetPosition = this.geometryManager.getPositionAtDistance(
        movementState.routeId, 
        distanceAlongRoute
      );
      
      movementState.targetPosition = targetPosition;
      
      // Add to interpolation history
      this.addToInterpolationHistory(unitId, {
        time: currentTime,
        progress: newProgress,
        position: targetPosition,
        rawGPS: [gpsLat, gpsLng],
        snapDistance: snapDistance
      });

      // Step 5: Start interpolation if needed
      this.startInterpolationIfNeeded(unitId);

      console.log(`🎯 Unit ${unitId} position update:`, {
        progress: (newProgress * 100).toFixed(1) + '%',
        velocity: movementState.velocity.toFixed(1) + ' m/s',
        snapDistance: snapDistance.toFixed(1) + 'm',
        targetPosition: targetPosition ? [targetPosition[0].toFixed(5), targetPosition[1].toFixed(5)] : null
      });

      return {
        latitude: targetPosition[0],
        longitude: targetPosition[1],
        progress: newProgress,
        velocity: movementState.velocity,
        snapDistance: snapDistance,
        isSnapped: snapDistance <= this.config.maxSnapDistance,
        rawGPS: [gpsLat, gpsLng],
        timestamp: currentTime
      };

    } catch (error) {
      console.error(`❌ Error updating Unit ${unitId} position:`, error);
      return this.getCurrentPosition(unitId);
    }
  }

  /**
   * Calculate progress along route from GPS position
   * @param {Object} routeData - Processed route data
   * @param {Array} gpsPosition - [lat, lng] GPS position
   * @returns {Object} Progress data or null
   */
  calculateRouteProgress(routeData, gpsPosition) {
    try {
      // Enhanced validation to prevent the "Unit object has no attribute 'assigned_unit'" error
      if (!routeData || typeof routeData !== 'object') {
        logDataError('RouteMovementController.calculateRouteProgress', routeData, 'invalid routeData');
        return null;
      }
      
      if (!routeData.segments || !Array.isArray(routeData.segments)) {
        logDataError('RouteMovementController.calculateRouteProgress', routeData, 'missing segments array');
        return null;
      }
      
      if (!gpsPosition || !Array.isArray(gpsPosition) || gpsPosition.length !== 2) {
        logDataError('RouteMovementController.calculateRouteProgress', gpsPosition, 'invalid gpsPosition');
        return null;
      }
      
      const [gpsLat, gpsLng] = gpsPosition;
      
      // Validate GPS coordinates
      if (typeof gpsLat !== 'number' || typeof gpsLng !== 'number' || 
          isNaN(gpsLat) || isNaN(gpsLng)) {
        logDataError('RouteMovementController.calculateRouteProgress', { gpsLat, gpsLng }, 'invalid GPS coordinates');
        return null;
      }
      
      // Find closest point on route
      let closestDistance = Infinity;
      let closestSegment = null;
      let closestPoint = null;
      let distanceAlongRoute = 0;
      let cumulativeDistance = 0;

      for (let i = 0; i < routeData.segments.length; i++) {
        const segment = routeData.segments[i];
        
        // Validate segment structure
        if (!segment || typeof segment !== 'object' ||
            !segment.startCoord || !segment.endCoord ||
            segment.distance === undefined) {
          logDataError('RouteMovementController.calculateRouteProgress', segment, `invalid segment ${i}`);
          continue;
        }
        
        // Calculate distance from GPS to this segment
        const distanceToSegment = this.pointToSegmentDistance(
          gpsPosition, 
          segment.startCoord, 
          segment.endCoord
        );

        if (distanceToSegment.distance < closestDistance) {
          closestDistance = distanceToSegment.distance;
          closestSegment = segment;
          closestPoint = distanceToSegment.closestPoint;
          distanceAlongRoute = cumulativeDistance + distanceToSegment.distanceAlongSegment;
        }
        
        cumulativeDistance += segment.distance;
      }

      if (!closestSegment) {
        console.warn('⚠️ No closest segment found for GPS position:', gpsPosition);
        return null;
      }

      // Validate total distance
      if (typeof routeData.totalDistance !== 'number' || routeData.totalDistance <= 0) {
        logDataError('RouteMovementController.calculateRouteProgress', routeData, 'invalid totalDistance');
        return null;
      }

      // Calculate progress as percentage
      const progress = Math.max(0, Math.min(1, distanceAlongRoute / routeData.totalDistance));

      return {
        progress: progress,
        distanceAlongRoute: distanceAlongRoute,
        snapDistance: closestDistance,
        closestPoint: closestPoint,
        segment: closestSegment
      };

    } catch (error) {
      console.error('❌ Error calculating route progress:', error);
      console.error('📊 Context:', {
        routeDataType: routeData ? routeData.constructor?.name || typeof routeData : 'undefined',
        routeDataKeys: routeData ? Object.keys(routeData) : [],
        gpsPosition: gpsPosition,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Calculate distance from point to line segment
   * @param {Array} point - [lat, lng] point
   * @param {Array} segmentStart - [lat, lng] segment start
   * @param {Array} segmentEnd - [lat, lng] segment end
   * @returns {Object} Distance data
   */
  pointToSegmentDistance(point, segmentStart, segmentEnd) {
    const [px, py] = point;
    const [x1, y1] = segmentStart;
    const [x2, y2] = segmentEnd;

    // Vector from start to end
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    // Vector from start to point
    const fx = px - x1;
    const fy = py - y1;

    // Calculate projection parameter
    const dot = fx * dx + fy * dy;
    const lengthSquared = dx * dx + dy * dy;
    
    let t = 0;
    if (lengthSquared > 0) {
      t = dot / lengthSquared;
    }
    
    // Clamp to segment
    t = Math.max(0, Math.min(1, t));
    
    // Calculate closest point on segment
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    
    // Calculate distance
    const distance = this.geometryManager.haversineDistance(px, py, closestX, closestY);
    
    // Calculate distance along segment
    const segmentLength = this.geometryManager.haversineDistance(x1, y1, x2, y2);
    const distanceAlongSegment = t * segmentLength;

    return {
      distance: distance,
      closestPoint: [closestX, closestY],
      distanceAlongSegment: distanceAlongSegment,
      projectionParameter: t
    };
  }

  /**
   * Get current interpolated position for a unit
   * @param {string} unitId - Unit identifier
   * @returns {Array|null} [lat, lng] position or null
   */
  getCurrentPosition(unitId) {
    const movementState = this.activeMovements.get(unitId);
    if (!movementState || !movementState.targetPosition) {
      return null;
    }

    // Return interpolated position if available
    if (movementState.lastPosition) {
      return movementState.lastPosition;
    }

    return movementState.targetPosition;
  }

  /**
   * Start interpolation for smooth movement
   * @param {string} unitId - Unit identifier
   */
  startInterpolationIfNeeded(unitId) {
    const movementState = this.activeMovements.get(unitId);
    if (!movementState || !movementState.targetPosition) {
      return;
    }

    // Check if interpolation is needed
    const lastPosition = movementState.lastPosition;
    const targetPosition = movementState.targetPosition;
    
    if (!lastPosition) {
      // First position, just set it
      movementState.lastPosition = targetPosition;
      return;
    }

    // Calculate distance to target
    const distance = this.geometryManager.haversineDistance(
      lastPosition[0], lastPosition[1],
      targetPosition[0], targetPosition[1]
    );

    // Start interpolation if distance is significant
    if (distance > 1) { // 1 meter threshold
      this.interpolateTowardsTarget(unitId);
    } else {
      movementState.lastPosition = targetPosition;
    }
  }

  /**
   * Interpolate marker position towards target smoothly
   * @param {string} unitId - Unit identifier
   */
  interpolateTowardsTarget(unitId) {
    if (this.isInterpolating) {
      return; // Avoid multiple interpolation loops
    }

    this.isInterpolating = true;
    
    const animate = () => {
      let allComplete = true;
      
      this.activeMovements.forEach((movementState, currentUnitId) => {
        if (currentUnitId !== unitId && unitId !== 'all') return;
        
        if (!movementState.isActive || !movementState.targetPosition) {
          return;
        }

        const lastPosition = movementState.lastPosition;
        const targetPosition = movementState.targetPosition;
        
        if (!lastPosition) {
          movementState.lastPosition = targetPosition;
          return;
        }

        // Calculate interpolation step
        const distance = this.geometryManager.haversineDistance(
          lastPosition[0], lastPosition[1],
          targetPosition[0], targetPosition[1]
        );

        if (distance < 0.5) {
          // Close enough to target
          movementState.lastPosition = targetPosition;
          return;
        }

        allComplete = false;

        // Calculate interpolation factor
        const stepSize = Math.min(distance * 0.3, 5); // Move up to 5m or 30% of distance per frame
        const interpolationFactor = stepSize / distance;

        // Interpolate position
        const newLat = lastPosition[0] + (targetPosition[0] - lastPosition[0]) * interpolationFactor;
        const newLng = lastPosition[1] + (targetPosition[1] - lastPosition[1]) * interpolationFactor;
        
        movementState.lastPosition = [newLat, newLng];
      });

      if (!allComplete) {
        this.interpolationFrame = requestAnimationFrame(animate);
      } else {
        this.isInterpolating = false;
        this.interpolationFrame = null;
      }
    };

    this.interpolationFrame = requestAnimationFrame(animate);
  }

  /**
   * Add data point to interpolation history
   * @param {string} unitId - Unit identifier
   * @param {Object} data - Interpolation data
   */
  addToInterpolationHistory(unitId, data) {
    const movementState = this.activeMovements.get(unitId);
    if (!movementState) return;

    movementState.interpolationHistory.push(data);
    
    // Limit history size
    if (movementState.interpolationHistory.length > this.config.maxInterpolationHistory) {
      movementState.interpolationHistory.shift();
    }
  }

  /**
   * Get route progress for a unit
   * @param {string} unitId - Unit identifier
   * @returns {Object|null} Progress data
   */
  getUnitProgress(unitId) {
    const movementState = this.activeMovements.get(unitId);
    if (!movementState) return null;

    return {
      unitId: unitId,
      progress: movementState.currentProgress,
      distanceAlongRoute: movementState.currentProgress * movementState.routeData.totalDistance,
      totalDistance: movementState.routeData.totalDistance,
      velocity: movementState.velocity,
      lastUpdate: movementState.lastUpdateTime,
      lastGPS: movementState.lastGPSUpdate,
      isActive: movementState.isActive
    };
  }

  /**
   * Stop route movement for a unit
   * @param {string} unitId - Unit identifier
   */
  stopUnitMovement(unitId) {
    const movementState = this.activeMovements.get(unitId);
    if (movementState) {
      movementState.isActive = false;
      console.log(`⏹️ Stopped route movement for Unit ${unitId}`);
    }
  }

  /**
   * Resume route movement for a unit
   * @param {string} unitId - Unit identifier
   */
  resumeUnitMovement(unitId) {
    const movementState = this.activeMovements.get(unitId);
    if (movementState) {
      movementState.isActive = true;
      console.log(`▶️ Resumed route movement for Unit ${unitId}`);
    }
  }

  /**
   * Remove unit from active tracking
   * @param {string} unitId - Unit identifier
   */
  removeUnit(unitId) {
    this.activeMovements.delete(unitId);
    this.routeProgressCache.delete(unitId);
    console.log(`🗑️ Removed Unit ${unitId} from route tracking`);
  }

  /**
   * Clear all active movements
   */
  clearAllMovements() {
    this.activeMovements.clear();
    this.routeProgressCache.clear();
    
    if (this.interpolationFrame) {
      cancelAnimationFrame(this.interpolationFrame);
      this.interpolationFrame = null;
    }
    
    this.isInterpolating = false;
    console.log('🧹 Cleared all route movements');
  }

  /**
   * Get status of all active movements
   * @returns {Array} Array of movement status
   */
  getAllMovementStatus() {
    const status = [];
    
    this.activeMovements.forEach((movementState, unitId) => {
      status.push({
        unitId: unitId,
        routeId: movementState.routeId,
        progress: movementState.currentProgress,
        isActive: movementState.isActive,
        velocity: movementState.velocity,
        lastUpdate: movementState.lastUpdateTime,
        targetPosition: movementState.targetPosition,
        lastPosition: movementState.lastPosition
      });
    });
    
    return status;
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Initialize from WebSocket location update
   * @param {Object} locationUpdate - WebSocket location update data
   */
  initializeFromWebSocket(locationUpdate) {
    try {
      const { unit_id, latitude, longitude, progress, route_data, emergency_id, route_geometry, osrm_route_id } = locationUpdate;
      
      if (!unit_id || (!route_data && !route_geometry)) {
        console.warn('⚠️ Cannot initialize from WebSocket: missing unitId or route data');
        return { success: false, error: 'Missing required data' };
      }

      console.log(`🔄 Initializing RouteMovementController for Unit ${unit_id} from WebSocket`);

      // 🔧 ENHANCED: Use OSRM route geometry directly if available
      let osrmRouteData;
      if (route_geometry) {
        // Use full OSRM geometry directly from backend
        osrmRouteData = {
          geometry: JSON.parse(route_geometry),  // Parse JSON string to object
          distance: locationUpdate.route_distance,
          duration: locationUpdate.route_duration
        };
        console.log(`📍 Using direct OSRM geometry for Unit ${unit_id}`);
      } else if (route_data) {
        // Fallback to route_data format
        osrmRouteData = {
          geometry: route_data.geometry,
          distance: route_data.distance,
          duration: route_data.duration
        };
        console.log(`📍 Using route_data for Unit ${unit_id}`);
      } else {
        throw new Error('No route geometry data available');
      }

      // Initialize unit route with enhanced options
      const result = this.initializeUnitRoute(unit_id.toString(), osrmRouteData, {
        emergencyId: emergency_id,
        initialProgress: progress || 0,
        osrmRouteId: osrm_route_id,
        useDirectOSRM: !!route_geometry,
        source: 'websocket'
      });

      if (result.success) {
        // Update current position based on progress
        if (progress !== undefined && progress >= 0) {
          const currentPosition = this.geometryManager.getPositionAtDistance(
            result.routeId,
            progress * this.activeMovements.get(unit_id.toString()).routeData.totalDistance
          );
          
          if (currentPosition) {
            this.activeMovements.get(unit_id.toString()).currentProgress = progress;
            this.activeMovements.get(unit_id.toString()).lastPosition = currentPosition;
            this.activeMovements.get(unit_id.toString()).targetPosition = currentPosition;
          }
        }

        console.log(`✅ RouteMovementController initialized for Unit ${unit_id}: ${(progress * 100).toFixed(1)}% progress using OSRM data`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Error initializing RouteMovementController from WebSocket:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Update from WebSocket location update
   * @param {Object} locationUpdate - WebSocket location update data
   */
  updateFromWebSocket(locationUpdate) {
    try {
      const { unit_id, latitude, longitude, progress, route_data, emergency_id, is_on_route } = locationUpdate;
      
      if (!unit_id) {
        console.warn('⚠️ Cannot update from WebSocket: missing unitId');
        return null;
      }

      const unitId = unit_id.toString();
      const movementState = this.activeMovements.get(unitId);
      
      if (!movementState) {
        // If no existing movement state, try to initialize from this update
        return this.initializeFromWebSocket(locationUpdate);
      }

      // 🔧 ENHANCED: Update progress if provided and route is active
      if (progress !== undefined && progress >= 0 && is_on_route) {
        movementState.currentProgress = progress;
        movementState.lastUpdateTime = Date.now();
        
        // Calculate target position along route using OSRM geometry
        const targetDistance = progress * movementState.routeData.totalDistance;
        const targetPosition = this.geometryManager.getPositionAtDistance(
          movementState.routeId,
          targetDistance
        );
        
        if (targetPosition) {
          movementState.targetPosition = targetPosition;
          
          // Start interpolation if needed
          this.startInterpolationIfNeeded(unitId);
          
          console.log(`📍 Unit ${unit_id} updated via WebSocket: ${(progress * 100).toFixed(1)}% progress along OSRM route`);
        }
      } else if (is_on_route === false) {
        // If unit is not on route, stop route following
        console.log(`⚠️ Unit ${unit_id} is not on route, stopping route following`);
        this.stopUnitMovement(unit_id);
      }

      return {
        unitId: unit_id,
        progress: progress,
        position: movementState.targetPosition,
        velocity: movementState.velocity,
        isActive: movementState.isActive,
        isOnRoute: is_on_route
      };
    } catch (error) {
      console.error(`❌ Error updating RouteMovementController from WebSocket:`, error);
      return null;
    }
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Main method to handle all WebSocket updates
   * @param {Object} locationUpdate - Complete WebSocket location update
   * @returns {Object} Updated movement state
   */
  handleWebSocketUpdate(locationUpdate) {
    try {
      console.log(`🔄 Handling WebSocket update for Unit ${locationUpdate.unit_id}`);
      
      // First update the movement controller
      const movementResult = this.updateFromWebSocket(locationUpdate);
      
      if (movementResult) {
        // Enhanced return data with OSRM information
        return {
          ...movementResult,
          // Add OSRM-specific metadata
          hasOSRMData: !!(locationUpdate.route_geometry || locationUpdate.route_data),
          osrmRouteId: locationUpdate.osrm_route_id,
          routeDistance: locationUpdate.route_distance,
          routeDuration: locationUpdate.route_duration,
          timestamp: locationUpdate.timestamp,
          source: 'websocket'
        };
      }
      
      return movementResult;
    } catch (error) {
      console.error(`❌ Error in handleWebSocketUpdate:`, error);
      return null;
    }
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Get polyline data with progress for AnimatedPolyline
   * @param {string} unitId - Unit identifier
   * @returns {Object|null} Polyline data for AnimatedPolyline component
   */
  getPolylineDataForUnit(unitId) {
    try {
      const movementState = this.activeMovements.get(unitId);
      if (!movementState) {
        return null;
      }

      // Get route geometry as polyline positions
      const routePositions = this.geometryManager.getRoutePolylinePositions(movementState.routeId);
      if (!routePositions || routePositions.length === 0) {
        console.warn(`⚠️ No route positions found for unit ${unitId}`);
        return null;
      }

      // Return polyline data compatible with AnimatedPolyline
      return {
        unitId: unitId,
        emergencyId: movementState.emergencyId,
        positions: routePositions,
        progress: movementState.currentProgress,
        color: this.getServiceColor(movementState.serviceType),
        serviceType: movementState.serviceType,
        // 🔧 ENHANCED: Add OSRM data if available
        osrmRouteData: movementState.osrmRouteData || null,
        routeGeometry: movementState.routeData ? {
          coordinates: movementState.routeData.segments.map(seg => [seg.startLat, seg.startLng])
        } : null,
        routeDistance: movementState.routeData ? movementState.routeData.totalDistance : null,
        routeDuration: movementState.routeData ? movementState.routeData.totalDuration : null,
        osrmRouteId: movementState.osrmRouteId || null,
        // Animation settings
        isAnimated: true,
        isRealtime: true,
        routeId: movementState.routeId
      };
    } catch (error) {
      console.error(`❌ Error getting polyline data for unit ${unitId}:`, error);
      return null;
    }
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Get all active polyline data
   * @returns {Array} Array of polyline data objects
   */
  getAllPolylineData() {
    const polylineData = [];
    
    for (const [unitId, movementState] of this.activeMovements) {
      const data = this.getPolylineDataForUnit(unitId);
      if (data) {
        polylineData.push(data);
      }
    }
    
    console.log(`📊 Generated polyline data for ${polylineData.length} active routes`);
    return polylineData;
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Get service color for route styling
   * @param {string} serviceType - Service type (AMBULANCE, FIRE_TRUCK, etc.)
   * @returns {string} Color hex code
   */
  getServiceColor(serviceType) {
    const colorMap = {
      'AMBULANCE': '#dc3545',      // Red
      'FIRE_TRUCK': '#fd7e14',     // Orange  
      'POLICE': '#007bff',         // Blue
      'DEFAULT': '#6c757d'         // Gray
    };
    
    return colorMap[serviceType] || colorMap.DEFAULT;
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Get enhanced route status
   * @param {string} unitId - Unit identifier
   * @returns {Object|null} Enhanced route status
   */
  getEnhancedRouteStatus(unitId) {
    const movementState = this.activeMovements.get(unitId);
    if (!movementState) {
      return null;
    }

    return {
      unitId: unitId,
      emergencyId: movementState.emergencyId,
      progress: movementState.currentProgress,
      isActive: movementState.isActive,
      isInterpolating: movementState.isInterpolating,
      lastUpdateTime: movementState.lastUpdateTime,
      // OSRM-specific data
      hasOSRMData: !!(movementState.osrmRouteData),
      osrmRouteId: movementState.osrmRouteId,
      totalDistance: movementState.routeData ? movementState.routeData.totalDistance : null,
      totalDuration: movementState.routeData ? movementState.routeData.totalDuration : null,
      // Position data
      currentPosition: movementState.currentPosition,
      targetPosition: movementState.targetPosition,
      lastPosition: movementState.lastPosition,
      // Service info
      serviceType: movementState.serviceType,
      // Metadata
      source: movementState.source || 'manual',
      createdAt: movementState.createdAt
    };
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Get unit marker position at current progress
   * @param {string} unitId - Unit identifier
   * @returns {Array|null} [lat, lng] position at current progress
   */
  getUnitMarkerPosition(unitId) {
    try {
      const movementState = this.activeMovements.get(unitId);
      if (!movementState || !movementState.targetPosition) {
        return null;
      }

      // Return interpolated position if available, otherwise target position
      return movementState.lastPosition || movementState.targetPosition;
    } catch (error) {
      console.error(`❌ Error getting unit marker position for Unit ${unitId}:`, error);
      return null;
    }
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Get color for unit route
   * @param {string} unitId - Unit identifier
   * @returns {string} Color hex code
   */
  getRouteColorForUnit(unitId) {
    const colors = [
      '#0080ff', // Blue
      '#dc3545', // Red
      '#28a745', // Green
      '#ffc107', // Yellow
      '#17a2b8', // Cyan
      '#6f42c1', // Purple
      '#fd7e14', // Orange
      '#20c997'  // Teal
    ];
    
    // Use unitId to consistently assign colors
    const hash = unitId.toString().split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Setup automatic WebSocket integration
   */
  setupWebSocketIntegration() {
    const handleLocationUpdate = (event) => {
      const locationUpdate = event.detail;
      this.updateFromWebSocket(locationUpdate);
    };

    // Listen for unit location updates from WebSocket
    window.addEventListener('unitLocationUpdate', handleLocationUpdate);
    
    // Store reference for cleanup
    this._websocketEventHandler = handleLocationUpdate;
    
    console.log('🔌 RouteMovementController WebSocket integration enabled');
  }

  /**
   * 🆕 WEBSOCKET INTEGRATION: Cleanup WebSocket integration
   */
  cleanupWebSocketIntegration() {
    if (this._websocketEventHandler) {
      window.removeEventListener('unitLocationUpdate', this._websocketEventHandler);
      this._websocketEventHandler = null;
      console.log('🧹 RouteMovementController WebSocket integration cleaned up');
    }
  }
}

export default RouteMovementController;
