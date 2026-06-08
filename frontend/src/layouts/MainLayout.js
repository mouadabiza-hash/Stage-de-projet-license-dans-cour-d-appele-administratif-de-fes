import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  // Structure du menu avec les rôles (comme à l’origine)
  const menu = [
    { label: 'dashboard', icon: 'logout', path: '/dashboard', roles: ['Admin', 'Directeur', 'Greffier', 'Enregistrement', 'Archive', 'Employe', 'Procedures'] },
    {
      label: 'gestion', icon: 'logout', roles: ['Admin', 'Greffier'],
      children: [
        { label: 'menu_courriers', path: '/courriers', roles: ['Admin', 'Greffier'] },
        { label: 'mes_entites', path: '/mes-entites', roles: ['Admin', 'Directeur', 'Greffier', 'Enregistrement', 'Archive', 'Employe', 'Procedures'] },
        { label: 'menu_archives_juridiques', path: '/archives-juridiques', roles: ['Admin', 'Directeur', 'Archive'] },
        { label: 'menu_tous_les_retraits', path: '/tout-retraits', roles: ['Admin', 'Directeur', 'Archive'] },
        { label: 'menu_acteurs_judiciaires', path: '/acteurs-judiciaires', roles: ['Admin', 'Directeur', 'Greffier', 'Enregistrement', 'Archive', 'Employe', 'Procedures'] },
        { label: 'dossier_search', path: '/dossier-search', roles: ['Admin', 'Directeur', 'Greffier', 'Enregistrement', 'Archive', 'Employe', 'Procedures'] }

      ]
    },
    {
      label: 'transactions', icon: 'logout', roles: ['Admin', 'Directeur', 'Greffier', 'Enregistrement', 'Archive', 'Employe', 'Procedures'],
      children: [
        { label: 'registre_transactions', path: '/transactions-outgoing', roles: ['Admin', 'Directeur', 'Greffier', 'Enregistrement', 'Archive', 'Employe', 'Procedures'] },
        { label: 'notifications', path: '/notifications', roles: ['Admin', 'Directeur', 'Greffier', 'Enregistrement', 'Archive', 'Employe', 'Procedures'] },
      ]
    },
    {
      label: 'administration', icon: 'settings', roles: ['Admin', 'Directeur'],
      children: [
        { label: 'equipements', path: '/equipements', roles: ['Admin', 'Directeur', 'Greffier'] },
        { label: 'services', path: '/services', roles: ['Admin', 'Directeur'] },
        { label: 'utilisateurs', path: '/utilisateurs', roles: ['Admin', 'Directeur'] },
        { label: 'gestion_listes', path: '/gestion-listes', roles: ['Admin'] },
        { label: 'profil', path: '/profile', roles: ['Admin', 'Directeur', 'Greffier', 'Enregistrement', 'Archive', 'Employe', 'Procedures']  }

      ]
    }
  ];

  const hasAccess = (roles) => {
    if (!roles) return true;
    if (roles === '*') return true;
    return roles.includes(user?.role);
  };

  const toggleMenu = (idx) => {
    setOpenMenu(openMenu === idx ? null : idx);
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark">⚖</div></div>
        <div className="user-info">
          <div className="user-avatar"></div>
          <div>
            <strong>{user?.nomComplet || user?.login}</strong>
            <span>{user?.nomService || 'IT'}</span>
            <small>{t('connecte')}</small>
          </div>
        </div>
        <div className="language-switcher">
          <button onClick={() => changeLanguage('fr')} className={i18n.language === 'fr' ? 'active' : ''}>FR</button>
          <button onClick={() => changeLanguage('ar')} className={i18n.language === 'ar' ? 'active' : ''}>AR</button>
        </div>
        <nav className="sidebar-nav">
          {menu.map((item, idx) => {
            // Élément sans enfant (simple lien)
            if (item.path) {
              if (!hasAccess(item.roles)) return null;
              return (
                <NavLink key={idx} to={item.path} className="main-menu-item">
                  <span className={`nav-icon nav-icon-${item.icon}`}></span>
                  <span>{t(item.label)}</span>
                </NavLink>
              );
            }

            // Élément avec enfants
            const visibleChildren = item.children.filter(child => hasAccess(child.roles));
            if (visibleChildren.length === 0) return null;
            const isOpen = openMenu === idx;

            return (
              <div key={idx} className="menu-parent">
                <div className="main-menu-item" onClick={() => toggleMenu(idx)}>
                  <span className={`nav-icon nav-icon-${item.icon}`}></span>
                  <span>{t(item.label)}</span>
                  <span className={`submenu-arrow ${isOpen ? 'open' : ''}`}>▼</span>
                </div>
                <div className={`submenu ${isOpen ? 'open' : ''}`}>
                  {visibleChildren.map(child => (
                    <NavLink key={child.path} to={child.path} onClick={() => setOpenMenu(null)}>
                      <span className="submenu-icon">•</span>
                      <span>{t(child.label)}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <button onClick={logout} className="logout-btn">
          <span className="nav-icon nav-icon-logout"></span>
          <span>{t('deconnexion')}</span>
        </button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

export default MainLayout;