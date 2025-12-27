"""Pydantic schemas for request/response validation."""

from app.schemas.audit import (
    AuditEventCountsResponse,
    AuditEventListResponse,
    AuditEventResponse,
    AuditQueryParams,
)
from app.schemas.broker import (
    BrokerConfigResponse,
    BrokerDetailResponse,
    BrokerListResponse,
    BrokerLoadResponse,
    BrokerResponse,
    ClusterInfoResponse,
    LeaderBrokerResponse,
)
from app.schemas.common import (
    ErrorResponse,
    HealthResponse,
    PaginatedResponse,
    ResourceInfo,
    StatsBase,
    SuccessResponse,
)
from app.schemas.environment import (
    EnvironmentCreate,
    EnvironmentListResponse,
    EnvironmentResponse,
    EnvironmentTestRequest,
    EnvironmentTestResponse,
    EnvironmentUpdate,
)
from app.schemas.message import (
    BrowseMessagesRequest,
    BrowseMessagesResponse,
    ExamineMessagesRequest,
    ExamineMessagesResponse,
    GetMessageResponse,
    LastMessageIdResponse,
    MessageInfo,
    MessagePayload,
)
from app.schemas.namespace import (
    NamespaceCreate,
    NamespaceDetailResponse,
    NamespaceListResponse,
    NamespacePolicies,
    NamespaceResponse,
    NamespaceUpdate,
)
from app.schemas.subscription import (
    ConsumerInfo,
    ExpireMessagesRequest,
    ResetCursorRequest,
    ResetCursorToMessageIdRequest,
    SkipMessagesRequest,
    SubscriptionCreate,
    SubscriptionDetailResponse,
    SubscriptionListResponse,
    SubscriptionResponse,
)
from app.schemas.tenant import (
    TenantCreate,
    TenantDetailResponse,
    TenantListResponse,
    TenantResponse,
    TenantUpdate,
)
from app.schemas.topic import (
    TopicCreate,
    TopicDetailResponse,
    TopicListResponse,
    TopicPartitionUpdate,
    TopicResponse,
)
from app.schemas.notification import (
    CreateNotificationRequest,
    DismissRequest,
    MarkReadRequest,
    NotificationCountResponse,
    NotificationListResponse,
    NotificationResponse,
)

__all__ = [
    # Common
    "ErrorResponse",
    "HealthResponse",
    "PaginatedResponse",
    "ResourceInfo",
    "StatsBase",
    "SuccessResponse",
    # Environment
    "EnvironmentCreate",
    "EnvironmentListResponse",
    "EnvironmentResponse",
    "EnvironmentTestRequest",
    "EnvironmentTestResponse",
    "EnvironmentUpdate",
    # Tenant
    "TenantCreate",
    "TenantDetailResponse",
    "TenantListResponse",
    "TenantResponse",
    "TenantUpdate",
    # Namespace
    "NamespaceCreate",
    "NamespaceDetailResponse",
    "NamespaceListResponse",
    "NamespacePolicies",
    "NamespaceResponse",
    "NamespaceUpdate",
    # Topic
    "TopicCreate",
    "TopicDetailResponse",
    "TopicListResponse",
    "TopicPartitionUpdate",
    "TopicResponse",
    # Subscription
    "ConsumerInfo",
    "ExpireMessagesRequest",
    "ResetCursorRequest",
    "ResetCursorToMessageIdRequest",
    "SkipMessagesRequest",
    "SubscriptionCreate",
    "SubscriptionDetailResponse",
    "SubscriptionListResponse",
    "SubscriptionResponse",
    # Message
    "BrowseMessagesRequest",
    "BrowseMessagesResponse",
    "ExamineMessagesRequest",
    "ExamineMessagesResponse",
    "GetMessageResponse",
    "LastMessageIdResponse",
    "MessageInfo",
    "MessagePayload",
    # Broker
    "BrokerConfigResponse",
    "BrokerDetailResponse",
    "BrokerListResponse",
    "BrokerLoadResponse",
    "BrokerResponse",
    "ClusterInfoResponse",
    "LeaderBrokerResponse",
    # Audit
    "AuditEventCountsResponse",
    "AuditEventListResponse",
    "AuditEventResponse",
    "AuditQueryParams",
    # Notification
    "CreateNotificationRequest",
    "DismissRequest",
    "MarkReadRequest",
    "NotificationCountResponse",
    "NotificationListResponse",
    "NotificationResponse",
]
