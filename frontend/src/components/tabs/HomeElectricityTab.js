import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

const EMPTY_FORM = { bill_date: todayStr(), from_date: '', to_date: '', units_consumed: '', amount: '', opening_reading: '', closing_reading: '', meter_number: '', paid: false, paid_date: '', notes: '' };

export default function HomeElectricityTab({ showToast, onSaved }) {
  const [bills, setBills]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const r = await fetch(`${API}/api/electricity-bills/`, { headers });
      if (r.ok) setBills(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-compute units from readings
  const computedUnits = form.opening_reading && form.closing_reading
    ? Math.max(0, parseFloat(form.closing_reading) - parseFloat(form.opening_reading)).toFixed(1) : null;

  const openAdd  = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (b) => {
    setEditId(b.id);
    setForm({ bill_date: b.bill_date, from_date: b.from_date, to_date: b.to_date, units_consumed: String(b.units_consumed), amount: String(b.amount), opening_reading: b.opening_reading != null ? String(b.opening_reading) : '', closing_reading: b.closing_reading != null ? String(b.closing_reading) : '', meter_number: b.meter_number || '', paid: b.paid, paid_date: b.paid_date || '', notes: b.notes || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.units_consumed) { showToast('Amount and units are required', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const units = form.units_consumed ? parseFloat(form.units_consumed) : (computedUnits ? parseFloat(computedUnits) : 0);
    const payload = { ...form, units_consumed: units, amount: parseFloat(form.amount), opening_reading: form.opening_reading ? parseFloat(form.opening_reading) : null, closing_reading: form.closing_reading ? parseFloat(form.closing_reading) : null, paid_date: form.paid_date || null };
    try {
      const url    = editId ? `${API}/api/electricity-bills/${editId}/` : `${API}/api/electricity-bills/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Bill saved');
      setShowForm(false); setEditId(null); fetchBills(); onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/electricity-bills/${id}/`, { method: 'DELETE', headers });
    fetchBills();
  };

  const handleTogglePaid = async (b) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/electricity-bills/${b.id}/`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ paid: !b.paid, paid_date: !b.paid ? todayStr() : null }) });
    fetchBills();
  };

  // Stats
  const thisYear = new Date().getFullYear();
  const yearBills = bills.filter(b => b.bill_date.startsWith(String(thisYear)));
  const totalYear = yearBills.reduce((t, b) => t + b.amount, 0);
  const totalUnits = yearBills.reduce((t, b) => t + b.units_consumed, 0);
  const avgCost = yearBills.length > 0 ? totalYear / yearBills.length : 0;
  const avgUnits = yearBills.length > 0 ? totalUnits / yearBills.length : 0;
  const unpaidCount = bills.filter(b => !b.paid).length;

  // SVG chart: monthly bill amounts (last 12 months)
  const monthlyData = (() => {
    const m = {};
    bills.forEach(b => { const k = b.bill_date.slice(0, 7); m[k] = (m[k] || 0) + b.amount; });
    return Object.entries(m).sort().slice(-12);
  })();
  const maxAmt = Math.max(...monthlyData.map(([, v]) => v), 1);

  return (
    <div style={s.section}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: `${thisYear} Total`,   value: '₹' + fmt(totalYear),          color: '#dc2626' },
          { label: 'Avg/Month',           value: '₹' + fmt(avgCost),            color: '#f97316' },
          { label: 'Avg Units',           value: avgUnits.toFixed(0) + ' u',    color: '#0369a1' },
          { label: 'Unpaid Bills',        value: unpaidCount,                    color: unpaidCount > 0 ? '#dc2626' : '#16a34a' },
        ].map(c => (
          <div key={c.label} style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {monthlyData.length > 1 && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 8px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Monthly bill (₹)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {monthlyData.map(([month, val]) => (
              <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${month}: ₹${fmt(val)}`}>
                <div style={{ width: '100%', background: '#a855f7', borderRadius: '3px 3px 0 0', height: Math.max(2, (val / maxAmt) * 70) }} />
                <div style={{ fontSize: 8, color: '#94a3b8', whiteSpace: 'nowrap' }}>{month.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={showForm ? () => { setShowForm(false); setEditId(null); } : openAdd}
          style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: showForm ? '#64748b' : '#a855f7' }}>
          {showForm ? '✕ Cancel' : '⚡ Add Bill'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editId ? 'Edit Bill' : 'New Electricity Bill'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={s.fieldLabel}>Bill Date</label><input style={s.input} type="date" value={form.bill_date} onChange={e => setF('bill_date', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Meter Number</label><input style={s.input} value={form.meter_number} onChange={e => setF('meter_number', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>From Date</label><input style={s.input} type="date" value={form.from_date} onChange={e => setF('from_date', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>To Date</label><input style={s.input} type="date" value={form.to_date} onChange={e => setF('to_date', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Opening Reading (units)</label><input style={s.input} type="number" value={form.opening_reading} onChange={e => setF('opening_reading', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Closing Reading (units)</label><input style={s.input} type="number" value={form.closing_reading} onChange={e => setF('closing_reading', e.target.value)} /></div>
            {computedUnits && <div style={{ gridColumn: '1 / -1', padding: '5px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 12, color: '#16a34a', fontWeight: 700 }}>Units consumed: {computedUnits}</div>}
            <div><label style={s.fieldLabel}>Units Consumed</label><input style={s.input} type="number" step="0.1" value={form.units_consumed} onChange={e => setF('units_consumed', e.target.value)} placeholder={computedUnits || ''} /></div>
            <div><label style={s.fieldLabel}>Amount (₹) *</label><input style={s.input} type="number" step="0.01" value={form.amount} onChange={e => setF('amount', e.target.value)} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><label style={{ ...s.fieldLabel, margin: 0 }}>Paid</label><input type="checkbox" checked={form.paid} onChange={e => setF('paid', e.target.checked)} style={{ width: 18, height: 18 }} /></div>
            {form.paid && <div><label style={s.fieldLabel}>Paid Date</label><input style={s.input} type="date" value={form.paid_date} onChange={e => setF('paid_date', e.target.value)} /></div>}
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Notes</label><input style={s.input} value={form.notes} onChange={e => setF('notes', e.target.value)} /></div>
          </div>
          <button type="submit" disabled={saving} style={{ ...s.primaryBtn, width: '100%', marginTop: 10, backgroundColor: '#a855f7' }}>
            {saving ? 'Saving…' : editId ? '✓ Update' : '✓ Save Bill'}
          </button>
        </form>
      )}

      {loading ? <p style={s.empty}>Loading…</p> : bills.length === 0 ? <p style={s.empty}>No electricity bills yet.</p> : (
        bills.map(bill => (
          <div key={bill.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${bill.paid ? '#16a34a' : '#dc2626'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtD(bill.bill_date)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: bill.paid ? '#16a34a' : '#dc2626', background: bill.paid ? '#dcfce7' : '#fee2e2', borderRadius: 4, padding: '1px 5px' }}>{bill.paid ? '✓ Paid' : 'Unpaid'}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{fmtD(bill.from_date)} – {fmtD(bill.to_date)} · {bill.units_consumed} units</div>
                {bill.cost_per_unit && <div style={{ fontSize: 11, color: '#94a3b8' }}>₹{bill.cost_per_unit}/unit</div>}
                <div style={{ fontSize: 16, fontWeight: 800, color: '#a855f7' }}>₹{fmt(bill.amount)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                <button onClick={() => handleTogglePaid(bill)} style={{ ...s.primaryBtn, fontSize: 10, padding: '3px 8px', backgroundColor: bill.paid ? '#64748b' : '#16a34a' }}>{bill.paid ? 'Unmark' : '✓ Mark Paid'}</button>
                <button onClick={() => openEdit(bill)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 15 }}>✏️</button>
                <button onClick={() => handleDelete(bill.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 15 }}>🗑</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
