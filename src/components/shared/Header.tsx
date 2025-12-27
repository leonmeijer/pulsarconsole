import { Search, Bell, Globe, User } from "lucide-react";
import { useEnvironments, useActivateEnvironment } from "@/api/hooks";
import { toast } from "sonner";

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
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Search Clusters, Topics..."
                        className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all hover:bg-white/10"
                    />
                </div>
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

                <button className="p-2.5 rounded-full hover:bg-white/5 relative group transition-all active:scale-95">
                    <Bell size={20} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
                </button>

                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
                    <User size={20} className="text-white" />
                </div>
            </div>
        </header>
    );
}
