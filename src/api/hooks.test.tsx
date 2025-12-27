import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import {
    useTenants,
    useTenant,
    useCreateTenant,
    useDeleteTenant,
    useNamespaces,
    useTopics,
    useBrokers,
    useEnvironment,
    useClusterInfo,
    useDashboardStats,
    useHealthStatus,
    useTopTenants,
    queryKeys,
} from './hooks';
import { mockTenants, mockNamespaces, mockTopics, mockBrokers, mockEnvironment } from '@/test/mocks/handlers';

// Create wrapper with QueryClient
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

describe('API Hooks', () => {
    describe('useTenants', () => {
        it('fetches tenants successfully', async () => {
            const { result } = renderHook(() => useTenants(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(mockTenants.length);
            expect(result.current.data?.[0].name).toBe('public');
        });

        it('returns loading state initially', () => {
            const { result } = renderHook(() => useTenants(), {
                wrapper: createWrapper(),
            });

            expect(result.current.isLoading).toBe(true);
        });
    });

    describe('useTenant', () => {
        it('fetches single tenant by name', async () => {
            const { result } = renderHook(() => useTenant('public'), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.name).toBe('public');
            expect(result.current.data?.namespaces).toBeDefined();
        });

        it('does not fetch when name is empty', () => {
            const { result } = renderHook(() => useTenant(''), {
                wrapper: createWrapper(),
            });

            expect(result.current.fetchStatus).toBe('idle');
        });
    });

    describe('useCreateTenant', () => {
        it('creates tenant successfully', async () => {
            const { result } = renderHook(() => useCreateTenant(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.mutateAsync).toBeDefined();
            });

            const newTenant = await result.current.mutateAsync({
                name: 'new-tenant',
            });

            expect(newTenant.name).toBe('new-tenant');
        });
    });

    describe('useDeleteTenant', () => {
        it('deletes tenant successfully', async () => {
            const { result } = renderHook(() => useDeleteTenant(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync('public');
            expect(response.success).toBe(true);
        });
    });

    describe('useNamespaces', () => {
        it('fetches namespaces for tenant', async () => {
            const { result } = renderHook(() => useNamespaces('public'), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(mockNamespaces.length);
        });

        it('does not fetch when tenant is empty', () => {
            const { result } = renderHook(() => useNamespaces(''), {
                wrapper: createWrapper(),
            });

            expect(result.current.fetchStatus).toBe('idle');
        });
    });

    describe('useTopics', () => {
        it('fetches topics for namespace', async () => {
            const { result } = renderHook(
                () => useTopics('public', 'default'),
                { wrapper: createWrapper() }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(mockTopics.length);
        });
    });

    describe('useBrokers', () => {
        it('fetches brokers successfully', async () => {
            const { result } = renderHook(() => useBrokers(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(mockBrokers.length);
            expect(result.current.data?.[0].url).toBe('localhost:8080');
        });
    });

    describe('useEnvironment', () => {
        it('fetches environment configuration', async () => {
            const { result } = renderHook(() => useEnvironment(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.name).toBe(mockEnvironment.name);
            expect(result.current.data?.admin_url).toBe(mockEnvironment.admin_url);
        });
    });

    describe('useClusterInfo', () => {
        it('fetches cluster information', async () => {
            const { result } = renderHook(() => useClusterInfo(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.clusters).toContain('standalone');
            expect(result.current.data?.broker_count).toBe(mockBrokers.length);
        });
    });

    describe('useDashboardStats', () => {
        it('aggregates dashboard statistics', async () => {
            const { result } = renderHook(() => useDashboardStats(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.tenants).toBe(mockTenants.length);
            expect(result.current.data?.brokers).toBe(mockBrokers.length);
        });
    });

    describe('useHealthStatus', () => {
        it('returns health status', async () => {
            const { result } = renderHook(() => useHealthStatus(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.overall).toBe('healthy');
            expect(result.current.data?.pulsar_connection).toBe(true);
        });
    });

    describe('useTopTenants', () => {
        it('returns top tenants by throughput', async () => {
            const { result } = renderHook(() => useTopTenants(5), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.length).toBeLessThanOrEqual(5);
        });
    });
});

describe('Query Keys', () => {
    it('generates correct tenant query key', () => {
        expect(queryKeys.tenant('public')).toEqual(['tenants', 'public']);
    });

    it('generates correct namespace query key', () => {
        expect(queryKeys.namespace('public', 'default')).toEqual([
            'namespaces',
            'public',
            'default',
        ]);
    });

    it('generates correct topic query key', () => {
        expect(queryKeys.topic('public', 'default', 'my-topic')).toEqual([
            'topics',
            'public',
            'default',
            'my-topic',
        ]);
    });

    it('generates correct subscription query key', () => {
        expect(queryKeys.subscription('public', 'default', 'my-topic', 'sub-1')).toEqual([
            'subscriptions',
            'public',
            'default',
            'my-topic',
            'sub-1',
        ]);
    });

    it('generates correct broker query key', () => {
        expect(queryKeys.broker('localhost:8080')).toEqual([
            'brokers',
            'localhost:8080',
        ]);
    });

    it('generates dashboard stats query key', () => {
        expect(queryKeys.dashboardStats).toEqual(['dashboard', 'stats']);
    });

    it('generates health status query key', () => {
        expect(queryKeys.healthStatus).toEqual(['dashboard', 'health']);
    });
});
