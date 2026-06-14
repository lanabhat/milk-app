import React, { useState } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmtD } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';
import Modal from '../common/Modal';

const FUEL_LABELS  = { petrol: 'Petrol', diesel: 'Diesel', cng: 'CNG', electric: 'Electric', hybrid: 'Hybrid' };
const TYPE_LABELS  = { car: 'Car', bike: 'Bike', scooter: 'Scooter', truck: 'Truck', other: 'Other' };
const TYPE_EMOJI   = { car: '🚗', bike: '🏍️', scooter: '🛵', truck: '🚚', other: '🚙' };
const FUEL_COLOR   = { petrol: '#f97316', diesel: '#64748b', cng: '#10b981', electric: '#6366f1', hybrid: '#0ea5e9' };

const EMPTY_FORM = { make: '', model: '', year: '', registration_no: '', color: '', vin_number: '', fuel_type: 'petrol', vehicle_type: 'car', purchase_date: '', image_url: '', notes: '' };

function statusBadge(days, label, warnDays = 30) {
  if (days === null || days === undefined) return null;
  const color = days < 0 ? '#dc2626' : days <= warnDays ? '#f59e0b' : '#16a34a';
  const bg    = days < 0 ? '#fee2e2' : days <= warnDays ? '#fef3c7' : '#dcfce7';
  const text  = days < 0 ? `${label} EXPIRED` : days === 0 ? `${label} today` : `${label} in ${days}d`;
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 4, padding: '2px 6px', marginRight: 4 }}>{text}</span>;
}

