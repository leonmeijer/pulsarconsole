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
    // RBAC hooks
    useCurrentUser,
    useSessions,
    useRevokeSession,
    useRoles,
    useCreateRole,
    useUpdateRole,
    useDeleteRole,
    usePermissions,
    useUsers,
    useAssignUserRole,
    useRevokeUserRole,
    useCheckPermission,
    useApiTokens,
    useTokenStats,
    useCreateApiToken,
    useRevokeApiToken,
    usePulsarTokenCapability,
    useGeneratePulsarToken,
} from './hooks';
import {
    mockTenants,
    mockNamespaces,
    mockTopics,
    mockBrokers,
    mockEnvironment,
    mockCurrentUser,
    mockSessions,
    mockRoles,
    mockPermissions,
    mockUsers,
    mockApiTokens,
    mockTokenStats,
} from '@/test/mocks/handlers';

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

// =============================================================================
// RBAC Hooks Tests
// =============================================================================

describe('Auth Hooks', () => {
    describe('useCurrentUser', () => {
        it('fetches current user', async () => {
            const { result } = renderHook(() => useCurrentUser(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.email).toBe(mockCurrentUser.email);
            expect(result.current.data?.display_name).toBe(mockCurrentUser.display_name);
        });
    });

    describe('useSessions', () => {
        it('fetches user sessions', async () => {
            const { result } = renderHook(() => useSessions(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(mockSessions.length);
            expect(result.current.data?.[0].is_current).toBe(true);
        });
    });

    describe('useRevokeSession', () => {
        it('revokes session successfully', async () => {
            const { result } = renderHook(() => useRevokeSession(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync('session-2');
            expect(response.success).toBe(true);
        });
    });
});

describe('RBAC Hooks', () => {
    describe('useRoles', () => {
        it('fetches roles', async () => {
            const { result } = renderHook(() => useRoles(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(mockRoles.length);
            expect(result.current.data?.[0].name).toBe('admin');
        });
    });

    describe('useCreateRole', () => {
        it('creates role successfully', async () => {
            const { result } = renderHook(() => useCreateRole(), {
                wrapper: createWrapper(),
            });

            const newRole = await result.current.mutateAsync({
                name: 'custom-role',
                description: 'Custom role for testing',
            });

            expect(newRole.name).toBe('custom-role');
            expect(newRole.is_system).toBe(false);
        });
    });

    describe('useUpdateRole', () => {
        it('updates role successfully', async () => {
            const { result } = renderHook(() => useUpdateRole(), {
                wrapper: createWrapper(),
            });

            const updatedRole = await result.current.mutateAsync({
                id: 'role-2',
                name: 'updated-developer',
                description: 'Updated description',
            });

            expect(updatedRole.name).toBe('updated-developer');
        });
    });

    describe('useDeleteRole', () => {
        it('deletes role successfully', async () => {
            const { result } = renderHook(() => useDeleteRole(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync('role-2');
            expect(response.success).toBe(true);
        });
    });

    describe('usePermissions', () => {
        it('fetches all permissions', async () => {
            const { result } = renderHook(() => usePermissions(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(mockPermissions.length);
            expect(result.current.data?.[0].action).toBe('read');
        });
    });

    describe('useUsers', () => {
        it('fetches users with roles', async () => {
            const { result } = renderHook(() => useUsers(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(mockUsers.length);
            expect(result.current.data?.[0].roles).toBeDefined();
        });
    });

    describe('useAssignUserRole', () => {
        it('assigns role to user', async () => {
            const { result } = renderHook(() => useAssignUserRole(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync({
                userId: 'user-1',
                roleId: 'role-1',
            });

            expect(response.success).toBe(true);
        });
    });

    describe('useRevokeUserRole', () => {
        it('revokes role from user', async () => {
            const { result } = renderHook(() => useRevokeUserRole(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync({
                userId: 'user-1',
                roleId: 'role-2',
            });

            expect(response.success).toBe(true);
        });
    });

    describe('useCheckPermission', () => {
        it('checks permission and returns result', async () => {
            const { result } = renderHook(() => useCheckPermission(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync({
                action: 'read',
                resource_level: 'cluster',
            });

            expect(response.allowed).toBe(true);
        });

        it('returns false for unauthorized action', async () => {
            const { result } = renderHook(() => useCheckPermission(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync({
                action: 'admin',
                resource_level: 'cluster',
            });

            expect(response.allowed).toBe(false);
        });
    });
});

describe('Token Hooks', () => {
    describe('useApiTokens', () => {
        it('fetches API tokens', async () => {
            const { result } = renderHook(() => useApiTokens(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toHaveLength(mockApiTokens.length);
            expect(result.current.data?.[0].name).toBe('CI/CD Token');
        });
    });

    describe('useTokenStats', () => {
        it('fetches token statistics', async () => {
            const { result } = renderHook(() => useTokenStats(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.total).toBe(mockTokenStats.total);
            expect(result.current.data?.active).toBe(mockTokenStats.active);
        });
    });

    describe('useCreateApiToken', () => {
        it('creates API token', async () => {
            const { result } = renderHook(() => useCreateApiToken(), {
                wrapper: createWrapper(),
            });

            const newToken = await result.current.mutateAsync({
                name: 'New Token',
                scopes: ['read', 'write'],
            });

            expect(newToken.name).toBe('New Token');
            expect(newToken.token).toBeDefined();
            expect(newToken.token_prefix).toBeDefined();
        });
    });

    describe('useRevokeApiToken', () => {
        it('revokes API token', async () => {
            const { result } = renderHook(() => useRevokeApiToken(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync('token-1');
            expect(response.success).toBe(true);
        });
    });

    describe('usePulsarTokenCapability', () => {
        it('checks Pulsar token generation capability', async () => {
            const { result } = renderHook(() => usePulsarTokenCapability(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.can_generate).toBe(true);
        });
    });

    describe('useGeneratePulsarToken', () => {
        it('generates Pulsar JWT token', async () => {
            const { result } = renderHook(() => useGeneratePulsarToken(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync({
                subject: 'my-service',
                expires_in_days: 30,
            });

            expect(response.token).toBeDefined();
            expect(response.subject).toBe('my-service');
            expect(response.expires_at).toBeDefined();
        });

        it('generates token without expiration', async () => {
            const { result } = renderHook(() => useGeneratePulsarToken(), {
                wrapper: createWrapper(),
            });

            const response = await result.current.mutateAsync({
                subject: 'permanent-service',
            });

            expect(response.token).toBeDefined();
            expect(response.subject).toBe('permanent-service');
        });
    });
});
