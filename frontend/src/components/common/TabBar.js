import React from 'react';

export default function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="tab-nav" role="tablist" aria-label="Main navigation">
      {tabs.map(([id, label, icon]) => (
        <button
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          onClick={() => onTabChange(id)}
          className="tab-btn"
        >
          {icon && <span className="tab-icon" aria-hidden="true">{icon}</span>}
          {label}
        </button>
      ))}
    </nav>
  );
}
