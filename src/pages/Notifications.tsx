import { useState } from "react";
import { Link } from "react-router-dom";
import {
    Bell,
    AlertTriangle,
    AlertCircle,
    Info,
    Server,
    Users,
    HardDrive,
    Check,
    CheckCheck,
    X,
    Trash2,
    Filter,
    RefreshCw,
} from "lucide-react";
import {
    useNotifications,
    useMarkNotificationRead,
    useMarkAllNotificationsRead,
    useDismissNotification,
    useDismissAllNotifications,
} from "@/api/hooks";
import type { PulsarNotification, NotificationType, NotificationSeverity } from "@/api/types";
import { formatDistanceToNow, format } from "date-fns";

function getSeverityIcon(severity: NotificationSeverity, size: "sm" | "md" = "md") {
    const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";
    switch (severity) {
        case "critical":
            return <AlertCircle className={`${sizeClass} text-destructive`} />;
        case "warning":
            return <AlertTriangle className={`${sizeClass} text-yellow-500`} />;
        default:
            return <Info className={`${sizeClass} text-blue-500`} />;
    }
}

function getTypeIcon(type: NotificationType) {
    switch (type) {
        case "consumer_disconnect":
            return <Users className="w-5 h-5" />;
        case "broker_health":
            return <Server className="w-5 h-5" />;
        case "storage_warning":
            return <HardDrive className="w-5 h-5" />;
        default:
            return <Bell className="w-5 h-5" />;
    }
}

function getSeverityBg(severity: NotificationSeverity) {
    switch (severity) {
        case "critical":
            return "bg-destructive/10 border-destructive/30";
        case "warning":
            return "bg-yellow-500/10 border-yellow-500/30";
        default:
            return "bg-blue-500/10 border-blue-500/30";
    }
}

function getSeverityLabel(severity: NotificationSeverity) {
    switch (severity) {
        case "critical":
            return "Critical";
        case "warning":
            return "Warning";
        default:
            return "Info";
    }
}

function getTypeLabel(type: NotificationType) {
    switch (type) {
        case "consumer_disconnect":
            return "Consumer Disconnect";
        case "broker_health":
            return "Broker Health";
        case "storage_warning":
            return "Storage Warning";
        case "backlog_warning":
            return "Backlog Warning";
        default:
            return type;
    }
}

function getResourceLink(notification: PulsarNotification): string | null {
    if (!notification.resource_type || !notification.resource_id) return null;

    const parts = notification.resource_id.split("/");

    switch (notification.resource_type) {
        case "subscription":
            // Format: topic/subscription or persistent://tenant/namespace/topic/subscription
            if (parts.length >= 2) {
                const subName = parts[parts.length - 1];
                const topic = parts.slice(0, -1).join("/");
                // Parse topic parts
                const topicMatch = topic.match(/^(?:persistent|non-persistent):\/\/([^/]+)\/([^/]+)\/(.+)$/);
                if (topicMatch) {
                    const [, tenant, namespace, topicName] = topicMatch;
                    return `/tenants/${tenant}/namespaces/${namespace}/topics/${topicName}/subscription/${subName}`;
                }
            }
            return null;
        case "topic":
            const topicMatch = notification.resource_id.match(/^(?:persistent|non-persistent):\/\/([^/]+)\/([^/]+)\/(.+)$/);
            if (topicMatch) {
                const [, tenant, namespace, topicName] = topicMatch;
                return `/tenants/${tenant}/namespaces/${namespace}/topics/${topicName}`;
            }
            return null;
        case "broker":
            return `/brokers`;
        default:
            return null;
    }
}

