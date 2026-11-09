#!/usr/bin/env node
'use strict';
/*
 * ch079-extraire-corpus.cjs — CH-079 (D-308) : extrait des cuts « validés faux » un petit corpus de contrôle (une fichier JSON par cut), à verser dans le dépôt de
 * données (`banane-data`), JAMAIS dans ce dépôt. Chaque fichier porte : la capture (rails, nuage) et les appuis du lot, la décision du lot et celle de L1 telles que le
 * journal les a consignées, la pose d'Ariane, l'écart de l'opérateur à cette pose (repère profil), les écartements des voisins validés avant le cut (pour la garde et le
 * serrage), et l'écart actuel (le plus grand des deux rails, mm) contre lequel `tests/ch079-cas-controle.test.cjs` compare chaque version.
 *
 *   node tools/ch079-extraire-corpus.cjs --corpus SEG.json [--corpus SEG2.json …] --journal JOURNAL.json --jointure TABLE.json --liste LISTE.json
 *        --partie N --cuts 142,143,… [--famille mauvaise-voie:220,360,361] --sortie DOSSIER
 * `--jointure` : la table de `tools/jointure-echo-orbite.cjs --sortie` ; `--liste` : l'instantané de la liste d'ESV de la partie (`ariane-liste-partieN-*.json`).
 */
const fs = require('node:fs'), path = require('node:path');
const J = require('./jointure-echo-orbite.cjs'), P = require('./p0-commun.cjs');
const LM = require('../src/liste-memoire.js'), VR = require('../src/voie-recentree.js');
const SIDES = ['left', 'right'], FR = { left: 'gauche', right: 'droite' };
const arg = (a, k) => { const r = []; for (let i = 0; i < a.length; i++) if (a[i] === k) r.push(a[++i]); return r; };
const fini = v => Number.isFinite(v);

function extraire({ corpus, journal, jointure, liste, partie, cuts, familles = {} }) {
  const jr = J.lireJournal(journal), par = J.journalParCut(jr), table = JSON.parse(fs.readFileSync(jointure)).table, L = LM.decompacter(JSON.parse(fs.readFileSync(liste)));
  const nuages = P.chargerCorpus(corpus), ev = new Map();
  for (const e of jr.events) if (e.type === 'gcv1-shadow-observed' && e.identity?.part === partie && e.lotObservation) ev.set(e.identity.cut, e);
  const poseDe = c => { const x = par.get(`${partie}|${c}`), a = x && J.poseAriane(x); return a ? Object.fromEntries(SIDES.map(s => [s, a.posee[s].positionSceneRelative.slice(0, 3)])) : null; };
  const sorties = [];
  for (const cut of cuts) {
    const e = ev.get(cut), t = table.find(r => r.partie === partie && r.cut === cut), cap = e && nuages.get(e.lidarCaptureId), ariane = poseDe(cut);
    if (!e || !t || !cap || !ariane || !t.ecartHumain) throw Error(`cut ${cut} : donnée manquante (journal ${!!e}, jointure ${!!t}, nuage ${!!cap}, pose ${!!ariane}, écart ${!!t?.ecartHumain})`);
    const lo = e.lotObservation, appuis = (lo.anchorsUsed || []).map(a => ({ identity: { part: partie, cut: a, frameId: cap.identity?.frameId ?? null }, stage: 'placed', positions: poseDe(a) }));
    if (appuis.some(a => !a.positions)) throw Error(`cut ${cut} : pose d'un appui absente`);
    const gauge = p => Math.hypot(...[0, 1, 2].map(i => p.left[i] - p.right[i])) * 1000;
    /* Écartements des voisins validés AVANT le cut (±20), dans l'état de la liste après le lot : ce que la garde et le serrage lisent. */
    const voisins = [];
    for (let i = Math.max(0, cut - 20); i < cut; i++) { if (L.st[i] !== 0) continue; const b = L.ed.slice(6 * i, 6 * i + 6); if (b.length === 6 && b.every(fini)) voisins.push(Math.round(Math.hypot(b[0] - b[3], b[1] - b[4], b[2] - b[5]) / 10 * 100) / 100); }
    const eh = t.ecartHumain;
    sorties.push({ format: 'ch079-cas-controle-v1', partie, cut, famille: familles[cut] || 'imprecision',
      capture: { identity: cap.identity, rails: cap.rails, pointsSceneRelative: cap.pointsSceneRelative, visibleByClipBoxes: cap.visibleByClipBoxes },
      appuis, lotEnregistre: { stage: lo.stage, reason: lo.reason ?? null, anchorsUsed: lo.anchorsUsed || [], positions: lo.positions || null },
      l1Enregistre: lo.l1 ? { etat: lo.l1.etat, motif: lo.l1.motif ?? null, zone: lo.l1.zone ?? null, variante: lo.l1.variante ?? null, correction: lo.l1.correction ?? null } : null,
      poseAriane: ariane,
      humain: Object.fromEntries(['gauche', 'droite'].map(k => [k, { longitudinalMm: eh[k].longitudinalMm, lateralMm: eh[k].lateralMm, verticalMm: eh[k].verticalMm }])),
      ecartementsMm: { ariane: Math.round(gauge(ariane) * 100) / 100, operateur: t.poseHumaineFinale ? Math.round(Math.hypot(...['x', 'y', 'z'].map(k => t.poseHumaineFinale.gauche[k] - t.poseHumaineFinale.droite[k])) * 100000) / 100 : null },
      voisinsEcartementsMm: voisins,
      ecartActuelMm: Math.round(eh.maxDist3dMm * 100) / 100 });
  }
  return sorties;
}
module.exports = { extraire };
if (require.main === module) {
  const a = process.argv.slice(2), un = k => arg(a, k)[0], familles = {};
  for (const f of arg(a, '--famille')) { const [n, l] = f.split(':'); for (const c of l.split(',')) familles[+c] = n; }
  const out = extraire({ corpus: arg(a, '--corpus'), journal: un('--journal'), jointure: un('--jointure'), liste: un('--liste'), partie: +un('--partie'), cuts: un('--cuts').split(',').map(Number), familles });
  fs.mkdirSync(un('--sortie'), { recursive: true });
  for (const o of out) fs.writeFileSync(path.join(un('--sortie'), `cut-${o.partie}-${o.cut}.json`), JSON.stringify(o));
  console.log(out.map(o => `${o.cut}:${o.famille}:${o.ecartActuelMm}mm`).join(' '));
}
