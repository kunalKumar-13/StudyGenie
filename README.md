# StudyGenie — RAG-Based AI Study Assistant

A local-first, full-stack GenAI study assistant with a premium, polished UI. Upload your notes and ask questions — answers are grounded in your actual documents using a **RAG pipeline**, not hallucinated.

> This project is designed to run locally and is not deployed publicly to avoid reliance on paid APIs.

---

## Screenshots

| Login | Chat (Math + Streaming) |
|-------|------------------------|
| ![Login](screenshots/login.png) | ![Chat](screenshots/chat.png) |

---

## How It Works

```
Upload notes → chunked → embedded → stored in FAISS
                                          ↓
Ask a question → Smart Router → needs docs? → YES → search FAISS → relevant chunks
                                            → NO  ─────────────────────┐
                                                                       ↓
                                              LLM generates answer (streamed in real-time)
```

1. **Upload** — PDF / TXT / MD → split into chunks → embedded into vectors
2. **Ask** — Smart router skips RAG for simple questions (math, greetings)
3. **Retrieve** — FAISS finds relevant chunks, irrelevant ones filtered by score
4. **Generate** — LLM streams the answer token-by-token
5. **Cite** — Collapsible source tags show which document was used

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Rendering | React Markdown, KaTeX (math) |
| Backend | FastAPI, Python 3.12 |
| Auth | JWT + bcrypt |
| Database | SQLite + SQLAlchemy |
| Vector Store | FAISS |
| Embeddings | Ollama `nomic-embed-text` |
| LLM | Ollama `llama3` (default) / Gemini 2.0 Flash (optional) |
| Orchestration | LangChain |
| Streaming | Server-Sent Events (SSE) |

---

## Features

- **RAG Pipeline** — Answers grounded in uploaded documents
- **100% Local** — Runs via Ollama, no API key needed
- **Streaming** — Tokens appear in real-time
- **Smart Routing** — Math / greetings skip RAG for instant answers
- **Relevance Filtering** — Sources shown only when actually relevant
- **Auth** — JWT login/register with hashed passwords
- **Chat History** — Multiple saved sessions
- **Math Support** — LaTeX rendered via KaTeX
- **Dual LLM** — Optional Gemini with automatic Ollama fallback

---

## Project Structure

```
StudyGenie/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── api/endpoints/
│   │   │   ├── auth.py          # Login / Register
│   │   │   ├── chat.py          # Chat + Streaming + Routing
│   │   │   └── documents.py     # Upload / List / Delete
│   │   ├── core/
│   │   │   ├── config.py        # Settings (.env)
│   │   │   ├── database.py      # SQLAlchemy + DB
│   │   │   └── auth.py          # JWT tokens
│   │   └── services/
│   │       ├── ingestion.py     # Chunking + processing
│   │       └── rag.py           # FAISS + embeddings
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/client.ts        # API + SSE streaming
│   │   └── components/
│   │       ├── AuthPage.tsx
│   │       ├── ChatInterface.tsx
│   │       └── Sidebar.tsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## How to Run

### Prerequisites

- Python 3.12+
- Node.js 18+
- [Ollama](https://ollama.com)

### 1. Ollama

```bash
ollama pull llama3
ollama pull nomic-embed-text
ollama serve
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # Windows
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Open the App

Open the local URL shown in the terminal, register an account, upload your notes, and start asking questions.

---

## Optional: Gemini API

For faster cloud-based responses, add a free [Gemini API key](https://aistudio.google.com/apikey) to `backend/.env`:

```
GEMINI_API_KEY=your_key_here
LLM_PROVIDER=gemini
```

Gemini is used for chat with automatic Ollama fallback if quota is exceeded.

---

## What I Learned

- How **RAG pipelines** work end-to-end (chunking → embedding → retrieval → generation)
- **Local vs cloud LLM** trade-offs (latency, quality, cost)
- **SSE streaming** for real-time token delivery
- **Smart query routing** to skip expensive operations
- **Relevance filtering** with vector similarity scores
- Full-stack integration: React + FastAPI + FAISS + LangChain

This project deepened my understanding of latency, model quality trade-offs, real-time streaming systems, and multi-model integration.

---

## License

MIT
