import React from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/route-animations.css";
import { useRealtimeUnitMarkers } from "../hooks/useWebSocketManager";

// Fix missing marker icons when using bundlers (CRA/Vite)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Enhanced icons for different unit types and statuses
const createUnitIcon = (unit, isRealtime = false) => {
  const { unit_id, service_type, status, latitude, longitude } = unit;
  
  const getEmoji = () => {
    if (service_type === 'AMBULANCE') return '';
    if (service_type === 'FIRE_TRUCK') return '';
    if (service_type === 'POLICE') return '';
    return '';
  };

  const getStatusColor = () => {
    switch (status) {
      case 'AVAILABLE': return '#28a745'; // Green
      case 'ENROUTE': return '#007bff'; // Blue
      case 'ARRIVED': return '#ffc107'; // Yellow
      case 'DEPARTED': return '#6c757d'; // Gray
      case 'BUSY': return '#dc3545'; // Red
      default: return '#6c757d'; // Default gray
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'AVAILABLE': return 'AVAIL';
      case 'ENROUTE': return 'ENROUTE';
      case 'ARRIVED': return 'ARRIVED';
      case 'DEPARTED': return 'DEPARTED';
      case 'BUSY': return 'BUSY';
      default: return status || 'UNKNOWN';
    }
  };

  return L.divIcon({
    className: "enhanced-unit-icon",
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -50%);
      ">
        <!-- Unit Name Badge -->
        <div style="
          position: absolute;
          top: -35px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          z-index: 1000;
        ">
          Unit ${unit_id}
        </div>
        
        <!-- Main Icon Container -->
        <div style="
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${getStatusColor()};
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.4);
          ${isRealtime ? 'animation: unitPulse 2s infinite;' : ''}
          z-index: 999;
        ">
          ${getEmoji()}
          ${isRealtime ? '<div style="position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background: #00ff00; border-radius: 50%; border: 2px solid white; animation: liveBlink 1.5s infinite;"></div>' : ''}
        </div>
        
        <!-- Status Badge -->
        <div style="
          position: absolute;
          bottom: -30px;
          left: 50%;
          transform: translateX(-50%);
          background: ${getStatusColor()};
          color: white;
          padding: 1px 4px;
          border-radius: 8px;
          font-size: 9px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${getStatusText()}
        </div>
      </div>
    `,
    iconSize: [36, 50], // Increased to accommodate name and status
    iconAnchor: [18, 25], // Centered anchor point
  });
};

const ambulanceIcon = L.divIcon({
  className: "ambulance-icon",
  html: '<div style="font-size:20px; line-height:20px;"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Enhanced icons for different emergency types and statuses
const createEmergencyIcon = (emergency, isSimulated = false) => {
  const { request_id, emergency_type, status } = emergency;
  
  const getEmoji = () => {
    if (emergency_type === 'MEDICAL') return '🏥';
    if (emergency_type === 'FIRE') return '🔥';
    if (emergency_type === 'CRIME') return '🚔';
    if (emergency_type === 'ACCIDENT') return '🚗';
    if (emergency_type === 'TRAFFIC') return '🚦';
    if (emergency_type === 'RESCUE') return '🛟';
    return '🚨';
  };

  const getStatusColor = () => {
    switch (status) {
      case 'PENDING': return '#ffc107'; // Yellow
      case 'APPROVED': return '#007bff'; // Blue
      case 'ASSIGNED': return '#28a745'; // Green
      case 'ENROUTE': return '#17a2b8'; // Cyan
      case 'ARRIVED': return '#6f42c1'; // Purple
      case 'COMPLETED': return '#6c757d'; // Gray
      default: return '#dc3545'; // Red
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'PENDING': return 'PENDING';
      case 'APPROVED': return 'APPROVED';
      case 'ASSIGNED': return 'ASSIGNED';
      case 'ENROUTE': return 'ENROUTE';
      case 'ARRIVED': return 'ARRIVED';
      case 'COMPLETED': return 'DONE';
      default: return status || 'UNKNOWN';
    }
  };

  return L.divIcon({
    className: "enhanced-emergency-icon",
    html: `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -50%);
      ">
        <!-- Emergency ID Badge -->
        <div style="
          position: absolute;
          top: -35px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          z-index: 1000;
        ">
          Emergency #${request_id}
        </div>
        
        <!-- Main Icon Container -->
        <div style="
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${getStatusColor()};
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.4);
          ${isSimulated ? 'animation: emergencyPulse 2s infinite;' : ''}
          z-index: 999;
        ">
          ${getEmoji()}
          ${isSimulated ? '<div style="position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background: #ff6b35; border-radius: 50%; border: 2px solid white; animation: simulatedBlink 1.5s infinite;"></div>' : ''}
        </div>
        
        <!-- Status Badge -->
        <div style="
          position: absolute;
          bottom: -30px;
          left: 50%;
          transform: translateX(-50%);
          background: ${getStatusColor()};
          color: white;
          padding: 1px 4px;
          border-radius: 8px;
          font-size: 9px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${getStatusText()}
        </div>
      </div>
    `,
    iconSize: [36, 50],
    iconAnchor: [18, 25],
  });
};

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

function AnimatedPolyline({
  positions,
  color = "#0066ff",
  progress = 1,
  showProgress = true,
  isAnimated = false,
  pathOptions = {},
  isRealtime = false,
  serviceType = null,
  unitId = null,
  routeId = null
}) {
  // ✅ SIMPLIFIED: Calculate moving marker position based on progress
  const movingMarkerPosition = React.useMemo(() => {
    if (!positions || positions.length < 2) return null;

    // Simple linear interpolation based on progress
    const index = Math.floor(progress * (positions.length - 1));
    return positions[index];
  }, [positions, progress]);


  // Calculate visible positions based on progress
  const animatedPositions = React.useMemo(() => {
    if (!positions || positions.length === 0) return [];
    return positions.slice(0, Math.max(2, Math.ceil(positions.length * progress)));
  }, [positions, progress]);

  if (animatedPositions.length === 0) return null;

  // Get service emoji based on service type
  const getServiceEmoji = () => {
    switch (serviceType) {
      case 'AMBULANCE': return '';
      case 'FIRE_TRUCK': return '';
      case 'POLICE': return '';
      default: return '';
    }
  };

  // Get route CSS class based on service type
  const getRouteClass = () => {
    switch (serviceType) {
      case 'AMBULANCE': return 'route-ambulance';
      case 'FIRE_TRUCK': return 'route-fire';
      case 'POLICE': return 'route-police';
      default: return 'route-other';
    }
  };

  // Merge default options with provided pathOptions
  const defaultOptions = {
    color: color,
    weight: isRealtime ? 6 : 4,
    opacity: isAnimated ? 1 : 0.8,
    dashArray: isAnimated ? null : (showProgress ? null : "10 10"),
    className: isAnimated ? "animated-polyline enhanced-route-line" : ""
  };

  const mergedOptions = { ...defaultOptions, ...pathOptions };

  // Add service type class
  if (serviceType && !mergedOptions.className.includes(getRouteClass())) {
    mergedOptions.className += ` ${getRouteClass()}`;
  }

  return (
    <div className={isAnimated ? "animated-polyline-container" : ""}>
      {/* Full route background */}
      {positions.length > 1 && (
        <Polyline
          positions={positions}
          pathOptions={{
            color: color,
            weight: 2,
            opacity: 0.2,
            dashArray: "3 3"
          }}
        />
      )}

      {/* Animated progress route */}
      {animatedPositions.length > 1 && (
        <Polyline
          positions={animatedPositions}
          pathOptions={mergedOptions}
        />
      )}

      {/* Route progress indicator */}
      {showProgress && animatedPositions.length < positions.length && (
        <Polyline
          positions={[animatedPositions[animatedPositions.length - 1], positions[animatedPositions.length]]}
          pathOptions={{
            color: mergedOptions.color,
            weight: Math.max(2, (mergedOptions.weight || 4) - 2),
            opacity: 0.6,
            dashArray: "5 5"
          }}
        />
      )}

      {/* Moving service emoji marker */}
      {isAnimated && movingMarkerPosition && serviceType && (
        <Marker
          position={movingMarkerPosition}
          icon={L.divIcon({
            className: "route-emoji-moving service-emoji-pulse",
            html: `
              <div style="
                position: relative;
                width: 32px;
                height: 32px;
                background: rgba(255, 255, 255, 0.9);
                border: 2px solid ${color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                z-index: 1000;
              ">
                ${getServiceEmoji()}
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })}
          zIndexOffset={1500}
        >
          <Popup>
            <div>
              <strong>🚩 {serviceType} Unit {unitId}</strong><br/>
              <small>Moving to destination</small><br/>
              <small>Progress: {Math.round(progress * 100)}%</small>
              {routeId && (
                <>
                  <br/>
                  <small>Route: {routeId}</small>
                </>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      {/* Static service emoji on route (for non-animated routes) */}
      {!isAnimated && serviceType && positions.length > 0 && (
        <Marker
          position={positions[Math.floor(positions.length / 2)]}
          icon={L.divIcon({
            className: "route-static-emoji",
            html: `
              <div style="
                position: relative;
                width: 28px;
                height: 28px;
                background: rgba(255, 255, 255, 0.95);
                border: 2px solid ${color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                z-index: 1000;
              ">
                ${getServiceEmoji()}
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })}
          zIndexOffset={800}
        >
          <Popup>
            <div>
              <strong>🚩 {serviceType} Route</strong><br/>
              <small>Unit {unitId}</small>
            </div>
          </Popup>
        </Marker>
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

function MapView({ markers, center, polylines = [], showRealtimeData = true, animateRoutes = true, mapRef = null }) {
  const defaultCenter = [19.076, 72.8777];
  const mapCenter = center || (markers.length === 1
    ? [markers[0].latitude, markers[0].longitude]
    : defaultCenter);
  const mapZoom = markers.length === 1 ? 14 : 12;

  // Use real-time unit data if enabled
  const realtimeData = useRealtimeUnitMarkers(markers);
  const finalMarkers = showRealtimeData ? realtimeData.markers : markers;

  // ✅ SIMPLIFIED: Process polylines for backend-driven routes
  const enhancedPolylines = React.useMemo(() => {
    return polylines.map(polyline => {
      const hasRealtimeData = finalMarkers.some(marker =>
        marker.unit_id === polyline.unitId && marker.isRealtime
      );

      return {
        ...polyline,
        routeId: `route-${polyline.unitId}-${polyline.emergencyId}`,
        isAnimated: animateRoutes,
        isRealtime: hasRealtimeData,
        progress: polyline.progress || 0,
        pathOptions: {
          color: hasRealtimeData ? polyline.color : '#6c757d',
          weight: hasRealtimeData ? 6 : 4,
          opacity: hasRealtimeData ? 1.0 : 0.6,
          dashArray: hasRealtimeData ? null : "8 4"
        }
      };
    });
  }, [polylines, finalMarkers, animateRoutes]);

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
          
          @keyframes unitPulse {
            0% { transform: scale(1); box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
            50% { transform: scale(1.05); box-shadow: 0 6px 12px rgba(0,0,0,0.5); }
            100% { transform: scale(1); box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
          }
          
          @keyframes liveBlink {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
          }
          
          @keyframes emergencyPulse {
            0% { transform: scale(1); box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
            50% { transform: scale(1.08); box-shadow: 0 6px 12px rgba(0,0,0,0.5); }
            100% { transform: scale(1); box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
          }
          
          @keyframes simulatedBlink {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
          }
          
          @keyframes markerGlow {
            0% { box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
            50% { box-shadow: 0 4px 8px rgba(0,0,0,0.4), 0 0 20px rgba(0, 123, 255, 0.6); }
            100% { box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
          }
          
          .enhanced-unit-icon {
            background: none !important;
            border: none !important;
          }
          
          .enhanced-emergency-icon {
            background: none !important;
            border: none !important;
          }
          
          .progress-indicator {
            background: none !important;
            border: none !important;
          }
          
          /* Enhanced marker styles */
          .leaflet-marker-icon.enhanced-unit-icon,
          .leaflet-marker-icon.enhanced-emergency-icon {
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
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
        {finalMarkers.map((m, i) => {
          // Enhanced popup content for units
          const isUnit = m.unit_id !== undefined;
          const isEmergency = m.request_id !== undefined && !isUnit;
          const popupContent = isUnit ? (
            <div>
              <strong> Unit {m.unit_id}</strong><br/>
              <strong>Type:</strong> {m.service_type}<br/>
              <strong>Status:</strong> 
              <span style={{ 
                color: m.status === 'AVAILABLE' ? '#28a745' : 
                       m.status === 'ENROUTE' ? '#007bff' : 
                       m.status === 'ARRIVED' ? '#ffc107' : '#6c757d',
                fontWeight: 'bold'
              }}>
                {m.status}
              </span><br/>
              {m.isRealtime && (
                <span style={{ color: '#0066ff', fontSize: '12px' }}>
                  🔴 Live Tracking
                </span>
              )}
              <br/>
              <strong>Location:</strong> {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
              {m.lastUpdate && (
                <>
                  <br/>
                  <small>Updated: {new Date(m.lastUpdate).toLocaleTimeString()}</small>
                </>
              )}
            </div>
          ) : (
            <div>
              <strong>🚨 Emergency #{m.request_id}</strong><br/>
              <strong>Type:</strong> {m.emergency_type || m.type || 'Unknown'}<br/>
              <strong>Status:</strong> 
              <span style={{ 
                color: m.status === 'PENDING' ? '#ffc107' :
                       m.status === 'APPROVED' ? '#007bff' :
                       m.status === 'ASSIGNED' ? '#28a745' :
                       m.status === 'ENROUTE' ? '#17a2b8' :
                       m.status === 'ARRIVED' ? '#6f42c1' :
                       m.status === 'COMPLETED' ? '#6c757d' : '#666',
                fontWeight: 'bold'
              }}>
                {m.status}
              </span><br/>
              {m.isSimulated && (
                <span style={{ color: '#ff9900', fontSize: '12px' }}>
                  🟡 Simulated
                </span>
              )}
              <br/>
              <strong>Location:</strong> {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
              {m.lastUpdate && (
                <>
                  <br/>
                  <small>Updated: {new Date(m.lastUpdate).toLocaleTimeString()}</small>
                </>
              )}
            </div>
          );

          // Select appropriate icon based on marker type
          let markerIcon;
          if (isUnit && m.isRealtime) {
            markerIcon = createUnitIcon(m, true);
          } else if (isEmergency) {
            markerIcon = createEmergencyIcon(m, m.isSimulated);
          } else if (m.isSimulated) {
            markerIcon = ambulanceIcon;
          } else {
            markerIcon = defaultIcon;
          }

          return (
            <Marker
              key={`${m.unit_id || m.request_id || i}-${m.isRealtime ? 'realtime' : 'static'}`}
              position={[m.latitude, m.longitude]}
              icon={markerIcon}
              zIndexOffset={m.isRealtime ? 500 : (m.isSimulated ? 400 : 0)}
            >
              <Popup>
                {popupContent}
              </Popup>
            </Marker>
          );
        })}
        
        {/* Enhanced animated polylines with source/destination markers */}
        {enhancedPolylines.map((pl, idx) => (
          <React.Fragment key={pl.id || idx}>
            {/* Source marker (unit starting position) */}
            <Marker
              position={pl.positions[0]}
              icon={L.divIcon({
                className: "source-marker",
                html: `
                  <div style="
                    position: relative;
                    width: 24px;
                    height: 24px;
                    background: ${pl.isRealtime ? '#007bff' : '#6c757d'};
                    border: 3px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ${pl.isRealtime ? 'animation: sourcePulse 2s infinite;' : ''}
                  ">
                    📍
                  </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
              zIndexOffset={pl.isRealtime ? 800 : 400}
            >
              <Popup>
                <div>
                  <strong>🚩 Source Location</strong><br/>
                  Unit {pl.unitId} Starting Point<br/>
                  <small>Service: {pl.serviceType}</small>
                </div>
              </Popup>
            </Marker>
            
            {/* Destination marker (emergency location) */}
            <Marker
              position={pl.positions[pl.positions.length - 1]}
              icon={L.divIcon({
                className: "destination-marker",
                html: `
                  <div style="
                    position: relative;
                    width: 28px;
                    height: 28px;
                    background: #dc3545;
                    border: 3px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    color: white;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ${pl.isRealtime ? 'animation: destinationPulse 2s infinite;' : ''}
                  ">
                    🎯
                  </div>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              })}
              zIndexOffset={pl.isRealtime ? 800 : 400}
            >
              <Popup>
                <div>
                  <strong>🎯 Destination</strong><br/>
                  Emergency #{pl.emergencyId}<br/>
                  <small>Target Location</small>
                </div>
              </Popup>
            </Marker>
            
            <AnimatedPolyline
              positions={pl.positions}
              color={pl.color || "#0066ff"}
              progress={pl.progress || 1}
              showProgress={animateRoutes}
              isAnimated={pl.isAnimated && animateRoutes}
              pathOptions={pl.pathOptions}
              isRealtime={pl.isRealtime}
              serviceType={pl.serviceType}
              unitId={pl.unitId}
              routeId={pl.routeId}
            />
            {animateRoutes && pl.progress < 1 && pl.positions.length > 0 && (
              <RouteProgressIndicator 
                progress={pl.progress || 0}
                position={pl.positions[Math.floor((pl.positions.length - 1) * (pl.progress || 0))]}
              />
            )}
            {/* Add route information overlay */}
            {pl.isRealtime && (
              <Marker
                position={pl.positions[Math.floor((pl.positions.length - 1) * (pl.progress || 0))]}
                icon={L.divIcon({
                  className: "route-info-overlay",
                  html: `
                    <div style="
                      position: absolute;
                      top: -40px;
                      left: 50%;
                      transform: translateX(-50%);
                      background: rgba(0, 0, 0, 0.9);
                      color: white;
                      padding: 4px 8px;
                      border-radius: 8px;
                      font-size: 10px;
                      white-space: nowrap;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                      border: 1px solid #007bff;
                    ">
                      🔴 Unit ${pl.unitId} → Emergency #${pl.emergencyId}
                      ${pl.progress ? `<br/><small>Progress: ${Math.round(pl.progress * 100)}%</small>` : ''}
                    </div>
                  `,
                  iconSize: [100, 30],
                  iconAnchor: [50, 15],
                })}
                zIndexOffset={1000}
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
