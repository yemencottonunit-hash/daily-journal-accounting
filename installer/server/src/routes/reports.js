const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ميزان المراجعة
router.get('/trial-balance', authenticateToken, (req, res) => {
  const { as_of_date } = req.query;

  let dateFilter = '';
  const params = [];

  if (as_of_date) {
    dateFilter = 'AND je.date <= ?';
    params.push(as_of_date);
  }

  const trialBalance = db.prepare(`
    SELECT
      a.id, a.code, a.name, a.type,
      COALESCE(SUM(jl.debit), 0) as total_debit,
      COALESCE(SUM(jl.credit), 0) as total_credit,
      COALESCE(SUM(jl.local_debit), 0) as total_local_debit,
      COALESCE(SUM(jl.local_credit), 0) as total_local_credit
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
    WHERE a.is_active = 1
    GROUP BY a.id
    HAVING total_debit != 0 OR total_credit != 0 OR total_local_debit != 0 OR total_local_credit != 0
    ORDER BY a.code
  `).all(...params);

  const totalDebit = trialBalance.reduce((sum, a) => sum + a.total_debit, 0);
  const totalCredit = trialBalance.reduce((sum, a) => sum + a.total_credit, 0);
  const totalLocalDebit = trialBalance.reduce((sum, a) => sum + a.total_local_debit, 0);
  const totalLocalCredit = trialBalance.reduce((sum, a) => sum + a.total_local_credit, 0);

  res.json({
    accounts: trialBalance,
    total_debit: totalDebit,
    total_credit: totalCredit,
    total_local_debit: totalLocalDebit,
    total_local_credit: totalLocalCredit,
    as_of_date: as_of_date || 'الآن'
  });
});

