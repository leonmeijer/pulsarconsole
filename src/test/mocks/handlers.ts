import { http, HttpResponse } from 'msw';

// Mock data
export const mockTenants = [
    {
        name: 'public',
        admin_roles: ['admin'],
        allowed_clusters: ['standalone'],
        namespace_count: 3,
        topic_count: 10,
        total_backlog: 1000,
        msg_rate_in: 150.5,
        msg_rate_out: 120.3,
    },
    {
        name: 'sample',
        admin_roles: ['admin'],
        allowed_clusters: ['standalone'],
        namespace_count: 2,
        topic_count: 5,
        total_backlog: 500,
        msg_rate_in: 75.2,
        msg_rate_out: 60.1,
    },
];

export const mockNamespaces = [
    {
        tenant: 'public',
        namespace: 'default',
        full_name: 'public/default',
        policies: {
            retention_time_minutes: 60,
            retention_size_mb: 100,
        },
        topic_count: 5,
        total_backlog: 500,
        total_storage_size: 1024000,
        msg_rate_in: 100,
        msg_rate_out: 80,
    },
];

export const mockTopics = [
    {
        tenant: 'public',
        namespace: 'default',
        name: 'my-topic',
        full_name: 'persistent://public/default/my-topic',
        persistent: true,
        producer_count: 2,
        subscription_count: 3,
        storage_size: 102400,
        backlog_size: 100,
        msg_rate_in: 50.5,
        msg_rate_out: 45.2,
    },
];

export const mockBrokers = [
    {
        url: 'localhost:8080',
        topics_count: 15,
        bundles_count: 4,
        producers_count: 10,
        consumers_count: 20,
        msg_rate_in: 250.5,
        msg_rate_out: 200.3,
        msg_throughput_in: 25000,
        msg_throughput_out: 20000,
        cpu_usage: 45.5,
        memory_usage: 60.2,
        direct_memory_usage: 30.1,
    },
];

export const mockEnvironment = {
    id: 'env-1',
    name: 'Production',
    admin_url: 'http://localhost:8080',
    auth_mode: 'none' as const,
    has_token: false,
    created_at: '2024-01-01T00:00:00Z',
};

export const mockSubscriptions = [
    {
        name: 'sub-1',
        topic: 'persistent://public/default/my-topic',
        type: 'Shared',
        msg_backlog: 100,
        msg_rate_out: 45.2,
        msg_throughput_out: 4500,
        msg_rate_expired: 0,
        unacked_messages: 5,
        consumer_count: 2,
        is_durable: true,
        replicated: false,
    },
];

export const mockAuditEvents = [
    {
        id: 'audit-1',
        action: 'CREATE',
        resource_type: 'tenant',
        resource_id: 'public',
        user_id: 'admin',
        user_email: 'admin@example.com',
        details: { name: 'public' },
        ip_address: '127.0.0.1',
        timestamp: '2024-01-01T10:00:00Z',
    },
];

// Auth & RBAC mock data
export const mockCurrentUser = {
    id: 'user-1',
    email: 'user@example.com',
    display_name: 'Test User',
    avatar_url: null,
    is_active: true,
    roles: [{ id: 'role-2', name: 'developer' }],
    last_login_at: '2024-01-15T10:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
};

export const mockSessions = [
    {
        id: 'session-1',
        user_id: 'user-1',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        created_at: '2024-01-15T10:00:00Z',
        expires_at: '2024-01-22T10:00:00Z',
        is_current: true,
    },
    {
        id: 'session-2',
        user_id: 'user-1',
        ip_address: '10.0.0.50',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        created_at: '2024-01-14T08:00:00Z',
        expires_at: '2024-01-21T08:00:00Z',
        is_current: false,
    },
];

export const mockPermissions = [
    { id: 'perm-1', action: 'read', resource_level: 'cluster', description: 'Read cluster data' },
    { id: 'perm-2', action: 'write', resource_level: 'tenant', description: 'Create/modify tenants' },
    { id: 'perm-3', action: 'admin', resource_level: 'namespace', description: 'Admin namespace' },
    { id: 'perm-4', action: 'produce', resource_level: 'topic', description: 'Produce to topic' },
    { id: 'perm-5', action: 'consume', resource_level: 'topic', description: 'Consume from topic' },
];

