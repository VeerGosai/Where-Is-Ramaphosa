let historicalFlights = [];
let historyRenderVersion = 0;
const flightDisplaySettings = { showMarkers: true, showRoutes: true, showLabels: false, showCurrentDeparture: true };

async function fetchHistoricalFlights() {
    const data = await fetchJSON('history.json');
    if (!Array.isArray(data)) throw new Error('Flight history is not an array');
    historicalFlights = data.filter(entry => entry && !isInTransit(entry.destination)).sort((a, b) => flightOrder(b) - flightOrder(a));
    document.getElementById('history-total').textContent = historicalFlights.length.toLocaleString();
    populateFlightSelector();
    renderHistory();
}

function hideHistoricalFlights() {
    historyRenderVersion++;
    historyLayer?.clearLayers();
    showMapLoading(false);
}

async function applyFlightSettings() {
    if (!map) return;
    hideHistoricalFlights();
    const version = historyRenderVersion;
    const button = document.getElementById('apply-settings');
    const status = document.getElementById('plot-status');
    for (const [key, id] of Object.entries({ showMarkers: 'show-markers', showRoutes: 'show-routes', showLabels: 'show-labels', showCurrentDeparture: 'show-current-departure' })) {
        flightDisplaySettings[key] = document.getElementById(id).checked;
    }
    updateCurrentDepartureVisibility();
    const selection = document.getElementById('flight-count').value;
    let flights;
    if (selection === 'selected') {
        flights = Array.from(document.querySelectorAll('#flight-selector input:checked'), input => historicalFlights[Number(input.value)]).filter(Boolean);
    } else flights = selection === 'all' ? historicalFlights : historicalFlights.slice(0, Number(selection));
    if (!flights.length) { status.textContent = 'Select at least one journey to display.'; return; }
    button.disabled = true;
    status.textContent = `Locating ${flights.length} journeys…`;
    showMapLoading(true);
    try {
        // Resolve unique names once; bundled and persisted entries never reach the API queue.
        const names = [...new Set(flights.flatMap(flight => [flight.departing, flight.destination]))];
        const resolved = new Map();
        for (const name of names) {
            if (version !== historyRenderVersion) return;
            resolved.set(name, await geocodeName(name));
        }
        if (version !== historyRenderVersion) return;
        const bounds = [];
        let plotted = 0;
        flights.forEach((flight, index) => {
            const from = resolved.get(flight.departing), to = resolved.get(flight.destination);
            if (!from || !to) return;
            plotted++;
            bounds.push(from, to);
            if (flightDisplaySettings.showRoutes) {
                L.polyline([from, to], { color: index === 0 ? '#e10600' : '#c16d67', weight: 2, opacity: .65 })
                    .bindPopup(`${escapeHTML(flight.departing)} → ${escapeHTML(flight.destination)}<br>${escapeHTML(flight.destination_date)}`).addTo(historyLayer);
            }
            if (flightDisplaySettings.showMarkers) {
                for (const [coords, name] of [[from, flight.departing], [to, flight.destination]]) {
                    const icon = L.divIcon({ className: 'flight-marker', html: flightDisplaySettings.showLabels ? String(index + 1) : '', iconSize: [20, 20], iconAnchor: [10, 10] });
                    L.marker(coords, { icon }).bindPopup(escapeHTML(name)).addTo(historyLayer);
                }
            }
        });
        if (bounds.length) fitRoutes(bounds);
        const visible = flightDisplaySettings.showRoutes || flightDisplaySettings.showMarkers;
        status.textContent = visible ? `${plotted} of ${flights.length} journeys mapped.${plotted < flights.length ? ' Some locations could not be resolved.' : ''}` : 'Historical layers are hidden. Enable connections or markers to see journeys.';
        document.getElementById('map-summary').textContent = visible ? `${plotted} historical journeys · select a route for details` : 'Historical layers hidden';
    } finally {
        if (version === historyRenderVersion) { button.disabled = false; showMapLoading(false); }
    }
}
