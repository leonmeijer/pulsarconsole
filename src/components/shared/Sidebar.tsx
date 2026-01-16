import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Building2,
    Server,
    Settings,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ScrollText,
    Star,
    FolderOpen,
    MessageSquare,
    Users,
    Bell,
    Key,
    Shield,
    Monitor,
    Lock,
    UserCog,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFavorites, type FavoriteType } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Building2, label: "Tenants", path: "/tenants" },
    { icon: Server, label: "Brokers", path: "/brokers" },
    { icon: Bell, label: "Notifications", path: "/notifications" },
    { icon: ScrollText, label: "Audit Logs", path: "/audit-logs" },
    { icon: Settings, label: "Environment", path: "/environment" },
];

const favoriteIcons: Record<FavoriteType, typeof Building2> = {
    tenant: Building2,
    namespace: FolderOpen,
    topic: MessageSquare,
    subscription: Users,
};

const settingsItems = [
    { icon: Key, label: "API Tokens", path: "/settings/tokens" },
    { icon: Monitor, label: "Sessions", path: "/settings/sessions" },
];

// OIDC-only admin items (require OIDC to be enabled)
const oidcAdminItems = [
    { icon: Shield, label: "Roles", path: "/settings/roles" },
    { icon: Users, label: "Users", path: "/settings/users" },
    { icon: UserCog, label: "OIDC Groups", path: "/settings/oidc" },
];

