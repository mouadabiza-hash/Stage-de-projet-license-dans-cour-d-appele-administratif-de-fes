import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoImage from '../assets/image.png';
import bgImage from '../assets/image2.png';

function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login: loginUser } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await loginUser(login, password);
      navigate('/dashboard');
    } catch (err) {
      setError(t('identifiants_incorrects'));
    }
  };

  useEffect(() => {
    const currentLang = i18n.language;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <div className="login-page" style={{ background: `linear-gradient(rgba(6,33,58,0.8), rgba(6,33,58,0.8)), url(${bgImage}) center/cover no-repeat` }}>
      <div className="login-wrapper">
        <div className="glass-card animate-in">
          {/* Language buttons */}
          <div className="language-switch-buttons">
            <button
              className={`lang-btn ${i18n.language === 'fr' ? 'active' : ''}`}
              onClick={() => changeLanguage('fr')}
            >
              FR
            </button>
            <button
              className={`lang-btn ${i18n.language === 'ar' ? 'active' : ''}`}
              onClick={() => changeLanguage('ar')}
            >
              AR
            </button>
          </div>

          {/* Circular logo */}
          <div className="logo-container">
            <img src={logoImage} alt="Ministère de la Justice" className="ministry-logo" />
          </div>

          <h1>{t('royal_kingdom') || 'المملكة المغربية'}</h1>
          <h2>{t('justice_ministry') || 'وزارة العدل'}</h2>
          <div className="divider"></div>
          <p className="french">{t('royal_kingdom_fr') || 'ROYAUME DU MAROC — MINISTÈRE DE LA JUSTICE'}</p>
          <p className="motto">{t('motto') || 'ÉQUITÉ · INTÉGRITÉ · MODERNITÉ'}</p>

          <form onSubmit={handleSubmit}>
            <div className="input-field">
              <input
                type="text"
                placeholder={t('nom_utilisateur')}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>
            <div className="input-field">
              <input
                type="password"
                placeholder={t('mot_de_passe')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit">{t('se_connecter')}</button>
            {error && <div className="error-message">{error}</div>}
          </form>

          <div className="legal">{t('secure_access') || 'Accès sécurisé – agents habilités'}</div>
        </div>
      </div>
    </div>
  );
}

export default Login;