import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

const TABS_DEF = [
  {
    id: 'oil', label: '🔄 Oil', endpoint: 'oil-changes', dataKey: 'oil',
    init: { date: todayStr(), odometer: '', oil_brand: '', oil_grade: '', oil_amount: '', cost: '', next_change_date: '', next_change_km: '', notes: '' },
    fromRecord: r => ({ date: r.date, odometer: String(r.odometer), oil_brand: r.oil_brand || '', oil_grade: r.oil_grade || '', oil_amount: r.oil_amount ? String(r.oil_amount) : '', cost: String(r.cost || ''), next_change_date: r.next_change_date || '', next_change_km: r.next_change_km ? String(r.next_change_km) : '', notes: r.notes || '' }),
    fields: [
      { key: 'date',             label: 'Date',             type: 'date' },
      { key: 'odometer',         label: 'Odometer (km)',    type: 'number', req: true },
      { key: 'oil_brand',        label: 'Oil Brand',        type: 'text',   placeholder: 'Castrol, Shell…' },
      { key: 'oil_grade',        label: 'Oil Grade',        type: 'text',   placeholder: '10W-40' },
      { key: 'oil_amount',       label: 'Amount (L)',       type: 'number' },
      { key: 'cost',             label: 'Cost (₹)',         type: 'number' },
      { key: 'next_change_date', label: 'Next Change Date', type: 'date' },
      { key: 'next_change_km',   label: 'Next Change KM',   type: 'number' },
      { key: 'notes',            label: 'Notes',            type: 'text' },
    ],
  },
  {
    id: 'tyre', label: '⭕ Tyre', endpoint: 'tyre-pressure', dataKey: 'tyre',
    init: { date: todayStr(), front_left: '', front_right: '', rear_left: '', rear_right: '', spare: '', notes: '' },
    fromRecord: r => ({ date: r.date, front_left: r.front_left ? String(r.front_left) : '', front_right: r.front_right ? String(r.front_right) : '', rear_left: r.rear_left ? String(r.rear_left) : '', rear_right: r.rear_right ? String(r.rear_right) : '', spare: r.spare ? String(r.spare) : '', notes: r.notes || '' }),
    fields: [
      { key: 'date',        label: 'Date',              type: 'date' },
      { key: 'front_left',  label: 'Front Left (PSI)',  type: 'number', step: '0.1' },
      { key: 'front_right', label: 'Front Right (PSI)', type: 'number', step: '0.1' },
      { key: 'rear_left',   label: 'Rear Left (PSI)',   type: 'number', step: '0.1' },
      { key: 'rear_right',  label: 'Rear Right (PSI)',  type: 'number', step: '0.1' },
      { key: 'spare',       label: 'Spare (PSI)',       type: 'number', step: '0.1' },
      { key: 'notes',       label: 'Notes',             type: 'text' },
    ],
  },
  {
    id: 'accessories', label: '🔩 Accessories', endpoint: 'accessory-spends', dataKey: 'accessories',
    init: { date: todayStr(), item_name: '', category: 'other', cost: '', vendor: '', notes: '' },
    fromRecord: r => ({ date: r.date, item_name: r.item_name, category: r.category, cost: String(r.cost), vendor: r.vendor || '', notes: r.notes || '' }),
    fields: [
      { key: 'date',      label: 'Date',      type: 'date' },
      { key: 'item_name', label: 'Item *',    type: 'text',   req: true, placeholder: 'Seat cover, Dash cam…' },
      { key: 'category',  label: 'Category',  type: 'select', options: [['electrical','Electrical'],['mechanical','Mechanical'],['cosmetic','Cosmetic'],['safety','Safety'],['other','Other']] },
      { key: 'cost',      label: 'Cost (₹)', type: 'number', req: true },
      { key: 'vendor',    label: 'Vendor',    type: 'text' },
      { key: 'notes',     label: 'Notes',     type: 'text' },
    ],
  },
  {
    id: 'parts', label: '🔑 Parts', endpoint: 'part-replacements', dataKey: 'parts',
    init: { date: todayStr(), part_name: '', part_number: '', manufacturer: '', cost: '', vendor: '', odometer: '', notes: '' },
    fromRecord: r => ({ date: r.date, part_name: r.part_name, part_number: r.part_number || '', manufacturer: r.manufacturer || '', cost: String(r.cost), vendor: r.vendor || '', odometer: r.odometer ? String(r.odometer) : '', notes: r.notes || '' }),
    fields: [
      { key: 'date',         label: 'Date',           type: 'date' },
      { key: 'part_name',    label: 'Part Name *',    type: 'text',   req: true },
      { key: 'part_number',  label: 'Part No.',       type: 'text' },
      { key: 'manufacturer', label: 'Manufacturer',   type: 'text' },
      { key: 'cost',         label: 'Cost (₹) *',    type: 'number', req: true },
      { key: 'vendor',       label: 'Vendor/Shop',    type: 'text' },
      { key: 'odometer',     label: 'Odometer (km)',  type: 'number' },
      { key: 'notes',        label: 'Notes',          type: 'text' },
    ],
  },
];

