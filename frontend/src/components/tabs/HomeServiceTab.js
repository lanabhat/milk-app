import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

const TYPE_LABELS  = { routine: 'Routine', repair: 'Repair', amc: 'AMC Service', installation: 'Installation', other: 'Other' };
const TYPE_COLORS  = { routine: '#0369a1', repair: '#f59e0b', amc: '#16a34a', installation: '#7e22ce', other: '#64748b' };
const EMPTY_FORM   = { date: todayStr(), service_type: 'routine', description: '', technician: '', company: '', cost: '', next_service_date: '', bill_url: '', notes: '' };

export default function HomeServiceTab({ appliances, selectedApplianceId, showToast, onSaved }) {
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [expandId, setExpandId]   = useState(null);

  const fetchRecords = useCallback(async () => {
    if (!selectedApplianceId) return;
    setLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const r = await fetch(`${API}/api/appliance-services/?appliance_id=${selectedApplianceId}`, { headers });
      if (r.ok) setRecords(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [selectedApplianceId]);

  useEffect(() => { setRecords([]); fetchRecords(); }, [fetchRecords]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd  = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (r) => {
    setEditId(r.id);
    setForm({ date: r.date, service_type: r.service_type, description: r.description || '', technician: r.technician || '', company: r.company || '', cost: String(r.cost || ''), next_service_date: r.next_service_date || '', bill_url: r.bill_url || '', notes: r.notes || '' });
    setShowForm(true); setExpandId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedApplianceId) return;
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, appliance: parseInt(selectedApplianceId), cost: parseFloat(form.cost) || 0, next_service_date: form.next_service_date || null };
    try {
      const url    = editId ? `${API}/api/appliance-services/${editId}/` : `${API}/api/appliance-services/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Service record saved');
      setShowForm(false); setEditId(null); fetchRecords(); onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/appliance-services/${id}/`, { method: 'DELETE', headers });
    fetchRecords();
  };

  const totalSpent = records.reduce((t, r) => t + parseFloat(r.cost || 0), 0);
  const selectedAppliance = appliances.find(a => String(a.id) === selectedApplianceId);

  if (!selectedApplianceId) return <div style={s.section}><p style={s.empty}>Select an appliance above.</p></div>;

  return (
    <div style={s.section}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 14 }}>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Records</div><div style={{ fontSize: 18, fontWeight: 700, color: '#1d4ed8' }}>{records.length}</div></div>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Total Spent</div><div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>₹{fmt(totalSpent)}</div></div>
        {selectedAppliance?.warranty_expiry && <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Warranty till</div><div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{fmtD(selectedAppliance.warranty_expiry)}</div></div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={showForm ? () => { setShowForm(false); setEditId(null); } : openAdd}
          style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: showForm ? '#64748b' : '#0369a1' }}>
          {showForm ? '✕ Cancel' : '+ Add Service Record'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editId ? 'Edit Record' : 'New Service Record'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={s.fieldLabel}>Date</label><input style={s.input} type="date" value={form.date} onChange={e => setF('date', e.target.value)} /></div>
            <div>
              <label style={s.fieldLabel}>Service Type</label>
              <select style={s.input} value={form.service_type} onChange={e => setF('service_type', e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label style={s.fieldLabel}>Technician</label><input style={s.input} value={form.technician} onChange={e => setF('technician', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Company / Service Center</label><input style={s.input} value={form.company} onChange={e => setF('company', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Cost (₹)</label><input style={s.input} type="number" value={form.cost} onChange={e => setF('cost', e.target.value)} /></div>
            <div><label style={s.fieldLabel}>Next Service Date</label><input style={s.input} type="date" value={form.next_service_date} onChange={e => setF('next_service_date', e.target.value)} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Description</label><textarea style={{ ...s.input, height: 60 }} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Work done, issues found, parts replaced…" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Bill URL (photo link)</label><input style={s.input} value={form.bill_url} onChange={e => setF('bill_url', e.target.value)} placeholder="https://…" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.fieldLabel}>Notes</label><input style={s.input} value={form.notes} onChange={e => setF('notes', e.target.value)} /></div>
          </div>
          <button type="submit" disabled={saving} style={{ ...s.primaryBtn, width: '100%', marginTop: 10, backgroundColor: '#0369a1' }}>
            {saving ? 'Saving…' : editId ? '✓ Update' : '✓ Save Record'}
          </button>
        </form>
      )}

      {loading ? <p style={s.empty}>Loading…</p> : records.length === 0 ? <p style={s.empty}>No service records yet.</p> : (
        records.map(rec => {
          const expanded = expandId === rec.id;
          return (
            <div key={rec.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${TYPE_COLORS[rec.service_type] || '#64748b'}` }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setExpandId(expanded ? null : rec.id)}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔧</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtD(rec.date)} · {TYPE_LABELS[rec.service_type]}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>₹{fmt(rec.cost)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{[rec.technician, rec.company].filter(Boolean).join(' · ')}</div>
                </div>
                <span style={{ color: '#94a3b8', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
              </div>
              {expanded && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                  {rec.description && <p style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>{rec.description}</p>}
                  {rec.next_service_date && <div style={{ fontSize: 12, color: '#0369a1', marginBottom: 8 }}>📅 Next service: {fmtD(rec.next_service_date)}</div>}
                  {rec.bill_url && <a href={rec.bill_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1d4ed8', display: 'block', marginBottom: 8 }}>📎 View Bill</a>}
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
