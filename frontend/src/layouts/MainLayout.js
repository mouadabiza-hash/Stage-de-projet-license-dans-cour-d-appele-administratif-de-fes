import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.resolvedLanguage || i18n.language || 'fr').split('-')[0];

  useEffect(() => {
    document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  const menuItems = [
    { labelKey: 'dashboard', icon: 'grid', path: '/dashboard' },
    { labelKey: 'menu_courriers', icon: 'mail', path: '/courriers' },
    { labelKey: 'menu_dossiers_juridiques', icon: 'folder', path: '/courriers-juridiques' },
    { labelKey: 'menu_archives_juridiques', icon: 'archive', path: '/archives-juridiques' },
    { labelKey: 'consulter', icon: 'eye', path: '/messages-administratifs' },
    { labelKey: 'menu_acteurs_judiciaires', icon: 'users', path: '/acteurs-judiciaires' },
    { labelKey: 'mes_entites', icon: 'building', path: '/mes-entites' },
    { labelKey: 'registre_transactions', icon: 'send', path: '/transactions-outgoing' },
    { labelKey: 'notifications', icon: 'bell', path: '/notifications' },
    { labelKey: 'equipements', icon: 'settings', path: '/equipements' },
    { labelKey: 'services', icon: 'service', path: '/services' },
    { labelKey: 'utilisateurs', icon: 'users', path: '/utilisateurs' }
  ];

  const displayName = user?.nomComplet || user?.login || t('administrateur');
  const serviceLabel = user?.nomService || 'IT';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark">⚖</div></div>
        <div className="user-info">
          <div className="user-avatar"></div>
          <div><strong>{displayName}</strong><span>{serviceLabel}</span><small>{t('connecte')}</small></div>
        </div>
        <div className="language-switcher">
          <button onClick={() => changeLanguage('fr')} className={currentLanguage === 'fr' ? 'active' : ''}><strong>FR</strong><span>FR</span></button>
          <button onClick={() => changeLanguage('ar')} className={currentLanguage === 'ar' ? 'active' : ''}><strong>AR</strong><span>SA</span></button>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className={`nav-icon nav-icon-${item.icon}`}></span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} className="logout-btn">
          <span className="nav-icon nav-icon-logout"></span>
          <span>{t('deconnexion')}</span>
        </button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

export default MainLayout;