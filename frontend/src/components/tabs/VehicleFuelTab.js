import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';
import Modal from '../common/Modal';

const EMPTY_FORM = { date: todayStr(), fuel_amount: '', price_per_litre: '', odometer: '', full_tank: true, fuel_station: '', notes: '' };

export default function VehicleFuelTab({ vehicles, selectedVehicleId, showToast, onSaved }) {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!selectedVehicleId) return;
    setLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const r = await fetch(`${API}/api/fuel-logs/?vehicle_id=${selectedVehicleId}`, { headers });
      if (r.ok) setLogs(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [selectedVehicleId]);

  useEffect(() => { setLogs([]); fetchLogs(); }, [fetchLogs]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const resetForm = () => { setEditId(null); setForm(EMPTY_FORM); setModalOpen(false); };

  const openEdit = (log) => {
    setEditId(log.id);
    setForm({ date: log.date, fuel_amount: String(log.fuel_amount), price_per_litre: String(log.price_per_litre), odometer: String(log.odometer), full_tank: log.full_tank, fuel_station: log.fuel_station || '', notes: log.notes || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.fuel_amount || !form.price_per_litre || !form.odometer) {
      showToast('Fuel amount, price, and odometer are required', 'error'); return;
    }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const total_cost = parseFloat((parseFloat(form.fuel_amount) * parseFloat(form.price_per_litre)).toFixed(2));
    const payload = { vehicle: parseInt(selectedVehicleId), date: form.date, fuel_amount: parseFloat(form.fuel_amount), price_per_litre: parseFloat(form.price_per_litre), total_cost, odometer: parseFloat(form.odometer), full_tank: form.full_tank, fuel_station: form.fuel_station, notes: form.notes };
    try {
      const url    = editId ? `${API}/api/fuel-logs/${editId}/` : `${API}/api/fuel-logs/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Fuel log saved');
      resetForm(); fetchLogs(); onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/fuel-logs/${id}/`, { method: 'DELETE', headers });
    fetchLogs();
  };

  const totalLitres = logs.reduce((s, l) => s + parseFloat(l.fuel_amount || 0), 0);
  const totalCost   = logs.reduce((s, l) => s + parseFloat(l.total_cost || 0), 0);
  const avgPrice    = totalLitres > 0 ? totalCost / totalLitres : 0;
  const milesLogs   = logs.filter(l => l.mileage);
  const avgMileage  = milesLogs.length > 0 ? milesLogs.reduce((s, l) => s + l.mileage, 0) / milesLogs.length : 0;
  const selectedVehicle = vehicles.find(v => String(v.id) === selectedVehicleId);
  const mileageData = logs.filter(l => l.mileage).slice().reverse();

  if (!selectedVehicleId) return <div style={s.section}><p style={s.empty}>Select a vehicle above.</p></div>;

  return (
    <div style={s.section}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Total Litres',    value: totalLitres.toFixed(1) + ' L',                            color: '#f97316' },
          { label: 'Total Fuel Cost', value: '₹' + fmt(totalCost),                                     color: '#dc2626' },
          { label: 'Avg Price/L',     value: avgPrice > 0 ? '₹' + fmt(avgPrice) : '—',                 color: '#64748b' },
          { label: 'Avg Mileage',     value: avgMileage > 0 ? avgMileage.toFixed(1) + ' km/L' : '—',   color: '#16a34a' },
          { label: 'Odometer',        value: selectedVehicle ? (selectedVehicle.current_odometer?.toLocaleString('en-IN') + ' km') : '—', color: '#1d4ed8' },
        ].map(c => (
          <div key={c.label} style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {mileageData.length > 1 && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 8px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Mileage trend (km/L)</div>
          {(() => {
            const n = mileageData.length;
            const maxM = Math.max(...mileageData.map(d => d.mileage), 1);
            const minM = Math.min(...mileageData.map(d => d.mileage));
            const W = Math.max(300, n * 36);
            const H = 80;
            const pts = mileageData.map((d, i) => ({ x: n < 2 ? W / 2 : (i / (n - 1)) * W, y: H - ((d.mileage - minM) / (maxM - minM + 0.01)) * H, v: d.mileage, date: d.date }));
            const poly = pts.map(p => `${p.x},${p.y}`).join(' ');
            return (
              <div style={{ overflowX: 'auto' }}>
                <svg width={W} height={H + 20} style={{ display: 'block', overflow: 'visible' }}>
                  <line x1={0} y1={H} x2={W} y2={H} stroke="#e2e8f0" strokeWidth={1} />
                  <polyline points={poly} fill="none" stroke="#16a34a" strokeWidth={2} strokeLinejoin="round" />
                  <polyline points={`0,${H} ${poly} ${W},${H}`} fill="#16a34a" fillOpacity={0.08} stroke="none" />
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={3} fill="#16a34a" stroke="white" strokeWidth={1.5}><title>{`${p.date}: ${p.v} km/L`}</title></circle>
                      {(n <= 8 || i % Math.ceil(n / 8) === 0) && <text x={p.x} y={H + 14} textAnchor="middle" fontSize={8} fill="#94a3b8">{p.date?.slice(5)}</text>}
                    </g>
                  ))}
                </svg>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(true); }} style={s.addBtn}>
          ⛽ Log Fuel Fill
        </button>
      </div>

      {loading ? <p style={s.empty}>Loading…</p> : logs.length === 0 ? <p style={s.empty}>No fuel logs yet.</p> : (
        logs.map(log => (
          <div key={log.id} style={{ ...s.card, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⛽</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtD(log.date)}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>₹{fmt(log.total_cost)}</div>
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {log.fuel_amount} L @ ₹{log.price_per_litre}/L · {log.odometer?.toLocaleString('en-IN')} km{log.full_tank && ' · Full tank'}
              </div>
              {log.mileage && <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>🏎 {log.mileage} km/L</div>}
              {log.fuel_station && <div style={{ fontSize: 11, color: '#94a3b8' }}>{log.fuel_station}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              <button onClick={() => openEdit(log)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 15 }}>✏️</button>
              <button onClick={() => handleDelete(log.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 15 }}>🗑</button>
            </div>
          </div>
        ))
      )}

      <Modal open={modalOpen} onClose={resetForm} title={editId ? 'Edit Fuel Log' : 'Log Fuel Fill'}
        onSave={handleSave} saveLabel={saving ? 'Saving…' : editId ? 'Update' : 'Save'} saving={saving}>
        <div className="form-grid">
          <label>Date<input style={s.input} type="date" value={form.date} onChange={e => setF('date', e.target.value)} /></label>
          <label>Odometer (km)<input style={s.input} type="number" value={form.odometer} onChange={e => setF('odometer', e.target.value)} placeholder="12500" /></label>
          <label>Fuel Amount (L)<input style={s.input} type="number" step="0.01" value={form.fuel_amount} onChange={e => setF('fuel_amount', e.target.value)} placeholder="5.5" /></label>
          <label>Price per Litre (₹)<input style={s.input} type="number" step="0.01" value={form.price_per_litre} onChange={e => setF('price_per_litre', e.target.value)} placeholder="106.5" /></label>
          {form.fuel_amount && form.price_per_litre && (
            <div style={{ padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
              Total: ₹{fmt(parseFloat(form.fuel_amount) * parseFloat(form.price_per_litre))}
            </div>
          )}
          <label>Fuel Station<input style={s.input} value={form.fuel_station} onChange={e => setF('fuel_station', e.target.value)} placeholder="HP, BPCL…" /></label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={form.full_tank} onChange={e => setF('full_tank', e.target.checked)} style={{ width: 18, height: 18, minHeight: 'unset' }} />
            Full Tank
          </label>
          <label>Notes<input style={s.input} value={form.notes} onChange={e => setF('notes', e.target.value)} /></label>
        </div>
      </Modal>
    </div>
  );
}
