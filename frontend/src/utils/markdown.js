/**
 * Enhanced markdown parser for message content
 * Supports: **bold**, *italic*, `code`, ```code blocks```, [links](url), lists, and better paragraph handling
 */
export function parseMarkdown(text) {
  if (!text) return [];
  
  const result = [];
  let keyCounter = 0;
  
  // First, extract code blocks and replace them with placeholders
  const codeBlocks = [];
  const codeBlockPlaceholder = '___CODEBLOCK___';
  let processedText = text;
  
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let codeBlockMatch;
  let codeBlockIndex = 0;
  
  while ((codeBlockMatch = codeBlockRegex.exec(text)) !== null) {
    const language = codeBlockMatch[1] || '';
    const content = codeBlockMatch[2].trim();
    const placeholder = `${codeBlockPlaceholder}${codeBlockIndex}___`;
    
    codeBlocks.push({
      placeholder,
      content,
      language,
      index: codeBlockIndex
    });
    
    processedText = processedText.replace(codeBlockMatch[0], placeholder);
    codeBlockIndex++;
  }
  
  // Split by lines
  const lines = processedText.split('\n');
  let currentParagraph = [];
  let currentList = null;
  
  lines.forEach((line, lineIndex) => {
    // Check if line contains a code block placeholder
    const codeBlockPlaceholderMatch = line.match(new RegExp(`${codeBlockPlaceholder}(\\d+)___`));
    if (codeBlockPlaceholderMatch) {
      // Close current paragraph/list if any
      if (currentParagraph.length > 0) {
        result.push({ type: 'paragraph', lines: currentParagraph, key: `para-${keyCounter++}` });
        currentParagraph = [];
      }
      if (currentList) {
        result.push(currentList);
        currentList = null;
      }
      
      // Add code block
      const blockIndex = parseInt(codeBlockPlaceholderMatch[1]);
      const codeBlock = codeBlocks.find(cb => cb.index === blockIndex);
      if (codeBlock) {
        result.push({
          type: 'codeblock',
          content: codeBlock.content,
          language: codeBlock.language,
          key: `codeblock-${keyCounter++}`
        });
      }
      return;
    }
    
    // Check if line is a list item
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      // Close current paragraph if any
      if (currentParagraph.length > 0) {
        result.push({ type: 'paragraph', lines: currentParagraph, key: `para-${keyCounter++}` });
        currentParagraph = [];
      }
      
      const indent = listMatch[1].length;
      const ordered = /^\d+\./.test(listMatch[2]);
      const content = parseLine(listMatch[3], keyCounter);
      
      // Check if we should start a new list or continue current one
      if (!currentList || 
          currentList.ordered !== ordered || 
          currentList.indent !== indent) {
        // Close previous list if any
        if (currentList) {
          result.push(currentList);
        }
        // Start new list
        currentList = {
          type: 'list',
          ordered,
          indent,
          items: [{
            type: 'list-item',
            content,
            key: `listitem-${keyCounter++}`
          }],
          key: `list-${keyCounter++}`
        };
      } else {
        // Add to current list
        currentList.items.push({
          type: 'list-item',
          content,
          key: `listitem-${keyCounter++}`
        });
      }
      return;
    }
    
    // Close current list if any (we hit a non-list line)
    if (currentList) {
      result.push(currentList);
      currentList = null;
    }
    
    // Handle empty lines
    if (!line.trim()) {
      if (currentParagraph.length > 0) {
        result.push({ type: 'paragraph', lines: currentParagraph, key: `para-${keyCounter++}` });
        currentParagraph = [];
      }
      return;
    }
    
    // Regular line - add to current paragraph
    currentParagraph.push(parseLine(line, keyCounter));
    keyCounter += 100; // Reserve keys for parts
  });
  
  // Close last paragraph/list if any
  if (currentParagraph.length > 0) {
    result.push({ type: 'paragraph', lines: currentParagraph, key: `para-${keyCounter++}` });
  }
  if (currentList) {
    result.push(currentList);
  }
  
  return result;
}

