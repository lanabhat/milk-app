import React, { useState } from 'react';
import { fmt, getDateRange } from '../../utils/date';
import { ITEM_META, CATEGORY_META, milkLitres } from '../../constants/itemMeta';
import { styles as s } from '../../styles/dashboard';

export default function TrendsTab({ purchases, items }) {
  const [trendPeriod, setTrendPeriod] = useState('30d');
  const [trendCustomStart, setTrendCustomStart] = useState('');
  const [trendCustomEnd, setTrendCustomEnd] = useState(new Date().toISOString().split('T')[0]);

  const trendRange = getDateRange(trendPeriod, trendCustomStart, trendCustomEnd);
  const trendFiltered = purchases.filter(p =>
    (!trendRange.start || p.date >= trendRange.start) &&
    (!trendRange.end || p.date <= trendRange.end)
  );

  const trendBuckets = (() => {
    if (trendRange.start && trendRange.end) {
      const b = {};
      const d = new Date(trendRange.start + 'T00:00:00');
      const e = new Date(trendRange.end + 'T00:00:00');
      while (d <= e) { b[d.toISOString().split('T')[0]] = 0; d.setDate(d.getDate() + 1); }
      trendFiltered.forEach(p => { if (b[p.date] !== undefined) b[p.date] += parseFloat(p.total); });
      return Object.entries(b);
    }
    const m = {};
    purchases.forEach(p => { const k = p.date.slice(0, 7); m[k] = (m[k] || 0) + parseFloat(p.total); });
    return Object.entries(m).sort();
  })();
  const maxTrend = Math.max(...trendBuckets.map(([, v]) => v), 1);

  const itemCatMap = {};
  items.forEach(i => { itemCatMap[i.name] = i.category || 'other'; });

  const catTotals = {};
  const catQty = {};
  trendFiltered.forEach(p => {
    const cat = itemCatMap[p.item_name] || 'other';
    catTotals[cat] = (catTotals[cat] || 0) + parseFloat(p.total);
    catQty[cat]    = (catQty[cat]    || 0) + (cat === 'milk' ? milkLitres(p.item_name, p.quantity) : p.quantity);
  });

  const milkPurchases = trendFiltered.filter(p => itemCatMap[p.item_name] === 'milk');
  const milkDays = new Set(milkPurchases.map(p => p.date)).size;
  const milkQtyTotal = milkPurchases.reduce((s, p) => s + milkLitres(p.item_name, p.quantity), 0);
  const milkAvgPerDay = milkDays > 0 ? milkQtyTotal / milkDays : 0;
  const milkSpend = catTotals['milk'] || 0;

  const grandTotal = trendFiltered.reduce((s, p) => s + parseFloat(p.total), 0);
  const activeDays = trendBuckets.filter(([, v]) => v > 0).length;

  return (
    <div style={s.section}>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {[['7d', '7 Days'], ['30d', '30 Days'], ['3m', '3 Mo'], ['6m', '6 Mo'], ['1y', '1 Year'], ['all', 'All Time'], ['custom', 'Custom']].map(([v, label]) => (
          <button key={v} onClick={() => setTrendPeriod(v)}
            style={{ ...s.sessionPill, ...(trendPeriod === v ? s.sessionPillActive : {}) }}>
            {label}
          </button>
        ))}
      </div>
      {trendPeriod === 'custom' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div><label style={s.fieldLabel}>From</label>
            <input type="date" value={trendCustomStart} onChange={e => setTrendCustomStart(e.target.value)} style={s.inlineInput} /></div>
          <div><label style={s.fieldLabel}>To</label>
            <input type="date" value={trendCustomEnd} onChange={e => setTrendCustomEnd(e.target.value)} style={s.inlineInput} /></div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'Period Total', value: '₹' + fmt(grandTotal), color: '#1d4ed8' },
          { label: 'All Time', value: '₹' + fmt(purchases.reduce((s, p) => s + parseFloat(p.total), 0)), color: '#7e22ce' },
          { label: 'Daily Spend', value: '₹' + fmt(activeDays ? grandTotal / activeDays : 0), color: '#0369a1' },
          { label: 'Active Days', value: activeDays, color: '#be185d' },
        ].map(c => (
          <div key={c.label} style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Milk consumption cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginBottom: 20 }}>
        {[
          { label: '🥛 Milk Qty Total', value: milkQtyTotal.toFixed(1) + ' L', color: '#0369a1' },
          { label: '🥛 Avg Milk / Day', value: milkAvgPerDay.toFixed(2) + ' L', color: '#1d4ed8' },
          { label: '🥛 Milk Spend', value: '₹' + fmt(milkSpend), color: '#0369a1' },
          { label: '🥛 Milk Days', value: milkDays, color: '#be185d' },
        ].map(c => (
          <div key={c.label} style={{ ...s.card, textAlign: 'center', padding: '10px 6px', borderTop: '3px solid #0369a1' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <h3 style={s.sectionTitle}>By Category</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
          const cm = CATEGORY_META[cat] || CATEGORY_META.other;
          const pct = Math.min(100, grandTotal ? total / grandTotal * 100 : 0);
          const catItems = Object.entries(
            trendFiltered.filter(p => (itemCatMap[p.item_name] || 'other') === cat)
              .reduce((acc, p) => {
                acc[p.item_name] = acc[p.item_name] || { qty: 0, total: 0 };
                acc[p.item_name].qty += cat === 'milk' ? milkLitres(p.item_name, p.quantity) : p.quantity;
                acc[p.item_name].total += parseFloat(p.total);
                return acc;
              }, {})
          ).sort((a, b) => b[1].total - a[1].total);

          return (
            <div key={cat} style={{ ...s.card, borderLeft: `4px solid ${cm.accent}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{cm.icon} {cm.label}</span>
                  {cat === 'milk' && milkAvgPerDay > 0 && (
                    <span style={{ marginLeft: 10, fontSize: 11, color: '#0369a1', backgroundColor: '#e0f2fe', borderRadius: 4, padding: '1px 7px' }}>
                      avg {milkAvgPerDay.toFixed(2)} L/day
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: cm.accent }}>₹{fmt(total)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{pct.toFixed(1)}% of spend</div>
                </div>
              </div>
              <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 10 }}>
                <div style={{ height: '100%', width: pct + '%', backgroundColor: cm.accent, borderRadius: 3 }} />
              </div>
              {catItems.map(([name, data]) => {
                const meta = ITEM_META[name] || { accent: cm.accent, img: '' };
                const iPct = Math.min(100, total ? data.total / total * 100 : 0);
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                    <img src={meta.img} alt={name} style={{ ...s.cartImg, width: 28, height: 28 }}
                      onError={e => { e.target.style.display = 'none'; }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      <div style={{ height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, marginTop: 3 }}>
                        <div style={{ height: '100%', width: iPct + '%', backgroundColor: meta.accent || cm.accent, borderRadius: 2 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>₹{fmt(data.total)}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>
                        {cat === 'milk' ? `${data.qty.toFixed(1)} L` : `qty ${data.qty}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {Object.keys(catTotals).length === 0 && <p style={s.empty}>No purchases in this period.</p>}
      </div>

      {/* Spending chart */}
      <h3 style={s.sectionTitle}>Spending Chart
        <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
          {trendPeriod === 'all' ? 'by month' : 'by day'}
        </span>
      </h3>
      {trendBuckets.length === 0
        ? <p style={s.empty}>No data for this period.</p>
        : (
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 8px', overflowX: 'auto', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: trendPeriod === 'all' ? 6 : 3, height: 120, minWidth: Math.max(300, trendBuckets.length * (trendPeriod === 'all' ? 36 : 14)) }}>
              {trendBuckets.map(([d, v]) => {
                const label = trendPeriod === 'all' ? d.slice(0, 7) : d.slice(5);
                const showLabel = trendPeriod === 'all' || trendBuckets.length <= 14 || d.slice(8) === '01' || d.slice(8) === '15';
                const dayPurchases = trendFiltered.filter(p => p.date === d || (trendPeriod === 'all' && p.date.startsWith(d)));
                const dayCats = {};
                dayPurchases.forEach(p => {
                  const cat = itemCatMap[p.item_name] || 'other';
                  dayCats[cat] = (dayCats[cat] || 0) + parseFloat(p.total);
                });
                const topCat = Object.entries(dayCats).sort((a, b) => b[1] - a[1])[0];
                const barColor = topCat ? (CATEGORY_META[topCat[0]] || CATEGORY_META.other).accent : '#f1f5f9';
                return (
                  <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: trendPeriod === 'all' ? 28 : 8 }} title={`${d}: ₹${fmt(v)}`}>
                    {v > 0 && trendPeriod === 'all' && <div style={{ fontSize: 9, color: '#64748b' }}>₹{fmt(v)}</div>}
                    <div style={{ width: '100%', backgroundColor: v > 0 ? barColor : '#f1f5f9', borderRadius: '3px 3px 0 0', height: Math.max(2, (v / maxTrend) * 90) }} />
                    {showLabel && <div style={{ fontSize: 8, color: '#94a3b8', whiteSpace: 'nowrap' }}>{label}</div>}
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingLeft: 4, flexWrap: 'wrap' }}>
              {Object.entries(CATEGORY_META).filter(([cat]) => catTotals[cat]).map(([cat, cm]) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: cm.accent }} />
                  {cm.label}
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
