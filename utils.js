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
