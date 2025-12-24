// import axios from "axios";

// const api = axios.create({
//   // Use explicit IPv4 to avoid macOS AirPlay (AirTunes) on ::1:5001
//   baseURL: "http://127.0.0.1:5001",
//   timeout: 10000,
//   headers: {
//     "Content-Type": "application/json",
//   },
//   // Enable credentials for CORS
//   withCredentials: true,
//   crossDomain: true,
// });

// // Request interceptor to handle CORS preflight
// api.interceptors.request.use(
//   (config) => {
//     // Add timestamp to prevent caching issues
//     config.headers['Cache-Control'] = 'no-cache';
//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   }
// );

// // Response interceptor to handle CORS errors
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response) {
//       // The request was made and the server responded with a status code
//       // that falls out of the range of 2xx
//       console.error('API Error:', {
//         status: error.response.status,
//         data: error.response.data,
//         headers: error.response.headers,
//       });
//     } else if (error.request) {
//       // The request was made but no response was received
//       console.error('Network Error:', error.request);
//     } else {
//       // Something happened in setting up the request that triggered an Error
//       console.error('Request Error:', error.message);
//     }
//     return Promise.reject(error);
//   }
// );

// export default api;

import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:5001",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: false,
  crossDomain: true,
});

export default api;

