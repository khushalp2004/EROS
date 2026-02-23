import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Navigation from "./components/Navigation";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthorityProtectedRoute from "./components/AuthorityProtectedRoute";
import AddEmergency from "./components/AddEmergency";
import EmailVerification from "./components/EmailVerification";
import Dashboard from "./pages/Dashboard";
import UnitsTracking from "./pages/UnitsTracking";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTrafficSimulation from "./pages/AdminTrafficSimulation";
import UnitDashboard from "./pages/UnitDashboard";
import PublicEmergencyTracking from "./pages/PublicEmergencyTracking";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import UnitProtectedRoute from "./components/UnitProtectedRoute";
import PendingApproval from "./pages/PendingApproval";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import "./styles/design-system.css";

// Disable all toast/notification popups globally.
window.showToast = () => {};
window.showErrorToast = () => {};
window.showSuccessToast = () => {};
window.showWarningToast = () => {};

function RouteMetaManager() {
  const location = useLocation();

  React.useEffect(() => {
    const routeMeta = {
      "/": {
        title: "Report Emergency | EROS",
        description: "Report emergencies quickly and connect with emergency response teams in real time."
      },
      "/dashboard": {
        title: "Dashboard | EROS",
        description: "Monitor emergencies, dispatch units, and track response progress from the command dashboard."
      },
      "/units-tracking": {
        title: "Units Tracking | EROS",
        description: "Track emergency response units and routes with live map updates."
      },
      "/admin": {
        title: "Admin | EROS",
        description: "Manage platform approvals, accounts, and administration settings."
      },
      "/admin/traffic": {
        title: "Traffic Simulation | EROS",
        description: "Configure manual traffic jam segments for dispatch route simulation."
      },
      "/unit": {
        title: "Unit Task | EROS",
        description: "View assigned emergency tasks and route details for response units."
      },
      "/forgot-password": {
        title: "Forgot Password | EROS",
        description: "Recover your EROS account access securely."
      },
      "/pending-approval": {
        title: "Pending Approval | EROS",
        description: "Your account is under review by the EROS admin team."
      }
    };

    const isTrackPage = location.pathname.startsWith("/track/");
    const isVerifyEmailPage = location.pathname.startsWith("/verify-email/");
    const isResetPasswordPage = location.pathname.startsWith("/reset-password/");

    const fallbackMeta = {
      title: "EROS - Emergency Response & Optimization System",
      description: "EROS emergency response platform for reporting, dispatch, and real-time unit tracking."
    };

    const metaForRoute = isTrackPage
      ? {
          title: "Emergency Tracking | EROS",
          description: "Track live emergency response status, assigned unit movement, and route progress."
        }
      : isVerifyEmailPage
      ? {
          title: "Verify Email | EROS",
          description: "Verify your EROS account email address."
        }
      : isResetPasswordPage
      ? {
          title: "Reset Password | EROS",
          description: "Set a new password for your EROS account."
        }
      : routeMeta[location.pathname] || fallbackMeta;

    document.title = metaForRoute.title;

    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute("content", metaForRoute.description);

    let faviconTag = document.querySelector('link[rel="icon"]');
    if (!faviconTag) {
      faviconTag = document.createElement("link");
      faviconTag.setAttribute("rel", "icon");
      document.head.appendChild(faviconTag);
    }
    faviconTag.setAttribute("href", "/eros-logo.png");
    faviconTag.setAttribute("type", "image/png");
  }, [location.pathname]);

  return null;
}

function AppContent() {
  return (
    <Router>
      <RouteMetaManager />
      <div
        className="min-vh-100"
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header with Navigation and Notification Badge */}
        <header className="sticky-top" style={{
          backgroundColor: 'var(--bg-primary)',
          padding: '14px 16px',
          boxShadow: '0 8px 22px rgba(15, 23, 42, 0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 'var(--z-sticky)',
          borderBottom: '1px solid var(--gray-200)'
        }}>
          <div style={{
            maxWidth: '1600px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            width: '100%'
          }}>
            {/* Logo/Brand */}
            <Link
              to="/"
              style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
                textDecoration: 'none',
                flex: '0 0 auto'
              }}
              aria-label="Go to Home"
            >
              <img
                src="/eros-logo.png"
                alt="EROS logo"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  objectFit: 'cover',
                  boxShadow: 'var(--shadow-sm)'
                }}
              />
              <div>
                <h1 style={{ 
                margin: 0, 
                fontSize: '18px', 
                fontWeight: 'var(--font-bold)',
                color: 'var(--text-primary)',
                lineHeight: 1.2
              }}>
                EROS
                </h1>
                <p style={{ 
                margin: 0, 
                fontSize: '6px', 
                color: 'var(--text-muted)',
                fontWeight: 'var(--font-medium)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                  Emergency Response & Optimization System
                </p>
              </div>
            </Link>

            {/* Navigation Component */}
            <Navigation />
          </div>
        </header>

        {/* Main Content */}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<AddEmergency />} />
            <Route path="/verify-email/:token" element={<EmailVerification />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/dashboard" element={<AuthorityProtectedRoute><Dashboard /></AuthorityProtectedRoute>} />
            <Route path="/units-tracking" element={<AuthorityProtectedRoute><UnitsTracking /></AuthorityProtectedRoute>} />
            <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
            <Route path="/admin/traffic" element={<AdminProtectedRoute><AdminTrafficSimulation /></AdminProtectedRoute>} />
            <Route path="/unit" element={<UnitProtectedRoute><UnitDashboard /></UnitProtectedRoute>} />
            <Route path="/track/:token" element={<PublicEmergencyTracking />} />
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
            © 2025 EROS - Emergency Response & Optimization System | Built with ❤️ for public safety
          </p>
        </footer>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
