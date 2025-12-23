import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import AddEmergency from "./components/AddEmergency";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <Router>
      <div>
        <nav>
          <Link to="/">Reporter</Link> | <Link to="/dashboard">Dashboard</Link>
        </nav>
        <Routes>
          <Route path="/" element={<AddEmergency />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
