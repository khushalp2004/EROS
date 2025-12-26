/**
 * RouteFollowingExample.js
 * Complete example showing production-grade route-based marker animation
 * Demonstrates GPS snapping vs raw GPS positioning for emergency response
 */

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import RouteFollowingService from '../services/RouteFollowingService.js';

// Fix marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Emergency vehicle icon
const createVehicleIcon = (vehicle, isSnapped = false) => {
  return L.divIcon({
    className: "vehicle-marker",
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
        background: ${isSnapped ? '#28a745' : '#dc3545'};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        z-index: 1000;
      ">
        
        ${isSnapped ? '<div style="position: absolute; top: -5px; right: -5px; width: 12px; height: 12px; background: #00ff00; border-radius: 50%; border: 2px solid white;"></div>' : ''}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

// GPS point marker
const createGPSPointIcon = (isSnapped = false) => {
  return L.divIcon({
    className: "gps-point",
    html: `
      <div style="
        width: 8px;
        height: 8px;
        background: ${isSnapped ? '#28a745' : '#dc3545'};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

function RouteFollowingExample() {
  const mapRef = useRef(null);
  const routeServiceRef = useRef(null);
  const gpsSimulationRef = useRef(null);

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [routeProgress, setRouteProgress] = useState(0);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [snappedPoints, setSnappedPoints] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationMode, setSimulationMode] = useState('snapped'); // 'raw' or 'snapped'

  // Sample OSRM route (Mumbai coordinates)
  const sampleRoute = {
    geometry: {
      coordinates: [
        [72.8777, 19.076], // Start point (Mumbai Central)
        [72.878, 19.077],
        [72.879, 19.078],
        [72.881, 19.080],
        [72.883, 19.082],
        [72.885, 19.085],
        [72.887, 19.088],
        [72.889, 19.091],
        [72.891, 19.094], // End point (Sample destination)
      ]
    }
  };

  // Initialize route following service
  useEffect(() => {
    if (mapRef.current && !routeServiceRef.current) {
      routeServiceRef.current = new RouteFollowingService(mapRef.current, {
        maxSnapDistance: 100, // meters
        gpsAccuracyThreshold: 20, // meters
        enableGPSSnapping: true,
        emergencyPriority: 'HIGH'
      });
      setIsInitialized(true);
      console.log('🚨 Route Following Service initialized');
    }

    return () => {
      if (routeServiceRef.current) {
        routeServiceRef.current.destroy();
      }
    };
  }, []);

  // Register emergency route
  const registerRoute = async () => {
    if (!routeServiceRef.current) return;

    try {
      const result = await routeServiceRef.current.registerEmergencyRoute(
        'emergency-001',
        'ambulance-001',
        sampleRoute,
        {
          vehicleType: 'AMBULANCE',
          priority: 'HIGH',
          estimatedDuration: 300000 // 5 minutes
        }
      );

      if (result.success) {
        setCurrentRoute(result.routeId);
        console.log('✅ Route registered:', result.routeId);
      }
    } catch (error) {
      console.error('❌ Route registration failed:', error);
    }
  };

  // Start emergency response
  const startResponse = () => {
    if (!routeServiceRef.current || !currentRoute) return;

    routeServiceRef.current.startEmergencyResponse(currentRoute, {
      duration: 30000 // 30 seconds for demo
    });

    console.log('🚨 Emergency response started');
  };

  // Simulate GPS updates
  const startGPSSimulation = () => {
    if (!routeServiceRef.current || !currentRoute) return;

    setIsSimulating(true);
    setGpsPoints([]);
    setSnappedPoints([]);

    // Subscribe to GPS updates
    const unsubscribe = routeServiceRef.current.subscribeVehicleGPS(
      currentRoute,
      (lat, lng, accuracy, timestamp) => {
        console.log(`📍 GPS Update: ${lat.toFixed(6)}, ${lng.toFixed(6)} (accuracy: ${accuracy}m)`);
      }
    );

    // Simulate GPS movement along route
    let progress = 0;
    const totalSteps = 100;
    const stepDuration = 300; // ms

    gpsSimulationRef.current = setInterval(() => {
      if (progress >= 1) {
        setIsSimulating(false);
        clearInterval(gpsSimulationRef.current);
        unsubscribe();
        routeServiceRef.current.vehicleArrived(currentRoute);
        return;
      }

      // Calculate position along route
      const routeCoords = sampleRoute.geometry.coordinates;
      const totalPoints = routeCoords.length;
      const currentIndex = Math.floor(progress * (totalPoints - 1));
      const nextIndex = Math.min(currentIndex + 1, totalPoints - 1);
      const segmentProgress = (progress * (totalPoints - 1)) - currentIndex;

      const startCoord = routeCoords[currentIndex];
      const endCoord = routeCoords[nextIndex];

      // Interpolate position
      const lat = startCoord[1] + (endCoord[1] - startCoord[1]) * segmentProgress;
      const lng = startCoord[0] + (endCoord[0] - startCoord[0]) * segmentProgress;

      // Add GPS noise based on simulation mode
      let gpsLat = lat;
      let gpsLng = lng;
      let accuracy = 5; // Good GPS accuracy

      if (simulationMode === 'raw') {
        // Add realistic GPS noise and occasional jumps
        const noise = 0.001; // ~100m noise
        gpsLat += (Math.random() - 0.5) * noise;
        gpsLng += (Math.random() - 0.5) * noise;
        accuracy = 15 + Math.random() * 20; // 15-35m accuracy

        // Occasional GPS jumps (simulating signal loss)
        if (Math.random() < 0.05) {
          gpsLat += (Math.random() - 0.5) * 0.005;
          gpsLng += (Math.random() - 0.5) * 0.005;
          accuracy = 50 + Math.random() * 50;
        }
      }

      // Create GPS data point
      const gpsPoint = {
        lat: gpsLat,
        lng: gpsLng,
        accuracy,
        timestamp: Date.now(),
        isSnapped: simulationMode === 'snapped'
      };

      setGpsPoints(prev => [...prev.slice(-50), gpsPoint]); // Keep last 50 points

      // Simulate GPS callback
      if (simulationMode === 'snapped') {
        // GPS snapping handled automatically by RouteFollowingService
        routeServiceRef.current.updateFromGPS(currentRoute, gpsLat, gpsLng, {
          accuracy,
          timestamp: gpsPoint.timestamp
        });
      } else {
        // Manual progress update for raw GPS mode
        routeServiceRef.current.updateVehicleProgress(currentRoute, progress);
      }

      // Update progress for next iteration
      progress += 1 / totalSteps;
      setRouteProgress(progress);

    }, stepDuration);

    // Cleanup function
    return () => {
      if (gpsSimulationRef.current) {
        clearInterval(gpsSimulationRef.current);
      }
      unsubscribe();
    };
  };

  // Stop simulation
  const stopSimulation = () => {
    setIsSimulating(false);
    if (gpsSimulationRef.current) {
      clearInterval(gpsSimulationRef.current);
    }
  };

  // Get route status
  const getRouteStatus = () => {
    if (!routeServiceRef.current || !currentRoute) return null;
    return routeServiceRef.current.getEmergencyStatus(currentRoute);
  };

  const status = getRouteStatus();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Control Panel */}
      <div style={{
        padding: '10px',
        background: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={registerRoute}
          disabled={!isInitialized}
          style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Register Route
        </button>

        <button
          onClick={startResponse}
          disabled={!currentRoute}
          style={{ padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Start Response
        </button>

        <select
          value={simulationMode}
          onChange={(e) => setSimulationMode(e.target.value)}
          style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
        >
          <option value="snapped">GPS Snapping (Recommended)</option>
          <option value="raw">Raw GPS (Noisy)</option>
        </select>

        <button
          onClick={isSimulating ? stopSimulation : startGPSSimulation}
          disabled={!currentRoute}
          style={{
            padding: '8px 16px',
            background: isSimulating ? '#dc3545' : '#ffc107',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {isSimulating ? 'Stop GPS Simulation' : 'Start GPS Simulation'}
        </button>

        {status && (
          <div style={{ marginLeft: '20px', fontSize: '14px' }}>
            <strong>Status:</strong> {status.status} |
            <strong> Progress:</strong> {(status.progress * 100).toFixed(1)}% |
            <strong> GPS:</strong> {status.isGPSActive ? 'Active' : 'Inactive'}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          ref={mapRef}
          center={[19.076, 72.8777]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Route Polyline */}
          {sampleRoute.geometry.coordinates.length > 1 && (
            <L.Polyline
              positions={sampleRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
              pathOptions={{
                color: '#007bff',
                weight: 4,
                opacity: 0.8,
                dashArray: '5 10'
              }}
            />
          )}

          {/* GPS Points (Raw GPS) */}
          {gpsPoints.map((point, index) => (
            <Marker
              key={`gps-${index}`}
              position={[point.lat, point.lng]}
              icon={createGPSPointIcon(point.isSnapped)}
            >
              <L.Popup>
                <div>
                  <strong>GPS Point</strong><br/>
                  Lat: {point.lat.toFixed(6)}<br/>
                  Lng: {point.lng.toFixed(6)}<br/>
                  Accuracy: {point.accuracy.toFixed(1)}m<br/>
                  Mode: {point.isSnapped ? 'Snapped' : 'Raw'}
                </div>
              </L.Popup>
            </Marker>
          ))}

          {/* Start Point */}
          <Marker
            position={[sampleRoute.geometry.coordinates[0][1], sampleRoute.geometry.coordinates[0][0]]}
            icon={L.divIcon({
              className: "start-marker",
              html: '<div style="width: 20px; height: 20px; background: #28a745; border: 3px solid white; border-radius: 50%;"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          >
            <L.Popup>🚩 Start Location</L.Popup>
          </Marker>

          {/* End Point */}
          <Marker
            position={[
              sampleRoute.geometry.coordinates[sampleRoute.geometry.coordinates.length - 1][1],
              sampleRoute.geometry.coordinates[sampleRoute.geometry.coordinates.length - 1][0]
            ]}
            icon={L.divIcon({
              className: "end-marker",
              html: '<div style="width: 20px; height: 20px; background: #dc3545; border: 3px solid white; border-radius: 50%;"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          >
            <L.Popup>🎯 Emergency Location</L.Popup>
          </Marker>
        </MapContainer>

        {/* Legend */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'white',
          padding: '10px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          fontSize: '12px',
          zIndex: 1000
        }}>
          <strong>Legend</strong><br/>
          <div style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
            <div style={{ width: '12px', height: '12px', background: '#28a745', borderRadius: '50%', marginRight: '5px' }}></div>
            GPS Snapped (Accurate)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
            <div style={{ width: '12px', height: '12px', background: '#dc3545', borderRadius: '50%', marginRight: '5px' }}></div>
            Raw GPS (Noisy)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
            <div style={{ width: '4px', height: '12px', background: '#007bff', marginRight: '5px' }}></div>
            Planned Route
          </div>
        </div>

        {/* Info Panel */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          fontSize: '14px',
          maxWidth: '400px',
          zIndex: 1000
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Route Following Demo</h4>

          <div style={{ marginBottom: '10px' }}>
            <strong>Why GPS Snapping Matters:</strong>
          </div>

          <ul style={{ margin: '0 0 10px 0', paddingLeft: '20px' }}>
            <li><strong>Raw GPS:</strong> Jumps around, goes off-route, poor accuracy</li>
            <li><strong>GPS Snapping:</strong> Smooth movement along planned route</li>
            <li><strong>Emergency Response:</strong> Predictable, reliable vehicle tracking</li>
          </ul>

          <div style={{ fontSize: '12px', color: '#666' }}>
            <strong>Current Mode:</strong> {simulationMode === 'snapped' ? 'GPS Snapping Active' : 'Raw GPS (Demonstrates Problems)'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RouteFollowingExample;
