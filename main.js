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
    // Initialize dark mode
    initDarkMode();
    
    // Set current year in the footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Fetch the data from data.json
    fetch('data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            displayData(data);
            updateCurrentLocation(data);
            initializeMap(data);
        })
        .catch(error => {
            console.error('There was a problem fetching the data:', error);
            displayError();
        });
    
    // Fetch and display historical flight data
    fetchHistoricalFlights();
    
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

    // Remove theme toggle button if it exists
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.style.display = 'none';
    }
});

// Initialize dark mode based on system preference only
function initDarkMode() {
    // Check if user prefers dark mode based on system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        enableDarkMode();
    } else {
        disableDarkMode(); // Default to light mode
    }
    
    // Add listener for changes to color scheme preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (event.matches) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
        
        // Update map tiles if map exists
        if (map) {
            // Force map to redraw tiles with new styles
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    });
}

// Enable dark mode
function enableDarkMode() {
    document.body.classList.add('dark-mode');
    isDarkMode = true;
}

// Disable dark mode
function disableDarkMode() {
    document.body.classList.remove('dark-mode');
    isDarkMode = false;
}

// Import other modules via script tags in HTML
// This is a comment for understanding structure, not actual code
