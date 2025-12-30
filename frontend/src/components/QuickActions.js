import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function QuickActions() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleQuickAction = (action) => {
    setIsExpanded(false);
    
    switch (action) {
      case 'report-emergency':
        navigate('/');
        break;
      case 'view-dashboard':
        if (user?.role === 'authority') navigate('/dashboard');
        break;
      case 'track-units':
        if (user?.role === 'authority') navigate('/units-tracking');
        break;
      case 'admin-panel':
        if (user?.role === 'admin') navigate('/admin');
        break;
      default:
        break;
    }
  };

  // Don't show if not authenticated (except for emergency reporting)
  if (!isAuthenticated && !user) {
    return (
      <div className="quick-actions">
        <button
          className="quick-action-btn primary"
          onClick={() => handleQuickAction('report-emergency')}
          title="Quick Emergency Report"
        >
          🚨 Report Emergency
        </button>
      </div>
    );
  }

  const getQuickActions = () => {
    const actions = [
      {
        id: 'report-emergency',
        label: 'Report Emergency',
        icon: '🚨',
        description: 'Quickly report a new emergency',
        color: 'var(--accent-red)',
        available: true
      }
    ];

    // Authority-specific actions
    if (user?.role === 'authority') {
      actions.push(
        {
          id: 'view-dashboard',
          label: 'Dashboard',
          icon: '📊',
          description: 'View emergency overview',
          color: 'var(--primary-blue)',
          available: true
        },
        {
          id: 'track-units',
          label: 'Track Units',
          icon: '📍',
          description: 'Monitor unit locations',
          color: 'var(--secondary-green)',
          available: true
        }
      );
    }

    // Admin-specific actions
    if (user?.role === 'admin') {
      actions.push({
        id: 'admin-panel',
        label: 'Admin Panel',
        icon: '🛡️',
        description: 'System administration',
        color: 'var(--primary-red)',
        available: true
      });
    }

    return actions;
  };

  const quickActions = getQuickActions();

  return (
    <div className="quick-actions">
      {quickActions.length === 1 ? (
        // Single action (emergency report)
        <button
          className="quick-action-btn primary"
          onClick={() => handleQuickAction('report-emergency')}
          title="Quick Emergency Report"
        >
          <span className="icon">🚨</span>
          <span className="label">Report Emergency</span>
        </button>
      ) : (
        // Multiple actions with dropdown
        <div className="quick-actions-dropdown">
          <button
            className={`quick-action-btn dropdown-toggle ${isExpanded ? 'expanded' : ''}`}
            onClick={() => setIsExpanded(!isExpanded)}
            title="Quick Actions Menu"
          >
            <span className="icon">⚡</span>
            <span className="label">Quick Actions</span>
            <span className="arrow">{isExpanded ? '▲' : '▼'}</span>
          </button>
          
          {isExpanded && (
            <div className="quick-actions-menu">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  className="quick-action-item"
                  onClick={() => handleQuickAction(action.id)}
                  style={{
                    '--action-color': action.color
                  }}
                >
                  <span className="icon">{action.icon}</span>
                  <div className="action-content">
                    <span className="label">{action.label}</span>
                    <span className="description">{action.description}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QuickActions;
