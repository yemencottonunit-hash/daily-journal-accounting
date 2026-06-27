export function formatCurrency(amount, currencyCode = 'YER') {
  const currencies = {
    YER: { symbol: '﷼', name: 'ريال يمني', decimal: 0 },
    USD: { symbol: '$', name: 'دولار أمريكي', decimal: 2 },
    SAR: { symbol: '﷼', name: 'ريال سعودي', decimal: 2 },
    AED: { symbol: 'د.إ', name: 'درهم إماراتي', decimal: 2 },
    EUR: { symbol: '€', name: 'يورو', decimal: 2 },
  };
  const currency = currencies[currencyCode] || currencies.YER;
  const formatted = new Intl.NumberFormat('ar-YE', {
    minimumFractionDigits: currency.decimal,
    maximumFractionDigits: currency.decimal,
  }).format(amount || 0);
  return `${formatted} ${currency.symbol}`;
}

export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function getToday() {
  return new Date().toISOString().split('T')[0];
}

export function getLocalEquivalent(amount, currencyCode, regionRates) {
  const rate = regionRates[currencyCode] || 1;
  return (parseFloat(amount) || 0) * rate;
}

export function getExchangeRateForCurrency(currencyCode, regionRates) {
  return regionRates[currencyCode] || 1;
}

export const accountTypeColors = {
  asset: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'أصول' },
  liability: { bg: 'bg-red-100', text: 'text-red-800', label: 'خصوم' },
  revenue: { bg: 'bg-green-100', text: 'text-green-800', label: 'إيرادات' },
  expense: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'نفقات' },
  equity: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'حقوق ملكية' },
};

export const accountTypes = [
  { value: 'asset', label: 'أصول' },
  { value: 'liability', label: 'خصوم' },
  { value: 'revenue', label: 'إيرادات' },
  { value: 'expense', label: 'نفقات' },
  { value: 'equity', label: 'حقوق ملكية' },
];

export const currencySymbols = {
  YER: '﷼',
  USD: '$',
  SAR: '﷼',
  AED: 'د.إ',
  EUR: '€',
};
