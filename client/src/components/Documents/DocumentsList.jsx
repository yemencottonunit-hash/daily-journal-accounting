import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { documentsAPI, branchesAPI, documentTypesAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency, formatDate, getToday } from '../../utils/helpers';
import { printDocument, printDocumentsList } from '../../utils/printUtils';
import { FiPlus, FiEye, FiTrash2, FiSearch, FiFilter, FiFileText, FiPrinter } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function DocumentsList() {
  const { canEdit } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [branches, setBranches] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [docTypeId, setDocTypeId] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { loadBranches(); loadDocTypes(); }, []);

  useEffect(() => {
    if (todayOnly) {
      setFromDate(getToday());
      setToDate(getToday());
    } else {
      setFromDate('');
      setToDate('');
    }
  }, [todayOnly]);

  useEffect(() => { loadDocuments(); }, [page, fromDate, toDate, branchId, docTypeId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (branchId) params.branch_id = branchId;
      if (docTypeId) params.doc_type_id = docTypeId;
      const res = await documentsAPI.getAll(params);
      setDocuments(res.data.documents);
      setPagination(res.data.pagination);
    } catch (err) { toast.error('خطأ في تحميل المستندات'); }
    finally { setLoading(false); }
  };

  const loadBranches = async () => {
    try { const res = await branchesAPI.getActive(); setBranches(res.data); } catch (err) { console.error(err); }
  };

  const loadDocTypes = async () => {
    try { const res = await documentTypesAPI.getActive(); setDocumentTypes(res.data); } catch (err) { console.error(err); }
  };

  const handleDelete = async (id, number) => {
    if (!confirm(`هل أنت متأكد من حذف المستند ${number}؟`)) return;
    try { await documentsAPI.delete(id); toast.success('تم الحذف بنجاح'); loadDocuments(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطأ في الحذف'); }
  };

  const handlePrint = async (docId) => {
    try {
      const res = await documentsAPI.getById(docId);
      await printDocument(res.data);
    } catch (err) { toast.error('خطأ في تحميل المستند للطباعة'); }
  };

  const handlePrintAll = async () => {
    if (documents.length === 0) { toast.error('لا توجد مستندات للطباعة'); return; }
    await printDocumentsList(documents);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">القيد الفردي المتعدد (FT)</h2>
        <div className="flex items-center gap-3">
          <button onClick={handlePrintAll} className="btn-secondary" title="طباعة الكل">
            <FiPrinter size={18} /> طباعة الكل
          </button>
          {canEdit && (
            <Link to="/documents/new" className="btn-primary">
              <FiPlus size={20} /> مستند جديد
            </Link>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadDocuments(); }} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">بحث</label>
            <div className="relative">
              <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pr-10" placeholder="رقم المستند أو البيان..." />
            </div>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
            <input type="date" value={fromDate} onChange={(e) => { setTodayOnly(false); setFromDate(e.target.value); }} className="input-field" disabled={todayOnly} />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
            <input type="date" value={toDate} onChange={(e) => { setTodayOnly(false); setToDate(e.target.value); }} className="input-field" disabled={todayOnly} />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">الفرع</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input-field">
              <option value="">الكل</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.code ? b.code + ' - ' : ''}{b.name}</option>)}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">نوع المستند</label>
            <select value={docTypeId} onChange={(e) => setDocTypeId(e.target.value)} className="input-field">
              <option value="">الكل</option>
              {documentTypes.map((dt) => <option key={dt.id} value={dt.id}>{dt.prefix || dt.code} - {dt.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none pb-1">
            <input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
            <span className="text-sm font-medium text-gray-700">عمليات اليوم فقط</span>
          </label>
          <button type="submit" className="btn-primary"><FiFilter size={18} /> بحث</button>
        </form>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiFileText className="mx-auto mb-4" size={48} />
            <p>لا توجد مستندات</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>رقم المستند</th>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>البيان</th>
                  <th>الفرع</th>
                  <th>عدد القيود</th>
                  <th>مدين (محلي)</th>
                  <th>دائن (محلي)</th>
                  <th>المنفذ</th>
                  <th>المعدّل</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-mono font-bold text-primary-600">{doc.doc_number}</td>
                    <td>{formatDate(doc.date)}</td>
                    <td>{doc.type_name || '-'}</td>
                    <td className="max-w-[200px] truncate">{doc.description}</td>
                    <td>{doc.branch_code ? doc.branch_code + ' - ' : ''}{doc.branch_name || '-'}</td>
                    <td className="text-center">{doc.entries_count || 0}</td>
                    <td className="font-bold text-blue-700">{formatCurrency(doc.total_local_debit)}</td>
                    <td className="font-bold text-red-700">{formatCurrency(doc.total_local_credit)}</td>
                    <td className="text-xs">{doc.created_by_name || '-'}</td>
                    <td className="text-xs">{doc.updated_by_name || '-'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handlePrint(doc.id)} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg" title="طباعة"><FiPrinter size={16} /></button>
                        {canEdit && <Link to={`/documents/${doc.id}`} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><FiEye size={16} /></Link>}
                        {canEdit && <button onClick={() => handleDelete(doc.id, doc.doc_number)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-top border-gray-200">
            <span className="text-sm text-gray-500">إجمالي: {pagination.total} مستند | صفحة {pagination.page} من {pagination.totalPages}</span>
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
