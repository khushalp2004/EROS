import React from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/route-animations.css";
import { useRealtimeUnitMarkers } from "../hooks/useWebSocket";

// Fix missing marker icons when using bundlers (CRA/Vite)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom icons for different unit types and statuses
const createUnitIcon = (unitType, status, isRealtime = false) => {
  const getEmoji = () => {
    if (unitType === 'AMBULANCE') return '🚑';
    if (unitType === 'FIRE_TRUCK') return '🚒';
    if (unitType === 'POLICE') return '🚓';
    return '🚐';
  };

  const getStatusColor = () => {
    if (isRealtime) {
      switch (status) {
        case 'ENROUTE': return '#00ff00';
        case 'ARRIVED': return '#ffaa00';
        case 'DEPARTED': return '#0066ff';
        case 'AVAILABLE': return '#00ff00';
        default: return '#666666';
      }
    }
    return '#333333';
  };

  return L.divIcon({
    className: "custom-unit-icon",
    html: `
      <div style="
        position: relative;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${getStatusColor()};
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ${isRealtime ? 'animation: pulse 2s infinite;' : ''}
      ">
        ${getEmoji()}
        ${isRealtime ? '<div style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #00ff00; border-radius: 50%; border: 1px solid white;"></div>' : ''}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const ambulanceIcon = L.divIcon({
  className: "ambulance-icon",
  html: '<div style="font-size:20px; line-height:20px;">🚑</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const defaultIcon = new L.Icon.Default();

function MapAutoCenter({ center }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

function AnimatedPolyline({ positions, color = "#0066ff", progress = 1, showProgress = true, isAnimated = false }) {
  const [animatedPositions, setAnimatedPositions] = React.useState([]);
  
  React.useEffect(() => {
    if (positions && positions.length > 0) {
      const animated = positions.slice(0, Math.ceil(positions.length * progress));
      setAnimatedPositions(animated);
    }
  }, [positions, progress]);

  if (animatedPositions.length === 0) return null;

  return (
    <div className={isAnimated ? "animated-polyline-container" : ""}>
      <Polyline
        positions={animatedPositions}
        pathOptions={{ 
          color: color, 
          weight: 6, 
          opacity: isAnimated ? 1 : 0.8,
          dashArray: isAnimated ? null : (showProgress ? null : "10 10"),
          className: isAnimated ? "animated-polyline" : ""
        }}
      />
      {showProgress && animatedPositions.length < positions.length && (
        <Polyline
          positions={[animatedPositions[animatedPositions.length - 1], positions[animatedPositions.length]]}
          pathOptions={{ 
            color: color, 
            weight: 4, 
            opacity: 0.6,
            dashArray: "5 5"
          }}
        />
      )}
    </div>
  );
}

function RouteProgressIndicator({ progress, position }) {
  return (
    <Marker
      position={position}
      icon={L.divIcon({
        className: "progress-indicator",
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background: #0066ff;
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">
            ${Math.round(progress * 100)}%
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })}
      zIndexOffset={1000}
    />
  );
}

function MapView({ markers, center, polylines = [], showRealtimeData = true, animateRoutes = true }) {
  const defaultCenter = [19.076, 72.8777];
  const mapCenter = center || (markers.length === 1
    ? [markers[0].latitude, markers[0].longitude]
    : defaultCenter);
  const mapZoom = markers.length === 1 ? 14 : 12;

  // Use real-time unit data if enabled
  const realtimeData = useRealtimeUnitMarkers(markers);
  const finalMarkers = showRealtimeData ? realtimeData.markers : markers;

  // Calculate route progress for each polyline
  const animatedPolylines = React.useMemo(() => {
    if (!animateRoutes) return polylines;

    return polylines.map((polyline, idx) => {
      // Calculate progress based on time or simulated progress
      const now = Date.now();
      const startTime = polyline.startTime || now;
      const duration = polyline.duration || 30000; // 30 seconds default
      const progress = Math.min(1, (now - startTime) / duration);

      return {
        ...polyline,
        progress,
        animated: true
      };
    });
  }, [polylines, animateRoutes]);

  if (!finalMarkers || finalMarkers.length === 0) {
    return <p style={{ marginTop: "10px" }}>No locations to display.</p>;
  }

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          
          .custom-unit-icon {
            background: none !important;
            border: none !important;
          }
          
          .progress-indicator {
            background: none !important;
            border: none !important;
          }
        `}
      </style>
      
      <MapContainer
        key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}-${finalMarkers.length}`}
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: "500px" }}
      >
        {center && <MapAutoCenter center={center} />}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {finalMarkers.map((m, i) => (
          <Marker
            key={`${m.unit_id || m.request_id || i}-${m.isRealtime ? 'realtime' : 'static'}`}
            position={[m.latitude, m.longitude]}
            icon={m.isRealtime 
              ? createUnitIcon(m.type || m.service_type, m.status, true)
              : (m.isSimulated ? ambulanceIcon : defaultIcon)
            }
            zIndexOffset={m.isRealtime ? 500 : (m.isSimulated ? 400 : 0)}
          >
            <Popup>
              <div>
                <strong>{m.type || m.service_type || 'Emergency'}</strong><br/>
                Status: <span style={{ 
                  color: m.isRealtime && m.status === 'ENROUTE' ? '#00ff00' : '#666' 
                }}>
                  {m.status}
                </span><br/>
                {m.isRealtime && (
                  <span style={{ color: '#0066ff', fontSize: '12px' }}>
                    🔴 Live Update
                  </span>
                )}
                {m.isSimulated && (
                  <span style={{ color: '#ff9900', fontSize: '12px' }}>
                    🟡 Simulated
                  </span>
                )}
                <br/>
                Lat: {m.latitude.toFixed(4)}, Lng: {m.longitude.toFixed(4)}
                {m.lastUpdate && (
                  <>
                    <br/>
                    <small>Updated: {new Date(m.lastUpdate).toLocaleTimeString()}</small>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Animated polylines */}
        {animatedPolylines.map((pl, idx) => (
          <React.Fragment key={idx}>
            <AnimatedPolyline
              positions={pl.positions}
              color={pl.color || "#0066ff"}
              progress={pl.progress || 1}
              showProgress={animateRoutes}
              isAnimated={pl.animated && animateRoutes}
            />
            {animateRoutes && pl.progress < 1 && pl.positions.length > 0 && (
              <RouteProgressIndicator 
                progress={pl.progress || 0}
                position={pl.positions[Math.floor((pl.positions.length - 1) * (pl.progress || 0))]}
              />
            )}
          </React.Fragment>
        ))}
        
        {/* Static polylines (fallback) */}
        {!animateRoutes && polylines.map((pl, idx) => (
          <Polyline
            key={`static-${idx}`}
            positions={pl.positions}
            pathOptions={{ color: pl.color || "blue", weight: 4, opacity: 0.6, dashArray: pl.dash ? "6 6" : null }}
          />
        ))}
      </MapContainer>
      
      {/* Real-time status indicator */}
      {showRealtimeData && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: realtimeData.isConnected ? '#00ff00' : '#ff4444',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '15px',
          fontSize: '12px',
          fontWeight: 'bold',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          {realtimeData.isConnected ? '🔴 LIVE' : '⚫ OFFLINE'}
        </div>
      )}
    </>
  );
}

export default MapView;
