import { motion } from "framer-motion";
import { Plus, RefreshCcw, FolderOpen, ArrowRight, Trash2, ArrowLeft, Settings, Clock, Shield, Star } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useNamespaces, useCreateNamespace, useDeleteNamespace } from "@/api/hooks";
import type { Namespace, NamespacePolicies } from "@/api/types";
import { NamespacePolicyEditor } from "@/components/shared";
import { useFavorites } from "@/context/FavoritesContext";
import { PermissionGate } from "@/components/auth";

export default function NamespacesPage() {
    const { tenant } = useParams<{ tenant: string }>();
    const { data: namespaces, isLoading, refetch } = useNamespaces(tenant!);
    const createNamespace = useCreateNamespace(tenant!);
    const deleteNamespace = useDeleteNamespace(tenant!);
    const [showCreate, setShowCreate] = useState(false);
    const [newNamespaceName, setNewNamespaceName] = useState("");
    const [editingNamespace, setEditingNamespace] = useState<Namespace | null>(null);
    const { isFavorite, toggleFavorite } = useFavorites();
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (showCreate) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [showCreate]);

    const handleCreate = async () => {
        if (!newNamespaceName.trim()) {
            toast.error("Namespace name is required");
            return;
        }
        try {
            await createNamespace.mutateAsync({ namespace: newNamespaceName.trim() });
            toast.success(`Namespace '${newNamespaceName}' created`);
            setNewNamespaceName("");
            setShowCreate(false);
        } catch (error) {
            toast.error("Failed to create namespace");
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`Are you sure you want to delete namespace '${name}'?`)) return;
        try {
            await deleteNamespace.mutateAsync(name);
            toast.success(`Namespace '${name}' deleted`);
        } catch (error) {
            toast.error("Failed to delete namespace. It may have topics.");
        }
    };

    const formatRate = (rate: number) => {
        if (rate >= 1000000) return `${(rate / 1000000).toFixed(1)}M/s`;
        if (rate >= 1000) return `${(rate / 1000).toFixed(1)}K/s`;
        return `${rate.toFixed(1)}/s`;
    };

    const formatSize = (bytes: number) => {
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${Math.round(bytes)} B`;
    };

    const formatMinutes = (minutes?: number) => {
        if (!minutes) return "Unlimited";
        if (minutes >= 1440) return `${(minutes / 1440).toFixed(0)}d`;
        if (minutes >= 60) return `${(minutes / 60).toFixed(0)}h`;
        return `${minutes}m`;
    };

    const hasPolicies = (policies: NamespacePolicies) => {
        return policies.retention_time_minutes ||
            policies.retention_size_mb ||
            policies.message_ttl_seconds ||
            policies.deduplication_enabled;
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Link to="/tenants" className="hover:text-primary flex items-center gap-1">
                            <ArrowLeft size={16} />
                            Tenants
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">{tenant}</span>
                    </div>
                    <h1 className="text-3xl font-bold">Namespaces</h1>
                    <p className="text-muted-foreground mt-1">Manage namespaces in tenant {tenant}.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => refetch()}
                        className="p-3 glass rounded-xl hover:bg-white/10 transition-all active:scale-95"
                    >
                        <RefreshCcw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <PermissionGate action="write" resourceLevel="namespace" resourcePath={tenant}>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 font-semibold"
                        >
                            <Plus size={20} />
                            Create Namespace
                        </button>
                    </PermissionGate>
                </div>
            </div>

            {showCreate && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-6 rounded-2xl"
                >
                    <h3 className="text-lg font-semibold mb-4">Create New Namespace</h3>
                    <div className="flex gap-4">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newNamespaceName}
                            onChange={(e) => setNewNamespaceName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreate();
                                if (e.key === 'Escape') setShowCreate(false);
                            }}
                            placeholder="Namespace name"
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={createNamespace.isPending}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                            {createNamespace.isPending ? "Creating..." : "Create"}
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
                ) : namespaces?.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        No namespaces found. Create one to get started.
                    </div>
                ) : (
                    namespaces?.map((ns, index) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            key={ns.full_name}
                            className="glass p-6 rounded-2xl group hover:border-primary/50 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />

                            <div className="flex items-start justify-between relative">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <FolderOpen size={24} className="text-primary" />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => toggleFavorite({
                                            type: 'namespace',
                                            name: ns.namespace,
                                            path: `/tenants/${tenant}/namespaces/${ns.namespace}/topics`,
                                            tenant: tenant,
                                        })}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                        title={isFavorite('namespace', ns.namespace, tenant) ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <Star
                                            size={18}
                                            className={isFavorite('namespace', ns.namespace, tenant) ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}
                                            fill={isFavorite('namespace', ns.namespace, tenant) ? "currentColor" : "none"}
                                        />
                                    </button>
                                    <PermissionGate action="admin" resourceLevel="namespace" resourcePath={`${tenant}/${ns.namespace}`}>
                                        <button
                                            onClick={() => setEditingNamespace(ns)}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                            title="Edit Policies"
                                        >
                                            <Settings size={18} className="text-muted-foreground hover:text-primary" />
                                        </button>
                                    </PermissionGate>
                                    <PermissionGate action="write" resourceLevel="namespace" resourcePath={`${tenant}/${ns.namespace}`}>
                                        <button
                                            onClick={() => handleDelete(ns.namespace)}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={18} className="text-muted-foreground hover:text-red-400" />
                                        </button>
                                    </PermissionGate>
                                </div>
                            </div>

                            <div className="mt-6">
                                <Link
                                    to={`/tenants/${tenant}/namespaces/${ns.namespace}/topics`}
                                    className="text-xl font-bold hover:text-primary transition-colors block"
                                >
                                    {ns.namespace}
                                </Link>
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                                    <span>{ns.topic_count} Topics</span>
                                    <span>•</span>
                                    <span>Storage: {formatSize(ns.total_storage_size)}</span>
                                </div>
                            </div>

                            {/* Policy Summary */}
                            {hasPolicies(ns.policies) && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {ns.policies.retention_time_minutes && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded">
                                            <Clock size={10} />
                                            Retention: {formatMinutes(ns.policies.retention_time_minutes)}
                                        </span>
                                    )}
                                    {ns.policies.message_ttl_seconds && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-400 text-xs rounded">
                                            <Clock size={10} />
                                            TTL: {ns.policies.message_ttl_seconds}s
                                        </span>
                                    )}
                                    {ns.policies.deduplication_enabled && (
                                        <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded">
                                            <Shield size={10} />
                                            Dedup
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-white/5 rounded-lg p-2">
                                    <div className="text-muted-foreground text-xs">Msg In</div>
                                    <div className="font-semibold">{formatRate(ns.msg_rate_in)}</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2">
                                    <div className="text-muted-foreground text-xs">Msg Out</div>
                                    <div className="font-semibold">{formatRate(ns.msg_rate_out)}</div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                                <div className="text-xs text-muted-foreground">
                                    Backlog: {ns.total_backlog.toLocaleString()}
                                </div>
                                <Link
                                    to={`/tenants/${tenant}/namespaces/${ns.namespace}/topics`}
                                    className="flex items-center gap-1 text-primary text-sm font-semibold hover:underline"
                                >
                                    View Topics
                                    <ArrowRight size={14} />
                                </Link>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Policy Editor Modal */}
            {editingNamespace && (
                <NamespacePolicyEditor
                    open={true}
                    onOpenChange={(open) => !open && setEditingNamespace(null)}
                    tenant={tenant!}
                    namespace={editingNamespace.namespace}
                    currentPolicies={editingNamespace.policies}
                    onSuccess={() => refetch()}
                />
            )}
        </div>
    );
}
