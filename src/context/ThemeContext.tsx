import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from 'react';

// Alle beschikbare thema's
export const THEMES = [
  'current-light',
  'current-dark',
  'shadcn-light',
  'shadcn-dark',
  'spireflow-snowlight',
  'spireflow-midnight',
  'spireflow-charcoal',
  'spireflow-obsidian',
] as const;

export type Theme = typeof THEMES[number];
export type Mode = 'light' | 'dark' | 'system';

// Thema metadata voor UI
// Note: Internal IDs (current-*, shadcn-*) are kept for localStorage compatibility
export const THEME_INFO: Record<Theme, { label: string; family: string; mode: 'light' | 'dark' }> = {
  'current-light': { label: 'Pulsar Light', family: 'Pulsar', mode: 'light' },
  'current-dark': { label: 'Pulsar Dark', family: 'Pulsar', mode: 'dark' },
  'shadcn-light': { label: 'Slate Light', family: 'Slate', mode: 'light' },
  'shadcn-dark': { label: 'Slate Dark', family: 'Slate', mode: 'dark' },
  'spireflow-snowlight': { label: 'Snowlight', family: 'Spireflow', mode: 'light' },
  'spireflow-midnight': { label: 'Midnight', family: 'Spireflow', mode: 'dark' },
  'spireflow-charcoal': { label: 'Charcoal', family: 'Spireflow', mode: 'dark' },
  'spireflow-obsidian': { label: 'Obsidian', family: 'Spireflow', mode: 'dark' },
};

// Thema families met hun light/dark varianten
export const THEME_FAMILIES = {
  pulsar: { light: 'current-light', dark: 'current-dark' },
  slate: { light: 'shadcn-light', dark: 'shadcn-dark' },
  spireflow: { light: 'spireflow-snowlight', dark: 'spireflow-obsidian' },
} as const;

const STORAGE_KEY = 'pulsar-manager-theme';
const MODE_KEY = 'pulsar-manager-mode';
const DEFAULT_THEME: Theme = 'current-dark';
const DEFAULT_MODE: Mode = 'system';

// Cookie helpers
function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
}

interface ThemeContextType {
  theme: Theme;
  mode: Mode;
  resolvedMode: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  setMode: (mode: Mode) => void;
  themes: typeof THEMES;
  themeInfo: typeof THEME_INFO;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  // First check cookie, then localStorage
  const fromCookie = getCookie(STORAGE_KEY);
  if (fromCookie && THEMES.includes(fromCookie as Theme)) {
    return fromCookie as Theme;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEMES.includes(stored as Theme)) {
    return stored as Theme;
  }
  return DEFAULT_THEME;
}

function getStoredMode(): Mode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  // First check cookie, then localStorage
  const fromCookie = getCookie(MODE_KEY);
  if (fromCookie && ['light', 'dark', 'system'].includes(fromCookie)) {
    return fromCookie as Mode;
  }
  const stored = localStorage.getItem(MODE_KEY);
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    return stored as Mode;
  }
  return DEFAULT_MODE;
}

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  defaultMode?: Mode;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  defaultMode = DEFAULT_MODE,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() || defaultTheme);
  const [mode, setModeState] = useState<Mode>(() => getStoredMode() || defaultMode);
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>(getSystemPreference);

  // Bereken de resolved mode (wat daadwerkelijk getoond wordt)
  const resolvedMode = useMemo((): 'light' | 'dark' => {
    if (mode === 'system') {
      return systemPreference;
    }
    return mode;
  }, [mode, systemPreference]);

  // Bepaal het effectieve thema op basis van mode
  const effectiveTheme = useMemo((): Theme => {
    const themeMode = THEME_INFO[theme].mode;
    
    // Als het thema al overeenkomt met de resolved mode, gebruik het
    if (themeMode === resolvedMode) {
      return theme;
    }
    
    // Anders, probeer de bijpassende variant te vinden in dezelfde familie
    const family = THEME_INFO[theme].family.toLowerCase();
    
    if (family === 'pulsar') {
      return resolvedMode === 'light' ? 'current-light' : 'current-dark';
    } else if (family === 'slate') {
      return resolvedMode === 'light' ? 'shadcn-light' : 'shadcn-dark';
    } else if (family === 'spireflow') {
      // Spireflow heeft meerdere dark thema's, maar slechts één light
      if (resolvedMode === 'light') {
        return 'spireflow-snowlight';
      }
      // Als we al een dark spireflow thema hebben, behoud het
      if (themeMode === 'dark') {
        return theme;
      }
      // Anders default naar obsidian
      return 'spireflow-obsidian';
    }
    
    return theme;
  }, [theme, resolvedMode]);

  // Luister naar system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Pas thema toe op document
  useEffect(() => {
    const root = document.documentElement;
    
    // Verwijder alle thema classes
    THEMES.forEach(t => {
      root.classList.remove(`theme-${t}`);
    });
    
    // Voeg nieuwe thema class toe
    root.classList.add(`theme-${effectiveTheme}`);
    
    // Voeg ook light/dark class toe voor componenten die dat nodig hebben
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedMode);
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (metaThemeColor) {
      const bgColor = getComputedStyle(root).getPropertyValue('--background').trim();
      metaThemeColor.setAttribute('content', bgColor || (resolvedMode === 'dark' ? '#0a0a0a' : '#ffffff'));
    }
  }, [effectiveTheme, resolvedMode]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    // Store in both cookie and localStorage
    setCookie(STORAGE_KEY, newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  const setMode = useCallback((newMode: Mode) => {
    setModeState(newMode);
    // Store in both cookie and localStorage
    setCookie(MODE_KEY, newMode);
    localStorage.setItem(MODE_KEY, newMode);
  }, []);

  const value = useMemo(() => ({
    theme: effectiveTheme,
    mode,
    resolvedMode,
    setTheme,
    setMode,
    themes: THEMES,
    themeInfo: THEME_INFO,
  }), [effectiveTheme, mode, resolvedMode, setTheme, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
