import React, { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../../utils/api';
import { fmt, fmtD, todayStr } from '../../utils/date';
import { styles as s } from '../../styles/dashboard';
import Modal from '../common/Modal';

const STATUS_COLOR = { outstanding: '#dc2626', partial: '#f59e0b', settled: '#16a34a' };
const STATUS_BG    = { outstanding: '#fee2e2', partial: '#fef3c7', settled: '#dcfce7' };
const STATUS_LABEL = { outstanding: 'OUTSTANDING', partial: 'PARTIAL PAID', settled: 'SETTLED' };

const EMPTY_FORM = { contact: '', contact_name: '', date: todayStr(), description: '', amount: '', notes: '' };

export default function HomeLendingTab({ family, showToast, onSaved }) {
  const [view, setView]           = useState('active');
  const [lendings, setLendings]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const [expandId, setExpandId]   = useState(null);
  const [paybackForms, setPaybackForms]   = useState({});
  const [showPayback, setShowPayback]     = useState({});
  const [paybackSaving, setPaybackSaving] = useState({});
  const [filterContact, setFilterContact] = useState('');

  // Report state
  const [showReport, setShowReport]           = useState(false);
  const [reportContacts, setReportContacts]   = useState([]);
  const [reportStatus, setReportStatus]       = useState('all');

  // Bulk settle state
  const [selectedIds, setSelectedIds]         = useState(new Set());
  const [bulkModalOpen, setBulkModalOpen]     = useState(false);
  const [bulkForm, setBulkForm]               = useState({ date: todayStr(), amount: '', notes: '' });
  const [bulkSaving, setBulkSaving]           = useState(false);

  const activeFamily = family.filter(m => m.is_active);

  const fetchLendings = useCallback(async () => {
    setLoading(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const r = await fetch(`${API}/api/lendings/`, { headers });
      if (r.ok) setLendings(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLendings(); }, [fetchLendings]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd  = () => { setEditId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (l) => {
    setEditId(l.id);
    setForm({ contact: l.contact ? String(l.contact) : '', contact_name: l.contact_name || '', date: l.date, description: l.description, amount: String(l.amount), notes: l.notes || '' });
    setModalOpen(true); setExpandId(null);
  };

  const resetForm = () => { setEditId(null); setForm(EMPTY_FORM); setModalOpen(false); };

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount) { showToast('Description and amount required', 'error'); return; }
    if (!form.contact && !form.contact_name.trim()) { showToast('Select a contact or enter a name', 'error'); return; }
    setSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    const payload = { ...form, amount: parseFloat(form.amount), contact: form.contact ? parseInt(form.contact) : null, contact_name: form.contact ? '' : form.contact_name };
    try {
      const url    = editId ? `${API}/api/lendings/${editId}/` : `${API}/api/lendings/`;
      const method = editId ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      showToast(editId ? '✓ Updated' : '✓ Lending recorded');
      resetForm(); fetchLendings();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/lendings/${id}/`, { method: 'DELETE', headers });
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    fetchLendings();
  };

  const handleRecordPayback = async (lendingId, outstanding) => {
    const pf = paybackForms[lendingId] || {};
    const amount = parseFloat(pf.amount);
    if (!amount || amount <= 0) { showToast('Enter a valid payback amount', 'error'); return; }
    if (amount > outstanding + 0.01) { showToast(`Amount cannot exceed outstanding ₹${fmt(outstanding)}`, 'error'); return; }
    setPaybackSaving(prev => ({ ...prev, [lendingId]: true }));
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API}/api/paybacks/`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ lending: lendingId, date: pf.date || todayStr(), amount, notes: pf.notes || '' }) });
      if (!res.ok) throw new Error();
      showToast('✓ Payback recorded');
      setPaybackForms(prev => ({ ...prev, [lendingId]: { date: todayStr(), amount: '', notes: '' } }));
      setShowPayback(prev => ({ ...prev, [lendingId]: false }));
      fetchLendings();
    } catch { showToast('Failed to record payback', 'error'); }
    finally { setPaybackSaving(prev => ({ ...prev, [lendingId]: false })); }
  };

  const handleDeletePayback = async (paybackId) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    await fetch(`${API}/api/paybacks/${paybackId}/`, { method: 'DELETE', headers });
    fetchLendings();
  };

  // Derived data
  const filtered   = lendings.filter(l => !filterContact || (l.contact ? `id:${l.contact}` : `name:${l.contact_name}`) === filterContact);
  const active     = filtered.filter(l => l.status !== 'settled');
  const history    = filtered.filter(l => l.status === 'settled');
  const displayed  = view === 'active' ? active : history;

  const totalLent        = active.reduce((t, l) => t + l.amount, 0);
  const totalOutstanding = active.reduce((t, l) => t + (l.outstanding || 0), 0);
  const totalPaidBack    = active.reduce((t, l) => t + (l.total_paid || 0), 0);

  const contactSummary = filterContact ? {
    totalLent: filtered.reduce((t, l) => t + l.amount, 0),
    totalPaid: filtered.reduce((t, l) => t + (l.total_paid || 0), 0),
    outstanding: filtered.filter(l => l.status !== 'settled').reduce((t, l) => t + (l.outstanding || 0), 0),
  } : null;

  // Bulk Settlement
  const toggleSelect = (id) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const selectedLendings = active.filter(l => selectedIds.has(l.id)).sort((a, b) => a.date.localeCompare(b.date));
  const totalSelectedOutstanding = selectedLendings.reduce((t, l) => t + (l.outstanding || 0), 0);

  const bulkDistribution = (() => {
    const amount = parseFloat(bulkForm.amount) || 0;
    let remaining = Math.min(amount, totalSelectedOutstanding);
    return selectedLendings.map(l => {
      const pay = Math.min(remaining, l.outstanding || 0);
      remaining -= pay;
      const willSettle = Math.abs(pay - (l.outstanding || 0)) < 0.01;
      return { ...l, pay: Math.round(pay * 100) / 100, willSettle };
    });
  })();

  const handleBulkSettle = async () => {
    if (!bulkForm.amount || parseFloat(bulkForm.amount) <= 0) { showToast('Enter payment amount', 'error'); return; }
    setBulkSaving(true);
    const headers = getAuthHeaders();
    if (!headers) return;
    let applied = 0;
    try {
      for (const item of bulkDistribution) {
        if (item.pay <= 0) continue;
        const res = await fetch(`${API}/api/paybacks/`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ lending: item.id, date: bulkForm.date || todayStr(), amount: item.pay, notes: bulkForm.notes || '' }) });
        if (!res.ok) throw new Error(`Failed for lending #${item.id}`);
        applied++;
      }
      showToast(`✓ Settlement applied across ${applied} entr${applied === 1 ? 'y' : 'ies'}`);
      setSelectedIds(new Set());
      setBulkModalOpen(false);
      setBulkForm({ date: todayStr(), amount: '', notes: '' });
      fetchLendings();
    } catch (err) { showToast(err.message || 'Partial failure — please check', 'error'); fetchLendings(); }
    finally { setBulkSaving(false); }
  };

  // Report Generation
  const uniqueContacts = [...new Map(
    lendings.map(l => [l.contact ? `id:${l.contact}` : `name:${l.contact_name}`, { key: l.contact ? `id:${l.contact}` : `name:${l.contact_name}`, name: l.contact_display, avatar: l.contact_avatar }])
  ).values()];

  const openReport = () => {
    setReportContacts(uniqueContacts.map(c => c.key));
    setReportStatus('all');
    setShowReport(true);
  };

  const toggleReportContact = (key) => setReportContacts(prev =>
    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
  );

  const handleGenerateReport = () => {
    const fmtAmt  = (v) => '₹' + parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    const reportData = lendings.filter(l => {
      const key = l.contact ? `id:${l.contact}` : `name:${l.contact_name}`;
      if (!reportContacts.includes(key)) return false;
      if (reportStatus !== 'all' && l.status !== reportStatus) return false;
      return true;
    });

    if (reportData.length === 0) { showToast('No entries match the selected filters', 'error'); return; }

    const contactMap = {};
    reportData.forEach(l => {
      const key = l.contact_display;
      if (!contactMap[key]) contactMap[key] = { name: key, avatar: l.contact_avatar, lent: 0, paid: 0, outstanding: 0, entries: [] };
      contactMap[key].lent        += l.amount;
      contactMap[key].paid        += l.total_paid || 0;
      contactMap[key].outstanding += l.outstanding || 0;
      contactMap[key].entries.push(l);
    });

    const grandLent        = reportData.reduce((t, l) => t + l.amount, 0);
    const grandPaid        = reportData.reduce((t, l) => t + (l.total_paid || 0), 0);
    const grandOutstanding = reportData.reduce((t, l) => t + (l.outstanding || 0), 0);

    const summaryRows = Object.values(contactMap).map(c =>
      `<tr><td>${c.avatar || '👤'} ${c.name}</td><td style="text-align:right">${fmtAmt(c.lent)}</td><td style="text-align:right;color:#16a34a">${fmtAmt(c.paid)}</td><td style="text-align:right;color:${c.outstanding > 0 ? '#dc2626' : '#16a34a'};font-weight:700">${fmtAmt(c.outstanding)}</td></tr>`
    ).join('');

    const detailSections = Object.values(contactMap).map(c => {
      const entryRows = c.entries.map(l => {
        const statusStyle = `color:${STATUS_COLOR[l.status]};background:${STATUS_BG[l.status]};padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700`;
        const paybackList = l.paybacks?.length > 0
          ? `<div style="margin-top:4px;padding-left:16px">${l.paybacks.map(pb => `<div style="font-size:11px;color:#16a34a">↳ ${fmtDate(pb.date)} +${fmtAmt(pb.amount)}${pb.notes ? ` (${pb.notes})` : ''}</div>`).join('')}</div>` : '';
        return `<tr>
          <td style="padding:6px 12px">${fmtDate(l.date)}</td>
          <td style="padding:6px 12px">${l.description}${l.notes ? `<div style="font-size:10px;color:#94a3b8">${l.notes}</div>` : ''}${paybackList}</td>
          <td style="padding:6px 12px;text-align:right">${fmtAmt(l.amount)}</td>
          <td style="padding:6px 12px;text-align:right;color:#16a34a">${fmtAmt(l.total_paid)}</td>
          <td style="padding:6px 12px;text-align:right;font-weight:700;color:${STATUS_COLOR[l.status]}">${fmtAmt(l.outstanding)}</td>
          <td style="padding:6px 12px"><span style="${statusStyle}">${STATUS_LABEL[l.status]}</span></td>
        </tr>`;
      }).join('');
      return `<div style="margin-bottom:24px">
        <div style="font-size:15px;font-weight:800;margin-bottom:8px;padding:8px 12px;background:#f8fafc;border-left:4px solid #1d4ed8;border-radius:4px">${c.avatar || '👤'} ${c.name} — Outstanding: ${fmtAmt(c.outstanding)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#f8fafc"><th style="text-align:left;padding:7px 12px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Date</th><th style="text-align:left;padding:7px 12px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Description</th><th style="text-align:right;padding:7px 12px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Lent</th><th style="text-align:right;padding:7px 12px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Paid Back</th><th style="text-align:right;padding:7px 12px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Outstanding</th><th style="text-align:left;padding:7px 12px;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0">Status</th></tr></thead>
          <tbody>${entryRows}</tbody>
        </table>
      </div>`;
    }).join('');

    const statusLabel  = reportStatus === 'all' ? 'All entries' : STATUS_LABEL[reportStatus] || reportStatus;
    const contactLabel = reportContacts.length === uniqueContacts.length ? 'All contacts' : reportContacts.map(k => uniqueContacts.find(c => c.key === k)?.name || k).join(', ');

    const html = `<!DOCTYPE html><html><head><title>Lending & IOU Statement</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#1e293b;background:white;padding:36px}
  h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .sub{font-size:13px;color:#64748b;margin-bottom:6px}
  .tag{display:inline-block;font-size:11px;background:#eff6ff;color:#1d4ed8;border-radius:4px;padding:2px 8px;margin:2px 2px 10px}
  .section-title{font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin:22px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:5px}
  .totals{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px}
  .total-box{padding:14px;border:1px solid #e2e8f0;border-radius:8px}
  .total-label{font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase}
  .total-value{font-size:22px;font-weight:800;margin-top:4px}
  table.summary{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}
  table.summary th{text-align:left;padding:8px 12px;background:#f8fafc;font-size:11px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0}
  table.summary td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
  table.summary tr:last-child td{border-bottom:none}
  .footer{margin-top:40px;font-size:10px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px}@page{margin:15mm}}
</style></head><body>
  <h1>Lending & IOU Statement</h1>
  <div class="sub">Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  <span class="tag">Contacts: ${contactLabel}</span>
  <span class="tag">Status: ${statusLabel}</span>

  <div class="totals">
    <div class="total-box"><div class="total-label">Total Lent</div><div class="total-value" style="color:#1d4ed8">${fmtAmt(grandLent)}</div></div>
    <div class="total-box"><div class="total-label">Received Back</div><div class="total-value" style="color:#16a34a">${fmtAmt(grandPaid)}</div></div>
    <div class="total-box"><div class="total-label">Outstanding</div><div class="total-value" style="color:#dc2626">${fmtAmt(grandOutstanding)}</div></div>
  </div>

  <div class="section-title">Summary by Contact</div>
  <table class="summary">
    <thead><tr><th>Contact</th><th style="text-align:right">Total Lent</th><th style="text-align:right">Paid Back</th><th style="text-align:right">Outstanding</th></tr></thead>
    <tbody>${summaryRows}</tbody>
    <tfoot><tr style="background:#f8fafc;font-weight:800">
      <td style="padding:8px 12px">Grand Total</td>
      <td style="padding:8px 12px;text-align:right">${fmtAmt(grandLent)}</td>
      <td style="padding:8px 12px;text-align:right;color:#16a34a">${fmtAmt(grandPaid)}</td>
      <td style="padding:8px 12px;text-align:right;color:#dc2626">${fmtAmt(grandOutstanding)}</td>
    </tr></tfoot>
  </table>

  <div class="section-title">Detail by Contact</div>
  ${detailSections}

  <div class="footer">myManeAI · Lending & IOU Statement · ${new Date().toLocaleString('en-IN')}</div>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
    setShowReport(false);
  };

  const setPF = (lendingId, k, v) => setPaybackForms(prev => ({ ...prev, [lendingId]: { ...(prev[lendingId] || {}), [k]: v } }));

  return (
    <div style={s.section}>
      {/* Top toolbar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setView('active')} style={{ ...s.sessionPill, ...(view === 'active' ? s.sessionPillActive : {}) }}>
          💸 Active ({active.length})
        </button>
        <button onClick={() => setView('history')} style={{ ...s.sessionPill, ...(view === 'history' ? s.sessionPillActive : {}) }}>
          ✓ Settled ({history.length})
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lendings.length > 0 && (
            <button onClick={openReport} style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: '#7e22ce' }}>
              📄 Report
            </button>
          )}
          <button onClick={openAdd} style={s.addBtn}>
            + Record Lending
          </button>
        </div>
      </div>

      {/* Report filter panel (stays inline) */}
      {showReport && (
        <div style={{ ...s.card, marginBottom: 14, borderLeft: '4px solid #7e22ce' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#7e22ce' }}>📄 Generate Lending Report</div>
          <div style={{ marginBottom: 10 }}>
            <label style={s.fieldLabel}>Contacts to include</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={reportContacts.length === uniqueContacts.length}
                  onChange={e => setReportContacts(e.target.checked ? uniqueContacts.map(c => c.key) : [])} />
                <strong>All</strong>
              </label>
              {uniqueContacts.map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', padding: '3px 8px', background: reportContacts.includes(c.key) ? '#eff6ff' : '#f8fafc', borderRadius: 6, border: `1px solid ${reportContacts.includes(c.key) ? '#bfdbfe' : '#e2e8f0'}` }}>
                  <input type="checkbox" checked={reportContacts.includes(c.key)} onChange={() => toggleReportContact(c.key)} style={{ marginRight: 2 }} />
                  {c.avatar || '👤'} {c.name}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={s.fieldLabel}>Status filter</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              {[['all','All entries'],['outstanding','Outstanding only'],['partial','Partial paid'],['settled','Settled only']].map(([v, l]) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                  <input type="radio" name="reportStatus" value={v} checked={reportStatus === v} onChange={() => setReportStatus(v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleGenerateReport} disabled={reportContacts.length === 0}
              style={{ ...s.primaryBtn, padding: '7px 16px', backgroundColor: '#7e22ce', opacity: reportContacts.length === 0 ? 0.5 : 1 }}>
              📄 Generate PDF
            </button>
            <button onClick={() => setShowReport(false)} style={{ ...s.primaryBtn, padding: '7px 16px', backgroundColor: '#64748b' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {view === 'active' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Total Lent',        value: '₹' + fmt(totalLent),        color: '#1d4ed8' },
            { label: 'Total Outstanding', value: '₹' + fmt(totalOutstanding), color: '#dc2626' },
            { label: 'Received Back',     value: '₹' + fmt(totalPaidBack),    color: '#16a34a' },
            { label: 'Active Entries',    value: active.length,                color: '#64748b' },
          ].map(c => (
            <div key={c.label} style={{ ...s.card, textAlign: 'center', padding: '10px 6px' }}>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Contact filter pills */}
      {uniqueContacts.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={() => setFilterContact('')} style={{ ...s.sessionPill, ...(!filterContact ? s.sessionPillActive : {}) }}>All</button>
          {uniqueContacts.map(c => (
            <button key={c.key} onClick={() => setFilterContact(filterContact === c.key ? '' : c.key)}
              style={{ ...s.sessionPill, ...(filterContact === c.key ? s.sessionPillActive : {}) }}>
              {c.avatar || '👤'} {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Per-contact summary */}
      {contactSummary && (
        <div style={{ ...s.card, marginBottom: 14, background: '#f0f9ff', borderLeft: '4px solid #0369a1' }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div><div style={{ fontSize: 10, color: '#0369a1', fontWeight: 700 }}>TOTAL LENT</div><div style={{ fontSize: 16, fontWeight: 800, color: '#1d4ed8' }}>₹{fmt(contactSummary.totalLent)}</div></div>
            <div><div style={{ fontSize: 10, color: '#0369a1', fontWeight: 700 }}>PAID BACK</div><div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>₹{fmt(contactSummary.totalPaid)}</div></div>
            <div><div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>OUTSTANDING</div><div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>₹{fmt(contactSummary.outstanding)}</div></div>
          </div>
        </div>
      )}

      {/* Bulk settle toolbar */}
      {selectedIds.size > 0 && view === 'active' && (
        <div style={{ ...s.card, marginBottom: 14, background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>{selectedIds.size} entr{selectedIds.size === 1 ? 'y' : 'ies'} selected</span>
            <span style={{ fontSize: 12, color: '#92400e', marginLeft: 8 }}>— Total outstanding: <strong>₹{fmt(totalSelectedOutstanding)}</strong></span>
          </div>
          <button onClick={() => setBulkModalOpen(true)} style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: '#16a34a' }}>
            📥 Bulk Settle
          </button>
          <button onClick={() => { setSelectedIds(new Set()); setBulkModalOpen(false); }} style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: '#64748b' }}>
            ✕ Clear
          </button>
        </div>
      )}

      {loading && <p style={s.empty}>Loading…</p>}
      {!loading && displayed.length === 0 && (
        <div style={{ ...s.card, textAlign: 'center', padding: '28px 16px', color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{view === 'active' ? '🤝' : '✅'}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{view === 'active' ? 'No outstanding lendings' : 'No settled lendings'}</div>
          {view === 'active' && <div style={{ fontSize: 12, marginTop: 4 }}>Record when you pay for someone who will pay back later</div>}
        </div>
      )}

      {/* Lending cards */}
      {displayed.map(lending => {
        const expanded    = expandId === lending.id;
        const status      = lending.status;
        const outstanding = lending.outstanding || 0;
        const pf          = paybackForms[lending.id] || { date: todayStr(), amount: String(Math.round(outstanding * 100) / 100), notes: '' };
        const isSelected  = selectedIds.has(lending.id);

        return (
          <div key={lending.id} style={{ ...s.card, marginBottom: 10, borderLeft: `4px solid ${STATUS_COLOR[status]}`, outline: isSelected ? '2px solid #16a34a' : 'none', outlineOffset: 2 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              {view === 'active' && (
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(lending.id)}
                  style={{ width: 18, height: 18, marginTop: 4, flexShrink: 0, cursor: 'pointer' }} />
              )}
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${STATUS_COLOR[status]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, cursor: 'pointer' }}
                onClick={() => setExpandId(expanded ? null : lending.id)}>
                {lending.contact_avatar || '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpandId(expanded ? null : lending.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{lending.contact_display}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lending.description}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{fmtD(lending.date)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>₹{fmt(lending.amount)}</div>
                    {outstanding > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>₹{fmt(outstanding)} left</div>}
                    {lending.total_paid > 0 && <div style={{ fontSize: 11, color: '#16a34a' }}>₹{fmt(lending.total_paid)} back</div>}
                  </div>
                </div>
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: STATUS_COLOR[status], background: STATUS_BG[status], borderRadius: 4, padding: '2px 7px' }}>
                    {STATUS_LABEL[status]}
                  </span>
                </div>
              </div>
              <span style={{ color: '#94a3b8', flexShrink: 0, cursor: 'pointer' }} onClick={() => setExpandId(expanded ? null : lending.id)}>
                {expanded ? '▲' : '▼'}
              </span>
            </div>

            {/* Expanded detail with inline payback forms */}
            {expanded && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                {lending.notes && <p style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>{lending.notes}</p>}

                {lending.paybacks?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Paybacks</div>
                    {lending.paybacks.map(pb => (
                      <div key={pb.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', borderRadius: 6, padding: '5px 10px', marginBottom: 4, fontSize: 12 }}>
                        <span>{fmtD(pb.date)}{pb.notes && ` · ${pb.notes}`}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#16a34a' }}>+₹{fmt(pb.amount)}</span>
                          <button onClick={() => handleDeletePayback(pb.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {status !== 'settled' && (
                  <div style={{ marginBottom: 10 }}>
                    {!showPayback[lending.id] ? (
                      <button onClick={() => setShowPayback(prev => ({ ...prev, [lending.id]: true }))}
                        style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: '#16a34a' }}>
                        + Record Payback
                      </button>
                    ) : (
                      <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>Record Payback (outstanding: ₹{fmt(outstanding)})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={s.fieldLabel}>Date<input style={s.input} type="date" value={pf.date || todayStr()} onChange={e => setPF(lending.id, 'date', e.target.value)} /></label>
                          <label style={s.fieldLabel}>Amount (₹)<input style={s.input} type="number" step="0.01" value={pf.amount || ''} onChange={e => setPF(lending.id, 'amount', e.target.value)} placeholder={String(Math.round(outstanding * 100) / 100)} /></label>
                          <label style={s.fieldLabel}>Notes<input style={s.input} value={pf.notes || ''} onChange={e => setPF(lending.id, 'notes', e.target.value)} placeholder="Cash, UPI, partial…" /></label>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={() => handleRecordPayback(lending.id, outstanding)} disabled={paybackSaving[lending.id]}
                            style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: '#16a34a' }}>
                            {paybackSaving[lending.id] ? 'Saving…' : '✓ Save Payback'}
                          </button>
                          <button onClick={() => setShowPayback(prev => ({ ...prev, [lending.id]: false }))}
                            style={{ ...s.primaryBtn, fontSize: 12, padding: '6px 12px', backgroundColor: '#64748b' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(lending)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px' }}>✏️ Edit</button>
                  <button onClick={() => handleDelete(lending.id)} style={{ ...s.primaryBtn, fontSize: 11, padding: '5px 10px', backgroundColor: '#ef4444' }}>🗑 Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add / Edit Lending Modal */}
      <Modal open={modalOpen} onClose={resetForm} title={editId ? 'Edit Lending' : 'Record New Lending'}
        onSave={handleSave} saveLabel={saving ? 'Saving…' : editId ? '✓ Update' : '✓ Record Lending'} saving={saving}>
        <div className="form-grid">
          <label>Contact (from family list)
            <select style={s.input} value={form.contact} onChange={e => { setF('contact', e.target.value); if (e.target.value) setF('contact_name', ''); }}>
              <option value="">— type name below instead —</option>
              {activeFamily.map(m => <option key={m.id} value={String(m.id)}>{m.avatar || '👤'} {m.name}</option>)}
            </select>
          </label>
          <label>Or enter name directly
            <input style={s.input} value={form.contact_name} onChange={e => { setF('contact_name', e.target.value); if (e.target.value) setF('contact', ''); }} placeholder="Uncle Ram, Friend Suresh…" disabled={!!form.contact} />
          </label>
          <label>Date
            <input style={s.input} type="date" value={form.date} onChange={e => setF('date', e.target.value)} />
          </label>
          <label>Amount (₹) *
            <input style={s.input} type="number" step="0.01" value={form.amount} onChange={e => setF('amount', e.target.value)} />
          </label>
          <label>Description *
            <input style={s.input} value={form.description} onChange={e => setF('description', e.target.value)} placeholder="What was paid for them? Petrol, groceries, hospital…" />
          </label>
          <label>Notes
            <input style={s.input} value={form.notes} onChange={e => setF('notes', e.target.value)} />
          </label>
        </div>
      </Modal>

      {/* Bulk Settle Modal */}
      <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)}
        title={`📥 Bulk Settle — ${selectedIds.size} entries · ₹${fmt(totalSelectedOutstanding)} outstanding`}
        onSave={handleBulkSettle}
        saveLabel={bulkSaving ? 'Applying…' : '✓ Apply Settlement'}
        saving={bulkSaving}>
        <div className="form-grid">
          <label>Payment Amount (₹)
            <input style={s.input} type="number" step="0.01" value={bulkForm.amount}
              onChange={e => setBulkForm(f => ({ ...f, amount: e.target.value }))}
              placeholder={String(Math.round(totalSelectedOutstanding * 100) / 100)} />
          </label>
          <label>Payment Date
            <input style={s.input} type="date" value={bulkForm.date} onChange={e => setBulkForm(f => ({ ...f, date: e.target.value }))} />
          </label>
          <label>Notes (applies to all)
            <input style={s.input} value={bulkForm.notes} onChange={e => setBulkForm(f => ({ ...f, notes: e.target.value }))} placeholder="Cash payment, UPI transfer…" />
          </label>

          {bulkForm.amount && parseFloat(bulkForm.amount) > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Distribution preview (oldest first)</div>
              {bulkDistribution.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', background: item.pay > 0 ? '#f0fdf4' : '#f8fafc', borderRadius: 6, marginBottom: 3, fontSize: 12 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {item.contact_display} · {item.description} <span style={{ color: '#94a3b8' }}>({fmtD(item.date)})</span>
                  </span>
                  <span style={{ flexShrink: 0, marginLeft: 8 }}>
                    {item.pay > 0 ? (
                      <span style={{ fontWeight: 700, color: '#16a34a' }}>+₹{fmt(item.pay)} {item.willSettle ? '✓ SETTLES' : `(₹${fmt((item.outstanding || 0) - item.pay)} left)`}</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>— no funds left</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
