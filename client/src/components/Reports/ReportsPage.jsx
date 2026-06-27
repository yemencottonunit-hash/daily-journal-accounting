import { useState, useEffect, useRef } from 'react';
import { reportsAPI, accountsAPI, branchesAPI, regionsAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { FiPrinter, FiFilter } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('trial-balance');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const printRef = useRef();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [asOfDate, setAsOfDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [regionId, setRegionId] = useState('');
  const [reportCurrency, setReportCurrency] = useState('YER');

  useEffect(() => { loadAccounts(); loadBranches(); loadRegions(); }, []);

  const loadAccounts = async () => { try { const res = await accountsAPI.getActive(); setAccounts(res.data); } catch (err) { console.error(err); } };
  const loadBranches = async () => { try { const res = await branchesAPI.getActive(); setBranches(res.data); } catch (err) { console.error(err); } };
  const loadRegions = async () => { try { const res = await regionsAPI.getActive(); setRegions(res.data); } catch (err) { console.error(err); } };

  const tabs = [
    { id: 'trial-balance', label: 'ميزان المراجعة' },
    { id: 'general-ledger', label: 'الأستاذ العام' },
    { id: 'account-statement', label: 'كشف حساب' },
    { id: 'income-statement', label: 'قائمة الدخل' },
    { id: 'balance-sheet', label: 'الميزانية العمومية' },
  ];

  const loadReport = async () => {
    setLoading(true); setData(null);
    try {
      let response;
      switch (activeTab) {
        case 'trial-balance':
          response = await reportsAPI.getTrialBalance({ from_date: fromDate, to_date: toDate, branch_id: branchId, region_id: regionId }); break;
        case 'general-ledger':
          if (!accountId) { toast.error('يرجى اختيار الحساب'); setLoading(false); return; }
          response = await reportsAPI.getGeneralLedger({ account_id: accountId, from_date: fromDate, to_date: toDate }); break;
        case 'account-statement':
          if (!accountId) { toast.error('يرجى اختيار الحساب'); setLoading(false); return; }
          response = await reportsAPI.getAccountStatement({ account_id: accountId, from_date: fromDate, to_date: toDate }); break;
        case 'income-statement':
          response = await reportsAPI.getIncomeStatement({ from_date: fromDate, to_date: toDate }); break;
        case 'balance-sheet':
          response = await reportsAPI.getBalanceSheet({ as_of_date: asOfDate, branch_id: branchId, region_id: regionId }); break;
      }
      setData(response.data);
    } catch (err) { toast.error('خطأ في تحميل التقرير'); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${tabs.find(t => t.id === activeTab)?.label}</title>
      <style>body{font-family:'Tajawal',Arial,sans-serif;padding:20px;direction:rtl;font-size:11px}h1{text-align:center;color:#1e40af;margin-bottom:10px;font-size:16px}h2{color:#374151;margin:20px 0 10px;font-size:14px}.date{text-align:center;color:#6b7280;margin-bottom:20px;font-size:11px}table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10px}th{background:#1e40af;color:white;padding:6px 8px;text-align:right;font-size:10px}td{padding:5px 8px;border-bottom:1px solid #e5e7eb}tr:nth-child(even){background:#f9fafb}.total{font-weight:bold;background:#f3f4f6 !important}.debit{color:#2563eb;font-weight:bold}.credit{color:#dc2626;font-weight:bold}.local{color:#7c3aed;font-size:10px}.footer{margin-top:30px;text-align:center;color:#9ca3af;font-size:10px}@media print{body{padding:0}table{font-size:9px}}</style></head><body>
      <h1>نظام القيود اليومية المحاسبية</h1><h2>${tabs.find(t => t.id === activeTab)?.label}</h2>
      <div class="date">${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
      ${printContent.innerHTML}<div class="footer">نظام القيود اليومية المحاسبية - طباعة تلقائية | لؤي العليمي 774347342</div></body></html>`);
    printWindow.document.close(); printWindow.print();
  };

  const renderTrialBalance = () => {
    if (!data) return null;
    const { accounts, totals, from_date, to_date, region_rates, region_name } = data;
    const hasRegionRates = region_rates && Object.keys(region_rates).length > 0;
    return (
      <div>
        <div className="mb-4 text-sm text-gray-600 flex flex-wrap gap-4">
          <span>من تاريخ: <b>{from_date}</b></span>
          <span>إلى تاريخ: <b>{to_date}</b></span>
          {hasRegionRates && (
            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
              {region_name && <b>{region_name}: </b>}
              {Object.entries(region_rates).map(([code, rate]) => `${code}=${rate}`).join(' | ')}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th rowSpan="2">رقم الحساب</th>
                <th rowSpan="2">اسم الحساب</th>
                <th rowSpan="2">النوع</th>
                <th colSpan="4" className="text-center bg-blue-50">الرصيد الافتتاحي</th>
                <th colSpan="4" className="text-center bg-green-50">حركة الفترة</th>
                <th colSpan="4" className="text-center bg-yellow-50">الرصيد النهائي</th>
              </tr>
              <tr>
                <th className="text-xs bg-blue-100">مدين عملة</th><th className="text-xs bg-blue-100">دائن عملة</th>
                <th className="text-xs bg-purple-50">مدين محلي</th><th className="text-xs bg-purple-50">دائن محلي</th>
                <th className="text-xs bg-green-100">مدين عملة</th><th className="text-xs bg-green-100">دائن عملة</th>
                <th className="text-xs bg-purple-50">مدين محلي</th><th className="text-xs bg-purple-50">دائن محلي</th>
                <th className="text-xs bg-yellow-100">مدين عملة</th><th className="text-xs bg-yellow-100">دائن عملة</th>
                <th className="text-xs bg-purple-50">مدين محلي</th><th className="text-xs bg-purple-50">دائن محلي</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono">{a.code}</td>
                  <td>{a.name}</td>
                  <td>{a.type === 'asset' ? 'أصول' : a.type === 'liability' ? 'خصوم' : a.type === 'revenue' ? 'إيرادات' : a.type === 'expense' ? 'نفقات' : 'حقوق ملكية'}</td>
                  <td className="debit">{a.opening_debit > 0 ? formatCurrency(a.opening_debit) : '-'}</td>
                  <td className="credit">{a.opening_credit > 0 ? formatCurrency(a.opening_credit) : '-'}</td>
                  <td className="text-purple-600">{a.opening_local_debit > 0 ? formatCurrency(a.opening_local_debit) : '-'}</td>
                  <td className="text-purple-600">{a.opening_local_credit > 0 ? formatCurrency(a.opening_local_credit) : '-'}</td>
                  <td className="debit">{a.move_debit > 0 ? formatCurrency(a.move_debit) : '-'}</td>
                  <td className="credit">{a.move_credit > 0 ? formatCurrency(a.move_credit) : '-'}</td>
                  <td className="text-purple-600">{a.move_local_debit > 0 ? formatCurrency(a.move_local_debit) : '-'}</td>
                  <td className="text-purple-600">{a.move_local_credit > 0 ? formatCurrency(a.move_local_credit) : '-'}</td>
                  <td className="debit">{a.closing_debit > 0 ? formatCurrency(a.closing_debit) : '-'}</td>
                  <td className="credit">{a.closing_credit > 0 ? formatCurrency(a.closing_credit) : '-'}</td>
                  <td className="text-purple-600">{a.closing_local_debit > 0 ? formatCurrency(a.closing_local_debit) : '-'}</td>
                  <td className="text-purple-600">{a.closing_local_credit > 0 ? formatCurrency(a.closing_local_credit) : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td colSpan="3" className="text-right font-bold">المجموع</td>
                <td className="debit font-bold">{formatCurrency(totals.opening_debit)}</td>
                <td className="credit font-bold">{formatCurrency(totals.opening_credit)}</td>
                <td className="text-purple-600 font-bold">{formatCurrency(totals.opening_local_debit)}</td>
                <td className="text-purple-600 font-bold">{formatCurrency(totals.opening_local_credit)}</td>
                <td className="debit font-bold">{formatCurrency(totals.move_debit)}</td>
                <td className="credit font-bold">{formatCurrency(totals.move_credit)}</td>
                <td className="text-purple-600 font-bold">{formatCurrency(totals.move_local_debit)}</td>
                <td className="text-purple-600 font-bold">{formatCurrency(totals.move_local_credit)}</td>
                <td className="debit font-bold">{formatCurrency(totals.closing_debit)}</td>
                <td className="credit font-bold">{formatCurrency(totals.closing_credit)}</td>
                <td className="text-purple-600 font-bold">{formatCurrency(totals.closing_local_debit)}</td>
                <td className="text-purple-600 font-bold">{formatCurrency(totals.closing_local_credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderGeneralLedger = () => {
    if (!data) return null;
    return (
      <div>
        <h3 className="text-lg font-bold mb-2">{data.account.code} - {data.account.name}</h3>
        <p className="text-gray-600 mb-4">الرصيد الافتتاحي: {formatCurrency(data.opening_balance)}</p>
        <table className="w-full">
          <thead><tr><th>رقم القيد</th><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
          <tbody>
            {data.movements.map((m, i) => (
              <tr key={i}><td className="font-mono">{m.entry_number}</td><td>{formatDate(m.date)}</td><td>{m.line_description || m.entry_description}</td>
                <td className="debit">{m.debit_amount > 0 ? formatCurrency(m.debit_amount) : '-'}</td>
                <td className="credit">{m.credit_amount > 0 ? formatCurrency(m.credit_amount) : '-'}</td>
                <td className="font-bold">{formatCurrency(m.running_balance)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="total"><td colSpan="3" className="text-right font-bold">الرصيد النهائي</td><td colSpan="2"></td><td className="font-bold">{formatCurrency(data.closing_balance)}</td></tr></tfoot>
        </table>
      </div>
    );
  };

  const renderAccountStatement = () => {
    if (!data) return null;
    return (
      <div>
        <h3 className="text-lg font-bold mb-2">{data.account.code} - {data.account.name}</h3>
        <p className="text-gray-600 mb-4">الرصيد الافتتاحي: {formatCurrency(data.opening_balance)} | العملة: {data.currency_code}</p>
        <table className="w-full">
          <thead><tr><th>رقم القيد</th><th>التاريخ</th><th>البيان</th><th>العملة</th><th>مدين</th><th>دائن</th><th>المقابل المحلي (مدين)</th><th>المقابل المحلي (دائن)</th><th>الرصيد</th></tr></thead>
          <tbody>
            {data.movements.map((m, i) => (
              <tr key={i}><td className="font-mono">{m.entry_number}</td><td>{formatDate(m.date)}</td><td>{m.description}</td><td className="font-mono text-xs">{m.currency_code}</td>
                <td className="debit">{m.debit > 0 ? formatCurrency(m.debit, m.currency_code) : '-'}</td>
                <td className="credit">{m.credit > 0 ? formatCurrency(m.credit, m.currency_code) : '-'}</td>
                <td className="local">{m.local_debit > 0 ? formatCurrency(m.local_debit) : '-'}</td>
                <td className="local">{m.local_credit > 0 ? formatCurrency(m.local_credit) : '-'}</td>
                <td className="font-bold">{formatCurrency(m.balance)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr className="total"><td colSpan="4" className="text-right font-bold">الرصيد النهائي</td><td className="debit font-bold">{formatCurrency(data.total_debit, data.currency_code)}</td>
            <td className="credit font-bold">{formatCurrency(data.total_credit, data.currency_code)}</td><td className="local font-bold">{formatCurrency(data.total_local_debit)}</td><td className="local font-bold">{formatCurrency(data.total_local_credit)}</td><td className="font-bold">{formatCurrency(data.closing_balance)}</td></tr></tfoot>
        </table>
      </div>
    );
  };

  const renderIncomeStatement = () => {
    if (!data) return null;
    return (
      <div>
        <h3 className="text-lg font-bold mb-4">الإيرادات</h3>
        <table className="w-full mb-6"><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المبلغ</th></tr></thead>
          <tbody>{data.revenue.map((r) => <tr key={r.code}><td className="font-mono">{r.code}</td><td>{r.name}</td><td className="debit font-bold">{formatCurrency(r.balance)}</td></tr>)}</tbody>
          <tfoot><tr className="total"><td colSpan="2" className="text-right font-bold">إجمالي الإيرادات</td><td className="debit font-bold">{formatCurrency(data.total_revenue)}</td></tr></tfoot>
        </table>
        <h3 className="text-lg font-bold mb-4">المصروفات</h3>
        <table className="w-full mb-6"><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المبلغ</th></tr></thead>
          <tbody>{data.expenses.map((e) => <tr key={e.code}><td className="font-mono">{e.code}</td><td>{e.name}</td><td className="credit font-bold">{formatCurrency(e.balance)}</td></tr>)}</tbody>
          <tfoot><tr className="total"><td colSpan="2" className="text-right font-bold">إجمالي المصروفات</td><td className="credit font-bold">{formatCurrency(data.total_expenses)}</td></tr></tfoot>
        </table>
        <div className="p-4 bg-gray-100 rounded-lg"><div className="flex justify-between items-center"><span className="text-lg font-bold">صافي الربح/الخسارة</span><span className={`text-2xl font-bold ${data.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(data.net_income)}</span></div></div>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    if (!data) return null;
    const { region_rates, region_name } = data;
    const hasRegionRates = region_rates && Object.keys(region_rates).length > 0;
    return (
      <div>
        {hasRegionRates && (
          <div className="mb-4 text-sm">
            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
              {region_name && <b>{region_name}: </b>}
              {Object.entries(region_rates).map(([code, rate]) => `${code}=${rate}`).join(' | ')}
            </span>
          </div>
        )}
        <h3 className="text-lg font-bold mb-4">الأصول</h3>
        <table className="w-full mb-6"><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المدين (محلي)</th><th>الدائن (محلي)</th><th>الرصيد (محلي)</th></tr></thead>
          <tbody>{data.assets.map((a) => <tr key={a.code}><td className="font-mono">{a.code}</td><td>{a.name}</td>
            <td className="debit">{a.total_debit > 0 ? formatCurrency(a.total_debit) : '-'}</td>
            <td className="credit">{a.total_credit > 0 ? formatCurrency(a.total_credit) : '-'}</td>
            <td className="debit font-bold">{formatCurrency(a.balance)}</td></tr>)}</tbody>
          <tfoot><tr className="total"><td colSpan="2" className="text-right font-bold">إجمالي الأصول</td>
            <td colSpan="2"></td><td className="debit font-bold">{formatCurrency(data.total_assets)}</td></tr></tfoot>
        </table>
        <h3 className="text-lg font-bold mb-4">الخصوم</h3>
        <table className="w-full mb-6"><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المدين (محلي)</th><th>الدائن (محلي)</th><th>الرصيد (محلي)</th></tr></thead>
          <tbody>{data.liabilities.map((l) => <tr key={l.code}><td className="font-mono">{l.code}</td><td>{l.name}</td>
            <td className="debit">{l.total_debit > 0 ? formatCurrency(l.total_debit) : '-'}</td>
            <td className="credit">{l.total_credit > 0 ? formatCurrency(l.total_credit) : '-'}</td>
            <td className="credit font-bold">{formatCurrency(l.balance)}</td></tr>)}</tbody>
          <tfoot><tr className="total"><td colSpan="2" className="text-right font-bold">إجمالي الخصوم</td>
            <td colSpan="2"></td><td className="credit font-bold">{formatCurrency(data.total_liabilities)}</td></tr></tfoot>
        </table>
        <h3 className="text-lg font-bold mb-4">حقوق الملكية</h3>
        <table className="w-full mb-6"><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المدين (محلي)</th><th>الدائن (محلي)</th><th>الرصيد (محلي)</th></tr></thead>
          <tbody>{data.equity.map((e) => <tr key={e.code}><td className="font-mono">{e.code}</td><td>{e.name}</td>
            <td className="debit">{e.total_debit > 0 ? formatCurrency(e.total_debit) : '-'}</td>
            <td className="credit">{e.total_credit > 0 ? formatCurrency(e.total_credit) : '-'}</td>
            <td className="credit font-bold">{formatCurrency(e.balance)}</td></tr>)}
            <tr><td colSpan="2" className="text-right font-bold">صافي الربح</td><td colSpan="2"></td>
            <td className={`font-bold ${data.net_income >= 0 ? 'debit' : 'credit'}`}>{formatCurrency(data.net_income)}</td></tr></tbody>
          <tfoot><tr className="total"><td colSpan="2" className="text-right font-bold">إجمالي حقوق الملكية + صافي الربح</td>
            <td colSpan="2"></td><td className="credit font-bold">{formatCurrency(data.total_equity)}</td></tr></tfoot>
        </table>
        <div className="p-4 bg-gray-100 rounded-lg"><div className="flex justify-between items-center"><span className="text-lg font-bold">الميزان</span>
          <span className={`text-xl font-bold ${Math.abs(data.total_assets - data.total_equity) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>{Math.abs(data.total_assets - data.total_equity) < 0.01 ? 'متوازن ✓' : 'غير متوازن ✗'}</span></div></div>
      </div>
    );
  };

  const showAccountFilter = activeTab === 'general-ledger' || activeTab === 'account-statement';
  const showDateRange = activeTab === 'general-ledger' || activeTab === 'account-statement' || activeTab === 'income-statement' || activeTab === 'trial-balance';
  const showAsOf = activeTab === 'balance-sheet';
  const showBranchFilter = activeTab === 'trial-balance' || activeTab === 'balance-sheet';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">التقارير</h2>
        {data && <button onClick={handlePrint} className="btn-primary"><FiPrinter size={18} /> طباعة</button>}
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2 flex-wrap">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setData(null); }} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.id ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{tab.label}</button>
        ))}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {showDateRange && (<>
            <div className="min-w-[150px]"><label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input-field" /></div>
            <div className="min-w-[150px]"><label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input-field" /></div>
          </>)}
          {showAsOf && <div className="min-w-[150px]"><label className="block text-sm font-medium text-gray-700 mb-1">بتاريخ</label><input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="input-field" /></div>}
          {showAccountFilter && (
            <div className="min-w-[250px]"><label className="block text-sm font-medium text-gray-700 mb-1">الحساب *</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input-field">
                <option value="">اختر الحساب</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
          )}
          {showBranchFilter && (
            <>
              <div className="min-w-[200px]"><label className="block text-sm font-medium text-gray-700 mb-1">الفرع المنفذ (فلتر)</label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input-field">
                  <option value="">الكل (بدون فلتر)</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.code ? b.code + ' - ' : ''}{b.name}</option>)}
                </select>
              </div>
              <div className="min-w-[200px]"><label className="block text-sm font-medium text-gray-700 mb-1">المنطقة (تسعير أسعار الصرف)</label>
                <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="input-field">
                  <option value="">بدون أسعار صرف</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </>
          )}
          <button onClick={loadReport} disabled={loading} className="btn-primary">
            {loading ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> جاري التحميل...</span> : <><FiFilter size={18} /> عرض التقرير</>}
          </button>
        </div>
      </div>

      {data && (
        <div className="card" ref={printRef}>
          {activeTab === 'trial-balance' && renderTrialBalance()}
          {activeTab === 'general-ledger' && renderGeneralLedger()}
          {activeTab === 'account-statement' && renderAccountStatement()}
          {activeTab === 'income-statement' && renderIncomeStatement()}
          {activeTab === 'balance-sheet' && renderBalanceSheet()}
        </div>
      )}
    </div>
  );
}
