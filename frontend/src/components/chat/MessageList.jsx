import React from 'react';
import Message from './Message';
import LoadingIndicator from '../common/LoadingIndicator';
import { useLanguage } from '../../contexts/LanguageContext';
import './MessageList.css';

function MessageList({ messages, isLoading, messagesEndRef, messageListRef, onDeleteMessage, onRedoMessage }) {
  const { t } = useLanguage();

  return (
    <div className="message-list" ref={messageListRef}>
      <div className="message-list-content">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                <path d="M13 8l-3 3 3 3"></path>
              </svg>
            </div>
            <h2>{t('chat.empty.title') || 'Start a conversation'}</h2>
            <p>{t('chat.empty.description') || 'Ask me anything about research, papers, or academic topics. I\'m here to help!'}</p>
            <div className="example-questions">
              <p className="example-label">{t('chat.empty.examples') || 'Try asking:'}</p>
              <ul>
                <li>"What problem does this paper solve?"</li>
                <li>"How does method A differ from method B?"</li>
                <li>"What are the limitations of this study?"</li>
                <li>"Can you summarize the key findings?"</li>
                <li>"What are the practical applications?"</li>
              </ul>
            </div>
          </div>
        )}
        {messages.map(message => (
          <Message 
            key={message.id} 
            message={message}
            onDelete={onDeleteMessage}
            onRedo={onRedoMessage}
          />
        ))}
        {isLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default MessageList;

