import React, { useState, useEffect } from 'react';
import { authAPI } from '../../services/api';

export default function PasswordResetRequests() {
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try { const res = await authAPI.getPasswordResetRequests(); setRequests(res.data); } catch (err) { console.error(err); }
  };

  const handleApprove = async (id) => {
    const pw = prompt('كلمة المرور الجديدة (اتركها فارغة لتوليد تلقائي):');
    if (pw === null) return;
    try {
      const res = await authAPI.resolvePasswordReset(id, 'approved', pw || undefined);
      alert('تمت الموافقة. كلمة المرور: ' + (res.data.new_password || pw));
      loadRequests();
    } catch (err) { alert(err.response?.data?.error || 'خطأ'); }
  };

  const handleReject = async (id) => {
    if (!confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    try {
      await authAPI.resolvePasswordReset(id, 'rejected');
      setMsg('تم رفض الطلب');
      loadRequests();
    } catch (err) { alert(err.response?.data?.error || 'خطأ'); }
  };

  const statusLabels = { pending: 'قيد الانتظار', approved: 'تمت الموافقة', rejected: 'مرفوض' };
  const statusColors = { pending: '#ff9800', approved: '#4caf50', rejected: '#f44336' };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>طلبات إعادة تعيين كلمة المرور</h2>
      {msg && <div style={{ padding: 10, background: '#e8f5e9', borderRadius: 6, marginBottom: 15 }}>{msg}</div>}
      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>#</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>المستخدم</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>البريد الإلكتروني</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>السبب</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>التاريخ</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>الحالة</th>
              <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#999' }}>لا توجد طلبات</td></tr>
            )}
            {requests.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 15px' }}>{i + 1}</td>
                <td style={{ padding: '10px 15px' }}>{r.full_name || r.username || '-'}</td>
                <td style={{ padding: '10px 15px' }}>{r.email}</td>
                <td style={{ padding: '10px 15px' }}>{r.reason || '-'}</td>
                <td style={{ padding: '10px 15px', fontSize: 12 }}>{new Date(r.created_at).toLocaleString('ar-EG')}</td>
                <td style={{ padding: '10px 15px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, background: statusColors[r.status] + '20', color: statusColors[r.status] }}>
                    {statusLabels[r.status]}
                  </span>
                </td>
                <td style={{ padding: '10px 15px' }}>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => handleApprove(r.id)} style={{ padding: '4px 10px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>موافقة</button>
                      <button onClick={() => handleReject(r.id)} style={{ padding: '4px 10px', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>رفض</button>
                    </div>
                  )}
                  {r.status !== 'pending' && r.new_password && (
                    <span style={{ fontSize: 12, color: '#666' }}>كلمة المرور: {r.new_password}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
