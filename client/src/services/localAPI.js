import { localQuery, localRun, isLocalMode } from './localDB';

function generateEntryNumber() {
  const now = new Date();
  const num = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  return `JE-${num}`;
}

function generateDocNumber(typeCode, date) {
  const d = new Date(date);
  const dateStr = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const prefix = (typeCode || 'DOC').replace(/-$/, '');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `${prefix}-${dateStr}-${seq}`;
}

// Auth API
export const localAuth = {
  login: async (username, password) => {
    const users = await localQuery('SELECT * FROM users WHERE username = ? AND password = ? AND is_active = 1', [username, password]);
    if (users.length === 0) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    const user = users[0];
    const token = btoa(JSON.stringify({ id: user.id, username: user.username }));
    return { token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, avatar: user.avatar, department: user.department } };
  },
  
  me: async (token) => {
    const data = JSON.parse(atob(token));
    const users = await localQuery('SELECT id, username, full_name, role, avatar, department, is_active FROM users WHERE id = ?', [data.id]);
    if (users.length === 0) throw new Error('المستخدم غير موجود');
    return users[0];
  },
  
  getUsers: async () => {
    return await localQuery('SELECT id, username, full_name, role, is_active, avatar, department, hidden FROM users WHERE hidden = 0 ORDER BY id');
  },
  
  createUser: async (data) => {
    const result = await localRun('INSERT INTO users (username, password, full_name, role, is_active, department) VALUES (?, ?, ?, ?, ?, ?)',
      [data.username, data.password, data.full_name || '', data.role || 'viewer', data.is_active ? 1 : 0, data.department || '']);
    return { id: result.lastInsertRowid };
  },
  
  updateUser: async (id, data) => {
    await localRun('UPDATE users SET full_name = ?, role = ?, is_active = ?, department = ? WHERE id = ?',
      [data.full_name || '', data.role || 'viewer', data.is_active ? 1 : 0, data.department || '', id]);
  },
  
  deleteUser: async (id) => {
    await localRun('DELETE FROM users WHERE id = ? AND hidden = 0', [id]);
  }
};

// Accounts API
export const localAccounts = {
  getAll: async () => {
    return await localQuery('SELECT * FROM accounts ORDER BY code');
  },
  
  getActive: async () => {
    return await localQuery('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code');
  },
  
  create: async (data) => {
    const result = await localRun('INSERT INTO accounts (code, name, type, parent_id, is_active, affected_by_transactions) VALUES (?, ?, ?, ?, ?, ?)',
      [data.code, data.name, data.type, data.parent_id || null, data.is_active ? 1 : 0, data.affected_by_transactions ? 1 : 0]);
    return { id: result.lastInsertRowid };
  },
  
  update: async (id, data) => {
    await localRun('UPDATE accounts SET code = ?, name = ?, type = ?, parent_id = ?, is_active = ?, affected_by_transactions = ? WHERE id = ?',
      [data.code, data.name, data.type, data.parent_id || null, data.is_active ? 1 : 0, data.affected_by_transactions ? 1 : 0, id]);
  },
  
  delete: async (id) => {
    await localRun('DELETE FROM accounts WHERE id = ?', [id]);
  }
};

// Currencies API
export const localCurrencies = {
  getAll: async () => {
    return await localQuery('SELECT * FROM currencies ORDER BY is_primary DESC, code');
  },
  
  update: async (id, data) => {
    await localRun('UPDATE currencies SET name = ?, symbol = ?, is_primary = ? WHERE id = ?',
      [data.name, data.symbol || '', data.is_primary ? 1 : 0, id]);
  }
};

// Branches API
export const localBranches = {
  getAll: async () => {
    return await localQuery('SELECT b.*, r.name as region_name FROM branches b LEFT JOIN regions r ON b.region_id = r.id ORDER BY b.code');
  },
  
  getActive: async () => {
    return await localQuery('SELECT b.*, r.name as region_name FROM branches b LEFT JOIN regions r ON b.region_id = r.id WHERE b.is_active = 1 ORDER BY b.code');
  },
  
  create: async (data) => {
    const result = await localRun('INSERT INTO branches (name, code, region_id, is_active) VALUES (?, ?, ?, ?)',
      [data.name, data.code || '', data.region_id || null, data.is_active ? 1 : 0]);
    return { id: result.lastInsertRowid };
  },
  
  update: async (id, data) => {
    await localRun('UPDATE branches SET name = ?, code = ?, region_id = ?, is_active = ? WHERE id = ?',
      [data.name, data.code || '', data.region_id || null, data.is_active ? 1 : 0, id]);
  },
  
  delete: async (id) => {
    await localRun('DELETE FROM branches WHERE id = ?', [id]);
  }
};

