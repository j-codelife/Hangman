// Shared theme toggle logic for all pages
(function () {
  const KEY = 'theme-preference'; // 'light' | 'dark'
  const root = document.documentElement;

  function getSystemPreference() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function currentTheme() {
    return localStorage.getItem(KEY) || getSystemPreference();
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('#themeToggle').forEach((btn) => {
      const isDark = theme === 'dark';
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.textContent = isDark ? '☀️' : '🌙';
    });
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    applyTheme(next);
  }

  applyTheme(currentTheme());

  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('#themeToggle');
    if (btn) {
      e.preventDefault();
      toggleTheme();
    }
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
})();
