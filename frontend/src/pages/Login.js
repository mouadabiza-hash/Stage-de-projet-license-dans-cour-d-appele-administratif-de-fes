import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login: loginUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await loginUser(login, password);
      navigate('/dashboard');
    } catch (err) {
      setError(t('identifiants_incorrects'));
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>{t('app_name')}</h2>
        <p>{t('ministere_justice')}</p>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder={t('nom_utilisateur')} value={login} onChange={e => setLogin(e.target.value)} required />
          <input type="password" placeholder={t('mot_de_passe')} value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit">{t('se_connecter')}</button>
          {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default Login;