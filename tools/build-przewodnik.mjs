// Builds the audio guide's API from the source folders in przewodnik/.
//
//   node tools/build-przewodnik.mjs <out dir> <contentVersion>
//
// Writes <out>/content.json and <out>/files/<sha256>.<ext>, the shape the
// app reads. Files are named by their hash, so the app downloads only what
// changed. Stops with a list of problems if the sources do not add up.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = 'przewodnik';
const [out, versionArg] = process.argv.slice(2);
const contentVersion = Number(versionArg);
if (!out || !Number.isInteger(contentVersion) || contentVersion < 1) {
  console.error('usage: node tools/build-przewodnik.mjs <out dir> <contentVersion>');
  process.exit(2);
}

const problems = [];
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    problems.push(`${path}: ${e.message}`);
    return null;
  }
};
const list = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : []);

const settings = readJson(join(SRC, 'ustawienia.json')) ?? {};
const cities = readJson(join(SRC, 'miasta.json')) ?? [];
const cityIds = new Set(cities.map((c) => c.id));
if (cityIds.size !== cities.length) problems.push('miasta.json: an id is used twice');

const files = {};
mkdirSync(join(out, 'files'), { recursive: true });
const addFile = (attraction, name) => {
  const where = `atrakcje/${attraction}/${name}`;
  const path = join(SRC, 'atrakcje', attraction, name);
  if (!existsSync(path)) {
    problems.push(`${where}: file is missing`);
    return;
  }
  const data = readFileSync(path);
  const sha256 = createHash('sha256').update(data).digest('hex');
  const served = `files/${sha256}${extname(name).toLowerCase()}`;
  copyFileSync(path, join(out, served));
  files[`${attraction}/${name}`] = { path: served, sha256, size: data.length };
};

const attractions = [];
for (const id of list(join(SRC, 'atrakcje'))) {
  const a = readJson(join(SRC, 'atrakcje', id, 'atrakcja.json'));
  if (!a) continue;
  const where = `atrakcje/${id}/atrakcja.json`;
  for (const key of ['title', 'city', 'latitude', 'longitude', 'photo', 'audio']) {
    if (a[key] === undefined) problems.push(`${where}: "${key}" is missing`);
  }
  if (a.city !== undefined && !cityIds.has(a.city)) problems.push(`${where}: no city "${a.city}" in miasta.json`);
  for (const line of a.practical ?? []) {
    if (!line.text) problems.push(`${where}: a "practical" line has no "text"`);
    if (line.kind !== 'listen' && line.kind !== 'entry') problems.push(`${where}: "practical" kind is "listen" or "entry"`);
  }
  if (a.photo) addFile(id, a.photo);
  if (a.marker) addFile(id, a.marker);
  for (const part of a.audio ?? []) {
    if (part.file) addFile(id, part.file);
    else problems.push(`${where}: an audio part has no "file"`);
  }
  attractions.push({ id, ...a });
}
const attractionIds = new Set(attractions.map((a) => a.id));

const routes = [];
for (const name of list(join(SRC, 'trasy')).filter((n) => n.endsWith('.json'))) {
  const id = name.slice(0, -'.json'.length);
  const r = readJson(join(SRC, 'trasy', name));
  if (!r) continue;
  const where = `trasy/${name}`;
  if (!cityIds.has(r.city)) problems.push(`${where}: no city "${r.city}" in miasta.json`);
  for (const stop of r.stops ?? []) {
    if (!attractionIds.has(stop)) problems.push(`${where}: no attraction "${stop}"`);
  }
  if ((r.legs ?? []).length !== Math.max(0, (r.stops ?? []).length - 1)) {
    problems.push(`${where}: needs one leg fewer than stops`);
  }
  routes.push({ id, ...r });
}

// Trips: what the company sells, each a list of the cities its guides cover. A city without
// attractions yet shows in the app as "w przygotowaniu".
const trips = readJson(join(SRC, 'wyjazdy.json')) ?? [];
const tripIds = new Set();
for (const t of trips) {
  const where = `wyjazdy.json: trip "${t.id}"`;
  if (!t.id || tripIds.has(t.id)) problems.push(`${where}: "id" is missing or used twice`);
  tripIds.add(t.id);
  if (!t.title) problems.push(`${where}: "title" is missing`);
  if (!(t.locations ?? []).length) problems.push(`${where}: "locations" needs at least one city`);
  for (const city of t.locations ?? []) {
    if (!cityIds.has(city)) problems.push(`${where}: no city "${city}" in miasta.json`);
  }
  if (t.cover !== undefined && !attractionIds.has(t.cover)) problems.push(`${where}: no attraction "${t.cover}" for "cover"`);
}

if (problems.length) {
  console.error(`Przewodnik: ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

const content = {
  contentVersion,
  trips,
  cities,
  attractions,
  routes,
  minAppVersionCode: settings.minAppVersionCode ?? 1,
  files,
};
writeFileSync(join(out, 'content.json'), JSON.stringify(content, null, 2) + '\n');
console.log(`Przewodnik v${contentVersion}: ${trips.length} trips, ${cities.length} cities, ${attractions.length} attractions, ${routes.length} routes, ${Object.keys(files).length} files`);
