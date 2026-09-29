#!/usr/bin/env node
'use strict';
/*
 * filtrer-journal.cjs — allège, en flux, un journal Orbite qui embarque aussi les données d'Écho.
 *
 *   node tools/filtrer-journal.cjs JOURNAL.json[.gz] SORTIE.json
 *
 * L'export « Tout télécharger pour l'analyse » d'Orbite porte l'état du lot, mais aussi les événements et les visites
 * d'Écho de toute la session du navigateur (KI-068) : après six relectures, un journal de 3,5 Mo devient 1 Go (786 Mo
 * de visites, 245 Mo d'événements). Ce filtre garde l'état, la clôture et les événements / visites qui ne portent ni
 * `nativeSessionId`, ni `railSnapshots`, ni `observationPeriodId` (marques d'Écho), sans jamais charger le fichier
 * entier en mémoire. Sur un journal sans données d'Écho, la sortie est identique à l'entrée.
 */
const fs = require('node:fs'), zlib = require('node:zlib'), { StringDecoder } = require('node:string_decoder');

const natif = el => el.includes('"nativeSessionId"') || el.includes('"railSnapshots"') || el.includes('"observationPeriodId"');

function filtrer(entree, sortie) {
  return new Promise((resolve, reject) => {
    const dec = new StringDecoder('utf8'), sorties = { events: [], records: [] }, haut = {}, stat = { events: { lus: 0, gardes: 0 }, records: { lus: 0, gardes: 0 } };
    let depth = 0, inStr = false, esc = false, strBuf = '', lastStr = null, key = null, cur = '', inEl = false, capture = false, valBuf = '';
    let src = fs.createReadStream(entree); if (/\.gz$/i.test(entree)) src = src.pipe(zlib.createGunzip());
    src.on('error', reject);
    src.on('data', b => {
      const s = dec.write(b);
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (capture) valBuf += c;
        if (inEl) cur += c;
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') { inStr = false; lastStr = strBuf; } else if (depth <= 1) strBuf += c; continue; }
        if (c === '"') { inStr = true; strBuf = ''; continue; }
        if (c === '{' || c === '[') { depth++; if ((key === 'events' || key === 'records') && depth === 3 && c === '{') { inEl = true; cur = '{'; } continue; }
        if (c === '}' || c === ']') {
          if (inEl && depth === 3) { stat[key].lus++; if (!natif(cur)) { stat[key].gardes++; sorties[key].push(cur); } inEl = false; cur = ''; }
          depth--;
          if (depth === 1 && capture) { haut[key] = valBuf.replace(/,\s*$/, ''); capture = false; valBuf = ''; }
          continue;
        }
        if (c === ',' && depth === 1 && capture) { haut[key] = valBuf.slice(0, -1).trim(); capture = false; valBuf = ''; continue; }
        if (c === ':' && depth === 1) { key = lastStr; capture = key !== 'events' && key !== 'records'; valBuf = ''; }
      }
    });
    src.on('end', () => {
      try {
        const morceaux = Object.entries(haut).map(([k, v]) => JSON.stringify(k) + ':' + v);
        const texte = '{' + morceaux.join(',') + ',"events":[' + sorties.events.join(',') + '],"records":[' + sorties.records.join(',') + ']}';
        JSON.parse(texte); fs.writeFileSync(sortie, texte);
        resolve({ ...stat, octets: texte.length });
      } catch (e) { reject(e); }
    });
  });
}

if (require.main === module) {
  const [entree, sortie] = process.argv.slice(2);
  if (!entree || !sortie) { console.error('Usage : node tools/filtrer-journal.cjs JOURNAL.json[.gz] SORTIE.json'); process.exit(1); }
  filtrer(entree, sortie).then(s => console.log(JSON.stringify(s)), e => { console.error(e.stack || e); process.exitCode = 1; });
}
module.exports = { filtrer, natif };
