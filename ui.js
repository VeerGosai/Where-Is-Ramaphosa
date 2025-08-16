// Variables for loading indicator
let loadingCount = 0;

function updateCurrentLocation(data) {
    const locationStatusElement = document.getElementById('current-location-status');
    const locationIconElement = document.getElementById('location-icon-symbol');
    const locationFlagElement = document.getElementById('location-flag');
    const locationCard = document.querySelector('.location-card');
    
    console.log('Current destination value:', data.destination);
    console.log('Character codes:', [...data.destination].map(c => c.charCodeAt(0)));
    
    // Check if destination indicates in transit
    if (isInTransit(data.destination)) {
        console.log('Detected in-transit status');
        locationStatusElement.textContent = "Currently In Transit";
        locationIconElement.textContent = "✈️";
        locationFlagElement.textContent = "🛫"; // Departure symbol instead of flag
        locationCard.classList.add('in-transit');
        locationCard.classList.remove('at-location');
    } else {
        locationStatusElement.textContent = data.destination;
        locationIconElement.textContent = "📍";
        
        // Set appropriate flag based on location (default to South Africa)
        locationFlagElement.textContent = getCountryFlag(data.destination);
        
        locationCard.classList.add('at-location');
        locationCard.classList.remove('in-transit');
    }
    
    // Add animation effect
    locationCard.classList.add('location-update');
    setTimeout(() => {
        locationCard.classList.remove('location-update');
    }, 1000);
    
    // After setting texts/flags, ensure skeleton is removed
    const status = document.getElementById('current-location-status');
    if (status) {
        status.classList.remove('skeleton', 'skeleton-text');
    }
}

