import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => { try { return JSON.parse(localStorage.getItem('tf_user')); } catch { return null; } });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      localStorage.setItem('tf_token', res.token);
      localStorage.setItem('tf_user',  JSON.stringify(res.user));
      setUser(res.user);
      return { ok: true };
    } catch(err) {
      return { ok: false, error: err.message };
    } finally { setLoading(false); }
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('tf_token');
    localStorage.removeItem('tf_user');
    setUser(null);
  };

  const pingPage = (page) => {
    authApi.page(page).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, pingPage }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
