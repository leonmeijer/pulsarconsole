import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type {
  Environment,
  EnvironmentCreate,
  EnvironmentListResponse,
  EnvironmentTestResult,
  Tenant,
  TenantDetail,
  TenantCreate,
  TenantListResponse,
  Namespace,
  NamespaceDetail,
  NamespaceCreate,
  NamespacePolicies,
  NamespaceListResponse,
  Topic,
  TopicDetail,
  TopicCreate,
  TopicListResponse,
  Subscription,
  SubscriptionDetail,
  SubscriptionCreate,
  SubscriptionListResponse,
  Broker,
  BrokerDetail,
  BrokerListResponse,
  ClusterInfo,
  BrowseMessagesResponse,
  SuccessResponse,
  DashboardStats,
  HealthStatus,
  TopTenant,
  TopTopic,
  AuditEvent,
  AuditEventListResponse,
  NotificationListResponse,
  NotificationCountResponse,
  // Auth & RBAC types
  User,
  Role,
  Permission,
  UserWithRoles,
  ApiToken,
  TokenCreatedResponse,
  TokenStats,
  PulsarTokenCapability,
  PulsarTokenResponse,
  SessionInfo,
  UserPermission,
} from './types';

// Query Keys
export const queryKeys = {
  environment: ['environment'] as const,
  environments: ['environments'] as const,
  tenants: ['tenants'] as const,
  tenant: (name: string) => ['tenants', name] as const,
  namespaces: (tenant: string) => ['namespaces', tenant] as const,
  namespace: (tenant: string, namespace: string) => ['namespaces', tenant, namespace] as const,
  topics: (tenant: string, namespace: string) => ['topics', tenant, namespace] as const,
  topic: (tenant: string, namespace: string, topic: string) => ['topics', tenant, namespace, topic] as const,
  subscriptions: (tenant: string, namespace: string, topic: string) => ['subscriptions', tenant, namespace, topic] as const,
  subscription: (tenant: string, namespace: string, topic: string, sub: string) => ['subscriptions', tenant, namespace, topic, sub] as const,
  brokers: ['brokers'] as const,
  broker: (url: string) => ['brokers', url] as const,
  clusterInfo: ['cluster-info'] as const,
  dashboardStats: ['dashboard', 'stats'] as const,
  healthStatus: ['dashboard', 'health'] as const,
  timeSeries: (duration: string) => ['dashboard', 'timeseries', duration] as const,
  topTenants: ['dashboard', 'top-tenants'] as const,
  topTopics: ['dashboard', 'top-topics'] as const,
  auditEvents: (filters?: Record<string, unknown>) => ['audit', filters] as const,
  notifications: (filters?: Record<string, unknown>) => ['notifications', filters] as const,
  notificationCount: () => ['notifications', 'count'] as const,
  // Auth & RBAC keys
  currentUser: ['auth', 'me'] as const,
  sessions: ['auth', 'sessions'] as const,
  userPermissions: ['auth', 'permissions'] as const,
  roles: ['rbac', 'roles'] as const,
  role: (id: string) => ['rbac', 'roles', id] as const,
  permissions: ['rbac', 'permissions'] as const,
  users: ['rbac', 'users'] as const,
  userRoles: (userId: string) => ['rbac', 'users', userId, 'roles'] as const,
  apiTokens: ['tokens', 'api'] as const,
  tokenStats: ['tokens', 'stats'] as const,
  pulsarTokenCapability: ['tokens', 'pulsar', 'capability'] as const,
};

// Environment Hooks
export function useEnvironment() {
  return useQuery<Environment | null>({
    queryKey: queryKeys.environment,
    queryFn: async () => {
      const { data } = await api.get<Environment | null>('/api/v1/environment');
      return data;
    },
  });
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<Environment, Error, EnvironmentCreate>({
    mutationFn: async (env) => {
      const { data } = await api.post<Environment>('/api/v1/environment', env);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.environment });
      queryClient.invalidateQueries({ queryKey: queryKeys.environments });
    },
  });
}

export function useTestEnvironment() {
  return useMutation<EnvironmentTestResult, Error, { admin_url: string; token?: string }>({
    mutationFn: async (params) => {
      const { data } = await api.post<EnvironmentTestResult>('/api/v1/environment/test', params);
      return data;
    },
  });
}

export function useEnvironments() {
  return useQuery<Environment[]>({
    queryKey: queryKeys.environments,
    queryFn: async () => {
      const { data } = await api.get<EnvironmentListResponse>('/api/v1/environment/all');
      return data.environments;
    },
  });
}

export function useActivateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<Environment, Error, string>({
    mutationFn: async (name) => {
      const { data } = await api.post<Environment>(`/api/v1/environment/${name}/activate`);
      return data;
    },
    onSuccess: () => {
      // Invalidate all queries as the environment changed
      queryClient.invalidateQueries({ queryKey: queryKeys.environment });
      queryClient.invalidateQueries({ queryKey: queryKeys.environments });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants });
      queryClient.invalidateQueries({ queryKey: queryKeys.brokers });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
    },
  });
}

