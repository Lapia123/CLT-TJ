import axios from "axios";

// In dev, requests go to /api and Vite proxies to the backend.
// In production, set VITE_API_URL to the API origin (or leave empty if the
// API is served from the same origin as the SPA).
const baseURL = import.meta.env.VITE_API_URL || "";

const api = axios.create({ baseURL });

// Attach the JWT to every request if present.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("clt_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the session and bounce to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/login")) {
      localStorage.removeItem("clt_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// Normalize an API error into a human-readable string.
export function errorMessage(err, fallback = "Something went wrong.") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => d.msg || d).join(", ");
  }
  return err?.message || fallback;
}

export default api;
