import React, { useState } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { styles as s } from '../../styles/dashboard';

const UNITS = ['tablets', 'mg', 'ml', 'units'];
const TYPES = ['tablet', 'insulin', 'syrup', 'capsule', 'drop', 'other'];

const SLOTS = [
  { key: 'morning_dose',   icon: '🌅', label: 'Morning' },
  { key: 'afternoon_dose', icon: '☀️', label: 'Afternoon' },
  { key: 'night_dose',     icon: '🌙', label: 'Night' },
];

const FOOD_LABELS = {
  before_food:    '🚫 Before Food',
  after_food:     '✓ After Food',
  with_food:      '🍽️ With Food',
  no_restriction: '',
};

const ALERT_BADGE = {
  critical: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: '🔴 Critical' },
  low:      { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: '🟡 Low Stock' },
  ok:       { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: '🟢 OK' },
};

function AlertBadge({ level }) {
  const style = ALERT_BADGE[level] || ALERT_BADGE.ok;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      backgroundColor: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
      {style.label}
    </span>
  );
}

function scheduleText(med) {
  return SLOTS
    .filter(sl => med[sl.key] != null && parseFloat(med[sl.key]) > 0)
    .map(sl => `${sl.icon} ${sl.label}: ${parseFloat(med[sl.key])}`)
    .join('  ·  ');
}

const emptyForm = {
  medicine_name: '', brand_name: '', strength: '', type: 'tablet', unit: 'tablets',
  morning_dose: '', afternoon_dose: '', night_dose: '',
  morning_on: false, afternoon_on: false, night_on: false,
  food_relation: 'no_restriction',
  current_stock: '', low_stock_threshold: '10',
  patient: null,
  prescribed_by: '', specialty: '',
};

