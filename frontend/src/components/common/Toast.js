import React from 'react';
import { styles as s } from '../../styles/dashboard';

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      ...s.toast,
      backgroundColor: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
      color: toast.type === 'error' ? '#dc2626' : '#16a34a',
    }}>
      {toast.msg}
    </div>
  );
}
