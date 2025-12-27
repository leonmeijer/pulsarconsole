"""Message browser API routes."""

from fastapi import APIRouter, Query

from app.api.deps import MessageBrowserSvc, SessionId
from app.schemas import (
    BrowseMessagesRequest,
    BrowseMessagesResponse,
    ExamineMessagesRequest,
    ExamineMessagesResponse,
    GetMessageResponse,
    LastMessageIdResponse,
)

router = APIRouter(
    prefix="/tenants/{tenant}/namespaces/{namespace}/topics/{topic}/messages",
    tags=["Messages"],
)


@router.post(
    "/subscriptions/{subscription}/browse",
    response_model=BrowseMessagesResponse,
)
async def browse_messages(
    tenant: str,
    namespace: str,
    topic: str,
    subscription: str,
    session_id: SessionId,
    service: MessageBrowserSvc,
    data: BrowseMessagesRequest | None = None,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> BrowseMessagesResponse:
    """Browse messages from a subscription without consuming them."""
    if data is None:
        data = BrowseMessagesRequest()

    result = await service.browse_messages(
        tenant=tenant,
        namespace=namespace,
        topic=topic,
        subscription=subscription,
        session_id=session_id,
        count=data.count,
        persistent=persistent,
        start_message_id=data.start_message_id,
    )

    return BrowseMessagesResponse(**result)


@router.post("/examine", response_model=ExamineMessagesResponse)
async def examine_messages(
    tenant: str,
    namespace: str,
    topic: str,
    session_id: SessionId,
    service: MessageBrowserSvc,
    data: ExamineMessagesRequest | None = None,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> ExamineMessagesResponse:
    """Examine messages from a topic without a subscription."""
    if data is None:
        data = ExamineMessagesRequest()

    result = await service.examine_messages(
        tenant=tenant,
        namespace=namespace,
        topic=topic,
        session_id=session_id,
        initial_position=data.initial_position,
        count=data.count,
        persistent=persistent,
    )

    return ExamineMessagesResponse(**result)


@router.get("/{message_id}", response_model=GetMessageResponse)
async def get_message(
    tenant: str,
    namespace: str,
    topic: str,
    message_id: str,
    session_id: SessionId,
    service: MessageBrowserSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> GetMessageResponse:
    """Get a specific message by ID."""
    result = await service.get_message_by_id(
        tenant=tenant,
        namespace=namespace,
        topic=topic,
        message_id=message_id,
        session_id=session_id,
        persistent=persistent,
    )

    return GetMessageResponse(**result)


@router.get("/last-id", response_model=LastMessageIdResponse)
async def get_last_message_id(
    tenant: str,
    namespace: str,
    topic: str,
    service: MessageBrowserSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> LastMessageIdResponse:
    """Get the last message ID for a topic."""
    result = await service.get_last_message_id(
        tenant=tenant,
        namespace=namespace,
        topic=topic,
        persistent=persistent,
    )

    return LastMessageIdResponse(**result)
