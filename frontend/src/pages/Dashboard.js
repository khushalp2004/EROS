import React, { useEffect, useState } from "react";
import api from "../api";
import MapView from "../components/MapView";

function Dashboard() {
  const [units, setUnits] = useState([]);
  const [emergencies, setEmergencies] = useState([]);

  useEffect(() => {
  const fetchData = async () => {
    try {
      const resUnits = await api.get("/authority/units");
      const resEmergencies = await api.get("/authority/emergencies");
      setUnits(resUnits.data);
      setEmergencies(resEmergencies.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };
  fetchData();
}, []);


  return (
    <div>
      <h2>Authority Dashboard</h2>

      <h3>Units</h3>
      <MapView markers={units.map(u => ({ ...u, type: u.service_type }))} />

      <h3>Emergencies</h3>
      <MapView markers={emergencies.map(e => ({ ...e, type: e.emergency_type }))} />
    </div>
  );
}

export default Dashboard;
