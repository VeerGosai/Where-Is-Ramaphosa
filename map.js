// Global variables for map control
let map;
let historicalFlightMarkers = [];
let historicalFlightPaths = [];
let showingHistoricalFlights = false;

// Coordinates cache to avoid unnecessary API calls
let coordinatesCache = {};

// Variables to store current view for recentering
let currentFlightBounds = null;

function initializeMap(data) {
    // Create a map centered on South Africa
    map = L.map('map').setView([-30.5595, 22.9375], 5);
    mapInstance = map; // Store map reference for dark mode updates
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add CSS for the map markers
    addMapStyles();
    
    // Set up recenter button click handler
    document.getElementById('recenter-map').addEventListener('click', function() {
        recenterMap();
    });
    
    // Plot current flight and zoom to it
    plotCurrentFlight(data);
    
    // Prefetch historical flight data so it's ready when needed
    fetchHistoricalFlightLocations();
}

function recenterMap() {
    // If we have current flight bounds, use them
    if (currentFlightBounds) {
        map.fitBounds(currentFlightBounds, { padding: [50, 50] });
    } 
    // Otherwise if we have departure and destination markers
    else if (map.departureCoords && map.destinationCoords) {
        map.fitBounds([
            map.departureCoords,
            map.destinationCoords
        ], { padding: [50, 50] });
    }
    // Otherwise center on South Africa
    else {
        map.setView([-30.5595, 22.9375], 5);
    }
    
    // Add a subtle bounce animation to the map
    const mapElement = document.getElementById('map');
    mapElement.classList.add('map-bounce');
    
    // Remove the animation class after it completes
    setTimeout(() => {
        mapElement.classList.remove('map-bounce');
    }, 600);
}

function plotCurrentFlight(data) {
    // Skip if no data or in transit
    if (!data || isInTransit(data.destination)) {
        console.log('No current flight to plot or flight is in transit');
        return;
    }
    
    // Show map-specific loading indicator
    showMapLoading();
    
    // Plot markers for departure and destination
    addLocationMarker(data.departing, false, () => {
        addLocationMarker(data.destination, true, () => {
            // Zoom to show both markers once both are added
            if (map.departureCoords && map.destinationCoords) {
                currentFlightBounds = [
                    map.departureCoords,
                    map.destinationCoords
                ];
                
                map.fitBounds(currentFlightBounds, { padding: [50, 50] });
            }
            
            // Hide map loading indicator
            hideMapLoading();
        });
    });
}

// Function to geocode a location name and add a marker
function addLocationMarker(locationName, isDestination = false, callback = () => {}) {
    // Skip API call for in-transit destinations
    if (isInTransit(locationName)) {
        console.log('Skipping geocoding for transit indicator:', locationName);
        callback(); // Call callback to continue the flow
        return;
    }
    
    // Skip departure markers if setting is disabled
    if (!isDestination && !flightDisplaySettings.showCurrentDeparture) {
        console.log('Skipping departure marker due to settings');
        callback();
        return;
    }

    // Check cache first
    if (coordinatesCache[locationName]) {
        const coords = coordinatesCache[locationName];
        createMarkerAndLine(coords, isDestination);
        callback();
        return;
    }
    
    // Using Nominatim geocoding service
    const encodedLocation = encodeURIComponent(locationName);
    
    showMapLoading(); // Show map-specific loading indicator
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                const coords = [lat, lon];
                
                // Cache the coordinates for future use
                coordinatesCache[locationName] = coords;
                
                createMarkerAndLine(coords, isDestination);
            }
            callback();
            hideMapLoading(); // Hide map-specific loading indicator
        })
        .catch(error => {
            console.error('Error geocoding location:', error);
            hideMapLoading(); // Hide map-specific loading indicator even if error
            callback();
        });
}

function createMarkerAndLine(coords, isDestination) {
    // Create marker with custom icon
    const markerIcon = L.divIcon({
        className: isDestination ? 'destination-marker' : 'departure-marker',
        html: `<div class="marker-pin ${isDestination ? 'destination' : 'departure'}"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });
    
    // Store marker reference for later visibility control
    const marker = L.marker(coords, { icon: markerIcon }).addTo(map);
    
    // Store reference to marker
    if (!isDestination) {
        map.departureMarker = marker;
        map.departureCoords = coords;
    } else {
        map.destinationMarker = marker;
        map.destinationCoords = coords;
    }
    
    // Add flight path if we have both departure and destination
    if (map.departureCoords && isDestination) {
        drawFlightPath(map.departureCoords, coords);
    }
}

function drawFlightPath(fromCoords, toCoords) {
    // Draw dashed line between points
    const polyline = L.polyline([fromCoords, toCoords], {
        color: '#007bff',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(map);
    
    map.currentPolyline = polyline;
    
    // Add animated line for visual effect
    const animatedPolyline = L.polyline([[fromCoords[0], fromCoords[1]]], {
        color: '#ff4757',
        weight: 4
    }).addTo(map);
    
    map.currentAnimatedPolyline = animatedPolyline;
    
    // Add the endpoints to complete the animation
    animatedPolyline.addLatLng(fromCoords);
    animatedPolyline.addLatLng(toCoords);
}

function addMapStyles() {
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
        .flight-marker div {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: white;
            border: 3px solid #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        .map-bounce {
            animation: map-bounce 0.6s ease;
        }
        @keyframes map-bounce {
            0%, 100% {
                transform: translateY(0);
            }
            50% {
                transform: translateY(-10px);
            }
        }
    `;
    document.head.appendChild(style);
}

// Check if a location name indicates in-transit status
function isInTransit(locationName) {
    return !locationName || 
        locationName === "— —" || 
        locationName === "-- --" ||
        (locationName && locationName.includes("—")) ||
        locationName.trim() === "";
}

// Update current departure visibility based on settings
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

// Show map-specific loading indicator
function showMapLoading() {
    document.getElementById('map-loading-overlay').classList.add('active');
}

// Hide map-specific loading indicator
function hideMapLoading() {
    document.getElementById('map-loading-overlay').classList.remove('active');
}
