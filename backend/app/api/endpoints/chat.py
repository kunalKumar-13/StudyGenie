"""Chat endpoint with session persistence and streaming."""
import uuid
import json
import re
import time
import traceback
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.models.chat import ChatRequest, ChatResponse, Source, SessionSummary, SessionListResponse, SessionDetail
from app.services.rag import RAGService
from app.core.config import settings
from app.core.database import get_db, ChatSessionDB, ChatMessageDB, UserDB
from app.core.auth import get_current_user
from langchain_core.messages import SystemMessage, HumanMessage

router = APIRouter()
rag_service = RAGService()

# Primary LLM: Gemini (cloud API)
# Fallback LLM: Ollama (local) — used automatically if Gemini quota is exhausted
gemini_llm = None
ollama_llm = None

if settings.GEMINI_API_KEY:
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        gemini_llm = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.2,
        )
        print("[LLM] Gemini configured as primary LLM")
    except Exception as e:
        print(f"[LLM] Could not initialize Gemini: {e}")

try:
    from langchain_ollama import ChatOllama
    ollama_llm = ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.OLLAMA_MODEL,
        temperature=0.2,
    )
    print("[LLM] Ollama configured as fallback LLM")
except Exception as e:
    print(f"[LLM] Could not initialize Ollama: {e}")


def invoke_llm(messages):
    """Call Gemini first; if it fails (quota/network), fall back to Ollama."""
    errors = []

    # Try Gemini first
    if gemini_llm:
        for attempt in range(2):
            try:
                response = gemini_llm.invoke(messages)
                print("[LLM] Response from Gemini")
                return response
            except Exception as e:
                err = str(e)
                errors.append(f"Gemini: {err}")
                if ("429" in err or "RESOURCE_EXHAUSTED" in err) and attempt == 0:
                    print(f"[LLM] Gemini rate limited, retrying in 1s...")
                    time.sleep(1)
                else:
                    print(f"[LLM] Gemini failed: {err[:120]}")
                    break

    # Fallback to Ollama
    if ollama_llm:
        try:
            response = ollama_llm.invoke(messages)
            print("[LLM] Response from Ollama (fallback)")
            return response
        except Exception as e:
            errors.append(f"Ollama: {str(e)}")

    raise Exception(f"All LLM providers failed: {'; '.join(errors)}")


def stream_llm(messages):
    """Stream tokens from Gemini first; fall back to Ollama on failure."""
    # Try Gemini
    if gemini_llm:
        try:
            for chunk in gemini_llm.stream(messages):
                if chunk.content:
                    yield chunk.content
            return
        except Exception as e:
            err = str(e)
            print(f"[LLM] Gemini stream failed: {err[:120]}, falling back to Ollama")

    # Fallback to Ollama
    if ollama_llm:
        try:
            for chunk in ollama_llm.stream(messages):
                if chunk.content:
                    yield chunk.content
            return
        except Exception as e:
            print(f"[LLM] Ollama stream failed: {e}")

    yield "[Error] All LLM providers are unavailable."


# ---------------------------------------------------------------------------
# Smart query routing — skip expensive RAG for simple / general questions
# ---------------------------------------------------------------------------
_GENERAL_PATTERNS = re.compile(
    r"(?i)^(hi\b|hello\b|hey\b|thanks|thank you|bye\b|good\s?(morning|night|evening)|" +
    r"what\s+is\s+\d|calculate\b|solve\b|simplify\b|evaluate\b|convert\b|" +
    r"how\s+much\s+is|what('?s|\s+is)\s+(\d|the\s+(sum|product|difference|square|cube|root|factorial))|" +
    r"\d+\s*[\+\-\*\/\^]\s*\d+|" +
    r"define\s|meaning\s+of\s|who\s+(is|was|are)|tell\s+me\s+(a\s+joke|about\s+yourself)|" +
    r"what\s+can\s+you\s+do|help$|explain\s+(what|how)\s+(you|this\s+app)|" +
    r"write\s+(a|an|me)\s|translate\s|summarize\s+this|" +
    r"how\s+do\s+i\s|how\s+to\s|what\s+does\s+.{0,20}\s+mean|" +
    r"give\s+me\s+(an?\s+)?example|list\s+\d+|" +
    r"compare\s|difference\s+between\s|pros\s+and\s+cons)"
)