// Always visible for superusers (Pulsar broker config)
const pulsarAdminItems = [
    { icon: Lock, label: "Pulsar Auth", path: "/settings/pulsar-auth" },
];

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [favoritesExpanded, setFavoritesExpanded] = useState(true);
    const [settingsExpanded, setSettingsExpanded] = useState(false);
    const location = useLocation();
    const { favorites, removeFavorite } = useFavorites();
    const { user, authRequired, isAuthenticated } = useAuth();
    const { resolvedMode } = useTheme();

    // Show user settings only when OIDC is enabled and user is authenticated
    const showUserSettings = authRequired && isAuthenticated;
    // Check if user has superuser role (for OIDC mode) or if running without OIDC (dev/superuser mode)
    const hasSuperuserRole = user?.is_global_admin || (user?.roles?.some((role) => role.name === 'superuser') ?? false);
    // Show OIDC admin items (Roles/Users) only when OIDC is enabled AND user is superuser
    const showOidcAdminItems = authRequired && hasSuperuserRole;
    // Show Pulsar admin items (Pulsar Auth) for superusers OR when OIDC is disabled (dev mode)
    const showPulsarAdminItems = hasSuperuserRole || !authRequired;
    // Show settings section if any settings items should be visible
    const showSettings = showUserSettings || showPulsarAdminItems;

    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? "80px" : "260px" }}
            className="glass h-screen sticky top-0 flex flex-col transition-all duration-300 z-50 border-r"
        >
            <div className="p-6 flex items-center justify-between">
                {!isCollapsed && (
                    <Link to="/" className="flex items-center gap-2 outline-none">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2"
                        >
                            <img 
                                src="/logo.png" 
                                alt="Pulsar Console" 
                                className="h-20 w-auto -mt-2.5 -ml-2.5 hover:opacity-80 transition-opacity"
                                style={resolvedMode === 'dark' ? { filter: 'brightness(0) invert(1)' } : undefined}
                            />
                        </motion.div>
                    </Link>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
                    return (
                        <Link
                            key={item.label}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                                isActive
                                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                                    : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <item.icon size={22} className={cn(isActive ? "text-white" : "text-muted-foreground group-hover:text-primary transition-colors")} />
                            {!isCollapsed && <span className="font-medium">{item.label}</span>}
                            {isCollapsed && (
                                <div className="absolute left-full ml-4 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
                                    {item.label}
                                </div>
                            )}
                        </Link>
                    );
                })}

                {/* Favorites Section */}
                {favorites.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/10">
                        <button
                            onClick={() => setFavoritesExpanded(!favoritesExpanded)}
                            className={cn(
                                "flex items-center gap-4 px-4 py-2 w-full rounded-xl transition-all duration-200 group relative",
                                "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Star size={20} className="text-yellow-500" fill="currentColor" />
                            {!isCollapsed && (
                                <>
                                    <span className="font-medium text-sm flex-1 text-left">Favorites</span>
                                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{favorites.length}</span>
                                </>
                            )}
                            {isCollapsed && (
                                <div className="absolute left-full ml-4 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
                                    Favorites ({favorites.length})
                                </div>
                            )}
                        </button>

                        <AnimatePresence>
                            {favoritesExpanded && !isCollapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-1 mt-2 pl-2">
                                        {favorites.map((fav) => {
                                            const Icon = favoriteIcons[fav.type];
                                            const isActive = location.pathname === fav.path;
                                            return (
                                                <div
                                                    key={fav.id}
                                                    className="group/fav flex items-center"
                                                >
                                                    <Link
                                                        to={fav.path}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 flex-1 min-w-0",
                                                            isActive
                                                                ? "bg-primary/20 text-primary"
                                                                : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                                        )}
                                                        title={fav.name}
                                                    >
                                                        <Icon size={16} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                                                        <span className="text-sm truncate">{fav.name}</span>
                                                    </Link>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            removeFavorite(fav.id);
                                                        }}
                                                        className="p-1 opacity-0 group-hover/fav:opacity-100 transition-opacity hover:text-red-400 shrink-0"
                                                        title="Remove from favorites"
                                                    >
                                                        <Star size={14} className="text-yellow-500 hover:text-red-400" fill="currentColor" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Settings Section */}
                {showSettings && (
                    <div className="mt-6 pt-4 border-t border-white/10">
                        <button
                            onClick={() => setSettingsExpanded(!settingsExpanded)}
                            className={cn(
                                "flex items-center gap-4 px-4 py-2 w-full rounded-xl transition-all duration-200 group relative",
                                location.pathname.startsWith("/settings")
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Settings size={20} className={location.pathname.startsWith("/settings") ? "text-primary" : ""} />
                            {!isCollapsed && (
                                <>
                                    <span className="font-medium text-sm flex-1 text-left">Settings</span>
                                    <ChevronDown
                                        size={16}
                                        className={cn(
                                            "transition-transform",
                                            settingsExpanded ? "rotate-180" : ""
                                        )}
                                    />
                                </>
                            )}
                            {isCollapsed && (
                                <div className="absolute left-full ml-4 px-3 py-2 bg-popover text-popover-foreground text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
                                    Settings
                                </div>
                            )}
                        </button>

                        <AnimatePresence>
                            {settingsExpanded && !isCollapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-1 mt-2 pl-2">
                                        {/* User settings - only when OIDC enabled */}
                                        {showUserSettings && settingsItems.map((item) => {
                                            const isActive = location.pathname === item.path;
                                            return (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                                                        isActive
                                                            ? "bg-primary/20 text-primary"
                                                            : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    <item.icon size={16} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                                                    <span className="text-sm">{item.label}</span>
                                                </Link>
                                            );
                                        })}
                                        {/* OIDC admin items (Roles/Users) - only when OIDC enabled AND superuser */}
                                        {showOidcAdminItems && (
                                            <>
                                                {showUserSettings && <div className="h-px bg-white/10 my-2" />}
                                                {oidcAdminItems.map((item) => {
                                                    const isActive = location.pathname === item.path;
                                                    return (
                                                        <Link
                                                            key={item.path}
                                                            to={item.path}
                                                            className={cn(
                                                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                                                                isActive
                                                                    ? "bg-primary/20 text-primary"
                                                                    : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            <item.icon size={16} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                                                            <span className="text-sm">{item.label}</span>
                                                        </Link>
                                                    );
                                                })}
                                            </>
                                        )}
                                        {/* Pulsar admin items - always for superusers OR when OIDC disabled */}
                                        {showPulsarAdminItems && (
                                            <>
                                                {(showUserSettings || showOidcAdminItems) && <div className="h-px bg-white/10 my-2" />}
                                                {pulsarAdminItems.map((item) => {
                                                    const isActive = location.pathname === item.path;
                                                    return (
                                                        <Link
                                                            key={item.path}
                                                            to={item.path}
                                                            className={cn(
                                                                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                                                                isActive
                                                                    ? "bg-primary/20 text-primary"
                                                                    : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            <item.icon size={16} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                                                            <span className="text-sm">{item.label}</span>
                                                        </Link>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </nav>

        </motion.aside>
    );
}
