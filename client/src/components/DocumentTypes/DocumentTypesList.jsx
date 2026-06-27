import { useState, useEffect } from 'react';
import { documentTypesAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiFileText } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function DocumentTypesList() {
  const { isAdmin } = useAuth();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', prefix: '', next_number: 1 });

  useEffect(() => { loadTypes(); }, []);

  const loadTypes = async () => {
    try {
      const res = await documentTypesAPI.getAll();
      setTypes(res.data);
    } catch (err) { toast.error('خطأ في تحميل أنواع المستندات'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('يرجى إدخال اسم النوع'); return; }
    try {
      if (editing) {
        await documentTypesAPI.update(editing.id, { name: formData.name, code: formData.code, prefix: formData.prefix });
        toast.success('تم تحديث النوع بنجاح');
      } else {
        await documentTypesAPI.create({ name: formData.name, code: formData.code, prefix: formData.prefix, next_number: parseInt(formData.next_number) || 1 });
        toast.success('تم إضافة النوع بنجاح');
      }
      setShowForm(false); setEditing(null); setFormData({ name: '', code: '', prefix: '', next_number: 1 });
      loadTypes();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحفظ'); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    try {
      await documentTypesAPI.delete(id);
      toast.success('تم الحذف بنجاح');
      loadTypes();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحذف'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">أنواع المستندات</h2>
          <p className="text-gray-500 mt-1">تعريف أنواع المستندات المحاسبية (سند قبض، سند صرف، إلخ)</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setFormData({ name: '', code: '', prefix: '', next_number: 1 }); setEditing(null); setShowForm(true); }} className="btn-primary">
            <FiPlus size={20} /> إضافة نوع
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">{editing ? 'تعديل نوع المستند' : 'إضافة نوع مستند جديد'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم النوع *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="مثال: سند قبض" required autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الكود</label>
                  <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="input-field" placeholder="مثال: RV" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البادئة (Prefix)</label>
                  <input type="text" value={formData.prefix} onChange={(e) => setFormData({ ...formData, prefix: e.target.value })} className="input-field" placeholder="مثال: RV-" />
                </div>
                {!editing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الابتدائي</label>
                    <input type="number" value={formData.next_number} onChange={(e) => setFormData({ ...formData, next_number: e.target.value })} className="input-field" min="1" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button type="submit" className="btn-primary flex-1"><FiSave size={18} /> {editing ? 'تحديث' : 'إضافة'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary flex-1"><FiX size={18} /> إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : types.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiFileText className="mx-auto mb-4" size={48} />
            <p>لا توجد أنواع مستندات</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>اسم النوع</th>
                  <th>الكود</th>
                  <th>البادئة</th>
                  <th>الرقم التالي</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => (
                  <tr key={type.id}>
                    <td className="font-medium">{type.name}</td>
                    <td className="font-mono text-primary-600">{type.code || '-'}</td>
                    <td className="font-mono">{type.prefix || '-'}</td>
                    <td className="font-mono">{type.next_number}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditing(type); setFormData({ name: type.name, code: type.code || '', prefix: type.prefix || '', next_number: type.next_number }); setShowForm(true); }} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"><FiEdit2 size={14} /></button>
                        {isAdmin && <button onClick={() => handleDelete(type.id, type.name)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><FiTrash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
