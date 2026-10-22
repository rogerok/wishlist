// The only persisted prototype value is its color-theme preference.
(() => {
  const key = 'wishlist-design-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try {
    const stored = localStorage.getItem(key);
    if (['light', 'dark', 'system'].includes(stored)) preference = stored;
  } catch {
    /* Local files and privacy settings may deny storage. Keep session choice. */
  }

  const apply = () => {
    document.documentElement.dataset.theme =
      preference === 'system'
        ? system.matches
          ? 'dark'
          : 'light'
        : preference;
  };
  apply(); // Runs before CSS to avoid a light flash when dark was selected.
  system.addEventListener('change', () => {
    if (preference === 'system') apply();
  });
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      const select = document.querySelector('#theme');
      select.value = preference;
      select.addEventListener('change', () => {
        preference = select.value;
        apply();
        try {
          localStorage.setItem(key, preference);
        } catch {
          /* Switching still works. */
        }
      });
    },
    { once: true },
  );
})();
