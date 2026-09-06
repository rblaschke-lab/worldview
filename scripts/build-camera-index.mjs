#!/usr/bin/env node
/**
 * build-camera-index.mjs — erzeugt data/cameras.json aus offenen Kamerakatalogen.
 *
 * WARUM ZUR BAUZEIT
 * Die Rohkataloge sind zusammen über 3 MB (TfL 1,15 MB · Austin 864 KB ·
 * Caltrans D11 1,04 MB). Die dürfen einem Besucher nicht zugemutet werden.
 * Hier werden sie einmal auf das eingedampft, was die Karte wirklich braucht —
 * Position, Name, Bildzugang — und als eine kompakte Datei ausgeliefert.
 *
 * Zweiter Grund: CORS ist eine reine Browser-Regel. Node kennt sie nicht, also
 * sind hier auch Kataloge nutzbar, die keine CORS-Header senden. Im Browser
 * bleibt nur der Bildabruf übrig, und <img> unterliegt CORS ohnehin nicht.
 *
 * FORMAT (Array-Zeilen statt Objekte — spart ~40 % gegenüber benannten Feldern)
 *   [quelle, id, lat, lon, name, bildUrl?]
 *   bildUrl entfällt, wenn sie sich aus der id ableiten lässt (siehe IMAGE_URL).
 *
 * MOMENTAUFNAHME — WICHTIG
 * Kameras werden abgeschaltet, umbenannt, entfernt. Diese Datei friert den
 * Stand des Bauzeitpunkts ein. Monatlich neu erzeugen; das Frontend blendet
 * tote Bilder sauber aus, aber ein halbes Jahr alter Index wird löchrig.
 *
 * AUFRUF
 *   node scripts/build-camera-index.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'cameras.json');

/** Quellkürzel -> wie das Frontend daraus eine Bild-URL macht. Muss mit main.js übereinstimmen. */
export const IMAGE_URL = {
  t: (id) => `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${id}.jpg`,
  a: (id) => `https://cctv.austinmobility.io/image/${id}.jpg`,
  // c (Caltrans) hat keine ableitbare URL — sie steht als 6. Feld in der Zeile.
};

const round5 = (v) => Math.round(Number(v) * 1e5) / 1e5;

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'GEOPULSE camera index builder' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  return res.json();
}

/** TfL JamCams — ganz London in einem Aufruf. Bild-URL aus der id ableitbar. */
async function tfl() {
  const rows = [];
  const cams = await getJson('https://api.tfl.gov.uk/Place/Type/JamCam');
  for (const c of cams) {
    // Ohne imageUrl ist die Kamera für uns wertlos — es gibt nichts zu zeigen.
    const img = (c.additionalProperties || []).find((p) => p.key === 'imageUrl');
    if (!img?.value || c.lat == null || c.lon == null) continue;
    // id kommt als "JamCams_00002.00865"; die Bild-URL nutzt nur den Teil danach.
    const id = String(c.id).replace(/^JamCams_/, '');
    // Gegenprobe: leitet unsere Vorlage wirklich die veröffentlichte URL her?
    // Wenn TfL das Ablageschema ändert, soll der Bau scheitern, nicht die Karte.
    if (IMAGE_URL.t(id) !== img.value) continue;
    rows.push(['t', id, round5(c.lat), round5(c.lon), String(c.commonName || '').trim()]);
  }
  return rows;
}

/** Austin Open Data — Socrata. Nur eingeschaltete Kameras. */
async function austin() {
  const rows = [];
  const cams = await getJson('https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=5000');
  for (const c of cams) {
    if (c.camera_status !== 'TURNED_ON') continue;
    const coords = c.location?.coordinates;
    if (!coords || !c.camera_id) continue;
    const expected = IMAGE_URL.a(c.camera_id);
    if (c.screenshot_address && c.screenshot_address !== expected) continue;
    const name = String(c.location_name || '').replace(/\s+/g, ' ').trim();
    rows.push(['a', String(c.camera_id), round5(coords[1]), round5(coords[0]), name]);
  }
  return rows;
}

/**
 * Caltrans — je Bezirk eine Datei, Schema variiert.
 * Bild-URL ist NICHT ableitbar und wird darum mitgespeichert.
 * Bezirke, die ein abweichendes Schema liefern, werden gemeldet statt still
 * übersprungen: eine stumme Null wäre nicht von "Bezirk hat keine Kameras" zu
 * unterscheiden.
 */
