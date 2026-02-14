// API Response Types

export interface SuccessResponse {
  success: boolean;
  message: string;
}

// =============================================================================
// Authentication Types
// =============================================================================

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_global_admin: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface OIDCProvider {
  id: string;
  name: string;
  issuer_url: string;
  login_url?: string;
}

// OIDC Provider Configuration (for admin settings)
export interface OIDCProviderConfig {
  id: string;
  environment_id: string;
  issuer_url: string;
  client_id: string;
  has_client_secret: boolean;
  use_pkce: boolean;
  scopes: string[];
  role_claim: string;
  auto_create_users: boolean;
  default_role_name: string | null;
  group_role_mappings: Record<string, string> | null;
  admin_groups: string[] | null;
  sync_roles_on_login: boolean;
  is_enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
  is_global: boolean;  // True if this is from global env vars, not database
}

export interface OIDCProviderConfigCreate {
  issuer_url: string;
  client_id: string;
  client_secret?: string;
  use_pkce?: boolean;
  scopes?: string[];
  role_claim?: string;
  auto_create_users?: boolean;
  default_role_name?: string;
  group_role_mappings?: Record<string, string>;
  admin_groups?: string[];
  sync_roles_on_login?: boolean;
}

export interface OIDCProviderConfigUpdate {
  issuer_url?: string;
  client_id?: string;
  client_secret?: string;
  use_pkce?: boolean;
  scopes?: string[];
  role_claim?: string;
  auto_create_users?: boolean;
  default_role_name?: string;
  group_role_mappings?: Record<string, string>;
  admin_groups?: string[];
  sync_roles_on_login?: boolean;
  is_enabled?: boolean;
}

export interface ProvidersResponse {
  providers: OIDCProvider[];
  auth_required: boolean;
}

export interface LoginResponse {
  authorization_url: string;
  state: string;
}

export interface SessionInfo {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export interface UserPermission {
  action: string;
  resource_level: string;
  resource_pattern: string | null;
  source: string;
}

export interface CheckPermissionResponse {
  allowed: boolean;
  reason: string | null;
}

// =============================================================================
// RBAC Types
// =============================================================================

export interface Permission {
  id: string;
  action: string;
  resource_level: string;
  description: string | null;
  full_name: string;
}

export interface RolePermission {
  permission_id: string;
  action: string;
  resource_level: string;
  resource_pattern: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: RolePermission[];
}

export interface UserRole {
  role_id: string;
  role_name: string;
  is_system: boolean;
  assigned_at: string;
}

export interface UserWithRoles {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  roles: UserRole[];
}

// =============================================================================
// Token Types
// =============================================================================

export interface ApiToken {
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  is_revoked: boolean;
  is_expired: boolean;
  is_valid: boolean;
  scopes: string[] | null;
  created_at: string;
}

export interface TokenCreatedResponse {
  id: string;
  name: string;
  token: string;
  token_prefix: string;
  expires_at: string | null;
  scopes: string[] | null;
  message: string;
}

export interface TokenStats {
  total: number;
  active: number;
  revoked: number;
  expired: number;
}

export interface PulsarTokenCapability {
  can_generate: boolean;
  environment_id: string | null;
  environment_name: string | null;
}

export interface PulsarTokenResponse {
  token: string;
  subject: string;
  expires_in_days: number | null;
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
  auth_mode: 'none' | 'token' | 'oidc';
  has_token: boolean;
  ca_bundle_ref?: string;
  is_active: boolean;
  is_shared: boolean;
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
  auth_mode?: 'none' | 'token' | 'oidc';
  oidc_mode?: 'none' | 'console_only' | 'passthrough';
  token?: string;
  ca_bundle_ref?: string;
  validate_connectivity?: boolean;
  is_shared?: boolean;
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
  msg_throughput_in: number;
  msg_throughput_out: number;
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
  msg_in_counter: number;
  msg_out_counter: number;
  msg_backlog: number;
}

export interface TopicStats {
  msg_rate_in: number;
  msg_rate_out: number;
  msg_throughput_in: number;
  msg_throughput_out: number;
  average_msg_size: number;
  storage_size: number;
  backlog_size: number;
  msg_in_counter: number;
  msg_out_counter: number;
  msg_backlog: number;
  bytes_in_counter: number;
  bytes_out_counter: number;
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
  backlog_size: number;
  msg_rate_out: number;
  msg_throughput_out: number;
  consumer_count: number;
  unacked_messages: number;
  msg_rate_redeliver: number;
  is_blocked: boolean;
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
  backlog_size: number;
  msg_rate_out: number;
  msg_throughput_out: number;
  msg_rate_expired: number;
  msg_rate_redeliver: number;
  unacked_messages: number;
  consumer_count: number;
  is_durable: boolean;
  is_blocked: boolean;
  replicated: boolean;
}

export interface SubscriptionDetail extends Subscription {
  consumers: Consumer[];
}

export interface SubscriptionCreate {
  name: string;
  initial_position?: 'earliest' | 'latest';
  replicated?: boolean;
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

export interface ExamineMessagesResponse {
  topic: string;
  initial_position: string;
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

// Notification Types
export type NotificationType =
  | 'consumer_disconnect'
  | 'broker_health'
  | 'storage_warning'
  | 'backlog_warning'
  | 'error'
  | 'info';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface PulsarNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: PulsarNotification[];
  total: number;
  unread_count: number;
}

export interface NotificationCountResponse {
  unread_count: number;
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

// =============================================================================
// Notification Channel Types
// =============================================================================

export type NotificationChannelType = 'email' | 'slack' | 'webhook';

export interface EmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_use_tls: boolean;
  from_address: string;
  from_name: string;
  recipients: string[];
}

export interface SlackConfig {
  webhook_url: string;
  channel?: string;
  username: string;
  icon_emoji: string;
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  include_metadata: boolean;
  timeout_seconds: number;
}

export type NotificationChannelConfig = EmailConfig | SlackConfig | WebhookConfig;

export interface NotificationChannel {
  id: string;
  name: string;
  channel_type: NotificationChannelType;
  is_enabled: boolean;
  severity_filter: NotificationSeverity[] | null;
  type_filter: NotificationType[] | null;
  config: Record<string, unknown>;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationChannelCreate {
  name: string;
  channel_type: NotificationChannelType;
  is_enabled?: boolean;
  severity_filter?: NotificationSeverity[] | null;
  type_filter?: NotificationType[] | null;
  config: EmailConfig | SlackConfig | WebhookConfig;
}

export interface NotificationChannelUpdate {
  name?: string;
  is_enabled?: boolean;
  severity_filter?: NotificationSeverity[] | null;
  type_filter?: NotificationType[] | null;
  config?: EmailConfig | SlackConfig | WebhookConfig;
}

export interface NotificationChannelListResponse {
  channels: NotificationChannel[];
  total: number;
}

export interface NotificationDelivery {
  id: string;
  notification_id: string;
  channel_id: string;
  channel_name: string;
  channel_type: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface NotificationDeliveryListResponse {
  deliveries: NotificationDelivery[];
  total: number;
}

export interface TestChannelResponse {
  success: boolean;
  message: string;
  latency_ms: number | null;
}
