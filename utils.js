function isInTransit(value) {
    return typeof value !== 'string' || !value.trim() || /^[\s—–-]+$/.test(value);
}

function parseFlightDate(value) {
    const match = String(value || '').match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (!match) return new Date(0);
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(match[2]);
    return month < 0 ? new Date(0) : new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function fetchJSON(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
    return response.json();
}

const progressBar = {
    start() { const el = document.getElementById('top-progress'); el.style.opacity = '1'; el.firstElementChild.style.width = '25%'; },
    finish() { const el = document.getElementById('top-progress'); el.firstElementChild.style.width = '100%'; setTimeout(() => { el.style.opacity = '0'; }, 250); }
};

function flightOrder(flight) {
    const day = parseFlightDate(flight.destination_date).getTime();
    const match = String(flight.destination_time || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return day;
    let hour = Number(match[1]);
    if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return day + (hour * 60 + Number(match[2])) * 60000;
}
