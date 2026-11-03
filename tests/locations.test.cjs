const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function app({ api = async () => ({ ok: true, json: async () => [{ lat: '10', lon: '20' }] }), storage = new Map(), brokenFiles = [], storageThrows = false } = {}) {
    const calls = [];
    const context = vm.createContext({
        console, URL, URLSearchParams, AbortSignal, Intl, Date, setTimeout,
        localStorage: {
            getItem: key => { if (storageThrows) throw Error('denied'); return storage.get(key) || null; },
            setItem: (key, value) => { if (storageThrows) throw Error('denied'); storage.set(key, value); }
        },
        fetch: async (url, options) => {
            calls.push(String(url));
            if (String(url).startsWith('https:')) return api(url, options);
            if (brokenFiles.includes(url)) return { ok: false, status: 404 };
            return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, url))) };
        }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'utils.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'locations.js'), 'utf8') + '\nglobalThis.store = locationStore;', context);
    return { store: context.store, calls, storage };
}
const remote = calls => calls.filter(url => url.startsWith('https:'));

test('bundled global airport codes, names, aliases and cities need no API', async () => {
    const { store, calls } = app();
    for (const name of ['JNB', 'FAOR', 'CPT', 'LHR', 'JFK', 'DXB', 'HND', 'Sydney Kingsford Smith International Airport', 'Heathrow (LHR)', 'CPT / FACT', 'Pretoria, South Africa', 'Tshwane, South Africa', 'East London, South Africa', 'Ysterplaat AFB']) {
        assert.ok(await store.resolve(name), name);
    }
    assert.equal(remote(calls).length, 0);
    assert.equal(calls.filter(url => url === 'data/airports.json').length, 1);
    assert.ok(store.counts().airports > 6000);
    assert.equal(store.lookup('Pretoria, South Africa').kind, 'city');
    assert.equal(store.lookup('Ysterplaat AFB').kind, 'airport');
});

test('misses deduplicate concurrently, persist across reloads and expire', async () => {
    const storage = new Map();
    const first = app({ storage });
    const values = await Promise.all([first.store.resolve('Uncatalogued Test Airport'), first.store.resolve('uncatalogued test airport')]);
    assert.equal(JSON.stringify(values), '[[10,20],[10,20]]');
    assert.equal(remote(first.calls).length, 1);
    const second = app({ storage });
    assert.equal(JSON.stringify(await second.store.resolve('Uncatalogued Test Airport')), '[10,20]');
    assert.equal(remote(second.calls).length, 0);
    const saved = JSON.parse(storage.get('ramaphosa-geocodes-v1'));
    saved['uncatalogued test airport'].expires = 1;
    storage.set('ramaphosa-geocodes-v1', JSON.stringify(saved));
    const third = app({ storage });
    await third.store.resolve('Uncatalogued Test Airport');
    assert.equal(remote(third.calls).length, 1);
});

test('bundled data wins over browser cache; ambiguous city names are not guessed', async () => {
    const storage = new Map([['ramaphosa-geocodes-v1', JSON.stringify({ jnb: { coords: [1, 2], expires: Date.now() + 999999 } })]]);
    const { store, calls } = app({ storage });
    const coords = await store.resolve('JNB');
    assert.ok(coords[0] < -20);
    assert.equal(store.lookup('Hyderabad'), null);
    assert.equal(remote(calls).length, 0);
});

test('unknown, invalid, and failed responses do not become valid locations', async () => {
    for (const api of [async () => ({ ok: true, json: async () => [] }), async () => ({ ok: true, json: async () => [{ lat: '999', lon: '0' }] }), async () => { throw Error('offline'); }]) {
        const { store, calls } = app({ api });
        assert.equal(await store.resolve('Uncatalogued location'), null);
        assert.equal(await store.resolve('Uncatalogued location'), null);
        assert.equal(remote(calls).length, 1);
    }
});

test('transit placeholders never cause requests and storage failures are tolerated', async () => {
    const { store, calls } = app({ storageThrows: true });
    for (const value of [null, '', '— —', '—\u00a0—', '-- --']) assert.equal(await store.resolve(value), null);
    assert.equal(calls.length, 0);
    assert.ok(await store.resolve('JNB'));
    assert.ok(await store.resolve('Uncatalogued location'));
});

test('API fallback still works if the bundled files fail', async () => {
    const { store, calls } = app({ brokenFiles: ['data/airports.json', 'data/cities.json'] });
    assert.ok(await store.resolve('JNB'));
    assert.equal(remote(calls).length, 1);
});

test('distinct API requests are serialized and spaced by at least one second', async () => {
    const times = [];
    const { store } = app({ api: async () => { times.push(Date.now()); return { ok: true, json: async () => [] }; } });
    await Promise.all([store.resolve('Uncatalogued A'), store.resolve('Uncatalogued B')]);
    assert.equal(times.length, 2);
    assert.ok(times[1] - times[0] >= 1000);
});

test('persisted cache and dataset coordinates are validated', async () => {
    const storage = new Map([['ramaphosa-geocodes-v1', JSON.stringify({ 'uncatalogued invalid cache': { coords: ['wrong', 20], expires: Date.now() + 999999 } })]]);
    const { store, calls } = app({ storage });
    assert.ok(await store.resolve('Uncatalogued invalid cache'));
    assert.equal(remote(calls).length, 1);
    for (const [file, field] of [['airports.json', 'airports'], ['cities.json', 'cities']]) {
        for (const row of JSON.parse(fs.readFileSync(path.join(root, 'data', file)))[field]) assert.ok(store.validCoords(row.coords), row.name);
    }
});

test('arrival sorting distinguishes morning and afternoon on the same day', () => {
    const context = vm.createContext({ console, Date, setTimeout });
    vm.runInContext(fs.readFileSync(path.join(root, 'utils.js'), 'utf8') + '\nglobalThis.order = flightOrder;', context);
    const morning = { destination_date: 'Sun 01-Nov-2026', destination_time: '10:14AM SAST' };
    const afternoon = { destination_date: 'Sun 01-Nov-2026', destination_time: '04:07PM SAST' };
    assert.ok(context.order(afternoon) > context.order(morning));
});
