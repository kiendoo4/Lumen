import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import './CreateConversationModal.css';

function CreateConversationModal({ isOpen, onClose, onCreate }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [emptyResponse, setEmptyResponse] = useState('');
  const [openingGreeting, setOpeningGreeting] = useState('');
  
  // LLM Model Selection
  const [modelCards, setModelCards] = useState({});
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  
  // Model Settings
  const [freedom, setFreedom] = useState(0.5);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [presencePenalty, setPresencePenalty] = useState(0.0);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0.0);
  const [maxTokens, setMaxTokens] = useState(2000);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dialog'); // 'dialog' or 'model'
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchModelCards();
    }
  }, [isOpen]);

  const fetchModelCards = async () => {
    try {
      const response = await axios.get('/api/models/');
      // Backend returns { openai: [...], gemini: [...], ollama: [...] }
      const models = response.data;
      setModelCards(models);
      // Set default model based on selected provider
      if (models[selectedProvider] && models[selectedProvider].length > 0) {
        setSelectedModel(models[selectedProvider][0].id);
      }
    } catch (error) {
      console.error('Error fetching model cards:', error);
      // Fallback to default models
      const fallbackModels = {
        openai: [{ id: 'gpt-4', name: 'GPT-4', description: 'Most capable model' }],
        gemini: [{ id: 'gemini-pro', name: 'Gemini Pro', description: 'Google\'s advanced model' }],
        ollama: [{ id: 'llama3', name: 'Llama 3', description: 'Latest Llama model' }]
      };
      setModelCards(fallbackModels);
      if (fallbackModels[selectedProvider] && fallbackModels[selectedProvider].length > 0) {
        setSelectedModel(fallbackModels[selectedProvider][0].id);
      }
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError(t('createConversation.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      // Create conversation
      const formData = new FormData();
      formData.append('title', name);
      if (avatar) {
        formData.append('avatar', avatar);
      }

      const conversationResponse = await axios.post('/api/conversations/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const conversationId = conversationResponse.data.id;

      // Create first dialog with model settings
      const dialogResponse = await axios.post(`/api/dialogs/conversation/${conversationId}`, {
        title: name,
        llm_model: selectedModel,
        freedom: freedom,
        temperature: temperature,
        top_p: topP,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
        max_tokens: maxTokens
      });

      // TODO: Save description, empty_response, opening_greeting to conversation or dialog
      // These fields might need to be added to the backend schema

      if (onCreate) {
        onCreate({
          conversation: conversationResponse.data,
          dialog: dialogResponse.data
        });
      }

      // Reset form
      handleReset();
      onClose();
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError(error.response?.data?.detail || t('createConversation.createError'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName('');
    setDescription('');
    setAvatar(null);
    setAvatarPreview(null);
    setEmptyResponse('');
    setOpeningGreeting('');
    setActiveTab('dialog');
    setSelectedProvider('openai');
    setSelectedModel('gpt-4');
    setFreedom(0.5);
    setTemperature(0.7);
    setTopP(0.9);
    setPresencePenalty(0.0);
    setFrequencyPenalty(0.0);
    setMaxTokens(2000);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="create-conversation-modal-overlay" onClick={handleClose}>
      <div 
        className="create-conversation-modal-content" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-conversation-modal-header">
          <div className="create-conversation-header-content">
            <h2>{t('createConversation.title')}</h2>
            <p className="create-conversation-header-subtitle">{t('createConversation.subtitle')}</p>
          </div>
          <button className="create-conversation-modal-close" onClick={handleClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="create-conversation-tabs">
          <button
            type="button"
            className={`create-conversation-tab ${activeTab === 'dialog' ? 'active' : ''}`}
            onClick={() => setActiveTab('dialog')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>{t('createConversation.dialogConfig')}</span>
          </button>
          <button
            type="button"
            className={`create-conversation-tab ${activeTab === 'model' ? 'active' : ''}`}
            onClick={() => setActiveTab('model')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <span>{t('createConversation.modelConfig')}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-conversation-form">
          {error && (
            <div className="create-conversation-error-message">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="create-conversation-modal-body">
            {/* Dialog Config Tab */}
            {activeTab === 'dialog' && (
              <div className="create-conversation-tab-content">
                <div className="create-conversation-section">
                  <h3 className="create-conversation-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    {t('createConversation.dialogConfig')}
                  </h3>
                  <p className="create-conversation-section-description">{t('createConversation.dialogConfigDescription')}</p>
              
              <div className="create-conversation-field">
                <label>
                  {t('createConversation.name')} <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('createConversation.namePlaceholder')}
                  required
                  disabled={loading}
                  className="create-conversation-input"
                />
              </div>

              <div className="create-conversation-field">
                <label>{t('createConversation.description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('createConversation.descriptionPlaceholder')}
                  rows="3"
                  disabled={loading}
                  className="create-conversation-textarea"
                />
              </div>

              <div className="create-conversation-field">
                <label>{t('createConversation.avatar')}</label>
                <div className="create-conversation-avatar-upload">
                  {avatarPreview ? (
                    <div className="create-conversation-avatar-preview">
                      <img src={avatarPreview} alt="Avatar preview" />
                      <button
                        type="button"
                        className="create-conversation-avatar-remove"
                        onClick={() => {
                          setAvatar(null);
                          setAvatarPreview(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="create-conversation-avatar-button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span>{t('createConversation.uploadAvatar')}</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div className="create-conversation-field">
                <label>{t('createConversation.emptyResponse')}</label>
                <textarea
                  value={emptyResponse}
                  onChange={(e) => setEmptyResponse(e.target.value)}
                  placeholder={t('createConversation.emptyResponsePlaceholder')}
                  rows="2"
                  disabled={loading}
                  className="create-conversation-textarea"
                />
              </div>

              <div className="create-conversation-field">
                <label>{t('createConversation.openingGreeting')}</label>
                <textarea
                  value={openingGreeting}
                  onChange={(e) => setOpeningGreeting(e.target.value)}
                  placeholder={t('createConversation.openingGreetingPlaceholder')}
                  rows="2"
                  disabled={loading}
                  className="create-conversation-textarea"
                />
              </div>
                </div>
              </div>
            )}

            {/* Model Config Tab */}
            {activeTab === 'model' && (
              <div className="create-conversation-tab-content">
                <div className="create-conversation-section">
                  <h3 className="create-conversation-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    {t('createConversation.modelConfig')}
                  </h3>
                  <p className="create-conversation-section-description">{t('createConversation.modelConfigDescription')}</p>
              
              {/* LLM Provider and Model Selection */}
              <div className="create-conversation-field">
                <label>{t('settings.llm.provider')}</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value);
                    // Auto-select first model of provider
                    if (modelCards[e.target.value] && modelCards[e.target.value].length > 0) {
                      setSelectedModel(modelCards[e.target.value][0].id);
                    }
                  }}
                  className="create-conversation-input"
                  disabled={loading}
                >
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                  <option value="ollama">Ollama</option>
                </select>
              </div>

              <div className="create-conversation-field">
                <label>{t('settings.llm.model')}</label>
                {modelCards[selectedProvider] && modelCards[selectedProvider].length > 0 ? (
                  <div className="create-conversation-model-cards">
                    {modelCards[selectedProvider].map(model => (
                      <div
                        key={model.id}
                        className={`create-conversation-model-card ${selectedModel === model.id ? 'selected' : ''}`}
                        onClick={() => setSelectedModel(model.id)}
                      >
                        <div className="create-conversation-model-card-name">{model.name}</div>
                        <div className="create-conversation-model-card-description">{model.description}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="create-conversation-model-loading">Loading models...</div>
                )}
              </div>
              
              <div className="create-conversation-field">
                <div className="create-conversation-field-header">
                  <label>{t('settings.advanced.freedom')}</label>
                  <span className="create-conversation-value">{freedom.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={freedom}
                  onChange={(e) => setFreedom(parseFloat(e.target.value))}
                  disabled={loading}
                  className="create-conversation-slider"
                />
              </div>

              <div className="create-conversation-field">
                <div className="create-conversation-field-header">
                  <label>{t('settings.advanced.temperature')}</label>
                  <span className="create-conversation-value">{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  disabled={loading}
                  className="create-conversation-slider"
                />
              </div>

              <div className="create-conversation-field">
                <div className="create-conversation-field-header">
                  <label>{t('settings.advanced.topP')}</label>
                  <span className="create-conversation-value">{topP.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  disabled={loading}
                  className="create-conversation-slider"
                />
              </div>

              <div className="create-conversation-field">
                <div className="create-conversation-field-header">
                  <label>{t('settings.advanced.presencePenalty')}</label>
                  <span className="create-conversation-value">{presencePenalty.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={presencePenalty}
                  onChange={(e) => setPresencePenalty(parseFloat(e.target.value))}
                  disabled={loading}
                  className="create-conversation-slider"
                />
              </div>

              <div className="create-conversation-field">
                <div className="create-conversation-field-header">
                  <label>{t('settings.advanced.frequencyPenalty')}</label>
                  <span className="create-conversation-value">{frequencyPenalty.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.01"
                  value={frequencyPenalty}
                  onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value))}
                  disabled={loading}
                  className="create-conversation-slider"
                />
              </div>

              <div className="create-conversation-field">
                <div className="create-conversation-field-header">
                  <label>{t('settings.advanced.maxTokens')}</label>
                  <span className="create-conversation-value">{maxTokens}</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="32000"
                  step="1"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2000)}
                  disabled={loading}
                  className="create-conversation-input"
                />
              </div>
                </div>
              </div>
            )}
          </div>

          <div className="create-conversation-modal-footer">
            <button
              type="button"
              className="create-conversation-button cancel"
              onClick={handleClose}
              disabled={loading}
            >
              {t('settings.cancel')}
            </button>
            <button
              type="submit"
              className="create-conversation-button submit"
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <>
                  <svg className="create-conversation-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <span>{t('auth.loading')}</span>
                </>
              ) : (
                <span>{t('createConversation.create')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateConversationModal;

