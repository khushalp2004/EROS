import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(segment => segment);

  const getBreadcrumbLabel = (segment, index) => {
    switch (segment) {
      case 'dashboard': return 'Dashboard';
      case 'units-tracking': return 'Unit Tracking';
      case 'admin': return 'Admin Panel';
      case 'verify-email': return 'Email Verification';
      case 'pending-approval': return 'Pending Approval';
      case 'forgot-password': return 'Forgot Password';
      case 'reset-password': return 'Reset Password';
      default:
        // Convert kebab-case to title case
        return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    }
  };

  const getBreadcrumbIcon = (segment, index) => {
    switch (segment) {
      case 'dashboard': return '📊';
      case 'units-tracking': return '📍';
      case 'admin': return '🛡️';
      case 'verify-email': return '📧';
      case 'pending-approval': return '⏳';
      case 'forgot-password': return '🔐';
      case 'reset-password': return '🔄';
      default: return '📄';
    }
  };

  if (pathSegments.length === 0) {
    return null;
  }

  const breadcrumbPath = [];
  
  return (
    <nav style={{
      padding: 'var(--space-3) var(--space-6)',
      backgroundColor: 'var(--gray-50)',
      borderBottom: '1px solid var(--gray-200)',
      fontSize: 'var(--text-sm)'
    }}>
      <ol style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        margin: 0,
        padding: 0,
        listStyle: 'none',
        flexWrap: 'wrap'
      }}>
        {/* Home link */}
        <li>
          <Link 
            to="/"
            style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-md)',
              transition: 'all var(--transition-fast)',
              fontWeight: 'var(--font-medium)'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--gray-100)';
              e.target.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = 'var(--text-secondary)';
            }}
          >
            🏠 <span>Home</span>
          </Link>
        </li>

        {/* Dynamic breadcrumbs */}
        {pathSegments.map((segment, index) => {
          breadcrumbPath.push(segment);
          const isLast = index === pathSegments.length - 1;
          const path = `/${breadcrumbPath.join('/')}`;
          const label = getBreadcrumbLabel(segment, index);
          const icon = getBreadcrumbIcon(segment, index);

          return (
            <React.Fragment key={segment}>
              <li style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
                padding: '0 var(--space-1)'
              }}>
                {'>'}
              </li>
              <li>
                {isLast ? (
                  <span style={{
                    color: 'var(--text-primary)',
                    fontWeight: 'var(--font-semibold)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-1)',
                    padding: 'var(--space-1) var(--space-2)',
                    backgroundColor: 'var(--primary-blue-light)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)'
                  }}>
                    {icon} <span>{label}</span>
                  </span>
                ) : (
                  <Link 
                    to={path}
                    style={{
                      color: 'var(--text-secondary)',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-1)',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'all var(--transition-fast)',
                      fontWeight: 'var(--font-medium)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'var(--gray-100)';
                      e.target.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {icon} <span>{label}</span>
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
