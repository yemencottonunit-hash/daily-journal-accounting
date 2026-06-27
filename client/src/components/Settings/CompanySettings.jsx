import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export default function CompanySettings() {
  const { isAdmin } = useAuth();
  const [company, setCompany] = useState({
    name: '', address: '', phone: '', email: '', tax_number: '', logo_path: ''
  });
  const [serverConfig, setServerConfig] = useState({ host: '0.0.0.0', port: 4357 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingServer, setSavingServer] = useState(false);

  useEffect(() => { loadCompany(); if (isAdmin) loadServer(); }, []);

  const loadCompany = async () => {
    try {
      const res = await settingsAPI.getCompany();
      setCompany(res.data);
    } catch (err) { console.error(err); }
  };

  const loadServer = async () => {
    try {
      const res = await settingsAPI.getServer();
      setServerConfig({ host: res.data.host, port: res.data.port });
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    setLoading(true); setMsg('');
    try {
      await settingsAPI.updateCompany(company);
      setMsg('تم الحفظ بنجاح');
    } catch (err) { setMsg('خطأ: ' + (err.response?.data?.error || err.message)); }
    setLoading(false);
  };

  const handleServerSave = async () => {
    if (!confirm('تغيير الهوست أو البورت يتطلب إعادة تشغيل السيرفر. هل تريد المتابعة؟')) return;
    setSavingServer(true);
    try {
      const res = await settingsAPI.updateServer(serverConfig);
      toast.success(res.data.message);
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحفظ'); }
    setSavingServer(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await settingsAPI.uploadLogo(formData);
      setCompany(prev => ({ ...prev, logo_path: res.data.logo_path }));
      setMsg('تم رفع الشعار بنجاح');
    } catch (err) { setMsg('خطأ في الرفع'); }
    setUploading(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">بيانات الشركة</h2>
      {msg && (
        <div className={`p-3 rounded-lg mb-4 ${msg.includes('خطأ') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {msg}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشركة</label>
          <input type="text" value={company.name || ''} onChange={e => setCompany({...company, name: e.target.value})} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
          <input type="text" value={company.address || ''} onChange={e => setCompany({...company, address: e.target.value})} className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الهاتف</label>
            <input type="text" value={company.phone || ''} onChange={e => setCompany({...company, phone: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <input type="email" value={company.email || ''} onChange={e => setCompany({...company, email: e.target.value})} className="input-field" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الضريبي</label>
          <input type="text" value={company.tax_number || ''} onChange={e => setCompany({...company, tax_number: e.target.value})} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">شعار الشركة</label>
          <div className="flex items-center gap-4">
            {company.logo_path && (
              <img src={company.logo_path.startsWith('/') ? company.logo_path : `/uploads/logos/${company.logo_path}`}
                alt="شعار الشركة" className="w-20 h-20 object-contain border rounded-lg" />
            )}
            <label className="btn-primary cursor-pointer">
              {uploading ? 'جاري الرفع...' : 'اختيار شعار'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
        </div>
        <button onClick={handleSave} disabled={loading} className="btn-primary w-full">
          {loading ? 'جاري الحفظ...' : 'حفظ البيانات'}
        </button>
      </div>

      {isAdmin && (
        <div className="mt-10 border-t pt-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">إعدادات السيرفر</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الهوست (Host)</label>
                <input type="text" value={serverConfig.host} onChange={e => setServerConfig({...serverConfig, host: e.target.value})} className="input-field" placeholder="0.0.0.0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المنفذ (Port)</label>
                <input type="number" value={serverConfig.port} onChange={e => setServerConfig({...serverConfig, port: e.target.value})} className="input-field" placeholder="4357" />
              </div>
            </div>
            <p className="text-xs text-orange-600">⚠ تغيير هذه الإعدادات يتطلب إعادة تشغيل السيرفر يدوياً</p>
            <button onClick={handleServerSave} disabled={savingServer} className="btn-secondary w-full">
              {savingServer ? 'جاري الحفظ...' : 'حفظ إعدادات السيرفر'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