// Regions API
export const localRegions = {
  getAll: async () => {
    return await localQuery('SELECT * FROM regions ORDER BY name');
  },
  
  getActive: async () => {
    return await localQuery('SELECT * FROM regions WHERE is_active = 1 ORDER BY name');
  },
  
  create: async (data) => {
    const result = await localRun('INSERT INTO regions (name, is_active) VALUES (?, ?)', [data.name, data.is_active ? 1 : 0]);
    return { id: result.lastInsertRowid };
  },
  
  update: async (id, data) => {
    await localRun('UPDATE regions SET name = ?, is_active = ? WHERE id = ?', [data.name, data.is_active ? 1 : 0, id]);
  },
  
  delete: async (id) => {
    await localRun('DELETE FROM regions WHERE id = ?', [id]);
  },
  
  getRates: async (regionId) => {
    return await localQuery('SELECT * FROM region_exchange_rates WHERE region_id = ?', [regionId]);
  },
  
  updateRates: async (regionId, rates) => {
    for (const rate of rates) {
      await localRun('INSERT OR REPLACE INTO region_exchange_rates (region_id, currency_code, exchange_rate) VALUES (?, ?, ?)',
        [regionId, rate.currency_code, rate.exchange_rate]);
    }
  }
};

// Journal API
export const localJournal = {
  getAll: async (params = {}) => {
    let where = 'WHERE 1=1';
    const sqlParams = [];
    
    if (params.from_date) { where += ' AND je.date >= ?'; sqlParams.push(params.from_date); }
    if (params.to_date) { where += ' AND je.date <= ?'; sqlParams.push(params.to_date); }
    if (params.branch_id) { where += ' AND je.branch_id = ?'; sqlParams.push(params.branch_id); }
    if (params.search) { where += ' AND (je.entry_number LIKE ? OR je.description LIKE ?)'; sqlParams.push(`%${params.search}%`, `%${params.search}%`); }
    
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;
    
    const countResult = await localQuery(`SELECT COUNT(*) as total FROM journal_entries je ${where}`, sqlParams);
    const total = countResult[0]?.total || 0;
    
    const entries = await localQuery(`
      SELECT je.*, b.name as branch_name, b.code as branch_code, u.full_name as created_by_name,
        COALESCE((SELECT SUM(jl.debit) FROM journal_lines jl WHERE jl.entry_id = je.id), 0) as total_debit,
        COALESCE((SELECT SUM(jl.credit) FROM journal_lines jl WHERE jl.entry_id = je.id), 0) as total_credit,
        COALESCE((SELECT SUM(jl.local_debit) FROM journal_lines jl WHERE jl.entry_id = je.id), 0) as total_local_debit,
        COALESCE((SELECT SUM(jl.local_credit) FROM journal_lines jl WHERE jl.entry_id = je.id), 0) as total_local_credit
      FROM journal_entries je
      LEFT JOIN branches b ON je.branch_id = b.id
      LEFT JOIN users u ON je.created_by = u.id
      ${where}
      ORDER BY je.date DESC, je.id DESC
      LIMIT ? OFFSET ?
    `, [...sqlParams, limit, offset]);
    
    return { entries, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },
  
  getById: async (id) => {
    const entry = await localQuery(`
      SELECT je.*, b.name as branch_name, b.code as branch_code, u.full_name as created_by_name
      FROM journal_entries je
      LEFT JOIN branches b ON je.branch_id = b.id
      LEFT JOIN users u ON je.created_by = u.id
      WHERE je.id = ?
    `, [id]);
    
    if (entry.length === 0) throw new Error('القيد غير موجود');
    
    const lines = await localQuery(`
      SELECT jl.*, a.name as account_name, a.code as account_code,
        b2.name as executing_branch_name, b2.code as executing_branch_code
      FROM journal_lines jl
      LEFT JOIN accounts a ON jl.account_id = a.id
      LEFT JOIN branches b2 ON jl.executing_branch_id = b2.id
      WHERE jl.entry_id = ?
      ORDER BY jl.id
    `, [id]);
    
    return { ...entry[0], lines };
  },
  
  create: async (data, userId) => {
    const entryNumber = generateEntryNumber();
    const result = await localRun(
      'INSERT INTO journal_entries (entry_number, date, description, branch_id, created_by) VALUES (?, ?, ?, ?, ?)',
      [entryNumber, data.date, data.description || '', data.branch_id || null, userId]
    );
    
    const entryId = result.lastInsertRowid;
    
    for (const line of data.lines) {
      const rate = parseFloat(line.exchange_rate) || 1;
      await localRun(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, currency_code, exchange_rate, local_debit, local_credit, executing_branch_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [entryId, line.account_id, parseFloat(line.debit) || 0, parseFloat(line.credit) || 0,
         line.currency_code || 'YER', rate, (parseFloat(line.debit) || 0) * rate, (parseFloat(line.credit) || 0) * rate,
         line.executing_branch_id || null, line.description || '']
      );
    }
    
    return { id: entryId, entry_number: entryNumber };
  },
  
  update: async (id, data) => {
    await localRun('UPDATE journal_entries SET date = ?, description = ?, branch_id = ? WHERE id = ?',
      [data.date, data.description || '', data.branch_id || null, id]);
    
    await localRun('DELETE FROM journal_lines WHERE entry_id = ?', [id]);
    
    for (const line of data.lines) {
      const rate = parseFloat(line.exchange_rate) || 1;
      await localRun(
        'INSERT INTO journal_lines (entry_id, account_id, debit, credit, currency_code, exchange_rate, local_debit, local_credit, executing_branch_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, line.account_id, parseFloat(line.debit) || 0, parseFloat(line.credit) || 0,
         line.currency_code || 'YER', rate, (parseFloat(line.debit) || 0) * rate, (parseFloat(line.credit) || 0) * rate,
         line.executing_branch_id || null, line.description || '']
      );
    }
  },
  
  delete: async (id) => {
    await localRun('DELETE FROM journal_lines WHERE entry_id = ?', [id]);
    await localRun('DELETE FROM journal_entries WHERE id = ?', [id]);
  }
};

