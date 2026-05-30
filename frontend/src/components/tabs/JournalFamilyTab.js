import React, { useState } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { styles as s } from '../../styles/dashboard';

const RELATION_LABELS = { self: 'Self/Me', spouse: 'Spouse', son: 'Son', daughter: 'Daughter', father: 'Father', mother: 'Mother', sibling: 'Sibling', other: 'Other' };
const RELATION_COLORS = { self: '#1d4ed8', spouse: '#be185d', son: '#0369a1', daughter: '#7c3aed', father: '#64748b', mother: '#d97706', sibling: '#0891b2', other: '#475569' };
const AVATARS = ['👤', '👩', '🧑', '👦', '👧', '👴', '👵', '👨', '🧒', '👶'];
const EMPTY_FORM = { name: '', relation: 'other', avatar: '👤' };

export default function JournalFamilyTab({ family, showToast, onSaved }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (m) => { setEditId(m.id); setForm({ name: m.name, relation: m.relation, avatar: m.avatar || '👤' }); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const url    = editId ? `${API}/api/family-members/${editId}/` : `${API}/api/family-members/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Family member added');
      setShowForm(false); setEditId(null); onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (m) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/family-members/${m.id}/`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !m.is_active }) });
    onSaved();
  };

  const active   = family.filter(m => m.is_active);
  const inactive = family.filter(m => !m.is_active);

  return (
    <div style={s.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h3 style={{ ...s.sectionTitle, margin: 0, flex: 1 }}>Family Members ({active.length})</h3>
        <button onClick={showForm ? () => { setShowForm(false); setEditId(null); } : openAdd}
          style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: showForm ? '#64748b' : '#1d4ed8' }}>
          {showForm ? '✕ Cancel' : '+ Add Member'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editId ? 'Edit Member' : 'Add Family Member'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={s.fieldLabel}>Name *</label>
              <input style={s.input} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Mom, Wife, Son 1…" />
            </div>
            <div>
              <label style={s.fieldLabel}>Relation</label>
              <select style={s.input} value={form.relation} onChange={e => setF('relation', e.target.value)}>
                {Object.entries(RELATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={s.fieldLabel}>Avatar</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {AVATARS.map(a => (
                  <button key={a} type="button" onClick={() => setF('avatar', a)}
                    style={{ width: 36, height: 36, borderRadius: 8, fontSize: 20, border: form.avatar === a ? '2px solid #1d4ed8' : '1px solid #e2e8f0', background: form.avatar === a ? '#eff6ff' : 'white', cursor: 'pointer' }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" disabled={saving} style={{ ...s.primaryBtn, width: '100%', marginTop: 10 }}>
            {saving ? 'Saving…' : editId ? '✓ Update' : '✓ Add'}
          </button>
        </form>
      )}

      {active.length === 0 && !showForm && (
        <div style={{ ...s.card, textAlign: 'center', padding: '28px 16px', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👨‍👩‍👧</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No family members yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add yourself and your family to assign todos and track expenses</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {active.map(m => {
          const color = RELATION_COLORS[m.relation] || '#64748b';
          return (
            <div key={m.id} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 12, borderLeft: `4px solid ${color}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                {m.avatar || '👤'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{m.name}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, borderRadius: 6, padding: '2px 8px' }}>
                  {RELATION_LABELS[m.relation] || m.relation}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b' }}>✏️</button>
                <button onClick={() => handleToggle(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#cbd5e1' }} title="Deactivate">🚫</button>
              </div>
            </div>
          );
        })}
      </div>

      {inactive.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Inactive ({inactive.length})</div>
          {inactive.map(m => (
            <div key={m.id} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.5, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{m.avatar || '👤'}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{RELATION_LABELS[m.relation]}</div></div>
              <button onClick={() => handleToggle(m)} style={{ ...s.primaryBtn, fontSize: 11, padding: '4px 10px', backgroundColor: '#16a34a' }}>Reactivate</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
