import { motion } from "framer-motion";
import { RefreshCcw, Server, Activity, Cpu, HardDrive, Play, Pause } from "lucide-react";
import { useState } from "react";
import { useBrokers, useClusterInfo } from "@/api/hooks";

export default function BrokersPage() {
    const [isPaused, setIsPaused] = useState(false);
    const { data: brokers, isLoading, refetch } = useBrokers({ paused: isPaused });
    const { data: clusterInfo } = useClusterInfo();

    const formatRate = (rate: number) => {
        if (rate >= 1000000) return `${(rate / 1000000).toFixed(1)}M/s`;
        if (rate >= 1000) return `${(rate / 1000).toFixed(1)}K/s`;
        return `${rate.toFixed(1)}/s`;
    };

    const formatBytes = (bytes: number) => {
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB/s`;
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB/s`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
        return `${bytes} B/s`;
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Brokers</h1>
                    <p className="text-muted-foreground mt-1">Monitor Pulsar cluster brokers.</p>
                </div>
                <div className="flex items-center gap-2">
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
                </div>
            </div>

            {/* Cluster Summary */}
            {clusterInfo && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-4 rounded-xl"
                    >
                        <div className="text-sm text-muted-foreground">Brokers</div>
                        <div className="text-2xl font-bold">{clusterInfo.broker_count}</div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass p-4 rounded-xl"
                    >
                        <div className="text-sm text-muted-foreground">Total Topics</div>
                        <div className="text-2xl font-bold">{clusterInfo.total_topics.toLocaleString()}</div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass p-4 rounded-xl"
                    >
                        <div className="text-sm text-muted-foreground">Producers</div>
                        <div className="text-2xl font-bold">{clusterInfo.total_producers.toLocaleString()}</div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass p-4 rounded-xl"
                    >
                        <div className="text-sm text-muted-foreground">Consumers</div>
                        <div className="text-2xl font-bold">{clusterInfo.total_consumers.toLocaleString()}</div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass p-4 rounded-xl"
                    >
                        <div className="text-sm text-muted-foreground">Total Msg Rate</div>
                        <div className="text-2xl font-bold">{formatRate(clusterInfo.total_msg_rate_in + clusterInfo.total_msg_rate_out)}</div>
                    </motion.div>
                </div>
            )}

            {/* Broker Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="glass h-64 rounded-2xl animate-pulse" />
                    ))
                ) : brokers?.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        No brokers found. Make sure the cluster is running.
                    </div>
                ) : (
                    brokers?.map((broker, index) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            key={broker.url}
                            className="glass p-6 rounded-2xl"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-primary/10 rounded-xl">
                                        <Server size={24} className="text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{broker.url}</h3>
                                        <div className="text-sm text-muted-foreground">
                                            {broker.topics_count} topics • {broker.bundles_count} bundles
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                        <Activity size={14} />
                                        Messages In
                                    </div>
                                    <div className="font-bold">{formatRate(broker.msg_rate_in)}</div>
                                    <div className="text-xs text-muted-foreground">{formatBytes(broker.msg_throughput_in)}</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                        <Activity size={14} />
                                        Messages Out
                                    </div>
                                    <div className="font-bold">{formatRate(broker.msg_rate_out)}</div>
                                    <div className="text-xs text-muted-foreground">{formatBytes(broker.msg_throughput_out)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                                        <Cpu size={14} />
                                        CPU
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${broker.cpu_usage > 80 ? 'bg-red-500' : broker.cpu_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                            style={{ width: `${Math.min(broker.cpu_usage, 100)}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">{broker.cpu_usage.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                                        <HardDrive size={14} />
                                        Memory
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${broker.memory_usage > 80 ? 'bg-red-500' : broker.memory_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                            style={{ width: `${Math.min(broker.memory_usage, 100)}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">{broker.memory_usage.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                                        <HardDrive size={14} />
                                        Direct Mem
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${broker.direct_memory_usage > 80 ? 'bg-red-500' : broker.direct_memory_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                            style={{ width: `${Math.min(broker.direct_memory_usage, 100)}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">{broker.direct_memory_usage.toFixed(1)}%</div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between text-sm text-muted-foreground">
                                <span>{broker.producers_count} producers</span>
                                <span>{broker.consumers_count} consumers</span>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