function getCountryFlag(destination) {
    // Create a mapping of countries to their flag emojis
    const countryFlags = {
        // Africa
        "South Africa": "🇿🇦",
        "Algeria": "🇩🇿",
        "Angola": "🇦🇴",
        "Benin": "🇧🇯",
        "Botswana": "🇧🇼",
        "Burkina Faso": "🇧🇫",
        "Burundi": "🇧🇮",
        "Cabo Verde": "🇨🇻",
        "Cameroon": "🇨🇲",
        "Central African Republic": "🇨🇫",
        "Chad": "🇹🇩",
        "Comoros": "🇰🇲",
        "Congo": "🇨🇬",
        "DR Congo": "🇨🇩",
        "Democratic Republic of Congo": "🇨🇩",
        "Djibouti": "🇩🇯",
        "Egypt": "🇪🇬",
        "Equatorial Guinea": "🇬🇶",
        "Eritrea": "🇪🇷",
        "Eswatini": "🇸🇿",
        "Ethiopia": "🇪🇹",
        "Gabon": "🇬🇦",
        "Gambia": "🇬🇲",
        "Ghana": "🇬🇭",
        "Guinea": "🇬🇳",
        "Guinea-Bissau": "🇬🇼",
        "Ivory Coast": "🇨🇮",
        "Côte d'Ivoire": "🇨🇮",
        "Kenya": "🇰🇪",
        "Lesotho": "🇱🇸",
        "Liberia": "🇱🇷",
        "Libya": "🇱🇾",
        "Madagascar": "🇲🇬",
        "Malawi": "🇲🇼",
        "Mali": "🇲🇱",
        "Mauritania": "🇲🇷",
        "Mauritius": "🇲🇺",
        "Morocco": "🇲🇦",
        "Mozambique": "🇲🇿",
        "Namibia": "🇳🇦",
        "Niger": "🇳🇪",
        "Nigeria": "🇳🇬",
        "Rwanda": "🇷🇼",
        "Sao Tome and Principe": "🇸🇹",
        "Senegal": "🇸🇳",
        "Seychelles": "🇸🇨",
        "Sierra Leone": "🇸🇱",
        "Somalia": "🇸🇴",
        "Sudan": "🇸🇩",
        "South Sudan": "🇸🇸",
        "Tanzania": "🇹🇿",
        "Togo": "🇹🇬",
        "Tunisia": "🇹🇳",
        "Uganda": "🇺🇬",
        "Zambia": "🇿🇲",
        "Zimbabwe": "🇿🇼",
        
        // Europe
        "Albania": "🇦🇱",
        "Andorra": "🇦🇩",
        "Austria": "🇦🇹",
        "Belarus": "🇧🇾",
        "Belgium": "🇧🇪",
        "Bosnia and Herzegovina": "🇧🇦",
        "Bulgaria": "🇧🇬",
        "Croatia": "🇭🇷",
        "Cyprus": "🇨🇾",
        "Czech Republic": "🇨🇿",
        "Denmark": "🇩🇰",
        "Estonia": "🇪🇪",
        "Finland": "🇫🇮",
        "France": "🇫🇷",
        "Germany": "🇩🇪",
        "Greece": "🇬🇷",
        "Hungary": "🇭🇺",
        "Iceland": "🇮🇸",
        "Ireland": "🇮🇪",
        "Italy": "🇮🇹",
        "Latvia": "🇱🇻",
        "Liechtenstein": "🇱🇮",
        "Lithuania": "🇱🇹",
        "Luxembourg": "🇱🇺",
        "Malta": "🇲🇹",
        "Moldova": "🇲🇩",
        "Monaco": "🇲🇨",
        "Montenegro": "🇲🇪",
        "Netherlands": "🇳🇱",
        "North Macedonia": "🇲🇰",
        "Norway": "🇳🇴",
        "Poland": "🇵🇱",
        "Portugal": "🇵🇹",
        "Romania": "🇷🇴",
        "Russia": "🇷🇺",
        "San Marino": "🇸🇲",
        "Serbia": "🇷🇸",
        "Slovakia": "🇸🇰",
        "Slovenia": "🇸🇮",
        "Spain": "🇪🇸",
        "Sweden": "🇸🇪",
        "Switzerland": "🇨🇭",
        "Ukraine": "🇺🇦",
        "United Kingdom": "🇬🇧",
        "UK": "🇬🇧",
        "Great Britain": "🇬🇧",
        "England": "🏴",
        "Scotland": "🏴",
        "Wales": "🏴",
        "Vatican City": "🇻🇦",
        
        // Americas
        "Antigua and Barbuda": "🇦🇬",
        "Argentina": "🇦🇷",
        "Bahamas": "🇧🇸",
        "Barbados": "🇧🇧",
        "Belize": "🇧🇿",
        "Bolivia": "🇧🇴",
        "Brazil": "🇧🇷",
        "Canada": "🇨🇦",
        "Chile": "🇨🇱",
        "Colombia": "🇨🇴",
        "Costa Rica": "🇨🇷",
        "Cuba": "🇨🇺",
        "Dominica": "🇩🇲",
        "Dominican Republic": "🇩🇴",
        "Ecuador": "🇪🇨",
        "El Salvador": "🇸🇻",
        "Grenada": "🇬🇩",
        "Guatemala": "🇬🇹",
        "Guyana": "🇬🇾",
        "Haiti": "🇭🇹",
        "Honduras": "🇭🇳",
        "Jamaica": "🇯🇲",
        "Mexico": "🇲🇽",
        "Nicaragua": "🇳🇮",
        "Panama": "🇵🇦",
        "Paraguay": "🇵🇾",
        "Peru": "🇵🇪",
        "Saint Kitts and Nevis": "🇰🇳",
        "Saint Lucia": "🇱🇨",
        "Saint Vincent and the Grenadines": "🇻🇨",
        "Suriname": "🇸🇷",
        "Trinidad and Tobago": "🇹🇹",
        "United States": "🇺🇸",
        "USA": "🇺🇸",
        "US": "🇺🇸",
        "Uruguay": "🇺🇾",
        "Venezuela": "🇻🇪",

        // American States
        "Alabama": "🇺🇸",
        "AL": "🇺🇸",
        "Alaska": "🇺🇸",
        "AK": "🇺🇸",
        "Arizona": "🇺🇸",
        "AZ": "🇺🇸",
        "Arkansas": "🇺🇸",
        "AR": "🇺🇸",
        "California": "🇺🇸",
        "CA": "🇺🇸",
        "Colorado": "🇺🇸",
        "CO": "🇺🇸",
        "Connecticut": "🇺🇸",
        "CT": "🇺🇸",
        "Delaware": "🇺🇸",
        "DE": "🇺🇸",
        "Florida": "🇺🇸",
        "FL": "🇺🇸",
        "Georgia": "🇺🇸",
        "GA": "🇺🇸",
        "Hawaii": "🇺🇸",
        "HI": "🇺🇸",
        "Idaho": "🇺🇸",
        "ID": "🇺🇸",
        "Illinois": "🇺🇸",
        "IL": "🇺🇸",
        "Indiana": "🇺🇸",
        "IN": "🇺🇸",
        "Iowa": "🇺🇸",
        "IA": "🇺🇸",
        "Kansas": "🇺🇸",
        "KS": "🇺🇸",
        "Kentucky": "🇺🇸",
        "KY": "🇺🇸",
        "Louisiana": "🇺🇸",
        "LA": "🇺🇸",
        "Maine": "🇺🇸",
        "ME": "🇺🇸",
        "Maryland": "🇺🇸",
        "MD": "🇺🇸",
        "Massachusetts": "🇺🇸",
        "MA": "🇺🇸",
        "Michigan": "🇺🇸",
        "MI": "🇺🇸",
        "Minnesota": "🇺🇸",
        "MN": "🇺🇸",
        "Mississippi": "🇺🇸",
        "MS": "🇺🇸",
        "Missouri": "🇺🇸",
        "MO": "🇺🇸",
        "Montana": "🇺🇸",
        "MT": "🇺🇸",
        "Nebraska": "🇺🇸",
        "NE": "🇺🇸",
        "Nevada": "🇺🇸",
        "NV": "🇺🇸",
        "New Hampshire": "🇺🇸",
        "NH": "🇺🇸",
        "New Jersey": "🇺🇸",
        "NJ": "🇺🇸",
        "New Mexico": "🇺🇸",
        "NM": "🇺🇸",
        "New York": "🇺🇸",
        "NY": "🇺🇸",
        "North Carolina": "🇺🇸",
        "NC": "🇺🇸",
        "North Dakota": "🇺🇸",
        "ND": "🇺🇸",
        "Ohio": "🇺🇸",
        "OH": "🇺🇸",
        "Oklahoma": "🇺🇸",
        "OK": "🇺🇸",
        "Oregon": "🇺🇸",
        "OR": "🇺🇸",
        "Pennsylvania": "🇺🇸",
        "PA": "🇺🇸",
        "Rhode Island": "🇺🇸",
        "RI": "🇺🇸",
        "South Carolina": "🇺🇸",
        "SC": "🇺🇸",
        "South Dakota": "🇺🇸",
        "SD": "🇺🇸",
        "Tennessee": "🇺🇸",
        "TN": "🇺🇸",
        "Texas": "🇺🇸",
        "TX": "🇺🇸",
        "Utah": "🇺🇸",
        "UT": "🇺🇸",
        "Vermont": "🇺🇸",
        "VT": "🇺🇸",
        "Virginia": "🇺🇸",
        "VA": "🇺🇸",
        "Washington": "🇺🇸",
        "WA": "🇺🇸",
        "West Virginia": "🇺🇸",
        "WV": "🇺🇸",
        "Wisconsin": "🇺🇸",
        "WI": "🇺🇸",
        "Wyoming": "🇺🇸",
        "WY": "🇺🇸",
        
        // Asia
        "Afghanistan": "🇦🇫",
        "Armenia": "🇦🇲",
        "Azerbaijan": "🇦🇿",
        "Bahrain": "🇧🇭",
        "Bangladesh": "🇧🇩",
        "Bhutan": "🇧🇹",
        "Brunei": "🇧🇳",
        "Cambodia": "🇰🇭",
        "China": "🇨🇳",
        "Georgia": "🇬🇪",
        "India": "🇮🇳",
        "Indonesia": "🇮🇩",
        "Iran": "🇮🇷",
        "Iraq": "🇮🇶",
        "Israel": "🇮🇱",
        "Japan": "🇯🇵",
        "Jordan": "🇯🇴",
        "Kazakhstan": "🇰🇿",
        "Kuwait": "🇰🇼",
        "Kyrgyzstan": "🇰🇬",
        "Laos": "🇱🇦",
        "Lebanon": "🇱🇧",
        "Malaysia": "🇲🇾",
        "Maldives": "🇲ް",
        "Mongolia": "🇲🇳",
        "Myanmar": "🇲🇲",
        "Nepal": "🇳🇵",
        "North Korea": "🇰🇵",
        "Oman": "🇴🇲",
        "Pakistan": "🇵🇰",
        "Palestine": "🇵🇸",
        "Philippines": "🇵🇭",
        "Qatar": "🇶🇦",
        "Saudi Arabia": "🇸🇦",
        "Singapore": "🇸🇬",
        "South Korea": "🇰🇷",
        "Sri Lanka": "🇱🇰",
        "Syria": "🇸🇾",
        "Taiwan": "🇹🇼",
        "Tajikistan": "🇹🇯",
        "Thailand": "🇹🇭",
        "Timor-Leste": "🇹🇱",
        "Turkey": "🇹🇷",
        "Türkiye": "🇹🇷",
        "Turkmenistan": "🇹🇲",
        "United Arab Emirates": "🇦🇪",
        "UAE": "🇦🇪",
        "Uzbekistan": "🇺🇿",
        "Vietnam": "🇻🇳",
        "Yemen": "🇾🇪",
        
        // Oceania
        "Australia": "🇦🇺",
        "Fiji": "🇫🇯",
        "Kiribati": "🇰🇮",
        "Marshall Islands": "🇲🇭",
        "Micronesia": "🇫🇲",
        "Nauru": "🇳🇷",
        "New Zealand": "🇳🇿",
        "Palau": "🇵🇼",
        "Papua New Guinea": "🇵🇬",
        "Samoa": "🇼🇸",
        "Solomon Islands": "🇸🇧",
        "Tonga": "🇹🇴",
        "Tuvalu": "🇹🇻",
        "Vanuatu": "🇻🇺"
    };
    
    // Smart matching logic - check if the destination contains any country name
    for (const [country, flag] of Object.entries(countryFlags)) {
        if (destination.includes(country)) {
            return flag;
        }
    }
    
    // If no match found, return default South Africa flag
    console.log("No country flag found for destination: " + destination);
    return "🇿🇦";  // Default to South Africa flag
}

