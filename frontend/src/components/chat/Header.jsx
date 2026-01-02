import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import Tooltip from '../common/Tooltip';
import './Header.css';

function DialogTitleButton({ title, onPin, isPinned, onRename, onDelete }) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="dialog-title-button-container">
      <button
        ref={buttonRef}
        className="dialog-title-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="dialog-title-text">{title}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {isOpen && (
        <div className="dialog-title-menu" ref={menuRef}>
          <button
            className="dialog-title-menu-item"
            onClick={() => {
              onPin();
              setIsOpen(false);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isPinned ? (
                <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.76z"></path>
              ) : (
                <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.76z"></path>
              )}
            </svg>
            <span>{isPinned ? t('sidebar.unpinDialog') : t('sidebar.pinDialog')}</span>
          </button>
          <button
            className="dialog-title-menu-item"
            onClick={() => {
              onRename();
              setIsOpen(false);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>{t('sidebar.renameDialog')}</span>
          </button>
          <button
            className="dialog-title-menu-item dialog-title-menu-item-danger"
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>{t('sidebar.deleteDialogAction')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Header({ onProfileClick, dialogTitle, onPinDialog, isDialogPinned, onRenameDialog, onDeleteDialog }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <div className="header-logo-wrapper">
            <img src="/intro-image copy.png" alt="Lumen" className="header-logo" />
          </div>
          <h1 className="header-brand-title">{t('app.title')}</h1>
        </div>
        <div className="header-center">
          {dialogTitle ? (
            <DialogTitleButton 
              title={dialogTitle} 
              onPin={onPinDialog}
              isPinned={isDialogPinned || false}
              onRename={onRenameDialog}
              onDelete={onDeleteDialog}
            />
          ) : (
            <h1 className="header-title">{t('app.title')}</h1>
          )}
        </div>
        <div className="header-right">
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
