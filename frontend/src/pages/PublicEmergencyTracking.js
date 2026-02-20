import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { emergencyAPI } from "../api";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const getServiceColor = (serviceType) => {
  switch (serviceType) {
    case "AMBULANCE":
      return "#dc3545";
    case "FIRE_TRUCK":
      return "#fd7e14";
    case "POLICE":
      return "#007bff";
    default:
      return "#2563eb";
  }
};

function routePointAtProgress(positions, progress) {
  if (!Array.isArray(positions) || positions.length === 0) return null;
  if (positions.length === 1) return positions[0];
  const clamped = Math.max(0, Math.min(1, progress || 0));
  if (clamped <= 0) return positions[0];
  if (clamped >= 1) return positions[positions.length - 1];

  const scaled = clamped * (positions.length - 1);
  const i = Math.floor(scaled);
  const t = scaled - i;
  const a = positions[i];
  const b = positions[i + 1];
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
}

export default function PublicEmergencyTracking() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let intervalId = null;
    let cancelled = false;

    const loadData = async (showLoading = false) => {
      try {
        if (showLoading && !cancelled) setLoading(true);
        const response = await emergencyAPI.getPublicTracking(token);
        if (!cancelled) {
          setData(response.data || null);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || "Unable to load tracking information");
        }
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    };

    loadData(true);
    intervalId = window.setInterval(() => loadData(false), 2000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [token]);

  const emergency = data?.emergency;
  const unit = data?.unit;
  const driver = data?.driver;
  const liveLocation = data?.unit_live_location;
  const routePositions = data?.route?.positions || [];
  const progress = typeof liveLocation?.progress === "number"
    ? Math.max(0, Math.min(1, liveLocation.progress))
    : 0;

  const unitPoint = useMemo(() => {
    const snappedOnRoute = routePointAtProgress(routePositions, progress);
    if (snappedOnRoute) return snappedOnRoute;
    if (liveLocation?.latitude != null && liveLocation?.longitude != null) {
      return [liveLocation.latitude, liveLocation.longitude];
    }
    return null;
  }, [liveLocation, routePositions, progress]);

  const mapCenter = useMemo(() => {
    if (unitPoint) return unitPoint;
    if (emergency?.latitude != null && emergency?.longitude != null) {
      return [emergency.latitude, emergency.longitude];
    }
    return [19.076, 72.8777];
  }, [unitPoint, emergency]);

  if (loading) return <div style={{ padding: 24 }}>Loading public tracking...</div>;
  if (error) return <div style={{ padding: 24, color: "#b91c1c" }}>{error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 10 }}>Emergency Tracking</h1>
      <p style={{ marginBottom: 12 }}>
        Incident #{emergency?.request_id} | Status: <strong>{emergency?.status}</strong>
      </p>
      {unit ? (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: "0 0 6px 0" }}>
            Assigned Unit: <strong>{unit.unit_vehicle_number}</strong> ({unit.service_type})
          </p>
          <p style={{ margin: "0 0 6px 0" }}>
            Driver: <strong>{driver?.name || "Not available yet"}</strong>
          </p>
          <p style={{ margin: 0 }}>
            Driver Phone:{" "}
            {driver?.phone ? (
              <a href={`tel:${driver.phone}`}>{driver.phone}</a>
            ) : (
              <strong>Not available yet</strong>
            )}
          </p>
        </div>
      ) : (
        <p style={{ marginBottom: 12 }}>No unit assigned yet. Please keep this page open.</p>
      )}

      <div style={{ height: 560, borderRadius: 12, overflow: "hidden" }}>
        <MapContainer center={mapCenter} zoom={14} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {routePositions.length > 1 && (
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: getServiceColor(unit?.service_type),
                weight: 6,
                opacity: 0.9,
              }}
            />
          )}

          {emergency?.latitude != null && emergency?.longitude != null && (
            <Marker position={[emergency.latitude, emergency.longitude]}>
              <Popup>
                <strong>Emergency Location</strong>
              </Popup>
            </Marker>
          )}

          {unitPoint && (
            <Marker
              position={unitPoint}
              icon={L.divIcon({
                className: "public-unit-live-marker",
                html: `
                  <div style="
                    width:36px;height:36px;border-radius:50%;
                    background:${getServiceColor(unit?.service_type)};
                    border:3px solid white;display:flex;align-items:center;justify-content:center;
                    box-shadow:0 2px 8px rgba(0,0,0,0.35);color:white;font-weight:700;
                  ">🚑</div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
              })}
            >
              <Popup>
                <strong>{unit?.unit_vehicle_number || "Assigned Unit"}</strong>
                <br />
                Status: {liveLocation?.status || unit?.status}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
