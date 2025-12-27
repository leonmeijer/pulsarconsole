import { motion } from "framer-motion";
import { RefreshCcw, Download, Search, Filter, Clock, User, Activity, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useAuditEvents } from "@/api/hooks";
import type { AuditEvent } from "@/api/types";
import { cn } from "@/lib/utils";

const RESOURCE_TYPES = ["all", "tenant", "namespace", "topic", "subscription", "broker"];
const ACTIONS = ["all", "create", "delete", "update", "read", "publish", "consume"];

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function getStatusIcon(action: string) {
    if (action.includes("delete") || action.includes("error") || action.includes("fail")) {
        return <XCircle size={16} className="text-red-400" />;
    }
    if (action.includes("create") || action.includes("success")) {
        return <CheckCircle size={16} className="text-green-400" />;
    }
    return <AlertCircle size={16} className="text-yellow-400" />;
}

function getActionColor(action: string): string {
    if (action.includes("delete")) return "bg-red-500/10 text-red-400 border-red-500/20";
    if (action.includes("create")) return "bg-green-500/10 text-green-400 border-green-500/20";
    if (action.includes("update")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    return "bg-gray-500/10 text-gray-400 border-gray-500/20";
}

function exportToCSV(events: AuditEvent[], filename: string) {
    const headers = ["Timestamp", "Action", "Resource Type", "Resource ID", "User", "IP Address", "Details"];
    const rows = events.map(event => [
        event.timestamp,
        event.action,
        event.resource_type,
        event.resource_id,
        event.user_email || event.user_id || "System",
        event.ip_address || "N/A",
        event.details ? JSON.stringify(event.details) : ""
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function exportToJSON(events: AuditEvent[], filename: string) {
    const jsonContent = JSON.stringify(events, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

export default function AuditLogsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [resourceType, setResourceType] = useState("all");
    const [actionFilter, setActionFilter] = useState("all");
    const [showFilters, setShowFilters] = useState(false);

    const filters = useMemo(() => {
        const f: Record<string, string> = {};
        if (resourceType !== "all") f.resource_type = resourceType;
        if (actionFilter !== "all") f.action = actionFilter;
        return Object.keys(f).length > 0 ? f : undefined;
    }, [resourceType, actionFilter]);

    const { data: events, isLoading, refetch } = useAuditEvents(filters);

    const filteredEvents = useMemo(() => {
        if (!events) return [];
        if (!searchQuery.trim()) return events;

        const query = searchQuery.toLowerCase();
        return events.filter(event =>
            event.resource_id.toLowerCase().includes(query) ||
            event.action.toLowerCase().includes(query) ||
            event.resource_type.toLowerCase().includes(query) ||
            (event.user_email?.toLowerCase().includes(query)) ||
            (event.user_id?.toLowerCase().includes(query))
        );
    }, [events, searchQuery]);

    const handleExport = (format: "csv" | "json") => {
        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `audit-logs-${timestamp}.${format}`;

        if (format === "csv") {
            exportToCSV(filteredEvents, filename);
        } else {
            exportToJSON(filteredEvents, filename);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Audit Logs</h1>
                    <p className="text-muted-foreground mt-1">
                        Track all actions and changes in your Pulsar cluster.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => refetch()}
                        className="p-3 glass rounded-xl hover:bg-white/10 transition-all active:scale-95"
                    >
                        <RefreshCcw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <div className="relative group">
                        <button className="flex items-center gap-2 px-4 py-3 glass rounded-xl hover:bg-white/10 transition-all">
                            <Download size={20} />
                            Export
                        </button>
                        <div className="absolute right-0 mt-2 w-40 glass rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <button
                                onClick={() => handleExport("csv")}
                                className="w-full px-4 py-2 text-left hover:bg-white/10 rounded-t-xl transition-colors"
                            >
                                Export as CSV
                            </button>
                            <button
                                onClick={() => handleExport("json")}
                                className="w-full px-4 py-2 text-left hover:bg-white/10 rounded-b-xl transition-colors"
                            >
                                Export as JSON
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="glass p-4 rounded-2xl space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by resource, action, or user..."
                            className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-3 rounded-xl transition-all",
                            showFilters ? "bg-primary text-white" : "glass hover:bg-white/10"
                        )}
                    >
                        <Filter size={18} />
                        Filters
                    </button>
                </div>

                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-4 pt-4 border-t border-white/10"
                    >
                        <div className="flex-1">
                            <label className="block text-sm text-muted-foreground mb-2">Resource Type</label>
                            <select
                                value={resourceType}
                                onChange={(e) => setResourceType(e.target.value)}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                            >
                                {RESOURCE_TYPES.map(type => (
                                    <option key={type} value={type} className="bg-gray-900">
                                        {type === "all" ? "All Resources" : type.charAt(0).toUpperCase() + type.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm text-muted-foreground mb-2">Action</label>
                            <select
                                value={actionFilter}
                                onChange={(e) => setActionFilter(e.target.value)}
                                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
                            >
                                {ACTIONS.map(action => (
                                    <option key={action} value={action} className="bg-gray-900">
                                        {action === "all" ? "All Actions" : action.charAt(0).toUpperCase() + action.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Activity size={20} className="text-primary" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{filteredEvents.length}</div>
                            <div className="text-sm text-muted-foreground">Total Events</div>
                        </div>
                    </div>
                </div>
                <div className="glass p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <CheckCircle size={20} className="text-green-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">
                                {filteredEvents.filter(e => e.action.includes("create")).length}
                            </div>
                            <div className="text-sm text-muted-foreground">Creates</div>
                        </div>
                    </div>
                </div>
                <div className="glass p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Activity size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">
                                {filteredEvents.filter(e => e.action.includes("update")).length}
                            </div>
                            <div className="text-sm text-muted-foreground">Updates</div>
                        </div>
                    </div>
                </div>
                <div className="glass p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <XCircle size={20} className="text-red-400" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">
                                {filteredEvents.filter(e => e.action.includes("delete")).length}
                            </div>
                            <div className="text-sm text-muted-foreground">Deletes</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Event List */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">Timestamp</th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">Action</th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">Resource</th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">User</th>
                                <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">IP Address</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-white/5">
                                        <td colSpan={5} className="px-6 py-4">
                                            <div className="h-6 bg-white/5 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                        No audit events found
                                    </td>
                                </tr>
                            ) : (
                                filteredEvents.map((event, index) => (
                                    <motion.tr
                                        key={event.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.02 }}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock size={14} className="text-muted-foreground" />
                                                {formatTimestamp(event.timestamp)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(event.action)}
                                                <span className={cn(
                                                    "px-2 py-1 text-xs font-medium rounded border",
                                                    getActionColor(event.action)
                                                )}>
                                                    {event.action}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-sm font-medium">{event.resource_id}</div>
                                                <div className="text-xs text-muted-foreground">{event.resource_type}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <User size={14} className="text-muted-foreground" />
                                                {event.user_email || event.user_id || "System"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {event.ip_address || "N/A"}
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
