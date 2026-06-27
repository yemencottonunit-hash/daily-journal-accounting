const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ميزان المراجعة
router.get('/trial-balance', authenticateToken, (req, res) => {
  const { as_of_date, from_date, to_date, branch_id, region_id } = req.query;

  // فلتر الرصيد الافتتاحي (قبل from_date)
  let openingFilter = '';
  const openingParams = [];
  if (from_date) {
    openingFilter = 'AND je.date < ?';
    openingParams.push(from_date);
  }
  if (branch_id) {
    openingFilter += ' AND jl.executing_branch_id = ?';
    openingParams.push(branch_id);
  }

  // فلتر الحركة (من from_date إلى to_date أو as_of_date)
  let movementFilter = '';
  const movementParams = [];
  if (from_date) {
    movementFilter += ' AND je.date >= ?';
    movementParams.push(from_date);
  }
  if (to_date) {
    movementFilter += ' AND je.date <= ?';
    movementParams.push(to_date);
  } else if (as_of_date) {
    movementFilter += ' AND je.date <= ?';
    movementParams.push(as_of_date);
  }
  if (branch_id) {
    movementFilter += ' AND jl.executing_branch_id = ?';
    movementParams.push(branch_id);
  }

  // جلب جميع الحسابات النشطة
  const allAccounts = db.prepare('SELECT id, code, name, type FROM accounts WHERE is_active = 1 ORDER BY code').all();

  // جلب أسعار الصرف حسب المنطقة المحددة (للتسعير وليس الفلتر)
  let regionRates = {};
  let regionName = '';
  if (region_id) {
    const region = db.prepare('SELECT name FROM regions WHERE id = ?').get(region_id);
    if (region) regionName = region.name;
    const rates = db.prepare('SELECT currency_code, exchange_rate FROM region_exchange_rates WHERE region_id = ?')
      .all(region_id);
    regionRates = Object.fromEntries(rates.map(r => [r.currency_code, r.exchange_rate]));
  }

  const result = allAccounts.map(account => {
    // الرصيد الافتتاحي
    const opening = db.prepare(`
      SELECT
        COALESCE(SUM(jl.debit), 0) as opening_debit,
        COALESCE(SUM(jl.credit), 0) as opening_credit,
        COALESCE(SUM(jl.local_debit), 0) as opening_local_debit,
        COALESCE(SUM(jl.local_credit), 0) as opening_local_credit
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      WHERE jl.account_id = ? ${openingFilter}
    `).get(account.id, ...openingParams);

    // حركة الفترة
    const movement = db.prepare(`
      SELECT
        COALESCE(SUM(jl.debit), 0) as move_debit,
        COALESCE(SUM(jl.credit), 0) as move_credit,
        COALESCE(SUM(jl.local_debit), 0) as move_local_debit,
        COALESCE(SUM(jl.local_credit), 0) as move_local_credit
      FROM journal_lines jl
      JOIN journal_entries je ON jl.entry_id = je.id
      WHERE jl.account_id = ? ${movementFilter}
    `).get(account.id, ...movementParams);

    return {
      ...account,
      opening_debit: opening.opening_debit,
      opening_credit: opening.opening_credit,
      opening_local_debit: opening.opening_local_debit,
      opening_local_credit: opening.opening_local_credit,
      move_debit: movement.move_debit,
      move_credit: movement.move_credit,
      move_local_debit: movement.move_local_debit,
      move_local_credit: movement.move_local_credit,
      closing_debit: opening.opening_debit + movement.move_debit,
      closing_credit: opening.opening_credit + movement.move_credit,
      closing_local_debit: opening.opening_local_debit + movement.move_local_debit,
      closing_local_credit: opening.opening_local_credit + movement.move_local_credit,
    };
  }).filter(a =>
    a.opening_debit !== 0 || a.opening_credit !== 0 ||
    a.move_debit !== 0 || a.move_credit !== 0 ||
    a.closing_debit !== 0 || a.closing_credit !== 0
  );

  const totals = result.reduce((sum, a) => ({
    opening_debit: sum.opening_debit + a.opening_debit,
    opening_credit: sum.opening_credit + a.opening_credit,
    opening_local_debit: sum.opening_local_debit + a.opening_local_debit,
    opening_local_credit: sum.opening_local_credit + a.opening_local_credit,
    move_debit: sum.move_debit + a.move_debit,
    move_credit: sum.move_credit + a.move_credit,
    move_local_debit: sum.move_local_debit + a.move_local_debit,
    move_local_credit: sum.move_local_credit + a.move_local_credit,
    closing_debit: sum.closing_debit + a.closing_debit,
    closing_credit: sum.closing_credit + a.closing_credit,
    closing_local_debit: sum.closing_local_debit + a.closing_local_debit,
    closing_local_credit: sum.closing_local_credit + a.closing_local_credit,
  }), {
    opening_debit: 0, opening_credit: 0, opening_local_debit: 0, opening_local_credit: 0,
    move_debit: 0, move_credit: 0, move_local_debit: 0, move_local_credit: 0,
    closing_debit: 0, closing_credit: 0, closing_local_debit: 0, closing_local_credit: 0,
  });

  res.json({
    accounts: result,
    totals,
    region_rates: regionRates,
    region_name: regionName,
    from_date: from_date || 'البداية',
    to_date: to_date || as_of_date || 'الآن'
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
  const { as_of_date, branch_id, region_id } = req.query;

  let dateFilter = '';
  const params = [];
  if (as_of_date) {
    dateFilter = 'AND je.date <= ?';
    params.push(as_of_date);
  }
  if (branch_id) {
    dateFilter += ' AND jl.executing_branch_id = ?';
    params.push(branch_id);
  }

  // جلب أسعار الصرف حسب المنطقة
  let regionRates = {};
  let regionName = '';
  if (region_id) {
    const region = db.prepare('SELECT name FROM regions WHERE id = ?').get(region_id);
    if (region) regionName = region.name;
    const rates = db.prepare('SELECT currency_code, exchange_rate FROM region_exchange_rates WHERE region_id = ?')
      .all(region_id);
    regionRates = Object.fromEntries(rates.map(r => [r.currency_code, r.exchange_rate]));
  }

  const assets = db.prepare(`
    SELECT a.code, a.name,
      COALESCE(SUM(jl.local_debit), 0) as total_debit,
      COALESCE(SUM(jl.local_credit), 0) as total_credit,
      COALESCE(SUM(jl.local_debit), 0) - COALESCE(SUM(jl.local_credit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
    WHERE a.type = 'asset' AND a.is_active = 1
    GROUP BY a.id
    HAVING total_debit != 0 OR total_credit != 0
    ORDER BY a.code
  `).all(...params);

  const liabilities = db.prepare(`
    SELECT a.code, a.name,
      COALESCE(SUM(jl.local_debit), 0) as total_debit,
      COALESCE(SUM(jl.local_credit), 0) as total_credit,
      COALESCE(SUM(jl.local_credit), 0) - COALESCE(SUM(jl.local_debit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
    WHERE a.type = 'liability' AND a.is_active = 1
    GROUP BY a.id
    HAVING total_debit != 0 OR total_credit != 0
    ORDER BY a.code
  `).all(...params);

  const equity = db.prepare(`
    SELECT a.code, a.name,
      COALESCE(SUM(jl.local_debit), 0) as total_debit,
      COALESCE(SUM(jl.local_credit), 0) as total_credit,
      COALESCE(SUM(jl.local_credit), 0) - COALESCE(SUM(jl.local_debit), 0) as balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    LEFT JOIN journal_entries je ON jl.entry_id = je.id ${dateFilter}
    WHERE a.type = 'equity' AND a.is_active = 1
    GROUP BY a.id
    HAVING total_debit != 0 OR total_credit != 0
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
    region_rates: regionRates,
    region_name: regionName,
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
