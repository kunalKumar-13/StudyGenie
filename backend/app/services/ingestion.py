import os
from typing import List
from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.models.document import DocumentChunk
import tempfile

class IngestionService:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            length_function=len,
        )

    async def process_document(self, file: UploadFile) -> List[DocumentChunk]:
        # Save uploaded file to a temporary file
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            documents = []
            if file_ext == ".pdf":
                loader = PyPDFLoader(tmp_path)
                documents = loader.load()
                # Replace temp path with original filename in metadata
                for doc in documents:
                    doc.metadata["source"] = file.filename
            elif file_ext in [".txt", ".md"]:
                with open(tmp_path, "r", encoding="utf-8") as f:
                    text = f.read()
                texts = self.text_splitter.create_documents([text], metadatas=[{"source": file.filename}])
                documents = texts
            else:
                raise ValueError(f"Unsupported file type: {file_ext}")

            # Split documents into chunks
            chunks = self.text_splitter.split_documents(documents)
            
            # Convert to internal model
            doc_chunks = []
            for i, chunk in enumerate(chunks):
                doc_chunks.append(DocumentChunk(
                    text=chunk.page_content,
                    metadata=chunk.metadata,
                    chunk_index=i
                ))
            
            return doc_chunks

        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
