import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import './DialogSettingsModal.css';

function DialogSettingsModal({ isOpen, onClose, settings, onSave, context, onAddContext }) {
  const { t } = useLanguage();
  const [localSettings, setLocalSettings] = useState(() => {
    return settings || {
      llm: 'gpt-4',
      freedom: 0.5,
      temperature: 0.7,
      topP: 0.9,
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
      maxTokens: 2000
    };
  });
  const [modelCards, setModelCards] = useState({ openai: [], gemini: [], ollama: [] });
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      fetchModelCards();
    }
  }, [isOpen]);

  const fetchModelCards = async () => {
    try {
      const response = await axios.get('/api/models/');
      setModelCards(response.data.models);
    } catch (error) {
      console.error('Error fetching model cards:', error);
    }
  };

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFiles = (files) => {
    files.forEach(file => {
      onAddContext('paper', {
        type: 'file',
        value: file.name,
        file: file,
        id: Date.now() + Math.random()
      });
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

  const handleRemoveSource = (sourceId) => {
    onAddContext('remove', { id: sourceId });
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('settings.title')}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* LLM Settings */}
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.llm.title')}</h3>
            <div className="settings-field">
              <label>{t('settings.llm.provider')}</label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  // Auto-select first model of provider
                  if (modelCards[e.target.value] && modelCards[e.target.value].length > 0) {
                    handleChange('llm', modelCards[e.target.value][0].id);
                  }
                }}
                className="settings-select"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>
            <div className="settings-field">
              <label>{t('settings.llm.model')}</label>
              {modelCards[selectedProvider] && modelCards[selectedProvider].length > 0 ? (
                <div className="model-cards-grid">
                  {modelCards[selectedProvider].map(model => (
                    <div
                      key={model.id}
                      className={`model-card ${localSettings.llm === model.id ? 'selected' : ''}`}
                      onClick={() => handleChange('llm', model.id)}
                    >
                      <div className="model-card-name">{model.name}</div>
                      <div className="model-card-description">{model.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="model-cards-loading">Loading models...</div>
              )}
            </div>
          </div>

          {/* Advanced LLM Parameters */}
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.advanced.title')}</h3>
            <p className="settings-section-description">{t('settings.advanced.description')}</p>

            <div className="settings-field">
              <div className="settings-field-header">
                <label>{t('settings.advanced.freedom')}</label>
                <span className="settings-value">{localSettings.freedom.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localSettings.freedom}
                onChange={(e) => handleChange('freedom', parseFloat(e.target.value))}
                className="settings-slider"
              />
            </div>

            <div className="settings-field">
              <div className="settings-field-header">
                <label>{t('settings.advanced.temperature')}</label>
                <span className="settings-value">{localSettings.temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={localSettings.temperature}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                className="settings-slider"
              />
            </div>

            <div className="settings-field">
              <div className="settings-field-header">
                <label>{t('settings.advanced.topP')}</label>
                <span className="settings-value">{localSettings.topP.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localSettings.topP}
                onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
                className="settings-slider"
              />
            </div>

            <div className="settings-field">
              <div className="settings-field-header">
                <label>{t('settings.advanced.presencePenalty')}</label>
                <span className="settings-value">{localSettings.presencePenalty.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.01"
                value={localSettings.presencePenalty}
                onChange={(e) => handleChange('presencePenalty', parseFloat(e.target.value))}
                className="settings-slider"
              />
            </div>

            <div className="settings-field">
              <div className="settings-field-header">
                <label>{t('settings.advanced.frequencyPenalty')}</label>
                <span className="settings-value">{localSettings.frequencyPenalty.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.01"
                value={localSettings.frequencyPenalty}
                onChange={(e) => handleChange('frequencyPenalty', parseFloat(e.target.value))}
                className="settings-slider"
              />
            </div>

            <div className="settings-field">
              <div className="settings-field-header">
                <label>{t('settings.advanced.maxTokens')}</label>
                <span className="settings-value">{localSettings.maxTokens}</span>
              </div>
              <input
                type="number"
                min="1"
                max="8000"
                step="100"
                value={localSettings.maxTokens}
                onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
                className="settings-input"
              />
            </div>
          </div>

          {/* Research Context */}
          <div className="settings-section">
            <h3 className="settings-section-title">{t('settings.context.title')}</h3>
            <p className="settings-section-description">{t('settings.context.description')}</p>

            {context.papers.length === 0 ? (
              <div
                className={`settings-drop-zone ${isDragging ? 'dragging' : ''}`}
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
                  <p className="drop-zone-text">{t('settings.context.dropFiles')}</p>
                  <p className="drop-zone-hint">{t('settings.context.supportedFormats')}</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={handleFileSelect}
                  className="settings-file-input"
                  style={{ display: 'none' }}
                />
              </div>
            ) : (
              <div className="settings-sources-list">
                {context.papers.map(paper => (
                  <div key={paper.id} className="settings-source-item">
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
                      onClick={() => handleRemoveSource(paper.id)}
                      title={t('settings.context.remove')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))}
                <div
                  className="settings-add-more"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={`settings-drop-zone-small ${isDragging ? 'dragging' : ''}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>{t('settings.context.addMore')}</span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md"
                    onChange={handleFileSelect}
                    className="settings-file-input"
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-button modal-button-secondary" onClick={onClose}>
            {t('settings.cancel')}
          </button>
          <button className="modal-button modal-button-primary" onClick={handleSave}>
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DialogSettingsModal;