function displayData(data) {
    // Update the DOM with the data
    document.getElementById('departing-location').textContent = data.departing;
    document.getElementById('destination-location').textContent = data.destination;
    document.getElementById('destination-date').textContent = data.destination_date;
    document.getElementById('destination-time').textContent = data.destination_time;
    
    // Remove skeleton loaders on first data render
    ['departing-location','destination-location','destination-date','destination-time'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        // If child is a skeleton span, clear it before setting class animation
        // (textContent above already replaced content)
        el.classList.remove('skeleton', 'skeleton-text');
    });

    // Add animation to elements as they update
    const elements = [
        'departing-location', 
        'destination-location',
        'destination-date',
        'destination-time'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        element.classList.add('updated');
        setTimeout(() => {
            element.classList.remove('updated');
        }, 1000);
    });
}

function displayError() {
    const errorMessage = 'Sorry, we could not load the latest data. Please try again later.';
    const elements = [
        'departing-location', 
        'destination-location',
        'destination-date',
        'destination-time'
    ];
    
    elements.forEach(id => {
        document.getElementById(id).textContent = errorMessage;
        document.getElementById(id).classList.add('error');
    });
}

function showLoading() {
    if (loadingCount === 0) {
        document.getElementById('loading-overlay').classList.add('active');
    }
    loadingCount++;
    console.log('Loading count increased:', loadingCount);
}

