import React, { useState, useCallback, useEffect } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { styles as s } from '../../styles/dashboard';

const SLOTS = [
  { key: 'morning',   doseKey: 'morning_dose',   icon: '🌅', label: 'Morning' },
  { key: 'afternoon', doseKey: 'afternoon_dose',  icon: '☀️', label: 'Afternoon' },
  { key: 'night',     doseKey: 'night_dose',      icon: '🌙', label: 'Night' },
];

const FOOD_LABELS = {
  before_food: '🚫 Before Food',
  after_food: '✓ After Food',
  with_food: '🍽️ With Food',
};

const ALERT_COLORS = { critical: '#dc2626', low: '#d97706', ok: 'var(--text-muted)' };

function getCurrentSlot() {
  const h = new Date().getHours();
  if (h >= 5 && h <= 11) return 'morning';
  if (h >= 12 && h <= 17) return 'afternoon';
  return 'night';
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function GiveMedicineTab({ showToast, medicines, patients, onSaved }) {
  const [slot, setSlot] = useState(getCurrentSlot);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [giving, setGiving] = useState({});          // { medId: true } while in-flight
  const [halfModal, setHalfModal] = useState(null);  // { med, slotDose }
  const [givenSet, setGivenSet] = useState(new Set()); // "medId-slot" keys for selectedDate
  const [resetConfirm, setResetConfirm] = useState(null); // { med, slotKey } or null
  const [resetting, setResetting] = useState(false);

  const allMeds = medicines || [];
  const allPatients = patients || [];
  const slotInfo = SLOTS.find(sl => sl.key === slot);

  // Fetch diary entries for selectedDate and build givenSet
  useEffect(() => {
    const fetchGiven = async () => {
      const headers = getAuthHeaders();
      if (!headers) return;
      try {
        const res = await fetch(`${API}/api/medicine-diary/?date=${selectedDate}&limit=500`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const keys = new Set(data.map(txn => `${txn.medicine}-${txn.slot}`));
        setGivenSet(keys);
      } catch { /* ignore */ }
    };
    fetchGiven();
  }, [selectedDate]);

  // Medicines active in this slot (dose > 0)
  const slotMeds = allMeds.filter(m => {
    const d = m[slotInfo.doseKey];
    return d != null && parseFloat(d) > 0;
  });

  // Group by patient
  const byPatient = {};
  slotMeds.forEach(med => {
    const key = med.patient ? String(med.patient) : '__household__';
    if (!byPatient[key]) byPatient[key] = [];
    byPatient[key].push(med);
  });
  const groups = [];
  allPatients.forEach(p => {
    if (byPatient[String(p.id)]) groups.push({ id: p.id, name: p.name, meds: byPatient[String(p.id)] });
  });
  if (byPatient['__household__']) {
    groups.push({ id: null, name: 'Household / General', meds: byPatient['__household__'] });
  }

  const doGive = useCallback(async (med, qty, discardQty, slotKey) => {
    setGiving(g => ({ ...g, [med.id]: true }));
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const body = { quantity: qty, slot: slotKey };
      if (discardQty) body.discard_qty = discardQty;
      const res = await fetch(`${API}/api/medicines/${med.id}/consume/`, {
        method: 'POST', headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const extra = discardQty ? ' + other half discarded' : '';
        showToast(`✔ ${med.medicine_name} given${extra}`, 'success');
        setGivenSet(prev => new Set([...prev, `${med.id}-${slotKey}`]));
        onSaved();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setGiving(g => ({ ...g, [med.id]: false })); }
  }, [showToast, onSaved]);

  const handleGive = (med) => {
    const slotDose = parseFloat(med[slotInfo.doseKey]);
    const isHalfTablet = med.unit === 'tablets' && slotDose % 1 !== 0;
    if (isHalfTablet) {
      setHalfModal({ med, slotDose, slotKey: slot });
    } else {
      doGive(med, slotDose, null, slot);
    }
  };

  const confirmGive = (discard) => {
    const { med, slotDose, slotKey } = halfModal;
    const discardQty = discard ? (Math.ceil(slotDose) - slotDose) : null;
    setHalfModal(null);
    doGive(med, slotDose, discardQty, slotKey);
  };

  const handleReset = async () => {
    if (!resetConfirm) return;
    const { med, slotKey } = resetConfirm;
    setResetting(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`${API}/api/medicines/${med.id}/unconsume/`, {
        method: 'POST', headers,
        body: JSON.stringify({ slot: slotKey, date: selectedDate }),
      });
      if (res.ok) {
        showToast(`↩ ${med.medicine_name} reset to not given`, 'success');
        setGivenSet(prev => {
          const next = new Set(prev);
          next.delete(`${med.id}-${slotKey}`);
          return next;
        });
        setResetConfirm(null);
        onSaved();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to reset', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setResetting(false); }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Date picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Date:</label>
        <input
          type="date"
          value={selectedDate}
          max={todayStr()}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ ...s.input, margin: 0, width: 'auto', fontSize: 13, padding: '5px 10px' }}
        />
        {selectedDate !== todayStr() && (
          <button onClick={() => setSelectedDate(todayStr())} style={{
            fontSize: 12, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
            backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)',
          }}>Today</button>
        )}
      </div>

      {/* Time slot tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {SLOTS.map(sl => {
          const active = slot === sl.key;
          const count = allMeds.filter(m => {
            const d = m[sl.doseKey];
            return d != null && parseFloat(d) > 0;
          }).length;
          const givenCount = allMeds.filter(m => givenSet.has(`${m.id}-${sl.key}`)).length;
          return (
            <button key={sl.key} onClick={() => setSlot(sl.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 20, cursor: 'pointer',
              fontWeight: active ? 700 : 400, fontSize: 14,
              backgroundColor: active ? 'var(--primary)' : 'var(--bg-secondary)',
              color: active ? 'white' : 'var(--text)',
              border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
              position: 'relative',
            }}>
              {sl.icon} {sl.label}
              {count > 0 && (
                <span style={{
                  backgroundColor: givenCount === count ? '#22c55e' : active ? 'rgba(255,255,255,0.3)' : 'var(--primary)',
                  color: 'white',
                  fontSize: 11, fontWeight: 700,
                  borderRadius: 10, padding: '1px 6px', marginLeft: 2,
                }}>
                  {givenCount}/{count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {slotMeds.length === 0 && (
        <div style={{ ...s.empty, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{slotInfo.icon}</div>
          No medicines scheduled for {slotInfo.label.toLowerCase()}.
        </div>
      )}

      {groups.map(group => (
        <div key={group.id ?? '__h'} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: 1,
            marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border)'
          }}>
            👤 {group.name}
          </div>

          {group.meds.map(med => {
            const slotDose = parseFloat(med[slotInfo.doseKey]);
            const foodLabel = FOOD_LABELS[med.food_relation];
            const isGiving = giving[med.id];
            const stockColor = ALERT_COLORS[med.alert_level] || ALERT_COLORS.ok;
            const noStock = parseFloat(med.current_stock) <= 0;
            const isGiven = givenSet.has(`${med.id}-${slot}`);

            return (
              <div key={med.id} style={{ ...s.listRow, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
                    {med.medicine_name}
                  </div>
                  {/* Chips row: strength · dose · food */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {med.strength && (
                      <span style={{ fontSize: 13, fontWeight: 600, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '3px 9px', borderRadius: 20, border: '1px solid var(--border)' }}>
                        {med.strength}
                      </span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 700, backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20 }}>
                      {slotDose} {med.unit}
                    </span>
                    {foodLabel && (
                      <span style={{ fontSize: 13, fontWeight: 600, backgroundColor: '#f0fdf4', color: '#16a34a', padding: '3px 9px', borderRadius: 20 }}>
                        {foodLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: stockColor, marginTop: 6 }}>
                    Stock: {parseFloat(med.current_stock)} {med.unit}
                    {med.days_left !== null && ` · ${med.days_left}d left`}
                  </div>
                </div>

                {isGiven ? (
                  <button
                    onClick={() => setResetConfirm({ med, slotKey: slot })}
                    style={{
                      flexShrink: 0, padding: '10px 18px', borderRadius: 10,
                      fontWeight: 700, fontSize: 13,
                      backgroundColor: '#f0fdf4',
                      color: '#16a34a',
                      border: '2px solid #86efac', cursor: 'pointer',
                    }}
                  >
                    ✔ Given
                  </button>
                ) : (
                  <button
                    onClick={() => handleGive(med)}
                    disabled={isGiving || noStock}
                    style={{
                      flexShrink: 0, padding: '10px 18px', borderRadius: 10,
                      fontWeight: 700, fontSize: 13,
                      backgroundColor: noStock ? '#f3f4f6' : '#22c55e',
                      color: noStock ? '#9ca3af' : 'white',
                      border: 'none', cursor: noStock ? 'not-allowed' : 'pointer',
                      opacity: isGiving ? 0.6 : 1,
                    }}
                  >
                    {isGiving ? '…' : noStock ? 'No Stock' : '✔ Give'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Half-tablet discard modal */}
      {halfModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setHalfModal(null)}>
          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 20, width: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
              {halfModal.med.medicine_name}
              {halfModal.med.strength ? <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-faint)', marginLeft: 6 }}>{halfModal.med.strength}</span> : null}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>
              {slotInfo.icon} {slotInfo.label}
            </div>

            <div style={{
              backgroundColor: '#fef3c7', border: '1px solid #fde68a',
              borderRadius: 8, padding: '8px 10px', marginBottom: 14, fontSize: 12, color: '#92400e',
            }}>
              Dose is <strong>{halfModal.slotDose} {halfModal.med.unit}</strong> — you'll need to break a tablet.
              What happens to the other half?
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button onClick={() => confirmGive(false)} style={{
                flex: 1, padding: '14px 8px', borderRadius: 10, cursor: 'pointer',
                backgroundColor: 'var(--primary)', color: 'white',
                border: 'none', fontWeight: 700, fontSize: 13, lineHeight: 1.4,
              }}>
                Kept<br />
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>usable for next dose</span>
              </button>
              <button onClick={() => confirmGive(true)} style={{
                flex: 1, padding: '14px 8px', borderRadius: 10, cursor: 'pointer',
                backgroundColor: 'var(--bg-secondary)', color: 'var(--text)',
                border: '2px solid var(--border)', fontWeight: 700, fontSize: 13, lineHeight: 1.4,
              }}>
                Discarded<br />
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>remove from stock</span>
              </button>
            </div>

            <button onClick={() => setHalfModal(null)} style={{ ...s.cancelBtn, width: '100%' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reset confirm modal */}
      {resetConfirm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setResetConfirm(null)}>
          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 20, width: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              ↩ Reset dose?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              Mark <strong>{resetConfirm.med.medicine_name}</strong> ({SLOTS.find(sl => sl.key === resetConfirm.slotKey)?.label}) as <em>not given</em> for {selectedDate}?
              <br /><br />
              This will restore the dose back to stock.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                  backgroundColor: '#fef2f2', color: '#dc2626',
                  border: '2px solid #fecaca', fontWeight: 700, fontSize: 13,
                  opacity: resetting ? 0.6 : 1,
                }}
              >
                {resetting ? 'Resetting…' : '↩ Reset'}
              </button>
              <button onClick={() => setResetConfirm(null)} style={s.cancelBtn}>
                Keep as Given
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