export function useUpdateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<Environment, Error, { name: string; data: Partial<EnvironmentCreate> }>({
    mutationFn: async ({ name, data: updateData }) => {
      const { data } = await api.put<Environment>(`/api/v1/environment/${name}`, updateData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.environment });
      queryClient.invalidateQueries({ queryKey: queryKeys.environments });
    },
  });
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (name) => {
      const { data } = await api.delete<SuccessResponse>(`/api/v1/environment/${name}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.environment });
      queryClient.invalidateQueries({ queryKey: queryKeys.environments });
    },
  });
}

// Tenant Hooks
export function useTenants(options: { useCache?: boolean; paused?: boolean } = {}) {
  const { useCache = true, paused = false } = options;
  return useQuery<Tenant[]>({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const { data } = await api.get<TenantListResponse>('/api/v1/tenants', {
        params: { use_cache: useCache },
      });
      return data.tenants;
    },
    staleTime: 10000,
    refetchInterval: paused ? false : 10000, // Auto-refresh every 10 seconds when not paused
  });
}

export function useTenant(name: string) {
  return useQuery<TenantDetail>({
    queryKey: queryKeys.tenant(name),
    queryFn: async () => {
      const { data } = await api.get<TenantDetail>(`/api/v1/tenants/${name}`);
      return data;
    },
    enabled: !!name,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation<Tenant, Error, TenantCreate>({
    mutationFn: async (tenant) => {
      const { data } = await api.post<Tenant>('/api/v1/tenants', tenant);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants });
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (name) => {
      const { data } = await api.delete<SuccessResponse>(`/api/v1/tenants/${name}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants });
    },
  });
}

// Namespace Hooks
export function useNamespaces(tenant: string, useCache = true) {
  return useQuery<Namespace[]>({
    queryKey: queryKeys.namespaces(tenant),
    queryFn: async () => {
      const { data } = await api.get<NamespaceListResponse>(`/api/v1/tenants/${tenant}/namespaces`, {
        params: { use_cache: useCache },
      });
      return data.namespaces;
    },
    enabled: !!tenant,
  });
}

export function useNamespace(tenant: string, namespace: string) {
  return useQuery<NamespaceDetail>({
    queryKey: queryKeys.namespace(tenant, namespace),
    queryFn: async () => {
      const { data } = await api.get<NamespaceDetail>(`/api/v1/tenants/${tenant}/namespaces/${namespace}`);
      return data;
    },
    enabled: !!tenant && !!namespace,
  });
}

export function useCreateNamespace(tenant: string) {
  const queryClient = useQueryClient();
  return useMutation<Namespace, Error, NamespaceCreate>({
    mutationFn: async (ns) => {
      const { data } = await api.post<Namespace>(`/api/v1/tenants/${tenant}/namespaces`, ns);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.namespaces(tenant) });
    },
  });
}

export function useDeleteNamespace(tenant: string) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (namespace) => {
      const { data } = await api.delete<SuccessResponse>(`/api/v1/tenants/${tenant}/namespaces/${namespace}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.namespaces(tenant) });
    },
  });
}

export function useUpdateNamespacePolicies(tenant: string, namespace: string) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, NamespacePolicies>({
    mutationFn: async (policies) => {
      const { data } = await api.put<SuccessResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}`,
        policies
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.namespace(tenant, namespace) });
      queryClient.invalidateQueries({ queryKey: queryKeys.namespaces(tenant) });
    },
  });
}

// Topic Hooks
export function useTopics(tenant: string, namespace: string, persistent = true, useCache = true) {
  return useQuery<Topic[]>({
    queryKey: queryKeys.topics(tenant, namespace),
    queryFn: async () => {
      const { data } = await api.get<TopicListResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics`,
        { params: { persistent, use_cache: useCache } }
      );
      return data.topics;
    },
    enabled: !!tenant && !!namespace,
  });
}

export function useTopic(tenant: string, namespace: string, topic: string, persistent = true) {
  return useQuery<TopicDetail>({
    queryKey: queryKeys.topic(tenant, namespace, topic),
    queryFn: async () => {
      const { data } = await api.get<TopicDetail>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}`,
        { params: { persistent } }
      );
      return data;
    },
    enabled: !!tenant && !!namespace && !!topic,
  });
}

export function useCreateTopic(tenant: string, namespace: string) {
  const queryClient = useQueryClient();
  return useMutation<Topic, Error, TopicCreate>({
    mutationFn: async (topic) => {
      const { data } = await api.post<Topic>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics`,
        topic
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.topics(tenant, namespace) });
    },
  });
}

export function useDeleteTopic(tenant: string, namespace: string) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { topic: string; persistent?: boolean; force?: boolean }>({
    mutationFn: async ({ topic, persistent = true, force = false }) => {
      const { data } = await api.delete<SuccessResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}`,
        { params: { persistent, force } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.topics(tenant, namespace) });
    },
  });
}

