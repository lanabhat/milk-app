import React, { useState } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { todayStr, fmt, fmtD } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

export default function PaymentsTab({ advances, balance, purchases, showToast, onSaved }) {
  const [advAmount, setAdvAmount] = useState('');
  const [advBalPaid, setAdvBalPaid] = useState('');
  const [advDate, setAdvDate] = useState(todayStr());
  const [advDesc, setAdvDesc] = useState('');
  const [advSaving, setAdvSaving] = useState(false);

  const sortedAdvances = [...advances].sort((a, b) =>
    b.date.localeCompare(a.date) || b.id - a.id
  );

  const cyclePurchasesTotal = (adv) =>
    purchases.filter(p => p.advance === adv.id).reduce((s, p) => s + parseFloat(p.total), 0);

  const handleAddAdvance = async (e) => {
    e.preventDefault();
    if (!advAmount) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setAdvSaving(true);
    try {
      const res = await fetch(`${API}/api/advances/`, {
        method: 'POST', headers,
        body: JSON.stringify({
          amount: parseFloat(advAmount),
          balance_paid: parseFloat(advBalPaid || 0),
          date: advDate,
          description: advDesc,
        }),
      });
      if (res.ok) {
        setAdvAmount(''); setAdvBalPaid(''); setAdvDesc('');
        showToast('✓ Payment recorded! New cycle started.');
        onSaved();
      } else showToast('Error recording payment', 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setAdvSaving(false); }
  };

  const handleDeleteAdvance = async (id) => {
    if (!window.confirm('Delete this payment record? All purchases linked to it will be unlinked.')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/advances/${id}/`, { method: 'DELETE', headers });
    if (res.ok || res.status === 204) { showToast('Payment deleted.'); onSaved(); }
    else showToast('Error deleting', 'error');
  };

  return (
    <div style={s.section}>
      <h3 style={s.sectionTitle}>Record a Payment</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
        Each payment starts a new cycle. Record the new advance and any extra paid to clear dues.
      </p>

      <form onSubmit={handleAddAdvance} style={s.card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={s.fieldLabel}>New Advance (₹) <span style={{ color: '#dc2626' }}>*</span></label>
            <input type="number" min="0" placeholder="e.g. 1000" value={advAmount}
              onChange={e => setAdvAmount(e.target.value)} style={s.input} required />
          </div>
          <div>
            <label style={s.fieldLabel}>Balance Paid (₹) <span style={{ color: '#94a3b8', fontWeight: 400 }}>to clear previous dues</span></label>
            <input type="number" min="0" placeholder="e.g. 100 (optional)" value={advBalPaid}
              onChange={e => setAdvBalPaid(e.target.value)} style={s.input} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={s.fieldLabel}>Date</label>
            <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} style={s.input} required />
          </div>
          <div>
            <label style={s.fieldLabel}>Note (optional)</label>
            <input type="text" placeholder="UPI, cash…" value={advDesc}
              onChange={e => setAdvDesc(e.target.value)} style={s.input} />
          </div>
        </div>

        {/* Preview */}
        {(advAmount || advBalPaid) && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>New advance for this cycle</span>
              <strong>₹{fmt(parseFloat(advAmount || 0))}</strong>
            </div>
            {parseFloat(advBalPaid || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>+ Balance paid to clear dues</span>
                <span>₹{fmt(parseFloat(advBalPaid || 0))}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #86efac', paddingTop: 6, marginTop: 6 }}>
              <span>Total you'll pay vendor</span>
              <span>₹{fmt(parseFloat(advAmount || 0) + parseFloat(advBalPaid || 0))}</span>
            </div>
            {balance && balance.current_balance !== undefined && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Previous cycle balance: {balance.current_balance >= 0
                  ? `₹${fmt(balance.current_balance)} remaining with you`
                  : `₹${fmt(Math.abs(balance.current_balance))} owed to vendor`}
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={advSaving} style={s.primaryBtn}>
          {advSaving ? 'Saving…' : '✓ Record Payment & Start New Cycle'}
        </button>
      </form>

      {/* All payment cycles */}
      <h3 style={{ ...s.sectionTitle, marginTop: 24 }}>Payment Cycles</h3>
      {sortedAdvances.length === 0
        ? <p style={s.empty}>No payments recorded yet.</p>
        : sortedAdvances.map((adv, idx) => {
          const spent = cyclePurchasesTotal(adv);
          const bal = adv.amount - spent;
          const isLatest = idx === 0;
          return (
            <div key={adv.id} style={{
              ...s.card, marginBottom: 10,
              borderLeft: `4px solid ${isLatest ? '#16a34a' : '#94a3b8'}`,
              opacity: isLatest ? 1 : 0.85,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtD(adv.date)}</span>
                  {isLatest && <span style={{ marginLeft: 8, fontSize: 11, backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: 4, padding: '1px 6px' }}>Current</span>}
                  {adv.description && <div style={{ fontSize: 12, color: '#64748b' }}>{adv.description}</div>}
                </div>
                <button onClick={() => handleDeleteAdvance(adv.id)}
                  style={{ ...s.iconBtn, borderColor: '#fca5a5' }} title="Delete payment">🗑️</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontSize: 12 }}>
                <div>
                  <div style={{ color: '#94a3b8' }}>Advance</div>
                  <div style={{ fontWeight: 700, color: '#16a34a' }}>₹{fmt(adv.amount)}</div>
                </div>
                {adv.balance_paid > 0 && (
                  <div>
                    <div style={{ color: '#94a3b8' }}>Balance Paid</div>
                    <div style={{ fontWeight: 700, color: '#0369a1' }}>₹{fmt(adv.balance_paid)}</div>
                  </div>
                )}
                <div>
                  <div style={{ color: '#94a3b8' }}>Spent</div>
                  <div style={{ fontWeight: 700, color: '#dc2626' }}>₹{fmt(spent)}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8' }}>Balance</div>
                  <div style={{ fontWeight: 700, color: bal >= 0 ? '#2563eb' : '#dc2626' }}>
                    {bal >= 0 ? `₹${fmt(bal)} left` : `₹${fmt(Math.abs(bal))} over`}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      }
    </div>
  );
}
