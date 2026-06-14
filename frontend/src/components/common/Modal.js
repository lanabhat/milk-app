import { useEffect } from 'react';

export default function Modal({
  open, onClose, title, onSave, saveLabel = 'Save', saving = false,
  children, hideFooter = false,
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={ov} onClick={onClose}>
      <div style={box} className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={header}>
          <span style={titleStyle}>{title}</span>
          <button style={closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={body}>{children}</div>
        {!hideFooter && (
          <div style={footer}>
            <button style={cancelStyle} onClick={onClose}>Cancel</button>
            {onSave && (
              <button style={saveStyle} onClick={onSave} disabled={saving}>
                {saving ? 'Saving…' : saveLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ov = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 1000,
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '0',
  overflowY: 'auto',
};

const box = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
  width: '100%',
  maxWidth: 540,
  margin: '40px 16px 40px',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 'calc(100vh - 80px)',
  /* on mobile (<600px) becomes full-screen via CSS — see index.css */
};

const header = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 18px 14px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const titleStyle = {
  fontSize: 16, fontWeight: 700, color: 'var(--text)',
};

const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 18, color: 'var(--text-muted)',
  padding: '4px 6px', borderRadius: 6, lineHeight: 1,
  minWidth: 32, minHeight: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const body = {
  flex: 1, overflowY: 'auto', padding: '18px',
};

const footer = {
  display: 'flex', justifyContent: 'flex-end', gap: 10,
  padding: '14px 18px',
  borderTop: '1px solid var(--border)',
  flexShrink: 0,
  background: 'var(--surface)',
};

const cancelStyle = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 8,
  padding: '10px 18px', cursor: 'pointer', fontSize: 14,
  color: 'var(--text-muted)', fontWeight: 500,
  minHeight: 44,
};

const saveStyle = {
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 22px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
  minHeight: 44,
};
