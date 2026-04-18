export const styles = {
  page:       { minHeight: '100vh', backgroundColor: 'var(--bg)', fontFamily: 'system-ui,-apple-system,sans-serif', color: 'var(--text)' },
  header:     { backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-sm)' },
  logo:       { fontSize: 17, fontWeight: 800, color: 'var(--accent)', flex: 1, letterSpacing: '-0.3px' },
  userEmail:  { fontSize: 12, color: 'var(--text-faint)' },
  logoutBtn:  { background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', transition: 'background 0.15s' },

  balBar:     { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px', backgroundColor: 'var(--bg2)', borderBottom: '1px solid var(--border)', alignItems: 'center' },
  balCard:    { flex: 1, minWidth: 90, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-sm)' },
  balLabel:   { fontSize: 10, color: 'var(--text-faint)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 },
  balVal:     { fontSize: 18, fontWeight: 800 },
  balWarn:    { width: '100%', backgroundColor: 'var(--warn-bg)', color: 'var(--warn)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 },

  toast:      { margin: '8px 16px', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid currentColor' },

  // Section/tab bars replaced by CSS classes in index.css
  sectionBar:       { display: 'flex', gap: 10, padding: '12px 14px 0', backgroundColor: 'var(--bg)' },
  sectionTab:       { backgroundColor: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  sectionTabActive: { backgroundColor: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' },

  tabBar:    { display: 'flex', gap: 3, padding: '8px 14px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  tab:       { padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, backgroundColor: 'transparent', color: 'var(--text-muted)' },
  tabActive:  { backgroundColor: 'var(--accent)', color: 'white' },

  body:    { padding: '16px', width: '100%', boxSizing: 'border-box' },
  section: { maxWidth: 900, margin: '0 auto' },

  twoPanel:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  productsPanel: { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--shadow-sm)' },
  cartPanel:     { backgroundColor: 'var(--surface)', border: '2px dashed var(--border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 },
  panelTitle:    { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 },
  cartBadge:     { backgroundColor: 'var(--accent)', color: 'white', borderRadius: 99, padding: '1px 6px', fontSize: 11 },
  cartEmpty:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13, gap: 6, textAlign: 'center' },

  productRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 10, cursor: 'grab', backgroundColor: 'var(--bg2)', border: '1px solid var(--border)', transition: 'box-shadow 0.15s' },
  productImg:  { width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, backgroundColor: 'var(--bg2)' },
  productInfo: { flex: 1, minWidth: 0 },
  productName: { fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  productTag:  { fontSize: 10, color: 'var(--text-faint)' },
  productPrice: { fontSize: 13, fontWeight: 700, marginTop: 1 },
  addBtn:      { flexShrink: 0, color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },

  cartRow:   { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' },
  cartImg:   { width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0, backgroundColor: 'var(--bg2)' },
  cartTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 14 },
  saveBtn:   { backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 8 },

  qtyCtrl:    { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  qtyBtn:     { width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' },
  qtyBtnFill: { width: 26, height: 26, borderRadius: '50%', border: 'none', color: 'white', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyNum:     { width: 20, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text)' },

  fieldLabel:   { fontSize: 10, color: 'var(--text-faint)', display: 'block', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionTitle: { margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  empty:        { color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '20px 0' },
  card:         { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, boxShadow: 'var(--shadow-sm)' },
  listRow:      { display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', boxShadow: 'var(--shadow-sm)' },
  dateHeader:   { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', padding: '4px 2px 5px', borderBottom: '1px solid var(--border)', marginBottom: 4 },

  input:        { display: 'block', width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, outline: 'none', boxSizing: 'border-box', backgroundColor: 'var(--input-bg)', color: 'var(--text)' },
  primaryBtn:   { backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  cancelBtn:    { background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' },
  secondaryBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontWeight: 500 },
  saveSmBtn:    { backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  iconBtn:      { background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 12, flexShrink: 0, color: 'var(--text-muted)' },
  inlineInput:  { padding: '5px 7px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, outline: 'none', backgroundColor: 'var(--input-bg)', color: 'var(--text)' },

  sessionPill:        { padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, background: 'var(--surface)', color: 'var(--text-muted)', fontWeight: 500 },
  sessionPillActive:  { backgroundColor: 'var(--accent)', color: 'white', border: '1px solid var(--accent)' },
  sessionPillSettled: { backgroundColor: '#7e22ce', color: 'white', border: '1px solid #7e22ce' },

  receipt:         { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 16px', maxWidth: 360, margin: '0 auto', fontFamily: 'monospace', color: 'var(--text)' },
  receiptDivider:  { borderTop: '1px dashed var(--border)', margin: '8px 0' },
  receiptSummary:  { fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 },
};
