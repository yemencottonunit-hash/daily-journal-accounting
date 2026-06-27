import React, { useState, useEffect } from 'react';
import { authAPI } from '../../services/api';

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'accountant', department: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try { const res = await authAPI.getUsers(); setUsers(res.data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    setMsg('');
    try {
      if (editing) {
        await authAPI.updateUser(editing.id, { full_name: form.full_name, role: form.role, department: form.department, is_active: form.is_active !== undefined ? form.is_active : 1 });
        setMsg('تم تحديث المستخدم بنجاح');
      } else {
        if (!form.username || !form.password) { setMsg('يرجى إدخال اسم المستخدم وكلمة المرور'); return; }
        await authAPI.createUser(form);
        setMsg('تم إنشاء المستخدم بنجاح');
      }
      setShowForm(false); setEditing(null);
      setForm({ username: '', password: '', full_name: '', role: 'accountant', department: '' });
      loadUsers();
    } catch (err) { setMsg(err.response?.data?.error || 'خطأ'); }
  };

  const handleEdit = (user) => {
    setEditing(user);
    setForm({ username: user.username, password: '', full_name: user.full_name, role: user.role, department: user.department || '', is_active: user.is_active });
    setShowForm(true);
  };

  const handleResetPassword = async (userId) => {
    const newPw = prompt('أدخل كلمة المرور الجديدة (6 أحرف على الأقل):');
    if (!newPw || newPw.length < 6) { alert('كلمة المرور قصيرة'); return; }
    try {
      await authAPI.resetUserPassword(userId, newPw);
      alert('تم إعادة التعيين بنجاح');
    } catch (err) { alert(err.response?.data?.error || 'خطأ'); }
  };

  const handleDelete = async (userId) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    try { await authAPI.deleteUser(userId); loadUsers(); } catch (err) { alert(err.response?.data?.error || 'خطأ'); }
  };

  const handleAvatarUpload = async (userId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await authAPI.uploadAvatar(userId, formData);
      loadUsers();
    } catch (err) { alert('خطأ في الرفع'); }
  };

  const roleLabels = { admin: 'مدير', accountant: 'محاسب', viewer: 'مشاهد' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>المستخدمين</h2>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ username: '', password: '', full_name: '', role: 'accountant' }); }}
          style={{ padding: '10px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
          مستخدم جديد
        </button>
      </div>
      {msg && <div style={{ padding: 10, background: msg.includes('خطأ') ? '#ffebee' : '#e8f5e9', borderRadius: 6, marginBottom: 15 }}>{msg}</div>}
      {showForm && (
        <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <h3>{editing ? 'تعديل مستخدم' : 'مستخدم جديد'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>اسم المستخدم</label>
              <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                disabled={!!editing} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>{editing ? 'كلمة المرور الجديدة' : 'كلمة المرور'}</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>الاسم الكامل</label>
              <input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>الدور</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}>
                <option value="admin">مدير</option>
                <option value="accountant">محاسب</option>
                <option value="viewer">مشاهد</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>الإدارة / القسم</label>
              <input type="text" value={form.department} onChange={e => setForm({...form, department: e.target.value})}
                placeholder="مثال: الإدارة المالية، قسم المحاسبة..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ marginTop: 15, display: 'flex', gap: 10 }}>
            <button onClick={handleSubmit} style={{ padding: '8px 20px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6 }}>
              {editing ? 'تحديث' : 'إنشاء'}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} style={{ padding: '8px 20px', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: 6 }}>إلغاء</button>
          </div>
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>#</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>الصورة</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>اسم المستخدم</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>الاسم الكامل</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>الإدارة</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>الدور</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>الحالة</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 15px' }}>{i + 1}</td>
                <td style={{ padding: '10px 15px' }}>
                  <label style={{ cursor: 'pointer' }}>
                    {u.avatar ? (
                      <img src={`/uploads/avatars/${u.avatar}`} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                        {(u.full_name || u.username || '').charAt(0)}
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={(e) => handleAvatarUpload(u.id, e)} style={{ display: 'none' }} />
                  </label>
                </td>
                <td style={{ padding: '10px 15px', fontWeight: 600 }}>{u.username}</td>
                <td style={{ padding: '10px 15px' }}>{u.full_name}</td>
                <td style={{ padding: '10px 15px', fontSize: 13, color: '#666' }}>{u.department || '-'}</td>
                <td style={{ padding: '10px 15px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, background: u.role === 'admin' ? '#e3f2fd' : u.role === 'accountant' ? '#e8f5e9' : '#f3e5f5', color: u.role === 'admin' ? '#1565c0' : u.role === 'accountant' ? '#2e7d32' : '#7b1fa2' }}>
                    {roleLabels[u.role]}
                  </span>
                </td>
                <td style={{ padding: '10px 15px' }}>
                  <span style={{ color: u.is_active ? '#4caf50' : '#f44336' }}>{u.is_active ? 'نشط' : 'معطل'}</span>
                </td>
                <td style={{ padding: '10px 15px' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => handleEdit(u)} style={{ padding: '4px 10px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>تعديل</button>
                    <button onClick={() => handleResetPassword(u.id)} style={{ padding: '4px 10px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>إعادة تعيين</button>
                    <button onClick={() => handleDelete(u.id)} style={{ padding: '4px 10px', background: '#b71c1c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