export function useUpdateTopicPartitions(tenant: string, namespace: string, topic: string) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { partitions: number; persistent?: boolean }>({
    mutationFn: async ({ partitions, persistent = true }) => {
      const { data } = await api.post<SuccessResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/partitions`,
        { partitions },
        { params: { persistent } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.topic(tenant, namespace, topic) });
      queryClient.invalidateQueries({ queryKey: queryKeys.topics(tenant, namespace) });
    },
  });
}

// Subscription Hooks
export function useSubscriptions(tenant: string, namespace: string, topic: string, persistent = true) {
  return useQuery<Subscription[]>({
    queryKey: queryKeys.subscriptions(tenant, namespace, topic),
    queryFn: async () => {
      const { data } = await api.get<SubscriptionListResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions`,
        { params: { persistent } }
      );
      return data.subscriptions;
    },
    enabled: !!tenant && !!namespace && !!topic,
  });
}

export function useSubscription(tenant: string, namespace: string, topic: string, subscription: string, persistent = true) {
  return useQuery<SubscriptionDetail>({
    queryKey: queryKeys.subscription(tenant, namespace, topic, subscription),
    queryFn: async () => {
      const { data } = await api.get<SubscriptionDetail>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions/${subscription}`,
        { params: { persistent } }
      );
      return data;
    },
    enabled: !!tenant && !!namespace && !!topic && !!subscription,
  });
}

export function useCreateSubscription(tenant: string, namespace: string, topic: string) {
  const queryClient = useQueryClient();
  return useMutation<Subscription, Error, SubscriptionCreate & { persistent?: boolean }>({
    mutationFn: async ({ persistent = true, ...sub }) => {
      const { data } = await api.post<Subscription>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions`,
        sub,
        { params: { persistent } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(tenant, namespace, topic) });
    },
  });
}

export function useSkipAllMessages(tenant: string, namespace: string, topic: string, subscription: string) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { persistent?: boolean }>({
    mutationFn: async ({ persistent = true }) => {
      const { data } = await api.post<SuccessResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions/${subscription}/skip-all`,
        {},
        { params: { persistent } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(tenant, namespace, topic) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription(tenant, namespace, topic, subscription) });
    },
  });
}

export function useDeleteSubscription(tenant: string, namespace: string, topic: string) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { subscription: string; persistent?: boolean; force?: boolean }>({
    mutationFn: async ({ subscription, persistent = true, force = false }) => {
      const { data } = await api.delete<SuccessResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions/${subscription}`,
        { params: { persistent, force } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(tenant, namespace, topic) });
    },
  });
}

export function useResetCursor(tenant: string, namespace: string, topic: string, subscription: string) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { timestamp: number; persistent?: boolean }>({
    mutationFn: async ({ timestamp, persistent = true }) => {
      const { data } = await api.post<SuccessResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions/${subscription}/reset-cursor`,
        { timestamp },
        { params: { persistent } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(tenant, namespace, topic) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription(tenant, namespace, topic, subscription) });
    },
  });
}

export function useSkipMessages(tenant: string, namespace: string, topic: string, subscription: string) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { count: number; persistent?: boolean }>({
    mutationFn: async ({ count, persistent = true }) => {
      const { data } = await api.post<SuccessResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/subscriptions/${subscription}/skip`,
        { count },
        { params: { persistent } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions(tenant, namespace, topic) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription(tenant, namespace, topic, subscription) });
    },
  });
}

// Broker Hooks
export function useBrokers(options: { useCache?: boolean; paused?: boolean } = {}) {
  const { useCache = true, paused = false } = options;
  return useQuery<Broker[]>({
    queryKey: queryKeys.brokers,
    queryFn: async () => {
      const { data } = await api.get<BrokerListResponse>('/api/v1/brokers', {
        params: { use_cache: useCache },
      });
      return data.brokers;
    },
    staleTime: 5000,
    refetchInterval: paused ? false : 5000, // Auto-refresh every 5 seconds when not paused
  });
}

export function useBroker(url: string) {
  return useQuery<BrokerDetail>({
    queryKey: queryKeys.broker(url),
    queryFn: async () => {
      const { data } = await api.get<BrokerDetail>(`/api/v1/brokers/${encodeURIComponent(url)}/details`);
      return data;
    },
    enabled: !!url,
  });
}

export function useClusterInfo() {
  return useQuery<ClusterInfo>({
    queryKey: queryKeys.clusterInfo,
    queryFn: async () => {
      const { data } = await api.get<ClusterInfo>('/api/v1/brokers/cluster');
      return data;
    },
  });
}

