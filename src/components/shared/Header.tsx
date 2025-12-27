import { Globe } from "lucide-react";
import { useEnvironments, useActivateEnvironment } from "@/api/hooks";
import { toast } from "sonner";
import NotificationDropdown from "./NotificationDropdown";
import GlobalSearch from "./GlobalSearch";
import { UserMenu } from "@/components/auth";

export default function Header() {
    const { data: environments, isLoading } = useEnvironments();
    const activateEnvironment = useActivateEnvironment();

    const activeEnv = environments?.find(env => env.is_active);

    const handleEnvChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const name = e.target.value;
        if (!name || name === activeEnv?.name) return;

        try {
            await activateEnvironment.mutateAsync(name);
            toast.success(`Switched to ${name}`);
            // Reload page to refresh all data
            window.location.reload();
        } catch (error) {
            toast.error("Failed to switch environment");
        }
    };

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

                <NotificationDropdown />

                <UserMenu />
            </div>
        </header>
    );
}
