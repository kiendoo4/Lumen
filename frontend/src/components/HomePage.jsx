import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Header from './chat/Header';
import Settings from './common/Settings';
import './HomePage.css';

function HomePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const features = [
    {
      id: 'chat',
      title: t('home.feature.chat.title'),
      description: t('home.feature.chat.description'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
      route: '/chat',
      color: 'blue'
    },
    {
      id: 'paper-chat',
      title: t('home.feature.paperChat.title'),
      description: t('home.feature.paperChat.description'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      ),
      route: '/paper-chat',
      color: 'green'
    },
    {
      id: 'citation',
      title: t('home.feature.citation.title'),
      description: t('home.feature.citation.description'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          <line x1="9" y1="7" x2="15" y2="7"></line>
          <line x1="9" y1="11" x2="15" y2="11"></line>
          <line x1="9" y1="15" x2="13" y2="15"></line>
        </svg>
      ),
      route: '/citation',
      color: 'purple',
      comingSoon: true
    },
    {
      id: 'paraphraser',
      title: t('home.feature.paraphraser.title'),
      description: t('home.feature.paraphraser.description'),
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>
      ),
      route: '/paraphraser',
      color: 'orange',
      comingSoon: true
    }
  ];

  const handleFeatureClick = (feature) => {
    if (feature.comingSoon) {
      console.log(`${feature.title} coming soon!`);
      return;
    }
    navigate(feature.route);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorning');
    if (hour < 18) return t('home.greetingAfternoon');
    return t('home.greetingEvening');
  };

  return (
    <div className="home-page">
      <Header 
        onProfileClick={() => navigate('/settings')}
        showBackButton={false}
      >
        <Settings variant="header" />
      </Header>

      {/* Main Content */}
      <div className="home-main">
        <div className="home-hero">
          <div className="hero-content">
            <div className="hero-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              <span>{t('home.badge')}</span>
            </div>
            <h1 className="hero-title">
              {getGreeting()}, <span className="hero-username">{user?.username}</span>!
            </h1>
            <p className="hero-subtitle">
              {t('home.subtitle')}
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="home-features">
          <div className="features-container">
            {features.map((feature) => (
              <div
                key={feature.id}
                className={`feature-card ${feature.color} ${feature.comingSoon ? 'coming-soon' : ''}`}
                onClick={() => handleFeatureClick(feature)}
              >
                {feature.comingSoon && (
                  <div className="coming-soon-badge">
                    <span>{t('home.comingSoon')}</span>
                  </div>
                )}
                <div className="feature-icon">
                  {feature.icon}
                </div>
                <div className="feature-content">
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
                <div className="feature-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7,7 17,7 17,17"></polyline>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
