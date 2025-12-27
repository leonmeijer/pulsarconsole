import { Globe, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { useEnvironments, useActivateEnvironment, usePendingUsersCount } from "@/api/hooks";
import { toast } from "sonner";
import NotificationDropdown from "./NotificationDropdown";
import GlobalSearch from "./GlobalSearch";
import { UserMenu } from "@/components/auth";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
    const { hasAccess, authRequired, user } = useAuth();
    const { data: environments, isLoading } = useEnvironments();
    const activateEnvironment = useActivateEnvironment();
    const { count: pendingUsersCount } = usePendingUsersCount();

    const activeEnv = environments?.find(env => env.is_active);

    // Don't show full header for users without access
    const showFullHeader = !authRequired || hasAccess;

    // Check if current user is a superuser
    const isSuperuser = user?.roles?.some(role => role.name === 'superuser') ?? false;

    const handleEnvChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const name = e.target.value;
        if (!name || name === activeEnv?.name) return;

        try {
            await activateEnvironment.mutateAsync(name);
            toast.success(`Switched to ${name}`);
            // Reload page to refresh all data
            window.location.reload();
        } catch {
            toast.error("Failed to switch environment");
        }
    };

    // Minimal header for users pending access - only show user menu for logout
    if (!showFullHeader) {
        return (
            <header className="h-20 border-b border-white/5 px-8 flex items-center justify-end glass z-40">
                <UserMenu />
            </header>
        );
    }

    return (
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between glass z-40">
            <div className="flex items-center gap-6 flex-1">
                <GlobalSearch />
            </div>

            <div className="flex items-center gap-4">
                {environments && environments.length > 0 ? (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 hover:bg-white/10 transition-colors cursor-pointer">
                        <Globe size={18} className="text-primary" />
                        <select
                            value={activeEnv?.name || ""}
                            onChange={handleEnvChange}
                            disabled={activateEnvironment.isPending || isLoading}
                            className="bg-transparent text-sm font-medium outline-none cursor-pointer disabled:opacity-50"
                        >
                            {environments.map((env) => (
                                <option key={env.id} value={env.name} className="bg-popover text-popover-foreground">
                                    {env.name} {env.is_active ? "✓" : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : !isLoading && (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-muted-foreground text-sm">
                        <Globe size={18} />
                        <span>No environment</span>
                    </div>
                )}

                {/* Pending Users Alert - Only visible to superusers */}
                {isSuperuser && pendingUsersCount > 0 && (
                    <Link
                        to="/settings/users"
                        className="relative p-2.5 rounded-full hover:bg-white/5 group transition-all active:scale-95"
                        title={`${pendingUsersCount} user${pendingUsersCount > 1 ? 's' : ''} awaiting approval`}
                    >
                        <UserPlus
                            size={20}
                            className="text-yellow-500 group-hover:text-yellow-400 transition-colors"
                        />
                        <span className="absolute top-0.5 right-0.5 min-w-[20px] h-[20px] bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-[11px] font-bold text-black">
                                {pendingUsersCount > 99 ? "99+" : pendingUsersCount}
                            </span>
                        </span>
                    </Link>
                )}

                <NotificationDropdown />

                <UserMenu />
            </div>
        </header>
    );
}
