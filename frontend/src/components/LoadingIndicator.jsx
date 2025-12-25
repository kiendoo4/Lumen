import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './LoadingIndicator.css';

function LoadingIndicator() {
  const { t } = useLanguage();
  return (
    <div className="loading-indicator">
      <div className="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span className="loading-text">{t('chat.loading')}</span>
    </div>
  );
}

export default LoadingIndicator;

