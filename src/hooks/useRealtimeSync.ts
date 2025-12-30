import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getStoredAccessToken, useAuth } from '@/context/AuthContext';
import { queryKeys } from '@/api/hooks';

/**
 * Hook to manage a single WebSocket connection for real-time updates.
 * Invalidates TanStack Query caches based on incoming events.
 */
export function useRealtimeSync() {
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            if (socketRef.current) {
                socketRef.current.close();
            }
            return;
        }

        const connect = () => {
            const token = getStoredAccessToken();
            if (!token) return;

            // Use wss:// if on https, otherwise ws://
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Use current host, assuming the API is on the same host (proxied)
            // or use VITE_API_URL if configured for direct access
            const host = window.location.host;
            const wsUrl = `${protocol}//${host}/api/v1/ws?token=${token}`;

            console.log('Connecting to WebSocket...', wsUrl);
            const socket = new WebSocket(wsUrl);
            socketRef.current = socket;

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Real-time event received:', data);

                    handleEvent(data);
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            socket.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                socketRef.current = null;
                
                // Don't reconnect if closed normally or if authentication failed
                if (event.code !== 1000 && event.code !== 4001) {
                    reconnectTimeoutRef.current = setTimeout(connect, 5000);
                }
            };

            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                socket.close();
            };
        };

        const handleEvent = (event: any) => {
            const { type, data } = event;

            switch (type) {
                case 'TENANTS_UPDATED':
                    queryClient.invalidateQueries({ queryKey: queryKeys.tenants });
                    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
                    if (data?.tenant) {
                        queryClient.invalidateQueries({ queryKey: queryKeys.tenant(data.tenant) });
                    }
                    break;
                case 'NAMESPACES_UPDATED':
                    if (data?.tenant) {
                        queryClient.invalidateQueries({ queryKey: queryKeys.namespaces(data.tenant) });
                    } else {
                        // Invalidate all namespaces
                        queryClient.invalidateQueries({ queryKey: ['namespaces'] });
                    }
                    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
                    break;
                case 'TOPICS_UPDATED':
                    if (data?.tenant && data?.namespace) {
                        queryClient.invalidateQueries({ queryKey: queryKeys.topics(data.tenant, data.namespace) });
                        if (data?.topic) {
                            queryClient.invalidateQueries({ queryKey: queryKeys.topic(data.tenant, data.namespace, data.topic) });
                        }
                    } else {
                        // Invalidate all topics
                        queryClient.invalidateQueries({ queryKey: ['topics'] });
                    }
                    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
                    break;
                case 'AUDIT_LOGS_UPDATED':
                    queryClient.invalidateQueries({ queryKey: ['audit'] });
                    break;
                case 'NOTIFICATIONS_UPDATED':
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    break;
                case 'BROKERS_UPDATED':
                    queryClient.invalidateQueries({ queryKey: queryKeys.brokers });
                    break;
                case 'ERROR':
                    console.error('WebSocket error event:', data?.message);
                    break;
                default:
                    console.warn('Unknown real-time event type:', type);
            }
        };

        connect();

        return () => {
            if (socketRef.current) {
                const socket = socketRef.current;
                socketRef.current = null;
                // Only close if it's not already closing or closed
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close(1000, 'Component unmounting');
                }
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [isAuthenticated, queryClient]);
}
