import { useState, useRef, useEffect } from 'react';
import { Palette, Sun, Moon, Monitor, Check, ChevronDown } from 'lucide-react';
import { useTheme, THEMES, THEME_INFO, type Theme, type Mode } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

export default function ThemeSwitch() {
  const { theme, mode, setTheme, setMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sluit dropdown bij klik buiten
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Groepeer thema's per familie
  const themesByFamily = THEMES.reduce((acc, t) => {
    const family = THEME_INFO[t].family;
    if (!acc[family]) acc[family] = [];
    acc[family].push(t);
    return acc;
  }, {} as Record<string, Theme[]>);

  const modeOptions: { value: Mode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const CurrentModeIcon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full",
          "bg-white/5 border border-white/10 hover:bg-white/10",
          "transition-colors cursor-pointer"
        )}
        aria-label="Change theme"
      >
        <Palette size={18} className="text-primary" />
        <span className="text-sm font-medium hidden sm:inline">
          {THEME_INFO[theme].label}
        </span>
        <ChevronDown 
          size={14} 
          className={cn(
            "text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-white/10 bg-popover shadow-xl z-50 overflow-hidden">
          {/* Mode Toggle */}
          <div className="p-2 border-b border-white/10">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5">
              {modeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-sm transition-colors",
                    mode === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme List */}
          <div className="max-h-80 overflow-y-auto">
            {Object.entries(themesByFamily).map(([family, themes]) => (
              <div key={family}>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-white/5">
                  {family}
                </div>
                {themes.map((t) => {
                  const info = THEME_INFO[t];
                  const isSelected = theme === t;
                  const ModeIcon = info.mode === 'light' ? Sun : Moon;
                  
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setTheme(t);
                        // Also set mode to match the theme's light/dark mode
                        setMode(info.mode);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-white/5 text-foreground"
                      )}
                    >
                      {/* Theme preview dot */}
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border-2",
                          info.mode === 'light'
                            ? "bg-white border-gray-300"
                            : "bg-gray-800 border-gray-600"
                        )}
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{info.label}</span>
                          <ModeIcon size={12} className="text-muted-foreground" />
                        </div>
                      </div>
                      
                      {isSelected && (
                        <Check size={16} className="text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer info */}
          <div className="p-2 border-t border-white/10 bg-white/5">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              {mode === 'system' && (
                <>
                  <CurrentModeIcon size={12} />
                  <span>System: auto-detecting</span>
                </>
              )}
              {mode !== 'system' && (
                <>
                  <CurrentModeIcon size={12} />
                  <span>Mode: {mode}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

