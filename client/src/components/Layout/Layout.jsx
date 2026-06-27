import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { settingsAPI } from '../../services/api';
import {
  FiHome, FiBook, FiFileText, FiDollarSign, FiGitBranch, FiArchive, FiBarChart2,
  FiLogOut, FiMenu, FiX, FiUser, FiGlobe, FiLayers, FiFolder, FiSettings, FiUsers, FiKey,
} from 'react-icons/fi';

const menuItems = [
  { path: '/', icon: FiHome, label: 'الرئيسية' },
  { path: '/documents', icon: FiFolder, label: 'القيد الفردي المتعدد', badge: 'FT', moduleKey: 'documents' },
  { path: '/journal', icon: FiFileText, label: 'القيد متعدد الأطراف', badge: 'MULTY', moduleKey: 'journal' },
  { path: '/journal/executed', icon: FiFileText, label: 'القيود المنفذة', moduleKey: 'journal' },
  { path: '/accounts', icon: FiBook, label: 'دليل الحسابات', moduleKey: 'accounts' },
  { path: '/currencies', icon: FiDollarSign, label: 'العملات وأسعار الصرف', moduleKey: 'currencies' },
  { path: '/branches', icon: FiGitBranch, label: 'الفروع', moduleKey: 'branches' },
  { path: '/regions', icon: FiGlobe, label: 'المناطق الجغرافية', moduleKey: 'regions' },
  { path: '/document-types', icon: FiLayers, label: 'أنواع المستندات', moduleKey: 'document-types' },
  { path: '/archive', icon: FiArchive, label: 'الأرشفة', moduleKey: 'reports' },
  { path: '/reports', icon: FiBarChart2, label: 'التقارير', moduleKey: 'reports' },
  { path: '/users', icon: FiUsers, label: 'المستخدمين', adminOnly: true },
  { path: '/users/permissions', icon: FiKey, label: 'الصلاحيات', adminOnly: true },
  { path: '/users/signatures', icon: FiKey, label: 'تذييلات التوقيعات', adminOnly: true },
  { path: '/users/requests', icon: FiKey, label: 'طلبات إعادة التعيين', adminOnly: true },
  { path: '/settings/company', icon: FiSettings, label: 'بيانات الشركة', adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [company, setCompany] = useState({ name: 'القيود اليومية', logo_path: '' });

  useEffect(() => {
    settingsAPI.getCompany().then(res => setCompany(res.data)).catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const filteredMenu = menuItems.filter(item => {
    if (item.adminOnly) return user?.role === 'admin';
    if (!item.moduleKey) return true;
    return hasPermission(item.moduleKey, 'can_view');
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: sidebarOpen ? 260 : 64, background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)', color: '#fff', position: 'fixed', top: 0, right: 0, bottom: 0, transition: 'width 0.3s', overflow: 'hidden', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {sidebarOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {company.logo_path ? (
                <img src={company.logo_path.startsWith('/') ? company.logo_path : `/uploads/logos/${company.logo_path}`} alt=""
                  style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 32, height: 32, background: '#1976d2', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiFileText size={18} /></div>
              )}
              <span style={{ fontSize: 15, fontWeight: 700, color: '#64b5f6' }}>{company.name}</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 4 }}>
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {filteredMenu.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} title={!sidebarOpen ? item.label : ''}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 2, color: isActive ? '#fff' : '#aaa', background: isActive ? 'rgba(25,118,210,0.3)' : 'transparent', textDecoration: 'none', fontSize: 14, transition: 'all 0.2s' }}>
                <Icon size={20} />
                {sidebarOpen && <span style={{ flex: 1 }}>{item.label}</span>}
                {sidebarOpen && item.badge && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.15)', color: '#90caf9' }}>{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: sidebarOpen ? 'space-between' : 'center' }}>
            {sidebarOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                {user?.avatar ? (
                  <img src={`/uploads/avatars/${user.avatar}`} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {(user?.full_name || user?.username || '').charAt(0)}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.full_name || user?.username}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{user?.role === 'admin' ? 'مسؤول' : user?.role === 'accountant' ? 'محاسب' : 'مشاهد'}</div>
                </div>
              </div>
            )}
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 4 }} title="تسجيل الخروج"><FiLogOut size={20} /></button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, marginRight: sidebarOpen ? 260 : 64, transition: 'margin-right 0.3s' }}>
        <header style={{ background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
            {filteredMenu.find(m => m.path === location.pathname)?.label || 'نظام القيود اليومية'}
          </h2>
          <div style={{ fontSize: 13, color: '#888' }}>
            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>
        <div style={{ padding: 24 }}>{children}</div>
        <div style={{ textAlign: 'center', padding: '12px 24px', color: '#bbb', fontSize: 11, borderTop: '1px solid #eee' }}>
          لؤي العليمي 774347342
        </div>
      </main>
    </div>
  );
}
