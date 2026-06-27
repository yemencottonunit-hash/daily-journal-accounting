import { useState, useEffect } from 'react';
import { journalAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { FiEye, FiDownload, FiTrash2, FiSearch, FiArchive } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { archiveAPI } from '../../services/api';

export default function ArchiveList() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    loadEntries();
  }, [page]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;

      const response = await journalAPI.getAll(params);
      // Filter entries with attachments
      const entriesWithAttachments = response.data.entries.filter(e => e.attachment_path);
      setEntries(entriesWithAttachments);
      setPagination(response.data.pagination);
    } catch (err) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadEntries();
  };

  const viewFile = async (entryId) => {
    try {
      const response = await archiveAPI.getFile(entryId);
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank');
    } catch (err) {
      toast.error('خطأ في عرض الملف');
    }
  };

  const downloadFile = async (entryId, entryNumber) => {
    try {
      const response = await archiveAPI.getFile(entryId);
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = ` مستند_${entryNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('خطأ في تحميل الملف');
    }
  };

  const deleteAttachment = async (entryId, entryNumber) => {
    if (!confirm(`هل أنت متأكد من حذف المستند المرفق بالقيد ${entryNumber}؟`)) return;
    try {
      await archiveAPI.delete(entryId);
      toast.success('تم حذف المستند بنجاح');
      loadEntries();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ في الحذف');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">الأرشفة</h2>
        <p className="text-gray-500 mt-1">المستندات المرفقة بالقيود اليومية</p>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">بحث</label>
            <div className="relative">
              <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pr-10"
                placeholder="رقم القيد أو البيان..."
              />
            </div>
          </div>
          <button type="submit" className="btn-primary">
            <FiSearch size={18} />
            بحث
          </button>
        </form>
      </div>

      {/* List */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiArchive className="mx-auto mb-4" size={48} />
            <p>لا توجد مستندات مؤرشفة</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <FiArchive className="text-primary-600" size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{entry.entry_number}</h4>
                    <p className="text-sm text-gray-500">{formatDate(entry.date)}</p>
                    <p className="text-sm text-gray-600">{entry.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => viewFile(entry.id)}
                    className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                    title="عرض المستند"
                  >
                    <FiEye size={18} />
                  </button>
                  <button
                    onClick={() => downloadFile(entry.id, entry.entry_number)}
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                    title="تحميل"
                  >
                    <FiDownload size={18} />
                  </button>
                  <button
                    onClick={() => deleteAttachment(entry.id, entry.entry_number)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="حذف"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
