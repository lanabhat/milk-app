export const THEMES = {
  dark: {
    name: 'dark',
    label: 'Dark Glass',
    swatch: '#6366f1',
    vars: {
      '--bg':              '#0f172a',
      '--bg2':             '#1e293b',
      '--surface':         'rgba(255,255,255,0.07)',
      '--surface-solid':   '#1e293b',
      '--border':          'rgba(255,255,255,0.10)',
      '--accent':          '#6366f1',
      '--accent-dim':      'rgba(99,102,241,0.18)',
      '--text':            '#e2e8f0',
      '--text-muted':      '#94a3b8',
      '--text-faint':      '#475569',
      '--danger':          '#f87171',
      '--danger-bg':       'rgba(248,113,113,0.12)',
      '--success':         '#4ade80',
      '--success-bg':      'rgba(74,222,128,0.12)',
      '--warn':            '#fbbf24',
      '--warn-bg':         'rgba(251,191,36,0.12)',
      '--shadow':          '0 4px 24px rgba(0,0,0,0.4)',
      '--shadow-sm':       '0 1px 8px rgba(0,0,0,0.3)',
      '--blur':            'blur(12px)',
      '--tab-indicator':   '#6366f1',
      '--input-bg':        'rgba(255,255,255,0.06)',
      '--overlay':         'rgba(0,0,0,0.6)',
      '--primary':         '#6366f1',
      '--bg-secondary':    '#1e293b',
    },
  },
  light: {
    name: 'light',
    label: 'Clean Light',
    swatch: '#2563eb',
    vars: {
      '--bg':              '#f8fafc',
      '--bg2':             '#f1f5f9',
      '--surface':         '#ffffff',
      '--surface-solid':   '#ffffff',
      '--border':          '#e2e8f0',
      '--accent':          '#2563eb',
      '--accent-dim':      '#eff6ff',
      '--text':            '#1e293b',
      '--text-muted':      '#64748b',
      '--text-faint':      '#94a3b8',
      '--danger':          '#dc2626',
      '--danger-bg':       '#fef2f2',
      '--success':         '#16a34a',
      '--success-bg':      '#f0fdf4',
      '--warn':            '#d97706',
      '--warn-bg':         '#fffbeb',
      '--shadow':          '0 1px 3px rgba(0,0,0,0.08)',
      '--shadow-sm':       '0 1px 2px rgba(0,0,0,0.05)',
      '--blur':            'none',
      '--tab-indicator':   '#2563eb',
      '--input-bg':        '#ffffff',
      '--overlay':         'rgba(0,0,0,0.4)',
      '--primary':         '#2563eb',
      '--bg-secondary':    '#f1f5f9',
    },
  },
  soft: {
    name: 'soft',
    label: 'Soft Neutral',
    swatch: '#7c6f9f',
    vars: {
      '--bg':              '#f1f0eb',
      '--bg2':             '#e8e6df',
      '--surface':         '#fafaf8',
      '--surface-solid':   '#fafaf8',
      '--border':          '#ddd8ce',
      '--accent':          '#7c6f9f',
      '--accent-dim':      '#ede9f5',
      '--text':            '#3d3a4a',
      '--text-muted':      '#6b6679',
      '--text-faint':      '#9e9aaa',
      '--danger':          '#c0392b',
      '--danger-bg':       '#fdf0ef',
      '--success':         '#2d7a4f',
      '--success-bg':      '#edf7f1',
      '--warn':            '#b8762e',
      '--warn-bg':         '#fef8ef',
      '--shadow':          '0 2px 8px rgba(60,50,80,0.08)',
      '--shadow-sm':       '0 1px 3px rgba(60,50,80,0.06)',
      '--blur':            'none',
      '--tab-indicator':   '#7c6f9f',
      '--input-bg':        '#fafaf8',
      '--overlay':         'rgba(40,35,55,0.4)',
      '--primary':         '#7c6f9f',
      '--bg-secondary':    '#e8e6df',
    },
  },
};

export function applyTheme(name) {
  const theme = THEMES[name] || THEMES.light;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  // Store extra info for JS-side checks
  root.setAttribute('data-theme', name);
  localStorage.setItem('milk_theme', name);
}

export function loadSavedTheme() {
  const saved = localStorage.getItem('milk_theme') || 'light';
  applyTheme(saved);
  return saved;
}
