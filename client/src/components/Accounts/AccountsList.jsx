import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { accountsAPI, currenciesAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { accountTypeColors, accountTypes } from '../../utils/helpers';
import { FiPlus, FiEdit2, FiTrash2, FiUpload, FiChevronDown, FiChevronLeft, FiSearch, FiSave, FiBook } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AccountsList() {
  const { canEdit, isAdmin } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [tree, setTree] = useState([]);
  const [allCurrencies, setAllCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedCurrencies, setSelectedCurrencies] = useState([]);

  const [formData, setFormData] = useState({ code: '', name: '', type: 'asset', parent_id: '', affected_by_transactions: true });

  useEffect(() => { loadAccounts(); loadCurrencies(); }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const [accountsRes, treeRes] = await Promise.all([accountsAPI.getAll(), accountsAPI.getTree()]);
      setAccounts(accountsRes.data);
      setTree(treeRes.data);
    } catch (err) { toast.error('خطأ في تحميل الحسابات'); }
    finally { setLoading(false); }
  };

  const loadCurrencies = async () => {
    try {
      const res = await currenciesAPI.getAll();
      setAllCurrencies(res.data);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, parent_id: formData.parent_id || null, currencies: selectedCurrencies, affected_by_transactions: formData.affected_by_transactions };
      if (editingAccount) {
        await accountsAPI.update(editingAccount.id, payload);
        toast.success('تم تحديث الحساب بنجاح');
      } else {
        await accountsAPI.create(payload);
        toast.success('تم إضافة الحساب بنجاح');
      }
      setShowForm(false); setEditingAccount(null); resetForm(); loadAccounts();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحفظ'); }
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setFormData({ code: account.code, name: account.name, type: account.type, parent_id: account.parent_id || '', affected_by_transactions: account.affected_by_transactions !== 0 });
    setSelectedCurrencies(account.currencies || []);
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`هل أنت متأكد من حذف الحساب "${name}"؟`)) return;
    try { await accountsAPI.delete(id); toast.success('تم الحذف بنجاح'); loadAccounts(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحذف'); }
  };

  const resetForm = () => { setFormData({ code: '', name: '', type: 'asset', parent_id: '', affected_by_transactions: true }); setSelectedCurrencies([]); };

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) newExpanded.delete(id); else newExpanded.add(id);
    setExpandedIds(newExpanded);
  };

  const toggleCurrency = (code) => {
    setSelectedCurrencies((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  };

  const renderAccountTree = (items, level = 0) => {
    return items.map((account) => {
      const hasChildren = account.children && account.children.length > 0;
      const isExpanded = expandedIds.has(account.id);
      const typeInfo = accountTypeColors[account.type] || {};
      return (
        <div key={account.id}>
          <div className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg cursor-pointer" style={{ paddingRight: `${level * 24 + 12}px` }}>
            {hasChildren ? <button onClick={() => toggleExpand(account.id)} className="text-gray-500 hover:text-gray-700">{isExpanded ? <FiChevronDown size={16} /> : <FiChevronLeft size={16} />}</button> : <span className="w-4"></span>}
            <span className="font-mono text-sm text-gray-600 w-16">{account.code}</span>
            <span className="font-medium text-gray-800 flex-1">{account.name}</span>
            <span className={`badge ${typeInfo.bg} ${typeInfo.text}`}>{typeInfo.label}</span>
            {account.currencies && account.currencies.length > 0 && (
              <span className="text-xs text-gray-500 font-mono">{account.currencies.join(', ')}</span>
            )}
            {account.affected_by_transactions === 0 && <span className="badge bg-orange-100 text-orange-700 text-xs">رئيسي</span>}
            {!account.is_active && <span className="badge bg-gray-100 text-gray-600">غير نشط</span>}
            {canEdit && (
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(account)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><FiEdit2 size={14} /></button>
                {isAdmin && <button onClick={() => handleDelete(account.id, account.name)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 size={14} /></button>}
              </div>
            )}
          </div>
          {hasChildren && isExpanded && <div>{renderAccountTree(account.children, level + 1)}</div>}
        </div>
      );
    });
  };

  const filteredTree = tree.filter(
    (a) => a.code.includes(search) || a.name.includes(search) || a.children?.some((c) => c.code.includes(search) || c.name.includes(search))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">دليل الحسابات</h2>
        <div className="flex items-center gap-3">
          <Link to="/accounts/import" className="btn-secondary"><FiUpload size={18} /> استيراد من Excel</Link>
          {canEdit && <button onClick={() => { resetForm(); setEditingAccount(null); setShowForm(true); }} className="btn-primary"><FiPlus size={20} /> إضافة حساب</button>}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{editingAccount ? 'تعديل الحساب' : 'إضافة حساب جديد'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الحساب *</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="input-field" placeholder="مثال: 1001" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الحساب *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="اسم الحساب" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع الحساب *</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="input-field" required>
                  {accountTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الحساب الرئيسي</label>
                <select value={formData.parent_id} onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })} className="input-field">
                  <option value="">بدون (حساب رئيسي)</option>
                  {accounts.filter((a) => a.id !== editingAccount?.id).map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="affected_by_transactions" checked={formData.affected_by_transactions} onChange={(e) => setFormData({ ...formData, affected_by_transactions: e.target.checked })} className="w-4 h-4 text-primary-600 rounded" />
                <label htmlFor="affected_by_transactions" className="text-sm font-medium text-gray-700">يتأثر بالعمليات (يُستخدم في القيود اليومية)</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">العملات المسموح بها</label>
                <p className="text-xs text-gray-500 mb-2">اترك فارغاً للسماح بجميع العملات</p>
                <div className="flex flex-wrap gap-2">
                  {allCurrencies.map((c) => (
                    <button key={c.code} type="button" onClick={() => toggleCurrency(c.code)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${selectedCurrencies.includes(c.code) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {c.code}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1"><FiSave size={18} /> {editingAccount ? 'تحديث' : 'إضافة'}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditingAccount(null); }} className="btn-secondary flex-1">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="relative">
          <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pr-10" placeholder="بحث في الحسابات..." />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : filteredTree.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><FiBook className="mx-auto mb-4" size={48} /><p>لا توجد حسابات</p></div>
        ) : (
          <div>{renderAccountTree(filteredTree)}</div>
        )}
      </div>
    </div>
  );
}
