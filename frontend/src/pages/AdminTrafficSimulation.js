import React, { useCallback, useMemo, useState, useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import { authAPI } from "../api";
import Breadcrumbs from "../components/Breadcrumbs";
import "leaflet/dist/leaflet.css";
import "../styles/admin-traffic.css";

const JAM_LEVELS = ["LOW", "MEDIUM", "HIGH"];
const JAM_LEVEL_INDEX = { LOW: 0, MEDIUM: 1, HIGH: 2 };

const JAM_COLORS = {
  LOW: "#f59e0b",
  MEDIUM: "#f97316",
  HIGH: "#dc2626"
};

const pointIcon = L.divIcon({
  className: "traffic-point-icon-wrap",
  html: '<div class="traffic-point-icon"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

function DraftClickHandler({ disabled, onPointAdd }) {
  useMapEvents({
    click(event) {
      if (!disabled) {
        onPointAdd([event.latlng.lat, event.latlng.lng]);
      }
    }
  });
  return null;
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      map.setView(center, Math.max(map.getZoom(), 13), { animate: true });
    }
  }, [center, map]);
  return null;
}

function toLatLngArray(geometry) {
  if (!geometry || geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)) {
    return [];
  }
  return geometry.coordinates
    .filter((coord) => Array.isArray(coord) && coord.length === 2)
    .map(([lng, lat]) => [lat, lng]);
}

function toGeoJsonLineString(latLngPoints) {
  return {
    type: "LineString",
    coordinates: latLngPoints.map(([lat, lng]) => [lng, lat])
  };
}

function JamLevelSlider({ value, onChange, disabled = false }) {
  const sliderValue = JAM_LEVEL_INDEX[value] ?? 1;

  return (
    <div className="traffic-jam-slider">
      <div className="traffic-jam-slider-head">
        <span>Jam Level</span>
        <strong>{value}</strong>
      </div>
      <input
        type="range"
        min={0}
        max={JAM_LEVELS.length - 1}
        step={1}
        value={sliderValue}
        disabled={disabled}
        onChange={(e) => {
          const nextLevel = JAM_LEVELS[Number(e.target.value)] || "MEDIUM";
          onChange(nextLevel);
        }}
        aria-label="Traffic jam severity"
      />
      <div className="traffic-jam-slider-marks">
        {JAM_LEVELS.map((level) => (
          <span key={level}>{level}</span>
        ))}
      </div>
    </div>
  );
}

