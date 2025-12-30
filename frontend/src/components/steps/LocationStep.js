import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
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

function MapAutoCenter({ center, zoom = 13 }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, map, zoom]);
  
  return null;
}

function LocationPicker({ value, onChange }) {
  useMapEvents({
    click(e) {
      onChange([e.latlng.lat, e.latlng.lng]);
    },
  });

  return value ? (
    <Marker position={value}>
      <Popup>
        <div style={{ textAlign: 'center' }}>
          <strong>Emergency Location</strong>
          <br />
          {value[0].toFixed(6)}, {value[1].toFixed(6)}
        </div>
      </Popup>
    </Marker>
  ) : null;
}

const LOCATION_SUGGESTIONS = [
  {
    name: "Current Location",
    description: "Use your device's GPS location",
    icon: "📍",
    action: "getCurrentLocation"
  },
  {
    name: "Hospital Nearby",
    description: "Select from nearby medical facilities",
    icon: "🏥",
    action: "nearbyHospitals"
  },
  {
    name: "Police Station",
    description: "Select from nearby police stations",
    icon: "🚓",
    action: "nearbyPolice"
  },
  {
    name: "Fire Station",
    description: "Select from nearby fire stations",
    icon: "🔥",
    action: "nearbyFire"
  }
];

function LocationStep({ data, onUpdate, errors }) {
  const [location, setLocation] = useState(data.location);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const defaultCenter = [19.076, 72.8777]; // Mumbai coordinates
  const mapCenter = location || defaultCenter;

  useEffect(() => {
    setLocation(data.location);
  }, [data.location]);

  const handleLocationChange = (newLocation) => {
    setLocation(newLocation);
    onUpdate({ location: newLocation });
    setLocationError(null);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    setIsDetectingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newLocation = [latitude, longitude];
        handleLocationChange(newLocation);
        setIsDetectingLocation(false);
        
        // Show success message
        if (window.showSuccessToast) {
          window.showSuccessToast("Location detected", {
            description: "Your current location has been selected."
          });
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        let errorMessage = "Unable to fetch your location.";
        
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please allow permission or pick manually on the map.";
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case err.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
        }
        
        setLocationError(errorMessage);
        setIsDetectingLocation(false);
        
        if (window.showErrorToast) {
          window.showErrorToast("Location access denied", {
            description: errorMessage
          });
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 60000 
      }
    );
  };

  const handleLocationSuggestion = (suggestion) => {
    switch (suggestion.action) {
      case 'getCurrentLocation':
        handleUseCurrentLocation();
        break;
      case 'nearbyHospitals':
        // In a real app, this would fetch nearby hospitals
        console.log('Fetching nearby hospitals...');
        break;
      case 'nearbyPolice':
        // In a real app, this would fetch nearby police stations
        console.log('Fetching nearby police stations...');
        break;
      case 'nearbyFire':
        // In a real app, this would fetch nearby fire stations
        console.log('Fetching nearby fire stations...');
        break;
      default:
        break;
    }
    setShowSuggestions(false);
  };

  const formatLocationDisplay = (loc) => {
    if (!loc) return "No location selected";
    return `${loc[0].toFixed(6)}, ${loc[1].toFixed(6)}`;
  };

  const getAccuracyIndicator = () => {
    if (!location) return null;
    
    // In a real app, you would get actual GPS accuracy from the geolocation API
    return (
      <div className="location-accuracy">
        <span className="accuracy-icon">🎯</span>
        <span className="accuracy-text">High accuracy location</span>
      </div>
    );
  };

  return (
    <div className="location-step">
      <div className="form-section">
        <h2 className="form-section-title">
          📍 Where is the emergency located?
        </h2>
        <p className="form-help">
          Select the exact location of the emergency. This helps our response team find you quickly.
        </p>

        {/* Location Status */}
        <div className="location-status">
          <div className="status-card">
            <div className="status-icon">
              {location ? '✅' : '📍'}
            </div>
            <div className="status-content">
              <div className="status-title">
                {location ? 'Location Selected' : 'No Location Selected'}
              </div>
              <div className="status-description">
                {location ? formatLocationDisplay(location) : 'Click on the map or use the location buttons below'}
              </div>
              {getAccuracyIndicator()}
            </div>
          </div>
        </div>

        {/* Location Actions */}
        <div className="location-actions">
          <div className="action-buttons">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isDetectingLocation}
              className={`btn btn-primary location-btn ${isDetectingLocation ? 'btn-loading' : ''}`}
            >
              {isDetectingLocation ? (
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

            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="btn btn-outline location-btn"
            >
              🗺️ Location Options
              <span className={`arrow ${showSuggestions ? 'expanded' : ''}`}>
                {showSuggestions ? '▲' : '▼'}
              </span>
            </button>

            {location && (
              <button
                type="button"
                onClick={() => handleLocationChange(null)}
                className="btn btn-outline location-btn"
                style={{ color: 'var(--accent-red)' }}
              >
                🗑️ Clear Location
              </button>
            )}
          </div>

          {/* Location Suggestions Dropdown */}
          {showSuggestions && (
            <div className="location-suggestions">
              <h4 className="suggestions-title">Quick Location Options</h4>
              <div className="suggestions-grid">
                {LOCATION_SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    className="suggestion-item"
                    onClick={() => handleLocationSuggestion(suggestion)}
                  >
                    <span className="suggestion-icon">{suggestion.icon}</span>
                    <div className="suggestion-content">
                      <span className="suggestion-name">{suggestion.name}</span>
                      <span className="suggestion-description">{suggestion.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Location Error */}
        {locationError && (
          <div className="form-error location-error">
            <div className="error-icon">⚠️</div>
            <div className="error-content">
              <div className="error-title">Location Error</div>
              <div className="error-message">{locationError}</div>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div className="map-container-wrapper">
          <div className="map-instructions">
            <div className="instruction-item">
              <span className="instruction-icon">🖱️</span>
              <span className="instruction-text">Click anywhere on the map to select the emergency location</span>
            </div>
            {!location && (
              <div className="instruction-item highlight">
                <span className="instruction-icon">💡</span>
                <span className="instruction-text">Tip: Use "Use My Location" for automatic GPS detection</span>
              </div>
            )}
          </div>

          <div className="map-container" style={{ height: "450px", borderRadius: 'var(--radius-xl)' }}>
            <MapContainer
              center={mapCenter}
              zoom={location ? 15 : 12}
              style={{ height: "100%", width: "100%" }}
            >
              <MapAutoCenter center={location} zoom={15} />
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <LocationPicker value={location} onChange={handleLocationChange} />
            </MapContainer>
          </div>

          {location && (
            <div className="location-details">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Coordinates</span>
                  <span className="detail-value">{formatLocationDisplay(location)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Map View</span>
                  <span className="detail-value">📍 Zoomed to location</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Validation Error */}
        {errors.location && (
          <div className="form-error">
            {errors.location}
          </div>
        )}
      </div>

      {/* Additional Location Information */}
      <div className="form-section">
        <h3 className="form-section-title">
          🏠 Additional Location Details (Optional)
        </h3>
        <p className="form-help">
          Any specific details about the location that might help responders find the emergency
        </p>

        <div className="form-group">
          <label className="form-label" htmlFor="location-description">
            Location Description
          </label>
          <input
            type="text"
            id="location-description"
            className="form-control"
            placeholder="e.g., Building name, floor number, landmark, etc."
            value={data.locationDescription || ''}
            onChange={(e) => onUpdate({ locationDescription: e.target.value })}
          />
        </div>

        <div className="location-tips">
          <h4 className="tips-title">💡 Location Tips</h4>
          <ul className="tips-list">
            <li>Be as specific as possible about the location</li>
            <li>Include nearby landmarks or building names</li>
            <li>Mention floor numbers or room details if applicable</li>
            <li>Consider accessibility for emergency vehicles</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default LocationStep;
