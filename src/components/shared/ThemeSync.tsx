import { useEffect, useRef } from 'react';
import { useThemePreference, useUpdateThemePreference } from '@/api/hooks';
import { useAuth } from '@/context/AuthContext';
import { useTheme, THEMES, type Theme, type Mode } from '@/context/ThemeContext';

/**
 * Component that syncs theme preferences with the database for authenticated users.
 * Must be placed inside both ThemeProvider and AuthProvider.
 * 
 * Flow:
 * 1. On login: loads theme from database and applies it (also saves to cookie)
 * 2. On theme change: saves to cookie immediately, then syncs to database (debounced)
 */
export default function ThemeSync() {
  const { theme, mode, setTheme, setMode } = useTheme();
  const { isAuthenticated } = useAuth();
  const isInitializedRef = useRef(false);
  const lastSyncedRef = useRef<{ theme: string; mode: string } | null>(null);
  
  const { data: serverPreference, isSuccess } = useThemePreference(isAuthenticated);
  const updatePreference = useUpdateThemePreference();

  // Load from server when authenticated
  useEffect(() => {
    if (isAuthenticated && isSuccess && serverPreference && !isInitializedRef.current) {
      // Apply server preferences if they exist
      if (serverPreference.theme && THEMES.includes(serverPreference.theme as Theme)) {
        setTheme(serverPreference.theme as Theme);
      }
      if (serverPreference.mode && ['light', 'dark', 'system'].includes(serverPreference.mode)) {
        setMode(serverPreference.mode as Mode);
      }
      lastSyncedRef.current = {
        theme: serverPreference.theme || theme,
        mode: serverPreference.mode || mode,
      };
      isInitializedRef.current = true;
    }
  }, [isAuthenticated, isSuccess, serverPreference, setTheme, setMode, theme, mode]);

  // Reset on logout
  useEffect(() => {
    if (!isAuthenticated) {
      isInitializedRef.current = false;
      lastSyncedRef.current = null;
    }
  }, [isAuthenticated]);

  // Save to server when theme changes (for authenticated users)
  useEffect(() => {
    if (!isAuthenticated || !isInitializedRef.current) return;
    
    // Check if theme or mode actually changed from last sync
    if (lastSyncedRef.current && 
        lastSyncedRef.current.theme === theme && 
        lastSyncedRef.current.mode === mode) {
      return;
    }

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      updatePreference.mutate({ theme, mode });
      lastSyncedRef.current = { theme, mode };
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [theme, mode, isAuthenticated, updatePreference]);

  return null;
}

