// Global variable to store historical flights
let historicalFlights = [];
let requestQueue = [];
let processingQueue = false;
const maxConcurrentRequests = 3; // Limit concurrent requests to Nominatim

function fetchHistoricalFlightLocations() {
    fetch('history.json')
        .then(response => response.json())
        .then(data => {
            // Filter out transit entries
            const completedFlights = data.filter(entry => !isInTransit(entry.destination));
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
    showMapLoading(); // Use map-specific loading
    
    // Clear existing markers first
    hideHistoricalFlights();
    
    if (!flights || flights.length === 0) {
        hideMapLoading(); // Use map-specific loading
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
        if (isInTransit(flight.destination)) {
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
                // Store these bounds for the recenter button
                currentFlightBounds = bounds;
                map.fitBounds(bounds, { padding: [30, 30] });
            }
            
            // Hide map loading
            setTimeout(() => {
                hideMapLoading();
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

// Update geocodeLocation to skip transit destinations and use cache
function geocodeLocation(locationName, callback) {
    // Skip geocoding for transit indicators
    if (isInTransit(locationName)) {
        console.log('Skipping geocoding for transit indicator:', locationName);
        callback(null); // Call callback with null to indicate no coordinates
        return;
    }
    
    // Check cache first
    if (coordinatesCache && coordinatesCache[locationName]) {
        console.log('Using cached coordinates for:', locationName);
        callback(coordinatesCache[locationName]);
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

// Process geocoding queue with rate limiting
function processGeocodingQueue() {
    if (requestQueue.length === 0) {
        processingQueue = false;
        // Hide loading when all requests are done
        setTimeout(() => {
            hideMapLoading(); // Use map-specific loading
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
            showMapLoading(); // Use map-specific loading
            
            fetch(`https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);
                        const coords = [lat, lon];
                        
                        // Cache the result
                        if (!coordinatesCache) coordinatesCache = {};
                        coordinatesCache[request.locationName] = coords;
                        
                        request.callback(coords);
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
            
            // Completely filter out any transit entries
            const completedFlights = data.filter(entry => {
                // Strict check for transit indicators
                return entry && 
                       entry.destination && 
                       entry.destination !== "— —" && 
                       entry.destination !== "-- --" &&
                       !entry.destination.includes("—") &&
                       entry.destination.trim() !== "";
            });
            
            historicalFlights = completedFlights;
            console.log(`After filtering: ${historicalFlights.length} completed flights`);
            
            // Create pairs of flights (departure and arrival that make a complete journey)
            const flightPairs = createFlightPairs(historicalFlights);
            console.log(`Created ${flightPairs.length} complete flight journeys`);
            
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

// New function to create logical flight pairs for better visualization
function createFlightPairs(flights) {
    const pairs = [];
    
    // Only include flights with actual destinations (not transit)
    for (let i = 0; i < flights.length - 1; i++) {
        pairs.push({
            departure: flights[i].departing,
            destination: flights[i].destination,
            departureDate: flights[i].departure_date || "",
            destinationDate: flights[i].destination_date || "",
            timestamp: flights[i].timestamp || ""
        });
    }
    
    return pairs;
}
