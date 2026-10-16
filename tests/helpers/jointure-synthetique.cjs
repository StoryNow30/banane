'use strict';
/* Fabrique de données SYNTHÉTIQUES pour les essais de tools/jointure-echo-orbite.cjs (parties 90 et suivantes
 * inventées, cuts inventés, poses en mètres, rien qui vienne du terrain). Un export Écho est construit en mémoire,
 * puis écrit au besoin dans un dossier temporaire par l'essai. */
const fs = require('node:fs'), path = require('node:path');

const M_ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const identite = (cut, partie = 90) => ({ pageId: 'page-synth', part: partie, cut, shape: 'U50', frameId: 'frame-synth', projectId: null });
/* Une pose de rail : [x, y, z] en mètres, repère profil confondu avec la scène (longitudinal x, latéral y, vertical z). */
const rail = pos => ({ positionSceneRelative: pos, sceneRelativeToProfileLocal: M_ID });
/* Un état à deux rails : `g` et `d` sont les positions des bords gauche et droit. */
const etat = (cut, [g, d], partie = 90) => ({ identity: identite(cut, partie), capturedAt: '2031-05-01T08:00:00.000Z', status: 'observed', rails: { left: rail(g), right: rail(d) } });
const decaler = (pos, dx = 0, dy = 0, dz = 0) => [pos[0] + dx, pos[1] + dy, pos[2] + dz];

const horodatage = (minutes, secondes = 0) => new Date(Date.UTC(2031, 4, 1, 8, minutes, secondes)).toISOString();

/* Une visite d'Écho.
 *  - session, index : (session, visitIndex) ; l'index repart de 0 à chaque session ;
 *  - debut, fin : { minutes, secondes } depuis 08:00 UTC, ou des chaînes ISO ;
 *  - initiale : [gauche, droit] à l'ouverture ; derniere : à la sortie (par défaut l'initiale) ;
 *  - validation : [gauche, droit] de la validation observée, ou rien ;
 *  - sansId : retire recordId (l'union retombe alors sur la clé de visite). */
function visite({ session, index, cut, partie = 90, debut, fin, initiale, derniere, validation, etiquette, sansId = false }) {
  const t = v => typeof v === 'string' ? v : horodatage(v.minutes, v.secondes || 0);
  const r = {
    recordId: `${session}-v${index}-c${cut}`, visitId: `vid-${session}-${index}-${cut}`, nativeSessionId: session, visitIndex: index,
    identity: identite(cut, partie), startedAt: t(debut), endedAt: fin ? t(fin) : undefined,
    initialObserved: etat(cut, initiale, partie), firstObserved: etat(cut, initiale, partie), lastObserved: etat(cut, derniere || initiale, partie),
    humanFinalReference: validation ? { state: etat(cut, validation, partie) } : null,
    observedLabelCandidate: etiquette || (validation ? 'VALIDATE_CORRECTED_BOTH' : 'PASS_NO_DECISION'), status: validation ? 'complete' : 'partial',
  };
  if (sansId) delete r.recordId;
  return r;
}

/* Un export Écho (format v2 clair). `nom` : nom du fichier (ariane-echo-… ou ariane-native-v4-…). */
function exportEcho({ session, debutSession, stamp, index = 1, records }) {
  return {
    format: 'banane-native-session-v2', version: 'test', exportedAt: '2031-05-01T12:00:00.000Z',
    session: { id: session, startedAt: typeof debutSession === 'string' ? debutSession : horodatage(debutSession.minutes, debutSession.secondes || 0) },
    segment: { index, stamp }, records,
  };
}
const ecrire = (dossier, nom, doc) => { const f = path.join(dossier, nom); fs.writeFileSync(f, JSON.stringify(doc)); return f; };

/* Un journal Orbite minimal : les cuts de `poses` sont posés ({ cut, partie, gauche, droit } : pose posée, repère de la scène du journal). */
function journal(poses) {
  const events = [], records = [];
  for (const p of poses) {
    const id = identite(p.cut, p.partie ?? 90);
    events.push({ eventId: `vp-${p.cut}`, timestamp: '2031-05-01T07:00:00.000Z', type: 'validation-accepted', identity: id });
    records.push({ recordId: `jr-${p.cut}`, identity: id, capturedAt: '2031-05-01T07:01:00.000Z', rails: {
      left: { initial: rail(p.gauche), corrected: rail(p.gauche) }, right: { initial: rail(p.droit), corrected: rail(p.droit) } } });
  }
  return { format: 'ariane-journal-v4', version: 'test', events, records };
}

module.exports = { identite, rail, etat, decaler, horodatage, visite, exportEcho, ecrire, journal };
