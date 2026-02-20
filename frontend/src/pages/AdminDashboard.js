import React, { useState, useEffect } from 'react';
import { authAPI } from '../api';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [filters, setFilters] = useState({
    role: '',
    status: '',
    page: 1,
    per_page: 20
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'all') {
      loadAllUsers();
    }
  }, [activeTab, filters]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadPendingUsers(),
        loadAdminStats()
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
      window.showErrorToast('Failed to load admin dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingUsers = async () => {
    try {
      const response = await authAPI.admin.getPendingUsers();
      if (response.data.success) {
        setPendingUsers(response.data.users);
      }
    } catch (error) {
      console.error('Error loading pending users:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const response = await authAPI.admin.getAllUsers(filters);
      if (response.data.success) {
        setAllUsers(response.data.users);
      }
    } catch (error) {
      console.error('Error loading all users:', error);
    }
  };

  const loadAdminStats = async () => {
    try {
      const response = await authAPI.admin.getAdminStats();
      if (response.data.success) {
        setAdminStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading admin stats:', error);
    }
  };

  const handleApproveUser = async (userId) => {
    try {
      setProcessing(prev => ({ ...prev, [userId]: true }));
      const response = await authAPI.admin.approveUser(userId, {
        send_notification: true,
        message: 'Welcome to EROS! Your account has been approved.'
      });
      
      if (response.data.success) {
        window.showSuccessToast(`User approved successfully`);
        await loadPendingUsers();
        await loadAdminStats();
      }
    } catch (error) {
      console.error('Error approving user:', error);
      window.showErrorToast(error.response?.data?.message || 'Failed to approve user');
    } finally {
      setProcessing(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleRejectUser = async (userId) => {
    const reason = prompt('Enter reason for rejection (optional):');
    try {
      setProcessing(prev => ({ ...prev, [userId]: true }));
      const response = await authAPI.admin.rejectUser(userId, reason || 'Rejected by administrator');
      
      if (response.data.success) {
        window.showSuccessToast(`User rejected`);
        await loadPendingUsers();
        await loadAdminStats();
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      window.showErrorToast(error.response?.data?.message || 'Failed to reject user');
    } finally {
      setProcessing(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      setProcessing(prev => ({ ...prev, [userId]: true }));
      const response = await authAPI.admin.updateUserStatus(userId, !currentStatus);
      
      if (response.data.success) {
        window.showSuccessToast(`User status updated successfully`);
        await loadAllUsers();
        await loadAdminStats();
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      window.showErrorToast(error.response?.data?.message || 'Failed to update user status');
    } finally {
      setProcessing(prev => ({ ...prev, [userId]: false }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'var(--primary-red)';
      case 'authority': return 'var(--primary-blue)';
      case 'unit': return 'var(--status-enroute)';
      case 'reporter': return 'var(--primary-green)';
      default: return 'var(--gray-600)';
    }
  };

  const getStatusBadgeColor = (user) => {
    if (!user.is_verified) return 'var(--warning-orange)';
    if (!user.is_approved) return 'var(--warning-yellow)';
    if (!user.is_active) return 'var(--gray-500)';
    return 'var(--success-green)';
  };

  const getStatusText = (user) => {
    if (!user.is_verified) return 'Unverified';
    if (!user.is_approved) return 'Pending Approval';
    if (!user.is_active) return 'Inactive';
    return 'Active';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        fontSize: 'var(--text-lg)',
        color: 'var(--text-muted)'
      }}>
        <div>Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: 'var(--space-6)',
      backgroundColor: 'var(--bg-secondary)'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        marginBottom: 'var(--space-6)'
      }}>
        <h1 style={{
          margin: '0 0 var(--space-2) 0',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)'
        }}>
          🛡️ Super Admin Dashboard
        </h1>
        <p style={{
          margin: 0,
          color: 'var(--text-muted)',
          fontSize: 'var(--text-sm)'
        }}>
          Manage users, approve authority requests, and monitor system statistics
        </p>
      </div>

      {/* Statistics Cards */}
      {adminStats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            borderLeft: '4px solid var(--primary-blue)'
          }}>
            <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Total Users
            </h3>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
              {adminStats.total_users}
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            borderLeft: '4px solid var(--warning-yellow)'
          }}>
            <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Pending Approval
            </h3>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
              {adminStats.pending_users}
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            borderLeft: '4px solid var(--success-green)'
          }}>
            <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Active Users
            </h3>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
              {adminStats.active_users}
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            borderLeft: '4px solid var(--primary-red)'
          }}>
            <h3 style={{ margin: '0 0 var(--space-2) 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Verification Rate
            </h3>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--text-primary)' }}>
              {adminStats.verification_rate}%
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--gray-200)'
        }}>
          <button
            onClick={() => setActiveTab('pending')}
            style={{
              flex: 1,
              padding: 'var(--space-4)',
              backgroundColor: activeTab === 'pending' ? 'var(--primary-blue)' : 'transparent',
              color: activeTab === 'pending' ? 'var(--text-inverse)' : 'var(--text-muted)',
              border: 'none',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)'
            }}
          >
            ⏳ Pending Approvals
            {pendingUsers.length > 0 && (
              <span style={{
                backgroundColor: 'var(--warning-orange)',
                color: 'var(--text-inverse)',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-bold)'
              }}>
                {pendingUsers.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1,
              padding: 'var(--space-4)',
              backgroundColor: activeTab === 'all' ? 'var(--primary-blue)' : 'transparent',
              color: activeTab === 'all' ? 'var(--text-inverse)' : 'var(--text-muted)',
              border: 'none',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
            👥 All Users
          </button>
        </div>

        <div style={{ padding: 'var(--space-6)' }}>
          {/* Pending Users Tab */}
          {activeTab === 'pending' && (
            <div>
              <h2 style={{ margin: '0 0 var(--space-4) 0', color: 'var(--text-primary)' }}>
                Users Awaiting Approval
              </h2>
              
              {pendingUsers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-8)',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-2)' }}>✅</div>
                  <p>No users pending approval</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  {pendingUsers.map(user => (
                    <div key={user.id} style={{
                      backgroundColor: 'var(--bg-secondary)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--gray-200)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                            {user.first_name && user.last_name 
                              ? `${user.first_name} ${user.last_name}` 
                              : user.email}
                          </h3>
                          <span style={{
                            backgroundColor: getRoleBadgeColor(user.role),
                            color: 'var(--text-inverse)',
                            padding: 'var(--space-1) var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 'var(--font-medium)',
                            textTransform: 'uppercase'
                          }}>
                            {user.role}
                          </span>
                          <span style={{
                            backgroundColor: getStatusBadgeColor(user),
                            color: 'var(--text-inverse)',
                            padding: 'var(--space-1) var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 'var(--font-medium)'
                          }}>
                            {getStatusText(user)}
                          </span>
                        </div>
                        
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                          <p style={{ margin: 'var(--space-1) 0' }}>📧 {user.email}</p>
                          {user.organization && <p style={{ margin: 'var(--space-1) 0' }}>🏢 {user.organization}</p>}
                          {user.phone && <p style={{ margin: 'var(--space-1) 0' }}>📱 {user.phone}</p>}
                          <p style={{ margin: 'var(--space-1) 0' }}>📅 Registered: {formatDate(user.created_at)}</p>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          onClick={() => setSelectedUser(user)}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            backgroundColor: 'var(--gray-100)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--gray-300)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: 'var(--text-sm)'
                          }}
                        >
                          👁️ View Details
                        </button>
                        
                        <button
                          onClick={() => handleApproveUser(user.id)}
                          disabled={processing[user.id]}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            backgroundColor: 'var(--success-green)',
                            color: 'var(--text-inverse)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: processing[user.id] ? 'not-allowed' : 'pointer',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            opacity: processing[user.id] ? 0.7 : 1
                          }}
                        >
                          {processing[user.id] ? '⏳ Approving...' : '✅ Approve'}
                        </button>
                        
                        <button
                          onClick={() => handleRejectUser(user.id)}
                          disabled={processing[user.id]}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            backgroundColor: 'var(--primary-red)',
                            color: 'var(--text-inverse)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: processing[user.id] ? 'not-allowed' : 'pointer',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            opacity: processing[user.id] ? 0.7 : 1
                          }}
                        >
                          {processing[user.id] ? '⏳ Rejecting...' : '❌ Reject'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All Users Tab */}
          {activeTab === 'all' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>All Users</h2>
                
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <select
                    value={filters.role}
                    onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value, page: 1 }))}
                    style={{
                      padding: 'var(--space-2)',
                      border: '1px solid var(--gray-300)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-sm)'
                    }}
                  >
                    <option value="">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="authority">Authority</option>
                    <option value="unit">Unit</option>
                  </select>
                  
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                    style={{
                      padding: 'var(--space-2)',
                      border: '1px solid var(--gray-300)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-sm)'
                    }}
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                    <option value="locked">Locked</option>
                  </select>
                </div>
              </div>
              
              {allUsers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: 'var(--space-8)',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-2)' }}>👥</div>
                  <p>No users found</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                  {allUsers.map(user => (
                    <div key={user.id} style={{
                      backgroundColor: 'var(--bg-secondary)',
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--gray-200)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                            {user.first_name && user.last_name 
                              ? `${user.first_name} ${user.last_name}` 
                              : user.email}
                          </h3>
                          <span style={{
                            backgroundColor: getRoleBadgeColor(user.role),
                            color: 'var(--text-inverse)',
                            padding: 'var(--space-1) var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 'var(--font-medium)',
                            textTransform: 'uppercase'
                          }}>
                            {user.role}
                          </span>
                          <span style={{
                            backgroundColor: getStatusBadgeColor(user),
                            color: 'var(--text-inverse)',
                            padding: 'var(--space-1) var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 'var(--font-medium)'
                          }}>
                            {getStatusText(user)}
                          </span>
                        </div>
                        
                        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                          <p style={{ margin: 'var(--space-1) 0' }}>📧 {user.email}</p>
                          {user.organization && <p style={{ margin: 'var(--space-1) 0' }}>🏢 {user.organization}</p>}
                          <p style={{ margin: 'var(--space-1) 0' }}>📅 Registered: {formatDate(user.created_at)}</p>
                          {user.last_login && <p style={{ margin: 'var(--space-1) 0' }}>🕐 Last Login: {formatDate(user.last_login)}</p>}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {!user.is_approved && (
                          <button
                            onClick={() => handleApproveUser(user.id)}
                            disabled={processing[user.id]}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              backgroundColor: 'var(--success-green)',
                              color: 'var(--text-inverse)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: processing[user.id] ? 'not-allowed' : 'pointer',
                              fontSize: 'var(--text-sm)',
                              fontWeight: 'var(--font-medium)',
                              opacity: processing[user.id] ? 0.7 : 1
                            }}
                          >
                            {processing[user.id] ? '⏳ Approving...' : '✅ Approve'}
                          </button>
                        )}
                        
                        <button
                          onClick={() => setSelectedUser(user)}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            backgroundColor: 'var(--gray-100)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--gray-300)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: 'var(--text-sm)'
                          }}
                        >
                          👁️ View Details
                        </button>
                        
                        <button
                          onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                          disabled={processing[user.id]}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            backgroundColor: user.is_active ? 'var(--warning-orange)' : 'var(--success-green)',
                            color: 'var(--text-inverse)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: processing[user.id] ? 'not-allowed' : 'pointer',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            opacity: processing[user.id] ? 0.7 : 1
                          }}
                        >
                          {user.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>User Details</h2>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: 'var(--text-xl)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Name</label>
                <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                  {selectedUser.first_name && selectedUser.last_name 
                    ? `${selectedUser.first_name} ${selectedUser.last_name}` 
                    : 'Not provided'}
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Email</label>
                <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{selectedUser.email}</div>
              </div>
              
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Role</label>
                <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{selectedUser.role}</div>
              </div>
              
              {selectedUser.organization && (
                <div>
                  <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Organization</label>
                  <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{selectedUser.organization}</div>
                </div>
              )}
              
              {selectedUser.phone && (
                <div>
                  <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Phone</label>
                  <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{selectedUser.phone}</div>
                </div>
              )}
              
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Status</label>
                <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                  {getStatusText(selectedUser)}
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Registered</label>
                <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                  {formatDate(selectedUser.created_at)}
                </div>
              </div>
              
              {selectedUser.last_login && (
                <div>
                  <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Last Login</label>
                  <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                    {formatDate(selectedUser.last_login)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