// Message Browser Hook
export function useBrowseMessages(
  tenant: string,
  namespace: string,
  topic: string,
  subscription: string,
  count = 10
) {
  return useMutation<BrowseMessagesResponse, Error, { persistent?: boolean }>({
    mutationFn: async ({ persistent = true }) => {
      const { data } = await api.post<BrowseMessagesResponse>(
        `/api/v1/tenants/${tenant}/namespaces/${namespace}/topics/${topic}/messages/subscriptions/${subscription}/browse`,
        { count },
        { params: { persistent } }
      );
      return data;
    },
  });
}

// Dashboard Hooks
export function useDashboardStats(options: { paused?: boolean } = {}) {
  const { paused = false } = options;
  return useQuery<DashboardStats>({
    queryKey: queryKeys.dashboardStats,
    queryFn: async () => {
      // Aggregate stats from tenants and brokers
      const [tenantsRes, brokersRes] = await Promise.all([
        api.get<{ tenants: Tenant[] }>('/api/v1/tenants'),
        api.get<{ brokers: Broker[] }>('/api/v1/brokers'),
      ]);

      const tenants = tenantsRes.data.tenants || [];
      const brokers = brokersRes.data.brokers || [];

      // Calculate aggregate statistics - use broker rates for live metrics
      const stats: DashboardStats = {
        tenants: tenants.length,
        namespaces: tenants.reduce((sum, t) => sum + (t.namespace_count || 0), 0),
        topics: tenants.reduce((sum, t) => sum + (t.topic_count || 0), 0),
        subscriptions: 0,
        producers: brokers.reduce((sum, b) => sum + (b.producers_count || 0), 0),
        consumers: brokers.reduce((sum, b) => sum + (b.consumers_count || 0), 0),
        brokers: brokers.length,
        msg_rate_in: brokers.reduce((sum, b) => sum + (b.msg_rate_in || 0), 0),
        msg_rate_out: brokers.reduce((sum, b) => sum + (b.msg_rate_out || 0), 0),
        throughput_in: brokers.reduce((sum, b) => sum + (b.msg_throughput_in || 0), 0),
        throughput_out: brokers.reduce((sum, b) => sum + (b.msg_throughput_out || 0), 0),
        storage_size: 0,
        backlog_size: tenants.reduce((sum, t) => sum + (t.total_backlog || 0), 0),
      };

      return stats;
    },
    staleTime: 5000,
    refetchInterval: paused ? false : 5000, // Auto-refresh every 5 seconds when not paused
  });
}

export function useHealthStatus() {
  return useQuery<HealthStatus>({
    queryKey: queryKeys.healthStatus,
    queryFn: async () => {
      try {
        const { data: brokers } = await api.get<{ brokers: Broker[] }>('/api/v1/brokers');

        return {
          overall: brokers.brokers?.length > 0 ? 'healthy' : 'degraded',
          pulsar_connection: brokers.brokers?.length > 0,
          database_connection: true,
          redis_connection: true,
          broker_count: brokers.brokers?.length || 0,
          unhealthy_brokers: 0,
          last_check: new Date().toISOString(),
        };
      } catch {
        return {
          overall: 'unhealthy',
          pulsar_connection: false,
          database_connection: true,
          redis_connection: true,
          broker_count: 0,
          unhealthy_brokers: 0,
          last_check: new Date().toISOString(),
        };
      }
    },
    staleTime: 5000,
    refetchInterval: 30000,
  });
}

export function useTopTenants(limit = 5) {
  return useQuery<TopTenant[]>({
    queryKey: queryKeys.topTenants,
    queryFn: async () => {
      const { data } = await api.get<{ tenants: Tenant[] }>('/api/v1/tenants');
      const tenants = data.tenants || [];

      return tenants
        .map((t) => ({
          name: t.name,
          msg_rate_in: t.msg_rate_in || 0,
          msg_rate_out: t.msg_rate_out || 0,
          backlog: t.total_backlog || 0,
          topic_count: t.topic_count || 0,
        }))
        .sort((a, b) => (b.msg_rate_in + b.msg_rate_out) - (a.msg_rate_in + a.msg_rate_out))
        .slice(0, limit);
    },
    staleTime: 15000,
  });
}

export function useTopTopics(limit = 5) {
  return useQuery<TopTopic[]>({
    queryKey: queryKeys.topTopics,
    queryFn: async () => {
      // Get tenants first
      const { data: tenantsData } = await api.get<{ tenants: Tenant[] }>('/api/v1/tenants');
      const tenants = tenantsData.tenants || [];

      const allTopics: TopTopic[] = [];

      // Fetch topics for each tenant/namespace
      for (const tenant of tenants.slice(0, 3)) {
        try {
          const { data: nsData } = await api.get<{ namespaces: Namespace[] }>(
            `/api/v1/tenants/${tenant.name}/namespaces`
          );

          for (const ns of (nsData.namespaces || []).slice(0, 3)) {
            try {
              const { data: topicsData } = await api.get<{ topics: Topic[] }>(
                `/api/v1/tenants/${tenant.name}/namespaces/${ns.namespace}/topics`
              );

              for (const topic of topicsData.topics || []) {
                allTopics.push({
                  name: topic.name,
                  tenant: tenant.name,
                  namespace: ns.namespace,
                  msg_rate_in: topic.msg_rate_in || 0,
                  msg_rate_out: topic.msg_rate_out || 0,
                  backlog: topic.backlog_size || 0,
                  storage_size: topic.storage_size || 0,
                });
              }
            } catch {
              // Skip failed topic fetches
            }
          }
        } catch {
          // Skip failed namespace fetches
        }
      }

      return allTopics
        .sort((a, b) => (b.msg_rate_in + b.msg_rate_out) - (a.msg_rate_in + a.msg_rate_out))
        .slice(0, limit);
    },
    staleTime: 30000,
  });
}

