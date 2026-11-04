#!/usr/bin/env node
'use strict';
/*
 * mesure-delta-vidage.cjs — CH-049-C. Mesure ce que gagnerait le vidage automatique en delta (src/native-export.js,
 * `deltaMetadonnees`) sur un export Écho RÉEL, et prouve que merge-segments relit la série à l'identique. Lecture seule : les
 * segments d'origine ne sont pas modifiés ; la série en delta est écrite dans --tmp (dossier neuf, à jeter).
 *
 *   node tools/mesure-delta-vidage.cjs --echo DOSSIER_DE_ZIPS_OU_JSON --tmp DOSSIER_VIDE [--json sortie.json]
 *
 * Les exports sont groupés par horodatage de segment (`segment.stamp`) et pris dans l'ordre du temps ; les vidages automatiques
 * sont ceux dont le nom porte « -auto » ; les autres (export final) restent complets et inchangés. Pour chaque vidage
 * automatique, le premier segment (celui qui porte l'en-tête complet) est réécrit avec le delta ; les segments suivants (en-tête
 * mince) sont recopiés tels quels. La comparaison porte sur les octets bruts ET sur les octets compressés (deflate, comme les
 * volumes zip), et sur la fusion : événements, visites et identifiants de nuages doivent être égaux au bit près.
 */
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const X = require('../src/native-export.js');
const V = require('./lire-volumes.cjs');
const { mergeFiles } = require('./merge-segments.cjs');

const argv = process.argv.slice(2), opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const echo = opt('--echo'), tmp = opt('--tmp'), sortie = opt('--json');
if (!echo || !tmp) { console.error('Usage : --echo DOSSIER --tmp DOSSIER_VIDE [--json sortie.json]'); process.exit(1); }
fs.mkdirSync(tmp, { recursive: true });
if (fs.readdirSync(tmp).length) { console.error('--tmp doit être un dossier vide'); process.exit(1); }

const def = b => zlib.deflateRawSync(b, { level: 6 }).length;
const sha = o => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const mo = n => (n / 1e6).toFixed(1);

/* Segments d'Écho (JSON de session), triés par horodatage puis index. Les JSON d'une autre nature (liste d'ESV) sont écartés. */
const entrees = V.entrees(echo).filter(e => /ariane-echo-/.test(e.nom));
const lus = entrees.map(e => { const buf = e.lire(); return { e, buf, doc: JSON.parse(buf) }; })
  .sort((a, b) => String(a.doc.segment.stamp).localeCompare(String(b.doc.segment.stamp)) || (a.doc.segment.index || 0) - (b.doc.segment.index || 0));
const groupes = new Map();
for (const l of lus) { const k = l.doc.segment.stamp; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(l); }

const originaux = [], modifies = [], lignes = [];
let jalon = null, session = null;
for (const [stamp, segs] of groupes) {
  const auto = /-auto/.test(segs[0].e.nom), premier = segs[0];
  const dirO = path.join(tmp, 'origine'), dirD = path.join(tmp, 'delta');
  fs.mkdirSync(dirO, { recursive: true }); fs.mkdirSync(dirD, { recursive: true });
  let delta = null;
  for (const s of segs) {
    const fo = path.join(dirO, s.e.nom); fs.writeFileSync(fo, s.buf); originaux.push(fo);
    const fd = path.join(dirD, s.e.nom);
    if (s !== premier || !auto) { fs.writeFileSync(fd, s.buf); modifies.push(fd); continue; }
    const complet = X.expand(s.doc);
    if (complet.session && complet.session.id !== session) { session = complet.session.id; jalon = null; }
    const r = X.deltaMetadonnees(complet, jalon);
    const sortieDoc = X.compact(r.doc, {});
    const buf = Buffer.from(JSON.stringify(sortieDoc));
    fs.writeFileSync(fd, buf); modifies.push(fd);
    jalon = X.confirmerJalon(r, true);
    delta = { stats: r.stats, avant: s.buf.length, apres: buf.length, avantZ: def(s.buf), apresZ: def(buf) };
  }
  const nom = segs.map(s => s.e.nom.replace(/^ariane-echo-.*?(seg\d+)\.json$/, '$1')).join('+');
  lignes.push({ stamp, auto, segments: nom, ...(delta || {}) });
}

