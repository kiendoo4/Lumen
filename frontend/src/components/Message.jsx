import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './Message.css';

function Message({ message }) {
  const { t } = useLanguage();
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-agent'} ${isError ? 'message-error' : ''}`}>
      <div className="message-header">
        <span className="message-role">{isUser ? t('message.you') : t('message.agent')}</span>
        {message.timestamp && (
          <span className="message-time">
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        )}
      </div>
      <div className="message-content">
        {message.content}
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
      {message.reasoning && message.reasoning.length > 0 && (
        <div className="message-reasoning">
          <div className="reasoning-header">{t('message.reasoning')}</div>
          <ul className="reasoning-steps">
            {message.reasoning.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        </div>
      )}
      {message.confidence && (
        <div className="message-confidence">
          <span className="confidence-label">{t('message.confidence')}</span>
          <span className={`confidence-value confidence-${message.confidence}`}>
            {message.confidence}
          </span>
        </div>
      )}
      {message.sources && message.sources.length > 0 && (
        <div className="message-sources">
          <div className="sources-header">{t('message.sources')}</div>
          <ul className="sources-list">
            {message.sources.map((source, idx) => (
              <li key={idx}>{source}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default Message;

