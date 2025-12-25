/**
 * RouteGeometryManager.js
 * Handles OSRM route data processing and path computation
 */

class RouteGeometryManager {
  constructor() {
    this.routes = new Map(); // routeId -> routeData
    this.pathCache = new Map(); // routeId -> processed path
  }

  // Process OSRM response into animation-ready data
  processOSRMRoute(osrmRoute, routeId) {
    const coordinates = osrmRoute.geometry.coordinates;
    const distances = this.calculateSegmentDistances(coordinates);
    
    const processedRoute = {
      id: routeId,
      coordinates: coordinates.map(([lon, lat]) => [lat, lon]), // Convert [lon, lat] to [lat, lon] for Leaflet
      distances: distances,
      totalDistance: distances.reduce((sum, d) => sum + d, 0),
      segments: this.createSegments(coordinates.map(([lon, lat]) => [lat, lon]), distances)
    };

    this.pathCache.set(routeId, processedRoute);
    console.log(`🛣️ Route processed for ${routeId}: ${coordinates.length} points, ${processedRoute.totalDistance.toFixed(2)}km`);
    return processedRoute;
  }

  // Calculate distances between consecutive points (Haversine formula)
  calculateSegmentDistances(coordinates) {
    const distances = [];
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lat1, lon1] = coordinates[i];
      const [lat2, lon2] = coordinates[i + 1];
      distances.push(this.haversineDistance(lat1, lon1, lat2, lon2));
    }
    return distances;
  }

  // Haversine distance calculation in meters
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

    return R * c; // Distance in meters
  }

  // Create route segments for efficient position lookup
  createSegments(coordinates, distances) {
    const segments = [];
    let cumulativeDistance = 0;
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      segments.push({
        startCoord: coordinates[i],
        endCoord: coordinates[i + 1],
        startDistance: cumulativeDistance,
        endDistance: cumulativeDistance + distances[i],
        distance: distances[i]
      });
      cumulativeDistance += distances[i];
    }
    
    return segments;
  }

  // Calculate position at given distance along route
  getPositionAtDistance(routeId, distance) {
    const route = this.pathCache.get(routeId);
    if (!route) return null;

    if (distance <= 0) return route.segments[0]?.startCoord;
    if (distance >= route.totalDistance) return route.segments[route.segments.length - 1]?.endCoord;

    // Find segment containing the target distance
    const segment = route.segments.find(s => 
      distance >= s.startDistance && distance <= s.endDistance
    );

    if (!segment) return null;

    // Calculate position within the segment
    const segmentProgress = (distance - segment.startDistance) / segment.distance;
    
    return this.interpolatePosition(
      segment.startCoord,
      segment.endCoord,
      segmentProgress
    );
  }

  // Linear interpolation between two coordinates
  interpolatePosition(startCoord, endCoord, progress) {
    const lat = startCoord[0] + (endCoord[0] - startCoord[0]) * progress;
    const lng = startCoord[1] + (endCoord[1] - startCoord[1]) * progress;
    return [lat, lng];
  }

  // Calculate heading for marker rotation
  getHeadingAtDistance(routeId, distance) {
    const route = this.pathCache.get(routeId);
    if (!route) return 0;

    const segment = route.segments.find(s => 
      distance >= s.startDistance && distance <= s.endDistance
    );

    if (!segment) return 0;

    const [lat1, lon1] = segment.startCoord;
    const [lat2, lon2] = segment.endCoord;
    
    // Calculate bearing in degrees
    const bearing = Math.atan2(
      Math.sin(lon2 - lon1) * Math.cos(lat2),
      Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
    ) * 180 / Math.PI;

    return (bearing + 360) % 360;
  }

  // Get processed route data
  getRoute(routeId) {
    return this.pathCache.get(routeId);
  }

  // Remove route from cache
  removeRoute(routeId) {
    this.pathCache.delete(routeId);
  }

  // Clear all routes
  clearRoutes() {
    this.pathCache.clear();
  }
}

export default RouteGeometryManager;
