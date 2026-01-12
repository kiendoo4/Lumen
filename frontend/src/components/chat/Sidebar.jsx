import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import Tooltip from '../common/Tooltip';
import Settings from '../common/Settings';
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
  onOpenConversationSettings,
  onOpenDialogSearch
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [expandedConversations, setExpandedConversations] = useState(new Set());
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(true);

  // Auto-expand conversation when it's selected and has a selected dialog
  useEffect(() => {
    if (selectedConversationId && selectedDialogId) {
      setExpandedConversations(prev => {
        const next = new Set(prev);
        next.add(selectedConversationId);
        return next;
      });
    }
  }, [selectedConversationId, selectedDialogId]);

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

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>{t('sidebar.conversations')}</h2>
        <div className="sidebar-header-actions">
          <Tooltip text={t('sidebar.searchDialogs')} position="bottom">
            <button 
              className="sidebar-new-button"
              onClick={onOpenDialogSearch}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </button>
          </Tooltip>
          <Tooltip text={t('sidebar.newConversation')} position="bottom">
            <button 
              className="sidebar-new-button"
              onClick={onCreateConversation}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="sidebar-content">
        {/* Pinned Dialogs Section */}
        {(() => {
          const pinnedDialogs = [];
          conversations.forEach(conv => {
            if (conv.dialogs) {
              conv.dialogs.forEach(dialog => {
                if (dialog.is_pinned === 1 || dialog.is_pinned === true) {
                  pinnedDialogs.push({ ...dialog, conversation: conv });
                }
              });
            }
          });

          return pinnedDialogs.length > 0 ? (
            <div className="sidebar-pinned-section">
              <div 
                className="sidebar-pinned-header"
                onClick={() => setIsPinnedExpanded(!isPinnedExpanded)}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  className={`sidebar-pinned-chevron ${isPinnedExpanded ? 'expanded' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.76z"></path>
                </svg>
                <span className="sidebar-pinned-title">{t('sidebar.pinnedDialogs') || 'Pinned'}</span>
              </div>
              {isPinnedExpanded && (
                <div className="sidebar-pinned-dialogs">
                {pinnedDialogs.map(({ id, title, conversation }) => (
                  <div
                    key={id}
                    className={`sidebar-dialog-item ${
                      selectedDialogId === id ? 'active' : ''
                    } pinned`}
                    onClick={() => onSelectDialog(conversation.id, id)}
                  >
                    <div className="sidebar-dialog-indicator"></div>
                    <span className="sidebar-dialog-title">{title}</span>
                    <Tooltip text={t('sidebar.deleteDialog')} position="left">
                      <button
                        className="sidebar-dialog-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDialog(conversation.id, id);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </Tooltip>
                  </div>
                ))}
                </div>
              )}
            </div>
          ) : null;
        })()}

        {conversations.length === 0 ? (
          <div className="sidebar-empty">
            <p>{t('sidebar.noConversations')}</p>
          </div>
        ) : (
          <div className="sidebar-conversations">
            {conversations.map(conversation => (
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
                  <img 
                    src={conversation.avatar_url || '/images/chatbot.png'} 
                    alt={conversation.title}
                    className="sidebar-conversation-avatar"
                    onError={(e) => {
                      e.target.src = '/images/chatbot.png';
                    }}
                  />
                  <span className="sidebar-conversation-title">{conversation.title}</span>
                  <div className="sidebar-conversation-actions">
                    <Tooltip text={t('sidebar.newDialog')} position="bottom">
                      <button
                        className="sidebar-action-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateDialog(conversation.id);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </button>
                    </Tooltip>
                    {onOpenConversationSettings && (
                      <Tooltip text={t('sidebar.settings')} position="bottom">
                        <button
                          className="sidebar-action-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenConversationSettings(conversation.id);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
                          </svg>
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip text={t('sidebar.deleteConversation')} position="bottom">
                      <button
                        className="sidebar-action-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conversation.id);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </Tooltip>
                  </div>
                </div>
                {expandedConversations.has(conversation.id) && (
                  <div className="sidebar-dialogs">
                    {conversation.dialogs.length === 0 ? (
                      <div className="sidebar-empty-dialogs">
                        <p>{t('sidebar.noDialogs')}</p>
                      </div>
                    ) : (
                      <>
                        <div className="sidebar-dialogs-list">
                          {conversation.dialogs.map(dialog => (
                            <div
                              key={dialog.id}
                              className={`sidebar-dialog-item ${
                                selectedDialogId === dialog.id ? 'active' : ''
                              }`}
                              onClick={() => onSelectDialog(conversation.id, dialog.id)}
                            >
                              <div className="sidebar-dialog-indicator"></div>
                              <span className="sidebar-dialog-title">{dialog.title}</span>
                              <Tooltip text={t('sidebar.deleteDialog')} position="left">
                                <button
                                  className="sidebar-dialog-delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteDialog(conversation.id, dialog.id);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                  </svg>
                                </button>
                              </Tooltip>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Settings />
    </div>
  );
}

export default Sidebar;

