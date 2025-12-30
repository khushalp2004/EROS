import React, { useState, useEffect } from 'react';

const EmergencyReportedPopup = ({ message, isVisible, onClose, duration = 4000 }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      // Auto-hide after duration
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  const handleClose = () => {
    setShow(false);
    setTimeout(() => {
      onClose?.();
    }, 300); // Wait for fade out animation
  };

  if (!show) return null;

  return (
    <div className="emergency-reported-popup-overlay">
      <div className="emergency-reported-popup">
        <div className="popup-header">
          <div className="popup-icon">🚨</div>
          <h3 className="popup-title">Emergency Reported</h3>
        </div>
        <div className="popup-content">
          <p className="popup-message">{message || 'Your emergency has been successfully reported to the authorities.'}</p>
        </div>
        <div className="popup-actions">
          <button onClick={handleClose} className="popup-btn primary">
            OK
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .emergency-reported-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease-in-out;
        }
        
        .emergency-reported-popup {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          max-width: 400px;
          width: 90%;
          animation: slideUp 0.3s ease-in-out;
        }
        
        .popup-header {
          padding: 24px 24px 16px;
          text-align: center;
          border-bottom: 1px solid #e5e5e5;
        }
        
        .popup-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        
        .popup-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }
        
        .popup-content {
          padding: 16px 24px;
        }
        
        .popup-message {
          margin: 0;
          font-size: 16px;
          line-height: 1.5;
          color: #666;
          text-align: center;
        }
        
        .popup-actions {
          padding: 16px 24px 24px;
          text-align: center;
        }
        
        .popup-btn {
          padding: 12px 32px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .popup-btn.primary {
          background: #007bff;
          color: white;
        }
        
        .popup-btn.primary:hover {
          background: #0056b3;
          transform: translateY(-1px);
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default EmergencyReportedPopup;