// Documents API
export const localDocuments = {
  getAll: async (params = {}) => {
    let where = 'WHERE 1=1';
    const sqlParams = [];
    
    if (params.from_date) { where += ' AND d.date >= ?'; sqlParams.push(params.from_date); }
    if (params.to_date) { where += ' AND d.date <= ?'; sqlParams.push(params.to_date); }
    if (params.branch_id) { where += ' AND d.branch_id = ?'; sqlParams.push(params.branch_id); }
    if (params.doc_type_id) { where += ' AND d.doc_type_id = ?'; sqlParams.push(params.doc_type_id); }
    if (params.search) { where += ' AND (d.doc_number LIKE ? OR d.description LIKE ?)'; sqlParams.push(`%${params.search}%`, `%${params.search}%`); }
    
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;
    
    const countResult = await localQuery(`SELECT COUNT(*) as total FROM documents d ${where}`, sqlParams);
    const total = countResult[0]?.total || 0;
    
    const documents = await localQuery(`
      SELECT d.*, b.name as branch_name, b.code as branch_code,
        dt.name as type_name, dt.code as type_code, dt.prefix,
        u.full_name as created_by_name,
        (SELECT COUNT(*) FROM journal_entries WHERE document_id = d.id) as entries_count,
        COALESCE((SELECT SUM(jl.local_debit) FROM journal_lines jl JOIN journal_entries je2 ON jl.entry_id = je2.id WHERE je2.document_id = d.id), 0) as total_local_debit,
        COALESCE((SELECT SUM(jl.local_credit) FROM journal_lines jl JOIN journal_entries je2 ON jl.entry_id = je2.id WHERE je2.document_id = d.id), 0) as total_local_credit
      FROM documents d
      LEFT JOIN branches b ON d.branch_id = b.id
      LEFT JOIN document_types dt ON d.doc_type_id = dt.id
      LEFT JOIN users u ON d.created_by = u.id
      ${where}
      ORDER BY d.date DESC, d.id DESC
      LIMIT ? OFFSET ?
    `, [...sqlParams, limit, offset]);
    
    return { documents, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  },
  
  getById: async (id) => {
    const doc = await localQuery(`
      SELECT d.*, b.name as branch_name, b.code as branch_code,
        dt.name as type_name, dt.code as type_code,
        u.full_name as created_by_name
      FROM documents d
      LEFT JOIN branches b ON d.branch_id = b.id
      LEFT JOIN document_types dt ON d.doc_type_id = dt.id
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.id = ?
    `, [id]);
    
    if (doc.length === 0) throw new Error('المستند غير موجود');
    
    const entries = await localQuery(`
      SELECT je.*, u.full_name as created_by_name, b2.name as branch_name, b2.code as branch_code
      FROM journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      LEFT JOIN branches b2 ON je.branch_id = b2.id
      WHERE je.document_id = ?
      ORDER BY je.id
    `, [id]);
    
    for (const entry of entries) {
      entry.lines = await localQuery(`
        SELECT jl.*, a.name as account_name, a.code as account_code
        FROM journal_lines jl
        LEFT JOIN accounts a ON jl.account_id = a.id
        WHERE jl.entry_id = ?
        ORDER BY jl.id
      `, [entry.id]);
    }
    
    return { ...doc[0], entries };
  },
  
  create: async (data, userId) => {
    const typeCode = data.doc_type_id ? 'JV' : 'DOC';
    const docNumber = generateDocNumber(typeCode, data.date);
    
    const result = await localRun(
      'INSERT INTO documents (doc_number, doc_type_id, date, description, branch_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [docNumber, data.doc_type_id || null, data.date, data.description || '', data.branch_id, userId]
    );
    
    const docId = result.lastInsertRowid;
    
    for (const entry of (data.entries || [])) {
      const entryNumber = generateEntryNumber();
      const entryBranchId = entry.branch_id || data.branch_id;
      
      const entryResult = await localRun(
        'INSERT INTO journal_entries (entry_number, document_id, date, description, branch_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [entryNumber, docId, data.date, entry.description || '', entryBranchId, userId]
      );
      
      const entryId = entryResult.lastInsertRowid;
      
      for (const line of (entry.lines || [])) {
        const rate = parseFloat(line.exchange_rate) || 1;
        const debit = parseFloat(line.debit) || 0;
        const credit = parseFloat(line.credit) || 0;
        
        await localRun(
          'INSERT INTO journal_lines (entry_id, account_id, debit, credit, currency_code, exchange_rate, local_debit, local_credit, executing_branch_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [entryId, line.account_id, debit, credit, line.currency_code || 'YER', rate, debit * rate, credit * rate, entryBranchId, line.description || '']
        );
      }
    }
    
    return { id: docId, doc_number: docNumber };
  },
  
  delete: async (id) => {
    const entries = await localQuery('SELECT id FROM journal_entries WHERE document_id = ?', [id]);
    for (const e of entries) {
      await localRun('DELETE FROM journal_lines WHERE entry_id = ?', [e.id]);
    }
    await localRun('DELETE FROM journal_entries WHERE document_id = ?', [id]);
    await localRun('DELETE FROM documents WHERE id = ?', [id]);
  }
};

// Document Types API
export const localDocumentTypes = {
  getAll: async () => {
    return await localQuery('SELECT * FROM document_types ORDER BY name');
  },
  
  getActive: async () => {
    return await localQuery('SELECT * FROM document_types WHERE is_active = 1 ORDER BY name');
  },
  
  create: async (data) => {
    const result = await localRun('INSERT INTO document_types (name, code, prefix, is_active) VALUES (?, ?, ?, ?)',
      [data.name, data.code || '', data.prefix || '', data.is_active ? 1 : 0]);
    return { id: result.lastInsertRowid };
  },
  
  update: async (id, data) => {
    await localRun('UPDATE document_types SET name = ?, code = ?, prefix = ?, is_active = ? WHERE id = ?',
      [data.name, data.code || '', data.prefix || '', data.is_active ? 1 : 0, id]);
  },
  
  delete: async (id) => {
    await localRun('DELETE FROM document_types WHERE id = ?', [id]);
  }
};

// Reports API
export const localReports = {
  getDashboard: async () => {
    const entries = await localQuery('SELECT COUNT(*) as count FROM journal_entries');
    const accounts = await localQuery('SELECT COUNT(*) as count FROM accounts WHERE is_active = 1');
    const branches = await localQuery('SELECT COUNT(*) as count FROM branches WHERE is_active = 1');
    const documents = await localQuery('SELECT COUNT(*) as count FROM documents');
    
    return {
      total_entries: entries[0]?.count || 0,
      total_accounts: accounts[0]?.count || 0,
      total_branches: branches[0]?.count || 0,
      total_documents: documents[0]?.count || 0,
      this_month_entries: 0
    };
  },
  
  getTrialBalance: async (params = {}) => {
    let dateFilter = '';
    const sqlParams = [];
    
    if (params.from_date) { dateFilter += ' AND je.date >= ?'; sqlParams.push(params.from_date); }
    if (params.to_date) { dateFilter += ' AND je.date <= ?'; sqlParams.push(params.to_date); }
    if (params.branch_id) { dateFilter += ' AND jl.executing_branch_id = ?'; sqlParams.push(params.branch_id); }
    
    const allAccounts = await localQuery('SELECT id, code, name, type FROM accounts WHERE is_active = 1 ORDER BY code');
    
    const result = [];
    for (const account of allAccounts) {
      const movement = await localQuery(`
        SELECT
          COALESCE(SUM(jl.debit), 0) as move_debit,
          COALESCE(SUM(jl.credit), 0) as move_credit,
          COALESCE(SUM(jl.local_debit), 0) as move_local_debit,
          COALESCE(SUM(jl.local_credit), 0) as move_local_credit
        FROM journal_lines jl
        JOIN journal_entries je ON jl.entry_id = je.id
        WHERE jl.account_id = ? ${dateFilter}
      `, [account.id, ...sqlParams]);
      
      const m = movement[0];
      if (m.move_debit !== 0 || m.move_credit !== 0) {
        result.push({ ...account, ...m });
      }
    }
    
    return { accounts: result, from_date: params.from_date || 'البداية', to_date: params.to_date || 'الآن' };
  }
};
