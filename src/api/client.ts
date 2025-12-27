import axios, { type AxiosError } from "axios";

// Base API URL - uses the new API v1 by default
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "",
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 30000,
});

// Request interceptor for adding session ID
api.interceptors.request.use((config) => {
    // Add session ID for rate limiting
    let sessionId = localStorage.getItem("pulsar-session-id");
    if (!sessionId) {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem("pulsar-session-id", sessionId);
    }
    config.headers["X-Session-Id"] = sessionId;

    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ error?: string; message?: string }>) => {
        if (error.response) {
            const message = error.response.data?.message || error.response.data?.error || "An error occurred";
            console.error(`API Error ${error.response.status}: ${message}`);
        } else if (error.request) {
            console.error("Network error: No response received");
        } else {
            console.error("Request error:", error.message);
        }
        return Promise.reject(error);
    }
);

export default api;

// Legacy API for backwards compatibility with old endpoints
export const legacyApi = axios.create({
    baseURL: import.meta.env.VITE_LEGACY_API_URL || "/pulsar-manager/admin/v2",
    headers: {
        "Content-Type": "application/json",
    },
});
