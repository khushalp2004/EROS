/**
 * Minimal GPS Snapping Example
 * Demonstrates the core concept: GPS → Route Snapping → Smooth Movement
 */

import React, { useState, useEffect } from 'react';
import L from 'leaflet';
import GPSSnapper from '../utils/GPSSnapper';
import RouteGeometryManager from '../utils/RouteGeometryManager';

const MinimalGPSSnappingExample = () => {
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [route, setRoute] = useState(null);
  const [snapper, setSnapper] = useState(null);
  const [animationFrame, setAnimationFrame] = useState(null);

  useEffect(() => {
    // Initialize map
    const mapInstance = L.map('map').setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
    
    // Create a sample route (emergency response route)
    const sampleRoute = {
      id: 'emergency-route-1',
      coordinates: [
        [40.7128, -74.0060], // Start: Emergency location
        [40.7138, -74.0065], // Point 2
        [40.7148, -74.0070], // Point 3
        [40.7158, -74.0075], // Point 4
        [40.7168, -74.0080]  // End: Hospital
      ],
      distances: [], // Will be calculated
      totalDistance: 0,
      segments: [] // Will be calculated
    };

    // Initialize route geometry manager and snapper
    const geometryManager = new RouteGeometryManager();
    const snapperInstance = new GPSSnapper(geometryManager);
    
    // Process the route for animation
    const osrmRoute = {
      geometry: {
        coordinates: sampleRoute.coordinates
      }
    };
    
    const processedRoute = geometryManager.processOSRMRoute(osrmRoute, 'emergency-route-1');
    
    // Draw route polyline
    const routePolyline = L.polyline(processedRoute.coordinates, {
      color: '#dc3545',
      weight: 4,
      opacity: 0.8
    }).addTo(mapInstance);
    
    // Create vehicle marker
    const vehicleMarker = L.marker([40.7128, -74.0060], {
      icon: L.divIcon({
        html: '🚑',
        iconSize: [32, 32],
        className: 'vehicle-marker'
      })
    }).addTo(mapInstance);

    // Add start/end markers
    L.marker([40.7128, -74.0060], {
      icon: L.divIcon({
        html: '🚨',
        iconSize: [24, 24]
      })
    }).addTo(mapInstance).bindPopup('Emergency Location');
    
    L.marker([40.7168, -74.0080], {
      icon: L.divIcon({
        html: '🏥',
        iconSize: [24, 24]
      })
    }).addTo(mapInstance).bindPopup('Hospital');

    setMap(mapInstance);
    setMarker(vehicleMarker);
    setRoute(processedRoute);
    setSnapper(snapperInstance);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      mapInstance.remove();
    };
  }, []);

  // Simulate GPS updates with noise
  const simulateGPSUpdates = () => {
    if (!marker || !route || !snapper) return;

    let progress = 0;
    const duration = 30000; // 30 seconds
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);

      // Calculate ideal position along route (0-1 progress)
      const idealDistance = route.totalDistance * progress;
      const idealPosition = route.segments.reduce((acc, segment) => {
        if (idealDistance >= segment.startDistance && idealDistance <= segment.endDistance) {
          const segmentProgress = (idealDistance - segment.startDistance) / segment.distance;
          const lat = segment.startCoord[0] + (segment.endCoord[0] - segment.startCoord[0]) * segmentProgress;
          const lng = segment.startCoord[1] + (segment.endCoord[1] - segment.startCoord[1]) * segmentProgress;
          return [lat, lng];
        }
        return acc;
      }, route.segments[0].startCoord);

      // Add realistic GPS noise (±30 meters)
      const gpsNoise = 0.0003; // ~30 meters in lat/lng degrees
      const noisyGPS = [
        idealPosition[0] + (Math.random() - 0.5) * gpsNoise,
        idealPosition[1] + (Math.random() - 0.5) * gpsNoise
      ];

      // Snap GPS to route
      const snapResult = snapper.snapToRoute(
        noisyGPS[0],
        noisyGPS[1],
        'emergency-route-1',
        {
          maxSnapDistance: 100, // Allow snapping up to 100m
          gpsAccuracyThreshold: 20,
          offRouteThreshold: 50
        }
      );

      // Update marker position
      marker.setLatLng(snapResult.snappedPosition);

      // Update popup with debugging info
      marker.setPopupContent(`
        <div style="min-width: 200px;">
          <h4>🚑 Emergency Vehicle Tracking</h4>
          <p><strong>Progress:</strong> ${Math.round(progress * 100)}%</p>
          <p><strong>GPS Accuracy:</strong> ${snapResult.isSnapped ? 'SNAPPED TO ROUTE' : 'RAW GPS'}</p>
          <p><strong>Distance from route:</strong> ${snapResult.distance.toFixed(1)}m</p>
          <p><strong>Reason:</strong> ${snapResult.reason}</p>
          <p><strong>Ideal Position:</strong> ${idealPosition[0].toFixed(5)}, ${idealPosition[1].toFixed(5)}</p>
          <p><strong>Noisy GPS:</strong> ${noisyGPS[0].toFixed(5)}, ${noisyGPS[1].toFixed(5)}</p>
          <p><strong>Snapped Position:</strong> ${snapResult.snappedPosition[0].toFixed(5)}, ${snapResult.snappedPosition[1].toFixed(5)}</p>
        </div>
      `);

      // Continue animation
      if (progress < 1) {
        const frameId = requestAnimationFrame(animate);
        setAnimationFrame(frameId);
      }
    };

    animate();
  };

  const stopAnimation = () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      setAnimationFrame(null);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        gap: '20px',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0 }}>🎯 GPS Snapping Demonstration</h2>
        <p style={{ margin: 0, color: '#6c757d' }}>
          Shows how raw GPS with noise gets snapped to planned route
        </p>
        <button 
          onClick={simulateGPSUpdates}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🚀 Start Simulation
        </button>
        <button 
          onClick={stopAnimation}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ⏹️ Stop
        </button>
      </div>
      
      <div id="map" style={{ flex: 1 }}></div>
      
      <div style={{
        padding: '20px',
        backgroundColor: '#e9ecef',
        borderTop: '1px solid #dee2e6'
      }}>
        <h3>🔍 What's Happening:</h3>
        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li><strong>Red Line:</strong> Planned emergency response route</li>
          <li><strong>🚑 Marker:</strong> Vehicle following the route (snapped to road)</li>
          <li><strong>GPS Noise:</strong> Real GPS has ±30m accuracy errors</li>
          <li><strong>Snapping:</strong> Algorithm projects GPS to nearest route point</li>
          <li><strong>Result:</strong> Smooth movement along roads instead of straight lines</li>
        </ul>
      </div>
    </div>
  );
};

export default MinimalGPSSnappingExample;
