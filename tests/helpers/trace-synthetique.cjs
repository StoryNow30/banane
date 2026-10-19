'use strict';
/* Fabrique de données SYNTHÉTIQUES pour les essais de tools/trace-ecritures.cjs : partie 90 inventée, cuts inventés, horloge
 * inventée (2031), générateur pseudo-aléatoire à graine fixe. Rien qui vienne du terrain. */
const fs = require('node:fs'), path = require('node:path');

const T0 = Date.UTC(2031, 4, 1, 8, 0, 0);
const PARTIE = 90;
/* Générateur congruentiel linéaire (graine fixe) : suite reproductible dans [0, 1[. */
function alea(graine) { let s = graine >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const CORPS_SEEN = () => ({ SeenByOperator: true });
const CORPS_VALIDATION = (cut) => ({ ExtractionStatus: 'valid', SeenByOperator: true, TreatedByOperator: true, RailType: 'U50', RailOrientationLeft: 2.5, RailOrientationRight: -2.5,
  XLeftEdge: 1000.123456789 + cut, YLeftEdge: 2000.123456789 + cut, ZLeftEdge: 30.123456789, XRightEdge: 1001.123456789 + cut, YRightEdge: 2000.223456789 + cut, ZRightEdge: 30.223456789 });
const CORPS_SKIP = (cut) => ({ ...CORPS_VALIDATION(cut), ExtractionStatus: 'skipped' });

let compteur = 0;
/* Un relevé `write` de l'observateur. `t` : ms depuis T0 (début de la requête). */
function ecriture({ t, cut, corps, status = 204, attempt = 1, duree = 30, rowIndex = cut, sansCorps = false }) {
  const debut = T0 + t;
  return { eventId: `w-${++compteur}`, timestamp: new Date(debut + duree + 250).toISOString(), type: 'esv-observation', kind: 'write', via: 'xhr', urlClass: 'rail-pair-write', method: 'PUT',
    status, outcome: 'done', attempt, body: sansCorps ? null : corps, rowIndex, startedEpochMs: debut, endedEpochMs: debut + duree, durationMs: duree, observer: { id: 'obs-synth', seq: compteur } };
}
const evenement = ({ t, nom, args }) => ({ eventId: `e-${++compteur}`, timestamp: new Date(T0 + t).toISOString(), type: 'esv-observation', kind: 'esv-event', nom, args, observer: { id: 'obs-synth', seq: compteur } });
const ressource = ({ t, n = 2, octets = 500000 }) => ({ eventId: `r-${++compteur}`, timestamp: new Date(T0 + t).toISOString(), type: 'esv-observation', kind: 'resource', class: 'point-resource', n, ept: n, bytes: octets,
  statuts: { 200: n }, echecs: 0, dureeTotMs: n * 100, observer: { id: 'obs-synth', seq: compteur } });
const pageListe = ({ t }) => ({ eventId: `l-${++compteur}`, timestamp: new Date(T0 + t).toISOString(), type: 'esv-observation', kind: 'list-page', status: 200, observer: { id: 'obs-synth', seq: compteur } });

/* Un cut traité : sélection, écriture seen (si `seen`), validation (si `validation`, `extra` ajoute des champs au corps). Rend les relevés. */
function traiterCut({ t, cut, seen = true, validation = true, delaiSeen = 600, delaiValidation = 700, extra = null, ordreInverse = false, lectures = 2 }) {
  const out = [evenement({ t, nom: 'railPairSelected', args: [String(PARTIE), cut] }), ressource({ t: t + 100, n: lectures })];
  const tSeen = t + delaiSeen, tVal = tSeen + delaiValidation;
  if (seen) out.push(evenement({ t: tSeen, nom: 'railPairSeen', args: [String(PARTIE), cut] }), ecriture({ t: tSeen, cut, corps: CORPS_SEEN() }));
  if (validation) {
    const corps = extra ? { ...CORPS_VALIDATION(cut), ...extra } : CORPS_VALIDATION(cut);
    out.push(ecriture({ t: ordreInverse ? t + 300 : tVal, cut, corps }), evenement({ t: tVal + 200, nom: 'railPairUpdated', args: [String(PARTIE), cut, 'valid'] }), pageListe({ t: tVal + 300 }));
  }
  return out;
}

/* Journal Orbite : un cut par cycle (`cycleMs`, gigue relative `gigue`), numéros `cuts`. */
function journalOrbite({ cuts, cycleMs = 2000, gigue = 0.02, graine = 1, differes = [], traitement = {}, intervalles = null }) {
  const r = alea(graine), events = [];
  let t = 1000;
  cuts.forEach((cut, i) => {
    const id = { pageId: 'page-synth', part: PARTIE, cut, shape: 'U50', frameId: 'frame-synth', projectId: null };
    events.push({ eventId: `p-${++compteur}`, type: 'proposed', identity: id, timestamp: new Date(T0 + t).toISOString() }, { eventId: `c-${++compteur}`, type: 'cut-target-changed', identity: id, timestamp: new Date(T0 + t).toISOString() });
    events.push(...traiterCut({ t, cut, validation: !differes.includes(cut), ...traitement }));
    t += intervalles ? intervalles[i % intervalles.length] : Math.round(cycleMs * (1 + gigue * (2 * r() - 1)));
  });
  return { format: 'banane-test-journal-v4', version: 'test', events, records: [] };
}

/* Export Écho (format v2 clair) : `visites` = [{ cut, t, seen, validation, ... }] ; `extra` = relevés ajoutés (échecs, sauts…). */
function exportEcho({ session = 'sess-synth', visites, extra = [], sansEvenementsWrite = false }) {
  const events = [], records = [];
  visites.forEach((v, i) => {
    const rel = traiterCut({ delaiSeen: 700, delaiValidation: 800, ...v });
    const ecr = rel.filter(e => e.kind === 'write');
    events.push(...(sansEvenementsWrite ? rel.filter(e => e.kind !== 'write') : rel));
    records.push({ recordId: `${session}-v${i}`, nativeSessionId: session, visitIndex: i, identity: { pageId: 'page-synth', part: PARTIE, cut: v.cut, shape: 'U50', frameId: 'frame-synth', projectId: null },
      startedAt: new Date(T0 + v.t).toISOString(), endedAt: new Date(T0 + v.t + 3000).toISOString(),
      serverWrites: ecr.map(e => ({ eventId: e.eventId, at: e.timestamp, kind: e.body && e.body.ExtractionStatus === 'valid' ? 'validation' : 'seen', status: e.status, method: e.method, outcome: e.outcome, attempt: e.attempt, rowIndex: e.rowIndex, body: e.body, joinMethod: 'row-index' })) });
  });
  events.push(...extra);
  return { format: 'banane-native-session-v2', version: 'test', exportedAt: new Date(T0).toISOString(), session: { id: session, startedAt: new Date(T0).toISOString() }, segment: { index: 1, stamp: '2031-05-01T09-00-00' }, records, events };
}
/* Intervalles « humains » : entre 1,8 s et 6,8 s (queue vers les petites valeurs), une pause de 40 s toutes les huit. */
function intervallesHumain(n, graine = 7) {
  const r = alea(graine);
  return Array.from({ length: n }, (_, i) => (i % 8 === 7 ? 40000 : 1800 + Math.round(5000 * r() * r())));
}
const ecrire = (dossier, nom, doc) => { const f = path.join(dossier, nom); fs.writeFileSync(f, JSON.stringify(doc)); return f; };

module.exports = { intervallesHumain, T0, PARTIE, alea, ecriture, evenement, ressource, traiterCut, journalOrbite, exportEcho, ecrire, CORPS_SEEN, CORPS_VALIDATION, CORPS_SKIP };
