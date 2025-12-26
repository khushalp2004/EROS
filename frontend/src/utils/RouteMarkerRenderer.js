/**
 * RouteMarkerRenderer.js
 * Handles marker creation and position updates along route geometry
 */

import L from 'leaflet';

class RouteMarkerRenderer {
  constructor(map, routeGeometryManager, progressManager) {
    this.map = map;
    this.geometryManager = routeGeometryManager;
    this.progressManager = progressManager;
    this.markers = new Map(); // routeId -> marker
    this.iconCache = new Map();
    this.animationFrame = null;
  }

  // Create or update marker for a route
  updateMarkerPosition(routeId) {
    const progress = this.progressManager.updateProgress(routeId);
    if (progress === null) return;

    const route = this.geometryManager.getRoute(routeId);
    if (!route) {
      console.warn(`⚠️ No route data found for ${routeId}`);
      return;
    }

    // Calculate snapped position along route
    const targetDistance = route.totalDistance * progress;
    const snappedPosition = this.geometryManager.getPositionAtDistance(routeId, targetDistance);
    
    if (!snappedPosition) {
      console.warn(`⚠️ Could not calculate position for ${routeId} at progress ${progress}`);
      return;
    }

    // Update or create marker
    let marker = this.markers.get(routeId);
    if (!marker) {
      marker = this.createRouteMarker(routeId, route.vehicleType || 'default');
      this.markers.set(routeId, marker);
      console.log(`📍 Created marker for ${routeId}`);
    }

    // Update marker position
    marker.setLatLng(snappedPosition);
    
    // Optional: Update marker rotation based on heading
    const heading = this.geometryManager.getHeadingAtDistance(routeId, targetDistance);
    if (marker.setRotationAngle) {
      marker.setRotationAngle(heading);
    }
    
    // Update marker tooltip with progress info
    this.updateMarkerTooltip(marker, routeId, progress, targetDistance);
  }

  // Create route marker with appropriate icon
  createRouteMarker(routeId, vehicleType) {
    const icon = this.getVehicleIcon(vehicleType);
    const marker = L.marker([0, 0], { icon });
    
    // Add marker to map
    marker.addTo(this.map);
    
    // Add popup with route information
    marker.bindPopup(this.createMarkerPopup(routeId, vehicleType));
    
    return marker;
  }

