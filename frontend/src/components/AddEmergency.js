import React, { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import api from "../api";
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

function AddEmergency() {
  const [type, setType] = useState("Ambulance");
  const [position, setPosition] = useState(null); // [lat, lng]
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate map center: use selected position if available, otherwise use default
  const defaultCenter = [19.076, 72.8777]; // Mumbai coordinates
  const mapCenter = position || defaultCenter;
  const mapZoom = 12;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!position) {
      setMessage("Please pick a location on the map.");
      return;
    }

    setIsSubmitting(true);
    try {
      const [lat, lng] = position;
      const res = await api.post("/emergencies", {
        emergency_type: type,
        latitude: lat,
        longitude: lng,
      });

      console.log("Backend response:", res.data);
      setMessage("Emergency reported successfully! Authorities have been notified.");
      
      // Reset form
      setPosition(null);
      setType("Ambulance");
      
      // Show success toast
      window.showSuccessToast("Emergency reported successfully!", {
        description: "Our emergency response team has been notified and will respond promptly."
      });
      
    } catch (err) {
      console.error("AXIOS ERROR:", err);
      setMessage("Failed to report emergency. Please try again.");
      window.showErrorToast("Failed to report emergency", {
        description: "Please check your connection and try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation not supported in this browser.");
      window.showErrorToast("Geolocation not supported", {
        description: "Please enable location access or pick manually on the map."
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        setMessage("Location set from your device.");
        window.showSuccessToast("Location detected", {
          description: "Your current location has been selected."
        });
        setLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setMessage("Unable to fetch your location. Please allow permission or pick on the map.");
        window.showErrorToast("Location access denied", {
          description: "Please allow location access or pick manually on the map."
        });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const getEmergencyTypeIcon = (emergencyType) => {
    switch (emergencyType.toLowerCase()) {
      case 'ambulance': return '🚑';
      case 'fire': return '🚒';
      case 'police': return '🚓';
      default: return '🚨';
    }
  };

  return (
    <div style={{ padding: "var(--space-6)", backgroundColor: "var(--bg-secondary)", minHeight: "calc(100vh - 200px)" }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="container">
          <h1 className="page-title">
            🚨 Report Emergency
          </h1>
          <p className="page-subtitle">
            Quickly report an emergency and get immediate assistance from our response team
          </p>
        </div>
      </div>

      <div className="container">
        <div className="form-section fade-in">
          <h2 className="form-section-title">
            📋 Emergency Details
          </h2>
          
          <form onSubmit={handleSubmit}>
            {/* Emergency Type Selection */}
            <div className="form-group">
              <label className="form-label" htmlFor="emergency-type">
                Emergency Type
              </label>
              <select
                id="emergency-type"
                className="form-control"
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ 
                  fontSize: 'var(--text-base)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--gray-300)'
                }}
              >
                <option value="Ambulance">🚑 Ambulance - Medical Emergency</option>
                <option value="Fire">🚒 Fire - Fire/Explosion Emergency</option>
                <option value="Police">🚓 Police - Security/Crime Emergency</option>
              </select>
              <div className="form-help">
                Select the type of emergency to ensure the right response team is dispatched
              </div>
            </div>

            {/* Location Selection */}
            <div className="form-group">
              <label className="form-label">
                📍 Emergency Location
              </label>
              <div className="form-help" style={{ marginBottom: 'var(--space-4)' }}>
                {position
                  ? `Selected: ${position[0].toFixed(5)}, ${position[1].toFixed(5)}`
                  : "Click on the map below to set the emergency location"}
              </div>
              
              {/* Location Actions */}
              <div className="btn-group" style={{ marginBottom: 'var(--space-4)' }}>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  className={`btn btn-outline ${locating ? 'btn-loading' : 'btn-icon'}`}
                  style={{
                    borderColor: 'var(--primary-blue)',
                    color: 'var(--primary-blue)',
                    fontSize: 'var(--text-sm)'
                  }}
                >
                  {locating ? (
                    <>
                      <div className="spinner"></div>
                      Detecting Location...
                    </>
                  ) : (
                    <>
                      📍 Use My Location
                    </>
                  )}
                </button>
                
                {position && (
                  <button
                    type="button"
                    onClick={() => setPosition(null)}
                    className="btn btn-outline"
                    style={{ color: 'var(--accent-red)' }}
                  >
                    🗑️ Clear Location
                  </button>
                )}
              </div>

              {/* Map Container */}
              <div className="map-container" style={{ height: "400px", borderRadius: 'var(--radius-xl)' }}>
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: "100%", width: "100%" }}
                >
                  <MapAutoCenter center={position} />
                  <TileLayer 
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <LocationPicker value={position} onChange={setPosition} />
                </MapContainer>
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-group" style={{ marginTop: 'var(--space-8)' }}>
              <button
                type="submit"
                disabled={!position || isSubmitting}
                className={`btn btn-primary btn-lg ${isSubmitting ? 'btn-loading' : 'btn-icon'}`}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontSize: 'var(--text-lg)',
                  padding: 'var(--space-4) var(--space-6)',
                  background: position ? 
                    'linear-gradient(135deg, var(--accent-red), var(--accent-red-light))' : 
                    'var(--gray-400)',
                  cursor: position ? 'pointer' : 'not-allowed'
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner"></div>
                    Reporting Emergency...
                  </>
                ) : (
                  <>
                    🚨 Report {getEmergencyTypeIcon(type)} Emergency
                  </>
                )}
              </button>
              
              {!position && (
                <div className="form-help" style={{ textAlign: 'center', marginTop: 'var(--space-2)' }}>
                  ⚠️ Please select a location on the map to continue
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Help Section */}
        <div className="card" style={{ marginTop: 'var(--space-6)', padding: 'var(--space-6)' }}>
          <h3 style={{ 
            fontSize: 'var(--text-lg)', 
            fontWeight: 'var(--font-semibold)', 
            margin: '0 0 var(--space-4) 0',
            color: 'var(--text-primary)'
          }}>
            🆘 Emergency Response Information
          </h3>
          <div style={{ 
            display: 'grid', 
            gap: 'var(--space-4)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)'
          }}>
            <div>
              <strong>Response Time:</strong> Average 8-12 minutes for urban areas
            </div>
            <div>
              <strong>What to Expect:</strong> Our dispatch team will contact you within 2 minutes
            </div>
            <div>
              <strong>Stay Safe:</strong> Move to a safe location if possible while waiting for help
            </div>
            <div>
              <strong>Emergency Hotline:</strong> For immediate assistance, call 911
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className="fade-in" style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: message.includes('successfully') ? 'var(--secondary-green)' : 'var(--accent-red)',
            color: 'var(--text-inverse)',
            textAlign: 'center',
            fontWeight: 'var(--font-medium)'
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default AddEmergency;
