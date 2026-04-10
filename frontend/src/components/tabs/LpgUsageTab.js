import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { todayStr, fmt2, fmtD } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

export default function LpgUsageTab({ showToast }) {
  const [data,        setData]        = useState(null);   // { usages, monthly, liters_per_cylinder }
  const [bookings,    setBookings]    = useState([]);     // for the booking-link dropdown
  const [saving,      setSaving]      = useState(false);
  const [editId,      setEditId]      = useState(null);

  // New-usage form
  const [newStart,    setNewStart]    = useState(todayStr());
  const [newEnd,      setNewEnd]      = useState('');
  const [newPrice,    setNewPrice]    = useState('');
  const [newBooking,  setNewBooking]  = useState('');
  const [newNotes,    setNewNotes]    = useState('');

  // Edit-usage form
  const [editStart,   setEditStart]   = useState('');
  const [editEnd,     setEditEnd]     = useState('');
  const [editPrice,   setEditPrice]   = useState('');
  const [editBooking, setEditBooking] = useState('');
  const [editNotes,   setEditNotes]   = useState('');

  const fetchUsage = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/usage/`, { headers });
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchBookings = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/status/`, { headers });
      if (res.ok) {
        const d = await res.json();
        setBookings(d.history || []);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchUsage();
    fetchBookings();
  }, [fetchUsage, fetchBookings]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newStart) { showToast('Start date is required', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/usage/`, {
        method: 'POST', headers,
        body: JSON.stringify({
          start_date: newStart,
          end_date:   newEnd   || null,
          price:      newPrice ? parseFloat(newPrice) : null,
          booking:    newBooking || null,
          notes:      newNotes,
        }),
      });
      if (res.ok) {
        setNewStart(todayStr()); setNewEnd(''); setNewPrice(''); setNewBooking(''); setNewNotes('');
        showToast('✓ Usage recorded');
        fetchUsage();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || err.error || 'Error saving', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/${id}/usage_detail/`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          start_date: editStart,
          end_date:   editEnd   || null,
          price:      editPrice ? parseFloat(editPrice) : null,
          booking:    editBooking || null,
          notes:      editNotes,
        }),
      });
      if (res.ok) { setEditId(null); showToast('✓ Updated'); fetchUsage(); }
      else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || err.error || 'Error updating', 'error');
      }
    } catch { showToast('Network error', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this usage record?')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/${id}/usage_detail/`, { method: 'DELETE', headers });
      if (res.ok || res.status === 204) { showToast('Deleted'); fetchUsage(); }
      else showToast('Error deleting', 'error');
    } catch { showToast('Network error', 'error'); }
  };

  const startEdit = (u) => {
    setEditId(u.id);
    setEditStart(u.start_date);
    setEditEnd(u.end_date || '');
    setEditPrice(u.price != null ? String(u.price) : '');
    setEditBooking(u.booking != null ? String(u.booking) : '');
    setEditNotes(u.notes || '');
  };

  const currentUsage = data?.usages?.find(u => u.is_current);

  return (
    <div style={s.section}>

      {/* Current cylinder status */}
      {currentUsage ? (
        <div style={{
          ...s.card,
          textAlign: 'center',
          padding: '18px 16px',
          marginBottom: 16,
          borderTop: '4px solid #0f766e',
        }}>
          <div style={{ fontSize: 28 }}>🔥</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f766e', marginTop: 4 }}>Cylinder In Use</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Started {fmtD(currentUsage.start_date)} · {currentUsage.duration_days} day{currentUsage.duration_days !== 1 ? 's' : ''} so far
          </div>
          {currentUsage.booking_date && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
              Linked to booking: {fmtD(currentUsage.booking_date)}
            </div>
          )}
          {currentUsage.price != null && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f766e', marginTop: 4 }}>
              Rs {fmt2(currentUsage.price)}
            </div>
          )}
          {currentUsage.notes && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
              {currentUsage.notes}
            </div>
          )}
        </div>
      ) : (
        !data && <p style={s.empty}>Loading…</p>
      )}

      {/* Monthly breakdown */}
      {data?.monthly?.length > 0 && (
        <div style={{ ...s.card, marginBottom: 12 }}>
          <div style={s.panelTitle}>Monthly Usage</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left',  padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Month</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Days</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Liters</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map(m => (
                  <tr key={m.month} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 500, color: '#1e293b' }}>
                      {new Date(m.month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#475569' }}>{m.days}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#0f766e', fontWeight: 600 }}>
                      {fmt2(m.liters)} L
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: m.cost_known ? '#1e293b' : '#94a3b8' }}>
                      {m.cost_known ? `Rs ${fmt2(m.cost)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
            Liters based on {data.liters_per_cylinder} L/cylinder (configurable in LPG Overview → Settings)
          </div>
        </div>
      )}

      {/* Add new usage form */}
      <div style={s.card}>
        <div style={s.panelTitle}>Record Cylinder Opening</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={s.fieldLabel}>Started Using On</label>
            <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} style={s.input} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={s.fieldLabel}>Finished On (optional)</label>
            <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} style={s.input} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={s.fieldLabel}>Price (optional)</label>
            <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={s.input} placeholder="Rs" />
          </div>
          <div style={{ flex: '2 1 200px' }}>
            <label style={s.fieldLabel}>Linked Booking (optional)</label>
            <select value={newBooking} onChange={e => setNewBooking(e.target.value)} style={s.input}>
              <option value="">— none —</option>
              {bookings.map(b => (
                <option key={b.id} value={b.id}>
                  {fmtD(b.booking_date)}{b.delivered_date ? ` · delivered ${fmtD(b.delivered_date)}` : ''}
                  {b.price ? ` · Rs ${fmt2(b.price)}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '3 1 260px' }}>
            <label style={s.fieldLabel}>Notes (optional)</label>
            <input type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)} style={s.input}
              placeholder="e.g. Guest visit, water boiling, festival cooking…" />
          </div>
        </div>
        <button onClick={handleAdd} disabled={saving} style={{ ...s.primaryBtn, minWidth: 160 }}>
          {saving ? 'Saving…' : '➕ Record Opening'}
        </button>
      </div>

      {/* Usage history */}
      {data?.usages?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={s.sectionTitle}>Usage History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.usages.map(u => (
              <div key={u.id} style={{
                ...s.card,
                padding: '12px 14px',
                borderLeft: u.is_current ? '4px solid #0f766e' : '4px solid #e2e8f0',
              }}>
                {editId === u.id ? (
                  <div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={s.fieldLabel}>Started On</label>
                        <input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} style={s.input} />
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={s.fieldLabel}>Finished On</label>
                        <input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} style={s.input} />
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={s.fieldLabel}>Price</label>
                        <input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={s.input} />
                      </div>
                      <div style={{ flex: '2 1 200px' }}>
                        <label style={s.fieldLabel}>Linked Booking</label>
                        <select value={editBooking} onChange={e => setEditBooking(e.target.value)} style={s.input}>
                          <option value="">— none —</option>
                          {bookings.map(b => (
                            <option key={b.id} value={b.id}>
                              {fmtD(b.booking_date)}{b.delivered_date ? ` · delivered ${fmtD(b.delivered_date)}` : ''}
                              {b.price ? ` · Rs ${fmt2(b.price)}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: '3 1 260px' }}>
                        <label style={s.fieldLabel}>Notes</label>
                        <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} style={s.input} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleSaveEdit(u.id)} style={{ ...s.primaryBtn, fontSize: 12 }}>Save</button>
                      <button onClick={() => setEditId(null)} style={{ ...s.secondaryBtn, fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                        {u.is_current && <span style={{ color: '#0f766e', marginRight: 6 }}>● Current</span>}
                        Started: {fmtD(u.start_date)}
                        {u.end_date && <span style={{ color: '#64748b', marginLeft: 10 }}>→ {fmtD(u.end_date)}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', marginTop: 3 }}>
                        {u.is_current
                          ? <span style={{ color: '#0f766e', fontWeight: 500 }}>{u.duration_days} days in use</span>
                          : <span>{u.duration_days} days lasted</span>
                        }
                        {u.price != null && <span style={{ marginLeft: 10, color: '#0f766e', fontWeight: 600 }}>· Rs {fmt2(u.price)}</span>}
                      </div>
                      {u.booking_date && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          Booking: {fmtD(u.booking_date)}
                        </div>
                      )}
                      {u.notes && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>
                          {u.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => startEdit(u)} style={{ ...s.secondaryBtn, fontSize: 12 }}>Edit</button>
                      <button onClick={() => handleDelete(u.id)}
                        style={{ ...s.secondaryBtn, fontSize: 12, color: '#dc2626', borderColor: '#fca5a5' }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.usages?.length === 0 && (
        <p style={{ ...s.empty, marginTop: 20 }}>No usage records yet. Record when you open a cylinder above.</p>
      )}
    </div>
  );
}
