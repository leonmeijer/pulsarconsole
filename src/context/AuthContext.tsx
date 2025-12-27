import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../api/client';

// =============================================================================
// Types
// =============================================================================

export interface UserRole {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  roles?: UserRole[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface OIDCProvider {
  id: string;
  name: string;
  issuer_url: string;
  login_url?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authRequired: boolean;
  providers: OIDCProvider[];
  hasAccess: boolean; // User has at least one role or is superuser
}

interface AuthContextType extends AuthState {
  login: (environmentId: string, redirectUri: string) => Promise<string>;
  handleCallback: (code: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  checkPermission: (action: string, resourceLevel: string, resourcePath?: string) => Promise<boolean>;
}

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'pulsar_console_access_token',
  REFRESH_TOKEN: 'pulsar_console_refresh_token',
  USER: 'pulsar_console_user',
  TOKEN_EXPIRY: 'pulsar_console_token_expiry',
};

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =============================================================================
// Provider
// =============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [providers, setProviders] = useState<OIDCProvider[]>([]);

  // Check if user has valid token
  const isAuthenticated = !!user && !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

  // Get access token for API requests
  const getAccessToken = useCallback((): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }, []);

  // Store tokens
  const storeTokens = useCallback((tokens: AuthTokens) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);

    // Calculate expiry time
    const expiryTime = Date.now() + tokens.expires_in * 1000;
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
  }, []);

  // Clear tokens
  const clearTokens = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  }, []);

  // Check if token is expired or about to expire
  const isTokenExpired = useCallback((): boolean => {
    const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    if (!expiry) return true;

    // Consider token expired if less than 1 minute remaining
    return Date.now() > parseInt(expiry) - 60000;
  }, []);

  // Refresh tokens
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) return false;

    try {
      const response = await api.post<AuthTokens>('/api/v1/auth/refresh', {
        refresh_token: refreshToken,
      });

      storeTokens(response.data);
      return true;
    } catch {
      clearTokens();
      setUser(null);
      return false;
    }
  }, [storeTokens, clearTokens]);

  // Fetch current user
  const fetchCurrentUser = useCallback(async (): Promise<User | null> => {
    try {
      const response = await api.get<User>('/api/v1/auth/me');
      const userData = response.data;
      setUser(userData);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
      return userData;
    } catch {
      clearTokens();
      setUser(null);
      return null;
    }
  }, [clearTokens]);

  // Fetch providers and check if auth is required
  const fetchProviders = useCallback(async () => {
    try {
      const response = await api.get<{ providers: OIDCProvider[]; auth_required: boolean }>(
        '/api/v1/auth/providers'
      );
      setProviders(response.data.providers);
      setAuthRequired(response.data.auth_required);
    } catch {
      // If we can't fetch providers, assume auth is not required
      setAuthRequired(false);
      setProviders([]);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      // Fetch providers first
      await fetchProviders();

      // Check if we have a stored token
      const accessToken = getAccessToken();
      if (accessToken) {
        // Check if token is expired
        if (isTokenExpired()) {
          // Try to refresh
          const refreshed = await refreshTokens();
          if (refreshed) {
            await fetchCurrentUser();
          }
        } else {
          // Validate token by fetching user
          await fetchCurrentUser();
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [fetchProviders, getAccessToken, isTokenExpired, refreshTokens, fetchCurrentUser]);

  // Set up token refresh interval
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkAndRefresh = async () => {
      if (isTokenExpired()) {
        await refreshTokens();
      }
    };

    // Check every minute
    const interval = setInterval(checkAndRefresh, 60000);

    return () => clearInterval(interval);
  }, [isAuthenticated, isTokenExpired, refreshTokens]);

  // Initiate OIDC login
  const login = useCallback(async (environmentId: string, redirectUri: string): Promise<string> => {
    const response = await api.post<{ authorization_url: string; state: string }>(
      '/api/v1/auth/login',
      {
        environment_id: environmentId,
        redirect_uri: redirectUri,
      }
    );

    // Store state for verification
    sessionStorage.setItem('oauth_state', response.data.state);

    return response.data.authorization_url;
  }, []);

  // Handle OIDC callback
  const handleCallback = useCallback(async (code: string, state: string): Promise<void> => {
    // Verify state
    const storedState = sessionStorage.getItem('oauth_state');
    if (state !== storedState) {
      throw new Error('Invalid OAuth state');
    }
    sessionStorage.removeItem('oauth_state');

    // Exchange code for tokens
    const response = await api.post<AuthTokens>('/api/v1/auth/callback', {
      code,
      state,
    });

    storeTokens(response.data);
    await fetchCurrentUser();
  }, [storeTokens, fetchCurrentUser]);

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // Ignore errors - we'll clear local state anyway
    }

    clearTokens();
    setUser(null);
  }, [clearTokens]);

  // Refresh auth state
  const refreshAuth = useCallback(async (): Promise<void> => {
    await fetchProviders();
    if (getAccessToken()) {
      await fetchCurrentUser();
    }
  }, [fetchProviders, getAccessToken, fetchCurrentUser]);

  // Check permission
  const checkPermission = useCallback(async (
    action: string,
    resourceLevel: string,
    resourcePath?: string
  ): Promise<boolean> => {
    if (!isAuthenticated) return false;

    try {
      const response = await api.post<{ allowed: boolean }>('/api/v1/rbac/check', {
        action,
        resource_level: resourceLevel,
        resource_path: resourcePath,
      });
      return response.data.allowed;
    } catch {
      return false;
    }
  }, [isAuthenticated]);

  // Determine if user has access to the console
  // - If auth is not required, everyone has access
  // - If auth is required, user needs to have at least one role (including superuser role)
  const hasAccess = !authRequired || (
    isAuthenticated && (
      user?.roles && user.roles.length > 0
    )
  ) || false;

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    authRequired,
    providers,
    hasAccess,
    login,
    handleCallback,
    logout,
    refreshAuth,
    checkPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// =============================================================================
// Helper to get token for API client
// =============================================================================

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}
