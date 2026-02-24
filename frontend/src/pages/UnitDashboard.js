import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unitTaskAPI } from '../api';
import Breadcrumbs from '../components/Breadcrumbs';
import { connectionManager, useWebSocketManager } from '../hooks/useWebSocketManager';
import backendRouteManager from '../utils/BackendRouteManager';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/unit-dashboard.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function MapInstanceBinder({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

function MapFollowController({ center, enabled, drivingMode, heading }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !center) return;
    if (!drivingMode) {
      map.panTo(center, { animate: true, duration: 0.8 });
      return;
    }
    const targetZoom = Math.max(map.getZoom(), 17);
    const projected = map.project(center, targetZoom);
    const radians = (heading || 0) * (Math.PI / 180);
    const lookAheadPixels = 120;
    const direction = L.point(
      Math.sin(radians) * lookAheadPixels,
      -Math.cos(radians) * lookAheadPixels
    );
    const shifted = projected.add(direction);
    const shiftedCenter = map.unproject(shifted, targetZoom);
    map.flyTo(shiftedCenter, targetZoom, { animate: true, duration: 0.8 });
  }, [enabled, center, drivingMode, heading, map]);
  return null;
}

function MapInteractionMonitor({ onUserMapMove }) {
  useMapEvents({
    dragstart: () => onUserMapMove(),
    zoomstart: () => onUserMapMove(),
  });
  return null;
}

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

function snapPointToRoute(routePositions, point) {
  if (!Array.isArray(routePositions) || routePositions.length < 2 || !Array.isArray(point)) {
    return null;
  }

  let best = null;
  let minDistanceSquared = Number.POSITIVE_INFINITY;

  for (let i = 0; i < routePositions.length - 1; i++) {
    const a = routePositions[i];
    const b = routePositions[i + 1];
    const ax = a[1];
    const ay = a[0];
    const bx = b[1];
    const by = b[0];
    const px = point[1];
    const py = point[0];

    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const lengthSquared = abx * abx + aby * aby;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lengthSquared)) : 0;

    const projX = ax + t * abx;
    const projY = ay + t * aby;
    const dx = px - projX;
    const dy = py - projY;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared < minDistanceSquared) {
      minDistanceSquared = distanceSquared;
      best = [projY, projX];
    }
  }

  return best;
}

function bearingBetweenPoints(a, b) {
  if (!a || !b) return 0;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const p1 = lat1 * (Math.PI / 180);
  const p2 = lat2 * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360;
}

const getServiceColor = (serviceType) => {
  switch (serviceType) {
    case 'AMBULANCE': return '#dc3545';
    case 'FIRE_TRUCK': return '#fd7e14';
    case 'POLICE': return '#007bff';
    default: return '#2563eb';
  }
};

const playBellSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const toneMs = 0.14;
    const gapMs = 0.08;
    const notes = [880, 1046.5, 1318.5];
    notes.forEach((freq, index) => {
      const start = now + index * (toneMs + gapMs);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + toneMs);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + toneMs);
    });
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1200);
  } catch (_) {
    // Ignore audio failures (autoplay policy / unsupported browser)
  }
};

