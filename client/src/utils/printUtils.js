import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { settingsAPI, signaturesAPI } from '../services/api';

let cachedCompany = null;
let cachedLogoBase64 = null;

async function getLogoAsBase64(logoPath) {
  if (!logoPath) return '';
  if (cachedLogoBase64 && cachedLogoBase64.path === logoPath) return cachedLogoBase64.data;
  try {
    const fullUrl = logoPath.startsWith('/') ? logoPath : `/uploads/logos/${logoPath}`;
    const res = await fetch(fullUrl);
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    cachedLogoBase64 = { path: logoPath, data: dataUrl };
    return dataUrl;
  } catch { return ''; }
}

async function getCompany() {
  if (cachedCompany) return cachedCompany;
  try {
    const res = await settingsAPI.getCompany();
    cachedCompany = res.data;
  } catch { cachedCompany = { name: 'نظام القيود اليومية', address: '', phone: '', email: '', tax_number: '', logo_path: '' }; }
  return cachedCompany;
}

export function clearCompanyCache() { cachedCompany = null; }

const COPYRIGHT = 'لؤي العليمي 774347342';

const defaultTemplates = {
  journal: {
    name: 'القيود اليومية',
    headerColor: [30, 64, 175],
    fontSize: 10,
    showLogo: true,
    showCompany: true,
    showDate: true,
    showFooter: true,
    showSignatures: true,
    signature1Title: 'إعداد / المحاسب',
    signature2Title: 'مراجعة / المدير',
    signatures: [
      { title: 'إعداد / المحاسب' },
      { title: 'مراجعة / المدير' },
    ],
    footerText: '',
    orientation: 'landscape',
  },
  document: {
    name: 'المستندات المحاسبية',
    headerColor: [30, 64, 175],
    fontSize: 10,
    showLogo: true,
    showCompany: true,
    showDate: true,
    showFooter: true,
    showSignatures: true,
    signature1Title: 'إعداد / المحاسب',
    signature2Title: 'توقيع / العميل',
    signatures: [
      { title: 'إعداد / المحاسب' },
      { title: 'توقيع / العميل' },
    ],
    footerText: '',
    orientation: 'landscape',
  },
  trialBalance: {
    name: 'ميزان المراجعة',
    headerColor: [30, 64, 175],
    fontSize: 10,
    showLogo: true,
    showCompany: true,
    showDate: true,
    showFooter: true,
    showSignatures: true,
    signature1Title: 'إعداد / المحاسب',
    signature2Title: 'مراجعة / المدير',
    signatures: [
      { title: 'إعداد / المحاسب' },
      { title: 'مراجعة / المدير' },
    ],
    footerText: '',
    orientation: 'landscape',
  },
  generalLedger: {
    name: 'الأستاذ العام',
    headerColor: [30, 64, 175],
    fontSize: 10,
    showLogo: true,
    showCompany: true,
    showDate: true,
    showFooter: true,
    showSignatures: true,
    signature1Title: 'إعداد / المحاسب',
    signature2Title: 'مراجعة / المدير',
    signatures: [
      { title: 'إعداد / المحاسب' },
      { title: 'مراجعة / المدير' },
    ],
    footerText: '',
    orientation: 'landscape',
  },
  accountStatement: {
    name: 'كشف حساب',
    headerColor: [30, 64, 175],
    fontSize: 10,
    showLogo: true,
    showCompany: true,
    showDate: true,
    showFooter: true,
    showSignatures: true,
    signature1Title: 'إعداد / المحاسب',
    signature2Title: 'توقيع / العميل',
    signatures: [
      { title: 'إعداد / المحاسب' },
      { title: 'توقيع / العميل' },
    ],
    footerText: '',
    orientation: 'landscape',
  },
  incomeStatement: {
    name: 'قائمة الدخل',
    headerColor: [30, 64, 175],
    fontSize: 10,
    showLogo: true,
    showCompany: true,
    showDate: true,
    showFooter: true,
    showSignatures: true,
    signature1Title: 'إعداد / المحاسب',
    signature2Title: 'إدارة / المدير',
    signatures: [
      { title: 'إعداد / المحاسب' },
      { title: 'إدارة / المدير' },
    ],
    footerText: '',
    orientation: 'portrait',
  },
  balanceSheet: {
    name: 'الميزانية العمومية',
    headerColor: [30, 64, 175],
    fontSize: 10,
    showLogo: true,
    showCompany: true,
    showDate: true,
    showFooter: true,
    showSignatures: true,
    signature1Title: 'إعداد / المحاسب',
    signature2Title: 'إدارة / المدير',
    signatures: [
      { title: 'إعداد / المحاسب' },
      { title: 'إدارة / المدير' },
    ],
    footerText: '',
    orientation: 'portrait',
  },
};

function getStorageKey(templateKey) { return `print_template_v2_${templateKey}`; }

export function getTemplate(templateKey) {
  try {
    const saved = localStorage.getItem(getStorageKey(templateKey));
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...(defaultTemplates[templateKey] || defaultTemplates.journal) };
}

export function saveTemplate(templateKey, template) {
  localStorage.setItem(getStorageKey(templateKey), JSON.stringify(template));
}

export function resetTemplate(templateKey) {
  localStorage.removeItem(getStorageKey(templateKey));
}

