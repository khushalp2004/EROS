import React, { useEffect, useState, useMemo } from "react";
import api from "../api";
import MapView from "../components/MapView";
import EmergencyList from "../components/EmergencyList";

function Dashboard() {
  const [units, setUnits] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null); // {type, message}
  const [simTracks, setSimTracks] = useState({}); // request_id -> {start, end, t0, durationMs}
  const [tick, setTick] = useState(0); // simple timer to drive animation
  const [routeCache, setRouteCache] = useState({}); // request_id -> {coords}

  const showToast = (message, type = "info", duration = 3500) => {
    setToast({ message, type });
    if (duration) {
      setTimeout(() => setToast(null), duration);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resUnits, resEmergencies] = await Promise.all([
        api.get("/authority/units"),
        api.get("/authority/emergencies"),
      ]);
      setUnits(resUnits.data);
      setEmergencies(resEmergencies.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Drive animation timer
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const filteredEmergencies =
    statusFilter === "ALL"
      ? emergencies
      : emergencies.filter((e) => (e.status || "").toUpperCase() === statusFilter);

  // If current selection is filtered out, clear it
  const isSelectedVisible =
    selectedEmergency &&
    filteredEmergencies.some((e) => e.request_id === selectedEmergency.request_id);
  const activeSelection = isSelectedVisible ? selectedEmergency : null;

  const availableByType = units.reduce((acc, u) => {
    if (u.status === "AVAILABLE") {
      acc[u.service_type] = (acc[u.service_type] || 0) + 1;
    }
    return acc;
  }, {});

  // Build/refresh simulated tracks for assigned emergencies
  useEffect(() => {
    const unitById = Object.fromEntries(units.map((u) => [u.unit_id, u]));
    const nextTracks = {};
    emergencies
      .filter((e) => e.status === "ASSIGNED" && e.assigned_unit)
      .forEach((e) => {
        const unit = unitById[e.assigned_unit];
        if (!unit) return;
        const existing = simTracks[e.request_id];
        nextTracks[e.request_id] = {
          start: [unit.latitude, unit.longitude],
          end: [e.latitude, e.longitude],
          t0: existing?.t0 || Date.now(),
          durationMs: existing?.durationMs || 60_000, // 1 minute simulated travel
        };
      });
    setSimTracks(nextTracks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencies, units]);

  // Fetch realistic route polyline for assigned emergencies (OSRM public demo)
  useEffect(() => {
    const assigned = emergencies.filter((e) => e.status === "ASSIGNED" && e.assigned_unit);
    const unitById = Object.fromEntries(units.map((u) => [u.unit_id, u]));

    assigned.forEach((e) => {
      if (routeCache[e.request_id]) return;
      const unit = unitById[e.assigned_unit];
      if (!unit) return;

      const fetchRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${unit.longitude},${unit.latitude};${e.longitude},${e.latitude}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          const coords = data?.routes?.[0]?.geometry?.coordinates || [];
          // coords from OSRM are [lon, lat]; convert to [lat, lon]
          const latlng = coords.map(([lon, lat]) => [lat, lon]);
          setRouteCache((prev) => ({ ...prev, [e.request_id]: { coords: latlng } }));
        } catch (err) {
          // fallback will use straight line
          setRouteCache((prev) => ({ ...prev, [e.request_id]: { coords: [] } }));
        }
      };
      fetchRoute();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencies, units, routeCache]);

  // Helper: interpolate along polyline by fraction
  const interpolatePolyline = (coords, frac) => {
    if (!coords || coords.length === 0) return null;
    if (coords.length === 1) return coords[0];
    // compute cumulative distances
    const segs = [];
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [lat1, lon1] = coords[i];
      const [lat2, lon2] = coords[i + 1];
      const d = Math.hypot(lat2 - lat1, lon2 - lon1);
      segs.push({ d, from: coords[i], to: coords[i + 1] });
      total += d;
    }
    const target = frac * total;
    let acc = 0;
    for (const s of segs) {
      if (acc + s.d >= target) {
        const localFrac = s.d === 0 ? 0 : (target - acc) / s.d;
        return [
          s.from[0] + (s.to[0] - s.from[0]) * localFrac,
          s.from[1] + (s.to[1] - s.from[1]) * localFrac,
        ];
      }
      acc += s.d;
    }
    return coords[coords.length - 1];
  };

  // Compute simulated positions for assigned emergencies
  const simulatedUnitMarkers = Object.entries(simTracks).map(([reqId, track]) => {
    const now = Date.now();
    const frac = Math.min(1, Math.max(0, (now - track.t0) / track.durationMs));
    const route = routeCache[reqId]?.coords;
    let lat, lng;
    if (route && route.length > 1) {
      const pos = interpolatePolyline(route, frac);
      lat = pos[0];
      lng = pos[1];
    } else {
      lat = track.start[0] + (track.end[0] - track.start[0]) * frac;
      lng = track.start[1] + (track.end[1] - track.start[1]) * frac;
    }
    return {
      request_id: Number(reqId),
      latitude: lat,
      longitude: lng,
      type: "Unit (simulated)",
      status: "ENROUTE",
      isSimulated: true,
    };
  });

  // Build simulated polylines from unit start to emergency
  const simulatedPolylines = Object.entries(simTracks).map(([reqId, track]) => {
    const route = routeCache[reqId]?.coords;
    const positions = route && route.length > 1 ? route : [track.start, track.end];
    return {
      request_id: Number(reqId),
      positions,
      color: "#0080ff",
    };
  });

  const handleDispatch = async (emergency) => {
    try {
      await api.post(`/authority/dispatch/${emergency.request_id}`);
      showToast("Emergency approved & dispatched", "success");
      await fetchData();
    } catch (err) {
      console.error("Dispatch error:", err);
      const msg =
        err?.response?.data?.error ||
        "No ambulance available for this emergency (within 50 km).";
      showToast(msg, "error");
    }
  };

  const handleComplete = async (emergency) => {
    try {
      await api.post(`/authority/complete/${emergency.request_id}`);
      showToast("Marked complete; unit is now available", "success");
      await fetchData();
    } catch (err) {
      console.error("Complete error:", err);
      const msg = err?.response?.data?.error || "Unable to mark complete.";
      showToast(msg, "error");
    }
  };

  // Choose markers for the map, showing simulated unit if relevant
  const mapMarkers = (() => {
    if (activeSelection) {
      const simForSelection = simulatedUnitMarkers.filter(
        (m) => m.request_id === activeSelection.request_id
      );
      return [
        { ...activeSelection, type: activeSelection.emergency_type },
        ...simForSelection,
      ];
    }
    return [
      ...filteredEmergencies.map((e) => ({ ...e, type: e.emergency_type })),
      ...simulatedUnitMarkers,
    ];
  })();

  const cardStyle = {
    background: "#fff",
    borderRadius: "12px",
    padding: "12px",
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
    border: "1px solid #eaeaea",
  };

  const sectionTitleStyle = { margin: "0 0 8px 0" };

  return (
    <div style={{ padding: "16px", background: "#f6f8fb", minHeight: "100vh" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "16px",
            right: "16px",
            padding: "12px 14px",
            borderRadius: "10px",
            background: toast.type === "error" ? "#ffe9e6" : "#e7f5ff",
            color: toast.type === "error" ? "#d1433f" : "#0b7285",
            boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
            border: `1px solid ${toast.type === "error" ? "#f5c2c0" : "#b5e0f2"}`,
            zIndex: 1000,
            maxWidth: "320px",
          }}
        >
          {toast.message}
        </div>
      )}
      <h2 style={{ marginBottom: "16px" }}>Authority Dashboard</h2>

      <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#5f6b7a" }}>
          {loading ? "Refreshing..." : "Live overview"}
        </div>
        <button
          onClick={fetchData}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #d0d7de",
            background: "#f3f4f6",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "stretch" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...cardStyle, height: "100%" }}>
            <h3 style={sectionTitleStyle}>Units</h3>
            <MapView markers={units.map((u) => ({ ...u, type: u.service_type }))} />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...cardStyle, height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <h3 style={sectionTitleStyle}>Emergencies</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                <label style={{ fontWeight: 600 }}>Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ padding: "6px 8px", borderRadius: "8px", border: "1px solid #d0d7de" }}
                >
                  <option value="ALL">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="COMPLETED">Completed</option>
                </select>
                <span style={{ color: "#5f6b7a" }}>
                  Showing {filteredEmergencies.length} / {emergencies.length}
                </span>
              </div>
            </div>
            <MapView
              markers={
                activeSelection
                  ? [{ ...activeSelection, type: activeSelection.emergency_type }]
                  : filteredEmergencies.map((e) => ({ ...e, type: e.emergency_type }))
              }
              polylines={
                activeSelection
                  ? simulatedPolylines.filter((p) => p.request_id === activeSelection.request_id)
                  : simulatedPolylines
              }
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: "16px" }}>
        <div style={cardStyle}>
          <h3 style={sectionTitleStyle}>Emergency List</h3>
          <EmergencyList
            emergencies={filteredEmergencies}
            onSelect={setSelectedEmergency}
            selectedId={activeSelection?.request_id}
            onDispatch={handleDispatch}
            onComplete={handleComplete}
            availableByType={availableByType}
          />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
