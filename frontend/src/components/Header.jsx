import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import Tooltip from './Tooltip';
import './Header.css';

function Header({ onProfileClick }) {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const { user } = useAuth();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <div className="header-logo-wrapper">
            <img src="/intro-image copy.png" alt="Lumen" className="header-logo" />
          </div>
          <div className="header-text-wrapper">
            <h1 className="header-title">{t('app.title')}</h1>
          </div>
        </div>
        <div className="header-right">
          <Tooltip text={language === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang Tiếng Anh'} position="bottom">
            <button
              className="header-button"
              onClick={toggleLanguage}
            >
              {language === 'en' ? 'VI' : 'EN'}
            </button>
          </Tooltip>
          <Tooltip text={theme === 'light' ? t('theme.dark') : t('theme.light')} position="bottom">
            <button
              className="header-button"
              onClick={toggleTheme}
            >
              {theme === 'light' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              )}
            </button>
          </Tooltip>
          {user && (
            <Tooltip text={t('header.profile') || user.username} position="bottom">
              <button
                className="header-avatar-button"
                onClick={onProfileClick}
              >
                <img
                  src={user.avatar_url || '/default_avatar.jpeg'}
                  alt={user.username}
                  className="header-avatar"
                  onError={(e) => {
                    e.target.src = '/default_avatar.jpeg';
                  }}
                />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
