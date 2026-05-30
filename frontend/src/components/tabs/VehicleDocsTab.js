import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

function DaysChip({ days, label }) {
  if (days === null || days === undefined) return null;
  const color = days < 0 ? '#dc2626' : days <= 30 ? '#f59e0b' : '#16a34a';
  const bg    = days < 0 ? '#fee2e2' : days <= 30 ? '#fef3c7' : '#dcfce7';
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 6, padding: '3px 8px' }}>{days < 0 ? `${label} EXPIRED ${Math.abs(days)}d ago` : days === 0 ? `${label} expires today!` : `${label}: ${days}d left`}</span>;
}

const STATUS_COLOR = { filed: '#64748b', under_review: '#f59e0b', approved: '#16a34a', rejected: '#dc2626', settled: '#0369a1' };

export default function VehicleDocsTab({ vehicles, selectedVehicleId, showToast, onSaved }) {
  const [docTab, setDocTab]   = useState('pucc');
  const [data, setData]       = useState({ pucc: [], insurance: [], claims: [], warranty: [] });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]       = useState({});
  const [editId, setEditId]   = useState(null);
  const [saving, setSaving]   = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedVehicleId) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const vid = `?vehicle_id=${selectedVehicleId}`;
    const [pr, ir, cr, wr] = await Promise.all([
      fetch(`${API}/api/pucc-records/${vid}`, { headers }),
      fetch(`${API}/api/insurance-policies/${vid}`, { headers }),
      fetch(`${API}/api/insurance-claims/${vid}`, { headers }),
      fetch(`${API}/api/extended-warranties/${vid}`, { headers }),
    ]);
    setData({
      pucc:      pr.ok ? await pr.json() : [],
      insurance: ir.ok ? await ir.json() : [],
      claims:    cr.ok ? await cr.json() : [],
      warranty:  wr.ok ? await wr.json() : [],
    });
  }, [selectedVehicleId]);

  useEffect(() => { setData({ pucc: [], insurance: [], claims: [], warranty: [] }); fetchData(); }, [fetchData]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const DEFS = {
    pucc: {
      fields: [
        { key: 'issue_date',     label: 'Issue Date',      type: 'date' },
        { key: 'expiry_date',    label: 'Expiry Date',     type: 'date' },
        { key: 'certificate_no', label: 'Certificate No.', type: 'text' },
        { key: 'test_center',    label: 'Test Center',     type: 'text' },
        { key: 'cost',           label: 'Cost (₹)',        type: 'number' },
        { key: 'notes',          label: 'Notes',           type: 'text' },
      ],
      endpoint: 'pucc-records', dataKey: 'pucc',
      init: { issue_date: todayStr(), expiry_date: '', certificate_no: '', test_center: '', cost: '', notes: '' },
      fromRecord: r => ({ issue_date: r.issue_date, expiry_date: r.expiry_date, certificate_no: r.certificate_no || '', test_center: r.test_center || '', cost: String(r.cost || ''), notes: r.notes || '' }),
    },
    insurance: {
      fields: [
        { key: 'provider',      label: 'Provider',            type: 'text' },
        { key: 'policy_number', label: 'Policy Number',       type: 'text' },
        { key: 'policy_type',   label: 'Policy Type',         type: 'select', options: [['comprehensive','Comprehensive'],['third_party','Third Party'],['own_damage','Own Damage']] },
        { key: 'start_date',    label: 'Start Date',          type: 'date' },
        { key: 'end_date',      label: 'End Date',            type: 'date' },
        { key: 'premium',       label: 'Premium (₹)',         type: 'number' },
        { key: 'insured_value', label: 'Insured Value (₹)',   type: 'number' },
        { key: 'agent_name',    label: 'Agent Name',          type: 'text' },
        { key: 'agent_phone',   label: 'Agent Phone',         type: 'text' },
        { key: 'notes',         label: 'Notes',               type: 'text' },
      ],
      endpoint: 'insurance-policies', dataKey: 'insurance',
      init: { provider: '', policy_number: '', policy_type: 'comprehensive', start_date: todayStr(), end_date: '', premium: '', insured_value: '', agent_name: '', agent_phone: '', notes: '' },
      fromRecord: r => ({ provider: r.provider, policy_number: r.policy_number, policy_type: r.policy_type, start_date: r.start_date, end_date: r.end_date, premium: String(r.premium), insured_value: r.insured_value ? String(r.insured_value) : '', agent_name: r.agent_name || '', agent_phone: r.agent_phone || '', notes: r.notes || '' }),
    },
    claims: {
      fields: [
        { key: 'policy',          label: 'Insurance Policy',    type: 'select', options: [] },
        { key: 'claim_date',      label: 'Claim Date',          type: 'date' },
        { key: 'incident_date',   label: 'Incident Date',       type: 'date' },
        { key: 'description',     label: 'Description',         type: 'textarea' },
        { key: 'claimed_amount',  label: 'Claimed Amount (₹)', type: 'number' },
        { key: 'approved_amount', label: 'Approved Amount (₹)',type: 'number' },
        { key: 'settlement_date', label: 'Settlement Date',     type: 'date' },
        { key: 'status',          label: 'Status',              type: 'select', options: [['filed','Filed'],['under_review','Under Review'],['approved','Approved'],['rejected','Rejected'],['settled','Settled']] },
        { key: 'notes',           label: 'Notes',               type: 'text' },
      ],
      endpoint: 'insurance-claims', dataKey: 'claims',
      init: { policy: '', claim_date: todayStr(), incident_date: todayStr(), description: '', claimed_amount: '', approved_amount: '', settlement_date: '', status: 'filed', notes: '' },
      fromRecord: r => ({ policy: String(r.policy), claim_date: r.claim_date, incident_date: r.incident_date, description: r.description, claimed_amount: String(r.claimed_amount), approved_amount: r.approved_amount ? String(r.approved_amount) : '', settlement_date: r.settlement_date || '', status: r.status, notes: r.notes || '' }),
    },
    warranty: {
      fields: [
        { key: 'provider',             label: 'Provider',             type: 'text' },
        { key: 'contract_number',      label: 'Contract No.',         type: 'text' },
        { key: 'start_date',           label: 'Start Date',           type: 'date' },
        { key: 'end_date',             label: 'End Date',             type: 'date' },
        { key: 'coverage_description', label: 'Coverage',             type: 'textarea' },
        { key: 'max_claim_amount',     label: 'Max Claim Amount (₹)', type: 'number' },
        { key: 'contact_phone',        label: 'Contact Phone',        type: 'text' },
        { key: 'cost',                 label: 'Cost (₹)',             type: 'number' },
        { key: 'notes',                label: 'Notes',                type: 'text' },
      ],
      endpoint: 'extended-warranties', dataKey: 'warranty',
      init: { provider: '', contract_number: '', start_date: todayStr(), end_date: '', coverage_description: '', max_claim_amount: '', contact_phone: '', cost: '', notes: '' },
      fromRecord: r => ({ provider: r.provider, contract_number: r.contract_number || '', start_date: r.start_date, end_date: r.end_date, coverage_description: r.coverage_description || '', max_claim_amount: r.max_claim_amount ? String(r.max_claim_amount) : '', contact_phone: r.contact_phone || '', cost: String(r.cost || ''), notes: r.notes || '' }),
    },
  };

  const currentDef = DEFS[docTab];

  const openAdd = () => {
    setEditId(null);
    const init = { ...currentDef.init };
    if (docTab === 'claims' && data.insurance.length > 0) init.policy = String(data.insurance[0].id);
    setForm(init); setShowForm(true);
  };

  const openEdit = (rec) => {
    setEditId(rec.id);
    setForm(currentDef.fromRecord(rec));
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVehicleId) return;
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, vehicle: parseInt(selectedVehicleId) };
    ['cost','premium','insured_value','claimed_amount','approved_amount','max_claim_amount'].forEach(k => { if (payload[k] !== '' && payload[k] !== undefined) payload[k] = parseFloat(payload[k]); else payload[k] = null; });
    if (payload.policy) payload.policy = parseInt(payload.policy);
    ['settlement_date'].forEach(k => { if (!payload[k]) payload[k] = null; });
    try {
      const url    = editId ? `${API}/api/${currentDef.endpoint}/${editId}/` : `${API}/api/${currentDef.endpoint}/`;
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
    await fetch(`${API}/api/${currentDef.endpoint}/${id}/`, { method: 'DELETE', headers });
    fetchData();
  };

  const DOC_TABS = [
    { id: 'pucc',      label: 'PUCC',      count: data.pucc.length },
    { id: 'insurance', label: 'Insurance', count: data.insurance.length },
    { id: 'claims',    label: 'Claims',    count: data.claims.length },
    { id: 'warranty',  label: 'Warranty',  count: data.warranty.length },
  ];

  const renderRecord = (rec) => {
    const editBtn = <button onClick={() => openEdit(rec)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 15 }}>✏️</button>;
    const delBtn  = <button onClick={() => handleDelete(rec.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 15 }}>🗑</button>;
    if (docTab === 'pucc') return (
      <div key={rec.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${rec.days_until_expiry <= 0 ? '#dc2626' : rec.days_until_expiry <= 30 ? '#f59e0b' : '#16a34a'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 13, fontWeight: 700 }}>{fmtD(rec.issue_date)} → {fmtD(rec.expiry_date)}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{rec.certificate_no && `Cert: ${rec.certificate_no}`}{rec.test_center && ` · ${rec.test_center}`}</div>
          {rec.cost > 0 && <div style={{ fontSize: 11, color: '#64748b' }}>₹{fmt(rec.cost)}</div>}
          <div style={{ marginTop: 4 }}><DaysChip days={rec.days_until_expiry} label="PUCC" /></div></div>
          <div style={{ display: 'flex', gap: 4 }}>{editBtn}{delBtn}</div>
        </div>
      </div>
    );
    if (docTab === 'insurance') return (
      <div key={rec.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${rec.days_until_expiry <= 0 ? '#dc2626' : rec.days_until_expiry <= 30 ? '#f59e0b' : '#0369a1'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{rec.provider}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{rec.policy_number} · {rec.policy_type}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{fmtD(rec.start_date)} → {fmtD(rec.end_date)}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>₹{fmt(rec.premium)}</div>
            {rec.agent_name && <div style={{ fontSize: 11, color: '#94a3b8' }}>{rec.agent_name}{rec.agent_phone && ` · ${rec.agent_phone}`}</div>}
            <div style={{ marginTop: 4 }}><DaysChip days={rec.days_until_expiry} label="Insurance" /></div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>{editBtn}{delBtn}</div>
        </div>
      </div>
    );
    if (docTab === 'claims') return (
      <div key={rec.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${STATUS_COLOR[rec.status] || '#64748b'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>₹{fmt(rec.claimed_amount)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[rec.status], background: '#f1f5f9', borderRadius: 4, padding: '2px 6px', textTransform: 'capitalize' }}>{rec.status.replace('_', ' ')}</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Incident: {fmtD(rec.incident_date)} · Claim: {fmtD(rec.claim_date)}</div>
            {rec.approved_amount && <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>Approved: ₹{fmt(rec.approved_amount)}</div>}
            {rec.description && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{rec.description}</div>}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>{editBtn}{delBtn}</div>
        </div>
      </div>
    );
    if (docTab === 'warranty') return (
      <div key={rec.id} style={{ ...s.card, marginBottom: 8, borderLeft: `4px solid ${rec.days_until_expiry <= 0 ? '#dc2626' : rec.days_until_expiry <= 30 ? '#f59e0b' : '#7e22ce'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{rec.provider}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{fmtD(rec.start_date)} → {fmtD(rec.end_date)}</div>
            {rec.max_claim_amount && <div style={{ fontSize: 12, color: '#7e22ce', fontWeight: 700 }}>Max: ₹{fmt(rec.max_claim_amount)}</div>}
            {rec.coverage_description && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{rec.coverage_description}</div>}
            <div style={{ marginTop: 4 }}><DaysChip days={rec.days_until_expiry} label="Warranty" /></div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>{editBtn}{delBtn}</div>
        </div>
      </div>
    );
    return null;
  };

  if (!selectedVehicleId) return <div style={s.section}><p style={s.empty}>Select a vehicle above.</p></div>;

  return (
    <div style={s.section}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '2px solid #e2e8f0', paddingBottom: 8, flexWrap: 'wrap' }}>
        {DOC_TABS.map(dt => (
          <button key={dt.id} onClick={() => { setDocTab(dt.id); setShowForm(false); setEditId(null); }}
            style={{ ...s.sessionPill, ...(docTab === dt.id ? s.sessionPillActive : {}) }}>
            {dt.label}{dt.count > 0 && <span style={{ marginLeft: 4, fontSize: 10, background: docTab === dt.id ? 'rgba(255,255,255,0.3)' : '#e2e8f0', borderRadius: 8, padding: '0 5px' }}>{dt.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={showForm ? () => { setShowForm(false); setEditId(null); } : openAdd}
          style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: showForm ? '#64748b' : '#1d4ed8' }}>
          {showForm ? '✕ Cancel' : `+ Add ${DOC_TABS.find(d => d.id === docTab)?.label}`}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ ...s.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editId ? 'Edit' : 'New'} {DOC_TABS.find(d => d.id === docTab)?.label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {currentDef.fields.map(f => (
              <div key={f.key} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                <label style={s.fieldLabel}>{f.label}</label>
                {f.type === 'select' ? (
                  <select style={s.input} value={form[f.key] || ''} onChange={e => setF(f.key, e.target.value)}>
                    {(f.key === 'policy' ? data.insurance.map(p => [String(p.id), `${p.provider} (${p.policy_number})`]) : f.options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea style={{ ...s.input, height: 60 }} value={form[f.key] || ''} onChange={e => setF(f.key, e.target.value)} />
                ) : (
                  <input style={s.input} type={f.type} value={form[f.key] || ''} onChange={e => setF(f.key, e.target.value)} placeholder={f.placeholder || ''} />
                )}
              </div>
            ))}
          </div>
          <button type="submit" disabled={saving} style={{ ...s.primaryBtn, width: '100%', marginTop: 10 }}>
            {saving ? 'Saving…' : editId ? '✓ Update' : '✓ Save'}
          </button>
        </form>
      )}

      {data[currentDef.dataKey].length === 0 && !showForm && <p style={s.empty}>No {DOC_TABS.find(d => d.id === docTab)?.label} records yet.</p>}
      {data[currentDef.dataKey].map(rec => renderRecord(rec))}
    </div>
  );
}
