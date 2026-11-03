// Shared resolver for latest and historical routes. Bundled data always wins.
const locationStore = (() => {
    const STORAGE_KEY = 'ramaphosa-geocodes-v1';
    const POSITIVE_TTL = 180 * 86400000;
    const NEGATIVE_TTL = 86400000;
    const index = new Map();
    const pending = new Map();
    const runtime = new Map();
    let ready;
    let queue = Promise.resolve();
    let nextRequestAt = 0;
    let config = { geocodingUrl: '', geocodingIntervalMs: 1100 };
    let counts = { airports: 0, cities: 0 };
    const countryNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

    function normalize(value) {
        return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
    }
    function validCoords(coords) {
        return Array.isArray(coords) && coords.length === 2 && coords.every(Number.isFinite)
            && Math.abs(coords[0]) <= 90 && Math.abs(coords[1]) <= 180;
    }
    function add(key, record) {
        key = normalize(key);
        if (!key) return;
        if (index.has(key) && index.get(key)?.id !== record.id) index.set(key, null); // Ambiguous: use API.
        else if (!index.has(key)) index.set(key, record);
    }
    function countryLabel(code) { try { return countryNames?.of(code) || code; } catch { return code; } }
    function addRecord(row, kind) {
        if (!validCoords(row.coords)) return;
        const record = { id: `${kind}:${row.id}`, coords: row.coords, name: row.name, country: row.country, kind };
        const names = [row.name, ...(row.aliases || [])];
        for (const name of names) {
            add(name, record);
            if (!name.includes(',')) {
                add(`${name}, ${row.country}`, record);
                add(`${name}, ${countryLabel(row.country)}`, record);
            }
        }
        if (kind === 'airport') {
            [row.id, row.iata, row.icao].filter(Boolean).forEach(code => add(code, record));
            // Do not map municipality names to airports: the feed may only identify a city.
        }
    }
    function hydrate() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            for (const [key, entry] of Object.entries(data)) {
                if (entry && Number.isFinite(entry.expires) && entry.expires > Date.now()
                    && (entry.coords === null || validCoords(entry.coords))) runtime.set(key, entry);
            }
        } catch { /* Corrupt/unavailable storage must not break location lookups. */ }
    }
    function persist() {
        // Bound storage growth; retain the most recent 500 lookups only.
        while (runtime.size > 500) runtime.delete(runtime.keys().next().value);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(runtime))); } catch { /* In-memory cache still works. */ }
    }
    function load() {
        if (!ready) ready = (async () => {
            hydrate();
            const results = await Promise.allSettled([fetchJSON('data/airports.json'), fetchJSON('data/cities.json'), fetchJSON('data/map-config.json')]);
            const [airports, cities, settings] = results;
            if (airports.status === 'fulfilled') {
                (airports.value.airports || []).forEach(row => addRecord(row, 'airport'));
                counts.airports = airports.value.airports.length;
            }
            if (cities.status === 'fulfilled') {
                (cities.value.cities || []).forEach(row => addRecord(row, 'city'));
                counts.cities = cities.value.cities.length;
            }
            if (settings.status === 'fulfilled') config = { ...config, ...settings.value };
            return { ...counts, config };
        })();
        return ready;
    }
    function lookup(name) {
        const exact = index.get(normalize(name));
        if (exact) return exact;
        // Accept common provider labels such as "Heathrow (LHR)" and "CPT / FACT".
        const codes = String(name).match(/\(([A-Z0-9]{3,4})\)|\b([A-Z]{3})\s*\/\s*([A-Z]{4})\b/);
        if (codes) return index.get(normalize(codes[1] || codes[2])) || null;
        return null;
    }
    async function resolve(name) {
        if (isInTransit(name)) return null;
        await load();
        const local = lookup(name);
        if (local) return local.coords;
        const key = normalize(name);
        const cached = runtime.get(key);
        if (cached && cached.expires > Date.now()) return cached.coords;
        if (pending.has(key)) return pending.get(key);
        if (!config.geocodingUrl) return null;
        const task = queue.then(async () => {
            const wait = Math.max(0, nextRequestAt - Date.now());
            if (wait) await new Promise(resolve => setTimeout(resolve, wait));
            nextRequestAt = Date.now() + Math.max(1100, Number(config.geocodingIntervalMs) || 1100);
            try {
                const url = new URL(config.geocodingUrl);
                url.search = new URLSearchParams({ q: name, format: 'json', limit: '1' }).toString();
                const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
                if (!response.ok) {
                    if (response.status === 429 || response.status === 503) nextRequestAt = Date.now() + 60000;
                    throw new Error(`Geocoder returned ${response.status}`);
                }
                const data = await response.json();
                if (!Array.isArray(data)) throw new Error('Invalid geocoder response');
                if (data.length && (!data[0] || data[0].lat == null || data[0].lon == null
                    || String(data[0].lat).trim() === '' || String(data[0].lon).trim() === '')) throw new Error('Missing geocoder coordinates');
                const candidate = data.length ? [Number(data[0].lat), Number(data[0].lon)] : null;
                if (candidate && !validCoords(candidate)) throw new Error('Invalid geocoder coordinates');
                const coords = candidate;
                runtime.delete(key);
                runtime.set(key, { coords, expires: Date.now() + (coords ? POSITIVE_TTL : NEGATIVE_TTL) });
                persist();
                return coords;
            } catch (error) {
                // Network failures are not "not found": suppress repeats only for this session.
                runtime.set(key, { coords: null, expires: Date.now() + 60000 });
                console.warn(`Location unavailable: ${name}`, error.message);
                return null;
            }
        });
        pending.set(key, task);
        queue = task.catch(() => null);
        try { return await task; } finally { pending.delete(key); }
    }
    return { load, resolve, lookup, normalize, validCoords, counts: () => ({ ...counts }) };
})();

function geocodeName(name) { return locationStore.resolve(name); }
