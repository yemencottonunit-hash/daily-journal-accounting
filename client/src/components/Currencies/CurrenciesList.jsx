import { useState, useEffect } from 'react';
import { currenciesAPI, regionsAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { FiEdit2, FiSave, FiGlobe } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function CurrenciesList() {
  const { canEdit } = useAuth();
  const [currencies, setCurrencies] = useState([]);
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [regionRates, setRegionRates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCurrencies(); loadRegions(); }, []);

  const loadCurrencies = async () => {
    try { const res = await currenciesAPI.getAll(); setCurrencies(res.data); }
    catch (err) { toast.error('خطأ في تحميل العملات'); }
    finally { setLoading(false); }
  };

  const loadRegions = async () => {
    try { const res = await regionsAPI.getAll(); setRegions(res.data); }
    catch (err) { console.error(err); }
  };

  const loadRegionRates = async (regionId) => {
    setSelectedRegion(regionId);
    if (!regionId) { setRegionRates({}); return; }
    try {
      const res = await currenciesAPI.getRegionRates(regionId);
      const rates = {};
      res.data.forEach((r) => { rates[r.currency_code] = r.exchange_rate; });
      setRegionRates(rates);
    } catch (err) { toast.error('خطأ في تحميل أسعار الصرف'); }
  };

  const handleRateChange = (code, value) => {
    setRegionRates({ ...regionRates, [code]: parseFloat(value) || 0 });
  };

  const saveRegionRates = async () => {
    if (!selectedRegion) { toast.error('يرجى اختيار منطقة'); return; }
    try {
      const rates = Object.entries(regionRates).map(([currency_code, exchange_rate]) => ({ currency_code, exchange_rate }));
      await currenciesAPI.updateRegionRates(selectedRegion, rates);
      toast.success('تم حفظ أسعار الصرف بنجاح');
    } catch (err) { toast.error('خطأ في الحفظ'); }
  };

  const currencySymbols = { YER: '﷼', USD: '$', SAR: '﷼', AED: 'د.إ', EUR: '€' };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">العملات وأسعار الصرف</h2>
        <p className="text-gray-500 mt-1">أسعار الصرف تُحدد لكل منطقة جغرافية على حدة</p>
      </div>

      {/* currencies table */}
      <div className="card mb-6">
        <h3 className="text-lg font-bold text-gray-700 mb-4">العملات المتاحة</h3>
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>العملة</th>
                  <th>الكود</th>
                  <th>الرمز</th>
                  <th>عملة أساسية</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td className="font-mono text-primary-600 font-bold">{c.code}</td>
                    <td className="text-2xl">{currencySymbols[c.code] || c.symbol}</td>
                    <td>{c.is_base ? <span className="badge badge-success">أساسية</span> : <span className="badge bg-gray-100 text-gray-600">فرعية</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* region rates */}
      <div className="card">
        <h3 className="text-lg font-bold text-gray-700 mb-4">أسعار الصرف حسب المنطقة</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">اختر المنطقة</label>
            <select value={selectedRegion} onChange={(e) => loadRegionRates(e.target.value)} className="input-field">
              <option value="">اختر منطقة...</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>

        {selectedRegion && (
          <div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>العملة</th>
                    <th>الكود</th>
                    <th>سعر الصرف (مقابل العملة الأساسية)</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="font-mono text-primary-600">{c.code}</td>
                      <td>
                        {canEdit ? (
                          <input type="number" value={regionRates[c.code] || ''} onChange={(e) => handleRateChange(c.code, e.target.value)} className="input-field-sm w-32" step="0.0001" min="0" placeholder={c.is_base ? '1' : '0'} />
                        ) : (
                          <span className="font-mono">{regionRates[c.code] || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <button onClick={saveRegionRates} className="btn-primary mt-4"><FiSave size={18} /> حفظ الأسعار</button>
            )}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-bold text-blue-800 mb-2">ملاحظات</h4>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• سعر الصرف يُستخدم لتحويل المبالغ إلى المقابل المحلي</li>
            <li>• سعر العملة الأساسية دائماً = 1</li>
            <li>• كل منطقة لها أسعار صرف مستقلة</li>
            <li>• عند اختيار الفرع في القيد، تُملأ أسعار الصرف تلقائياً حسب المنطقة</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
