import { useState, useEffect } from 'react';
import { FiWifi, FiServer, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ServerConnect({ onConnected }) {
  const [serverUrl, setServerUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [savedUrl, setSavedUrl] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('server_url');
    if (saved) {
      setSavedUrl(saved);
      setServerUrl(saved);
      testConnection(saved);
    }
  }, []);

  const testConnection = async (url) => {
    setTesting(true);
    try {
      const response = await fetch(`${url}/api/settings/company`, {
        method: 'GET',
        timeout: 5000
      });
      if (response.ok) {
        setConnected(true);
        localStorage.setItem('server_url', url);
        toast.success('تم الاتصال بالسيرفر بنجاح');
        if (onConnected) onConnected(url);
      } else {
        setConnected(false);
      }
    } catch (error) {
      setConnected(false);
      console.error('Connection error:', error);
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = () => {
    let url = serverUrl.trim();
    if (!url) {
      toast.error('أدخل رابط السيرفر');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://${url}`;
    }
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    testConnection(url);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('server_url');
    setSavedUrl('');
    setConnected(false);
    setServerUrl('');
    toast.success('تم قطع الاتصال');
  };

  const quickConnect = (ip) => {
    setServerUrl(`http://${ip}:4357`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiServer size={40} className="text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">ربط السيرفر</h1>
            <p className="text-gray-500 mt-2">أدخل رابط السيرفر للاتصال بالشبكة</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">رابط السيرفر</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="مثال: http://192.168.1.100:4357"
                className="input-field w-full text-center text-lg"
                dir="ltr"
                disabled={connected}
              />
            </div>

            {connected ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <FiCheck size={24} className="text-green-600 mx-auto mb-2" />
                <p className="text-green-700 font-medium">متصل بالسيرفر</p>
                <p className="text-green-600 text-sm mt-1">{savedUrl}</p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiAlertTriangle size={16} className="text-yellow-600" />
                  <p className="text-yellow-700 font-medium text-sm">روابط سريعة</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => quickConnect('192.168.43.147')} className="text-xs bg-white border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">
                    192.168.43.147
                  </button>
                  <button onClick={() => quickConnect('localhost')} className="text-xs bg-white border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">
                    localhost
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {connected ? (
                <button onClick={handleDisconnect} className="flex-1 btn-secondary justify-center">
                  قطع الاتصال
                </button>
              ) : (
                <button onClick={handleConnect} disabled={testing || !serverUrl} className="flex-1 btn-primary justify-center">
                  {testing ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      جاري الفحص...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <FiWifi size={18} /> اتصال
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
            <p>تأكد أن السيرفر يعمل على نفس الشبكة</p>
          </div>
        </div>
      </div>
    </div>
  );
}
