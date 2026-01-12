# Chat with Paper Feature

## Overview

The "Chat with Paper" feature allows users to upload research papers (PDF, DOCX, TXT) and have intelligent conversations with the document content using RAG (Retrieval-Augmented Generation) technology.

## Key Features

### 1. Document Upload
- Support for PDF, DOCX, and TXT files
- Maximum file size: 50MB
- Drag & drop interface
- Real-time upload progress

### 2. Document Processing
- Automatic text extraction
- Intelligent chunking with overlap
- Semantic embedding generation
- Vector storage in Qdrant database
- Progress tracking with visual feedback

### 3. Chat Interface
- Split-screen layout: PDF viewer + Chat panel
- Real-time conversation with the document
- Citation-based responses with page references
- Highlighted relevant chunks
- Suggested starter questions

### 4. RAG-Powered Responses
- Semantic search through document content
- Context-aware answers based only on document content
- Precise citations with page numbers
- Relevance scoring for retrieved chunks

## Architecture

### Backend Components

1. **Document Processing Pipeline**
   - `DocumentProcessor`: Text extraction and chunking
   - `QdrantManager`: Vector database operations
   - `MinIOClient`: File storage management

2. **Database Models**
   - `PaperDocument`: Document metadata and status
   - `DocumentChunk`: Text chunks with embeddings
   - `PaperChatSession`: Chat session management
   - `PaperChatMessage`: Conversation history

3. **AI Agent System**
   - `PaperChatAgent`: Specialized agent for document Q&A
   - `search_paper_rag`: RAG tool for semantic search
   - Citation extraction and formatting

### Frontend Components

1. **DocumentUpload**: File upload interface
2. **DocumentProcessing**: Processing status display
3. **PaperChatInterface**: Main chat interface with PDF viewer

## API Endpoints

### Document Management
- `POST /api/paper-chat/upload` - Upload document
- `GET /api/paper-chat/documents` - List user documents
- `GET /api/paper-chat/documents/{id}/status` - Check processing status
- `GET /api/paper-chat/documents/{id}/url` - Get document URL
- `DELETE /api/paper-chat/documents/{id}` - Delete document

### Chat Sessions
- `POST /api/paper-chat/documents/{id}/sessions` - Create chat session
- `GET /api/paper-chat/sessions` - List user sessions
- `GET /api/paper-chat/sessions/{id}/messages` - Get session messages
- `POST /api/paper-chat/sessions/{id}/chat` - Send message
- `DELETE /api/paper-chat/sessions/{id}` - Delete session

## Usage Flow

1. **Upload Document**
   - Navigate to `/paper-chat/upload`
   - Upload PDF/DOCX/TXT file
   - Wait for processing completion

2. **Start Chatting**
   - Automatic redirect to chat interface
   - PDF viewer on left, chat on right
   - Ask questions about the document

3. **Interactive Features**
   - Click citations to highlight relevant sections
   - Use suggested questions to get started
   - View page references for all answers

## Technical Details

### Vector Database (Qdrant)
- Collection per document for isolation
- 1024-dimensional embeddings (intfloat/multilingual-e5-large-instruct)
- Cosine similarity search
- Metadata filtering by document ID

### Document Processing
- Recursive character text splitting
- 1000 character chunks with 200 character overlap
- Page number tracking for citations
- Automatic title/author/abstract extraction

### RAG Implementation
- Query embedding generation
- Top-k similarity search (default k=5)
- Context injection with citations
- Response filtering to document content only

## Configuration

### Environment Variables
```env
# Qdrant Configuration
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_API_KEY=optional

# Embedding Model
EMBEDDING_MODEL=intfloat/multilingual-e5-large-instruct
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

### Docker Services
```yaml
qdrant:
  image: qdrant/qdrant:latest
  ports:
    - "6333:6333"
    - "6334:6334"
```

## Development Notes

### Adding New File Types
1. Update `DocumentProcessor.extract_text()` method
2. Add MIME type to allowed types in upload endpoint
3. Update frontend file validation

### Customizing Chunking Strategy
- Modify `DocumentProcessor.chunk_text()` parameters
- Adjust `CHUNK_SIZE` and `CHUNK_OVERLAP` in config
- Consider domain-specific splitting strategies

### Improving RAG Performance
- Experiment with different embedding models
- Adjust similarity search parameters
- Implement query expansion techniques
- Add re-ranking mechanisms

## Troubleshooting

### Common Issues

1. **Document Processing Fails**
   - Check file format compatibility
   - Verify Qdrant connection
   - Review processing logs

2. **Poor Search Results**
   - Ensure document is properly chunked
   - Check embedding model performance
   - Verify query formulation

3. **PDF Display Issues**
   - Check MinIO presigned URL generation
   - Verify CORS settings
   - Test file accessibility

### Monitoring
- Check processing status in database
- Monitor Qdrant collection health
- Review agent reasoning steps
- Track citation accuracy

## Future Enhancements

1. **Multi-Document Chat**: Chat across multiple papers
2. **Advanced PDF Viewer**: Annotation and highlighting
3. **Export Features**: Save conversations and citations
4. **Collaborative Features**: Share documents and chats
5. **Analytics**: Usage tracking and performance metrics
