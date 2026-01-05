import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import Tooltip from '../common/Tooltip';
import './Message.css';

function Message({ message, onDelete, onRedo }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isUser = message.role === 'user';
  const isError = message.isError;
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [expandedResults, setExpandedResults] = useState({});
  const [isCitationsExpanded, setIsCitationsExpanded] = useState(false);

  return (
    <div className={`message-container ${isUser ? 'message-container-user' : 'message-container-agent'}`}>
      <div className="message-header-row">
        <div className="message-avatar-wrapper">
          <img
            src={isUser ? (user?.avatar_url || '/default_avatar.jpeg') : '/images/chatbot.png'}
            alt={isUser ? (user?.username || 'You') : 'Agent'}
            className="message-avatar"
            onError={(e) => {
              e.target.src = isUser ? '/default_avatar.jpeg' : '/images/chatbot.png';
            }}
          />
        </div>
        <div className="message-header-info">
          <span className="message-name">{isUser ? (user?.username || t('message.you')) : t('message.agent')}</span>
          {message.timestamp && (
            <span className="message-time">
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          )}
        </div>
        {isUser && (
          <div className="message-actions">
            <button
              className="message-action-button message-action-redo"
              onClick={() => onRedo && onRedo(message.id)}
              title={t('message.redo') || 'Redo'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
            <button
              className="message-action-button message-action-delete"
              onClick={() => onDelete && onDelete(message.id)}
              title={t('message.delete') || 'Delete'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className={`message-bubble ${isUser ? 'message-bubble-user' : 'message-bubble-agent'} ${isError ? 'message-error' : ''}`}>
        <div className="message-content">
          {(() => {
            // Parse citations from message content
            const citations = message.citations || [];
            let content = message.content || '';
            
            // Build citation map for quick lookup
            const citationMap = {};
            citations.forEach((citation, idx) => {
              const citationId = citation.index !== undefined ? citation.index : (idx + 1);
              citationMap[citationId] = citation;
            });
            
            // Process content: handle both ##i$$ format (legacy) and [1], [2] format
            // First, replace ##i$$ with [i] format for consistency
            content = content.replace(/##(\d+)\$\$/g, (match, index) => {
              return `[${index}]`;
            });
            
            // Replace [1], [2] patterns with HTML cite tags
            // We need to be careful not to replace markdown links [text](url)
            let processedContent = content;
            if (citations.length > 0) {
              // Replace citation patterns [number] that are not part of markdown links
              // This regex matches [number] that is not followed by (url)
              processedContent = processedContent.replace(/\[(\d+)\](?!\()/g, (match, citationId) => {
                const id = parseInt(citationId);
                if (citationMap[id]) {
                  const citation = citationMap[id];
                  const url = citation.url || `#citation-${id}`;
                  return `<cite id="cite-${id}" data-citation-id="${id}" data-url="${url || ''}" data-title="${(citation.title || '').replace(/"/g, '&quot;')}">[${id}]</cite>`;
                }
                return match; // Keep original if citation not found
              });
            }
            
            // Custom components for ReactMarkdown to handle cite tags
            const markdownComponents = {
              cite: ({ node, children, ...props }) => {
                // Extract citation ID from data attribute or id attribute
                const citationId = props['data-citation-id'] || 
                                  (props.id ? props.id.replace('cite-', '') : null);
                
                if (!citationId) {
                  return <cite {...props}>{children}</cite>;
                }
                
                const id = parseInt(citationId);
                const citation = citationMap[id];
                
                if (!citation) {
                  return <cite {...props}>{children}</cite>;
                }
                
                // Check if this is a Semantic Scholar citation (has authors, year, or venue)
                const isSemanticScholar = citation.authors || citation.year || citation.venue;
                
                const tooltipContent = (
                  <div className="citation-tooltip-content">
                    <div className="citation-tooltip-title">{citation.title || 'Untitled'}</div>
                    
                    {/* Semantic Scholar specific fields */}
                    {isSemanticScholar && citation.authors && citation.authors.length > 0 && (
                      <div className="citation-tooltip-authors">
                        <strong>Authors:</strong> {citation.authors.slice(0, 5).join(', ')}
                        {citation.authors.length > 5 && ` and ${citation.authors.length - 5} more`}
                      </div>
                    )}
                    
                    {isSemanticScholar && citation.year && (
                      <div className="citation-tooltip-year">
                        <strong>Year:</strong> {citation.year}
                      </div>
                    )}
                    
                    {isSemanticScholar && citation.venue && (
                      <div className="citation-tooltip-venue">
                        <strong>Venue:</strong> {citation.venue}
                      </div>
                    )}
                    
                    {citation.url && (
                      <div className="citation-tooltip-url">{citation.url}</div>
                    )}
                    
                    {/* Show abstract for Semantic Scholar, snippet for others */}
                    {isSemanticScholar && citation.abstract ? (
                      <div className="citation-tooltip-abstract">
                        {citation.abstract.length > 200 
                          ? `${citation.abstract.substring(0, 200)}...` 
                          : citation.abstract}
                      </div>
                    ) : citation.snippet && (
                      <div className="citation-tooltip-snippet">{citation.snippet}</div>
                    )}
                  </div>
                );
                
                return (
                  <Tooltip text={tooltipContent} position="top">
                    <sup
                      className="citation-sup"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (citation.url) {
                          window.open(citation.url, '_blank', 'noopener,noreferrer');
                        } else {
                          // Scroll to citation in references list
                          const citationEl = document.getElementById(`citation-${id}`);
                          if (citationEl) {
                            citationEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }
                      }}
                    >
                      {children}
                    </sup>
                  </Tooltip>
                );
              },
            };
            
            // Render markdown with custom components
            return (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, rehypeKatex]}
                components={markdownComponents}
              >
                {processedContent}
              </ReactMarkdown>
            );
          })()}
        </div>
        {/* Citations list at the bottom */}
        {(() => {
          const citations = message.citations || [];
          if (citations.length === 0) return null;
          
          return (
            <div className="citations-list">
              <button 
                className="citations-toggle"
                onClick={() => setIsCitationsExpanded(!isCitationsExpanded)}
                type="button"
              >
                <span className="citations-toggle-text">
                  {t('message.references') || 'References'}
                </span>
                <span className="citations-toggle-count">({citations.length})</span>
                <svg 
                  className={`citations-toggle-icon ${isCitationsExpanded ? 'expanded' : ''}`}
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {isCitationsExpanded && (
                <ol className="citations-items">
                {citations.map((citation, idx) => {
                  const citationId = citation.index !== undefined ? citation.index : (idx + 1);
                  const isSemanticScholar = citation.authors || citation.year || citation.venue;
                  
                  return (
                    <li key={idx} id={`citation-${citationId}`} className="citation-item">
                      <span className="citation-number">[{citationId}]</span>
                      <div className="citation-content">
                        {citation.url ? (
                          <a 
                            href={citation.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="citation-link"
                          >
                            {citation.title || citation.url}
                          </a>
                        ) : (
                          <span className="citation-title">{citation.title || 'Untitled'}</span>
                        )}
                        
                        {/* Semantic Scholar specific fields */}
                        {isSemanticScholar && citation.authors && citation.authors.length > 0 && (
                          <div className="citation-authors">
                            <strong>Authors:</strong> {citation.authors.slice(0, 5).join(', ')}
                            {citation.authors.length > 5 && ` and ${citation.authors.length - 5} more`}
                          </div>
                        )}
                        
                        {isSemanticScholar && (citation.year || citation.venue) && (
                          <div className="citation-meta">
                            {citation.year && <span>Year: {citation.year}</span>}
                            {citation.year && citation.venue && <span> • </span>}
                            {citation.venue && <span>Venue: {citation.venue}</span>}
                          </div>
                        )}
                        
                        {/* Show abstract for Semantic Scholar, snippet for others */}
                        {isSemanticScholar && citation.abstract ? (
                          <div className="citation-abstract">{citation.abstract}</div>
                        ) : citation.snippet && (
                          <div className="citation-snippet">{citation.snippet}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
                </ol>
              )}
            </div>
          );
        })()}
        {message.files && message.files.length > 0 && (
          <div className="message-files">
            {message.files.map((file, idx) => (
              <div key={idx} className="message-file-item">
                <span className="message-file-name">{file.name}</span>
                <span className="message-file-size">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ))}
          </div>
        )}
        {(() => {
          // Handle both array and dict formats for reasoning
          const reasoningSteps = Array.isArray(message.reasoning) 
            ? message.reasoning 
            : (message.reasoning?.steps || []);
          
          if (!reasoningSteps || reasoningSteps.length === 0) return null;
          
          // Filter to only show tool calls and responses
          const toolSteps = reasoningSteps.filter(step => 
            step && (step.type === 'tool_call' || step.type === 'tool_response')
          );
          
          if (toolSteps.length === 0) return null;
          
          // Get tool display names (no emoji)
          const getToolDisplayName = (toolName) => {
            if (toolName === 'search_duckduckgo') return 'Search DuckDuckGo';
            if (toolName === 'search_url') return 'Read URL';
            return toolName;
          };
          
          return (
            <div className="message-reasoning">
              <button 
                className="reasoning-toggle"
                onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                type="button"
              >
                <span className="reasoning-toggle-text">
                  {t('message.reasoning') || 'Reasoning Process'}
                </span>
                <span className="reasoning-toggle-count">({toolSteps.length} steps)</span>
                <svg 
                  className={`reasoning-toggle-icon ${isReasoningExpanded ? 'expanded' : ''}`}
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {isReasoningExpanded && (
                <div className="reasoning-steps">
                  {toolSteps.map((step, idx) => {
                    if (step.type === 'tool_call') {
                      const toolName = step.tool_name || 'unknown';
                      const args = step.args || '';
                      const toolDisplayName = getToolDisplayName(toolName);
                      
                      return (
                        <div key={idx} className="reasoning-step reasoning-step-call">
                          <div className="reasoning-step-header">
                            <span className="reasoning-step-icon">→</span>
                            <span className="reasoning-step-title">{toolDisplayName}</span>
                          </div>
                          {args && (
                            <div className="reasoning-step-content">
                              <span className="reasoning-step-label">Query:</span> {args}
                            </div>
                          )}
                        </div>
                      );
                    } else if (step.type === 'tool_response') {
                      const toolName = step.tool_name || 'unknown';
                      const result = step.result || '';
                      const toolDisplayName = getToolDisplayName(toolName);
                      const resultId = `result-${idx}`;
                      const isResultExpanded = expandedResults[resultId] || false;
                      const shouldTruncate = result.length > 300;
                      // Show full result when expanded, truncated when collapsed
                      const displayResult = shouldTruncate && !isResultExpanded 
                        ? result.substring(0, 300) 
                        : result;
                      
                      return (
                        <div key={idx} className="reasoning-step reasoning-step-response">
                          <div className="reasoning-step-header">
                            <span className="reasoning-step-icon">✓</span>
                            <span className="reasoning-step-title">{toolDisplayName} completed</span>
                          </div>
                          {result && (
                            <div className="reasoning-step-content">
                              <span className="reasoning-step-label">Result:</span> 
                              <div className="reasoning-step-result">
                                {displayResult}
                                {shouldTruncate && !isResultExpanded && <span>...</span>}
                                {shouldTruncate && (
                                  <button
                                    className={`reasoning-result-expand ${isResultExpanded ? 'expanded' : ''}`}
                                    onClick={() => setExpandedResults(prev => ({
                                      ...prev,
                                      [resultId]: !isResultExpanded
                                    }))}
                                    type="button"
                                  >
                                    <span>{isResultExpanded ? 'Show less' : 'Show more'}</span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          );
        })()}
        {message.confidence && (
          <div className="message-confidence">
            <span className="confidence-label">{t('message.confidence')}</span>
            <span className={`confidence-value confidence-${message.confidence}`}>
              {message.confidence}
            </span>
          </div>
        )}
        {(() => {
          // Handle both array and dict formats for sources
          const sourceItems = Array.isArray(message.sources) 
            ? message.sources 
            : (message.sources?.items || []);
          
          return sourceItems.length > 0 && (
            <div className="message-sources">
              <div className="sources-header">{t('message.sources')}</div>
              <ul className="sources-list">
                {sourceItems.map((source, idx) => (
                  <li key={idx}>{source}</li>
                ))}
              </ul>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default Message;

