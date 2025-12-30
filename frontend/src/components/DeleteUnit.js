import React, { useState } from "react";
import { unitAPI } from "../api";

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

  const handleOpen = () => {
    if (window.showToast) {
      window.showToast({
        message: '🗑️ Delete Emergency Unit',
        description: 'Enter the vehicle number to permanently remove from system',
        type: 'info',
        duration: 3000
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--gray-200)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-6)',
          borderBottom: '1px solid var(--gray-200)',
          paddingBottom: 'var(--space-4)'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              🗑️ Delete Emergency Unit
            </h2>
            <p style={{
              margin: 'var(--space-2) 0 0 0',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)'
            }}>
              Delete an emergency response unit by vehicle number
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 'var(--text-lg)',
              cursor: 'pointer',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'var(--gray-100)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            ✕
          </button>
        </div>

        {success ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--secondary-green)'
          }}>
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
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-6)'
          }}>
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
            <div style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleCancelDelete}
                disabled={loading}
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  border: '1px solid var(--gray-300)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={loading}
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  border: 'none',
                  backgroundColor: 'var(--accent-red)',
                  color: 'var(--text-inverse)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}
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
          <form onSubmit={handleDeleteClick}>
            <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
              
              {/* Vehicle Number Input */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Vehicle Number Plate *
                </label>
                <input
                  type="text"
                  name="unit_vehicle_number"
                  value={formData.unit_vehicle_number}
                  onChange={handleInputChange}
                  placeholder="e.g., ABC-1234, FIRE-001"
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    border: '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-base)',
                    backgroundColor: 'var(--bg-primary)'
                  }}
                  maxLength={15}
                />
                <div style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  marginTop: 'var(--space-1)'
                }}>
                  Enter the exact vehicle number you want to delete
                </div>
              </div>

              {/* Warning Message */}
              <div style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--accent-red)',
                color: 'var(--text-inverse)',
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}>
                <span>⚠️</span>
                <span>This action will permanently delete the vehicle and all associated data.</span>
              </div>

              {/* Error Display */}
              {error && (
                <div style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--accent-red)',
                  color: 'var(--text-inverse)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: 'var(--text-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}>
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: 'var(--space-3)',
                justifyContent: 'flex-end',
                borderTop: '1px solid var(--gray-200)',
                paddingTop: 'var(--space-4)',
                marginTop: 'var(--space-4)'
              }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  style={{
                    padding: 'var(--space-3) var(--space-6)',
                    border: '1px solid var(--gray-300)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: 'var(--space-3) var(--space-6)',
                    border: 'none',
                    backgroundColor: 'var(--accent-red)',
                    color: 'var(--text-inverse)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)'
                  }}
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
