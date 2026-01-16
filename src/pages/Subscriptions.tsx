import { motion } from "framer-motion";
import {
    RefreshCcw,
    Plus,
    ArrowLeft,
    Users,
    Activity,
    AlertTriangle,
    SkipForward,
    ChevronDown,
    ChevronRight,
    Radio,
    ExternalLink,
    Info,
    Clock,
    Globe
} from "lucide-react";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
    useSubscriptions,
    useSubscription,
    useCreateSubscription,
    useSkipAllMessages
} from "@/api/hooks";
import type { Subscription, Consumer, SubscriptionCreate } from "@/api/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared";
import { formatBytes } from "@/lib/format";

function formatRate(rate: number): string {
    if (rate >= 1000000) return `${(rate / 1000000).toFixed(1)}M/s`;
    if (rate >= 1000) return `${(rate / 1000).toFixed(1)}K/s`;
    return `${rate.toFixed(1)}/s`;
}


function getBacklogStatus(backlog: number): { color: string; label: string } {
    if (backlog === 0) return { color: "text-green-400", label: "Clear" };
    if (backlog < 1000) return { color: "text-yellow-400", label: "Low" };
    if (backlog < 10000) return { color: "text-orange-400", label: "Medium" };
    return { color: "text-red-400", label: "High" };
}

