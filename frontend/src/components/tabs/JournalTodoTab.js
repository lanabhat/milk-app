import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

const PRIORITY_COLOR  = { low: '#64748b', medium: '#0369a1', high: '#f59e0b' };
const PRIORITY_BG     = { low: '#f8fafc',  medium: '#eff6ff', high: '#fef3c7' };
const CRITICAL_COLOR  = { minor: '#64748b', normal: '#0369a1', critical: '#dc2626' };
const STATUS_COLOR    = { open: '#1d4ed8', in_progress: '#f59e0b', done: '#16a34a', cancelled: '#94a3b8' };
const STATUS_LABEL    = { open: 'Open', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' };

const EMPTY_FORM = { title: '', content: '', owner: '', priority: 'medium', criticality: 'normal', status: 'open', due_date: '', tags: '', entry_date: todayStr(), related_trip: '' };

function MemberPill({ m, selected, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: '5px 10px', borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
        background: selected ? '#1d4ed8' : '#f1f5f9', color: selected ? 'white' : '#475569' }}>
      {m.avatar || '👤'} {m.name}
    </button>
  );
}

export default function JournalTodoTab({ family, vehicles, showToast, onSaved }) {
  const [todos, setTodos]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [editId, setEditId]         = useState(null);
  const [saving, setSaving]         = useState(false);
  const [expandId, setExpandId]     = useState(null);
  const [noteText, setNoteText]     = useState({});
  const [expForm, setExpForm]       = useState({});
  const [showExpForm, setShowExpForm] = useState({});
  const [trips, setTrips]           = useState([]);

  // Filters
  const [filterOwner, setFilterOwner]   = useState('');
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterPriority, setFilterPriority] = useState('');

  const activeFamily = family.filter(m => m.is_active);

  useEffect(() => {
    if (vehicles.length > 0) {
      const headers = getAuthHeaders();
      if (!headers) return;
      Promise.all(vehicles.map(v => fetch(`${API}/api/trips/?vehicle_id=${v.id}`, { headers }).then(r => r.ok ? r.json() : [])))
        .then(all => setTrips(all.flat()));
    }
  }, [vehicles]);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const params = new URLSearchParams({ entry_type: 'todo' });
    if (filterOwner)   params.set('owner_id', filterOwner);
    if (filterStatus)  params.set('status', filterStatus);
    if (filterPriority) params.set('priority', filterPriority);
    try {
      const r = await fetch(`${API}/api/diary-entries/?${params}`, { headers });
      if (r.ok) setTodos(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [filterOwner, filterStatus, filterPriority]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (t) => {
    setEditId(t.id);
    setForm({ title: t.title, content: t.content || '', owner: t.owner ? String(t.owner) : '', priority: t.priority, criticality: t.criticality, status: t.status, due_date: t.due_date || '', tags: t.tags || '', entry_date: t.entry_date, related_trip: t.related_trip ? String(t.related_trip) : '' });
    setShowForm(true); setExpandId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast('Title required', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, entry_type: 'todo', owner: form.owner ? parseInt(form.owner) : null, related_trip: form.related_trip ? parseInt(form.related_trip) : null, due_date: form.due_date || null };
    try {
      const url    = editId ? `${API}/api/diary-entries/${editId}/` : `${API}/api/diary-entries/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Todo added');
      setShowForm(false); setEditId(null); fetchTodos(); onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleComplete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/diary-entries/${id}/complete/`, { method: 'POST', headers });
    fetchTodos();
  };

  const handleReopen = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/diary-entries/${id}/reopen/`, { method: 'POST', headers });
    fetchTodos();
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/diary-entries/${id}/`, { method: 'DELETE', headers });
    fetchTodos();
  };

  const handleAddNote = async (entryId) => {
    const content = noteText[entryId]?.trim();
    if (!content) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/entry-notes/`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ entry: entryId, content }) });
    if (res.ok) {
      setNoteText(prev => ({ ...prev, [entryId]: '' }));
      fetchTodos();
    }
  };

  const handleAddExpense = async (entryId) => {
    const ef = expForm[entryId] || {};
    if (!ef.description?.trim() || !ef.amount) { showToast('Description and amount required', 'error'); return; }
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/entry-expenses/`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry: entryId, description: ef.description, amount: parseFloat(ef.amount), date: ef.date || todayStr(), payment_method: ef.payment_method || 'cash', paid_by: ef.paid_by ? parseInt(ef.paid_by) : null, notes: ef.notes || '' }),
    });
    if (res.ok) { setExpForm(prev => ({ ...prev, [entryId]: {} })); setShowExpForm(prev => ({ ...prev, [entryId]: false })); fetchTodos(); }
  };

  const handleDeleteNote = async (noteId) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/entry-notes/${noteId}/`, { method: 'DELETE', headers });
    fetchTodos();
  };

  const handleDeleteExpense = async (expId) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/entry-expenses/${expId}/`, { method: 'DELETE', headers });
    fetchTodos();
  };

  // Sort: critical+high open first, then by due date
  const sorted = [...todos].sort((a, b) => {
    const critScore = { critical: 2, normal: 1, minor: 0 };
    const priScore  = { high: 2, medium: 1, low: 0 };
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    const scoreA = critScore[a.criticality] * 3 + priScore[a.priority];
    const scoreB = critScore[b.criticality] * 3 + priScore[b.priority];
    if (scoreB !== scoreA) return scoreB - scoreA;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  const borderColor = (t) => {
    if (t.criticality === 'critical') return '#dc2626';
    if (t.priority === 'high') return '#f59e0b';
    if (t.priority === 'medium') return '#0369a1';
    return '#e2e8f0';
  };

  return (
    <div style={s.section}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          <button onClick={() => setFilterOwner('')} style={{ ...s.sessionPill, ...(!filterOwner ? s.sessionPillActive : {}) }}>All</button>
          {activeFamily.map(m => (
            <button key={m.id} onClick={() => setFilterOwner(filterOwner === String(m.id) ? '' : String(m.id))}
              style={{ ...s.sessionPill, ...(filterOwner === String(m.id) ? s.sessionPillActive : {}) }}>
              {m.avatar || '👤'} {m.name}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['', 'All Status'], ['open', 'Open'], ['in_progress', 'In Progress'], ['done', 'Done'], ['cancelled', 'Cancelled']].map(([v, l]) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            style={{ ...s.sessionPill, ...(filterStatus === v ? s.sessionPillActive : {}), fontSize: 11, padding: '4px 10px' }}>{l}</button>
        ))}
        <div style={{ width: '100%', height: 0 }} />
        {[['', 'Any Priority'], ['high', '🔴 High'], ['medium', '🟡 Medium'], ['low', '⚪ Low']].map(([v, l]) => (
          <button key={v} onClick={() => setFilterPriority(v)}
            style={{ ...s.sessionPill, ...(filterPriority === v ? s.sessionPillActive : {}), fontSize: 11, padding: '4px 10px' }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={showForm ? () => { setShowForm(false); setEditId(null); } : openAdd}
          style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 14px', backgroundColor: showForm ? '#64748b' : '#1d4ed8' }}>
          {showForm ? '✕ Cancel' : '+ Add Todo'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editId ? 'Edit Todo' : 'New Todo'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Title *</label><input style={s.input} value={form.title} onChange={e => setF('title', e.target.value)} placeholder="What needs to be done?" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Description</label><textarea style={{ ...s.input, height: 70 }} value={form.content} onChange={e => setF('content', e.target.value)} placeholder="Details, context, steps…" /></div>
            <div>
              <label style={s.fieldLabel}>Owner</label>
              <select style={s.input} value={form.owner} onChange={e => setF('owner', e.target.value)}>
                <option value="">— unassigned —</option>
                {activeFamily.map(m => <option key={m.id} value={String(m.id)}>{m.avatar || '👤'} {m.name}</option>)}
              </select>
            </div>
            <div><label style={s.fieldLabel}>Due Date</label><input style={s.input} type="date" value={form.due_date} onChange={e => setF('due_date', e.target.value)} /></div>
            <div>
              <label style={s.fieldLabel}>Priority</label>
              <select style={s.input} value={form.priority} onChange={e => setF('priority', e.target.value)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div>
              <label style={s.fieldLabel}>Criticality</label>
              <select style={s.input} value={form.criticality} onChange={e => setF('criticality', e.target.value)}>
                <option value="minor">Minor</option><option value="normal">Normal</option><option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label style={s.fieldLabel}>Status</label>
              <select style={s.input} value={form.status} onChange={e => setF('status', e.target.value)}>
                <option value="open">Open</option><option value="in_progress">In Progress</option><option value="done">Done</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label style={s.fieldLabel}>Linked Trip (optional)</label>
              <select style={s.input} value={form.related_trip} onChange={e => setF('related_trip', e.target.value)}>
                <option value="">— none —</option>
                {trips.map(t => <option key={t.id} value={String(t.id)}>{t.title} ({t.trip_date})</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Tags (comma-separated)</label><input style={s.input} value={form.tags} onChange={e => setF('tags', e.target.value)} placeholder="home, urgent, shopping" /></div>
          </div>
          <button type="submit" disabled={saving} style={{ ...s.primaryBtn, width: '100%', marginTop: 10 }}>
            {saving ? 'Saving…' : editId ? '✓ Update' : '✓ Add Todo'}
          </button>
        </form>
      )}

      {loading && <p style={s.empty}>Loading…</p>}
      {!loading && sorted.length === 0 && <p style={s.empty}>No todos{filterStatus ? ` with status "${filterStatus}"` : ''}. Add one above.</p>}

      {sorted.map(todo => {
        const expanded = expandId === todo.id;
        const isDone   = todo.status === 'done';
        const owner    = activeFamily.find(m => m.id === todo.owner);
        const ef       = expForm[todo.id] || {};
        const setEF    = (k, v) => setExpForm(prev => ({ ...prev, [todo.id]: { ...(prev[todo.id] || {}), [k]: v } }));

        return (
          <div key={todo.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${borderColor(todo)}`, background: isDone ? '#f8fafc' : 'white', opacity: isDone ? 0.75 : 1 }}>
            {/* Header row */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setExpandId(expanded ? null : todo.id)}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: isDone ? '#dcfce7' : PRIORITY_BG[todo.priority], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {isDone ? '✅' : todo.criticality === 'critical' ? '🔴' : todo.priority === 'high' ? '🟡' : '⚪'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isDone ? '#64748b' : '#1e293b', textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {todo.title}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[todo.status], background: `${STATUS_COLOR[todo.status]}18`, borderRadius: 4, padding: '1px 5px' }}>{STATUS_LABEL[todo.status]}</span>
                  {todo.criticality !== 'normal' && <span style={{ fontSize: 10, fontWeight: 700, color: CRITICAL_COLOR[todo.criticality], background: '#fee2e2', borderRadius: 4, padding: '1px 5px' }}>{todo.criticality}</span>}
                  <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[todo.priority], background: PRIORITY_BG[todo.priority], borderRadius: 4, padding: '1px 5px' }}>{todo.priority} priority</span>
                  {owner && <span style={{ fontSize: 10, color: '#475569', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>{owner.avatar || '👤'} {owner.name}</span>}
                  {todo.due_date && <span style={{ fontSize: 10, color: todo.due_date < todayStr() && !isDone ? '#dc2626' : '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>📅 {fmtD(todo.due_date)}</span>}
                  {todo.expense_total > 0 && <span style={{ fontSize: 10, color: '#dc2626', background: '#fee2e2', borderRadius: 4, padding: '1px 5px' }}>₹{fmt(todo.expense_total)}</span>}
                  {todo.notes?.length > 0 && <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>💬 {todo.notes.length}</span>}
                </div>
              </div>
              <span style={{ color: '#94a3b8', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
            </div>

            {/* Expanded detail */}
            {expanded && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                {todo.content && <p style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.5 }}>{todo.content}</p>}
                {todo.related_trip_title && <div style={{ fontSize: 12, color: '#7e22ce', marginBottom: 8 }}>🗺️ Trip: {todo.related_trip_title}</div>}
                {todo.tags && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>🏷 {todo.tags}</div>}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {!isDone && <button onClick={() => handleComplete(todo.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', backgroundColor: '#16a34a' }}>✓ Mark Done</button>}
                  {isDone && <button onClick={() => handleReopen(todo.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', backgroundColor: '#0369a1' }}>↺ Reopen</button>}
                  <button onClick={() => openEdit(todo)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px' }}>✏️ Edit</button>
                  <button onClick={() => handleDelete(todo.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', backgroundColor: '#ef4444' }}>🗑 Delete</button>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Notes ({todo.notes?.length || 0})</div>
                  {todo.notes?.map(n => (
                    <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#f8fafc', borderRadius: 6, padding: '6px 10px', marginBottom: 4 }}>
                      <div style={{ flex: 1, fontSize: 12, color: '#475569' }}>{n.content}</div>
                      <button onClick={() => handleDeleteNote(n.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <input style={{ ...s.input, flex: 1, fontSize: 12 }} value={noteText[todo.id] || ''} onChange={e => setNoteText(prev => ({ ...prev, [todo.id]: e.target.value }))} placeholder="Add a note…" onKeyDown={e => e.key === 'Enter' && handleAddNote(todo.id)} />
                    <button onClick={() => handleAddNote(todo.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px' }}>+ Note</button>
                  </div>
                </div>

                {/* Expenses */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Expenses ({todo.expenses?.length || 0}) {todo.expense_total > 0 && `· ₹${fmt(todo.expense_total)}`}</div>
                    <button onClick={() => setShowExpForm(prev => ({ ...prev, [todo.id]: !prev[todo.id] }))}
                      style={{ ...s.primaryBtn, fontSize: 10, padding: '3px 8px', backgroundColor: '#7e22ce' }}>+ Add</button>
                  </div>
                  {todo.expenses?.map(exp => (
                    <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: 6, padding: '5px 10px', marginBottom: 3, fontSize: 12 }}>
                      <span>{exp.description}{exp.paid_by_name && ` · ${exp.paid_by_name}`}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>₹{fmt(exp.amount)}</span>
                        <button onClick={() => handleDeleteExpense(exp.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  {showExpForm[todo.id] && (
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
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
                        <div>
                          <label style={s.fieldLabel}>Payment Method</label>
                          <select style={s.input} value={ef.payment_method || 'cash'} onChange={e => setEF('payment_method', e.target.value)}>
                            <option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option><option value="other">Other</option>
                          </select>
                        </div>
                        <div><label style={s.fieldLabel}>Notes</label><input style={s.input} value={ef.notes || ''} onChange={e => setEF('notes', e.target.value)} /></div>
                      </div>
                      <button onClick={() => handleAddExpense(todo.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', marginTop: 6, backgroundColor: '#7e22ce' }}>✓ Add Expense</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
