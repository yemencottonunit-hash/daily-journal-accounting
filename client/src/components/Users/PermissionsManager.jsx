import { useState, useEffect } from 'react';
import { permissionsAPI, authAPI } from '../../services/api';
import { FiSave, FiArrowRight, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

const ACTIONS = [
  { key: 'can_view', label: 'استعراض', color: 'text-blue-600' },
  { key: 'can_add', label: 'إضافة', color: 'text-green-600' },
  { key: 'can_edit', label: 'تعديل', color: 'text-yellow-600' },
  { key: 'can_delete', label: 'حذف', color: 'text-red-600' },
  { key: 'can_print', label: 'طباعة', color: 'text-purple-600' },
];

export default function PermissionsManager() {
  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [usersRes, modulesRes] = await Promise.all([
        authAPI.getUsers(), permissionsAPI.getModules()
      ]);
      setUsers(usersRes.data);
      setModules(modulesRes.data);
    } catch (err) { toast.error('خطأ في تحميل البيانات'); }
    finally { setLoading(false); }
  };

  const loadUserPermissions = async (userId) => {
    try {
      const res = await permissionsAPI.getUserPermissions(userId);
      setPermissions(res.data);
    } catch (err) { toast.error('خطأ في تحميل الصلاحيات'); }
  };

  const handleUserSelect = async (userId) => {
    setSelectedUser(userId);
    await loadUserPermissions(userId);
  };

  const togglePermission = (module, action) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action]
      }
    }));
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await permissionsAPI.updateUserPermissions(selectedUser, permissions);
      toast.success('تم حفظ الصلاحيات بنجاح');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحفظ'); }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">إدارة الصلاحيات</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold text-gray-700 mb-4">المستخدمين</h3>
          <div className="space-y-2">
            {users.map(u => (
              <button key={u.id} onClick={() => handleUserSelect(u.id)}
                className={`w-full text-right p-3 rounded-lg transition-colors ${selectedUser == u.id ? 'bg-primary-50 border-2 border-primary-500 text-primary-700' : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'}`}>
                <div className="font-medium">{u.full_name || u.username}</div>
                <div className="text-xs text-gray-500">{u.role === 'admin' ? 'مدير' : u.role === 'accountant' ? 'محاسب' : 'مشاهد'}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 card">
          {!selectedUser ? (
            <div className="text-center py-12 text-gray-500">اختر مستخدماً لتعديل صلاحياته</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-700">
                  صلاحيات: {users.find(u => u.id == selectedUser)?.full_name}
                </h3>
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  <FiSave size={18} /> {saving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-right font-bold">الموديول</th>
                      {ACTIONS.map(a => (
                        <th key={a.key} className={`px-4 py-3 text-center font-bold ${a.color}`}>{a.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map(m => (
                      <tr key={m.key} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                        {ACTIONS.map(a => (
                          <td key={a.key} className="px-4 py-3 text-center">
                            <button onClick={() => togglePermission(m.key, a.key)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${permissions[m.key]?.[a.key] ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                              {permissions[m.key]?.[a.key] ? <FiCheck size={16} /> : <FiX size={16} />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => {
                  const all = {};
                  modules.forEach(m => { all[m.key] = { can_view: true, can_add: true, can_edit: true, can_delete: true, can_print: true }; });
                  setPermissions(all);
                }} className="btn-secondary text-sm">تحديد الكل</button>
                <button onClick={() => {
                  const viewOnly = {};
                  modules.forEach(m => { viewOnly[m.key] = { can_view: true, can_add: false, can_edit: false, can_delete: false, can_print: true }; });
                  setPermissions(viewOnly);
                }} className="btn-secondary text-sm">استعراض فقط</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
