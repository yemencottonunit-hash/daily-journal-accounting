import { useState, useEffect } from 'react';
import { regionsAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiGlobe } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function RegionsList() {
  const { isAdmin } = useAuth();
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '' });

  useEffect(() => { loadRegions(); }, []);

  const loadRegions = async () => {
    try {
      const res = await regionsAPI.getAll();
      setRegions(res.data);
    } catch (err) {
      toast.error('خطأ في تحميل المناطق');
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('يرجى إدخال اسم المنطقة'); return; }
    try {
      if (editing) {
        await regionsAPI.update(editing.id, { name: formData.name, code: formData.code });
        toast.success('تم تحديث المنطقة بنجاح');
      } else {
        await regionsAPI.create({ name: formData.name, code: formData.code });
        toast.success('تم إضافة المنطقة بنجاح');
      }
      setShowForm(false); setEditing(null); setFormData({ name: '', code: '' });
      loadRegions();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحفظ'); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`هل أنت متأكد من حذف المنطقة "${name}"؟`)) return;
    try {
      await regionsAPI.delete(id);
      toast.success('تم حذف المنطقة بنجاح');
      loadRegions();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحذف'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">المناطق الجغرافية</h2>
          <p className="text-gray-500 mt-1">كل منطقة لها أسعار صرف خاصة بها</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setFormData({ name: '', code: '' }); setEditing(null); setShowForm(true); }} className="btn-primary">
            <FiPlus size={20} /> إضافة منطقة
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">{editing ? 'تعديل المنطقة' : 'إضافة منطقة جديدة'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنطقة *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="مثال: صنعاء" required autoFocus />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">كود المنطقة</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="input-field" placeholder="مثال: Sanaa" />
              </div>
              <div className="flex items-center gap-3">
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
        ) : regions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiGlobe className="mx-auto mb-4" size={48} />
            <p>لا توجد مناطق</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regions.map((region) => (
              <div key={region.id} className="p-4 rounded-lg border-2 border-primary-200 bg-primary-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-gray-800">{region.name}</h4>
                  {region.code && <span className="text-xs font-mono text-gray-500">{region.code}</span>}
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                    <button onClick={() => { setEditing(region); setFormData({ name: region.name, code: region.code || '' }); setShowForm(true); }} className="p-1 text-gray-500 hover:text-primary-600"><FiEdit2 size={14} /></button>
                    <button onClick={() => handleDelete(region.id, region.name)} className="p-1 text-gray-500 hover:text-red-600"><FiTrash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
