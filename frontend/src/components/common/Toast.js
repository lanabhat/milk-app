import React from 'react';
import { styles as s } from '../../styles/dashboard';

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      ...s.toast,
      backgroundColor: toast.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
      color: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
    }}>
      {toast.msg}
    </div>
  );
}
