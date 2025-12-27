import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAutoRefresh, formatLastRefresh } from './useAutoRefresh';
import React from 'react';

// Create wrapper with QueryClient
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

describe('useAutoRefresh', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('initializes with correct default values', () => {
        const { result } = renderHook(() => useAutoRefresh(), {
            wrapper: createWrapper(),
        });

        expect(result.current.isAutoRefreshEnabled).toBe(true);
        expect(result.current.secondsUntilRefresh).toBe(30);
    });

    it('respects enabled option', () => {
        const { result } = renderHook(
            () => useAutoRefresh({ enabled: false }),
            { wrapper: createWrapper() }
        );

        expect(result.current.isAutoRefreshEnabled).toBe(false);
    });

    it('respects custom interval', () => {
        const { result } = renderHook(
            () => useAutoRefresh({ interval: 60000 }),
            { wrapper: createWrapper() }
        );

        expect(result.current.secondsUntilRefresh).toBe(60);
    });

    it('toggles auto-refresh on and off', () => {
        const { result } = renderHook(() => useAutoRefresh(), {
            wrapper: createWrapper(),
        });

        expect(result.current.isAutoRefreshEnabled).toBe(true);

        act(() => {
            result.current.toggleAutoRefresh();
        });

        expect(result.current.isAutoRefreshEnabled).toBe(false);

        act(() => {
            result.current.toggleAutoRefresh();
        });

        expect(result.current.isAutoRefreshEnabled).toBe(true);
    });

    it('decrements countdown timer', () => {
        const { result } = renderHook(
            () => useAutoRefresh({ interval: 10000 }),
            { wrapper: createWrapper() }
        );

        expect(result.current.secondsUntilRefresh).toBe(10);

        // Advance timers and let React process the state update
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.secondsUntilRefresh).toBe(9);

        // Advance another second
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.secondsUntilRefresh).toBe(8);
    });

    it('calls onRefresh callback when refresh is called', () => {
        const onRefresh = vi.fn();
        const { result } = renderHook(
            () => useAutoRefresh({ onRefresh }),
            { wrapper: createWrapper() }
        );

        act(() => {
            result.current.refresh();
        });

        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('resets countdown after refresh', () => {
        const { result } = renderHook(
            () => useAutoRefresh({ interval: 30000 }),
            { wrapper: createWrapper() }
        );

        act(() => {
            vi.advanceTimersByTime(10000); // 20 seconds left
        });

        act(() => {
            result.current.refresh();
        });

        expect(result.current.secondsUntilRefresh).toBe(30);
    });
});

describe('formatLastRefresh', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns "Just now" for recent times', () => {
        const now = new Date();
        vi.setSystemTime(now);

        const result = formatLastRefresh(now);
        expect(result).toBe('Just now');
    });

    it('returns seconds ago for times less than a minute', () => {
        const now = new Date();
        vi.setSystemTime(now);

        const thirtySecondsAgo = new Date(now.getTime() - 30000);
        const result = formatLastRefresh(thirtySecondsAgo);
        expect(result).toBe('30s ago');
    });

    it('returns minutes ago for times less than an hour', () => {
        const now = new Date();
        vi.setSystemTime(now);

        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const result = formatLastRefresh(fiveMinutesAgo);
        expect(result).toBe('5m ago');
    });

    it('returns formatted time for times over an hour', () => {
        const now = new Date('2024-01-15T10:30:00');
        vi.setSystemTime(now);

        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const result = formatLastRefresh(twoHoursAgo);
        expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
});
