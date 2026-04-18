import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { styles as s } from '../../styles/dashboard';

const SUGAR_TYPES = [
  { value: 'fasting',   label: 'Fasting' },
  { value: 'post_meal', label: 'Post Meal (2hr)' },
  { value: 'random',    label: 'Random' },
  { value: 'hba1c',     label: 'HbA1c' },
];

// Normal ranges for color-coding
function bpStatus(sys, dia) {
  if (sys > 140 || dia > 90) return 'high';
  if (sys < 90 || dia < 60) return 'low';
  return 'normal';
}
function pulseStatus(p) {
  if (p > 100) return 'high';
  if (p < 60) return 'low';
  return 'normal';
}
function sugarStatus(val, type, unit) {
  const v = unit === 'mmol_l' ? val * 18 : val; // normalize to mg/dL
  if (type === 'fasting') { if (v > 126) return 'high'; if (v < 70) return 'low'; }
  else if (type === 'post_meal') { if (v > 200) return 'high'; if (v < 70) return 'low'; }
  else { if (v > 200) return 'high'; if (v < 70) return 'low'; }
  return 'normal';
}
const STATUS_COLOR = { normal: '#16a34a', high: '#dc2626', low: '#d97706' };
const STATUS_LABEL = { normal: '✓', high: '↑', low: '↓' };

function nowLocal() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Simple SVG line chart
function LineChart({ data, width = 320, height = 120, color = '#2563eb', label = '' }) {
  if (!data || data.length < 2) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-faint)', fontSize: 12 }}>Need ≥2 readings for trend</div>
  );
  const vals = data.map(d => d.value).filter(v => v !== null && v !== undefined);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const px = (i) => (i / (data.length - 1)) * (width - 20) + 10;
  const py = (v) => height - 10 - ((v - min) / range) * (height - 20);
  const pts = data.map((d, i) => `${px(i)},${py(d.value)}`).join(' ');
  return (
    <div style={{ position: 'relative' }}>
      {label && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 2 }}>{label}</div>}
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={px(i)} cy={py(d.value)} r={3} fill={color} />
        ))}
        <text x={10} y={14} fontSize={9} fill="var(--text-faint)">{max}</text>
        <text x={10} y={height - 2} fontSize={9} fill="var(--text-faint)">{min}</text>
      </svg>
    </div>
  );
}

const emptyForm = () => ({
  patient: '',
  recorded_at: nowLocal(),
  systolic: '', diastolic: '', pulse: '',
  blood_sugar: '', sugar_unit: 'mg_dl', sugar_type: 'fasting',
  food_time: '', notes: '',
});

