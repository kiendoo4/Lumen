import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import './DeleteConfirmationModal.css';

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, type, name }) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="delete-confirmation-overlay" onClick={onClose}>
      <div className="delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-confirmation-header">
          <h2 className="delete-confirmation-title">{t('deleteConfirmation.title')}</h2>
          <button className="delete-confirmation-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="delete-confirmation-body">
          <p className="delete-confirmation-message">
            {type === 'conversation' 
              ? t('deleteConfirmation.conversationMessage').replace('{name}', name)
              : t('deleteConfirmation.dialogMessage').replace('{name}', name)}
          </p>
          <p className="delete-confirmation-warning">{t('deleteConfirmation.warning')}</p>
        </div>
        <div className="delete-confirmation-actions">
          <button
            className="delete-confirmation-button cancel"
            onClick={onClose}
          >
            {t('settings.cancel')}
          </button>
          <button
            className="delete-confirmation-button confirm"
            onClick={onConfirm}
          >
            {t('deleteConfirmation.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmationModal;

