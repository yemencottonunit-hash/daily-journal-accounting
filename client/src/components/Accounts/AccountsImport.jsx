import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountsAPI } from '../../services/api';
import { accountTypes } from '../../utils/helpers';
import { FiUpload, FiDownload, FiArrowRight, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function AccountsImport() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: upload, 2: map, 3: preview

  // Column mapping
  const [mapping, setMapping] = useState({
    code: '',
    name: '',
    type: '',
    parent_code: '',
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const wb = XLSX.read(event.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (jsonData.length < 2) {
          toast.error('الملف فارغ أو لا يحتوي على بيانات');
          return;
        }

        setHeaders(jsonData[0]);
        setData(jsonData.slice(1).filter(row => row.some(cell => cell)));
        setStep(2);
        toast.success(`تم قراءة ${jsonData.length - 1} صف`);
      } catch (err) {
        toast.error('خطأ في قراءة الملف');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!mapping.code || !mapping.name || !mapping.type) {
      toast.error('يرجى ربط الأعمدة المطلوبة (رقم الحساب، الاسم، النوع)');
      return;
    }

    setLoading(true);
    try {
      const accounts = data.map((row) => {
        const codeIdx = headers.indexOf(mapping.code);
        const nameIdx = headers.indexOf(mapping.name);
        const typeIdx = headers.indexOf(mapping.type);
        const parentIdx = mapping.parent_code ? headers.indexOf(mapping.parent_code) : -1;

        return {
          code: String(row[codeIdx] || ''),
          name: String(row[nameIdx] || ''),
          type: String(row[typeIdx] || 'asset').toLowerCase(),
          parent_code: parentIdx >= 0 ? String(row[parentIdx] || '') : null,
        };
      }).filter(a => a.code && a.name);

      // Build parent mapping
      const codeToId = {};
      const validAccounts = [];

      for (const account of accounts) {
        if (!['asset', 'liability', 'revenue', 'expense', 'equity'].includes(account.type)) {
          account.type = 'asset';
        }
        validAccounts.push(account);
      }

      await accountsAPI.import({ accounts: validAccounts });
      toast.success(`تم استيراد ${validAccounts.length} حساب بنجاح`);
      navigate('/accounts');
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ في الاستيراد');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['رقم الحساب', 'اسم الحساب', 'نوع الحساب', 'رقم الحساب الرئيسي'],
      ['1', 'الأصول', 'asset', ''],
      ['1001', 'الصندوق', 'asset', '1'],
      ['1002', 'البنوك', 'asset', '1'],
      ['2', 'الخصوم', 'liability', ''],
      ['2001', 'الحسابات المدينة', 'liability', '2'],
      ['3', 'حقوق الملكية', 'equity', ''],
      ['3001', 'رأس المال', 'equity', '3'],
      ['4', 'الإيرادات', 'revenue', ''],
      ['4001', 'إيرادات المبيعات', 'revenue', '4'],
      ['5', 'المصروفات', 'expense', ''],
      ['5001', 'مصاريف إدارية', 'expense', '5'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الحسابات');
    XLSX.writeFile(wb, 'نموذج_دليل_الحسابات.xlsx');
    toast.success('تم تحميل النموذج');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/accounts')} className="btn-secondary">
            <FiArrowRight size={20} />
            العودة
          </button>
          <h2 className="text-2xl font-bold text-gray-800">استيراد دليل الحسابات</h2>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary">
          <FiDownload size={18} />
          تحميل نموذج
        </button>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= s ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {step > s ? <FiCheck size={16} /> : s}
            </div>
            <span className={step >= s ? 'text-primary-600 font-medium' : 'text-gray-500'}>
              {s === 1 ? 'رفع الملف' : s === 2 ? 'ربط الأعمدة' : 'المعاينة والاستيراد'}
            </span>
            {s < 3 && <div className="w-12 h-0.5 bg-gray-200 mx-2"></div>}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card max-w-2xl mx-auto">
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-500 transition-colors">
            <FiUpload className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-600 mb-4">اسحب الملف هنا أو اضغط لاختيار ملف</p>
            <p className="text-sm text-gray-500 mb-4">الملفات المدعومة: XLSX, XLS, CSV</p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept=".xlsx,.xls,.csv"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              className="btn-primary"
            >
              <FiUpload size={18} />
              اختيار ملف
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Map Columns */}
      {step === 2 && (
        <div className="card max-w-2xl mx-auto">
          <h3 className="text-lg font-bold mb-4">ربط الأعمدة</h3>
          <p className="text-gray-600 mb-6">اختر العمود الذي يمثل كل حقل مطلوب</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم الحساب *</label>
              <select
                value={mapping.code}
                onChange={(e) => setMapping({ ...mapping, code: e.target.value })}
                className="input-field"
              >
                <option value="">اختر العمود</option>
                {headers.map((h, i) => (
                  <option key={i} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم الحساب *</label>
              <select
                value={mapping.name}
                onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                className="input-field"
              >
                <option value="">اختر العمود</option>
                {headers.map((h, i) => (
                  <option key={i} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع الحساب *</label>
              <select
                value={mapping.type}
                onChange={(e) => setMapping({ ...mapping, type: e.target.value })}
                className="input-field"
              >
                <option value="">اختر العمود</option>
                {headers.map((h, i) => (
                  <option key={i} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الحساب الرئيسي</label>
              <select
                value={mapping.parent_code}
                onChange={(e) => setMapping({ ...mapping, parent_code: e.target.value })}
                className="input-field"
              >
                <option value="">بدون</option>
                {headers.map((h, i) => (
                  <option key={i} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-50">
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 border text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 border">{cell || ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 5 && (
              <p className="text-sm text-gray-500 mt-2">...و {data.length - 5} صف إضافي</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary">
              رفع ملف آخر
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!mapping.code || !mapping.name || !mapping.type}
              className="btn-primary"
            >
              المعاينة والاستيراد
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Import */}
      {step === 3 && (
        <div className="card max-w-4xl mx-auto">
          <h3 className="text-lg font-bold mb-4">المعاينة النهائية</h3>
          <p className="text-gray-600 mb-4">
            سيتم استيراد <strong>{data.length}</strong> حساب
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 border text-right">رقم الحساب</th>
                  <th className="px-3 py-2 border text-right">اسم الحساب</th>
                  <th className="px-3 py-2 border text-right">النوع</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 10).map((row, i) => {
                  const codeIdx = headers.indexOf(mapping.code);
                  const nameIdx = headers.indexOf(mapping.name);
                  const typeIdx = headers.indexOf(mapping.type);
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2 border font-mono">{row[codeIdx]}</td>
                      <td className="px-3 py-2 border">{row[nameIdx]}</td>
                      <td className="px-3 py-2 border">{row[typeIdx]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">...و {data.length - 10} حساب إضافي</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary">
              العودة
            </button>
            <button onClick={handleImport} disabled={loading} className="btn-success">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  جاري الاستيراد...
                </span>
              ) : (
                <>
                  <FiCheck size={18} />
                  تأكيد الاستيراد
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
