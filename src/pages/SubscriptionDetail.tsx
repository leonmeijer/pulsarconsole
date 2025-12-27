import { motion } from "framer-motion";
import {
    RefreshCcw,
    ArrowLeft,
    Users,
    Activity,
    AlertTriangle,
    SkipForward,
    ChevronDown,
    ChevronRight,
    Radio,
    Trash2,
    Clock,
    RotateCcw,
    Info,
    CheckCircle,
    XCircle,
    Star
} from "lucide-react";
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    useSubscription,
    useSkipAllMessages,
    useDeleteSubscription,
    useResetCursor,
    useSkipMessages
} from "@/api/hooks";
import type { Consumer } from "@/api/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared";
import { useFavorites } from "@/context/FavoritesContext";

function formatRate(rate: number): string {
    if (rate >= 1000000) return `${(rate / 1000000).toFixed(1)}M/s`;
    if (rate >= 1000) return `${(rate / 1000).toFixed(1)}K/s`;
    return `${rate.toFixed(1)}/s`;
}

function formatBytes(bytes: number): string {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
}

function getBacklogStatus(backlog: number): { color: string; label: string; bgColor: string } {
    if (backlog === 0) return { color: "text-green-400", label: "Clear", bgColor: "bg-green-500/10" };
    if (backlog < 1000) return { color: "text-yellow-400", label: "Low", bgColor: "bg-yellow-500/10" };
    if (backlog < 10000) return { color: "text-orange-400", label: "Medium", bgColor: "bg-orange-500/10" };
    return { color: "text-red-400", label: "High", bgColor: "bg-red-500/10" };
}

