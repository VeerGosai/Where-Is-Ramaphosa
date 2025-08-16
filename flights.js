// Global variable to store historical flights
let historicalFlights = [];
let requestQueue = [];
let processingQueue = false;
// Use hardware-aware concurrency (fallback to 6)
const maxConcurrentRequests = (typeof MAX_CONCURRENCY !== 'undefined' ? MAX_CONCURRENCY : 6);

// Live geocoding counters for UI
let geoTotal = 0;
let geoDone = 0;
let geoStartTs = 0; // start time for ETA

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
    showMapLoading();
    if (window.progressBar) progressBar.start();
    hideHistoricalFlights();
    if (!flights || flights.length === 0) {
        hideMapLoading();
        return;
    }

    // Compute total geocoding tasks (parallel via queue)
    geoTotal = flights.reduce((acc, f) => {
        let add = 0;
        if (f && f.departing && !isInTransit(f.departing)) add++;
        if (f && f.destination && !isInTransit(f.destination)) add++;
        return acc + add;
    }, 0);
    geoDone = 0;
    geoStartTs = Date.now();
    updateGeoProgress();

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

        // Update progress proportionally
        if (window.progressBar && completedFlights.target > 0) {
            const ratio = completedFlights.count / completedFlights.target;
            progressBar.set(Math.min(0.95, 0.2 + ratio * 0.7));
        }

        if (completedFlights.count >= completedFlights.target) {
            // All flights processed, fit map to bounds if any
            console.log('All flights processed');
            if (bounds.length > 0) {
                // Store these bounds for the recenter button
                currentFlightBounds = bounds;
                map.fitBounds(bounds, { padding: [30, 30] });
            }

            // Hide map loading + geo indicator
            setTimeout(() => {
                hideMapLoading();
                finishGeoProgress();
                if (window.progressBar) progressBar.finish();
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
        callback(null);
        return;
    }

    // Check cache first
    if (coordinatesCache && coordinatesCache[locationName]) {
        console.log('Using cached coordinates for:', locationName);
        // Count as done for the geo UI
        geoDone++;
        updateGeoProgress();
        callback(coordinatesCache[locationName]);
        return;
    }

    // Add to queue instead of executing immediately; wrap callback to update counts
    requestQueue.push({
        locationName,
        callback: (coords) => {
            geoDone++;
            updateGeoProgress();
            callback(coords);
        }
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
        }, 500);
        return;
    }

    processingQueue = true;

    // Process multiple requests in parallel, up to the limit
    const batch = requestQueue.splice(0, maxConcurrentRequests);
    const promises = batch.map(request => {
        return new Promise((resolve) => {
            const encodedLocation = encodeURIComponent(request.locationName);
            showMapLoading(); // Use map-specific loading

            fetch(`https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);
                        const coords = [lat, lon];

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
        setTimeout(processGeocodingQueue, 200); // small spacing to stay polite
    });
}

// Geo-progress helpers
function updateGeoProgress() {
    const box = document.getElementById('geo-progress');
    const doneEl = document.getElementById('geo-done');
    const totalEl = document.getElementById('geo-total');
    const etaEl = document.getElementById('geo-eta');
    if (!box || !doneEl || !totalEl) return;

    totalEl.textContent = String(geoTotal);
    doneEl.textContent = String(geoDone);
    box.hidden = geoTotal === 0;

    // ETA
    if (etaEl) {
        const remaining = Math.max(geoTotal - geoDone, 0);
        if (geoDone > 0 && remaining > 0) {
            const elapsedMs = Math.max(Date.now() - geoStartTs, 1);
            const avgPerTaskMs = elapsedMs / geoDone;
            const etaSec = Math.ceil((remaining * avgPerTaskMs) / 1000);
            etaEl.textContent = `ETA ${formatETA(etaSec)}`;
        } else if (remaining === 0 && geoTotal > 0) {
            etaEl.textContent = 'ETA 00:00';
        } else {
            etaEl.textContent = 'ETA —';
        }
    }
}

function finishGeoProgress() {
    const box = document.getElementById('geo-progress');
    const etaEl = document.getElementById('geo-eta');
    if (etaEl) etaEl.textContent = 'ETA 00:00';
    if (box) box.hidden = true;
}

// Simple mm:ss formatter
function formatETA(totalSeconds) {
    const s = Math.max(0, totalSeconds | 0);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fetchHistoricalFlights() {
    console.log('Fetching historical flights...');
    // Return the promise chain so callers can await progress
    return fetch('history.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(text => {
            try {
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
