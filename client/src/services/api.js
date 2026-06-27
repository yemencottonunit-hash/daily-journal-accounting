import axios from 'axios';
import { isLocalMode, localQuery, localRun } from './localDB';
import * as localAPI from './localAPI';

const getBaseUrl = () => {
  const saved = localStorage.getItem('server_url');
  if (saved) return saved;
  return '/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export const updateApiBase = (baseUrl) => {
  api.defaults.baseURL = baseUrl;
};

function wrapLocal(localFn) {
  return async (...args) => {
    try {
      const data = await localFn(...args);
      return { data };
    } catch (error) {
      throw { response: { data: { error: error.message } } };
    }
  };
}

export const authAPI = isLocalMode() ? {
  login: wrapLocal(async (data) => { const r = await localAPI.localAuth.login(data.username, data.password); localStorage.setItem('token', r.token); localStorage.setItem('user', JSON.stringify(r.user)); return r; }),
  me: wrapLocal((token) => localAPI.localAuth.me(token)),
  getUsers: wrapLocal(() => localAPI.localAuth.getUsers()),
  createUser: wrapLocal((data) => localAPI.localAuth.createUser(data)),
  updateUser: (id, data) => wrapLocal((d) => localAPI.localAuth.updateUser(id, d))(data),
  deleteUser: (id) => wrapLocal(() => localAPI.localAuth.deleteUser(id))(),
  changePassword: wrapLocal(async (data) => { await new Promise(r => setTimeout(r, 10)); return { message: 'تم تغيير كلمة المرور' }; }),
  resetUserPassword: (id, pw) => wrapLocal(async () => { await localAPI.localAuth.updateUser(id, { password: pw }); return { message: 'تمت إعادة التعيين' }; })(),
  uploadAvatar: wrapLocal(async () => ({ avatar: '' })),
  getPasswordResetRequests: wrapLocal(async () => []),
  resolvePasswordReset: wrapLocal(async () => ({ message: 'تم' })),
} : {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/users', data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  changePassword: (data) => api.post('/auth/change-password', data),
  resetUserPassword: (id, newPassword) => api.put(`/auth/users/${id}/reset-password`, { newPassword }),
  uploadAvatar: (id, formData) => api.put(`/auth/users/${id}/avatar`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getPasswordResetRequests: () => api.get('/auth/password-reset-requests'),
  resolvePasswordReset: (id, status, new_password) => api.put(`/auth/password-reset-requests/${id}`, { status, new_password }),
};

export const accountsAPI = isLocalMode() ? {
  getAll: wrapLocal(() => localAPI.localAccounts.getAll()),
  getActive: wrapLocal(() => localAPI.localAccounts.getActive()),
  getById: wrapLocal(async (id) => { const all = await localAPI.localAccounts.getAll(); return all.find(a => a.id === id); }),
  create: wrapLocal((data) => localAPI.localAccounts.create(data)),
  update: (id, data) => wrapLocal((d) => localAPI.localAccounts.update(id, d))(data),
  delete: (id) => wrapLocal(() => localAPI.localAccounts.delete(id))(),
  import: wrapLocal(async (data) => { for (const a of data.accounts || []) { await localAPI.localAccounts.create(a); } return { message: 'تم الاستيراد' }; }),
} : {
  getAll: () => api.get('/accounts'),
  getActive: () => api.get('/accounts/active'),
  getById: (id) => api.get(`/accounts/${id}`),
  create: (data) => api.post('/accounts', data),
  update: (id, data) => api.put(`/accounts/${id}`, data),
  delete: (id) => api.delete(`/accounts/${id}`),
  import: (data) => api.post('/accounts/import', data),
};

export const currenciesAPI = isLocalMode() ? {
  getAll: wrapLocal(() => localAPI.localCurrencies.getAll()),
  update: (id, data) => wrapLocal((d) => localAPI.localCurrencies.update(id, d))(data),
  getRegionRates: (regionId) => wrapLocal((id) => localAPI.localRegions.getRates(id))(regionId),
  updateRegionRates: (regionId, rates) => wrapLocal((id, r) => localAPI.localRegions.updateRates(id, r))(regionId, rates),
} : {
  getAll: () => api.get('/currencies'),
  update: (id, data) => api.put(`/currencies/${id}`, data),
  getRegionRates: (regionId) => api.get(`/currencies/region/${regionId}`),
  updateRegionRates: (regionId, rates) => api.put(`/currencies/region/${regionId}`, { rates }),
};

export const branchesAPI = isLocalMode() ? {
  getAll: wrapLocal(() => localAPI.localBranches.getAll()),
  getActive: wrapLocal(() => localAPI.localBranches.getActive()),
  getById: wrapLocal(async (id) => { const all = await localAPI.localBranches.getAll(); return all.find(b => b.id === id); }),
  create: wrapLocal((data) => localAPI.localBranches.create(data)),
  update: (id, data) => wrapLocal((d) => localAPI.localBranches.update(id, d))(data),
  delete: (id) => wrapLocal(() => localAPI.localBranches.delete(id))(),
} : {
  getAll: () => api.get('/branches'),
  getActive: () => api.get('/branches/active'),
  getById: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`),
};

export const regionsAPI = isLocalMode() ? {
  getAll: wrapLocal(() => localAPI.localRegions.getAll()),
  getActive: wrapLocal(() => localAPI.localRegions.getActive()),
  getById: wrapLocal(async (id) => { const all = await localAPI.localRegions.getAll(); return all.find(r => r.id === id); }),
  create: wrapLocal((data) => localAPI.localRegions.create(data)),
  update: (id, data) => wrapLocal((d) => localAPI.localRegions.update(id, d))(data),
  delete: (id) => wrapLocal(() => localAPI.localRegions.delete(id))(),
} : {
  getAll: () => api.get('/regions'),
  getActive: () => api.get('/regions/active'),
  getById: (id) => api.get(`/regions/${id}`),
  create: (data) => api.post('/regions', data),
  update: (id, data) => api.put(`/regions/${id}`, data),
  delete: (id) => api.delete(`/regions/${id}`),
};

export const journalAPI = isLocalMode() ? {
  getAll: (params) => wrapLocal((p) => localAPI.localJournal.getAll(p))(params),
  getById: (id) => wrapLocal((i) => localAPI.localJournal.getById(i))(id),
  create: (data) => wrapLocal((d) => { const user = JSON.parse(localStorage.getItem('user') || '{}'); return localAPI.localJournal.create(d, user.id); })(data),
  update: (id, data) => wrapLocal((d) => localAPI.localJournal.update(id, d))(data),
  delete: (id) => wrapLocal(() => localAPI.localJournal.delete(id))(),
  getNextNumber: wrapLocal(async () => ({ next_number: 'JE-' + String(Math.floor(Math.random() * 999999)).padStart(6, '0') })),
  getExecuted: (params) => wrapLocal(async (p) => {
    const result = await localAPI.localJournal.getAll(p);
    return result;
  })(params),
} : {
  getAll: (params) => api.get('/journal', { params }),
  getById: (id) => api.get(`/journal/${id}`),
  create: (data) => api.post('/journal', data),
  update: (id, data) => api.put(`/journal/${id}`, data),
  delete: (id) => api.delete(`/journal/${id}`),
  getNextNumber: () => api.get('/journal/next-number/preview'),
  getExecuted: (params) => api.get('/journal/executed', { params }),
};

export const documentTypesAPI = isLocalMode() ? {
  getAll: wrapLocal(() => localAPI.localDocumentTypes.getAll()),
  getActive: wrapLocal(() => localAPI.localDocumentTypes.getActive()),
  create: wrapLocal((data) => localAPI.localDocumentTypes.create(data)),
  update: (id, data) => wrapLocal((d) => localAPI.localDocumentTypes.update(id, d))(data),
  delete: (id) => wrapLocal(() => localAPI.localDocumentTypes.delete(id))(),
} : {
  getAll: () => api.get('/document-types'),
  getActive: () => api.get('/document-types/active'),
  create: (data) => api.post('/document-types', data),
  update: (id, data) => api.put(`/document-types/${id}`, data),
  delete: (id) => api.delete(`/document-types/${id}`),
};

export const documentsAPI = isLocalMode() ? {
  getAll: (params) => wrapLocal((p) => localAPI.localDocuments.getAll(p))(params),
  getById: (id) => wrapLocal((i) => localAPI.localDocuments.getById(i))(id),
  create: (data) => wrapLocal((d) => { const user = JSON.parse(localStorage.getItem('user') || '{}'); return localAPI.localDocuments.create(d, user.id); })(data),
  delete: (id) => wrapLocal(() => localAPI.localDocuments.delete(id))(),
  getNextNumber: wrapLocal(async () => ({ next_number: 'DOC-' + Date.now() })),
} : {
  getAll: (params) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  create: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  getNextNumber: (docTypeId) => api.get('/documents/next-number/preview', { params: { doc_type_id: docTypeId } }),
};

export const reportsAPI = isLocalMode() ? {
  getDashboard: wrapLocal(() => localAPI.localReports.getDashboard()),
  getTrialBalance: (params) => wrapLocal((p) => localAPI.localReports.getTrialBalance(p))(params),
  getGeneralLedger: wrapLocal(async () => ({ account: {}, opening_balance: 0, movements: [], closing_balance: 0 })),
  getAccountStatement: wrapLocal(async () => ({ account: {}, opening_balance: 0, movements: [], closing_balance: 0, total_debit: 0, total_credit: 0 })),
  getIncomeStatement: wrapLocal(async () => ({ revenue: [], expenses: [], total_revenue: 0, total_expenses: 0, net_income: 0 })),
  getBalanceSheet: wrapLocal(async () => ({ assets: [], liabilities: [], equity: [], net_income: 0, total_assets: 0, total_liabilities: 0, total_equity: 0 })),
} : {
  getDashboard: () => api.get('/reports/dashboard'),
  getTrialBalance: (params) => api.get('/reports/trial-balance', { params }),
  getGeneralLedger: (params) => api.get('/reports/general-ledger', { params }),
  getAccountStatement: (params) => api.get('/reports/account-statement', { params }),
  getIncomeStatement: (params) => api.get('/reports/income-statement', { params }),
  getBalanceSheet: (params) => api.get('/reports/balance-sheet', { params }),
};

export const archiveAPI = isLocalMode() ? {
  upload: wrapLocal(async () => ({ message: 'تم' })),
  getFile: wrapLocal(async () => null),
  delete: wrapLocal(async () => ({ message: 'تم' })),
} : {
  upload: (entryId, formData) => api.post(`/archive/upload/${entryId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getFile: (entryId) => api.get(`/archive/${entryId}`, { responseType: 'blob' }),
  delete: (entryId) => api.delete(`/archive/${entryId}`),
};

export const settingsAPI = isLocalMode() ? {
  getCompany: wrapLocal(async () => { const r = await localQuery('SELECT * FROM companies LIMIT 1'); return r[0] || { name: 'نظام القيود اليومية' }; }),
  updateCompany: wrapLocal(async (data) => { await localRun('UPDATE companies SET name=?, address=?, phone=?, email=?, tax_number=? WHERE id=1', [data.name, data.address, data.phone, data.email, data.tax_number]); }),
  uploadLogo: wrapLocal(async () => ({ logo_path: '' })),
  getServer: wrapLocal(async () => ({ host: '0.0.0.0', port: 4357 })),
  updateServer: wrapLocal(async (data) => ({ message: 'تم' })),
} : {
  getCompany: () => api.get('/settings/company'),
  updateCompany: (data) => api.put('/settings/company', data),
  uploadLogo: (formData) => api.post('/settings/company/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getServer: () => api.get('/settings/server'),
  updateServer: (data) => api.put('/settings/server', data),
};

export const permissionsAPI = isLocalMode() ? {
  getModules: wrapLocal(async () => []),
  getMyPermissions: wrapLocal(async () => []),
  getUserPermissions: wrapLocal(async () => []),
  updateUserPermissions: wrapLocal(async () => ({ message: 'تم' })),
} : {
  getModules: () => api.get('/permissions/modules'),
  getMyPermissions: () => api.get('/permissions/mine'),
  getUserPermissions: (userId) => api.get(`/permissions/${userId}`),
  updateUserPermissions: (userId, permissions) => api.put(`/permissions/${userId}`, { permissions }),
};

export const signaturesAPI = isLocalMode() ? {
  getTemplates: wrapLocal(async () => []),
  getAll: wrapLocal(async () => []),
  getByTemplate: wrapLocal(async () => []),
  getMine: wrapLocal(async () => []),
  save: wrapLocal(async (data) => ({ id: 1 })),
  update: wrapLocal(async () => ({ message: 'تم' })),
  delete: wrapLocal(async () => ({ message: 'تم' })),
} : {
  getTemplates: () => api.get('/signatures/templates'),
  getAll: () => api.get('/signatures'),
  getByTemplate: (templateKey) => api.get(`/signatures/by-template/${templateKey}`),
  getMine: (templateKey) => api.get(`/signatures/mine/${templateKey}`),
  save: (data) => api.post('/signatures', data),
  update: (id, data) => api.put(`/signatures/${id}`, data),
  delete: (id) => api.delete(`/signatures/${id}`),
};

export default api;
