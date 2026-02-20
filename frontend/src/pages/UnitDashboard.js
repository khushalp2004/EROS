import React, { useEffect, useMemo, useRef, useState } from 'react';
import { unitTaskAPI } from '../api';
import { useWebSocketManager } from '../hooks/useWebSocketManager';
import backendRouteManager from '../utils/BackendRouteManager';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  const [mapType, setMapType] = useState('road');
  const [drivingMode, setDrivingMode] = useState(false);
  const hasInitializedAssignmentRef = useRef(false);
  const lastAssignedRequestIdRef = useRef(null);

  const { isConnected, unitLocations, refreshUnitLocations, reconnect } = useWebSocketManager();

  const loadMyTask = async ({ showLoading = false } = {}) => {
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
  };

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
    if (!assignedEmergency?.request_id) return;
    try {
      setSubmitting(true);
      await unitTaskAPI.completeMyEmergency(assignedEmergency.request_id);
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

  const progress = useMemo(() => {
    const p = realtimeUnitLocation?.progress;
    if (typeof p === 'number') return Math.max(0, Math.min(1, p));
    return 0;
  }, [realtimeUnitLocation?.progress]);

  const simulatedUnitPoint = useMemo(() => routePointAtProgress(routePositions, progress), [routePositions, progress]);
  const aheadPoint = useMemo(() => routePointAtProgress(routePositions, Math.min(1, progress + 0.03)), [routePositions, progress]);

  const liveUnitPoint = useMemo(() => {
    if (simulatedUnitPoint) return simulatedUnitPoint;
    if (realtimeUnitLocation?.latitude != null && realtimeUnitLocation?.longitude != null) {
      return [realtimeUnitLocation.latitude, realtimeUnitLocation.longitude];
    }
    if (unit?.latitude != null && unit?.longitude != null) {
      return [unit.latitude, unit.longitude];
    }
    return null;
  }, [simulatedUnitPoint, realtimeUnitLocation, unit]);

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
    return <div style={{ padding: '24px' }}>Loading unit dashboard...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '12px' }}>Unit Dashboard</h1>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {unit && (
          <div>
            <strong>Unit:</strong> {unit.unit_vehicle_number} ({unit.service_type}) | <strong>Status:</strong> {realtimeUnitLocation?.status || unit.status}
          </div>
        )}
        <div>
          <strong>Socket:</strong> {isConnected ? 'LIVE' : 'OFFLINE'}
          {!isConnected && (
            <button
              onClick={reconnect}
              style={{ marginLeft: '8px', padding: '4px 8px', cursor: 'pointer' }}
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '16px', color: '#b91c1c' }}>{error}</div>
      )}

      {!assignedEmergency ? (
        <div>No active assigned emergency.</div>
      ) : (
        <div>
          <h3>Assigned Emergency #{assignedEmergency.request_id}</h3>
          <p>Type: {assignedEmergency.emergency_type}</p>
          <p>Location: {assignedEmergency.latitude}, {assignedEmergency.longitude}</p>
          <p>Status: {assignedEmergency.status}</p>

          <div style={{ height: '520px', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
            <MapContainer
              center={liveUnitPoint || mapCenter}
              zoom={drivingMode ? 17 : 14}
              style={{ height: '100%', width: '100%' }}
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

            <div style={{
              position: 'absolute',
              top: 10,
              left: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 1000
            }}>
              <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.15)', padding: 4, display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setMapType('road')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: mapType === 'road' ? '#111827' : '#f3f4f6',
                    color: mapType === 'road' ? '#fff' : '#111827',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Map
                </button>
                <button
                  onClick={() => setMapType('satellite')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: mapType === 'satellite' ? '#111827' : '#f3f4f6',
                    color: mapType === 'satellite' ? '#fff' : '#111827',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Satellite
                </button>
              </div>
            </div>

            <div style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              zIndex: 1000
            }}>
              <button onClick={handleRecenter} style={{ width: 44, height: 44, borderRadius: 22, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: 18 }}>
                ◎
              </button>
              <button onClick={() => setFollowLive((v) => !v)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #cbd5e1', background: followLive ? '#111827' : '#fff', color: followLive ? '#fff' : '#111827', cursor: 'pointer', fontWeight: 700 }}>
                {followLive ? 'LIVE' : 'PAUSED'}
              </button>
              <button onClick={() => setDrivingMode((v) => !v)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #cbd5e1', background: drivingMode ? '#0f766e' : '#fff', color: drivingMode ? '#fff' : '#111827', cursor: 'pointer', fontWeight: 700 }}>
                {drivingMode ? 'DRIVING' : 'NORMAL'}
              </button>
              <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                <button onClick={zoomIn} style={{ display: 'block', width: 40, height: 34, border: 'none', borderBottom: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 20 }}>
                  +
                </button>
                <button onClick={zoomOut} style={{ display: 'block', width: 40, height: 34, border: 'none', background: '#fff', cursor: 'pointer', fontSize: 20 }}>
                  -
                </button>
              </div>
            </div>

            <div style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
              gap: 8,
              zIndex: 1000,
              maxWidth: 320
            }}>
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>SOCKET</div>
                <div style={{ fontWeight: 700 }}>{isConnected ? 'LIVE' : 'OFFLINE'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>PROGRESS</div>
                <div style={{ fontWeight: 700 }}>{(progress * 100).toFixed(1)}%</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>ETA</div>
                <div style={{ fontWeight: 700 }}>{formatSeconds(etaSeconds)}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>FOLLOW</div>
                <div style={{ fontWeight: 700 }}>{followLive ? 'ON' : 'OFF'}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>HEADING</div>
                <div style={{ fontWeight: 700 }}>{heading.toFixed(0)}&deg;</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>VIEW</div>
                <div style={{ fontWeight: 700 }}>{drivingMode ? 'DRIVING' : 'NORMAL'}</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleCompleteTask}
            disabled={submitting}
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#16a34a',
              color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Completing...' : 'Mark Task Complete'}
          </button>
        </div>
      )}
    </div>
  );
}
