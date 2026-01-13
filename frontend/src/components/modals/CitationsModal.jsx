import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import './CitationsModal.css';

function CitationsModal({ isOpen, onClose, query, citations, onCitationClick }) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  // Sort citations by score (highest first)
  const sortedCitations = [...(citations || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="citations-modal-overlay" onClick={onClose}>
      <div className="citations-modal" onClick={(e) => e.stopPropagation()}>
        <div className="citations-modal-header">
          <h2 className="citations-modal-title">
            {t('paperChat.citations.title') || 'Retrieved Sources'}
          </h2>
          <button className="citations-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className="citations-modal-body">
          {query && (
            <div className="citations-query-section">
              <h3 className="citations-query-label">
                {t('paperChat.citations.query') || 'Query'}:
              </h3>
              <p className="citations-query-text">{query}</p>
            </div>
          )}
          
          <div className="citations-list-section">
            <h3 className="citations-list-label">
              {t('paperChat.citations.sources') || 'Top Retrieved Chunks'} ({sortedCitations.length})
            </h3>
            <div className="citations-list">
              {sortedCitations.map((citation, index) => {
                const id = citation.index !== undefined ? citation.index : (index + 1);
                return (
                  <div
                    key={index}
                    className="citation-item"
                    onClick={() => onCitationClick && onCitationClick(citation)}
                  >
                    <div className="citation-item-header">
                      <span className="citation-item-index">[{id}]</span>
                      {citation.score !== undefined && (
                        <span className="citation-item-score">
                          {t('paperChat.citations.similarity') || 'Similarity'}: {citation.score.toFixed(3)}
                        </span>
                      )}
                      {citation.page_number && (
                        <span className="citation-item-page">
                          {t('paperChat.citations.page') || 'Page'} {citation.page_number}
                        </span>
                      )}
                    </div>
                    <div className="citation-item-content">
                      {citation.content || (citation.title || 'Citation content')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="citations-modal-footer">
          <button
            className="citations-modal-button"
            onClick={onClose}
          >
            {t('settings.close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CitationsModal;
