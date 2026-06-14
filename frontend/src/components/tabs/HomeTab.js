import React, { useEffect, useRef, useState } from 'react';
import { fmtD, fmtShort, fmt, fmt2, todayStr } from '../../utils/date';
import { API, getAuthHeaders } from '../../utils/api';

function daysBetween(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.floor((new Date() - d) / 86400000);
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const TYPE_ORDER = { danger: 0, warn: 1, ok: 2 };

const STATUS_STYLE = {
  danger: { border: '#dc2626', badgeBg: '#fee2e2', badgeText: '#dc2626' },
  warn:   { border: '#f59e0b', badgeBg: '#fef3c7', badgeText: '#b45309' },
  ok:     { border: '#16a34a', badgeBg: '#dcfce7', badgeText: '#16a34a' },
  none:   { border: '#e2e8f0', badgeBg: '#f8fafc', badgeText: '#94a3b8' },
};

const CAT_META = {
  milk:         { icon: '🥛', label: 'Milk' },
  finance:      { icon: '💳', label: 'Finance' },
  todos:        { icon: '✅', label: 'Todos' },
  medicines:    { icon: '💊', label: 'Medicines' },
  vehicles:     { icon: '🚗', label: 'Vehicles' },
  appliances:   { icon: '🔌', label: 'Appliances' },
  lpg:          { icon: '🔵', label: 'LPG' },
  appointments: { icon: '🩺', label: 'Health' },
};

export default function HomeTab({ balance, advances, purchases, lpgStatus, medicines, vehicles, appliances, onNavigate }) {
  const today = todayStr();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [upcoming, setUpcoming]     = useState([]);
  const [openTodos, setOpenTodos]   = useState([]);
  const [skippedDates, setSkippedDates] = useState(new Set());

  // UI state
  const [activeCard, setActiveCard] = useState(null); // key of expanded detail panel
  const [filterCat, setFilterCat]   = useState('all');
  const [tooltip, setTooltip]       = useState(null); // card key on hover
  const detailRef                   = useRef(null);

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch(`${API}/api/consulting-records/?upcoming=true&limit=5`, { headers })
      .then(r => r.ok ? r.json() : []).then(d => setUpcoming(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/api/reminder-skips/`, { headers })
      .then(r => r.ok ? r.json() : []).then(d => setSkippedDates(new Set(Array.isArray(d) ? d : []))).catch(() => {});
    fetch(`${API}/api/diary-entries/?entry_type=todo&status=open`, { headers })
      .then(r => r.ok ? r.json() : []).then(d => setOpenTodos(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Scroll to detail panel when opened
  useEffect(() => {
    if (activeCard && detailRef.current) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [activeCard]);

  // ── Derived: Cycle ──
  const latestAdvance = advances.length ? advances.reduce((a, b) => (a.date > b.date ? a : b)) : null;
  const cycleAgeDays  = latestAdvance ? daysBetween(latestAdvance.date) : null;

  // ── Derived: Missing purchase days ──
  const missingDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (!purchases.some(p => p.date === ds) && !skippedDates.has(ds)) missingDates.push(ds);
  }

  // ── Derived: Todos ──
  const criticalTodos = openTodos.filter(t => t.criticality === 'critical').length;
  const overdueTodos  = openTodos.filter(t => t.due_date && t.due_date < today).length;

  // ── Build actionItems ──
  const actionItems = [];

  // Finance
  if (balance) {
    if (balance.current_balance < 0)
      actionItems.push({ type: 'danger', icon: '⚠️', text: `₹${fmt(Math.abs(balance.current_balance))} over advance — pay vendor`, category: 'finance', navTarget: ['payments', null] });
    else if (balance.current_balance <= 200)
      actionItems.push({ type: 'warn', icon: '💳', text: `Balance low: ₹${fmt(balance.current_balance)} remaining`, category: 'finance', navTarget: ['payments', null] });
    if (cycleAgeDays !== null && cycleAgeDays >= 25 && balance.current_balance > 0)
      actionItems.push({ type: 'warn', icon: '📅', text: `Cycle is ${cycleAgeDays}d old — consider settling`, category: 'finance', navTarget: ['payments', null] });
  }

  // LPG
  if (lpgStatus) {
    if (lpgStatus.can_book)
      actionItems.push({ type: 'ok', icon: '🔵', text: 'LPG cylinder can be booked now', category: 'lpg', navTarget: ['home', 'lpg'] });
    else if (lpgStatus.days_remaining !== undefined && lpgStatus.days_remaining <= 3)
      actionItems.push({ type: 'warn', icon: '🔵', text: `LPG eligible in ${lpgStatus.days_remaining}d`, category: 'lpg', navTarget: ['home', 'lpg'] });
  }

  // Vehicles
  vehicles?.filter(v => v.is_active).forEach(v => {
    const lbl = `${v.make} ${v.model} (${v.registration_no})`;
    if (v.days_until_pucc_expiry !== null && v.days_until_pucc_expiry <= 30)
      actionItems.push({ type: v.days_until_pucc_expiry <= 0 ? 'danger' : 'warn', icon: '📋', text: `${lbl} PUCC ${v.days_until_pucc_expiry <= 0 ? 'EXPIRED' : `in ${v.days_until_pucc_expiry}d`}`, category: 'vehicles', navTarget: ['vehicles', 'docs'] });
    if (v.days_until_insurance_expiry !== null && v.days_until_insurance_expiry <= 30)
      actionItems.push({ type: v.days_until_insurance_expiry <= 0 ? 'danger' : 'warn', icon: '🛡️', text: `${lbl} insurance ${v.days_until_insurance_expiry <= 0 ? 'EXPIRED' : `in ${v.days_until_insurance_expiry}d`}`, category: 'vehicles', navTarget: ['vehicles', 'docs'] });
    if (v.days_until_next_service !== null && v.days_until_next_service <= 14)
      actionItems.push({ type: v.days_until_next_service <= 0 ? 'danger' : 'warn', icon: '🔧', text: `${lbl} service ${v.days_until_next_service <= 0 ? 'OVERDUE' : `in ${v.days_until_next_service}d`}`, category: 'vehicles', navTarget: ['vehicles', 'maint'] });
    if (v.days_until_oil_change !== null && v.days_until_oil_change <= 14)
      actionItems.push({ type: v.days_until_oil_change <= 0 ? 'danger' : 'warn', icon: '🔄', text: `${lbl} oil ${v.days_until_oil_change <= 0 ? 'OVERDUE' : `in ${v.days_until_oil_change}d`}`, category: 'vehicles', navTarget: ['vehicles', 'maint'] });
  });

  // Appliances
  appliances?.filter(a => a.is_active).forEach(a => {
    if (a.days_until_warranty !== null && a.days_until_warranty !== undefined && a.days_until_warranty <= 30)
      actionItems.push({ type: a.days_until_warranty <= 0 ? 'danger' : 'warn', icon: '🔌', text: `${a.name} warranty ${a.days_until_warranty <= 0 ? 'EXPIRED' : `in ${a.days_until_warranty}d`}`, category: 'appliances', navTarget: ['home', 'appliances'] });
    if (a.days_until_amc !== null && a.days_until_amc !== undefined && a.days_until_amc <= 30)
      actionItems.push({ type: a.days_until_amc <= 0 ? 'danger' : 'warn', icon: '🔌', text: `${a.name} AMC ${a.days_until_amc <= 0 ? 'EXPIRED' : `in ${a.days_until_amc}d`}`, category: 'appliances', navTarget: ['home', 'appliances'] });
    if (a.days_until_next_service !== null && a.days_until_next_service !== undefined && a.days_until_next_service <= 14)
      actionItems.push({ type: a.days_until_next_service <= 0 ? 'danger' : 'warn', icon: '🔧', text: `${a.name} service ${a.days_until_next_service <= 0 ? 'OVERDUE' : `in ${a.days_until_next_service}d`}`, category: 'appliances', navTarget: ['home', 'appliances'] });
  });

  // Medicines
  medicines?.forEach(med => {
    if (med.alert_level === 'critical')
      actionItems.push({ type: 'danger', icon: '🔴', text: `${med.medicine_name} critically low${med.days_left !== null ? ` — ${med.days_left}d` : ''}`, category: 'medicines', navTarget: ['medicare', 'medicines'] });
    else if (med.alert_level === 'low')
      actionItems.push({ type: 'warn', icon: '🟡', text: `${med.medicine_name} low stock (${parseFloat(med.current_stock)} ${med.unit})`, category: 'medicines', navTarget: ['medicare', 'medicines'] });
  });

  // Milk missing purchases
  missingDates.forEach(ds => {
    const isToday = ds === today;
    const lbl = isToday ? 'Today' : new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    actionItems.push({ type: 'warn', icon: '🥛', text: `No purchases for ${lbl}`, category: 'milk', navTarget: ['purchase', 'milk'], date: ds });
  });

  // Todos
  openTodos.forEach(t => {
    const type = t.criticality === 'critical' ? 'danger' : (t.due_date && t.due_date < today) ? 'warn' : 'ok';
    actionItems.push({ type, icon: t.criticality === 'critical' ? '🔴' : '✅', text: `${t.title}${t.due_date ? ` · due ${fmtD(t.due_date)}` : ''}`, category: 'todos', navTarget: ['journal', 'todo'] });
  });

  // Upcoming consultations
  upcoming.forEach(c => {
    const d = c.days_until_next;
    actionItems.push({ type: d <= 7 ? 'warn' : 'ok', icon: '🩺', text: `${c.patient_name} — ${c.doctor_name} · ${d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d}d`}`, category: 'appointments', navTarget: ['medicare', 'consult'] });
  });

  actionItems.sort((a, b) => (TYPE_ORDER[a.type] ?? 3) - (TYPE_ORDER[b.type] ?? 3));

  const skipReminder = async (dateStr) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      await fetch(`${API}/api/reminder-skips/`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateStr }) });
      setSkippedDates(prev => new Set([...prev, dateStr]));
    } catch {}
  };

  // ── Build card definitions ──
  const milkItems  = actionItems.filter(a => a.category === 'milk');
  const finItems   = actionItems.filter(a => a.category === 'finance');
  const todoItems  = actionItems.filter(a => a.category === 'todos');
  const medItems   = actionItems.filter(a => a.category === 'medicines');
  const vehItems   = actionItems.filter(a => a.category === 'vehicles');
  const appItems   = actionItems.filter(a => a.category === 'appliances');
  const lpgItems   = actionItems.filter(a => a.category === 'lpg');
  const hlthItems  = actionItems.filter(a => a.category === 'appointments');

  const worstType = (items) => {
    if (items.some(i => i.type === 'danger')) return 'danger';
    if (items.some(i => i.type === 'warn'))   return 'warn';
    if (items.length > 0)                     return 'ok';
    return 'none';
  };

  // Milk card: primary = balance, secondary = cycle + missing
  const milkStatus = (() => {
    if (!balance) return 'none';
    if (balance.current_balance < 0) return 'danger';
    if (balance.current_balance <= 200 || missingDates.length > 0) return 'warn';
    return 'ok';
  })();

  const cardDefs = [
    {
      key: 'milk', icon: '🥛', label: 'Milk',
      status: milkStatus,
      primary: balance ? `₹${fmt(Math.abs(balance.current_balance))}` : '—',
      secondary: [
        balance ? (balance.current_balance >= 0 ? 'remaining' : 'over advance') : '',
        missingDates.length > 0 ? `${missingDates.length} day${missingDates.length > 1 ? 's' : ''} missing` : '',
        cycleAgeDays !== null ? `${cycleAgeDays}d cycle` : '',
      ].filter(Boolean).join(' · '),
      items: milkItems,
      navTarget: ['purchase', 'milk'],
    },
    {
      key: 'finance', icon: '💳', label: 'Finance',
      status: worstType(finItems) === 'none' ? (balance ? 'ok' : 'none') : worstType(finItems),
      primary: balance ? `₹${fmt(Math.abs(balance.current_balance))}` : '—',
      secondary: balance
        ? (balance.current_balance >= 0 ? 'advance balance left' : 'over advance')
        + (balance.current_advance_date ? ` · ${fmtShort(balance.current_advance_date)}` : '')
        : 'No data',
      items: finItems,
      navTarget: ['payments', null],
    },
    {
      key: 'todos', icon: '✅', label: 'Todos',
      status: criticalTodos > 0 ? 'danger' : openTodos.length > 0 ? 'warn' : 'ok',
      primary: openTodos.length > 0 ? `${openTodos.length} open` : 'All done',
      secondary: [
        criticalTodos > 0 ? `${criticalTodos} critical` : '',
        overdueTodos > 0  ? `${overdueTodos} overdue`  : '',
      ].filter(Boolean).join(' · ') || (openTodos.length === 0 ? 'Nothing pending' : `${openTodos.length} task${openTodos.length > 1 ? 's' : ''}`),
      items: todoItems,
      navTarget: ['journal', 'todo'],
    },
    {
      key: 'medicines', icon: '💊', label: 'Medicines',
      status: worstType(medItems),
      primary: medItems.length > 0 ? `${medItems.length} alert${medItems.length > 1 ? 's' : ''}` : 'All OK',
      secondary: medItems.length > 0
        ? medItems.slice(0, 2).map(i => i.text.split(' — ')[0]).join(', ')
        : 'Stock levels fine',
      items: medItems,
      navTarget: ['medicare', 'medicines'],
    },
    {
      key: 'vehicles', icon: '🚗', label: 'Vehicles',
      status: worstType(vehItems),
      primary: vehItems.length > 0 ? `${vehItems.length} expiring` : 'All OK',
      secondary: vehItems.length > 0
        ? vehItems[0].text.replace(/\(.*?\)/g, '').trim()
        : 'Docs & service up to date',
      items: vehItems,
      navTarget: ['vehicles', 'maint'],
    },
    {
      key: 'appliances', icon: '🔌', label: 'Appliances',
      status: worstType(appItems),
      primary: appItems.length > 0 ? `${appItems.length} alert${appItems.length > 1 ? 's' : ''}` : 'All OK',
      secondary: appItems.length > 0
        ? appItems.slice(0, 2).map(i => i.text.split(' warranty')[0].split(' AMC')[0].split(' service')[0]).join(', ')
        : 'Warranty & AMC current',
      items: appItems,
      navTarget: ['home', 'appliances'],
    },
    {
      key: 'lpg', icon: '🔵', label: 'LPG',
      status: lpgStatus?.can_book ? 'ok' : (lpgStatus?.days_remaining <= 3 ? 'warn' : 'none'),
      primary: lpgStatus ? `${lpgStatus.filled_cylinders ?? '—'} filled` : '—',
      secondary: lpgStatus
        ? (lpgStatus.can_book ? '✓ Can book now' : `${lpgStatus.days_remaining}d until eligible`)
        : 'No data',
      items: lpgItems,
      navTarget: ['home', 'lpg'],
    },
    {
      key: 'appointments', icon: '🩺', label: 'Health',
      status: worstType(hlthItems),
      primary: upcoming.length > 0 ? `${upcoming.length} upcoming` : 'None scheduled',
      secondary: upcoming.length > 0
        ? `${upcoming[0].patient_name} · ${fmtD(upcoming[0].next_appointment_date)}`
        : 'No upcoming appointments',
      items: hlthItems,
      navTarget: ['medicare', 'consult'],
    },
  ];

  // ── Filter tabs for detail panel ──
  const activeCats = ['all', ...Object.keys(CAT_META).filter(k => actionItems.some(a => a.category === k))];
  const detailItems = filterCat === 'all' ? actionItems : actionItems.filter(a => a.category === filterCat);

  // ── Styles ──
  const cardBase = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '14px 12px',
    boxShadow: 'var(--shadow)',
    position: 'relative',
    cursor: 'pointer',
    minHeight: 110,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    transition: 'box-shadow 0.15s',
    userSelect: 'none',
  };

  // ── SummaryCard ──
  const SummaryCard = ({ def }) => {
    const ss = STATUS_STYLE[def.status] || STATUS_STYLE.none;
    const isActive = activeCard === def.key;
    const showTip = tooltip === def.key && def.items.length > 0;

    return (
      <div
        style={{
          ...cardBase,
          borderLeft: `4px solid ${ss.border}`,
          boxShadow: isActive
            ? `0 0 0 2px ${ss.border}, var(--shadow)`
            : 'var(--shadow)',
        }}
        onClick={() => {
          setActiveCard(isActive ? null : def.key);
          setFilterCat(def.key === 'milk' ? 'milk' : def.key === 'appointments' ? 'appointments' : def.key);
          setTooltip(null);
        }}
        onMouseEnter={() => setTooltip(def.key)}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Icon + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>{def.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{def.label}</span>
        </div>

        {/* Primary metric */}
        <div style={{ fontSize: 18, fontWeight: 800, color: ss.border, lineHeight: 1.1 }}>
          {def.primary}
        </div>

        {/* Secondary */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {def.secondary}
        </div>

        {/* Badge dot if alerts exist */}
        {def.items.filter(i => i.type !== 'ok').length > 0 && (
          <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: ss.border }} />
        )}

        {/* Hover tooltip */}
        {showTip && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8,
            background: 'var(--surface)', border: `1px solid ${ss.border}`,
            borderRadius: 10, padding: '10px 12px', zIndex: 200,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ss.border, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {def.icon} {def.label}
            </div>
            {def.items.slice(0, 4).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 3, fontSize: 12, color: 'var(--text)' }}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                <span style={{ lineHeight: 1.3 }}>{item.text}</span>
              </div>
            ))}
            {def.items.length > 4 && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>+{def.items.length - 4} more</div>
            )}
            {def.items.length === 0 && (
              <div style={{ fontSize: 12, color: '#16a34a' }}>✓ No issues</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const totalUrgent = actionItems.filter(a => a.type !== 'ok').length;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Welcome banner */}
      <div style={{ background: 'var(--accent)', border: 'none', borderRadius: 14, padding: '14px 16px', color: 'white', boxShadow: 'var(--shadow)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 2 }}>
          {greet()}{user.email ? `, ${user.email.split('@')[0]}` : ''} 👋
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        {totalUrgent > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.2)', borderRadius: 20, display: 'inline-block', padding: '3px 10px' }}>
            🔔 {totalUrgent} item{totalUrgent > 1 ? 's' : ''} need{totalUrgent === 1 ? 's' : ''} attention
          </div>
        )}
      </div>

      {/* Card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
        {cardDefs.map(def => <SummaryCard key={def.key} def={def} />)}
      </div>

      {/* Detail panel */}
      {activeCard && (
        <div ref={detailRef} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', boxShadow: 'var(--shadow)' }}>

          {/* Panel header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
              🔔 Notifications
            </div>
            <button onClick={() => setActiveCard(null)}
              style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-faint)', padding: '2px 6px', lineHeight: 1 }}>
              ✕
            </button>
          </div>

          {/* Category filter tabs */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 12, WebkitOverflowScrolling: 'touch' }}>
            {activeCats.map(catKey => {
              const meta  = catKey === 'all' ? { icon: '🔔', label: 'All' } : CAT_META[catKey];
              const count = catKey === 'all' ? actionItems.length : actionItems.filter(a => a.category === catKey).length;
              const active = filterCat === catKey;
              return (
                <button key={catKey} onClick={() => setFilterCat(catKey)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: active ? 'white' : 'var(--text-muted)' }}>
                  <span>{meta?.icon}</span>
                  <span>{meta?.label}</span>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Item list */}
          {detailItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-faint)', fontSize: 13 }}>
              ✓ Nothing to show here
            </div>
          ) : (
            detailItems.map((item, i) => {
              const typeColors = { danger: '#dc2626', warn: '#b45309', ok: '#16a34a' };
              const typeBgs    = { danger: '#fee2e2', warn: '#fef3c7', ok: '#f0fdf4' };
              const catMeta    = CAT_META[item.category];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  background: typeBgs[item.type] || '#f8fafc',
                  borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                  borderLeft: `3px solid ${typeColors[item.type] || '#94a3b8'}` }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{item.text}</div>
                    <div style={{ fontSize: 11, color: typeColors[item.type] || '#94a3b8', marginTop: 2 }}>
                      {catMeta?.icon} {catMeta?.label}
                    </div>
                    {item.date && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button onClick={() => { sessionStorage.setItem('purchaseDateHint', item.date); onNavigate?.(...item.navTarget); }}
                          style={{ padding: '4px 10px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Add Purchases
                        </button>
                        <button onClick={() => skipReminder(item.date)}
                          style={{ padding: '4px 10px', background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>
                          Skip
                        </button>
                      </div>
                    )}
                  </div>
                  {!item.date && item.navTarget && (
                    <button onClick={() => onNavigate?.(...item.navTarget)}
                      style={{ flexShrink: 0, padding: '6px 12px', background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      Go →
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}