/* Fusion des deux séries : doit être identique. */
const A = mergeFiles(originaux).merged, B = mergeFiles(modifies).merged;
const verif = {
  evenements: [A.events.length, B.events.length, sha(A.events) === sha(B.events)],
  visites: [A.records.length, B.records.length, sha(A.records) === sha(B.records)],
  nuages: [A.clouds.length, B.clouds.length, sha(A.clouds.map(c => c.chunkId || c.captureId).sort()) === sha(B.clouds.map(c => c.chunkId || c.captureId).sort())],
  declares: [A.mergeTrace.declaredCloudIds, B.mergeTrace.declaredCloudIds, A.mergeTrace.declaredCloudIds === B.mergeTrace.declaredCloudIds],
  manquants: [A.mergeTrace.missingCloudIds, B.mergeTrace.missingCloudIds, A.mergeTrace.missingCloudIds === B.mergeTrace.missingCloudIds],
};
const identique = Object.values(verif).every(v => v[2]);

const tot = lignes.filter(l => l.avant).reduce((t, l) => ({ avant: t.avant + l.avant, apres: t.apres + l.apres, avantZ: t.avantZ + l.avantZ, apresZ: t.apresZ + l.apresZ }), { avant: 0, apres: 0, avantZ: 0, apresZ: 0 });
const totSerie = { avant: lus.reduce((n, l) => n + l.buf.length, 0), avantZ: lus.reduce((n, l) => n + def(l.buf), 0) };
console.log('Vidages automatiques (premier segment, en-tête complet) :');
for (const l of lignes) console.log(`  ${l.stamp} ${l.auto ? 'auto ' : 'final'} ${l.segments}` + (l.avant
  ? `  ${mo(l.avant)} -> ${mo(l.apres)} Mo brut, ${mo(l.avantZ)} -> ${mo(l.apresZ)} Mo compressé ; événements ${l.stats.events.envoyes}/${l.stats.events.total}, visites ${l.stats.records.envoyes}/${l.stats.records.total}` : '  (inchangé)'));
console.log(`Segments d'en-tête réécrits : ${mo(tot.avant)} -> ${mo(tot.apres)} Mo brut (${(100 - tot.apres / tot.avant * 100).toFixed(1)} % en moins), ${mo(tot.avantZ)} -> ${mo(tot.apresZ)} Mo compressé (${(100 - tot.apresZ / tot.avantZ * 100).toFixed(1)} % en moins)`);
const serieApres = totSerie.avant - tot.avant + tot.apres, serieApresZ = totSerie.avantZ - tot.avantZ + tot.apresZ;
console.log(`Série entière : ${mo(totSerie.avant)} -> ${mo(serieApres)} Mo brut (${(100 - serieApres / totSerie.avant * 100).toFixed(1)} %), ${mo(totSerie.avantZ)} -> ${mo(serieApresZ)} Mo compressé (${(100 - serieApresZ / totSerie.avantZ * 100).toFixed(1)} %)`);
console.log('Relecture par merge-segments (origine, delta, égal) :');
for (const [k, v] of Object.entries(verif)) console.log(`  ${k.padEnd(10)} ${v[0]} ${v[1]} ${v[2] ? 'IDENTIQUE' : 'DIFFÈRE'}`);
console.log(identique ? 'RELECTURE IDENTIQUE' : 'ÉCART : ne pas adopter');
if (sortie) fs.writeFileSync(sortie, JSON.stringify({ lignes, tot, totSerie, serieApres, serieApresZ, verif, identique }, null, 1));
process.exit(identique ? 0 : 2);
