#!/usr/bin/env node
'use strict';
/*
 * mesure-bilan-reference.cjs — CH-049-C. Mesure ce que gagnerait le bilan de « Tout télécharger » à ne pas recopier les événements du journal
 * (src/native-export.js : `evenementsParReference`, `rehydraterEvenements`) et prouve la relecture à l'identique. Lecture seule.
 *
 *   node tools/mesure-bilan-reference.cjs --journal JOURNAL.json --bilan BILAN.json [--json sortie.json]
 *
 * (Les fichiers JSON s'extraient des volumes : `unzip -o volume.zip -d DOSSIER`.) Sort 0 si la liste d'événements relue égale celle du bilan d'origine.
 */
const fs = require('node:fs'), zlib = require('node:zlib');
const X = require('../src/native-export.js');
const argv = process.argv.slice(2), opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const fj = opt('--journal'), fb = opt('--bilan');
if (!fj || !fb) { console.error('Usage : --journal JOURNAL.json --bilan BILAN.json [--json sortie.json]'); process.exit(1); }
const def = b => zlib.deflateRawSync(b, { level: 6 }).length, mo = n => (n / 1e6).toFixed(1);
const J = JSON.parse(fs.readFileSync(fj, 'utf8'));
const brut = fs.readFileSync(fb);
const B = X.expand(JSON.parse(brut));
const t0 = Date.now();
const ref = X.evenementsParReference(B.events, J.events);
const tRef = Date.now() - t0;
if (!ref) { console.log('Pas de référence possible : le bilan n’est pas le journal plus des insertions.'); process.exit(3); }
const t1 = Date.now();
const relu = X.rehydraterEvenements(ref, J.events);
const tRel = Date.now() - t1;
const identique = relu.length === B.events.length && relu.every((e, i) => JSON.stringify(e) === JSON.stringify(B.events[i]));
const leger = Buffer.from(JSON.stringify(X.compact({ ...B, events: [], evenementsParReference: ref }, {})));
const r = { evenementsBilan: B.events.length, evenementsJournal: J.events.length, ajouts: ref.ajouts.map(a => ({ position: a.position, type: a.evenement.type })),
  bilanBrutAvant: brut.length, bilanBrutApres: leger.length, bilanZipAvant: def(brut), bilanZipApres: def(leger), msReference: tRef, msRelecture: tRel, identique };
console.log(`événements : bilan ${r.evenementsBilan}, journal ${r.evenementsJournal}, ajouts ${r.ajouts.length} (${r.ajouts.map(a => a.type + '@' + a.position).join(', ')})`);
console.log(`bilan : ${mo(r.bilanBrutAvant)} -> ${mo(r.bilanBrutApres)} Mo brut, ${mo(r.bilanZipAvant)} -> ${mo(r.bilanZipApres)} Mo compressé (${(100 - r.bilanZipApres / r.bilanZipAvant * 100).toFixed(1)} % en moins)`);
console.log(`référence calculée en ${r.msReference} ms, relue en ${r.msRelecture} ms ; liste relue ${identique ? 'IDENTIQUE' : 'DIFFÉRENTE'}`);
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(r, null, 1));
process.exit(identique ? 0 : 2);
