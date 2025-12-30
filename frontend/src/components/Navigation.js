import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import SignupModal from './SignupModal';
import '../styles/navigation.css';

export default function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  const currentLocation = useLocation();

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="enhanced-navigation">
      <div className="nav-left">
        <Link to="/" className="nav-logo">EROS</Link>
      </div>

      <div className="nav-center">
        {isAuthenticated ? (
          user?.role === 'admin' ? (
            <>
              <Link to="/" className={`nav-link ${currentLocation.pathname === '/' ? 'active' : ''}`}>Reporters</Link>
              <Link to="/admin" className={`nav-link ${currentLocation.pathname === '/admin' ? 'active' : ''}`}>Approvals</Link>
              <button onClick={handleLogout} className="nav-link logout-link">Logout</button>
            </>
          ) : (
            <>
              <Link to="/" className={`nav-link ${currentLocation.pathname === '/' ? 'active' : ''}`}>Reporter</Link>
              <Link to="/dashboard" className={`nav-link ${currentLocation.pathname === '/dashboard' ? 'active' : ''}`}>Dashboard</Link>
              <Link to="/units-tracking" className={`nav-link ${currentLocation.pathname === '/units-tracking' ? 'active' : ''}`}>Units Tracking</Link>
              <button onClick={handleLogout} className="nav-link logout-link">Logout</button>
            </>
          )
        ) : (
          <>
            <Link to="/" className={`nav-link ${currentLocation.pathname === '/' ? 'active' : ''}`}>Reporter</Link>
          </>
        )}
      </div>

      <div className="nav-right">
        {isAuthenticated ? (
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        ) : (
          <div className="auth-buttons">
            <button onClick={() => setSignupModalOpen(true)} className="signup-btn">Sign Up</button>
            <button onClick={() => setLoginModalOpen(true)} className="login-btn">Log In</button>
          </div>
        )}
      </div>

      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
      <SignupModal isOpen={signupModalOpen} onClose={() => setSignupModalOpen(false)} />
    </nav>
  );
}
