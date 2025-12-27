import { motion } from "framer-motion";
import {
    RefreshCcw,
    ArrowLeft,
    Send,
    Database,
    Activity,
    Eye,
    ExternalLink,
    ChevronDown,
    ChevronRight,
    Copy,
    Clock,
    User,
    FileText,
    Code,
    Layers,
    Settings,
    Star,
    Info
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTopic, useSubscriptions, useBrowseMessages } from "@/api/hooks";
import type { Message, MessagePayload } from "@/api/types";
import { cn } from "@/lib/utils";
import { TopicPartitionEditor } from "@/components/shared";
import { useFavorites } from "@/context/FavoritesContext";

function formatRate(rate: number): string {
    if (rate >= 1000000) return `${(rate / 1000000).toFixed(1)}M/s`;
    if (rate >= 1000) return `${(rate / 1000).toFixed(1)}K/s`;
    return `${rate.toFixed(1)}/s`;
}

function formatSize(bytes: number): string {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
}

function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
}

function PayloadViewer({ payload }: { payload: MessagePayload }) {
    const [expanded, setExpanded] = useState(false);

    const renderContent = () => {
        if (payload.type === "json") {
            try {
                const formatted = JSON.stringify(payload.content, null, 2);
                return (
                    <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap break-words">
                        {formatted}
                    </pre>
                );
            } catch {
                return <span className="text-muted-foreground">Invalid JSON</span>;
            }
        }
        if (payload.type === "binary") {
            return (
                <div className="text-sm">
                    <span className="text-muted-foreground">Binary data</span>
                    {payload.size && <span className="ml-2">({formatSize(payload.size)})</span>}
                    {payload.raw && (
                        <pre className="mt-2 font-mono text-xs bg-black/20 p-2 rounded overflow-x-auto">
                            {payload.raw.slice(0, 200)}
                            {payload.raw.length > 200 && "..."}
                        </pre>
                    )}
                </div>
            );
        }
        return <pre className="text-sm font-mono whitespace-pre-wrap">{String(payload.content)}</pre>;
    };

    return (
        <div className="bg-white/5 rounded-lg p-3">
            <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="text-xs text-muted-foreground uppercase">
                    {payload.type}
                </span>
                {payload.size && (
                    <span className="text-xs text-muted-foreground">
                        ({formatSize(payload.size)})
                    </span>
                )}
            </div>
            {expanded && <div className="mt-2">{renderContent()}</div>}
        </div>
    );
}

