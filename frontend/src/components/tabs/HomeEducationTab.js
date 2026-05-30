import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

const CAT_LABELS  = { tuition: 'Tuition/Fee', transport: 'Transport', food: 'Food/Tiffin', books: 'Books', uniform: 'Uniform/Shoes', activity: 'Activity/Sports', exam: 'Exam/Test', coaching: 'Coaching', other: 'Other' };
const CAT_COLORS  = { tuition: '#1d4ed8', transport: '#f97316', food: '#16a34a', books: '#7e22ce', uniform: '#0369a1', activity: '#f59e0b', exam: '#dc2626', coaching: '#0ea5e9', other: '#64748b' };
const PAYMENT_METHODS = [['cash','Cash'],['card','Card'],['upi','UPI'],['bank','Bank'],['other','Other']];
const EMPTY_FORM  = { family_member: '', date: todayStr(), category: 'tuition', description: '', amount: '', institution: '', academic_year: '', payment_method: 'cash', notes: '' };

export default function HomeEducationTab({ family, showToast, onSaved }) {
  const [expenses, setExpenses]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [filterMember, setFilterMember] = useState('');
  const [filterYear, setFilterYear]     = useState('');

  const activeFamily = family.filter(m => m.is_active);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const params = new URLSearchParams();
    if (filterMember) params.set('family_member_id', filterMember);
    if (filterYear)   params.set('academic_year', filterYear);
    try {
      const r = await fetch(`${API}/api/education-expenses/?${params}`, { headers });
      if (r.ok) setExpenses(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [filterMember, filterYear]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd  = () => { setEditId(null); setForm({ ...EMPTY_FORM, family_member: filterMember || '' }); setShowForm(true); };
  const openEdit = (exp) => {
    setEditId(exp.id);
    setForm({ family_member: exp.family_member ? String(exp.family_member) : '', date: exp.date, category: exp.category, description: exp.description, amount: String(exp.amount), institution: exp.institution || '', academic_year: exp.academic_year || '', payment_method: exp.payment_method, notes: exp.notes || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.description.trim()) { showToast('Description and amount required', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, amount: parseFloat(form.amount), family_member: form.family_member ? parseInt(form.family_member) : null };
    try {
      const url    = editId ? `${API}/api/education-expenses/${editId}/` : `${API}/api/education-expenses/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Expense saved');
      setShowForm(false); setEditId(null); fetchExpenses();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/education-expenses/${id}/`, { method: 'DELETE', headers });
    fetchExpenses();
  };

  // Stats
  const total = expenses.reduce((t, e) => t + e.amount, 0);
  const byMember = expenses.reduce((acc, exp) => {
    const k = exp.family_member || 0;
    acc[k] = (acc[k] || 0) + exp.amount;
    return acc;
  }, {});
  const byCat = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {});

  // Unique academic years in data
  const academicYears = [...new Set(expenses.map(e => e.academic_year).filter(Boolean))].sort().reverse();

  return (
    <div style={s.section}>
      {/* Member filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={() => setFilterMember('')} style={{ ...s.sessionPill, ...(!filterMember ? s.sessionPillActive : {}) }}>All</button>
        {activeFamily.map(m => (
          <button key={m.id} onClick={() => setFilterMember(filterMember === String(m.id) ? '' : String(m.id))}
            style={{ ...s.sessionPill, ...(filterMember === String(m.id) ? s.sessionPillActive : {}) }}>
            {m.avatar || '👤'} {m.name}
          </button>
        ))}
      </div>

      {/* Academic year filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={() => setFilterYear('')} style={{ ...s.sessionPill, ...(!filterYear ? s.sessionPillActive : {}) }}>All Years</button>
        {academicYears.map(y => (
          <button key={y} onClick={() => setFilterYear(filterYear === y ? '' : y)}
            style={{ ...s.sessionPill, ...(filterYear === y ? s.sessionPillActive : {}) }}>{y}</button>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginBottom: 14 }}>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Total</div><div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>₹{fmt(total)}</div></div>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Entries</div><div style={{ fontSize: 18, fontWeight: 700, color: '#1d4ed8' }}>{expenses.length}</div></div>
      </div>

      {/* Per-member breakdown */}
      {!filterMember && Object.keys(byMember).length > 1 && (
        <div style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>By Family Member</div>
          {Object.entries(byMember).sort((a, b) => b[1] - a[1]).map(([memberId, amt]) => {
            const member = activeFamily.find(m => String(m.id) === memberId);
            const pct = Math.min(100, total ? (amt / total) * 100 : 0);
            return (
              <div key={memberId} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{member ? `${member.avatar || '👤'} ${member.name}` : 'Unassigned'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>₹{fmt(amt)}</span>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}><div style={{ height: '100%', width: pct + '%', background: '#1d4ed8', borderRadius: 3 }} /></div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-category breakdown */}
      {Object.keys(byCat).length > 1 && (
        <div style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>By Category</div>
          {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
            const pct = Math.min(100, total ? (amt / total) * 100 : 0);
            const color = CAT_COLORS[cat] || '#64748b';
            return (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{CAT_LABELS[cat] || cat}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>₹{fmt(amt)}</span>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}><div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 3 }} /></div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={showForm ? () => { setShowForm(false); setEditId(null); } : openAdd}
          style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: showForm ? '#64748b' : '#1d4ed8' }}>
          {showForm ? '✕ Cancel' : '📚 Add Expense'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editId ? 'Edit Expense' : 'New Education Expense'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={s.fieldLabel}>Child / Family Member</label>
              <select style={s.input} value={form.family_member} onChange={e => setF('family_member', e.target.value)}>
                <option value="">— unassigned —</option>
                {activeFamily.map(m => <option key={m.id} value={String(m.id)}>{m.avatar || '👤'} {m.name}</option>)}
              </select>
            </div>
            <div><label style={s.fieldLabel}>Date</label><input style={s.input} type="date" value={form.date} onChange={e => setF('date', e.target.value)} /></div>
            <div>
              <label style={s.fieldLabel}>Category</label>
              <select style={s.input} value={form.category} onChange={e => setF('category', e.target.value)}>
                {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label style={s.fieldLabel}>Amount (₹) *</label><input style={s.input} type="number" step="0.01" value={form.amount} onChange={e => setF('amount', e.target.value)} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Description *</label><input style={s.input} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Monthly tuition fee, School trip, Books…" /></div>
            <div><label style={s.fieldLabel}>Institution / School</label><input style={s.input} value={form.institution} onChange={e => setF('institution', e.target.value)} placeholder="ABC Public School" /></div>
            <div><label style={s.fieldLabel}>Academic Year</label><input style={s.input} value={form.academic_year} onChange={e => setF('academic_year', e.target.value)} placeholder="2024-25" /></div>
            <div>
              <label style={s.fieldLabel}>Payment Method</label>
              <select style={s.input} value={form.payment_method} onChange={e => setF('payment_method', e.target.value)}>
                {PAYMENT_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label style={s.fieldLabel}>Notes</label><input style={s.input} value={form.notes} onChange={e => setF('notes', e.target.value)} /></div>
          </div>
          <button type="submit" disabled={saving} style={{ ...s.primaryBtn, width: '100%', marginTop: 10 }}>
            {saving ? 'Saving…' : editId ? '✓ Update' : '✓ Save Expense'}
          </button>
        </form>
      )}

      {loading ? <p style={s.empty}>Loading…</p> : expenses.length === 0 ? <p style={s.empty}>No education expenses yet.</p> : (
        expenses.map(exp => {
          const member = activeFamily.find(m => m.id === exp.family_member);
          const color  = CAT_COLORS[exp.category] || '#64748b';
          return (
            <div key={exp.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${color}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📚</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{exp.description}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color, flexShrink: 0 }}>₹{fmt(exp.amount)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                    {member && <span style={{ fontSize: 10, color: '#1d4ed8', background: '#eff6ff', borderRadius: 4, padding: '1px 5px' }}>{member.avatar || '👤'} {member.name}</span>}
                    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, borderRadius: 4, padding: '1px 5px' }}>{CAT_LABELS[exp.category]}</span>
                    {exp.institution && <span style={{ fontSize: 10, color: '#64748b' }}>{exp.institution}</span>}
                    {exp.academic_year && <span style={{ fontSize: 10, color: '#94a3b8' }}>{exp.academic_year}</span>}
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{fmtD(exp.date)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                  <button onClick={() => openEdit(exp)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#64748b' }}>✏️</button>
                  <button onClick={() => handleDelete(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#cbd5e1' }}>🗑</button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
