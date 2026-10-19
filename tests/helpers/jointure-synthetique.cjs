'use strict';
/* Fabrique de données SYNTHÉTIQUES pour les essais de tools/jointure-echo-orbite.cjs (parties 90 et suivantes
 * inventées, cuts inventés, poses en mètres, rien qui vienne du terrain). Un export Écho est construit en mémoire,
 * puis écrit au besoin dans un dossier temporaire par l'essai. */
const fs = require('node:fs'), path = require('node:path');

const M_ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/* `cadre` : { pageId, frameId } d'un autre cadre de scène (rechargement de la page ESV) ; par défaut le cadre unique. */
const identite = (cut, partie = 90, cadre = {}) => ({ pageId: cadre.pageId || 'page-synth', part: partie, cut, shape: 'U50', frameId: cadre.frameId || 'frame-synth', projectId: null });
/* Une pose de rail : [x, y, z] en mètres, repère profil confondu avec la scène (longitudinal x, latéral y, vertical z). */
const rail = pos => ({ positionSceneRelative: pos, sceneRelativeToProfileLocal: M_ID });
/* Un état à deux rails : `g` et `d` sont les positions des bords gauche et droit. */
const etat = (cut, [g, d], partie = 90, cadre) => ({ identity: identite(cut, partie, cadre), capturedAt: '2031-05-01T08:00:00.000Z', status: 'observed', rails: { left: rail(g), right: rail(d) } });
const decaler = (pos, dx = 0, dy = 0, dz = 0) => [pos[0] + dx, pos[1] + dy, pos[2] + dz];

const horodatage = (minutes, secondes = 0) => new Date(Date.UTC(2031, 4, 1, 8, 0, 0) + Math.round((minutes * 60 + secondes) * 1000)).toISOString();

/* Une visite d'Écho.
 *  - session, index : (session, visitIndex) ; l'index repart de 0 à chaque session ;
 *  - debut, fin : { minutes, secondes } depuis 08:00 UTC, ou des chaînes ISO ;
 *  - initiale : [gauche, droit] à l'ouverture ; derniere : à la sortie (par défaut l'initiale) ;
 *  - validation : [gauche, droit] de la validation observée, ou rien ;
 *  - sansId : retire recordId (l'union retombe alors sur la clé de visite) ;
 *  - cadre : { pageId, frameId } du cadre de scène de la visite (par défaut le cadre unique). */
function visite({ session, index, cut, partie = 90, debut, fin, initiale, derniere, validation, etiquette, sansId = false, ecritures, referenceSource, cadre }) {
  const t = v => typeof v === 'string' ? v : horodatage(v.minutes, v.secondes || 0);
  const r = {
    recordId: `${session}-v${index}-c${cut}`, visitId: `vid-${session}-${index}-${cut}`, nativeSessionId: session, visitIndex: index,
    identity: identite(cut, partie, cadre), startedAt: t(debut), endedAt: fin ? t(fin) : undefined,
    initialObserved: etat(cut, initiale, partie, cadre), firstObserved: etat(cut, initiale, partie, cadre), lastObserved: etat(cut, derniere || initiale, partie, cadre),
    humanFinalReference: validation ? { state: etat(cut, validation, partie, cadre) } : null,
    observedLabelCandidate: etiquette || (validation ? 'VALIDATE_CORRECTED_BOTH' : 'PASS_NO_DECISION'), status: validation ? 'complete' : 'partial',
  };
  if (sansId) delete r.recordId;
  if (ecritures) r.serverWrites = ecritures.map((e, i) => ecritureEcho({ cut, i, ...e }));
  if (referenceSource && r.humanFinalReference) r.humanFinalReference.source = referenceSource;
  return r;
}

/* Une écriture serveur vue par l'Écho (`serverWrites` d'un record) : par défaut une validation réussie (204), rattachée par
 * numéro de ligne, au cut de la visite ; `rails` : [gauche, droit], ses bords sont mis dans le corps (`XLeftEdge`…).
 * `corps` remplace le corps ; `a` : horodatage ISO de l'écriture. */
