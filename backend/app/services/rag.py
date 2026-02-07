from typing import List, Tuple
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from app.core.config import settings
import os
import time

# ---------------------------------------------------------------------------
# Embeddings: Gemini (fast, cloud) with Ollama fallback (local, slower)
# ---------------------------------------------------------------------------
_embeddings = None

def _init_embeddings():
    global _embeddings
    if _embeddings is not None:
        return _embeddings

    # Try Gemini embeddings first — much faster than local Ollama
    if settings.GEMINI_API_KEY:
        try:
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            _embeddings = GoogleGenerativeAIEmbeddings(
                model=settings.GEMINI_EMBEDDING_MODEL,
                google_api_key=settings.GEMINI_API_KEY,
            )
            # Quick smoke test
            _embeddings.embed_query("test")
            print("[Embeddings] Using Gemini embeddings (fast, cloud)")
            return _embeddings
        except Exception as e:
            err = str(e)
            print(f"[Embeddings] Gemini embeddings failed ({err[:80]}), trying Ollama...")
            _embeddings = None

    # Fallback: Ollama local embeddings
    try:
        from langchain_ollama import OllamaEmbeddings
        _embeddings = OllamaEmbeddings(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_EMBEDDING_MODEL,
        )
        # Warm up Ollama so first real query is fast (cold start takes ~3s)
        print("[Embeddings] Warming up Ollama embeddings...")
        t0 = time.time()
        _embeddings.embed_query("warmup")
        print(f"[Embeddings] Ollama ready ({time.time()-t0:.1f}s warmup)")
        return _embeddings
    except Exception as e:
        print(f"[Embeddings] Ollama embeddings also failed: {e}")
        raise RuntimeError("No embedding provider available")


class RAGService:
    def __init__(self):
        self.persist_directory = "data/faiss_index"
        self.index_name = "index"
        os.makedirs(self.persist_directory, exist_ok=True)

        self.embeddings = _init_embeddings()

        self.vector_store = None
        index_file_path = os.path.join(self.persist_directory, f"{self.index_name}.faiss")
        if os.path.exists(index_file_path):
            try:
                self.vector_store = FAISS.load_local(
                    folder_path=self.persist_directory,
                    embeddings=self.embeddings,
                    index_name=self.index_name,
                    allow_dangerous_deserialization=True,
                )
            except Exception as e:
                print(f"[RAG] Failed to load FAISS index: {e}")
                print("[RAG] Index may have been built with different embeddings. Will rebuild on next upload.")

    def add_documents(self, chunks: List[str], metadatas: List[dict]):
        docs = [Document(page_content=text, metadata=meta) for text, meta in zip(chunks, metadatas)]
        if self.vector_store:
            self.vector_store.add_documents(docs)
        else:
            self.vector_store = FAISS.from_documents(docs, self.embeddings)
        self.vector_store.save_local(self.persist_directory, index_name=self.index_name)

    def similarity_search(self, query: str, k: int = 3) -> List[Document]:
        if not self.vector_store:
            return []
        return self.vector_store.similarity_search(query, k=k)

    def similarity_search_with_score(self, query: str, k: int = 3, threshold: float = 1.2) -> List[Tuple[Document, float]]:
        """Return docs with L2 distance scores. Lower = more relevant.
        Only return docs below the threshold."""
        if not self.vector_store:
            return []
        t0 = time.time()
        results = self.vector_store.similarity_search_with_score(query, k=k)
        print(f"[PERF] FAISS search + embed: {time.time()-t0:.2f}s | scores: {[f'{s:.2f}' for _, s in results]}")
        # Filter by threshold — skip irrelevant docs
        return [(doc, score) for doc, score in results if score < threshold]