export default function UnitDashboard() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unit, setUnit] = useState(null);
  const [assignedEmergency, setAssignedEmergency] = useState(null);
  const [fallbackRoute, setFallbackRoute] = useState(null);
  const [routeFromManager, setRouteFromManager] = useState(null);
  const [error, setError] = useState('');
  const [mapInstance, setMapInstance] = useState(null);
  const [followLive, setFollowLive] = useState(true);
  const [mapType, setMapType] = useState('satellite');
  const [drivingMode, setDrivingMode] = useState(false);
  const hasInitializedAssignmentRef = useRef(false);
  const lastAssignedRequestIdRef = useRef(null);

  const { isConnected, unitLocations, refreshUnitLocations, reconnect } = useWebSocketManager();

  const loadMyTask = useCallback(async ({ showLoading = false } = {}) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const response = await unitTaskAPI.getMyAssignedEmergency();
      const data = response.data || {};
      const nextUnit = data.unit || null;
      const nextEmergency = data.assigned_emergency || null;
      const nextRoute = data.route || null;

      setUnit(nextUnit);
      setAssignedEmergency(nextEmergency);
      setFallbackRoute(nextRoute);

      if (nextUnit?.unit_id) {
        const managerRoute = backendRouteManager.getRouteData(nextUnit.unit_id);
        setRouteFromManager(managerRoute || null);
      } else {
        setRouteFromManager(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load unit task');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyTask({ showLoading: true });
  }, []);

  useEffect(() => {
    backendRouteManager.startAutoUpdates(2000);
    return () => backendRouteManager.stopAutoUpdates();
  }, []);

  useEffect(() => {
    if (isConnected) {
      refreshUnitLocations();
    }
  }, [isConnected, refreshUnitLocations]);

  useEffect(() => {
    if (!isConnected || !unit?.unit_id) return;

    const currentUnitId = Number(unit.unit_id);
    const matchesCurrentUnit = (candidateUnitId) =>
      candidateUnitId != null && Number(candidateUnitId) === currentUnitId;

    const handleUnitStatusUpdate = (data) => {
      if (!data) return;
      if (matchesCurrentUnit(data.unit_id)) {
        loadMyTask({ showLoading: false });
      }
    };

    const handleEmergencyEvent = (payload) => {
      if (!payload) return;
      const emergency = payload.emergency || payload;
      const assignedUnitId = emergency?.assigned_unit;
      const sameEmergency = assignedEmergency?.request_id != null &&
        Number(emergency?.request_id) === Number(assignedEmergency.request_id);

      if (matchesCurrentUnit(assignedUnitId) || sameEmergency) {
        loadMyTask({ showLoading: false });
      }
    };

    const unsubscribeUnitStatus = connectionManager.subscribe('unit_status_update', handleUnitStatusUpdate);
    const unsubscribeEmergencyUpdated = connectionManager.subscribe('emergency_updated', handleEmergencyEvent);
    const unsubscribeEmergencyUpdate = connectionManager.subscribe('emergency_update', handleEmergencyEvent);

    return () => {
      unsubscribeUnitStatus && unsubscribeUnitStatus();
      unsubscribeEmergencyUpdated && unsubscribeEmergencyUpdated();
      unsubscribeEmergencyUpdate && unsubscribeEmergencyUpdate();
    };
  }, [isConnected, unit?.unit_id, assignedEmergency?.request_id, loadMyTask]);

  useEffect(() => {
    if (!unit?.unit_id) return;
    const unsubscribe = backendRouteManager.subscribeToRoute(unit.unit_id, (routeData) => {
      setRouteFromManager(routeData || null);
    });
    backendRouteManager.fetchActiveRoutes().catch(() => {});
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [unit?.unit_id]);

  useEffect(() => {
    const currentId = assignedEmergency?.request_id || null;
    if (!hasInitializedAssignmentRef.current) {
      hasInitializedAssignmentRef.current = true;
      lastAssignedRequestIdRef.current = currentId;
      return;
    }
    if (currentId && currentId !== lastAssignedRequestIdRef.current) {
      playBellSound();
      if (window.showInfoToast) {
        window.showInfoToast(`New emergency assigned (#${currentId})`);
      }
    }
    lastAssignedRequestIdRef.current = currentId;
  }, [assignedEmergency?.request_id]);

  const handleCompleteTask = async () => {
    const emergencyId = Number(assignedEmergency?.request_id);
    if (!Number.isInteger(emergencyId) || emergencyId <= 0) {
      const msg = 'Invalid emergency id. Refresh and try again.';
      setError(msg);
      if (window.showErrorToast) {
        window.showErrorToast(msg);
      }
      return;
    }
    try {
      setSubmitting(true);
      await unitTaskAPI.completeMyEmergency(emergencyId);
      if (window.showSuccessToast) {
        window.showSuccessToast('Task completed. Unit is now available.');
      }
      await loadMyTask();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to complete task';
      setError(msg);
      if (window.showErrorToast) {
        window.showErrorToast(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const realtimeUnitLocation = unit?.unit_id ? unitLocations[unit.unit_id] : null;

  const mapCenter = useMemo(() => {
    if (realtimeUnitLocation?.latitude != null && realtimeUnitLocation?.longitude != null) {
      return [realtimeUnitLocation.latitude, realtimeUnitLocation.longitude];
    }
    if (unit?.latitude != null && unit?.longitude != null) {
      return [unit.latitude, unit.longitude];
    }
    if (assignedEmergency?.latitude != null && assignedEmergency?.longitude != null) {
      return [assignedEmergency.latitude, assignedEmergency.longitude];
    }
    return [19.076, 72.8777];
  }, [realtimeUnitLocation, unit, assignedEmergency]);

  const routePositions = useMemo(() => {
    const managerPositions = routeFromManager?.route?.positions;
    const fallbackPositions = fallbackRoute?.positions;
    if (Array.isArray(managerPositions) && managerPositions.length > 1) return managerPositions;
    if (Array.isArray(fallbackPositions) && fallbackPositions.length > 1) return fallbackPositions;
    return [];
  }, [routeFromManager, fallbackRoute]);

  const hasProgress = typeof realtimeUnitLocation?.progress === 'number';
  const progress = useMemo(() => {
    const p = realtimeUnitLocation?.progress;
    if (typeof p === 'number') return Math.max(0, Math.min(1, p));
    return 0;
  }, [realtimeUnitLocation?.progress]);

  const simulatedUnitPoint = useMemo(
    () => (hasProgress ? routePointAtProgress(routePositions, progress) : null),
    [routePositions, progress, hasProgress]
  );
  const aheadPoint = useMemo(
    () => (hasProgress ? routePointAtProgress(routePositions, Math.min(1, progress + 0.03)) : null),
    [routePositions, progress, hasProgress]
  );
  const snappedRealtimePoint = useMemo(() => {
    if (realtimeUnitLocation?.latitude == null || realtimeUnitLocation?.longitude == null) return null;
    return snapPointToRoute(routePositions, [realtimeUnitLocation.latitude, realtimeUnitLocation.longitude]);
  }, [routePositions, realtimeUnitLocation]);

  const liveUnitPoint = useMemo(() => {
    if (simulatedUnitPoint) return simulatedUnitPoint;
    if (snappedRealtimePoint) return snappedRealtimePoint;
    if (realtimeUnitLocation?.latitude != null && realtimeUnitLocation?.longitude != null) {
      return [realtimeUnitLocation.latitude, realtimeUnitLocation.longitude];
    }
    if (unit?.latitude != null && unit?.longitude != null) {
      return [unit.latitude, unit.longitude];
    }
    return null;
  }, [simulatedUnitPoint, snappedRealtimePoint, realtimeUnitLocation, unit]);

  const heading = useMemo(() => {
    if (liveUnitPoint && aheadPoint) return bearingBetweenPoints(liveUnitPoint, aheadPoint);
    if (routePositions.length > 1) return bearingBetweenPoints(routePositions[0], routePositions[1]);
    return 0;
  }, [liveUnitPoint, aheadPoint, routePositions]);

  const estimatedDuration = routeFromManager?.route?.estimated_duration || fallbackRoute?.duration || 0;
  const etaSeconds = estimatedDuration ? Math.max(0, Math.round(estimatedDuration * (1 - progress))) : null;
  const formatSeconds = (s) => {
    if (s == null) return 'N/A';
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
  };

  const tileConfig = mapType === 'satellite'
    ? {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
        subdomains: undefined,
      }
    : {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
      };

  const handleRecenter = () => {
    if (!mapInstance) return;
    const target = liveUnitPoint || mapCenter;
    setFollowLive(true);
    mapInstance.setView(target, mapInstance.getZoom(), { animate: true });
  };

  const zoomIn = () => mapInstance?.zoomIn();
  const zoomOut = () => mapInstance?.zoomOut();

  if (loading) {
    return (
      <div className="unit-loading-wrap">
        <div className="unit-loading-spinner"></div>
        <div>Loading unit dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container unit-dashboard-page">
      <Breadcrumbs />
      <div className="dashboard-main unit-dashboard-shell">
        <section className="unit-hero-card">
          <div className="unit-hero-eyebrow">Field Operations</div>
          <h1 className="unit-hero-title">Unit Command Console</h1>
          <p className="unit-hero-subtitle">
            Real-time routing, live telemetry, and task completion for your assigned emergency response.
          </p>
        </section>

        <section className="unit-status-row">
          {unit && (
            <article className="unit-status-card">
              <div className="unit-status-label">Unit</div>
              <div className="unit-status-value">{unit.unit_vehicle_number}</div>
              <div className="unit-status-sub">{unit.service_type}</div>
            </article>
          )}
          <article className="unit-status-card">
            <div className="unit-status-label">Status</div>
            <div className="unit-status-value">{realtimeUnitLocation?.status || unit?.status || 'Unknown'}</div>
            <div className={`unit-status-sub ${isConnected ? 'live' : 'offline'}`}>
              Socket {isConnected ? 'LIVE' : 'OFFLINE'}
            </div>
          </article>
          {!isConnected && (
            <article className="unit-status-card action">
              <div className="unit-status-label">Connection</div>
              <button onClick={reconnect} className="unit-inline-btn">Reconnect</button>
            </article>
          )}
        </section>

        {error && (
          <div className="unit-alert-error">{error}</div>
        )}

        {!assignedEmergency ? (
          <section className="unit-empty-state">No active assigned emergency.</section>
        ) : (
          <section className="unit-main-card">
            <div className="unit-emergency-head">
              <h3>Assigned Emergency #{assignedEmergency.request_id}</h3>
              <div className="unit-emergency-chip">{assignedEmergency.status}</div>
            </div>

            <div className="unit-emergency-meta">
              <div>
                <span>Type</span>
                <strong>{assignedEmergency.emergency_type}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>{assignedEmergency.latitude}, {assignedEmergency.longitude}</strong>
              </div>
            </div>

            <div className="unit-map-shell">
              <MapContainer
                center={liveUnitPoint || mapCenter}
                zoom={drivingMode ? 17 : 14}
                className="unit-map-canvas"
                zoomControl={false}
              >
                <MapInstanceBinder onReady={setMapInstance} />
                <MapFollowController
                  center={liveUnitPoint || mapCenter}
                  enabled={followLive}
                  drivingMode={drivingMode}
                  heading={heading}
                />
                <MapInteractionMonitor onUserMapMove={() => setFollowLive(false)} />
                <TileLayer
                  url={tileConfig.url}
                  attribution={tileConfig.attribution}
                  {...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {})}
                />

                {routePositions.length > 1 && (
                  <Polyline
                    positions={routePositions}
                    pathOptions={{ color: getServiceColor(unit?.service_type), weight: 6, opacity: 0.95 }}
                  />
                )}

                {assignedEmergency?.latitude != null && assignedEmergency?.longitude != null && (
                  <Marker position={[assignedEmergency.latitude, assignedEmergency.longitude]}>
                    <Popup>
                      <strong>Emergency #{assignedEmergency.request_id}</strong><br />
                      {assignedEmergency.emergency_type}
                    </Popup>
                  </Marker>
                )}

                {liveUnitPoint && (
                  <Marker
                    position={liveUnitPoint}
                    zIndexOffset={1000}
                    icon={L.divIcon({
                      className: 'unit-live-marker',
                      html: `
                        <div style="
                          width:36px;height:36px;border-radius:50%;
                          background:${getServiceColor(unit?.service_type)};
                          border:3px solid white;display:flex;align-items:center;justify-content:center;
                          box-shadow:0 2px 8px rgba(0,0,0,0.35);color:white;font-weight:700;
                          transform: rotate(${heading.toFixed(1)}deg);
                        ">
                          ▲
                        </div>
                      `,
                      iconSize: [36, 36],
                      iconAnchor: [18, 18],
                    })}
                  >
                    <Popup>
                      <strong>Your Unit</strong><br />
                      {unit?.unit_vehicle_number} ({unit?.service_type})<br />
                      Status: {realtimeUnitLocation?.status || unit?.status}<br />
                      Progress: {(progress * 100).toFixed(1)}%
                    </Popup>
                  </Marker>
                )}
              </MapContainer>

              <div className="unit-map-type-toggle">
                <button
                  onClick={() => setMapType('road')}
                  className={mapType === 'road' ? 'active' : ''}
                >
                  Map
                </button>
                <button
                  onClick={() => setMapType('satellite')}
                  className={mapType === 'satellite' ? 'active' : ''}
                >
                  Satellite
                </button>
              </div>

              <div className="unit-map-controls">
                <button onClick={handleRecenter} className="circle">◎</button>
                <button
                  onClick={() => setFollowLive((v) => !v)}
                  className={`mode-btn ${followLive ? 'active' : ''}`}
                >
                  {followLive ? 'LIVE' : 'PAUSED'}
                </button>
                <button
                  onClick={() => setDrivingMode((v) => !v)}
                  className={`mode-btn ${drivingMode ? 'driving' : ''}`}
                >
                  {drivingMode ? 'DRIVING' : 'NORMAL'}
                </button>
                <div className="unit-zoom-box">
                  <button onClick={zoomIn}>+</button>
                  <button onClick={zoomOut}>-</button>
                </div>
              </div>

              <div className="unit-map-kpis">
                <div><span>Socket</span><strong>{isConnected ? 'LIVE' : 'OFFLINE'}</strong></div>
                <div><span>Progress</span><strong>{(progress * 100).toFixed(1)}%</strong></div>
                <div><span>ETA</span><strong>{formatSeconds(etaSeconds)}</strong></div>
                <div><span>Follow</span><strong>{followLive ? 'ON' : 'OFF'}</strong></div>
                <div><span>Heading</span><strong>{heading.toFixed(0)}&deg;</strong></div>
                <div><span>View</span><strong>{drivingMode ? 'DRIVING' : 'NORMAL'}</strong></div>
              </div>
            </div>

            <button
              onClick={handleCompleteTask}
              disabled={submitting}
              className="unit-complete-btn"
            >
              {submitting ? 'Completing...' : 'Mark Task Complete'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
