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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentLocation = useLocation();
  const navRootRef = React.useRef(null);
  const navLinksRef = React.useRef([]);
  const [indicatorStyle, setIndicatorStyle] = React.useState({ left: 0, width: 0, opacity: 0 });

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
  };

  const navItems = React.useMemo(() => {
    if (!isAuthenticated) {
      return [{ to: '/', label: 'Report Emergency' }];
    }

    if (user?.role === 'admin') {
      return [
        { to: '/', label: 'Reporters' },
        { to: '/admin', label: 'Approvals' },
      ];
    }

    if (user?.role === 'unit') {
      return [
        { to: '/', label: 'Reporters' },
        { to: '/unit', label: 'Unit Task' }
      ];
    }

    return [
      { to: '/', label: 'Reporter' },
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/units-tracking', label: 'Units Tracking' },
    ];
  }, [isAuthenticated, user?.role]);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentLocation.pathname]);

  React.useEffect(() => {
    if (!isAuthenticated && (currentLocation.search.includes('openLogin=true') || currentLocation.search.includes('passwordReset=true'))) {
      setLoginModalOpen(true);
    }
  }, [currentLocation.search, isAuthenticated]);

  React.useEffect(() => {
    const updateIndicator = () => {
      if (window.innerWidth <= 768) {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
        return;
      }

      const activeIndex = navItems.findIndex((item) => item.to === currentLocation.pathname);
      const activeEl = activeIndex >= 0 ? navLinksRef.current[activeIndex] : null;

      if (!activeEl) {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
        return;
      }

      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        opacity: 1
      });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [currentLocation.pathname, navItems]);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleOutsideClick = (event) => {
      if (!navRootRef.current) return;
      if (!navRootRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="enhanced-navigation" ref={navRootRef}>
      <button
        className={`nav-menu-toggle ${mobileMenuOpen ? 'open' : ''}`}
        type="button"
        aria-label="Toggle navigation menu"
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((prev) => !prev)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div className={`nav-collapse ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="nav-center">
          <div className="nav-links-group">
            <span
              className="nav-active-indicator"
              style={{
                transform: `translateX(${indicatorStyle.left}px)`,
                width: `${indicatorStyle.width}px`,
                opacity: indicatorStyle.opacity
              }}
              aria-hidden="true"
            />
            {navItems.map((item, index) => (
              <Link
                key={`${item.to}-${index}`}
                to={item.to}
                className={`nav-link ${currentLocation.pathname === item.to ? 'active' : ''}`}
                ref={(el) => { navLinksRef.current[index] = el; }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="nav-right">
          {isAuthenticated ? (
            <>
              <span className="nav-user-pill">
                {user?.role ? user.role.toUpperCase() : 'USER'}
              </span>
              <button onClick={handleLogout} className="logout-btn nav-logout-btn">Logout</button>
            </>
          ) : (
            <div className="auth-buttons">
              <button onClick={() => setSignupModalOpen(true)} className="signup-btn">Sign Up</button>
              <button onClick={() => setLoginModalOpen(true)} className="login-btn">Log In</button>
            </div>
          )}
        </div>
      </div>
      {mobileMenuOpen && (
        <button
          type="button"
          className="nav-mobile-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
      <SignupModal isOpen={signupModalOpen} onClose={() => setSignupModalOpen(false)} />
    </nav>
  );
}
