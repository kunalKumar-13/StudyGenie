"""Document management endpoints: upload, list, delete."""
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.services.ingestion import IngestionService
from app.services.rag import RAGService
from app.models.document import IngestionResponse, DocumentListResponse, DocumentInfo, DocumentDeleteResponse
from app.core.database import get_db, DocumentDB, UserDB
from app.core.auth import get_current_user

router = APIRouter()
ingestion_service = IngestionService()
rag_service = RAGService()


@router.post("/upload", response_model=IngestionResponse)
async def upload_document(
    file: UploadFile = File(...),
    user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload and ingest a document (PDF, TXT, MD)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    try:
        # Read file size
        content = await file.read()
        file_size = len(content)
        await file.seek(0)  # Reset for ingestion

        # Process document into chunks
        chunks = await ingestion_service.process_document(file)

        # Extract text and metadata for indexing
        doc_id = str(uuid.uuid4())
        texts = [chunk.text for chunk in chunks]
        metadatas = [
            {**chunk.metadata, "doc_id": doc_id, "user_id": user.id}
            for chunk in chunks
        ]

        # Add to Vector DB
        rag_service.add_documents(texts, metadatas)

        # Save document record in SQL
        doc_record = DocumentDB(
            id=doc_id,
            user_id=user.id,
            filename=file.filename,
            file_size=file_size,
            content_type=file.content_type or "",
            chunks_count=len(chunks),
            status="processed",
        )
        db.add(doc_record)
        db.commit()

        return IngestionResponse(
            filename=file.filename,
            chunks_count=len(chunks),
            status="processed",
            doc_id=doc_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=DocumentListResponse)
def list_documents(
    user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all documents uploaded by the current user."""
    docs = (
        db.query(DocumentDB)
        .filter(DocumentDB.user_id == user.id)
        .order_by(DocumentDB.uploaded_at.desc())
        .all()
    )
    items = [
        DocumentInfo(
            id=d.id,
            filename=d.filename,
            file_size=d.file_size,
            chunks_count=d.chunks_count,
            status=d.status,
            uploaded_at=d.uploaded_at,
        )
        for d in docs
    ]
    return DocumentListResponse(documents=items)


@router.delete("/{doc_id}", response_model=DocumentDeleteResponse)
def delete_document(
    doc_id: str,
    user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document record. (Vector store cleanup is best-effort.)"""
    doc = db.query(DocumentDB).filter(
        DocumentDB.id == doc_id,
        DocumentDB.user_id == user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    filename = doc.filename
    db.delete(doc)
    db.commit()

    return DocumentDeleteResponse(
        status="deleted",
        message=f"Document '{filename}' deleted successfully.",
    )