export default function VitalsTab({ patients = [], showToast }) {
  const [readings, setReadings] = useState([]);
  const [averages, setAverages] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'chart'

  // Set default patient
  useEffect(() => {
    if (patients.length && !selectedPatient) {
      setSelectedPatient(String(patients[0].id));
      setForm(f => ({ ...f, patient: String(patients[0].id) }));
    }
  }, [patients]);

  const fetchReadings = useCallback(async (patientId) => {
    if (!patientId) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    setLoading(true);
    try {
      const [rRes, aRes] = await Promise.all([
        fetch(`${API}/api/vital-readings/?patient_id=${patientId}`, { headers }),
        fetch(`${API}/api/vital-readings/averages/?patient_id=${patientId}`, { headers }),
      ]);
      if (rRes.ok) setReadings(await rRes.json());
      if (aRes.ok) setAverages(await aRes.json());
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedPatient) fetchReadings(selectedPatient);
  }, [selectedPatient, fetchReadings]);

  const resetForm = () => {
    setForm({ ...emptyForm(), patient: selectedPatient });
    setEditId(null);
  };

  const handleSave = async () => {
    if (!form.patient) return showToast('Select a patient', 'error');
    const hasData = form.systolic || form.diastolic || form.pulse || form.blood_sugar;
    if (!hasData) return showToast('Enter at least one reading (BP, pulse, or blood sugar)', 'error');

    setSaving(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const payload = {
        patient: parseInt(form.patient),
        recorded_at: form.recorded_at,
        systolic: form.systolic ? parseInt(form.systolic) : null,
        diastolic: form.diastolic ? parseInt(form.diastolic) : null,
        pulse: form.pulse ? parseInt(form.pulse) : null,
        blood_sugar: form.blood_sugar ? parseFloat(form.blood_sugar) : null,
        sugar_unit: form.blood_sugar ? form.sugar_unit : '',
        sugar_type: form.blood_sugar ? form.sugar_type : '',
        food_time: form.food_time || null,
        notes: form.notes,
      };
      const url = editId ? `${API}/api/vital-readings/${editId}/` : `${API}/api/vital-readings/`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        showToast(editId ? 'Reading updated' : 'Reading saved', 'success');
        resetForm();
        fetchReadings(selectedPatient);
      } else {
        const err = await res.json();
        showToast(Object.values(err).flat().join(' '), 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this reading?')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    const res = await fetch(`${API}/api/vital-readings/${id}/`, { method: 'DELETE', headers });
    if (res.ok) { showToast('Deleted', 'success'); fetchReadings(selectedPatient); }
    else showToast('Failed', 'error');
  };

  const startEdit = (r) => {
    setEditId(r.id);
    const dt = r.recorded_at ? r.recorded_at.slice(0, 16) : nowLocal();
    setForm({
      patient: String(r.patient),
      recorded_at: dt,
      systolic: r.systolic != null ? String(r.systolic) : '',
      diastolic: r.diastolic != null ? String(r.diastolic) : '',
      pulse: r.pulse != null ? String(r.pulse) : '',
      blood_sugar: r.blood_sugar != null ? String(r.blood_sugar) : '',
      sugar_unit: r.sugar_unit || 'mg_dl',
      sugar_type: r.sugar_type || 'fasting',
      food_time: r.food_time || '',
      notes: r.notes || '',
    });
  };

  const latest = readings[0];

  // Build chart data series
  const bpData = readings.filter(r => r.systolic != null).map(r => ({ value: r.systolic, label: r.recorded_at?.slice(0,10) })).reverse();
  const pulseData = readings.filter(r => r.pulse != null).map(r => ({ value: r.pulse, label: r.recorded_at?.slice(0,10) })).reverse();
  const sugarData = readings.filter(r => r.blood_sugar != null).map(r => ({ value: parseFloat(r.blood_sugar), label: r.recorded_at?.slice(0,10) })).reverse();

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>

      {/* Patient selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {patients.map(p => (
          <button key={p.id} onClick={() => { setSelectedPatient(String(p.id)); setForm(f => ({ ...f, patient: String(p.id) })); }} style={{
            fontSize: 13, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
            backgroundColor: selectedPatient === String(p.id) ? 'var(--primary)' : 'var(--bg-secondary)',
            color: selectedPatient === String(p.id) ? 'white' : 'var(--text)',
            border: `2px solid ${selectedPatient === String(p.id) ? 'var(--primary)' : 'var(--border)'}`,
            fontWeight: selectedPatient === String(p.id) ? 700 : 400,
          }}>👤 {p.name}</button>
        ))}
      </div>

      {/* Latest + Averages snapshot */}
      {selectedPatient && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
          {/* BP */}
          {latest?.bp_display && (() => {
            const st = bpStatus(latest.systolic, latest.diastolic);
            return (
              <div style={{ ...s.card, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 700 }}>Blood Pressure</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: STATUS_COLOR[st], margin: '4px 0' }}>{latest.bp_display}</div>
                <div style={{ fontSize: 11, color: STATUS_COLOR[st] }}>{STATUS_LABEL[st]} {st}</div>
                {averages?.systolic_avg && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Avg {averages.systolic_avg}/{averages.diastolic_avg}</div>}
              </div>
            );
          })()}

          {/* Pulse */}
          {latest?.pulse != null && (() => {
            const st = pulseStatus(latest.pulse);
            return (
              <div style={{ ...s.card, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 700 }}>Pulse</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: STATUS_COLOR[st], margin: '4px 0' }}>{latest.pulse}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>bpm {STATUS_LABEL[st]}</div>
                {averages?.pulse_avg && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Avg {averages.pulse_avg}</div>}
              </div>
            );
          })()}

          {/* Blood Sugar */}
          {latest?.blood_sugar != null && (() => {
            const st = sugarStatus(parseFloat(latest.blood_sugar), latest.sugar_type, latest.sugar_unit);
            const typeLabel = SUGAR_TYPES.find(t => t.value === latest.sugar_type)?.label || '';
            return (
              <div style={{ ...s.card, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 700 }}>Blood Sugar</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: STATUS_COLOR[st], margin: '4px 0' }}>
                  {parseFloat(latest.blood_sugar).toFixed(1)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{latest.sugar_unit === 'mg_dl' ? 'mg/dL' : 'mmol/L'} · {typeLabel}</div>
                {averages?.sugar_avgs?.length > 0 && averages.sugar_avgs.map(a => (
                  <div key={a.type} style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                    {SUGAR_TYPES.find(t => t.value === a.type)?.label} avg: {a.avg}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <div style={s.twoPanel}>
        {/* Left — readings list / chart */}
        <div style={s.productsPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={s.panelTitle}>❤️ Readings <span style={s.cartBadge}>{readings.length}</span></div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['list', 'chart'].map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                  backgroundColor: view === v ? 'var(--primary)' : 'var(--bg-secondary)',
                  color: view === v ? 'white' : 'var(--text)',
                  border: `1px solid ${view === v ? 'var(--primary)' : 'var(--border)'}`,
                }}>{v === 'list' ? '📋 List' : '📈 Chart'}</button>
              ))}
            </div>
          </div>

          {loading && <div style={s.empty}>Loading…</div>}
          {!loading && readings.length === 0 && <div style={s.empty}>No readings yet for this patient.</div>}

          {view === 'chart' && readings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 8 }}>
              {bpData.length > 0 && <LineChart data={bpData} color="#ef4444" label="Systolic BP (mmHg)" />}
              {pulseData.length > 0 && <LineChart data={pulseData} color="#3b82f6" label="Pulse (bpm)" />}
              {sugarData.length > 0 && <LineChart data={sugarData} color="#f59e0b" label="Blood Sugar" />}
            </div>
          )}

          {view === 'list' && readings.map(r => {
            const bpSt = r.systolic != null ? bpStatus(r.systolic, r.diastolic) : null;
            const pSt = r.pulse != null ? pulseStatus(r.pulse) : null;
            const sSt = r.blood_sugar != null ? sugarStatus(parseFloat(r.blood_sugar), r.sugar_type, r.sugar_unit) : null;
            const dt = r.recorded_at ? new Date(r.recorded_at) : null;
            return (
              <div key={r.id} style={{ ...s.listRow, flexDirection: 'column', alignItems: 'stretch', gap: 4, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    {dt ? dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                    {' '}{dt ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={s.iconBtn} onClick={() => startEdit(r)}>✏</button>
                    <button style={{ ...s.iconBtn, color: '#dc2626' }} onClick={() => handleDelete(r.id)}>🗑</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {r.bp_display && (
                    <span style={{ fontWeight: 700, color: STATUS_COLOR[bpSt] }}>
                      BP {r.bp_display} {STATUS_LABEL[bpSt]}
                    </span>
                  )}
                  {r.pulse != null && (
                    <span style={{ fontWeight: 700, color: STATUS_COLOR[pSt] }}>
                      ♥ {r.pulse} bpm {STATUS_LABEL[pSt]}
                    </span>
                  )}
                  {r.blood_sugar != null && (
                    <span style={{ fontWeight: 700, color: STATUS_COLOR[sSt] }}>
                      🩸 {parseFloat(r.blood_sugar).toFixed(1)} {r.sugar_unit === 'mg_dl' ? 'mg/dL' : 'mmol/L'}
                      {' · '}{SUGAR_TYPES.find(t => t.value === r.sugar_type)?.label}
                      {' '}{STATUS_LABEL[sSt]}
                    </span>
                  )}
                </div>
                {r.food_time && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>🍽 Food at {r.food_time}</div>}
                {r.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.notes}</div>}
              </div>
            );
          })}
        </div>

        {/* Right — add form */}
        <div style={s.cartPanel}>
          <div style={s.panelTitle}>{editId ? '✏ Edit Reading' : '➕ Add Reading'}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={s.fieldLabel}>Patient *</label>
              <select style={s.input} value={form.patient}
                onChange={e => { setForm(f => ({ ...f, patient: e.target.value })); setSelectedPatient(e.target.value); }}>
                <option value="">— Select —</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label style={s.fieldLabel}>Date & Time *</label>
              <input style={s.input} type="datetime-local" value={form.recorded_at}
                onChange={e => setForm(f => ({ ...f, recorded_at: e.target.value }))} />
            </div>

            {/* BP */}
            <div>
              <label style={s.fieldLabel}>Blood Pressure (optional)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={s.input} type="number" placeholder="Systolic (e.g. 120)" value={form.systolic}
                  onChange={e => setForm(f => ({ ...f, systolic: e.target.value }))} />
                <input style={s.input} type="number" placeholder="Diastolic (e.g. 80)" value={form.diastolic}
                  onChange={e => setForm(f => ({ ...f, diastolic: e.target.value }))} />
              </div>
              {form.systolic && form.diastolic && (
                <div style={{ fontSize: 12, color: STATUS_COLOR[bpStatus(parseInt(form.systolic), parseInt(form.diastolic))], marginTop: 3 }}>
                  BP: {form.systolic}/{form.diastolic} — {bpStatus(parseInt(form.systolic), parseInt(form.diastolic))}
                </div>
              )}
            </div>

            {/* Pulse */}
            <div>
              <label style={s.fieldLabel}>Pulse / Heart Rate (optional)</label>
              <input style={s.input} type="number" placeholder="e.g. 72 bpm" value={form.pulse}
                onChange={e => setForm(f => ({ ...f, pulse: e.target.value }))} />
              {form.pulse && (
                <div style={{ fontSize: 12, color: STATUS_COLOR[pulseStatus(parseInt(form.pulse))], marginTop: 3 }}>
                  {form.pulse} bpm — {pulseStatus(parseInt(form.pulse))}
                </div>
              )}
            </div>

            {/* Blood Sugar */}
            <div>
              <label style={s.fieldLabel}>Blood Sugar (optional)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
                <input style={s.input} type="number" step="0.1" placeholder="Value" value={form.blood_sugar}
                  onChange={e => setForm(f => ({ ...f, blood_sugar: e.target.value }))} />
                <select style={s.input} value={form.sugar_unit}
                  onChange={e => setForm(f => ({ ...f, sugar_unit: e.target.value }))}>
                  <option value="mg_dl">mg/dL</option>
                  <option value="mmol_l">mmol/L</option>
                </select>
              </div>
              <select style={s.input} value={form.sugar_type}
                onChange={e => setForm(f => ({ ...f, sugar_type: e.target.value }))}>
                {SUGAR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label style={s.fieldLabel}>Food Time (when last ate)</label>
              <input style={s.input} type="time" value={form.food_time}
                onChange={e => setForm(f => ({ ...f, food_time: e.target.value }))} />
            </div>

            <div>
              <label style={s.fieldLabel}>Notes</label>
              <input style={s.input} value={form.notes} placeholder="Optional"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.saveBtn, flex: 1, marginTop: 0 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update' : '💾 Save Reading'}
              </button>
              {editId && <button style={s.cancelBtn} onClick={resetForm}>Cancel</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
