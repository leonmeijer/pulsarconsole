import { motion } from "framer-motion";
import { Plus, RefreshCcw, Building2, ArrowRight, Trash2, Play, Pause, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useTenants, useCreateTenant, useDeleteTenant } from "@/api/hooks";
import { useFavorites } from "@/context/FavoritesContext";

export default function TenantsPage() {
    const [isPaused, setIsPaused] = useState(false);
    const { data: tenants, isLoading, refetch } = useTenants({ paused: isPaused });
    const createTenant = useCreateTenant();
    const deleteTenant = useDeleteTenant();
    const [showCreate, setShowCreate] = useState(false);
    const [newTenantName, setNewTenantName] = useState("");
    const { isFavorite, toggleFavorite } = useFavorites();

    const handleCreate = async () => {
        if (!newTenantName.trim()) {
            toast.error("Tenant name is required");
            return;
        }
        try {
            await createTenant.mutateAsync({ name: newTenantName.trim() });
            toast.success(`Tenant '${newTenantName}' created`);
            setNewTenantName("");
            setShowCreate(false);
        } catch (error) {
            toast.error("Failed to create tenant");
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`Are you sure you want to delete tenant '${name}'?`)) return;
        try {
            await deleteTenant.mutateAsync(name);
            toast.success(`Tenant '${name}' deleted`);
        } catch (error) {
            toast.error("Failed to delete tenant. It may have namespaces.");
        }
    };

    const formatRate = (rate: number) => {
        if (rate >= 1000000) return `${(rate / 1000000).toFixed(1)}M/s`;
        if (rate >= 1000) return `${(rate / 1000).toFixed(1)}K/s`;
        return `${rate.toFixed(1)}/s`;
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Tenants</h1>
                    <p className="text-muted-foreground mt-1">Manage all tenants and their cluster permissions.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`p-3 glass rounded-xl hover:bg-white/10 transition-all active:scale-95 ${isPaused ? 'text-yellow-500' : 'text-green-500'}`}
                        title={isPaused ? "Resume auto-refresh" : "Pause auto-refresh"}
                    >
                        {isPaused ? <Play size={20} /> : <Pause size={20} />}
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="p-3 glass rounded-xl hover:bg-white/10 transition-all active:scale-95"
                        title="Refresh now"
                    >
                        <RefreshCcw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 font-semibold"
                    >
                        <Plus size={20} />
                        Create Tenant
                    </button>
                </div>
            </div>

            {showCreate && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-6 rounded-2xl"
                >
                    <h3 className="text-lg font-semibold mb-4">Create New Tenant</h3>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={newTenantName}
                            onChange={(e) => setNewTenantName(e.target.value)}
                            placeholder="Tenant name"
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={createTenant.isPending}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                            {createTenant.isPending ? "Creating..." : "Create"}
                        </button>
                        <button
                            onClick={() => setShowCreate(false)}
                            className="px-6 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                        >
                            Cancel
                        </button>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="glass h-48 rounded-2xl animate-pulse" />
                    ))
                ) : (
                    tenants?.map((tenant, index) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            key={tenant.name}
                            className="glass p-6 rounded-2xl group hover:border-primary/50 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />

                            <div className="flex items-start justify-between relative">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <Building2 size={24} className="text-primary" />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => toggleFavorite({
                                            type: 'tenant',
                                            name: tenant.name,
                                            path: `/tenants/${tenant.name}/namespaces`,
                                        })}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                        title={isFavorite('tenant', tenant.name) ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <Star
                                            size={18}
                                            className={isFavorite('tenant', tenant.name) ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}
                                            fill={isFavorite('tenant', tenant.name) ? "currentColor" : "none"}
                                        />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(tenant.name)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} className="text-muted-foreground hover:text-red-400" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6">
                                <Link
                                    to={`/tenants/${tenant.name}/namespaces`}
                                    className="text-xl font-bold hover:text-primary transition-colors block"
                                >
                                    {tenant.name}
                                </Link>
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                                    <span>{tenant.namespace_count} Namespaces</span>
                                    <span>•</span>
                                    <span>{tenant.topic_count} Topics</span>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-white/5 rounded-lg p-2">
                                    <div className="text-muted-foreground text-xs">Msg In</div>
                                    <div className="font-semibold">{formatRate(tenant.msg_rate_in)}</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2">
                                    <div className="text-muted-foreground text-xs">Msg Out</div>
                                    <div className="font-semibold">{formatRate(tenant.msg_rate_out)}</div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                                <div className="text-xs text-muted-foreground">
                                    Backlog: {tenant.total_backlog.toLocaleString()}
                                </div>
                                <Link
                                    to={`/tenants/${tenant.name}/namespaces`}
                                    className="flex items-center gap-1 text-primary text-sm font-semibold hover:underline"
                                >
                                    View Namespaces
                                    <ArrowRight size={14} />
                                </Link>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
