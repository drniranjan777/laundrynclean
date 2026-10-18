import { useState, useEffect } from 'react';

export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('admin_user') || 'null'));

  const login = (tokenValue, userData) => {
    localStorage.setItem('admin_token', tokenValue);
    localStorage.setItem('admin_user', JSON.stringify(userData));
    setToken(tokenValue);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
  };

  return { token, user, login, logout };
}
