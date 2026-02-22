import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { emergencyAPI } from "../api";
import "../styles/public-emergency-tracking.css";
import "../styles/map-chrome.css";

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

function MapInstanceBinder({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function MapFollowController({ center, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !center) return;
    map.flyTo(center, map.getZoom(), { animate: true, duration: 0.8 });
  }, [enabled, center, map]);
  return null;
}

function MapInteractionMonitor({ onUserMapMove }) {
  useMapEvents({
    dragstart: () => onUserMapMove(),
    zoomstart: () => onUserMapMove(),
  });
  return null;
}

export default function PublicEmergencyTracking() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [mapType, setMapType] = useState("satellite");
  const [followLive, setFollowLive] = useState(true);
  const [mapInstance, setMapInstance] = useState(null);

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
  const tileConfig = mapType === "satellite"
    ? {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Tiles &copy; Esri",
        subdomains: undefined,
      }
    : {
        url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
      };

  const handleRecenter = () => {
    if (!mapInstance) return;
    setFollowLive(true);
    mapInstance.setView(mapCenter, mapInstance.getZoom(), { animate: true });
  };

  if (loading) {
    return (
      <div className="public-track-loading-wrap">
        <div className="public-track-loading-spinner"></div>
        <div>Loading public tracking...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-track-page">
        <div className="public-track-shell">
          <section className="public-track-error-card">
            <h2>Tracking Unavailable</h2>
            <p>{error}</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="public-track-page">
      <div className="public-track-shell">
        <section className="public-track-hero">
          <div className="public-track-eyebrow">Live Public View</div>
          <h1>Emergency Tracking</h1>
          <p>Follow response progress in real-time and stay updated on assigned unit movement.</p>
        </section>

        <section className="public-track-kpi-row">
          <article className="public-track-kpi">
            <span>Incident</span>
            <strong>#{emergency?.request_id}</strong>
          </article>
          <article className="public-track-kpi">
            <span>Status</span>
            <strong>{emergency?.status || "Unknown"}</strong>
          </article>
          <article className="public-track-kpi">
            <span>Response Unit</span>
            <strong>{unit?.unit_vehicle_number || "Pending"} ({unit.service_type})</strong>
          </article>
          <article className="public-track-kpi">
            <span>Driver</span>
            <strong>{driver?.name || "Not available yet"}</strong>
          </article>

          <article className="public-track-kpi">
            <span>Driver Phone</span>
            <strong>{driver?.phone ? (
                  <a href={`tel:${driver.phone}`}>{driver.phone}</a>
                ) : (
                  <strong>Not available yet</strong>
                )}</strong>
          </article>
        </section>

        {/* <section className="public-track-contact-card">
          {unit ? (
            <div className="public-track-contact-grid">
              <p>
                <span>Driver</span>
                <strong>{driver?.name || "Not available yet"}</strong>
              </p>
              <p>
                <span>Driver Phone</span>
                {driver?.phone ? (
                  <a href={`tel:${driver.phone}`}>{driver.phone}</a>
                ) : (
                  <strong>Not available yet</strong>
                )}
              </p>
            </div>
          ) : (
            <p className="public-track-empty-note">No unit assigned yet. Please keep this page open.</p>
          )}
        </section> */}

        <section className="public-track-map-shell">
          <MapContainer center={mapCenter} zoom={14} className="public-track-map">
            <MapInstanceBinder onReady={setMapInstance} />
            <MapFollowController center={mapCenter} enabled={followLive} />
            <MapInteractionMonitor onUserMapMove={() => setFollowLive(false)} />
          <TileLayer
            url={tileConfig.url}
            attribution={tileConfig.attribution}
            {...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {})}
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

          <div className="gm-map-type-toggle">
            <button
              type="button"
              onClick={() => setMapType("road")}
              className={mapType === "road" ? "active" : ""}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setMapType("satellite")}
              className={mapType === "satellite" ? "active" : ""}
            >
              Satellite
            </button>
          </div>

          <div className="gm-map-controls">
            <button type="button" className="circle" onClick={handleRecenter}>◎</button>
            <button
              type="button"
              className={`mode-btn ${followLive ? "active" : ""}`}
              onClick={() => setFollowLive((v) => !v)}
            >
              {followLive ? "LIVE" : "PAUSED"}
            </button>
            <div className="gm-zoom-box">
              <button type="button" onClick={() => mapInstance?.zoomIn()}>+</button>
              <button type="button" onClick={() => mapInstance?.zoomOut()}>-</button>
            </div>
          </div>

        </section>
      </div>
    </div>
  );
}
