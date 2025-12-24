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
    if (service_type === 'AMBULANCE') return '🚑';
    if (service_type === 'FIRE_TRUCK') return '🚒';
    if (service_type === 'POLICE') return '🚓';
    return '🚐';
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

function AnimatedPolyline({ positions, progress = 1, color = "#0080ff", originalPositions = [] }) {
  // Calculate how much of the polyline to show based on progress
  const visiblePositions = positions.slice(0, Math.max(2, Math.floor(positions.length * progress)));
  
  return (
    <>
      {/* Draw the full route as a faint background */}
      {originalPositions.length > 1 && (
        <Polyline
          positions={originalPositions}
          pathOptions={{ 
            color: color, 
            weight: 2, 
            opacity: 0.2, 
            dashArray: "3 3" 
          }}
        />
      )}
      {/* Draw the animated progress */}
      {visiblePositions.length > 1 && (
        <Polyline
          positions={visiblePositions}
          pathOptions={{ 
            color: color, 
            weight: 6, 
            opacity: 0.8,
            className: "animated-route"
          }}
        />
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
              html: '<div style="font-size:20px; line-height:20px;">🚑</div>',
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
                    <strong>🚑 Unit {m.unit_id}</strong><br/>
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
          />
        ))}
      </MapContainer>
    </>
  );
}

export default MapView;
