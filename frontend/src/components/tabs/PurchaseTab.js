import React, { useState } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { todayStr, fmt, fmtShort, fmtD } from '../../utils/date';
import { ITEM_META } from '../../constants/itemMeta';
import { styles as s } from '../../styles/dashboard';

export default function PurchaseTab({ items, advances, showToast, onSaved }) {
  const [cart, setCart] = useState({});
  const [purchaseDate, setPurchaseDate] = useState(todayStr());
  const [cartAdvance, setCartAdvance] = useState('');
  const [saving, setSaving] = useState(false);

  const sortedAdvances = [...advances].sort((a, b) =>
    b.date.localeCompare(a.date) || b.id - a.id
  );
  const latestAdvance = sortedAdvances[0] || null;

  const addToCart = (id) => setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const changeQty = (id, d) => setCart(prev => {
    const n = Math.max(0, (prev[id] || 0) + d);
    const u = { ...prev, [id]: n };
    if (n === 0) delete u[id];
    return u;
  });
  const cartTotal = items.reduce((s, i) => s + (cart[i.id] || 0) * i.price, 0);
  const cartCount = Object.values(cart).reduce((s, v) => s + v, 0);

  const onDragStart = (e, id) => e.dataTransfer.setData('itemId', String(id));
  const onDrop = (e) => { e.preventDefault(); addToCart(parseInt(e.dataTransfer.getData('itemId'))); };
  const onDragOver = (e) => e.preventDefault();

  const handleSavePurchase = async () => {
    if (cartCount === 0) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setSaving(true);
    try {
      const advanceId = cartAdvance || (latestAdvance ? String(latestAdvance.id) : '');
      const results = await Promise.all(
        items.filter(i => cart[i.id] > 0).map(item =>
          fetch(`${API}/api/purchases/`, {
            method: 'POST', headers,
            body: JSON.stringify({
              item: item.id,
              quantity: cart[item.id],
              date: purchaseDate,
              advance: advanceId || undefined,
            }),
          })
        )
      );
      if (results.find(r => !r.ok)) showToast('Error saving some purchases', 'error');
      else { setCart({}); showToast('✓ Purchases saved!'); onSaved(); }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <style>{`
        .two-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 600px) { .two-panel { grid-template-columns: 1fr; } }
      `}</style>

      {/* Date + Cycle selector */}
      <div style={{ ...s.card, marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={s.fieldLabel}>Purchase Date</label>
          <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
            style={{ ...s.inlineInput, fontSize: 14, fontWeight: 600 }} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={s.fieldLabel}>Link to Payment Cycle</label>
          <select value={cartAdvance} onChange={e => setCartAdvance(e.target.value)} style={s.input}>
            <option value="">Latest — {latestAdvance ? `₹${latestAdvance.amount} on ${fmtShort(latestAdvance.date)}` : 'no payment recorded'}</option>
            {sortedAdvances.map(adv => (
              <option key={adv.id} value={String(adv.id)}>
                {fmtD(adv.date)} · ₹{adv.amount} advance{adv.balance_paid > 0 ? ` + ₹${adv.balance_paid} bal` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="two-panel">
        {/* Products */}
        <div style={s.productsPanel}>
          <div style={s.panelTitle}>Available Products</div>
          {items.map(item => {
            const meta = ITEM_META[item.name] || { img: '', accent: '#475569', tag: '' };
            return (
              <div key={item.id} draggable onDragStart={e => onDragStart(e, item.id)}
                style={{ ...s.productRow, borderLeft: `4px solid ${meta.accent}` }}>
                <img src={meta.img} alt={item.name} style={s.productImg}
                  onError={e => { e.target.style.display = 'none'; }} />
                <div style={s.productInfo}>
                  <div style={s.productName}>{item.name}</div>
                  <div style={s.productTag}>{meta.tag}</div>
                  <div style={{ ...s.productPrice, color: meta.accent }}>₹{item.price}/unit</div>
                </div>
                <button onClick={() => addToCart(item.id)} style={{ ...s.addBtn, backgroundColor: meta.accent }}>
                  + Add
                </button>
              </div>
            );
          })}
        </div>

        {/* Cart */}
        <div style={s.cartPanel} onDrop={onDrop} onDragOver={onDragOver}>
          <div style={s.panelTitle}>
            Today's Order
            {cartCount > 0 && <span style={s.cartBadge}>{cartCount}</span>}
          </div>
          {cartCount === 0 ? (
            <div style={s.cartEmpty}>
              <div style={{ fontSize: 32 }}>🛒</div>
              <div>Tap + Add or drag items here</div>
            </div>
          ) : (
            <>
              {items.filter(i => cart[i.id] > 0).map(item => {
                const meta = ITEM_META[item.name] || { accent: '#475569' };
                return (
                  <div key={item.id} style={s.cartRow}>
                    <img src={(ITEM_META[item.name] || {}).img} alt={item.name} style={s.cartImg}
                      onError={e => { e.target.style.display = 'none'; }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>₹{item.price}/unit</div>
                    </div>
                    <div style={s.qtyCtrl}>
                      <button onClick={() => changeQty(item.id, -1)} style={{ ...s.qtyBtn, borderColor: meta.accent, color: meta.accent }}>−</button>
                      <span style={s.qtyNum}>{cart[item.id]}</span>
                      <button onClick={() => changeQty(item.id, 1)} style={{ ...s.qtyBtnFill, backgroundColor: meta.accent }}>+</button>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 52 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>₹{fmt(cart[item.id] * item.price)}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{cart[item.id]}×₹{item.price}</div>
                    </div>
                  </div>
                );
              })}
              <div style={s.cartTotal}>
                <span>Total</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: '#1d4ed8' }}>₹{fmt(cartTotal)}</span>
              </div>
              <button onClick={handleSavePurchase} disabled={saving} style={s.saveBtn}>
                {saving ? 'Saving…' : `✓ Save · ₹${fmt(cartTotal)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
