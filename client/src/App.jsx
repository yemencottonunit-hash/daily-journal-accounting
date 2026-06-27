import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { updateApiBase } from './services/api';
import { initLocalDB, isLocalMode } from './services/localDB';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import ServerConnect from './components/Auth/ServerConnect';
import Dashboard from './components/Dashboard';
import JournalList from './components/Journal/JournalList';
import JournalForm from './components/Journal/JournalForm';
import AccountsList from './components/Accounts/AccountsList';
import AccountsImport from './components/Accounts/AccountsImport';
import CurrenciesList from './components/Currencies/CurrenciesList';
import BranchesList from './components/Branches/BranchesList';
import RegionsList from './components/Regions/RegionsList';
import DocumentTypesList from './components/DocumentTypes/DocumentTypesList';
import DocumentsList from './components/Documents/DocumentsList';
import DocumentForm from './components/Documents/DocumentForm';
import ExecutedEntries from './components/Journal/ExecutedEntries';
import ArchiveList from './components/Archive/ArchiveList';
import ReportsPage from './components/Reports/ReportsPage';
import UsersList from './components/Users/UsersList';
import PasswordResetRequests from './components/Users/PasswordResetRequests';
import PermissionsManager from './components/Users/PermissionsManager';
import SignatureManager from './components/Users/SignatureManager';
import CompanySettings from './components/Settings/CompanySettings';

function isNativeApp() {
  return window.location.protocol === 'capacitor:' || 
         window.location.hostname === 'localhost' && window.location.pathname.startsWith('/index.html');
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;
  return user?.role === 'admin' ? children : <Navigate to="/" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/connect" element={<ServerConnect onConnected={(url) => { updateApiBase(url); window.location.href = '/login'; }} />} />
      <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
      <Route path="/journal" element={<PrivateRoute><Layout><JournalList /></Layout></PrivateRoute>} />
      <Route path="/journal/new" element={<PrivateRoute><Layout><JournalForm /></Layout></PrivateRoute>} />
      <Route path="/journal/edit/:id" element={<PrivateRoute><Layout><JournalForm /></Layout></PrivateRoute>} />
      <Route path="/journal/executed" element={<PrivateRoute><Layout><ExecutedEntries /></Layout></PrivateRoute>} />
      <Route path="/accounts" element={<PrivateRoute><Layout><AccountsList /></Layout></PrivateRoute>} />
      <Route path="/accounts/import" element={<PrivateRoute><Layout><AccountsImport /></Layout></PrivateRoute>} />
      <Route path="/currencies" element={<PrivateRoute><Layout><CurrenciesList /></Layout></PrivateRoute>} />
      <Route path="/branches" element={<PrivateRoute><Layout><BranchesList /></Layout></PrivateRoute>} />
      <Route path="/regions" element={<PrivateRoute><Layout><RegionsList /></Layout></PrivateRoute>} />
      <Route path="/document-types" element={<PrivateRoute><Layout><DocumentTypesList /></Layout></PrivateRoute>} />
      <Route path="/documents" element={<PrivateRoute><Layout><DocumentsList /></Layout></PrivateRoute>} />
      <Route path="/documents/new" element={<PrivateRoute><Layout><DocumentForm /></Layout></PrivateRoute>} />
      <Route path="/documents/:id" element={<PrivateRoute><Layout><DocumentForm /></Layout></PrivateRoute>} />
      <Route path="/archive" element={<PrivateRoute><Layout><ArchiveList /></Layout></PrivateRoute>} />
      <Route path="/reports" element={<PrivateRoute><Layout><ReportsPage /></Layout></PrivateRoute>} />
      <Route path="/users" element={<AdminRoute><Layout><UsersList /></Layout></AdminRoute>} />
      <Route path="/users/permissions" element={<AdminRoute><Layout><PermissionsManager /></Layout></AdminRoute>} />
      <Route path="/users/signatures" element={<AdminRoute><Layout><SignatureManager /></Layout></AdminRoute>} />
      <Route path="/users/requests" element={<AdminRoute><Layout><PasswordResetRequests /></Layout></AdminRoute>} />
      <Route path="/settings/company" element={<AdminRoute><Layout><CompanySettings /></Layout></AdminRoute>} />
    </Routes>
  );
}

function App() {
  const [serverConfigured, setServerConfigured] = useState(true);
  const [initComplete, setInitComplete] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const isNative = await Capacitor.isNativePlatform();
        if (isNative) {
          const dbReady = await initLocalDB();
          if (dbReady) {
            console.log('Running in local mode - Phone is the server');
            setServerConfigured(true);
          } else {
            const saved = localStorage.getItem('server_url');
            setServerConfigured(!!saved);
          }
        }
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setInitComplete(true);
      }
    }
    init();
  }, []);

  if (!initComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!serverConfigured && !isLocalMode()) {
    return (
      <Router>
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#1f2937', color: '#fff', direction: 'rtl' } }} />
        <ServerConnect onConnected={(url) => { updateApiBase(url); setServerConfigured(true); }} />
      </Router>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#1f2937', color: '#fff', direction: 'rtl' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }} />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
