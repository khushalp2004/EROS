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
import { useAuth } from "../hooks/useAuth";
import EmergencyReportedPopup from "./EmergencyReportedPopup";
import Breadcrumbs from "./Breadcrumbs";
import "../styles/reporter-home.css";
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
  const { user } = useAuth();
  const [type, setType] = useState("Ambulance");
  const [position, setPosition] = useState(null); // [lat, lng]
  const [reporterPhoneLocal, setReporterPhoneLocal] = useState("");
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmergencyPopup, setShowEmergencyPopup] = useState(false);
  const [, setPublicTrackingUrl] = useState("");
  const [smsStatus, setSmsStatus] = useState("");

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
    if (!reporterPhoneLocal.trim()) {
      setMessage("Please enter your phone number.");
      return;
    }
    const reporterPhone = `+91${reporterPhoneLocal.trim()}`;

    setIsSubmitting(true);
    try {
      const [lat, lng] = position;
      const res = await api.post("/api/emergencies", {
        emergency_type: type,
        latitude: lat,
        longitude: lng,
        reporter_phone: reporterPhone,
      });

      console.log("Backend response:", res.data);
      setMessage("Emergency reported successfully! Authorities have been notified.");
      setPublicTrackingUrl("");
      const smsText = res.data?.sms_sent
        ? "SMS sent."
        : `SMS not sent: ${res.data?.sms_message || "Unknown error"}`;
      setSmsStatus(smsText);
      if (!res.data?.sms_sent && window.showWarningToast) {
        window.showWarningToast("Tracking SMS not sent", {
          description: res.data?.sms_message || "SMS provider is not configured."
        });
      }
      
      // Reset form
      setPosition(null);
      setType("Ambulance");
      setReporterPhoneLocal("");
      
      // Show different success feedback based on user role
      if (!user || user.role === 'reporter') {
        // Show popup for reporter users
        setShowEmergencyPopup(true);
      } else {
        // Show success toast for admin/authority users
        window.showSuccessToast("Emergency reported successfully!", {
          description: "Our emergency response team has been notified and will respond promptly."
        });
      }
      
    } catch (err) {
      console.error("AXIOS ERROR:", err);
      setMessage("Failed to report emergency. Please try again.");
      setPublicTrackingUrl("");
      setSmsStatus("");
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
      case 'ambulance': return 'Medical';
      case 'fire': return 'Fire';
      case 'police': return 'Police';
      default: return 'Emergency';
    }
  };

  return (
    <div className="dashboard-container report-page">
      <Breadcrumbs />

      <div className="dashboard-main report-shell">
        <section className="report-intro-card fade-in">
          <div className="report-intro-main">
            <h2 className="report-intro-title">Report Emergency</h2>
            <p className="report-intro-subtitle">
              Share type, contact, and location in under 30 seconds so the nearest team can be dispatched quickly.
            </p>
            <div className="report-urgent-banner">
              <span className="report-urgent-dot" aria-hidden="true"></span>
              If there is immediate danger, Dial on our National emergency number<b>112</b>
            </div>
          </div>
          <div className="report-intro-badges">
            <span className="report-badge">24/7 Dispatch</span>
            <span className="report-badge">Live Unit Routing</span>
            <span className="report-badge">Priority Triage</span>
          </div>
        </section>

        <div className="report-grid">
          <div className="report-card form-section fade-in">
            <h2 className="form-section-title">Emergency Details</h2>

            <form onSubmit={handleSubmit} className="report-form-layout">
              <div className="report-form-left">
                <div className="form-group">
                  <label className="form-label" htmlFor="emergency-type">
                    Emergency Type
                  </label>
                  <select
                    id="emergency-type"
                    className="form-control report-input"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="Ambulance">Ambulance - Medical Emergency</option>
                    <option value="Fire">Fire - Fire/Explosion Emergency</option>
                    <option value="Police">Police - Security/Crime Emergency</option>
                  </select>
                  <div className="form-help">
                    Select the emergency category to dispatch the correct team immediately.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reporter-phone">
                    Contact Number
                  </label>
                  <div className="report-phone-row">
                    <input
                      type="text"
                      className="form-control report-input report-phone-prefix"
                      value="+91"
                      readOnly
                    />
                    <input
                      id="reporter-phone"
                      type="tel"
                      className="form-control report-input"
                      value={reporterPhoneLocal}
                      onChange={(e) => setReporterPhoneLocal(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="Enter 10-digit mobile number"
                      required
                    />
                  </div>
                  <div className="form-help">
                    Dispatch can call you if rapid verification is needed.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Emergency Location</label>
                  <div className="form-help report-location-help">
                    {position
                      ? `Selected: ${position[0].toFixed(5)}, ${position[1].toFixed(5)}`
                      : "Select a point on the map to set the emergency location."}
                  </div>
                  {position && (
                    <div className="report-location-chip">
                      Location pinned and ready for dispatch.
                    </div>
                  )}

                  <div className="btn-group report-location-actions">
                    <button
                      type="button"
                      onClick={handleUseMyLocation}
                      disabled={locating}
                      className={`btn btn-outline ${locating ? 'btn-loading' : 'btn-icon'} report-location-btn`}
                    >
                      {locating ? (
                        <>
                          <div className="spinner"></div>
                          Detecting Location...
                        </>
                      ) : (
                        <>Use My Location</>
                      )}
                    </button>

                    {position && (
                      <button
                        type="button"
                        onClick={() => setPosition(null)}
                        className="btn btn-outline report-clear-location-btn"
                      >
                        Clear Location
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="report-form-map-panel">
                <label className="form-label report-map-label">Map View</label>
                <div className="map-container report-map-container">
                  <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>
                    <MapAutoCenter center={position} />
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Tiles &copy; Esri"
                    />
                    <LocationPicker value={position} onChange={setPosition} />
                  </MapContainer>
                </div>
                <div className="form-help report-map-help">
                  Click directly on the map to pin the incident location.
                </div>
              </div>

              <div className="form-group report-submit-group">
                <button
                  type="submit"
                  disabled={!position || isSubmitting}
                  className={`btn btn-primary btn-lg ${isSubmitting ? 'btn-loading' : 'btn-icon'} report-submit-btn`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="spinner"></div>
                      Reporting Emergency...
                    </>
                  ) : (
                    <>Report {getEmergencyTypeIcon(type)} Emergency</>
                  )}
                </button>

                {!position && (
                  <div className="form-help report-submit-help">
                    Please select a location on the map to continue.
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        <aside className="report-card report-help-card fade-in">
          <h3 className="report-help-title">What Happens After You Submit</h3>
          <div className="report-help-grid">
            <div><strong>1. Alert Created:</strong> Your report is sent to the live dispatch queue instantly.</div>
            <div><strong>2. Team Assigned:</strong> Nearest suitable response unit is notified.</div>
            <div><strong>3. Verification Call:</strong> You may receive a quick callback for details.</div>
            <div><strong>4. Stay Safe:</strong> Move to a safer nearby area while help is on the way.</div>
          </div>
        </aside>

        {message && (
          <div className={`fade-in report-status-message ${message.includes('successfully') ? 'success' : 'error'}`}>
            <div>{message}</div>
            {smsStatus && (
              <div className="report-status-subtext">
                {smsStatus}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Emergency Reported Popup - Only for reporter users */}
      <EmergencyReportedPopup
        message="Your emergency has been successfully reported to the authorities."
        isVisible={showEmergencyPopup}
        onClose={() => setShowEmergencyPopup(false)}
      />
    </div>
  );
}

export default AddEmergency;
