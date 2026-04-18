import React, { useState, useEffect } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { styles as s } from '../../styles/dashboard';

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'other'];
const PM_LABELS = { cash: '💵 Cash', card: '💳 Card', upi: '📱 UPI', other: 'Other' };

const emptyItem = () => ({ medicine: '', medicine_name: '', quantity: '', unit_cost: '', total_cost: '' });
const emptyForm = () => ({
  purchase_date: new Date().toISOString().slice(0, 10),
  purchased_from: '',
  bill_number: '',
  paid_by: '',
  payment_method: 'cash',
  patient: '',
  notes: '',
  items: [emptyItem()],
});

export default function MedicinePurchaseTab({ medicines = [], patients = [], showToast, onSaved }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const fetchPurchases = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/medicine-purchases/`, { headers });
      if (res.ok) setPurchases(await res.json());
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPurchases(); }, []);

  const resetForm = () => { setForm(emptyForm()); setEditId(null); };

  const setItem = (idx, field, value) => {
    setForm(f => {
      const items = f.items.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: value };
        if (field === 'quantity' || field === 'unit_cost') {
          const qty = parseFloat(field === 'quantity' ? value : updated.quantity) || 0;
          const cost = parseFloat(field === 'unit_cost' ? value : updated.unit_cost) || 0;
          updated.total_cost = (qty * cost).toFixed(2);
        }
        return updated;
      });
      const total = items.reduce((s, it) => s + (parseFloat(it.total_cost) || 0), 0);
      return { ...f, items, total_amount: total.toFixed(2) };
    });
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!form.purchased_from.trim()) return showToast('Pharmacy name is required', 'error');
    if (!form.purchase_date) return showToast('Date is required', 'error');
    const validItems = form.items.filter(it => it.quantity && (it.medicine || it.medicine_name));
    if (!validItems.length) return showToast('Add at least one item with quantity', 'error');

    setSaving(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const total = validItems.reduce((s, it) => s + (parseFloat(it.total_cost) || 0), 0);
      const payload = {
        purchase_date: form.purchase_date,
        purchased_from: form.purchased_from,
        bill_number: form.bill_number,
        paid_by: form.paid_by,
        payment_method: form.payment_method,
        patient: form.patient || null,
        notes: form.notes,
        total_amount: total.toFixed(2),
        items: validItems.map(it => ({
          medicine: it.medicine || null,
          medicine_name: it.medicine_name,
          quantity: parseFloat(it.quantity),
          unit_cost: parseFloat(it.unit_cost) || 0,
          total_cost: parseFloat(it.total_cost) || 0,
        })),
      };
      const url = editId ? `${API}/api/medicine-purchases/${editId}/` : `${API}/api/medicine-purchases/`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        showToast(editId ? 'Purchase updated' : 'Purchase recorded — stock updated', 'success');
        resetForm();
        fetchPurchases();
        onSaved();
      } else {
        const err = await res.json();
        showToast(Object.values(err).flat().join(' '), 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase record?')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/medicine-purchases/${id}/`, { method: 'DELETE', headers });
    if (res.ok) { showToast('Deleted', 'success'); fetchPurchases(); onSaved(); }
    else showToast('Failed to delete', 'error');
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setForm({
      purchase_date: p.purchase_date,
      purchased_from: p.purchased_from,
      bill_number: p.bill_number || '',
      paid_by: p.paid_by || '',
      payment_method: p.payment_method,
      patient: p.patient || '',
      notes: p.notes || '',
      items: p.items.length ? p.items.map(it => ({
        medicine: it.medicine || '',
        medicine_name: it.medicine_name || it.medicine_display || '',
        quantity: String(it.quantity),
        unit_cost: String(it.unit_cost),
        total_cost: String(it.total_cost),
      })) : [emptyItem()],
    });
  };

  // Group purchases by date
  const grouped = purchases.reduce((acc, p) => {
    const d = p.purchase_date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(p);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={s.twoPanel}>

        {/* Left — purchase list */}
        <div style={s.productsPanel}>
          <div style={s.panelTitle}>🏪 Medicine Purchases <span style={s.cartBadge}>{purchases.length}</span></div>

          {loading && <div style={s.empty}>Loading…</div>}
          {!loading && purchases.length === 0 && (
            <div style={s.empty}>No purchases yet. Record your first pharmacy bill.</div>
          )}

          {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, list]) => (
            <div key={date}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: 0.5, padding: '6px 0 3px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
                {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {list.map(p => (
                <div key={p.id} style={{ ...s.listRow, flexDirection: 'column', alignItems: 'stretch', gap: 4, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{p.purchased_from}</span>
                      {p.bill_number && <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>#{p.bill_number}</span>}
                      {p.patient_name && (
                        <span style={{ fontSize: 11, marginLeft: 6, backgroundColor: '#eff6ff', color: '#0369a1', padding: '1px 5px', borderRadius: 4 }}>
                          👤 {p.patient_name}
                        </span>
                      )}
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>₹{parseFloat(p.total_amount).toFixed(2)}</span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{PM_LABELS[p.payment_method] || p.payment_method}</span>
                    {p.paid_by && <span>Paid by: {p.paid_by}</span>}
                    <span>{p.items.length} item{p.items.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    {p.items.map((it, i) => (
                      <span key={i}>
                        {it.medicine_display || it.medicine_name} ×{parseFloat(it.quantity)}
                        {i < p.items.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    <button style={s.iconBtn} onClick={() => startEdit(p)}>✏ Edit</button>
                    <button style={{ ...s.iconBtn, color: '#dc2626' }} onClick={() => handleDelete(p.id)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right — add/edit form */}
        <div style={s.cartPanel}>
          <div style={s.panelTitle}>{editId ? '✏ Edit Purchase' : '➕ Record Purchase'}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Date *</label>
                <input style={s.input} type="date" value={form.purchase_date}
                  onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
              </div>
              <div>
                <label style={s.fieldLabel}>Payment</label>
                <select style={s.input} value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PM_LABELS[m]}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={s.fieldLabel}>Pharmacy / Shop *</label>
              <input style={s.input} value={form.purchased_from} placeholder="e.g. Apollo Pharmacy"
                onChange={e => setForm(f => ({ ...f, purchased_from: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Bill Number</label>
                <input style={s.input} value={form.bill_number} placeholder="Optional"
                  onChange={e => setForm(f => ({ ...f, bill_number: e.target.value }))} />
              </div>
              <div>
                <label style={s.fieldLabel}>Paid By</label>
                <input style={s.input} value={form.paid_by} placeholder="e.g. Self, Mom"
                  onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={s.fieldLabel}>For Patient (optional)</label>
              <select style={s.input} value={form.patient}
                onChange={e => setForm(f => ({ ...f, patient: e.target.value }))}>
                <option value="">— Household / General —</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Line items */}
            <div>
              <label style={{ ...s.fieldLabel, marginBottom: 6 }}>Items *</label>
              {form.items.map((item, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 6, backgroundColor: 'var(--bg2)' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <label style={s.fieldLabel}>Medicine</label>
                      <select style={s.input} value={item.medicine}
                        onChange={e => {
                          const med = medicines.find(m => String(m.id) === e.target.value);
                          setItem(idx, 'medicine', e.target.value);
                          if (med) setItem(idx, 'medicine_name', med.medicine_name);
                        }}>
                        <option value="">— Free text below —</option>
                        {medicines.map(m => <option key={m.id} value={m.id}>{m.medicine_name}{m.strength ? ` ${m.strength}` : ''}</option>)}
                      </select>
                    </div>
                    {form.items.length > 1 && (
                      <button style={{ ...s.iconBtn, color: '#dc2626', marginTop: 16, flexShrink: 0 }}
                        onClick={() => removeItem(idx)}>✕</button>
                    )}
                  </div>
                  {!item.medicine && (
                    <div style={{ marginBottom: 6 }}>
                      <label style={s.fieldLabel}>Medicine Name (if not in list)</label>
                      <input style={s.input} value={item.medicine_name} placeholder="e.g. Metformin 500mg"
                        onChange={e => setItem(idx, 'medicine_name', e.target.value)} />
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div>
                      <label style={s.fieldLabel}>Qty</label>
                      <input style={s.input} type="number" min="0" step="1" value={item.quantity} placeholder="0"
                        onChange={e => setItem(idx, 'quantity', e.target.value)} />
                    </div>
                    <div>
                      <label style={s.fieldLabel}>Unit Cost ₹</label>
                      <input style={s.input} type="number" min="0" step="0.01" value={item.unit_cost} placeholder="0.00"
                        onChange={e => setItem(idx, 'unit_cost', e.target.value)} />
                    </div>
                    <div>
                      <label style={s.fieldLabel}>Total ₹</label>
                      <input style={{ ...s.input, backgroundColor: 'var(--bg2)', fontWeight: 700 }}
                        readOnly value={item.total_cost || ''} placeholder="0.00" />
                    </div>
                  </div>
                </div>
              ))}
              <button style={{ ...s.secondaryBtn, width: '100%', marginTop: 4 }} onClick={addItem}>
                + Add Item
              </button>
            </div>

            <div>
              <label style={s.fieldLabel}>Notes</label>
              <input style={s.input} value={form.notes} placeholder="Optional notes"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0',
              borderTop: '1px solid var(--border)', fontWeight: 700, fontSize: 15 }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent)' }}>
                ₹{form.items.reduce((s, it) => s + (parseFloat(it.total_cost) || 0), 0).toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.saveBtn, flex: 1, marginTop: 0 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update Purchase' : '💾 Save & Update Stock'}
              </button>
              {editId && <button style={s.cancelBtn} onClick={resetForm}>Cancel</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
