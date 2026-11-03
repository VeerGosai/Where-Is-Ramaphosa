# Where Is Ramaphosa

An independent portal for public LMG1 aircraft records. The dashboard shows the latest reported journey and a searchable archive; aircraft records do not confirm a passenger's location.

Website: https://veergosai.github.io/Where-Is-Ramaphosa/

## Run locally

No build or frontend dependencies are required. Serve the repository over HTTP:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Opening `index.html` directly as a file will not work because the portal fetches local JSON files.

The compact interface follows a red, white, and black design with square edges and supports Light, Dark, and System themes. Theme preferences persist across the dashboard and About page. Theme, flight-count, and sort controls use custom in-page dropdowns with keyboard navigation, type-ahead, and Escape/outside-click dismissal. The font stack uses Geist Pixel when installed and falls back to Helvetica/Arial.

## Location cache

The repository ships actual downloaded coordinates, rather than requesting every airport from an API:

- `data/airports.json`: 6,620 airports from OurAirports. Includes all large and medium airports in the source, smaller airports with scheduled service, and South African small airports. Lookup accepts airport names, IATA/ICAO codes, and explicit aliases.
- `data/cities.json`: 1,992 places from GeoNames. Includes the 1,000 most populous places in the source, South African towns, and matches for existing flight records. City labels resolve to approximate city coordinates, not an assumed airport. Explicit airfield labels resolve to airfields.
- Each file records source URL, source checksum, generation time, and licence. Ambiguous/unmatched historical labels are listed in `unresolvedHistory`; Aggeneys, Boschkop and Gran Canaria currently fall back to the configured API.

Resolution order: **bundled JSON → persistent browser cache → configured API**. Bundled datasets load once per page. Concurrent lookups for the same normalized label share one request. Successful API coordinates are cached for 180 days, no-result responses for one day, and network failures only briefly in memory. Browser storage is bounded to 500 entries; blocked or corrupt storage does not prevent the portal working. Map tiles remain network resources and use the browser's normal HTTP cache; the portal is not a fully offline map.

Regenerate both JSON files using Python's standard library:

```sh
python3 scripts/refresh-locations.py
```

This downloads the source CSV/ZIP in bulk, not thousands of geocoding requests. It preserves the existing cache on download/parse failure. Offline regeneration from previously downloaded files is supported:

```sh
python3 scripts/refresh-locations.py --airports-csv /path/to/airports.csv --cities-zip /path/to/cities500.zip
```

The cache is committed as static data; refreshing it does not modify flight records or run the scraper. Run the refresh command when updating the catalogue, then deploy the changed JSON along with the site.

## Map and API configuration

`data/map-config.json` configures the tile URL, attribution, max zoom, geocoding endpoint, and request spacing. The default map uses **OpenStreetMap standard tiles without an API key**. Dark mode adjusts the tile pane in CSS, leaving route and marker colours intact. Tiles are requested only for the visible map and retain visible attribution. See the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

The existing Nominatim fallback is now serialized with at least 1.1 seconds between requests, timeouts, a cooldown for throttling, and persistent caching. There is no speculative history geocoding or autocomplete. The [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) limits traffic to **one request per second across the whole application**, not per visitor. The client queue only limits an individual page: a busy public deployment must use a shared rate-limited caching proxy or a suitable hosted/self-hosted geocoder. Change `geocodingUrl` to a compatible endpoint in the JSON configuration, or set it to an empty string to use local coordinates only. Never place secret API credentials in this public file.

## Data credits

- [OurAirports](https://ourairports.com/data/): public-domain airport data, selected and reformatted into JSON.
- [GeoNames](https://www.geonames.org/): city data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), selected and reformatted with local aliases. Original download: https://download.geonames.org/export/dump/cities500.zip.
- [OpenStreetMap contributors](https://www.openstreetmap.org/copyright): map data and fallback geocoding, under ODbL.

## Verification

```sh
node --test tests/*.test.cjs
```

Tests cover local lookup, code aliases, cache priority and expiry, concurrent request deduplication, rate limiting, invalid responses, unavailable local files, and disabled browser storage.

## Flight collection

The existing GitHub Action runs `scrape.js` using Puppeteer every two hours. It reads the public FlightAware LMG1 record and writes `data.json` and `history.json`. Historical entries can be delayed, repeated, or incomplete; map lines simply connect reported places.

Aircraft associated with the project's original scope include the Boeing 737-800 (ZS-RSA), Gulfstream G5 (ZS-GKA), Dassault Falcon 900EX (ZS-FCI), and chartered aircraft. The portal does not independently verify aircraft occupants.
