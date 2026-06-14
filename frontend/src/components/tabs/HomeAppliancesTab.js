import React, { useState } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';
import Modal from '../common/Modal';

const CAT_ICON  = { kitchen:'🍳', laundry:'🧺', entertainment:'📺', climate:'❄️', computing:'💻', mobile:'📱', lighting:'💡', security:'🔒', other:'🔌' };
const CAT_COLOR = { kitchen:'#f97316', laundry:'#0369a1', entertainment:'#7e22ce', climate:'#0ea5e9', computing:'#1d4ed8', mobile:'#be185d', lighting:'#eab308', security:'#64748b', other:'#475569' };
const CAT_LABELS = { kitchen:'Kitchen', laundry:'Laundry', entertainment:'Entertainment', climate:'Air/Climate', computing:'Computing', mobile:'Mobile/Phone', lighting:'Lighting', security:'Security', other:'Other' };

const EMPTY_FORM = { name: '', brand: '', model_number: '', category: 'other', purchase_date: '', purchase_price: '', warranty_expiry: '', amc_expiry: '', serial_number: '', location: '', image_url: '', notes: '' };

function StatusBadge({ days, label, warnDays = 30 }) {
  if (days === null || days === undefined) return null;
  const color = days < 0 ? '#dc2626' : days <= warnDays ? '#f59e0b' : '#16a34a';
  const bg    = days < 0 ? '#fee2e2' : days <= warnDays ? '#fef3c7' : '#dcfce7';
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, borderRadius: 4, padding: '2px 6px', marginRight: 4 }}>
    {days < 0 ? `${label} EXPIRED` : `${label}: ${days}d`}
  </span>;
}