function CreateSimulationPanel({
  draftName,
  setDraftName,
  draftCity,
  setDraftCity,
  draftZone,
  setDraftZone,
  draftLevel,
  setDraftLevel,
  draftPointsCount,
  editingMode,
  saving,
  onUndo,
  onClear,
  onSave
}) {
  return (
    <div className="admin-traffic-section">
      <h3>Create Simulation</h3>
      <div className="admin-traffic-form">
        <input
          type="text"
          placeholder="Simulation name (optional)"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
        />
        <input
          type="text"
          placeholder="City (e.g., Mumbai)"
          value={draftCity}
          onChange={(e) => setDraftCity(e.target.value)}
        />
        <input
          type="text"
          placeholder="Zone (e.g., South)"
          value={draftZone}
          onChange={(e) => setDraftZone(e.target.value)}
        />
        <JamLevelSlider value={draftLevel} onChange={setDraftLevel} disabled={editingMode} />
        <div className="admin-traffic-meta">Draft points: {draftPointsCount}</div>
        <div className="admin-traffic-actions">
          <button type="button" onClick={onUndo} disabled={draftPointsCount === 0 || editingMode}>Undo</button>
          <button type="button" onClick={onClear} disabled={draftPointsCount === 0 || editingMode}>Clear</button>
          <button
            type="button"
            className="primary"
            onClick={onSave}
            disabled={draftPointsCount < 2 || saving || editingMode}
          >
            {saving ? "Saving..." : "Save Simulation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchSimulationsPanel({
  cityFilter,
  setCityFilter,
  zoneFilter,
  setZoneFilter,
  searchText,
  setSearchText,
  onApplyFilters,
  onClearFilters,
  loading,
  simulations,
  editingSegmentId,
  onSaveEditedPath,
  onCancelEdit,
  onUpdateSimulation,
  onStartEditPath,
  onDeleteSimulation
}) {
  return (
    <div className="admin-traffic-section">
      <h3>Search Simulations</h3>
      <div className="admin-traffic-form admin-traffic-filter-form">
        <input
          type="text"
          placeholder="Filter by city"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
        />
        <input
          type="text"
          placeholder="Filter by zone"
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
        />
        <input
          type="text"
          placeholder="Search simulations (name/city/zone/state)"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div className="admin-traffic-actions">
          <button type="button" onClick={onApplyFilters}>Apply Filters</button>
          <button type="button" onClick={onClearFilters}>Clear Filters</button>
        </div>
      </div>

      {editingSegmentId && (
        <>
          <h3>Edit Simulation Path</h3>
          <div className="admin-traffic-actions">
            <button type="button" className="primary" onClick={onSaveEditedPath}>
              Save Edited Path
            </button>
            <button type="button" onClick={onCancelEdit}>Cancel Edit</button>
          </div>
        </>
      )}

      <h3>All Simulations</h3>
      {loading ? (
        <p className="admin-traffic-empty">Loading simulations...</p>
      ) : simulations.length === 0 ? (
        <p className="admin-traffic-empty">No simulations found.</p>
      ) : (
        <div className="admin-traffic-list">
          {simulations.map((segment) => (
            <div key={segment.id} className="admin-traffic-item">
              <div className="admin-traffic-item-head">
                <strong>{segment.name || `Simulation #${segment.id}`}</strong>
                <span
                  className="admin-traffic-level"
                  style={{ background: JAM_COLORS[segment.jam_level] || "#64748b" }}
                >
                  {segment.jam_level}
                </span>
              </div>
              <div className="admin-traffic-item-submeta">
                <span>{segment.city || "No city"}</span>
                <span>{segment.zone || "No zone"}</span>
              </div>
              <div className="admin-traffic-item-actions">
                <JamLevelSlider
                  value={segment.jam_level}
                  onChange={(nextLevel) => onUpdateSimulation(segment.id, { jam_level: nextLevel })}
                />
                <button type="button" onClick={() => onStartEditPath(segment)}>Edit Path</button>
                <button type="button" onClick={() => onUpdateSimulation(segment.id, { is_active: !segment.is_active })}>
                  {segment.is_active ? "Disable" : "Enable"}
                </button>
                <button type="button" className="danger" onClick={() => onDeleteSimulation(segment.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminTrafficSimulation() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draftPoints, setDraftPoints] = useState([]);
  const [draftLevel, setDraftLevel] = useState("MEDIUM");
  const [draftName, setDraftName] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftZone, setDraftZone] = useState("");

  const [cityFilter, setCityFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activePanel, setActivePanel] = useState("create");

  const [editingSegmentId, setEditingSegmentId] = useState(null);
  const [editingPoints, setEditingPoints] = useState([]);
  const [mapCenter, setMapCenter] = useState([19.076, 72.8777]);

  const fetchSegments = useCallback(async (city = cityFilter, zone = zoneFilter) => {
    try {
      setLoading(true);
      const params = {};
      if ((city || "").trim()) params.city = city.trim();
      if ((zone || "").trim()) params.zone = zone.trim();
      const response = await authAPI.admin.getTrafficSegments(params);
      if (response.data?.success) {
        setSegments(response.data.segments || []);
      }
    } catch (error) {
      console.error("Failed to load traffic segments:", error);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, zoneFilter]);

  useEffect(() => {
    fetchSegments("", "");
  }, [fetchSegments]);

  const addDraftPoint = useCallback((point) => {
    setDraftPoints((prev) => [...prev, point]);
  }, []);

  const handleUndo = () => setDraftPoints((prev) => prev.slice(0, -1));
  const handleClearDraft = () => setDraftPoints([]);

  const startEditSegment = (segment) => {
    setEditingSegmentId(segment.id);
    setEditingPoints(toLatLngArray(segment.geometry));
    setDraftPoints([]);
  };

  const cancelEditSegment = () => {
    setEditingSegmentId(null);
    setEditingPoints([]);
  };

  const saveEditedSegmentPath = async () => {
    if (!editingSegmentId || editingPoints.length < 2) return;
    try {
      setSaving(true);
      await authAPI.admin.updateTrafficSegment(editingSegmentId, {
        geometry: toGeoJsonLineString(editingPoints)
      });
      cancelEditSegment();
      await fetchSegments();
    } catch (error) {
      console.error("Failed to save edited path:", error);
    } finally {
      setSaving(false);
    }
  };

  const saveDraftSegment = async () => {
    if (draftPoints.length < 2) return;
    try {
      setSaving(true);
      const response = await authAPI.admin.createTrafficSegment({
        name: draftName.trim() || null,
        city: draftCity.trim() || null,
        zone: draftZone.trim() || null,
        jam_level: draftLevel,
        geometry: toGeoJsonLineString(draftPoints),
        is_active: true
      });

      if (response.data?.success) {
        setDraftPoints([]);
        setDraftName("");
        setDraftCity("");
        setDraftZone("");
        await fetchSegments();
      }
    } catch (error) {
      console.error("Failed to create traffic segment:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateSegment = async (segmentId, patch) => {
    try {
      await authAPI.admin.updateTrafficSegment(segmentId, patch);
      await fetchSegments();
    } catch (error) {
      console.error("Failed to update traffic segment:", error);
    }
  };

  const removeSegment = async (segmentId) => {
    try {
      await authAPI.admin.deleteTrafficSegment(segmentId);
      if (editingSegmentId === segmentId) {
        cancelEditSegment();
      }
      await fetchSegments();
    } catch (error) {
      console.error("Failed to delete traffic segment:", error);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.error("Could not fetch location:", err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const filteredSegments = useMemo(() => {
    const query = (searchText || "").trim().toLowerCase();
    if (!query) return segments;

    return segments.filter((segment) => {
      const haystack = [
        segment.name || "",
        segment.city || "",
        segment.zone || "",
        segment.jam_level || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [segments, searchText]);

  const visiblePolylines = useMemo(() => {
    return filteredSegments
      .map((segment) => ({
        id: segment.id,
        level: segment.jam_level,
        isActive: segment.is_active,
        positions: toLatLngArray(segment.geometry)
      }))
      .filter((segment) => segment.positions.length >= 2);
  }, [filteredSegments]);

  return (
    <div className="dashboard-container admin-page">
      <Breadcrumbs />
      <div className="dashboard-main admin-shell">
        <section className="admin-traffic-hero">
          <div>
            <div className="admin-hero-eyebrow">Traffic Simulation</div>
            <h1 className="admin-hero-title">Manual Traffic Jam Editor</h1>
            <p className="admin-hero-subtitle">
              Draw road segments with jam levels. Dispatch routing avoids blocked/heavy paths where alternatives exist.
            </p>
          </div>
          <div className="admin-traffic-hero-actions">
            <button type="button" className="admin-traffic-back-btn" onClick={handleUseMyLocation}>
              Use My Location
            </button>
            <Link to="/admin" className="admin-traffic-back-btn">Back to Admin</Link>
          </div>
        </section>

        <section className="admin-traffic-layout">
          <article className="admin-traffic-card">
            <div className="admin-traffic-map-wrap">
              <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
                <MapRecenter center={mapCenter} />
                <TileLayer
                  attribution='Tiles &copy; Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <DraftClickHandler disabled={!!editingSegmentId} onPointAdd={addDraftPoint} />

                {visiblePolylines.map((segment) => (
                  <Polyline
                    key={segment.id}
                    positions={segment.positions}
                    pathOptions={{
                      color: JAM_COLORS[segment.level] || "#475569",
                      weight: segment.isActive ? 6 : 4,
                      opacity: segment.isActive ? 0.9 : 0.35
                    }}
                  />
                ))}

                {draftPoints.length >= 2 && !editingSegmentId && (
                  <Polyline
                    positions={draftPoints}
                    pathOptions={{ color: "#2563eb", weight: 5, dashArray: "8 8", opacity: 0.95 }}
                  />
                )}

                {editingSegmentId && editingPoints.length >= 2 && (
                  <>
                    <Polyline
                      positions={editingPoints}
                      pathOptions={{ color: "#38bdf8", weight: 6, dashArray: "10 8", opacity: 0.95 }}
                    />
                    {editingPoints.map((point, idx) => (
                      <Marker
                        key={`${editingSegmentId}-${idx}`}
                        position={point}
                        draggable
                        icon={pointIcon}
                        eventHandlers={{
                          dragend: (event) => {
                            const latlng = event.target.getLatLng();
                            setEditingPoints((prev) =>
                              prev.map((p, i) => (i === idx ? [latlng.lat, latlng.lng] : p))
                            );
                          }
                        }}
                      />
                    ))}
                  </>
                )}
              </MapContainer>
            </div>
            <div className="admin-traffic-hint">
              {editingSegmentId
                ? "Editing mode: drag the blue points, then click Save Edited Path."
                : "Click on map to draw route points. Add at least 2 points, set jam level, then save segment."}
            </div>
          </article>

          <aside className="admin-traffic-card admin-traffic-sidebar">
            <div className="admin-traffic-tabs" role="tablist" aria-label="Simulation panels">
              <span
                className={`admin-traffic-tab-indicator ${activePanel === "search" ? "search" : "create"}`}
                aria-hidden="true"
              />
              <button
                type="button"
                role="tab"
                aria-selected={activePanel === "create"}
                className={`admin-traffic-tab-btn ${activePanel === "create" ? "active" : ""}`}
                onClick={() => setActivePanel("create")}
              >
                Create Simulation
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanel === "search"}
                className={`admin-traffic-tab-btn ${activePanel === "search" ? "active" : ""}`}
                onClick={() => setActivePanel("search")}
              >
                Search Simulations
              </button>
            </div>

            {activePanel === "create" ? (
              <CreateSimulationPanel
                draftName={draftName}
                setDraftName={setDraftName}
                draftCity={draftCity}
                setDraftCity={setDraftCity}
                draftZone={draftZone}
                setDraftZone={setDraftZone}
                draftLevel={draftLevel}
                setDraftLevel={setDraftLevel}
                draftPointsCount={draftPoints.length}
                editingMode={!!editingSegmentId}
                saving={saving}
                onUndo={handleUndo}
                onClear={handleClearDraft}
                onSave={saveDraftSegment}
              />
            ) : (
              <SearchSimulationsPanel
                cityFilter={cityFilter}
                setCityFilter={setCityFilter}
                zoneFilter={zoneFilter}
                setZoneFilter={setZoneFilter}
                searchText={searchText}
                setSearchText={setSearchText}
                onApplyFilters={() => fetchSegments(cityFilter, zoneFilter)}
                onClearFilters={() => {
                  setCityFilter("");
                  setZoneFilter("");
                  setSearchText("");
                  fetchSegments("", "");
                }}
                loading={loading}
                simulations={filteredSegments}
                editingSegmentId={editingSegmentId}
                onSaveEditedPath={saveEditedSegmentPath}
                onCancelEdit={cancelEditSegment}
                onUpdateSimulation={updateSegment}
                onStartEditPath={startEditSegment}
                onDeleteSimulation={removeSegment}
              />
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
