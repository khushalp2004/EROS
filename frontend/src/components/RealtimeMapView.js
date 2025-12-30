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
  isAnimated = false,
  pathOptions = {},
  isRealtime = false,
  serviceType = null,
  unitId = null,
  routeId = null,
  progress = 0 // NEW: Progress percentage (0-1)
}) {
  if (!positions || positions.length === 0) return null;
  if (positions.length < 2) return null;

  // Calculate positions based on progress
  const getProgressPositions = (positions, progress) => {
    if (!isRealtime || progress === 0) return [];
    if (progress >= 1.0) return positions;
    
    const totalPositions = positions.length;
    const progressIndex = Math.floor(totalPositions * progress);
    
    // Ensure we have at least the starting position
    const progressPositions = positions.slice(0, Math.max(2, progressIndex + 1));
    
    // If we have a fractional position, interpolate the last point
    if (progressIndex < totalPositions - 1) {
      const fractionalPart = (totalPositions * progress) - progressIndex;
      if (fractionalPart > 0) {
        const startPoint = positions[progressIndex];
        const endPoint = positions[progressIndex + 1];
        
        // Linear interpolation for the fractional position
        const interpolatedPoint = [
          startPoint[0] + (endPoint[0] - startPoint[0]) * fractionalPart,
          startPoint[1] + (endPoint[1] - startPoint[1]) * fractionalPart
        ];
        
        progressPositions[progressPositions.length - 1] = interpolatedPoint;
      }
    }
    
    return progressPositions;
  };

  // Get current position based on progress
  const getCurrentPosition = (positions, progress) => {
    if (progress <= 0) return positions[0];
    if (progress >= 1.0) return positions[positions.length - 1];
    
    const totalPositions = positions.length;
    const progressIndex = Math.floor(totalPositions * progress);
    const fractionalPart = (totalPositions * progress) - progressIndex;
    
    if (progressIndex >= totalPositions - 1) {
      return positions[totalPositions - 1];
    }
    
    const startPoint = positions[progressIndex];
    const endPoint = positions[progressIndex + 1];
    
    return [
      startPoint[0] + (endPoint[0] - startPoint[0]) * fractionalPart,
      startPoint[1] + (endPoint[1] - startPoint[1]) * fractionalPart
    ];
  };

  // Get service emoji based on service type
  const getServiceEmoji = () => {
    switch (serviceType) {
      case 'AMBULANCE': return '🚑';
      case 'FIRE_TRUCK': return '🚒';
      case 'POLICE': return '🚓';
      default: return '🚐';
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
    opacity: isRealtime ? 1.0 : 0.8,
    dashArray: isRealtime ? null : "10 10",
    className: "enhanced-route-line"
  };

  const mergedOptions = { ...defaultOptions, ...pathOptions };

  // Add service type class
  if (serviceType && !mergedOptions.className.includes(getRouteClass())) {
    mergedOptions.className += ` ${getRouteClass()}`;
  }

  // Get progress-based data
  const progressPositions = getProgressPositions(positions, progress);
  const currentPosition = getCurrentPosition(positions, progress);
  const completedPositions = getProgressPositions(positions, 1.0); // Complete route for reference

  return (
    <div>
      {/* Complete route line (faded, for reference) */}
      {isRealtime && (
        <Polyline
          positions={completedPositions}
          pathOptions={{
            ...mergedOptions,
            opacity: 0.3,
            weight: 2,
            color: color + '80', // Add transparency
            dashArray: "5 5"
          }}
        />
      )}

      {/* Progress-based animated polyline */}
      {progressPositions.length > 0 && (
        <Polyline
          positions={progressPositions}
          pathOptions={{
            ...mergedOptions,
            className: `progress-route-line ${getRouteClass()}`,
            weight: isRealtime ? 8 : 6, // Thicker for progress
            opacity: isRealtime ? 1.0 : 0.8
          }}
        />
      )}

      {/* Moving unit marker at current position with integrated status */}
      {isRealtime && progress > 0 && (
        <Marker
          position={currentPosition}
          icon={L.divIcon({
            className: "moving-unit-marker",
            html: `
              <div style="
                position: relative;
                width: 40px;
                height: 40px;
                background: ${color};
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                color: white;
                font-weight: bold;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                animation: unitMovePulse 1.5s infinite;
                z-index: 1000;
              ">
                <!-- Service Emoji -->
                <div style="font-size: 14px; margin-bottom: 1px;">
                  ${getServiceEmoji()}
                </div>
                <!-- Status Text -->
                <div style="
                  font-size: 8px;
                  font-weight: bold;
                  background: rgba(0,0,0,0.7);
                  padding: 1px 3px;
                  border-radius: 4px;
                  line-height: 1;
                  margin-top: 1px;
                ">
                  ${progress < 0.1 ? 'DEPARTED' : 
                    progress < 0.9 ? 'ENROUTE' : 
                    progress < 1.0 ? 'ARRIVING' : 'ARRIVED'}
                </div>
                <!-- Progress Percentage -->
                <div style="
                  position: absolute;
                  top: -25px;
                  left: 50%;
                  transform: translateX(-50%);
                  background: rgba(0, 0, 0, 0.8);
                  color: white;
                  padding: 2px 4px;
                  border-radius: 6px;
                  font-size: 9px;
                  font-weight: bold;
                  white-space: nowrap;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                ">
                  ${(progress * 100).toFixed(0)}%
                </div>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })}
          zIndexOffset={1000}
        >
          <Popup>
            <div>
              <strong>🚗 Unit {unitId} - Route Progress</strong><br/>
              <strong>Service:</strong> {serviceType}<br/>
              <strong>Status:</strong> 
              <span style={{ 
                color: progress < 0.1 ? '#6c757d' : 
                       progress < 0.9 ? '#007bff' : 
                       progress < 1.0 ? '#ffc107' : '#28a745',
                fontWeight: 'bold'
              }}>
                ${progress < 0.1 ? 'DEPARTED' : 
                  progress < 0.9 ? 'ENROUTE' : 
                  progress < 1.0 ? 'ARRIVING' : 'ARRIVED'}
              </span><br/>
              <strong>Progress:</strong> {(progress * 100).toFixed(1)}%<br/>
              <small>Real-time tracking active</small>
            </div>
          </Popup>
        </Marker>
      )}




    </div>
  );
}



function MapView({ 
  markers, 
  center = null, 
  polylines = [], 
  showRealtimeData = true, 
  animateRoutes = true, 
  mapRef = null, 
  onMapClick = null, 
  selectionMode = false, 
  zoom = null,
  height = "500px",
  showUnitMarkers = false
}) {
  const defaultCenter = [19.076, 72.8777];
  const mapCenter = center || (markers.length === 1
    ? [markers[0].latitude, markers[0].longitude]
    : defaultCenter);
  const mapZoom = zoom || (markers.length === 1 ? 14 : 12);

  // Helper function to calculate approximate progress based on position - MOVED HERE TO FIX INITIALIZATION
  const calculateApproximateProgress = (routePositions, currentPosition) => {
    if (!routePositions || routePositions.length < 2 || !currentPosition) {
      return 0;
    }

    const [currLat, currLng] = currentPosition;
    let minDistance = Infinity;
    let closestIndex = 0;

    // Find the closest point on the route
    routePositions.forEach((point, index) => {
      const [pointLat, pointLng] = point;
      const distance = Math.sqrt(
        Math.pow(currLat - pointLat, 2) + Math.pow(currLng - pointLng, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // Return progress as percentage of route completed
    return closestIndex / (routePositions.length - 1);
  };

  // Use real-time unit data if enabled
  const realtimeData = useRealtimeUnitMarkers(markers);
  const finalMarkers = showRealtimeData ? realtimeData.markers : markers;

  // Handle map click for location selection
  const handleMapClick = (e) => {
    if (selectionMode && onMapClick) {
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);
    }
  };

  // Add click event handler to map container
  const mapContainerProps = selectionMode && onMapClick ? {
    onclick: handleMapClick
  } : {};

  // ✅ SIMPLIFIED: Process polylines for backend-driven routes - Complete routes only
  const enhancedPolylines = React.useMemo(() => {
    return polylines.map(polyline => {
      const hasRealtimeData = finalMarkers.some(marker =>
        marker.unit_id === polyline.unitId && marker.isRealtime
      );

      // Calculate progress for this route based on realtime marker data
      let progress = 0;
      if (hasRealtimeData) {
        const realtimeMarker = finalMarkers.find(marker =>
          marker.unit_id === polyline.unitId && marker.isRealtime
        );
        
        if (realtimeMarker && realtimeMarker.routeProgress !== undefined) {
          // Use backend-provided progress if available
          progress = Math.max(0, Math.min(1, realtimeMarker.routeProgress));
        } else {
          // Calculate approximate progress based on position if no backend progress
          // This is a fallback calculation
          progress = calculateApproximateProgress(
            polyline.positions, 
            realtimeMarker ? [realtimeMarker.latitude, realtimeMarker.longitude] : null
          );
        }
      }

      return {
        ...polyline,
        routeId: `route-${polyline.unitId}-${polyline.emergencyId}`,
        isAnimated: animateRoutes,
        isRealtime: hasRealtimeData,
        progress: progress, // NEW: Progress percentage (0-1)
        pathOptions: {
          color: hasRealtimeData ? polyline.color : '#6c757d',
          weight: hasRealtimeData ? 6 : 4,
          opacity: hasRealtimeData ? 1.0 : 0.6,
          dashArray: hasRealtimeData ? null : "8 4"
        }
      };
    });
  }, [polylines, finalMarkers, animateRoutes]);

  // Always render the map, even with no markers (for selection mode)
  const shouldShowEmptyMessage = !finalMarkers || finalMarkers.length === 0;

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
          
          @keyframes unitMovePulse {
            0% { transform: scale(1); box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
            50% { transform: scale(1.1); box-shadow: 0 6px 12px rgba(0,0,0,0.5); }
            100% { transform: scale(1); box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
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
        style={{ height }}
        {...mapContainerProps}
      >
        {center && <MapAutoCenter center={center} />}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Show regular unit markers based on toggle - hide during route simulation unless specifically enabled */}
        {(!polylines || polylines.length === 0 || showUnitMarkers) ? finalMarkers.map((m, i) => {
          // Filter out unit markers if showUnitMarkers is false (during route simulation)
          const isUnit = m.unit_id !== undefined;
          const isEmergency = m.request_id !== undefined && !isUnit;
          
          // During route simulation (polylines exist), hide regular unit markers unless showUnitMarkers is true
          if ((polylines && polylines.length > 0) && isUnit && !showUnitMarkers) {
            return null;
          }
          
          // Always show emergency markers
          // Enhanced popup content for units
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
        }) : null}
        
        {/* Route polylines with start/end markers for dashboard view */}
        {enhancedPolylines.map((pl, idx) => (
          <React.Fragment key={pl.id || idx}>
            {/* Start marker (unit starting position) - shown in dashboard */}
            <Marker
              position={pl.positions[0]}
              icon={L.divIcon({
                className: "start-marker-dashboard",
                html: `
                  <div style="
                    position: relative;
                    width: 24px;
                    height: 24px;
                    background: #28a745;
                    border: 3px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    animation: startPulse 2s infinite;
                  ">
                    🚩 START
                  </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
              zIndexOffset={800}
            >
              <Popup>
                <div>
                  <strong>🚩 Starting Point</strong><br/>
                  Unit {pl.unitId} Departure<br/>
                  <small>Service: {pl.serviceType}</small>
                </div>
              </Popup>
            </Marker>
            
            {/* End marker (emergency location) - shown in dashboard */}
            <Marker
              position={pl.positions[pl.positions.length - 1]}
              icon={L.divIcon({
                className: "end-marker-dashboard",
                html: `
                  <div style="
                    position: relative;
                    width: 24px;
                    height: 24px;
                    background: #dc3545;
                    border: 3px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    animation: endPulse 2s infinite;
                  ">
                    🎯 END
                  </div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              })}
              zIndexOffset={800}
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
              isAnimated={pl.isAnimated && animateRoutes}
              pathOptions={pl.pathOptions}
              isRealtime={pl.isRealtime}
              serviceType={pl.serviceType}
              unitId={pl.unitId}
              routeId={pl.routeId}
              progress={pl.progress || 0}
            />
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
      
      {/* Empty state message for non-selection mode */}
      {shouldShowEmptyMessage && !selectionMode && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #ddd',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📍</div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            No locations to display
          </div>
        </div>
      )}
    </>
  );
}

export default MapView;
