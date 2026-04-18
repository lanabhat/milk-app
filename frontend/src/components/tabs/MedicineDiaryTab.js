import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { styles as s } from '../../styles/dashboard';

const SLOT_ICONS = { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' };
const SLOT_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };

function inferSlot(dateStr) {
  const h = new Date(dateStr).getHours();
  if (h >= 5 && h <= 11) return 'morning';
  if (h >= 12 && h <= 16) return 'afternoon';
  if (h >= 17 && h <= 19) return 'evening';
  return 'night';
}

function toLocalDateStr(d) {
  // Returns YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByPatient(txns, patients) {
  const patientMap = {};
  patients.forEach(p => { patientMap[String(p.id)] = p; });

  const groups = {};
  txns.forEach(tx => {
    const key = tx.patient_id != null ? String(tx.patient_id) : '__household__';
    if (!groups[key]) groups[key] = { label: tx.patient_name || 'Household / General', txns: [] };
    groups[key].txns.push(tx);
  });

  // Sort: named patients first in order of patients list, household last
  const ordered = [];
  patients.forEach(p => {
    if (groups[String(p.id)]) ordered.push({ key: String(p.id), ...groups[String(p.id)] });
  });
  if (groups['__household__']) ordered.push({ key: '__household__', ...groups['__household__'] });
  return ordered;
}

export default function MedicineDiaryTab({ showToast, patients }) {
  const today = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedPatientId, setSelectedPatientId] = useState('all');
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDiary = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      let url = `${API}/api/medicine-diary/?date=${selectedDate}&limit=200`;
      if (selectedPatientId !== 'all') url += `&patient_id=${selectedPatientId}`;
      const res = await fetch(url, { headers });
      if (res.ok) setTxns(await res.json());
      else showToast('Failed to load diary', 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(false); }
  }, [selectedDate, selectedPatientId, showToast]);

  useEffect(() => { fetchDiary(); }, [fetchDiary]);

  const changeDate = (delta) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    if (dt > new Date()) return; // no future
    setSelectedDate(toLocalDateStr(dt));
  };

  const allPatients = patients || [];
  const patientGroups = groupByPatient(txns, allPatients);

  const isToday = selectedDate === today;
  const isHouseholdSelected = selectedPatientId === '__household__';

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>

      {/* Patient filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[{ id: 'all', name: 'All Patients' }, ...allPatients, { id: '__household__', name: 'Household' }].map(p => {
          const active = selectedPatientId === String(p.id);
          return (
            <button
              key={p.id}
              onClick={() => setSelectedPatientId(String(p.id))}
              style={{
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
                fontWeight: active ? 700 : 400,
                backgroundColor: active ? 'var(--primary)' : 'var(--bg-secondary)',
                color: active ? 'white' : 'var(--text)',
                border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Date navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
        backgroundColor: 'var(--bg-secondary)', borderRadius: 12,
        padding: '10px 14px', border: '1px solid var(--border)',
      }}>
        <button onClick={() => changeDate(-1)} style={{ ...s.iconBtn, fontSize: 18, padding: '2px 10px' }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={e => setSelectedDate(e.target.value)}
            style={{
              border: 'none', background: 'transparent', fontSize: 15, fontWeight: 700,
              color: 'var(--text)', cursor: 'pointer', textAlign: 'center',
            }}
          />
          {isToday && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>Today</span>
          )}
        </div>
        <button
          onClick={() => changeDate(1)}
          disabled={isToday}
          style={{ ...s.iconBtn, fontSize: 18, padding: '2px 10px', opacity: isToday ? 0.3 : 1 }}
        >›</button>
      </div>

      {/* Content */}
      {loading && <div style={s.empty}>Loading…</div>}

      {!loading && txns.length === 0 && (
        <div style={{ ...s.empty, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          No medicines recorded for {formatDisplayDate(selectedDate)}.
        </div>
      )}

      {!loading && patientGroups.map(group => (
        <div key={group.key} style={{ marginBottom: 24 }}>
          {/* Patient header */}
          <div style={{
            fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: 1,
            marginBottom: 8, paddingBottom: 4,
            borderBottom: '2px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            👤 {group.label}
            <span style={{
              fontSize: 11, backgroundColor: 'var(--primary)', color: 'white',
              borderRadius: 10, padding: '1px 7px', fontWeight: 600,
              textTransform: 'none', letterSpacing: 0,
            }}>
              {group.txns.length} dose{group.txns.length !== 1 ? 's' : ''}
            </span>
          </div>

          {group.txns.map(tx => {
            const slot = tx.slot || inferSlot(tx.date);
            const slotIcon = SLOT_ICONS[slot] || '💊';
            const slotLabel = SLOT_LABELS[slot] || slot;
            const d = new Date(tx.date);
            const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={tx.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10, marginBottom: 6,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{slotIcon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{tx.medicine_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {slotLabel} · <strong style={{ color: 'var(--text)' }}>{parseFloat(tx.quantity)}</strong> tablets
                    {tx.notes && tx.notes !== 'Marked taken' ? ` · ${tx.notes}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0, textAlign: 'right' }}>
                  {timeStr}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