export function getAllTemplates() {
  const templates = {};
  Object.keys(defaultTemplates).forEach(key => { templates[key] = getTemplate(key); });
  return templates;
}

export function getAllTemplateKeys() {
  return Object.keys(defaultTemplates).map(key => ({
    key,
    label: defaultTemplates[key].name,
  }));
}

function formatDateArabic(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

function formatCurrency(amount, currencyCode = 'YER') {
  const symbols = { YER: '﷼', USD: '$', SAR: '﷼', AED: 'د.إ', EUR: '€' };
  const formatted = new Intl.NumberFormat('ar-YE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount || 0);
  return `${formatted} ${symbols[currencyCode] || ''}`;
}

async function buildPrintHTML(title, subtitle, contentHTML, template, extraHeader = {}) {
  const t = template;
  const company = await getCompany();
  const [r, g, b] = t.headerColor || [30, 64, 175];

  let logoHTML = '';
  if (t.showLogo && company.logo_path) {
    const base64 = await getLogoAsBase64(company.logo_path);
    if (base64) {
      logoHTML = `<img src="${base64}" style="height:60px;object-fit:contain;margin-bottom:8px" />`;
    }
  }

  const sigs = t.signatures || [];
  const signaturesHTML = t.showSignatures && sigs.length > 0 ? `
    <div style="display:flex;justify-content:space-around;margin-top:40px;page-break-inside:avoid">
      ${sigs.map(s => `
        <div style="text-align:center;width:${Math.floor(900 / sigs.length)}px">
          <div style="border-top:1px solid #374151;margin-top:60px;padding-top:8px;font-weight:600;font-size:12px">${s.title || ''}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const infoLines = [];
  if (company.address) infoLines.push(`العنوان: ${company.address}`);
  if (company.phone) infoLines.push(`الهاتف: ${company.phone}`);
  if (company.email) infoLines.push(`البريد: ${company.email}`);
  if (company.tax_number) infoLines.push(`الرقم الضريبي: ${company.tax_number}`);

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', Arial, sans-serif; font-size: ${t.fontSize || 10}px; direction: rtl; padding: 15px; color: #1f2937; }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid rgb(${r},${g},${b}); }
    .company-name { font-size: 22px; font-weight: 800; color: rgb(${r},${g},${b}); margin-bottom: 4px; }
    .company-info { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
    .report-title { font-size: 18px; font-weight: 700; color: #374151; margin-bottom: 5px; }
    .report-subtitle { font-size: 13px; color: #6b7280; }
    .report-date { font-size: 12px; color: #9ca3af; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: rgb(${r},${g},${b}); color: white; padding: 8px 10px; text-align: right; font-weight: 600; font-size: ${(t.fontSize || 10) - 1}px; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: ${t.fontSize || 10}px; }
    tr:nth-child(even) { background: #f9fafb; }
    .total-row { font-weight: 700; background: #f3f4f6 !important; border-top: 2px solid #d1d5db; }
    .debit { color: #2563eb; font-weight: 600; }
    .credit { color: #dc2626; font-weight: 600; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .section-title { font-size: 15px; font-weight: 700; color: #374151; margin: 15px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb; }
    .summary-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-top: 15px; }
    .summary-item { display: flex; justify-content: space-between; padding: 4px 0; }
    .summary-label { font-weight: 600; }
    .summary-value { font-weight: 700; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px; }
    @media print { body { padding: 0; } .no-print { display: none !important; } @page { margin: 15mm; } }
  </style>
</head>
<body>
  <div class="header">
    ${logoHTML}
    <div class="company-name">${company.name || 'نظام القيود اليومية'}</div>
    ${extraHeader.department ? `<div style="font-size:14px;font-weight:600;color:#374151;margin-bottom:4px">${extraHeader.department}</div>` : ''}
    ${infoLines.length > 0 ? `<div class="company-info">${infoLines.join(' | ')}</div>` : ''}
    <div class="report-title">${title}</div>
    ${subtitle ? `<div class="report-subtitle">${subtitle}</div>` : ''}
    ${t.showDate !== false ? `<div class="report-date">${formatDateArabic(new Date())}</div>` : ''}
  </div>
  <div class="content">${contentHTML}</div>
  ${signaturesHTML}
  ${t.showFooter !== false ? `<div class="footer">${t.footerText || ''} ${t.footerText ? '|' : ''} ${COPYRIGHT}</div>` : ''}
</body>
</html>`;
}

function openPrintWindow(html) {
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export async function printJournalEntry(entry, templateKey = 'journal', extraHeader = {}) {
  const t = getTemplate(templateKey);
  t.fontSize = 9;

  let dbSigs = [];
  try {
    const res = await signaturesAPI.getByTemplate(templateKey);
    if (res.data && res.data.length > 0) {
      dbSigs = res.data.filter(s => s.is_active).map(s => ({ title: s.title || '' }));
    }
  } catch {}
  const sigs = dbSigs.length > 0 ? dbSigs : (t.signatures || []);
  t.signatures = sigs;

  let linesHTML = '';
  if (entry.lines && entry.lines.length > 0) {
    const totalLocalDebit = entry.lines.reduce((s, l) => s + ((parseFloat(l.debit) || 0) * (parseFloat(l.exchange_rate) || 1)), 0);
    const totalLocalCredit = entry.lines.reduce((s, l) => s + ((parseFloat(l.credit) || 0) * (parseFloat(l.exchange_rate) || 1)), 0);
    const totalDebit = entry.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = entry.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    linesHTML = `<table><thead><tr><th>#</th><th>رقم الحساب</th><th>اسم الحساب</th><th>مدين</th><th>دائن</th><th>العملة</th><th>الصرف</th><th>محلي مدين</th><th>محلي دائن</th><th>البيان الفرعي</th></tr></thead>
    <tbody>${entry.lines.map((line, i) => {
      const localD = (parseFloat(line.debit) || 0) * (parseFloat(line.exchange_rate) || 1);
      const localC = (parseFloat(line.credit) || 0) * (parseFloat(line.exchange_rate) || 1);
      return `<tr>
        <td class="text-center">${i + 1}</td>
        <td class="text-center">${line.account_code || ''}</td>
        <td>${line.account_name || ''}</td>
        <td class="debit">${line.debit > 0 ? formatCurrency(line.debit, line.currency_code) : '-'}</td>
        <td class="credit">${line.credit > 0 ? formatCurrency(line.credit, line.currency_code) : '-'}</td>
        <td class="text-center">${line.currency_code || 'YER'}</td>
        <td class="text-center">${line.exchange_rate || 1}</td>
        <td class="debit">${localD > 0 ? formatCurrency(localD) : '-'}</td>
        <td class="credit">${localC > 0 ? formatCurrency(localC) : '-'}</td>
        <td>${line.description || ''}</td>
      </tr>`;
    }).join('')}</tbody>
    <tfoot><tr class="total-row">
      <td colspan="3" class="text-right">المجموع</td>
      <td class="debit">${formatCurrency(totalDebit)}</td>
      <td class="credit">${formatCurrency(totalCredit)}</td>
      <td colspan="2"></td>
      <td class="debit">${formatCurrency(totalLocalDebit)}</td>
      <td class="credit">${formatCurrency(totalLocalCredit)}</td>
      <td></td>
    </tr></tfoot></table>`;
  }

  const company = await getCompany();
  const [r, g, b] = t.headerColor || [30, 64, 175];

  let logoHTML = '';
  if (t.showLogo && company.logo_path) {
    const base64 = await getLogoAsBase64(company.logo_path);
    if (base64) logoHTML = `<img src="${base64}" style="height:40px;object-fit:contain" />`;
  }

  const infoLines = [];
  if (company.address) infoLines.push(`العنوان: ${company.address}`);
  if (company.phone) infoLines.push(`الهاتف: ${company.phone}`);
  if (company.tax_number) infoLines.push(`الرقم الضريبي: ${company.tax_number}`);

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>قيد يومي - ${entry.entry_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', Arial, sans-serif; font-size: 9px; direction: rtl; padding: 8px; color: #1f2937; }
    .header { text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid rgb(${r},${g},${b}); }
    .company-name { font-size: 16px; font-weight: 800; color: rgb(${r},${g},${b}); }
    .company-info { font-size: 9px; color: #6b7280; }
    .report-title { font-size: 14px; font-weight: 700; color: #374151; margin-top: 2px; }
    .report-subtitle { font-size: 10px; color: #6b7280; }
    .info-row { display: flex; gap: 16px; margin-bottom: 8px; padding: 6px 10px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; flex-wrap: wrap; }
    .info-item { display: flex; gap: 4px; }
    .info-label { font-weight: 700; color: #374151; }
    .info-value { color: #1f2937; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th { background: rgb(${r},${g},${b}); color: white; padding: 4px 6px; text-align: right; font-size: 8px; }
    td { padding: 3px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; }
    tr:nth-child(even) { background: #f9fafb; }
    .total-row { font-weight: 700; background: #f3f4f6 !important; border-top: 2px solid #d1d5db; }
    .debit { color: #2563eb; font-weight: 600; }
    .credit { color: #dc2626; font-weight: 600; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .footer { margin-top: 8px; padding-top: 6px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; }
    .sigs { display: flex; justify-content: space-around; margin-top: 12px; }
    .sig { text-align: center; width: 200px; }
    .sig-line { border-top: 1px solid #374151; margin-top: 30px; padding-top: 4px; font-weight: 600; font-size: 10px; }
    .copy { text-align: center; color: #9ca3af; font-size: 8px; margin-top: 4px; }
    @media print { body { padding: 5mm; } @page { size: A4 landscape; margin: 8mm; } }
  </style>
</head>
<body>
  <div class="header">
    ${logoHTML ? `<div style="margin-bottom:4px">${logoHTML}</div>` : ''}
    <div class="company-name">${company.name || ''}</div>
    ${extraHeader.department ? `<div style="font-size:11px;font-weight:600;color:#374151">${extraHeader.department}</div>` : ''}
    ${infoLines.length > 0 ? `<div class="company-info">${infoLines.join(' | ')}</div>` : ''}
    <div class="report-title">قيد يومي</div>
    <div class="report-subtitle">رقم القيد: ${entry.entry_number} | التاريخ: ${entry.date}</div>
  </div>

  <div class="info-row">
    <div class="info-item"><span class="info-label">رقم القيد:</span><span class="info-value">${entry.entry_number}</span></div>
    <div class="info-item"><span class="info-label">التاريخ:</span><span class="info-value">${entry.date}</span></div>
    ${entry.description ? `<div class="info-item"><span class="info-label">البيان:</span><span class="info-value">${entry.description}</span></div>` : ''}
    ${entry.branch_name ? `<div class="info-item"><span class="info-label">الفرع:</span><span class="info-value">${entry.branch_code ? entry.branch_code + ' - ' : ''}${entry.branch_name}</span></div>` : ''}
  </div>

  ${linesHTML}

  <div class="sigs">
    ${(sigs.length > 0 ? sigs : t.signatures || []).map(s => `
      <div class="sig">
        <div class="sig-line">${s.title || ''}</div>
      </div>
    `).join('')}
  </div>

  <div class="copy">لؤي العليمي 774347342</div>
</body>
</html>`;

  openPrintWindow(html);
}

export async function printDocument(doc, templateKey = 'document', extraHeader = {}) {
  const t = getTemplate(templateKey);

  let dbSigs = [];
  try {
    const res = await signaturesAPI.getByTemplate(templateKey);
    if (res.data && res.data.length > 0) {
      dbSigs = res.data.filter(s => s.is_active).map(s => ({ title: s.title || '' }));
    }
  } catch {}
  const sigs = dbSigs.length > 0 ? dbSigs : (t.signatures || []);
  t.signatures = sigs;

  let totalLocalDebitAll = 0;
  let totalLocalCreditAll = 0;
  let totalDebitAll = 0;
  let totalCreditAll = 0;

  let entriesHTML = '';
  if (doc.entries && doc.entries.length > 0) {
    doc.entries.forEach((entry, ei) => {
      const entryLocalD = (entry.lines || []).reduce((s, l) => s + (parseFloat(l.debit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
      const entryLocalC = (entry.lines || []).reduce((s, l) => s + (parseFloat(l.credit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
      const entryD = (entry.lines || []).reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
      const entryC = (entry.lines || []).reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
      totalLocalDebitAll += entryLocalD;
      totalLocalCreditAll += entryLocalC;
      totalDebitAll += entryD;
      totalCreditAll += entryC;

      entriesHTML += `<h3 style="margin:15px 0 8px;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:5px">القيد ${ei + 1}: ${entry.description || ''}${entry.branch_name ? ' | الفرع: ' + (entry.branch_code ? entry.branch_code + ' - ' : '') + entry.branch_name : ''}</h3>`;
      entriesHTML += `<table><thead><tr><th>#</th><th>الحساب</th><th>مدين</th><th>دائن</th><th>العملة</th><th>سعر الصرف</th><th>محلي مدين</th><th>محلي دائن</th><th>البيان الفرعي</th></tr></thead>
      <tbody>${(entry.lines || []).map((l, i) => {
        const localD = (parseFloat(l.debit) || 0) * (parseFloat(l.exchange_rate) || 1);
        const localC = (parseFloat(l.credit) || 0) * (parseFloat(l.exchange_rate) || 1);
        return `<tr>
          <td class="text-center">${i + 1}</td>
          <td>${l.account_code || ''} - ${l.account_name || ''}</td>
          <td class="debit">${l.debit > 0 ? formatCurrency(l.debit, l.currency_code) : '-'}</td>
          <td class="credit">${l.credit > 0 ? formatCurrency(l.credit, l.currency_code) : '-'}</td>
          <td class="text-center">${l.currency_code || ''}</td>
          <td class="text-center">${l.exchange_rate || 1}</td>
          <td class="debit">${localD > 0 ? formatCurrency(localD) : '-'}</td>
          <td class="credit">${localC > 0 ? formatCurrency(localC) : '-'}</td>
          <td>${l.description || ''}</td>
        </tr>`;
      }).join('')}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="2" class="text-right">إجمالي القيد ${ei + 1}</td>
        <td class="debit">${formatCurrency(entryD)}</td>
        <td class="credit">${formatCurrency(entryC)}</td>
        <td colspan="2"></td>
        <td class="debit">${formatCurrency(entryLocalD)}</td>
        <td class="credit">${formatCurrency(entryLocalC)}</td>
        <td></td>
      </tr></tfoot></table>`;
    });
  }
  const content = `
    <div class="summary-box" style="margin-bottom:15px">
      <div class="summary-item"><span class="summary-label">رقم المستند:</span><span class="summary-value">${doc.doc_number || ''}</span></div>
      <div class="summary-item"><span class="summary-label">التاريخ:</span><span class="summary-value">${formatDateArabic(doc.date)}</span></div>
      ${doc.description ? `<div class="summary-item"><span class="summary-label">البيان:</span><span class="summary-value">${doc.description}</span></div>` : ''}
      ${doc.branch_name ? `<div class="summary-item"><span class="summary-label">الفرع:</span><span class="summary-value">${doc.branch_code ? doc.branch_code + ' - ' : ''}${doc.branch_name}</span></div>` : ''}
      ${doc.type_name ? `<div class="summary-item"><span class="summary-label">النوع:</span><span class="summary-value">${doc.type_code ? doc.type_code + ' - ' : ''}${doc.type_name}</span></div>` : ''}
    </div>
    ${entriesHTML}
    <div class="summary-box" style="margin-top:15px;border:2px solid #374151">
      <div class="summary-item" style="font-size:14px;font-weight:700"><span class="summary-label">الإجمالي العام:</span></div>
      <div class="summary-item"><span class="summary-label">مدين (عملة):</span><span class="summary-value debit">${formatCurrency(totalDebitAll)}</span></div>
      <div class="summary-item"><span class="summary-label">دائن (عملة):</span><span class="summary-value credit">${formatCurrency(totalCreditAll)}</span></div>
      <div class="summary-item"><span class="summary-label">محلي مدين:</span><span class="summary-value debit">${formatCurrency(totalLocalDebitAll)}</span></div>
      <div class="summary-item"><span class="summary-label">محلي دائن:</span><span class="summary-value credit">${formatCurrency(totalLocalCreditAll)}</span></div>
      <div class="summary-item"><span class="summary-label">التوازن:</span><span class="summary-value ${Math.abs(totalLocalDebitAll - totalLocalCreditAll) < 0.01 ? 'debit' : 'credit'}">${Math.abs(totalLocalDebitAll - totalLocalCreditAll) < 0.01 ? 'متوازن ✓' : 'غير متوازن ✗'}</span></div>
    </div>`;
  const html = await buildPrintHTML('مستند محاسبي', `رقم المستند: ${doc.doc_number || ''} | التاريخ: ${doc.date}`, content, t, extraHeader);
  openPrintWindow(html);
}

export async function printTrialBalance(data, templateKey = 'trialBalance', extraHeader = {}) {
  const t = getTemplate(templateKey);
  const typeMap = { asset: 'أصول', liability: 'خصوم', revenue: 'إيرادات', expense: 'نفقات', equity: 'حقوق ملكية' };
  const content = `<table><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>النوع</th><th>المدين</th><th>الدائن</th><th>محلي مدين</th><th>محلي دائن</th></tr></thead>
    <tbody>${data.accounts.map(a => `<tr><td class="text-center">${a.code}</td><td>${a.name}</td><td class="text-center">${typeMap[a.type] || a.type}</td><td class="debit">${a.total_debit > 0 ? formatCurrency(a.total_debit) : '-'}</td><td class="credit">${a.total_credit > 0 ? formatCurrency(a.total_credit) : '-'}</td><td>${a.total_local_debit > 0 ? formatCurrency(a.total_local_debit) : '-'}</td><td>${a.total_local_credit > 0 ? formatCurrency(a.total_local_credit) : '-'}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="total-row"><td colspan="3" class="text-right">المجموع</td><td class="debit">${formatCurrency(data.total_debit)}</td><td class="credit">${formatCurrency(data.total_credit)}</td><td>${formatCurrency(data.total_local_debit)}</td><td>${formatCurrency(data.total_local_credit)}</td></tr></tfoot></table>`;
  const html = await buildPrintHTML('ميزان المراجعة', `بتاريخ: ${data.as_of_date || 'الآن'}`, content, t, extraHeader);
  openPrintWindow(html);
}

export async function printGeneralLedger(data, templateKey = 'generalLedger', extraHeader = {}) {
  const t = getTemplate(templateKey);
  const content = `
    <div class="summary-box" style="margin-bottom:15px">
      <div class="summary-item"><span class="summary-label">الحساب:</span><span class="summary-value">${data.account.code} - ${data.account.name}</span></div>
      <div class="summary-item"><span class="summary-label">الرصيد الافتتاحي:</span><span class="summary-value">${formatCurrency(data.opening_balance)}</span></div>
    </div>
    <table><thead><tr><th>رقم القيد</th><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
    <tbody>${data.movements.map(m => `<tr><td class="text-center">${m.entry_number}</td><td class="text-center">${m.date}</td><td>${m.line_description || m.entry_description || ''}</td><td class="debit">${m.debit_amount > 0 ? formatCurrency(m.debit_amount) : '-'}</td><td class="credit">${m.credit_amount > 0 ? formatCurrency(m.credit_amount) : '-'}</td><td class="text-left" style="font-weight:700">${formatCurrency(m.running_balance)}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="total-row"><td colspan="3" class="text-right">الرصيد النهائي</td><td></td><td></td><td class="text-left" style="font-weight:700">${formatCurrency(data.closing_balance)}</td></tr></tfoot></table>`;
  const html = await buildPrintHTML('الأستاذ العام', `${data.account.code} - ${data.account.name}`, content, t, extraHeader);
  openPrintWindow(html);
}

export async function printAccountStatement(data, templateKey = 'accountStatement', extraHeader = {}) {
  const t = getTemplate(templateKey);
  const content = `
    <div class="summary-box" style="margin-bottom:15px">
      <div class="summary-item"><span class="summary-label">الحساب:</span><span class="summary-value">${data.account.code} - ${data.account.name}</span></div>
      <div class="summary-item"><span class="summary-label">الرصيد الافتتاحي:</span><span class="summary-value">${formatCurrency(data.opening_balance)}</span></div>
    </div>
    <table><thead><tr><th>رقم القيد</th><th>التاريخ</th><th>البيان</th><th>العملة</th><th>مدين</th><th>دائن</th><th>محلي مدين</th><th>محلي دائن</th><th>الرصيد</th></tr></thead>
    <tbody>${data.movements.map(m => `<tr><td class="text-center">${m.entry_number}</td><td>${formatDateArabic(m.date)}</td><td>${m.description || ''}</td><td class="text-center">${m.currency_code || ''}</td><td class="debit">${m.debit > 0 ? formatCurrency(m.debit) : '-'}</td><td class="credit">${m.credit > 0 ? formatCurrency(m.credit) : '-'}</td><td>${m.local_debit > 0 ? formatCurrency(m.local_debit) : '-'}</td><td>${m.local_credit > 0 ? formatCurrency(m.local_credit) : '-'}</td><td class="font-bold">${formatCurrency(m.balance)}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="total-row"><td colspan="4" class="text-right">الرصيد النهائي</td><td class="debit">${formatCurrency(data.total_debit)}</td><td class="credit">${formatCurrency(data.total_credit)}</td><td>${formatCurrency(data.total_local_debit)}</td><td>${formatCurrency(data.total_local_credit)}</td><td class="font-bold">${formatCurrency(data.closing_balance)}</td></tr></tfoot></table>`;
  const html = await buildPrintHTML('كشف حساب', `${data.account.code} - ${data.account.name}`, content, t, extraHeader);
  openPrintWindow(html);
}

export async function printIncomeStatement(data, templateKey = 'incomeStatement', extraHeader = {}) {
  const t = getTemplate(templateKey);
  const content = `
    <div class="section-title">الإيرادات</div>
    <table><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المبلغ</th></tr></thead>
    <tbody>${data.revenue.map(r => `<tr><td class="text-center">${r.code}</td><td>${r.name}</td><td class="debit">${formatCurrency(r.balance)}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="total-row"><td colspan="2" class="text-right">إجمالي الإيرادات</td><td class="debit">${formatCurrency(data.total_revenue)}</td></tr></tfoot></table>
    <div class="section-title">المصروفات</div>
    <table><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المبلغ</th></tr></thead>
    <tbody>${data.expenses.map(e => `<tr><td class="text-center">${e.code}</td><td>${e.name}</td><td class="credit">${formatCurrency(e.balance)}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="total-row"><td colspan="2" class="text-right">إجمالي المصروفات</td><td class="credit">${formatCurrency(data.total_expenses)}</td></tr></tfoot></table>
    <div class="summary-box">
      <div class="summary-item"><span class="summary-label">صافي الربح / الخسارة</span><span class="summary-value ${data.net_income >= 0 ? 'debit' : 'credit'}">${formatCurrency(data.net_income)}</span></div>
    </div>`;
  const html = await buildPrintHTML('قائمة الدخل', `من: ${data.from_date || 'البداية'} | إلى: ${data.to_date || 'الآن'}`, content, t, extraHeader);
  openPrintWindow(html);
}

export async function printBalanceSheet(data, templateKey = 'balanceSheet', extraHeader = {}) {
  const t = getTemplate(templateKey);
  const content = `
    <div class="section-title">الأصول</div>
    <table><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المبلغ</th></tr></thead>
    <tbody>${data.assets.map(a => `<tr><td class="text-center">${a.code}</td><td>${a.name}</td><td class="debit">${formatCurrency(a.balance)}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="total-row"><td colspan="2" class="text-right">إجمالي الأصول</td><td class="debit">${formatCurrency(data.total_assets)}</td></tr></tfoot></table>
    <div class="section-title">الخصوم</div>
    <table><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المبلغ</th></tr></thead>
    <tbody>${data.liabilities.map(l => `<tr><td class="text-center">${l.code}</td><td>${l.name}</td><td class="credit">${formatCurrency(l.balance)}</td></tr>`).join('')}</tbody>
    <tfoot><tr class="total-row"><td colspan="2" class="text-right">إجمالي الخصوم</td><td class="credit">${formatCurrency(data.total_liabilities)}</td></tr></tfoot></table>
    <div class="section-title">حقوق الملكية</div>
    <table><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>المبلغ</th></tr></thead>
    <tbody>${data.equity.map(e => `<tr><td class="text-center">${e.code}</td><td>${e.name}</td><td class="credit">${formatCurrency(e.balance)}</td></tr>`).join('')}
    <tr><td colspan="2" class="text-right" style="font-weight:600">صافي الربح</td><td class="${data.net_income >= 0 ? 'debit' : 'credit'}">${formatCurrency(data.net_income)}</td></tr></tbody>
    <tfoot><tr class="total-row"><td colspan="2" class="text-right">إجمالي حقوق الملكية + صافي الربح</td><td class="credit">${formatCurrency(data.total_equity)}</td></tr></tfoot></table>
    <div class="summary-box">
      <div class="summary-item"><span class="summary-label">الميزان</span><span class="summary-value ${Math.abs(data.total_assets - (data.total_liabilities + data.total_equity)) < 0.01 ? 'debit' : 'credit'}">${Math.abs(data.total_assets - (data.total_liabilities + data.total_equity)) < 0.01 ? 'متوازن ✓' : 'غير متوازن ✗'}</span></div>
    </div>`;
  const html = await buildPrintHTML('الميزانية العمومية', `بتاريخ: ${data.as_of_date || 'الآن'}`, content, t, extraHeader);
  openPrintWindow(html);
}

export async function printAccountsTree(tree, templateKey = 'journal', extraHeader = {}) {
  const t = getTemplate(templateKey);
  const typeMap = { asset: 'أصول', liability: 'خصوم', revenue: 'إيرادات', expense: 'نفقات', equity: 'حقوق ملكية' };
  function renderRows(items, level = 0) {
    return items.map(a => {
      const indent = '&nbsp;'.repeat(level * 6);
      const prefix = level > 0 ? '└─ ' : '';
      let rows = `<tr><td class="text-center">${a.code}</td><td>${indent}${prefix}${a.name}</td><td class="text-center">${typeMap[a.type] || a.type}</td><td class="text-center">${a.is_active ? 'نشط' : 'غير نشط'}</td></tr>`;
      if (a.children && a.children.length > 0) rows += renderRows(a.children, level + 1);
      return rows;
    }).join('');
  }
  const content = `<table><thead><tr><th>رقم الحساب</th><th>اسم الحساب</th><th>النوع</th><th>الحالة</th></tr></thead><tbody>${renderRows(tree)}</tbody></table>`;
  const html = await buildPrintHTML('دليل الحسابات', '', content, t, extraHeader);
  openPrintWindow(html);
}

function createPDF(title, headers, rows, options = {}) {
  const doc = new jsPDF({ orientation: options.orientation || 'landscape', unit: 'mm', format: 'a4' });
  const company = cachedCompany || { name: 'نظام القيود اليومية' };
  doc.setFont('helvetica');
  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175);
  doc.text(company.name || 'نظام القيود اليومية', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(55, 65, 81);
  doc.text(title, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(formatDateArabic(new Date()), doc.internal.pageSize.getWidth() / 2, 34, { align: 'center' });
  doc.autoTable({
    startY: 40, head: [headers], body: rows,
    styles: { font: 'helvetica', fontSize: options.fontSize || 9, cellPadding: 3, halign: 'right', valign: 'middle' },
    headStyles: { fillColor: options.headerColor || [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: options.columnStyles || {},
    margin: { top: 40, left: 15, right: 15 },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`${company.name || ''} | ${COPYRIGHT} | صفحة ${doc.internal.getCurrentPageInfo().pageNumber}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    },
  });
  return doc;
}

export function exportJournalPDF(entry) {
  const headers = ['#', 'رقم الحساب', 'اسم الحساب', 'مدين', 'دائن', 'العملة', 'الوصف'];
  const rows = (entry.lines || []).map((line, i) => [i + 1, line.account_code || '', line.account_name || '', line.debit > 0 ? formatCurrency(line.debit) : '-', line.credit > 0 ? formatCurrency(line.credit) : '-', line.currency_code || 'YER', line.description || '']);
  const doc = createPDF(`قيد يومي - ${entry.entry_number}`, headers, rows, { orientation: 'landscape' });
  doc.save(`قيد_${entry.entry_number}.pdf`);
}

export function exportTrialBalancePDF(data) {
  const typeMap = { asset: 'أصول', liability: 'خصوم', revenue: 'إيرادات', expense: 'نفقات', equity: 'حقوق ملكية' };
  const headers = ['رقم الحساب', 'اسم الحساب', 'النوع', 'المدين', 'الدائن'];
  const rows = data.accounts.map(a => [a.code, a.name, typeMap[a.type] || a.type, a.total_debit > 0 ? formatCurrency(a.total_debit) : '-', a.total_credit > 0 ? formatCurrency(a.total_credit) : '-']);
  rows.push(['', 'المجموع', '', formatCurrency(data.total_debit), formatCurrency(data.total_credit)]);
  const doc = createPDF('ميزان المراجعة', headers, rows, { orientation: 'landscape' });
  doc.save('ميزان_المراجعة.pdf');
}

function exportToExcel(title, headers, rows, filename) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportJournalExcel(entry) {
  const headers = ['#', 'رقم الحساب', 'اسم الحساب', 'مدين', 'دائن', 'العملة', 'سعر الصرف', 'الوصف'];
  const rows = (entry.lines || []).map((line, i) => [i + 1, line.account_code, line.account_name, line.debit || 0, line.credit || 0, line.currency_code || 'YER', line.exchange_rate || 1, line.description || '']);
  rows.push(['', '', 'المجموع', entry.lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0, entry.lines?.reduce((s, l) => s + (l.credit || 0), 0) || 0, '', '', '']);
  exportToExcel(`قيد ${entry.entry_number}`, headers, rows, `قيد_${entry.entry_number}`);
}

export function exportTrialBalanceExcel(data) {
  const typeMap = { asset: 'أصول', liability: 'خصوم', revenue: 'إيرادات', expense: 'نفقات', equity: 'حقوق ملكية' };
  const headers = ['رقم الحساب', 'اسم الحساب', 'النوع', 'المدين', 'الدائن'];
  const rows = data.accounts.map(a => [a.code, a.name, typeMap[a.type] || a.type, a.total_debit || 0, a.total_credit || 0]);
  rows.push(['', 'المجموع', '', data.total_debit, data.total_credit]);
  exportToExcel('ميزان المراجعة', headers, rows, 'ميزان_المراجعة');
}

export function exportIncomeStatementExcel(data) {
  const headers = ['رقم الحساب', 'اسم الحساب', 'المبلغ'];
  const rows = [];
  data.revenue.forEach(r => rows.push([r.code, r.name, r.balance]));
  rows.push(['', 'إجمالي الإيرادات', data.total_revenue]);
  data.expenses.forEach(e => rows.push([e.code, e.name, e.balance]));
  rows.push(['', 'إجمالي المصروفات', data.total_expenses]);
  rows.push(['', 'صافي الربح/الخسارة', data.net_income]);
  exportToExcel('قائمة الدخل', headers, rows, 'قائمة_الدخل');
}

export function exportBalanceSheetExcel(data) {
  const headers = ['رقم الحساب', 'اسم الحساب', 'المبلغ'];
  const rows = [];
  data.assets.forEach(a => rows.push([a.code, a.name, a.balance]));
  rows.push(['', 'إجمالي الأصول', data.total_assets]);
  data.liabilities.forEach(l => rows.push([l.code, l.name, l.balance]));
  rows.push(['', 'إجمالي الخصوم', data.total_liabilities]);
  data.equity.forEach(e => rows.push([e.code, e.name, e.balance]));
  rows.push(['', 'صافي الربح', data.net_income]);
  rows.push(['', 'إجمالي حقوق الملكية', data.total_equity]);
  exportToExcel('الميزانية العمومية', headers, rows, 'الميزانية_العمومية');
}

export function exportAccountsExcel(tree) {
  const headers = ['رقم الحساب', 'اسم الحساب', 'النوع', 'الحساب الرئيسي', 'الحالة'];
  const typeMap = { asset: 'أصول', liability: 'خصوم', revenue: 'إيرادات', expense: 'نفقات', equity: 'حقوق ملكية' };
  const rows = [];
  function flatten(items, parent = '') { items.forEach(a => { rows.push([a.code, a.name, typeMap[a.type] || a.type, parent, a.is_active ? 'نشط' : 'غير نشط']); if (a.children?.length) flatten(a.children, a.name); }); }
  flatten(tree);
  exportToExcel('دليل الحسابات', headers, rows, 'دليل_الحسابات');
}

export function exportJournalListExcel(entries) {
  const headers = ['رقم القيد', 'التاريخ', 'البيان', 'الفرع', 'المدين', 'الدائن', 'أنشأه'];
  const rows = entries.map(e => [e.entry_number, e.date, e.description || '', e.branch_name || '', e.total_debit || 0, e.total_credit || 0, e.created_by_name || '']);
  exportToExcel('القيود اليومية', headers, rows, 'القيود_اليومية');
}

export async function printDocumentsList(documents, templateKey = 'document', extraHeader = {}) {
  const t = getTemplate(templateKey);

  let dbSigs = [];
  try {
    const res = await signaturesAPI.getByTemplate(templateKey);
    if (res.data && res.data.length > 0) {
      dbSigs = res.data.filter(s => s.is_active).map(s => ({ title: s.title || '' }));
    }
  } catch {}
  const sigs = dbSigs.length > 0 ? dbSigs : (t.signatures || []);
  t.signatures = sigs;

  const totalDebit = documents.reduce((s, d) => s + (parseFloat(d.total_local_debit) || 0), 0);
  const totalCredit = documents.reduce((s, d) => s + (parseFloat(d.total_local_credit) || 0), 0);

  const rowsHTML = documents.map((doc, i) => `
    <tr>
      <td class="text-center">${i + 1}</td>
      <td class="font-mono font-bold">${doc.doc_number || ''}</td>
      <td>${formatDateArabic(doc.date)}</td>
      <td>${doc.type_name || '-'}</td>
      <td>${doc.description || ''}</td>
      <td>${doc.branch_code ? doc.branch_code + ' - ' : ''}${doc.branch_name || '-'}</td>
      <td class="text-center">${doc.entries_count || 0}</td>
      <td class="debit">${formatCurrency(doc.total_local_debit)}</td>
      <td class="credit">${formatCurrency(doc.total_local_credit)}</td>
      <td>${doc.created_by_name || '-'}</td>
    </tr>
  `).join('');

  const content = `
    <div class="summary-box" style="margin-bottom:15px">
      <div class="summary-item"><span class="summary-label">عدد المستندات:</span><span class="summary-value">${documents.length}</span></div>
      <div class="summary-item"><span class="summary-label">إجمالي مدين (محلي):</span><span class="summary-value debit">${formatCurrency(totalDebit)}</span></div>
      <div class="summary-item"><span class="summary-label">إجمالي دائن (محلي):</span><span class="summary-value credit">${formatCurrency(totalCredit)}</span></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>رقم المستند</th>
          <th>التاريخ</th>
          <th>النوع</th>
          <th>البيان</th>
          <th>الفرع</th>
          <th>عدد القيود</th>
          <th>مدين (محلي)</th>
          <th>دائن (محلي)</th>
          <th>المنفذ</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="6" class="text-right">الإجمالي</td>
          <td class="text-center">${documents.reduce((s, d) => s + (d.entries_count || 0), 0)}</td>
          <td class="debit">${formatCurrency(totalDebit)}</td>
          <td class="credit">${formatCurrency(totalCredit)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>`;

  const html = await buildPrintHTML('تقرير المستندات المحاسبية', `إجمالي ${documents.length} مستند`, content, t, extraHeader);
  openPrintWindow(html);
}
