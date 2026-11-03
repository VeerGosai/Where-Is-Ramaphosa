document.addEventListener('DOMContentLoaded', async () => {
    progressBar.start();
    document.getElementById('history-search').addEventListener('input', () => { historyPage = 0; renderHistory(); });
    document.getElementById('history-sort').addEventListener('change', () => { historyPage = 0; renderHistory(); });
    document.getElementById('previous-page').addEventListener('click', () => { historyPage--; renderHistory(); });
    document.getElementById('next-page').addEventListener('click', () => { historyPage++; renderHistory(); });
    document.getElementById('apply-settings').addEventListener('click', applyFlightSettings);
    document.getElementById('clear-history').addEventListener('click', () => {
        hideHistoricalFlights();
        document.getElementById('apply-settings').disabled = !map || !historicalFlights.length;
        document.getElementById('show-current-departure').checked = true;
        flightDisplaySettings.showCurrentDeparture = true;
        updateCurrentDepartureVisibility();
        recenterMap();
        document.getElementById('plot-status').textContent = 'Showing the latest flight.';
        document.getElementById('map-summary').textContent = 'Latest reported journey · LMG1';
    });
    document.getElementById('flight-selector').addEventListener('change', () => { document.getElementById('flight-count').value = 'selected'; document.getElementById('flight-count').dispatchEvent(new Event('dropdown:sync')); });
    for (const [id, checked] of [['select-all', true], ['select-none', false]]) {
        document.getElementById(id).addEventListener('click', () => {
            document.querySelectorAll('#flight-selector input').forEach(input => { input.checked = checked; });
            document.getElementById('flight-count').value = 'selected'; document.getElementById('flight-count').dispatchEvent(new Event('dropdown:sync'));
        });
    }
    const latestTask = (async () => {
        let data;
        try {
            [data] = await Promise.all([fetchJSON('data.json'), locationStore.load()]);
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid latest record');
            displayData(data);
        } catch (error) { console.warn(error); displayError(); }
        try { await initializeMap(data); } catch (error) { console.warn(error); setMapMessage('The map could not load. Flight records remain available below.'); }
    })();
    const historyTask = fetchHistoricalFlights().catch(error => {
        console.warn(error);
        document.getElementById('history-data').innerHTML = '<tr><td colspan="4" class="loading-message">Flight history could not load. Refresh to try again.</td></tr>';
        document.getElementById('history-count').textContent = 'History unavailable';
        document.getElementById('history-total').textContent = '—';
        document.getElementById('flight-selector').textContent = 'Flight history unavailable.';
    });
    await Promise.allSettled([latestTask, historyTask]);
    document.getElementById('apply-settings').disabled = !map || !historicalFlights.length;
    progressBar.finish();
});
