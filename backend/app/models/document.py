from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class DocumentMetadata(BaseModel):
    filename: str
    content_type: str
    size: int
    uploaded_at: datetime = datetime.now()


class DocumentChunk(BaseModel):
    text: str
    metadata: dict
    chunk_index: int


class IngestionResponse(BaseModel):
    filename: str
    chunks_count: int
    status: str
    doc_id: str


class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_size: int
    chunks_count: int
    status: str
    uploaded_at: datetime


class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]


class DocumentDeleteResponse(BaseModel):
    status: str
    message: str
