import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import io from 'socket.io-client';
import api from '../api';

// WebSocket URL
const SOCKET_URL = 'http://127.0.0.1:5001';

// Socket connection
let socket = null;

// Default icons for different unit types
const createUnitIcon = (serviceType, status = 'AVAILABLE') => {
  const colorMap = {
    'AMBULANCE': 'red',
    'POLICE': 'blue', 
    'FIRE_TRUCK': 'orange',
    'DEFAULT': 'green'
  };
  
  const color = colorMap[serviceType?.toUpperCase()] || colorMap.DEFAULT;
  const statusColor = status === 'ON_DUTY' ? color : 'gray';
  
  return new Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${statusColor}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Real-time map component
const RealTimeMap = ({ 
  selectedUnits = [], 
  showRoutes = true, 
  center = [40.7128, -74.0060], 
  zoom = 12,
  onUnitSelect = () => {},
  height = "600px"
}) => {
  const mapRef = useRef();
  const [units, setUnits] = useState([]);
  const [unitLocations, setUnitLocations] = useState(new Map());
  const [activeRoutes, setActiveRoutes] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState(null);

  // Fetch initial unit data
  const fetchUnits = useCallback(async () => {
    try {
      const response = await api.get('/api/units');
      setUnits(response.data.units || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch units:', error);
      setLoading(false);
    }
  }, []);

  // Fetch unit locations
  const fetchUnitLocations = useCallback(async () => {
    try {
      const response = await api.get('/api/location/units/all');
      
      const locationMap = new Map();
      response.data.units?.forEach(unit => {
        locationMap.set(unit.unit_id, {
          ...unit.location,
          service_type: unit.service_type,
          status: unit.status
        });
      });
      
      setUnitLocations(locationMap);
    } catch (error) {
      console.error('Failed to fetch unit locations:', error);
    }
  }, []);

  // Calculate route for a unit
  const calculateRoute = useCallback(async (unitId, destination) => {
    try {
      const response = await api.post('/api/route/calculate', {
        unit_id: unitId,
        end_latitude: destination.lat,
        end_longitude: destination.lng,
        profile: 'driving'
      });
      
      if (response.status === 200) {
        setActiveRoutes(prev => new Map(prev).set(unitId, response.data));
        return response.data;
      } else {
        console.error('Route calculation failed:', response.data.error);
        return null;
      }
    } catch (error) {
      console.error('Failed to calculate route:', error);
      return null;
    }
  }, []);

  // Handle unit marker click
  const handleUnitClick = useCallback((unit) => {
    setSelectedUnit(unit);
    onUnitSelect(unit);
    
    // Center map on unit
    const location = unitLocations.get(unit.unit_id);
    if (location && mapRef.current) {
      mapRef.current.setView([location.latitude, location.longitude], 15);
    }
  }, [unitLocations, onUnitSelect]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!socket) {
      socket = io(SOCKET_URL, {
        transports: ['websocket'],
        autoConnect: true
      });

      socket.on('connect', () => {
        console.log('Connected to real-time map WebSocket');
        setIsConnected(true);
        
        // Join tracking room
        socket.emit('join_tracking_room');
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from real-time map WebSocket');
        setIsConnected(false);
      });

      socket.on('location_update', (data) => {
        console.log('Location update received:', data);
        
        setUnitLocations(prev => {
          const newMap = new Map(prev);
          const unit = units.find(u => u.unit_id === data.unit_id);
          if (unit) {
            newMap.set(data.unit_id, {
              latitude: data.latitude,
              longitude: data.longitude,
              accuracy: data.accuracy,
              speed: data.speed,
              heading: data.heading,
              timestamp: data.timestamp,
              service_type: unit.service_type,
              status: unit.status
            });
          }
          return newMap;
        });
      });

      socket.on('unit_location_update', (data) => {
        console.log('Unit location update received:', data);
        
        setUnitLocations(prev => {
          const newMap = new Map(prev);
          const unit = units.find(u => u.unit_id === data.unit_id);
          if (unit) {
            newMap.set(data.unit_id, {
              latitude: data.latitude,
              longitude: data.longitude,
              timestamp: data.timestamp,
              service_type: unit.service_type,
              status: unit.status
            });
          }
          return newMap;
        });
      });
    }

    return () => {
      if (socket) {
        socket.emit('leave_tracking_room');
        socket.disconnect();
        socket = null;
      }
    };
  }, [units]);

  // Initial data loading
  useEffect(() => {
    fetchUnits();
    fetchUnitLocations();
    
    // Refresh locations every 30 seconds
    const interval = setInterval(fetchUnitLocations, 30000);
    
    return () => clearInterval(interval);
  }, [fetchUnits, fetchUnitLocations]);

  // Component to handle map instance
  const MapUpdater = ({ center, zoom }) => {
    const map = useMap();
    
    useEffect(() => {
      map.setView(center, zoom);
    }, [center, zoom, map]);
    
    return null;
  };

  if (loading) {
    return (
      <div className="realtime-map-loading" style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        border: '1px solid #ddd'
      }}>
        <div>
          <div>🗺️ Loading real-time map...</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Fetching unit locations</div>
        </div>
      </div>
    );
  }

  return (
    <div className="realtime-map-container" style={{ position: 'relative', height }}>
      {/* Map Header */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1000,
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        gap: '10px',
        alignItems: 'center'
      }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: isConnected ? '#4CAF50' : '#f44336'
        }}></div>
        <span style={{ fontSize: '12px' }}>
          {isConnected ? 'Live' : 'Disconnected'}
        </span>
        <span style={{ fontSize: '12px', color: '#666' }}>
          {units.length} units
        </span>
      </div>

      {/* Unit Selection Panel */}
      {units.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          backgroundColor: 'white',
          padding: '10px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '200px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
            Units ({units.length})
          </div>
          {units.map(unit => {
            const location = unitLocations.get(unit.unit_id);
            const isSelected = selectedUnit?.unit_id === unit.unit_id;
            
            return (
              <div
                key={unit.unit_id}
                onClick={() => handleUnitClick(unit)}
                style={{
                  padding: '8px',
                  marginBottom: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                  border: `1px solid ${isSelected ? '#2196F3' : '#ddd'}`,
                  fontSize: '12px'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>
                  Unit {unit.unit_id}
                </div>
                <div style={{ color: '#666' }}>
                  {unit.service_type}
                </div>
                {location && (
                  <div style={{ fontSize: '10px', color: '#999' }}>
                    Last: {new Date(location.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapUpdater center={center} zoom={zoom} />
        
        {/* Unit Markers */}
        {units.map(unit => {
          const location = unitLocations.get(unit.unit_id);
          if (!location) return null;

          return (
            <Marker
              key={unit.unit_id}
              position={[location.latitude, location.longitude]}
              icon={createUnitIcon(unit.service_type, unit.status)}
              eventHandlers={{
                click: () => handleUnitClick(unit)
              }}
            >
              <Popup>
                <div>
                  <strong>Unit {unit.unit_id}</strong><br />
                  Type: {unit.service_type}<br />
                  Status: {unit.status}<br />
                  Speed: {location.speed || 0} km/h<br />
                  Accuracy: {location.accuracy || 'N/A'}m<br />
                  Updated: {new Date(location.timestamp).toLocaleString()}
                  
                  {selectedUnit?.unit_id === unit.unit_id && (
                    <div style={{ marginTop: '8px', fontSize: '12px' }}>
                      <button
                        onClick={() => {
                          // Calculate route to center of map
                          const map = mapRef.current;
                          if (map) {
                            const center = map.getCenter();
                            calculateRoute(unit.unit_id, {
                              lat: center.lat,
                              lng: center.lng
                            });
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Calculate Route
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        
        {/* Route Polylines */}
        {showRoutes && Array.from(activeRoutes.entries()).map(([unitId, routeData]) => {
  const unit = units.find(u => u.unit_id === unitId);
  if (!unit || !routeData?.route?.positions) return null;

  return (
    <Polyline
      key={`route-${unitId}`}
      positions={routeData.route.positions} // ✅ backend already sends [lat, lng]
      pathOptions={{
        color:
          unit.service_type === 'AMBULANCE'
            ? 'red'
            : unit.service_type === 'FIRE_TRUCK'
            ? 'orange'
            : 'blue',
        weight: 5,
        opacity: 0.85
      }}
    >
      <Popup>
        <div>
          <strong>Route for Unit {unit.unit_id}</strong><br />
          Distance: {(routeData.route.total_distance / 1000).toFixed(1)} km<br />
          ETA: {(routeData.route.estimated_duration / 60).toFixed(0)} min<br />
          Progress: {(routeData.route.progress * 100).toFixed(1)}%<br />
          Type: {unit.service_type}
        </div>
      </Popup>
    </Polyline>
  );
})}

        {/* {showRoutes && Array.from(activeRoutes.entries()).map(([unitId, routeData]) => {
          
          const unit = units.find(u => u.unit_id === unitId);
          if (!unit || !routeData.geometry) return null;

          // Convert GeoJSON to Leaflet coordinates
          let coordinates = [];
          // if (routeData.geometry.type === 'LineString') {
          //   coordinates = routeData.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          // } 
          // if (routeData.geometry.type === 'MultiLineString') {
          //   // Use first line for simplicity
          //   coordinates = routeData.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
          // }

          // if (coordinates.length === 0) return null;

          return (
            <Polyline
              key={`route-${unitId}`}
              positions={coordinates}
              color={unit.service_type === 'AMBULANCE' ? 'red' : 
                     unit.service_type === 'FIRE_TRUCK' ? 'orange' : 'blue'}
              weight={4}
              opacity={0.8}
            >
              <Popup>
                <div>
                  <strong>Route to Unit {unit.unit_id}</strong><br />
                  Distance: {(routeData.distance / 1000).toFixed(1)} km<br />
                  Duration: {(routeData.duration / 60).toFixed(0)} min<br />
                  Type: {unit.service_type}
                </div>
              </Popup>
            </Polyline>
          );
        })} */}
      </MapContainer>
    </div>
  );
};

export default RealTimeMap;

