import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:5001",
  headers: { "Content-Type": "application/json" },
  withCredentials: false
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear local storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      // Optionally redirect to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);


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

// Authentication API methods
export const authAPI = {
  // Register new user
  register: (userData) => api.post('/api/auth/signup', userData),
  
  // Login user
  login: (credentials) => api.post('/api/auth/login', credentials),
  
  // Logout user
  logout: () => api.post('/api/auth/logout'),
  
  // Verify email with token
  verifyEmail: (token) => api.get(`/api/auth/verify-email/${token}`),
  
  // Resend verification email (unauthenticated)
  resendVerificationUnauth: (email) => api.post('/api/auth/resend-verification-unauth', { email }),
  
  // Get current user profile
  getProfile: () => api.get('/api/auth/profile'),
  
  // Forgot password
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  
  // Reset password
  resetPassword: (token, newPassword) => 
    api.post('/api/auth/reset-password', { token, password: newPassword }),
  
  // Health check
  health: () => api.get('/api/auth/health'),
  
  // Admin endpoints
  admin: {
    // User management
    getAllUsers: (params = {}) => {
      const queryParams = new URLSearchParams(params).toString();
      return api.get(`/api/admin/users${queryParams ? '?' + queryParams : ''}`);
    },
    getPendingUsers: () => api.get('/api/admin/pending-users'),
    getUserDetails: (userId) => api.get(`/api/admin/users/${userId}`),
    createUser: (userData) => api.post('/api/admin/users', userData),
    updateUser: (userId, userData) => api.put(`/api/admin/users/${userId}`, userData),
    deleteUser: (userId) => api.delete(`/api/admin/users/${userId}`),
    
    // Approval workflow
    approveUser: (userId, options = {}) => api.post(`/api/admin/approve-user/${userId}`, options),
    rejectUser: (userId, reason = '') => api.post(`/api/admin/reject-user/${userId}`, { reason }),
    updateUserRole: (userId, role) => api.put(`/api/admin/users/${userId}/role`, { role }),
    updateUserStatus: (userId, isActive) => api.put(`/api/admin/users/${userId}/status`, { is_active: isActive }),
    unlockUser: (userId) => api.post(`/api/admin/users/${userId}/unlock`),
    
    // Statistics and health
    getAdminStats: () => api.get('/api/admin/stats'),
    health: () => api.get('/api/admin/health')
  }
};

export default api;

