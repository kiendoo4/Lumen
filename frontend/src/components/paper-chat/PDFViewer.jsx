import React, { useRef, useEffect, useState } from 'react';
import './PDFViewer.css';

// Simple PDF.js integration for better highlighting control
const PDFViewer = React.forwardRef(({ pdfUrl, highlightedChunks = [], onPageChange }, ref) => {
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageInput, setPageInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1.0); // Default 100%
  const [containerReady, setContainerReady] = useState(false);

  // Callback ref to detect when container is mounted
  const setContainerRef = (node) => {
    containerRef.current = node;
    if (node) {
      setContainerReady(true);
    }
  };

  // When pdfUrl or container is ready, attempt to load PDF once
  useEffect(() => {
    if (pdfUrl && containerReady) {
      loadPDF();
    }
  }, [pdfUrl, containerReady]);

  // Add ResizeObserver to re-render when container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdfDoc) return;

    let resizeTimeout;
    let lastWidth = container.clientWidth;

    const resizeObserver = new ResizeObserver((entries) => {
      // Debounce resize events
      clearTimeout(resizeTimeout);
      
      resizeTimeout = setTimeout(() => {
        const newWidth = container.clientWidth;
        // Only re-render if width actually changed significantly (more than 50px)
        if (Math.abs(newWidth - lastWidth) > 50 && newWidth > 0) {
          console.log(`Container resized significantly: ${lastWidth}px → ${newWidth}px, re-rendering PDF`);
          lastWidth = newWidth;
          renderAllPages(pdfDoc);
        }
      }, 500); // Debounce 500ms
    });

    resizeObserver.observe(container);

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [pdfDoc, zoomLevel]);

  useEffect(() => {
    if (highlightedChunks.length > 0 && pdfDoc) {
      highlightChunks();
    }
  }, [highlightedChunks, pdfDoc, currentPage]);

  const loadPDF = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Container should be ready now, but wait for width if needed
      if (!containerRef.current) {
        throw new Error('PDF container not available. Please refresh the page.');
      }
      
      // Wait for container to have width (should be quick if container is ready)
      let retries = 0;
      const maxRetries = 20; // Wait up to 2 seconds
      while (containerRef.current.clientWidth <= 0 && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
      
      if (containerRef.current.clientWidth <= 0) {
        console.warn('Container width is 0, will use default width');
      }
      
      // Check if PDF.js is available
      if (!window.pdfjsLib) {
        throw new Error('PDF.js library not loaded');
      }
      
      // Configure PDF.js worker
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      
      const pdf = await window.pdfjsLib.getDocument(pdfUrl).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      
      // Render all pages (will wait for container width inside)
      await renderAllPages(pdf);
      
      // Ensure loading is set to false after successful render
      console.log('PDF loaded and rendered successfully');
      setIsLoading(false);
      
      // Force container to be visible and trigger a repaint
      if (containerRef.current) {
        containerRef.current.style.opacity = '0';
        requestAnimationFrame(() => {
          containerRef.current.style.opacity = '1';
        });
      }
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError(`Failed to load PDF: ${err.message}`);
      setIsLoading(false);
    }
  };

  const renderAllPages = async (pdf = pdfDoc) => {
    if (!pdf || !containerRef.current) return;

    try {
      // Wait for container to have width
      let containerWidth = containerRef.current.clientWidth - 40;
      let retries = 0;
      const maxRetries = 10;
      
      while (containerWidth <= 0 && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        containerWidth = containerRef.current.clientWidth - 40;
        retries++;
      }
      
      // Fallback to a reasonable default width if still 0
      if (containerWidth <= 0) {
        containerWidth = 800; // Default width
        console.warn('Container width not available, using default:', containerWidth);
      }
      
      // Clear container
      containerRef.current.innerHTML = '';
      console.log(`Starting to render ${pdf.numPages} pages with container width: ${containerWidth}`);
      
      // Render all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        
        // Calculate scale to fit container width at 100% zoom
        const baseViewport = page.getViewport({ scale: 1.0 });
        const baseScale = containerWidth / baseViewport.width;
        
        // Apply zoom level to the base scale
        const finalScale = baseScale * zoomLevel;
        const viewport = page.getViewport({ scale: finalScale });
        
        // Create canvas with high DPI support
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Set actual canvas size for high DPI
        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.height = viewport.height * devicePixelRatio;
        canvas.width = viewport.width * devicePixelRatio;
        
        // Set display size and ensure visibility
        canvas.style.height = `${viewport.height}px`;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';
        
        // Scale context for high DPI
        context.scale(devicePixelRatio, devicePixelRatio);
        
        // Create text layer for text selection and highlighting
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.position = 'absolute';
        textLayerDiv.style.left = '0';
        textLayerDiv.style.top = '0';
        textLayerDiv.style.right = '0';
        textLayerDiv.style.bottom = '0';
        textLayerDiv.style.overflow = 'hidden';
        textLayerDiv.style.opacity = '0.2';
        textLayerDiv.style.lineHeight = '1.0';
        textLayerDiv.style.setProperty('--scale-factor', finalScale.toString());
        
        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container';
        pageContainer.style.position = 'relative';
        pageContainer.style.marginBottom = '20px';
        pageContainer.style.setProperty('--scale-factor', finalScale.toString());
        pageContainer.setAttribute('data-page-number', pageNum);
        
        // Add page number label
        const pageLabel = document.createElement('div');
        pageLabel.className = 'page-label';
        pageLabel.textContent = `Page ${pageNum}`;
        pageLabel.style.position = 'absolute';
        pageLabel.style.top = '-25px';
        pageLabel.style.left = '0';
        pageLabel.style.fontSize = '12px';
        pageLabel.style.color = 'var(--text-secondary)';
        pageLabel.style.fontWeight = '500';
        
        pageContainer.appendChild(pageLabel);
        pageContainer.appendChild(canvas);
        pageContainer.appendChild(textLayerDiv);
        containerRef.current.appendChild(pageContainer);
        console.log(`Rendered page ${pageNum}/${pdf.numPages}`);
        
        // Render PDF page
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Render text layer for highlighting
        const textContent = await page.getTextContent();
        
        if (window.pdfjsLib.renderTextLayer) {
          window.pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: [],
            textContentItemsStr: []
          });
        } else {
          // Fallback: create simple text divs manually
          textContent.items.forEach((item, index) => {
            const textDiv = document.createElement('span');
            textDiv.textContent = item.str;
            textDiv.style.position = 'absolute';
            textDiv.style.left = `${item.transform[4]}px`;
            textDiv.style.top = `${item.transform[5]}px`;
            textDiv.style.fontSize = `${item.transform[0]}px`;
            textDiv.style.fontFamily = item.fontName || 'sans-serif';
            textDiv.style.color = 'transparent';
            textDiv.style.userSelect = 'text';
            textDiv.setAttribute('data-text-index', index);
            textLayerDiv.appendChild(textDiv);
          });
        }
      }
      
      // Update current page based on scroll position
      updateCurrentPageFromScroll();
      
      console.log(`Successfully rendered ${pdf.numPages} pages`);
      console.log('Container children count:', containerRef.current.children.length);
      console.log('Container innerHTML length:', containerRef.current.innerHTML.length);
      
    } catch (err) {
      console.error('Error rendering pages:', err);
      // If rendering fails, still set loading to false to show error
      setIsLoading(false);
      setError(`Failed to render PDF pages: ${err.message}`);
    }
  };

  const updateCurrentPageFromScroll = () => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const scrollCenter = scrollTop + containerHeight / 2;
    
    // Find which page is in the center of the viewport
    const pageContainers = container.querySelectorAll('.page-container');
    let newCurrentPage = 1;
    
    pageContainers.forEach((pageContainer, index) => {
      const pageTop = pageContainer.offsetTop;
      const pageBottom = pageTop + pageContainer.offsetHeight;
      
      if (scrollCenter >= pageTop && scrollCenter <= pageBottom) {
        newCurrentPage = index + 1;
      }
    });
    
    if (newCurrentPage !== currentPage) {
      setCurrentPage(newCurrentPage);
      if (onPageChange) {
        onPageChange(newCurrentPage);
      }
    }
  };

  const highlightChunks = () => {
    if (!containerRef.current || highlightedChunks.length === 0) return;
    
    // Remove existing highlights
    const existingHighlights = containerRef.current.querySelectorAll('.pdf-highlight');
    existingHighlights.forEach(el => el.remove());
    
    highlightedChunks.forEach(chunk => {
      if (chunk.page_number === currentPage && chunk.content) {
        highlightTextInPage(chunk.content.substring(0, 100));
      }
    });
  };

  const highlightTextInPage = (searchText, highlightType = 'search') => {
    if (!containerRef.current || !searchText) return;
    
    console.log('Highlighting text:', searchText, 'Type:', highlightType);
    
    // Remove existing highlights of the same type first
    const existingHighlights = containerRef.current.querySelectorAll(`.pdf-highlight-${highlightType}`);
    existingHighlights.forEach(highlight => {
      const parent = highlight.parentNode;
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      parent.normalize(); // Merge adjacent text nodes
    });
    
    // Find and highlight text in all text layers (all pages)
    const textLayers = containerRef.current.querySelectorAll('.textLayer');
    const searchLower = searchText.toLowerCase();
    let highlightCount = 0;
    
    textLayers.forEach(textLayer => {
      const textSpans = textLayer.querySelectorAll('span[data-text-index]');
      
      textSpans.forEach(span => {
        const text = span.textContent;
        const textLower = text.toLowerCase();
        
        if (textLower.includes(searchLower)) {
          const index = textLower.indexOf(searchLower);
          if (index !== -1) {
            const beforeText = text.substring(0, index);
            const matchText = text.substring(index, index + searchText.length);
            const afterText = text.substring(index + searchText.length);
            
            // Clear span content
            span.innerHTML = '';
            
            // Add parts with highlight
            if (beforeText) {
              span.appendChild(document.createTextNode(beforeText));
            }
            
            const highlightSpan = document.createElement('span');
            highlightSpan.className = `pdf-highlight pdf-highlight-${highlightType}`;
            
            // Different colors for different highlight types
            if (highlightType === 'citation') {
              // Light purple for citations
              highlightSpan.style.backgroundColor = 'rgba(147, 51, 234, 0.3)';
              highlightSpan.style.boxShadow = '0 0 0 1px rgba(147, 51, 234, 0.6)';
            } else {
              // Yellow for search
              highlightSpan.style.backgroundColor = 'rgba(255, 255, 0, 0.6)';
              highlightSpan.style.boxShadow = '0 0 0 1px rgba(255, 193, 7, 0.8)';
            }
            
            highlightSpan.style.padding = '1px 2px';
            highlightSpan.style.borderRadius = '2px';
            highlightSpan.textContent = matchText;
            span.appendChild(highlightSpan);
            
            if (afterText) {
              span.appendChild(document.createTextNode(afterText));
            }
            
            highlightCount++;
            console.log(`Highlighted text (${highlightType}):`, matchText);
          }
        }
      });
    });
    
    console.log(`Total highlights created (${highlightType}):`, highlightCount);
    return highlightCount;
  };

  const goToPage = async (pageNum) => {
    if (pageNum < 1 || pageNum > totalPages || !containerRef.current) return;
    
    // Find the page container and scroll to it
    const pageContainer = containerRef.current.querySelector(`[data-page-number="${pageNum}"]`);
    if (pageContainer) {
      pageContainer.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const handlePageInputChange = (e) => {
    const value = e.target.value;
    setPageInput(value);
  };

  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput);
    if (pageNum >= 1 && pageNum <= totalPages) {
      goToPage(pageNum);
      setPageInput('');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchText.trim()) {
      console.log('Searching for:', searchText.trim());
      highlightTextInPage(searchText.trim(), 'search');
    }
  };

  const clearSearch = () => {
    setSearchText('');
    // Remove search highlights only
    if (containerRef.current) {
      const searchHighlights = containerRef.current.querySelectorAll('.pdf-highlight-search');
      searchHighlights.forEach(highlight => {
        const parent = highlight.parentNode;
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
        parent.normalize();
      });
    }
  };

  const clearCitationHighlights = () => {
    // Remove citation highlights only
    if (containerRef.current) {
      const citationHighlights = containerRef.current.querySelectorAll('.pdf-highlight-citation');
      citationHighlights.forEach(highlight => {
        const parent = highlight.parentNode;
        parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
        parent.normalize();
      });
    }
  };

  const highlightCitationText = (citation) => {
    console.log('Highlighting citation:', citation);
    
    // Clear previous citation highlights
    clearCitationHighlights();
    
    if (!citation || !citation.content) {
      console.log('No citation content to highlight');
      return;
    }
    
    // First, scroll to the page if specified
    if (citation.page_number) {
      goToPage(citation.page_number);
    }
    
    // Highlight the citation text with purple color
    setTimeout(() => {
      // Try different text snippets for highlighting
      const textToHighlight = citation.content.substring(0, 100).trim();
      const shortText = citation.content.substring(0, 50).trim();
      const mediumText = citation.content.substring(0, 75).trim();
      
      console.log('Trying to highlight citation text:', textToHighlight);
      
      // Try highlighting with different text lengths
      let highlightCount = highlightTextInPage(textToHighlight, 'citation');
      
      if (highlightCount === 0) {
        console.log('Trying shorter text for highlighting');
        highlightCount = highlightTextInPage(mediumText, 'citation');
      }
      
      if (highlightCount === 0) {
        console.log('Trying even shorter text for highlighting');
        highlightCount = highlightTextInPage(shortText, 'citation');
      }
      
      if (highlightCount === 0) {
        console.log('No text highlighted, trying word-by-word');
        // Try highlighting individual words
        const words = textToHighlight.split(' ').filter(word => word.length > 3);
        words.slice(0, 3).forEach(word => {
          highlightTextInPage(word.trim(), 'citation');
        });
      }
    }, 500); // Delay to ensure page is scrolled first
  };

  const zoomIn = () => {
    const newZoom = Math.min(zoomLevel * 1.25, 3.0); // Max 300%
    setZoomLevel(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(zoomLevel / 1.25, 0.5); // Min 50%
    setZoomLevel(newZoom);
  };

  const resetZoom = () => {
    setZoomLevel(1.0); // Reset to 100%
  };

  // Re-render all pages when zoom changes
  useEffect(() => {
    if (pdfDoc) {
      console.log(`Zoom level changed to ${zoomLevel}, re-rendering PDF`);
      renderAllPages(pdfDoc);
    }
  }, [zoomLevel]);

  // Add scroll listener to update current page
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      updateCurrentPageFromScroll();
    };

    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [currentPage]);

  // Add mouse wheel zoom support
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        if (e.deltaY < 0) {
          // Zoom in
          zoomIn();
        } else {
          // Zoom out
          zoomOut();
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoomLevel]);

  // Expose methods for external control via ref
  React.useImperativeHandle(ref, () => ({
    goToPage,
    highlightText: highlightTextInPage,
    highlightCitation: highlightCitationText,
    clearCitationHighlights,
    currentPage,
    totalPages,
    scrollToPage: goToPage // Alias for backward compatibility
  }), [pdfDoc, totalPages, currentPage]);

  if (isLoading) {
    return (
      <div className="pdf-viewer-loading">
        <div className="loading-spinner"></div>
        <p>Loading PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-viewer-error">
        <p>{error}</p>
        <button onClick={loadPDF}>Retry</button>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-controls">
        <div className="pdf-navigation">
          <button onClick={prevPage} disabled={currentPage <= 1} className="nav-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,18 9,12 15,6"></polyline>
            </svg>
          </button>
          
          <div className="page-input-container">
            <form onSubmit={handlePageInputSubmit} className="page-form">
              <span className="page-label">Page</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pageInput || currentPage}
                onChange={handlePageInputChange}
                onFocus={() => setPageInput(currentPage.toString())}
                onBlur={() => setPageInput('')}
                className="page-input"
              />
              <span className="page-total">of {totalPages}</span>
            </form>
          </div>
          
          <button onClick={nextPage} disabled={currentPage >= totalPages} className="nav-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,18 15,12 9,6"></polyline>
            </svg>
          </button>
        </div>
        
        <div className="pdf-tools">
          <div className="pdf-zoom">
            <button onClick={zoomOut} disabled={zoomLevel <= 0.5} className="zoom-button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="M8 11h6"></path>
              </svg>
            </button>
            
            <button onClick={resetZoom} className="zoom-reset">
              {Math.round(zoomLevel * 100)}%
            </button>
            
            <button onClick={zoomIn} disabled={zoomLevel >= 3.0} className="zoom-button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="M8 11h6"></path>
                <path d="M11 8v6"></path>
              </svg>
            </button>
          </div>

          <div className="pdf-search">
            <form onSubmit={handleSearchSubmit} className="search-form">
              <input
                type="text"
                placeholder="Search in PDF..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-button" disabled={!searchText.trim()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>
              {searchText && (
                <button type="button" onClick={clearSearch} className="clear-button">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
      
      <div 
        ref={setContainerRef} 
        className="pdf-container"
        style={{ 
          width: '100%', 
          height: 'calc(100% - 60px)', 
          overflow: 'auto',
          backgroundColor: '#f5f5f5',
          padding: '20px'
        }}
      />
    </div>
  );
});

export default PDFViewer;
