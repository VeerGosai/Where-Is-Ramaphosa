// Add these variables to store user preferences
let flightDisplaySettings = {
    count: 10,
    showMarkers: true,
    showRoutes: true,
    showLabels: true,
    showCurrentDeparture: true,
    selectedFlights: []
};

document.addEventListener('DOMContentLoaded', function() {
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
});

// Global variable to store historical flights
let historicalFlights = [];

// Global variables for map control
let map;
let historicalFlightMarkers = [];
let historicalFlightPaths = [];
let showingHistoricalFlights = false;

// Add these variables at the top of your file
let loadingCount = 0;
const maxConcurrentRequests = 3; // Limit concurrent requests to Nominatim
let requestQueue = [];
let processingQueue = false;

function updateCurrentLocation(data) {
    const locationStatusElement = document.getElementById('current-location-status');
    const locationIconElement = document.getElementById('location-icon-symbol');
    const locationFlagElement = document.getElementById('location-flag');
    const locationCard = document.querySelector('.location-card');
    
    console.log('Current destination value:', data.destination);
    console.log('Character codes:', [...data.destination].map(c => c.charCodeAt(0)));
    
    // Check if destination indicates in transit
    // Handle both regular dashes and em dashes (which appear as "— —")
    if (!data.destination || 
        data.destination === "— —" || 
        data.destination === "-- --" ||
        data.destination.includes("—") ||
        data.destination.trim() === "") {
        
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
        // This could be extended to show different flags for international travel
        if (data.destination.includes("South Africa")) {
            locationFlagElement.textContent = "🇿🇦";  // South Africa flag
        } else if (data.destination.includes("Kenya")) {
            locationFlagElement.textContent = "🇰🇪";  // Kenya flag
        } else if (data.destination.includes("Nigeria")) {
            locationFlagElement.textContent = "🇳🇬";  // Nigeria flag
        } else if (data.destination.includes("Cote d'Ivoire") || data.destination.includes("Ivory Coast")) {
            locationFlagElement.textContent = "🇨🇮";  // Côte d'Ivoire flag
        } else {
            locationFlagElement.textContent = "🇿🇦";  // Default to South Africa flag
        }
        
        locationCard.classList.add('at-location');
        locationCard.classList.remove('in-transit');
    }
    
    // Add animation effect
    locationCard.classList.add('location-update');
    setTimeout(() => {
        locationCard.classList.remove('location-update');
    }, 1000);
}