function MessageCard({ message }: { message: Message }) {
    const [showDetails, setShowDetails] = useState(false);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-4 space-y-3"
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText size={18} className="text-primary" />
                    </div>
                    <div>
                        <div className="font-medium">Message #{message.index + 1}</div>
                        {message.message_id && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-mono">{message.message_id.slice(0, 20)}...</span>
                                <button
                                    onClick={() => copyToClipboard(message.message_id!)}
                                    className="hover:text-primary"
                                >
                                    <Copy size={12} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-muted-foreground hover:text-primary"
                >
                    {showDetails ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {message.publish_time && (
                    <div className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatTimestamp(message.publish_time)}
                    </div>
                )}
                {message.producer_name && (
                    <div className="flex items-center gap-1">
                        <User size={14} />
                        {message.producer_name}
                    </div>
                )}
                {message.redelivery_count > 0 && (
                    <div className="text-orange-400">
                        Redelivered {message.redelivery_count}x
                    </div>
                )}
            </div>

            <PayloadViewer payload={message.payload} />

            {showDetails && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2 pt-2 border-t border-white/10"
                >
                    {message.key && (
                        <div className="text-sm">
                            <span className="text-muted-foreground">Key: </span>
                            <span className="font-mono">{message.key}</span>
                        </div>
                    )}
                    {message.event_time && (
                        <div className="text-sm">
                            <span className="text-muted-foreground">Event Time: </span>
                            {formatTimestamp(message.event_time)}
                        </div>
                    )}
                    {Object.keys(message.properties).length > 0 && (
                        <div className="text-sm">
                            <span className="text-muted-foreground">Properties:</span>
                            <div className="mt-1 bg-white/5 rounded p-2">
                                {Object.entries(message.properties).map(([key, value]) => (
                                    <div key={key} className="flex gap-2">
                                        <span className="text-primary font-mono">{key}:</span>
                                        <span>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
}

function MessageBrowser({
    tenant,
    namespace,
    topic,
    subscriptions,
}: {
    tenant: string;
    namespace: string;
    topic: string;
    subscriptions: { name: string }[];
}) {
    const [selectedSub, setSelectedSub] = useState(subscriptions[0]?.name || "");
    const [messageCount, setMessageCount] = useState(10);
    const [messages, setMessages] = useState<Message[]>([]);

    const browseMessages = useBrowseMessages(tenant, namespace, topic, selectedSub, messageCount);

    const handleBrowse = async () => {
        if (!selectedSub) {
            toast.error("Select a subscription first");
            return;
        }
        try {
            const result = await browseMessages.mutateAsync({});
            setMessages(result.messages);
            if (result.messages.length === 0) {
                toast.info("No messages in this subscription");
            }
        } catch (error) {
            toast.error("Failed to browse messages");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Eye size={20} />
                    Message Browser
                </h2>
            </div>

            <div className="glass p-4 rounded-xl">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm text-muted-foreground mb-2">
                            Subscription
                        </label>
                        <select
                            value={selectedSub}
                            onChange={(e) => setSelectedSub(e.target.value)}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                        >
                            {subscriptions.map((sub) => (
                                <option key={sub.name} value={sub.name} className="bg-gray-900">
                                    {sub.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="w-32">
                        <label className="block text-sm text-muted-foreground mb-2">
                            Count
                        </label>
                        <select
                            value={messageCount}
                            onChange={(e) => setMessageCount(parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                        >
                            <option value={5} className="bg-gray-900">5</option>
                            <option value={10} className="bg-gray-900">10</option>
                            <option value={25} className="bg-gray-900">25</option>
                            <option value={50} className="bg-gray-900">50</option>
                        </select>
                    </div>
                    <button
                        onClick={handleBrowse}
                        disabled={browseMessages.isPending || !selectedSub}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Code size={18} />
                        {browseMessages.isPending ? "Loading..." : "Browse Messages"}
                    </button>
                </div>
            </div>

            {messages.length > 0 && (
                <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                        Showing {messages.length} message(s)
                    </div>
                    {messages.map((message) => (
                        <MessageCard key={message.index} message={message} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function TopicDetailPage() {
    const { tenant, namespace, topic } = useParams<{ tenant: string; namespace: string; topic: string }>();
    const { data: topicData, isLoading: topicLoading, refetch: refetchTopic } = useTopic(tenant!, namespace!, topic!);
    const { data: subscriptions, isLoading: subsLoading, refetch: refetchSubs } = useSubscriptions(tenant!, namespace!, topic!);
    const [showPartitionEditor, setShowPartitionEditor] = useState(false);
    const { isFavorite, toggleFavorite } = useFavorites();

    const isLoading = topicLoading || subsLoading;

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
                        <Link to={`/tenants/${tenant}/namespaces/${namespace}/topics`} className="hover:text-primary">
                            {namespace}
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">{topic}</span>
                    </div>
                    <h1 className="text-3xl font-bold">{topic}</h1>
                    <p className="text-muted-foreground mt-1">Topic details, subscriptions, and message browser.</p>
                </div>
                <button
                    onClick={() => { refetchTopic(); refetchSubs(); }}
                    className="p-3 glass rounded-xl hover:bg-white/10 transition-all active:scale-95"
                >
                    <RefreshCcw size={20} className={isLoading ? "animate-spin" : ""} />
                </button>
            </div>

            {topicLoading ? (
                <div className="glass h-48 rounded-2xl animate-pulse" />
            ) : topicData && (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass p-4 rounded-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                    <Activity size={20} className="text-green-500" />
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Msg In</div>
                                    <div className="text-xl font-bold">{formatRate(topicData.stats.msg_rate_in)}</div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="glass p-4 rounded-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Activity size={20} className="text-blue-500" />
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Msg Out</div>
                                    <div className="text-xl font-bold">{formatRate(topicData.stats.msg_rate_out)}</div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="glass p-4 rounded-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <Database size={20} className="text-purple-500" />
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Storage</div>
                                    <div className="text-xl font-bold">{formatSize(topicData.stats.storage_size)}</div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="glass p-4 rounded-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-500/10 rounded-lg">
                                    <Send size={20} className="text-orange-500" />
                                </div>
                                <div>
                                    <div className="text-sm text-muted-foreground">Backlog</div>
                                    <div className="text-xl font-bold">{topicData.stats.backlog_size.toLocaleString()}</div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="glass p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => setShowPartitionEditor(true)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-500/10 rounded-lg">
                                    <Layers size={20} className="text-cyan-500" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm text-muted-foreground">Partitions</div>
                                    <div className="text-xl font-bold">
                                        {topicData.partitions > 0 ? topicData.partitions : "None"}
                                    </div>
                                </div>
                                <Settings size={16} className="text-muted-foreground" />
                            </div>
                        </motion.div>
                    </div>

                    {/* Internal Stats */}
                    <div className="glass p-6 rounded-xl">
                        <h2 className="text-lg font-semibold mb-4">Internal Statistics</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div className="group relative">
                                <div className="text-muted-foreground flex items-center gap-1 cursor-help">
                                    Entries Added
                                    <Info size={12} className="opacity-50" />
                                </div>
                                <div className="font-medium">{topicData.internal_stats.entries_added_counter.toLocaleString()}</div>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    Cumulative count of all entries (messages) ever added to this topic since creation. This counter never decreases, even after messages are consumed or deleted.
                                </div>
                            </div>
                            <div className="group relative">
                                <div className="text-muted-foreground flex items-center gap-1 cursor-help">
                                    Total Entries
                                    <Info size={12} className="opacity-50" />
                                </div>
                                <div className="font-medium">{topicData.internal_stats.number_of_entries.toLocaleString()}</div>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    Current number of entries stored in the topic across all ledgers. This decreases when messages are acknowledged and cleaned up by retention policies.
                                </div>
                            </div>
                            <div className="group relative">
                                <div className="text-muted-foreground flex items-center gap-1 cursor-help">
                                    Total Size
                                    <Info size={12} className="opacity-50" />
                                </div>
                                <div className="font-medium">{formatSize(topicData.internal_stats.total_size)}</div>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    Total storage size of all entries in the topic across all ledgers in BookKeeper. Includes message payloads, headers, and metadata.
                                </div>
                            </div>
                            <div className="group relative">
                                <div className="text-muted-foreground flex items-center gap-1 cursor-help">
                                    Ledger Entries
                                    <Info size={12} className="opacity-50" />
                                </div>
                                <div className="font-medium">{topicData.internal_stats.current_ledger_entries.toLocaleString()}</div>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    Number of entries in the current active ledger. Pulsar uses Apache BookKeeper ledgers to store messages. When a ledger reaches its size limit, a new one is created.
                                </div>
                            </div>
                            <div className="group relative">
                                <div className="text-muted-foreground flex items-center gap-1 cursor-help">
                                    Ledger Size
                                    <Info size={12} className="opacity-50" />
                                </div>
                                <div className="font-medium">{formatSize(topicData.internal_stats.current_ledger_size)}</div>
                                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a2e] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 pointer-events-none shadow-xl border border-white/10 z-10">
                                    Size of the current active ledger in bytes. When this reaches the configured maximum ledger size, Pulsar rolls over to a new ledger automatically.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Producers */}
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Producers ({topicData.producer_count})</h2>
                        {topicData.producers.length === 0 ? (
                            <div className="glass p-6 rounded-xl text-muted-foreground text-center">
                                No active producers
                            </div>
                        ) : (
                            <div className="glass rounded-xl overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-white/5">
                                        <tr>
                                            <th className="text-left p-4 text-sm font-semibold">Name</th>
                                            <th className="text-left p-4 text-sm font-semibold">Address</th>
                                            <th className="text-right p-4 text-sm font-semibold">Msg Rate</th>
                                            <th className="text-right p-4 text-sm font-semibold">Throughput</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topicData.producers.map((producer, i) => (
                                            <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                                                <td className="p-4">{producer.producer_name || 'Unknown'}</td>
                                                <td className="p-4 text-muted-foreground">{producer.address || '-'}</td>
                                                <td className="p-4 text-right">{formatRate(producer.msg_rate_in)}</td>
                                                <td className="p-4 text-right">{formatSize(producer.msg_throughput_in)}/s</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Subscriptions */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Subscriptions ({subscriptions?.length || 0})</h2>
                            <Link
                                to={`/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions`}
                                className="flex items-center gap-2 text-primary hover:underline text-sm"
                            >
                                Manage Subscriptions
                                <ExternalLink size={14} />
                            </Link>
                        </div>
                        {subsLoading ? (
                            <div className="glass h-32 rounded-xl animate-pulse" />
                        ) : !subscriptions?.length ? (
                            <div className="glass p-6 rounded-xl text-muted-foreground text-center">
                                No subscriptions
                            </div>
                        ) : (
                            <div className="glass rounded-xl overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-white/5">
                                        <tr>
                                            <th className="w-10 p-4"></th>
                                            <th className="text-left p-4 text-sm font-semibold">Name</th>
                                            <th className="text-left p-4 text-sm font-semibold">Type</th>
                                            <th className="text-right p-4 text-sm font-semibold">Consumers</th>
                                            <th className="text-right p-4 text-sm font-semibold">Backlog</th>
                                            <th className="text-right p-4 text-sm font-semibold">Msg Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subscriptions.map((sub) => (
                                            <tr key={sub.name} className="border-t border-white/5 hover:bg-white/5 group">
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => toggleFavorite({
                                                            type: 'subscription',
                                                            name: sub.name,
                                                            path: `/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscription/${sub.name}`,
                                                            tenant: tenant,
                                                            namespace: namespace,
                                                            topic: topic,
                                                        })}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                                                        title={isFavorite('subscription', sub.name, tenant, namespace, topic) ? "Remove from favorites" : "Add to favorites"}
                                                    >
                                                        <Star
                                                            size={16}
                                                            className={isFavorite('subscription', sub.name, tenant, namespace, topic) ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}
                                                            fill={isFavorite('subscription', sub.name, tenant, namespace, topic) ? "currentColor" : "none"}
                                                        />
                                                    </button>
                                                </td>
                                                <td className="p-4 font-medium">
                                                    <Link
                                                        to={`/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscription/${sub.name}`}
                                                        className="hover:text-primary hover:underline transition-colors"
                                                    >
                                                        {sub.name}
                                                    </Link>
                                                </td>
                                                <td className="p-4">
                                                    <span className={cn(
                                                        "px-2 py-1 rounded text-xs",
                                                        sub.type === 'Exclusive' ? 'bg-blue-500/20 text-blue-400' :
                                                        sub.type === 'Shared' ? 'bg-green-500/20 text-green-400' :
                                                        sub.type === 'Failover' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                    )}>
                                                        {sub.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">{sub.consumer_count}</td>
                                                <td className="p-4 text-right">
                                                    <span className={sub.msg_backlog > 1000 ? 'text-orange-400' : ''}>
                                                        {sub.msg_backlog.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">{formatRate(sub.msg_rate_out)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Message Browser */}
                    {subscriptions && subscriptions.length > 0 && (
                        <MessageBrowser
                            tenant={tenant!}
                            namespace={namespace!}
                            topic={topic!}
                            subscriptions={subscriptions}
                        />
                    )}

                    {/* Partition Editor Modal */}
                    <TopicPartitionEditor
                        open={showPartitionEditor}
                        onOpenChange={setShowPartitionEditor}
                        tenant={tenant!}
                        namespace={namespace!}
                        topic={topic!}
                        currentPartitions={topicData.partitions || 0}
                        onSuccess={() => refetchTopic()}
                    />
                </>
            )}
        </div>
    );
}
