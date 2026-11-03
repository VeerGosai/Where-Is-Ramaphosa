let map;
let latestBounds = null;
let displayedBounds = null;
let currentFlightLayer;
let latestDeparture;
let latestPath;
let historyLayer;
let currentMapMessage = '';

function setMapMessage(message) {
    currentMapMessage = message;
    const el = document.getElementById('map-message');
    el.textContent = message;
    el.hidden = !message;
}

async function initializeMap(data) {
    if (typeof L === 'undefined') {
        setMapMessage('The map library could not load. Flight records are still available below.');
        return;
    }
    const { config } = await locationStore.load();
    map = L.map('map', { scrollWheelZoom: false }).setView([-28.5, 25], 5);
    const tiles = L.tileLayer(config.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: config.attribution || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: config.maxZoom || 19
    });
    const tileError = 'Map tiles are unavailable. Flight records and route overlays remain accessible.';
    tiles.on('tileerror', () => setMapMessage(tileError));
    tiles.on('load', () => {
        // A finished batch can contain errors, so only clear when every visible tile loaded.
        const failed = document.querySelector('#map .leaflet-tile:not(.leaflet-tile-loaded)');
        if (!failed && currentMapMessage === tileError) setMapMessage('');
    });
    tiles.addTo(map);
    currentFlightLayer = L.layerGroup().addTo(map);
    historyLayer = L.layerGroup().addTo(map);
    document.getElementById('recenter-map').addEventListener('click', recenterMap);
    document.getElementById('reset-map').addEventListener('click', () => {
        displayedBounds = null;
        map.setView([-28.5, 25], 5);
    });
    const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ pan: false });
        if (displayedBounds?.length) fitRoutes(displayedBounds);
    });
    resizeObserver.observe(document.getElementById('map'));
    if (data) await plotCurrentFlight(data);
}

function makePoint(coords, name, destination, layer = currentFlightLayer) {
    const icon = L.divIcon({ className: 'map-marker', html: `<div class="map-point ${destination ? 'destination' : 'departure'}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] });
    return L.marker(coords, { icon }).bindPopup(escapeHTML(name)).addTo(layer);
}

async function plotCurrentFlight(data) {
    showMapLoading(true);
    try {
        const [from, to] = await Promise.all([geocodeName(data.departing), geocodeName(data.destination)]);
        if (from) latestDeparture = makePoint(from, data.departing, false);
        if (to) makePoint(to, data.destination, true);
        latestBounds = [from, to].filter(Boolean);
        if (from && to) latestPath = L.polyline([from, to], { color: '#e10600', weight: 2.5, dashArray: '7 7', opacity: .9 }).addTo(currentFlightLayer);
        if (latestBounds.length) recenterMap();
        if (!from || (!to && !isInTransit(data.destination))) setMapMessage('Some locations could not be resolved. Available locations are shown.');
        document.getElementById('map-summary').textContent = isInTransit(data.destination)
            ? 'In transit · destination not yet reported' : 'Latest reported journey · LMG1';
    } finally { showMapLoading(false); }
}

function recenterMap() {
    if (!map) return;
    if (latestBounds?.length) fitRoutes(latestBounds);
    else map.setView([-28.5, 25], 5);
}

function fitRoutes(bounds) {
    displayedBounds = bounds;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9, animate: false });
}

function updateCurrentDepartureVisibility() {
    if (!map || !currentFlightLayer) return;
    for (const layer of [latestDeparture, latestPath].filter(Boolean)) {
        if (flightDisplaySettings.showCurrentDeparture) currentFlightLayer.addLayer(layer);
        else currentFlightLayer.removeLayer(layer);
    }
}

function showMapLoading(active) { document.getElementById('map-loading-overlay').hidden = !active; }
