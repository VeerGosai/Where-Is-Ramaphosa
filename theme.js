// Run in the head so the saved theme is applied before the first paint.
(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let mode = 'auto';
    try { mode = localStorage.getItem('theme-mode') || 'auto'; } catch { /* Storage may be disabled. */ }
    function apply(next) {
        mode = ['auto', 'light', 'dark'].includes(next) ? next : 'auto';
        const dark = mode === 'dark' || (mode === 'auto' && media.matches);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        const select = document.getElementById('theme-select');
        if (select) {
            select.value = mode;
            select.dispatchEvent(new Event('dropdown:sync'));
        }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = dark ? '#0a0a0a' : '#ffffff';
    }
    apply(mode);
    media.addEventListener('change', () => apply(mode));
    window.addEventListener('storage', event => { if (event.key === 'theme-mode') apply(event.newValue || 'auto'); });
    document.addEventListener('DOMContentLoaded', () => {
        apply(mode);
        document.getElementById('theme-select')?.addEventListener('change', event => {
            apply(event.target.value);
            try { localStorage.setItem('theme-mode', mode); } catch { /* Keep theme for this visit. */ }
        });
        document.getElementById('current-year').textContent = new Date().getFullYear();
    });
})();
