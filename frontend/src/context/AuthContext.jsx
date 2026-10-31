import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('originality_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('originality_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync to localStorage
    if (token) {
      localStorage.setItem('originality_token', token);
    } else {
      localStorage.removeItem('originality_token');
    }

    if (user) {
      localStorage.setItem('originality_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('originality_user');
    }
    setLoading(false);
  }, [token, user]);

  const apiBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '';

  const register = async (email, password) => {
    const res = await fetch(`${apiBase}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Registration failed');
    }

    const data = await res.json();
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const res = await fetch(`${apiBase}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Invalid email or password');
    }

    const data = await res.json();
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('originality_token');
    localStorage.removeItem('originality_user');
  };

  // Helper fetch function that automatically injects the Bearer JWT token
  const authFetch = async (url, options = {}) => {
    const headers = options.headers ? new Headers(options.headers) : new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;
    return fetch(fullUrl, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout, authFetch, isAuthenticated: !!token }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
