import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { settingsAPI } from '../../services/api';
import { FiUser, FiLock, FiLogIn, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState({ name: 'نظام القيود اليومية', logo_path: '' });
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetReason, setResetReason] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    settingsAPI.getCompany().then(res => setCompany(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { toast.error('يرجى إدخال اسم المستخدم وكلمة المرور'); return; }
    setLoading(true);
    try {
      await login(username, password);
      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في تسجيل الدخول'); }
    finally { setLoading(false); }
  };

  const handleResetRequest = async () => {
    if (!resetEmail) { toast.error('يرجى إدخال البريد الإلكتروني'); return; }
    try {
      await fetch('/api/auth/password-reset-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, reason: resetReason }),
      });
      toast.success('تم إرسال طلبك. في انتظار موافقة المسؤول.');
      setShowReset(false); setResetEmail(''); setResetReason('');
    } catch (err) { toast.error('خطأ في الإرسال'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/watermark.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15, filter: 'blur(2px)', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(25,118,210,0.92) 0%, rgba(13,71,161,0.95) 100%)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, background: '#fff', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.3)', padding: '40px 36px', width: '100%', maxWidth: 420, margin: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {company.logo_path ? (
            <img src={company.logo_path.startsWith('/') ? company.logo_path : `/uploads/logos/${company.logo_path}`} alt="شعار الشركة"
              style={{ width: 80, height: 80, objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />
          ) : (
            <div style={{ width: 80, height: 80, background: '#e3f2fd', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <FiFileText size={40} color="#1976d2" />
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>{company.name}</h1>
          <p style={{ color: '#888', fontSize: 14 }}>تسجيل الدخول إلى حسابك</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>اسم المستخدم</label>
            <div style={{ position: 'relative' }}>
              <FiUser style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%', padding: '10px 40px 10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                placeholder="أدخل اسم المستخدم" autoComplete="username" />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>كلمة المرور</label>
            <div style={{ position: 'relative' }}>
              <FiLock style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 40px 10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                placeholder="أدخل كلمة المرور" autoComplete="current-password" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '12px 0', background: loading ? '#90caf9' : '#1976d2', color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? (
              <><span style={{ width: 20, height: 20, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }}></span> جاري تسجيل الدخول...</>
            ) : (<><FiLogIn size={20} /> تسجيل الدخول</>)}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => setShowReset(true)} style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
            نسيت كلمة المرور؟
          </button>
        </div>

        {showReset && (
          <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <h4 style={{ marginBottom: 10, fontSize: 14 }}>طلب إعادة تعيين كلمة المرور</h4>
            <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
              placeholder="البريد الإلكتروني أو اسم المستخدم" />
            <textarea value={resetReason} onChange={(e) => setResetReason(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, marginBottom: 8, boxSizing: 'border-box', resize: 'none' }}
              rows={2} placeholder="سبب الطلب (اختياري)" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleResetRequest} style={{ flex: 1, padding: '8px 0', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>إرسال الطلب</button>
              <button onClick={() => setShowReset(false)} style={{ flex: 1, padding: '8px 0', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>إلغاء</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', color: '#aaa', fontSize: 11 }}>
          لؤي العليمي 774347342
        </div>
      </div>
    </div>
  );
}