function SubscriptionCard({
    subscription,
    tenant,
    namespace,
    topic,
    onSkipAll
}: {
    subscription: Subscription;
    tenant: string;
    namespace: string;
    topic: string;
    onSkipAll: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [showSkipConfirm, setShowSkipConfirm] = useState(false);

    const { data: detail, isLoading: detailLoading } = useSubscription(
        tenant,
        namespace,
        topic,
        subscription.name,
        true
    );

    const backlogStatus = getBacklogStatus(subscription.msg_backlog);

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl overflow-hidden"
            >
                <div
                    className="p-6 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-xl">
                                <Radio size={24} className="text-primary" />
                            </div>
                            <div>
                                <Link
                                    to={`/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscription/${subscription.name}`}
                                    className="text-lg font-semibold hover:text-primary transition-colors flex items-center gap-2 group"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {subscription.name}
                                    <ExternalLink size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                    <span className="px-2 py-0.5 bg-white/5 rounded text-xs">
                                        {subscription.type}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <Users size={14} />
                                        {subscription.consumer_count} consumers
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSkipConfirm(true);
                                }}
                                disabled={subscription.msg_backlog === 0}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Skip all messages"
                            >
                                <SkipForward size={18} className="text-muted-foreground" />
                            </button>
                            {expanded ? (
                                <ChevronDown size={20} className="text-muted-foreground" />
                            ) : (
                                <ChevronRight size={20} className="text-muted-foreground" />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="bg-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                <AlertTriangle size={14} />
                                Backlog
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold">
                                    {subscription.msg_backlog.toLocaleString()}
                                </span>
                                <span className={cn("text-xs font-medium", backlogStatus.color)}>
                                    {backlogStatus.label}
                                </span>
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                <Activity size={14} />
                                Rate Out
                            </div>
                            <div className="text-2xl font-bold">
                                {formatRate(subscription.msg_rate_out)}
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                <Activity size={14} />
                                Throughput
                            </div>
                            <div className="text-2xl font-bold">
                                {formatBytes(subscription.msg_throughput_out || 0)}/s
                            </div>
                        </div>
                    </div>
                </div>

                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-white/10 p-6"
                    >
                        <h4 className="text-sm font-semibold text-muted-foreground mb-4">
                            Connected Consumers
                        </h4>
                        {detailLoading ? (
                            <div className="space-y-3">
                                {[1, 2].map(i => (
                                    <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : detail?.consumers && detail.consumers.length > 0 ? (
                            <div className="space-y-3">
                                {detail.consumers.map((consumer: Consumer, index: number) => (
                                    <div
                                        key={index}
                                        className="bg-white/5 rounded-xl p-4 flex items-center justify-between"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {consumer.consumer_name || `Consumer ${index + 1}`}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {consumer.address || "Unknown address"}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">
                                                {formatRate(consumer.msg_rate_out)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {consumer.connected_since
                                                    ? `Connected ${new Date(consumer.connected_since).toLocaleDateString()}`
                                                    : ""}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                No consumers connected
                            </div>
                        )}
                    </motion.div>
                )}
            </motion.div>

            <ConfirmDialog
                open={showSkipConfirm}
                onOpenChange={setShowSkipConfirm}
                title="Skip All Messages"
                description={`Are you sure you want to skip all ${subscription.msg_backlog.toLocaleString()} messages in the backlog for subscription "${subscription.name}"? This action cannot be undone.`}
                confirmLabel="Skip All"
                variant="danger"
                onConfirm={onSkipAll}
            />
        </>
    );
}

export default function SubscriptionsPage() {
    const { tenant, namespace, topic } = useParams<{
        tenant: string;
        namespace: string;
        topic: string;
    }>();

    const [showCreate, setShowCreate] = useState(false);
    const [newSubName, setNewSubName] = useState("");
    const [initialPosition, setInitialPosition] = useState<'earliest' | 'latest'>('latest');
    const [replicated, setReplicated] = useState(false);

    const { data: subscriptions, isLoading, refetch } = useSubscriptions(
        tenant || "",
        namespace || "",
        topic || ""
    );

    const createSubscription = useCreateSubscription(
        tenant || "",
        namespace || "",
        topic || ""
    );

    const handleCreate = async () => {
        if (!newSubName.trim()) {
            toast.error("Subscription name is required");
            return;
        }
        try {
            const createData: SubscriptionCreate = {
                name: newSubName.trim(),
                initial_position: initialPosition,
                replicated: replicated,
            };
            await createSubscription.mutateAsync(createData);
            toast.success(`Subscription '${newSubName}' created`);
            setNewSubName("");
            setInitialPosition('latest');
            setReplicated(false);
            setShowCreate(false);
        } catch (error) {
            toast.error("Failed to create subscription");
        }
    };

    const SkipAllButton = ({ subscription }: { subscription: Subscription }) => {
        const skipAll = useSkipAllMessages(
            tenant || "",
            namespace || "",
            topic || "",
            subscription.name
        );

        const handleSkipAll = async () => {
            try {
                await skipAll.mutateAsync({});
                toast.success(`Skipped all messages for '${subscription.name}'`);
                refetch();
            } catch (error) {
                toast.error("Failed to skip messages");
            }
        };

        return (
            <SubscriptionCard
                subscription={subscription}
                tenant={tenant || ""}
                namespace={namespace || ""}
                topic={topic || ""}
                onSkipAll={handleSkipAll}
            />
        );
    };

    if (!tenant || !namespace || !topic) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                Invalid route parameters
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link
                            to={`/tenants/${tenant}/namespaces/${namespace}/topics/${topic}`}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-3xl font-bold">Subscriptions</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Manage subscriptions for topic <span className="text-primary font-mono">{topic}</span>
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>{tenant}</span>
                        <span>/</span>
                        <span>{namespace}</span>
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
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 font-semibold"
                    >
                        <Plus size={20} />
                        Create Subscription
                    </button>
                </div>
            </div>

            {showCreate && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-6 rounded-2xl"
                >
                    <h3 className="text-lg font-semibold mb-4">Create New Subscription</h3>

                    <div className="space-y-5">
                        {/* Subscription Name */}
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">
                                Subscription Name *
                            </label>
                            <input
                                type="text"
                                value={newSubName}
                                onChange={(e) => setNewSubName(e.target.value)}
                                placeholder="e.g., my-subscription"
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                            />
                        </div>

                        {/* Initial Position */}
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">
                                <div className="flex items-center gap-2">
                                    <Clock size={14} />
                                    Initial Position
                                </div>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setInitialPosition('latest')}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all text-left",
                                        initialPosition === 'latest'
                                            ? "border-primary bg-primary/10"
                                            : "border-white/10 bg-white/5 hover:bg-white/10"
                                    )}
                                >
                                    <div className="font-medium">Latest</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Start consuming from new messages only
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setInitialPosition('earliest')}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all text-left",
                                        initialPosition === 'earliest'
                                            ? "border-primary bg-primary/10"
                                            : "border-white/10 bg-white/5 hover:bg-white/10"
                                    )}
                                >
                                    <div className="font-medium">Earliest</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Start consuming from the first available message
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Geo-Replication */}
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">
                                <div className="flex items-center gap-2">
                                    <Globe size={14} />
                                    Geo-Replication
                                </div>
                            </label>
                            <button
                                type="button"
                                onClick={() => setReplicated(!replicated)}
                                className={cn(
                                    "w-full p-4 rounded-xl border transition-all text-left flex items-center justify-between",
                                    replicated
                                        ? "border-primary bg-primary/10"
                                        : "border-white/10 bg-white/5 hover:bg-white/10"
                                )}
                            >
                                <div>
                                    <div className="font-medium">Replicated Subscription</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Enable geo-replication for this subscription across clusters
                                    </div>
                                </div>
                                <div className={cn(
                                    "w-12 h-6 rounded-full transition-colors relative",
                                    replicated ? "bg-primary" : "bg-white/20"
                                )}>
                                    <div className={cn(
                                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                                        replicated ? "left-7" : "left-1"
                                    )} />
                                </div>
                            </button>
                        </div>

                        {/* Subscription Type Info */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-blue-400">About Subscription Types</div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        The subscription type (Exclusive, Shared, Failover, Key_Shared) is determined
                                        by the first consumer that connects to this subscription, not during creation.
                                        Configure the subscription type in your consumer client code.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleCreate}
                                disabled={createSubscription.isPending || !newSubName.trim()}
                                className="flex-1 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {createSubscription.isPending ? "Creating..." : "Create Subscription"}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCreate(false);
                                    setNewSubName("");
                                    setInitialPosition('latest');
                                    setReplicated(false);
                                }}
                                className="px-6 py-2.5 bg-white/10 rounded-lg hover:bg-white/20"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass p-4 rounded-xl">
                    <div className="text-sm text-muted-foreground">Total Subscriptions</div>
                    <div className="text-2xl font-bold mt-1">
                        {subscriptions?.length || 0}
                    </div>
                </div>
                <div className="glass p-4 rounded-xl">
                    <div className="text-sm text-muted-foreground">Total Backlog</div>
                    <div className="text-2xl font-bold mt-1">
                        {subscriptions?.reduce((acc, s) => acc + s.msg_backlog, 0).toLocaleString() || 0}
                    </div>
                </div>
                <div className="glass p-4 rounded-xl">
                    <div className="text-sm text-muted-foreground">Total Consumers</div>
                    <div className="text-2xl font-bold mt-1">
                        {subscriptions?.reduce((acc, s) => acc + s.consumer_count, 0) || 0}
                    </div>
                </div>
                <div className="glass p-4 rounded-xl">
                    <div className="text-sm text-muted-foreground">Aggregate Rate Out</div>
                    <div className="text-2xl font-bold mt-1">
                        {formatRate(subscriptions?.reduce((acc, s) => acc + s.msg_rate_out, 0) || 0)}
                    </div>
                </div>
            </div>

            {/* Subscription List */}
            <div className="space-y-4">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="glass h-48 rounded-2xl animate-pulse" />
                    ))
                ) : subscriptions?.length === 0 ? (
                    <div className="glass rounded-2xl p-12 text-center">
                        <Radio size={48} className="mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">No subscriptions</h3>
                        <p className="text-muted-foreground mt-2">
                            Create a subscription to start consuming messages from this topic.
                        </p>
                    </div>
                ) : (
                    subscriptions?.map((subscription) => (
                        <SkipAllButton key={subscription.name} subscription={subscription} />
                    ))
                )}
            </div>
        </div>
    );
}
