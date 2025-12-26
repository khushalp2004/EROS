import React, { useState, useEffect, useCallback } from 'react';
import RealTimeMap from '../components/RealTimeMap';
import { locationAPI, unitAPI } from '../api';
import '../styles/design-system.css';

const RealTimeUnitTracking = () => {
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [activeRoutes, setActiveRoutes] = useState([]);
  const [stats, setStats] = useState({
    totalUnits: 0,
    activeUnits: 0,
    lastUpdate: null
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // NYC default
  const [loading, setLoading] = useState(false);

  // Fetch units data
  const fetchUnits = useCallback(async () => {
    try {
      const response = await unitAPI.getUnits();
      setUnits(response.data.units || []);
      setStats(prev => ({
        ...prev,
        totalUnits: response.data.units?.length || 0,
        activeUnits: response.data.units?.filter(u => u.status === 'ON_DUTY').length || 0,
        lastUpdate: new Date()
      }));
    } catch (error) {
      console.error('Failed to fetch units:', error);
    }
  }, []);

  // Fetch location history for selected unit
  const fetchLocationHistory = useCallback(async (unitId) => {
    if (!unitId) return;
    
    try {
      const response = await locationAPI.getLocationHistory(unitId, {
        limit: 50,
        hours: 24
      });
      setLocationHistory(response.data.history || []);
    } catch (error) {
      console.error('Failed to fetch location history:', error);
    }
  }, []);

  // Fetch active routes for selected unit
  const fetchActiveRoutes = useCallback(async (unitId) => {
    if (!unitId) return;
    
    try {
      const response = await locationAPI.getActiveRoutes(unitId);
      setActiveRoutes(response.data.routes || []);
    } catch (error) {
      console.error('Failed to fetch active routes:', error);
    }
  }, []);

  // Update unit location (simulated GPS update)
  const updateUnitLocation = useCallback(async (unitId, location) => {
    try {
      const response = await locationAPI.updateLocation({
        unit_id: unitId,
        latitude: location.lat,
        longitude: location.lng,
        accuracy: location.accuracy || 5,
        speed: location.speed || 0,
        heading: location.heading || 0,
        session_id: `session_${Date.now()}`
      });
      
      console.log('Location updated:', response.data);
      
      // Refresh units to get updated positions
      fetchUnits();
      
      return response.data;
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  }, [fetchUnits]);

  // Handle unit selection
  const handleUnitSelect = useCallback((unit) => {
    setSelectedUnit(unit);
    
    // Fetch detailed data for selected unit
    fetchLocationHistory(unit.unit_id);
    fetchActiveRoutes(unit.unit_id);
  }, [fetchLocationHistory, fetchActiveRoutes]);

  // Simulate GPS updates for demo purposes
  const simulateGPSUpdate = useCallback(() => {
    if (units.length === 0) return;
    
    const randomUnit = units[Math.floor(Math.random() * units.length)];
    
    // Generate random nearby location (within ~1km)
    const baseLat = 40.7128;
    const baseLng = -74.0060;
    const latOffset = (Math.random() - 0.5) * 0.02; // ~2km range
    const lngOffset = (Math.random() - 0.5) * 0.02;
    
    const newLocation = {
      lat: baseLat + latOffset,
      lng: baseLng + lngOffset,
      accuracy: Math.random() * 10 + 2, // 2-12m accuracy
      speed: Math.random() * 60, // 0-60 km/h
      heading: Math.random() * 360
    };
    
    updateUnitLocation(randomUnit.unit_id, newLocation);
  }, [units, updateUnitLocation]);

  // Auto-refresh data
  useEffect(() => {
    fetchUnits();
    
    // Set up auto-refresh interval
    const interval = setInterval(fetchUnits, 10000); // Every 10 seconds
    
    return () => clearInterval(interval);
  }, [fetchUnits]);

  // Set up simulated GPS updates for demo
  useEffect(() => {
    const gpsInterval = setInterval(simulateGPSUpdate, 5000); // Every 5 seconds
    return () => clearInterval(gpsInterval);
  }, [simulateGPSUpdate]);

  return (
    <div className="realtime-unit-tracking-page" style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      {/* Header */}
      <div className="page-header" style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>
          🚨 Real-Time Unit Tracking
        </h1>
        <p style={{ margin: '8px 0 0 0', color: '#666' }}>
          Live tracking with OSRM route calculation and WebSocket updates
        </p>
      </div>

      {/* Stats Dashboard */}
      <div className="stats-dashboard" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div className="stat-card" style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', color: '#2196F3' }}>
            📍
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>
            {stats.totalUnits}
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>
            Total Units
          </div>
        </div>

        <div className="stat-card" style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', color: '#4CAF50' }}>
            ✅
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>
            {stats.activeUnits}
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>
            Active Units
          </div>
        </div>

        <div className="stat-card" style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', color: '#FF9800' }}>
            🗺️
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>
            {activeRoutes.length}
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>
            Active Routes
          </div>
        </div>

        <div className="stat-card" style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', color: '#9C27B0' }}>
            🕐
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>
            {stats.lastUpdate ? stats.lastUpdate.toLocaleTimeString() : 'Never'}
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>
            Last Update
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: '20px',
        minHeight: '600px'
      }}>
        {/* Map */}
        <div className="map-section">
          <RealTimeMap
            selectedUnits={selectedUnit ? [selectedUnit] : []}
            showRoutes={showRoutes}
            center={mapCenter}
            zoom={12}
            onUnitSelect={handleUnitSelect}
            height="600px"
          />
        </div>

        {/* Control Panel */}
        <div className="control-panel" style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          padding: '20px',
          height: 'fit-content'
        }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>
            🎛️ Control Panel
          </h3>

          {/* Controls */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={showRoutes}
                  onChange={(e) => setShowRoutes(e.target.checked)}
                />
                Show Routes
              </label>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <button
                onClick={simulateGPSUpdate}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                📍 Simulate GPS Update
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <button
                onClick={fetchUnits}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                🔄 Refresh Data
              </button>
            </div>
          </div>

          {/* Selected Unit Details */}
          {selectedUnit && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <h4 style={{ marginTop: 0, color: '#333' }}>
                📋 Selected Unit Details
              </h4>
              
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <div><strong>Unit ID:</strong> {selectedUnit.unit_id}</div>
                <div><strong>Type:</strong> {selectedUnit.service_type}</div>
                <div><strong>Status:</strong> 
                  <span style={{ 
                    color: selectedUnit.status === 'ON_DUTY' ? '#4CAF50' : '#666',
                    fontWeight: 'bold'
                  }}>
                    {' '}{selectedUnit.status}
                  </span>
                </div>
                <div><strong>Last Updated:</strong> {selectedUnit.last_updated}</div>
              </div>

              {/* Location History */}
              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    width: '100%'
                  }}
                >
                  📈 {showHistory ? 'Hide' : 'Show'} Location History
                </button>

                {showHistory && (
                  <div style={{
                    marginTop: '8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontSize: '12px'
                  }}>
                    {locationHistory.length > 0 ? (
                      locationHistory.slice(0, 10).map((location, index) => (
                        <div key={index} style={{
                          padding: '4px',
                          borderBottom: '1px solid #eee'
                        }}>
                          <div>{new Date(location.timestamp).toLocaleTimeString()}</div>
                          <div style={{ color: '#666' }}>
                            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                          </div>
                          {location.speed && (
                            <div style={{ color: '#666' }}>
                              Speed: {location.speed.toFixed(1)} km/h
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#666', fontStyle: 'italic' }}>
                        No location history available
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OSRM Route Demo */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: '20px', marginTop: '20px' }}>
            <h4 style={{ marginTop: 0, color: '#333' }}>
              🗺️ OSRM Route Demo
            </h4>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
              Click "Calculate Route" on any unit marker to see OSRM routing in action!
            </p>
            <div style={{ fontSize: '12px', color: '#666' }}>
              ✨ Features:
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Real road network routing</li>
                <li>Distance & duration calculation</li>
                <li>Multiple transportation profiles</li>
                <li>Turn-by-turn directions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        textAlign: 'center',
        color: '#666',
        fontSize: '14px'
      }}>
        <div>
          🚨 Emergency Response System | Real-Time Tracking with OSRM Routing
        </div>
        <div style={{ marginTop: '8px', fontSize: '12px' }}>
          Database-driven location storage | WebSocket real-time updates | Professional map visualization
        </div>
      </div>
    </div>
  );
};

export default RealTimeUnitTracking;