export default function NotificationsPage() {
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const [showRead, setShowRead] = useState(true);

    const { data, isLoading, refetch } = useNotifications({
        type: typeFilter !== "all" ? typeFilter : undefined,
        severity: severityFilter !== "all" ? severityFilter : undefined,
        is_read: showRead ? undefined : false,
        limit: 100,
    });

    const markRead = useMarkNotificationRead();
    const markAllRead = useMarkAllNotificationsRead();
    const dismiss = useDismissNotification();
    const dismissAll = useDismissAllNotifications();

    const notifications = data?.notifications || [];
    const unreadCount = data?.unread_count || 0;

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <Bell className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Notifications</h1>
                        <p className="text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetch()}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    {unreadCount > 0 && (
                        <button
                            onClick={() => markAllRead.mutate()}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <CheckCheck className="w-4 h-4" />
                            Mark All Read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            onClick={() => {
                                if (confirm("Are you sure you want to dismiss all notifications?")) {
                                    dismissAll.mutate();
                                }
                            }}
                            className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Dismiss All
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                <Filter className="w-5 h-5 text-muted-foreground" />
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Type:</label>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                        <option value="all">All Types</option>
                        <option value="consumer_disconnect">Consumer Disconnect</option>
                        <option value="broker_health">Broker Health</option>
                        <option value="storage_warning">Storage Warning</option>
                        <option value="backlog_warning">Backlog Warning</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Severity:</label>
                    <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary outline-none"
                    >
                        <option value="all">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="warning">Warning</option>
                        <option value="info">Info</option>
                    </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showRead}
                        onChange={(e) => setShowRead(e.target.checked)}
                        className="rounded border-white/20 bg-white/5"
                    />
                    <span className="text-sm text-muted-foreground">Show read</span>
                </label>
            </div>

            {/* Notification List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : notifications.length === 0 ? (
                <div className="text-center py-20 bg-white/5 border border-white/10 rounded-xl">
                    <Bell className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No notifications</h3>
                    <p className="text-muted-foreground">
                        {typeFilter !== "all" || severityFilter !== "all" || !showRead
                            ? "Try adjusting your filters"
                            : "You're all caught up!"}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notification) => {
                        const resourceLink = getResourceLink(notification);
                        const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                        });
                        const fullDate = format(new Date(notification.created_at), "PPpp");

                        return (
                            <div
                                key={notification.id}
                                className={`p-4 border rounded-xl transition-colors ${
                                    !notification.is_read
                                        ? "bg-white/[0.03] border-white/15"
                                        : "bg-white/[0.01] border-white/10"
                                } hover:bg-white/5`}
                            >
                                <div className="flex items-start gap-4">
                                    <div
                                        className={`p-3 rounded-xl border ${getSeverityBg(
                                            notification.severity
                                        )}`}
                                    >
                                        {getTypeIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            {getSeverityIcon(notification.severity, "sm")}
                                            <h3 className="font-semibold">{notification.title}</h3>
                                            {!notification.is_read && (
                                                <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                                                    New
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground mb-3">
                                            {notification.message}
                                        </p>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="px-2 py-1 bg-white/5 rounded text-xs">
                                                {getTypeLabel(notification.type)}
                                            </span>
                                            <span
                                                className={`px-2 py-1 rounded text-xs ${
                                                    notification.severity === "critical"
                                                        ? "bg-destructive/20 text-destructive"
                                                        : notification.severity === "warning"
                                                        ? "bg-yellow-500/20 text-yellow-500"
                                                        : "bg-blue-500/20 text-blue-500"
                                                }`}
                                            >
                                                {getSeverityLabel(notification.severity)}
                                            </span>
                                            <span
                                                className="text-muted-foreground"
                                                title={fullDate}
                                            >
                                                {timeAgo}
                                            </span>
                                            {resourceLink && (
                                                <Link
                                                    to={resourceLink}
                                                    className="text-primary hover:underline"
                                                >
                                                    View Resource
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!notification.is_read && (
                                            <button
                                                onClick={() => markRead.mutate(notification.id)}
                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                title="Mark as read"
                                            >
                                                <Check className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => dismiss.mutate(notification.id)}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                            title="Dismiss"
                                        >
                                            <X className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
