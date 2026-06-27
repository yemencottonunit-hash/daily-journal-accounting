import { useState, useEffect } from 'react';
import { branchesAPI, regionsAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiGitBranch } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function BranchesList() {
  const { isAdmin } = useAuth();
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', region_id: '' });

  useEffect(() => { loadBranches(); loadRegions(); }, []);

  const loadBranches = async () => {
    try { const res = await branchesAPI.getAll(); setBranches(res.data); }
    catch (err) { toast.error('خطأ في تحميل الفروع'); }
    finally { setLoading(false); }
  };

  const loadRegions = async () => {
    try { const res = await regionsAPI.getAll(); setRegions(res.data); }
    catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('يرجى إدخال اسم الفرع'); return; }
    try {
      const payload = { name: formData.name, code: formData.code, region_id: formData.region_id || null, is_active: 1 };
      if (editingBranch) {
        await branchesAPI.update(editingBranch.id, payload);
        toast.success('تم تحديث الفرع بنجاح');
      } else {
        await branchesAPI.create(payload);
        toast.success('تم إضافة الفرع بنجاح');
      }
      setShowForm(false); setEditingBranch(null); setFormData({ name: '', code: '', region_id: '' });
      loadBranches();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحفظ'); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`هل أنت متأكد من حذف الفرع "${name}"؟`)) return;
    try { await branchesAPI.delete(id); toast.success('تم الحذف بنجاح'); loadBranches(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحذف'); }
  };

  const toggleActive = async (branch) => {
    try {
      await branchesAPI.update(branch.id, { name: branch.name, code: branch.code, region_id: branch.region_id, is_active: branch.is_active ? 0 : 1 });
      toast.success(branch.is_active ? 'تم تعطيل الفرع' : 'تم تفعيل الفرع');
      loadBranches();
    } catch (err) { toast.error('خطأ في التحديث'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">الفروع (مراكز التكلفة)</h2>
          <p className="text-gray-500 mt-1">كل فرع له منطقة جغرافية تحدد أسعار الصرف</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setFormData({ name: '', code: '', region_id: '' }); setEditingBranch(null); setShowForm(true); }} className="btn-primary">
            <FiPlus size={20} /> إضافة فرع
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4">{editingBranch ? 'تعديل الفرع' : 'إضافة فرع جديد'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفرع *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="اسم الفرع" required autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كود الفرع</label>
                  <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="input-field" placeholder="مثال: BR001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المنطقة الجغرافية</label>
                  <select value={formData.region_id} onChange={(e) => setFormData({ ...formData, region_id: e.target.value })} className="input-field">
                    <option value="">بدون منطقة</option>
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button type="submit" className="btn-primary flex-1"><FiSave size={18} /> {editingBranch ? 'تحديث' : 'إضافة'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingBranch(null); }} className="btn-secondary flex-1"><FiX size={18} /> إلغاء</button>
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
        ) : branches.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiGitBranch className="mx-auto mb-4" size={48} />
            <p>لا توجد فروع</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <div key={branch.id} className={`p-4 rounded-lg border-2 transition-colors ${branch.is_active ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-gray-800">{branch.name}</h4>
                  {branch.is_active ? <span className="badge badge-success">نشط</span> : <span className="badge bg-gray-100 text-gray-600">غير نشط</span>}
                </div>
                {branch.code && <p className="text-xs font-mono text-gray-500 mb-1">كود: {branch.code}</p>}
                {branch.region_name && <p className="text-sm text-gray-600">المنطقة: {branch.region_name}</p>}
                {isAdmin && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                    <button onClick={() => toggleActive(branch)} className="text-sm text-gray-600 hover:text-primary-600">{branch.is_active ? 'تعطيل' : 'تفعيل'}</button>
                    <button onClick={() => { setEditingBranch(branch); setFormData({ name: branch.name, code: branch.code || '', region_id: branch.region_id || '' }); setShowForm(true); }} className="p-1 text-gray-500 hover:text-primary-600"><FiEdit2 size={14} /></button>
                    <button onClick={() => handleDelete(branch.id, branch.name)} className="p-1 text-gray-500 hover:text-red-600"><FiTrash2 size={14} /></button>
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
