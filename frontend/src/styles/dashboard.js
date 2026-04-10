export const styles = {
  page:       { minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'system-ui,-apple-system,sans-serif' },
  header:     { backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 },
  logo:       { fontSize: 17, fontWeight: 700, color: '#1e293b', flex: 1 },
  userEmail:  { fontSize: 12, color: '#94a3b8' },
  logoutBtn:  { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: '#64748b' },

  balBar:     { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', alignItems: 'center' },
  balCard:    { flex: 1, minWidth: 90, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', textAlign: 'center' },
  balLabel:   { fontSize: 10, color: '#94a3b8', marginBottom: 2 },
  balVal:     { fontSize: 18, fontWeight: 700 },
  balWarn:    { width: '100%', backgroundColor: '#fef9c3', color: '#92400e', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600 },

  toast:      { margin: '8px 16px', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid currentColor' },

  sectionBar:       { display: 'flex', gap: 10, padding: '12px 14px 0', backgroundColor: '#f1f5f9' },
  sectionTab:       { backgroundColor: 'white', color: '#475569', border: '1px solid #dbe3f0', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  sectionTabActive: { backgroundColor: '#0f172a', color: 'white', borderColor: '#0f172a' },

  tabBar:   { display: 'flex', gap: 3, padding: '8px 14px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  tab:      { padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', color: '#64748b' },
  tabActive: { backgroundColor: '#1d4ed8', color: 'white' },

  body:    { padding: '14px' },
  section: { maxWidth: 680, margin: '0 auto' },

  twoPanel:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  productsPanel: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  cartPanel:     { backgroundColor: 'white', border: '2px dashed #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 },
  panelTitle:    { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 },
  cartBadge:     { backgroundColor: '#1d4ed8', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: 11 },
  cartEmpty:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13, gap: 6, textAlign: 'center' },

  productRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 8, cursor: 'grab', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' },
  productImg:  { width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0, backgroundColor: '#f1f5f9' },
  productInfo: { flex: 1, minWidth: 0 },
  productName: { fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  productTag:  { fontSize: 10, color: '#94a3b8' },
  productPrice: { fontSize: 13, fontWeight: 700, marginTop: 1 },
  addBtn:      { flexShrink: 0, color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },

  cartRow:   { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f5f9' },
  cartImg:   { width: 36, height: 36, objectFit: 'cover', borderRadius: 5, flexShrink: 0, backgroundColor: '#f1f5f9' },
  cartTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0', fontSize: 14 },
  saveBtn:   { backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 8 },

  qtyCtrl:    { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  qtyBtn:     { width: 26, height: 26, borderRadius: '50%', border: '1.5px solid', background: 'white', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyBtnFill: { width: 26, height: 26, borderRadius: '50%', border: 'none', color: 'white', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyNum:     { width: 20, textAlign: 'center', fontSize: 14, fontWeight: 700 },

  fieldLabel:   { fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 2 },
  sectionTitle: { margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1e293b' },
  empty:        { color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' },
  card:         { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 },
  listRow:      { display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 9, padding: '10px 12px' },
  dateHeader:   { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', padding: '4px 2px 5px', borderBottom: '1px solid #e2e8f0', marginBottom: 4 },

  input:        { display: 'block', width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  primaryBtn:   { backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  cancelBtn:    { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: '#64748b' },
  secondaryBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 500 },
  saveSmBtn:    { backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  iconBtn:      { background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 12, flexShrink: 0 },
  inlineInput:  { padding: '5px 7px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, outline: 'none' },

  sessionPill:        { padding: '5px 10px', borderRadius: 20, border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 12, background: 'white', color: '#64748b', fontWeight: 500 },
  sessionPillActive:  { backgroundColor: '#1d4ed8', color: 'white', border: '1px solid #1d4ed8' },
  sessionPillSettled: { backgroundColor: '#7e22ce', color: 'white', border: '1px solid #7e22ce' },

  receipt:         { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 16px', maxWidth: 360, margin: '0 auto', fontFamily: 'monospace' },
  receiptDivider:  { borderTop: '1px dashed #ccc', margin: '8px 0' },
  receiptSummary:  { fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 },
};
