import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { styles as s } from '../../styles/dashboard';

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'insurance', 'other'];
const PM_LABELS = { cash: '💵 Cash', card: '💳 Card', upi: '📱 UPI', insurance: '🏥 Insurance', other: 'Other' };

const NEXT_INTERVALS = [
  { label: '+1 Week',   days: 7 },
  { label: '+2 Weeks',  days: 14 },
  { label: '+1 Month',  days: 30 },
  { label: '+3 Months', days: 91 },
  { label: '+6 Months', days: 182 },
];

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function urgencyStyle(days) {
  if (days === null) return {};
  if (days < 0) return { color: '#dc2626', fontWeight: 700 };
  if (days <= 7) return { color: '#dc2626', fontWeight: 700 };
  if (days <= 30) return { color: '#d97706', fontWeight: 700 };
  return { color: '#16a34a', fontWeight: 600 };
}

function daysLabel(days) {
  if (days === null) return '';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days}d`;
}

const emptyForm = (patients) => ({
  patient: patients.length ? String(patients[0].id) : '',
  doctor_name: '',
  specialty: '',
  hospital: '',
  consultation_date: new Date().toISOString().slice(0, 10),
  next_appointment_date: '',
  fee: '',
  payment_method: 'cash',
  notes: '',
  instructions: '',
});

export default function ConsultingTab({ patients = [], showToast, onSaved }) {
  const [records, setRecords] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientFilter, setPatientFilter] = useState('all');
  const [form, setForm] = useState(() => emptyForm(patients));
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchRecords = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    setLoading(true);
    try {
      const [recRes, upRes] = await Promise.all([
        fetch(`${API}/api/consulting-records/`, { headers }),
        fetch(`${API}/api/consulting-records/?upcoming=true&limit=10`, { headers }),
      ]);
      if (recRes.ok) setRecords(await recRes.json());
      if (upRes.ok) setUpcoming(await upRes.json());
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const resetForm = () => { setForm(emptyForm(patients)); setEditId(null); };

  const setNextFromInterval = (days) => {
    const base = form.consultation_date || new Date().toISOString().slice(0, 10);
    setForm(f => ({ ...f, next_appointment_date: addDays(base, days) }));
  };

  const handleSave = async () => {
    if (!form.patient) return showToast('Select a patient', 'error');
    if (!form.doctor_name.trim()) return showToast('Doctor name is required', 'error');
    if (!form.consultation_date) return showToast('Date is required', 'error');

    setSaving(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const payload = {
        patient: parseInt(form.patient),
        doctor_name: form.doctor_name,
        specialty: form.specialty,
        hospital: form.hospital,
        consultation_date: form.consultation_date,
        next_appointment_date: form.next_appointment_date || null,
        fee: parseFloat(form.fee) || 0,
        payment_method: form.payment_method,
        notes: form.notes,
        instructions: form.instructions,
      };
      const url = editId ? `${API}/api/consulting-records/${editId}/` : `${API}/api/consulting-records/`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        showToast(editId ? 'Record updated' : 'Consultation recorded', 'success');
        resetForm();
        fetchRecords();
        onSaved();
      } else {
        const err = await res.json();
        showToast(Object.values(err).flat().join(' '), 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this consultation record?')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/consulting-records/${id}/`, { method: 'DELETE', headers });
    if (res.ok) { showToast('Deleted', 'success'); fetchRecords(); }
    else showToast('Failed to delete', 'error');
  };

  const startEdit = (r) => {
    setEditId(r.id);
    setForm({
      patient: String(r.patient),
      doctor_name: r.doctor_name,
      specialty: r.specialty || '',
      hospital: r.hospital || '',
      consultation_date: r.consultation_date,
      next_appointment_date: r.next_appointment_date || '',
      fee: r.fee ? String(r.fee) : '',
      payment_method: r.payment_method,
      notes: r.notes || '',
      instructions: r.instructions || '',
    });
  };

  const filtered = patientFilter === 'all'
    ? records
    : records.filter(r => String(r.patient) === patientFilter);

  // Detect close-date clusters for "combine visits" hint
  const upcomingWithHint = upcoming.map((rec, i) => {
    const days = rec.days_until_next;
    const others = upcoming.filter((o, j) => j !== i && o.days_until_next !== null && Math.abs((o.days_until_next || 0) - (days || 0)) <= 3);
    return { ...rec, combineHint: others.length > 0 };
  });

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>

      {/* Upcoming appointments */}
      {upcoming.length > 0 && (
        <div style={{ ...s.card, marginBottom: 16, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            📅 Upcoming Appointments
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcomingWithHint.map(rec => {
              const days = rec.days_until_next;
              return (
                <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  backgroundColor: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>{rec.patient_name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>
                      Dr. {rec.doctor_name}{rec.specialty ? ` · ${rec.specialty}` : ''}
                    </span>
                    {rec.combineHint && (
                      <span style={{ fontSize: 11, marginLeft: 8, backgroundColor: '#fef3c7', color: '#92400e',
                        padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        💡 Consider combining visits
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{formatDate(rec.next_appointment_date)}</div>
                    <div style={{ fontSize: 13, ...urgencyStyle(days) }}>{daysLabel(days)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={s.twoPanel}>
        {/* Left — records */}
        <div style={s.productsPanel}>
          <div style={s.panelTitle}>🩺 Consultations <span style={s.cartBadge}>{filtered.length}</span></div>

          {/* Patient filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setPatientFilter('all')} style={{
              fontSize: 12, padding: '4px 10px', borderRadius: 16, cursor: 'pointer',
              backgroundColor: patientFilter === 'all' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: patientFilter === 'all' ? 'white' : 'var(--text)',
              border: `1px solid ${patientFilter === 'all' ? 'var(--primary)' : 'var(--border)'}`,
              fontWeight: patientFilter === 'all' ? 600 : 400,
            }}>All</button>
            {patients.map(p => (
              <button key={p.id} onClick={() => setPatientFilter(String(p.id))} style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 16, cursor: 'pointer',
                backgroundColor: patientFilter === String(p.id) ? '#60a5fa' : 'var(--bg-secondary)',
                color: patientFilter === String(p.id) ? 'white' : 'var(--text)',
                border: `1px solid ${patientFilter === String(p.id) ? '#60a5fa' : 'var(--border)'}`,
                fontWeight: patientFilter === String(p.id) ? 600 : 400,
              }}>{p.name}</button>
            ))}
          </div>

          {loading && <div style={s.empty}>Loading…</div>}
          {!loading && filtered.length === 0 && <div style={s.empty}>No consultation records yet.</div>}

          {filtered.map(rec => {
            const isOpen = expandedId === rec.id;
            const days = rec.days_until_next;
            return (
              <div key={rec.id} style={{ ...s.listRow, flexDirection: 'column', alignItems: 'stretch', gap: 4, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>Dr. {rec.doctor_name}</span>
                    {rec.specialty && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{rec.specialty}</span>}
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                      <span style={{ backgroundColor: '#eff6ff', color: '#0369a1', padding: '1px 5px', borderRadius: 4 }}>
                        👤 {rec.patient_name}
                      </span>
                      {rec.hospital && <span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>🏥 {rec.hospital}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{formatDate(rec.consultation_date)}</div>
                    {rec.fee > 0 && <div style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{parseFloat(rec.fee).toFixed(0)}</div>}
                  </div>
                </div>

                {rec.next_appointment_date && (
                  <div style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-faint)' }}>Next:</span>
                    <span style={urgencyStyle(days)}>{formatDate(rec.next_appointment_date)} ({daysLabel(days)})</span>
                  </div>
                )}

                {isOpen && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {rec.notes && <div><strong>Notes:</strong> {rec.notes}</div>}
                    {rec.instructions && (
                      <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 8px', color: '#92400e' }}>
                        ⚠️ <strong>Instructions:</strong> {rec.instructions}
                      </div>
                    )}
                    <div>{PM_LABELS[rec.payment_method]}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <button style={s.iconBtn} onClick={() => setExpandedId(isOpen ? null : rec.id)}>
                    {isOpen ? '▲ Less' : '▼ More'}
                  </button>
                  <button style={s.iconBtn} onClick={() => startEdit(rec)}>✏ Edit</button>
                  <button style={{ ...s.iconBtn, color: '#dc2626' }} onClick={() => handleDelete(rec.id)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right — add/edit form */}
        <div style={s.cartPanel}>
          <div style={s.panelTitle}>{editId ? '✏ Edit Consultation' : '➕ Add Consultation'}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={s.fieldLabel}>Patient *</label>
              <select style={s.input} value={form.patient}
                onChange={e => setForm(f => ({ ...f, patient: e.target.value }))}>
                <option value="">— Select —</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label style={s.fieldLabel}>Doctor Name *</label>
              <input style={s.input} value={form.doctor_name} placeholder="e.g. Dr. Sharma"
                onChange={e => setForm(f => ({ ...f, doctor_name: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Specialty</label>
                <input style={s.input} value={form.specialty} placeholder="e.g. Cardiology"
                  onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} />
              </div>
              <div>
                <label style={s.fieldLabel}>Hospital / Clinic</label>
                <input style={s.input} value={form.hospital} placeholder="e.g. Apollo"
                  onChange={e => setForm(f => ({ ...f, hospital: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={s.fieldLabel}>Consultation Date *</label>
              <input style={s.input} type="date" value={form.consultation_date}
                onChange={e => setForm(f => ({ ...f, consultation_date: e.target.value }))} />
            </div>

            {/* Next appointment quick-pick */}
            <div>
              <label style={s.fieldLabel}>Next Appointment</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {NEXT_INTERVALS.map(({ label, days }) => (
                  <button key={days} onClick={() => setNextFromInterval(days)} style={{
                    fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)',
                  }}>{label}</button>
                ))}
                <button onClick={() => setForm(f => ({ ...f, next_appointment_date: '' }))} style={{
                  fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                  backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)',
                }}>Clear</button>
              </div>
              <input style={s.input} type="date" value={form.next_appointment_date}
                onChange={e => setForm(f => ({ ...f, next_appointment_date: e.target.value }))} />
              {form.next_appointment_date && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  📅 Next: <strong>{formatDate(form.next_appointment_date)}</strong>
                  {' '}({daysLabel(daysUntil(form.next_appointment_date))})
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Fee (₹)</label>
                <input style={s.input} type="number" min="0" step="0.01" value={form.fee} placeholder="0"
                  onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} />
              </div>
              <div>
                <label style={s.fieldLabel}>Payment</label>
                <select style={s.input} value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{PM_LABELS[m]}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={s.fieldLabel}>Your Notes</label>
              <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical' }}
                value={form.notes} placeholder="Notes from the visit…"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div>
              <label style={s.fieldLabel}>Special Instructions ⚠️</label>
              <textarea style={{ ...s.input, minHeight: 64, resize: 'vertical', borderColor: '#fde68a', backgroundColor: '#fef9ec' }}
                value={form.instructions} placeholder="Doctor's special instructions to remember…"
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.saveBtn, flex: 1, marginTop: 0 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update' : '💾 Save'}
              </button>
              {editId && <button style={s.cancelBtn} onClick={resetForm}>Cancel</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
