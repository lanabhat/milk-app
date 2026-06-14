import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';
import Modal from '../common/Modal';

const EMPTY_FORM = { trip_date: todayStr(), title: '', from_location: '', to_location: '', start_odometer: '', end_odometer: '', distance_km: '', purpose: '', image_url: '', notes: '', is_draft: false };

export default function VehicleTripsTab({ vehicles, selectedVehicleId, showToast, onSaved }) {
  const [trips, setTrips]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [editId, setEditId]       = useState(null);
  const [expandId, setExpandId]   = useState(null);

  const fetchTrips = useCallback(async () => {
    if (!selectedVehicleId) return;
    setLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const r = await fetch(`${API}/api/trips/?vehicle_id=${selectedVehicleId}`, { headers });
      if (r.ok) setTrips(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [selectedVehicleId]);

  useEffect(() => { setTrips([]); fetchTrips(); }, [fetchTrips]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const computedDist = form.start_odometer && form.end_odometer
    ? Math.max(0, parseFloat(form.end_odometer) - parseFloat(form.start_odometer)).toFixed(1) : null;

  const resetForm = () => { setEditId(null); setForm(EMPTY_FORM); setModalOpen(false); };

  const openAdd = (draft = false) => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, is_draft: draft, title: draft ? `Trip on ${todayStr()}` : '' });
    setModalOpen(true);
  };

  const openEdit = (trip) => {
    setEditId(trip.id);
    setForm({ trip_date: trip.trip_date, title: trip.title, from_location: trip.from_location || '', to_location: trip.to_location || '', start_odometer: trip.start_odometer || '', end_odometer: trip.end_odometer || '', distance_km: trip.distance_km || '', purpose: trip.purpose || '', image_url: trip.image_url || '', notes: trip.notes || '', is_draft: trip.is_draft });
    setModalOpen(true); setExpandId(null);
  };

  const handleSave = async () => {
    if (!form.title.trim() && !form.is_draft) { showToast('Title required', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = {
      vehicle: parseInt(selectedVehicleId), trip_date: form.trip_date,
      title: form.title || `Trip on ${form.trip_date}`,
      from_location: form.from_location, to_location: form.to_location,
      start_odometer: form.start_odometer ? parseFloat(form.start_odometer) : null,
      end_odometer: form.end_odometer ? parseFloat(form.end_odometer) : null,
      distance_km: form.distance_km ? parseFloat(form.distance_km) : (computedDist ? parseFloat(computedDist) : null),
      purpose: form.purpose, image_url: form.image_url, notes: form.notes, is_draft: form.is_draft,
    };
    try {
      const url    = editId ? `${API}/api/trips/${editId}/` : `${API}/api/trips/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Trip saved');
      resetForm(); fetchTrips(); onSaved();
    } catch { showToast('Failed to save trip', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/trips/${id}/`, { method: 'DELETE', headers });
    fetchTrips();
  };

  const totalKm    = trips.reduce((s, t) => s + (t.computed_distance || t.distance_km || 0), 0);
  const draftCount = trips.filter(t => t.is_draft).length;

  if (!selectedVehicleId) return <div style={s.section}><p style={s.empty}>Select a vehicle above.</p></div>;

  return (
    <div style={s.section}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Total Trips',    value: trips.length,  color: '#1d4ed8' },
          { label: 'Total Distance', value: totalKm > 0 ? totalKm.toFixed(0) + ' km' : '—', color: '#7e22ce' },
          { label: 'Drafts',         value: draftCount,    color: '#f59e0b' },
        ].map(c => (
          <div key={c.label} style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => openAdd(false)} style={s.addBtn}>🗺️ Log Trip</button>
        <button onClick={() => openAdd(true)} style={{ ...s.addBtn, backgroundColor: '#f59e0b' }}>📸 Quick Capture</button>
      </div>

      {loading ? <p style={s.empty}>Loading…</p> : trips.length === 0 ? <p style={s.empty}>No trips logged yet.</p> : (
        trips.map(trip => {
          const expanded = expandId === trip.id;
          const dist = trip.computed_distance || trip.distance_km;
          return (
            <div key={trip.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${trip.is_draft ? '#f59e0b' : '#7e22ce'}`, opacity: trip.is_draft ? 0.85 : 1 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setExpandId(expanded ? null : trip.id)}>
                {trip.image_url
                  ? <img src={trip.image_url} alt={trip.title} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
                  : <div style={{ width: 48, height: 48, borderRadius: 8, background: trip.is_draft ? '#fef3c7' : '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{trip.is_draft ? '📸' : '🗺️'}</div>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{trip.title}{trip.is_draft && <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#fef3c7', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>DRAFT</span>}</div>
                    {dist && <div style={{ fontSize: 13, fontWeight: 700, color: '#7e22ce' }}>{parseFloat(dist).toFixed(0)} km</div>}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{fmtD(trip.trip_date)}{trip.from_location && trip.to_location ? ` · ${trip.from_location} → ${trip.to_location}` : ''}</div>
                </div>
                <span style={{ color: '#94a3b8', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
              </div>
              {expanded && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                  {trip.purpose && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Purpose: {trip.purpose}</div>}
                  {trip.notes && <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>{trip.notes}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEdit(trip)} style={{ ...s.primaryBtn, fontSize: 11, padding: '4px 10px' }}>✏️ {trip.is_draft ? 'Fill Details' : 'Edit'}</button>
                    <button onClick={() => handleDelete(trip.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '4px 10px', backgroundColor: '#ef4444' }}>🗑 Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      <Modal open={modalOpen} onClose={resetForm}
        title={editId ? (form.is_draft ? 'Fill Trip Details' : 'Edit Trip') : (form.is_draft ? '📸 Quick Capture' : 'Log Trip')}
        onSave={handleSave} saveLabel={saving ? 'Saving…' : editId ? 'Update' : form.is_draft ? 'Save Draft' : 'Save Trip'} saving={saving}>
        <div className="form-grid">
          <label>Date<input style={s.input} type="date" value={form.trip_date} onChange={e => setF('trip_date', e.target.value)} /></label>
          <label>Title<input style={s.input} value={form.title} onChange={e => setF('title', e.target.value)} placeholder="Bangalore to Mysore" /></label>
          {!form.is_draft && (
            <>
              <label>From<input style={s.input} value={form.from_location} onChange={e => setF('from_location', e.target.value)} /></label>
              <label>To<input style={s.input} value={form.to_location} onChange={e => setF('to_location', e.target.value)} /></label>
              <label>Start Odometer<input style={s.input} type="number" value={form.start_odometer} onChange={e => setF('start_odometer', e.target.value)} /></label>
              <label>End Odometer<input style={s.input} type="number" value={form.end_odometer} onChange={e => setF('end_odometer', e.target.value)} /></label>
              {computedDist && (
                <div style={{ padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                  Distance: {computedDist} km
                </div>
              )}
              <label>Distance km (manual)<input style={s.input} type="number" value={form.distance_km} onChange={e => setF('distance_km', e.target.value)} /></label>
              <label>Purpose<input style={s.input} value={form.purpose} onChange={e => setF('purpose', e.target.value)} /></label>
            </>
          )}
          <label>Image URL<input style={s.input} value={form.image_url} onChange={e => setF('image_url', e.target.value)} placeholder="https://…" /></label>
          <label>Notes<textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setF('notes', e.target.value)} /></label>
        </div>
      </Modal>
    </div>
  );
}
