#!/usr/bin/env python3
"""Build the shipped location cache from public bulk datasets, never a geocoding API.

Run from any directory; optional local inputs make regeneration/test runs offline.
"""
import argparse
import csv
import hashlib
import io
import json
import unicodedata
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AIRPORT_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
CITY_URL = 'https://download.geonames.org/export/dump/cities500.zip'
COUNTRIES = {
    'ZA': 'South Africa', 'CI': "Cote d'Ivoire", 'ET': 'Ethiopia', 'MG': 'Madagascar',
    'BE': 'Belgium', 'EG': 'Egypt', 'US': 'United States', 'AE': 'United Arab Emirates',
    'IE': 'Ireland', 'BW': 'Botswana', 'ES': 'Spain', 'VN': 'Vietnam', 'ZW': 'Zimbabwe',
    'ID': 'Indonesia', 'AO': 'Angola', 'SZ': 'Eswatini', 'MZ': 'Mozambique', 'KE': 'Kenya',
    'LS': 'Lesotho', 'NA': 'Namibia', 'JP': 'Japan', 'MY': 'Malaysia', 'SG': 'Singapore', 'CH': 'Switzerland'
}


def normalize(value):
    return ' '.join(''.join(c for c in unicodedata.normalize('NFKD', value).lower()
                            if not unicodedata.combining(c) and c.isalnum() or c.isspace()).split())


def read_source(path, url):
    if path:
        return Path(path).read_bytes()
    request = urllib.request.Request(url, headers={'User-Agent': 'WhereIsRamaphosa-cache-builder/1.0'})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def build(airport_bytes, city_bytes):
    airports = []
    for row in csv.DictReader(io.StringIO(airport_bytes.decode('utf-8-sig'))):
        kind = row['type']
        if kind not in ('large_airport', 'medium_airport') and not (
            kind == 'small_airport' and (row['scheduled_service'] == 'yes' or row['iso_country'] == 'ZA')
        ):
            continue
        lat, lon = float(row['latitude_deg']), float(row['longitude_deg'])
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError(f"Invalid airport coordinate: {row['ident']}")
        airports.append({'id': row['ident'], 'iata': row['iata_code'], 'icao': row.get('icao_code') or '',
                         'name': row['name'], 'city': row['municipality'], 'country': row['iso_country'],
                         'type': kind, 'coords': [round(lat, 6), round(lon, 6)]})
    airports.sort(key=lambda row: row['id'])
    by_id = {row['id']: row for row in airports}
    history = json.loads((ROOT / 'history.json').read_text()) + [json.loads((ROOT / 'data.json').read_text())]
    labels = sorted({entry.get(key, '').strip() for entry in history for key in ('departing', 'destination')
                     if entry.get(key) and any(c.isalpha() for c in entry[key])})
    with zipfile.ZipFile(io.BytesIO(city_bytes)) as archive:
        member = next(name for name in archive.namelist() if name.startswith('cities') and name.endswith('.txt'))
        rows = [line.split('\t') for line in archive.read(member).decode('utf-8').splitlines()]
    # Largest population centres and South African towns are included for future records.
    selected = {r[0]: r for r in sorted(rows, key=lambda r: int(r[14] or 0), reverse=True)[:1000]}
    selected.update({r[0]: r for r in rows if r[8] == 'ZA'})
    aliases_by_id = {}
    index = {}
    for row in rows:
        for name in {row[1], row[2], *row[3].split(',')}:
            index.setdefault((normalize(name), row[8]), {})[row[0]] = row
    # Explicit equivalences, not guesses about which airport a city flight used.
    city_aliases = {
        'Tshwane, South Africa': ('Pretoria', 'ZA', ''),
        'Near Gaborone': ('Gaborone', 'BW', ''), 'Near Maseru': ('Maseru', 'LS', ''),
        'Near Windhoek': ('Windhoek', 'NA', ''), 'Manzini, Swaziland': ('Manzini', 'SZ', ''),
        'New Windsor, NY': ('New Windsor', 'US', 'NY'), 'New York, NY': ('New York City', 'US', 'NY'),
        'Camp Springs, MD': ('Camp Springs', 'US', 'MD'), 'Ota, Japan': ('Ota', 'JP', '40'),
    }
    # These feed labels identify named airfields; other city labels stay city coordinates.
    airport_aliases = {'Ysterplaat AFB': 'FAYP', 'Ysterplaat, South Africa': 'FAYP',
                       'Pilanesberg, South Africa': 'FAPN'}
    country_codes = {normalize(name): code for code, name in COUNTRIES.items()}
    country_codes['za'] = 'ZA'
    unresolved = []
    for label in labels:
        if label in airport_aliases:
            by_id[airport_aliases[label]].setdefault('aliases', []).append(label)
            continue
        parts = [part.strip() for part in label.split(',')]
        name, country, admin = city_aliases.get(label, (parts[0], country_codes.get(normalize(parts[-1]), ''), ''))
        if label == 'Singapore':
            country = 'SG'
        matches = list(index.get((normalize(name), country), {}).values())
        # Prefer the primary spelling over aliases (Durban is also an old alias of Durbanville).
        exact = [row for row in matches if normalize(name) in (normalize(row[1]), normalize(row[2]))]
        if exact:
            matches = exact
        if label == 'Hanoi, Vietnam':
            matches = [row for row in matches if row[0] == '1581130']
        if admin:
            matches = [row for row in matches if row[10] == admin]
        # Avoid silently picking one of several different places with the same name.
        if len(matches) != 1:
            unresolved.append({'label': label, 'candidates': [r[0] for r in matches]})
            continue
        row = matches[0]
        selected[row[0]] = row
        aliases_by_id.setdefault(row[0], []).append(label)
    cities = []
    for row in sorted(selected.values(), key=lambda r: r[0]):
        cities.append({'id': row[0], 'name': row[1], 'country': row[8],
                       'aliases': sorted(set([row[2], *aliases_by_id.get(row[0], [])]) - {row[1]}),
                       'coords': [float(row[4]), float(row[5])]})
    stamp = datetime.now(timezone.utc).isoformat(timespec='seconds')
    airport_doc = {'version': 1, 'generatedAt': stamp, 'source': AIRPORT_URL, 'license': 'Public domain',
                   'sha256': hashlib.sha256(airport_bytes).hexdigest(), 'airports': airports}
    city_doc = {'version': 1, 'generatedAt': stamp, 'source': CITY_URL, 'license': 'CC BY 4.0',
                'attribution': 'GeoNames — https://www.geonames.org/',
                'sha256': hashlib.sha256(city_bytes).hexdigest(), 'cities': cities, 'unresolvedHistory': unresolved}
    return airport_doc, city_doc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--airports-csv')
    parser.add_argument('--cities-zip')
    args = parser.parse_args()
    airports, cities = build(read_source(args.airports_csv, AIRPORT_URL), read_source(args.cities_zip, CITY_URL))
    if len(airports['airports']) < 4000 or len(cities['cities']) < 1000:
        raise ValueError('Unexpectedly small source dataset; existing cache was not replaced.')
    directory = ROOT / 'data'
    directory.mkdir(exist_ok=True)
    for name, data in [('airports.json', airports), ('cities.json', cities)]:
        target = directory / name
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        temporary.replace(target)
    print(f"Saved {len(airports['airports']):,} airports and {len(cities['cities']):,} cities.")
    print('Unresolved history labels:', json.dumps(cities['unresolvedHistory']))


if __name__ == '__main__':
    main()
