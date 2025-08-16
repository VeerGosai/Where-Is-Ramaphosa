// Parse flight dates
function parseFlightDate(dateString) {
    if (!dateString || typeof dateString !== 'string' || dateString.trim() === '') {
        return new Date(0);
    }
    
    try {
        // Extract components from format like "Fri 16-May-2025"
        const parts = dateString.trim().split(' ');
        if (parts.length < 2) return new Date(0);
        
        const dateParts = parts[1].split('-');
        if (dateParts.length !== 3) return new Date(0);
        
        const day = parseInt(dateParts[0], 10);
        const month = getMonthNumber(dateParts[1]);
        const year = parseInt(dateParts[2], 10);
        
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
            return new Date(0);
        }
        
        return new Date(year, month, day);
    } catch (error) {
        console.error('Error parsing date string:', dateString, error);
        return new Date(0);
    }
}

// Convert month name to number
function getMonthNumber(monthStr) {
    if (!monthStr || typeof monthStr !== 'string') {
        return 0;
    }
    
    const months = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    return months[monthStr] || 0;
}

// Generate color gradient for flights
function generateColorGradient(startColor, endColor, steps) {
    // Convert hex to RGB
    const startRGB = hexToRgb(startColor);
    const endRGB = hexToRgb(endColor);
    
    // Generate steps
    const colors = [];
    for (let i = 0; i < steps; i++) {
        const ratio = i / (steps - 1);
        const r = Math.round(startRGB.r + ratio * (endRGB.r - startRGB.r));
        const g = Math.round(startRGB.g + ratio * (endRGB.g - startRGB.g));
        const b = Math.round(startRGB.b + ratio * (endRGB.b - startRGB.b));
        colors.push(`rgb(${r}, ${g}, ${b})`);
    }
    
    return colors;
}

// Convert hex color to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

// Truncate text for better UI
function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Hardware-aware concurrency (used by geocoding)
window.MAX_CONCURRENCY = Math.min(8, (navigator.hardwareConcurrency || 4));

// Tiny top progress bar controller
(function () {
    let el, bar, active = false, value = 0, finishTimer = null;

    function ensure() {
        if (!el) el = document.getElementById('top-progress');
        if (el && !bar) bar = el.querySelector('.bar');
        return !!(el && bar);
    }

    function set(val) {
        if (!ensure()) return;
        value = Math.max(0, Math.min(1, val));
        bar.style.width = (value * 100) + '%';
    }

    function show() {
        if (!ensure()) return;
        el.style.opacity = '1';
        el.style.visibility = 'visible';
    }

    function hide() {
        if (!ensure()) return;
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
        bar.style.width = '0%';
    }

    window.progressBar = {
        start() {
            clearTimeout(finishTimer);
            active = true;
            show();
            set(0.08);
        },
        set(p) {
            if (!active) show();
            set(p);
        },
        increment(delta = 0.03) {
            if (!active) show();
            set(value + delta);
        },
        finish() {
            if (!ensure()) return;
            set(1);
            finishTimer = setTimeout(() => {
                active = false;
                hide();
            }, 250);
        }
    };
})();
//
// Toggle service status helper for footer status card
window.setServiceStatus = function setServiceStatus(liId, online) {
    const row = document.getElementById(liId);
    if (!row) return;
    const dot = row.querySelector('.status-dot');
    const text = row.querySelector('.status-text');
    if (!dot || !text) return;

    // Reset classes
    dot.classList.remove('online', 'offline');
    text.classList.remove('online', 'offline');

    if (online) {
        dot.classList.add('online');
        text.classList.add('online');
        text.textContent = 'Online';
    } else {
        dot.classList.add('offline');
        text.classList.add('offline');
        text.textContent = 'Offline';
    }
};
