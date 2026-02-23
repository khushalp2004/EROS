import React, { useState } from "react";
import { unitAPI } from "../api";
import "../styles/unit-modals.css";

const DeleteUnit = ({ isOpen, onClose, onUnitDeleted }) => {
  const [formData, setFormData] = useState({
    unit_vehicle_number: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value.toUpperCase().trim()
    }));
    
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const validateForm = () => {
    if (!formData.unit_vehicle_number.trim()) {
      const errorMsg = "Vehicle number is required";
      setError(errorMsg);
      if (window.showErrorToast) {
        window.showErrorToast("Validation Error", {
          description: errorMsg
        });
      }
      return false;
    }
    
    if (formData.unit_vehicle_number.length < 3 || formData.unit_vehicle_number.length > 15) {
      const errorMsg = "Vehicle number must be between 3 and 15 characters";
      setError(errorMsg);
      if (window.showErrorToast) {
        window.showErrorToast("Invalid Vehicle Number", {
          description: errorMsg
        });
      }
      return false;
    }
    
    return true;
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // Show confirmation dialog
    if (window.showToast) {
      window.showToast({
        message: '⚠️ Deletion confirmation required',
        description: `Please confirm the deletion of ${formData.unit_vehicle_number}`,
        type: 'warning',
        duration: 3000
      });
    }
    
    setShowConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirmation(false);
    setLoading(true);
    setError(null);
    
    if (window.showToast) {
      window.showToast({
        message: '🗑️ Deleting vehicle...',
        description: `Removing ${formData.unit_vehicle_number} from the system`,
        type: 'info',
        duration: 2000
      });
    }
    
    try {
      const response = await unitAPI.deleteUnitByVehicleNumber(formData.unit_vehicle_number);
      
      if (response.data) {
        setSuccess(true);
        
        if (window.showSuccessToast) {
          window.showSuccessToast('Vehicle deleted successfully', {
            description: `${formData.unit_vehicle_number} has been permanently removed from the system`
          });
        }
        
        setTimeout(() => {
          onUnitDeleted && onUnitDeleted(response.data.deleted_unit);
          handleClose();
        }, 1500);
      }
    } catch (err) {
      console.error("Error deleting unit:", err);
      const errorMessage = err.response?.data?.error || "Failed to delete unit";
      setError(errorMessage);
      
      if (window.showErrorToast) {
        window.showErrorToast('Failed to delete vehicle', {
          description: errorMessage
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmation(false);
    
    if (window.showToast) {
      window.showToast({
        message: 'Delete cancelled',
        description: 'Vehicle deletion was cancelled, no changes made',
        type: 'info',
        duration: 2000
      });
    }
  };

  const handleClose = () => {
    setFormData({
      unit_vehicle_number: ""
    });
    setError(null);
    setSuccess(false);
    setShowConfirmation(false);
    onClose && onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="unit-modal-overlay">
      <div className="unit-modal-card compact">
        {/* Header */}
        <div className="unit-modal-head">
          <div>
            <h2 className="unit-modal-title">
              <span className="unit-modal-title-icon" aria-hidden="true">🗑️</span>
              Delete Emergency Unit
            </h2>
            <p className="unit-modal-subtitle">
              Delete an emergency response unit by vehicle number
            </p>
          </div>
          <button
            onClick={handleClose}
            className="unit-modal-close"
            aria-label="Close delete unit modal"
            type="button"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="unit-modal-confirm">
            <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-4)' }}>
              ✅
            </div>
            <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-lg)' }}>
              Unit Deleted Successfully!
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              The vehicle has been permanently removed from the system.
            </p>
          </div>
        ) : showConfirmation ? (
          <div className="unit-modal-confirm">
            <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-4)' }}>
              ⚠️
            </div>
            <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-lg)', color: 'var(--accent-red)' }}>
              Confirm Deletion
            </h3>
            <p style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Are you sure you want to delete vehicle <strong>{formData.unit_vehicle_number}</strong>?<br/>
              This action cannot be undone.
            </p>
            <div className="unit-modal-actions">
              <button
                onClick={handleCancelDelete}
                disabled={loading}
                className="unit-modal-btn secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={loading}
                className="unit-modal-btn danger"
              >
                {loading && (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid currentColor',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
                {loading ? 'Deleting...' : 'Delete Vehicle'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDeleteClick} className="unit-modal-form">
            <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
              
              {/* Vehicle Number Input */}
              <div className="unit-modal-field">
                <label className="unit-modal-label">
                  Vehicle Number Plate *
                </label>
                <input
                  type="text"
                  name="unit_vehicle_number"
                  value={formData.unit_vehicle_number}
                  onChange={handleInputChange}
                  placeholder="e.g., ABC-1234, FIRE-001"
                  className="unit-modal-input"
                  maxLength={15}
                />
                <div className="unit-modal-note">
                  Enter the exact vehicle number you want to delete
                </div>
              </div>

              {/* Warning Message */}
              <div className="unit-modal-alert warning">
                <span>⚠️</span>
                <span>This action will permanently delete the vehicle and all associated data.</span>
              </div>

              {/* Error Display */}
              {error && (
                <div className="unit-modal-alert error">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="unit-modal-actions">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="unit-modal-btn secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="unit-modal-btn danger"
                >
                  {loading && (
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid transparent',
                      borderTop: '2px solid currentColor',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  )}
                  {loading ? 'Validating...' : 'Delete Vehicle'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default DeleteUnit;
