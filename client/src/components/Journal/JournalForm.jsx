import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { journalAPI, accountsAPI, currenciesAPI, branchesAPI, regionsAPI, archiveAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, getToday } from '../../utils/helpers';
import { FiPlus, FiTrash2, FiSave, FiArrowRight, FiUpload } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function JournalForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regionRates, setRegionRates] = useState({});
  const [attachment, setAttachment] = useState(null);
  const [existingAttachment, setExistingAttachment] = useState(null);

  const [formData, setFormData] = useState({
    date: getToday(),
    description: '',
    branch_id: '',
    lines: [
      { account_id: '', debit: '', credit: '', currency_code: 'YER', exchange_rate: 1, executing_branch_id: '', description: '' },
      { account_id: '', debit: '', credit: '', currency_code: 'YER', exchange_rate: 1, executing_branch_id: '', description: '' },
    ],
  });

  useEffect(() => { loadData(); if (isEdit) loadEntry(); }, [id]);

  const loadData = async () => {
    try {
      const [accountsRes, currenciesRes, branchesRes] = await Promise.all([
        accountsAPI.getActive(), currenciesAPI.getAll(), branchesAPI.getActive(),
      ]);
      setAllAccounts(accountsRes.data.filter(a => a.affected_by_transactions !== 0));
      setCurrencies(currenciesRes.data);
      setBranches(branchesRes.data);
    } catch (err) { toast.error('خطأ في تحميل البيانات'); }
  };

  const loadEntry = async () => {
    setLoading(true);
    try {
      const res = await journalAPI.getById(id);
      const entry = res.data;
      if (entry.branch_id) await loadBranchRates(entry.branch_id);
      setFormData({
        date: entry.date,
        description: entry.description || '',
        branch_id: entry.branch_id || '',
        lines: entry.lines.map((l) => ({
          account_id: l.account_id,
          debit: l.debit || '',
          credit: l.credit || '',
          currency_code: l.currency_code || 'YER',
          exchange_rate: l.exchange_rate || 1,
          executing_branch_id: l.executing_branch_id || '',
          description: l.description || '',
          line_id: l.id,
        })),
      });
      if (entry.attachment_path) setExistingAttachment(entry.attachment_path);
    } catch (err) { toast.error('خطأ في تحميل القيد'); navigate('/journal'); }
    finally { setLoading(false); }
  };

  const loadBranchRates = async (branchId) => {
    try {
      const branch = branches.find((b) => b.id == branchId);
      if (branch?.region_id) {
        const res = await currenciesAPI.getRegionRates(branch.region_id);
        const rates = {};
        res.data.forEach((r) => { rates[r.currency_code] = r.exchange_rate; });
        setRegionRates(rates);
      }
    } catch (err) { console.error(err); }
  };

  const handleBranchChange = async (branchId) => {
    setFormData({ ...formData, branch_id: branchId });
    if (!branchId) { setRegionRates({}); return; }
    await loadBranchRates(branchId);
  };

  const getAccountCurrencyOptions = (accountId) => {
    if (!accountId) return currencies;
    const acct = allAccounts.find((a) => a.id == accountId);
    if (!acct || !acct.currencies || acct.currencies.length === 0) return currencies;
    return currencies.filter((c) => acct.currencies.includes(c.code));
  };

  const handleLineChange = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };

    if (field === 'currency_code') {
      newLines[index].exchange_rate = regionRates[value] || currencies.find((c) => c.code === value)?.exchange_rate || 1;
    }
    if (field === 'account_id') {
      const acct = allAccounts.find((a) => a.id == value);
      if (acct?.currencies?.length > 0 && !acct.currencies.includes(newLines[index].currency_code)) {
        newLines[index].currency_code = acct.currencies[0];
        newLines[index].exchange_rate = regionRates[acct.currencies[0]] || 1;
      }
    }

    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { account_id: '', debit: '', credit: '', currency_code: 'YER', exchange_rate: 1, executing_branch_id: '', description: '' }],
    });
  };

  const removeLine = (index) => {
    if (formData.lines.length <= 2) { toast.error('يجب أن يحتوي القيد على بندين على الأقل'); return; }
    setFormData({ ...formData, lines: formData.lines.filter((_, i) => i !== index) });
  };

  const totalDebit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);

  const totalLocalDebit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
  const totalLocalCredit = formData.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
  const isBalanced = Math.abs(totalLocalDebit - totalLocalCredit) < 0.001 && totalLocalDebit > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.date) { toast.error('يرجى إدخال التاريخ'); return; }
    const validLines = formData.lines.filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) { toast.error('يجب إدخال بندين على الأقل'); return; }
    if (!isBalanced) { toast.error('مجموع المقابل المحلي للمدين يجب أن يساوي مجموع المقابل المحلي للدائن'); return; }

    setSaving(true);
    try {
      const payload = {
        date: formData.date, description: formData.description, branch_id: formData.branch_id || null,
        lines: validLines.map(l => ({ ...l, executing_branch_id: l.executing_branch_id || null }))
      };
      let entryId;
      if (isEdit) { await journalAPI.update(id, payload); entryId = id; toast.success('تم تحديث القيد بنجاح'); }
      else { const res = await journalAPI.create(payload); entryId = res.data.id; toast.success('تم إنشاء القيد بنجاح'); }
      if (attachment) { const fd = new FormData(); fd.append('file', attachment); await archiveAPI.upload(entryId, fd); }
      navigate('/journal');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحفظ'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/journal')} className="btn-secondary"><FiArrowRight size={20} /> العودة</button>
        <h2 className="text-2xl font-bold text-gray-800">{isEdit ? 'تعديل القيد' : 'إضافة قيد يومي جديد'}</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="card">
            <h3 className="text-lg font-bold text-gray-700 mb-4">بيانات القيد</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البيان</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows="2" placeholder="وصف القيد..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفرع</label>
                <select value={formData.branch_id} onChange={(e) => handleBranchChange(e.target.value)} className="input-field">
                  <option value="">بدون فرع</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مرفق (اختياري)</label>
                <input type="file" onChange={(e) => setAttachment(e.target.files[0])} className="input-field" accept="image/*,.pdf" />
                {existingAttachment && !attachment && <p className="text-sm text-green-600 mt-1">✓ يوجد مستند مرفق</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-700">بنود القيد</h3>
              {canEdit && <button type="button" onClick={addLine} className="btn-secondary text-sm"><FiPlus size={16} /> إضافة بند</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-right">#</th>
                    <th className="px-3 py-2 text-right">الحساب *</th>
                    <th className="px-3 py-2 text-right">مدين</th>
                    <th className="px-3 py-2 text-right">دائن</th>
                    <th className="px-3 py-2 text-right">العملة</th>
                    <th className="px-3 py-2 text-right">سعر الصرف</th>
                    <th className="px-3 py-2 text-right">المقابل المحلي</th>
                    <th className="px-3 py-2 text-right">الفرع المنفذ</th>
                    <th className="px-3 py-2 text-right">الوصف</th>
                    {canEdit && <th className="px-3 py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {formData.lines.map((line, index) => {
                    const localDebit = (parseFloat(line.debit) || 0) * (parseFloat(line.exchange_rate) || 1);
                    const localCredit = (parseFloat(line.credit) || 0) * (parseFloat(line.exchange_rate) || 1);
                    return (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                        <td className="px-3 py-2">
                          <select value={line.account_id} onChange={(e) => handleLineChange(index, 'account_id', e.target.value)} className="input-field-sm" required>
                            <option value="">اختر الحساب</option>
                            {allAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><input type="number" value={line.debit} onChange={(e) => handleLineChange(index, 'debit', e.target.value)} className="input-field-sm" min="0" step="0.01" placeholder="0" /></td>
                        <td className="px-3 py-2"><input type="number" value={line.credit} onChange={(e) => handleLineChange(index, 'credit', e.target.value)} className="input-field-sm" min="0" step="0.01" placeholder="0" /></td>
                        <td className="px-3 py-2">
                          <select value={line.currency_code} onChange={(e) => handleLineChange(index, 'currency_code', e.target.value)} className="input-field-sm">
                            {getAccountCurrencyOptions(line.account_id).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><input type="number" value={line.exchange_rate} onChange={(e) => handleLineChange(index, 'exchange_rate', e.target.value)} className="input-field-sm" min="0" step="0.0001" /></td>
                        <td className="px-3 py-2 text-xs">
                          {line.debit > 0 && <span className="text-blue-600">{formatCurrency(localDebit)}</span>}
                          {line.credit > 0 && <span className="text-red-600">{formatCurrency(localCredit)}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <select value={line.executing_branch_id} onChange={(e) => handleLineChange(index, 'executing_branch_id', e.target.value)} className="input-field-sm">
                            <option value="">بدون</option>
                            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2"><input type="text" value={line.description} onChange={(e) => handleLineChange(index, 'description', e.target.value)} className="input-field-sm" placeholder="وصف" /></td>
                        {canEdit && <td className="px-3 py-2"><button type="button" onClick={() => removeLine(index)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"><FiTrash2 size={16} /></button></td>}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan="2" className="px-3 py-3 text-right">المجموع</td>
                    <td className="px-3 py-3 text-blue-600">{formatCurrency(totalDebit)}</td>
                    <td className="px-3 py-3 text-red-600">{formatCurrency(totalCredit)}</td>
                    <td colSpan="2" className="px-3 py-3 text-xs">
                      <div>محلي مدين: {formatCurrency(totalLocalDebit)}</div>
                      <div>محلي دائن: {formatCurrency(totalLocalCredit)}</div>
                    </td>
                    <td className="px-3 py-3">
                      {isBalanced ? <span className="text-green-600">✓ متوازن</span> : <span className="text-red-600">✗ غير متوازن</span>}
                    </td>
                    {canEdit && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center justify-start gap-4">
            <button type="submit" disabled={saving || !isBalanced} className="btn-primary px-8">
              {saving ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> جاري الحفظ...</span> : <><FiSave size={20} /> {isEdit ? 'تحديث القيد' : 'حفظ القيد'}</>}
            </button>
            <button type="button" onClick={() => navigate('/journal')} className="btn-secondary">إلغاء</button>
          </div>
        )}
      </form>
    </div>
  );
}
