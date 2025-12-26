import React from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
const createUnitIcon = (unit) => {
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
          z-index: 999;
        ">
          ${getEmoji()}
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

// Enhanced icons for different emergency types and statuses
const createEmergencyIcon = (emergency) => {
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
          z-index: 999;
        ">
          ${getEmoji()}
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

/**
 * AnimatedPolyline Component (Basic Version)
 * 
 * Refactored to use OSRM geometry + progress-based animation:
 * - OSRM geometry → polyline (fixed) + progress (dynamic) → animation calculated from both
 * 
 * Props:
 * - positions: Array of [lat, lng] coordinates from OSRM route geometry
 * - progress: Float (0-1) representing progress along the route
 * - color: Route color for visualization
 * - originalPositions: Full route coordinates (optional, defaults to positions)
 * - serviceType: Service type for icon selection (optional)
 * - unitId: Unit identifier for tracking (optional)
 */
function AnimatedPolyline({ 
  positions, 
  progress = 1, 
  color = "#0080ff", 
  originalPositions = [], 
  serviceType = null,
  unitId = null
}) {
  // Calculate position at progress for potential future marker usage
  const getProgressPosition = () => {
    if (positions.length === 0) return null;
    
    // Validate progress
    if (progress < 0 || progress > 1 || isNaN(progress)) {
      console.warn(`Invalid progress value: ${progress}. Using 0.`);
      return positions[0]; // Start of route
    }
    
    // Calculate position at progress
    const index = Math.floor(progress * (positions.length - 1));
    return positions[Math.max(0, Math.min(positions.length - 1, index))];
  };

  // Determine final positions
  const fullRoutePositions = originalPositions.length > 0 ? originalPositions : positions;
  const progressPosition = getProgressPosition();
  
  return (
    <>
      {/* 🆕 FULL ROUTE: Draw complete OSRM geometry as main route */}
      {fullRoutePositions.length > 1 && (
        <Polyline
          positions={fullRoutePositions}
          pathOptions={{ 
            color: color, 
            weight: 4, 
            opacity: 0.7,
            className: "animated-route full-route-line"
          }}
        />
      )}
      
      {/* 🆕 PROGRESS POSITION: Calculate position at progress (for future marker usage) */}
      {progressPosition && (
        <Marker
          position={progressPosition}
          icon={L.divIcon({
            className: "progress-marker",
            html: `
              <div style="
                position: relative;
                width: 20px;
                height: 20px;
                background: ${color};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                z-index: 1000;
                animation: pulse 2s infinite;
              "></div>
              <style>
                @keyframes pulse {
                  0% { transform: scale(1); }
                  50% { transform: scale(1.2); }
                  100% { transform: scale(1); }
                }
              </style>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })}
          zIndexOffset={1000}
        >
          <Popup>
            <div>
              <strong>🚩 Route Progress</strong><br/>
              <strong>Unit:</strong> {unitId || 'Unknown'}<br/>
              <strong>Progress:</strong> {(progress * 100).toFixed(1)}%<br/>
              <strong>Animation:</strong> OSRM Geometry + Progress
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

function MapView({ markers, center, polylines = [] }) {
  const defaultCenter = [19.076, 72.8777];
  const mapCenter = center || (markers.length === 1
    ? [markers[0].latitude, markers[0].longitude]
    : defaultCenter);
  const mapZoom = markers.length === 1 ? 14 : 12;

  if (!markers || markers.length === 0) {
    return <p style={{ marginTop: "10px" }}>No locations to display.</p>;
  }

  return (
    <>
      <style>
        {`
          .enhanced-unit-icon {
            background: none !important;
            border: none !important;
          }
          
          .enhanced-emergency-icon {
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
        key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}-${markers.length}`}
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: "500px" }}
      >
        {center && <MapAutoCenter center={center} />}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, i) => {
          // Determine marker type and select appropriate icon
          const isUnit = m.unit_id !== undefined;
          const isEmergency = m.request_id !== undefined && !isUnit;
          
          let markerIcon;
          if (isUnit) {
            markerIcon = createUnitIcon(m);
          } else if (isEmergency) {
            markerIcon = createEmergencyIcon(m);
          } else if (m.isSimulated) {
            // Fallback for simulated markers without service type info
            markerIcon = L.divIcon({
              className: "ambulance-icon",
              html: '<div style="font-size:20px; line-height:20px;"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });
          } else {
            markerIcon = defaultIcon;
          }

          return (
            <Marker
              key={i}
              position={[m.latitude, m.longitude]}
              icon={markerIcon}
              zIndexOffset={m.isSimulated ? 500 : 0}
            >
              <Popup>
                {isUnit ? (
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
                    <strong>Location:</strong> {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
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
                    <strong>Location:</strong> {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
        {polylines.map((pl, idx) => (
          <AnimatedPolyline
            key={idx}
            positions={pl.positions}
            progress={pl.progress || 1}
            color={pl.color || "#0080ff"}
            originalPositions={pl.originalPositions}
            serviceType={pl.serviceType}
            unitId={pl.unitId}
          />
        ))}
      </MapContainer>
    </>
  );
}

export default MapView;
