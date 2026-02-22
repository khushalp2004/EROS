import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/breadcrumbs.css';

function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const getBreadcrumbLabel = (segment) => {
    switch (segment) {
      case 'dashboard': return 'Dashboard';
      case 'units-tracking': return 'Unit Tracking';
      case 'unit': return 'Unit Console';
      case 'admin': return 'Admin Panel';
      case 'verify-email': return 'Email Verification';
      case 'pending-approval': return 'Pending Approval';
      case 'forgot-password': return 'Forgot Password';
      case 'reset-password': return 'Reset Password';
      default:
        return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    }
  };

  const getBreadcrumbIcon = (segment) => {
    switch (segment) {
      case 'dashboard': return '📊';
      case 'units-tracking': return '📍';
      case 'unit': return '🚑';
      case 'admin': return '🛡️';
      case 'verify-email': return '📧';
      case 'pending-approval': return '⏳';
      case 'forgot-password': return '🔐';
      case 'reset-password': return '🔄';
      default: return '📄';
    }
  };

  const breadcrumbPath = [];

  return (
    <nav className="breadcrumbs-nav" aria-label="Breadcrumb">
      <div className="breadcrumbs-shell">
        <ol className="breadcrumbs-list">
          <li className="breadcrumbs-item">
            {pathSegments.length === 0 ? (
              <span className="breadcrumbs-current breadcrumbs-home-link" aria-current="page">
                <span className="breadcrumbs-icon" aria-hidden="true">🏠</span>
                <span>Home</span>
              </span>
            ) : (
              <Link to="/" className="breadcrumbs-link breadcrumbs-home-link">
                <span className="breadcrumbs-icon" aria-hidden="true">🏠</span>
                <span>Home</span>
              </Link>
            )}
          </li>

          {pathSegments.map((segment, index) => {
            breadcrumbPath.push(segment);
            const isLast = index === pathSegments.length - 1;
            const path = `/${breadcrumbPath.join('/')}`;
            const label = getBreadcrumbLabel(segment);
            const icon = getBreadcrumbIcon(segment);

            return (
              <React.Fragment key={`${segment}-${index}`}>
                <li className="breadcrumbs-separator" aria-hidden="true">
                  <span>›</span>
                </li>
                <li className="breadcrumbs-item">
                  {isLast ? (
                    <span className="breadcrumbs-current" aria-current="page">
                      <span className="breadcrumbs-icon" aria-hidden="true">{icon}</span>
                      <span>{label}</span>
                    </span>
                  ) : (
                    <Link to={path} className="breadcrumbs-link">
                      <span className="breadcrumbs-icon" aria-hidden="true">{icon}</span>
                      <span>{label}</span>
                    </Link>
                  )}
                </li>
              </React.Fragment>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

export default Breadcrumbs;
