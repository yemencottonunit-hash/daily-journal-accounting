import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportsAPI, settingsAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { FiFileText, FiBook, FiGitBranch, FiCalendar, FiArrowUp, FiMonitor, FiSmartphone, FiGlobe } from 'react-icons/fi';

function getDeviceInfo() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return { icon: FiSmartphone, label: 'جهاز Android' };
  if (/iphone|ipad/i.test(ua)) return { icon: FiSmartphone, label: 'جهاز iOS' };
  if (/windows/i.test(ua)) return { icon: FiMonitor, label: 'جهاز Windows' };
  if (/macintosh/i.test(ua)) return { icon: FiMonitor, label: 'جهاز Mac' };
  if (/linux/i.test(ua)) return { icon: FiGlobe, label: 'جهاز Linux' };
  return { icon: FiMonitor, label: 'جهاز غير معروف' };
}

export default function Dashboard() {
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState({ name: 'نظام القيود اليومية', logo_path: '' });

  useEffect(() => {
    loadDashboard();
    settingsAPI.getCompany().then(res => setCompany(res.data)).catch(() => {});
  }, []);

  const loadDashboard = async () => {
    try { const response = await reportsAPI.getDashboard(); setStats(response.data); }
    catch (err) { console.error('Error loading dashboard:', err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <div style={{ width: 48, height: 48, border: '4px solid #1976d2', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
      </div>
    );
  }

  const device = getDeviceInfo();
  const DeviceIcon = device.icon;

  const allStatCards = [
    { title: 'إجمالي القيود', value: stats?.total_entries || 0, icon: FiFileText, color: '#1976d2', bg: '#e3f2fd', link: '/journal', moduleKey: 'journal' },
    { title: 'الحسابات النشطة', value: stats?.total_accounts || 0, icon: FiBook, color: '#2e7d32', bg: '#e8f5e9', link: '/accounts', moduleKey: 'accounts' },
    { title: 'الفروع', value: stats?.total_branches || 0, icon: FiGitBranch, color: '#7b1fa2', bg: '#f3e5f5', link: '/branches', moduleKey: 'branches' },
    { title: 'قيود هذا الشهر', value: stats?.this_month_entries || 0, icon: FiCalendar, color: '#e65100', bg: '#fff3e0', link: '/journal', moduleKey: 'journal' },
  ];
  const statCards = allStatCards.filter(c => hasPermission(c.moduleKey, 'can_view'));

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', borderRadius: 12, padding: '24px 28px', marginBottom: 24, color: '#fff', display: 'flex', alignItems: 'center', gap: 20 }}>
        {user?.avatar ? (
          <img src={`/uploads/avatars/${user.avatar}`} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.3)' }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, border: '3px solid rgba(255,255,255,0.3)' }}>
            {(user?.full_name || user?.username || '').charAt(0)}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>مرحباً {user?.full_name || user?.username}</h2>
          <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: 14 }}>
            {device.label} | {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {company.logo_path && (
          <img src={company.logo_path.startsWith('/') ? company.logo_path : `/uploads/logos/${company.logo_path}`} alt="شعار الشركة"
            style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Link key={index} to={card.link} style={{ textDecoration: 'none', background: '#fff', borderRadius: 10, padding: '20px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'box-shadow 0.2s' }}>
              <div>
                <p style={{ margin: 0, color: '#888', fontSize: 13 }}>{card.title}</p>
                <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: '#1a1a2e' }}>{card.value}</p>
              </div>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={26} color={card.color} />
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>إجراءات سريعة</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hasPermission('documents', 'can_add') && (
              <Link to="/documents/new" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#e3f2fd', borderRadius: 8, textDecoration: 'none', color: '#1565c0', fontWeight: 600, fontSize: 14 }}>
                <FiFileText size={18} /> مستند جديد (قيد فردي متعدد)
              </Link>
            )}
            {hasPermission('journal', 'can_add') && (
              <Link to="/journal/new" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#e8f5e9', borderRadius: 8, textDecoration: 'none', color: '#2e7d32', fontWeight: 600, fontSize: 14 }}>
                <FiFileText size={18} /> قيد يومي جديد (متعدد الأطراف)
              </Link>
            )}
            {hasPermission('reports', 'can_view') && (
              <Link to="/reports" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f3e5f5', borderRadius: 8, textDecoration: 'none', color: '#7b1fa2', fontWeight: 600, fontSize: 14 }}>
                <FiArrowUp size={18} /> عرض التقارير
              </Link>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>معلومات النظام</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ color: '#666' }}>إصدار النظام</span><span style={{ fontWeight: 600 }}>2.0.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ color: '#666' }}>العملة الأساسية</span><span style={{ fontWeight: 600 }}>ريال يمني (YER)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ color: '#666' }}>العملات المدعومة</span><span style={{ fontWeight: 600 }}>5 عملات</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: '#666' }}>قاعدة البيانات</span><span style={{ fontWeight: 600 }}>SQLite</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
