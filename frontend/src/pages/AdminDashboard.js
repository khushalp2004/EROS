import React, { useState, useEffect } from 'react';
import { authAPI } from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import '../styles/admin-dashboard.css';

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
        window.showSuccessToast('User approved successfully');
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
        window.showSuccessToast('User rejected');
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
        window.showSuccessToast('User status updated successfully');
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

  const handleToggleUserLock = async (user) => {
    try {
      setProcessing(prev => ({ ...prev, [user.id]: true }));
      const locked = isUserLocked(user);
      const response = locked
        ? await authAPI.admin.unlockUser(user.id)
        : await authAPI.admin.lockUser(user.id, 24);

      if (response.data.success) {
        window.showSuccessToast(locked ? 'User account unlocked successfully' : 'User account locked successfully');
        await loadAllUsers();
        await loadAdminStats();
      }
    } catch (error) {
      console.error('Error updating user lock state:', error);
      window.showErrorToast(error.response?.data?.message || 'Failed to update account lock state');
    } finally {
      setProcessing(prev => ({ ...prev, [user.id]: false }));
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
    if (user.locked_until && new Date(user.locked_until) > new Date()) return 'var(--primary-red)';
    if (!user.is_verified) return 'var(--warning-orange)';
    if (!user.is_approved) return 'var(--warning-yellow)';
    if (!user.is_active) return 'var(--gray-500)';
    return 'var(--success-green)';
  };

  const getStatusText = (user) => {
    if (user.locked_until && new Date(user.locked_until) > new Date()) return 'Locked';
    if (!user.is_verified) return 'Unverified';
    if (!user.is_approved) return 'Pending Approval';
    if (!user.is_active) return 'Inactive';
    return 'Active';
  };

  const isUserLocked = (user) => Boolean(user.locked_until && new Date(user.locked_until) > new Date());

  const getOrganizationMeta = (user) => {
    if (!user) return null;

    if (user.role === 'unit') {
      const unitId = user.unit_id ?? user.organization;
      if (unitId === null || unitId === undefined || unitId === '') return null;
      return { label: 'Unit ID', value: unitId };
    }

    if (!user.organization) return null;
    return { label: 'Organization', value: user.organization };
  };

  if (loading) {
    return (
      <div className="admin-loading-wrap">
        <div className="admin-loading-spinner"></div>
        <div>Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container admin-page">
      <Breadcrumbs />
      <div className="dashboard-main admin-shell">
        <section className="admin-hero-card">
          <div className="admin-hero-eyebrow">Platform Control</div>
          <h1 className="admin-hero-title">Admin Dashboard</h1>
          <p className="admin-hero-subtitle">
            Manage user approvals, role access, and platform health from a single control center.
          </p>
        </section>

        {adminStats && (
          <section className="admin-stats-grid">
            <article className="admin-stat-card total">
              <span className="admin-stat-label">Total Users</span>
              <strong className="admin-stat-value">{adminStats.total_users}</strong>
            </article>
            <article className="admin-stat-card pending">
              <span className="admin-stat-label">Pending Approval</span>
              <strong className="admin-stat-value">{adminStats.pending_users}</strong>
            </article>
            <article className="admin-stat-card active">
              <span className="admin-stat-label">Active Users</span>
              <strong className="admin-stat-value">{adminStats.active_users}</strong>
            </article>
            <article className="admin-stat-card verify">
              <span className="admin-stat-label">Verification Rate</span>
              <strong className="admin-stat-value">{adminStats.verification_rate}%</strong>
            </article>
          </section>
        )}

        <section className="admin-main-panel">
          <div className="admin-tabs">
            <button
              onClick={() => setActiveTab('pending')}
              className={`admin-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            >
              <span>Pending Approvals</span>
              {pendingUsers.length > 0 && (
                <span className="admin-tab-pill">{pendingUsers.length}</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`admin-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            >
              All Users
            </button>
          </div>

          <div className="admin-panel-body">
            {activeTab === 'pending' && (
              <div>
                <h2 className="admin-section-title">Users Awaiting Approval</h2>

                {pendingUsers.length === 0 ? (
                  <div className="admin-empty-state">
                    <div className="admin-empty-icon">Done</div>
                    <p>No users pending approval</p>
                  </div>
                ) : (
                  <div className="admin-user-list">
                    {pendingUsers.map((user) => (
                      <article key={user.id} className="admin-user-card">
                        <div className="admin-user-main">
                          <div className="admin-user-head">
                            <h3>
                              {user.first_name && user.last_name
                                ? `${user.first_name} ${user.last_name}`
                                : user.email}
                            </h3>
                            <span className="admin-badge" style={{ backgroundColor: getRoleBadgeColor(user.role) }}>
                              {user.role}
                            </span>
                            <span className="admin-badge" style={{ backgroundColor: getStatusBadgeColor(user) }}>
                              {getStatusText(user)}
                            </span>
                          </div>

                          <div className="admin-user-meta">
                            <p><span>Email</span>{user.email}</p>
                            {getOrganizationMeta(user) && (
                              <p>
                                <span>{getOrganizationMeta(user).label}</span>
                                {getOrganizationMeta(user).value}
                              </p>
                            )}
                            {user.phone && <p><span>Phone</span>{user.phone}</p>}
                            <p><span>Registered</span>{formatDate(user.created_at)}</p>
                          </div>
                        </div>

                        <div className="admin-user-actions">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="admin-btn ghost"
                          >
                            View
                          </button>

                          <button
                            onClick={() => handleApproveUser(user.id)}
                            disabled={processing[user.id]}
                            className="admin-btn approve"
                          >
                            {processing[user.id] ? 'Approving...' : 'Approve'}
                          </button>

                          <button
                            onClick={() => handleRejectUser(user.id)}
                            disabled={processing[user.id]}
                            className="admin-btn reject"
                          >
                            {processing[user.id] ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'all' && (
              <div>
                <div className="admin-all-head">
                  <h2 className="admin-section-title">All Users</h2>

                  <div className="admin-filter-row">
                    <select
                      value={filters.role}
                      onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value, page: 1 }))}
                    >
                      <option value="">All Roles</option>
                      <option value="admin">Admin</option>
                      <option value="authority">Authority</option>
                      <option value="unit">Unit</option>
                    </select>

                    <select
                      value={filters.status}
                      onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}
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
                  <div className="admin-empty-state">
                    <div className="admin-empty-icon">Users</div>
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="admin-user-list">
                    {allUsers.map((user) => (
                      <article key={user.id} className="admin-user-card">
                        <div className="admin-user-main">
                          <div className="admin-user-head">
                            <h3>
                              {user.first_name && user.last_name
                                ? `${user.first_name} ${user.last_name}`
                                : user.email}
                            </h3>
                            <span className="admin-badge" style={{ backgroundColor: getRoleBadgeColor(user.role) }}>
                              {user.role}
                            </span>
                            <span className="admin-badge" style={{ backgroundColor: getStatusBadgeColor(user) }}>
                              {getStatusText(user)}
                            </span>
                          </div>

                          <div className="admin-user-meta">
                            <p><span>Email</span>{user.email}</p>
                            {getOrganizationMeta(user) && (
                              <p>
                                <span>{getOrganizationMeta(user).label}</span>
                                {getOrganizationMeta(user).value}
                              </p>
                            )}
                            <p><span>Registered</span>{formatDate(user.created_at)}</p>
                            {user.last_login && <p><span>Last Login</span>{formatDate(user.last_login)}</p>}
                          </div>
                        </div>

                        <div className="admin-user-actions">
                          {!user.is_approved && (
                            <button
                            onClick={() => handleApproveUser(user.id)}
                            disabled={processing[user.id]}
                            className="admin-btn approve"
                          >
                            {processing[user.id] ? 'Approving...' : 'Approve'}
                          </button>
                        )}

                          <button
                            onClick={() => setSelectedUser(user)}
                            className="admin-btn ghost"
                          >
                            View
                          </button>

                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                            disabled={processing[user.id]}
                            className={`admin-btn ${user.is_active ? 'warn' : 'activate'}`}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>

                          <button
                            onClick={() => handleToggleUserLock(user)}
                            disabled={processing[user.id]}
                            className={`admin-btn ${isUserLocked(user) ? 'unlock' : 'lock'}`}
                          >
                            {processing[user.id]
                              ? (isUserLocked(user) ? 'Unlocking...' : 'Locking...')
                              : (isUserLocked(user) ? 'Unlock Account' : 'Lock Account')}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedUser && (
        <div className="admin-user-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="admin-user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-user-modal-head">
              <h2>User Details</h2>
              <button onClick={() => setSelectedUser(null)} className="admin-user-modal-close">×</button>
            </div>

            <div className="admin-user-modal-grid">
              <div>
                <label>Name</label>
                <p>
                  {selectedUser.first_name && selectedUser.last_name
                    ? `${selectedUser.first_name} ${selectedUser.last_name}`
                    : 'Not provided'}
                </p>
              </div>

              <div>
                <label>Email</label>
                <p>{selectedUser.email}</p>
              </div>

              <div>
                <label>Role</label>
                <p>{selectedUser.role}</p>
              </div>

              {getOrganizationMeta(selectedUser) && (
                <div>
                  <label>{getOrganizationMeta(selectedUser).label}</label>
                  <p>{getOrganizationMeta(selectedUser).value}</p>
                </div>
              )}

              {selectedUser.phone && (
                <div>
                  <label>Phone</label>
                  <p>{selectedUser.phone}</p>
                </div>
              )}

              <div>
                <label>Status</label>
                <p>{getStatusText(selectedUser)}</p>
              </div>

              <div>
                <label>Registered</label>
                <p>{formatDate(selectedUser.created_at)}</p>
              </div>

              {selectedUser.last_login && (
                <div>
                  <label>Last Login</label>
                  <p>{formatDate(selectedUser.last_login)}</p>
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