function displayData(data) {
    // Update the DOM with the data
    document.getElementById('departing-location').textContent = data.departing;
    document.getElementById('destination-location').textContent = data.destination;
    document.getElementById('destination-date').textContent = data.destination_date;
    document.getElementById('destination-time').textContent = data.destination_time;
    
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

function initializeMap(data) {
    // Create a map centered on South Africa
    map = L.map('map').setView([-30.5595, 22.9375], 5);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Remove the map controls section that was here before
    
    // Function to geocode a location name and add a marker
    function addLocationMarker(locationName, isDestination = false) {
        // Skip API call for in-transit destinations
        if (locationName === "— —" || locationName === "-- --" || 
            (locationName && locationName.includes("—"))) {
            console.log('Skipping geocoding for transit indicator:', locationName);
            return; // Exit early, don't make the API call
        }
        
        // Skip departure markers if setting is disabled
        if (!isDestination && !flightDisplaySettings.showCurrentDeparture) {
            console.log('Skipping departure marker due to settings');
            return;
        }
        
        // Using Nominatim geocoding service
        const encodedLocation = encodeURIComponent(locationName);
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    
                    // Create marker with custom icon and popup
                    const markerIcon = L.divIcon({
                        className: isDestination ? 'destination-marker' : 'departure-marker',
                        html: `<div class="marker-pin ${isDestination ? 'destination' : 'departure'}"></div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    });
                    
                    // Store marker reference for later visibility control
                    const marker = L.marker([lat, lon], { icon: markerIcon }).addTo(map);
                    
                    // Store reference to marker
                    if (!isDestination) {
                        map.departureMarker = marker;
                    } else {
                        map.destinationMarker = marker;
                    }
                    
                    // Store references for polylines too
                    if (map.departureCoords && isDestination) {
                        const polyline = L.polyline([map.departureCoords, [lat, lon]], {
                            color: '#007bff',
                            weight: 3,
                            opacity: 0.7,
                            dashArray: '10, 10'
                        }).addTo(map);
                        
                        map.currentPolyline = polyline;
                        
                        // Animate the line
                        const animatedPolyline = L.polyline([[map.departureCoords[0], map.departureCoords[1]]], {
                            color: '#ff4757',
                            weight: 4
                        }).addTo(map);
                        
                        map.currentAnimatedPolyline = animatedPolyline;
                        
                        animateLine(animatedPolyline, map.departureCoords, [lat, lon]);
                        
                        // Set map view to show both markers
                        map.fitBounds([
                            map.departureCoords,
                            [lat, lon]
                        ], { padding: [50, 50] });
                    }
                    
                    // Store departure coordinates for later use
                    if (!isDestination) {
                        map.departureCoords = [lat, lon];
                    }
                }
            })
            .catch(error => {
                console.error('Error geocoding location:', error);
            });
    }
    
    // Animate a line from start to end point
    function animateLine(line, startPoint, endPoint) {
        line.addLatLng(startPoint);
        line.addLatLng(endPoint);
    }
    
    // Add markers for departure and destination
    addLocationMarker(data.departing, false);
    addLocationMarker(data.destination, true);
    
    // Prefetch historical flight data so it's ready when needed
    fetchHistoricalFlightLocations();
    
    // Add CSS for the map markers
    const style = document.createElement('style');
    style.textContent = `
        .marker-pin {
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            background: #c30b82;
            transform: rotate(-45deg);
            position: relative;
        }
        .marker-pin.departure {
            background: #4caf50;
        }
        .marker-pin.destination {
            background: #007bff;
        }
        .marker-pin:after {
            content: '';
            width: 14px;
            height: 14px;
            background: #fff;
            position: absolute;
            border-radius: 50%;
            top: 8px;
            left: 8px;
        }
    `;
    document.head.appendChild(style);
}

function fetchHistoricalFlightLocations() {
    fetch('history.json')
        .then(response => response.json())
        .then(data => {
            // Filter out transit entries
            const completedFlights = data.filter(entry => entry.destination !== "— —");
            // Cache the processed flight data for later use
            window.historicalFlightData = completedFlights;
        })
        .catch(error => console.error('Error fetching historical flight data:', error));
}

function showHistoricalFlights() {
    if (showingHistoricalFlights) return;
    showingHistoricalFlights = true;
    
    if (!window.historicalFlightData) {
        console.log('Historical flight data not yet loaded');
        return;
    }
    
    // Get flights based on user settings
    let flightsToShow = [];
    
    if (flightDisplaySettings.selectedFlights.length > 0) {
        // User has selected specific flights
        flightsToShow = flightDisplaySettings.selectedFlights.map(index => 
            window.historicalFlightData[parseInt(index)]);
    } else {
        // Get flights based on count setting
        flightsToShow = window.historicalFlightData
            .slice(-Math.min(flightDisplaySettings.count, window.historicalFlightData.length))
            .reverse(); // Reverse to show most recent first
    }
    
    // Create markers and paths for selected flights
    plotHistoricalFlights(flightsToShow);
    
    // Show settings are applied
    document.getElementById('show-history-flights').style.display = 'none';
    document.getElementById('hide-history-flights').style.display = 'block';
}

function hideHistoricalFlights() {
    showingHistoricalFlights = false;
    
    // Remove all historical flight markers
    historicalFlightMarkers.forEach(marker => map.removeLayer(marker));
    historicalFlightMarkers = [];
    
    // Remove all historical flight paths
    historicalFlightPaths.forEach(path => map.removeLayer(path));
    historicalFlightPaths = [];
}

function plotHistoricalFlights(flights) {
    showLoading();
    
    // Clear existing markers first
    hideHistoricalFlights();
    
    if (!flights || flights.length === 0) {
        hideLoading();
        console.log('No flights to plot');
        return;
    }
    
    // Generate a color gradient for the flights
    const colors = generateColorGradient('#FF5733', '#3498DB', flights.length);
    
    // Keep track of bounds to adjust view
    const bounds = [];
    const completedFlights = { count: 0, target: flights.length * 2 }; // Count both departure and destination
    
    // Process each flight
    flights.forEach((flight, index) => {
        // Skip flights with transit indicators
        if (!flight.destination || 
            flight.destination === "— —" || 
            flight.destination.includes("—")) {
            completedFlights.count += 2; // Count as completed
            return;
        }
        
        // Geocode both locations
        geocodeLocation(flight.departing, (fromCoords) => {
            completedFlights.count++;
            checkCompletion();
            
            geocodeLocation(flight.destination, (toCoords) => {
                completedFlights.count++;
                
                if (fromCoords && toCoords) {
                    // Add to bounds
                    bounds.push(fromCoords);
                    bounds.push(toCoords);
                    
                    // Create markers if enabled
                    if (flightDisplaySettings.showMarkers) {
                        const fromMarker = createFlightMarker(fromCoords, index + 1, colors[index]);
                        const toMarker = createFlightMarker(toCoords, index + 1, colors[index]);
                        
                        if (fromMarker) historicalFlightMarkers.push(fromMarker);
                        if (toMarker) historicalFlightMarkers.push(toMarker);
                    }
                    
                    // Create flight path if enabled
                    if (flightDisplaySettings.showRoutes) {
                        const path = L.polyline([fromCoords, toCoords], {
                            color: colors[index],
                            weight: 3,
                            opacity: 0.8
                        }).addTo(map);
                        
                        // Add popup with flight info
                        path.bindPopup(`
                            <b>Flight #${index + 1}</b><br>
                            From: ${flight.departing}<br>
                            To: ${flight.destination}<br>
                            Date: ${flight.destination_date || 'Unknown'}
                        `);
                        
                        historicalFlightPaths.push(path);
                    }
                }
                
                checkCompletion();
            });
        });
    });
    
    function checkCompletion() {
        console.log(`Flight processing: ${completedFlights.count}/${completedFlights.target}`);
        
        if (completedFlights.count >= completedFlights.target) {
            // All flights processed, fit map to bounds if any
            console.log('All flights processed');
            if (bounds.length > 0) {
                map.fitBounds(bounds, { padding: [30, 30] });
            }
            
            // Force hide loading after a short delay
            setTimeout(() => {
                loadingCount = 0; // Reset counter
                hideLoading();
            }, 500);
        }
    }
}

function createFlightMarker(coords, number, color) {
    // Only create marker if showMarkers is enabled
    if (!flightDisplaySettings.showMarkers) {
        return null;
    }
    
    // Create icon with or without labels based on settings
    const icon = L.divIcon({
        className: 'flight-marker',
        html: flightDisplaySettings.showLabels ? 
              `<div style="border-color: ${color};">${number}</div>` :
              `<div style="border-color: ${color};"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    // Create and add the marker
    return L.marker(coords, { icon: icon }).addTo(map);
}

// Update geocodeLocation to skip transit destinations
function geocodeLocation(locationName, callback) {
    // Skip geocoding for transit indicators
    if (!locationName || 
        locationName === "— —" || 
        locationName === "-- --" || 
        locationName.includes("—") ||
        locationName.trim() === "") {
        
        console.log('Skipping geocoding for transit indicator:', locationName);
        callback(null); // Call callback with null to indicate no coordinates
        return;
    }
    
    // Add to queue instead of executing immediately
    requestQueue.push({
        locationName,
        callback
    });
    
    // Start processing the queue if not already running
    if (!processingQueue) {
        processGeocodingQueue();
    }
}

// Add function to process geocoding queue
function processGeocodingQueue() {
    if (requestQueue.length === 0) {
        processingQueue = false;
        // Hide loading when all requests are done
        setTimeout(() => {
            hideLoading();
        }, 500); // Small delay to ensure all callbacks have finished
        return;
    }
    
    processingQueue = true;
    
    // Process multiple requests in parallel, up to the limit
    const batch = requestQueue.splice(0, maxConcurrentRequests);
    const promises = batch.map(request => {
        return new Promise((resolve) => {
            // Using Nominatim geocoding service
            const encodedLocation = encodeURIComponent(request.locationName);
            showLoading(); // Show loading before each request
            
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);
                        request.callback([lat, lon]);
                    } else {
                        request.callback(null);
                    }
                })
                .catch(error => {
                    console.error('Error geocoding location:', error);
                    request.callback(null);
                })
                .finally(() => {
                    resolve();
                });
        });
    });
    
    // Continue processing after this batch is done
    Promise.all(promises).then(() => {
        // Small delay to avoid overwhelming the API
        setTimeout(processGeocodingQueue, 1000);
    });
}

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

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function fetchHistoricalFlights() {
    console.log('Fetching historical flights...');
    fetch('history.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text(); // Get as text first to debug JSON issues
        })
        .then(text => {
            try {
                // Replace potential special dash characters with standard ones
                const cleanedText = text.replace(/— —/g, '-- --');
                return JSON.parse(cleanedText);
            } catch (error) {
                console.error('JSON parse error:', error);
                console.error('First 200 characters of text:', text.substring(0, 200));
                throw new Error('Invalid JSON: ' + error.message);
            }
        })
        .then(data => {
            console.log(`Loaded ${data.length} entries from history.json`);
            
            // Filter out entries where destination indicates transit
            historicalFlights = data.filter(entry => {
                const isTransit = !entry || 
                    !entry.destination || 
                    entry.destination === "— —" || 
                    entry.destination === "-- --" ||
                    (entry.destination && entry.destination.includes("—"));
                
                return !isTransit;
            });
            
            console.log(`After filtering: ${historicalFlights.length} completed flights`);
            
            // Update the flight count
            const countElement = document.querySelector('.history-count');
            if (countElement) {
                countElement.textContent = `${historicalFlights.length} flights`;
            }
            
            // Populate the flight selector
            populateFlightSelector(historicalFlights);
            
            // Display the flights sorted by most recent date first
            sortHistoricalFlights('date');
        })
        .catch(error => {
            console.error('There was a problem fetching the historical data:', error);
            const historyData = document.getElementById('history-data');
            if (historyData) {
                historyData.innerHTML = 
                    `<tr><td colspan="4" class="loading-message">Error loading flight history: ${error.message}</td></tr>`;
            }
            
            const flightSelector = document.getElementById('flight-selector');
            if (flightSelector) {
                flightSelector.innerHTML = 
                    `<p class="loading-message">Error loading flights: ${error.message}</p>`;
            }
        });
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

// Add or update the displayHistoricalFlights function
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

// Update the parseFlightDate function to handle invalid date formats
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

// Also update the getMonthNumber function to be more robust
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

// Reset loading count when showing and hiding
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
}

// Add a function to update current departure visibility
function updateCurrentDepartureVisibility() {
    // Find the current departure marker and update its visibility
    if (map && map.departureMarker) {
        if (flightDisplaySettings.showCurrentDeparture) {
            map.addLayer(map.departureMarker);
        } else {
            map.removeLayer(map.departureMarker);
        }
    }
    
    // Also update any polylines that might be showing the current route
    if (map && map.currentPolyline) {
        if (flightDisplaySettings.showCurrentDeparture) {
            map.addLayer(map.currentPolyline);
        } else {
            map.removeLayer(map.currentPolyline);
        }
    }
    
    if (map && map.currentAnimatedPolyline) {
        if (flightDisplaySettings.showCurrentDeparture) {
            map.addLayer(map.currentAnimatedPolyline);
        } else {
            map.removeLayer(map.currentAnimatedPolyline);
        }
    }
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

// Function to truncate text for better UI
function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}