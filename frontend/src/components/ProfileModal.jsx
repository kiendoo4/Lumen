import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './ProfileModal.css';

function ProfileModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  const { user, updateProfile, changePassword } = useAuth();
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

  if (!isOpen) return null;

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
      setAvatarUrl(response.data.user.avatar_url);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('profile.title')}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

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

        <div className="profile-content">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="profile-form">
              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              <div className="avatar-section">
                <div className="avatar-preview">
                  <img src={avatarUrl} alt="Avatar" />
                  <button
                    type="button"
                    className="avatar-change-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    {t('profile.changeAvatar')}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div className="form-field">
                <label>{t('auth.username')}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>{t('auth.email')}</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="disabled-input"
                />
              </div>

              <button type="submit" className="submit-button">
                {t('profile.save')}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="profile-form">
              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              <div className="form-field">
                <label>{t('profile.currentPassword')}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>{t('profile.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label>{t('auth.confirmPassword')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="submit-button">
                {t('profile.changePassword')}
              </button>
            </form>
          )}

          {activeTab === 'llm' && (
            <LLMProvidersTab />
          )}
        </div>
      </div>
    </div>
  );
}

function LLMProvidersTab() {
  const { t } = useLanguage();
  const [providers, setProviders] = useState({
    openai: { api_key: '', base_url: '' },
    gemini: { api_key: '', base_url: '' },
    ollama: { api_key: '', base_url: 'http://localhost:11434' }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  React.useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await axios.get('/api/llm-providers/');
      const providerData = {};
      response.data.forEach(p => {
        providerData[p.provider] = { api_key: p.api_key || '', base_url: p.base_url || '' };
      });
      setProviders(prev => ({ ...prev, ...providerData }));
    } catch (error) {
      console.error('Error fetching providers:', error);
    }
  };

  const handleSave = async (provider) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.put(`/api/llm-providers/${provider}`, providers[provider]);
      setSuccess(t('profile.providerUpdated'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.detail || t('profile.updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="llm-providers-tab">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {['openai', 'gemini', 'ollama'].map(provider => (
        <div key={provider} className="provider-section">
          <h3>{provider.toUpperCase()}</h3>
          <div className="form-field">
            <label>{t('profile.apiKey')}</label>
            <input
              type="password"
              value={providers[provider].api_key}
              onChange={(e) => setProviders(prev => ({
                ...prev,
                [provider]: { ...prev[provider], api_key: e.target.value }
              }))}
              placeholder={t('profile.apiKeyPlaceholder')}
            />
          </div>
          {provider === 'ollama' && (
            <div className="form-field">
              <label>{t('profile.baseUrl')}</label>
              <input
                type="text"
                value={providers[provider].base_url}
                onChange={(e) => setProviders(prev => ({
                  ...prev,
                  [provider]: { ...prev[provider], base_url: e.target.value }
                }))}
                placeholder="http://localhost:11434"
              />
            </div>
          )}
          <button
            onClick={() => handleSave(provider)}
            className="submit-button"
            disabled={loading}
          >
            {t('profile.save')}
          </button>
        </div>
      ))}
    </div>
  );
}

export default ProfileModal;


