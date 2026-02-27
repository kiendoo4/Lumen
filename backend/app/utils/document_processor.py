import os
import pypdf
from docx import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List, Dict, Any, Optional, Tuple
import logging
import re

logger = logging.getLogger(__name__)

class DocumentProcessor:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

    def _make_anchors(self, text: str, words: int = 18) -> Dict[str, str]:
        """
        Create short, highlight-friendly anchor phrases from a chunk.
        These are used by the frontend to locate/underline text more reliably than full chunk matching.
        
        Generates 3 anchors:
        - anchor_start: First N words of the chunk (more reliable than offset approach)
        - anchor_end: Last N words of the chunk
        - anchor_middle: Middle N words of the chunk (for additional matching options)
        """
        if not text:
            return {"anchor_start": "", "anchor_end": "", "anchor_middle": ""}

        # Normalize whitespace but keep punctuation (frontend will normalize further)
        compact = re.sub(r"\s+", " ", text).strip()
        toks = [t for t in compact.split(" ") if t]
        if not toks:
            return {"anchor_start": "", "anchor_end": "", "anchor_middle": ""}

        # Take anchors from beginning, middle, and end of chunk for better matching
        # Start: first N words (more reliable than skipping the beginning)
        anchor_start = " ".join(toks[:min(words, len(toks))]).strip()
        
        # End: last N words
        end_start_idx = max(0, len(toks) - words)
        anchor_end = " ".join(toks[end_start_idx:]).strip()
        
        # Middle: N words from the middle of the chunk
        middle_start_idx = max(0, (len(toks) - words) // 2)
        anchor_middle = " ".join(toks[middle_start_idx:middle_start_idx + words]).strip()

        return {
            "anchor_start": anchor_start, 
            "anchor_end": anchor_end,
            "anchor_middle": anchor_middle
        }
    
    def detect_file_type(self, file_path: str) -> str:
        """Detect file type using file extension"""
        try:
            ext = os.path.splitext(file_path)[1].lower()
            if ext == '.pdf':
                return 'application/pdf'
            elif ext in ['.doc', '.docx']:
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            elif ext == '.txt':
                return 'text/plain'
            else:
                return 'application/octet-stream'
        except Exception as e:
            logger.error(f"Error detecting file type: {e}")
            return 'application/octet-stream'
    
    def extract_text_from_pdf(self, file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from PDF file"""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = pypdf.PdfReader(file)
                
                # Extract metadata
                metadata = {
                    'total_pages': len(pdf_reader.pages),
                    'title': None,
                    'authors': None,
                    'abstract': None
                }
                
                # Try to extract metadata from PDF info
                if pdf_reader.metadata:
                    metadata['title'] = pdf_reader.metadata.get('/Title', '').strip()
                    metadata['authors'] = pdf_reader.metadata.get('/Author', '').strip()
                
                # Extract text from all pages
                full_text = ""
                page_texts = []
                
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        page_text = page.extract_text()
                        page_texts.append({
                            'page_number': page_num + 1,
                            'text': page_text,
                            'start_char': len(full_text),
                            'end_char': len(full_text) + len(page_text)
                        })
                        full_text += page_text + "\n"
                    except Exception as e:
                        logger.warning(f"Error extracting text from page {page_num + 1}: {e}")
                        continue
                
                # Try to extract title and abstract from first few pages if not in metadata
                if not metadata['title'] or not metadata['abstract']:
                    first_pages_text = ""
                    for i in range(min(3, len(page_texts))):
                        first_pages_text += page_texts[i]['text'] + "\n"
                    
                    # Extract title (usually in first few lines, often in caps or bold)
                    if not metadata['title']:
                        title_match = self._extract_title_from_text(first_pages_text)
                        if title_match:
                            metadata['title'] = title_match
                    
                    # Extract abstract
                    if not metadata['abstract']:
                        abstract_match = self._extract_abstract_from_text(first_pages_text)
                        if abstract_match:
                            metadata['abstract'] = abstract_match
                
                metadata['page_texts'] = page_texts
                return full_text, metadata
                
        except Exception as e:
            logger.error(f"Error extracting text from PDF {file_path}: {e}")
            return "", {}
    
    def extract_text_from_docx(self, file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from DOCX file"""
        try:
            doc = Document(file_path)
            
            # Extract metadata
            metadata = {
                'total_pages': None,  # DOCX doesn't have clear page concept
                'title': doc.core_properties.title or None,
                'authors': doc.core_properties.author or None,
                'abstract': None
            }
            
            # Extract text from all paragraphs
            full_text = ""
            paragraphs = []
            
            for para in doc.paragraphs:
                para_text = para.text.strip()
                if para_text:
                    paragraphs.append({
                        'text': para_text,
                        'start_char': len(full_text),
                        'end_char': len(full_text) + len(para_text)
                    })
                    full_text += para_text + "\n"
            
            # Try to extract abstract from first few paragraphs
            if not metadata['abstract']:
                first_text = "\n".join([p['text'] for p in paragraphs[:10]])
                abstract_match = self._extract_abstract_from_text(first_text)
                if abstract_match:
                    metadata['abstract'] = abstract_match
            
            metadata['paragraphs'] = paragraphs
            return full_text, metadata
            
        except Exception as e:
            logger.error(f"Error extracting text from DOCX {file_path}: {e}")
            return "", {}
    
    def extract_text_from_txt(self, file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from TXT file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                full_text = file.read()
            
            metadata = {
                'total_pages': None,
                'title': None,
                'authors': None,
                'abstract': None
            }
            
            # Try to extract title and abstract from first part
            first_lines = full_text[:2000]  # First 2000 characters
            
            title_match = self._extract_title_from_text(first_lines)
            if title_match:
                metadata['title'] = title_match
            
            abstract_match = self._extract_abstract_from_text(first_lines)
            if abstract_match:
                metadata['abstract'] = abstract_match
            
            return full_text, metadata
            
        except Exception as e:
            logger.error(f"Error extracting text from TXT {file_path}: {e}")
            return "", {}
    
    def _extract_title_from_text(self, text: str) -> Optional[str]:
        """Extract title from text using heuristics"""
        lines = text.split('\n')[:10]  # First 10 lines
        
        for line in lines:
            line = line.strip()
            if len(line) > 10 and len(line) < 200:
                # Check if line looks like a title
                if (line.isupper() or 
                    (line[0].isupper() and not line.endswith('.')) or
                    re.match(r'^[A-Z][^.]*[^.]$', line)):
                    return line
        
        return None
    
    def _extract_abstract_from_text(self, text: str) -> Optional[str]:
        """Extract abstract from text using pattern matching"""
        # Common abstract patterns
        patterns = [
            r'(?i)abstract[:\s]*\n?(.*?)(?=\n\s*(?:keywords?|introduction|1\.|background))',
            r'(?i)summary[:\s]*\n?(.*?)(?=\n\s*(?:keywords?|introduction|1\.|background))',
            r'(?i)overview[:\s]*\n?(.*?)(?=\n\s*(?:keywords?|introduction|1\.|background))'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL | re.MULTILINE)
            if match:
                abstract = match.group(1).strip()
                # Clean up the abstract
                abstract = re.sub(r'\s+', ' ', abstract)
                if len(abstract) > 50 and len(abstract) < 2000:
                    return abstract
        
        return None
    
    def extract_text(self, file_path: str) -> Tuple[str, Dict[str, Any]]:
        """Extract text from file based on its type"""
        file_type = self.detect_file_type(file_path)
        
        if 'pdf' in file_type.lower():
            return self.extract_text_from_pdf(file_path)
        elif 'word' in file_type.lower() or 'docx' in file_type.lower():
            return self.extract_text_from_docx(file_path)
        elif 'text' in file_type.lower():
            return self.extract_text_from_txt(file_path)
        else:
            logger.warning(f"Unsupported file type: {file_type}")
            return "", {}
    
    def chunk_text(self, text: str, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Split text into chunks"""
        try:
            result_chunks: List[Dict[str, Any]] = []

            # IMPORTANT: If we have per-page text, chunk per page to avoid chunks spanning page boundaries.
            if metadata and 'page_texts' in metadata and metadata['page_texts']:
                chunk_index = 0
                for page_info in metadata['page_texts']:
                    page_number = page_info.get('page_number')
                    page_text = page_info.get('text') or ""
                    page_base = int(page_info.get('start_char') or 0)

                    if not page_text.strip():
                        continue

                    page_chunks = self.text_splitter.split_text(page_text)
                    page_current_pos = 0

                    for chunk in page_chunks:
                        chunk_start_in_page = page_text.find(chunk, page_current_pos)
                        if chunk_start_in_page == -1:
                            chunk_start_in_page = page_current_pos
                        chunk_end_in_page = chunk_start_in_page + len(chunk)

                        # Convert to global offsets
                        chunk_start = page_base + chunk_start_in_page
                        chunk_end = page_base + chunk_end_in_page

                        anchors = self._make_anchors(chunk)

                        result_chunks.append({
                            'chunk_index': chunk_index,
                            'content': chunk,
                            'page_number': page_number,
                            'start_char': chunk_start,
                            'end_char': chunk_end,
                            # Offsets within the page-extracted text
                            'page_start_char': chunk_start_in_page,
                            'page_end_char': chunk_end_in_page,
                            **anchors
                        })

                        chunk_index += 1
                        page_current_pos = chunk_end_in_page

                logger.info(f"Created {len(result_chunks)} chunks from per-page text")
                return result_chunks

            # Fallback: chunk whole document (e.g., TXT/DOCX); page_number will be None
            chunks = self.text_splitter.split_text(text)
            current_pos = 0

            for i, chunk in enumerate(chunks):
                chunk_start = text.find(chunk, current_pos)
                if chunk_start == -1:
                    chunk_start = current_pos
                chunk_end = chunk_start + len(chunk)

                anchors = self._make_anchors(chunk)

                result_chunks.append({
                    'chunk_index': i,
                    'content': chunk,
                    'start_char': chunk_start,
                    'end_char': chunk_end,
                    'page_number': None,
                    'page_start_char': None,
                    'page_end_char': None,
                    **anchors
                })

                current_pos = chunk_end

            logger.info(f"Created {len(result_chunks)} chunks from whole-document text")
            return result_chunks
            
        except Exception as e:
            logger.error(f"Error chunking text: {e}")
            return []
    
    def process_document(self, file_path: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Process document: extract text, metadata, and create chunks"""
        try:
            # Extract text and metadata
            full_text, metadata = self.extract_text(file_path)
            
            if not full_text:
                logger.error(f"No text extracted from {file_path}")
                return [], {}
            
            # Create chunks
            chunks = self.chunk_text(full_text, metadata)
            
            logger.info(f"Successfully processed document {file_path}: {len(chunks)} chunks")
            return chunks, metadata
            
        except Exception as e:
            logger.error(f"Error processing document {file_path}: {e}")
            return [], {}

# Global instance
document_processor = DocumentProcessor()