// Audit Hooks
export function useAuditEvents(filters?: {
  resource_type?: string;
  action?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
}) {
  return useQuery<AuditEvent[]>({
    queryKey: queryKeys.auditEvents(filters),
    queryFn: async () => {
      const { data } = await api.get<AuditEventListResponse>('/api/v1/audit/events', {
        params: filters,
      });
      return data.events || [];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

// Notification Hooks
export function useNotifications(filters?: {
  type?: string;
  severity?: string;
  is_read?: boolean;
  include_dismissed?: boolean;
  limit?: number;
}) {
  return useQuery<NotificationListResponse>({
    queryKey: queryKeys.notifications(filters),
    queryFn: async () => {
      const { data } = await api.get<NotificationListResponse>('/api/v1/notifications', {
        params: filters,
      });
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useNotificationCount() {
  return useQuery<number>({
    queryKey: queryKeys.notificationCount(),
    queryFn: async () => {
      const { data } = await api.get<NotificationCountResponse>('/api/v1/notifications/count');
      return data.unread_count;
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.post(`/api/v1/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post('/api/v1/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      await api.post(`/api/v1/notifications/${notificationId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDismissAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post('/api/v1/notifications/dismiss-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// =============================================================================
// Auth Hooks
// =============================================================================

export function useCurrentUser() {
  return useQuery<User>({
    queryKey: queryKeys.currentUser,
    queryFn: async () => {
      const { data } = await api.get<User>('/api/v1/auth/me');
      return data;
    },
    retry: false,
  });
}

export function useSessions() {
  return useQuery<SessionInfo[]>({
    queryKey: queryKeys.sessions,
    queryFn: async () => {
      const { data } = await api.get<{ sessions: SessionInfo[] }>('/api/v1/auth/sessions');
      return data.sessions;
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (sessionId) => {
      const { data } = await api.delete<SuccessResponse>(`/api/v1/auth/sessions/${sessionId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, void>({
    mutationFn: async () => {
      const { data } = await api.delete<SuccessResponse>('/api/v1/auth/sessions');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

export function useUserPermissions() {
  return useQuery<UserPermission[]>({
    queryKey: queryKeys.userPermissions,
    queryFn: async () => {
      const { data } = await api.get<UserPermission[]>('/api/v1/auth/permissions');
      return data;
    },
  });
}

// =============================================================================
// RBAC Hooks
// =============================================================================

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: queryKeys.roles,
    queryFn: async () => {
      const { data } = await api.get<{ roles: Role[] }>('/api/v1/rbac/roles');
      return data.roles;
    },
  });
}

export function useRole(roleId: string) {
  return useQuery<Role>({
    queryKey: queryKeys.role(roleId),
    queryFn: async () => {
      const { data } = await api.get<Role>(`/api/v1/rbac/roles/${roleId}`);
      return data;
    },
    enabled: !!roleId,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation<Role, Error, { name: string; description?: string }>({
    mutationFn: async (roleData) => {
      const { data } = await api.post<Role>('/api/v1/rbac/roles', roleData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation<Role, Error, { roleId: string; name?: string; description?: string }>({
    mutationFn: async ({ roleId, ...roleData }) => {
      const { data } = await api.put<Role>(`/api/v1/rbac/roles/${roleId}`, roleData);
      return data;
    },
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles });
      queryClient.invalidateQueries({ queryKey: queryKeys.role(roleId) });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (roleId) => {
      const { data } = await api.delete<SuccessResponse>(`/api/v1/rbac/roles/${roleId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles });
    },
  });
}

export function usePermissions() {
  return useQuery<Permission[]>({
    queryKey: queryKeys.permissions,
    queryFn: async () => {
      const { data } = await api.get<{ permissions: Record<string, Permission[]> }>('/api/v1/rbac/permissions');
      // Flatten grouped permissions into a single array
      return Object.values(data.permissions).flat();
    },
  });
}

export function useAddRolePermission() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { roleId: string; permissionId: string; resourcePattern?: string }>({
    mutationFn: async ({ roleId, permissionId, resourcePattern }) => {
      const { data } = await api.post<SuccessResponse>(
        `/api/v1/rbac/roles/${roleId}/permissions`,
        { permission_id: permissionId, resource_pattern: resourcePattern }
      );
      return data;
    },
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.role(roleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.roles });
    },
  });
}

export function useRemoveRolePermission() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { roleId: string; rolePermissionId: string }>({
    mutationFn: async ({ roleId, rolePermissionId }) => {
      const { data } = await api.delete<SuccessResponse>(
        `/api/v1/rbac/roles/${roleId}/permissions/${rolePermissionId}`
      );
      return data;
    },
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.role(roleId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.roles });
    },
  });
}

export function useUsers() {
  return useQuery<UserWithRoles[]>({
    queryKey: queryKeys.users,
    queryFn: async () => {
      const { data } = await api.get<{ users: UserWithRoles[] }>('/api/v1/rbac/users');
      return data.users;
    },
  });
}

export function usePendingUsersCount() {
  const { data: users, isLoading } = useUsers();

  const pendingCount = users?.filter((user) => user.roles.length === 0).length ?? 0;
  const pendingUsers = users?.filter((user) => user.roles.length === 0) ?? [];

  return {
    count: pendingCount,
    users: pendingUsers,
    isLoading,
  };
}

export function useAssignUserRole() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { userId: string; roleId: string }>({
    mutationFn: async ({ userId, roleId }) => {
      const { data } = await api.post<SuccessResponse>(
        `/api/v1/rbac/users/${userId}/roles`,
        { role_id: roleId }
      );
      return data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.userRoles(userId) });
    },
  });
}

export function useRevokeUserRole() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { userId: string; roleId: string }>({
    mutationFn: async ({ userId, roleId }) => {
      const { data } = await api.delete<SuccessResponse>(
        `/api/v1/rbac/users/${userId}/roles/${roleId}`
      );
      return data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
      queryClient.invalidateQueries({ queryKey: queryKeys.userRoles(userId) });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (userId) => {
      const { data } = await api.delete<SuccessResponse>(
        `/api/v1/rbac/users/${userId}`
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

export function useCheckPermission() {
  return useMutation<{ allowed: boolean; reason?: string }, Error, { action: string; resourceLevel: string; resourcePath?: string }>({
    mutationFn: async ({ action, resourceLevel, resourcePath }) => {
      const { data } = await api.post<{ allowed: boolean; reason?: string }>(
        '/api/v1/rbac/check',
        { action, resource_level: resourceLevel, resource_path: resourcePath }
      );
      return data;
    },
  });
}

// =============================================================================
// API Token Hooks
// =============================================================================

export function useApiTokens() {
  return useQuery<ApiToken[]>({
    queryKey: queryKeys.apiTokens,
    queryFn: async () => {
      const { data } = await api.get<{ tokens: ApiToken[] }>('/api/v1/tokens');
      return data.tokens;
    },
  });
}

export function useTokenStats() {
  return useQuery<TokenStats>({
    queryKey: queryKeys.tokenStats,
    queryFn: async () => {
      const { data } = await api.get<TokenStats>('/api/v1/tokens/stats');
      return data;
    },
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation<TokenCreatedResponse, Error, { name: string; expiresInDays?: number; scopes?: string[] }>({
    mutationFn: async ({ name, expiresInDays, scopes }) => {
      const { data } = await api.post<TokenCreatedResponse>('/api/v1/tokens', {
        name,
        expires_in_days: expiresInDays,
        scopes,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiTokens });
      queryClient.invalidateQueries({ queryKey: queryKeys.tokenStats });
    },
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (tokenId) => {
      const { data } = await api.delete<SuccessResponse>(`/api/v1/tokens/${tokenId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiTokens });
      queryClient.invalidateQueries({ queryKey: queryKeys.tokenStats });
    },
  });
}

export function useRevokeAllApiTokens() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, void>({
    mutationFn: async () => {
      const { data } = await api.delete<SuccessResponse>('/api/v1/tokens');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiTokens });
      queryClient.invalidateQueries({ queryKey: queryKeys.tokenStats });
    },
  });
}

// =============================================================================
// Pulsar Token Hooks
// =============================================================================

export function usePulsarTokenCapability() {
  return useQuery<PulsarTokenCapability>({
    queryKey: queryKeys.pulsarTokenCapability,
    queryFn: async () => {
      const { data } = await api.get<PulsarTokenCapability>('/api/v1/tokens/pulsar/capability');
      return data;
    },
  });
}

export function useGeneratePulsarToken() {
  return useMutation<PulsarTokenResponse, Error, { subject: string; expiresInDays?: number }>({
    mutationFn: async ({ subject, expiresInDays }) => {
      const { data } = await api.post<PulsarTokenResponse>('/api/v1/tokens/pulsar', {
        subject,
        expires_in_days: expiresInDays,
      });
      return data;
    },
  });
}

// =============================================================================
// Pulsar Auth Hooks
// =============================================================================

// Types for Pulsar Auth
export interface PulsarAuthStatus {
  authentication_enabled: boolean;
  authorization_enabled: boolean;
  authentication_providers: string[];
  super_user_roles: string[];
  authorization_provider: string | null;
  raw_config: Record<string, unknown>;
}

export interface PulsarAuthValidation {
  can_proceed: boolean;
  can_enable_auth: boolean;
  has_valid_token: boolean;
  superuser_roles_configured: boolean;
  warnings: string[];
  errors: string[];
  current_config: Record<string, unknown>;
}

export interface PulsarPermission {
  role: string;
  actions: string[];
}

export interface PulsarPermissionsResponse {
  permissions: PulsarPermission[];
  total: number;
}

export interface BrokerConfigResponse {
  config_values: Record<string, string>;
  available_configs: string[];
}

export interface SyncChangeInfo {
  action: string;
  resource_type: string;
  resource_id: string;
  role: string;
  permissions: string[];
  source: string;
}

export interface SyncPreviewResponse {
  direction: string;
  changes: SyncChangeInfo[];
  warnings: string[];
  errors: string[];
  can_proceed: boolean;
  has_changes: boolean;
}

export interface SyncDiffResponse {
  only_in_console: Record<string, string[]>;
  only_in_pulsar: Record<string, string[]>;
  different: Record<string, { console: string[]; pulsar: string[] }>;
  same: Record<string, string[]>;
  total_console: number;
  total_pulsar: number;
}

export interface SyncResultResponse {
  success: boolean;
  changes_applied: number;
  changes_failed: number;
  details: string[];
  errors: string[];
}

// Query keys for Pulsar Auth
export const pulsarAuthKeys = {
  status: ['pulsar-auth', 'status'] as const,
  validation: ['pulsar-auth', 'validation'] as const,
  namespacePermissions: (tenant: string, namespace: string) =>
    ['pulsar-auth', 'permissions', 'namespace', tenant, namespace] as const,
  topicPermissions: (tenant: string, namespace: string, topic: string) =>
    ['pulsar-auth', 'permissions', 'topic', tenant, namespace, topic] as const,
  brokerConfig: ['pulsar-auth', 'broker-config'] as const,
  rbacDiff: (tenant: string, namespace: string) =>
    ['pulsar-auth', 'rbac-diff', tenant, namespace] as const,
  rbacPreview: (tenant: string, namespace: string) =>
    ['pulsar-auth', 'rbac-preview', tenant, namespace] as const,
};

// Auth Status Hooks
export function usePulsarAuthStatus() {
  return useQuery<PulsarAuthStatus>({
    queryKey: pulsarAuthKeys.status,
    queryFn: async () => {
      const { data } = await api.get<PulsarAuthStatus>('/api/v1/pulsar-auth/status');
      return data;
    },
  });
}

export function usePulsarAuthValidation() {
  return useQuery<PulsarAuthValidation>({
    queryKey: pulsarAuthKeys.validation,
    queryFn: async () => {
      const { data } = await api.get<PulsarAuthValidation>('/api/v1/pulsar-auth/validate');
      return data;
    },
  });
}

// Namespace Permission Hooks
export function useNamespacePermissions(tenant: string, namespace: string) {
  return useQuery<PulsarPermissionsResponse>({
    queryKey: pulsarAuthKeys.namespacePermissions(tenant, namespace),
    queryFn: async () => {
      const { data } = await api.get<PulsarPermissionsResponse>(
        `/api/v1/pulsar-auth/namespaces/${tenant}/${namespace}/permissions`
      );
      return data;
    },
    enabled: !!tenant && !!namespace,
  });
}

export function useGrantNamespacePermission() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { tenant: string; namespace: string; role: string; actions: string[] }>({
    mutationFn: async ({ tenant, namespace, role, actions }) => {
      const { data } = await api.post<SuccessResponse>(
        `/api/v1/pulsar-auth/namespaces/${tenant}/${namespace}/permissions`,
        { role, actions }
      );
      return data;
    },
    onSuccess: (_, { tenant, namespace }) => {
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.namespacePermissions(tenant, namespace) });
    },
  });
}

export function useRevokeNamespacePermission() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { tenant: string; namespace: string; role: string }>({
    mutationFn: async ({ tenant, namespace, role }) => {
      const { data } = await api.delete<SuccessResponse>(
        `/api/v1/pulsar-auth/namespaces/${tenant}/${namespace}/permissions/${role}`
      );
      return data;
    },
    onSuccess: (_, { tenant, namespace }) => {
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.namespacePermissions(tenant, namespace) });
    },
  });
}

// Topic Permission Hooks
export function useTopicPermissions(tenant: string, namespace: string, topic: string, persistent = true) {
  return useQuery<PulsarPermissionsResponse>({
    queryKey: pulsarAuthKeys.topicPermissions(tenant, namespace, topic),
    queryFn: async () => {
      const { data } = await api.get<PulsarPermissionsResponse>(
        `/api/v1/pulsar-auth/topics/${tenant}/${namespace}/${topic}/permissions`,
        { params: { persistent } }
      );
      return data;
    },
    enabled: !!tenant && !!namespace && !!topic,
  });
}

export function useGrantTopicPermission() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { tenant: string; namespace: string; topic: string; role: string; actions: string[]; persistent?: boolean }>({
    mutationFn: async ({ tenant, namespace, topic, role, actions, persistent = true }) => {
      const { data } = await api.post<SuccessResponse>(
        `/api/v1/pulsar-auth/topics/${tenant}/${namespace}/${topic}/permissions`,
        { role, actions },
        { params: { persistent } }
      );
      return data;
    },
    onSuccess: (_, { tenant, namespace, topic }) => {
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.topicPermissions(tenant, namespace, topic) });
    },
  });
}

export function useRevokeTopicPermission() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { tenant: string; namespace: string; topic: string; role: string; persistent?: boolean }>({
    mutationFn: async ({ tenant, namespace, topic, role, persistent = true }) => {
      const { data } = await api.delete<SuccessResponse>(
        `/api/v1/pulsar-auth/topics/${tenant}/${namespace}/${topic}/permissions/${role}`,
        { params: { persistent } }
      );
      return data;
    },
    onSuccess: (_, { tenant, namespace, topic }) => {
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.topicPermissions(tenant, namespace, topic) });
    },
  });
}

// Broker Config Hooks
export function useBrokerConfig() {
  return useQuery<BrokerConfigResponse>({
    queryKey: pulsarAuthKeys.brokerConfig,
    queryFn: async () => {
      const { data } = await api.get<BrokerConfigResponse>('/api/v1/pulsar-auth/broker/config');
      return data;
    },
  });
}

export function useUpdateBrokerConfig() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, { configName: string; value: string }>({
    mutationFn: async ({ configName, value }) => {
      const { data } = await api.post<SuccessResponse>(
        `/api/v1/pulsar-auth/broker/config/${configName}`,
        { value }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.brokerConfig });
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.status });
    },
  });
}

export function useDeleteBrokerConfig() {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (configName) => {
      const { data } = await api.delete<SuccessResponse>(`/api/v1/pulsar-auth/broker/config/${configName}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.brokerConfig });
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.status });
    },
  });
}

// RBAC Sync Hooks
export function useRbacDiff(tenant: string, namespace: string) {
  return useQuery<SyncDiffResponse>({
    queryKey: pulsarAuthKeys.rbacDiff(tenant, namespace),
    queryFn: async () => {
      const { data } = await api.get<SyncDiffResponse>(
        `/api/v1/pulsar-auth/rbac-sync/namespaces/${tenant}/${namespace}/diff`
      );
      return data;
    },
    enabled: !!tenant && !!namespace,
  });
}

export function useRbacSyncPreview(tenant: string, namespace: string, direction?: string) {
  return useQuery<SyncPreviewResponse>({
    queryKey: [...pulsarAuthKeys.rbacPreview(tenant, namespace), direction],
    queryFn: async () => {
      const { data } = await api.get<SyncPreviewResponse>(
        `/api/v1/pulsar-auth/rbac-sync/namespaces/${tenant}/${namespace}/preview`,
        { params: direction ? { direction } : undefined }
      );
      return data;
    },
    enabled: !!tenant && !!namespace,
  });
}

export function useRbacSync() {
  const queryClient = useQueryClient();
  return useMutation<SyncResultResponse, Error, { tenant: string; namespace: string; direction?: string; dryRun?: boolean }>({
    mutationFn: async ({ tenant, namespace, direction, dryRun = true }) => {
      const { data } = await api.post<SyncResultResponse>(
        `/api/v1/pulsar-auth/rbac-sync/namespaces/${tenant}/${namespace}`,
        { direction, dry_run: dryRun }
      );
      return data;
    },
    onSuccess: (_, { tenant, namespace }) => {
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.rbacDiff(tenant, namespace) });
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.rbacPreview(tenant, namespace) });
      queryClient.invalidateQueries({ queryKey: pulsarAuthKeys.namespacePermissions(tenant, namespace) });
    },
  });
}

// =============================================================================
// Theme Preferences
// =============================================================================

export interface ThemePreference {
  theme: string | null;
  mode: string | null;
}

export const themeKeys = {
  preference: ['theme', 'preference'] as const,
};

export function useThemePreference(enabled: boolean = true) {
  return useQuery<ThemePreference>({
    queryKey: themeKeys.preference,
    queryFn: async () => {
      const { data } = await api.get<ThemePreference>('/api/v1/auth/preferences/theme');
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - theme doesn't change often
    retry: false, // Don't retry if not authenticated
    enabled, // Only fetch when enabled (user is authenticated)
  });
}

export function useUpdateThemePreference() {
  const queryClient = useQueryClient();
  return useMutation<ThemePreference, Error, { theme?: string; mode?: string }>({
    mutationFn: async (preferences) => {
      const { data } = await api.put<ThemePreference>('/api/v1/auth/preferences/theme', preferences);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(themeKeys.preference, data);
    },
  });
}
