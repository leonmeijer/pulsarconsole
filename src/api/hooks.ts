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
  });
}