function parseLine(line, startKeyCounter) {
  const parts = [];
  let keyCounter = startKeyCounter;
  let lastIndex = 0;
  
  // Find all inline code first (they have highest priority)
  // Match backtick, then any non-backtick characters (at least one), then closing backtick
  const codeRegex = /`([^`\n]+)`/g;
  const codeMatches = [];
  let codeMatch;
  while ((codeMatch = codeRegex.exec(line)) !== null) {
    codeMatches.push({
      start: codeMatch.index,
      end: codeMatch.index + codeMatch[0].length,
      content: codeMatch[1],
      type: 'code'
    });
  }
  
  // Find all links [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const linkMatches = [];
  let linkMatch;
  while ((linkMatch = linkRegex.exec(line)) !== null) {
    const isInCode = codeMatches.some(
      (c) => linkMatch.index >= c.start && linkMatch.index < c.end
    );
    if (!isInCode) {
      linkMatches.push({
        start: linkMatch.index,
        end: linkMatch.index + linkMatch[0].length,
        text: linkMatch[1],
        url: linkMatch[2],
        type: 'link'
      });
    }
  }
  
  // Find all bold (**text** or __text__) - not inside code
  // Only match if properly closed (avoid incomplete like **:)
  // Match **text** or __text__, ensuring proper closing
  const boldRegex = /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/g;
  const boldMatches = [];
  let boldMatch;
  while ((boldMatch = boldRegex.exec(line)) !== null) {
    const boldStart = boldMatch.index;
    const boldEnd = boldStart + boldMatch[0].length;
    
    // Ensure it's properly closed (not just **: or **)
    const content = boldMatch[1] || boldMatch[2];
    if (!content || content.trim().length === 0) {
      continue; // Skip empty or incomplete bold
    }
    
    // Check if this bold is inside a code block
    const isInCode = codeMatches.some(
      (c) => boldStart >= c.start && boldStart < c.end
    );
    
    if (!isInCode) {
      // Check if this bold contains code matches inside it
      const containsCode = codeMatches.some(
        (c) => c.start > boldStart && c.end < boldEnd
      );
      
      if (containsCode) {
        // If bold contains code, we'll handle nesting during rendering
        boldMatches.push({
          start: boldStart,
          end: boldEnd,
          content: content,
          type: 'bold',
          containsCode: true
        });
      } else {
        boldMatches.push({
          start: boldStart,
          end: boldEnd,
          content: content,
          type: 'bold',
          containsCode: false
        });
      }
    }
  }
  
  // Find all italic (*text* or _text_) - not inside code or bold
  // Only match if properly closed and not part of bold
  const italicRegex = /\*([^*\n]+?)\*|_([^_\n]+?)_/g;
  const italicMatches = [];
  let italicMatch;
  while ((italicMatch = italicRegex.exec(line)) !== null) {
    const matchStart = italicMatch.index;
    const matchEnd = matchStart + italicMatch[0].length;
    const content = italicMatch[1] || italicMatch[2];
    
    // Skip if empty or incomplete
    if (!content || content.trim().length === 0) {
      continue;
    }
    
    // Skip if it's part of ** (bold) or __ (bold)
    const prevChar = matchStart > 0 ? line[matchStart - 1] : '';
    const nextChar = matchEnd < line.length ? line[matchEnd] : '';
    if ((prevChar === '*' && nextChar === '*') || (prevChar === '_' && nextChar === '_')) {
      continue;
    }
    
    // Skip if it's part of incomplete bold like **:
    if (prevChar === '*' && nextChar === ':') {
      continue;
    }
    
    const isInCode = codeMatches.some(
      (c) => matchStart >= c.start && matchStart < c.end
    );
    const isInBold = boldMatches.some(
      (b) => matchStart >= b.start && matchStart < b.end
    );
    const isInLink = linkMatches.some(
      (l) => matchStart >= l.start && matchStart < l.end
    );
    if (!isInCode && !isInBold && !isInLink) {
      italicMatches.push({
        start: matchStart,
        end: matchEnd,
        content: content,
        type: 'italic'
      });
    }
  }
  
  // Combine all matches and sort by position, with code having highest priority
  // Put code matches first so they take priority in overlap resolution
  const allMatches = [...codeMatches, ...linkMatches, ...boldMatches, ...italicMatches]
    .sort((a, b) => {
      // Code matches have highest priority
      if (a.type === 'code' && b.type !== 'code') return -1;
      if (b.type === 'code' && a.type !== 'code') return 1;
      // Then sort by position
      return a.start - b.start;
    });
  
  // Remove overlapping matches, but handle nested cases (code inside bold)
  const filteredMatches = [];
  allMatches.forEach((match) => {
    if (match.type === 'code') {
      // Code always gets added (highest priority)
      filteredMatches.push(match);
    } else {
      // For other matches, check if they overlap with existing matches
      const overlaps = filteredMatches.some((m) => {
        // If this match is completely inside a code match, skip it
        if (m.type === 'code' && match.start >= m.start && match.end <= m.end) {
          return true;
        }
        // If this match overlaps with another match (not nested), skip it
        return match.start < m.end && match.end > m.start;
      });
      
      // Also check if this match contains code matches (for nested bold+code)
      if (match.type === 'bold' && match.containsCode) {
        // Check if all contained code matches are already in filteredMatches
        const containedCodes = codeMatches.filter(
          (c) => c.start > match.start && c.end < match.end
        );
        const allCodesAdded = containedCodes.every((c) =>
          filteredMatches.some((m) => m.type === 'code' && m.start === c.start && m.end === c.end)
        );
        
        if (allCodesAdded && !overlaps) {
          // Bold contains code and codes are already added, add bold for nesting
          filteredMatches.push(match);
        }
      } else if (!overlaps) {
        filteredMatches.push(match);
      }
    }
  });
  
  // Re-sort filtered matches by position for rendering
  filteredMatches.sort((a, b) => a.start - b.start);
  
  // Track which code matches have been processed in bold
  const processedCodes = new Set();
  
  // Build parts array, handling nested bold+code
  filteredMatches.forEach((match) => {
    // Handle bold matches that contain code separately
    if (match.type === 'bold' && match.containsCode) {
      // Find all code matches inside this bold from filteredMatches
      const codesInBold = filteredMatches.filter(
        (m) => m.type === 'code' && m.start > match.start && m.end < match.end
      ).sort((a, b) => a.start - b.start);
      
      // Add text before bold
      if (match.start > lastIndex) {
        const textBefore = line.substring(lastIndex, match.start);
        if (textBefore) {
          parts.push({
            type: 'text',
            content: textBefore,
            key: `text-${keyCounter++}`
          });
        }
      }
      
      // Process content inside bold: text before first code, codes, text between codes, text after last code
      // match.start is position of opening **, match.end is after closing **
      // So content starts at match.start + 2 and ends at match.end - 2
      const boldContentStart = match.start + 2;
      const boldContentEnd = match.end - 2;
      let boldLastIndex = boldContentStart;
      
      codesInBold.forEach((codeMatch, idx) => {
        // Text before this code (inside bold)
        if (codeMatch.start > boldLastIndex) {
          const textInBold = line.substring(boldLastIndex, codeMatch.start);
          if (textInBold) {
            parts.push({
              type: 'bold',
              content: textInBold,
              key: `bold-${keyCounter++}`
            });
          }
        }
        
        // Code (wrapped in bold)
        parts.push({
          type: 'bold-code',
          content: codeMatch.content,
          key: `bold-code-${keyCounter++}`
        });
        
        // Mark this code as processed
        processedCodes.add(`${codeMatch.start}-${codeMatch.end}`);
        
        boldLastIndex = codeMatch.end;
      });
      
      // Text after last code but before closing **
      if (boldContentEnd > boldLastIndex) {
        const textInBold = line.substring(boldLastIndex, boldContentEnd);
        if (textInBold) {
          parts.push({
            type: 'bold',
            content: textInBold,
            key: `bold-${keyCounter++}`
          });
        }
      }
      
      lastIndex = match.end;
      return;
    }
    
    // Add text before match
    if (match.start > lastIndex) {
      const textBefore = line.substring(lastIndex, match.start);
      if (textBefore) {
        parts.push({
          type: 'text',
          content: textBefore,
          key: `text-${keyCounter++}`
        });
      }
    }
    
    // Skip code matches that were already processed in bold
    if (match.type === 'code') {
      const codeKey = `${match.start}-${match.end}`;
      if (processedCodes.has(codeKey)) {
        lastIndex = match.end;
        return;
      }
    }
    
    // Add match
    if (match.type === 'link') {
      parts.push({
        type: 'link',
        text: match.text,
        url: match.url,
        key: `link-${keyCounter++}`
      });
    } else {
      parts.push({
        type: match.type,
        content: match.content,
        key: `${match.type}-${keyCounter++}`
      });
    }
    
    lastIndex = match.end;
  });
  
  // Add remaining text
  if (lastIndex < line.length) {
    const remainingText = line.substring(lastIndex);
    if (remainingText) {
      parts.push({
        type: 'text',
        content: remainingText,
        key: `text-${keyCounter++}`
      });
    }
  }
  
  // If no parts, add whole line as text
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content: line,
      key: `text-${keyCounter++}`
    });
  }
  
  return { parts, key: `line-${keyCounter++}` };
}
