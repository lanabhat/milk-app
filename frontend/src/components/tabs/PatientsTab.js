import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { styles as s } from '../../styles/dashboard';

const RELATIONS = ['mom', 'dad', 'son', 'daughter', 'other'];
const TREATMENTS = ['allopathic', 'ayurvedic', 'homeopathic', 'other'];

const TREATMENT_COLORS = {
  allopathic:  { bg: '#dbeafe', color: '#0369a1', label: '💊 Allopathic' },
  ayurvedic:   { bg: '#dcfce7', color: '#15803d', label: '🌿 Ayurvedic' },
  homeopathic: { bg: '#faf5ff', color: '#7c3aed', label: '⚗️ Homeopathic' },
  other:       { bg: '#f3f4f6', color: '#6b7280', label: '❓ Other' },
};

const RELATION_LABELS = { mom: 'Mom', dad: 'Dad', son: 'Son', daughter: 'Daughter', other: 'Other' };

const SLOT_ICONS = { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' };
const SLOT_KEYS = ['morning_dose', 'afternoon_dose', 'evening_dose', 'night_dose'];
const SLOT_LABELS = { morning_dose: 'Morning', afternoon_dose: 'Afternoon', evening_dose: 'Evening', night_dose: 'Night' };

function scheduleChips(med) {
  return SLOT_KEYS
    .filter(k => med[k] != null && parseFloat(med[k]) > 0)
    .map(k => {
      const slot = k.replace('_dose', '');
      return `${SLOT_ICONS[slot]} ${SLOT_LABELS[k]}: ${parseFloat(med[k])}`;
    })
    .join('  ·  ');
}

const FOOD_LABELS = {
  before_food: '🚫 Before Food',
  after_food:  '✓ After Food',
  with_food:   '🍽️ With Food',
  no_restriction: '',
};

const TX_ICONS = { consume: '✔', add: '➕', adjust: '✏' };
const TX_COLORS = { consume: '#16a34a', add: '#0369a1', adjust: '#d97706' };

const emptyForm = { name: '', relation: 'other', treatment_type: 'allopathic', notes: '', active: true };

function PatientDetail({ patient, showToast, onBack, medicines, onSaved }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('consume');

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`${API}/api/patients/${patient.id}/history/?type=${historyFilter}&limit=50`, { headers });
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ }
    finally { setLoadingHistory(false); }
  }, [patient.id, historyFilter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Medicines belonging to this patient
  const patientMeds = (medicines || []).filter(m => m.patient === patient.id);
  const treatmentStyle = TREATMENT_COLORS[patient.treatment_type] || TREATMENT_COLORS.other;

  const handleConsume = async (med) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/medicines/${med.id}/consume/`, {
      method: 'POST', headers,
      body: JSON.stringify({ quantity: parseFloat(med.dosage_per_intake) }),
    });
    if (res.ok) {
      showToast(`✔ ${med.medicine_name} marked as taken`, 'success');
      onSaved();
      fetchHistory();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed', 'error');
    }
  };

  return (
    <div>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ ...s.iconBtn, fontSize: 13 }}>← Back</button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{patient.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{RELATION_LABELS[patient.relation]}</div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          backgroundColor: treatmentStyle.bg, color: treatmentStyle.color,
        }}>
          {treatmentStyle.label}
        </span>
      </div>

      {/* Medicines section */}
      <div style={{ marginBottom: 20 }}>
        <div style={s.panelTitle}>
          💊 Medicines
          <span style={s.cartBadge}>{patientMeds.length}</span>
        </div>
        {patientMeds.length === 0 && (
          <div style={s.empty}>No medicines assigned to {patient.name}. Assign from the Medicine tab.</div>
        )}
        {patientMeds.map(med => {
          const daysLeft = med.days_left;
          const foodLabel = FOOD_LABELS[med.food_relation];
          return (
            <div key={med.id} style={{ ...s.listRow, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{med.medicine_name}</div>
                {med.brand_name && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{med.brand_name}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', fontSize: 11 }}>
                  {scheduleChips(med) && (
                    <span style={{ backgroundColor: '#dbeafe', color: '#0369a1', padding: '1px 6px', borderRadius: 4 }}>
                      {scheduleChips(med)}
                    </span>
                  )}
                  {foodLabel && (
                    <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 4 }}>
                      {foodLabel}
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)' }}>
                    Dose: <strong style={{ color: 'var(--text)' }}>{parseFloat(med.dosage_per_intake)} {med.unit}</strong>
                  </span>
                  <span style={{ color: med.alert_level === 'critical' ? '#dc2626' : med.alert_level === 'low' ? '#d97706' : 'var(--text-muted)' }}>
                    Stock: {parseFloat(med.current_stock)} · {daysLeft !== null ? `${daysLeft}d left` : '—'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleConsume(med)}
                disabled={med.current_stock <= 0}
                style={{
                  flexShrink: 0, padding: '8px 14px', borderRadius: 8,
                  fontWeight: 700, fontSize: 12,
                  backgroundColor: med.current_stock <= 0 ? '#f3f4f6' : '#22c55e',
                  color: med.current_stock <= 0 ? '#9ca3af' : 'white',
                  border: 'none', cursor: med.current_stock <= 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {med.current_stock <= 0 ? 'No Stock' : '✔ Given'}
              </button>
            </div>
          );
        })}
      </div>

      {/* History section */}
      <div>
        <div style={{ ...s.panelTitle, marginBottom: 8 }}>
          📋 History
        </div>
        {/* Filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[['consume', '✔ Taken'], ['add', '➕ Added'], ['adjust', '✏ Adjusted']].map(([type, label]) => (
            <button
              key={type}
              onClick={() => setHistoryFilter(type)}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 16, cursor: 'pointer',
                backgroundColor: historyFilter === type ? 'var(--primary)' : 'var(--bg-secondary)',
                color: historyFilter === type ? 'white' : 'var(--text)',
                border: `1px solid ${historyFilter === type ? 'var(--primary)' : 'var(--border)'}`,
                fontWeight: historyFilter === type ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingHistory && <div style={s.empty}>Loading…</div>}
        {!loadingHistory && history.length === 0 && (
          <div style={s.empty}>No history yet.</div>
        )}
        {!loadingHistory && history.map(tx => {
          const d = new Date(tx.date);
          const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={tx.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8, marginBottom: 6,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}>
              <span style={{
                fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0,
                color: TX_COLORS[tx.type],
              }}>
                {TX_ICONS[tx.type]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{tx.medicine_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {tx.type === 'consume' ? 'Taken' : tx.type === 'add' ? 'Stock added' : 'Adjusted'}{' '}
                  <strong>{parseFloat(tx.quantity)}</strong>
                  {tx.notes ? ` · ${tx.notes}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>
                <div>{dateStr}</div>
                <div>{timeStr}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PatientsTab({ showToast, patients, medicines, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const resetForm = () => { setForm(emptyForm); setEditId(null); };

  const startEdit = (patient, e) => {
    e.stopPropagation();
    setEditId(patient.id);
    setForm({
      name: patient.name,
      relation: patient.relation,
      treatment_type: patient.treatment_type,
      notes: patient.notes || '',
      active: patient.active,
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return showToast('Name is required', 'error');
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const url = editId ? `${API}/api/patients/${editId}/` : `${API}/api/patients/`;
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, headers,
        body: JSON.stringify({
          name: form.name, relation: form.relation,
          treatment_type: form.treatment_type, notes: form.notes, active: form.active,
        }),
      });
      if (res.ok) {
        showToast(editId ? 'Patient updated' : 'Patient added', 'success');
        resetForm();
        onSaved();
        setSelectedPatient(null);
      } else {
        const err = await res.json();
        showToast(Object.values(err).flat().join(' '), 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this patient? Their medicines will become household items.')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/patients/${id}/`, { method: 'DELETE', headers });
    if (res.ok) {
      showToast('Deleted', 'success');
      if (selectedPatient?.id === id) setSelectedPatient(null);
      onSaved();
    } else showToast('Failed to delete', 'error');
  };

  const list = patients || [];

  // Drill-down view
  if (selectedPatient) {
    // Re-find the patient from the live list so medicine_count stays fresh
    const fresh = list.find(p => p.id === selectedPatient.id) || selectedPatient;
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px' }}>
        <PatientDetail
          patient={fresh}
          showToast={showToast}
          onBack={() => setSelectedPatient(null)}
          medicines={medicines}
          onSaved={onSaved}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={s.twoPanel}>

        {/* Left — patient list */}
        <div style={s.productsPanel}>
          <div style={s.panelTitle}>
            👤 Patients
            <span style={s.cartBadge}>{list.length}</span>
          </div>
          {list.length === 0 && (
            <div style={s.empty}>No patients yet. Add one on the right.</div>
          )}
          {list.map(patient => {
            const treatmentStyle = TREATMENT_COLORS[patient.treatment_type] || TREATMENT_COLORS.other;
            return (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                style={{ ...s.listRow, flexDirection: 'column', alignItems: 'stretch', gap: 6, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{patient.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{RELATION_LABELS[patient.relation] || patient.relation}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    backgroundColor: treatmentStyle.bg, color: treatmentStyle.color,
                    border: `1px solid ${treatmentStyle.color}20`,
                  }}>
                    {treatmentStyle.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span>Medicines: <strong style={{ color: 'var(--text)' }}>{patient.medicine_count}</strong></span>
                  <span>{patient.active ? '✓ Active' : '✗ Inactive'}</span>
                </div>
                {patient.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>"{patient.notes}"</div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={{ ...s.saveSmBtn, fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setSelectedPatient(patient); }}>
                    📋 View History
                  </button>
                  <button style={{ ...s.iconBtn }} onClick={(e) => startEdit(patient, e)}>📝 Edit</button>
                  <button style={{ ...s.iconBtn, color: '#dc2626' }} onClick={(e) => handleDelete(patient.id, e)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right — add/edit form */}
        <div style={s.cartPanel}>
          <div style={s.panelTitle}>{editId ? '📝 Edit Patient' : '➕ Add Patient'}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={s.fieldLabel}>Name *</label>
              <input style={s.input} value={form.name} placeholder="e.g. Mom"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={s.fieldLabel}>Relation</label>
              <select style={s.input} value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))}>
                {RELATIONS.map(r => <option key={r} value={r}>{RELATION_LABELS[r] || r}</option>)}
              </select>
            </div>
            <div>
              <label style={s.fieldLabel}>Treatment Type</label>
              <select style={s.input} value={form.treatment_type} onChange={e => setForm(f => ({ ...f, treatment_type: e.target.value }))}>
                {TREATMENTS.map(t => <option key={t} value={t}>{TREATMENT_COLORS[t]?.label || t}</option>)}
              </select>
            </div>
            <div>
              <label style={s.fieldLabel}>Notes</label>
              <textarea style={{ ...s.input, minHeight: 60, fontFamily: 'inherit', fontSize: 13 }}
                value={form.notes} placeholder="e.g. Diabetes patient, prefers morning doses"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="active" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              <label htmlFor="active" style={{ marginBottom: 0, cursor: 'pointer' }}>Active</label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button style={{ ...s.saveBtn, flex: 1, marginTop: 0 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update Patient' : 'Add Patient'}
              </button>
              {editId && <button style={s.cancelBtn} onClick={resetForm}>Cancel</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
