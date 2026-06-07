import React from 'react';
import { styles as s } from '../../styles/dashboard';

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 70,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      maxWidth: 'calc(100vw - 32px)',
      minWidth: 220,
      whiteSpace: 'nowrap',
      ...s.toast,
      backgroundColor: toast.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
      color: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      margin: 0,
    }}>
      {toast.msg}
    </div>
  );
}
