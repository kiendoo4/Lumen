import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import Header from '../chat/Header';
import Settings from '../common/Settings';
import Tooltip from '../common/Tooltip';
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!documentId) {
      navigate('/paper-chat/upload');
      return;
    }

    loadDocument();
    createChatSession();
  }, [documentId, navigate]);

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
          llm_model: 'gpt-4',
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2000
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create chat session');
      }

      const data = await response.json();
      setSessionId(data.id);

      // Load existing messages if any
      loadMessages(data.id);

    } catch (err) {
      setError(err.message);
    }
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
          llm_model: 'gpt-4',
          temperature: 0.7
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

  const handleCitationClick = (citation) => {
    // Highlight the specific chunk in the PDF viewer
    setHighlightedChunks([citation]);
    
    // You could also scroll to the specific page if page number is available
    if (citation.page_number) {
      // This would require integration with a PDF viewer library
      console.log(`Scroll to page ${citation.page_number}`);
    }
  };

  const formatMessage = (content) => {
    // Replace citation markers with clickable links
    return content.replace(/\[Context (\d+)\]/g, (match, num) => {
      return `<span class="citation-link" data-citation="${num}">[Context ${num}]</span>`;
    });
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
        <button 
          className="new-session-button"
          onClick={() => window.location.reload()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6"></path>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          {t('paperChat.newSession')}
        </button>
        <Settings variant="header" />
      </Header>

      <div className="paper-chat-content">
        <div className="pdf-viewer-panel">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="PDF Viewer"
              className="pdf-iframe"
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
          <div className="messages-container">
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
                      </div>
                      <div className={`message-bubble ${message.role === 'user' ? 'message-bubble-user' : 'message-bubble-agent'}`}>
                        <div className="message-content">
                          <div 
                            className="message-text"
                            dangerouslySetInnerHTML={{ 
                              __html: formatMessage(message.content) 
                            }}
                          />
                          {message.citations && message.citations.length > 0 && (
                            <div className="message-citations">
                              <h4>{t('message.references') || 'References'}:</h4>
                              {message.citations.map((citation, index) => (
                                <div 
                                  key={index}
                                  className="citation"
                                  onClick={() => handleCitationClick(citation)}
                                >
                                  <span className="citation-index">[{citation.index || index + 1}]</span>
                                  <span className="citation-content">
                                    {citation.content ? (citation.content.substring(0, 100) + '...') : (citation.title || 'Citation')}
                                  </span>
                                  {citation.page_number && (
                                    <span className="citation-page">{t('paperChat.page') || 'Page'} {citation.page_number}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
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
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('paperChat.inputPlaceholder') || 'Ask a question about the document...'}
                className="message-input"
                rows="1"
                disabled={isLoading}
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
    </div>
  );
};

export default PaperChatInterface;
