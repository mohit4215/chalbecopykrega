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

  // Validate stored session on boot
  useEffect(() => {
    if (token) {
      authFetch('/api/me')
        .then(async (res) => {
          if (res.status === 401 || res.status === 403) {
            console.warn('[Auth] Stored JWT session is invalid or expired. Auto-logging out.');
            logout();
          } else if (res.ok) {
            const freshUser = await res.json();
            setUser(freshUser);
          }
        })
        .catch(() => {
          // Network offline / slow connection
        });
    }
  }, []);

  const apiBase = (() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // If no explicit VITE_API_URL is configured and running on localhost:
      if (!import.meta.env.VITE_API_URL && (hostname === 'localhost' || hostname === '127.0.0.1')) {
        if (window.location.port === '8000') {
          return ''; // Served directly by FastAPI
        }
        return 'http://127.0.0.1:8000'; // Vite dev server proxying to local backend
      }
    }
    let raw = (import.meta.env.VITE_API_URL || 'https://chalbecopykrega-api.onrender.com').trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = `https://${raw}`;
    }
    return raw.replace(/\/+$/, '');
  })();

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
    console.log(`[Auth] Attempting login to ${apiBase}/api/login for:`, email);
    try {
      const res = await fetch(`${apiBase}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log(`[Auth] Response status: ${res.status} (${res.statusText})`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[Auth] Server rejected login:', res.status, errorData);
        const errorMessage = errorData.detail 
          ? (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail))
          : `HTTP ${res.status}: Failed to authenticate`;
        throw new Error(errorMessage);
      }

      const data = await res.json();
      console.log('[Auth] Login successful. Received token:', data.access_token?.slice(0, 10) + '...');
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('originality_token', data.access_token);
      localStorage.setItem('originality_user', JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      console.error('[Auth] Network or parsing exception during login:', err);
      throw err;
    }
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
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('originality_token') : null);
    if (activeToken) {
      headers.set('Authorization', `Bearer ${activeToken}`);
    }
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = (url.startsWith('http://') || url.startsWith('https://'))
      ? url
      : `${apiBase}${cleanUrl}`;

    const res = await fetch(fullUrl, { ...options, headers });
    if (res.status === 401 && activeToken) {
      console.warn('[Auth] Server returned HTTP 401 Unauthorized. Clearing stale token.');
      logout();
    }
    return res;
  };

  const loginAsDemo = async () => {
    return login('student@university.edu', 'password123');
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/me');
      if (res.status === 401) {
        logout();
        return null;
      }
      if (res.ok) {
        const freshUser = await res.json();
        setUser(freshUser);
        return freshUser;
      }
    } catch {
      // Ignore network errors
    }
  };

  const updateUserCredits = (credits, tier) => {
    setUser(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        scan_credits: credits !== undefined ? credits : prev.scan_credits,
        subscription_tier: tier !== undefined ? tier : prev.subscription_tier,
        has_active_subscription: tier === 'pro'
      };
    });
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      user, 
      login, 
      register, 
      logout, 
      loginAsDemo,
      authFetch, 
      refreshUser, 
      updateUserCredits, 
      isAuthenticated: Boolean(token && user)
    }}>
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
