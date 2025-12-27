import { motion } from "framer-motion";
import { Plus, RefreshCcw, MessageSquare, ArrowRight, Trash2, ArrowLeft, Star } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTopics, useCreateTopic, useDeleteTopic } from "@/api/hooks";
import { useFavorites } from "@/context/FavoritesContext";
import { PermissionGate } from "@/components/auth";

export default function TopicsPage() {
    const { tenant, namespace } = useParams<{ tenant: string; namespace: string }>();
    const { data: topics, isLoading, refetch } = useTopics(tenant!, namespace!);
    const createTopic = useCreateTopic(tenant!, namespace!);
    const deleteTopic = useDeleteTopic(tenant!, namespace!);
    const [showCreate, setShowCreate] = useState(false);
    const [newTopicName, setNewTopicName] = useState("");
    const [partitions, setPartitions] = useState(0);
    const { isFavorite, toggleFavorite } = useFavorites();

    const handleCreate = async () => {
        if (!newTopicName.trim()) {
            toast.error("Topic name is required");
            return;
        }
        try {
            await createTopic.mutateAsync({
                name: newTopicName.trim(),
                persistent: true,
                partitions,
            });
            toast.success(`Topic '${newTopicName}' created`);
            setNewTopicName("");
            setPartitions(0);
            setShowCreate(false);
        } catch (error) {
            toast.error("Failed to create topic");
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`Are you sure you want to delete topic '${name}'?`)) return;
        try {
            await deleteTopic.mutateAsync({ topic: name });
            toast.success(`Topic '${name}' deleted`);
        } catch (error) {
            toast.error("Failed to delete topic. It may have active subscriptions.");
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
        return `${bytes} B`;
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-2 flex-wrap">
                        <Link to="/tenants" className="hover:text-primary flex items-center gap-1">
                            <ArrowLeft size={16} />
                            Tenants
                        </Link>
                        <span>/</span>
                        <Link to={`/tenants/${tenant}/namespaces`} className="hover:text-primary">
                            {tenant}
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">{namespace}</span>
                    </div>
                    <h1 className="text-3xl font-bold">Topics</h1>
                    <p className="text-muted-foreground mt-1">Manage topics in {tenant}/{namespace}.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => refetch()}
                        className="p-3 glass rounded-xl hover:bg-white/10 transition-all active:scale-95"
                    >
                        <RefreshCcw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <PermissionGate action="write" resourceLevel="topic" resourcePath={`${tenant}/${namespace}`}>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 font-semibold"
                        >
                            <Plus size={20} />
                            Create Topic
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
                    <h3 className="text-lg font-semibold mb-4">Create New Topic</h3>
                    <div className="flex gap-4 flex-wrap">
                        <input
                            type="text"
                            value={newTopicName}
                            onChange={(e) => setNewTopicName(e.target.value)}
                            placeholder="Topic name"
                            className="flex-1 min-w-[200px] px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                        />
                        <input
                            type="number"
                            value={partitions}
                            onChange={(e) => setPartitions(parseInt(e.target.value) || 0)}
                            placeholder="Partitions"
                            min="0"
                            className="w-32 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={createTopic.isPending}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                        >
                            {createTopic.isPending ? "Creating..." : "Create"}
                        </button>
                        <button
                            onClick={() => setShowCreate(false)}
                            className="px-6 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                        >
                            Cancel
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Set partitions to 0 for a non-partitioned topic.
                    </p>
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="glass h-48 rounded-2xl animate-pulse" />
                    ))
                ) : topics?.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        No topics found. Create one to get started.
                    </div>
                ) : (
                    topics?.map((topic, index) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            key={topic.full_name}
                            className="glass p-6 rounded-2xl group hover:border-primary/50 transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />

                            <div className="flex items-start justify-between relative">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <MessageSquare size={24} className="text-primary" />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => toggleFavorite({
                                            type: 'topic',
                                            name: topic.name,
                                            path: `/tenants/${tenant}/namespaces/${namespace}/topics/${topic.name}`,
                                            tenant: tenant,
                                            namespace: namespace,
                                        })}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                        title={isFavorite('topic', topic.name, tenant, namespace) ? "Remove from favorites" : "Add to favorites"}
                                    >
                                        <Star
                                            size={18}
                                            className={isFavorite('topic', topic.name, tenant, namespace) ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}
                                            fill={isFavorite('topic', topic.name, tenant, namespace) ? "currentColor" : "none"}
                                        />
                                    </button>
                                    <PermissionGate action="write" resourceLevel="topic" resourcePath={`${tenant}/${namespace}/${topic.name}`}>
                                        <button
                                            onClick={() => handleDelete(topic.name)}
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
                                    to={`/tenants/${tenant}/namespaces/${namespace}/topics/${topic.name}`}
                                    className="text-xl font-bold hover:text-primary transition-colors truncate block"
                                    title={topic.name}
                                >
                                    {topic.name}
                                </Link>
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                                    <span>{topic.subscription_count} Subs</span>
                                    <span>•</span>
                                    <span>{topic.producer_count} Producers</span>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-white/5 rounded-lg p-2">
                                    <div className="text-muted-foreground text-xs">Msg In</div>
                                    <div className="font-semibold">{formatRate(topic.msg_rate_in)}</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2">
                                    <div className="text-muted-foreground text-xs">Storage</div>
                                    <div className="font-semibold">{formatSize(topic.storage_size)}</div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                                <div className="text-xs text-muted-foreground">
                                    Backlog: {formatSize(topic.backlog_size)}
                                </div>
                                <Link
                                    to={`/tenants/${tenant}/namespaces/${namespace}/topics/${topic.name}`}
                                    className="flex items-center gap-1 text-primary text-sm font-semibold hover:underline"
                                >
                                    View Details
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
