let historyPage = 0;
const PAGE_SIZE = 10;

function displayData(data) {
    const transit = isInTransit(data.destination);
    const destination = transit ? 'In transit' : data.destination;
    document.getElementById('current-location-status').textContent = destination;
    document.getElementById('departing-location').textContent = data.departing || 'Not reported';
    document.getElementById('destination-location').textContent = transit ? 'Awaiting destination' : destination;
    document.getElementById('destination-date').textContent = transit ? 'Not yet reported' : data.destination_date || 'Not reported';
    document.getElementById('destination-time').textContent = transit ? 'Not yet reported' : data.destination_time || 'Not reported';
    document.getElementById('flight-record-date').textContent = data.destination_date || 'Date unavailable';
    document.getElementById('record-status').textContent = transit ? 'In transit' : 'Reported arrival';
    document.getElementById('location-note').textContent = transit ? 'Arrival pending' : `Reported ${data.destination_date || 'date unavailable'}`;
    const match = locationStore.lookup(data.destination);
    document.getElementById('location-flag').textContent = match?.country?.length === 2
        ? [...match.country].map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join('') : '↗';
}

function displayError() {
    document.getElementById('current-location-status').textContent = 'Record unavailable';
    document.getElementById('record-status').textContent = 'Unable to load';
    document.getElementById('location-note').textContent = 'Unable to load. Refresh to retry.';
    ['departing-location', 'destination-location', 'destination-date', 'destination-time', 'flight-record-date'].forEach(id => {
        document.getElementById(id).textContent = 'Unavailable';
    });
    document.getElementById('map-summary').textContent = 'Latest flight record unavailable';
}

function populateFlightSelector() {
    document.getElementById('flight-selector').innerHTML = historicalFlights.length ? historicalFlights.map((flight, index) => `
        <label class="flight-checkbox-label"><input type="checkbox" value="${index}"><span>${escapeHTML(flight.departing)} → ${escapeHTML(flight.destination)}<small>${escapeHTML(flight.destination_date)}</small></span></label>
    `).join('') : '<p class="loading-message">No completed journeys available.</p>';
}

function renderHistory() {
    const query = document.getElementById('history-search').value.trim().toLocaleLowerCase();
    let flights = historicalFlights.filter(flight => [flight.departing, flight.destination, flight.destination_date, flight.destination_time].join(' ').toLocaleLowerCase().includes(query));
    if (document.getElementById('history-sort').value === 'destination') flights.sort((a, b) => a.destination.localeCompare(b.destination));
    const pages = Math.ceil(flights.length / PAGE_SIZE);
    historyPage = Math.max(0, Math.min(historyPage, pages - 1));
    const start = historyPage * PAGE_SIZE;
    const page = flights.slice(start, start + PAGE_SIZE);
    document.getElementById('history-data').innerHTML = page.length ? page.map(flight => `<tr><td>${escapeHTML(flight.departing || 'Unknown')}</td><td>${escapeHTML(flight.destination)}</td><td>${escapeHTML(flight.destination_date || 'Not reported')}</td><td>${escapeHTML(flight.destination_time || 'Not reported')}</td></tr>`).join('') : '<tr><td colspan="4" class="loading-message">No journeys match your search.</td></tr>';
    document.getElementById('history-count').textContent = flights.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, flights.length)} of ${flights.length} records` : '0 records';
    document.getElementById('page-number').textContent = `${String(historyPage + 1).padStart(2, '0')} / ${String(Math.max(1, pages)).padStart(2, '0')}`;
    document.getElementById('previous-page').disabled = historyPage === 0;
    document.getElementById('next-page').disabled = historyPage >= pages - 1;
}
