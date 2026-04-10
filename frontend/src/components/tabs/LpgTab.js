import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { todayStr, fmt, fmt2, fmtD, getDateRange } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';

export default function LpgTab({ showToast }) {
  const [lpg, setLpg] = useState(null);
  const [lpgWaiting, setLpgWaiting] = useState('');
  const [lpgTotalCylinders, setLpgTotalCylinders] = useState('');
  const [lpgFilledCylinders, setLpgFilledCylinders] = useState('');
  const [lpgEmptyCylinders, setLpgEmptyCylinders] = useState('');
  const [lpgBookDate, setLpgBookDate] = useState(todayStr());
  const [lpgDelivDate, setLpgDelivDate] = useState('');
  const [lpgPrice, setLpgPrice] = useState('');
  const [lpgNotes, setLpgNotes] = useState('');
  const [lpgSaving, setLpgSaving] = useState(false);
  const [lpgEditId, setLpgEditId] = useState(null);
  const [lpgEditDate, setLpgEditDate] = useState('');
  const [lpgEditDeliv, setLpgEditDeliv] = useState('');
  const [lpgEditPrice, setLpgEditPrice] = useState('');
  const [lpgEditNotes, setLpgEditNotes] = useState('');
  const [lpgTrends, setLpgTrends] = useState(null);
  const [lpgTrendPeriod, setLpgTrendPeriod] = useState('6m');
  const [lpgTrendCustomStart, setLpgTrendCustomStart] = useState('');
  const [lpgTrendCustomEnd, setLpgTrendCustomEnd] = useState(todayStr());

  const fetchLpg = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/status/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLpg(data);
        setLpgWaiting(String(data.waiting_days));
        setLpgTotalCylinders(String(data.total_cylinders ?? ''));
        setLpgFilledCylinders(String(data.filled_cylinders ?? ''));
        setLpgEmptyCylinders(String(data.empty_cylinders ?? ''));
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchLpgTrends = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const range = getDateRange(lpgTrendPeriod, lpgTrendCustomStart, lpgTrendCustomEnd);
      const params = new URLSearchParams();
      if (range.start) params.set('start', range.start);
      if (range.end) params.set('end', range.end);
      const res = await fetch(`${API}/api/lpg/trends/?${params}`, { headers });
      if (res.ok) setLpgTrends(await res.json());
    } catch (e) { console.error(e); }
  }, [lpgTrendCustomEnd, lpgTrendCustomStart, lpgTrendPeriod]);

  useEffect(() => {
    fetchLpg();
    fetchLpgTrends();
  }, [fetchLpg, fetchLpgTrends]);

  useEffect(() => {
    if (lpg) fetchLpgTrends();
  }, [lpg, fetchLpgTrends]);

  // BUG FIX: validate filled + empty <= total before sending, and add try/catch
  const handleLpgSaveConfig = async () => {
    const total  = parseInt(lpgTotalCylinders  || 0);
    const filled = parseInt(lpgFilledCylinders || 0);
    const empty  = parseInt(lpgEmptyCylinders  || 0);

    if (filled + empty > total) {
      showToast(`Filled (${filled}) + empty (${empty}) cannot exceed total (${total}) cylinders`, 'error');
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/config/`, {
        method: 'POST', headers,
        body: JSON.stringify({
          waiting_days:      parseInt(lpgWaiting || 0),
          total_cylinders:   total,
          filled_cylinders:  filled,
          empty_cylinders:   empty,
        }),
      });
      if (res.ok) {
        showToast('✓ Settings updated');
        fetchLpg();
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.non_field_errors?.[0] || err.detail || 'Error saving settings';
        showToast(msg, 'error');
      }
    } catch { showToast('Network error', 'error'); }
  };

  const handleLpgBook = async (e) => {
    e.preventDefault();
    setLpgSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/book/`, {
        method: 'POST', headers,
        body: JSON.stringify({
          booking_date:   lpgBookDate,
          delivered_date: lpgDelivDate || null,
          price:          lpgPrice ? parseFloat(lpgPrice) : null,
          notes:          lpgNotes,
        }),
      });
      if (res.ok) {
        setLpgBookDate(todayStr()); setLpgDelivDate(''); setLpgNotes(''); setLpgPrice('');
        showToast('✓ Booking recorded'); fetchLpg();
      } else showToast('Error recording booking', 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLpgSaving(false); }
  };

  const handleLpgSaveEdit = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/${id}/booking/`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          booking_date:   lpgEditDate,
          delivered_date: lpgEditDeliv || null,
          price:          lpgEditPrice ? parseFloat(lpgEditPrice) : null,
          notes:          lpgEditNotes,
        }),
      });
      if (res.ok) { setLpgEditId(null); showToast('✓ Updated'); fetchLpg(); }
      else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Error updating booking', 'error');
      }
    } catch { showToast('Network error', 'error'); }
  };

  const handleLpgDelete = async (id) => {
    if (!window.confirm('Delete this booking?')) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/lpg/${id}/booking/`, { method: 'DELETE', headers });
      if (res.ok || res.status === 204) { showToast('Deleted'); fetchLpg(); fetchLpgTrends(); }
      else showToast('Error deleting', 'error');
    } catch { showToast('Network error', 'error'); }
  };

  const lpgBookingMax = Math.max(...(lpgTrends?.booking_points || []).map(p => p.bookings), 1);
  const lpgPriceMax   = Math.max(...(lpgTrends?.price_points   || []).map(p => p.price),    1);

  return (
    <div style={s.section}>
      {/* Status banner */}
      {lpg && (
        <div style={{
          ...s.card,
          textAlign: 'center',
          padding: '18px 16px',
          marginBottom: 16,
          borderTop: `4px solid ${lpg.can_book ? '#16a34a' : '#f59e0b'}`,
        }}>
          {(() => {
            const eligibleDate = lpg.latest_booking
              ? (() => {
                  const d = new Date(lpg.latest_booking.booking_date);
                  d.setDate(d.getDate() + lpg.waiting_days);
                  return fmtD(d.toISOString().slice(0, 10));
                })()
              : null;
            return lpg.can_book ? (
              <>
                <div style={{ fontSize: 28 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>Booking Open</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  {lpg.days_since} days since last booking — you can book now
                </div>
              </>
            ) : lpg.latest_booking ? (
              <>
                <div style={{ fontSize: 28 }}>⏳</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                  Wait {lpg.days_remaining} more day{lpg.days_remaining !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  Last booked {lpg.days_since} day{lpg.days_since !== 1 ? 's' : ''} ago
                  · eligible after {lpg.waiting_days} days
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e', marginTop: 6, backgroundColor: '#fef3c7', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                  📅 Next eligible: {eligibleDate}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28 }}>🔥</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1d4ed8', marginTop: 4 }}>No bookings yet</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Record your first LPG cylinder booking below</div>
              </>
            );
          })()}
        </div>
      )}
      {!lpg && <p style={s.empty}>Loading LPG status…</p>}

      {/* Trends */}
      {lpgTrends && (
        <>
          <div style={{ ...s.card, marginBottom: 12 }}>
            <div style={s.panelTitle}>LPG Trends</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0 12px' }}>
              {[['30d', '30 Days'], ['3m', '3 Months'], ['6m', '6 Months'], ['1y', '1 Year'], ['all', 'All Time'], ['custom', 'Custom']].map(([v, label]) => (
                <button key={v} onClick={() => setLpgTrendPeriod(v)} style={{ ...s.sessionPill, ...(lpgTrendPeriod === v ? s.sessionPillActive : {}) }}>{label}</button>
              ))}
            </div>
            {lpgTrendPeriod === 'custom' && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <label style={s.fieldLabel}>Start</label>
                  <input type="date" value={lpgTrendCustomStart} onChange={e => setLpgTrendCustomStart(e.target.value)} style={s.input} />
                </div>
                <div>
                  <label style={s.fieldLabel}>End</label>
                  <input type="date" value={lpgTrendCustomEnd} onChange={e => setLpgTrendCustomEnd(e.target.value)} style={s.input} />
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <div style={s.balCard}><div style={s.balLabel}>Bookings</div><div style={s.balVal}>{lpgTrends.bookings_count}</div></div>
              <div style={s.balCard}><div style={s.balLabel}>Avg Price</div><div style={s.balVal}>Rs {lpgTrends.avg_price != null ? fmt2(lpgTrends.avg_price) : '--'}</div></div>
              <div style={s.balCard}><div style={s.balLabel}>Avg Days Lasted</div><div style={s.balVal}>{lpgTrends.avg_days_lasted != null ? lpgTrends.avg_days_lasted : '--'}</div></div>
              <div style={s.balCard}><div style={s.balLabel}>Total Spend</div><div style={s.balVal}>Rs {fmt2(lpgTrends.total_spend || 0)}</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                <div style={s.panelTitle}>Bookings In Period</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, marginTop: 12, overflowX: 'auto' }}>
                  {(lpgTrends.booking_points || []).map(point => (
                    <div key={point.period} style={{ minWidth: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${point.period}: ${point.bookings}`}>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{point.bookings}</div>
                      <div style={{ width: '100%', height: Math.max(4, (point.bookings / lpgBookingMax) * 80), backgroundColor: '#f59e0b', borderRadius: '4px 4px 0 0' }} />
                      <div style={{ fontSize: 9, color: '#94a3b8' }}>{point.period.slice(-5)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                <div style={s.panelTitle}>Price Trend</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, marginTop: 12, overflowX: 'auto' }}>
                  {(lpgTrends.price_points || []).map(point => (
                    <div key={point.date} style={{ minWidth: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${point.date}: Rs ${fmt2(point.price)}`}>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Rs {fmt(point.price)}</div>
                      <div style={{ width: '100%', height: Math.max(4, (point.price / lpgPriceMax) * 80), backgroundColor: '#0f766e', borderRadius: '4px 4px 0 0' }} />
                      <div style={{ fontSize: 9, color: '#94a3b8' }}>{point.date.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div style={{ ...s.card, padding: 12 }}>
              <div style={s.balLabel}>Current Stock</div>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>{lpgTrends.current_stock.filled_cylinders} filled / {lpgTrends.current_stock.empty_cylinders} empty</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>out of {lpgTrends.current_stock.total_cylinders} total cylinders</div>
            </div>
            <div style={{ ...s.card, padding: 12 }}>
              <div style={s.balLabel}>Duration Range</div>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>{lpgTrends.shortest_days_lasted ?? '--'} to {lpgTrends.longest_days_lasted ?? '--'} days</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>completed cylinders in selected period</div>
            </div>
            <div style={{ ...s.card, padding: 12 }}>
              <div style={s.balLabel}>Latest Price Change</div>
              <div style={{ fontWeight: 700, color: lpgTrends.latest_price_change >= 0 ? '#b45309' : '#0f766e' }}>
                {lpgTrends.latest_price_change != null ? `Rs ${fmt2(Math.abs(lpgTrends.latest_price_change))} ${lpgTrends.latest_price_change >= 0 ? 'up' : 'down'}` : '--'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>vs previous priced booking</div>
            </div>
          </div>
        </>
      )}

      {/* New booking form */}
      <div style={s.card}>
        <div style={s.panelTitle}>Record New Booking</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ flex: '1 1 130px' }}>
            <label style={s.fieldLabel}>Booking Date</label>
            <input type="date" value={lpgBookDate} onChange={e => setLpgBookDate(e.target.value)} style={s.input} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={s.fieldLabel}>Delivered Date (optional)</label>
            <input type="date" value={lpgDelivDate} onChange={e => setLpgDelivDate(e.target.value)} style={s.input} />
          </div>
          <div style={{ flex: '2 1 200px' }}>
            <label style={s.fieldLabel}>Notes (optional)</label>
            <input type="text" value={lpgNotes} onChange={e => setLpgNotes(e.target.value)}
              placeholder="e.g. Indane, refill #12" style={s.input} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={s.fieldLabel}>Price (optional)</label>
            <input type="number" step="0.01" value={lpgPrice} onChange={e => setLpgPrice(e.target.value)} style={s.input} />
          </div>
        </div>
        <button onClick={handleLpgBook} disabled={lpgSaving} style={{ ...s.primaryBtn, minWidth: 140 }}>
          {lpgSaving ? 'Saving…' : '➕ Add Booking'}
        </button>
      </div>

      {/* Settings */}
      <div style={{ ...s.card, marginTop: 12 }}>
        <div style={s.panelTitle}>Settings</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={s.fieldLabel}>Waiting Days Before Eligible</label>
            <input type="number" min="1" max="90" value={lpgWaiting} onChange={e => setLpgWaiting(e.target.value)}
              placeholder={lpg ? String(lpg.waiting_days) : '21'} style={{ ...s.input, width: 90 }} />
          </div>
          <div>
            <label style={s.fieldLabel}>Total Cylinders</label>
            <input type="number" min="0" value={lpgTotalCylinders} onChange={e => setLpgTotalCylinders(e.target.value)} style={{ ...s.input, width: 90 }} />
          </div>
          <div>
            <label style={s.fieldLabel}>Filled In Stock</label>
            <input type="number" min="0" value={lpgFilledCylinders} onChange={e => setLpgFilledCylinders(e.target.value)} style={{ ...s.input, width: 110 }} />
          </div>
          <div>
            <label style={s.fieldLabel}>Empty In Stock</label>
            <input type="number" min="0" value={lpgEmptyCylinders} onChange={e => setLpgEmptyCylinders(e.target.value)} style={{ ...s.input, width: 110 }} />
          </div>
          <button onClick={handleLpgSaveConfig} style={{ ...s.primaryBtn, marginBottom: 0 }}>Save</button>
        </div>
      </div>

      {/* Booking history */}
      {lpg && lpg.history && lpg.history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={s.sectionTitle}>Booking History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lpg.history.map(b => (
              <div key={b.id} style={{ ...s.card, padding: '12px 14px' }}>
                {lpgEditId === b.id ? (
                  <div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={s.fieldLabel}>Booking Date</label>
                        <input type="date" value={lpgEditDate} onChange={e => setLpgEditDate(e.target.value)} style={s.input} />
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={s.fieldLabel}>Delivered Date</label>
                        <input type="date" value={lpgEditDeliv} onChange={e => setLpgEditDeliv(e.target.value)} style={s.input} />
                      </div>
                      <div style={{ flex: '1 1 120px' }}>
                        <label style={s.fieldLabel}>Price</label>
                        <input type="number" step="0.01" value={lpgEditPrice} onChange={e => setLpgEditPrice(e.target.value)} style={s.input} />
                      </div>
                      <div style={{ flex: '2 1 180px' }}>
                        <label style={s.fieldLabel}>Notes</label>
                        <input type="text" value={lpgEditNotes} onChange={e => setLpgEditNotes(e.target.value)} style={s.input} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleLpgSaveEdit(b.id)} style={{ ...s.primaryBtn, fontSize: 12 }}>Save</button>
                      <button onClick={() => setLpgEditId(null)} style={{ ...s.secondaryBtn, fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                        📅 Booked: {fmtD(b.booking_date)}
                        {b.delivered_date && <span style={{ color: '#16a34a', marginLeft: 10 }}>✔ Delivered: {fmtD(b.delivered_date)}</span>}
                      </div>
                      {b.price != null && <div style={{ fontSize: 12, color: '#0f766e', marginTop: 2 }}>Price: Rs {fmt2(b.price)}</div>}
                      {b.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{b.notes}</div>}
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        {b.days_lasted != null
                          ? `Lasted ${b.days_lasted} days`
                          : `${b.days_since_booking} days since booking (current)`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setLpgEditId(b.id); setLpgEditDate(b.booking_date); setLpgEditDeliv(b.delivered_date || ''); setLpgEditPrice(b.price || ''); setLpgEditNotes(b.notes || ''); }}
                        style={{ ...s.secondaryBtn, fontSize: 12 }}>Edit</button>
                      <button onClick={() => handleLpgDelete(b.id)}
                        style={{ ...s.secondaryBtn, fontSize: 12, color: '#dc2626', borderColor: '#fca5a5' }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
