import React from 'react';
import Message from './Message';
import LoadingIndicator from './LoadingIndicator';
import { useLanguage } from '../contexts/LanguageContext';
import './MessageList.css';

function MessageList({ messages, isLoading, messagesEndRef }) {
  const { t } = useLanguage();

  return (
    <div className="message-list">
      <div className="message-list-content">
        {messages.length === 0 && (
          <div className="empty-state">
            <h2>{t('chat.empty.title')}</h2>
            <p>{t('chat.empty.description')}</p>
            <div className="example-questions">
              <p className="example-label">{t('chat.empty.examples')}</p>
              <ul>
                <li>What problem does this paper solve?</li>
                <li>How does method A differ from method B?</li>
                <li>What are the limitations of this study?</li>
              </ul>
            </div>
          </div>
        )}
        {messages.map(message => (
          <Message key={message.id} message={message} />
        ))}
        {isLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default MessageList;

