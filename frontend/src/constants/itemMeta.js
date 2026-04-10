export const ITEM_META = {
  'Nandini Toned Milk 1L':       { img: '/images/toned-milk-1l.jpg',       accent: '#1d4ed8', tag: '1L · Pasteurised',  litres: 1.0 },
  'Nandini Toned Milk 500ml':    { img: '/images/toned-milk-500ml.jpg',    accent: '#0369a1', tag: '500ml · Pasteurised', litres: 0.5 },
  'Nandini Shubham Gold 500ml':  { img: '/images/shubham-gold-500ml.jpg',  accent: '#b45309', tag: '500ml · Full Cream',  litres: 0.5 },
  'Kannada Prabha':              { img: '/images/kannada-prabha.jpg',      accent: '#be185d', tag: 'ಕನ್ನಡ ಪ್ರಭ' },
  'New Indian Express':          { img: '/images/new-indian-express.jpg',  accent: '#7e22ce', tag: 'English Daily' },
  'Yugadi Special Magazine':     { img: '/images/yugadi-visheshanka.jpg',  accent: '#2c5eaa', tag: 'English Daily' },
};

export const CATEGORY_META = {
  milk:      { label: 'Milk & Dairy',             accent: '#0369a1', icon: '🥛' },
  newspaper: { label: 'Newspaper & Magazine',     accent: '#be185d', icon: '📰' },
  other:     { label: 'Other',                    accent: '#64748b', icon: '📦' },
};

// Returns volume in litres for a purchase row (falls back to raw quantity for non-milk)
export const milkLitres = (itemName, quantity) => {
  const meta = ITEM_META[itemName];
  return meta?.litres != null ? quantity * meta.litres : quantity;
};
