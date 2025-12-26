import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:5001",
  headers: { "Content-Type": "application/json" },
  withCredentials: false
});


// Location tracking API methods
export const locationAPI = {
  // Update unit location
  updateLocation: (locationData) => 
    api.post('/api/location/update', locationData),
  
  // Get current location for a unit
  getCurrentLocation: (unitId) => 
    api.get(`/api/location/unit/${unitId}/current`),
  
  // Get location history for a unit
  getLocationHistory: (unitId, params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/api/location/unit/${unitId}/history${queryParams ? '?' + queryParams : ''}`);
  },
  
  // Get all unit locations
  getAllLocations: () => 
    api.get('/api/location/units/all'),
  
  // Calculate route using OSRM
  calculateRoute: (routeData) => 
    api.post('/api/route/calculate', routeData),
  
  // Get active routes for a unit
  getActiveRoutes: (unitId) => 
    api.get(`/api/route/unit/${unitId}/active`)
};

// Unit tracking API methods
export const unitAPI = {
  // Get all units
  getUnits: () => api.get('/api/units'),
  
  // Get specific unit
  getUnit: (unitId) => api.get(`/api/units/${unitId}`),
  
  // Create new unit
  createUnit: (unitData) => api.post('/api/units', unitData),
  
  // Update unit
  updateUnit: (unitId, unitData) => api.put(`/api/units/${unitId}`, unitData),
  
  // Delete unit
  deleteUnit: (unitId) => api.delete(`/api/units/${unitId}`),

  // ✅ NEW: Delete unit by vehicle number
  deleteUnitByVehicleNumber: (vehicleNumber) => api.delete(`/api/units/vehicle-number/${vehicleNumber}`),

  // ✅ NEW: Get route data with polylines_position for animation
  getUnitRoutes: (unitId) => api.get(`/api/unit-routes/${unitId}`),
  
  // ✅ NEW: Get all active unit routes for dashboard overview
  getActiveUnitRoutes: () => api.get('/api/active-unit-routes')
};

// Emergency API methods
export const emergencyAPI = {
  // Get all emergencies
  getEmergencies: () => api.get('/api/emergencies'),
  
  // Create new emergency
  createEmergency: (emergencyData) => api.post('/api/emergencies', emergencyData),
  
  // Update emergency status
  updateEmergency: (requestId, status) => 
    api.put(`/api/emergencies/${requestId}/status`, { status }),
  
  // Assign unit to emergency
  assignUnit: (requestId, unitId) => 
    api.post(`/api/emergencies/${requestId}/assign`, { unit_id: unitId })
};

export default api;

