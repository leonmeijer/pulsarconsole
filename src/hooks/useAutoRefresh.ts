import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface UseAutoRefreshOptions {
    enabled?: boolean;
    interval?: number;
    queryKeys?: ReadonlyArray<readonly unknown[]>;
    onRefresh?: () => void;
}

export function useAutoRefresh({
    enabled = true,
    interval = 30000,
    queryKeys = [],
    onRefresh,
}: UseAutoRefreshOptions = {}) {
    const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(enabled);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(interval / 1000);
    const queryClient = useQueryClient();
    const intervalRef = useRef<number | null>(null);
    const countdownRef = useRef<number | null>(null);
    const queryKeysRef = useRef(queryKeys);
    useEffect(() => {
        queryKeysRef.current = queryKeys;
    }, [queryKeys]);

    const refresh = useCallback(() => {
        queryKeysRef.current.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
        });
        setLastRefresh(new Date());
        setSecondsUntilRefresh(interval / 1000);
        onRefresh?.();
    }, [queryClient, interval, onRefresh]);

    const toggleAutoRefresh = useCallback(() => {
        setIsAutoRefreshEnabled((prev) => !prev);
    }, []);

    useEffect(() => {
        if (!isAutoRefreshEnabled) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            return;
        }

        intervalRef.current = window.setInterval(() => {
            refresh();
        }, interval);

        countdownRef.current = window.setInterval(() => {
            setSecondsUntilRefresh((prev) => {
                if (prev <= 1) return interval / 1000;
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [isAutoRefreshEnabled, interval, refresh]);

    return {
        isAutoRefreshEnabled,
        toggleAutoRefresh,
        refresh,
        lastRefresh,
        secondsUntilRefresh,
    };
}

export function formatLastRefresh(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 2) return "Just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    return date.toLocaleTimeString();
}
