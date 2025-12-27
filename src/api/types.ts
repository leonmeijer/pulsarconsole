// API Response Types

export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  request_id?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// Environment Types
export interface Environment {
  id: string;
  name: string;
  admin_url: string;
  auth_mode: 'none' | 'token' | 'oauth2';
  has_token: boolean;
  ca_bundle_ref?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface EnvironmentListResponse {
  environments: Environment[];
  total: number;
}

export interface EnvironmentCreate {
  name: string;
  admin_url: string;
  auth_mode?: 'none' | 'token' | 'oauth2';
  token?: string;
  ca_bundle_ref?: string;
  validate_connectivity?: boolean;
}

export interface EnvironmentTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

// Tenant Types
export interface Tenant {
  name: string;
  admin_roles: string[];
  allowed_clusters: string[];
  namespace_count: number;
  topic_count: number;
  total_backlog: number;
  msg_rate_in: number;
  msg_rate_out: number;
}

export interface TenantDetail extends Tenant {
  namespaces: string[];
  total_storage_size: number;
}

export interface TenantCreate {
  name: string;
  admin_roles?: string[];
  allowed_clusters?: string[];
}

// Namespace Types
export interface NamespacePolicies {
  retention_time_minutes?: number;
  retention_size_mb?: number;
  message_ttl_seconds?: number;
  backlog_quota?: Record<string, unknown>;
  deduplication_enabled?: boolean;
  schema_compatibility_strategy?: string;
}

export interface Namespace {
  tenant: string;
  namespace: string;
  full_name: string;
  policies: NamespacePolicies;
  topic_count: number;
  total_backlog: number;
  total_storage_size: number;
  msg_rate_in: number;
  msg_rate_out: number;
}

export interface NamespaceDetail extends Namespace {
  persistent_topics: string[];
  non_persistent_topics: string[];
}

export interface NamespaceCreate {
  namespace: string;
}

// Topic Types
export interface Topic {
  tenant: string;
  namespace: string;
  name: string;
  full_name: string;
  persistent: boolean;
  producer_count: number;
  subscription_count: number;
  storage_size: number;
  backlog_size: number;
  msg_rate_in: number;
  msg_rate_out: number;
}

export interface TopicStats {
  msg_rate_in: number;
  msg_rate_out: number;
  msg_throughput_in: number;
  msg_throughput_out: number;
  average_msg_size: number;
  storage_size: number;
  backlog_size: number;
}

export interface ProducerInfo {
  producer_id?: number;
  producer_name?: string;
  address?: string;
  msg_rate_in: number;
  msg_throughput_in: number;
}

export interface SubscriptionInfo {
  name: string;
  type: string;
  msg_backlog: number;
  msg_rate_out: number;
  consumer_count: number;
}

export interface TopicDetail {
  tenant: string;
  namespace: string;
  name: string;
  full_name: string;
  persistent: boolean;
  partitions: number;
  stats: TopicStats;
  internal_stats: {
    entries_added_counter: number;
    number_of_entries: number;
    total_size: number;
    current_ledger_entries: number;
    current_ledger_size: number;
  };
  producers: ProducerInfo[];
  subscriptions: SubscriptionInfo[];
  producer_count: number;
  subscription_count: number;
}

export interface TopicCreate {
  name: string;
  persistent?: boolean;
  partitions?: number;
}

// Subscription Types
export interface Consumer {
  consumer_name?: string;
  address?: string;
  connected_since?: string;
  msg_rate_out: number;
  msg_throughput_out: number;
  available_permits: number;
  unacked_messages: number;
  blocked_consumer_on_unacked_msgs?: boolean;
}

export interface Subscription {
  name: string;
  topic: string;
  type: string;
  msg_backlog: number;
  msg_rate_out: number;
  msg_throughput_out: number;
  msg_rate_expired: number;
  unacked_messages: number;
  consumer_count: number;
  is_durable: boolean;
  replicated: boolean;
}

export interface SubscriptionDetail extends Subscription {
  consumers: Consumer[];
}

export interface SubscriptionCreate {
  name: string;
  message_id?: string;
}

// Broker Types
export interface Broker {
  url: string;
  topics_count: number;
  bundles_count: number;
  producers_count: number;
  consumers_count: number;
  msg_rate_in: number;
  msg_rate_out: number;
  msg_throughput_in: number;
  msg_throughput_out: number;
  cpu_usage: number;
  memory_usage: number;
  direct_memory_usage: number;
}

export interface BrokerDetail extends Broker {
  jvm_heap_used: number;
  jvm_heap_max: number;
  owned_namespaces: string[];
}

export interface ClusterInfo {
  clusters: string[];
  broker_count: number;
  brokers: Broker[];
  total_topics: number;
  total_producers: number;
  total_consumers: number;
  total_msg_rate_in: number;
  total_msg_rate_out: number;
}

// Message Types
export interface MessagePayload {
  type: 'json' | 'text' | 'binary';
  content: unknown;
  raw?: string;
  size?: number;
}

export interface Message {
  index: number;
  message_id?: string;
  publish_time?: string;
  producer_name?: string;
  properties: Record<string, string>;
  payload: MessagePayload;
  key?: string;
  event_time?: string;
  redelivery_count: number;
}

export interface BrowseMessagesResponse {
  topic: string;
  subscription: string;
  messages: Message[];
  message_count: number;
  rate_limit_remaining: number;
}

// Audit Types
export interface AuditEvent {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  user_id?: string;
  user_email?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
}

// List Response Types
export interface TenantListResponse {
  tenants: Tenant[];
  total: number;
}

export interface NamespaceListResponse {
  namespaces: Namespace[];
  total: number;
}

export interface TopicListResponse {
  topics: Topic[];
  total: number;
}

export interface SubscriptionListResponse {
  subscriptions: Subscription[];
  total: number;
}

export interface BrokerListResponse {
  brokers: Broker[];
  total: number;
}

export interface AuditEventListResponse {
  events: AuditEvent[];
  total: number;
}

// Dashboard Types
export interface DashboardStats {
  tenants: number;
  namespaces: number;
  topics: number;
  subscriptions: number;
  producers: number;
  consumers: number;
  brokers: number;
  msg_rate_in: number;
  msg_rate_out: number;
  throughput_in: number;
  throughput_out: number;
  storage_size: number;
  backlog_size: number;
}

export interface HealthStatus {
  overall: "healthy" | "degraded" | "unhealthy";
  pulsar_connection: boolean;
  database_connection: boolean;
  redis_connection: boolean;
  broker_count: number;
  unhealthy_brokers: number;
  last_check: string;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  msg_rate_in: number;
  msg_rate_out: number;
  throughput_in: number;
  throughput_out: number;
  backlog: number;
}

export interface TopTenant {
  name: string;
  msg_rate_in: number;
  msg_rate_out: number;
  backlog: number;
  topic_count: number;
}

export interface TopTopic {
  name: string;
  tenant: string;
  namespace: string;
  msg_rate_in: number;
  msg_rate_out: number;
  backlog: number;
  storage_size: number;
}
