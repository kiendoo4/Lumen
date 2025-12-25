import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './Sidebar.css';

function Sidebar({ 
  conversations, 
  selectedConversationId, 
  selectedDialogId,
  onSelectConversation,
  onSelectDialog,
  onCreateConversation,
  onCreateDialog,
  onSearch,
  onDeleteConversation,
  onDeleteDialog,
  onOpenConversationSettings
}) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedConversations, setExpandedConversations] = useState(new Set());

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const toggleConversation = (id) => {
    setExpandedConversations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredConversations = searchQuery
    ? conversations.filter(c => 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.dialogs.some(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : conversations;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>{t('sidebar.conversations')}</h2>
        <button 
          className="sidebar-new-button"
          onClick={onCreateConversation}
          title={t('sidebar.newConversation')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder={t('sidebar.searchPlaceholder')}
          value={searchQuery}
          onChange={handleSearch}
          className="sidebar-search-input"
        />
      </div>

      <div className="sidebar-content">
        {filteredConversations.length === 0 ? (
          <div className="sidebar-empty">
            <p>{t('sidebar.noConversations')}</p>
          </div>
        ) : (
          <div className="sidebar-conversations">
            {filteredConversations.map(conversation => (
              <div key={conversation.id} className="sidebar-conversation-item">
                <div 
                  className={`sidebar-conversation-header ${
                    selectedConversationId === conversation.id ? 'active' : ''
                  }`}
                  onClick={() => {
                    toggleConversation(conversation.id);
                    onSelectConversation(conversation.id);
                  }}
                >
                  {conversation.avatar_url && (
                    <img 
                      src={conversation.avatar_url} 
                      alt={conversation.title}
                      className="sidebar-conversation-avatar"
                    />
                  )}
                  <span className="sidebar-conversation-title">{conversation.title}</span>
                  <div className="sidebar-conversation-actions">
                    <button
                      className="sidebar-action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenConversationSettings(conversation.id);
                      }}
                      title={t('sidebar.settings')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-4.242 0L5.636 18.364M18.364 5.636l-4.243 4.243m0 0L5.636 5.636"></path>
                      </svg>
                    </button>
                    <button
                      className="sidebar-action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateDialog(conversation.id);
                      }}
                      title={t('sidebar.newDialog')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </button>
                    <button
                      className="sidebar-action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conversation.id);
                      }}
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                {expandedConversations.has(conversation.id) && (
                  <div className="sidebar-dialogs">
                    {conversation.dialogs.length === 0 ? (
                      <div className="sidebar-empty-dialogs">
                        <p>{t('sidebar.noDialogs')}</p>
                      </div>
                    ) : (
                      conversation.dialogs.map(dialog => (
                        <div
                          key={dialog.id}
                          className={`sidebar-dialog-item ${
                            selectedDialogId === dialog.id ? 'active' : ''
                          }`}
                          onClick={() => onSelectDialog(conversation.id, dialog.id)}
                        >
                          <span className="sidebar-dialog-title">{dialog.title}</span>
                          <button
                            className="sidebar-dialog-delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDialog(conversation.id, dialog.id);
                            }}
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Sidebar;

