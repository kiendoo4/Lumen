import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import './ProfilePage.css';

// Provider capabilities mapping
const PROVIDER_CAPABILITIES = {
  openai: ['LLM', 'TEXT EMBEDDING', 'TTS', 'TEXT RE-RANK', 'SPEECH2TEXT', 'MODERATION'],
  gemini: ['LLM', 'TEXT EMBEDDING', 'IMAGE2TEXT'],
  ollama: ['LLM', 'TEXT EMBEDDING', 'SPEECH2TEXT', 'MODERATION']
};

// Provider display names
const PROVIDER_NAMES = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  ollama: 'Ollama'
};

// Provider logos
const PROVIDER_LOGOS = {
  openai: '/images/openai.png',
  gemini: '/images/gemini.png',
  ollama: '/images/ollama.png'
};

function ProviderModal({ isOpen, onClose, provider, onSave, existingConfig }) {
  const { t } = useLanguage();
  const [apiKey, setApiKey] = useState(existingConfig?.api_key || '');
  const [baseUrl, setBaseUrl] = useState(existingConfig?.base_url || (provider === 'ollama' ? 'http://localhost:11434' : ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onSave(provider, { api_key: apiKey, base_url: baseUrl });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || t('profile.updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="provider-modal-overlay" onClick={onClose}>
      <div className="provider-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="provider-modal-header">
          <h3>{PROVIDER_NAMES[provider] || provider}</h3>
          <button className="provider-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="provider-modal-form">
          {error && <div className="profile-error-message">{error}</div>}
          <div className="profile-form-field">
            <label>{t('profile.apiKey')}</label>
            <div className="profile-input-wrapper">
              <svg className="profile-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('profile.apiKeyPlaceholder')}
                className="profile-input"
                required={provider !== 'ollama'}
              />
            </div>
          </div>
          {provider === 'ollama' && (
            <div className="profile-form-field">
              <label>{t('profile.baseUrl')}</label>
              <div className="profile-input-wrapper">
                <svg className="profile-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="profile-input"
                />
              </div>
            </div>
          )}
          <div className="provider-modal-actions">
            <button type="button" className="provider-modal-cancel" onClick={onClose}>
              {t('settings.cancel')}
            </button>
            <button type="submit" className="provider-modal-save" disabled={loading}>
              {loading ? t('auth.loading') : t('profile.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LLMProvidersTab() {
  const { t } = useLanguage();
  const [providers, setProviders] = useState({});
  const [availableModels, setAvailableModels] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [expandedProviders, setExpandedProviders] = useState({});
  const [showMoreModels, setShowMoreModels] = useState({});

  React.useEffect(() => {
    fetchProviders();
    fetchAvailableModels();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await axios.get('/api/llm-providers/');
      const providerData = {};
      response.data.forEach(p => {
        providerData[p.provider] = { api_key: p.api_key || '', base_url: p.base_url || '' };
      });
      setProviders(providerData);
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const response = await axios.get('/api/models/');
      // API returns { openai: [...], gemini: [...], ollama: [...] }
      setAvailableModels(response.data);
    } catch (error) {
      console.error('Error fetching models:', error);
      // Fallback to empty object if API fails
      setAvailableModels({});
    }
  };

  const handleSaveProvider = async (provider, config) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.put(`/api/llm-providers/${provider}`, config);
      await fetchProviders();
      setSuccess(t('profile.providerUpdated'));
      setTimeout(() => setSuccess(''), 3000);
      setSelectedProvider(null);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProvider = async (provider) => {
    if (!window.confirm(t('profile.removeProviderConfirm'))) return;
    
    try {
      await axios.put(`/api/llm-providers/${provider}`, { api_key: '', base_url: '' });
      await fetchProviders();
      setSuccess(t('profile.providerRemoved'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.detail || t('profile.updateError'));
    }
  };

  const toggleExpand = (provider) => {
    setExpandedProviders(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  const toggleShowMore = (provider) => {
    setShowMoreModels(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  const addedProviders = Object.keys(providers).filter(p => providers[p].api_key || (p === 'ollama' && providers[p].base_url));
  const availableProviders = ['openai', 'gemini', 'ollama'].filter(p => !addedProviders.includes(p));

  return (
    <div className="llm-providers-container">
      {error && <div className="profile-error-message">{error}</div>}
      {success && <div className="profile-success-message">{success}</div>}

      {/* Added Models Section */}
      <div className="llm-section">
        <div className="llm-section-header">
          <h3>{t('profile.addedModels')}</h3>
          <span className="llm-section-count">{addedProviders.length} {t('profile.active')}</span>
        </div>

        {addedProviders.length === 0 ? (
          <div className="llm-empty-state">
            <p>{t('profile.noProvidersAdded')}</p>
          </div>
        ) : (
          <div className="llm-providers-list">
            {addedProviders.map(provider => {
              const models = availableModels[provider] || [];
              const isExpanded = expandedProviders[provider];
              const showAll = showMoreModels[provider];
              const displayModels = showAll ? models : models.slice(0, 5);
              const hasModels = models && models.length > 0;

              return (
                <div key={provider} className="llm-provider-card added">
                  <div className="llm-provider-header">
                    <div className="llm-provider-info">
                      <div className="llm-provider-title-row">
                        {PROVIDER_LOGOS[provider] && (
                          <img 
                            src={PROVIDER_LOGOS[provider]} 
                            alt={PROVIDER_NAMES[provider]} 
                            className="llm-provider-logo"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                        <h4>{PROVIDER_NAMES[provider] || provider}</h4>
                      </div>
                      <div className="llm-provider-capabilities">
                        {PROVIDER_CAPABILITIES[provider]?.map(cap => (
                          <span key={cap} className="llm-capability-badge">{cap}</span>
                        ))}
                      </div>
                    </div>
                    <div className="llm-provider-actions">
                      <button
                        className="llm-action-button share"
                        title={t('profile.share')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="18" cy="5" r="3"></circle>
                          <circle cx="6" cy="12" r="3"></circle>
                          <circle cx="18" cy="19" r="3"></circle>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                      </button>
                      <button
                        className="llm-action-button"
                        onClick={() => setSelectedProvider(provider)}
                        title={t('profile.edit')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        className="llm-action-button remove"
                        onClick={() => handleRemoveProvider(provider)}
                        title={t('profile.remove')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="llm-provider-details">
                    <div className="llm-api-key-display">
                      <span className="llm-label">{t('profile.apiKey')}</span>
                      <span className="llm-value">{providers[provider].api_key ? '••••••••' : '-'}</span>
                    </div>
                    
                    {hasModels && (
                      <button
                        className="llm-expand-button"
                        onClick={() => toggleExpand(provider)}
                      >
                        {isExpanded ? t('profile.showLess') : t('profile.showMoreModels')}
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                    )}

                    {isExpanded && hasModels && (
                      <div className="llm-models-list">
                        {displayModels.map((model, idx) => {
                          const modelId = typeof model === 'string' ? model : (model.id || model.name || model);
                          const modelDesc = typeof model === 'object' ? (model.description || 'chat') : 'chat';
                          return (
                            <div key={idx} className="llm-model-item">
                              <span className="llm-model-name">{modelId}</span>
                              <span className="llm-model-type">{modelDesc}</span>
                            </div>
                          );
                        })}
                        {models.length > 5 && (
                          <button
                            className="llm-show-more-button"
                            onClick={() => toggleShowMore(provider)}
                          >
                            {showAll ? t('profile.showLess') : `+${models.length - 5} ${t('profile.more')}`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Models to be Added Section */}
      <div className="llm-section">
        <div className="llm-section-header">
          <h3>{t('profile.modelsToBeAdded')}</h3>
          <span className="llm-section-count">{availableProviders.length} {t('profile.providersAvailable')}</span>
        </div>

        <div className="llm-providers-list">
          {availableProviders.map(provider => (
            <div key={provider} className="llm-provider-card available">
              <div className="llm-provider-header">
                <div className="llm-provider-info">
                  <div className="llm-provider-title-row">
                    {PROVIDER_LOGOS[provider] && (
                      <img 
                        src={PROVIDER_LOGOS[provider]} 
                        alt={PROVIDER_NAMES[provider]} 
                        className="llm-provider-logo"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <h4>{PROVIDER_NAMES[provider] || provider}</h4>
                  </div>
                  <div className="llm-provider-capabilities">
                    {PROVIDER_CAPABILITIES[provider]?.map(cap => (
                      <span key={cap} className="llm-capability-badge">{cap}</span>
                    ))}
                  </div>
                </div>
                <button
                  className="llm-add-button"
                  onClick={() => setSelectedProvider(provider)}
                >
                  {t('profile.addTheModel')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ProviderModal
        isOpen={!!selectedProvider}
        onClose={() => setSelectedProvider(null)}
        provider={selectedProvider}
        onSave={handleSaveProvider}
        existingConfig={selectedProvider ? providers[selectedProvider] : null}
      />
    </div>
  );
}

function ProfilePage({ onBack }) {
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, updateProfile, changePassword, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '/default_avatar.jpeg');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setAvatarUrl(user.avatar_url || '/default_avatar.jpeg');
    }
  }, [user]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setLoading(true);
      const response = await axios.put('/api/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAvatarUrl(response.data.user.avatar_url || '/default_avatar.jpeg');
      setSuccess(t('profile.avatarUpdated'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.detail || t('profile.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const result = await updateProfile({ username });
    if (result.success) {
      setSuccess(t('profile.profileUpdated'));
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result.error);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      setSuccess(t('profile.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result.error);
    }
  };

  const handleLogout = () => {
    logout();
    onBack();
  };

  return (
    <div className="profile-screen">
      <div className="profile-container">
        <div className="profile-header">
          <button className="profile-back-button" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>{t('profile.back')}</span>
          </button>
          <h1 className="profile-title">{t('profile.title')}</h1>
          <button className="profile-logout-button" onClick={handleLogout} title={t('auth.logout')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>{t('auth.logout')}</span>
          </button>
        </div>

        <div className="profile-tabs-container">
          <div className="profile-tabs">
            <button
              className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              {t('profile.profile')}
            </button>
            <button
              className={`profile-tab ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              {t('profile.password')}
            </button>
            <button
              className={`profile-tab ${activeTab === 'llm' ? 'active' : ''}`}
              onClick={() => setActiveTab('llm')}
            >
              {t('profile.llmProviders')}
            </button>
          </div>
        </div>

        <div className="profile-content-wrapper">
          <div className="profile-main-layout">
            <div className="profile-content">
              {activeTab === 'profile' && (
                <form onSubmit={handleProfileUpdate} className="profile-form">
                  <div className="profile-avatar-section-inline">
                    <div className="profile-avatar-wrapper">
                      <img 
                        src={avatarUrl || '/default_avatar.jpeg'} 
                        alt="Avatar" 
                        className="profile-avatar-image"
                        onError={(e) => {
                          e.target.src = '/default_avatar.jpeg';
                        }}
                      />
                      <button
                        type="button"
                        className="profile-avatar-edit-button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        title={t('profile.changeAvatar')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        style={{ display: 'none' }}
                      />
                    </div>
                    <div className="profile-user-info">
                      <h2 className="profile-username">{user?.username || 'User'}</h2>
                      <p className="profile-user-email">{user?.email || ''}</p>
                    </div>
                  </div>

                  {error && (
                    <div className="profile-error-message">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div className="profile-success-message">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <span>{success}</span>
                    </div>
                  )}

                  <div className="profile-form-field">
                    <label>{t('auth.username')}</label>
                    <div className="profile-input-wrapper">
                      <svg className="profile-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        disabled={loading}
                        className="profile-input"
                      />
                    </div>
                  </div>

                  <div className="profile-form-field">
                    <label>{t('auth.email')}</label>
                    <div className="profile-input-wrapper">
                      <svg className="profile-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="profile-input profile-disabled-input"
                      />
                    </div>
                  </div>

                  <button type="submit" className="profile-submit-button" disabled={loading}>
                    {t('profile.save')}
                  </button>
                </form>
              )}

              {activeTab === 'password' && (
                <form onSubmit={handlePasswordChange} className="profile-form">
                  {error && (
                    <div className="profile-error-message">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div className="profile-success-message">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <span>{success}</span>
                    </div>
                  )}

                  <div className="profile-form-field">
                    <label>{t('profile.currentPassword')}</label>
                    <div className="profile-input-wrapper">
                      <svg className="profile-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="profile-input"
                      />
                    </div>
                  </div>

                  <div className="profile-form-field">
                    <label>{t('profile.newPassword')}</label>
                    <div className="profile-input-wrapper">
                      <svg className="profile-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="profile-input"
                      />
                    </div>
                  </div>

                  <div className="profile-form-field">
                    <label>{t('auth.confirmPassword')}</label>
                    <div className="profile-input-wrapper">
                      <svg className="profile-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="profile-input"
                      />
                    </div>
                  </div>

                  <button type="submit" className="profile-submit-button">
                    {t('profile.changePassword')}
                  </button>
                </form>
              )}

              {activeTab === 'llm' && <LLMProvidersTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
