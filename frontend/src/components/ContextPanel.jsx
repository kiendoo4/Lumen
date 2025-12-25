import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './ContextPanel.css';

function ContextPanel({ context, onAddContext }) {
  const { t } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFiles = (files) => {
    files.forEach(file => {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        onAddContext('paper', {
          type: 'file',
          value: file.name,
          file: file,
          id: Date.now() + Math.random()
        });
      } else {
        onAddContext('paper', {
          type: 'file',
          value: file.name,
          file: file,
          id: Date.now() + Math.random()
        });
      }
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleRemovePaper = (paperId) => {
    onAddContext('remove', { id: paperId });
  };

  return (
    <div className={`context-panel ${isCollapsed ? 'context-panel-collapsed' : ''}`}>
      <div className="context-panel-header">
        <h3>{t('context.title')}</h3>
        <button
          className="context-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="context-panel-content">
          <div className="context-section">
            <h4>{t('context.sources')}</h4>
            {context.papers.length === 0 ? (
              <div
                className={`context-drop-zone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="drop-zone-content">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <p className="drop-zone-text">{t('context.dropFiles')}</p>
                  <p className="drop-zone-hint">{t('context.orClick')}</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  className="context-file-input"
                  style={{ display: 'none' }}
                />
              </div>
            ) : (
              <div className="context-sources-list">
                {context.papers.map(paper => (
                  <div key={paper.id} className="context-source-item">
                    <div className="source-icon">
                      {paper.type === 'file' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                          <polyline points="13 2 13 9 20 9"></polyline>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      )}
                    </div>
                    <div className="source-info">
                      <span className="source-name">{paper.value}</span>
                      {paper.type && paper.type !== 'file' && (
                        <span className="source-type">{paper.type.toUpperCase()}</span>
                      )}
                    </div>
                    <button
                      className="source-remove"
                      onClick={() => handleRemovePaper(paper.id)}
                      title={t('context.remove')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))}
                <div
                  className="context-add-more"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={`context-drop-zone-small ${isDragging ? 'dragging' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>{t('context.addMore')}</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    className="context-file-input"
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContextPanel;