export const mockRoles = [
    {
        id: 'role-1',
        name: 'admin',
        description: 'Full administrative access',
        is_system: true,
        environment_id: 'env-1',
        permissions: [mockPermissions[0], mockPermissions[1], mockPermissions[2]],
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 'role-2',
        name: 'developer',
        description: 'Developer access',
        is_system: false,
        environment_id: 'env-1',
        permissions: [mockPermissions[0], mockPermissions[3], mockPermissions[4]],
        created_at: '2024-01-02T00:00:00Z',
    },
    {
        id: 'role-3',
        name: 'viewer',
        description: 'Read-only access',
        is_system: true,
        environment_id: 'env-1',
        permissions: [mockPermissions[0]],
        created_at: '2024-01-01T00:00:00Z',
    },
];

export const mockUsers = [
    {
        ...mockCurrentUser,
        roles: [mockRoles[1]],
    },
    {
        id: 'user-2',
        email: 'admin@example.com',
        display_name: 'Admin User',
        avatar_url: null,
        is_active: true,
        last_login_at: '2024-01-15T09:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        roles: [mockRoles[0]],
    },
];

export const mockApiTokens = [
    {
        id: 'token-1',
        name: 'CI/CD Token',
        token_prefix: 'pc_abc1',
        expires_at: '2025-01-01T00:00:00Z',
        last_used_at: '2024-01-14T15:00:00Z',
        is_revoked: false,
        scopes: ['read', 'write'],
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 'token-2',
        name: 'Monitoring Token',
        token_prefix: 'pc_def2',
        expires_at: null,
        last_used_at: '2024-01-15T08:00:00Z',
        is_revoked: false,
        scopes: ['read'],
        created_at: '2024-01-05T00:00:00Z',
    },
];

export const mockTokenStats = {
    total: 2,
    active: 2,
    expired: 0,
    revoked: 0,
};

