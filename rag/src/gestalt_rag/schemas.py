from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AccessRole(str, Enum):
    manager = "manager"
    developer = "developer"
    intern = "intern"


class AccessTier(str, Enum):
    public = "public"
    engineering = "engineering"
    management = "management"


class ChatBlockType(str, Enum):
    client_snapshot = "client_snapshot"
    open_issues = "open_issues"
    jira_tickets = "jira_tickets"
    talking_points = "talking_points"
    usage_trend = "usage_trend"
    overdue_queue = "overdue_queue"
    last_meeting_recap = "last_meeting_recap"
    hypothesis_list = "hypothesis_list"


class IngestDocument(BaseModel):
    id: str
    text: str
    source_type: str = "document"
    org_id: str
    client_id: str | None = None
    date: str | None = None
    ticket_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    access_tier: AccessTier = AccessTier.public
    title: str | None = None


class IngestRequest(BaseModel):
    documents: list[IngestDocument]


class IngestResponse(BaseModel):
    ingested: int
    chunk_count: int


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list)
    org_id: str
    access_role: AccessRole
    client_ids: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    # Optional — Express forwards the signed-in user so live Jira can use their connector
    user_id: str | None = None


class ChatBlock(BaseModel):
    type: ChatBlockType
    props: dict[str, Any] = Field(default_factory=dict)
    why: str = ""
    sources: list[str] = Field(default_factory=list)


class Citation(BaseModel):
    id: str
    label: str


class ChatResponse(BaseModel):
    reply: str
    clarification_needed: str | None = None
    blocks: list[ChatBlock] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)
    intent: str | None = None


class HealthResponse(BaseModel):
    ok: bool = True
    service: str = "gestalt-rag"
    embedding_model: str
    llm_provider: str
    llm_model: str
