export const todayStr = () => new Date().toISOString().split('T')[0];
export const fmt = v => Number(v).toFixed(0);
export const fmt2 = v => Number(v).toFixed(2);
export const fmtD = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtShort = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export const getDateRange = (period, customStart, customEnd) => {
  if (period === 'custom') return { start: customStart, end: customEnd };
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const f = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const end = f(today);
  const from = new Date(today);
  if (period === '7d') from.setDate(today.getDate() - 6);
  else if (period === '30d') from.setDate(today.getDate() - 29);
  else if (period === '3m') from.setMonth(today.getMonth() - 3);
  else if (period === '6m') from.setMonth(today.getMonth() - 6);
  else if (period === '1y') from.setFullYear(today.getFullYear() - 1);
  else return { start: null, end: null };
  return { start: f(from), end };
};