_DOC_KEYWORDS = re.compile(r"(?i)(my\s+(notes|docs|document|upload|file|material)|from\s+(the\s+)?(notes|docs|document|upload|material)|according\s+to|based\s+on\s+(my|the))")

def _needs_rag(query: str, has_docs: bool) -> bool:
    """Return True if the query should go through the RAG pipeline."""
    if not has_docs:
        return False
    q = query.strip()
    if len(q) < 4:
        return False
    # Explicitly mentions documents → always use RAG
    if _DOC_KEYWORDS.search(q):
        return True
    # Matches a general/math/greeting pattern → skip RAG
    if _GENERAL_PATTERNS.search(q):
        return False
    return True


SYSTEM_PROMPT_RAG = """You are StudyGenie, an expert AI tutor.
Answer the student's question based on the provided context from their study materials.
If the context doesn't contain enough info, say so.
Be concise. Explain step-by-step when needed. Use simple language."""

SYSTEM_PROMPT_GENERAL = """You are StudyGenie, a friendly and fast AI study assistant.
Answer the student's question directly and concisely.
For math, show the solution step-by-step.
Keep answers short unless asked to elaborate."""


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # 1. Get or create session
        session_id = request.session_id
        if session_id:
            session = db.query(ChatSessionDB).filter(
                ChatSessionDB.id == session_id,
                ChatSessionDB.user_id == user.id,
            ).first()
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
        else:
            session_id = str(uuid.uuid4())
            # Use the first few words of the query as the session title
            title = request.query[:50] + ("..." if len(request.query) > 50 else "")
            session = ChatSessionDB(id=session_id, user_id=user.id, title=title)
            db.add(session)
            db.commit()

        # 2. Save user message
        user_msg = ChatMessageDB(
            session_id=session_id,
            role="user",
            content=request.query,
        )
        db.add(user_msg)
        db.commit()

        # 3. Smart routing — decide if we need RAG
        has_docs = rag_service.vector_store is not None
        use_rag = _needs_rag(request.query, has_docs)

        t0 = time.time()
        docs = []
        sources = []

        if use_rag:
            scored = rag_service.similarity_search_with_score(request.query, k=3, threshold=1.0)
            docs = [doc for doc, _ in scored]
            print(f"[PERF] RAG search: {time.time()-t0:.2f}s  ({len(scored)} relevant of 3 requested)")
            if docs:
                sources = [
                    Source(text=doc.page_content[:150], metadata=doc.metadata)
                    for doc in docs
                ]

        # 4. Build prompt
        past_messages = (
            db.query(ChatMessageDB)
            .filter(ChatMessageDB.session_id == session_id)
            .order_by(ChatMessageDB.created_at.desc())
            .limit(6)
            .all()
        )
        past_messages.reverse()

        if docs:
            context_text = "\n\n".join([doc.page_content for doc in docs])
            messages = [
                SystemMessage(content=SYSTEM_PROMPT_RAG),
                SystemMessage(content=f"Context:\n{context_text}"),
            ]
        else:
            messages = [SystemMessage(content=SYSTEM_PROMPT_GENERAL)]

        for msg in past_messages[:-1]:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(SystemMessage(content=msg.content))
        messages.append(HumanMessage(content=request.query))

        # 5. Generate answer
        t1 = time.time()
        response = invoke_llm(messages)
        answer = response.content
        print(f"[PERF] LLM invoke: {time.time()-t1:.2f}s  (total: {time.time()-t0:.2f}s)")

        # 7. Save assistant message
        assistant_msg = ChatMessageDB(
            session_id=session_id,
            role="assistant",
            content=answer,
            sources_json=json.dumps([s.model_dump() for s in sources]),
        )
        db.add(assistant_msg)
        db.commit()

        return ChatResponse(answer=answer, sources=sources, session_id=session_id)

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        error_msg = str(e)
        if "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg:
            raise HTTPException(
                status_code=429,
                detail="Gemini API quota exceeded. Please wait a minute or check your plan at https://ai.google.dev/pricing"
            )
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streaming chat endpoint — sends tokens as SSE for real-time display."""
    try:
        # 1. Get or create session
        session_id = request.session_id
        if session_id:
            session = db.query(ChatSessionDB).filter(
                ChatSessionDB.id == session_id,
                ChatSessionDB.user_id == user.id,
            ).first()
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
        else:
            session_id = str(uuid.uuid4())
            title = request.query[:50] + ("..." if len(request.query) > 50 else "")
            session = ChatSessionDB(id=session_id, user_id=user.id, title=title)
            db.add(session)
            db.commit()

        # 2. Save user message
        user_msg = ChatMessageDB(
            session_id=session_id,
            role="user",
            content=request.query,
        )
        db.add(user_msg)
        db.commit()

        # 3. Smart routing
        has_docs = rag_service.vector_store is not None
        use_rag = _needs_rag(request.query, has_docs)

        t0 = time.time()
        docs = []
        sources = []

        if use_rag:
            scored = rag_service.similarity_search_with_score(request.query, k=3, threshold=1.0)
            docs = [doc for doc, _ in scored]
            print(f"[PERF][stream] RAG search: {time.time()-t0:.2f}s  ({len(scored)} relevant)")
            if docs:
                sources = [
                    Source(text=doc.page_content[:150], metadata=doc.metadata)
                    for doc in docs
                ]

        # Build messages BEFORE the generator so they're ready to go
        past_messages = (
            db.query(ChatMessageDB)
            .filter(ChatMessageDB.session_id == session_id)
            .order_by(ChatMessageDB.created_at.desc())
            .limit(6)
            .all()
        )
        past_messages.reverse()

        if docs:
            context_text = "\n\n".join([doc.page_content for doc in docs])
            llm_messages = [
                SystemMessage(content=SYSTEM_PROMPT_RAG),
                SystemMessage(content=f"Context:\n{context_text}"),
            ]
        else:
            llm_messages = [SystemMessage(content=SYSTEM_PROMPT_GENERAL)]

        for msg in past_messages[:-1]:
            if msg.role == "user":
                llm_messages.append(HumanMessage(content=msg.content))
            else:
                llm_messages.append(SystemMessage(content=msg.content))
        llm_messages.append(HumanMessage(content=request.query))

        def generate():
            """SSE generator: streams session_id, sources, tokens, then [DONE]."""
            yield f"data: {json.dumps({'type': 'meta', 'session_id': session_id, 'sources': [s.model_dump() for s in sources]})}\n\n"

            # Stream tokens
            t1 = time.time()
            full_answer = ""
            for token in stream_llm(llm_messages):
                full_answer += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            print(f"[PERF][stream] LLM stream: {time.time()-t1:.2f}s  (total: {time.time()-t0:.2f}s)")

            # Save full answer to DB
            assistant_msg = ChatMessageDB(
                session_id=session_id,
                role="assistant",
                content=full_answer,
                sources_json=json.dumps([s.model_dump() for s in sources]),
            )
            db.add(assistant_msg)
            db.commit()

            yield "data: [DONE]\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Session management ---

@router.get("/sessions", response_model=SessionListResponse)
def list_sessions(
    user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all chat sessions for the current user."""
    sessions = (
        db.query(ChatSessionDB)
        .filter(ChatSessionDB.user_id == user.id)
        .order_by(ChatSessionDB.updated_at.desc())
        .all()
    )
    items = []
    for s in sessions:
        msg_count = db.query(ChatMessageDB).filter(ChatMessageDB.session_id == s.id).count()
        items.append(SessionSummary(
            id=s.id,
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
            message_count=msg_count,
        ))
    return SessionListResponse(sessions=items)


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full chat history for a session."""
    session = db.query(ChatSessionDB).filter(
        ChatSessionDB.id == session_id,
        ChatSessionDB.user_id == user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages_db = (
        db.query(ChatMessageDB)
        .filter(ChatMessageDB.session_id == session_id)
        .order_by(ChatMessageDB.created_at)
        .all()
    )
    messages = []
    for m in messages_db:
        msg = {"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
        if m.sources_json and m.sources_json != "[]":
            msg["sources"] = json.loads(m.sources_json)
        messages.append(msg)

    return SessionDetail(id=session.id, title=session.title, created_at=session.created_at, messages=messages)


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a chat session and all its messages."""
    session = db.query(ChatSessionDB).filter(
        ChatSessionDB.id == session_id,
        ChatSessionDB.user_id == user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"status": "deleted"}
