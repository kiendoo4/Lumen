import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
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
  const [enabledProviders, setEnabledProviders] = useState([]);
  
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
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchModelCards();
      fetchEnabledProviders();
    }
  }, [isOpen]);

  const fetchModelCards = async () => {
    try {
      const response = await axios.get('/api/models/');
      // Backend returns { openai: [...], gemini: [...], ollama: [...] }
      const models = response.data;
      setModelCards(models);
    } catch (error) {
      console.error('Error fetching model cards:', error);
      // Fallback to empty object
      setModelCards({});
    }
  };

  const fetchEnabledProviders = async () => {
    try {
      const response = await axios.get('/api/llm-providers/');
      const providers = response.data || [];
      const names = providers.map(p => p.provider);
      setEnabledProviders(names);
    } catch (error) {
      console.error('Error fetching enabled providers:', error);
      setEnabledProviders([]);
    }
  };

  // Sync selectedProvider với enabledProviders sau khi cả hai đã load
  useEffect(() => {
    if (enabledProviders.length > 0 && Object.keys(modelCards).length > 0) {
      // Nếu selectedProvider không có trong danh sách enabled, chọn provider đầu tiên
      if (!enabledProviders.includes(selectedProvider)) {
        const firstProvider = enabledProviders[0];
        setSelectedProvider(firstProvider);
        // Reset model về model đầu tiên của provider mới
        const firstProviderModels = modelCards[firstProvider] || [];
        if (firstProviderModels.length > 0) {
          const firstModel = firstProviderModels[0];
          setSelectedModel(firstModel.id);
          if (firstModel.max_tokens) {
            setMaxTokens(firstModel.max_tokens);
          }
        }
      } else {
        // Nếu provider hợp lệ, đảm bảo model được set đúng
        const providerModels = modelCards[selectedProvider] || [];
        if (providerModels.length > 0 && !providerModels.find(m => m.id === selectedModel)) {
          const firstModel = providerModels[0];
          setSelectedModel(firstModel.id);
          if (firstModel.max_tokens) {
            setMaxTokens(firstModel.max_tokens);
          }
        }
      }
    }
  }, [enabledProviders, modelCards, selectedProvider]);

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
      // Create conversation with dialog settings (backend will automatically create dialog)
      const formData = new FormData();
      formData.append('title', name);
      if (avatar) {
        formData.append('avatar', avatar);
      }
      // Add dialog settings to form data
      formData.append('llm_model', selectedModel);
      formData.append('freedom', freedom.toString());
      formData.append('temperature', temperature.toString());
      formData.append('top_p', topP.toString());
      formData.append('presence_penalty', presencePenalty.toString());
      formData.append('frequency_penalty', frequencyPenalty.toString());
      formData.append('max_tokens', maxTokens.toString());

      const conversationResponse = await axios.post('/api/conversations/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Backend automatically creates a dialog, so use the first dialog from the response
      const dialog = conversationResponse.data.dialogs && conversationResponse.data.dialogs.length > 0
        ? conversationResponse.data.dialogs[0]
        : null;

      // TODO: Save description, empty_response, opening_greeting to conversation or dialog
      // These fields might need to be added to the backend schema

      if (onCreate && dialog) {
        onCreate({
          conversation: conversationResponse.data,
          dialog: dialog
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
    setIsAdvancedSettingsOpen(false);
    setIsProviderDropdownOpen(false);
    setIsModelDropdownOpen(false);
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

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProviderDropdownOpen || isModelDropdownOpen) {
        const target = event.target;
        if (!target.closest('.model-select')) {
          setIsProviderDropdownOpen(false);
          setIsModelDropdownOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isProviderDropdownOpen, isModelDropdownOpen]);

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
                  {/* LLM Provider and Model Selection */}
              {/* LLM Provider selection (custom dropdown with logos) */}
              <div className="create-conversation-field">
                <label>{t('settings.llm.provider')}</label>
                <div className="model-select">
                  <button
                    type="button"
                    className="model-select-trigger"
                    onClick={() => setIsProviderDropdownOpen(open => !open)}
                    disabled={loading}
                  >
                    <div className="model-select-trigger-content">
                      <img
                        src={
                          selectedProvider === 'openai'
                            ? '/images/openai.png'
                            : selectedProvider === 'gemini'
                              ? '/images/gemini.png'
                              : '/images/ollama.png'
                        }
                        alt={selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'gemini' ? 'Gemini' : 'Ollama'}
                        className="model-select-trigger-logo"
                      />
                      <div className="model-select-trigger-text">
                        <span className="model-select-trigger-name">
                          {selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'gemini' ? 'Gemini' : 'Ollama'}
                        </span>
                      </div>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={isProviderDropdownOpen ? 'expanded' : ''}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>

                  {isProviderDropdownOpen && (
                    <div className="model-select-menu">
                      {enabledProviders.length > 0 ? (
                        enabledProviders.map(provider => {
                          const name =
                            provider === 'openai'
                              ? 'OpenAI'
                              : provider === 'gemini'
                                ? 'Gemini'
                                : 'Ollama';
                          const logo =
                            provider === 'openai'
                              ? '/images/openai.png'
                              : provider === 'gemini'
                                ? '/images/gemini.png'
                                : '/images/ollama.png';

                          return (
                            <div
                              key={provider}
                              className={`model-select-option ${
                                selectedProvider === provider ? 'selected' : ''
                              }`}
                              onClick={() => {
                                setSelectedProvider(provider);
                                setIsProviderDropdownOpen(false);
                                const list = modelCards[provider] || [];
                                if (list.length > 0) {
                                  setSelectedModel(list[0].id);
                                  if (list[0].max_tokens) {
                                    setMaxTokens(list[0].max_tokens);
                                  }
                                }
                              }}
                            >
                              <div className="model-select-option-header">
                                <img
                                  src={logo}
                                  alt={name}
                                  className="model-select-option-logo"
                                />
                                <div className="model-select-option-title">
                                  <div className="model-select-option-name">{name}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="model-select-option disabled">
                          <div className="model-select-option-title">
                            <div className="model-select-option-name">
                              {t('conversationSettings.noProvidersConfigured') || 'No providers configured. Please add providers in Settings.'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="create-conversation-field">
                <label>{t('settings.llm.model')}</label>
                {!enabledProviders.includes(selectedProvider) ? (
                  <div className="create-conversation-model-loading">
                    {t('conversationSettings.providerNotConfigured') || `Configure ${selectedProvider} in Settings before selecting a model.`}
                  </div>
                ) : modelCards[selectedProvider] && modelCards[selectedProvider].length > 0 ? (
                  <div className="model-select">
                    <button
                      type="button"
                      className="model-select-trigger"
                      onClick={() => setIsModelDropdownOpen(open => !open)}
                      disabled={loading}
                    >
                      <div className="model-select-trigger-content">
                        <img
                          src={
                            selectedProvider === 'openai'
                              ? '/images/openai.png'
                              : selectedProvider === 'gemini'
                                ? '/images/gemini.png'
                                : '/images/ollama.png'
                          }
                          alt={selectedProvider}
                          className="model-select-trigger-logo"
                        />
                        <div className="model-select-trigger-text">
                          <span className="model-select-trigger-name">
                            {(modelCards[selectedProvider] || []).find(m => m.id === selectedModel)?.name || selectedModel}
                          </span>
                        </div>
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={isModelDropdownOpen ? 'expanded' : ''}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>

                    {isModelDropdownOpen && (
                      <div className="model-select-menu">
                        {modelCards[selectedProvider].map(model => (
                          <div
                            key={model.id}
                            className={`model-select-option ${
                              selectedModel === model.id ? 'selected' : ''
                            }`}
                            onClick={() => {
                              setSelectedModel(model.id);
                              setIsModelDropdownOpen(false);
                              if (model.max_tokens) {
                                setMaxTokens(model.max_tokens);
                              }
                            }}
                          >
                            <div className="model-select-option-header">
                              <img
                                src={
                                  selectedProvider === 'openai'
                                    ? '/images/openai.png'
                                    : selectedProvider === 'gemini'
                                      ? '/images/gemini.png'
                                      : '/images/ollama.png'
                                }
                                alt={selectedProvider}
                                className="model-select-option-logo"
                              />
                              <div className="model-select-option-title">
                                <div className="model-select-option-name">{model.name}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="create-conversation-model-loading">Loading models...</div>
                )}
              </div>
              
              {/* Advanced Settings Section */}
              <div className="create-conversation-advanced-settings">
                <button
                  type="button"
                  className="create-conversation-advanced-toggle"
                  onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
                  disabled={loading}
                >
                  <span>{t('createConversation.advancedSettings')}</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={isAdvancedSettingsOpen ? 'expanded' : ''}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                
                {isAdvancedSettingsOpen && (
                  <div className="create-conversation-advanced-content">
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
                        step="1"
                        value={maxTokens}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 2000;
                          // Allow any positive number, no max limit
                          setMaxTokens(value > 0 ? value : 2000);
                        }}
                        disabled={loading}
                        className="create-conversation-input"
                      />
                    </div>
                  </div>
                )}
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