export default function VehicleMaintTab({ vehicles, selectedVehicleId, showToast, onSaved }) {
  const [maintTab, setMaintTab] = useState('oil');
  const [data, setData]         = useState({ oil: [], tyre: [], accessories: [], parts: [] });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({});
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedVehicleId) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const vid = `?vehicle_id=${selectedVehicleId}`;
    const [or, tr, ar, pr] = await Promise.all([
      fetch(`${API}/api/oil-changes/${vid}`, { headers }),
      fetch(`${API}/api/tyre-pressure/${vid}`, { headers }),
      fetch(`${API}/api/accessory-spends/${vid}`, { headers }),
      fetch(`${API}/api/part-replacements/${vid}`, { headers }),
    ]);
    setData({ oil: or.ok ? await or.json() : [], tyre: tr.ok ? await tr.json() : [], accessories: ar.ok ? await ar.json() : [], parts: pr.ok ? await pr.json() : [] });
  }, [selectedVehicleId]);

  useEffect(() => { setData({ oil: [], tyre: [], accessories: [], parts: [] }); fetchData(); }, [fetchData]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const currentTabDef = TABS_DEF.find(t => t.id === maintTab);

  const openAdd = () => { setEditId(null); setForm({ ...currentTabDef.init }); setShowForm(true); };
  const openEdit = (rec) => { setEditId(rec.id); setForm(currentTabDef.fromRecord(rec)); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, vehicle: parseInt(selectedVehicleId) };
    ['cost','oil_amount','next_change_km','odometer','front_left','front_right','rear_left','rear_right','spare'].forEach(k => {
      if (payload[k] !== '' && payload[k] !== undefined) payload[k] = parseFloat(payload[k]);
      else payload[k] = null;
    });
    if (payload.next_change_date === '') payload.next_change_date = null;
    try {
      const url    = editId ? `${API}/api/${currentTabDef.endpoint}/${editId}/` : `${API}/api/${currentTabDef.endpoint}/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Saved');
      setShowForm(false); setEditId(null); fetchData(); onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/${currentTabDef.endpoint}/${id}/`, { method: 'DELETE', headers });
    fetchData();
  };

  const CAT_COLORS = { electrical: '#6366f1', mechanical: '#0369a1', cosmetic: '#ec4899', safety: '#16a34a', other: '#64748b' };

  const renderRecord = (rec) => {
    const editBtn = <button onClick={() => openEdit(rec)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 15 }}>✏️</button>;
    const delBtn  = <button onClick={() => handleDelete(rec.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 15 }}>🗑</button>;
    if (maintTab === 'oil') {
      const due = rec.next_change_date;
      const today = todayStr();
      const urgent = due && due <= today;
      const soon   = due && !urgent && (new Date(due) - new Date()) / 86400000 <= 14;
      return (
        <div key={rec.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${urgent ? '#dc2626' : soon ? '#f59e0b' : '#0369a1'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtD(rec.date)}{rec.odometer && ` · ${rec.odometer?.toLocaleString('en-IN')} km`}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{[rec.oil_brand, rec.oil_grade, rec.oil_amount && `${rec.oil_amount}L`].filter(Boolean).join(' · ')}</div>
              {rec.cost > 0 && <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>₹{fmt(rec.cost)}</div>}
              {due && <div style={{ fontSize: 11, fontWeight: 700, color: urgent ? '#dc2626' : soon ? '#f59e0b' : '#16a34a', marginTop: 4 }}>
                {urgent ? '⚠️ Oil change OVERDUE' : `Next: ${fmtD(due)}${rec.next_change_km ? ` or ${rec.next_change_km?.toLocaleString('en-IN')} km` : ''}`}
              </div>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>{editBtn}{delBtn}</div>
          </div>
        </div>
      );
    }
    if (maintTab === 'tyre') return (
      <div key={rec.id} style={{ ...s.card, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{fmtD(rec.date)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxWidth: 220 }}>
              {['front_left','front_right','rear_left','rear_right'].map(k => rec[k] != null && (
                <div key={k} style={{ fontSize: 11, background: '#f1f5f9', borderRadius: 4, padding: '3px 6px' }}>
                  {k.replace('_', ' ')}: <strong>{rec[k]} PSI</strong>
                </div>
              ))}
              {rec.spare != null && <div style={{ fontSize: 11, background: '#f1f5f9', borderRadius: 4, padding: '3px 6px' }}>spare: <strong>{rec.spare} PSI</strong></div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>{editBtn}{delBtn}</div>
        </div>
      </div>
    );
    if (maintTab === 'accessories') return (
      <div key={rec.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${CAT_COLORS[rec.category] || '#64748b'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{rec.item_name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{fmtD(rec.date)}{rec.vendor && ` · ${rec.vendor}`} · {rec.category}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>₹{fmt(rec.cost)}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>{editBtn}{delBtn}</div>
        </div>
      </div>
    );
    if (maintTab === 'parts') return (
      <div key={rec.id} style={{ ...s.card, marginBottom: 8, borderLeft: '4px solid #7e22ce' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{rec.part_name}{rec.manufacturer && ` (${rec.manufacturer})`}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{fmtD(rec.date)}{rec.odometer && ` · ${rec.odometer?.toLocaleString('en-IN')} km`}{rec.vendor && ` · ${rec.vendor}`}</div>
            {rec.part_number && <div style={{ fontSize: 10, color: '#94a3b8' }}>Part#: {rec.part_number}</div>}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>₹{fmt(rec.cost)}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>{editBtn}{delBtn}</div>
        </div>
      </div>
    );
    return null;
  };

  if (!selectedVehicleId) return <div style={s.section}><p style={s.empty}>Select a vehicle above.</p></div>;

  const totalAccessories = data.accessories.reduce((s, a) => s + parseFloat(a.cost || 0), 0);
  const totalParts = data.parts.reduce((s, p) => s + parseFloat(p.cost || 0), 0);
  const currentData = data[currentTabDef?.dataKey] || [];

  return (
    <div style={s.section}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 14 }}>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Oil Changes</div><div style={{ fontSize: 18, fontWeight: 700, color: '#0369a1' }}>{data.oil.length}</div></div>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Tyre Logs</div><div style={{ fontSize: 18, fontWeight: 700, color: '#64748b' }}>{data.tyre.length}</div></div>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Accessories</div><div style={{ fontSize: 14, fontWeight: 700, color: '#6366f1' }}>₹{fmt(totalAccessories)}</div></div>
        <div style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}><div style={{ fontSize: 10, color: '#94a3b8' }}>Parts</div><div style={{ fontSize: 14, fontWeight: 700, color: '#7e22ce' }}>₹{fmt(totalParts)}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '2px solid #e2e8f0', paddingBottom: 8, flexWrap: 'wrap' }}>
        {TABS_DEF.map(t => (
          <button key={t.id} onClick={() => { setMaintTab(t.id); setShowForm(false); setEditId(null); }}
            style={{ ...s.sessionPill, ...(maintTab === t.id ? s.sessionPillActive : {}) }}>
            {t.label}{data[t.dataKey].length > 0 && ` (${data[t.dataKey].length})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={showForm ? () => { setShowForm(false); setEditId(null); } : openAdd}
          style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: showForm ? '#64748b' : '#1d4ed8' }}>
          {showForm ? '✕ Cancel' : `+ Add ${currentTabDef?.label?.replace(/.*\s/, '')}`}
        </button>
      </div>

      {showForm && currentTabDef && (
        <form onSubmit={handleSubmit} style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editId ? 'Edit' : 'New'} {currentTabDef.label.replace(/.*\s/, '')} Record</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {currentTabDef.fields.map(f => (
              <div key={f.key} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                <label style={s.fieldLabel}>{f.label}</label>
                {f.type === 'select' ? (
                  <select style={s.input} value={form[f.key] || ''} onChange={e => setF(f.key, e.target.value)}>
                    {(f.options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea style={{ ...s.input, height: 50 }} value={form[f.key] || ''} onChange={e => setF(f.key, e.target.value)} />
                ) : (
                  <input style={s.input} type={f.type} step={f.step} value={form[f.key] || ''} onChange={e => setF(f.key, e.target.value)} placeholder={f.placeholder || ''} />
                )}
              </div>
            ))}
          </div>
          <button type="submit" disabled={saving} style={{ ...s.primaryBtn, width: '100%', marginTop: 10 }}>
            {saving ? 'Saving…' : editId ? '✓ Update' : '✓ Save'}
          </button>
        </form>
      )}

      {currentData.length === 0 && !showForm && <p style={s.empty}>No records yet.</p>}
      {currentData.map(rec => renderRecord(rec))}
    </div>
  );
}
