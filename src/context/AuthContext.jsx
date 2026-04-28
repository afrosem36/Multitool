import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';
/* @refresh reset */
const AuthContext = createContext(null);

const parseJsonResponse = async (res) => {
  const text = await res.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error('Invalid JSON:', text);
    throw new Error('Server error');
  }

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('auth_token');
    return saved && saved !== 'null' ? saved : null;
  });
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async (currentToken) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      const data = await parseJsonResponse(res);
      if (data.data?.user) {
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
    const fullPath = path.startsWith('/api') ? `${API_BASE_URL}${path}` : path;
    return fetch(fullPath, { ...options, headers });
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
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await parseJsonResponse(res);
      if (data.data?.token) {
        localStorage.setItem('auth_token', data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (error) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const register = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await parseJsonResponse(res);
      if (data.data?.token) {
        localStorage.setItem('auth_token', data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
        return { success: true };
      }
      return { success: false, error: 'Registration failed' };
    } catch (error) {
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const loginWithGoogle = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await parseJsonResponse(res);
      if (data.data?.token) {
        localStorage.setItem('auth_token', data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
        return { success: true };
      }
      return { success: false, error: 'Google login failed' };
    } catch (error) {
      return { success: false, error: error.message || 'Google login failed' };
    }
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginWithGoogle, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