export default function MedicineTab({ showToast, medicines, patients = [], onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [patientFilter, setPatientFilter] = useState('all');

  // modal state
  const [modal, setModal] = useState(null); // { type, medicine }
  const [modalQty, setModalQty] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  const resetForm = () => { setForm(emptyForm); setEditId(null); };

  const startEdit = (med) => {
    setEditId(med.id);
    setForm({
      medicine_name: med.medicine_name,
      brand_name: med.brand_name || '',
      strength: med.strength || '',
      type: med.type,
      unit: med.unit,
      morning_dose:   med.morning_dose   != null ? String(med.morning_dose)   : '',
      afternoon_dose: med.afternoon_dose != null ? String(med.afternoon_dose) : '',
      night_dose:     med.night_dose     != null ? String(med.night_dose)     : '',
      morning_on:   med.morning_dose   != null && parseFloat(med.morning_dose)   > 0,
      afternoon_on: med.afternoon_dose != null && parseFloat(med.afternoon_dose) > 0,
      night_on:     med.night_dose     != null && parseFloat(med.night_dose)     > 0,
      food_relation: med.food_relation || 'no_restriction',
      current_stock: String(med.current_stock),
      low_stock_threshold: String(med.low_stock_threshold),
      patient: med.patient || null,
      prescribed_by: med.prescribed_by || '',
      specialty: med.specialty || '',
    });
  };

  const handleSave = async () => {
    if (!form.medicine_name.trim()) return showToast('Medicine name is required', 'error');

    setSaving(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const url = editId ? `${API}/api/medicines/${editId}/` : `${API}/api/medicines/`;
      const method = editId ? 'PATCH' : 'POST';

      // Derive dosage_per_intake from first active slot (for backward compat)
      const firstActiveSlot = SLOTS.find(sl => form[sl.key.replace('_dose', '_on')]);
      const dosageRef = firstActiveSlot ? parseFloat(form[firstActiveSlot.key]) || 1 : 1;
      const activeCount = SLOTS.filter(sl => form[sl.key.replace('_dose', '_on')]).length;

      const payload = {
        medicine_name: form.medicine_name,
        brand_name: form.brand_name,
        strength: form.strength,
        type: form.type,
        unit: form.unit,
        morning_dose:   form.morning_on   ? (parseFloat(form.morning_dose)   || 1) : null,
        afternoon_dose: form.afternoon_on ? (parseFloat(form.afternoon_dose) || 1) : null,
        evening_dose:   null,
        night_dose:     form.night_on     ? (parseFloat(form.night_dose)     || 1) : null,
        dosage_per_intake: dosageRef,
        intakes_per_day: activeCount,
        food_relation: form.food_relation,
        current_stock: parseFloat(form.current_stock) || 0,
        low_stock_threshold: parseFloat(form.low_stock_threshold) || 10,
        patient: form.patient || null,
        prescribed_by: form.prescribed_by,
        specialty: form.specialty,
      };
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        showToast(editId ? 'Medicine updated' : 'Medicine added', 'success');
        resetForm();
        onSaved();
      } else {
        const err = await res.json();
        showToast(Object.values(err).flat().join(' '), 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this medicine?')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/medicines/${id}/`, { method: 'DELETE', headers });
    if (res.ok) { showToast('Deleted', 'success'); onSaved(); }
    else showToast('Failed to delete', 'error');
  };

  const openModal = (type, med) => {
    setModal({ type, medicine: med });
    setModalQty('');
    setModalNotes('');
  };

  const handleModalAction = async () => {
    if (!modal) return;
    const { type, medicine } = modal;
    const qty = parseFloat(modalQty);
    if (isNaN(qty) || (type !== 'adjust' && qty <= 0)) return showToast('Enter a valid quantity', 'error');
    setModalSaving(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      let body = { quantity: qty, notes: modalNotes };
      const res = await fetch(`${API}/api/medicines/${medicine.id}/${type}/`, {
        method: 'POST', headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const label = type === 'add_stock' ? 'Stock added' : 'Stock adjusted';
        showToast(label, 'success');
        setModal(null);
        onSaved();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setModalSaving(false); }
  };

  const list = medicines || [];
  const filteredList = patientFilter === 'all'
    ? list
    : patientFilter === 'unassigned'
      ? list.filter(m => !m.patient)
      : list.filter(m => m.patient === parseInt(patientFilter));

  return (
    <>
    <div style={{ width: '100%' }}>
      <div style={s.twoPanel}>

        {/* Left — medicine list */}
        <div style={s.productsPanel}>
          <div style={s.panelTitle}>
            💊 Medicines
            <span style={s.cartBadge}>{filteredList.length}</span>
          </div>

          {/* Patient filter pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[['all', 'All', 'var(--primary)'], ['unassigned', 'Household', '#fbbf24']].map(([key, lbl, clr]) => (
              <button key={key} onClick={() => setPatientFilter(key)} style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 16, cursor: 'pointer',
                backgroundColor: patientFilter === key ? clr : 'var(--bg-secondary)',
                color: patientFilter === key ? 'white' : 'var(--text)',
                border: `1px solid ${patientFilter === key ? clr : 'var(--border)'}`,
                fontWeight: patientFilter === key ? 600 : 400,
              }}>{lbl}</button>
            ))}
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

          {filteredList.length === 0 && (
            <div style={s.empty}>{patientFilter === 'all' ? 'No medicines yet.' : 'No medicines for this filter.'}</div>
          )}
          {filteredList.map(med => {
            const daysLeft = med.days_left;
            const daysText = daysLeft === null ? '—' : `${daysLeft}d left`;
            const foodLabel = FOOD_LABELS[med.food_relation];
            const schedule = scheduleText(med);
            return (
              <div key={med.id} style={{ ...s.listRow, flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{med.medicine_name}</span>
                    {med.strength && <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>{med.strength}</span>}
                    {med.brand_name && <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>{med.brand_name}</span>}
                    {(med.prescribed_by || med.specialty) && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {med.prescribed_by && `Dr. ${med.prescribed_by}`}{med.specialty ? ` · ${med.specialty}` : ''}
                      </div>
                    )}
                    <div style={{ marginTop: 3 }}>
                      <span style={{ fontSize: 11, backgroundColor: med.patient_name ? '#eff6ff' : '#f3f4f6',
                        color: med.patient_name ? '#0369a1' : '#6b7280', padding: '2px 6px', borderRadius: 4 }}>
                        {med.patient_name ? `👤 ${med.patient_name}` : '🏠 Household'}
                      </span>
                    </div>
                  </div>
                  <AlertBadge level={med.alert_level} />
                </div>
                {schedule && (
                  <div style={{ fontSize: 11, color: '#0369a1', backgroundColor: '#dbeafe', padding: '3px 7px', borderRadius: 4 }}>
                    {schedule}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, fontSize: 11, flexWrap: 'wrap' }}>
                  {foodLabel && (
                    <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '2px 6px', borderRadius: 4 }}>
                      {foodLabel}
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)' }}>
                    Stock: <strong style={{ color: 'var(--text)' }}>{parseFloat(med.current_stock)} {med.unit}</strong>
                  </span>
                  <span style={{ color: med.alert_level === 'critical' ? '#dc2626' : med.alert_level === 'low' ? '#d97706' : 'var(--text-muted)' }}>
                    {daysText}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={{ ...s.secondaryBtn, fontSize: 12, padding: '4px 10px' }} onClick={() => openModal('add_stock', med)}>➕ Add Stock</button>
                  <button style={{ ...s.iconBtn }} onClick={() => openModal('adjust', med)}>✏ Adjust</button>
                  <button style={{ ...s.iconBtn }} onClick={() => startEdit(med)}>📝 Edit</button>
                  <button style={{ ...s.iconBtn, color: '#dc2626' }} onClick={() => handleDelete(med.id)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right — add/edit form */}
        <div style={s.cartPanel}>
          <div style={s.panelTitle}>{editId ? '📝 Edit Medicine' : '➕ Add Medicine'}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={s.fieldLabel}>Medicine Name *</label>
              <input style={s.input} value={form.medicine_name} placeholder="e.g. Metformin"
                onChange={e => setForm(f => ({ ...f, medicine_name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Brand Name</label>
                <input style={s.input} value={form.brand_name} placeholder="e.g. Glycomet"
                  onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} />
              </div>
              <div>
                <label style={s.fieldLabel}>Strength</label>
                <input style={s.input} value={form.strength} placeholder="e.g. 500mg"
                  onChange={e => setForm(f => ({ ...f, strength: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Type</label>
                <select style={s.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={s.fieldLabel}>Unit</label>
                <select style={s.input} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Schedule — checkboxes with per-slot qty */}
            <div>
              <label style={{ ...s.fieldLabel, marginBottom: 6 }}>Schedule *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6,
                border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
                backgroundColor: 'var(--bg-secondary)' }}>
                {SLOTS.map(sl => {
                  const onKey = sl.key.replace('_dose', '_on');
                  const isOn = form[onKey];
                  return (
                    <div key={sl.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        id={sl.key}
                        checked={isOn}
                        onChange={e => setForm(f => ({ ...f, [onKey]: e.target.checked }))}
                      />
                      <label htmlFor={sl.key} style={{ width: 90, fontSize: 13, marginBottom: 0, cursor: 'pointer' }}>
                        {sl.icon} {sl.label}
                      </label>
                      <input
                        style={{ ...s.input, width: 70, margin: 0, opacity: isOn ? 1 : 0.4 }}
                        type="number" min="0.5" step="0.5"
                        placeholder="qty"
                        disabled={!isOn}
                        value={form[sl.key]}
                        onChange={e => setForm(f => ({ ...f, [sl.key]: e.target.value }))}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{form.unit || 'units'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={s.fieldLabel}>With Food?</label>
              <select style={s.input} value={form.food_relation} onChange={e => setForm(f => ({ ...f, food_relation: e.target.value }))}>
                <option value="before_food">🚫 Before Food</option>
                <option value="after_food">✓ After Food</option>
                <option value="with_food">🍽️ With Food</option>
                <option value="no_restriction">✨ No Restriction</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Current Stock</label>
                <input style={s.input} type="number" min="0" step="1" value={form.current_stock}
                  onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))} />
              </div>
              <div>
                <label style={s.fieldLabel}>Low Stock Alert At</label>
                <input style={s.input} type="number" min="0" step="1" value={form.low_stock_threshold}
                  onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={s.fieldLabel}>Prescribed By</label>
                <input style={s.input} value={form.prescribed_by} placeholder="e.g. Dr. Sharma"
                  onChange={e => setForm(f => ({ ...f, prescribed_by: e.target.value }))} />
              </div>
              <div>
                <label style={s.fieldLabel}>Specialty</label>
                <input style={s.input} value={form.specialty} placeholder="e.g. Cardiology"
                  onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={s.fieldLabel}>Patient (optional)</label>
              <select style={s.input} value={form.patient || ''}
                onChange={e => setForm(f => ({ ...f, patient: e.target.value ? parseInt(e.target.value, 10) : null }))}>
                <option value="">— Household / General —</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.relation})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button style={{ ...s.saveBtn, flex: 1, marginTop: 0 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update Medicine' : 'Add Medicine'}
              </button>
              {editId && <button style={s.cancelBtn} onClick={resetForm}>Cancel</button>}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Modal overlay */}
    {modal && (
      <div style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }} onClick={() => setModal(null)}>
        <div style={{
          backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 20, width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {modal.type === 'add_stock' ? '➕ Add Stock' : '✏ Adjust Stock'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            {modal.medicine.medicine_name}{modal.medicine.strength ? ` ${modal.medicine.strength}` : ''}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={s.fieldLabel}>{modal.type === 'adjust' ? 'Quantity (use − for reduction)' : 'Quantity'}</label>
            <input style={s.input} type="number"
              step="0.5"
              value={modalQty}
              onChange={e => setModalQty(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={s.fieldLabel}>Notes (optional)</label>
            <input style={s.input} value={modalNotes} onChange={e => setModalNotes(e.target.value)}
              placeholder="e.g. Purchased from pharmacy" />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...s.saveBtn, flex: 1, marginTop: 0 }} onClick={handleModalAction} disabled={modalSaving}>
              {modalSaving ? 'Saving…' : 'Confirm'}
            </button>
            <button style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
