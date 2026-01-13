import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import Header from '../chat/Header';
import Settings from '../common/Settings';
import Tooltip from '../common/Tooltip';
import ConversationSettingsModal from '../modals/ConversationSettingsModal';
import CitationsModal from '../modals/CitationsModal';
import PDFViewer from './PDFViewer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import axios from 'axios';
import './PaperChatInterface.css';

const PaperChatInterface = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [document, setDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [highlightedChunks, setHighlightedChunks] = useState([]);
  const [sessionSettings, setSessionSettings] = useState({
    llm_model: 'gpt-4',
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 2000
  });
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const [citationsModalOpen, setCitationsModalOpen] = useState(false);
  const [selectedMessageCitations, setSelectedMessageCitations] = useState(null);
  const [selectedMessageQuery, setSelectedMessageQuery] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const pdfViewerRef = useRef(null);

  useEffect(() => {
    if (!documentId) {
      navigate('/paper-chat/upload');
      return;
    }

    loadUserDefaultSettings();
  }, [documentId, navigate]);

  // Load user's default LLM settings first, then load document and create session
  const loadUserDefaultSettings = async () => {
    let userSettings = {
      llm_model: 'gpt-4',
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 2000
    };

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/llm-providers/default-settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const defaultSettings = await response.json();
        console.log('Loaded user default LLM settings:', defaultSettings);
        
        userSettings = {
          llm_model: defaultSettings.llm_model || 'gpt-4',
          temperature: defaultSettings.temperature || 0.7,
          top_p: defaultSettings.top_p || 0.9,
          max_tokens: defaultSettings.max_tokens || 2000
        };
      }
    } catch (err) {
      console.error('Failed to load user default settings:', err);
      // Continue with hardcoded defaults if API fails
    }

    // Update session settings with user defaults
    setSessionSettings(userSettings);

    // After loading settings, proceed with document and session
    await loadDocument();
    await createChatSessionWithSettings(userSettings);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadDocument = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/paper-chat/documents/${documentId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Document not found');
      }

      const data = await response.json();
      
      if (data.processing_status !== 'completed') {
        navigate(`/paper-chat/processing/${documentId}`);
        return;
      }

      setDocument(data);

      // Get PDF URL for viewing
      const pdfResponse = await fetch(`/api/paper-chat/documents/${documentId}/url`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (pdfResponse.ok) {
        const pdfData = await pdfResponse.json();
        setPdfUrl(pdfData.url);
      }

    } catch (err) {
      setError(err.message);
    }
  };

  const createChatSession = async () => {
    return createChatSessionWithSettings(sessionSettings);
  };

  const createChatSessionWithSettings = async (settings) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/paper-chat/documents/${documentId}/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Chat with Document`,
          llm_model: settings.llm_model,
          temperature: settings.temperature,
          top_p: settings.top_p,
          max_tokens: settings.max_tokens
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create chat session');
      }

      const data = await response.json();
      setSessionId(data.id);
      
      // Load session settings
      await loadSessionSettings(data.id);

      // Load existing messages if any
      loadMessages(data.id);

    } catch (err) {
      setError(err.message);
    }
  };

  const loadSessionSettings = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/paper-chat/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.data) {
        setSessionSettings({
          llm_model: response.data.llm_model || 'gpt-4',
          temperature: response.data.temperature || 0.7,
          top_p: response.data.top_p || 0.9,
          max_tokens: response.data.max_tokens || 2000
        });
      }
    } catch (err) {
      console.error('Failed to load session settings:', err);
    }
  };

  const handleSaveModelSettings = (newSettings) => {
    // onUpdate callback from ConversationSettingsModal will be called after save
    // Update local state with new settings
    setSessionSettings({
      llm_model: newSettings.llm_model || sessionSettings.llm_model,
      temperature: newSettings.temperature !== undefined ? newSettings.temperature : sessionSettings.temperature,
      top_p: newSettings.top_p !== undefined ? newSettings.top_p : sessionSettings.top_p,
      max_tokens: newSettings.max_tokens !== undefined ? newSettings.max_tokens : sessionSettings.max_tokens
    });
  };

  const loadMessages = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/paper-chat/sessions/${sessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }

    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionId || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/paper-chat/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          llm_model: sessionSettings.llm_model,
          temperature: sessionSettings.temperature
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const agentMessage = {
        id: Date.now() + 1,
        role: 'agent',
        content: data.message,
        citations: data.citations,
        reasoning: data.reasoning,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, agentMessage]);

      // Update highlighted chunks if citations exist
      if (data.citations && data.citations.length > 0) {
        setHighlightedChunks(data.citations);
      }

    } catch (err) {
      setError(err.message);
      // Remove the user message if sending failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCitationClick = (citationId, pageNumber, startChar, endChar) => {
    console.log('Citation clicked:', { citationId, pageNumber, startChar, endChar });
    
    // Find citation from all agent messages (not just current one)
    let citation = null;
    for (const message of messages) {
      if (message.role === 'agent' && message.citations) {
        citation = message.citations.find(c => {
          const id = c.index !== undefined ? c.index : message.citations.indexOf(c) + 1;
          return id === parseInt(citationId);
        });
        if (citation) break;
      }
    }

    if (citation) {
      console.log('Found citation:', citation);
      
      // Highlight the specific chunk in the PDF viewer
      setHighlightedChunks([citation]);
      
      // Use custom PDF viewer methods for navigation and highlighting
      if (pdfViewerRef.current) {
        const pdfViewer = pdfViewerRef.current;
        
        console.log('Using PDF viewer to highlight citation:', citation);
        
        try {
          // Use the new highlightCitation method
          if (pdfViewer.highlightCitation) {
            pdfViewer.highlightCitation(citation);
          } else {
            // Fallback to old method
            if (citation.page_number && pdfViewer.goToPage) {
              pdfViewer.goToPage(citation.page_number);
            }
            
            if (pdfViewer.highlightText && citation.content) {
              const textToHighlight = citation.content.substring(0, 100).trim();
              setTimeout(() => {
                pdfViewer.highlightText(textToHighlight, 'citation');
              }, 500);
            }
          }
          
        } catch (e) {
          console.error('Error highlighting citation in PDF viewer:', e);
        }
      } else {
        console.log('PDF viewer not available for citation highlighting');
      }
    } else {
      console.log('Citation not found for ID:', citationId);
    }
  };

  // Handle clicks on citation links in message content using event delegation
  // Use a container ref instead of document to avoid SSR issues
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleCitationLinkClick = (e) => {
      const citationLink = e.target.closest('.citation-link');
      if (!citationLink) return;
      
      e.preventDefault();
      e.stopPropagation();
      const citationId = citationLink.getAttribute('data-citation-id');
      const pageNumber = citationLink.getAttribute('data-page');
      const startChar = citationLink.getAttribute('data-start');
      const endChar = citationLink.getAttribute('data-end');
      
      if (!citationId) return;
      
      // Find citation from message citations
      const currentMessage = messages.find(m => m.role === 'agent' && m.citations);
      if (!currentMessage || !currentMessage.citations) {
        return;
      }

      const citation = currentMessage.citations.find(c => {
        const id = c.index !== undefined ? c.index : currentMessage.citations.indexOf(c) + 1;
        return id === parseInt(citationId);
      });

      if (citation) {
        // Highlight the specific chunk in the PDF viewer
        setHighlightedChunks([citation]);
        
        // Try to scroll to page in PDF iframe and highlight text
        if (pageNumber && pdfUrl) {
          // Use ref to access iframe instead of getElementById
          const iframe = pdfViewerRef.current;
          if (iframe && iframe.src) {
            try {
              // Method 1: Try to append page number to URL (works with browser's native PDF viewer)
              // Most PDF viewers support #page=N in URL
              const currentSrc = iframe.src || '';
              const urlWithoutHash = currentSrc.split('#')[0];
              let newUrl = `${urlWithoutHash}#page=${pageNumber}`;
              
              // Try to add text highlight if start_char and end_char are available
              // Enhanced PDF highlighting with multiple methods
              if (startChar && endChar && citation.content) {
                // Method 1: Try text search highlighting
                const textSnippet = citation.content.substring(0, 100).trim();
                if (textSnippet) {
                  // Some PDF viewers support #search=text for highlighting
                  newUrl = `${urlWithoutHash}#page=${pageNumber}&search=${encodeURIComponent(textSnippet)}`;
                  
                  // Also try with zoom parameter for better visibility
                  const zoomUrl = `${urlWithoutHash}#page=${pageNumber}&search=${encodeURIComponent(textSnippet)}&zoom=125`;
                  newUrl = zoomUrl;
                }
              }
              
              if (iframe.src !== newUrl) {
                iframe.src = newUrl;
              }
              
              // Method 2: Enhanced postMessage API with multiple highlight strategies
              setTimeout(() => {
                if (iframe && iframe.contentWindow) {
                  try {
                    // Strategy 1: Send highlight command
                    iframe.contentWindow.postMessage({
                      type: 'highlight',
                      page: parseInt(pageNumber),
                      startChar: startChar ? parseInt(startChar) : null,
                      endChar: endChar ? parseInt(endChar) : null,
                      text: citation.content ? citation.content.substring(0, 200) : null
                    }, '*');
                    
                    // Strategy 2: Send search command
                    if (citation.content) {
                      iframe.contentWindow.postMessage({
                        type: 'search',
                        query: citation.content.substring(0, 50).trim(),
                        page: parseInt(pageNumber)
                      }, '*');
                    }
                    
                    // Strategy 3: Send scroll to position
                    iframe.contentWindow.postMessage({
                      type: 'scrollToPosition',
                      page: parseInt(pageNumber),
                      position: {
                        start: startChar ? parseInt(startChar) : null,
                        end: endChar ? parseInt(endChar) : null
                      }
                    }, '*');
                  } catch (e) {
                    console.log('Could not send highlight commands to PDF viewer:', e);
                  }
                }
              }, 300); // Delay to ensure PDF page loads
            } catch (e) {
              console.log('Could not communicate with PDF viewer:', e);
            }
          }
        }
      }
    };

    container.addEventListener('click', handleCitationLinkClick);
    
    return () => {
      if (container) {
        container.removeEventListener('click', handleCitationLinkClick);
      }
    };
  }, [messages, pdfUrl]);

  const formatMessage = (content, citations = []) => {
    // Build citation map
    const citationMap = {};
    citations.forEach((citation, idx) => {
      const citationId = citation.index !== undefined ? citation.index : (idx + 1);
      citationMap[citationId] = citation;
    });

    let processedContent = content;
    
    // First, split multiple citations like [1, 2, 3] into separate [1] [2] [3]
    processedContent = processedContent.replace(/\[([0-9,\s]+)\](?!\()/g, (match, citationList) => {
      // Extract individual citation numbers
      const citationNumbers = citationList.split(',').map(num => num.trim()).filter(num => num);
      
      // Convert each number to individual citation
      return citationNumbers.map(num => `[${num}]`).join(' ');
    });

    // Replace individual [1], [2] patterns with cite tags for ReactMarkdown
    // Be careful not to replace markdown links [text](url)
    if (citations.length > 0) {
      processedContent = processedContent.replace(/\[(\d+)\](?!\()/g, (match, citationId) => {
        const id = parseInt(citationId);
        if (citationMap[id]) {
          const citation = citationMap[id];
          return `<cite data-citation-id="${id}" data-page="${citation.page_number || ''}" data-start="${citation.start_char || ''}" data-end="${citation.end_char || ''}">[${id}]</cite>`;
        }
        return match;
      });
    }

    // Also handle legacy [Context X] format
    processedContent = processedContent.replace(/\[Context (\d+)\]/g, (match, num) => {
      const id = parseInt(num);
      if (citationMap[id]) {
        const citation = citationMap[id];
        return `<cite data-citation-id="${id}" data-page="${citation.page_number || ''}" data-start="${citation.start_char || ''}" data-end="${citation.end_char || ''}">[${id}]</cite>`;
      }
      return `<cite data-citation-id="${num}">[${num}]</cite>`;
    });

    return { processedContent, citationMap };
  };

  if (error) {
    return (
      <div className="paper-chat-error">
        <div className="error-content">
          <h2>{t('paperChat.error.title') || 'Error'}</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/paper-chat')}>
            {t('paperChat.error.backToLibrary') || 'Back to Library'}
          </button>
        </div>
      </div>
    );
  }

  if (!document || !sessionId) {
    return (
      <div className="paper-chat-loading">
        <div className="loading-spinner">{t('paperChat.loading') || 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="paper-chat-interface">
      <Header 
        onProfileClick={() => navigate('/settings')}
        showBackButton={true}
        backRoute="/paper-chat"
        backTooltip="Back to Library"
        dialogTitle={document?.title}
        showDialogMenu={false}
      >
        <Tooltip text={t('paperChat.newSession') || 'Start a new chat session'}>
          <button 
            className="new-session-button"
            onClick={() => window.location.reload()}
            title={t('paperChat.newSession') || 'Start a new chat session'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6"></path>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            {t('paperChat.newSession')}
          </button>
        </Tooltip>
        <Tooltip text={t('paperChat.modelSettings.tooltip') || t('paperChat.modelSettings.title') || 'Model Settings'}>
          <button 
            className="model-settings-button"
            onClick={() => setIsModelSettingsOpen(true)}
            title={t('paperChat.modelSettings.tooltip') || `${t('paperChat.modelSettings.title') || 'Model Settings'}: ${sessionSettings.llm_model}`}
          >
            {(() => {
              const model = sessionSettings.llm_model || 'gpt-4';
              let provider = 'openai';
              if (model.includes('gemini') || model.startsWith('google')) {
                provider = 'gemini';
              } else if (model.startsWith('ollama') || model.startsWith('llama') || model.startsWith('mistral') || model.startsWith('codellama') || model.startsWith('phi')) {
                provider = 'ollama';
              }
              const providerIcon = provider === 'openai' ? '/images/openai.png' : provider === 'gemini' ? '/images/gemini.png' : '/images/ollama.png';
              return (
                <>
                  <img 
                    src={providerIcon} 
                    alt={provider}
                    className="model-settings-button-icon"
                    onError={(e) => {
                      // Fallback to icon if image fails
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className="model-settings-button-icon-fallback"
                    style={{ display: 'none' }}
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  <span className="model-settings-button-text">{sessionSettings.llm_model}</span>
                </>
              );
            })()}
          </button>
        </Tooltip>
        <Settings variant="header" />
      </Header>

      <div className="paper-chat-content">
        <div className="pdf-viewer-panel">
          {pdfUrl ? (
            <PDFViewer 
              pdfUrl={pdfUrl}
              highlightedChunks={highlightedChunks}
              onPageChange={(page) => console.log('Page changed:', page)}
              ref={pdfViewerRef}
            />
          ) : (
            <div className="pdf-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
              <p>PDF viewer not available</p>
            </div>
          )}
        </div>

        <div className="chat-panel">
          <div className="messages-container" ref={messagesContainerRef}>
            {messages.length === 0 ? (
              <div className="welcome-message">
                <div className="welcome-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <h3>{t('paperChat.welcome.title') || 'Start chatting with your document!'}</h3>
                <p>{t('paperChat.welcome.description') || 'Ask questions about the content, request summaries, or explore specific topics.'}</p>
                <div className="suggested-questions">
                  <button 
                    className="suggestion-button"
                    onClick={() => setInputMessage(t('paperChat.suggestions.contribution') || "What is the main contribution of this paper?")}
                  >
                    {t('paperChat.suggestions.contribution') || 'What is the main contribution?'}
                  </button>
                  <button 
                    className="suggestion-button"
                    onClick={() => setInputMessage(t('paperChat.suggestions.summary') || "Can you summarize the key findings?")}
                  >
                    {t('paperChat.suggestions.summary') || 'Summarize key findings'}
                  </button>
                  <button 
                    className="suggestion-button"
                    onClick={() => setInputMessage(t('paperChat.suggestions.methodology') || "What methodology was used?")}
                  >
                    {t('paperChat.suggestions.methodology') || 'What methodology was used?'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="messages-list">
                {messages.map((message) => (
                  <div key={message.id} className={`message ${message.role}`}>
                    <div className="message-avatar-wrapper">
                      <img
                        src={message.role === 'user' ? (user?.avatar_url || '/default_avatar.jpeg') : '/images/chatbot.png'}
                        alt={message.role === 'user' ? (user?.username || 'You') : 'Agent'}
                        className="message-avatar"
                        onError={(e) => {
                          e.target.src = message.role === 'user' ? '/default_avatar.jpeg' : '/images/chatbot.png';
                        }}
                      />
                    </div>
                    <div className="message-bubble-wrapper">
                      <div className="message-header-info">
                        <span className="message-name">
                          {message.role === 'user' ? (user?.username || t('message.you')) : t('message.agent')}
                        </span>
                        <span className="message-time">
                          {new Date(message.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                        {message.role === 'agent' && message.citations && message.citations.length > 0 && (
                          <button
                            className="citations-toggle-button"
                            onClick={() => {
                              setSelectedMessageCitations(message.citations);
                              // Get the latest user message before this agent message
                              const messageIndex = messages.findIndex(m => m.id === message.id);
                              let userQuery = 'Query not available';
                              for (let i = messageIndex - 1; i >= 0; i--) {
                                if (messages[i].role === 'user') {
                                  userQuery = messages[i].content;
                                  break;
                                }
                              }
                              setSelectedMessageQuery(userQuery);
                              setCitationsModalOpen(true);
                            }}
                            title={t('paperChat.citations.showSources') || 'Show retrieved sources'}
                          >
                            {t('paperChat.citations.showSources') || 'Sources'}
                          </button>
                        )}
                      </div>
                      <div className={`message-bubble ${message.role === 'user' ? 'message-bubble-user' : 'message-bubble-agent'}`}>
                        <div className="message-content">
                          <div className="message-text">
                            {(() => {
                              const { processedContent, citationMap } = formatMessage(message.content, message.citations || []);
                              
                              // Custom components for ReactMarkdown to handle cite tags
                              const markdownComponents = {
                                cite: ({ node, children, ...props }) => {
                                  const citationId = props['data-citation-id'];
                                  const pageNumber = props['data-page'];
                                  const startChar = props['data-start'];
                                  const endChar = props['data-end'];
                                  
                                  if (!citationId) {
                                    return <cite {...props}>{children}</cite>;
                                  }
                                  
                                  const id = parseInt(citationId);
                                  const citation = citationMap[id];
                                  
                                  return (
                                    <sup
                                      className="citation-sup"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Citation clicked:', id);
                                        handleCitationClick(id, pageNumber, startChar, endChar);
                                      }}
                                    >
                                      {children}
                                    </sup>
                                  );
                                },
                              };
                              
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
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="message agent loading">
                    <div className="message-avatar-wrapper">
                      <img
                        src="/images/chatbot.png"
                        alt="Agent"
                        className="message-avatar"
                      />
                    </div>
                    <div className="message-bubble-wrapper">
                      <div className="message-bubble message-bubble-agent">
                        <div className="message-content">
                          <div className="typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  // Auto-resize textarea
                  const textarea = e.target;
                  textarea.style.height = 'auto';
                  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
                }}
                onKeyPress={handleKeyPress}
                placeholder={t('paperChat.inputPlaceholder') || 'Ask a question about the document...'}
                className="message-input"
                rows="1"
                disabled={isLoading}
                style={{ overflow: 'hidden' }}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="send-button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConversationSettingsModal
        isOpen={isModelSettingsOpen}
        onClose={() => setIsModelSettingsOpen(false)}
        mode="paper-chat"
        sessionId={sessionId}
        session={sessionSettings}
        onUpdate={handleSaveModelSettings}
      />

      <CitationsModal
        isOpen={citationsModalOpen}
        onClose={() => setCitationsModalOpen(false)}
        query={selectedMessageQuery}
        citations={selectedMessageCitations}
        onCitationClick={(citation) => {
          console.log('Citation clicked from modal:', citation);
          
          // Use custom PDF viewer methods for navigation and highlighting
          if (pdfViewerRef.current) {
            const pdfViewer = pdfViewerRef.current;
            
            try {
              // Use the new highlightCitation method
              if (pdfViewer.highlightCitation) {
                pdfViewer.highlightCitation(citation);
              } else {
                // Fallback to old method
                if (citation.page_number && pdfViewer.goToPage) {
                  pdfViewer.goToPage(citation.page_number);
                }
                
                if (pdfViewer.highlightText && citation.content) {
                  const textToHighlight = citation.content.substring(0, 100).trim();
                  setTimeout(() => {
                    pdfViewer.highlightText(textToHighlight, 'citation');
                  }, 500);
                }
              }
              
            } catch (e) {
              console.error('Error highlighting citation from modal:', e);
            }
          } else {
            console.log('PDF viewer not available for citation highlighting from modal');
          }
          
          // Update highlighted chunks state
          setHighlightedChunks([citation]);
        }}
      />
    </div>
  );
};

export default PaperChatInterface;