// الأستاذ العام
router.get('/general-ledger', authenticateToken, (req, res) => {
  const { account_id, from_date, to_date } = req.query;

  if (!account_id) {
    return res.status(400).json({ error: 'يرجى اختيار الحساب' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(account_id);
  if (!account) {
    return res.status(404).json({ error: 'الحساب غير موجود' });
  }

  let dateFilter = '';
  const params = [account_id];

  if (from_date) {
    dateFilter += ' AND je.date >= ?';
    params.push(from_date);
  }
  if (to_date) {
    dateFilter += ' AND je.date <= ?';
    params.push(to_date);
  }

  let openingFilter = '';
  const openingParams = [account_id];
  if (from_date) {
    openingFilter = 'AND je.date < ?';
    openingParams.push(from_date);
  }

  const openingBalance = db.prepare(`
    SELECT
      COALESCE(SUM(jl.local_debit), 0) - COALESCE(SUM(jl.local_credit), 0) as balance
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    WHERE jl.account_id = ? ${openingFilter}
  `).get(...openingParams);

  const movements = db.prepare(`
    SELECT
      je.id as entry_id, je.entry_number, je.date,
      je.description as entry_description,
      jl.debit, jl.credit, jl.currency_code, jl.exchange_rate,
      jl.local_debit, jl.local_credit,
      jl.description as line_description
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    WHERE jl.account_id = ? ${dateFilter}
    ORDER BY je.date, je.id
  `).all(...params);

  let runningBalance = openingBalance.balance;
  const movementsWithBalance = movements.map(m => {
    runningBalance += m.local_debit - m.local_credit;
    return { ...m, running_balance: runningBalance };
  });

  res.json({
    account,
    opening_balance: openingBalance.balance,
    movements: movementsWithBalance,
    closing_balance: runningBalance,
    from_date: from_date || 'البداية',
    to_date: to_date || 'الآن'
  });
});

// كشف حساب (جديد)
router.get('/account-statement', authenticateToken, (req, res) => {
  const { account_id, from_date, to_date } = req.query;

  if (!account_id) {
    return res.status(400).json({ error: 'يرجى اختيار الحساب' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(account_id);
  if (!account) {
    return res.status(404).json({ error: 'الحساب غير موجود' });
  }

  let dateFilter = '';
  const params = [account_id];

  if (from_date) {
    dateFilter += ' AND je.date >= ?';
    params.push(from_date);
  }
  if (to_date) {
    dateFilter += ' AND je.date <= ?';
    params.push(to_date);
  }

  let openingFilter = '';
  const openingParams = [account_id];
  if (from_date) {
    openingFilter = 'AND je.date < ?';
    openingParams.push(from_date);
  }

  const openingBalance = db.prepare(`
    SELECT
      COALESCE(SUM(jl.local_debit), 0) - COALESCE(SUM(jl.local_credit), 0) as balance_local
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    WHERE jl.account_id = ? ${openingFilter}
  `).get(...openingParams);

  const movements = db.prepare(`
    SELECT
      je.id as entry_id, je.entry_number, je.date,
      je.description as entry_description,
      jl.debit, jl.credit, jl.currency_code, jl.exchange_rate,
      jl.local_debit, jl.local_credit,
      jl.description as line_description,
      d.doc_number, dt.name as doc_type_name
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    LEFT JOIN documents d ON je.document_id = d.id
    LEFT JOIN document_types dt ON d.doc_type_id = dt.id
    WHERE jl.account_id = ? ${dateFilter}
    ORDER BY je.date, je.id
  `).all(...params);

  let runningBalance = openingBalance.balance_local;
  const movementsWithBalance = movements.map(m => {
    runningBalance += m.local_debit - m.local_credit;
    return { ...m, running_balance: runningBalance };
  });

  const totalDebit = movements.reduce((sum, m) => sum + (m.debit || 0), 0);
  const totalCredit = movements.reduce((sum, m) => sum + (m.credit || 0), 0);
  const totalLocalDebit = movements.reduce((sum, m) => sum + (m.local_debit || 0), 0);
  const totalLocalCredit = movements.reduce((sum, m) => sum + (m.local_credit || 0), 0);

  res.json({
    account,
    opening_balance: openingBalance.balance_local,
    movements: movementsWithBalance,
    closing_balance: runningBalance,
    total_debit: totalDebit,
    total_credit: totalCredit,
    total_local_debit: totalLocalDebit,
    total_local_credit: totalLocalCredit,
    from_date: from_date || 'البداية',
    to_date: to_date || 'الآن'
  });
});

// قائمة الدخل
router.get('/income-statement', authenticateToken, (req, res) => {
  const { from_date, to_date } = req.query;

  let dateFilter = '';
  const params = [];

  if (from_date) {
    dateFilter += ' AND je.date >= ?';
    params.push(from_date);
  }
  if (to_date) {
    dateFilter += ' AND je.date <= ?';
    params.push(to_date);
  }

  const revenue = db.prepare(`
    SELECT a.code, a.name,
      COALESCE(SUM(jl.local_credit), 0) - COALESCE(SUM(jl.local_debit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
    WHERE a.type = 'revenue' AND a.is_active = 1
    GROUP BY a.id
    HAVING balance != 0
    ORDER BY a.code
  `).all(...params);

  const expenses = db.prepare(`
    SELECT a.code, a.name,
      COALESCE(SUM(jl.local_debit), 0) - COALESCE(SUM(jl.local_credit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
    WHERE a.type = 'expense' AND a.is_active = 1
    GROUP BY a.id
    HAVING balance != 0
    ORDER BY a.code
  `).all(...params);

  const totalRevenue = revenue.reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
  const netIncome = totalRevenue - totalExpenses;

  res.json({
    revenue,
    expenses,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    net_income: netIncome,
    from_date: from_date || 'البداية',
    to_date: to_date || 'الآن'
  });
});

// الميزانية العمومية
router.get('/balance-sheet', authenticateToken, (req, res) => {
  const { as_of_date } = req.query;

  let dateFilter = '';
  const params = [];

  if (as_of_date) {
    dateFilter = 'AND je.date <= ?';
    params.push(as_of_date);
  }

  const assets = db.prepare(`
    SELECT a.code, a.name,
      COALESCE(SUM(jl.local_debit), 0) - COALESCE(SUM(jl.local_credit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
    WHERE a.type = 'asset' AND a.is_active = 1
    GROUP BY a.id
    HAVING balance != 0
    ORDER BY a.code
  `).all(...params);

  const liabilities = db.prepare(`
    SELECT a.code, a.name,
      COALESCE(SUM(jl.local_credit), 0) - COALESCE(SUM(jl.local_debit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
    WHERE a.type = 'liability' AND a.is_active = 1
    GROUP BY a.id
    HAVING balance != 0
    ORDER BY a.code
  `).all(...params);

  const equity = db.prepare(`
    SELECT a.code, a.name,
      COALESCE(SUM(jl.local_credit), 0) - COALESCE(SUM(jl.local_debit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
    WHERE a.type = 'equity' AND a.is_active = 1
    GROUP BY a.id
    HAVING balance != 0
    ORDER BY a.code
  `).all(...params);

  const netIncomeResult = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN a.type = 'revenue' THEN jl.local_credit - jl.local_debit ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN a.type = 'expense' THEN jl.local_debit - jl.local_credit ELSE 0 END), 0) as net_income
    FROM journal_lines jl
    JOIN accounts a ON jl.account_id = a.id
    JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
  `).get(...params);

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0) + netIncomeResult.net_income;

  res.json({
    assets,
    liabilities,
    equity,
    net_income: netIncomeResult.net_income,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    as_of_date: as_of_date || 'الآن'
  });
});

// إحصائيات عامة
router.get('/dashboard', authenticateToken, (req, res) => {
  const totalEntries = db.prepare('SELECT COUNT(*) as count FROM journal_entries').get();
  const totalAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE is_active = 1').get();
  const totalBranches = db.prepare('SELECT COUNT(*) as count FROM branches WHERE is_active = 1').get();
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get();
  const totalDocuments = db.prepare('SELECT COUNT(*) as count FROM documents').get();
  const totalRegions = db.prepare('SELECT COUNT(*) as count FROM regions WHERE is_active = 1').get();

  const thisMonth = db.prepare(`
    SELECT COUNT(*) as count FROM documents
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
  `).get();

  res.json({
    total_entries: totalEntries.count,
    total_accounts: totalAccounts.count,
    total_branches: totalBranches.count,
    total_users: totalUsers.count,
    total_documents: totalDocuments.count,
    total_regions: totalRegions.count,
    this_month_entries: thisMonth.count
  });
});

module.exports = router;