  // Get appropriate icon for vehicle type
  getVehicleIcon(vehicleType) {
    const iconKey = `icon-${vehicleType}`;
    
    if (this.iconCache.has(iconKey)) {
      return this.iconCache.get(iconKey);
    }

    let iconUrl, iconSize, iconAnchor;
    
    switch (vehicleType) {
      case 'ambulance':
        iconUrl = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15" fill="#dc3545" stroke="#fff" stroke-width="2"/>
            <text x="16" y="20" text-anchor="middle" fill="white" font-size="16" font-weight="bold"></text>
          </svg>
        `);
        iconSize = [32, 32];
        iconAnchor = [16, 16];
        break;
        
      case 'fire':
        iconUrl = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15" fill="#fd7e14" stroke="#fff" stroke-width="2"/>
            <text x="16" y="20" text-anchor="middle" fill="white" font-size="16" font-weight="bold"></text>
          </svg>
        `);
        iconSize = [32, 32];
        iconAnchor = [16, 16];
        break;
        
      case 'police':
        iconUrl = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15" fill="#007bff" stroke="#fff" stroke-width="2"/>
            <text x="16" y="20" text-anchor="middle" fill="white" font-size="16" font-weight="bold"></text>
          </svg>
        `);
        iconSize = [32, 32];
        iconAnchor = [16, 16];
        break;
        
      default:
        iconUrl = 'data:image/svg+xml;base64,' + btoa(`
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15" fill="#6c757d" stroke="#fff" stroke-width="2"/>
            <text x="16" y="20" text-anchor="middle" fill="white" font-size="16" font-weight="bold"></text>
          </svg>
        `);
        iconSize = [32, 32];
        iconAnchor = [16, 16];
        break;
    }

    const icon = L.icon({
      iconUrl,
      iconSize,
      iconAnchor,
      popupAnchor: [0, -16]
    });

    this.iconCache.set(iconKey, icon);
    return icon;
  }

  // Create popup content for marker
  createMarkerPopup(routeId, vehicleType) {
    return `
      <div style="min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Vehicle Tracking</h4>
        <p style="margin: 4px 0;"><strong>Route ID:</strong> ${routeId}</p>
        <p style="margin: 4px 0;"><strong>Vehicle Type:</strong> ${vehicleType}</p>
        <p style="margin: 4px 0;" id="progress-${routeId}"><strong>Progress:</strong> Loading...</p>
        <p style="margin: 4px 0;" id="status-${routeId}"><strong>Status:</strong> Active</p>
      </div>
    `;
  }

  // Update marker tooltip with current progress
  updateMarkerTooltip(marker, routeId, progress, distance) {
    const status = this.progressManager.getAnimationStatus(routeId);
    const progressPercent = Math.round(progress * 100);
    const distanceKm = (distance / 1000).toFixed(2);
    
    // Update popup content
    const popup = marker.getPopup();
    if (popup) {
      const progressElement = document.getElementById(`progress-${routeId}`);
      const statusElement = document.getElementById(`status-${routeId}`);
      
      if (progressElement) {
        progressElement.innerHTML = `<strong>Progress:</strong> ${progressPercent}% (${distanceKm}km)`;
      }
      
      if (statusElement) {
        statusElement.innerHTML = `<strong>Status:</strong> ${status?.status || 'Unknown'}`;
      }
    }
  }

  // Start continuous animation loop
  startAnimationLoop() {
    if (this.animationFrame) return; // Already running
    
    const animate = () => {
      // Update all active marker positions
      const activeAnimations = this.progressManager.getActiveAnimations();
      
      activeAnimations.forEach(animation => {
        this.updateMarkerPosition(animation.routeId);
      });

      // Continue animation if there are active animations
      if (activeAnimations.length > 0) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.animationFrame = null;
        console.log('🎬 Animation loop stopped - no active animations');
      }
    };

    animate();
  }

  // Stop animation loop
  stopAnimationLoop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
      console.log('⏹️ Animation loop stopped manually');
    }
  }

  // Remove marker for route
  removeMarker(routeId) {
    const marker = this.markers.get(routeId);
    if (marker) {
      this.map.removeLayer(marker);
      this.markers.delete(routeId);
      console.log(`🗑️ Removed marker for ${routeId}`);
    }
  }

  // Clear all markers
  clearAllMarkers() {
    this.markers.forEach((marker, routeId) => {
      this.map.removeLayer(marker);
    });
    this.markers.clear();
    console.log('🗑️ Cleared all markers');
  }

  // Get marker for route
  getMarker(routeId) {
    return this.markers.get(routeId);
  }

  // Get all markers
  getAllMarkers() {
    return Array.from(this.markers.entries());
  }

  // Highlight marker (temporary visual feedback)
  highlightMarker(routeId, duration = 2000) {
    const marker = this.markers.get(routeId);
    if (marker) {
      const originalIcon = marker.options.icon;
      
      // Create highlight icon
      const highlightIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(`
          <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" fill="#ffc107" stroke="#fff" stroke-width="3"/>
            <circle cx="20" cy="20" r="12" fill="#ffc107" opacity="0.5"/>
          </svg>
        `),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      });
      
      marker.setIcon(highlightIcon);
      
      // Restore original icon after duration
      setTimeout(() => {
        marker.setIcon(originalIcon);
      }, duration);
    }
  }

  // Calculate distance from point to route
  calculateDistanceToRoute(point, routeId) {
    const route = this.geometryManager.getRoute(routeId);
    if (!route) return Infinity;
    
    let minDistance = Infinity;
    
    route.segments.forEach(segment => {
      const distance = this.distancePointToLineSegment(point, segment.startCoord, segment.endCoord);
      minDistance = Math.min(minDistance, distance);
    });
    
    return minDistance;
  }

  // Helper: Calculate distance from point to line segment
  distancePointToLineSegment(point, lineStart, lineEnd) {
    const A = point[0] - lineStart[0];
    const B = point[1] - lineStart[1];
    const C = lineEnd[0] - lineStart[0];
    const D = lineEnd[1] - lineStart[1];

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    let param = dot / lenSq;

    if (param < 0) {
      return Math.sqrt(A * A + B * B);
    } else if (param > 1) {
      const dx = point[0] - lineEnd[0];
      const dy = point[1] - lineEnd[1];
      return Math.sqrt(dx * dx + dy * dy);
    } else {
      const projX = lineStart[0] + param * C;
      const projY = lineStart[1] + param * D;
      const dx = point[0] - projX;
      const dy = point[1] - projY;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }
}

export default RouteMarkerRenderer;
