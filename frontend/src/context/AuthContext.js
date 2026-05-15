import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const id = localStorage.getItem('userId');
    const login = localStorage.getItem('login');
    const nomService = localStorage.getItem('nomService');
    const idService = localStorage.getItem('idService');
    const role = localStorage.getItem('role');
    const substituteUserId = localStorage.getItem('substituteUserId');

    if (token && login && id) {
      setUser({
        token,
        id: parseInt(id),
        login,
        nomService,
        idService: parseInt(idService),
        role,
        substituteUserId: substituteUserId ? parseInt(substituteUserId) : null,
      });
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (login, password) => {
    const response = await axios.post('/api/auth/login', { login, password });
    const {
      token,
      id,
      login: userLogin,
      nomComplet,
      idService,
      nomService,
      role,
      substituteUserId,
    } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('userId', id);
    localStorage.setItem('login', userLogin);
    localStorage.setItem('nomService', nomService);
    localStorage.setItem('idService', idService);
    localStorage.setItem('role', role);
    if (substituteUserId) localStorage.setItem('substituteUserId', substituteUserId);
    else localStorage.removeItem('substituteUserId');

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    setUser({
      token,
      id,
      login: userLogin,
      nomComplet,
      idService,
      nomService,
      role,
      substituteUserId,
    });
    return response.data;
  };

  const logout = () => {
    localStorage.clear();
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};