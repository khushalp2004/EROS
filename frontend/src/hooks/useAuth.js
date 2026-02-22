import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);

  // Check for stored authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('user');
      const pendingUserData = localStorage.getItem('pendingUser');
      
      if (token && userData) {
        // Fully authenticated user
        try {
          setIsAuthenticated(true);
          setUser(JSON.parse(userData));
          setPendingApproval(false);
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
          setPendingApproval(false);
        }
      } else if (pendingUserData) {
        // Pending approval user
        try {
          setPendingApproval(true);
          setUser(JSON.parse(pendingUserData));
          setIsAuthenticated(false);
        } catch (error) {
          console.error('Error parsing stored pending user data:', error);
          localStorage.removeItem('pendingUser');
          setPendingApproval(false);
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = (userData, token, status = 'success') => {
    if (status === 'pending_approval') {
      // Store user data but no token for pending approval users
      localStorage.setItem('pendingUser', JSON.stringify(userData));
      setPendingApproval(true);
      setUser(userData);
      setIsAuthenticated(false);
    } else if (status === 'success') {
      // Full authentication for approved users
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.removeItem('pendingUser'); // Clear any pending user data
      setPendingApproval(false);
      setIsAuthenticated(true);
      setUser(userData);
    }
  };

  const setPendingApprovalUser = (userData) => {
    localStorage.setItem('pendingUser', JSON.stringify(userData));
    setPendingApproval(true);
    setUser(userData);
    setIsAuthenticated(false);
  };

  const clearPendingApproval = () => {
    localStorage.removeItem('pendingUser');
    setPendingApproval(false);
    setUser(null);
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint (only if user is authenticated)
      if (isAuthenticated) {
        await authAPI.logout();
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with client-side logout even if API call fails
    }

    // Clear all local storage and update state
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('pendingUser');
    setIsAuthenticated(false);
    setUser(null);
    setPendingApproval(false);

    // Always return users to home page after logout.
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    pendingApproval,
    login,
    logout,
    setPendingApprovalUser,
    clearPendingApproval
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
