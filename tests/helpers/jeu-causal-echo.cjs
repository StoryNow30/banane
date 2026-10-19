'use strict';
/* Écho SYNTHÉTIQUE écrit sur disque pour l'essai de bout en bout du JEU CAUSAL (tests/gcv2-jeu-causal.test.cjs) : une partie inventée (projet 9,
 * partie 91), des cuts consécutifs espacés de 0,6 m, chacun visité par l'« opérateur » dans l'ordre, avec sa pose de départ, ses chunks de nuage
 * (deux rails à 1 450 mm de la fixture du jeu), sa validation éventuelle (rail déplacé de `lat` mm en travers) et ses instants. Un journal de lot
 * synthétique peut l'accompagner. Valeurs inventées, coordonnées de scène fabriquées, rien du terrain. */
const fs = require('node:fs'), path = require('node:path');
const F = require('./gcv2-jeu-fixture.cjs');

const ORIGINE = [458559.4, 6699187.6, 24.0];
const SIDES = ['left', 'right'];
const t = s => new Date(Date.UTC(2031, 4, 1, 10, 0, 0) + Math.round(s * 1000)).toISOString();
const origineDe = (cut, dy = 0) => [ORIGINE[0] + 0.6 * cut, ORIGINE[1] + dy, ORIGINE[2]];
/* Rails d'un cut ; `dl`/`dr` : décalage latéral (m) de chaque rail par rapport à la géométrie de base. */
function railsDe(cut, { dl = 0, dr = 0 } = {}) {
  const o = origineDe(cut);
  return { left: F.rail(dl, 1, o), right: F.rail(1.45 + dr, -1, o) };
}
/* Points du nuage autour des rails de base d'un cut, partagés par côté ; `decale` (m) : tout le nuage déplacé en travers (« autre » capture). */
function pointsDe(cut, { decale = 0, graine = 7 } = {}) {
  const cap = F.capture({ cut, graine: graine + cut, origine: origineDe(cut, decale) }), mi = origineDe(cut)[1] + 0.725 + decale;
  return { left: cap.pointsSceneRelative.filter(p => p[1] < mi), right: cap.pointsSceneRelative.filter(p => p[1] >= mi) };
}
/*
 * Une visite. `debut` (s depuis 10:00), `duree` (s) ; `depart` : rails de départ ({ dl, dr }, m) ; `ref` : { lat } (mm, déplacement en travers des deux rails
 * à la validation) ou null (visite sans action) ; `nuage` : { decale, graine } ou false ; `deplace` : chunk ajouté APRÈS le geste, pris autour de la pose
 * déplacée (doit être écarté par l'entrée sans fuite) ; `ecritureA` : instant (s) d'une écriture serveur de la visite.
 */
function visite({ cut, index, debut, duree = 20, depart = {}, ref = null, nuage = {}, deplace = null, ecritureA = null, session = 'sess-1' }) {
  const before = railsDe(cut, depart), id = `v-${session}-${index}-${cut}`;
  const bouge = ref ? railsDe(cut, { dl: (depart.dl || 0) + ref.lat / 1000, dr: (depart.dr || 0) + ref.lat / 1000 }) : null;
  const etat = rails => ({ identity: { part: 91, cut }, rails });
  const r = { recordId: id, visitId: id, nativeSessionId: session, visitIndex: index, identity: { pageId: 'p', part: 91, cut, shape: 'U50', frameId: 'f', projectId: null },
    startedAt: t(debut), endedAt: t(debut + duree), beforeEstablished: { rails: before }, initialObserved: etat(before), firstObserved: etat(before), lastObserved: etat(bouge || before),
    humanFinalReference: bouge ? { state: etat(bouge), observedAt: t(debut + duree - 1) } : null,
    stateTransitions: bouge ? [{ observedAt: t(debut + 5), effect: { kind: 'rail-state-changed' } }] : [], serverWrites: [] };
  if (ecritureA !== null) r.serverWrites.push({ eventId: `w-${id}`, at: t(ecritureA), kind: 'seen', status: 204, body: { SeenByOperator: true } });
  const clouds = [];
  if (nuage !== false) {
    const pts = pointsDe(cut, nuage || {});
    for (const s of SIDES) clouds.push({ chunkId: `k-${id}-${s}`, captureId: `c-${id}`, visitId: id, side: s, rail: before[s], pointsSceneRelative: pts[s], visibleByClipBoxes: pts[s].map(() => true), capturedAt: t(debut + 2) });
  }
  if (deplace && bouge) {
    const pts = pointsDe(cut, { decale: deplace.decale || 0.03, graine: 99 });
    for (const s of SIDES) clouds.push({ chunkId: `kd-${id}-${s}`, captureId: `cd-${id}`, visitId: id, side: s, rail: bouge[s], pointsSceneRelative: pts[s], visibleByClipBoxes: pts[s].map(() => true), capturedAt: t(debut + duree - 2) });
  }
  return { record: r, clouds };
}
/* Écrit l'Écho (un fichier JSON « ariane-echo-… ») dans `dossier` ; `visites` : liste d'options de `visite`. */
function ecrireEcho(dossier, visites) {
  fs.mkdirSync(dossier, { recursive: true });
  const vs = visites.map(visite);
  const doc = { format: 'banane-native-session-v2', version: 'test', exportedAt: t(99999), session: { id: 'sess-1', startedAt: t(0) }, segment: { index: 1, stamp: 's1' },
    records: vs.map(v => v.record), clouds: vs.flatMap(v => v.clouds) };
  fs.writeFileSync(path.join(dossier, 'ariane-echo-2031-05-01T12-00-00.json'), JSON.stringify(doc));
  return dossier;
}
/* Journal de lot synthétique : `poses` : cut → { lat } (mm : déplacement du lot), `differes` : cuts différés. Seuls les champs que lit regles-metier.cjs. */
function ecrireJournal(fichier, { poses = {}, differes = [] } = {}) {
  const cuts = [...Object.keys(poses).map(Number), ...differes].sort((a, b) => a - b), events = [], records = [];
  cuts.forEach((cut, i) => {
    events.push({ type: 'gcv1-shadow-observed', identity: { part: 91, cut }, lotObservation: { stage: differes.includes(cut) ? 'deferred' : 'first-pass' }, timestamp: t(-1000 + i), lidarCaptureId: `lot-${cut}` });
    if (!differes.includes(cut)) {
      events.push({ type: 'validation-accepted', identity: { part: 91, cut }, timestamp: t(-999 + i) });
      const ini = railsDe(cut), fin = railsDe(cut, { dl: poses[cut].lat / 1000, dr: poses[cut].lat / 1000 });
      records.push({ identity: { part: 91, cut }, rails: Object.fromEntries(SIDES.map(s => [s, { initial: { positionSceneRelative: ini[s].positionSceneRelative }, corrected: { positionSceneRelative: fin[s].positionSceneRelative } }])) });
    }
  });
  fs.writeFileSync(fichier, JSON.stringify({ version: 'test', events, records }));
  return fichier;
}
module.exports = { ORIGINE, origineDe, railsDe, pointsDe, visite, ecrireEcho, ecrireJournal, t };
