import React, { useEffect, useState, useCallback } from 'react';
import { API, getAuthHeaders } from '../utils/api';
import { styles as s } from '../styles/dashboard';
import { THEMES, applyTheme, loadSavedTheme } from '../styles/themes';
import Toast from './common/Toast';
import TabBar from './common/TabBar';
import HomeTab from './tabs/HomeTab';
import PurchaseTab from './tabs/PurchaseTab';
import PaymentsTab from './tabs/PaymentsTab';
import HistoryTab from './tabs/HistoryTab';
import BillTab from './tabs/BillTab';
import TrendsTab from './tabs/TrendsTab';
import LpgTab from './tabs/LpgTab';
import LpgUsageTab from './tabs/LpgUsageTab';
import MedicineTab from './tabs/MedicineTab';
import PatientsTab from './tabs/PatientsTab';
import GiveMedicineTab from './tabs/GiveMedicineTab';
import MedicineDiaryTab from './tabs/MedicineDiaryTab';
import MedicinePurchaseTab from './tabs/MedicinePurchaseTab';
import ConsultingTab from './tabs/ConsultingTab';
import VitalsTab from './tabs/VitalsTab';
import HealthExpensesTab from './tabs/HealthExpensesTab';
import CatalogTab from './tabs/CatalogTab';
import VehicleListTab from './tabs/VehicleListTab';
import VehicleFuelTab from './tabs/VehicleFuelTab';
import VehicleServiceTab from './tabs/VehicleServiceTab';
import VehicleDocsTab from './tabs/VehicleDocsTab';
import VehicleTripsTab from './tabs/VehicleTripsTab';
import VehicleMaintTab from './tabs/VehicleMaintTab';
import JournalFamilyTab from './tabs/JournalFamilyTab';
import JournalTodoTab from './tabs/JournalTodoTab';
import JournalDiaryTab from './tabs/JournalDiaryTab';
import HomeAppliancesTab from './tabs/HomeAppliancesTab';
import HomeServiceTab from './tabs/HomeServiceTab';
import HomeElectricityTab from './tabs/HomeElectricityTab';
import HomeSpendsTab from './tabs/HomeSpendsTab';
import HomeEducationTab from './tabs/HomeEducationTab';

const NAV = [
  {
    id: 'home',
    label: 'Home',
    icon: '🏠',
    tabs: [],
  },
  {
    id: 'milk',
    label: 'Milk & Paper',
    icon: '🥛',
    tabs: [
      { id: 'purchase',  label: 'Purchase',  icon: '🛒' },
      { id: 'payments',  label: 'Payments',  icon: '💳' },
      { id: 'history',   label: 'History',   icon: '📋' },
      { id: 'bill',      label: 'Bill',      icon: '🧾' },
      { id: 'trends',    label: 'Trends',    icon: '📈' },
      { id: 'catalog',   label: 'Catalog',   icon: '⚙️' },
    ],
  },
  {
    id: 'lpg',
    label: 'LPG',
    icon: '🔵',
    tabs: [
      { id: 'lpg',       label: 'LPG',       icon: '🔵' },
      { id: 'lpg-usage', label: 'Usage',     icon: '⚡' },
    ],
  },
  {
    id: 'medicare',
    label: 'Medicare',
    icon: '💊',
    tabs: [
      { id: 'give',         label: 'Give',      icon: '💉' },
      { id: 'medicine',     label: 'Medicines', icon: '💊' },
      { id: 'diary',        label: 'Diary',     icon: '📓' },
      { id: 'patients',     label: 'Patients',  icon: '👤' },
      { id: 'med-buy',      label: 'Purchases', icon: '🏪' },
      { id: 'consult',      label: 'Consult',   icon: '🩺' },
      { id: 'vitals',       label: 'Vitals',    icon: '❤️' },
      { id: 'med-expenses', label: 'Expenses',  icon: '📊' },
    ],
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: '📔',
    tabs: [
      { id: 'journal-todo',   label: 'Todos',  icon: '✅' },
      { id: 'journal-diary',  label: 'Diary',  icon: '📓' },
      { id: 'journal-family', label: 'Family', icon: '👨‍👩‍👧' },
    ],
  },
  {
    id: 'home-mgmt',
    label: 'Home',
    icon: '🏡',
    tabs: [
      { id: 'home-appliances', label: 'Appliances', icon: '🔌' },
      { id: 'home-service',    label: 'Service',    icon: '🔧' },
      { id: 'home-electric',   label: 'Electricity',icon: '⚡' },
      { id: 'home-spends',     label: 'Spends',     icon: '🛒' },
      { id: 'home-education',  label: 'Education',  icon: '📚' },
    ],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    icon: '🚗',
    tabs: [
      { id: 'vehicle-list',    label: 'Fleet',       icon: '🚗' },
      { id: 'vehicle-fuel',    label: 'Fuel',        icon: '⛽' },
      { id: 'vehicle-service', label: 'Service',     icon: '🔧' },
      { id: 'vehicle-docs',    label: 'Docs',        icon: '📋' },
      { id: 'vehicle-trips',   label: 'Trips',       icon: '🗺️' },
      { id: 'vehicle-maint',   label: 'Maintenance', icon: '⚙️' },
    ],
  },
];

