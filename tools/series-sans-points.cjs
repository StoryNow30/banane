#!/usr/bin/env node
'use strict';
/*
 * series-sans-points.cjs — repère, dans un journal Orbite, les SÉRIES DE CAPTURES VIDES (CH-051) : des captures consécutives
 * rendues avec 0 point alors que la page ESV avait des points juste avant. Lecture seule, aucune donnée de terrain dans le dépôt.
 *
 *   node tools/series-sans-points.cjs (--journal J.json [--journal …] | --dossier DOSSIER) [--min 3] [--json SORTIE.json]
 *
 * Constat qui motive l'outil (lot du 04/11, version 5) : 362 des 428 différés du lot venaient de deux séries de captures à 0 point
 * (337 cuts en 22,7 min dans la partie 10, 25 cuts en 76 s dans la partie 13). Pendant chaque série, ESV n'émettait presque plus de
 * requêtes de points (`esv-observation`, classe `point-resource`), la page gardait ses vieux nœuds, le compteur `numNodesLoading` restait
 * à 1 ; chaque série commençait quelques secondes après une requête de points en échec (502). Les points existaient : l'Écho du soir les a
 * lus sur les mêmes cuts. Ce ne sont donc pas des trous de données mais un blocage du chargement, qu'Ariane n'a pas détecté.
 *
 * Définitions :
 *   capture        un `adapter-result` d'action `capture` ; vide si `lastDetail.points` vaut 0 ;
 *   série          au moins `--min` captures vides consécutives (dans l'ordre du temps) de la même partie, sans capture pleine entre elles ;
 *   cuts différés  cuts distincts de la partie avec un `defer-finalized` entre le début de la série et sa fin plus 10 s ;
 *   requêtes       somme des `ept` des `esv-observation` de classe `point-resource` : 5 min avant la série, pendant, 5 min après ;
 *   échec avant    la dernière fenêtre d'observation en échec (`echecs` > 0) avant le début de la série, et son délai ;
 *   compteur bloqué  captures de la série dont la lecture (`adapter-progress`, même `requestId`) montre `diag.nl[0]` ≥ 1.
 * Le texte ne donne que des comptes, des durées et des numéros de cut : aucun identifiant de lot, de requête ni de page.
 */
const fs = require('node:fs');

const SEUIL_VIDE = 0;
const FENETRE_MS = 5 * 60 * 1000;
const APRES_FIN_MS = 10 * 1000;

const instant = e => { const t = Date.parse(e && e.timestamp); return Number.isFinite(t) ? t : null; };
const part = e => (e && e.identity && Number.isInteger(e.identity.part) ? e.identity.part : null);
const cut = e => (e && e.identity && Number.isInteger(e.identity.cut) ? e.identity.cut : null);

function analyser(journal, { min = 3 } = {}) {
  const ev = (journal && Array.isArray(journal.events) ? journal.events : []).filter(e => instant(e) !== null)
    .slice().sort((a, b) => instant(a) - instant(b));
  const captures = ev.filter(e => e.type === 'adapter-result' && e.action === 'capture' && e.lastDetail && typeof e.lastDetail === 'object');
  const nlParRequete = new Map();
  for (const e of ev) {
    if (e.type !== 'adapter-progress' || e.action !== 'capture' || !e.requestId) continue;
    const nl = e.lastDetail && e.lastDetail.diag && Array.isArray(e.lastDetail.diag.nl) ? e.lastDetail.diag.nl[0] : null;
    if (Number.isFinite(nl)) nlParRequete.set(e.requestId, Math.max(nlParRequete.get(e.requestId) || 0, nl));
  }
  const R = ev.filter(e => e.type === 'esv-observation' && e.kind === 'resource' && e.class === 'point-resource' && Number.isFinite(e.startedEpochMs));
  const ept = (a, b) => R.filter(e => e.startedEpochMs >= a && e.startedEpochMs <= b).reduce((s, e) => s + (Number.isFinite(e.ept) ? e.ept : 0), 0);
  const differes = ev.filter(e => e.type === 'defer-finalized');
  const erreurs = captures.filter(c => c.error).length;
  const vide = c => Number.isFinite(c.lastDetail.points) && c.lastDetail.points <= SEUIL_VIDE;

  const parPartie = {};
  for (const c of captures) { const p = part(c); const k = p === null ? 'sans-partie' : p; parPartie[k] = parPartie[k] || { captures: 0, vides: 0 }; parPartie[k].captures++; if (vide(c)) parPartie[k].vides++; }

  const brutes = [];
  let cur = null;
  for (const c of captures) {
    if (!vide(c)) { cur = null; continue; }
    const p = part(c);
    if (cur && cur.partie === p) cur.liste.push(c); else { cur = { partie: p, liste: [c] }; brutes.push(cur); }
  }
  const series = brutes.filter(s => s.liste.length >= min).map(s => {
    const debut = instant(s.liste[0]), fin = instant(s.liste[s.liste.length - 1]);
    const cuts = new Set(s.liste.map(cut).filter(x => x !== null));
    const cutsDifferes = new Set(differes.filter(d => part(d) === s.partie && instant(d) >= debut && instant(d) <= fin + APRES_FIN_MS).map(cut).filter(x => x !== null));
    const echecs = R.filter(e => (e.echecs || 0) > 0 && e.startedEpochMs <= debut);
    const dernier = echecs.length ? echecs[echecs.length - 1] : null;
    const bloque = s.liste.filter(c => (nlParRequete.get(c.requestId) || 0) >= 1).length;
    const numeros = [...cuts];
    return {
      partie: s.partie, captures: s.liste.length, cuts: cuts.size, cutsDifferes: cutsDifferes.size,
      premierCut: numeros.length ? numeros[0] : null, dernierCut: numeros.length ? numeros[numeros.length - 1] : null,
      debut: new Date(debut).toISOString(), fin: new Date(fin).toISOString(), dureeS: Math.round((fin - debut) / 1000),
      requetes: { avant5min: ept(debut - FENETRE_MS, debut - 1), pendant: ept(debut, fin), apres5min: ept(fin + 1, fin + FENETRE_MS),
        pendantParMinute: Math.round(ept(debut, fin) / Math.max((fin - debut) / 60000, 1 / 60) * 10) / 10 },
      echecAvant: dernier ? { delaiS: Math.round((debut - dernier.startedEpochMs) / 1000), statuts: dernier.statuts || null, echecs: dernier.echecs } : null,
      compteurBloque: bloque,
    };
  });
  return {
    format: 'ariane-series-sans-points-v1', version: journal && journal.version || null, min,
    captures: captures.length, vides: captures.filter(vide).length, erreurs,
    series, cutsDifferesDansSeries: series.reduce((a, s) => a + s.cutsDifferes, 0), dureeSeriesS: series.reduce((a, s) => a + s.dureeS, 0),
    parPartie,
  };
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1).replace('.', ',') + ' %' : '—');
const hms = iso => iso.slice(11, 19);
const duree = s => (s >= 120 ? `${(s / 60).toFixed(1).replace('.', ',')} min` : `${s} s`);

