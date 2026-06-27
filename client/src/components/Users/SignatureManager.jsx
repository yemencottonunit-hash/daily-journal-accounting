import { useState, useEffect } from 'react';
import { signaturesAPI, authAPI } from '../../services/api';
import { FiSave, FiTrash2, FiPlus, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

const TEMPLATE_KEYS = {
  journal: 'القيود اليومية (MULTY)',
  document: 'المستندات المحاسبية (FT)',
  trialBalance: 'ميزان المراجعة',
  generalLedger: 'الأستاذ العام',
  accountStatement: 'كشف حساب',
  incomeStatement: 'قائمة الدخل',
  balanceSheet: 'الميزانية العمومية',
};

export default function SignatureManager() {
  const [users, setUsers] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('journal');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ user_id: '', title: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  useEffect(() => { loadSignatures(); }, [selectedTemplate]);

  const loadData = async () => {
    try {
      const [usersRes] = await Promise.all([authAPI.getUsers()]);
      setUsers(usersRes.data);
    } catch (err) { toast.error('خطأ في تحميل البيانات'); }
    finally { setLoading(false); }
  };

  const loadSignatures = async () => {
    try {
      const res = await signaturesAPI.getByTemplate(selectedTemplate);
      setSignatures(res.data);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async () => {
    if (!form.user_id) { toast.error('يرجى اختيار المستخدم'); return; }
    try {
      await signaturesAPI.save({ template_key: selectedTemplate, user_id: form.user_id, title: form.title });
      toast.success('تم الحفظ بنجاح');
      setShowForm(false);
      setForm({ user_id: '', title: '' });
      loadSignatures();
    } catch (err) { toast.error('خطأ في الحفظ'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await signaturesAPI.delete(id);
      toast.success('تم الحذف بنجاح');
      loadSignatures();
    } catch (err) { toast.error('خطأ في الحذف'); }
  };

  const handleToggleActive = async (id, current) => {
    try {
      await signaturesAPI.update(id, { is_active: current ? 0 : 1 });
      loadSignatures();
    } catch (err) { toast.error('خطأ'); }
  };

  const handleTitleChange = async (id, title) => {
    try {
      await signaturesAPI.update(id, { title });
      toast.success('تم التحديث');
    } catch (err) { toast.error('خطأ'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">إدارة تذييلات التوقيعات</h2>
      </div>

      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">اختر الشاشة / القالب</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TEMPLATE_KEYS).map(([key, label]) => (
            <button key={key} onClick={() => setSelectedTemplate(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${selectedTemplate === key ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-700">التذييلات النشطة: {TEMPLATE_KEYS[selectedTemplate]}</h3>
          <button onClick={() => setShowForm(true)} className="btn-primary"><FiPlus size={18} /> إضافة توقيع</button>
        </div>

        {showForm && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4 border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المستخدم *</label>
                <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} className="input-field">
                  <option value="">اختر المستخدم</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.username} {u.department ? `(${u.department})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">عنوان التوقيع</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="مثال: إعداد / المحاسب" />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handleSubmit} className="btn-primary"><FiSave size={16} /> حفظ</button>
                <button onClick={() => { setShowForm(false); setForm({ user_id: '', title: '' }); }} className="btn-secondary"><FiX size={16} /> إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {signatures.length === 0 ? (
          <div className="text-center py-8 text-gray-500">لا توجد تذييلات مسجلة لهذا القالب</div>
        ) : (
          <div className="space-y-3">
            {signatures.map((sig) => (
              <div key={sig.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
                <button onClick={() => handleToggleActive(sig.id, sig.is_active)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${sig.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                  <FiCheck size={16} />
                </button>
                <div className="flex-1">
                  <input type="text" defaultValue={sig.title} onBlur={(e) => handleTitleChange(sig.id, e.target.value)} className="input-field-sm w-full" placeholder="عنوان التوقيع" />
                </div>
                <div className="text-sm text-gray-600">
                  {sig.full_name || ''} {sig.department ? `(${sig.department})` : ''}
                </div>
                <button onClick={() => handleDelete(sig.id)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"><FiTrash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
          <strong>ملاحظة:</strong> التذييلات المعروضة هنا ستظهر في تذييل الطباعة للقالب المحدد. عنوان التوقيع يُكتب فوق خط التوقيع.
        </div>
      </div>
    </div>
  );
}
