import React, { useState, useRef } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

export default function BillTab({ advances, showToast }) {
  const [billData, setBillData] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [billAdvId, setBillAdvId] = useState('');
  const [billAdvOverride, setBillAdvOverride] = useState('');
  const billRef = useRef();

  const sortedAdvances = [...advances].sort((a, b) =>
    b.date.localeCompare(a.date) || b.id - a.id
  );

  const loadBill = async () => {
    setBillLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const params = new URLSearchParams();
      if (billAdvId) params.set('advance_id', billAdvId);
      if (billAdvOverride) params.set('advance_override', billAdvOverride);
      const res = await fetch(`${API}/api/bills/cycle_bill/?${params}`, { headers });
      if (res.ok) setBillData(await res.json());
      else showToast('Error loading bill', 'error');
    } catch { showToast('Error loading bill', 'error'); }
    finally { setBillLoading(false); }
  };

  const handlePrint = () => {
    if (!billData) return;

    const itemSummary = Object.entries(
      billData.purchases.reduce((acc, p) => {
        if (!acc[p.item_name]) {
          acc[p.item_name] = { qty: 0, total: 0, unitPrice: p.quantity > 0 ? parseFloat(p.total) / p.quantity : 0 };
        }
        acc[p.item_name].qty   += p.quantity;
        acc[p.item_name].total += parseFloat(p.total);
        return acc;
      }, {})
    );

    const byD = billData.purchases.reduce((acc, p) => {
      acc[p.date] = acc[p.date] || []; acc[p.date].push(p); return acc;
    }, {});
    const dailyRows = Object.keys(byD).sort().map(d => {
      const dayTotal = byD[d].reduce((s, p) => s + parseFloat(p.total), 0);
      const items = byD[d].map(p => `<tr><td style="padding:3px 12px 3px 24px;color:#555">${p.item_name}</td><td style="padding:3px 12px;text-align:center;color:#555">${p.quantity}</td><td style="padding:3px 12px;text-align:right;color:#555">₹${fmt(p.total)}</td></tr>`).join('');
      return `<tr style="background:#f8fafc"><td style="padding:5px 12px;font-weight:600">${fmtD(d)}</td><td></td><td style="padding:5px 12px;text-align:right;font-weight:600">₹${fmt(dayTotal)}</td></tr>${items}`;
    }).join('');

    const itemRows = itemSummary.map(([name, data]) =>
      `<tr><td style="padding:6px 12px">${name}</td><td style="padding:6px 12px;text-align:center;color:#555">₹${fmt(data.unitPrice)}</td><td style="padding:6px 12px;text-align:center">${data.qty}</td><td style="padding:6px 12px;text-align:right;font-weight:600">₹${fmt(data.total)}</td></tr>`
    ).join('');

    const balColor = billData.remaining_balance >= 0 ? '#16a34a' : '#dc2626';
    const balLabel = billData.remaining_balance >= 0 ? 'Balance with you' : 'Amount due to vendor';

    const html = `<!DOCTYPE html><html><head><title>Milk & Paper — Bill</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#1e293b;background:white;padding:40px}
  h1{font-size:22px;font-weight:700;margin-bottom:2px}
  .sub{font-size:13px;color:#64748b;margin-bottom:24px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 32px;margin-bottom:28px;font-size:13px}
  .meta-label{color:#64748b}
  .meta-value{font-weight:600}
  h2{font-size:14px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin:24px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:6px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;padding:8px 12px;background:#f8fafc;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0}
  td{border-bottom:1px solid #f1f5f9}
  tr:last-child td{border-bottom:none}
  .summary-box{margin-top:28px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:14px}
  .summary-row{display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #f1f5f9}
  .summary-row:last-child{border-bottom:none;font-weight:700;font-size:16px;background:#f8fafc}
  .footer{margin-top:40px;font-size:11px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px}@page{margin:15mm}}
</style>
</head><body>
  <h1>Milk & Paper</h1>
  <div class="sub">Daily Delivery Bill</div>
  <div class="meta">
    <div><span class="meta-label">Customer</span><br><span class="meta-value">${billData.user.name}</span></div>
    <div><span class="meta-label">Billing Period</span><br><span class="meta-value">${fmtD(billData.advance_date)} – ${fmtD(billData.end_date)}</span></div>
    <div><span class="meta-label">Advance Given</span><br><span class="meta-value">₹${fmt(billData.advance_amount)}</span></div>
    ${billData.balance_paid > 0 ? `<div><span class="meta-label">Previous Balance Paid</span><br><span class="meta-value">₹${fmt(billData.balance_paid)}</span></div>` : ''}
  </div>
  <h2>Daily Purchases</h2>
  <table>
    <thead><tr><th>Date / Item</th><th></th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${dailyRows}</tbody>
  </table>
  <h2>Summary by Item</h2>
  <table>
    <thead><tr><th>Item</th><th style="text-align:center">Rate</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="summary-box">
    <div class="summary-row"><span>Total Purchases</span><span>₹${fmt(billData.total_purchases)}</span></div>
    <div class="summary-row"><span>Advance Given</span><span>₹${fmt(billData.advance_amount)}</span></div>
    ${billData.balance_paid > 0 ? `<div class="summary-row"><span>Balance Paid</span><span>₹${fmt(billData.balance_paid)}</span></div>` : ''}
    <div class="summary-row"><span>${balLabel}</span><span style="color:${balColor}">₹${fmt(Math.abs(billData.remaining_balance))}</span></div>
  </div>
  <div class="footer">Generated on ${new Date().toLocaleString('en-IN')}</div>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <div style={s.section}>
      <h3 style={s.sectionTitle}>Generate Bill</h3>

      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={s.fieldLabel}>Payment Cycle</label>
            <select value={billAdvId} onChange={e => { setBillAdvId(e.target.value); setBillData(null); }} style={s.input}>
              <option value="">Current (Latest) Cycle</option>
              {sortedAdvances.map(adv => (
                <option key={adv.id} value={String(adv.id)}>
                  {fmtD(adv.date)} · ₹{adv.amount}{adv.balance_paid > 0 ? ` + ₹${adv.balance_paid}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={s.fieldLabel}>Override Advance Amount (₹)</label>
            <input type="number" min="0" placeholder="Auto from payment" value={billAdvOverride}
              onChange={e => setBillAdvOverride(e.target.value)} style={s.input} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadBill} disabled={billLoading} style={{ ...s.primaryBtn, flex: 1 }}>
            {billLoading ? 'Generating…' : '🧾 Generate Bill'}
          </button>
          {billData && <button onClick={handlePrint} style={{ ...s.primaryBtn, backgroundColor: '#16a34a' }}>🖨 Print</button>}
        </div>
      </div>

      {billData && (
        <div ref={billRef} style={s.receipt}>
          <h2 style={{ textAlign: 'center', fontSize: 16, margin: '4px 0', letterSpacing: 1 }}>MILK & PAPER</h2>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#555', margin: '2px 0' }}>Daily Delivery Billing</p>
          <div style={s.receiptDivider} />
          <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Customer:</strong> {billData.user.name}</p>
          <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Cycle started:</strong> {fmtD(billData.advance_date)}</p>
          <p style={{ fontSize: 12, margin: '2px 0' }}><strong>Generated:</strong> {fmtD(billData.end_date)}</p>
          <div style={s.receiptDivider} />

          {(() => {
            const byD = billData.purchases.reduce((acc, p) => {
              acc[p.date] = acc[p.date] || []; acc[p.date].push(p); return acc;
            }, {});
            return Object.keys(byD).sort().map(d => {
              const dayTotal = byD[d].reduce((s, p) => s + parseFloat(p.total), 0);
              return (
                <div key={d} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', borderBottom: '1px dotted #ddd', paddingBottom: 2, marginBottom: 2 }}>
                    <span>{fmtD(d)}</span><span>₹{fmt(dayTotal)}</span>
                  </div>
                  {byD[d].map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, paddingLeft: 8 }}>
                      <span>{p.item_name} × {p.quantity}</span>
                      <span>₹{fmt(p.total)}</span>
                    </div>
                  ))}
                </div>
              );
            });
          })()}

          <div style={s.receiptDivider} />

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px dashed #999', padding: '2px 0' }}>Item</th>
                <th style={{ textAlign: 'center', borderBottom: '1px dashed #999', padding: '2px 0' }}>Qty</th>
                <th style={{ textAlign: 'center', borderBottom: '1px dashed #999', padding: '2px 0' }}>Rate</th>
                <th style={{ textAlign: 'right', borderBottom: '1px dashed #999', padding: '2px 0' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(
                billData.purchases.reduce((acc, p) => {
                  if (!acc[p.item_name]) {
                    acc[p.item_name] = { qty: 0, total: 0, unitPrice: p.quantity > 0 ? parseFloat(p.total) / p.quantity : 0 };
                  }
                  acc[p.item_name].qty += p.quantity;
                  acc[p.item_name].total += parseFloat(p.total);
                  return acc;
                }, {})
              ).map(([name, data]) => (
                <tr key={name}>
                  <td style={{ padding: '3px 0' }}>{name}</td>
                  <td style={{ textAlign: 'center', padding: '3px 0' }}>{data.qty}</td>
                  <td style={{ textAlign: 'center', padding: '3px 0', color: '#64748b' }}>₹{fmt(data.unitPrice)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 0' }}>₹{fmt(data.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={s.receiptDivider} />
          <div style={s.receiptSummary}>
            <div><span>Total Purchases</span><span>₹{fmt(billData.total_purchases)}</span></div>
            <div><span>Advance Given</span><span>₹{fmt(billData.advance_amount)}</span></div>
            {billData.balance_paid > 0 && (
              <div><span>Balance Paid</span><span>₹{fmt(billData.balance_paid)}</span></div>
            )}
            <div style={{ fontWeight: 700, fontSize: 14, borderTop: '1px solid #ccc', paddingTop: 4, marginTop: 4 }}>
              <span>{billData.remaining_balance >= 0 ? 'Balance with you' : 'Amount due to vendor'}</span>
              <span style={{ color: billData.remaining_balance >= 0 ? '#16a34a' : '#dc2626' }}>
                ₹{fmt(Math.abs(billData.remaining_balance))}
              </span>
            </div>
          </div>
          <div style={s.receiptDivider} />
          <p style={{ textAlign: 'center', fontSize: 10, color: '#999' }}>Generated {new Date().toLocaleString('en-IN')}</p>
        </div>
      )}
    </div>
  );
}
