import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { documentsAPI, accountsAPI, currenciesAPI, branchesAPI, regionsAPI, documentTypesAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, getToday } from '../../utils/helpers';
import { FiPlus, FiTrash2, FiSave, FiArrowRight, FiPrinter } from 'react-icons/fi';
import { printDocument } from '../../utils/printUtils';
import toast from 'react-hot-toast';

export default function DocumentForm() {
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
  const [regions, setRegions] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [regionRates, setRegionRates] = useState({});

  const [nextDocNumber, setNextDocNumber] = useState('');

  const [formData, setFormData] = useState({
    date: getToday(),
    description: '',
    branch_id: '',
    doc_type_id: '',
    entries: [{
      entry_number: 1,
      description: '',
      branch_id: '',
      lines: [
        { account_id: '', debit: '', credit: '', currency_code: 'YER', exchange_rate: 1, description: '' },
        { account_id: '', debit: '', credit: '', currency_code: 'YER', exchange_rate: 1, description: '' },
      ],
    }],
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!isEdit && documentTypes.length > 0) loadNextNumber();
  }, [formData.doc_type_id, documentTypes]);

  const loadNextNumber = async () => {
    try {
      const res = await documentsAPI.getNextNumber(formData.doc_type_id || null);
      setNextDocNumber(res.data.next_number);
    } catch {}
  };

  const loadData = async () => {
    try {
      const [accountsRes, currenciesRes, branchesRes, regionsRes, docTypesRes] = await Promise.all([
        accountsAPI.getActive(), currenciesAPI.getAll(), branchesAPI.getActive(), regionsAPI.getAll(),
        documentTypesAPI.getActive(),
      ]);
      setAllAccounts(accountsRes.data.filter((a) => a.affected_by_transactions === 1 || a.affected_by_transactions === true));
      setCurrencies(currenciesRes.data);
      setBranches(branchesRes.data);
      setRegions(regionsRes.data);
      setDocumentTypes(docTypesRes.data);
    } catch (err) { toast.error('خطأ في تحميل البيانات'); }
    if (isEdit) {
      await loadDocument();
    } else {
      try {
        const res = await documentsAPI.getNextNumber(null);
        setNextDocNumber(res.data.next_number);
      } catch {}
    }
  };

  const loadDocument = async () => {
    setLoading(true);
    try {
      const res = await documentsAPI.getById(id);
      const doc = res.data;
      setNextDocNumber(doc.doc_number || '');
      setFormData({
        date: doc.date,
        description: doc.description || '',
        branch_id: doc.branch_id || '',
        doc_type_id: doc.doc_type_id || '',
        entries: doc.entries.map((e, i) => ({
          entry_number: i + 1,
          description: e.description || '',
          branch_id: e.branch_id || '',
          lines: e.lines.map((l) => ({
            account_id: l.account_id,
            debit: l.debit || '',
            credit: l.credit || '',
            currency_code: l.currency_code || 'YER',
            exchange_rate: l.exchange_rate || 1,
            description: l.description || '',
          })),
        })),
      });
    } catch (err) { toast.error('خطأ في تحميل المستند'); navigate('/documents'); }
    finally { setLoading(false); }
  };

  const handleBranchChange = async (branchId) => {
    setFormData({ ...formData, branch_id: branchId });
    if (!branchId) { setRegionRates({}); return; }
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

  const getAccountCurrencyOptions = (accountId) => {
    if (!accountId) return currencies;
    const acct = allAccounts.find((a) => a.id == accountId);
    if (!acct || !acct.currencies || acct.currencies.length === 0) return currencies;
    return currencies.filter((c) => acct.currencies.includes(c.code));
  };

  const handleEntryChange = (entryIdx, lineIdx, field, value) => {
    const newEntries = [...formData.entries];
    const newLine = { ...newEntries[entryIdx].lines[lineIdx], [field]: value };

    if (field === 'currency_code') {
      newLine.exchange_rate = regionRates[value] || currencies.find((c) => c.code === value)?.exchange_rate || 1;
    }
    if (field === 'account_id') {
      const acct = allAccounts.find((a) => a.id == value);
      if (acct?.currencies?.length > 0 && !acct.currencies.includes(newLine.currency_code)) {
        newLine.currency_code = acct.currencies[0];
        newLine.exchange_rate = regionRates[acct.currencies[0]] || 1;
      }
    }

    newEntries[entryIdx].lines[lineIdx] = newLine;
    setFormData({ ...formData, entries: newEntries });
  };

  const addLineToEntry = (entryIdx) => {
    const newEntries = [...formData.entries];
    const entryDesc = newEntries[entryIdx].description || '';
    newEntries[entryIdx].lines.push({ account_id: '', debit: '', credit: '', currency_code: 'YER', exchange_rate: 1, description: entryDesc });
    setFormData({ ...formData, entries: newEntries });
  };

  const removeLineFromEntry = (entryIdx, lineIdx) => {
    const newEntries = [...formData.entries];
    if (newEntries[entryIdx].lines.length <= 2) { toast.error('يجب أن يحتوي القيد على بندين على الأقل'); return; }
    newEntries[entryIdx].lines = newEntries[entryIdx].lines.filter((_, i) => i !== lineIdx);
    setFormData({ ...formData, entries: newEntries });
  };

  const addEntry = () => {
    setFormData({
      ...formData,
      entries: [...formData.entries, {
        entry_number: formData.entries.length + 1,
        description: '',
        branch_id: '',
        lines: [
          { account_id: '', debit: '', credit: '', currency_code: 'YER', exchange_rate: 1, description: '' },
          { account_id: '', debit: '', credit: '', currency_code: 'YER', exchange_rate: 1, description: '' },
        ],
      }],
    });
  };

  const removeEntry = (entryIdx) => {
    if (formData.entries.length <= 1) { toast.error('يجب أن يحتوي المستند على قيد واحد على الأقل'); return; }
    const newEntries = formData.entries.filter((_, i) => i !== entryIdx).map((e, i) => ({ ...e, entry_number: i + 1 }));
    setFormData({ ...formData, entries: newEntries });
  };

  const validateEntries = () => {
    for (let i = 0; i < formData.entries.length; i++) {
      const entry = formData.entries[i];
      const validLines = entry.lines.filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
      if (validLines.length < 2) { toast.error(`القيد ${i + 1}: يجب إدخال بندين على الأقل`); return false; }
      const totalLocalDebit = validLines.reduce((s, l) => s + (parseFloat(l.debit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
      const totalLocalCredit = validLines.reduce((s, l) => s + (parseFloat(l.credit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
      if (Math.abs(totalLocalDebit - totalLocalCredit) > 0.001) { toast.error(`القيد ${i + 1}: المقابل المحلي للمدين لا يساوي المقابل المحلي للدائن`); return false; }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.date) { toast.error('يرجى إدخال التاريخ'); return; }
    if (!formData.branch_id) { toast.error('يرجى اختيار الفرع'); return; }
    if (!validateEntries()) return;

    setSaving(true);
    try {
      const payload = {
        date: formData.date,
        description: formData.description,
        branch_id: formData.branch_id || null,
        doc_type_id: formData.doc_type_id || null,
        entries: formData.entries.map((e) => ({
          description: e.description,
          branch_id: e.branch_id || formData.branch_id || null,
          lines: e.lines.filter((l) => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)).map((l) => ({
            account_id: l.account_id,
            debit: l.debit,
            credit: l.credit,
            currency_code: l.currency_code,
            exchange_rate: l.exchange_rate,
            description: l.description,
          })),
        })),
      };

      let savedId;
      if (isEdit) {
        await documentsAPI.update(id, payload);
        savedId = id;
        toast.success('تم تحديث المستند بنجاح');
      } else {
        const res = await documentsAPI.create(payload);
        savedId = res.data.id;
        toast.success('تم إنشاء المستند بنجاح');
      }

      if (confirm('تم الحفظ بنجاح. هل تريد طباعة المستند؟')) {
        try {
          const res = await documentsAPI.getById(savedId);
          await printDocument(res.data);
        } catch (err) { console.error(err); }
      }

      navigate('/documents');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحفظ'); }
    finally { setSaving(false); }
  };

  const renderEntry = (entry, entryIdx) => {
    const totalDebit = entry.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = entry.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const totalLocalDebit = entry.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
    const totalLocalCredit = entry.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
    const isBalanced = Math.abs(totalLocalDebit - totalLocalCredit) < 0.001 && totalLocalDebit > 0;

    return (
      <div key={entryIdx} className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h4 className="font-bold text-gray-700">القيد {entry.entry_number}</h4>
            <input type="text" value={entry.description} onChange={(e) => {
              const newDesc = e.target.value;
              const newEntries = [...formData.entries];
              const oldDesc = newEntries[entryIdx].description;
              newEntries[entryIdx].description = newDesc;
              newEntries[entryIdx].lines = newEntries[entryIdx].lines.map((l) => ({
                ...l,
                description: l.description === oldDesc ? newDesc : l.description,
              }));
              setFormData({ ...formData, entries: newEntries });
            }} className="input-field-sm" placeholder="بيان القيد" />
            <select value={entry.branch_id || ''} onChange={(e) => {
              const newEntries = [...formData.entries]; newEntries[entryIdx].branch_id = e.target.value; setFormData({ ...formData, entries: newEntries });
            }} className="input-field-sm">
              <option value="">الفرع العام</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.code ? b.code + ' - ' : ''}{b.name}</option>)}
            </select>
          </div>
          {canEdit && formData.entries.length > 1 && (
            <button type="button" onClick={() => removeEntry(entryIdx)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"><FiTrash2 size={16} /></button>
          )}
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
                <th className="px-3 py-2 text-right">الوصف</th>
                {canEdit && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line, lineIdx) => {
                const localDebit = (parseFloat(line.debit) || 0) * (parseFloat(line.exchange_rate) || 1);
                const localCredit = (parseFloat(line.credit) || 0) * (parseFloat(line.exchange_rate) || 1);
                return (
                  <tr key={lineIdx} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-500">{lineIdx + 1}</td>
                    <td className="px-3 py-2">
                      <select value={line.account_id} onChange={(e) => handleEntryChange(entryIdx, lineIdx, 'account_id', e.target.value)} className="input-field-sm" required>
                        <option value="">اختر الحساب</option>
                        {allAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={line.debit} onChange={(e) => handleEntryChange(entryIdx, lineIdx, 'debit', e.target.value)} className="input-field-sm" min="0" step="0.01" placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={line.credit} onChange={(e) => handleEntryChange(entryIdx, lineIdx, 'credit', e.target.value)} className="input-field-sm" min="0" step="0.01" placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={line.currency_code} onChange={(e) => handleEntryChange(entryIdx, lineIdx, 'currency_code', e.target.value)} className="input-field-sm">
                        {getAccountCurrencyOptions(line.account_id).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={line.exchange_rate} onChange={(e) => handleEntryChange(entryIdx, lineIdx, 'exchange_rate', e.target.value)} className="input-field-sm" min="0" step="0.0001" />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {line.debit > 0 && <span className="text-blue-600">{formatCurrency(localDebit)}</span>}
                      {line.credit > 0 && <span className="text-red-600">{formatCurrency(localCredit)}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={line.description} onChange={(e) => handleEntryChange(entryIdx, lineIdx, 'description', e.target.value)} className="input-field-sm" placeholder="وصف" />
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeLineFromEntry(entryIdx, lineIdx)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"><FiTrash2 size={14} /></button>
                      </td>
                    )}
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
              </tr>
            </tfoot>
          </table>
        </div>

        {canEdit && (
          <button type="button" onClick={() => addLineToEntry(entryIdx)} className="btn-secondary text-sm mt-3">
            <FiPlus size={16} /> إضافة بند
          </button>
        )}
      </div>
    );
  };

  const handlePrint = async () => {
    if (!isEdit) { toast.error('يجب حفظ المستند أولاً'); return; }
    try {
      const res = await documentsAPI.getById(id);
      await printDocument(res.data);
    } catch (err) { toast.error('خطأ في تحميل المستند للطباعة'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const selectedBranch = branches.find((b) => b.id == formData.branch_id);
  const selectedDocType = documentTypes.find((dt) => dt.id == formData.doc_type_id);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/documents')} className="btn-secondary"><FiArrowRight size={20} /> العودة</button>
        <h2 className="text-2xl font-bold text-gray-800">{isEdit ? 'تعديل المستند' : 'مستند محاسبي جديد'}</h2>
        {isEdit && <button onClick={handlePrint} className="btn-secondary"><FiPrinter size={18} /> طباعة</button>}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card mb-6">
          <h3 className="text-lg font-bold text-gray-700 mb-4">بيانات المستند</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم المستند (ترميز)</label>
              <input type="text" value={nextDocNumber} className="input-field bg-gray-100 font-mono font-bold" disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التسلسل</label>
              <input type="text" value={nextDocNumber ? nextDocNumber.split('-').pop() : ''} className="input-field bg-gray-100" disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
              <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الفرع *</label>
              <select value={formData.branch_id} onChange={(e) => handleBranchChange(e.target.value)} className="input-field" required>
                <option value="">اختر الفرع</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.code ? b.code + ' - ' : ''}{b.name}</option>)}
              </select>
              {selectedBranch && <div className="text-xs text-gray-500 mt-1">الكود: {selectedBranch.code || '-'}</div>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع المستند</label>
              <select value={formData.doc_type_id} onChange={(e) => setFormData({ ...formData, doc_type_id: e.target.value })} className="input-field">
                <option value="">بدون</option>
                {documentTypes.map((dt) => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رمز نوع المستند</label>
              <input type="text" value={selectedDocType ? (selectedDocType.prefix || selectedDocType.code) : ''} className="input-field bg-gray-100 font-mono" disabled placeholder="—" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">البيان العام</label>
            <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" placeholder="بيان المستند..." />
          </div>
        </div>

        {formData.entries.map((entry, idx) => renderEntry(entry, idx))}

        {canEdit && (
          <div className="flex items-center gap-3 mb-6">
            <button type="button" onClick={addEntry} className="btn-secondary"><FiPlus size={18} /> إضافة قيد</button>
          </div>
        )}

        {canEdit && (
          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving} className="btn-primary px-8">
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> جاري الحفظ...
                </span>
              ) : <><FiSave size={20} /> {isEdit ? 'تحديث المستند' : 'حفظ المستند'}</>}
            </button>
            <button type="button" onClick={() => navigate('/documents')} className="btn-secondary">إلغاء</button>
          </div>
        )}
      </form>
    </div>
  );
}