export default function VehicleListTab({ vehicles, showToast, onSaved, selectedVehicleId, onSelectVehicle }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [expandId, setExpandId]   = useState(null);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const resetForm = () => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(false); };

  const handleSave = async () => {
    if (!form.make.trim() || !form.model.trim() || !form.registration_no.trim()) {
      showToast('Make, model, and registration are required', 'error'); return;
    }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, year: form.year ? parseInt(form.year) : null };
    try {
      const url    = editId ? `${API}/api/vehicles/${editId}/` : `${API}/api/vehicles/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Vehicle updated' : '✓ Vehicle added');
      resetForm(); onSaved();
    } catch { showToast('Failed to save vehicle', 'error'); }
    finally { setSaving(false); }
  };

  const handleEdit = (v) => {
    setEditId(v.id);
    setForm({ make: v.make, model: v.model, year: v.year || '', registration_no: v.registration_no, color: v.color, vin_number: v.vin_number, fuel_type: v.fuel_type, vehicle_type: v.vehicle_type, purchase_date: v.purchase_date || '', image_url: v.image_url || '', notes: v.notes });
    setModalOpen(true);
  };

  const handleDeactivate = async (v) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/vehicles/${v.id}/`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !v.is_active }) });
    onSaved();
  };

  const activeVehicles   = vehicles.filter(v => v.is_active);
  const inactiveVehicles = vehicles.filter(v => !v.is_active);

  const VehicleCard = ({ v }) => {
    const emoji = TYPE_EMOJI[v.vehicle_type] || '🚗';
    const expanded = expandId === v.id;
    return (
      <div style={{ ...s.card, borderLeft: `4px solid ${FUEL_COLOR[v.fuel_type] || '#64748b'}`, marginBottom: 10, outline: String(v.id) === selectedVehicleId ? '2px solid var(--accent)' : 'none', outlineOffset: 2 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {v.image_url
            ? <img src={v.image_url} alt={v.make} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
            : <div style={{ width: 64, height: 64, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>{emoji}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{v.year} {v.make} {v.model}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{v.registration_no} · {TYPE_LABELS[v.vehicle_type]} · {FUEL_LABELS[v.fuel_type]}</div>
            {v.color && <div style={{ fontSize: 11, color: '#94a3b8' }}>{v.color}</div>}
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>📍 {v.current_odometer?.toLocaleString('en-IN')} km</div>
            <div style={{ marginTop: 6, flexWrap: 'wrap', display: 'flex', gap: 2 }}>
              {statusBadge(v.days_until_pucc_expiry, 'PUCC')}
              {statusBadge(v.days_until_insurance_expiry, 'Insurance')}
              {statusBadge(v.days_until_next_service, 'Service', 14)}
              {statusBadge(v.days_until_oil_change, 'Oil', 14)}
              {statusBadge(v.days_until_warranty_expiry, 'Warranty')}
            </div>
          </div>
          <button onClick={() => setExpandId(expanded ? null : v.id)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
        {expanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
            {v.vin_number && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>VIN: {v.vin_number}</div>}
            {v.purchase_date && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Purchased: {fmtD(v.purchase_date)}</div>}
            {v.notes && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{v.notes}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {String(v.id) !== selectedVehicleId && v.is_active && (
                <button onClick={() => onSelectVehicle?.(String(v.id))} style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: '#16a34a' }}>
                  ✓ Set as Active Vehicle
                </button>
              )}
              <button onClick={() => handleEdit(v)} style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px' }}>✏️ Edit</button>
              <button onClick={() => handleDeactivate(v)} style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: v.is_active ? '#ef4444' : '#16a34a' }}>
                {v.is_active ? '🚫 Deactivate' : '✓ Reactivate'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={s.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <h3 style={{ ...s.sectionTitle, margin: 0, flex: 1 }}>Fleet ({activeVehicles.length})</h3>
        <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(true); }} style={s.addBtn}>
          + Add Vehicle
        </button>
      </div>

      {activeVehicles.length === 0 && <p style={s.empty}>No vehicles yet. Add your first vehicle above.</p>}
      {activeVehicles.map(v => <VehicleCard key={v.id} v={v} />)}

      {inactiveVehicles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Inactive ({inactiveVehicles.length})</div>
          {inactiveVehicles.map(v => <VehicleCard key={v.id} v={v} />)}
        </div>
      )}

      <Modal open={modalOpen} onClose={resetForm} title={editId ? 'Edit Vehicle' : 'Add Vehicle'}
        onSave={handleSave} saveLabel={saving ? 'Saving…' : editId ? 'Update' : 'Add Vehicle'} saving={saving}>
        <div className="form-grid">
          <label>Make *<input style={s.input} value={form.make} onChange={e => setF('make', e.target.value)} placeholder="Honda" /></label>
          <label>Model *<input style={s.input} value={form.model} onChange={e => setF('model', e.target.value)} placeholder="Activa 6G" /></label>
          <label>Registration No *<input style={s.input} value={form.registration_no} onChange={e => setF('registration_no', e.target.value)} placeholder="KA 01 AB 1234" /></label>
          <label>Year<input style={s.input} type="number" value={form.year} onChange={e => setF('year', e.target.value)} placeholder="2022" /></label>
          <label>Color<input style={s.input} value={form.color} onChange={e => setF('color', e.target.value)} placeholder="Pearl White" /></label>
          <label>VIN / Chassis No<input style={s.input} value={form.vin_number} onChange={e => setF('vin_number', e.target.value)} /></label>
          <label>
            Vehicle Type
            <select style={s.input} value={form.vehicle_type} onChange={e => setF('vehicle_type', e.target.value)}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>
            Fuel Type
            <select style={s.input} value={form.fuel_type} onChange={e => setF('fuel_type', e.target.value)}>
              {Object.entries(FUEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>Purchase Date<input style={s.input} type="date" value={form.purchase_date} onChange={e => setF('purchase_date', e.target.value)} /></label>
          <label>Image URL (optional)<input style={s.input} value={form.image_url} onChange={e => setF('image_url', e.target.value)} placeholder="https://..." /></label>
          <label>Notes<input style={s.input} value={form.notes} onChange={e => setF('notes', e.target.value)} /></label>
        </div>
      </Modal>
    </div>
  );
}
