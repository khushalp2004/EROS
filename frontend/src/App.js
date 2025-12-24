import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { NotificationProvider } from "./hooks/useNotifications";
import { ToastContainer, toastManager } from "./components/ToastNotification";
import NotificationBadge from "./components/NotificationBadge";
import NotificationPanel from "./components/NotificationPanel";
import AddEmergency from "./components/AddEmergency";
import Dashboard from "./pages/Dashboard";
import UnitsTracking from "./pages/UnitsTracking";

// Make toast functions globally available
window.showToast = (toast) => toastManager.addToast(toast);
window.showErrorToast = (message, options) => toastManager.addToast({ message, type: 'error', duration: 0, ...options });
window.showSuccessToast = (message, options) => toastManager.addToast({ message, type: 'success', duration: 3000, ...options });
window.showWarningToast = (message, options) => toastManager.addToast({ message, type: 'warning', duration: 5000, ...options });

function App() {
  const [notificationPanelOpen, setNotificationPanelOpen] = React.useState(false);

  return (
    <NotificationProvider userId={1}> {/* Default user ID for demo */}
      <Router>
        <div style={{ minHeight: '100vh', backgroundColor: '#f6f8fb' }}>
          {/* Header with Navigation and Notification Badge */}
          <div style={{
            backgroundColor: 'white',
            padding: '16px 24px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <Link 
                to="/" 
                style={{
                  textDecoration: 'none',
                  color: '#374151',
                  fontWeight: '500',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Reporter
              </Link>
              <Link 
                to="/dashboard" 
                style={{
                  textDecoration: 'none',
                  color: '#374151',
                  fontWeight: '500',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Dashboard
              </Link>
              <Link 
                to="/units-tracking" 
                style={{
                  textDecoration: 'none',
                  color: '#374151',
                  fontWeight: '500',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Units Tracking
              </Link>
            </nav>
            
            {/* Notification Badge */}
            <NotificationBadge 
              onClick={() => setNotificationPanelOpen(true)}
              showText={false}
            />
          </div>

          {/* Main Content */}
          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<AddEmergency />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/units-tracking" element={<UnitsTracking />} />
            </Routes>
          </div>
        </div>

        {/* Toast Notifications */}
        <ToastContainer />

        {/* Notification Panel */}
        <NotificationPanel 
          isOpen={notificationPanelOpen}
          onClose={() => setNotificationPanelOpen(false)}
        />
      </Router>
    </NotificationProvider>
  );
}

export default App;
