// Global settings for flight display
let flightDisplaySettings = {
    count: 10,
    showMarkers: false, // Changed default to false
    showRoutes: true,
    showLabels: false, // Changed default to false
    showCurrentDeparture: true,
    selectedFlights: []
};

// Dark mode variables
let isDarkMode = false;
let mapInstance = null;

document.addEventListener('DOMContentLoaded', function() {
    progressBar.start();
    // Initialize dark mode (now supports Auto/Light/Dark)
    initDarkMode();

    // Wire up theme toggle (click + keyboard)
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.style.display = ''; // ensure visible
        const activate = () => cycleThemeMode();
        themeToggle.addEventListener('click', activate);
        themeToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            }
        });
    }
    
    // Set current year in the footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Kick off parallel initialization
    const latestFlightTask = fetch('data.json')
        .then(r => {
            if (!r.ok) throw new Error('Failed to fetch data.json');
            progressBar.increment(0.08);
            return r.json();
        })
        .then(data => {
            displayData(data);
            updateCurrentLocation(data);
            progressBar.increment(0.08);
            // initializeMap now returns a Promise that resolves after plotting
            return initializeMap(data).then(() => {
                progressBar.increment(0.12);
            });
        })
        .catch(err => {
            console.error(err);
            displayError();
        });

    const historyTask = fetchHistoricalFlights()
        .then(() => {
            progressBar.increment(0.18);
        })
        .catch(err => console.error(err));

    Promise.allSettled([latestFlightTask, historyTask]).finally(() => {
        progressBar.finish();
    });
    
    // Set up history sorting buttons
    document.getElementById('sort-by-date').addEventListener('click', function() {
        sortHistoricalFlights('date');
    });
    
    document.getElementById('sort-by-destination').addEventListener('click', function() {
        sortHistoricalFlights('destination');
    });

    // Set up flight control event listeners
    document.getElementById('apply-settings').addEventListener('click', function() {
        applyFlightSettings();
    });
    
    // Initialize the flight selector with empty state
    initializeFlightSelector();

    // Apply when "Number of flights to show" changes
    const countSelect = document.getElementById('flight-count');
    if (countSelect) {
        countSelect.addEventListener('change', () => {
            applyFlightSettings();
        });
    }
});

// Initialize dark mode based on saved preference or system preference
function initDarkMode() {
    const saved = localStorage.getItem('theme-mode') || 'auto';
    applyTheme(saved);

    // Update on system change only when in auto
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', (event) => {
        const mode = localStorage.getItem('theme-mode') || 'auto';
        if (mode === 'auto') {
            applyTheme('auto');
        }
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    });
}

function cycleThemeMode() {
    const current = localStorage.getItem('theme-mode') || 'auto';
    const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    applyTheme(next);
}

function applyTheme(mode) {
    localStorage.setItem('theme-mode', mode);
    document.body.dataset.theme = mode; // optional hook
    // Resolve effective dark state
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = mode === 'dark' || (mode === 'auto' && systemDark);

    if (dark) {
        document.body.classList.add('dark-mode');
        isDarkMode = true;
    } else {
        document.body.classList.remove('dark-mode');
        isDarkMode = false;
    }
    updateThemeToggleUI(mode);

    if (map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

function updateThemeToggleUI(mode) {
    const icon = document.getElementById('theme-toggle-icon');
    const text = document.getElementById('theme-toggle-text');
    const btn = document.getElementById('theme-toggle');
    if (!icon || !text || !btn) return;

    if (mode === 'light') {
        icon.textContent = '☀️';
        text.textContent = 'Light';
        btn.setAttribute('data-mode', 'light');
        btn.setAttribute('aria-pressed', 'false');
    } else if (mode === 'dark') {
        icon.textContent = '🌙';
        text.textContent = 'Dark';
        btn.setAttribute('data-mode', 'dark');
        btn.setAttribute('aria-pressed', 'true');
    } else {
        icon.textContent = '🌓';
        text.textContent = 'Auto';
        btn.setAttribute('data-mode', 'auto');
        btn.setAttribute('aria-pressed', String(isDarkMode));
    }
}

// Enable/Disable helpers (kept for compatibility)
function enableDarkMode() {
    applyTheme('dark');
}
function disableDarkMode() {
    applyTheme('light');
}

// Import other modules via script tags in HTML
// This is a comment for understanding structure, not actual code
