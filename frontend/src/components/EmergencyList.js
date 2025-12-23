import React from "react";

function EmergencyList({
  emergencies = [],
  onSelect,
  selectedId,
  onDispatch,
  onComplete,
  availableByType = {},
}) {
  if (!emergencies.length) {
    return <p>No emergency requests yet.</p>;
  }

  return (
    <table border="1" cellPadding="6" cellSpacing="0" style={{ width: "100%", marginTop: "10px" }}>
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Status</th>
          <th>Lat</th>
          <th>Lng</th>
          <th>Assigned Unit</th>
          <th>Approved By</th>
          <th>Created At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {emergencies.map((e) => (
          <tr
            key={e.request_id}
            onClick={() => onSelect && onSelect(e)}
            style={{
              cursor: onSelect ? "pointer" : "default",
              background: selectedId === e.request_id ? "#f0f8ff" : "transparent",
            }}
          >
            <td>{e.request_id}</td>
            <td>{e.emergency_type}</td>
            <td>{e.status}</td>
            <td>{e.latitude}</td>
            <td>{e.longitude}</td>
            <td>{e.assigned_unit ?? "—"}</td>
            <td>{e.approved_by ?? "—"}</td>
            <td>{e.created_at ?? "—"}</td>
            <td style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {e.status === "PENDING" && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDispatch && onDispatch(e);
                  }}
                  disabled={(availableByType[e.emergency_type] || 0) === 0}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "1px solid #d0d7de",
                    background: "#e8f0fe",
                    cursor: (availableByType[e.emergency_type] || 0) === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Approve & Dispatch
                </button>
              )}
              {e.status === "ASSIGNED" && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onComplete && onComplete(e);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "1px solid #d0d7de",
                    background: "#e9f7ef",
                    cursor: "pointer",
                  }}
                >
                  Mark Complete
                </button>
              )}
              {e.status !== "PENDING" && e.status !== "ASSIGNED" && (
                <span style={{ color: "#5f6b7a", fontSize: "12px" }}>—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default EmergencyList;

