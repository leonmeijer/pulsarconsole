import { useState, useRef, useEffect } from "react";
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
    ExternalLink,
} from "lucide-react";
import {
    useNotifications,
    useNotificationCount,
    useMarkNotificationRead,
    useMarkAllNotificationsRead,
    useDismissNotification,
} from "@/api/hooks";
import { Notification, NotificationType, NotificationSeverity } from "@/api/types";
import { formatDistanceToNow } from "date-fns";

function getSeverityIcon(severity: NotificationSeverity) {
    switch (severity) {
        case "critical":
            return <AlertCircle className="w-4 h-4 text-destructive" />;
        case "warning":
            return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
        default:
            return <Info className="w-4 h-4 text-blue-500" />;
    }
}

function getTypeIcon(type: NotificationType) {
    switch (type) {
        case "consumer_disconnect":
            return <Users className="w-4 h-4" />;
        case "broker_health":
            return <Server className="w-4 h-4" />;
        case "storage_warning":
            return <HardDrive className="w-4 h-4" />;
        default:
            return <Bell className="w-4 h-4" />;
    }
}

function getSeverityBg(severity: NotificationSeverity) {
    switch (severity) {
        case "critical":
            return "bg-destructive/10 border-destructive/20";
        case "warning":
            return "bg-yellow-500/10 border-yellow-500/20";
        default:
            return "bg-blue-500/10 border-blue-500/20";
    }
}

interface NotificationItemProps {
    notification: Notification;
    onMarkRead: (id: string) => void;
    onDismiss: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead, onDismiss }: NotificationItemProps) {
    const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

    return (
        <div
            className={`p-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                !notification.is_read ? "bg-white/[0.02]" : ""
            }`}
        >
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getSeverityBg(notification.severity)}`}>
                    {getTypeIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {getSeverityIcon(notification.severity)}
                        <span className="font-medium text-sm truncate">{notification.title}</span>
                        {!notification.is_read && (
                            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">{timeAgo}</span>
                        <div className="flex items-center gap-1">
                            {!notification.is_read && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMarkRead(notification.id);
                                    }}
                                    className="p-1 hover:bg-white/10 rounded transition-colors"
                                    title="Mark as read"
                                >
                                    <Check className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDismiss(notification.id);
                                }}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Dismiss"
                            >
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function NotificationDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { data: notifications } = useNotifications({ limit: 10 });
    const { data: unreadCount = 0 } = useNotificationCount();
    const markRead = useMarkNotificationRead();
    const markAllRead = useMarkAllNotificationsRead();
    const dismiss = useDismissNotification();

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMarkRead = (id: string) => {
        markRead.mutate(id);
    };

    const handleMarkAllRead = () => {
        markAllRead.mutate();
    };

    const handleDismiss = (id: string) => {
        dismiss.mutate(id);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2.5 rounded-full hover:bg-white/5 relative group transition-all active:scale-95"
            >
                <Bell
                    size={20}
                    className="text-muted-foreground group-hover:text-foreground transition-colors"
                />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-destructive rounded-full border-2 border-background flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-popover border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications?.notifications && notifications.notifications.length > 0 ? (
                            notifications.notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={handleMarkRead}
                                    onDismiss={handleDismiss}
                                />
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground text-sm">No notifications</p>
                                <p className="text-muted-foreground/60 text-xs mt-1">
                                    You're all caught up!
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-white/10 bg-white/[0.02]">
                        <Link
                            to="/notifications"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            View all notifications
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
