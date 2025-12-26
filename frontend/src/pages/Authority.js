import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { emergencyAPI, unitAPI } from "../api";
import AddUnit from "../components/AddUnit";
import DeleteUnit from "../components/DeleteUnit";
import EmergencyList from "../components/EmergencyList";
import NotificationPanel from "../components/NotificationPanel";
import { useNotifications } from "../hooks/useNotifications";

const Authority = () => {
  const navigate = useNavigate();
  const [emergencies, setEmergencies] = useState([]);
  const [units, setUnits] = useState([]);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showDeleteUnit, setShowDeleteUnit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalEmergencies: 0,
    pendingEmergencies: 0,
    assignedEmergencies: 0,
    totalUnits: 0,
    availableUnits: 0,
    busyUnits: 0
  });

  const { notifications, unreadCount, markAsRead } = useNotifications();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [emergencies, units]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [emergenciesResponse, unitsResponse] = await Promise.all([
        emergencyAPI.getEmergencies(),
        unitAPI.getUnits()
      ]);

      setEmergencies(emergenciesResponse.data || []);
      setUnits(unitsResponse.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalEmergencies = emergencies.length;
    const pendingEmergencies = emergencies.filter(e => e.status === 'PENDING').length;
    const assignedEmergencies = emergencies.filter(e => e.status === 'ASSIGNED').length;
    
    const totalUnits = units.length;
    const availableUnits = units.filter(u => u.status === 'AVAILABLE').length;
    const busyUnits = units.filter(u => u.status === 'BUSY' || u.status === 'ENROUTE').length;

    setStats({
      totalEmergencies,
      pendingEmergencies,
      assignedEmergencies,
      totalUnits,
      availableUnits,
      busyUnits
    });
  };

  const handleUnitAdded = (newUnit) => {
    console.log('✅ New unit added:', newUnit);
    setUnits(prev => [...prev, newUnit]);
    setShowAddUnit(false);
    // Refresh data to get updated stats
    setTimeout(() => fetchData(), 1000);
  };

  const handleEmergencyUpdate = (updatedEmergency) => {
    setEmergencies(prev => 
      prev.map(e => e.request_id === updatedEmergency.request_id ? updatedEmergency : e)
    );
  };

  const handleUnitStatusUpdate = (updatedUnit) => {
    setUnits(prev => 
      prev.map(u => u.unit_id === updatedUnit.unit_id ? updatedUnit : u)
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return '#ffc107';
      case 'APPROVED': return '#17a2b8';
      case 'ASSIGNED': return '#28a745';
      case 'ENROUTE': return '#007bff';
      case 'ARRIVED': return '#6f42c1';
      case 'COMPLETED': return '#6c757d';
      default: return '#dc3545';
    }
  };

  const getServiceEmoji = (serviceType) => {
    switch (serviceType) {
      case 'AMBULANCE': return '🚑';
      case 'FIRE_TRUCK': return '🚒';
      case 'POLICE': return '👮';
      default: return '🚛';
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: 'var(--text-lg)',
        color: 'var(--text-secondary)'
      }}>
        <div className="spinner"></div>
        <span style={{ marginLeft: 'var(--space-3)' }}>Loading Authority Dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 'var(--space-4)'
      }}>
        <div style={{ color: 'var(--accent-red)', fontSize: 'var(--text-lg)' }}>
          {error}
        </div>
        <button onClick={fetchData} className="btn btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Header */}
      <div className="dashboard-header">
        <div className="container">
          <h1 className="page-title">
            👮 Authority Dashboard
          </h1>
          <p className="page-subtitle">
            Emergency Response Management System
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="container" style={{ margin: 'var(--space-6) auto', maxWidth: '1200px' }}>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#ffc107' }}>🚨</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalEmergencies}</div>
              <div className="stat-label">Total Emergencies</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#28a745' }}>⏳</div>
            <div className="stat-content">
              <div className="stat-value">{stats.pendingEmergencies}</div>
              <div className="stat-label">Pending Approval</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#007bff' }}>🚛</div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalUnits}</div>
              <div className="stat-label">Total Units</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#28a745' }}>✅</div>
            <div className="stat-content">
              <div className="stat-value">{stats.availableUnits}</div>
              <div className="stat-label">Available Units</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#dc3545' }}>🚓</div>
            <div className="stat-content">
              <div className="stat-value">{stats.busyUnits}</div>
              <div className="stat-label">Busy Units</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="container" style={{ margin: 'var(--space-6) auto', maxWidth: '1200px' }}>
        <div className="card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
              <button
                onClick={() => setShowAddUnit(true)}
                className="btn btn-primary btn-lg"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  justifyContent: 'center'
                }}
              >
                🚛 Add New Unit
              </button>
              
              <button
                onClick={() => navigate('/units-tracking')}
                className="btn btn-secondary btn-lg"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  justifyContent: 'center'
                }}
              >
                📍 View Unit Tracking
              </button>
              
              <button
                onClick={fetchData}
                className="btn btn-success btn-lg"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  justifyContent: 'center'
                }}
              >
                🔄 Refresh Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Units Overview */}
      <div className="container" style={{ margin: 'var(--space-6) auto', maxWidth: '1200px' }}>
        <div className="card">
          <div className="card-header">
            <h3>🚛 Units Overview</h3>
          </div>
          <div className="card-body">
            {units.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>🚛</div>
                <div>No units found. Add your first emergency unit to get started.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                {units.slice(0, 6).map((unit) => (
                  <div key={unit.unit_id} style={{
                    padding: 'var(--space-4)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--bg-primary)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                      <div style={{ fontSize: 'var(--text-2xl)' }}>
                        {getServiceEmoji(unit.service_type)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-base)' }}>
                          Unit {unit.unit_id}
                        </div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {unit.unit_vehicle_number || 'No Plate'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`badge ${unit.status.toLowerCase()}`}>
                        {unit.status}
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        {unit.service_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {units.length > 6 && (
              <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                <button
                  onClick={() => navigate('/units-tracking')}
                  className="btn btn-outline"
                >
                  View All {units.length} Units
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Management */}
      <div className="container" style={{ margin: 'var(--space-6) auto', maxWidth: '1200px' }}>
        <EmergencyList 
          emergencies={emergencies}
          units={units}
          onEmergencyUpdate={handleEmergencyUpdate}
          onUnitStatusUpdate={handleUnitStatusUpdate}
        />
      </div>

      {/* Notification Panel */}
      {notifications.length > 0 && (
        <div className="container" style={{ margin: 'var(--space-6) auto', maxWidth: '1200px' }}>
          <NotificationPanel 
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
          />
        </div>
      )}

      {/* Add Unit Modal */}
      <AddUnit 
        isOpen={showAddUnit}
        onClose={() => setShowAddUnit(false)}
        onUnitAdded={handleUnitAdded}
      />
    </div>
  );
};

export default Authority;
