import axios from "axios";

export async function fetchRoute(start, end) {
  const url = `https://router.project-osrm.org/route/v1/driving/` +
    `${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;

  const res = await axios.get(url);

  if (!res.data.routes?.length) {
    throw new Error("No route found");
  }

  return res.data.routes[0].geometry.coordinates.map(
    ([lng, lat]) => [lat, lng]
  );
}
