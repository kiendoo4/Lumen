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
  const renderTaskIdRef = useRef(0);       // Track the latest render task to cancel old ones
  const isRenderingRef = useRef(false);    // Flag to avoid spamming zoom while rendering

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

    // Increment render task id to cancel any previous in‑flight renders
    const currentTaskId = ++renderTaskIdRef.current;
    isRenderingRef.current = true;

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
      if (currentTaskId !== renderTaskIdRef.current || !containerRef.current) {
        console.log('Render task cancelled before clearing container');
        return;
      }
      containerRef.current.innerHTML = '';
      console.log(`Starting to render ${pdf.numPages} pages with container width: ${containerWidth}`);

      // Render all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        // If a newer render started, stop this one
        if (currentTaskId !== renderTaskIdRef.current || !containerRef.current) {
          console.log('Render task cancelled during page loop');
          return;
        }

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

        // Create highlight overlay layer (region highlight) between canvas and text layer
        const highlightLayerDiv = document.createElement('div');
        highlightLayerDiv.className = 'highlightLayer';
        highlightLayerDiv.style.position = 'absolute';
        highlightLayerDiv.style.left = '0';
        highlightLayerDiv.style.top = '0';
        highlightLayerDiv.style.right = '0';
        highlightLayerDiv.style.bottom = '0';
        highlightLayerDiv.style.pointerEvents = 'none';

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
        pageContainer.appendChild(highlightLayerDiv);
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

      // Only update state/logs if this is still the latest render
      if (currentTaskId === renderTaskIdRef.current && containerRef.current) {
        // Update current page based on scroll position
        updateCurrentPageFromScroll();

        console.log(`Successfully rendered ${pdf.numPages} pages`);
        console.log('Container children count:', containerRef.current.children.length);
        console.log('Container innerHTML length:', containerRef.current.innerHTML.length);
      } else {
        console.log('Render task finished but was superseded by a newer task');
      }

    } catch (err) {
      console.error('Error rendering pages:', err);
      // If rendering fails, still set loading to false to show error
      setIsLoading(false);
      setError(`Failed to render PDF pages: ${err.message}`);
    } finally {
      // Only clear rendering flag for the active task
      if (currentTaskId === renderTaskIdRef.current) {
        isRenderingRef.current = false;
      }
    }
  };

  const updateCurrentPageFromScroll = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const pageContainers = container.querySelectorAll('.page-container');
    if (!pageContainers.length) return;

    let newCurrentPage = 1;

    // Trường hợp scroll bên trong chính pdf-container (overflow: auto)
    if (container.scrollHeight > container.clientHeight + 1) {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const scrollCenter = scrollTop + containerHeight / 2;

      pageContainers.forEach((pageContainer, index) => {
        const pageTop = pageContainer.offsetTop;
        const pageBottom = pageTop + pageContainer.offsetHeight;

        if (scrollCenter >= pageTop && scrollCenter <= pageBottom) {
          newCurrentPage = index + 1;
        }
      });
    } else {
      // Trường hợp không scroll trong container mà scroll toàn bộ window
      const viewportCenterY = window.innerHeight / 2;

      pageContainers.forEach((pageContainer, index) => {
        const rect = pageContainer.getBoundingClientRect();
        if (viewportCenterY >= rect.top && viewportCenterY <= rect.bottom) {
          newCurrentPage = index + 1;
        }
      });
    }

    // Dùng functional setState để không bị dính currentPage cũ trong closure của event listener
    setCurrentPage((prevPage) => {
      if (prevPage === newCurrentPage) return prevPage;
      if (onPageChange) {
        onPageChange(newCurrentPage);
      }
      return newCurrentPage;
    });
  };

  const highlightChunks = () => {
    if (!containerRef.current || highlightedChunks.length === 0) return;

    // Remove existing highlights
    const existingHighlights = containerRef.current.querySelectorAll('.pdf-highlight');
    existingHighlights.forEach(el => el.remove());

    highlightedChunks.forEach(chunk => {
      if (chunk.page_number === currentPage && chunk.content) {
        // Dùng kiểu 'citation' để màu trùng với highlight khi click citation
        highlightTextInPage(chunk.content.substring(0, 100), 'citation', chunk.page_number || currentPage);
      }
    });
  };

  const normalizeForMatch = (text) => {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/-\s+/g, '')            // Remove hyphens at line breaks (e.g., "di- mension" -> "dimension")
      .replace(/\s+-/g, '-')           // Keep hyphens within words (e.g., "long-term")
      .replace(/[""]/g, '"')           // Normalize quotes
      .replace(/['']/g, "'")           // Normalize apostrophes
      .trim()
      .toLowerCase();
  };

  const getTextLayerForPage = (pageNumber) => {
    if (!containerRef.current || !pageNumber) return null;
    const pageContainer = containerRef.current.querySelector(`[data-page-number="${pageNumber}"]`);
    if (!pageContainer) return null;
    return pageContainer.querySelector('.textLayer');
  };

  const getHighlightLayerForPage = (pageNumber) => {
    if (!containerRef.current || !pageNumber) return null;
    const pageContainer = containerRef.current.querySelector(`[data-page-number="${pageNumber}"]`);
    if (!pageContainer) return null;
    return pageContainer.querySelector('.highlightLayer');
  };

  const clearRegionHighlights = () => {
    if (!containerRef.current) return;
    const regions = containerRef.current.querySelectorAll('.pdf-region-highlight');
    regions.forEach((el) => el.remove());
  };

  const highlightSpanFully = (span, highlightType) => {
    if (!span) return;
    const text = span.textContent || '';
    if (!text) return;
    span.innerHTML = '';

    const highlightSpan = document.createElement('span');
    highlightSpan.className = `pdf-highlight pdf-highlight-${highlightType}`;

    if (highlightType === 'citation') {
      highlightSpan.style.backgroundColor = 'rgba(147, 51, 234, 0.3)';
      highlightSpan.style.boxShadow = '0 0 0 1px rgba(147, 51, 234, 0.6)';
    } else {
      highlightSpan.style.backgroundColor = 'rgba(255, 255, 0, 0.6)';
      highlightSpan.style.boxShadow = '0 0 0 1px rgba(255, 193, 7, 0.8)';
    }

    highlightSpan.style.padding = '1px 2px';
    highlightSpan.style.borderRadius = '2px';
    highlightSpan.textContent = text;
    span.appendChild(highlightSpan);
  };

  // Phrase match across multiple PDF.js spans by token sequence, then highlight the matched spans.
  const highlightPhraseByTokensInPage = (phrase, pageNumber, highlightType = 'citation') => {
    if (!containerRef.current || !phrase || !pageNumber) return 0;

    const textLayer = getTextLayerForPage(pageNumber);
    if (!textLayer) return 0;

    const phraseTokens = normalizeForMatch(phrase).split(' ').filter(Boolean);
    if (phraseTokens.length === 0) return 0;

    const spans = Array.from(textLayer.querySelectorAll('span'));
    if (spans.length === 0) return 0;

    // Build a token stream from spans, keeping mapping back to spans.
    const tokens = [];
    const tokenSpanIndex = [];
    spans.forEach((span, spanIdx) => {
      const raw = span.textContent || '';
      const tks = normalizeForMatch(raw).split(' ').filter(Boolean);
      tks.forEach((tk) => {
        tokens.push(tk);
        tokenSpanIndex.push(spanIdx);
      });
    });

    if (tokens.length === 0) return 0;

    // Naive subsequence search
    for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
      let ok = true;
      for (let j = 0; j < phraseTokens.length; j++) {
        if (tokens[i + j] !== phraseTokens[j]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      const matchedSpanIdxs = new Set();
      for (let j = 0; j < phraseTokens.length; j++) {
        matchedSpanIdxs.add(tokenSpanIndex[i + j]);
      }

      Array.from(matchedSpanIdxs).forEach((spanIdx) => {
        highlightSpanFully(spans[spanIdx], highlightType);
      });

      // Scroll to first highlighted span for visibility
      const firstIdx = Math.min(...Array.from(matchedSpanIdxs));
      const firstSpan = spans[firstIdx];
      if (firstSpan && firstSpan.scrollIntoView) {
        firstSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      return matchedSpanIdxs.size;
    }

    return 0;
  };

  // Region highlight: draw translucent rectangles on the highlightLayer based on matched spans.
  const highlightRegionByTokensInPage = (phrase, pageNumber, regionType = 'citation') => {
    if (!containerRef.current || !phrase || !pageNumber) return 0;
    const textLayer = getTextLayerForPage(pageNumber);
    const highlightLayer = getHighlightLayerForPage(pageNumber);
    if (!textLayer || !highlightLayer) {
      console.log(`No text/highlight layer found for page ${pageNumber}`);
      return 0;
    }

    const phraseTokens = normalizeForMatch(phrase).split(' ').filter(Boolean);
    if (phraseTokens.length === 0) return 0;

    console.log(`Trying to highlight phrase on page ${pageNumber}:`, phrase.substring(0, 50) + '...');
    console.log(`Phrase tokens (${phraseTokens.length}):`, phraseTokens.slice(0, 5).join(' ') + '...');

    const spans = Array.from(textLayer.querySelectorAll('span'));
    if (spans.length === 0) {
      console.log(`No spans found in text layer for page ${pageNumber}`);
      return 0;
    }

    const tokens = [];
    const tokenSpanIndex = [];
    spans.forEach((span, spanIdx) => {
      const raw = span.textContent || '';
      const tks = normalizeForMatch(raw).split(' ').filter(Boolean);
      tks.forEach((tk) => {
        tokens.push(tk);
        tokenSpanIndex.push(spanIdx);
      });
    });
    if (tokens.length === 0) return 0;

    console.log(`Page has ${tokens.length} tokens from ${spans.length} spans`);

    let matchStart = -1;
    for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
      let ok = true;
      for (let j = 0; j < phraseTokens.length; j++) {
        if (tokens[i + j] !== phraseTokens[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        matchStart = i;
        console.log(`✓ Found match at token index ${i}`);
        break;
      }
    }

    if (matchStart === -1) {
      console.log(`✗ No match found for phrase on page ${pageNumber}`);
      return 0;
    }

    const matchedSpanIdxs = [];
    for (let j = 0; j < phraseTokens.length; j++) {
      matchedSpanIdxs.push(tokenSpanIndex[matchStart + j]);
    }
    const uniqueSpanIdxs = Array.from(new Set(matchedSpanIdxs)).sort((a, b) => a - b);

    const pageContainer = containerRef.current.querySelector(`[data-page-number="${pageNumber}"]`);
    if (!pageContainer) return 0;
    const pageRect = pageContainer.getBoundingClientRect();

    const rects = uniqueSpanIdxs
      .map((idx) => spans[idx]?.getBoundingClientRect())
      .filter(Boolean)
      .map((r) => ({
        left: r.left - pageRect.left,
        top: r.top - pageRect.top,
        right: r.right - pageRect.left,
        bottom: r.bottom - pageRect.top,
      }))
      .filter((r) => r.right > r.left && r.bottom > r.top);

    if (rects.length === 0) return 0;

    rects.sort((a, b) => a.top - b.top);
    const lineGroups = [];
    const lineThresholdPx = 6;

    for (const r of rects) {
      const last = lineGroups[lineGroups.length - 1];
      if (!last || Math.abs(last.anchorTop - r.top) > lineThresholdPx) {
        lineGroups.push({
          anchorTop: r.top,
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
        });
      } else {
        last.left = Math.min(last.left, r.left);
        last.top = Math.min(last.top, r.top);
        last.right = Math.max(last.right, r.right);
        last.bottom = Math.max(last.bottom, r.bottom);
      }
    }

    clearRegionHighlights();

    lineGroups.forEach((g) => {
      const el = document.createElement('div');
      el.className = `pdf-region-highlight pdf-region-highlight-${regionType}`;
      el.style.left = `${Math.max(g.left - 2, 0)}px`;
      el.style.top = `${Math.max(g.top - 2, 0)}px`;
      el.style.width = `${Math.max(g.right - g.left + 4, 0)}px`;
      el.style.height = `${Math.max(g.bottom - g.top + 4, 0)}px`;
      highlightLayer.appendChild(el);
    });

    console.log(`✓ Created ${lineGroups.length} highlight regions on page ${pageNumber}`);
    return lineGroups.length;
  };

  // Backward compatible signature: (searchText, highlightType, pageNumber?)
  const highlightTextInPage = (searchText, highlightType = 'search', pageNumber = null) => {
    if (!containerRef.current || !searchText) return;

    console.log('Highlighting text:', searchText, 'Type:', highlightType);

    // Remove existing highlights of the same type first
    const existingHighlights = containerRef.current.querySelectorAll(`.pdf-highlight-${highlightType}`);
    existingHighlights.forEach(highlight => {
      const parent = highlight.parentNode;
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      parent.normalize(); // Merge adjacent text nodes
    });

    // Find and highlight text in text layers (optionally scoped to a page)
    const textLayers = pageNumber
      ? [getTextLayerForPage(pageNumber)].filter(Boolean)
      : Array.from(containerRef.current.querySelectorAll('.textLayer'));

    const searchLower = normalizeForMatch(searchText);
    let highlightCount = 0;

    textLayers.forEach(textLayer => {
      // Use all spans inside textLayer (PDF.js generated spans may not have data-text-index)
      const textSpans = textLayer.querySelectorAll('span');

      textSpans.forEach(span => {
        const text = span.textContent;
        const textLower = normalizeForMatch(text);

        if (textLower.includes(searchLower)) {
          const index = textLower.indexOf(searchLower);
          if (index !== -1) {
            // NOTE: index is on normalized text; we keep the old simple highlight behavior within a span.
            const beforeText = text.substring(0, Math.max(index, 0));
            const matchText = text.substring(Math.max(index, 0), Math.min(text.length, Math.max(index, 0) + searchText.length));
            const afterText = text.substring(Math.min(text.length, Math.max(index, 0) + searchText.length));

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
      // Cập nhật luôn currentPage để input không nhảy ngược về trang cũ
      setCurrentPage(pageNum);
      if (onPageChange) {
        onPageChange(pageNum);
      }
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
    clearRegionHighlights();
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
      const pageNum = citation.page_number ? parseInt(citation.page_number) : null;
      const content = (citation.content || '').trim();

      // Get all available anchors from backend
      const anchorStart = (citation.anchor_start || '').trim();
      const anchorMiddle = (citation.anchor_middle || '').trim();
      const anchorEnd = (citation.anchor_end || '').trim();

      const words = content.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

      // Create multiple anchor options with different lengths for better matching
      const anchorsToTry = [
        // Backend anchors (18 words)
        anchorStart,
        anchorMiddle,
        anchorEnd,
        // Longer anchors for more context (25 words)
        words.slice(0, 25).join(' '),
        words.slice(Math.max(0, Math.floor(words.length / 2) - 12), Math.floor(words.length / 2) + 13).join(' '),
        words.slice(Math.max(0, words.length - 25)).join(' '),
        // Medium anchors (15 words)
        words.slice(0, 15).join(' '),
        words.slice(Math.max(0, words.length - 15)).join(' '),
        // Short anchors (10 words)
        words.slice(0, 10).join(' '),
        words.slice(Math.max(0, words.length - 10)).join(' '),
      ].filter(a => a && a.length >= 20); // Filter out empty or too short anchors

      // Expand page search range to ±2 pages for better coverage
      const pagesToTry = [];
      if (pageNum) {
        pagesToTry.push(pageNum);           // Current page first
        if (pageNum > 1) pagesToTry.push(pageNum - 1);  // Previous page
        pagesToTry.push(pageNum + 1);       // Next page
        if (pageNum > 2) pagesToTry.push(pageNum - 2);  // 2 pages before
        pagesToTry.push(pageNum + 2);       // 2 pages after
      }

      console.log(`Trying ${anchorsToTry.length} anchors across ${pagesToTry.length} pages`);

      let highlightCount = 0;

      // Strategy 1: Try region highlighting with anchors
      if (pagesToTry.length > 0) {
        for (const p of pagesToTry) {
          for (const a of anchorsToTry) {
            highlightCount += highlightRegionByTokensInPage(a, p, 'citation');
            if (highlightCount > 0) {
              console.log(`✓ Found anchor match on page ${p}, now trying to highlight full content...`);

              // Try to highlight full content now that we found the page
              clearRegionHighlights(); // Clear anchor highlight

              // Try progressively longer portions of content
              const contentLengths = [
                content.length, // Full content first
                Math.min(content.length, 500),
                Math.min(content.length, 300),
                Math.min(content.length, 200),
                Math.min(content.length, 150),
              ];

              for (const len of contentLengths) {
                const snippet = content.substring(0, len).trim();
                const fullHighlight = highlightRegionByTokensInPage(snippet, p, 'citation');
                if (fullHighlight > 0) {
                  console.log(`✓ Successfully highlighted ${len} chars of full content on page ${p}`);

                  // If we didn't highlight full content, try to highlight the rest on next page
                  if (len < content.length && p < totalPages) {
                    const remaining = content.substring(len).trim();
                    if (remaining.length > 50) {
                      console.log(`Trying to highlight remaining ${remaining.length} chars on page ${p + 1}...`);
                      const remainingHighlight = highlightRegionByTokensInPage(remaining.substring(0, 300), p + 1, 'citation');
                      if (remainingHighlight > 0) {
                        console.log(`✓ Also highlighted continuation on page ${p + 1}`);
                      }
                    }
                  }
                  return; // Success!
                }
              }

              // If full content doesn't work, keep the anchor highlight
              highlightRegionByTokensInPage(a, p, 'citation');
              console.log(`⚠ Could only highlight anchor (${a.length} chars), not full content`);

              // Try to highlight continuation on next page
              // Find what comes after the anchor in the full content
              if (p < totalPages) {
                const anchorNormalized = normalizeForMatch(a);
                const contentNormalized = normalizeForMatch(content);
                const anchorPos = contentNormalized.indexOf(anchorNormalized);

                if (anchorPos !== -1) {
                  // Get text after the anchor
                  const afterAnchor = content.substring(anchorPos + a.length).trim();

                  if (afterAnchor.length > 50) {
                    console.log(`Trying to highlight ${afterAnchor.length} chars after anchor on page ${p + 1}...`);

                    // Try different lengths of the continuation
                    const contLengths = [
                      Math.min(afterAnchor.length, 300),
                      Math.min(afterAnchor.length, 200),
                      Math.min(afterAnchor.length, 150),
                      Math.min(afterAnchor.length, 100),
                    ];

                    for (const len of contLengths) {
                      const contSnippet = afterAnchor.substring(0, len).trim();
                      const contHighlight = highlightRegionByTokensInPage(contSnippet, p + 1, 'citation');
                      if (contHighlight > 0) {
                        console.log(`✓ Highlighted ${len} chars of continuation on page ${p + 1}`);
                        break;
                      }
                    }
                  }
                }
              }
              return;
            }
          }
        }
      }

      console.log('⚠ Anchor-based highlighting failed, trying content-based fallback...');

      // Strategy 2: Try highlighting with progressively shorter content snippets
      const contentLengths = [200, 150, 100, 70, 50];
      for (const len of contentLengths) {
        const snippet = content.substring(0, len).trim();
        if (snippet.length < 20) continue;

        highlightCount = highlightTextInPage(snippet, 'citation', pageNum);
        if (highlightCount > 0) {
          console.log(`✓ Highlighted using ${len}-char content snippet`);
          return;
        }
      }

      // Strategy 3: Try phrase-based highlighting (split into sentences)
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
      if (sentences.length > 0) {
        for (const sentence of sentences.slice(0, 3)) { // Try first 3 sentences
          highlightCount = highlightTextInPage(sentence.trim(), 'citation', pageNum);
          if (highlightCount > 0) {
            console.log(`✓ Highlighted using sentence match`);
            return;
          }
        }
      }

      // Strategy 4: Last resort - highlight distinctive words
      console.log('⚠ All strategies failed, highlighting distinctive words...');
      const distinctiveWords = words
        .filter(w => w.length > 6)
        .filter(w => !/^(the|and|that|this|with|from|have|been|were|their)$/i.test(w))
        .slice(0, 8);

      if (distinctiveWords.length > 0) {
        distinctiveWords.forEach((w) => highlightTextInPage(w, 'citation', pageNum));
        console.log(`Highlighted ${distinctiveWords.length} distinctive words as fallback`);
      } else {
        console.error('❌ Could not highlight citation - no matching text found');
      }
    }, 500); // Delay to ensure page is scrolled first
  };

  const zoomIn = () => {
    // Tránh đổi zoom khi đang render để không bị huỷ render giữa chừng
    if (isRenderingRef.current) {
      console.log('Skip zoomIn because PDF is currently rendering');
      return;
    }
    const newZoom = Math.min(zoomLevel * 1.25, 3.0); // Max 300%
    setZoomLevel(newZoom);
  };

  const zoomOut = () => {
    if (isRenderingRef.current) {
      console.log('Skip zoomOut because PDF is currently rendering');
      return;
    }
    const newZoom = Math.max(zoomLevel / 1.25, 0.5); // Min 50%
    setZoomLevel(newZoom);
  };

  const resetZoom = () => {
    if (isRenderingRef.current) {
      console.log('Skip resetZoom because PDF is currently rendering');
      return;
    }
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

    // Chỉ cần lắng nghe scroll trên chính khung PDF
    container.addEventListener('scroll', handleScroll);

    // Gọi 1 lần để sync currentPage ban đầu sau khi render xong
    updateCurrentPageFromScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerReady, pdfDoc]);

  // Fallback: nếu container vẫn trống sau khi có pdfDoc + containerReady, thử render lại
  useEffect(() => {
    if (!pdfDoc || !containerReady) return;
    const container = containerRef.current;
    if (!container) return;

    if (container.children.length > 0) return;

    const timeout = setTimeout(() => {
      if (containerRef.current && containerRef.current.children.length === 0) {
        console.log('PDF container still empty after load, re-rendering pages as fallback');
        renderAllPages(pdfDoc);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [pdfDoc, containerReady, zoomLevel]);

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
                value={pageInput === '' ? currentPage : pageInput}
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
