import React, { useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { unitAPI } from "../api";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Ensure marker icons load in bundlers
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapAutoCenter({ center }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

function LocationPicker({ value, onChange }) {
  useMapEvents({
    click(e) {
      onChange([e.latlng.lat, e.latlng.lng]);
    },
  });

  if (!value) return null;
  return (
    <Marker position={value}>
      <Popup>Selected location</Popup>
    </Marker>
  );
}

const AddUnit = ({ isOpen, onClose, onUnitAdded }) => {
  // Constants
  const VEHICLE_NUMBER_MIN_LENGTH = 3;
  const VEHICLE_NUMBER_MAX_LENGTH = 15;
  const DEFAULT_MAP_CENTER = [19.076, 72.8777]; // Mumbai coordinates
  const DEFAULT_MAP_ZOOM = 12;

  const [formData, setFormData] = useState({
    unit_vehicle_number: "",
    service_type: "",
    latitude: null,
    longitude: null
  });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [locating, setLocating] = useState(false);

  const serviceTypes = [
    { value: "AMBULANCE", label: "🚑 Ambulance", color: "#dc3545" },
    { value: "FIRE_TRUCK", label: "🚒 Fire Truck", color: "#fd7e14" },
    { value: "POLICE", label: "👮 Police", color: "#0d6efd" }
  ];

  // Calculate map center: use selected position if available, otherwise use default
  const mapCenter = selectedLocation ? [selectedLocation.latitude, selectedLocation.longitude] : DEFAULT_MAP_CENTER;
  const mapZoom = DEFAULT_MAP_ZOOM;

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (error) setError(null);
  }, [error]);

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

    if (formData.unit_vehicle_number.length < VEHICLE_NUMBER_MIN_LENGTH || formData.unit_vehicle_number.length > VEHICLE_NUMBER_MAX_LENGTH) {
      const errorMsg = `Vehicle number must be between ${VEHICLE_NUMBER_MIN_LENGTH} and ${VEHICLE_NUMBER_MAX_LENGTH} characters`;
      setError(errorMsg);
      if (window.showErrorToast) {
        window.showErrorToast("Invalid Vehicle Number", {
          description: errorMsg
        });
      }
      return false;
    }

    if (!formData.service_type) {
      const errorMsg = "Service type is required";
      setError(errorMsg);
      if (window.showErrorToast) {
        window.showErrorToast("Service Type Required", {
          description: errorMsg
        });
      }
      return false;
    }

    if (!formData.latitude || !formData.longitude) {
      const errorMsg = "Location must be selected from the map";
      setError(errorMsg);
      if (window.showErrorToast) {
        window.showErrorToast("Location Required", {
          description: errorMsg
        });
      }
      return false;
    }

    return true;
  };

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported in this browser.");
      window.showErrorToast("Geolocation not supported", {
        description: "Please enable location access or pick manually on the map."
      });
      return;
    }

    setLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const locationData = { latitude, longitude };

        setSelectedLocation(locationData);
        setFormData(prev => ({
          ...prev,
          latitude: latitude,
          longitude: longitude
        }));

        window.showSuccessToast("Location detected", {
          description: "Your current location has been selected."
        });

        setLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        let errorMessage = "Unable to fetch your location. ";

        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage += "Please allow location access or pick manually on the map.";
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage += "Location information is unavailable.";
            break;
          case err.TIMEOUT:
            errorMessage += "Location request timed out. Please try again.";
            break;
          default:
            errorMessage += "Please allow permission or pick manually on the map.";
            break;
        }

        setError(errorMessage);
        window.showErrorToast("Location access denied", {
          description: errorMessage
        });
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }, []);

  const handleClose = () => {
    setFormData({
      unit_vehicle_number: "",
      service_type: "",
      latitude: null,
      longitude: null
    });
    setSelectedLocation(null);
    setError(null);
    setSuccess(false);
    onClose && onClose();
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    if (window.showToast) {
      window.showToast({
        message: 'Creating unit...',
        description: `Adding ${formData.unit_vehicle_number} to the system`,
        type: 'info',
        duration: 2000
      });
    }

    try {
      const response = await unitAPI.createUnit(formData);

      if (response.data) {
        setSuccess(true);

        if (window.showSuccessToast) {
          window.showSuccessToast('Unit created successfully', {
            description: `${formData.unit_vehicle_number} has been added to the system and is ready for dispatch`
          });
        }

        setTimeout(() => {
          onUnitAdded && onUnitAdded(response.data.unit);
          handleClose();
        }, 1500);
      }
    } catch (err) {
      console.error("Error creating unit:", err);
      const errorMessage = err.response?.data?.error || "Failed to create unit";
      setError(errorMessage);

      if (window.showErrorToast) {
        window.showErrorToast('Failed to create unit', {
          description: errorMessage
        });
      }
    } finally {
      setLoading(false);
    }
  }, [formData, onUnitAdded, validateForm, handleClose]);

  const handleOpen = () => {
    if (window.showToast) {
      window.showToast({
        message: '🚛 Add New Unit',
        description: 'Fill in the details to add a new emergency response unit',
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
        padding: 'var(--space-4)',
      width: '85%',
      maxWidth: '700px',
      height: '90vh',
      overflow: 'hidden',
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
          paddingBottom: 'var(--space-2)'
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
              🚛 Add New Emergency Unit
            </h2>
            <p style={{
              margin: 'var(--space-2) 0 0 0',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)'
            }}>
              Add a new emergency response unit to the system
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
              Unit Created Successfully!
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              The new unit has been added to the system and is now available for dispatch.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              
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
                  Must be unique and between 3-15 characters
                </div>
              </div>

              {/* Service Type Selection */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Service Type *
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--space-3)'
                }}>
                  {serviceTypes.map((service) => (
                    <label
                      key={service.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3)',
                        border: `2px solid ${formData.service_type === service.value ? service.color : 'var(--gray-200)'}`,
                        borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer',
                        backgroundColor: formData.service_type === service.value ? `${service.color}10` : 'transparent',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input
                        type="radio"
                        name="service_type"
                        value={service.value}
                        checked={formData.service_type === service.value}
                        onChange={(e) => {
                          handleInputChange(e);
                          if (window.showToast) {
                            window.showToast({
                              message: `${service.label.split(' ')[0]} Service Selected`,
                              description: `Set to ${service.label.substring(2)}`,
                              type: 'info',
                              duration: 1500
                            });
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <span style={{
                        fontSize: 'var(--text-lg)',
                        width: '24px',
                        textAlign: 'center'
                      }}>
                        {service.label.split(' ')[0]}
                      </span>
                      <span style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--font-medium)',
                        color: 'var(--text-primary)'
                      }}>
                        {service.label.substring(2)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Location Selection Map */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Unit Location *
                </label>
                
                {/* Location Actions */}
                <div style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  flexWrap: 'wrap'
                }}>
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={locating}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      border: '1px solid var(--primary-blue)',
                      backgroundColor: locating ? 'var(--gray-200)' : 'transparent',
                      color: locating ? 'var(--text-muted)' : 'var(--primary-blue)',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      cursor: locating ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      opacity: locating ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      if (!locating) {
                        e.target.style.backgroundColor = 'var(--primary-blue)';
                        e.target.style.color = 'var(--text-inverse)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!locating) {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = 'var(--primary-blue)';
                      }
                    }}
                  >
                    {locating ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid transparent',
                          borderTop: '2px solid currentColor',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        Detecting Location...
                      </>
                    ) : (
                      <>
                        📍 Use My Location
                      </>
                    )}
                  </button>
                  
                  {selectedLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLocation(null);
                        setFormData(prev => ({
                          ...prev,
                          latitude: null,
                          longitude: null
                        }));
                        setError(null);
                        
                        if (window.showToast) {
                          window.showToast({
                            message: '📍 Location cleared',
                            description: 'Location has been removed, please select a new location',
                            type: 'info',
                            duration: 2000
                          });
                        }
                      }}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        border: '1px solid var(--accent-red)',
                        backgroundColor: 'transparent',
                        color: 'var(--accent-red)',
                        borderRadius: 'var(--radius-lg)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--font-medium)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = 'var(--accent-red)';
                        e.target.style.color = 'var(--text-inverse)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = 'var(--accent-red)';
                      }}
                    >
                      🗑️ Clear Location
                    </button>
                  )}
                </div>
                
                {/* Location Status */}
                <div style={{
                  marginBottom: 'var(--space-4)',
                  fontSize: 'var(--text-sm)',
                  color: selectedLocation ? 'var(--secondary-green)' : 'var(--text-secondary)'
                }}>
                  {selectedLocation
                    ? `📍 Selected: ${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
                    : "Click on the map below to set unit location or use 'Use My Location' button"}
                </div>
                
                <div style={{
                  height: '250px',
                  border: '2px solid var(--gray-200)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <MapAutoCenter center={selectedLocation ? [selectedLocation.latitude, selectedLocation.longitude] : null} />
                    <TileLayer 
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <LocationPicker 
                      value={selectedLocation ? [selectedLocation.latitude, selectedLocation.longitude] : null} 
                      onChange={(coords) => {
                        const [lat, lng] = coords;
                        setSelectedLocation({ latitude: lat, longitude: lng });
                        setFormData(prev => ({
                          ...prev,
                          latitude: lat,
                          longitude: lng
                        }));
                        
                        if (window.showToast) {
                          window.showToast({
                            message: '📍 Location selected',
                            description: `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                            type: 'info',
                            duration: 2000
                          });
                        }
                      }} 
                    />
                  </MapContainer>
                  
                  {!selectedLocation && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: 'var(--bg-overlay)',
                      backdropFilter: 'blur(8px)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      textAlign: 'center',
                      border: '1px solid var(--gray-200)',
                      zIndex: 1000
                    }}>
                      <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>
                        📍
                      </div>
                      <div style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--font-medium)',
                        color: 'var(--text-primary)'
                      }}>
                        Click on map to set unit location
                      </div>
                    </div>
                  )}
                </div>
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
                    backgroundColor: 'var(--primary-blue)',
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
                  {loading ? 'Creating...' : 'Create Unit'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddUnit;