export default function HomeAppliancesTab({ appliances, selectedApplianceId, onSelectAppliance, showToast, onSaved }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [expandId, setExpandId]   = useState(null);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const resetForm = () => { setEditId(null); setForm(EMPTY_FORM); setModalOpen(false); };

  const openEdit = (a) => {
    setEditId(a.id);
    setForm({ name: a.name, brand: a.brand || '', model_number: a.model_number || '', category: a.category, purchase_date: a.purchase_date || '', purchase_price: a.purchase_price != null ? String(a.purchase_price) : '', warranty_expiry: a.warranty_expiry || '', amc_expiry: a.amc_expiry || '', serial_number: a.serial_number || '', location: a.location || '', image_url: a.image_url || '', notes: a.notes || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null, purchase_date: form.purchase_date || null, warranty_expiry: form.warranty_expiry || null, amc_expiry: form.amc_expiry || null };
    try {
      const url    = editId ? `${API}/api/home-appliances/${editId}/` : `${API}/api/home-appliances/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Appliance added');
      resetForm(); onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (a) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/home-appliances/${a.id}/`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !a.is_active }) });
    onSaved();
  };

  const active   = appliances.filter(a => a.is_active);
  const inactive = appliances.filter(a => !a.is_active);

  const ApplianceCard = ({ a }) => {
    const icon  = CAT_ICON[a.category] || '🔌';
    const color = CAT_COLOR[a.category] || '#475569';
    const expanded = expandId === a.id;
    return (
      <div style={{ ...s.card, borderLeft: `4px solid ${color}`, marginBottom: 10, outline: String(a.id) === selectedApplianceId ? '2px solid var(--accent)' : 'none', outlineOffset: 2 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {a.image_url
            ? <img src={a.image_url} alt={a.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
            : <div style={{ width: 56, height: 56, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{icon}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{[a.brand, CAT_LABELS[a.category], a.location].filter(Boolean).join(' · ')}</div>
            <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <StatusBadge days={a.days_until_warranty} label="Warranty" />
              <StatusBadge days={a.days_until_amc} label="AMC" />
              <StatusBadge days={a.days_until_next_service} label="Service" warnDays={14} />
            </div>
          </div>
          <button onClick={() => setExpandId(expanded ? null : a.id)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</button>
        </div>
        {expanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {a.model_number && <div style={{ fontSize: 12, color: '#64748b' }}><span style={{ fontWeight: 600 }}>Model:</span> {a.model_number}</div>}
              {a.serial_number && <div style={{ fontSize: 12, color: '#64748b' }}><span style={{ fontWeight: 600 }}>Serial:</span> {a.serial_number}</div>}
              {a.purchase_date && <div style={{ fontSize: 12, color: '#64748b' }}><span style={{ fontWeight: 600 }}>Purchased:</span> {fmtD(a.purchase_date)}</div>}
              {a.purchase_price != null && <div style={{ fontSize: 12, color: '#64748b' }}><span style={{ fontWeight: 600 }}>Price:</span> ₹{fmt(a.purchase_price)}</div>}
              {a.warranty_expiry && <div style={{ fontSize: 12, color: '#64748b' }}><span style={{ fontWeight: 600 }}>Warranty till:</span> {fmtD(a.warranty_expiry)}</div>}
              {a.amc_expiry && <div style={{ fontSize: 12, color: '#64748b' }}><span style={{ fontWeight: 600 }}>AMC till:</span> {fmtD(a.amc_expiry)}</div>}
            </div>
            {a.notes && <p style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>{a.notes}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {String(a.id) !== selectedApplianceId && <button onClick={() => onSelectAppliance(String(a.id))} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', backgroundColor: '#16a34a' }}>✓ Select for Service</button>}
              <button onClick={() => openEdit(a)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px' }}>✏️ Edit</button>
              <button onClick={() => handleToggle(a)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', backgroundColor: a.is_active ? '#ef4444' : '#16a34a' }}>{a.is_active ? '🚫 Deactivate' : '✓ Reactivate'}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={s.section}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <h3 style={{ ...s.sectionTitle, margin: 0, flex: 1 }}>Appliances ({active.length})</h3>
        <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(true); }} style={s.addBtn}>
          + Add Appliance
        </button>
      </div>

      {active.length === 0 && <p style={s.empty}>No appliances yet. Add your first appliance above.</p>}
      {active.map(a => <ApplianceCard key={a.id} a={a} />)}

      {inactive.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Inactive ({inactive.length})</div>
          {inactive.map(a => <ApplianceCard key={a.id} a={a} />)}
        </div>
      )}

      <Modal open={modalOpen} onClose={resetForm} title={editId ? 'Edit Appliance' : 'Add Appliance'}
        onSave={handleSave} saveLabel={saving ? 'Saving…' : editId ? 'Update' : 'Add Appliance'} saving={saving}>
        <div className="form-grid">
          <label>Name *<input style={s.input} value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Samsung 253L Double Door Fridge" /></label>
          <label>Brand<input style={s.input} value={form.brand} onChange={e => setF('brand', e.target.value)} placeholder="Samsung, LG, Sony…" /></label>
          <label>Model Number<input style={s.input} value={form.model_number} onChange={e => setF('model_number', e.target.value)} /></label>
          <label>
            Category
            <select style={s.input} value={form.category} onChange={e => setF('category', e.target.value)}>
              {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{CAT_ICON[v]} {l}</option>)}
            </select>
          </label>
          <label>Location<input style={s.input} value={form.location} onChange={e => setF('location', e.target.value)} placeholder="Kitchen, Bedroom 1…" /></label>
          <label>Purchase Date<input style={s.input} type="date" value={form.purchase_date} onChange={e => setF('purchase_date', e.target.value)} /></label>
          <label>Purchase Price (₹)<input style={s.input} type="number" value={form.purchase_price} onChange={e => setF('purchase_price', e.target.value)} /></label>
          <label>Warranty Expiry<input style={s.input} type="date" value={form.warranty_expiry} onChange={e => setF('warranty_expiry', e.target.value)} /></label>
          <label>AMC Expiry<input style={s.input} type="date" value={form.amc_expiry} onChange={e => setF('amc_expiry', e.target.value)} /></label>
          <label>Serial Number<input style={s.input} value={form.serial_number} onChange={e => setF('serial_number', e.target.value)} /></label>
          <label>Image URL<input style={s.input} value={form.image_url} onChange={e => setF('image_url', e.target.value)} placeholder="https://…" /></label>
          <label>Notes<textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setF('notes', e.target.value)} /></label>
        </div>
      </Modal>
    </div>
  );
}
