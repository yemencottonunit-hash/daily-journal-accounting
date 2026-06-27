import { useState, useEffect } from 'react';
import { journalAPI, branchesAPI, accountsAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { FiSearch, FiFilter, FiFileText, FiPrinter } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ExecutedEntries() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [executingBranchId, setExecutingBranchId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { loadBranches(); loadAccounts(); }, []);
  useEffect(() => { loadLines(); }, [page, fromDate, toDate, executingBranchId, accountId]);

  const loadLines = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (executingBranchId) params.executing_branch_id = executingBranchId;
      if (accountId) params.account_id = accountId;
      const res = await journalAPI.getExecuted(params);
      setLines(res.data.lines);
      setPagination(res.data.pagination);
    } catch (err) { toast.error('خطأ في تحميل القيود المنفذة'); }
    finally { setLoading(false); }
  };

  const loadBranches = async () => { try { const res = await branchesAPI.getActive(); setBranches(res.data); } catch {} };
  const loadAccounts = async () => { try { const res = await accountsAPI.getAll(); setAccounts(res.data); } catch {} };

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const totalLocalDebit = lines.reduce((s, l) => s + (parseFloat(l.local_debit) || 0), 0);
  const totalLocalCredit = lines.reduce((s, l) => s + (parseFloat(l.local_credit) || 0), 0);

  const handlePrint = () => {
    if (lines.length === 0) { toast.error('لا توجد بيانات للطباعة'); return; }
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>القيود المنفذة</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Tajawal',Arial,sans-serif;font-size:10px;padding:10px;color:#1f2937}
h1{text-align:center;font-size:16px;margin-bottom:10px;color:#1a1a2e}
.summary{display:flex;gap:20px;margin-bottom:10px;padding:8px;background:#f9fafb;border-radius:6px;font-size:10px}
table{width:100%;border-collapse:collapse;font-size:9px}
th{background:#1976d2;color:#fff;padding:4px 6px;text-align:right;font-size:8px}
td{padding:3px 6px;border-bottom:1px solid #e5e7eb}
tr:nth-child(even){background:#f9fafb}
.debit{color:#2563eb;font-weight:600}.credit{color:#dc2626;font-weight:600}
.total{font-weight:700;background:#e3f2fd !important;border-top:2px solid #1976d2}
@media print{@page{size:landscape;margin:8mm}}
</style></head><body>
<h1>القيود المنفذة حسب الفرع</h1>
<div class="summary">
<span>عدد البنود: <b>${lines.length}</b></span>
<span>إجمالي مدين: <b class="debit">${formatCurrency(totalDebit)}</b></span>
<span>إجمالي دائن: <b class="credit">${formatCurrency(totalCredit)}</b></span>
<span>محلي مدين: <b class="debit">${formatCurrency(totalLocalDebit)}</b></span>
<span>محلي دائن: <b class="credit">${formatCurrency(totalLocalCredit)}</b></span>
</div>
<table><thead><tr>
<th>#</th><th>رقم القيد</th><th>التاريخ</th><th>رقم الحساب</th><th>اسم الحساب</th>
<th>مدين</th><th>دائن</th><th>العملة</th><th>الصرف</th><th>محلي مدين</th><th>محلي دائن</th>
<th>البيان</th><th>الفرع المنفذ</th><th>أنشأه</th>
</tr></thead><tbody>${lines.map((l, i) => `<tr>
<td>${i + 1}</td><td>${l.entry_number}</td><td>${formatDate(l.entry_date)}</td>
<td>${l.account_code || ''}</td><td>${l.account_name || ''}</td>
<td class="debit">${l.debit > 0 ? formatCurrency(l.debit, l.currency_code) : '-'}</td>
<td class="credit">${l.credit > 0 ? formatCurrency(l.credit, l.currency_code) : '-'}</td>
<td>${l.currency_code || 'YER'}</td><td>${l.exchange_rate || 1}</td>
<td class="debit">${(parseFloat(l.local_debit) || 0) > 0 ? formatCurrency(l.local_debit) : '-'}</td>
<td class="credit">${(parseFloat(l.local_credit) || 0) > 0 ? formatCurrency(l.local_credit) : '-'}</td>
<td>${l.description || l.entry_description || ''}</td>
<td>${l.executing_branch_code ? l.executing_branch_code + ' - ' : ''}${l.executing_branch_name || '-'}</td>
<td>${l.created_by_name || ''}</td>
</tr>`).join('')}</tbody>
<tfoot><tr class="total">
<td colspan="5">الإجمالي</td>
<td class="debit">${formatCurrency(totalDebit)}</td><td class="credit">${formatCurrency(totalCredit)}</td>
<td colspan="2"></td>
<td class="debit">${formatCurrency(totalLocalDebit)}</td><td class="credit">${formatCurrency(totalLocalCredit)}</td>
<td colspan="3"></td>
</tr></tfoot></table>
<div style="text-align:center;margin-top:10px;color:#999;font-size:9px">لؤي العليمي 774347342</div>
</body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html); win.document.close();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">القيود المنفذة</h2>
        <button onClick={handlePrint} className="btn-secondary"><FiPrinter size={18} /> طباعة</button>
      </div>

      <div className="card mb-6">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadLines(); }} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">بحث</label>
            <div className="relative">
              <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pr-10" placeholder="رقم القيد، البيان، الحساب..." />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">الفرع المنفذ</label>
            <select value={executingBranchId} onChange={(e) => setExecutingBranchId(e.target.value)} className="input-field">
              <option value="">الكل</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.code ? b.code + ' - ' : ''}{b.name}</option>)}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">الحساب</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input-field">
              <option value="">الكل</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary"><FiFilter size={18} /> بحث</button>
        </form>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : lines.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><FiFileText className="mx-auto mb-4" size={48} /><p>لا توجد قيود منفذة</p></div>
        ) : (
          <>
            <div className="flex gap-4 mb-3 text-sm">
              <span>عدد البنود: <b>{lines.length}</b></span>
              <span className="text-blue-600">مدين: <b>{formatCurrency(totalDebit)}</b></span>
              <span className="text-red-600">دائن: <b>{formatCurrency(totalCredit)}</b></span>
              <span className="text-blue-500">محلي مدين: <b>{formatCurrency(totalLocalDebit)}</b></span>
              <span className="text-red-500">محلي دائن: <b>{formatCurrency(totalLocalCredit)}</b></span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>رقم القيد</th>
                    <th>التاريخ</th>
                    <th>الحساب</th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>العملة</th>
                    <th>الصرف</th>
                    <th>محلي مدين</th>
                    <th>محلي دائن</th>
                    <th>البيان</th>
                    <th>الفرع المنفذ</th>
                    <th>أنشأه</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className="font-mono font-bold text-primary-600">{line.entry_number}</td>
                      <td>{formatDate(line.entry_date)}</td>
                      <td>{line.account_code ? line.account_code + ' - ' : ''}{line.account_name || ''}</td>
                      <td className="font-bold text-blue-600">{line.debit > 0 ? formatCurrency(line.debit, line.currency_code) : '-'}</td>
                      <td className="font-bold text-red-600">{line.credit > 0 ? formatCurrency(line.credit, line.currency_code) : '-'}</td>
                      <td className="text-center">{line.currency_code || 'YER'}</td>
                      <td className="text-center">{line.exchange_rate || 1}</td>
                      <td className="font-bold text-blue-500">{(parseFloat(line.local_debit) || 0) > 0 ? formatCurrency(line.local_debit) : '-'}</td>
                      <td className="font-bold text-red-500">{(parseFloat(line.local_credit) || 0) > 0 ? formatCurrency(line.local_credit) : '-'}</td>
                      <td className="max-w-[200px] truncate">{line.description || line.entry_description || ''}</td>
                      <td>{line.executing_branch_code ? line.executing_branch_code + ' - ' : ''}{line.executing_branch_name || '-'}</td>
                      <td className="text-xs">{line.created_by_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-500">إجمالي: {pagination.total} بند | صفحة {pagination.page} من {pagination.totalPages}</span>
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
