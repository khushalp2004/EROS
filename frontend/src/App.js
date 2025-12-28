import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { NotificationProvider } from "./hooks/useNotifications";
import { AuthProvider } from "./hooks/useAuth";
import { ToastContainer, toastManager } from "./components/ToastNotification";
import NotificationBadge from "./components/NotificationBadge";
import NotificationPanel from "./components/NotificationPanel";
import Navigation from "./components/Navigation";
import ProtectedRoute from "./components/ProtectedRoute";
import AddEmergency from "./components/AddEmergency";
import EmailVerification from "./components/EmailVerification";
import Dashboard from "./pages/Dashboard";
import UnitsTracking from "./pages/UnitsTracking";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import "./styles/design-system.css";

// Make toast functions globally available
window.showToast = (toast) => toastManager.addToast(toast);
window.showErrorToast = (message, options) => toastManager.addToast({ message, type: 'error', duration: 0, ...options });
window.showSuccessToast = (message, options) => toastManager.addToast({ message, type: 'success', duration: 3000, ...options });
window.showWarningToast = (message, options) => toastManager.addToast({ message, type: 'warning', duration: 5000, ...options });

function App() {
  const [notificationPanelOpen, setNotificationPanelOpen] = React.useState(false);

  return (
    <AuthProvider>
      <NotificationProvider userId={1}> {/* Default user ID for demo */}
        <Router>
          <div className="min-vh-100" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)' }}>
            {/* Header with Navigation and Notification Badge */}
            <header className="sticky-top" style={{
              backgroundColor: 'var(--bg-primary)',
              padding: 'var(--space-4) var(--space-6)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              zIndex: 'var(--z-sticky)',
              borderBottom: '1px solid var(--gray-200)'
            }}>
              {/* Logo/Brand */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-light))',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-lg)',
                  color: 'var(--text-inverse)',
                  boxShadow: 'var(--shadow-md)'
                }}>
                  🚨
                </div>
                <div>
                  <h1 style={{ 
                    margin: 0, 
                    fontSize: 'var(--text-xl)', 
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--text-primary)',
                    lineHeight: 1.2
                  }}>
                    EROS
                  </h1>
                  <p style={{ 
                    margin: 0, 
                    fontSize: 'var(--text-xs)', 
                    color: 'var(--text-muted)',
                    fontWeight: 'var(--font-medium)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Emergency Response System
                  </p>
                </div>
              </div>

              {/* Navigation Component */}
              <Navigation />
              
              {/* Notification Badge */}
              <NotificationBadge 
                onClick={() => setNotificationPanelOpen(true)}
                showText={false}
              />
            </header>

            {/* Main Content */}
            <main style={{ flex: 1 }}>
              <Routes>
                <Route path="/" element={<AddEmergency />} />
                <Route path="/verify-email/:token" element={<EmailVerification />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/units-tracking" element={<ProtectedRoute><UnitsTracking /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
              </Routes>
            </main>

            {/* Footer */}
            <footer style={{
              backgroundColor: 'var(--bg-primary)',
              borderTop: '1px solid var(--gray-200)',
              padding: 'var(--space-6)',
              textAlign: 'center',
              marginTop: 'auto'
            }}>
              <p style={{ 
                margin: 0, 
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)'
              }}>
                © 2024 EROS - Emergency Response Operating System | Built with ❤️ for public safety
              </p>
            </footer>
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
    </AuthProvider>
  );
}

export default App;