export default function Dashboard() {
  const [items,      setItems]      = useState([]);
  const [purchases,  setPurchases]  = useState([]);
  const [advances,   setAdvances]   = useState([]);
  const [balance,    setBalance]    = useState(null);
  const [lpgStatus,  setLpgStatus]  = useState(null);
  const [medicines,  setMedicines]  = useState([]);
  const [patients,   setPatients]   = useState([]);
  const [vehicles,             setVehicles]             = useState([]);
  const [selectedVehicleId,    setSelectedVehicleId]    = useState('');
  const [appliances,           setAppliances]           = useState([]);
  const [selectedApplianceId,  setSelectedApplianceId]  = useState('');
  const [family,               setFamily]               = useState([]);
  const [tab,        setTab]        = useState('home');
  const [section,    setSection]    = useState('home');
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === 'true'
  );
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState('light');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUnauthorized = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const fetchLpgStatus = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const r = await fetch(`${API}/api/lpg/status/`, { headers });
      if (r.ok) setLpgStatus(await r.json());
    } catch { }
  }, []);

  const fetchData = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const [ir, pr, ar, br, mr, patr] = await Promise.all([
        fetch(`${API}/api/items/`,            { headers }),
        fetch(`${API}/api/purchases/`,        { headers }),
        fetch(`${API}/api/advances/`,         { headers }),
        fetch(`${API}/api/advances/balance/`, { headers }),
        fetch(`${API}/api/medicines/`,        { headers }),
        fetch(`${API}/api/patients/`,         { headers }),
      ]);
      if (ir.status === 401) { handleUnauthorized(); return; }
      const itemData = ir.ok ? await ir.json() : [];
      const pData    = pr.ok ? await pr.json() : [];
      const aData    = ar.ok ? await ar.json() : [];
      setItems(itemData);
      setPurchases(pData);
      setAdvances(aData);
      if (br.ok) setBalance(await br.json());
      if (mr.ok) setMedicines(await mr.json());
      if (patr.ok) setPatients(await patr.json());
      const fr = await fetch(`${API}/api/family-members/`, { headers });
      if (fr.ok) setFamily(await fr.json());
      const apr = await fetch(`${API}/api/home-appliances/`, { headers });
      if (apr.ok) {
        const aData = await apr.json();
        setAppliances(aData);
        setSelectedApplianceId(prev => {
          if (prev) return prev;
          const first = aData.find(a => a.is_active);
          return first ? String(first.id) : '';
        });
      }
      const vr = await fetch(`${API}/api/vehicles/`, { headers });
      if (vr.ok) {
        const vData = await vr.json();
        setVehicles(vData);
        setSelectedVehicleId(prev => {
          if (prev) return prev;
          const first = vData.find(v => v.is_active);
          return first ? String(first.id) : '';
        });
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('token')) { window.location.href = '/'; return; }
    const saved = loadSavedTheme();
    setTheme(saved);
    fetchData();
    fetchLpgStatus();
  }, [fetchData, fetchLpgStatus]);

  const handleThemeChange = (name) => {
    applyTheme(name);
    setTheme(name);
  };

  const handleLogout = async () => {
    const headers = getAuthHeaders();
    if (headers) try { await fetch(`${API}/api/auth/logout/`, { method: 'POST', headers }); } catch { }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const navigate = (tabId, sectionId) => {
    setTab(tabId);
    setSection(sectionId);
    setSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  const handleSectionClick = (sec) => {
    if (section === sec.id) { setSidebarOpen(false); return; }
    if (sec.tabs.length === 0) navigate(sec.id, sec.id);
    else navigate(sec.tabs[0].id, sec.id);
  };

  const activeSection = NAV.find(sec => sec.id === section);
  const sectionTabs = activeSection?.tabs ?? [];

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ ...s.header, position: 'sticky', top: 0, zIndex: 50 }}>
        <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
          ☰
        </button>

        {/* App title — click to go home */}
        <button
          style={{ ...s.logo, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => navigate('home', 'home')}
          aria-label="Go to Home"
        >
          myManeAI
        </button>

        <span style={s.userEmail}>{user.email || ''}</span>

        {/* Theme swatches */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
          {Object.values(THEMES).map(t => (
            <button
              key={t.name}
              title={t.label}
              onClick={() => handleThemeChange(t.name)}
              className={`theme-swatch${theme === t.name ? ' active' : ''}`}
              style={{ backgroundColor: t.swatch }}
              aria-label={`Switch to ${t.label} theme`}
            />
          ))}
        </div>

        <button onClick={handleLogout} style={{ ...s.logoutBtn, marginLeft: 8 }}>Logout</button>
      </div>

      <Toast toast={toast} />

      <div className="app-shell">
        {/* Mobile overlay */}
        <div
          className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <nav className={`sidebar${sidebarOpen ? ' open' : ''}${sidebarCollapsed ? ' collapsed' : ''}`}>
          {/* Collapse toggle — desktop only (hidden on mobile via CSS) */}
          <button
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>

          {NAV.map(sec => {
            const isActive = section === sec.id;
            return (
              <div key={sec.id} className="sidebar-section">
                <button
                  className={`sidebar-section-btn${isActive ? ' active' : ''}`}
                  onClick={() => handleSectionClick(sec)}
                  aria-label={sec.label}
                >
                  <span className="sidebar-section-icon">{sec.icon}</span>
                  <span className="sidebar-section-label">{sec.label}</span>
                </button>
              </div>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="main-content">
          {/* Horizontal tab bar — shown only for sections that have sub-tabs */}
          {sectionTabs.length > 0 && (
            <TabBar
              tabs={sectionTabs.map(t => [t.id, t.label, t.icon])}
              activeTab={tab}
              onTabChange={(tabId) => navigate(tabId, section)}
            />
          )}

          {/* Global appliance selector — shown for home service tab */}
          {section === 'home-mgmt' && tab === 'home-service' && appliances.filter(a => a.is_active).length > 0 && (
            <div style={{ padding: '8px 16px 0', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Selected appliance</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 8 }}>
                {appliances.filter(a => a.is_active).map(a => (
                  <button key={a.id} onClick={() => setSelectedApplianceId(String(a.id))}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: String(a.id) === selectedApplianceId ? 'var(--accent)' : 'var(--surface)',
                      color: String(a.id) === selectedApplianceId ? 'white' : 'var(--text-muted)',
                      boxShadow: String(a.id) === selectedApplianceId ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                    }}>
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Global vehicle selector — shown for all vehicle sub-tabs except Fleet */}
          {section === 'vehicles' && tab !== 'vehicle-list' && vehicles.filter(v => v.is_active).length > 0 && (
            <div style={{ padding: '8px 16px 0', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Active vehicle</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 8 }}>
                {vehicles.filter(v => v.is_active).map(v => (
                  <button key={v.id} onClick={() => setSelectedVehicleId(String(v.id))}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: String(v.id) === selectedVehicleId ? 'var(--accent)' : 'var(--surface)',
                      color: String(v.id) === selectedVehicleId ? 'white' : 'var(--text-muted)',
                      boxShadow: String(v.id) === selectedVehicleId ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                    }}>
                    {v.make} {v.model} · {v.registration_no}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={s.body}>
            {tab === 'home' && (
              <HomeTab
                balance={balance}
                advances={advances}
                purchases={purchases}
                lpgStatus={lpgStatus}
                medicines={medicines}
                vehicles={vehicles}
                appliances={appliances}
                onNavigate={navigate}
              />
            )}
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
            {tab === 'catalog' && (
              <CatalogTab
                items={items}
                showToast={showToast}
                onSaved={fetchData}
              />
            )}
            {tab === 'vehicle-list' && (
              <VehicleListTab vehicles={vehicles} showToast={showToast} onSaved={fetchData} selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
            )}
            {tab === 'vehicle-fuel' && (
              <VehicleFuelTab vehicles={vehicles} selectedVehicleId={selectedVehicleId} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'vehicle-service' && (
              <VehicleServiceTab vehicles={vehicles} selectedVehicleId={selectedVehicleId} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'vehicle-docs' && (
              <VehicleDocsTab vehicles={vehicles} selectedVehicleId={selectedVehicleId} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'vehicle-trips' && (
              <VehicleTripsTab vehicles={vehicles} selectedVehicleId={selectedVehicleId} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'vehicle-maint' && (
              <VehicleMaintTab vehicles={vehicles} selectedVehicleId={selectedVehicleId} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'journal-family' && (
              <JournalFamilyTab family={family} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'journal-todo' && (
              <JournalTodoTab family={family} vehicles={vehicles} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'journal-diary' && (
              <JournalDiaryTab family={family} vehicles={vehicles} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'home-appliances' && (
              <HomeAppliancesTab appliances={appliances} selectedApplianceId={selectedApplianceId} onSelectAppliance={setSelectedApplianceId} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'home-service' && (
              <HomeServiceTab appliances={appliances} selectedApplianceId={selectedApplianceId} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'home-electric' && (
              <HomeElectricityTab showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'home-spends' && (
              <HomeSpendsTab family={family} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'home-education' && (
              <HomeEducationTab family={family} showToast={showToast} onSaved={fetchData} />
            )}
            {tab === 'lpg' && (
              <LpgTab showToast={showToast} />
            )}
            {tab === 'lpg-usage' && (
              <LpgUsageTab showToast={showToast} />
            )}
            {tab === 'medicine' && (
              <MedicineTab
                medicines={medicines}
                patients={patients}
                showToast={showToast}
                onSaved={fetchData}
              />
            )}
            {tab === 'give' && (
              <GiveMedicineTab
                medicines={medicines}
                patients={patients}
                showToast={showToast}
                onSaved={fetchData}
              />
            )}
            {tab === 'diary' && (
              <MedicineDiaryTab
                patients={patients}
                showToast={showToast}
              />
            )}
            {tab === 'patients' && (
              <PatientsTab
                patients={patients}
                medicines={medicines}
                showToast={showToast}
                onSaved={fetchData}
              />
            )}
            {tab === 'med-buy' && (
              <MedicinePurchaseTab
                medicines={medicines}
                patients={patients}
                showToast={showToast}
                onSaved={fetchData}
              />
            )}
            {tab === 'consult' && (
              <ConsultingTab
                patients={patients}
                showToast={showToast}
                onSaved={fetchData}
              />
            )}
            {tab === 'vitals' && (
              <VitalsTab
                patients={patients}
                showToast={showToast}
              />
            )}
            {tab === 'med-expenses' && (
              <HealthExpensesTab
                patients={patients}
                showToast={showToast}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
