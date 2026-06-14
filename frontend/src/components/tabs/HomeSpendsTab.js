import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, getDateRange, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';
import Modal from '../common/Modal';

const PAYMENT_METHODS = [['cash','Cash'],['card','Card'],['upi','UPI'],['bank','Bank'],['other','Other']];
const EMPTY_FORM = { date: todayStr(), category: '', description: '', amount: '', store_name: '', paid_by: '', payment_method: 'cash', notes: '' };
const EMPTY_CAT  = { name: '', icon: '', color: '#64748b' };
const PRESET_COLORS = ['#16a34a','#22c55e','#f97316','#0369a1','#eab308','#dc2626','#f59e0b','#06b6d4','#64748b','#a855f7','#3b82f6','#8b5cf6','#0ea5e9','#ef4444','#94a3b8'];
const PRESET_ICONS  = ['🛒','🥦','🍎','🥛','🫙','🍖','🍪','🧹','🔧','⚡','💧','📱','📡','💊','📦','🏠','👗','🚌','🍽','🎓'];

export default function HomeSpendsTab({ family, showToast, onSaved }) {
  const [view, setView]             = useState('spends');
  const [spends, setSpends]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [editId, setEditId]         = useState(null);
  const [saving, setSaving]         = useState(false);
  const [filterCatId, setFilterCatId] = useState('');
  const [period, setPeriod]         = useState('30d');

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catForm, setCatForm]           = useState(EMPTY_CAT);
  const [catEditId, setCatEditId]       = useState(null);
  const [catSaving, setCatSaving]       = useState(false);

  const activeFamily = family.filter(m => m.is_active);

  const fetchCategories = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const r = await fetch(`${API}/api/spend-categories/`, { headers });
    if (r.ok) setCategories(await r.json());
  }, []);

  const range = getDateRange(period, '', todayStr());
  const fetchSpends = useCallback(async () => {
    setLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const params = new URLSearchParams();
    if (filterCatId) params.set('category_id', filterCatId);
    if (range.start) params.set('date_from', range.start);
    if (range.end)   params.set('date_to',   range.end);
    try {
      const r = await fetch(`${API}/api/home-spends/?${params}`, { headers });
      if (r.ok) setSpends(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [filterCatId, range.start, range.end]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchSpends(); }, [fetchSpends]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const resetForm    = () => { setEditId(null); setForm(EMPTY_FORM); setModalOpen(false); };
  const resetCatForm = () => { setCatEditId(null); setCatForm(EMPTY_CAT); setCatModalOpen(false); };

  const openEdit = (sp) => {
    setEditId(sp.id);
    setForm({ date: sp.date, category: sp.category ? String(sp.category) : '', description: sp.description, amount: String(sp.amount), store_name: sp.store_name || '', paid_by: sp.paid_by ? String(sp.paid_by) : '', payment_method: sp.payment_method, notes: sp.notes || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.amount || !form.description.trim()) { showToast('Description and amount required', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, amount: parseFloat(form.amount), category: form.category ? parseInt(form.category) : null, paid_by: form.paid_by ? parseInt(form.paid_by) : null };
    try {
      const url    = editId ? `${API}/api/home-spends/${editId}/` : `${API}/api/home-spends/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Spend saved');
      resetForm(); fetchSpends();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/home-spends/${id}/`, { method: 'DELETE', headers });
    fetchSpends();
  };

  const openCatEdit = (c) => { setCatEditId(c.id); setCatForm({ name: c.name, icon: c.icon || '', color: c.color || '#64748b' }); setCatModalOpen(true); };

  const handleCatSave = async () => {
    if (!catForm.name.trim()) { showToast('Category name required', 'error'); return; }
    setCatSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const url    = catEditId ? `${API}/api/spend-categories/${catEditId}/` : `${API}/api/spend-categories/`;
      const method = catEditId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
      if (!res.ok) throw new Error();
      showToast(catEditId ? '✓ Updated' : '✓ Category added');
      resetCatForm(); fetchCategories();
    } catch { showToast('Failed to save', 'error'); }
    finally { setCatSaving(false); }
  };

  const handleCatDelete = async (c) => {
    if (c.spend_count > 0) { showToast(`Cannot delete — ${c.spend_count} spend(s) linked`, 'error'); return; }
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/spend-categories/${c.id}/`, { method: 'DELETE', headers });
    fetchCategories();
  };

  const totalAmount = spends.reduce((t, sp) => t + sp.amount, 0);
  const byCategory = spends.reduce((acc, sp) => {
    const k = sp.category || 0;
    acc[k] = (acc[k] || 0) + sp.amount;
    return acc;
  }, {});
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const catMap = Object.fromEntries(categories.map(c => [String(c.id), c]));

  const grouped = spends.reduce((acc, sp) => { (acc[sp.date] = acc[sp.date] || []).push(sp); return acc; }, {});
  const sortedDates = Object.keys(grouped).sort().reverse();

  const dailyTotals = spends.reduce((acc, sp) => { acc[sp.date] = (acc[sp.date] || 0) + sp.amount; return acc; }, {});
  const chartData   = Object.entries(dailyTotals).sort();
  const maxDay      = Math.max(...Object.values(dailyTotals), 1);

  return (
    <div style={s.section}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button onClick={() => setView('spends')} style={{ ...s.sessionPill, ...(view === 'spends' ? s.sessionPillActive : {}) }}>💸 Spends</button>
        <button onClick={() => setView('categories')} style={{ ...s.sessionPill, ...(view === 'categories' ? s.sessionPillActive : {}) }}>🏷 Categories ({categories.length})</button>
      </div>

      {/* ── CATEGORIES VIEW ── */}
      {view === 'categories' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => { setCatForm(EMPTY_CAT); setCatEditId(null); setCatModalOpen(true); }} style={s.addBtn}>
              + Add Category
            </button>
          </div>
          {categories.length === 0 && <p style={s.empty}>No categories yet.</p>}
          {categories.map(c => (
            <div key={c.id} style={{ ...s.card, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, borderLeft: `4px solid ${c.color || '#64748b'}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${c.color || '#64748b'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{c.icon || '📦'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.spend_count} spend{c.spend_count !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => openCatEdit(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b' }}>✏️</button>
              <button onClick={() => handleCatDelete(c)} title={c.spend_count > 0 ? `${c.spend_count} spends linked` : 'Delete'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: c.spend_count > 0 ? '#cbd5e1' : '#ef4444' }}>🗑</button>
            </div>
          ))}
        </>
      )}

      {/* ── SPENDS VIEW ── */}
      {view === 'spends' && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {[['7d','7 Days'],['30d','30 Days'],['3m','3 Mo'],['6m','6 Mo'],['1y','1 Year']].map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)} style={{ ...s.sessionPill, ...(period === v ? s.sessionPillActive : {}) }}>{l}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginBottom: 14 }}>
            <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Total</div><div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>₹{fmt(totalAmount)}</div></div>
            <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Entries</div><div style={{ fontSize: 18, fontWeight: 700, color: '#1d4ed8' }}>{spends.length}</div></div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={() => setFilterCatId('')} style={{ ...s.sessionPill, ...(!filterCatId ? s.sessionPillActive : {}) }}>All</button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setFilterCatId(filterCatId === String(c.id) ? '' : String(c.id))}
                style={{ ...s.sessionPill, ...(filterCatId === String(c.id) ? { ...s.sessionPillActive, backgroundColor: c.color, borderColor: c.color } : {}), display: 'flex', alignItems: 'center', gap: 3 }}>
                {c.icon || '📦'} {c.name}
              </button>
            ))}
          </div>

          {!filterCatId && sortedCats.length > 0 && (
            <div style={{ ...s.card, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>By Category</div>
              {sortedCats.map(([catId, total]) => {
                const cat = catMap[catId];
                const pct = Math.min(100, totalAmount ? (total / totalAmount) * 100 : 0);
                return (
                  <div key={catId} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{cat ? `${cat.icon || '📦'} ${cat.name}` : 'Uncategorised'}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>₹{fmt(total)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: pct + '%', background: cat?.color || '#64748b', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {chartData.length > 1 && (
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 8px', marginBottom: 14, overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70, minWidth: Math.max(300, chartData.length * 14) }}>
                {chartData.map(([date, val]) => (
                  <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 8 }} title={`${date}: ₹${fmt(val)}`}>
                    <div style={{ width: '100%', background: '#16a34a', borderRadius: '2px 2px 0 0', height: Math.max(2, (val / maxDay) * 60) }} />
                    {chartData.length <= 15 && <div style={{ fontSize: 7, color: '#94a3b8', whiteSpace: 'nowrap' }}>{date.slice(5)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(true); }} style={s.addBtn}>
              + Add Spend
            </button>
          </div>

          {loading ? <p style={s.empty}>Loading…</p> : spends.length === 0 ? <p style={s.empty}>No spends in this period.</p> : (
            sortedDates.map(date => (
              <div key={date}>
                <div style={{ ...s.dateHeader, marginBottom: 6 }}>{fmtD(date)} · ₹{fmt(grouped[date].reduce((t, sp) => t + sp.amount, 0))}</div>
                {grouped[date].map(sp => {
                  const cat = catMap[String(sp.category)];
                  return (
                    <div key={sp.id} style={{ ...s.card, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${cat?.color || '#64748b'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cat?.icon || '📦'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.description}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                          {cat && <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: `${cat.color}18`, borderRadius: 4, padding: '1px 5px' }}>{cat.name}</span>}
                          {sp.store_name && <span style={{ fontSize: 10, color: '#94a3b8' }}>{sp.store_name}</span>}
                          {sp.paid_by_name && <span style={{ fontSize: 10, color: '#64748b' }}>👤 {sp.paid_by_name}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>₹{fmt(sp.amount)}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                        <button onClick={() => openEdit(sp)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b' }}>✏️</button>
                        <button onClick={() => handleDelete(sp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#cbd5e1' }}>🗑</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </>
      )}

      {/* Spend Modal */}
      <Modal open={modalOpen} onClose={resetForm} title={editId ? 'Edit Spend' : 'Add Spend'}
        onSave={handleSave} saveLabel={saving ? 'Saving…' : editId ? 'Update' : 'Save Spend'} saving={saving}>
        <div className="form-grid">
          <label>Date<input style={s.input} type="date" value={form.date} onChange={e => setF('date', e.target.value)} /></label>
          <label>Amount (₹) *<input style={s.input} type="number" step="0.01" value={form.amount} onChange={e => setF('amount', e.target.value)} /></label>
          <label>Description *<input style={s.input} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Weekly market, Rice bag, Plumber visit…" /></label>
          <label>
            Category
            <select style={s.input} value={form.category} onChange={e => setF('category', e.target.value)}>
              <option value="">— uncategorised —</option>
              {categories.map(c => <option key={c.id} value={String(c.id)}>{c.icon || '📦'} {c.name}</option>)}
            </select>
          </label>
          <label>Store / Vendor<input style={s.input} value={form.store_name} onChange={e => setF('store_name', e.target.value)} placeholder="DMart, Local market…" /></label>
          <label>
            Paid By
            <select style={s.input} value={form.paid_by} onChange={e => setF('paid_by', e.target.value)}>
              <option value="">—</option>
              {activeFamily.map(m => <option key={m.id} value={String(m.id)}>{m.avatar || '👤'} {m.name}</option>)}
            </select>
          </label>
          <label>
            Payment Method
            <select style={s.input} value={form.payment_method} onChange={e => setF('payment_method', e.target.value)}>
              {PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>Notes<input style={s.input} value={form.notes} onChange={e => setF('notes', e.target.value)} /></label>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal open={catModalOpen} onClose={resetCatForm} title={catEditId ? 'Edit Category' : 'Add Category'}
        onSave={handleCatSave} saveLabel={catSaving ? 'Saving…' : catEditId ? 'Update' : 'Add Category'} saving={catSaving}>
        <div className="form-grid">
          <label>Name *<input style={s.input} value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Vegetables, Groceries, Plumber…" /></label>
          <label>
            Icon (emoji)
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {PRESET_ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setCatForm(f => ({ ...f, icon: ic }))}
                  style={{ width: 34, height: 34, borderRadius: 6, fontSize: 18, border: catForm.icon === ic ? '2px solid #1d4ed8' : '1px solid #e2e8f0', background: catForm.icon === ic ? '#eff6ff' : 'white', cursor: 'pointer' }}>{ic}</button>
              ))}
            </div>
          </label>
          <label>
            Color
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setCatForm(f => ({ ...f, color: c }))}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: catForm.color === c ? '3px solid #1e293b' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </label>
        </div>
      </Modal>
    </div>
  );
}
