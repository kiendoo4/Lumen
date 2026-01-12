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
            chunks = self.text_splitter.split_text(text)
            
            result_chunks = []
            current_pos = 0
            
            for i, chunk in enumerate(chunks):
                # Find the position of this chunk in the original text
                chunk_start = text.find(chunk, current_pos)
                if chunk_start == -1:
                    chunk_start = current_pos
                
                chunk_end = chunk_start + len(chunk)
                
                # Determine page number if we have page information
                page_number = None
                if metadata and 'page_texts' in metadata:
                    for page_info in metadata['page_texts']:
                        if (chunk_start >= page_info['start_char'] and 
                            chunk_start < page_info['end_char']):
                            page_number = page_info['page_number']
                            break
                
                chunk_data = {
                    'chunk_index': i,
                    'content': chunk,
                    'start_char': chunk_start,
                    'end_char': chunk_end,
                    'page_number': page_number
                }
                
                result_chunks.append(chunk_data)
                current_pos = chunk_end
            
            logger.info(f"Created {len(result_chunks)} chunks from text")
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
