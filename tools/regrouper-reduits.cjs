#!/usr/bin/env node
'use strict';
/*
 * regrouper-reduits.cjs — reçoit en vrac les fichiers produits par la page « réducteur d'exports »
 * (`*.json.gz` ou `*.json` : journaux, diagnostics, relectures allégées) et les range par partie dans
 * l'arborescence attendue par analyse-locale.cjs :
 *
 *   node tools/regrouper-reduits.cjs DOSSIER_EN_VRAC DOSSIER_RACINE
 *   node tools/analyse-locale.cjs DOSSIER_RACINE
 *
 * Le classement vient du contenu, jamais du nom : le journal donne la partie (`state.batch.scope.part`),
 * le diagnostic se rattache à son journal par l'horodatage de son nom (exporté juste après le journal ; le
 * diagnostic couvre toute la session du moteur, donc plusieurs lots partagent le même `sessionId`), à défaut
 * par `sessionId`, la relecture donne la partie de ses visites.
 * Deux lots de la même partie (rejeu, reprise) restent séparés : `lot 25`, `lot 25 (2)`.
 */
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const R = require('./reducteur-exports-core.js');

const lire = f => { const b = fs.readFileSync(f); return /\.gz$/i.test(f) ? zlib.gunzipSync(b) : b; };
const nomSansGz = f => path.basename(f).replace(/\.gz$/i, '');
const horodatage = f => { const m = /-(\d{12,14})\.json(\.gz)?$/i.exec(path.basename(f)); return m ? Number(m[1]) : null; };

function regrouper(vrac, racine) {
  const fichiers = fs.readdirSync(vrac).filter(n => /\.json(\.gz)?$/i.test(n)).sort().map(n => path.join(vrac, n));
  const journaux = [], diagnostics = [], relectures = [], inconnus = [];
  for (const f of fichiers) {
    const brut = lire(f), entete = brut.subarray(0, 700).toString('utf8'),
      type = /"format"\s*:\s*"ariane-relecture-reduite-v1"/.test(entete) ? 'relecture' : R.classer(entete);
    if (type === 'journal') { const d = JSON.parse(brut); journaux.push({ f, brut, part: d.state?.batch?.scope?.part ?? null, session: d.state?.sessionId ?? null }); }
    else if (type === 'diagnostic') { const d = JSON.parse(brut); diagnostics.push({ f, brut, session: d.sessionId ?? null }); }
    else if (type === 'relecture') { const d = JSON.parse(brut); relectures.push({ f, brut, parts: [...new Set((d.records || []).map(r => r.identity?.part).filter(Number.isInteger))] }); }
    else inconnus.push({ fichier: path.basename(f), type });
  }
  const rapport = { lots: [], relectures: [], inconnus, sansJournal: [] };
  const utilises = new Map();
  const dossier = (base, part) => { const n = (utilises.get(base + part) || 0) + 1; utilises.set(base + part, n); return path.join(racine, `${base} ${part}${n > 1 ? ` (${n})` : ''}`); };
  for (const j of journaux) {
    if (!Number.isInteger(j.part)) { inconnus.push({ fichier: path.basename(j.f), type: 'journal sans partie' }); continue; }
    const d = dossier('lot', j.part); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, nomSansGz(j.f)), j.brut);
    /* Un seul diagnostic par lot : le plus proche dans le temps du journal (exportés à quelques secondes d'écart) ; sans
     * horodatage lisible, un diagnostic de la même session. */
    const tj = horodatage(j.f), libres = diagnostics.filter(x => !x.pris);
    const proches = tj === null ? [] : libres.filter(x => horodatage(x.f) !== null).sort((a, b) => Math.abs(horodatage(a.f) - tj) - Math.abs(horodatage(b.f) - tj));
    const choisi = proches[0] || libres.find(x => x.session && x.session === j.session) || null;
    const diag = choisi ? [choisi] : [];
    for (const x of diag) { fs.writeFileSync(path.join(d, nomSansGz(x.f)), x.brut); x.pris = true; }
    rapport.lots.push({ partie: j.part, dossier: path.basename(d), journal: path.basename(j.f), diagnostics: diag.length });
  }
  for (const x of diagnostics) if (!x.pris) rapport.sansJournal.push(path.basename(x.f));
  for (const r of relectures) {
    if (!r.parts.length) { inconnus.push({ fichier: path.basename(r.f), type: 'relecture sans visite' }); continue; }
    const part = r.parts.join('-'), d = path.join(racine, `echo ${part}`); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, nomSansGz(r.f)), r.brut);
    rapport.relectures.push({ parties: r.parts, fichier: path.basename(r.f) });
  }
  return rapport;
}

function main(argv = process.argv.slice(2)) {
  const [vrac, racine] = argv;
  if (!vrac || !racine || !fs.existsSync(vrac)) { console.error('Usage : node tools/regrouper-reduits.cjs DOSSIER_EN_VRAC DOSSIER_RACINE'); process.exit(1); }
  fs.mkdirSync(racine, { recursive: true });
  const r = regrouper(vrac, racine);
  console.log(`${r.lots.length} lot(s), ${r.relectures.length} fichier(s) de relecture.`);
  for (const l of r.lots) console.log(`  ${l.dossier} : ${l.journal} + ${l.diagnostics} diagnostic(s)`);
  for (const x of r.relectures) console.log(`  echo ${x.parties.join('-')} : ${x.fichier}`);
  if (r.sansJournal.length) console.log('Diagnostics sans journal : ' + r.sansJournal.join(', '));
  if (r.inconnus.length) console.log('Ignorés : ' + r.inconnus.map(i => `${i.fichier} (${i.type})`).join(', '));
  return r;
}

if (require.main === module) try { main(); } catch (e) { console.error(e.stack || e); process.exitCode = 1; }
module.exports = { regrouper, main };
