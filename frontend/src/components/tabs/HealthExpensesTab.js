import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { styles as s } from '../../styles/dashboard';

const EXPENSE_TYPES = [
  { value: 'medicine',   label: '💊 Medicine',    color: '#3b82f6' },
  { value: 'consulting', label: '🩺 Consulting',   color: '#8b5cf6' },
  { value: 'lab',        label: '🧪 Lab Test',     color: '#f59e0b' },
  { value: 'scan',       label: '🔬 Scan/Imaging', color: '#ec4899' },
  { value: 'other',      label: '🏥 Other',        color: '#6b7280' },
];
const TYPE_MAP = Object.fromEntries(EXPENSE_TYPES.map(t => [t.value, t]));

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'insurance', 'other'];
const PM_LABELS = { cash: '💵 Cash', card: '💳 Card', upi: '📱 UPI', insurance: '🏥 Insurance', other: 'Other' };

// Distinct colour palette for payers (cycles if > 8)
const PAYER_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#db2777','#65a30d'];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function monthStr(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}
function formatMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const emptyForm = () => ({
  expense_type: 'medicine',
  description: '',
  expense_date: todayStr(),
  amount: '',
  payment_method: 'cash',
  paid_by: '',
  patient: '',
  notes: '',
});

export default function HealthExpensesTab({ patients = [], showToast }) {
  const [expenses, setExpenses]     = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [editId, setEditId]         = useState(null);
  const [patientFilter, setPatientFilter] = useState('');
  const [typeFilter, setTypeFilter]       = useState('');
  const [payerFilter, setPayerFilter]     = useState('');
  const [startDate, setStartDate]   = useState(monthStr(-11));
  const [endDate, setEndDate]       = useState(todayStr());
  const [tab, setTab]               = useState('summary');

  const fetchData = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (patientFilter) params.set('patient_id', patientFilter);
    if (typeFilter)    params.set('expense_type', typeFilter);
    if (payerFilter)   params.set('paid_by', payerFilter);
    if (startDate)     params.set('start', startDate);
    if (endDate)       params.set('end', endDate);
    try {
      const [eRes, sRes] = await Promise.all([
        fetch(`${API}/api/health-expenses/?${params}`, { headers }),
        fetch(`${API}/api/health-expenses/summary/?${params}`, { headers }),
      ]);
      if (eRes.ok) setExpenses(await eRes.json());
      if (sRes.ok) setSummary(await sRes.json());
    } catch { }
    finally { setLoading(false); }
  }, [patientFilter, typeFilter, payerFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => { setForm(emptyForm()); setEditId(null); };

  const handleSave = async () => {
    if (!form.description.trim()) return showToast('Description is required', 'error');
    if (!form.amount || parseFloat(form.amount) <= 0) return showToast('Enter a valid amount', 'error');

    setSaving(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const payload = {
        expense_type:   form.expense_type,
        description:    form.description,
        expense_date:   form.expense_date,
        amount:         parseFloat(form.amount),
        payment_method: form.payment_method,
        paid_by:        form.paid_by,
        patient:        form.patient ? parseInt(form.patient) : null,
        notes:          form.notes,
      };
      const url = editId ? `${API}/api/health-expenses/${editId}/` : `${API}/api/health-expenses/`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        showToast(editId ? 'Updated' : 'Expense recorded', 'success');
        resetForm();
        setTab('list');
        fetchData();
      } else {
        const err = await res.json();
        showToast(Object.values(err).flat().join(' '), 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/health-expenses/${id}/`, { method: 'DELETE', headers });
    if (res.ok) { showToast('Deleted', 'success'); fetchData(); }
    else showToast('Failed', 'error');
  };

  const startEdit = (e) => {
    setEditId(e.id);
    setForm({
      expense_type:   e.expense_type,
      description:    e.description,
      expense_date:   e.expense_date,
      amount:         String(e.amount),
      payment_method: e.payment_method,
      paid_by:        e.paid_by || '',
      patient:        e.patient ? String(e.patient) : '',
      notes:          e.notes || '',
    });
    setTab('add');
  };

  const handleGenerateReport = () => {
    const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const fmtAmt  = (v) => '₹' + parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const filters = [
      typeFilter    && `Type: ${TYPE_MAP[typeFilter]?.label || typeFilter}`,
      patientFilter && `Patient: ${patients.find(p => String(p.id) === patientFilter)?.name || patientFilter}`,
      payerFilter   && `Paid by: ${payerFilter}`,
    ].filter(Boolean);

    // Group expenses by date
    const byDate = expenses.reduce((acc, e) => { (acc[e.expense_date] = acc[e.expense_date] || []).push(e); return acc; }, {});
    const sortedDates = Object.keys(byDate).sort().reverse();

    const typeRows = (summary?.by_type || []).map(t => {
      const info = TYPE_MAP[t.type] || { label: t.type };
      const pct  = totalAmount > 0 ? (t.total / totalAmount * 100).toFixed(1) : '0';
      return `<tr><td>${info.label}</td><td style="text-align:right">${fmtAmt(t.total)}</td><td style="text-align:right;color:#64748b">${pct}%</td></tr>`;
    }).join('');

    const patientRows = (summary?.by_patient || []).map(p =>
      `<tr><td>👤 ${p.patient}</td><td style="text-align:right">${fmtAmt(p.total)}</td></tr>`
    ).join('');

    const payerRows = (summary?.by_payer || []).map(p =>
      `<tr><td>${p.payer}</td><td style="text-align:right">${fmtAmt(p.total)}</td></tr>`
    ).join('');

    const expenseRows = sortedDates.map(date => {
      const dayTotal = byDate[date].reduce((s, e) => s + parseFloat(e.amount), 0);
      const items = byDate[date].map(e => {
        const info = TYPE_MAP[e.expense_type] || { label: e.expense_type };
        return `<tr>
          <td style="padding:4px 12px 4px 28px;color:#555">${info.label}</td>
          <td style="padding:4px 12px;color:#555">${e.description}${e.patient_name ? ` <span style="color:#94a3b8">(${e.patient_name})</span>` : ''}</td>
          <td style="padding:4px 12px;color:#555">${e.paid_by || '—'}</td>
          <td style="padding:4px 12px;color:#555">${PM_LABELS[e.payment_method] || e.payment_method}</td>
          <td style="padding:4px 12px;text-align:right;color:#555">${fmtAmt(e.amount)}</td>
        </tr>`;
      }).join('');
      return `<tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-weight:700" colspan="4">${fmtDate(date)}</td>
        <td style="padding:6px 12px;font-weight:700;text-align:right">${fmtAmt(dayTotal)}</td>
      </tr>${items}`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Medicare Expenses Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#1e293b;background:white;padding:36px}
  h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .sub{font-size:13px;color:#64748b;margin-bottom:6px}
  .filter-tag{display:inline-block;font-size:11px;background:#eff6ff;color:#1d4ed8;border-radius:4px;padding:2px 8px;margin:2px 2px 10px}
  .section-title{font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin:22px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:5px}
  .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px}
  .summary-box{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
  .summary-box table{width:100%;border-collapse:collapse;font-size:12px}
  .summary-box th{text-align:left;padding:7px 12px;background:#f8fafc;font-size:11px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0}
  .summary-box td{padding:6px 12px;border-bottom:1px solid #f1f5f9}
  .summary-box tr:last-child td{border-bottom:none}
  .total-box{margin-bottom:20px;padding:14px 18px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px}
  .total-label{font-size:12px;color:#0369a1;font-weight:600}
  .total-value{font-size:26px;font-weight:800;color:#0369a1}
  table.expenses{width:100%;border-collapse:collapse;font-size:12px}
  table.expenses th{text-align:left;padding:8px 12px;background:#f8fafc;font-size:11px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0}
  table.expenses td{border-bottom:1px solid #f1f5f9}
  .footer{margin-top:40px;font-size:10px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px}@page{margin:15mm}}
</style></head><body>
  <h1>Medicare — Health Expenses Report</h1>
  <div class="sub">Period: ${fmtDate(startDate)} to ${fmtDate(endDate)}</div>
  ${filters.map(f => `<span class="filter-tag">${f}</span>`).join('')}

  <div class="total-box">
    <div class="total-label">Total Healthcare Spend</div>
    <div class="total-value">${fmtAmt(totalAmount)}</div>
    <div style="font-size:12px;color:#0369a1;margin-top:2px">${expenses.length} expense${expenses.length !== 1 ? 's' : ''}</div>
  </div>

  <div class="section-title">Summary</div>
  <div class="summary-grid">
    ${typeRows ? `<div class="summary-box"><table><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th></tr></thead><tbody>${typeRows}</tbody></table></div>` : ''}
    ${patientRows ? `<div class="summary-box"><table><thead><tr><th>Patient</th><th style="text-align:right">Amount</th></tr></thead><tbody>${patientRows}</tbody></table></div>` : ''}
    ${payerRows ? `<div class="summary-box"><table><thead><tr><th>Paid By</th><th style="text-align:right">Amount</th></tr></thead><tbody>${payerRows}</tbody></table></div>` : ''}
  </div>

  <div class="section-title">Expense Detail</div>
  <table class="expenses">
    <thead><tr><th>Category</th><th>Description</th><th>Paid By</th><th>Method</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${expenseRows}</tbody>
    <tfoot><tr style="background:#f0f9ff;font-weight:800">
      <td colspan="4" style="padding:8px 12px">Total</td>
      <td style="padding:8px 12px;text-align:right">${fmtAmt(totalAmount)}</td>
    </tr></tfoot>
  </table>

  <div class="footer">Generated on ${new Date().toLocaleString('en-IN')} · Medicare Expenses Report</div>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const totalAmount    = summary?.total     || 0;
  const byType         = summary?.by_type   || [];
  const byPatient      = summary?.by_patient|| [];
  const byPayer        = summary?.by_payer  || [];
  const byMonth        = summary?.by_month  || [];
  const maxMonthTotal  = Math.max(...byMonth.map(m => m.total), 1);

  // Derive known payers from current summary for the filter dropdown
  const knownPayers = byPayer.filter(p => p.payer !== 'Unspecified').map(p => p.payer);

  // Assign stable colours to payers
  const payerColorMap = {};
  byPayer.forEach((p, i) => { payerColorMap[p.payer] = PAYER_COLORS[i % PAYER_COLORS.length]; });

  return (
    <div style={{ width: '100%' }}>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ ...s.fieldLabel, marginBottom: 3 }}>From</label>
          <input style={{ ...s.input, width: 130 }} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label style={{ ...s.fieldLabel, marginBottom: 3 }}>To</label>
          <input style={{ ...s.input, width: 130 }} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div>
          <label style={{ ...s.fieldLabel, marginBottom: 3 }}>Type</label>
          <select style={{ ...s.input, width: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ ...s.fieldLabel, marginBottom: 3 }}>Patient</label>
          <select style={{ ...s.input, width: 130 }} value={patientFilter} onChange={e => setPatientFilter(e.target.value)}>
            <option value="">All</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ ...s.fieldLabel, marginBottom: 3 }}>Paid By</label>
          <select style={{ ...s.input, width: 130 }} value={payerFilter} onChange={e => setPayerFilter(e.target.value)}>
            <option value="">Anyone</option>
            {knownPayers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* ── Sub-tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['summary','📊 Summary'],['list','📋 List'],['add', editId ? '✏ Edit' : '➕ Add']].map(([v, lbl]) => (
          <button key={v} onClick={() => { setTab(v); if (v !== 'add' && !editId) resetForm(); }} style={{
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
            backgroundColor: tab === v ? 'var(--primary)' : 'var(--bg-secondary)',
            color: tab === v ? 'white' : 'var(--text)',
            border: `1px solid ${tab === v ? 'var(--primary)' : 'var(--border)'}`,
          }}>{lbl}</button>
        ))}
        <button onClick={handleGenerateReport} disabled={expenses.length === 0}
          style={{ padding: '7px 14px', borderRadius: 8, cursor: expenses.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13, backgroundColor: '#7e22ce', color: 'white', border: 'none', opacity: expenses.length === 0 ? 0.5 : 1, marginLeft: 'auto' }}>
          📄 Generate Report
        </button>
      </div>

      {/* ── Summary tab ── */}
      {tab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Total card */}
          <div style={{ ...s.card, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase' }}>Total Healthcare Spend</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--accent)' }}>₹{parseFloat(totalAmount).toFixed(2)}</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{expenses.length} entries</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* By category */}
            {byType.length > 0 && (
              <div style={s.card}>
                <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)' }}>By Category</div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {byType.map(t => {
                    const info = TYPE_MAP[t.type] || { label: t.type, color: '#6b7280' };
                    const pct = totalAmount > 0 ? (t.total / totalAmount * 100) : 0;
                    return (
                      <div key={t.type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span>{info.label}</span>
                          <span style={{ fontWeight: 700 }}>₹{t.total.toFixed(0)} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div style={{ height: 8, backgroundColor: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: info.color, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* By payer */}
            {byPayer.length > 0 && (
              <div style={s.card}>
                <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)' }}>By Payer</div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {byPayer.map((p, i) => {
                    const color = PAYER_COLORS[i % PAYER_COLORS.length];
                    const pct = totalAmount > 0 ? (p.total / totalAmount * 100) : 0;
                    return (
                      <div key={p.payer}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
                            {p.payer}
                          </span>
                          <span style={{ fontWeight: 700 }}>₹{p.total.toFixed(0)} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div style={{ height: 8, backgroundColor: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: 4 }} />
                        </div>
                        {/* Click to filter */}
                        <button onClick={() => setPayerFilter(p.payer === 'Unspecified' ? '' : p.payer)}
                          style={{ fontSize: 10, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1 }}>
                          filter by this payer ›
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Donut-style legend summary */}
                <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {byPayer.map((p, i) => (
                    <span key={p.payer} style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 600,
                      backgroundColor: PAYER_COLORS[i % PAYER_COLORS.length] + '22',
                      color: PAYER_COLORS[i % PAYER_COLORS.length],
                      border: `1px solid ${PAYER_COLORS[i % PAYER_COLORS.length]}44`,
                    }}>
                      {p.payer} — ₹{p.total.toFixed(0)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* By patient */}
            {byPatient.length > 1 && (
              <div style={s.card}>
                <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)' }}>By Patient</div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {byPatient.map(p => (
                    <div key={p.patient} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>👤 {p.patient}</span>
                      <span style={{ fontWeight: 700 }}>₹{p.total.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly spend bar chart */}
            {byMonth.length > 0 && (
              <div style={{ ...s.card, gridColumn: byPatient.length > 1 ? 'auto' : '1 / -1' }}>
                <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Monthly Spend</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-faint)' }}>stacked by category</span>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {byMonth.map(m => (
                    <div key={m.month}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>{formatMonth(m.month)}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>₹{m.total.toFixed(0)}</span>
                      </div>
                      <div style={{ height: 12, backgroundColor: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                        {EXPENSE_TYPES.map(t => {
                          const typeTotal = m.by_type?.[t.value] || 0;
                          const w = maxMonthTotal > 0 ? (typeTotal / maxMonthTotal * 100) : 0;
                          return w > 0 ? (
                            <div key={t.value} title={`${t.label}: ₹${typeTotal.toFixed(0)}`}
                              style={{ height: '100%', width: `${w}%`, backgroundColor: t.color }} />
                          ) : null;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EXPENSE_TYPES.map(t => (
                    <span key={t.value} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: t.color, display: 'inline-block' }} />
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {loading && <div style={s.empty}>Loading…</div>}
          {!loading && byType.length === 0 && <div style={s.empty}>No expenses in selected range.</div>}
        </div>
      )}

      {/* ── List tab ── */}
      {tab === 'list' && (
        <div style={s.productsPanel}>
          {loading && <div style={s.empty}>Loading…</div>}
          {!loading && expenses.length === 0 && <div style={s.empty}>No expenses found.</div>}
          {expenses.map(e => {
            const info = TYPE_MAP[e.expense_type] || { label: e.expense_type, color: '#6b7280' };
            return (
              <div key={e.id} style={{ ...s.listRow, flexDirection: 'column', alignItems: 'stretch', gap: 3, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 11, backgroundColor: info.color + '22', color: info.color,
                      padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginRight: 6 }}>
                      {info.label}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{e.description}</span>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 15 }}>₹{parseFloat(e.amount).toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{new Date(e.expense_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span>{PM_LABELS[e.payment_method] || e.payment_method}</span>
                  {e.paid_by && <span>👤 Paid by: <strong>{e.paid_by}</strong></span>}
                  {e.patient_name && <span>🏥 {e.patient_name}</span>}
                </div>
                {e.notes && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{e.notes}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <button style={s.iconBtn} onClick={() => startEdit(e)}>✏ Edit</button>
                  <button style={{ ...s.iconBtn, color: '#dc2626' }} onClick={() => handleDelete(e.id)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit tab ── */}
      {tab === 'add' && (
        <div style={{ ...s.cartPanel, maxWidth: 560 }}>
          <div style={s.panelTitle}>{editId ? '✏ Edit Expense' : '➕ Add Expense'}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={s.fieldLabel}>Category *</label>
              <select style={s.input} value={form.expense_type}
                onChange={e => setForm(f => ({ ...f, expense_type: e.target.value }))}>
                {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label style={s.fieldLabel}>Description *</label>
              <input style={s.input} value={form.description} placeholder="e.g. CBC Blood Test, Apollo Pharmacy"
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Date *</label>
                <input style={s.input} type="date" value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
              <div>
                <label style={s.fieldLabel}>Amount ₹ *</label>
                <input style={s.input} type="number" min="0" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Payment Method</label>
                <select style={s.input} value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PM_LABELS[m]}</option>)}
                </select>
              </div>
              <div>
                <label style={s.fieldLabel}>Paid By</label>
                <input style={s.input} value={form.paid_by} placeholder="e.g. Self, Mom, Insurance"
                  onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
                  list="known-payers" />
                {knownPayers.length > 0 && (
                  <datalist id="known-payers">
                    {knownPayers.map(p => <option key={p} value={p} />)}
                  </datalist>
                )}
              </div>
            </div>

            <div>
              <label style={s.fieldLabel}>Patient (optional)</label>
              <select style={s.input} value={form.patient}
                onChange={e => setForm(f => ({ ...f, patient: e.target.value }))}>
                <option value="">— Household / General —</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label style={s.fieldLabel}>Notes</label>
              <input style={s.input} value={form.notes} placeholder="Optional"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.saveBtn, flex: 1, marginTop: 0 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update' : '💾 Save'}
              </button>
              <button style={s.cancelBtn} onClick={() => { resetForm(); setTab('list'); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
