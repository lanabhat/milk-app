import React from 'react';
import { styles as s } from '../../styles/dashboard';

export default function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div style={s.tabBar}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          style={{ ...s.tab, ...(activeTab === id ? s.tabActive : {}) }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
