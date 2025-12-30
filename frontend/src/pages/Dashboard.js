import React, { useEffect, useState } from "react";
import api from "../api";
import RealtimeMapView from "../components/RealtimeMapView";
import EmergencyList from "../components/EmergencyList";
import { useWebSocketManager } from "../hooks/useWebSocketManager";
import backendRouteManager from "../utils/BackendRouteManager";
import { fetchRoute } from "../services/routeService";
import "../styles/dashboard-styles.css";

function Dashboard() {
  const [units, setUnits] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [showUnitMarkers, setShowUnitMarkers] = useState(false);
  
  // WebSocket connection for real-time updates
  const { isConnected: wsConnected } = useWebSocketManager();

  const showToast = (message, type = "info", duration = 3000) => {
    setToast({ message, type });
    if (duration) {
      setTimeout(() => setToast(null), duration);
    }
  };

  const centerMapOnLocation = (latitude, longitude) => {
    setMapCenter([latitude, longitude]);
  };

  const handleClearSelection = () => {
    setSelectedEmergency(null);
    setMapCenter(null);
  };

  // Route fetching functions - Show complete routes without progress tracking
  const fetchRoutesForEmergency = async (emergency) => {
    if (!emergency) {
      setRoutes([]);
      return;
    }

    try {
      setRoutesLoading(true);
      const routesData = [];

      // If emergency is assigned to a unit, show the complete route
      if (emergency.assigned_unit && emergency.latitude && emergency.longitude) {
        const assignedUnit = units.find(unit => unit.unit_id === emergency.assigned_unit);
        
        if (assignedUnit && assignedUnit.latitude && assignedUnit.longitude) {
          // Try to get backend-driven route first
          const backendRoute = backendRouteManager.getRouteData(emergency.assigned_unit);
          
          if (backendRoute && backendRoute.route && backendRoute.route.positions) {
            // Use backend-calculated route - show complete route
            routesData.push({
              id: `backend-${emergency.assigned_unit}-${emergency.request_id}`,
              positions: backendRoute.route.positions,
              color: assignedUnit.service_type === 'AMBULANCE' ? '#dc3545' : 
                     assignedUnit.service_type === 'FIRE_TRUCK' ? '#fd7e14' : '#007bff',
              unitId: emergency.assigned_unit,
              emergencyId: emergency.request_id,
              serviceType: assignedUnit.service_type,
              isRealtime: true,
              isAnimated: false,
              estimatedDuration: backendRoute.route.estimated_duration,
              elapsedSeconds: backendRoute.route.elapsed_seconds
            });
          } else {
            // Generate route using routeService
            try {
              const start = [assignedUnit.latitude, assignedUnit.longitude];
              const end = [emergency.latitude, emergency.longitude];
              const positions = await fetchRoute(start, end);
              
              if (positions && positions.length > 1) {
                routesData.push({
                  id: `generated-${emergency.assigned_unit}-${emergency.request_id}`,
                  positions: positions,
                  color: assignedUnit.service_type === 'AMBULANCE' ? '#dc3545' : 
                         assignedUnit.service_type === 'FIRE_TRUCK' ? '#fd7e14' : '#007bff',
                  unitId: emergency.assigned_unit,
                  emergencyId: emergency.request_id,
                  serviceType: assignedUnit.service_type,
                  isRealtime: false,
                  isAnimated: false
                });
              }
            } catch (routeError) {
              console.warn('Failed to generate route:', routeError);
              // Create a simple straight line as fallback
              const straightLine = [
                [assignedUnit.latitude, assignedUnit.longitude],
                [emergency.latitude, emergency.longitude]
              ];
              
              routesData.push({
                id: `fallback-${emergency.assigned_unit}-${emergency.request_id}`,
                positions: straightLine,
                color: "#ffc107",
                unitId: emergency.assigned_unit,
                emergencyId: emergency.request_id,
                serviceType: assignedUnit.service_type,
                isRealtime: false,
                isAnimated: false
              });
            }
          }
        }
      }

      // Fetch all active routes from backend - show complete routes
      try {
        await backendRouteManager.fetchActiveRoutes();
        const activeRoutes = backendRouteManager.getAllActiveRoutes();
        
        activeRoutes.forEach(routeData => {
          if (routeData.route && routeData.route.positions) {
            const unit = units.find(u => u.unit_id === routeData.unit_id);
            const emergency = emergencies.find(e => e.request_id === routeData.emergency_id);
            
            if (unit && emergency && routeData.route.positions.length > 1) {
              routesData.push({
                id: `active-${routeData.unit_id}-${routeData.emergency_id}`,
                positions: routeData.route.positions,
                color: unit.service_type === 'AMBULANCE' ? '#dc3545' : 
                       unit.service_type === 'FIRE_TRUCK' ? '#fd7e14' : '#007bff',
                unitId: routeData.unit_id,
                emergencyId: routeData.emergency_id,
                serviceType: unit.service_type,
                isRealtime: true,
                isAnimated: false,
                estimatedDuration: routeData.route.estimated_duration,
                elapsedSeconds: routeData.route.elapsed_seconds
              });
            }
          }
        });
      } catch (backendError) {
        console.warn('Failed to fetch backend routes:', backendError);
      }

      setRoutes(routesData);
    } catch (error) {
      console.error('Error fetching routes:', error);
      showToast('Failed to load route information', 'error');
      setRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  };

  // Start backend route updates
  useEffect(() => {
    backendRouteManager.startAutoUpdates(3000); // Update every 3 seconds
    return () => {
      backendRouteManager.stopAutoUpdates();
    };
  }, []);

  // Update routes when selected emergency changes
  useEffect(() => {
    if (selectedEmergency) {
      fetchRoutesForEmergency(selectedEmergency);
    } else {
      setRoutes([]);
    }
  }, [selectedEmergency, units, emergencies]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Use public API endpoints that don't require authority role
      const [unitsResponse, emergenciesResponse] = await Promise.all([
        api.get("/api/units"),
        api.get("/api/emergencies"),
      ]);
      
      const unitsData = unitsResponse.data || [];
      const emergenciesData = emergenciesResponse.data || [];
      
      setUnits(unitsData);
      setEmergencies(emergenciesData);
      
      // Show toast if no units found
      if (unitsData.length === 0) {
        showToast("No units available - add units to track emergencies", "info");
      }
      
    } catch (error) {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter emergencies by status
  const pendingEmergencies = emergencies.filter(e => e.status === 'PENDING');
  const activeEmergencies = emergencies.filter(e => ['APPROVED', 'ASSIGNED'].includes(e.status));
  const completedEmergencies = emergencies.filter(e => e.status === 'COMPLETED');
  
  // Unit status counts
  const availableUnits = units.filter(u => u.status === 'AVAILABLE');
  const busyUnits = units.filter(u => ['DISPATCHED', 'ENROUTE'].includes(u.status));

  // Case-insensitive service type filtering with fallback
  const getAvailableUnitsByType = (emergencyType) => {
    const normalizedType = emergencyType.toUpperCase().replace(' ', '_');
    return availableUnits.filter(u => 
      u.service_type && u.service_type.toUpperCase() === normalizedType
    ).length;
  };



  // Filter map markers based on selection - NO unit markers, emergency filtering only
  const mapMarkers = React.useMemo(() => {
    const markers = [];
    
    if (selectedEmergency) {
      // Show only selected emergency + its assigned unit (if any)
      if (selectedEmergency.latitude && selectedEmergency.longitude) {
        markers.push({
          ...selectedEmergency,
          type: 'emergency',
          isSimulated: true
        });
      }
      
      // Add assigned unit if it exists and has coordinates
      if (selectedEmergency.assigned_unit) {
        const assignedUnit = units.find(unit => unit.unit_id === selectedEmergency.assigned_unit);
        if (assignedUnit && assignedUnit.latitude && assignedUnit.longitude) {
          markers.push({
            ...assignedUnit,
            type: 'unit',
            isRealtime: true
          });
        }
      }
    } else {
      // No selection: show all emergencies only (NO unit markers)
      // Use 'emergencies' instead of 'activeEmergencies' to ensure we show all available emergencies
      emergencies.forEach(emergency => {
        if (emergency.latitude && emergency.longitude) {
          markers.push({
            ...emergency,
            type: 'emergency',
            isSimulated: true
          });
        }
      });
    }
    
    return markers;
  }, [units, emergencies, selectedEmergency]);

  const handleDispatch = async (emergency) => {
    try {
      // Find the assigned unit to get vehicle number
      const assignedUnit = units.find(unit => unit.unit_id === emergency.assigned_unit);
      const vehicleNumber = assignedUnit?.unit_vehicle_number || `Unit ${emergency.assigned_unit}`;
      
      await api.post(`/api/authority/dispatch/${emergency.request_id}`);
      showToast(`Unit ${vehicleNumber} is dispatched`, "success");
      await fetchData();
    } catch (error) {
      console.error("Dispatch error:", error);
      const msg = error?.response?.data?.error || "No ambulance available for this emergency (within 50 km).";
      showToast(msg, "error");
    }
  };

  const handleComplete = async (emergency) => {
    try {
      await api.post(`/api/authority/complete/${emergency.request_id}`);
      showToast("Mark as done", "success");
      await fetchData();
    } catch (error) {
      showToast("Failed to complete emergency", "error");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'AVAILABLE': '#28a745',
      'ENROUTE': '#007bff',
      'ARRIVED': '#ffc107',
      'DISPATCHED': '#17a2b8',
      'BUSY': '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`dashboard-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <h1 className="dashboard-title">
            🚨 Emergency Dashboard
          </h1>
          <p className="dashboard-subtitle">
            Real-time emergency response management
          </p>
        </div>
      </div>

      <div className="dashboard-main">
        {/* Status Cards */}
        <div className="dashboard-stats-grid-balanced">
          <div className="dashboard-stat-card-balanced pending">
            <div className="dashboard-stat-icon">🚨</div>
            <div className="dashboard-stat-value">
              {pendingEmergencies.length}
            </div>
            <div className="dashboard-stat-label">Pending Emergencies</div>
          </div>

          <div className="dashboard-stat-card-balanced active">
            <div className="dashboard-stat-icon">🚑</div>
            <div className="dashboard-stat-value">
              {activeEmergencies.length}
            </div>
            <div className="dashboard-stat-label">Active Emergencies</div>
          </div>

          <div className="dashboard-stat-card-balanced available">
            <div className="dashboard-stat-icon">✅</div>
            <div className="dashboard-stat-value">
              {availableUnits.length}
            </div>
            <div className="dashboard-stat-label">Available Units</div>
          </div>

          <div className={`dashboard-stat-card-balanced status ${wsConnected ? 'connected' : 'disconnected'}`}>
            <div className="dashboard-stat-icon">{wsConnected ? '🟢' : '🔴'}</div>
            <div className="dashboard-stat-value">
              {wsConnected ? 'ONLINE' : 'OFFLINE'}
            </div>
            <div className="dashboard-stat-label">System Status</div>
          </div>
        </div>



        {/* Main Content */}
        <div className="dashboard-content-grid">
          {/* Map Section */}
          <div className="dashboard-map-section">
            <div className="dashboard-map-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="dashboard-map-title">
                  🗺️ Emergency Map
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'var(--space-1)',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={showUnitMarkers}
                      onChange={(e) => setShowUnitMarkers(e.target.checked)}
                      style={{ transform: 'scale(1.1)' }}
                    />
                    <span>👥 Show Unit Markers</span>
                  </label>
                </div>
              </div>
              {selectedEmergency && (
                <div style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--primary-blue)',
                  fontWeight: 'var(--font-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-1)'
                }}>
                  <span>🎯 Showing:</span>
                  <span>Emergency #{selectedEmergency.request_id}</span>
                  {selectedEmergency.assigned_unit && (
                    <span style={{ color: 'var(--secondary-green)' }}>
                      + Unit {selectedEmergency.assigned_unit}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="dashboard-map-container">
              {routesLoading && (
                <div className="route-loading-indicator">
                  <div className="route-loading-spinner"></div>
                  <span>Loading route information...</span>
                </div>
              )}
              <RealtimeMapView
                markers={mapMarkers}
                center={mapCenter}
                polylines={routes}
                showRealtimeData={true}
                animateRoutes={true}
                showUnitMarkers={showUnitMarkers}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-actions-section">
            <h3 className="dashboard-actions-title">
              ⚡ Quick Actions
            </h3>
            
            <div className="dashboard-actions-grid">
              <button
                onClick={() => {
                  if (pendingEmergencies.length > 0) {
                    handleDispatch(pendingEmergencies[0]);
                  } else {
                    showToast('No pending emergencies', 'info');
                  }
                }}
                disabled={pendingEmergencies.length === 0}
                className="dashboard-btn dashboard-btn-primary"
              >
                🚨 Dispatch Emergency
              </button>

              <button
                onClick={() => fetchData()}
                className="dashboard-btn dashboard-btn-secondary"
              >
                🔄 Refresh Data
              </button>

              <button
                onClick={() => showToast('Emergency broadcast sent', 'success')}
                className="dashboard-btn dashboard-btn-warning"
              >
                📢 Send Alert
              </button>
            </div>

            {/* Unit Status Summary */}
            <div className="dashboard-actions-summary">
              <h4 className="dashboard-summary-title">
                📊 Unit Status
              </h4>
              <div className="dashboard-summary-grid">
                <div className="dashboard-summary-row">
                  <span className="dashboard-summary-label">Available:</span>
                  <span className="dashboard-summary-value available">
                    {availableUnits.length}
                  </span>
                </div>
                <div className="dashboard-summary-row">
                  <span className="dashboard-summary-label">Busy:</span>
                  <span className="dashboard-summary-value busy">
                    {busyUnits.length}
                  </span>
                </div>
                <div className="dashboard-summary-row">
                  <span className="dashboard-summary-label">Total:</span>
                  <span className="dashboard-summary-value">
                    {units.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency List */}
        <div className="dashboard-emergency-section">
          <div className="dashboard-emergency-header">
            <h3 className="dashboard-emergency-title">
              📋 Emergency Management
            </h3>
            <span className="dashboard-emergency-count">
              {emergencies.length} total emergencies
            </span>
          </div>
          
          <EmergencyList
            emergencies={emergencies}
            onSelect={setSelectedEmergency}
            onCenterMap={centerMapOnLocation}
            selectedId={selectedEmergency?.request_id}
            onDispatch={handleDispatch}
            onComplete={handleComplete}
            availableByType={{
              'AMBULANCE': getAvailableUnitsByType('AMBULANCE'),
              'FIRE_TRUCK': getAvailableUnitsByType('FIRE_TRUCK'),
              'POLICE': getAvailableUnitsByType('POLICE')
            }}
          />
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="dashboard-loading">
            <div className="dashboard-spinner"></div>
            <span>Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
