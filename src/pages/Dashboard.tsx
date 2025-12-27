import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
    Activity,
    Building2,
    FileText,
    Server,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCcw,
    Clock,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Zap,
    Database,
    TrendingUp,
    Pause,
    Play,
} from "lucide-react";
import { useDashboardStats, useHealthStatus, useTopTenants, useBrokers, queryKeys } from "@/api/hooks";
import { MetricCard, ChartContainer, TimeSeriesChart, SimpleBarChart } from "@/components/shared";
import { useAutoRefresh, formatLastRefresh } from "@/hooks/useAutoRefresh";
import { cn } from "@/lib/utils";
import { useMemo, useState, useEffect, useRef } from "react";

export default function DashboardPage() {
    const {
        isAutoRefreshEnabled,
        toggleAutoRefresh,
        refresh,
        lastRefresh,
        secondsUntilRefresh,
    } = useAutoRefresh({
        enabled: true,
        interval: 5000, // 5 seconds for real-time metrics
        queryKeys: [
            queryKeys.dashboardStats,
            queryKeys.healthStatus,
            queryKeys.topTenants,
            queryKeys.brokers,
        ],
    });

    const isPaused = !isAutoRefreshEnabled;
    const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats({ paused: isPaused });
    const { data: health, isLoading: healthLoading } = useHealthStatus();
    const { data: topTenants, isLoading: tenantsLoading } = useTopTenants(5);
    const { data: brokers, isLoading: brokersLoading } = useBrokers({ paused: isPaused });

    const formatRate = (rate: number) => {
        if (rate >= 1000000) return `${(rate / 1000000).toFixed(1)}M/s`;
        if (rate >= 1000) return `${(rate / 1000).toFixed(1)}K/s`;
        return `${rate.toFixed(1)}/s`;
    };

    const formatBytes = (bytes: number) => {
        if (bytes >= 1099511627776) return `${(bytes / 1099511627776).toFixed(1)} TB`;
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${bytes} B`;
    };

    const HealthIcon = health?.overall === "healthy"
        ? CheckCircle
        : health?.overall === "degraded"
            ? AlertTriangle
            : XCircle;

    const healthColor = health?.overall === "healthy"
        ? "text-green-500"
        : health?.overall === "degraded"
            ? "text-yellow-500"
            : "text-red-500";

    const healthBgColor = health?.overall === "healthy"
        ? "bg-green-500/10"
        : health?.overall === "degraded"
            ? "bg-yellow-500/10"
            : "bg-red-500/10";

    // Time range options for the chart
    const timeRanges = [
        { label: '1m', seconds: 60, points: 12 },
        { label: '10m', seconds: 600, points: 60 },
        { label: '30m', seconds: 1800, points: 90 },
        { label: '1h', seconds: 3600, points: 120 },
        { label: '4h', seconds: 14400, points: 240 },
        { label: '12h', seconds: 43200, points: 360 },
        { label: '24h', seconds: 86400, points: 480 },
    ];

    const [selectedRange, setSelectedRange] = useState(timeRanges[1]); // Default: 10m

    // Collect real time series data points with timestamps
    const [allTimeSeriesData, setAllTimeSeriesData] = useState<Array<{
        timestamp: number;
        time: string;
        timeShort: string;
        msg_rate_in: number;
        msg_rate_out: number;
    }>>([]);

    const statsRef = useRef<{ msg_rate_in: number; msg_rate_out: number } | null>(null);
    const MAX_DATA_POINTS = 500; // Keep up to 500 data points for longer ranges

    // Keep stats ref updated
    useEffect(() => {
        if (stats) {
            statsRef.current = {
                msg_rate_in: stats.msg_rate_in || 0,
                msg_rate_out: stats.msg_rate_out || 0,
            };
        }
    }, [stats]);

    // Collect data points every 5 seconds using interval
    useEffect(() => {
        const addDataPoint = () => {
            const currentStats = statsRef.current;
            if (!currentStats) return;

            const now = Date.now();
            const date = new Date();
            const newPoint = {
                timestamp: now,
                time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                timeShort: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                msg_rate_in: currentStats.msg_rate_in,
                msg_rate_out: currentStats.msg_rate_out,
            };

            setAllTimeSeriesData(prev => {
                const updated = [...prev, newPoint];
                return updated.slice(-MAX_DATA_POINTS);
            });
        };

        // Add initial point immediately if we have stats
        if (statsRef.current) {
            addDataPoint();
        }

        // Then add a point every 5 seconds
        const interval = setInterval(addDataPoint, 5000);

        return () => clearInterval(interval);
    }, []); // Empty deps - runs once on mount

    // Filter data based on selected time range and format time labels
    const timeSeriesData = useMemo(() => {
        if (allTimeSeriesData.length === 0) return [];

        const now = Date.now();
        const cutoff = now - (selectedRange.seconds * 1000);

        // Filter by time range
        const filtered = allTimeSeriesData.filter(point => point.timestamp >= cutoff);

        // For shorter ranges, show all points; for longer ranges, sample to reduce density
        const maxPoints = selectedRange.points;
        let sampled = filtered;
        if (filtered.length > maxPoints) {
            const step = Math.ceil(filtered.length / maxPoints);
            sampled = filtered.filter((_, index) => index % step === 0 || index === filtered.length - 1);
        }

        // Format time based on selected range
        const useShortTime = selectedRange.seconds > 600; // Use short format for >10min
        return sampled.map(point => ({
            ...point,
            displayTime: useShortTime ? (point.timeShort || point.time.slice(0, 5)) : point.time,
        }));
    }, [allTimeSeriesData, selectedRange]);

    // Broker chart data
    const brokerChartData = useMemo(() => {
        if (!brokers) return [];
        return brokers.slice(0, 5).map((broker) => ({
            name: broker.url.split(':').pop() || broker.url.slice(-8),
            cpu: broker.cpu_usage || 0,
            memory: broker.memory_usage || 0,
        }));
    }, [brokers]);

    const isLoading = statsLoading || healthLoading;

    if (statsError) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="p-4 bg-red-500/10 rounded-full mb-4">
                    <XCircle className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Unable to Load Dashboard</h2>
                <p className="text-muted-foreground mb-4">
                    Please check your connection and environment configuration.
                </p>
                <Link
                    to="/environment"
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                    Configure Environment
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground mt-1">
                        Cluster overview and real-time metrics
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Auto-refresh indicator */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock size={14} />
                        <span>Updated {formatLastRefresh(lastRefresh)}</span>
                        {isAutoRefreshEnabled && (
                            <span className="text-xs">({secondsUntilRefresh}s)</span>
                        )}
                    </div>
                    <button
                        onClick={toggleAutoRefresh}
                        className={cn(
                            "p-2 rounded-lg transition-colors",
                            isAutoRefreshEnabled
                                ? "bg-primary/20 text-primary"
                                : "bg-white/5 text-muted-foreground hover:bg-white/10"
                        )}
                        title={isAutoRefreshEnabled ? "Pause auto-refresh" : "Enable auto-refresh"}
                    >
                        {isAutoRefreshEnabled ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                        onClick={refresh}
                        className="p-3 glass rounded-xl hover:bg-white/10 transition-all active:scale-95"
                        disabled={isLoading}
                    >
                        <RefreshCcw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Health Status */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("glass p-4 rounded-2xl flex items-center gap-4", healthBgColor)}
            >
                <div className={cn("p-3 rounded-xl", healthBgColor)}>
                    <HealthIcon className={cn("w-6 h-6", healthColor)} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className={cn("font-semibold capitalize", healthColor)}>
                            {health?.overall || "Unknown"} Status
                        </span>
                        <span className="text-muted-foreground text-sm">•</span>
                        <span className="text-sm text-muted-foreground">
                            {health?.broker_count || 0} brokers active
                        </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className={health?.pulsar_connection ? "text-green-500" : "text-red-500"}>
                            Pulsar: {health?.pulsar_connection ? "Connected" : "Disconnected"}
                        </span>
                        <span className={health?.database_connection ? "text-green-500" : "text-red-500"}>
                            Database: {health?.database_connection ? "OK" : "Error"}
                        </span>
                        <span className={health?.redis_connection ? "text-green-500" : "text-red-500"}>
                            Cache: {health?.redis_connection ? "OK" : "Error"}
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Tenants"
                    value={stats?.tenants || 0}
                    subtitle={`${stats?.namespaces || 0} namespaces`}
                    icon={Building2}
                    loading={statsLoading}
                />
                <MetricCard
                    title="Topics"
                    value={stats?.topics || 0}
                    subtitle={`${stats?.subscriptions || 0} subscriptions`}
                    icon={FileText}
                    loading={statsLoading}
                />
                <MetricCard
                    title="Producers"
                    value={stats?.producers || 0}
                    icon={ArrowUpRight}
                    variant="success"
                    loading={statsLoading}
                />
                <MetricCard
                    title="Consumers"
                    value={stats?.consumers || 0}
                    icon={ArrowDownRight}
                    variant="default"
                    loading={statsLoading}
                />
            </div>

            {/* Message Rates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Messages In"
                    value={formatRate(stats?.msg_rate_in || 0)}
                    icon={Zap}
                    variant="success"
                    loading={statsLoading}
                />
                <MetricCard
                    title="Messages Out"
                    value={formatRate(stats?.msg_rate_out || 0)}
                    icon={Zap}
                    loading={statsLoading}
                />
                <MetricCard
                    title="Throughput In"
                    value={formatBytes(stats?.throughput_in || 0) + "/s"}
                    icon={TrendingUp}
                    loading={statsLoading}
                />
                <MetricCard
                    title="Backlog"
                    value={(stats?.backlog_size || 0).toLocaleString()}
                    subtitle="messages pending"
                    icon={Database}
                    variant={stats?.backlog_size && stats.backlog_size > 10000 ? "warning" : "default"}
                    loading={statsLoading}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold">Message Rate</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {timeSeriesData.length > 0
                                    ? `${timeSeriesData.length} data points`
                                    : "Waiting for data..."}
                            </p>
                        </div>
                        <div className="flex gap-1">
                            {timeRanges.map((range) => (
                                <button
                                    key={range.label}
                                    onClick={() => setSelectedRange(range)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                                        selectedRange.label === range.label
                                            ? "bg-primary text-white"
                                            : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                                    )}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ width: "100%", height: 280 }}>
                        {timeSeriesData.length >= 2 ? (
                            <TimeSeriesChart
                                data={timeSeriesData}
                                xAxisKey="displayTime"
                                lines={[
                                    { dataKey: "msg_rate_in", name: "In", color: "#22c55e", type: "area" },
                                    { dataKey: "msg_rate_out", name: "Out", color: "#3b82f6", type: "area" },
                                ]}
                                height={280}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>Collecting live data...</p>
                                    <p className="text-sm mt-1">Chart will appear when message traffic is detected</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <ChartContainer
                    title="Broker Resource Usage"
                    subtitle="CPU and Memory utilization"
                    loading={brokersLoading}
                >
                    <SimpleBarChart
                        data={brokerChartData}
                        xAxisKey="name"
                        bars={[
                            { dataKey: "cpu", name: "CPU %", color: "#3b82f6" },
                            { dataKey: "memory", name: "Memory %", color: "#a855f7" },
                        ]}
                        height={280}
                    />
                </ChartContainer>
            </div>

            {/* Top Tenants & Brokers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Tenants */}
                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Top Tenants</h3>
                        <Link
                            to="/tenants"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                            View All
                            <ArrowUpRight size={14} />
                        </Link>
                    </div>
                    {tenantsLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : topTenants?.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No tenants found</p>
                    ) : (
                        <div className="space-y-3">
                            {topTenants?.map((tenant, index) => (
                                <motion.div
                                    key={tenant.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <Link
                                                to={`/tenants/${tenant.name}/namespaces`}
                                                className="font-medium hover:text-primary transition-colors"
                                            >
                                                {tenant.name}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">
                                                {tenant.topic_count} topics
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium">
                                            {formatRate(tenant.msg_rate_in + tenant.msg_rate_out)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {tenant.backlog.toLocaleString()} backlog
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Active Brokers */}
                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Active Brokers</h3>
                        <Link
                            to="/brokers"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                            View All
                            <ArrowUpRight size={14} />
                        </Link>
                    </div>
                    {brokersLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : brokers?.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No brokers found</p>
                    ) : (
                        <div className="space-y-3">
                            {brokers?.slice(0, 5).map((broker, index) => (
                                <motion.div
                                    key={broker.url}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-green-500/10">
                                            <Server size={16} className="text-green-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm truncate max-w-[180px]">
                                                {broker.url}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {broker.topics_count} topics • {broker.bundles_count} bundles
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-muted-foreground">CPU:</span>
                                            <span className={cn(
                                                "font-medium",
                                                broker.cpu_usage > 80 ? "text-red-500" :
                                                    broker.cpu_usage > 60 ? "text-yellow-500" : "text-green-500"
                                            )}>
                                                {broker.cpu_usage?.toFixed(1) || 0}%
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-muted-foreground">Mem:</span>
                                            <span className={cn(
                                                "font-medium",
                                                broker.memory_usage > 80 ? "text-red-500" :
                                                    broker.memory_usage > 60 ? "text-yellow-500" : "text-green-500"
                                            )}>
                                                {broker.memory_usage?.toFixed(1) || 0}%
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link
                        to="/tenants"
                        className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                    >
                        <Building2 size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium">Manage Tenants</span>
                    </Link>
                    <Link
                        to="/brokers"
                        className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                    >
                        <Server size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium">View Brokers</span>
                    </Link>
                    <Link
                        to="/environment"
                        className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                    >
                        <Activity size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium">Environment</span>
                    </Link>
                    <button
                        onClick={refresh}
                        className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                    >
                        <RefreshCcw size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium">Refresh All</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
