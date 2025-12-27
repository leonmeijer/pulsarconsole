import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

// Storage keys for auth tokens
const STORAGE_KEYS = {
    ACCESS_TOKEN: 'pulsar_console_access_token',
    REFRESH_TOKEN: 'pulsar_console_refresh_token',
    TOKEN_EXPIRY: 'pulsar_console_token_expiry',
};

// Base API URL - uses the new API v1 by default
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "",
    headers: {
        "Content-Type": "application/json",
    },
    timeout: 30000,
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Request interceptor for adding auth headers
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    // Add session ID for rate limiting
    let sessionId = localStorage.getItem("pulsar-session-id");
    if (!sessionId) {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem("pulsar-session-id", sessionId);
    }
    config.headers["X-Session-Id"] = sessionId;

    // Add Authorization header if we have a token
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (accessToken) {
        config.headers["Authorization"] = `Bearer ${accessToken}`;
    }

    return config;
});

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<{ error?: string; message?: string; detail?: string }>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized - attempt token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            // Don't try to refresh if this is already a refresh request
            if (originalRequest.url?.includes('/auth/refresh')) {
                // Clear tokens and redirect to login
                clearAuthTokens();
                window.dispatchEvent(new CustomEvent('auth:logout'));
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Queue the request while refreshing
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    if (originalRequest.headers) {
                        originalRequest.headers["Authorization"] = `Bearer ${token}`;
                    }
                    return api(originalRequest);
                }).catch((err) => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
            if (!refreshToken) {
                isRefreshing = false;
                clearAuthTokens();
                window.dispatchEvent(new CustomEvent('auth:logout'));
                return Promise.reject(error);
            }

            try {
                const response = await axios.post(
                    `${import.meta.env.VITE_API_BASE_URL || ""}/api/v1/auth/refresh`,
                    { refresh_token: refreshToken },
                    { headers: { "Content-Type": "application/json" } }
                );

                const { access_token, refresh_token, expires_in } = response.data;

                // Store new tokens
                localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
                localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
                localStorage.setItem(
                    STORAGE_KEYS.TOKEN_EXPIRY,
                    (Date.now() + expires_in * 1000).toString()
                );

                isRefreshing = false;
                processQueue(null, access_token);

                // Retry original request with new token
                if (originalRequest.headers) {
                    originalRequest.headers["Authorization"] = `Bearer ${access_token}`;
                }
                return api(originalRequest);
            } catch (refreshError) {
                isRefreshing = false;
                processQueue(refreshError, null);
                clearAuthTokens();
                window.dispatchEvent(new CustomEvent('auth:logout'));
                return Promise.reject(refreshError);
            }
        }

        // Log other errors
        if (error.response) {
            const message = error.response.data?.detail ||
                           error.response.data?.message ||
                           error.response.data?.error ||
                           "An error occurred";
            console.error(`API Error ${error.response.status}: ${message}`);
        } else if (error.request) {
            console.error("Network error: No response received");
        } else {
            console.error("Request error:", error.message);
        }

        return Promise.reject(error);
    }
);

// Helper to clear auth tokens
function clearAuthTokens() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem('pulsar_console_user');
}

// Export helper for checking if user is authenticated
export function isAuthenticated(): boolean {
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

// Export helper to get current access token
export function getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export default api;

// Legacy API for backwards compatibility with old endpoints
export const legacyApi = axios.create({
    baseURL: import.meta.env.VITE_LEGACY_API_URL || "/pulsar-manager/admin/v2",
    headers: {
        "Content-Type": "application/json",
    },
});
