import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

const TYPE_LABELS  = { routine: 'Routine Service', repair: 'Repair', accidental: 'Accidental', recall: 'Recall', other: 'Other' };
const TYPE_COLORS  = { routine: '#0369a1', repair: '#f59e0b', accidental: '#dc2626', recall: '#7e22ce', other: '#64748b' };
const EMPTY_PART   = { part_name: '', part_number: '', manufacturer: '', quantity: '1', unit_cost: '', total_cost: '' };
const EMPTY_FORM   = { date: todayStr(), service_type: 'routine', service_center: '', odometer: '', description: '', labour_cost: '', next_service_date: '', next_service_km: '', notes: '', parts: [] };

export default function VehicleServiceTab({ vehicles, selectedVehicleId, showToast, onSaved }) {
  const [records, setRecords]               = useState([]);
  const [centers, setCenters]               = useState([]);
  const [loading, setLoading]               = useState(false);
  const [showForm, setShowForm]             = useState(false);
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [editId, setEditId]                 = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [expandId, setExpandId]             = useState(null);
  const [showCenterForm, setShowCenterForm] = useState(false);
  const [centerForm, setCenterForm]         = useState({ name: '', address: '', phone: '' });

  const fetchAll = useCallback(async () => {
    if (!selectedVehicleId) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setLoading(true);
    try {
      const [rr, cr] = await Promise.all([
        fetch(`${API}/api/service-records/?vehicle_id=${selectedVehicleId}`, { headers }),
        fetch(`${API}/api/service-centers/`, { headers }),
      ]);
      if (rr.ok) setRecords(await rr.json());
      if (cr.ok) setCenters(await cr.json());
    } catch {}
    finally { setLoading(false); }
  }, [selectedVehicleId]);

  useEffect(() => { setRecords([]); fetchAll(); }, [fetchAll]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const addPart = () => setForm(f => ({ ...f, parts: [...f.parts, { ...EMPTY_PART }] }));
  const removePart = (i) => setForm(f => ({ ...f, parts: f.parts.filter((_, idx) => idx !== i) }));
  const setPart = (i, k, v) => setForm(f => {
    const parts = [...f.parts];
    parts[i] = { ...parts[i], [k]: v };
    if (k === 'quantity' || k === 'unit_cost') {
      const q = parseFloat(k === 'quantity' ? v : parts[i].quantity) || 0;
      const u = parseFloat(k === 'unit_cost' ? v : parts[i].unit_cost) || 0;
      parts[i].total_cost = String((q * u).toFixed(2));
    }
    return { ...f, parts };
  });

  const partsTotal = form.parts.reduce((s, p) => s + (parseFloat(p.total_cost) || 0), 0);
  const grandTotal = (parseFloat(form.labour_cost) || 0) + partsTotal;

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (rec) => {
    setEditId(rec.id);
    setForm({
      date: rec.date, service_type: rec.service_type,
      service_center: rec.service_center ? String(rec.service_center) : '',
      odometer: rec.odometer ? String(rec.odometer) : '',
      description: rec.description || '', labour_cost: String(rec.labour_cost || ''),
      next_service_date: rec.next_service_date || '', next_service_km: rec.next_service_km ? String(rec.next_service_km) : '',
      notes: rec.notes || '',
      parts: (rec.parts || []).map(p => ({ part_name: p.part_name, part_number: p.part_number || '', manufacturer: p.manufacturer || '', quantity: String(p.quantity), unit_cost: String(p.unit_cost), total_cost: String(p.total_cost) })),
    });
    setShowForm(true); setExpandId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVehicleId) return;
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = {
      vehicle: parseInt(selectedVehicleId), date: form.date, service_type: form.service_type,
      service_center: form.service_center || null,
      odometer: form.odometer ? parseFloat(form.odometer) : null,
      description: form.description, labour_cost: parseFloat(form.labour_cost) || 0, total_cost: grandTotal,
      next_service_date: form.next_service_date || null,
      next_service_km: form.next_service_km ? parseFloat(form.next_service_km) : null,
      notes: form.notes,
      parts: form.parts.map(p => ({ part_name: p.part_name, part_number: p.part_number, manufacturer: p.manufacturer, quantity: parseFloat(p.quantity) || 1, unit_cost: parseFloat(p.unit_cost) || 0, total_cost: parseFloat(p.total_cost) || 0 })).filter(p => p.part_name),
    };
    try {
      const url    = editId ? `${API}/api/service-records/${editId}/` : `${API}/api/service-records/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Service record saved');
      setShowForm(false); setEditId(null); setForm(EMPTY_FORM); fetchAll(); onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleSaveCenter = async () => {
    if (!centerForm.name.trim()) { showToast('Name required', 'error'); return; }
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/service-centers/`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(centerForm) });
    if (res.ok) { const c = await res.json(); setCenters(prev => [...prev, c]); setShowCenterForm(false); setCenterForm({ name: '', address: '', phone: '' }); showToast('✓ Service center added'); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/service-records/${id}/`, { method: 'DELETE', headers });
    fetchAll();
  };

  const totalSpent = records.reduce((s, r) => s + parseFloat(r.total_cost || 0), 0);

  if (!selectedVehicleId) return <div style={s.section}><p style={s.empty}>Select a vehicle above.</p></div>;

  return (
    <div style={s.section}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 14 }}>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Total Records</div><div style={{ fontSize: 18, fontWeight: 700, color: '#1d4ed8' }}>{records.length}</div></div>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Total Spent</div><div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>₹{fmt(totalSpent)}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={showForm ? () => { setShowForm(false); setEditId(null); } : openAdd}
          style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: showForm ? '#64748b' : '#0369a1' }}>
          {showForm ? '✕ Cancel' : '+ Add Service Record'}
        </button>
        <button onClick={() => setShowCenterForm(v => !v)} style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: '#64748b' }}>
          🏪 Service Centers ({centers.length})
        </button>
      </div>

      {showCenterForm && (
        <div style={{ ...s.card, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Add Service Center</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div><label style={s.fieldLabel}>Name</label><input style={s.input} value={centerForm.name} onChange={e => setCenterForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label style={s.fieldLabel}>Phone</label><input style={s.input} value={centerForm.phone} onChange={e => setCenterForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Address</label><input style={s.input} value={centerForm.address} onChange={e => setCenterForm(f => ({ ...f, address: e.target.value }))} /></div>
          </div>
          {centers.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>{centers.map(c => <span key={c.id} style={{ fontSize: 11, background: '#f1f5f9', borderRadius: 6, padding: '3px 8px', color: '#475569' }}>{c.name}</span>)}</div>}
          <button onClick={handleSaveCenter} style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px' }}>+ Add</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editId ? 'Edit Service Record' : 'New Service Record'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={s.fieldLabel}>Date</label><input style={s.input} type="date" value={form.date} onChange={e => setF('date', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Service Type</label>
              <select style={s.input} value={form.service_type} onChange={e => setF('service_type', e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label style={s.fieldLabel}>Service Center</label>
              <select style={s.input} value={form.service_center} onChange={e => setF('service_center', e.target.value)}>
                <option value="">— none —</option>
                {centers.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </div>
            <div><label style={s.fieldLabel}>Odometer (km)</label><input style={s.input} type="number" value={form.odometer} onChange={e => setF('odometer', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Labour Cost (₹)</label><input style={s.input} type="number" value={form.labour_cost} onChange={e => setF('labour_cost', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Next Service Date</label><input style={s.input} type="date" value={form.next_service_date} onChange={e => setF('next_service_date', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Next Service KM</label><input style={s.input} type="number" value={form.next_service_km} onChange={e => setF('next_service_km', e.target.value)} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Description</label><textarea style={{ ...s.input, height: 60 }} value={form.description} onChange={e => setF('description', e.target.value)} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Notes</label><input style={s.input} value={form.notes} onChange={e => setF('notes', e.target.value)} /></div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Parts Replaced ({form.parts.length})</div>
              <button type="button" onClick={addPart} style={{ ...s.primaryBtn, fontSize: 11, padding: '4px 10px', backgroundColor: '#7e22ce' }}>+ Add Part</button>
            </div>
            {form.parts.map((p, i) => (
              <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div><label style={s.fieldLabel}>Part Name *</label><input style={s.input} value={p.part_name} onChange={e => setPart(i, 'part_name', e.target.value)} placeholder="Air Filter" /></div>
                  <div><label style={s.fieldLabel}>Part No.</label><input style={s.input} value={p.part_number} onChange={e => setPart(i, 'part_number', e.target.value)} /></div>
                  <div><label style={s.fieldLabel}>Manufacturer</label><input style={s.input} value={p.manufacturer} onChange={e => setPart(i, 'manufacturer', e.target.value)} /></div>
                  <div><label style={s.fieldLabel}>Qty</label><input style={s.input} type="number" step="0.1" value={p.quantity} onChange={e => setPart(i, 'quantity', e.target.value)} /></div>
                  <div><label style={s.fieldLabel}>Unit Cost (₹)</label><input style={s.input} type="number" step="0.01" value={p.unit_cost} onChange={e => setPart(i, 'unit_cost', e.target.value)} /></div>
                  <div><label style={s.fieldLabel}>Total</label><input style={{ ...s.input, background: '#f0fdf4', color: '#16a34a', fontWeight: 700 }} readOnly value={p.total_cost ? `₹${fmt(p.total_cost)}` : ''} /></div>
                </div>
                <button type="button" onClick={() => removePart(i)} style={{ marginTop: 4, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>✕ Remove</button>
              </div>
            ))}
            {(partsTotal > 0 || parseFloat(form.labour_cost) > 0) && (
              <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Labour:</span><span>₹{fmt(form.labour_cost || 0)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Parts:</span><span>₹{fmt(partsTotal)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 4, borderTop: '1px solid #bfdbfe', paddingTop: 4 }}><span>Total:</span><span>₹{fmt(grandTotal)}</span></div>
              </div>
            )}
          </div>
          <button type="submit" disabled={saving} style={{ ...s.primaryBtn, width: '100%', marginTop: 10, backgroundColor: '#0369a1' }}>
            {saving ? 'Saving…' : editId ? '✓ Update' : '✓ Save Service Record'}
          </button>
        </form>
      )}

      {loading ? <p style={s.empty}>Loading…</p> : records.length === 0 ? <p style={s.empty}>No service records yet.</p> : (
        records.map(rec => {
          const expanded = expandId === rec.id;
          return (
            <div key={rec.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${TYPE_COLORS[rec.service_type] || '#64748b'}` }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setExpandId(expanded ? null : rec.id)}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔧</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtD(rec.date)} · {TYPE_LABELS[rec.service_type]}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>₹{fmt(rec.total_cost)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {rec.service_center_name && `${rec.service_center_name} · `}{rec.odometer && `${rec.odometer?.toLocaleString('en-IN')} km`}{rec.parts?.length > 0 && ` · ${rec.parts.length} part(s)`}
                  </div>
                </div>
                <span style={{ color: '#94a3b8', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
              </div>
              {expanded && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                  {rec.description && <p style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>{rec.description}</p>}
                  {rec.next_service_date && <div style={{ fontSize: 12, color: '#0369a1', marginBottom: 4 }}>📅 Next: {fmtD(rec.next_service_date)}{rec.next_service_km ? ` or at ${rec.next_service_km?.toLocaleString('en-IN')} km` : ''}</div>}
                  {rec.parts?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#7e22ce', marginBottom: 4 }}>Parts replaced:</div>
                      {rec.parts.map((p, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{p.part_name}{p.manufacturer ? ` (${p.manufacturer})` : ''} × {p.quantity}</span>
                          <span>₹{fmt(p.total_cost)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                    <span>Labour: ₹{fmt(rec.labour_cost)}</span><span>Parts: ₹{fmt(rec.parts_cost)}</span><span style={{ fontWeight: 700 }}>Total: ₹{fmt(rec.total_cost)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEdit(rec)} style={{ ...s.primaryBtn, fontSize: 11, padding: '4px 10px' }}>✏️ Edit</button>
                    <button onClick={() => handleDelete(rec.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '4px 10px', backgroundColor: '#ef4444' }}>🗑 Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