function ecritureEcho({ cut, i = 0, rails, kind = 'validation', status = 204, rowIndex = cut, joinMethod = 'row-index', a, corps }) {
  const bords = rails ? { XLeftEdge: rails[0][0], YLeftEdge: rails[0][1], ZLeftEdge: rails[0][2], XRightEdge: rails[1][0], YRightEdge: rails[1][1], ZRightEdge: rails[1][2] } : {};
  const drapeaux = kind === 'validation' ? { ExtractionStatus: 'valid', TreatedByOperator: true, SeenByOperator: true } : { SeenByOperator: true };
  return { eventId: `w-${cut}-${i}`, at: a || horodatage(0, 0), kind, status, method: 'PUT', outcome: 'done', attempt: 1, rowIndex, joinedTo: 'closed-visit', joinMethod,
    body: corps || { ...bords, ...drapeaux } };
}

/* Un export Écho (format v2 clair). `nom` : nom du fichier (ariane-echo-… ou ariane-native-v4-…). `events` : événements
 * de la session (par exemple ceux de `pagePerdue` et `captureFaite`). */
function exportEcho({ session, debutSession, stamp, index = 1, records, events }) {
  return {
    format: 'banane-native-session-v2', version: 'test', exportedAt: '2031-05-01T12:00:00.000Z',
    session: { id: session, startedAt: typeof debutSession === 'string' ? debutSession : horodatage(debutSession.minutes, debutSession.secondes || 0) },
    segment: { index, stamp }, records, ...(events ? { events } : {}),
  };
}
/* Événement « page ESV perdue » de l'Écho (rechargement), à l'instant `a` ({ minutes, secondes } ou ISO). */
const instant = v => typeof v === 'string' ? v : horodatage(v.minutes, v.secondes || 0);
const pagePerdue = ({ session, a, n = 0 }) => ({ eventId: `pl-${session}-${n}`, type: 'native-page-lost', timestamp: instant(a), nativeSessionId: session, sessionId: session, identity: null, reason: 'page-reloaded' });
/* Événement « capture prête » d'une visite : `statut` est le statut de lecture du nuage (`read-complete-empty` : lecture
 * complète, aucun point gardé). */
const captureFaite = ({ session, visitId, statut, n = 0 }) => ({ eventId: `cr-${visitId}-${n}`, type: 'native-capture-ready', timestamp: horodatage(0, 0), nativeSessionId: session, visitId,
  cloud: { format: 'banane-native-lidar-capture-v2', captureId: `cap-${visitId}-${n}`, status: statut } });
const ecrire = (dossier, nom, doc) => { const f = path.join(dossier, nom); fs.writeFileSync(f, JSON.stringify(doc)); return f; };

/* Un journal Orbite minimal : les cuts de `poses` sont posés ({ cut, partie, gauche, droit, cadre } : pose posée, repère de la
 * scène du journal ; `cadre` : { pageId, frameId } quand le lot a changé de page). */
function journal(poses) {
  const events = [], records = [];
  for (const p of poses) {
    const id = identite(p.cut, p.partie ?? 90, p.cadre);
    events.push({ eventId: `vp-${p.cut}`, timestamp: '2031-05-01T07:00:00.000Z', type: 'validation-accepted', identity: id });
    records.push({ recordId: `jr-${p.cut}`, identity: id, capturedAt: '2031-05-01T07:01:00.000Z', rails: {
      left: { initial: rail(p.gauche), corrected: rail(p.gauche) }, right: { initial: rail(p.droit), corrected: rail(p.droit) } } });
  }
  return { format: 'ariane-journal-v4', version: 'test', events, records };
}

module.exports = { identite, rail, etat, decaler, horodatage, visite, ecritureEcho, exportEcho, pagePerdue, captureFaite, ecrire, journal };
