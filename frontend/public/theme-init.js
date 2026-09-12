// Apply the saved theme before the application paints.
(() => {
  let theme;
  try {
    theme = localStorage.getItem('wboj-theme');
  } catch {
    // System preference remains available when storage is blocked.
  }
  document.documentElement.dataset.theme = theme === 'light' || theme === 'dark'
    ? theme
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
})();
