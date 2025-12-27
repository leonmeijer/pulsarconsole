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
    http.get('/api/v1/audit', () => {
        return HttpResponse.json({
            events: mockAuditEvents,
            total: mockAuditEvents.length,
        });
    }),
];
