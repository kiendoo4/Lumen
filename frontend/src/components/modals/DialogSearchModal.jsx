import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import './DialogSearchModal.css';

function DialogSearchModal({ isOpen, onClose, conversations, onSelectDialog }) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDialogs, setFilteredDialogs] = useState([]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }
    // Focus search input when modal opens
    const input = document.querySelector('.dialog-search-modal-input');
    if (input) {
      setTimeout(() => input.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      // Show all dialogs grouped by conversation
      const allDialogs = [];
      conversations.forEach(conv => {
        conv.dialogs.forEach(dialog => {
          allDialogs.push({ ...dialog, conversation: conv });
        });
      });
      setFilteredDialogs(allDialogs);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = [];
    
    conversations.forEach(conv => {
      conv.dialogs.forEach(dialog => {
        if (dialog.title.toLowerCase().includes(query) || 
            conv.title.toLowerCase().includes(query)) {
          results.push({ ...dialog, conversation: conv });
        }
      });
    });
    
    setFilteredDialogs(results);
  }, [searchQuery, conversations]);

  const handleSelectDialog = (conversationId, dialogId) => {
    onSelectDialog(conversationId, dialogId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-search-modal-overlay" onClick={onClose}>
      <div className="dialog-search-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-search-modal-header">
          <h2>{t('dialogSearch.title')}</h2>
          <button className="dialog-search-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="dialog-search-modal-search">
          <svg className="dialog-search-modal-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            className="dialog-search-modal-input"
            placeholder={t('dialogSearch.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="dialog-search-modal-results">
          {filteredDialogs.length === 0 ? (
            <div className="dialog-search-modal-empty">
              <p>{t('dialogSearch.noResults')}</p>
            </div>
          ) : (
            <div className="dialog-search-modal-list">
              {filteredDialogs.map((dialog) => (
                <div
                  key={dialog.id}
                  className="dialog-search-modal-item"
                  onClick={() => handleSelectDialog(dialog.conversation.id, dialog.id)}
                >
                  <div className="dialog-search-modal-item-header">
                    <div className="dialog-search-modal-item-info">
                      <div className="dialog-search-modal-item-title">{dialog.title}</div>
                      <div className="dialog-search-modal-item-conversation">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span>{dialog.conversation.title}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DialogSearchModal;

