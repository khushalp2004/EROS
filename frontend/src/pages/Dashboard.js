import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import RealtimeMapView from "../components/RealtimeMapView";
import EmergencyList from "../components/EmergencyList";
import Breadcrumbs from "../components/Breadcrumbs";
import { useWebSocketManager } from "../hooks/useWebSocketManager";
import backendRouteManager from "../utils/BackendRouteManager";
import { fetchRoute } from "../services/routeService";
import "../styles/dashboard-styles.css";

function Dashboard() {
  const [units, setUnits] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [tableEmergencies, setTableEmergencies] = useState([]);
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [showUnitMarkers, setShowUnitMarkers] = useState(false);
  const [dispatchBlockInfo, setDispatchBlockInfo] = useState(null);
  const [dispatchingEmergencyId, setDispatchingEmergencyId] = useState(null);
  const [filters, setFilters] = useState({
    status: "ALL",
    type: "ALL",
    query: "",
  });
  const [emergenciesPage, setEmergenciesPage] = useState(1);
  const [emergenciesPerPage] = useState(10);
  const [emergenciesTotal, setEmergenciesTotal] = useState(0);
  const [emergenciesTotalPages, setEmergenciesTotalPages] = useState(1);
  
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

  const fetchData = async (page = 1) => {
    try {
      setLoading(true);
      // Use public API endpoints that don't require authority role.
      // Keep full emergencies for dashboard map/stats and paginated emergencies for table rendering.
      const [unitsResponse, emergenciesResponse, pagedEmergenciesResponse] = await Promise.all([
        api.get("/api/units"),
        api.get("/api/emergencies"),
        api.get("/api/emergencies", {
          params: { page, per_page: emergenciesPerPage }
        }),
      ]);
      
      const unitsData = unitsResponse.data || [];
      const emergenciesData = emergenciesResponse.data || [];
      const pagedPayload = pagedEmergenciesResponse.data;
      const isPagedShape = pagedPayload && !Array.isArray(pagedPayload) && Array.isArray(pagedPayload.data);
      const pagedEmergencyRows = isPagedShape ? pagedPayload.data : (Array.isArray(pagedPayload) ? pagedPayload : []);
      const resolvedPage = isPagedShape ? Number(pagedPayload.page || page) : 1;
      
      setUnits(unitsData);
      setEmergencies(emergenciesData);
      setTableEmergencies(pagedEmergencyRows);
      setEmergenciesTotal(isPagedShape ? Number(pagedPayload.total || 0) : pagedEmergencyRows.length);
      setEmergenciesTotalPages(isPagedShape ? Math.max(1, Number(pagedPayload.total_pages || 1)) : 1);
      if (resolvedPage !== emergenciesPage) {
        setEmergenciesPage(resolvedPage);
      }
      
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
    fetchData(emergenciesPage);
  }, [emergenciesPage]);

  // Filter emergencies by status
  const pendingEmergencies = emergencies.filter(e => e.status === 'PENDING');
  const activeEmergencies = emergencies.filter(e => ['APPROVED', 'ASSIGNED'].includes(e.status));
  const completedEmergencies = emergencies.filter(e => e.status === 'COMPLETED');
  
  // Unit status counts
  const availableUnits = units.filter(u => u.status === 'AVAILABLE');
  const busyUnits = units.filter(u => ['DISPATCHED', 'ENROUTE'].includes(u.status));

  const emergencyTypes = useMemo(
    () => ["ALL", ...Array.from(new Set(emergencies.map((e) => e.emergency_type).filter(Boolean)))],
    [emergencies]
  );

  const filteredEmergencies = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return emergencies.filter((emergency) => {
      const statusOk = filters.status === "ALL" || emergency.status === filters.status;
      const typeOk = filters.type === "ALL" || emergency.emergency_type === filters.type;
      const queryOk =
        !query ||
        String(emergency.request_id || "").includes(query) ||
        String(emergency.emergency_type || "").toLowerCase().includes(query) ||
        String(emergency.approved_by || "").toLowerCase().includes(query) ||
        String(emergency.assigned_unit || "").toLowerCase().includes(query);

      return statusOk && typeOk && queryOk;
    });
  }, [emergencies, filters]);

  const filteredTableEmergencies = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return tableEmergencies.filter((emergency) => {
      const statusOk = filters.status === "ALL" || emergency.status === filters.status;
      const typeOk = filters.type === "ALL" || emergency.emergency_type === filters.type;
      const queryOk =
        !query ||
        String(emergency.request_id || "").includes(query) ||
        String(emergency.emergency_type || "").toLowerCase().includes(query) ||
        String(emergency.approved_by || "").toLowerCase().includes(query) ||
        String(emergency.assigned_unit || "").toLowerCase().includes(query);

      return statusOk && typeOk && queryOk;
    });
  }, [tableEmergencies, filters]);

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
      // No selection: show filtered emergencies only (NO unit markers)
      filteredEmergencies.forEach(emergency => {
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
  }, [units, filteredEmergencies, selectedEmergency]);

  const handleDispatch = async (emergency) => {
    try {
      setDispatchingEmergencyId(emergency?.request_id || null);
      showToast(`Dispatching emergency #${emergency?.request_id}...`, "info", 1200);
      // Find the assigned unit to get vehicle number
      const assignedUnit = units.find(unit => unit.unit_id === emergency.assigned_unit);
      const vehicleNumber = assignedUnit?.unit_vehicle_number || `Unit ${emergency.assigned_unit}`;
      
      await api.post(`/api/authority/dispatch/${emergency.request_id}`);
      showToast(`Unit ${vehicleNumber} is dispatched`, "success");
      setDispatchBlockInfo(null);
      await fetchData(emergenciesPage);
    } catch (error) {
      console.error("Dispatch error:", error);
      const responseData = error?.response?.data;
      const isBlockedRouteError = error?.response?.status === 409 && Array.isArray(responseData?.blocking_segment_ids);

      if (isBlockedRouteError) {
        setDispatchBlockInfo({
          emergencyId: emergency?.request_id,
          nearestUnit: responseData?.nearest_unit || null,
          blockingSegmentIds: responseData?.blocking_segment_ids || [],
          message: responseData?.error || "All nearest-unit route alternatives are blocked by simulation."
        });
      }

      const msg = responseData?.error || "No ambulance available for this emergency (within 50 km).";
      showToast(msg, "error");
    } finally {
      setDispatchingEmergencyId(null);
    }
  };

  const handleComplete = async (emergency) => {
    try {
      await api.post(`/api/authority/complete/${emergency.request_id}`);
      showToast("Mark as done", "success");
      await fetchData(emergenciesPage);
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

  const handleNextEmergenciesPage = () => {
    setEmergenciesPage((prev) => Math.min(prev + 1, emergenciesTotalPages));
  };

  const handlePrevEmergenciesPage = () => {
    setEmergenciesPage((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`dashboard-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {dispatchBlockInfo && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2, 6, 23, 0.45)",
          zIndex: 1400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px"
        }}>
          <div style={{
            width: "min(560px, 100%)",
            borderRadius: "14px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            boxShadow: "0 16px 40px rgba(15,23,42,0.28)",
            padding: "16px"
          }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "1.03rem", color: "#0f172a" }}>
              Route Blocked By Simulation
            </h3>
            <p style={{ margin: "0 0 10px 0", color: "#475569", fontSize: "0.9rem" }}>
              {dispatchBlockInfo.message}
            </p>
            <div style={{ display: "grid", gap: "6px", marginBottom: "12px", fontSize: "0.88rem", color: "#1e293b" }}>
              <div><strong>Emergency:</strong> #{dispatchBlockInfo.emergencyId}</div>
              <div>
                <strong>Nearest Unit:</strong>{" "}
                {dispatchBlockInfo.nearestUnit?.unit_vehicle_number
                  ? `${dispatchBlockInfo.nearestUnit.unit_vehicle_number} (ID ${dispatchBlockInfo.nearestUnit.unit_id})`
                  : (dispatchBlockInfo.nearestUnit?.unit_id ? `Unit ${dispatchBlockInfo.nearestUnit.unit_id}` : "N/A")}
              </div>
              <div>
                <strong>Blocking Segment IDs:</strong>{" "}
                {dispatchBlockInfo.blockingSegmentIds.length > 0
                  ? dispatchBlockInfo.blockingSegmentIds.join(", ")
                  : "None returned"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <a
                href="/admin/traffic"
                style={{
                  textDecoration: "none",
                  background: "#2563eb",
                  color: "#fff",
                  border: "1px solid #2563eb",
                  borderRadius: "10px",
                  minHeight: "36px",
                  padding: "0 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  fontWeight: 700,
                  fontSize: "0.82rem"
                }}
              >
                Open Traffic Simulation
              </a>
              <button
                type="button"
                onClick={() => setDispatchBlockInfo(null)}
                style={{
                  background: "#f8fafc",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  minHeight: "36px",
                  padding: "0 12px",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Breadcrumbs />

      <div className="dashboard-main">
        {/* Main Content */}
        <div className="dashboard-content-grid" id="dashboard-stats">
          {/* Map Section */}
          <div className="dashboard-map-section" id="dashboard-map">
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
                zoom={12}
                height="100%"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-actions-section" id="dashboard-actions">
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
                🚨 Dispatch
              </button>

              <button
                onClick={() => fetchData(emergenciesPage)}
                className="dashboard-btn dashboard-btn-secondary"
              >
                🔄 Refresh
              </button>

              <button
                onClick={() => showToast('Emergency broadcast sent', 'success')}
                className="dashboard-btn dashboard-btn-warning"
              >
                📢 Alert
              </button>
            </div>

            <div className="dashboard-actions-mini-stats">
              <div className="dashboard-mini-stat pending">
                <span className="dashboard-mini-label">Pending</span>
                <strong>{pendingEmergencies.length}</strong>
              </div>
              <div className="dashboard-mini-stat active">
                <span className="dashboard-mini-label">Active</span>
                <strong>{activeEmergencies.length}</strong>
              </div>
              <div className="dashboard-mini-stat available">
                <span className="dashboard-mini-label">Available</span>
                <strong>{availableUnits.length}</strong>
              </div>
              <div className={`dashboard-mini-stat ${wsConnected ? 'online' : 'offline'}`}>
                <span className="dashboard-mini-label">System</span>
                <strong>{wsConnected ? 'Online' : 'Offline'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency List */}
        <div className="dashboard-emergency-section" id="dashboard-emergencies">
          <div className="dashboard-emergency-header">
              <h3 className="dashboard-emergency-title">
                📋 Emergency Management
              </h3>
              {/* <hr/> */}
            <div className="dashboard-emergency-filters">
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, status: e.target.value }));
                  setEmergenciesPage(1);
                }}
                className="dashboard-emergency-filter-input"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, type: e.target.value }));
                  setEmergenciesPage(1);
                }}
                className="dashboard-emergency-filter-input"
              >
                {emergencyTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "ALL" ? "All Types" : type}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={filters.query}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, query: e.target.value }));
                  setEmergenciesPage(1);
                }}
                placeholder="Search emergencies..."
                className="dashboard-emergency-filter-input dashboard-emergency-filter-search"
              />
              <button
                type="button"
                onClick={() => {
                  setFilters({ status: "ALL", type: "ALL", query: "" });
                  setEmergenciesPage(1);
                }}
                className="dashboard-emergency-filter-reset"
              >
                Reset
              </button>
            </div>
          </div>
          
          <EmergencyList
            emergencies={filteredTableEmergencies}
            onSelect={setSelectedEmergency}
            onCenterMap={centerMapOnLocation}
            selectedId={selectedEmergency?.request_id}
            onDispatch={handleDispatch}
            dispatchingEmergencyId={dispatchingEmergencyId}
            onComplete={handleComplete}
            availableByType={{
              'AMBULANCE': getAvailableUnitsByType('AMBULANCE'),
              'FIRE_TRUCK': getAvailableUnitsByType('FIRE_TRUCK'),
              'POLICE': getAvailableUnitsByType('POLICE')
            }}
          />
          <div className="units-pagination-bar">
            <div className="units-pagination-meta">
              Page {emergenciesPage} of {emergenciesTotalPages} • Showing up to {emergenciesPerPage} rows
            </div>
            <div className="units-pagination-actions">
              <button
                type="button"
                className="units-page-btn"
                onClick={handlePrevEmergenciesPage}
                disabled={emergenciesPage <= 1 || loading}
              >
                Previous
              </button>
              <button
                type="button"
                className="units-page-btn"
                onClick={handleNextEmergenciesPage}
                disabled={emergenciesPage >= emergenciesTotalPages || loading}
              >
                Next
              </button>
            </div>
          </div>
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
