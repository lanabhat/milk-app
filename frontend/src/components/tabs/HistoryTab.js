import React, { useState } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, fmtShort } from '../../utils/date';
import { ITEM_META } from '../../constants/itemMeta';
import { styles as s } from '../../styles/dashboard';

export default function HistoryTab({ advances, purchases, showToast, onRefresh }) {
  const [histCycle, setHistCycle] = useState('latest');
  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editDate, setEditDate] = useState('');

  const sortedAdvances = [...advances].sort((a, b) =>
    b.date.localeCompare(a.date) || b.id - a.id
  );
  const latestAdvance = sortedAdvances[0] || null;

  const selectedAdv = histCycle === 'latest'
    ? latestAdvance
    : advances.find(a => String(a.id) === String(histCycle)) || null;

  const displayPurchases = selectedAdv
    ? purchases.filter(p => p.advance === selectedAdv.id)
    : purchases.filter(p => !p.advance);

  const byDate = displayPurchases.reduce((acc, p) => {
    acc[p.date] = acc[p.date] || []; acc[p.date].push(p); return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const cycleBalance = (adv) => {
    const linked = purchases.filter(p => p.advance === adv.id);
    return adv.amount - linked.reduce((s, p) => s + parseFloat(p.total), 0);
  };
  const cyclePurchasesTotal = (adv) =>
    purchases.filter(p => p.advance === adv.id).reduce((s, p) => s + parseFloat(p.total), 0);

  const startEdit = (p) => { setEditingId(p.id); setEditQty(String(p.quantity)); setEditDate(p.date); };
  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (p) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/purchases/${p.id}/`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ quantity: parseFloat(editQty), date: editDate }),
    });
    if (res.ok) { setEditingId(null); showToast('✓ Updated!'); onRefresh(); }
    else showToast('Error updating', 'error');
  };

  const handleDeletePurchase = async (id) => {
    if (!window.confirm('Delete this purchase?')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/purchases/${id}/`, { method: 'DELETE', headers });
    if (res.ok || res.status === 204) { showToast('Deleted.'); onRefresh(); }
    else showToast('Error deleting', 'error');
  };

  return (
    <div style={s.section}>
      {/* Cycle selector pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Cycle:</span>
        {sortedAdvances.map((adv, idx) => (
          <button key={adv.id}
            onClick={() => setHistCycle(idx === 0 ? 'latest' : String(adv.id))}
            style={{ ...s.sessionPill, ...((histCycle === 'latest' && idx === 0) || String(histCycle) === String(adv.id) ? s.sessionPillActive : {}) }}>
            {idx === 0 ? `Current · ${fmtShort(adv.date)}` : fmtShort(adv.date)}
            {' '}₹{fmt(adv.amount)}
          </button>
        ))}
        {sortedAdvances.length === 0 && <span style={{ fontSize: 12, color: '#94a3b8' }}>No payment cycles yet</span>}
      </div>

      {/* Cycle summary */}
      {selectedAdv && (
        <div style={{ ...s.card, marginBottom: 12, backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <div>
              <strong>{fmtD(selectedAdv.date)}</strong>
              {selectedAdv.description && <span style={{ color: '#64748b', marginLeft: 8 }}>{selectedAdv.description}</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>₹{fmt(selectedAdv.amount)} advance</span>
              {selectedAdv.balance_paid > 0 && <span style={{ color: '#0369a1', marginLeft: 8 }}>+ ₹{fmt(selectedAdv.balance_paid)} bal paid</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12 }}>
            <span style={{ color: '#dc2626' }}>Spent: ₹{fmt(cyclePurchasesTotal(selectedAdv))}</span>
            <span style={{ color: cycleBalance(selectedAdv) >= 0 ? '#2563eb' : '#dc2626', fontWeight: 700 }}>
              Balance: {cycleBalance(selectedAdv) >= 0 ? `₹${fmt(cycleBalance(selectedAdv))} remaining` : `₹${fmt(Math.abs(cycleBalance(selectedAdv)))} over`}
            </span>
          </div>
        </div>
      )}

      <h3 style={s.sectionTitle}>
        Purchases
        {displayPurchases.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
            {displayPurchases.length} entries · ₹{fmt(displayPurchases.reduce((s, p) => s + parseFloat(p.total), 0))}
          </span>
        )}
      </h3>

      {dates.length === 0
        ? <p style={s.empty}>No purchases in this cycle.</p>
        : dates.map(d => {
          const dayItems = byDate[d];
          const dayTotal = dayItems.reduce((sum, p) => sum + parseFloat(p.total), 0);
          return (
            <div key={d} style={{ marginBottom: 16 }}>
              <div style={s.dateHeader}>
                <span style={{ fontWeight: 700 }}>{fmtD(d)}</span>
                <span style={{ fontWeight: 700, color: '#1d4ed8' }}>₹{fmt(dayTotal)}</span>
              </div>
              {dayItems.map(p => {
                const meta = ITEM_META[p.item_name] || { accent: '#475569', img: '' };
                const isEditing = editingId === p.id;
                return (
                  <div key={p.id} style={{ ...s.listRow, borderLeft: isEditing ? `4px solid ${meta.accent}` : '4px solid #e2e8f0', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    {isEditing ? (
                      <>
                        <img src={meta.img} alt={p.item_name} style={s.cartImg} onError={e => { e.target.style.display = 'none'; }} />
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.item_name}</div>
                        <input type="number" min="0.5" step="0.5" value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          style={{ ...s.inlineInput, width: 60 }} autoFocus />
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                          style={{ ...s.inlineInput, width: 130 }} />
                        <button onClick={() => handleSaveEdit(p)} style={s.saveSmBtn}>Save</button>
                        <button onClick={cancelEdit} style={s.cancelBtn}>✕</button>
                      </>
                    ) : (
                      <>
                        <img src={meta.img} alt={p.item_name} style={s.cartImg} onError={e => { e.target.style.display = 'none'; }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.item_name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>qty {p.quantity} · ₹{fmt(parseFloat(p.total) / p.quantity)}/unit</div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>₹{p.total}</span>
                        <button onClick={() => startEdit(p)} style={s.iconBtn} title="Edit">✏️</button>
                        <button onClick={() => handleDeletePurchase(p.id)} style={{ ...s.iconBtn, borderColor: '#fca5a5' }} title="Delete">🗑️</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      }
    </div>
  );
}