function hideLoading() {
    loadingCount--;
    console.log('Loading count decreased:', loadingCount);
    
    if (loadingCount <= 0) {
        loadingCount = 0;
        document.getElementById('loading-overlay').classList.remove('active');
    }
}

// Function to initialize flight selector
function initializeFlightSelector() {
    const flightSelector = document.getElementById('flight-selector');
    if (!flightSelector) return;
    
    flightSelector.innerHTML = '<p class="loading-message">Loading flights...</p>';
}

// Function to apply user-selected flight display settings
function applyFlightSettings() {
    if (window.progressBar) progressBar.start();
    // Get settings from UI
    const countSelect = document.getElementById('flight-count');
    const countValue = countSelect.value;
    
    flightDisplaySettings.count = countValue === 'all' ? 9999 : parseInt(countValue);
    flightDisplaySettings.showMarkers = document.getElementById('show-markers').checked;
    flightDisplaySettings.showRoutes = document.getElementById('show-routes').checked;
    flightDisplaySettings.showLabels = document.getElementById('show-labels').checked;
    flightDisplaySettings.showCurrentDeparture = document.getElementById('show-current-departure').checked;
    
    // Get selected flights (if any)
    flightDisplaySettings.selectedFlights = Array.from(
        document.querySelectorAll('#flight-selector input:checked')
    ).map(checkbox => checkbox.value);
    
    // Always hide existing flights first
    hideHistoricalFlights();
    
    // Update current departure visibility
    updateCurrentDepartureVisibility();
    
    // Show historical flights
    showHistoricalFlights();
    
    // Update button text to show it's been applied
    const applyButton = document.getElementById('apply-settings');
    const originalText = applyButton.textContent;
    applyButton.textContent = 'Settings Applied!';
    applyButton.classList.add('settings-applied');
    
    // Reset button text after a delay
    setTimeout(() => {
        applyButton.textContent = originalText;
        applyButton.classList.remove('settings-applied');
    }, 1500);
    setTimeout(() => {
        if (window.progressBar) progressBar.finish();
    }, 600);
}

