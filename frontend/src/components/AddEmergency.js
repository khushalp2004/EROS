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

    try {
      const [lat, lng] = position;
      const res = await api.post("/emergencies", {
        emergency_type: type,
        latitude: lat,
        longitude: lng,
      });

      console.log("Backend response:", res.data);
      setMessage("Emergency saved successfully");
    } catch (err) {
      console.error("AXIOS ERROR:", err);
      setMessage("Frontend error");
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation not supported in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);
        setMessage("Location set from your device.");
        setLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setMessage("Unable to fetch your location. Please allow permission or pick on the map.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Report an Emergency</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "10px" }}>
          <label>Type: </label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option>Ambulance</option>
            <option>Fire</option>
            <option>Police</option>
          </select>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <p style={{ margin: "6px 0" }}>
            {position
              ? `Selected: ${position[0].toFixed(5)}, ${position[1].toFixed(5)}`
              : "Click on the map to set location"}
          </p>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            style={{ marginBottom: "10px" }}
          >
            {locating ? "Locating..." : "Use my location"}
          </button>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "400px" }}
          >
            <MapAutoCenter center={position} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationPicker value={position} onChange={setPosition} />
          </MapContainer>
        </div>

        <button type="submit" style={{ marginTop: "10px" }}>
          Submit
        </button>
      </form>
      {message && <p style={{ marginTop: "10px" }}>{message}</p>}
    </div>
  );
}

export default AddEmergency;
