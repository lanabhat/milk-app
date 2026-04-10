import React, { useEffect, useState, useCallback } from 'react';
import { API, getAuthHeaders } from '../utils/api';
import { fmt, fmtShort } from '../utils/date';
import { styles as s } from '../styles/dashboard';
import Toast from './common/Toast';
import TabBar from './common/TabBar';
import PurchaseTab from './tabs/PurchaseTab';
import PaymentsTab from './tabs/PaymentsTab';
import HistoryTab from './tabs/HistoryTab';
import BillTab from './tabs/BillTab';
import TrendsTab from './tabs/TrendsTab';
import LpgTab from './tabs/LpgTab';
import LpgUsageTab from './tabs/LpgUsageTab';

const MILK_TABS = [['purchase', 'Purchase'], ['payments', 'Payments'], ['history', 'History'], ['bill', 'Bill'], ['trends', 'Trends']];
const LPG_TABS  = [['lpg', 'LPG Overview'], ['lpg-usage', 'Usage']];

export default function Dashboard() {
  const [items,     setItems]     = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [advances,  setAdvances]  = useState([]);
  const [balance,   setBalance]   = useState(null);
  const [section,   setSection]   = useState('milk');
  const [tab,       setTab]       = useState('purchase');
  const [toast,     setToast]     = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUnauthorized = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const fetchData = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const [ir, pr, ar, br] = await Promise.all([
        fetch(`${API}/api/items/`,            { headers }),
        fetch(`${API}/api/purchases/`,        { headers }),
        fetch(`${API}/api/advances/`,         { headers }),
        fetch(`${API}/api/advances/balance/`, { headers }),
      ]);
      if (ir.status === 401) { handleUnauthorized(); return; }
      const itemData = ir.ok ? await ir.json() : [];
      const pData    = pr.ok ? await pr.json() : [];
      const aData    = ar.ok ? await ar.json() : [];
      // Sort items by purchase frequency
      const counts = {};
      pData.forEach(p => { counts[p.item] = (counts[p.item] || 0) + 1; });
      itemData.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
      setItems(itemData);
      setPurchases(pData);
      setAdvances(aData);
      if (br.ok) setBalance(await br.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('token')) { window.location.href = '/'; return; }
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    const headers = getAuthHeaders();
    if (headers) try { await fetch(`${API}/api/auth/logout/`, { method: 'POST', headers }); } catch { }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const activeTabs = section === 'milk' ? MILK_TABS : LPG_TABS;

  const handleSectionChange = (newSection) => {
    setSection(newSection);
    setTab(newSection === 'lpg' ? 'lpg' : 'purchase');
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.logo}>Milk & Paper</span>
        <span style={s.userEmail}>{user.email || ''}</span>
        <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>
      </div>

      {/* Balance bar */}
      {balance && (
        <div style={s.balBar}>
          <div style={{ ...s.balCard, backgroundColor: 'white' }}>
            <div style={s.balLabel}>Current Advance</div>
            <div style={{ ...s.balVal, color: '#16a34a' }}>Rs {fmt(balance.current_advance_amount)}</div>
            {balance.current_advance_date && (
              <div style={{ fontSize: 9, color: '#94a3b8' }}>since {fmtShort(balance.current_advance_date)}</div>
            )}
          </div>
          <div style={{ ...s.balCard, backgroundColor: 'white' }}>
            <div style={s.balLabel}>Spent This Cycle</div>
            <div style={{ ...s.balVal, color: '#dc2626' }}>Rs {fmt(balance.current_purchases)}</div>
          </div>
          <div style={{
            ...s.balCard,
            backgroundColor: balance.current_balance < 0 ? '#fef2f2' : 'white',
            borderColor:     balance.current_balance < 0 ? '#fca5a5' : '#e2e8f0',
          }}>
            <div style={s.balLabel}>Cycle Balance</div>
            <div style={{ ...s.balVal, color: balance.current_balance >= 0 ? '#2563eb' : '#dc2626' }}>
              Rs {fmt(Math.abs(balance.current_balance))}
              {balance.current_balance < 0 ? ' owed' : ' left'}
            </div>
          </div>
          {balance.current_balance <= 100 && (
            <div style={s.balWarn}>
              {balance.current_balance < 0
                ? `Rs ${fmt(Math.abs(balance.current_balance))} over advance - pay vendor`
                : 'Balance low - make a payment soon'}
            </div>
          )}
        </div>
      )}

      <Toast toast={toast} />

      {/* Section switcher */}
      <div style={s.sectionBar}>
        <button
          onClick={() => handleSectionChange('milk')}
          style={{ ...s.sectionTab, ...(section === 'milk' ? s.sectionTabActive : {}) }}>
          Milk Management
        </button>
        <button
          onClick={() => handleSectionChange('lpg')}
          style={{ ...s.sectionTab, ...(section === 'lpg' ? s.sectionTabActive : {}) }}>
          LPG Cylinders
        </button>
      </div>

      <TabBar tabs={activeTabs} activeTab={tab} onTabChange={setTab} />

      <div style={s.body}>
        {tab === 'purchase' && (
          <PurchaseTab
            items={items}
            advances={advances}
            showToast={showToast}
            onSaved={fetchData}
          />
        )}
        {tab === 'payments' && (
          <PaymentsTab
            advances={advances}
            balance={balance}
            purchases={purchases}
            showToast={showToast}
            onSaved={fetchData}
          />
        )}
        {tab === 'history' && (
          <HistoryTab
            advances={advances}
            purchases={purchases}
            showToast={showToast}
            onRefresh={fetchData}
          />
        )}
        {tab === 'bill' && (
          <BillTab
            advances={advances}
            showToast={showToast}
          />
        )}
        {tab === 'trends' && (
          <TrendsTab
            purchases={purchases}
            items={items}
          />
        )}
        {tab === 'lpg' && (
          <LpgTab showToast={showToast} />
        )}
        {tab === 'lpg-usage' && (
          <LpgUsageTab showToast={showToast} />
        )}
      </div>
    </div>
  );
}
