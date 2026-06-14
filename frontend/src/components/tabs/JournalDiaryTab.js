import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';
import Modal from '../common/Modal';

const EMPTY_FORM = { title: '', content: '', owner: '', tags: '', entry_date: todayStr(), related_trip: '' };

export default function JournalDiaryTab({ family, vehicles, showToast, onSaved }) {
  const [entries, setEntries]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [editId, setEditId]         = useState(null);
  const [saving, setSaving]         = useState(false);
  const [expandId, setExpandId]     = useState(null);
  const [noteText, setNoteText]     = useState({});
  const [expForm, setExpForm]       = useState({});
  const [showExpForm, setShowExpForm] = useState({});
  const [trips, setTrips]           = useState([]);
  const [filterOwner, setFilterOwner] = useState('');

  const activeFamily = family.filter(m => m.is_active);

  useEffect(() => {
    if (vehicles.length > 0) {
      const headers = getAuthHeaders();
      if (!headers) return;
      Promise.all(vehicles.map(v => fetch(`${API}/api/trips/?vehicle_id=${v.id}`, { headers }).then(r => r.ok ? r.json() : [])))
        .then(all => setTrips(all.flat()));
    }
  }, [vehicles]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const params = new URLSearchParams({ entry_type: 'note' });
    if (filterOwner) params.set('owner_id', filterOwner);
    try {
      const r = await fetch(`${API}/api/diary-entries/?${params}`, { headers });
      if (r.ok) setEntries(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [filterOwner]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (e) => {
    setEditId(e.id);
    setForm({ title: e.title, content: e.content || '', owner: e.owner ? String(e.owner) : '', tags: e.tags || '', entry_date: e.entry_date, related_trip: e.related_trip ? String(e.related_trip) : '' });
    setModalOpen(true); setExpandId(null);
  };

  const resetForm = () => { setEditId(null); setForm(EMPTY_FORM); setModalOpen(false); };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Title required', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, entry_type: 'note', owner: form.owner ? parseInt(form.owner) : null, related_trip: form.related_trip ? parseInt(form.related_trip) : null };
    try {
      const url    = editId ? `${API}/api/diary-entries/${editId}/` : `${API}/api/diary-entries/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Entry saved');
      resetForm(); fetchEntries(); onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/diary-entries/${id}/`, { method: 'DELETE', headers });
    fetchEntries();
  };

  const handleAddNote = async (entryId) => {
    const content = noteText[entryId]?.trim();
    if (!content) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/entry-notes/`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ entry: entryId, content }) });
    if (res.ok) { setNoteText(prev => ({ ...prev, [entryId]: '' })); fetchEntries(); }
  };

  const handleDeleteNote = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/entry-notes/${id}/`, { method: 'DELETE', headers });
    fetchEntries();
  };

  const handleAddExpense = async (entryId) => {
    const ef = expForm[entryId] || {};
    if (!ef.description?.trim() || !ef.amount) { showToast('Description and amount required', 'error'); return; }
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/entry-expenses/`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry: entryId, description: ef.description, amount: parseFloat(ef.amount), date: ef.date || todayStr(), payment_method: ef.payment_method || 'cash', paid_by: ef.paid_by ? parseInt(ef.paid_by) : null, notes: ef.notes || '' }),
    });
    setExpForm(prev => ({ ...prev, [entryId]: {} })); setShowExpForm(prev => ({ ...prev, [entryId]: false })); fetchEntries();
  };

  const handleDeleteExpense = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/entry-expenses/${id}/`, { method: 'DELETE', headers });
    fetchEntries();
  };

  const grouped = entries.reduce((acc, e) => {
    if (!acc[e.entry_date]) acc[e.entry_date] = [];
    acc[e.entry_date].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort().reverse();

  return (
    <div style={s.section}>
      {/* Owner filter */}
      {activeFamily.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={() => setFilterOwner('')} style={{ ...s.sessionPill, ...(!filterOwner ? s.sessionPillActive : {}) }}>All</button>
          {activeFamily.map(m => (
            <button key={m.id} onClick={() => setFilterOwner(filterOwner === String(m.id) ? '' : String(m.id))}
              style={{ ...s.sessionPill, ...(filterOwner === String(m.id) ? s.sessionPillActive : {}) }}>
              {m.avatar || '👤'} {m.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={openAdd} style={{ ...s.addBtn, backgroundColor: '#7e22ce' }}>
          📓 New Entry
        </button>
      </div>

      {loading && <p style={s.empty}>Loading…</p>}
      {!loading && entries.length === 0 && (
        <div style={{ ...s.card, textAlign: 'center', padding: '28px 16px', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📓</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No diary entries yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Capture your thoughts, memories, and moments</div>
        </div>
      )}

      {sortedDates.map(date => (
        <div key={date}>
          <div style={{ ...s.dateHeader, marginBottom: 8 }}>{fmtD(date)}</div>
          {grouped[date].map(entry => {
            const expanded = expandId === entry.id;
            const owner    = activeFamily.find(m => m.id === entry.owner);
            const ef       = expForm[entry.id] || {};
            const setEF    = (k, v) => setExpForm(prev => ({ ...prev, [entry.id]: { ...(prev[entry.id] || {}), [k]: v } }));

            return (
              <div key={entry.id} style={{ ...s.card, marginBottom: 8, borderLeft: '4px solid #7e22ce' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setExpandId(expanded ? null : entry.id)}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {owner?.avatar || '📓'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                      {owner && <span style={{ fontSize: 10, color: '#475569', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>{owner.avatar || '👤'} {owner.name}</span>}
                      {entry.tags && entry.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                        <span key={tag} style={{ fontSize: 10, color: '#7e22ce', background: '#f5f3ff', borderRadius: 4, padding: '1px 5px' }}>#{tag}</span>
                      ))}
                      {entry.notes?.length > 0 && <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>💬 {entry.notes.length}</span>}
                      {entry.expense_total > 0 && <span style={{ fontSize: 10, color: '#dc2626', background: '#fee2e2', borderRadius: 4, padding: '1px 5px' }}>₹{fmt(entry.expense_total)}</span>}
                      {entry.related_trip_title && <span style={{ fontSize: 10, color: '#7e22ce', background: '#f5f3ff', borderRadius: 4, padding: '1px 5px' }}>🗺️ {entry.related_trip_title}</span>}
                    </div>
                    {!expanded && entry.content && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.content}</div>
                    )}
                  </div>
                  <span style={{ color: '#94a3b8', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
                </div>

                {expanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    {entry.content && <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{entry.content}</div>}

                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button onClick={() => openEdit(entry)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px' }}>✏️ Edit</button>
                      <button onClick={() => handleDelete(entry.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', backgroundColor: '#ef4444' }}>🗑 Delete</button>
                    </div>

                    {/* Inline notes */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Notes ({entry.notes?.length || 0})</div>
                      {entry.notes?.map(n => (
                        <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#faf5ff', borderRadius: 6, padding: '6px 10px', marginBottom: 4 }}>
                          <div style={{ flex: 1, fontSize: 12, color: '#475569' }}>{n.content}</div>
                          <button onClick={() => handleDeleteNote(n.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}>✕</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <input style={{ ...s.input, flex: 1, fontSize: 12 }} value={noteText[entry.id] || ''} onChange={e => setNoteText(prev => ({ ...prev, [entry.id]: e.target.value }))} placeholder="Add a note…" onKeyDown={e => e.key === 'Enter' && handleAddNote(entry.id)} />
                        <button onClick={() => handleAddNote(entry.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', backgroundColor: '#7e22ce' }}>+ Note</button>
                      </div>
                    </div>

                    {/* Inline expenses */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Expenses ({entry.expenses?.length || 0}){entry.expense_total > 0 && ` · ₹${fmt(entry.expense_total)}`}</div>
                        <button onClick={() => setShowExpForm(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))} style={{ ...s.primaryBtn, fontSize: 10, padding: '3px 8px', backgroundColor: '#7e22ce' }}>+ Add</button>
                      </div>
                      {entry.expenses?.map(exp => (
                        <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#faf5ff', borderRadius: 6, padding: '5px 10px', marginBottom: 3, fontSize: 12 }}>
                          <span>{exp.description}{exp.paid_by_name && ` · ${exp.paid_by_name}`}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>₹{fmt(exp.amount)}</span>
                            <button onClick={() => handleDeleteExpense(exp.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}>✕</button>
                          </div>
                        </div>
                      ))}
                      {showExpForm[entry.id] && (
                        <div style={{ background: '#faf5ff', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <div><label style={s.fieldLabel}>Description *</label><input style={s.input} value={ef.description || ''} onChange={e => setEF('description', e.target.value)} /></div>
                            <div><label style={s.fieldLabel}>Amount (₹) *</label><input style={s.input} type="number" value={ef.amount || ''} onChange={e => setEF('amount', e.target.value)} /></div>
                            <div><label style={s.fieldLabel}>Date</label><input style={s.input} type="date" value={ef.date || todayStr()} onChange={e => setEF('date', e.target.value)} /></div>
                            <div>
                              <label style={s.fieldLabel}>Paid By</label>
                              <select style={s.input} value={ef.paid_by || ''} onChange={e => setEF('paid_by', e.target.value)}>
                                <option value="">—</option>
                                {activeFamily.map(m => <option key={m.id} value={String(m.id)}>{m.avatar || '👤'} {m.name}</option>)}
                              </select>
                            </div>
                          </div>
                          <button onClick={() => handleAddExpense(entry.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', marginTop: 6, backgroundColor: '#7e22ce' }}>✓ Add Expense</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Add / Edit Entry Modal */}
      <Modal open={modalOpen} onClose={resetForm} title={editId ? 'Edit Entry' : 'New Diary Entry'}
        onSave={handleSave} saveLabel={saving ? 'Saving…' : editId ? '✓ Update' : '✓ Save Entry'} saving={saving}>
        <div className="form-grid">
          <label>Title *
            <input style={s.input} value={form.title} onChange={e => setF('title', e.target.value)} placeholder="What's on your mind?" />
          </label>
          <label>Entry
            <textarea style={{ ...s.input, height: 100, resize: 'vertical' }} value={form.content} onChange={e => setF('content', e.target.value)} placeholder="Write your diary entry here…" />
          </label>
          <label>Date
            <input style={s.input} type="date" value={form.entry_date} onChange={e => setF('entry_date', e.target.value)} />
          </label>
          <label>Author (optional)
            <select style={s.input} value={form.owner} onChange={e => setF('owner', e.target.value)}>
              <option value="">—</option>
              {activeFamily.map(m => <option key={m.id} value={String(m.id)}>{m.avatar || '👤'} {m.name}</option>)}
            </select>
          </label>
          <label>Linked Trip (optional)
            <select style={s.input} value={form.related_trip} onChange={e => setF('related_trip', e.target.value)}>
              <option value="">— none —</option>
              {trips.map(t => <option key={t.id} value={String(t.id)}>{t.title} ({t.trip_date})</option>)}
            </select>
          </label>
          <label>Tags
            <input style={s.input} value={form.tags} onChange={e => setF('tags', e.target.value)} placeholder="travel, family, work…" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
