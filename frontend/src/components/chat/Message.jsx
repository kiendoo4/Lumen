import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import './Message.css';

function Message({ message, onDelete, onRedo }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isUser = message.role === 'user';
  const isError = message.isError;

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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
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
          
          return reasoningSteps.length > 0 && (
            <div className="message-reasoning">
              <div className="reasoning-header">{t('message.reasoning')}</div>
              <ul className="reasoning-steps">
                {reasoningSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
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

