import React, { useEffect, useState } from 'react';
import { fmtD, fmtShort, fmt, fmt2, todayStr } from '../../utils/date';
import { API, getAuthHeaders } from '../../utils/api';

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / 86400000);
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeTab({ balance, advances, purchases, lpgStatus, medicines, onNavigate }) {
  const today = todayStr();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch(`${API}/api/consulting-records/?upcoming=true&limit=5`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setUpcoming(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // ── Cycle age ──
  const latestAdvance = advances.length
    ? advances.reduce((a, b) => (a.date > b.date ? a : b))
    : null;
  const cycleAgeDays = latestAdvance ? daysBetween(latestAdvance.date) : null;

  // ── Alerts ──
  const alerts = [];
  if (balance) {
    if (balance.current_balance < 0) {
      alerts.push({ type: 'danger', icon: '⚠️', text: `Rs ${fmt(Math.abs(balance.current_balance))} over advance — pay vendor soon` });
    } else if (balance.current_balance <= 200) {
      alerts.push({ type: 'warn', icon: '💳', text: `Balance low (Rs ${fmt(balance.current_balance)}) — payment approaching` });
    }
    if (cycleAgeDays !== null && cycleAgeDays >= 25 && balance.current_balance > 0) {
      alerts.push({ type: 'warn', icon: '📅', text: `Payment cycle is ${cycleAgeDays} days old — consider settling soon` });
    }
  }
  if (lpgStatus) {
    if (lpgStatus.can_book) {
      alerts.push({ type: 'ok', icon: '🔵', text: 'LPG cylinder can be booked now' });
    } else if (lpgStatus.days_remaining !== undefined && lpgStatus.days_remaining <= 3) {
      alerts.push({ type: 'warn', icon: '🔵', text: `LPG booking available in ${lpgStatus.days_remaining} day${lpgStatus.days_remaining === 1 ? '' : 's'}` });
    }
  }
  if (medicines && medicines.length > 0) {
    medicines.forEach(med => {
      if (med.alert_level === 'critical') {
        const daysText = med.days_left !== null ? ` — ${med.days_left}d left` : '';
        alerts.push({ type: 'danger', icon: '🔴', text: `${med.medicine_name} critically low${daysText}` });
      } else if (med.alert_level === 'low') {
        alerts.push({ type: 'warn', icon: '🟡', text: `${med.medicine_name} — low stock (${parseFloat(med.current_stock)} ${med.unit} remaining)` });
      }
    });
  }

  // ── Today's purchases ──
  const todayPurchases = purchases.filter(p => p.date === today);
  const todayTotal = todayPurchases.reduce((s, p) => s + (p.total || 0), 0);

  // ── Recent activity (last 8) ──
  const recent = [...purchases].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '16px',
    boxShadow: 'var(--shadow)',
    backdropFilter: 'var(--blur)',
    WebkitBackdropFilter: 'var(--blur)',
  };

  const labelStyle = { fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' };
  const bigNumStyle = { fontSize: 26, fontWeight: 800, lineHeight: 1, marginBottom: 2 };
  const subStyle = { fontSize: 12, color: 'var(--text-muted)' };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Welcome */}
      <div style={{ ...cardStyle, background: 'var(--accent)', border: 'none', color: 'white' }}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.8, marginBottom: 2 }}>
          {greet()}{user.email ? `, ${user.email.split('@')[0]}` : ''} 👋
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => (
            <div key={i} className={`alert-pill ${a.type}`}
              style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <span>{a.icon}</span>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="stat-grid">
        {/* Balance */}
        <div style={cardStyle}>
          <span style={labelStyle}>Advance Balance</span>
          {balance ? (
            <>
              <div style={{ ...bigNumStyle, color: balance.current_balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                Rs {fmt(Math.abs(balance.current_balance))}
              </div>
              <div style={subStyle}>{balance.current_balance >= 0 ? 'remaining' : 'over advance'}</div>
            </>
          ) : (
            <div style={{ ...bigNumStyle, color: 'var(--text-faint)' }}>—</div>
          )}
        </div>

        {/* Current Advance */}
        <div style={cardStyle}>
          <span style={labelStyle}>Current Advance</span>
          {balance ? (
            <>
              <div style={{ ...bigNumStyle, color: 'var(--accent)' }}>Rs {fmt(balance.current_advance_amount)}</div>
              {balance.current_advance_date && (
                <div style={subStyle}>since {fmtShort(balance.current_advance_date)}{cycleAgeDays !== null ? ` · ${cycleAgeDays}d ago` : ''}</div>
              )}
            </>
          ) : (
            <div style={{ ...bigNumStyle, color: 'var(--text-faint)' }}>—</div>
          )}
        </div>

        {/* Spent this cycle */}
        <div style={cardStyle}>
          <span style={labelStyle}>Spent This Cycle</span>
          {balance ? (
            <>
              <div style={{ ...bigNumStyle, color: 'var(--danger)' }}>Rs {fmt(balance.current_purchases)}</div>
              <div style={subStyle}>this payment cycle</div>
            </>
          ) : (
            <div style={{ ...bigNumStyle, color: 'var(--text-faint)' }}>—</div>
          )}
        </div>

        {/* Today */}
        <div style={cardStyle}>
          <span style={labelStyle}>Today's Spend</span>
          <div style={{ ...bigNumStyle, color: 'var(--text)' }}>Rs {fmt2(todayTotal)}</div>
          <div style={subStyle}>{todayPurchases.length} item{todayPurchases.length !== 1 ? 's' : ''} purchased</div>
        </div>
      </div>

      {/* LPG Status */}
      {lpgStatus && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={labelStyle}>LPG Cylinder Status</span>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{lpgStatus.filled_cylinders ?? '—'}</div>
                  <div style={subStyle}>filled</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-muted)' }}>{lpgStatus.empty_cylinders ?? '—'}</div>
                  <div style={subStyle}>empty</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {lpgStatus.can_book ? (
                <span className="alert-pill ok" style={{ borderRadius: 8, padding: '6px 12px' }}>✓ Can Book</span>
              ) : (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                    {lpgStatus.days_remaining > 0 ? `${lpgStatus.days_remaining}d until eligible` : 'Checking...'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                    {lpgStatus.days_since} days since last booking
                  </div>
                </div>
              )}
            </div>
          </div>
          {lpgStatus.latest_booking && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
              Last booked {fmtD(lpgStatus.latest_booking.booking_date)}
              {lpgStatus.latest_booking.delivered_date
                ? ` · delivered ${fmtD(lpgStatus.latest_booking.delivered_date)}`
                : ' · pending delivery'}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Consultations */}
      {upcoming.length > 0 && (
        <div style={{ ...cardStyle, cursor: 'pointer' }} onClick={() => onNavigate?.('medicare', 'consult')}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>🩺 Upcoming Consultations</span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>tap to view all</span>
          </div>
          {upcoming.map((c, i) => {
            const d = c.days_until_next;
            const color = d <= 7 ? 'var(--danger)' : d <= 30 ? '#f59e0b' : 'var(--success)';
            return (
              <div key={c.id ?? i} className="activity-row">
                <div style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🩺</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.patient_name} — {c.doctor_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    {c.specialty && `${c.specialty} · `}{fmtD(c.next_appointment_date)}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                  {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d}d`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Activity */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span>Recent Activity</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontWeight: 500 }}>last {recent.length} entries</span>
        </div>
        {recent.length === 0 ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No purchases yet</div>
        ) : (
          recent.map((p, i) => (
            <div key={p.id ?? i} className="activity-row">
              <div style={{
                width: 34, height: 34, borderRadius: 8, backgroundColor: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                {p.item_name?.toLowerCase().includes('milk') ? '🥛' :
                 p.item_name?.toLowerCase().includes('prabha') || p.item_name?.toLowerCase().includes('paper') ? '📰' : '📦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.item_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  {fmtD(p.date)} · qty {p.quantity}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>
                Rs {fmt2(p.total)}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
