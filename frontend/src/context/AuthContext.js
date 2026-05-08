import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const login = localStorage.getItem('login');
    const nomService = localStorage.getItem('nomService');
    const idService = localStorage.getItem('idService');
    if (token && login) {
      setUser({ token, login, nomService, idService: parseInt(idService) });
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (login, password) => {
    const response = await axios.post('/api/auth/login', { login, password });
    const { token, id, login: userLogin, nomComplet, idService, nomService } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('login', userLogin);
    localStorage.setItem('nomService', nomService);
    localStorage.setItem('idService', idService);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser({ token, login: userLogin, nomComplet, idService, nomService });
    return response.data;
  };

  const logout = () => {
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};