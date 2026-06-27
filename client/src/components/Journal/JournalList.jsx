import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { journalAPI, branchesAPI, currenciesAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { FiPlus, FiTrash2, FiEye, FiSearch, FiFilter, FiFileText, FiPrinter } from 'react-icons/fi';
import { printJournalEntry } from '../../utils/printUtils';
import toast from 'react-hot-toast';

export default function JournalList() {
  const { canEdit } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [branches, setBranches] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [currencyCode, setCurrencyCode] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { loadEntries(); loadBranches(); loadCurrencies(); }, [page, fromDate, toDate, branchId, currencyCode]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (branchId) params.branch_id = branchId;
      if (currencyCode) params.currency_code = currencyCode;
      const res = await journalAPI.getAll(params);
      setEntries(res.data.entries);
      setPagination(res.data.pagination);
    } catch (err) { toast.error('خطأ في تحميل القيود'); }
    finally { setLoading(false); }
  };

  const loadBranches = async () => { try { const res = await branchesAPI.getActive(); setBranches(res.data); } catch (err) { console.error(err); } };
  const loadCurrencies = async () => { try { const res = await currenciesAPI.getAll(); setCurrencies(res.data); } catch (err) { console.error(err); } };

  const handleDelete = async (id, number) => {
    if (!confirm(`هل أنت متأكد من حذف القيد ${number}؟`)) return;
    try { await journalAPI.delete(id); toast.success('تم الحذف بنجاح'); loadEntries(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحذف'); }
  };

  const handlePrint = async (entryId) => {
    try {
      const res = await journalAPI.getById(entryId);
      await printJournalEntry(res.data);
    } catch (err) { toast.error('خطأ في تحميل القيد للطباعة'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">القيد متعدد الأطراف (MULTY)</h2>
        {canEdit && <Link to="/journal/new" className="btn-primary"><FiPlus size={20} /> إضافة قيد جديد</Link>}
      </div>

      <div className="card mb-6">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadEntries(); }} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">بحث</label>
            <div className="relative">
              <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pr-10" placeholder="رقم القيد أو البيان..." />
            </div>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input-field" />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input-field" />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">الفرع</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input-field">
              <option value="">الكل</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="min-w-[120px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">العملة</label>
            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="input-field">
              <option value="">الكل</option>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary"><FiFilter size={18} /> بحث</button>
        </form>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><FiFileText className="mx-auto mb-4" size={48} /><p>لا توجد قيود يومية</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>رقم القيد</th>
                  <th>التاريخ</th>
                  <th>البيان</th>
                  <th>الفرع</th>
                  <th>المدين</th>
                  <th>الدائن</th>
                  <th>المقابل المحلي (مدين)</th>
                  <th>المقابل المحلي (دائن)</th>
                  <th>أنشأه</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-mono font-bold text-primary-600">{entry.entry_number}</td>
                    <td>{formatDate(entry.date)}</td>
                    <td className="max-w-[200px] truncate">{entry.description}</td>
                    <td>{entry.branch_name || '-'}</td>
                    <td className="font-bold text-blue-600">{formatCurrency(entry.total_debit)}</td>
                    <td className="font-bold text-red-600">{formatCurrency(entry.total_credit)}</td>
                    <td className="font-bold text-blue-500 text-sm">{formatCurrency(entry.total_local_debit)}</td>
                    <td className="font-bold text-red-500 text-sm">{formatCurrency(entry.total_local_credit)}</td>
                    <td>{entry.created_by_name}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handlePrint(entry.id)} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg" title="طباعة"><FiPrinter size={16} /></button>
                        <Link to={`/journal/edit/${entry.id}`} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><FiEye size={16} /></Link>
                        {canEdit && <button onClick={() => handleDelete(entry.id, entry.entry_number)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-500">إجمالي: {pagination.total} قيد | صفحة {pagination.page} من {pagination.totalPages}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-50">السابق</button>
              <button onClick={() => setPage(Math.min(pagination.totalPages, page + 1))} disabled={page === pagination.totalPages} className="btn-secondary disabled:opacity-50">التالي</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