// Populate flight selector with checkboxes
function populateFlightSelector(flights) {
    const flightSelector = document.getElementById('flight-selector');
    if (!flightSelector) return;
    
    if (!flights || flights.length === 0) {
        flightSelector.innerHTML = '<p class="loading-message">No flights available</p>';
        return;
    }
    
    let html = '';
    flights.forEach((flight, index) => {
        const flightId = `flight-${index}`;
        const flightDesc = `${flight.departing} → ${flight.destination}`;
        const flightDate = flight.destination_date || 'Unknown date';
        
        html += `
            <label class="flight-checkbox-label" title="${flightDesc} (${flightDate})">
                <input type="checkbox" id="${flightId}" value="${index}" checked>
                ${truncateText(flightDesc, 30)}
            </label>
        `;
    });
    
    flightSelector.innerHTML = html;
}

function sortHistoricalFlights(sortBy) {
    // Clone the array to avoid mutating the original
    const sortedFlights = [...historicalFlights];
    
    // Sort based on criteria
    if (sortBy === 'date') {
        // Sort by date (most recent first)
        sortedFlights.sort((a, b) => {
            try {
                // Try to parse dates from destination_date
                const dateA = parseFlightDate(a.destination_date || '');
                const dateB = parseFlightDate(b.destination_date || '');
                
                // If we have timestamps, use those first
                if (a.timestamp && b.timestamp) {
                    return new Date(b.timestamp) - new Date(a.timestamp);
                }
                
                // Otherwise fall back to parsed dates
                return dateB - dateA;
            } catch (error) {
                console.error('Error sorting flights by date:', error);
                return 0; // Keep original order in case of error
            }
        });
    } else if (sortBy === 'destination') {
        // Sort alphabetically by destination
        sortedFlights.sort((a, b) => {
            return a.destination.localeCompare(b.destination);
        });
    }
    
    // Display the sorted flights
    displayHistoricalFlights(sortedFlights);
    
    // Highlight the active sort button
    document.querySelectorAll('.history-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`sort-by-${sortBy}`).classList.add('active');
}

// Display historical flights in the table
function displayHistoricalFlights(flights) {
    const tableBody = document.getElementById('history-data');
    
    if (!tableBody) {
        console.error('Could not find history-data element');
        return;
    }
    
    // Show loading message if flights are empty
    if (!flights || flights.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="loading-message">No flight history available</td></tr>';
        console.log('No flights to display');
        return;
    }
    
    console.log(`Displaying ${flights.length} historical flights`);
    
    // Build HTML for each flight
    let html = '';
    flights.forEach((flight, index) => {
        html += `
            <tr class="history-entry" style="animation-delay: ${index * 0.05}s">
                <td>${flight.departing || 'Unknown'}</td>
                <td>${flight.destination || 'Unknown'}</td>
                <td>${flight.destination_date || 'Unknown'}</td>
                <td>${flight.destination_time || 'Unknown'}</td>
            </tr>
        `;
    });
    
    // Update the table
    tableBody.innerHTML = html;
    
    // Add debug information
    console.log('Table updated with flight history');
}

// Update function to initialize UI controls with current settings
function initializeFlightControls() {
    // Set checkboxes to match default settings
    document.getElementById('show-markers').checked = flightDisplaySettings.showMarkers;
    document.getElementById('show-routes').checked = flightDisplaySettings.showRoutes;
    document.getElementById('show-labels').checked = flightDisplaySettings.showLabels;
    document.getElementById('show-current-departure').checked = flightDisplaySettings.showCurrentDeparture;
}

// Call this function during initialization
document.addEventListener('DOMContentLoaded', function() {
    // Initialize control defaults
    initializeFlightControls();
    // If needed, mark placeholders as skeleton (already in HTML)
    // No-op here; removal happens in displayData/updateCurrentLocation
});
