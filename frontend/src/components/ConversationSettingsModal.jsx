import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import './ConversationSettingsModal.css';

function ConversationSettingsModal({ isOpen, onClose, conversationId, conversation, onUpdate }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(conversation?.title || '');
  const [avatarUrl, setAvatarUrl] = useState(conversation?.avatar_url || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('title', title);

    try {
      setLoading(true);
      const response = await axios.put(`/api/conversations/${conversationId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAvatarUrl(response.data.conversation.avatar_url);
      if (onUpdate) onUpdate(response.data.conversation);
      setError('');
    } catch (error) {
      setError(error.response?.data?.detail || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      if (fileInputRef.current?.files[0]) {
        formData.append('avatar', fileInputRef.current.files[0]);
      }

      const response = await axios.put(`/api/conversations/${conversationId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (onUpdate) onUpdate(response.data.conversation);
      onClose();
    } catch (error) {
      setError(error.response?.data?.detail || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content conversation-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('conversationSettings.title')}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="conversation-settings-form">
          {error && <div className="error-message">{error}</div>}

          <div className="avatar-section">
            <div className="avatar-preview">
              <img src={avatarUrl || '/default_avatar.jpeg'} alt="Conversation avatar" />
              <button
                type="button"
                className="avatar-change-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {t('conversationSettings.changeAvatar')}
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
            <label>{t('conversationSettings.title')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="modal-button modal-button-secondary" onClick={onClose}>
              {t('settings.cancel')}
            </button>
            <button type="submit" className="modal-button modal-button-primary" disabled={loading}>
              {loading ? t('auth.loading') : t('settings.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConversationSettingsModal;