// API Handlers
export const handlers = [
    // Environment
    http.get('/api/v1/environment', () => {
        return HttpResponse.json(mockEnvironment);
    }),

    http.post('/api/v1/environment', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
            id: 'new-env',
            ...body,
            has_token: !!body.token,
            created_at: new Date().toISOString(),
        });
    }),

    http.post('/api/v1/environment/test', () => {
        return HttpResponse.json({
            success: true,
            message: 'Connection successful',
            latency_ms: 45,
        });
    }),

    // Tenants
    http.get('/api/v1/tenants', () => {
        return HttpResponse.json({
            tenants: mockTenants,
            total: mockTenants.length,
        });
    }),

    http.get('/api/v1/tenants/:name', ({ params }) => {
        const tenant = mockTenants.find((t) => t.name === params.name);
        if (!tenant) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({
            ...tenant,
            namespaces: ['default', 'functions'],
            total_storage_size: 1024000,
        });
    }),

    http.post('/api/v1/tenants', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({
            name: body.name,
            admin_roles: body.admin_roles || [],
            allowed_clusters: body.allowed_clusters || ['standalone'],
            namespace_count: 0,
            topic_count: 0,
            total_backlog: 0,
            msg_rate_in: 0,
            msg_rate_out: 0,
        });
    }),

    http.delete('/api/v1/tenants/:name', () => {
        return HttpResponse.json({ success: true, message: 'Tenant deleted' });
    }),

    // Namespaces
    http.get('/api/v1/tenants/:tenant/namespaces', () => {
        return HttpResponse.json({
            namespaces: mockNamespaces,
            total: mockNamespaces.length,
        });
    }),

    http.get('/api/v1/tenants/:tenant/namespaces/:namespace', ({ params }) => {
        const ns = mockNamespaces.find((n) => n.namespace === params.namespace);
        if (!ns) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({
            ...ns,
            persistent_topics: ['topic-1', 'topic-2'],
            non_persistent_topics: [],
        });
    }),

    http.post('/api/v1/tenants/:tenant/namespaces', async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
            tenant: params.tenant,
            namespace: body.namespace,
            full_name: `${params.tenant}/${body.namespace}`,
            policies: {},
            topic_count: 0,
            total_backlog: 0,
            total_storage_size: 0,
            msg_rate_in: 0,
            msg_rate_out: 0,
        });
    }),

    http.delete('/api/v1/tenants/:tenant/namespaces/:namespace', () => {
        return HttpResponse.json({ success: true, message: 'Namespace deleted' });
    }),

    // Topics
    http.get('/api/v1/tenants/:tenant/namespaces/:namespace/topics', () => {
        return HttpResponse.json({
            topics: mockTopics,
            total: mockTopics.length,
        });
    }),

    http.get('/api/v1/tenants/:tenant/namespaces/:namespace/topics/:topic', ({ params }) => {
        const topic = mockTopics.find((t) => t.name === params.topic);
        if (!topic) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({
            ...topic,
            stats: {
                msg_rate_in: topic.msg_rate_in,
                msg_rate_out: topic.msg_rate_out,
                msg_throughput_in: 5000,
                msg_throughput_out: 4500,
                average_msg_size: 100,
                storage_size: topic.storage_size,
                backlog_size: topic.backlog_size,
            },
            internal_stats: {
                entries_added_counter: 1000,
                number_of_entries: 500,
                total_size: topic.storage_size,
                current_ledger_entries: 100,
                current_ledger_size: 10000,
            },
            producers: [
                {
                    producer_id: 1,
                    producer_name: 'producer-1',
                    address: '127.0.0.1:52000',
                    msg_rate_in: 25.0,
                    msg_throughput_in: 2500,
                },
            ],
            subscriptions: mockSubscriptions,
            producer_count: topic.producer_count,
            subscription_count: topic.subscription_count,
        });
    }),

    http.post('/api/v1/tenants/:tenant/namespaces/:namespace/topics', async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({
            tenant: params.tenant,
            namespace: params.namespace,
            name: body.name,
            full_name: `persistent://${params.tenant}/${params.namespace}/${body.name}`,
            persistent: body.persistent ?? true,
            producer_count: 0,
            subscription_count: 0,
            storage_size: 0,
            backlog_size: 0,
            msg_rate_in: 0,
            msg_rate_out: 0,
        });
    }),

    http.delete('/api/v1/tenants/:tenant/namespaces/:namespace/topics/:topic', () => {
        return HttpResponse.json({ success: true, message: 'Topic deleted' });
    }),

    // Subscriptions
    http.get('/api/v1/tenants/:tenant/namespaces/:namespace/topics/:topic/subscriptions', () => {
        return HttpResponse.json({
            subscriptions: mockSubscriptions,
            total: mockSubscriptions.length,
        });
    }),

    http.post('/api/v1/tenants/:tenant/namespaces/:namespace/topics/:topic/subscriptions/:sub/skip-all', () => {
        return HttpResponse.json({ success: true, message: 'Messages skipped' });
    }),

    // Brokers
    http.get('/api/v1/brokers', () => {
        return HttpResponse.json({
            brokers: mockBrokers,
            total: mockBrokers.length,
        });
    }),

    http.get('/api/v1/brokers/cluster', () => {
        return HttpResponse.json({
            clusters: ['standalone'],
            broker_count: mockBrokers.length,
            brokers: mockBrokers,
            total_topics: 15,
            total_producers: 10,
            total_consumers: 20,
            total_msg_rate_in: 250.5,
            total_msg_rate_out: 200.3,
        });
    }),

    // Audit
    http.get('/api/v1/audit/events', () => {
        return HttpResponse.json({
            events: mockAuditEvents,
            total: mockAuditEvents.length,
        });
    }),

    // Auth
    http.get('/api/v1/auth/providers', () => {
        return HttpResponse.json({
            providers: [],
            auth_required: false,
        });
    }),

    http.get('/api/v1/auth/me', () => {
        return HttpResponse.json(mockCurrentUser);
    }),

    http.post('/api/v1/auth/logout', () => {
        return HttpResponse.json({ success: true });
    }),

    // Sessions
    http.get('/api/v1/auth/sessions', () => {
        return HttpResponse.json({ sessions: mockSessions });
    }),

    http.delete('/api/v1/auth/sessions/:id', () => {
        return HttpResponse.json({ success: true, message: 'Session revoked' });
    }),

    // Permissions
    http.get('/api/v1/rbac/permissions', () => {
        // Group permissions by action like the backend does
        const grouped: Record<string, typeof mockPermissions> = {};
        for (const perm of mockPermissions) {
            if (!grouped[perm.action]) {
                grouped[perm.action] = [];
            }
            grouped[perm.action].push(perm);
        }
        return HttpResponse.json({ permissions: grouped });
    }),

    http.get('/api/v1/rbac/user/permissions', () => {
        return HttpResponse.json({
            permissions: [mockPermissions[0], mockPermissions[3], mockPermissions[4]],
        });
    }),

    http.post('/api/v1/rbac/check', async ({ request }) => {
        const body = await request.json() as { action: string; resource_level: string; resource_path?: string };
        // Simulate permission check - allow 'read' for everything
        const allowed = body.action === 'read' ||
                       (body.action === 'produce' && body.resource_level === 'topic') ||
                       (body.action === 'consume' && body.resource_level === 'topic');
        return HttpResponse.json({ allowed });
    }),

    // Roles
    http.get('/api/v1/rbac/roles', () => {
        return HttpResponse.json({ roles: mockRoles });
    }),

    http.post('/api/v1/rbac/roles', async ({ request }) => {
        const body = await request.json() as { name: string; description?: string };
        return HttpResponse.json({
            id: 'new-role',
            name: body.name,
            description: body.description || '',
            is_system: false,
            environment_id: 'env-1',
            permissions: [],
            created_at: new Date().toISOString(),
        });
    }),

    http.put('/api/v1/rbac/roles/:id', async ({ request, params }) => {
        const body = await request.json() as { name?: string; description?: string };
        const role = mockRoles.find((r) => r.id === params.id);
        return HttpResponse.json({
            ...role,
            ...body,
        });
    }),

    http.delete('/api/v1/rbac/roles/:id', () => {
        return HttpResponse.json({ success: true, message: 'Role deleted' });
    }),

    http.post('/api/v1/rbac/roles/:roleId/permissions/:permId', () => {
        return HttpResponse.json({ success: true, message: 'Permission added' });
    }),

    http.delete('/api/v1/rbac/roles/:roleId/permissions/:permId', () => {
        return HttpResponse.json({ success: true, message: 'Permission removed' });
    }),

    // Users (RBAC)
    http.get('/api/v1/rbac/users', () => {
        return HttpResponse.json({ users: mockUsers });
    }),

    http.post('/api/v1/rbac/users/:userId/roles/:roleId', () => {
        return HttpResponse.json({ success: true, message: 'Role assigned' });
    }),

    http.delete('/api/v1/rbac/users/:userId/roles/:roleId', () => {
        return HttpResponse.json({ success: true, message: 'Role revoked' });
    }),

    // API Tokens
    http.get('/api/v1/tokens', () => {
        return HttpResponse.json({ tokens: mockApiTokens });
    }),

    http.get('/api/v1/tokens/stats', () => {
        return HttpResponse.json(mockTokenStats);
    }),

    http.post('/api/v1/tokens', async ({ request }) => {
        const body = await request.json() as { name: string; scopes?: string[]; expires_at?: string };
        return HttpResponse.json({
            id: 'new-token',
            name: body.name,
            token: 'pc_newtok_abcdefghijklmnop',
            token_prefix: 'pc_newt',
            expires_at: body.expires_at || null,
            scopes: body.scopes || ['read'],
            created_at: new Date().toISOString(),
        });
    }),

    http.delete('/api/v1/tokens/:id', () => {
        return HttpResponse.json({ success: true, message: 'Token revoked' });
    }),

    // Pulsar Token generation
    http.get('/api/v1/tokens/pulsar/capability', () => {
        return HttpResponse.json({
            can_generate: true,
            reason: null,
        });
    }),

    http.post('/api/v1/tokens/pulsar', async ({ request }) => {
        const body = await request.json() as { subject: string; expires_in_days?: number };
        return HttpResponse.json({
            token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
            subject: body.subject,
            expires_at: body.expires_in_days
                ? new Date(Date.now() + body.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
                : null,
        });
    }),
];