async function caltrans() {
  const rows = [];
  const districts = ['03', '04', '05', '06', '07', '08', '10', '11', '12'];
  for (const d of districts) {
    const n = Number(d);
    const url = `https://cwwp2.dot.ca.gov/data/d${n}/cctv/cctvStatusD${d}.json`;
    let j;
    try {
      j = await getJson(url);
    } catch (err) {
      console.warn(`  ! Caltrans D${d}: nicht erreichbar (${err.message})`);
      continue;
    }
    const before = rows.length;
    for (const entry of j.data || []) {
      const c = entry?.cctv;
      if (!c?.inService) continue;
      const loc = c.location, img = c.imageData?.static?.currentImageURL;
      if (!loc?.latitude || !img) continue;
      const name = [loc.locationName, loc.nearbyPlace || loc.county].filter(Boolean).join(', ');
      rows.push([
        'c', `${d}-${c.index}`, round5(loc.latitude), round5(loc.longitude),
        name.replace(/\s+/g, ' ').trim(), img,
      ]);
    }
    const got = rows.length - before;
    console.log(`  Caltrans D${d}: ${got}`);
    if (got === 0) console.warn(`  ! D${d} lieferte 0 — abweichendes Schema oder wirklich leer`);
  }
  return rows;
}

const SOURCES = [
  ['TfL London', tfl],
  ['Austin', austin],
  ['Caltrans', caltrans],
];

const all = [];
for (const [label, fn] of SOURCES) {
  console.log(`\n${label} …`);
  try {
    const rows = await fn();
    console.log(`  ${rows.length} Kameras`);
    all.push(...rows);
  } catch (err) {
    // Eine ausgefallene Quelle darf den Bau nicht kippen — aber sie muss laut
    // sein, sonst schrumpft der Index unbemerkt.
    console.error(`  FEHLER bei ${label}: ${err.message}`);
  }
}

// Stabile Sortierung: gleiche Eingabe -> gleiche Datei -> saubere Diffs im Git.
all.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));

/**
 * Abdeckungsregionen — je Quelle Schwerpunkt und Anzahl.
 *
 * WARUM DAS HIER ENTSTEHT UND NICHT IM FRONTEND
 * Die Kameras decken drei Flecken der Erde ab, nicht die Welt. Ohne diese
 * Angabe zoomt jemand in Wiesbaden auf Stadtebene, sieht nichts und hält das
 * Feature für kaputt — die Karte hätte ihm 4.983 Kameras versprochen, ohne zu
 * sagen wo. Das Frontend setzt daraus beim Herauszoomen anklickbare Marken.
 *
 * Wächst automatisch mit: kommt eine Quelle dazu, erscheint ihre Region von
 * selbst — solange sie unten ein Label bekommt.
 */
const REGION_LABEL = {
  t: { de: 'London', en: 'London' },
  a: { de: 'Austin, Texas', en: 'Austin, Texas' },
  c: { de: 'Kalifornien', en: 'California' },
};

const regions = Object.entries(
  all.reduce((acc, c) => {
    (acc[c[0]] ||= []).push(c);
    return acc;
  }, {}),
).map(([key, rows]) => {
  // Schwerpunkt statt Mittelpunkt der Bounding-Box: Kalifornien ist lang und
  // dünn besiedelt, die Box-Mitte läge im Nirgendwo.
  const lat = rows.reduce((s, r) => s + r[2], 0) / rows.length;
  const lon = rows.reduce((s, r) => s + r[3], 0) / rows.length;
  return {
    key,
    count: rows.length,
    lat: round5(lat),
    lon: round5(lon),
    label_de: REGION_LABEL[key]?.de || key,
    label_en: REGION_LABEL[key]?.en || key,
  };
}).sort((a, b) => b.count - a.count);

for (const r of regions) {
  if (!REGION_LABEL[r.key]) console.warn(`  ! Quelle "${r.key}" hat kein Label in REGION_LABEL`);
}

const payload = {
  generated: new Date().toISOString().slice(0, 10),
  attribution: {
    t: 'Powered by TfL Open Data. Contains OS data © Crown copyright and database rights',
    a: 'City of Austin, TX — data.austintexas.gov',
    c: 'Caltrans — cwwp2.dot.ca.gov',
  },
  regions,
  cameras: all,
};

const json = JSON.stringify(payload);
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, json);

console.log(`\n──────────────────────────────`);
console.log(`Kameras gesamt : ${all.length}`);
console.log(`roh            : ${(json.length / 1024).toFixed(1)} KB`);
console.log(`gzip (so wird ausgeliefert): ${(gzipSync(json).length / 1024).toFixed(1)} KB`);
console.log(`geschrieben    : ${path.relative(ROOT, OUT)}`);
