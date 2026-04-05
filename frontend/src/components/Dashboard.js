import React, { useEffect, useState, useCallback, useRef } from 'react';

// In production (PythonAnywhere) API is same origin — leave REACT_APP_API_URL blank.
// In development set it to http://localhost:8000
const API = process.env.REACT_APP_API_URL || '';

const ITEM_META = {
  'Nandini Toned Milk 1L':      { img: '/images/toned-milk-1l.jpg',      accent: '#1d4ed8', tag: '1L · Pasteurised' },
  'Nandini Toned Milk 500ml':   { img: '/images/toned-milk-500ml.jpg',   accent: '#0369a1', tag: '500ml · Pasteurised' },
  'Nandini Shubham Gold 500ml': { img: '/images/shubham-gold-500ml.jpg', accent: '#b45309', tag: '500ml · Full Cream' },
  'Kannada Prabha':             { img: '/images/kannada-prabha.jpg',     accent: '#be185d', tag: 'ಕನ್ನಡ ಪ್ರಭ' },
  'New Indian Express':         { img: '/images/new-indian-express.jpg', accent: '#7e22ce', tag: 'English Daily' },
};

const CATEGORY_META = {
  milk:      { label: 'Milk & Dairy',            accent: '#0369a1', icon: '🥛' },
  newspaper: { label: 'Newspaper & Magazine',    accent: '#be185d', icon: '📰' },
  other:     { label: 'Other',                   accent: '#64748b', icon: '📦' },
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/'; return null; }
  return { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' };
};

const todayStr = () => new Date().toISOString().split('T')[0];
const fmt  = v => Number(v).toFixed(0);
const fmtD = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtShort = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export default function Dashboard() {
  // ── Core data ──
  const [items,     setItems]     = useState([]);
  const [purchases, setPurchases] = useState([]);  // all purchases
  const [advances,  setAdvances]  = useState([]);  // all advance payments (= cycles)
  const [balance,   setBalance]   = useState(null);
  const [tab, setTab]             = useState('purchase');
  const [toast, setToast]         = useState(null);
  const [saving, setSaving]       = useState(false);

  // ── Purchase / Cart ──
  const [cart, setCart]               = useState({});
  const [purchaseDate, setPurchaseDate] = useState(todayStr());
  const [cartAdvance, setCartAdvance]  = useState('');  // advance ID to link; '' = latest

  // ── Payments tab ──
  const [advAmount,   setAdvAmount]   = useState('');
  const [advBalPaid,  setAdvBalPaid]  = useState('');  // balance_paid (clearing previous dues)
  const [advDate,     setAdvDate]     = useState(todayStr());
  const [advDesc,     setAdvDesc]     = useState('');
  const [advSaving,   setAdvSaving]   = useState(false);

  // ── History tab ──
  const [histCycle,    setHistCycle]   = useState('latest');  // 'latest' | advance id
  const [editingId,    setEditingId]   = useState(null);
  const [editQty,      setEditQty]     = useState('');
  const [editDate,     setEditDate]    = useState('');

  // ── Bill tab ──
  const [billData,       setBillData]       = useState(null);
  const [billLoading,    setBillLoading]    = useState(false);
  const [billAdvId,      setBillAdvId]      = useState('');
  const [billAdvOverride, setBillAdvOverride] = useState('');
  const billRef = useRef();

  // ── Trends tab ──
  const [trendPeriod,      setTrendPeriod]      = useState('30d');
  const [trendCustomStart, setTrendCustomStart] = useState('');
  const [trendCustomEnd,   setTrendCustomEnd]   = useState(todayStr());

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUnauthorized = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  // ── Fetch all data ──
  const fetchData = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const [ir, pr, ar, br] = await Promise.all([
        fetch(`${API}/api/items/`,             { headers }),
        fetch(`${API}/api/purchases/`,         { headers }),  // all purchases
        fetch(`${API}/api/advances/`,          { headers }),  // all advances
        fetch(`${API}/api/advances/balance/`,  { headers }),
      ]);
      if (ir.status === 401) { handleUnauthorized(); return; }
      const itemData = ir.ok ? await ir.json() : [];
      const pData    = pr.ok ? await pr.json() : [];
      const aData    = ar.ok ? await ar.json() : [];
      // Sort items by frequency
      const counts = {};
      pData.forEach(p => { counts[p.item] = (counts[p.item] || 0) + 1; });
      itemData.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
      setItems(itemData);
      setPurchases(pData);
      setAdvances(aData);
      if (br.ok) setBalance(await br.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('token')) { window.location.href = '/'; return; }
    fetchData();
  }, [fetchData]);

  // ── Derived: cycle helpers ──
  // advances sorted newest first
  const sortedAdvances = [...advances].sort((a, b) =>
    b.date.localeCompare(a.date) || b.id - a.id
  );
  const latestAdvance = sortedAdvances[0] || null;

  const cycleBalance = (adv) => {
    const linked = purchases.filter(p => p.advance === adv.id);
    return adv.amount - linked.reduce((s, p) => s + parseFloat(p.total), 0);
  };
  const cyclePurchasesTotal = (adv) =>
    purchases.filter(p => p.advance === adv.id).reduce((s, p) => s + parseFloat(p.total), 0);

  // ── Cart ──
  const addToCart    = (id)    => setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const changeQty    = (id, d) => setCart(prev => {
    const n = Math.max(0, (prev[id] || 0) + d);
    const u = { ...prev, [id]: n };
    if (n === 0) delete u[id];
    return u;
  });
  const cartTotal = items.reduce((s, i) => s + (cart[i.id] || 0) * i.price, 0);
  const cartCount = Object.values(cart).reduce((s, v) => s + v, 0);

  const onDragStart = (e, id) => e.dataTransfer.setData('itemId', String(id));
  const onDrop      = (e)     => { e.preventDefault(); addToCart(parseInt(e.dataTransfer.getData('itemId'))); };
  const onDragOver  = (e)     => e.preventDefault();

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
      else { setCart({}); showToast('✓ Purchases saved!'); fetchData(); }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  // ── Add Advance / Payment ──
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
          amount:      parseFloat(advAmount),
          balance_paid: parseFloat(advBalPaid || 0),
          date:        advDate,
          description: advDesc,
        }),
      });
      if (res.ok) {
        setAdvAmount(''); setAdvBalPaid(''); setAdvDesc('');
        showToast('✓ Payment recorded! New cycle started.');
        fetchData();
      } else showToast('Error recording payment', 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setAdvSaving(false); }
  };

  const handleDeleteAdvance = async (id) => {
    if (!window.confirm('Delete this payment record? All purchases linked to it will be unlinked.')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/advances/${id}/`, { method: 'DELETE', headers });
    if (res.ok || res.status === 204) { showToast('Payment deleted.'); fetchData(); }
    else showToast('Error deleting', 'error');
  };

  // ── History edit/delete ──
  const startEdit  = (p) => { setEditingId(p.id); setEditQty(String(p.quantity)); setEditDate(p.date); };
  const cancelEdit = ()  => setEditingId(null);

  const handleSaveEdit = async (p) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/purchases/${p.id}/`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ quantity: parseFloat(editQty), date: editDate }),
    });
    if (res.ok) { setEditingId(null); showToast('✓ Updated!'); fetchData(); }
    else showToast('Error updating', 'error');
  };

  const handleDeletePurchase = async (id) => {
    if (!window.confirm('Delete this purchase?')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/purchases/${id}/`, { method: 'DELETE', headers });
    if (res.ok || res.status === 204) { showToast('Deleted.'); fetchData(); }
    else showToast('Error deleting', 'error');
  };

  // ── Bill ──
  const loadBill = async () => {
    setBillLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const params = new URLSearchParams();
      if (billAdvId)      params.set('advance_id',       billAdvId);
      if (billAdvOverride) params.set('advance_override', billAdvOverride);
      const res = await fetch(`${API}/api/bills/cycle_bill/?${params}`, { headers });
      if (res.ok) setBillData(await res.json());
      else showToast('Error loading bill', 'error');
    } catch { showToast('Error loading bill', 'error'); }
    finally { setBillLoading(false); }
  };

  const handlePrint = () => {
    const content = billRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Bill</title><style>
      body{font-family:monospace;font-size:13px;padding:20px;max-width:340px;margin:0 auto}
      h2{text-align:center;font-size:16px;margin:4px 0}p{text-align:center;margin:2px 0;font-size:12px}
      .div{border-top:1px dashed #000;margin:8px 0}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{text-align:left;border-bottom:1px solid #000;padding:2px}td{padding:2px}
      td:last-child{text-align:right}.tr td{font-weight:bold;border-top:1px solid #000;padding-top:4px}
      .sum{margin-top:8px;font-size:13px}.sum div{display:flex;justify-content:space-between}
      @media print{button{display:none}}
    </style></head><body>${content}</body></html>`);
    win.document.close(); win.print();
  };

  // ── Trends ──
  const getTrendRange = () => {
    if (trendPeriod === 'custom') return { start: trendCustomStart, end: trendCustomEnd };
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const f = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const end = f(today);
    const from = new Date(today);
    if      (trendPeriod === '7d')  from.setDate(today.getDate() - 6);
    else if (trendPeriod === '30d') from.setDate(today.getDate() - 29);
    else if (trendPeriod === '3m')  from.setMonth(today.getMonth() - 3);
    else if (trendPeriod === '6m')  from.setMonth(today.getMonth() - 6);
    else if (trendPeriod === '1y')  from.setFullYear(today.getFullYear() - 1);
    else return { start: null, end: null };
    return { start: f(from), end };
  };
  const trendRange    = getTrendRange();
  const trendFiltered = purchases.filter(p =>
    (!trendRange.start || p.date >= trendRange.start) &&
    (!trendRange.end   || p.date <= trendRange.end)
  );
  const trendBuckets = (() => {
    if (trendRange.start && trendRange.end) {
      const b = {};
      const d = new Date(trendRange.start + 'T00:00:00');
      const e = new Date(trendRange.end   + 'T00:00:00');
      while (d <= e) { b[d.toISOString().split('T')[0]] = 0; d.setDate(d.getDate() + 1); }
      trendFiltered.forEach(p => { if (b[p.date] !== undefined) b[p.date] += parseFloat(p.total); });
      return Object.entries(b);
    }
    const m = {};
    purchases.forEach(p => { const k = p.date.slice(0,7); m[k] = (m[k]||0) + parseFloat(p.total); });
    return Object.entries(m).sort();
  })();
  const maxTrend = Math.max(...trendBuckets.map(([,v]) => v), 1);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const handleLogout = async () => {
    const headers = getAuthHeaders();
    if (headers) try { await fetch(`${API}/api/auth/logout/`, { method: 'POST', headers }); } catch {}
    localStorage.removeItem('token'); localStorage.removeItem('user');
    window.location.href = '/';
  };

  const s = styles;

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <span style={s.logo}>🥛 Milk & Paper</span>
        <span style={s.userEmail}>{user.email || ''}</span>
        <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>
      </div>

      {/* ── Balance Bar (current cycle) ── */}
      {balance && (
        <div style={s.balBar}>
          <div style={{ ...s.balCard, backgroundColor: 'white' }}>
            <div style={s.balLabel}>Current Advance</div>
            <div style={{ ...s.balVal, color: '#16a34a' }}>₹{fmt(balance.current_advance_amount)}</div>
            {balance.current_advance_date && (
              <div style={{ fontSize: 9, color: '#94a3b8' }}>since {fmtShort(balance.current_advance_date)}</div>
            )}
          </div>
          <div style={{ ...s.balCard, backgroundColor: 'white' }}>
            <div style={s.balLabel}>Spent This Cycle</div>
            <div style={{ ...s.balVal, color: '#dc2626' }}>₹{fmt(balance.current_purchases)}</div>
          </div>
          <div style={{ ...s.balCard,
            backgroundColor: balance.current_balance < 0 ? '#fef2f2' : 'white',
            borderColor: balance.current_balance < 0 ? '#fca5a5' : '#e2e8f0' }}>
            <div style={s.balLabel}>Cycle Balance</div>
            <div style={{ ...s.balVal, color: balance.current_balance >= 0 ? '#2563eb' : '#dc2626' }}>
              ₹{fmt(Math.abs(balance.current_balance))}
              {balance.current_balance < 0 ? ' owed' : ' left'}
            </div>
          </div>
          {balance.current_balance <= 100 && (
            <div style={s.balWarn}>
              {balance.current_balance < 0
                ? `⚠️ ₹${fmt(Math.abs(balance.current_balance))} over advance — pay vendor`
                : '⚠️ Balance low — make a payment soon'}
            </div>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ ...s.toast,
          backgroundColor: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
          color:           toast.type === 'error' ? '#dc2626' : '#16a34a' }}>
          {toast.msg}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={s.tabBar}>
        {[['purchase','🛒 Purchase'],['payments','💳 Payments'],['history','📋 History'],['bill','🧾 Bill'],['trends','📊 Trends']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }}>
            {label}
          </button>
        ))}
      </div>

      <div style={s.body}>

        {/* ══════════════════════════════════════════
            TAB: PURCHASE
        ══════════════════════════════════════════ */}
        {tab === 'purchase' && (
          <div>
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
            <div style={s.twoPanel}>
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
        )}

        {/* ══════════════════════════════════════════
            TAB: PAYMENTS
        ══════════════════════════════════════════ */}
        {tab === 'payments' && (
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
                const spent   = cyclePurchasesTotal(adv);
                const bal     = adv.amount - spent;
                const isLatest = idx === 0;
                return (
                  <div key={adv.id} style={{ ...s.card, marginBottom: 10,
                    borderLeft: `4px solid ${isLatest ? '#16a34a' : '#94a3b8'}`,
                    opacity: isLatest ? 1 : 0.85 }}>
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
        )}

        {/* ══════════════════════════════════════════
            TAB: HISTORY
        ══════════════════════════════════════════ */}
        {tab === 'history' && (() => {
          // Pick which cycle to display
          const selectedAdv = histCycle === 'latest'
            ? latestAdvance
            : advances.find(a => String(a.id) === String(histCycle)) || null;

          const displayPurchases = selectedAdv
            ? purchases.filter(p => p.advance === selectedAdv.id)
            : purchases.filter(p => !p.advance);  // unlinked (old data)

          const byDate = displayPurchases.reduce((acc, p) => {
            acc[p.date] = acc[p.date] || []; acc[p.date].push(p); return acc;
          }, {});
          const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

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
                                  <div style={{ fontSize: 11, color: '#94a3b8' }}>qty {p.quantity} · ₹{fmt(parseFloat(p.total)/p.quantity)}/unit</div>
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
        })()}

        {/* ══════════════════════════════════════════
            TAB: BILL
        ══════════════════════════════════════════ */}
        {tab === 'bill' && (
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

                {/* Daily breakdown */}
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

                {/* Item summary table */}
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
                        acc[p.item_name].qty   += p.quantity;
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
        )}

        {/* ══════════════════════════════════════════
            TAB: TRENDS
        ══════════════════════════════════════════ */}
        {tab === 'trends' && (() => {
          // Build item-name → category map from live item data
          const itemCatMap = {};
          items.forEach(i => { itemCatMap[i.name] = i.category || 'other'; });

          // Per-category aggregates for filtered period
          const catTotals = {};
          const catQty    = {};
          trendFiltered.forEach(p => {
            const cat = itemCatMap[p.item_name] || 'other';
            catTotals[cat] = (catTotals[cat] || 0) + parseFloat(p.total);
            catQty[cat]    = (catQty[cat]    || 0) + p.quantity;
          });

          // Milk-specific: average per day (qty / active days with milk)
          const milkPurchases = trendFiltered.filter(p => itemCatMap[p.item_name] === 'milk');
          const milkDays      = new Set(milkPurchases.map(p => p.date)).size;
          const milkQtyTotal  = milkPurchases.reduce((s, p) => s + p.quantity, 0);
          const milkAvgPerDay = milkDays > 0 ? milkQtyTotal / milkDays : 0;
          const milkSpend     = catTotals['milk'] || 0;

          // Spending chart uses category-coloured stacked bars for daily view,
          // or simple total for monthly
          const grandTotal = trendFiltered.reduce((s, p) => s + parseFloat(p.total), 0);
          const activeDays = trendBuckets.filter(([, v]) => v > 0).length;

          return (
            <div style={s.section}>
              {/* Period selector */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                {[['7d','7 Days'],['30d','30 Days'],['3m','3 Mo'],['6m','6 Mo'],['1y','1 Year'],['all','All Time'],['custom','Custom']].map(([v, label]) => (
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

              {/* Summary cards row 1 — spending */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, marginBottom: 10 }}>
                {[
                  { label: 'Period Total', value: '₹' + fmt(grandTotal),                                    color: '#1d4ed8' },
                  { label: 'All Time',     value: '₹' + fmt(purchases.reduce((s,p) => s+parseFloat(p.total),0)), color: '#7e22ce' },
                  { label: 'Daily Spend',  value: '₹' + fmt(activeDays ? grandTotal / activeDays : 0),       color: '#0369a1' },
                  { label: 'Active Days',  value: activeDays,                                                 color: '#be185d' },
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
                  { label: '🥛 Milk Qty Total',   value: milkQtyTotal.toFixed(1) + ' L',                   color: '#0369a1' },
                  { label: '🥛 Avg Milk / Day',   value: milkAvgPerDay.toFixed(2) + ' L',                  color: '#1d4ed8' },
                  { label: '🥛 Milk Spend',        value: '₹' + fmt(milkSpend),                             color: '#0369a1' },
                  { label: '🥛 Milk Days',          value: milkDays,                                         color: '#be185d' },
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
                {Object.entries(catTotals).sort((a,b) => b[1]-a[1]).map(([cat, total]) => {
                  const cm  = CATEGORY_META[cat] || CATEGORY_META.other;
                  const qty = catQty[cat] || 0;
                  const pct = Math.min(100, grandTotal ? total / grandTotal * 100 : 0);
                  // item breakdown within this category
                  const catItems = Object.entries(
                    trendFiltered.filter(p => (itemCatMap[p.item_name]||'other') === cat)
                      .reduce((acc, p) => {
                        acc[p.item_name] = acc[p.item_name] || { qty: 0, total: 0 };
                        acc[p.item_name].qty   += p.quantity;
                        acc[p.item_name].total += parseFloat(p.total);
                        return acc;
                      }, {})
                  ).sort((a,b) => b[1].total - a[1].total);

                  return (
                    <div key={cat} style={{ ...s.card, borderLeft: `4px solid ${cm.accent}` }}>
                      {/* Category header */}
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
                      {/* Category bar */}
                      <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 10 }}>
                        <div style={{ height: '100%', width: pct + '%', backgroundColor: cm.accent, borderRadius: 3 }} />
                      </div>
                      {/* Item rows */}
                      {catItems.map(([name, data]) => {
                        const meta  = ITEM_META[name] || { accent: cm.accent, img: '' };
                        const iPct  = Math.min(100, total ? data.total / total * 100 : 0);
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
                      const label = trendPeriod === 'all' ? d.slice(0,7) : d.slice(5);
                      const showLabel = trendPeriod === 'all' || trendBuckets.length <= 14 || d.slice(8) === '01' || d.slice(8) === '15';
                      // Colour bar by dominant category that day
                      const dayPurchases = trendFiltered.filter(p => p.date === d || (trendPeriod === 'all' && p.date.startsWith(d)));
                      const dayCats = {};
                      dayPurchases.forEach(p => {
                        const cat = itemCatMap[p.item_name] || 'other';
                        dayCats[cat] = (dayCats[cat] || 0) + parseFloat(p.total);
                      });
                      const topCat   = Object.entries(dayCats).sort((a,b) => b[1]-a[1])[0];
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
        })()}

      </div>
    </div>
  );
}

const styles = {
  page:      { minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'system-ui,-apple-system,sans-serif' },
  header:    { backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 },
  logo:      { fontSize: 17, fontWeight: 700, color: '#1e293b', flex: 1 },
  userEmail: { fontSize: 12, color: '#94a3b8' },
  logoutBtn: { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: '#64748b' },

  balBar:  { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
  balCard: { flex: 1, minWidth: 90, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', textAlign: 'center' },
  balLabel:{ fontSize: 10, color: '#94a3b8', marginBottom: 2 },
  balVal:  { fontSize: 18, fontWeight: 700 },
  balWarn: { width: '100%', backgroundColor: '#fef9c3', color: '#92400e', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600 },

  toast:   { margin: '8px 16px', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid currentColor' },

  tabBar:    { display: 'flex', gap: 3, padding: '8px 14px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' },
  tab:       { padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', color: '#64748b' },
  tabActive: { backgroundColor: '#1d4ed8', color: 'white' },

  body:    { padding: '14px' },
  section: { maxWidth: 680, margin: '0 auto' },

  twoPanel:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  productsPanel: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  cartPanel:     { backgroundColor: 'white', border: '2px dashed #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 },
  panelTitle:    { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 },
  cartBadge:     { backgroundColor: '#1d4ed8', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: 11 },
  cartEmpty:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, gap: 6, textAlign: 'center' },

  productRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 8, cursor: 'grab', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' },
  productImg:  { width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0, backgroundColor: '#f1f5f9' },
  productInfo: { flex: 1, minWidth: 0 },
  productName: { fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  productTag:  { fontSize: 10, color: '#94a3b8' },
  productPrice:{ fontSize: 13, fontWeight: 700, marginTop: 1 },
  addBtn:      { flexShrink: 0, color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },

  cartRow:   { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' },
  cartImg:   { width: 36, height: 36, objectFit: 'cover', borderRadius: 5, flexShrink: 0, backgroundColor: '#f1f5f9' },
  cartTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0', fontSize: 14 },
  saveBtn:   { backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 8 },

  qtyCtrl:    { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  qtyBtn:     { width: 26, height: 26, borderRadius: '50%', border: '1.5px solid', background: 'white', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyBtnFill: { width: 26, height: 26, borderRadius: '50%', border: 'none', color: 'white', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyNum:     { width: 20, textAlign: 'center', fontSize: 14, fontWeight: 700 },

  fieldLabel:  { fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 2 },
  sectionTitle:{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1e293b' },
  empty:       { color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' },
  card:        { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 },
  listRow:     { display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 9, padding: '10px 12px' },
  dateHeader:  { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', padding: '4px 2px 5px', borderBottom: '1px solid #e2e8f0', marginBottom: 4 },

  input:      { display: 'block', width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  primaryBtn: { backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  cancelBtn:  { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: '#64748b' },
  saveSmBtn:  { backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  iconBtn:    { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 12, flexShrink: 0 },
  inlineInput:{ padding: '5px 7px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, outline: 'none' },

  sessionPill:       { padding: '5px 10px', borderRadius: 20, border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 12, background: 'white', color: '#64748b', fontWeight: 500 },
  sessionPillActive: { backgroundColor: '#1d4ed8', color: 'white', border: '1px solid #1d4ed8' },
  sessionPillSettled:{ backgroundColor: '#7e22ce', color: 'white', border: '1px solid #7e22ce' },

  receipt:        { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 16px', maxWidth: 360, margin: '0 auto', fontFamily: 'monospace' },
  receiptDivider: { borderTop: '1px dashed #ccc', margin: '8px 0' },
  receiptSummary: { fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 },
};
