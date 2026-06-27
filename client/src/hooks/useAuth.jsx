import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { authAPI, permissionsAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({});

  const loadPermissions = async (userData) => {
    try {
      const res = await permissionsAPI.getMyPermissions();
      setPermissions(res.data);
    } catch (err) {
      console.error('Permissions load error:', err);
      const role = userData?.role || user?.role || 'viewer';
      const defaults = {};
      const modules = ['accounts','journal','documents','regions','branches','currencies','document-types','reports','users','settings'];
      for (const m of modules) {
        if (role === 'admin') {
          defaults[m] = { can_view: true, can_add: true, can_edit: true, can_delete: true, can_print: true };
        } else if (role === 'accountant') {
          defaults[m] = { can_view: true, can_add: true, can_edit: true, can_delete: false, can_print: true };
        } else {
          defaults[m] = { can_view: true, can_add: false, can_edit: false, can_delete: false, can_print: true };
        }
      }
      setPermissions(defaults);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        loadPermissions(parsed);
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await authAPI.login({ username, password });
    const { token, user: userData } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    await loadPermissions(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPermissions({});
  };

  const hasPermission = (module, action) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const mod = permissions[module];
    if (!mod) return false;
    return !!mod[action];
  };

  const value = useMemo(() => ({
    user,
    login,
    logout,
    loading,
    permissions,
    hasPermission,
    isAdmin: user?.role === 'admin',
    isAccountant: user?.role === 'accountant' || user?.role === 'admin',
    canEdit: user?.role !== 'viewer',
  }), [user, loading, permissions]);

  return (
    <AuthContext.Provider value={value}>
      {children}
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
