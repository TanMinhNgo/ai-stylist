// Single list of app tabs, shared by the iOS native tab bar and the Android floating tab bar.
export const TABS = [
  { name: 'index', label: 'Studio', sf: 'sparkles', md: 'auto_awesome' },
  { name: 'wardrobe', label: 'Tủ đồ', sf: 'hanger', md: 'checkroom' },
  { name: 'lookbook', label: 'Lookbook', sf: 'square.grid.2x2', md: 'grid_view' },
  { name: 'profile', label: 'Hồ sơ', sf: 'person.crop.circle', md: 'person' },
] as const;

/** Height the Android floating tab bar occupies above the bottom inset. */
export const FLOATING_TAB_BAR_SPACE = 92;
