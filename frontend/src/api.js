import axios from "axios";

const api = axios.create({
  // Use explicit IPv4 to avoid macOS AirPlay (AirTunes) on ::1:5000
  baseURL: "http://127.0.0.1:5000",
  timeout: 5000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
