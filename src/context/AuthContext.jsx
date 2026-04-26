import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('auth_token');
    return saved && saved !== 'null' ? saved : null;
  });
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (currentToken) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      const data = await res.json();
      if (res.ok && data.data?.user) {
        setUser(data.data.user);
      } else {
        setToken(null);
      }
    } catch (err) {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = { ...options.headers };
    if (token && token !== 'null') {
      headers.Authorization = `Bearer ${token}`;
    }
    return fetch(path, { ...options, headers });
  }, [token]);

  useEffect(() => {
    if (token && token !== 'null') {
      localStorage.setItem('auth_token', token);
      fetchUser(token);
    } else {
      localStorage.removeItem('auth_token');
      setUser(null);
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.data?.token) {
      setToken(data.data.token);
      setUser(data.data.user);
      return { success: true };
    }
    return { success: false, error: data.error || 'Login failed' };
  };

  const register = async (email, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.data?.token) {
      setToken(data.data.token);
      setUser(data.data.user);
      return { success: true };
    }
    return { success: false, error: data.error || 'Registration failed' };
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
