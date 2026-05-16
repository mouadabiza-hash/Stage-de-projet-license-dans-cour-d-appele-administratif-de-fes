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

  // All possible menu items with roles
const allMenuItems = [
  { labelKey: 'dashboard', icon: 'grid', path: '/dashboard',
    roles: ['Admin','Directeur','Greffier','Enregistrement','Archive','Employe'] },
  { labelKey: 'menu_courriers', icon: 'mail', path: '/courriers',
    roles: ['Admin','Greffier'] },                                      // ← only Admin & Greffier
  { labelKey: 'menu_archives_juridiques', icon: 'archive', path: '/archives-juridiques',
    roles: ['Admin','Directeur','Archive'] },
  { labelKey: 'menu_acteurs_judiciaires', icon: 'eye', path: '/acteurs-judiciaires',
    roles: ['Admin','Directeur','Greffier','Enregistrement','Archive'] },
  { labelKey: 'mes_entites', icon: 'building', path: '/mes-entites',
    roles: ['Admin','Directeur','Greffier','Enregistrement','Archive','Employe'] },
  { labelKey: 'registre_transactions', icon: 'send', path: '/transactions-outgoing',
    roles: ['Admin','Directeur','Greffier','Enregistrement','Archive','Employe'] },
  { labelKey: 'notifications', icon: 'bell', path: '/notifications',
    roles: ['Admin','Directeur','Greffier','Enregistrement','Archive','Employe'] },
  { labelKey: 'equipements', icon: 'settings', path: '/equipements',
    roles: ['Admin','Directeur','Greffier','Enregistrement','Archive','Employe'] },
  { labelKey: 'services', icon: 'service', path: '/services',
    roles: ['Admin','Directeur'] },
  { labelKey: 'utilisateurs', icon: 'users', path: '/utilisateurs',
    roles: ['Admin','Directeur'] },
  { labelKey: 'dossier_search', icon: 'search', path: '/dossier-search',
    roles: ['Admin','Directeur','Greffier','Enregistrement','Archive','Employe'] },
];

  // Filter by user role
  const menuItems = allMenuItems.filter(item => item.roles.includes(user?.role));

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