function texte(R, source) {
  const L = [];
  L.push(`Séries de captures vides — ${source}${R.version ? ` · version ${R.version}` : ''}`);
  L.push(`Captures ${R.captures}, à 0 point ${R.vides} (${pct(R.vides, R.captures)}), en erreur ${R.erreurs}.`);
  if (!R.series.length) { L.push(`Aucune série de ${R.min} captures vides consécutives ou plus.`); }
  else {
    L.push(`Séries de ${R.min} captures vides consécutives ou plus : ${R.series.length} ; cuts différés pendant ces séries : ${R.cutsDifferesDansSeries} ; durée cumulée ${duree(R.dureeSeriesS)}.`);
    L.push('');
    L.push('| Partie | Captures | Cuts | Différés | Début → fin (UTC) | Durée | ept-data : 5 min avant / pendant (par min) / 5 min après | Échec de requête avant | Compteur bloqué |');
    L.push('|---|--:|--:|--:|---|--:|---|---|--:|');
    for (const s of R.series) {
      const q = s.requetes, e = s.echecAvant;
      L.push(`| Partie ${s.partie} | ${s.captures} | ${s.cuts} (${s.premierCut} … ${s.dernierCut}) | ${s.cutsDifferes} | ${hms(s.debut)} → ${hms(s.fin)} | ${duree(s.dureeS)} | ${q.avant5min} / ${q.pendant} (${String(q.pendantParMinute).replace('.', ',')}) / ${q.apres5min} | ${e ? `${e.delaiS} s avant, statuts ${Object.entries(e.statuts || {}).map(([k, v]) => `${k}×${v}`).join(' ')}` : 'aucun'} | ${s.compteurBloque}/${s.captures} |`);
    }
  }
  L.push('');
  L.push('Par partie : ' + Object.entries(R.parPartie).map(([p, v]) => `partie ${p} ${v.vides}/${v.captures}`).join(' ; ') + '.');
  return L.join('\n');
}

function lireArguments(argv) {
  const a = { journaux: [], dossier: null, min: 3, json: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--journal') a.journaux.push(argv[++i]);
    else if (x === '--dossier') a.dossier = argv[++i];
    else if (x === '--min') { a.min = Number(argv[++i]); if (!Number.isInteger(a.min) || a.min < 2) throw Error('--min : entier ≥ 2'); }
    else if (x === '--json') a.json = argv[++i];
    else throw Error(`option inconnue : ${x}`);
  }
  if (a.journaux.length && a.dossier) throw Error('--journal et --dossier : pas les deux');
  if (!a.journaux.length && !a.dossier) throw Error('donner --journal J.json ou --dossier DOSSIER');
  return a;
}

function* sources(a) {
  for (const f of a.journaux) yield { nom: f, journal: JSON.parse(fs.readFileSync(f, 'utf8')) };
  if (a.dossier) { const X = require('./exports-lots.cjs'); for (const j of X.journaux(a.dossier)) yield { nom: j.nom, journal: JSON.parse(j.lire()) }; }
}

function executer(argv) {
  const a = lireArguments(argv);
  const tous = [];
  for (const s of sources(a)) { const R = analyser(s.journal, { min: a.min }); tous.push({ source: s.nom, ...R }); console.log(texte(R, s.nom)); console.log(''); }
  if (!tous.length) console.log('aucun journal');
  if (a.json) fs.writeFileSync(a.json, JSON.stringify(tous.length === 1 ? tous[0] : { format: 'ariane-series-sans-points-v1', journaux: tous }, null, 1));
  return tous;
}

module.exports = { analyser, texte, lireArguments, executer, SEUIL_VIDE, FENETRE_MS, APRES_FIN_MS };
if (require.main === module) { try { executer(process.argv.slice(2)); } catch (e) { console.error(String(e && e.message || e)); process.exit(1); } }