const subscriptionTypes = [
    {
        type: "Exclusive",
        description: "Only one consumer may connect. If a second consumer tries to connect, it fails.",
        color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    {
        type: "Shared",
        description: "Multiple consumers share messages. Each message goes to only one consumer (round-robin). Good for load balancing.",
        color: "bg-green-500/20 text-green-400 border-green-500/30",
    },
    {
        type: "Failover",
        description: "One active consumer, others on standby. On failure, the next consumer takes over.",
        color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    },
    {
        type: "Key_Shared",
        description: "Like Shared, but messages with the same key always go to the same consumer.",
        color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
];

function ConsumerCard({ consumer, index }: { consumer: Consumer; index: number }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white/5 rounded-xl overflow-hidden"
        >
            <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Users size={18} className="text-primary" />
                    </div>
                    <div>
                        <div className="font-medium">
                            {consumer.consumer_name || `Consumer ${index + 1}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {consumer.address || "Unknown address"}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-medium">
                            {formatRate(consumer.msg_rate_out)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {formatBytes(consumer.msg_throughput_out || 0)}/s
                        </div>
                    </div>
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
            </div>
            {expanded && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-t border-white/10 p-4 grid grid-cols-2 md:grid-cols-4 gap-4"
                >
                    <div>
                        <div className="text-xs text-muted-foreground">Connected Since</div>
                        <div className="font-medium text-sm">
                            {consumer.connected_since
                                ? new Date(consumer.connected_since).toLocaleString()
                                : "Unknown"}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Available Permits</div>
                        <div className="font-medium text-sm">{consumer.available_permits || 0}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Unacked Messages</div>
                        <div className={cn(
                            "font-medium text-sm",
                            (consumer.unacked_messages || 0) > 100 ? "text-orange-400" : ""
                        )}>
                            {consumer.unacked_messages || 0}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Blocked</div>
                        <div className="font-medium text-sm flex items-center gap-1">
                            {consumer.blocked_consumer_on_unacked_msgs ? (
                                <>
                                    <XCircle size={14} className="text-red-400" />
                                    Yes
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={14} className="text-green-400" />
                                    No
                                </>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}

export default function SubscriptionDetailPage() {
    const { tenant, namespace, topic, subscription } = useParams<{
        tenant: string;
        namespace: string;
        topic: string;
        subscription: string;
    }>();
    const navigate = useNavigate();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);
    const [showResetCursor, setShowResetCursor] = useState(false);
    const [showSkipCount, setShowSkipCount] = useState(false);
    const [skipCount, setSkipCount] = useState(1);
    const [resetTimestamp, setResetTimestamp] = useState("");

    const { isFavorite, toggleFavorite } = useFavorites();

    const { data: detail, isLoading, refetch } = useSubscription(
        tenant || "",
        namespace || "",
        topic || "",
        subscription || "",
        true
    );

    const deleteSubscription = useDeleteSubscription(
        tenant || "",
        namespace || "",
        topic || ""
    );

    const skipAll = useSkipAllMessages(
        tenant || "",
        namespace || "",
        topic || "",
        subscription || ""
    );

    const resetCursor = useResetCursor(
        tenant || "",
        namespace || "",
        topic || "",
        subscription || ""
    );

    const skipMessages = useSkipMessages(
        tenant || "",
        namespace || "",
        topic || "",
        subscription || ""
    );

    const handleDelete = async () => {
        try {
            await deleteSubscription.mutateAsync({ subscription: subscription || "" });
            toast.success(`Subscription '${subscription}' deleted`);
            navigate(`/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions`);
        } catch (error) {
            toast.error("Failed to delete subscription");
        }
    };

    const handleSkipAll = async () => {
        try {
            await skipAll.mutateAsync({});
            toast.success(`Skipped all messages for '${subscription}'`);
            refetch();
        } catch (error) {
            toast.error("Failed to skip messages");
        }
    };

    const handleResetCursor = async () => {
        if (!resetTimestamp) {
            toast.error("Please select a timestamp");
            return;
        }
        try {
            const timestamp = new Date(resetTimestamp).getTime();
            await resetCursor.mutateAsync({ timestamp });
            toast.success(`Cursor reset to ${new Date(timestamp).toLocaleString()}`);
            setShowResetCursor(false);
            refetch();
        } catch (error) {
            toast.error("Failed to reset cursor");
        }
    };

    const handleSkipMessages = async () => {
        if (skipCount < 1) {
            toast.error("Count must be at least 1");
            return;
        }
        try {
            await skipMessages.mutateAsync({ count: skipCount });
            toast.success(`Skipped ${skipCount} messages`);
            setShowSkipCount(false);
            refetch();
        } catch (error) {
            toast.error("Failed to skip messages");
        }
    };

    if (!tenant || !namespace || !topic || !subscription) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                Invalid route parameters
            </div>
        );
    }

    const backlogStatus = detail ? getBacklogStatus(detail.msg_backlog) : null;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link
                            to={`/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions`}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Radio size={28} className="text-primary" />
                            {subscription}
                        </h1>
                        <button
                            onClick={() => toggleFavorite({
                                type: 'subscription',
                                name: subscription,
                                path: `/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscription/${subscription}`,
                                tenant: tenant,
                                namespace: namespace,
                                topic: topic,
                            })}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title={isFavorite('subscription', subscription, tenant, namespace, topic) ? "Remove from favorites" : "Add to favorites"}
                        >
                            <Star
                                size={20}
                                className={isFavorite('subscription', subscription, tenant, namespace, topic) ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}
                                fill={isFavorite('subscription', subscription, tenant, namespace, topic) ? "currentColor" : "none"}
                            />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link to={`/tenants/${tenant}/namespaces`} className="hover:text-primary">{tenant}</Link>
                        <span>/</span>
                        <Link to={`/tenants/${tenant}/namespaces/${namespace}/topics`} className="hover:text-primary">{namespace}</Link>
                        <span>/</span>
                        <Link to={`/tenants/${tenant}/namespaces/${namespace}/topics/${topic}`} className="hover:text-primary">{topic}</Link>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => refetch()}
                        className="p-3 glass rounded-xl hover:bg-white/10 transition-all active:scale-95"
                    >
                        <RefreshCcw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-all active:scale-95"
                    >
                        <Trash2 size={18} />
                        Delete
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <div className="glass h-48 rounded-2xl animate-pulse" />
                    <div className="glass h-32 rounded-2xl animate-pulse" />
                </div>
            ) : detail && (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn("glass p-4 rounded-xl", backlogStatus?.bgColor)}
                        >
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                                <AlertTriangle size={16} />
                                Message Backlog
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold">
                                    {detail.msg_backlog.toLocaleString()}
                                </span>
                                <span className={cn("text-sm font-medium", backlogStatus?.color)}>
                                    {backlogStatus?.label}
                                </span>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="glass p-4 rounded-xl"
                        >
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                                <Activity size={16} />
                                Message Rate Out
                            </div>
                            <div className="text-3xl font-bold">
                                {formatRate(detail.msg_rate_out)}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="glass p-4 rounded-xl"
                        >
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                                <Activity size={16} />
                                Throughput Out
                            </div>
                            <div className="text-3xl font-bold">
                                {formatBytes(detail.msg_throughput_out || 0)}/s
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="glass p-4 rounded-xl"
                        >
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                                <Users size={16} />
                                Consumers
                            </div>
                            <div className="text-3xl font-bold">
                                {detail.consumer_count}
                            </div>
                        </motion.div>
                    </div>

                    {/* Subscription Type */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass p-6 rounded-2xl"
                    >
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Info size={20} />
                            Subscription Type
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {subscriptionTypes.map((type) => (
                                <div
                                    key={type.type}
                                    className={cn(
                                        "p-4 rounded-xl border-2 transition-all",
                                        type.type === detail.type
                                            ? type.color + " border-current"
                                            : "border-white/10 opacity-50"
                                    )}
                                >
                                    <div className="font-semibold mb-2">{type.type}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {type.description}
                                    </div>
                                    {type.type === detail.type && (
                                        <div className="mt-2 text-xs font-medium flex items-center gap-1">
                                            <CheckCircle size={14} />
                                            Current
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                            The subscription type is set when the first consumer connects and cannot be changed afterwards.
                            To use a different type, delete this subscription and create a new one with a consumer using the desired type.
                        </p>
                    </motion.div>

                    {/* Properties */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="glass p-6 rounded-2xl"
                    >
                        <h2 className="text-lg font-semibold mb-4">Properties</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="group relative">
                                <div className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                                    Durable
                                    <Info size={12} className="opacity-50" />
                                </div>
                                <div className="font-medium flex items-center gap-2 mt-1">
                                    {detail.is_durable ? (
                                        <>
                                            <CheckCircle size={16} className="text-green-400" />
                                            Yes
                                        </>
                                    ) : (
                                        <>
                                            <XCircle size={16} className="text-red-400" />
                                            No
                                        </>
                                    )}
                                </div>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    A durable subscription persists even when there are no active consumers. Messages are retained until acknowledged. Non-durable subscriptions are deleted when the last consumer disconnects.
                                </div>
                            </div>
                            <div className="group relative">
                                <div className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                                    Replicated
                                    <Info size={12} className="opacity-50" />
                                </div>
                                <div className="font-medium flex items-center gap-2 mt-1">
                                    {detail.replicated ? (
                                        <>
                                            <CheckCircle size={16} className="text-green-400" />
                                            Yes
                                        </>
                                    ) : (
                                        <>
                                            <XCircle size={16} className="text-muted-foreground" />
                                            No
                                        </>
                                    )}
                                </div>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    A replicated subscription is synchronized across multiple clusters in a geo-replicated setup. This ensures consumers in different regions see the same subscription state.
                                </div>
                            </div>
                            <div className="group relative">
                                <div className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                                    Expired Messages Rate
                                    <Info size={12} className="opacity-50" />
                                </div>
                                <div className="font-medium mt-1">{formatRate(detail.msg_rate_expired || 0)}</div>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    The rate at which messages are being expired (removed) from this subscription due to TTL (Time-To-Live) policies. High rates may indicate consumers are not keeping up.
                                </div>
                            </div>
                            <div className="group relative">
                                <div className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                                    Unacked Messages
                                    <Info size={12} className="opacity-50" />
                                </div>
                                <div className={cn(
                                    "font-medium mt-1",
                                    (detail.unacked_messages || 0) > 1000 ? "text-orange-400" : ""
                                )}>
                                    {(detail.unacked_messages || 0).toLocaleString()}
                                </div>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    Messages that have been delivered to consumers but not yet acknowledged. High numbers may indicate slow processing or consumer issues. These messages will be redelivered if not acknowledged.
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="glass p-6 rounded-2xl"
                    >
                        <h2 className="text-lg font-semibold mb-4">Actions</h2>
                        <div className="flex flex-wrap gap-3">
                            <div className="group relative">
                                <button
                                    onClick={() => setShowSkipConfirm(true)}
                                    disabled={detail.msg_backlog === 0 || skipAll.isPending}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <SkipForward size={18} />
                                    Skip All Messages
                                </button>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    Immediately skip all messages in the backlog without consuming them. This clears the entire backlog and cannot be undone. Use with caution.
                                </div>
                            </div>
                            <div className="group relative">
                                <button
                                    onClick={() => setShowSkipCount(true)}
                                    disabled={detail.msg_backlog === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <SkipForward size={18} />
                                    Skip N Messages
                                </button>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    Skip a specific number of messages from the backlog. Useful for skipping past problematic messages that are causing consumer failures.
                                </div>
                            </div>
                            <div className="group relative">
                                <button
                                    onClick={() => setShowResetCursor(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                                >
                                    <RotateCcw size={18} />
                                    Reset Cursor
                                </button>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    Reset the subscription cursor to a specific timestamp. All messages published after this timestamp will be redelivered to consumers. Useful for replaying messages.
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Consumers */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="glass p-6 rounded-2xl"
                    >
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Users size={20} />
                            Connected Consumers ({detail.consumers?.length || 0})
                        </h2>
                        {detail.consumers && detail.consumers.length > 0 ? (
                            <div className="space-y-3">
                                {detail.consumers.map((consumer: Consumer, index: number) => (
                                    <ConsumerCard key={index} consumer={consumer} index={index} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                <Users size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No consumers connected to this subscription</p>
                            </div>
                        )}
                    </motion.div>
                </>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Subscription"
                description={`Are you sure you want to delete subscription "${subscription}"? This action cannot be undone and all unacknowledged messages will be lost.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleDelete}
            />

            {/* Skip All Confirmation Dialog */}
            <ConfirmDialog
                open={showSkipConfirm}
                onOpenChange={setShowSkipConfirm}
                title="Skip All Messages"
                description={`Are you sure you want to skip all ${detail?.msg_backlog.toLocaleString() || 0} messages in the backlog? This action cannot be undone.`}
                confirmLabel="Skip All"
                variant="danger"
                onConfirm={handleSkipAll}
            />

            {/* Skip N Messages Dialog */}
            {showSkipCount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass p-6 rounded-2xl w-full max-w-md mx-4"
                    >
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <SkipForward size={20} />
                            Skip Messages
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-muted-foreground mb-2">
                                    Number of messages to skip
                                </label>
                                <input
                                    type="number"
                                    value={skipCount}
                                    onChange={(e) => setSkipCount(parseInt(e.target.value) || 1)}
                                    min={1}
                                    max={detail?.msg_backlog || 1}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                    Max: {detail?.msg_backlog.toLocaleString() || 0} messages
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowSkipCount(false)}
                                    className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSkipMessages}
                                    disabled={skipMessages.isPending}
                                    className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 disabled:opacity-50"
                                >
                                    {skipMessages.isPending ? "Skipping..." : "Skip"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Reset Cursor Dialog */}
            {showResetCursor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass p-6 rounded-2xl w-full max-w-md mx-4"
                    >
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Clock size={20} />
                            Reset Cursor
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-muted-foreground mb-2">
                                    Reset cursor to timestamp
                                </label>
                                <input
                                    type="datetime-local"
                                    value={resetTimestamp}
                                    onChange={(e) => setResetTimestamp(e.target.value)}
                                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                    Messages published after this timestamp will be replayed
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowResetCursor(false)}
                                    className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResetCursor}
                                    disabled={resetCursor.isPending}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-400 disabled:opacity-50"
                                >
                                    {resetCursor.isPending ? "Resetting..." : "Reset Cursor"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
