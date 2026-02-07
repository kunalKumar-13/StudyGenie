from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = []


class Source(BaseModel):
    text: str
    metadata: dict


class ChatResponse(BaseModel):
    answer: str
    sources: List[Source]
    session_id: str


# --- Session Models ---

class SessionSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class SessionDetail(BaseModel):
    id: str
    title: str
    created_at: datetime
    messages: List[dict]


class SessionListResponse(BaseModel):
    sessions: List[SessionSummary]


# --- Auth Models ---

class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = ""


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str


class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
