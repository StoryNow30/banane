'use strict';
// Double du backend pour le banc U2/U1. Données exclusivement synthétiques :
// aucune géométrie, aucun export opérateur, aucun onglet ESV, aucune capture ESV.

// Identité complète (session, page, repère, forme) : nécessaire au résumé U1.
function identite(cut, part = 23, extra = {}) {
  return { project: 'U2-SYNTHETIQUE', projectId: 'U2-PROJET', pageId: 'u2-page', frameId: 'u2-repere', shape: 'U2-FORME', part, cut, ...extra };
}

function fixture(mode = 'idle') {
  const s = {
    current: { identity: { project: 'U2-SYNTHETIQUE', part: 1, cut: 10 } }, busy: false,
    manual: null, native: null, batch: null, notice: 'État synthétique U2', intent: null, reconcileRequired: false,
  };
  if (['running', 'paused', 'error', 'unresolved', 'completed'].includes(mode)) s.batch = {
    id: 'U2-LOT-SYNTHETIQUE',
    state: { running: 'RUNNING', paused: 'PAUSED', error: 'ERROR', unresolved: 'PAUSED_UNRESOLVED_RAIL', completed: 'COMPLETED' }[mode],
    step: mode === 'unresolved' ? 'apply' : 'capture', pauseReason: mode === 'unresolved' ? 'unresolved-rail' : null,
    scope: { part: 1, start: 10, end: 20, unresolvedPolicy: 'defer', lotDecision: 'apply', geometryEngine: 'geometry-candidate-v1', lowConfidence: 'attempt' },
    activeIdentity: { project: 'U2-SYNTHETIQUE', part: 1, cut: 10 },
    processed: [], skipped: [], deferred: [], paused: [], interrupted: [], manuallyCompleted: [], sequence: [], lotCommands: {},
  };
  if (mode === 'busy') s.busy = true;
  if (mode === 'native-running') s.native = { id: 'U2-ECHO-SYNTHETIQUE', status: 'RUNNING', visits: [], incomplete: [], message: 'Observation synthétique U2' };
  if (mode === 'native-paused') s.native = { id: 'U2-ECHO-SYNTHETIQUE', status: 'PAUSED', visits: [], incomplete: [], message: 'Pause synthétique U2' };
  return s;
}

// États du résumé de partie U1 : identité complète et session déclarée.
function fixtureResume({ part = 23, cut = 30, batch = null } = {}) {
  const s = fixture('idle');
  s.sessionId = 'u2-session';
  s.current = { identity: identite(cut, part) };
  if (batch) {
    s.batch = {
      ...fixture('running').batch, id: batch.id, state: batch.state, startedAt: batch.startedAt,
      scope: { ...fixture('running').batch.scope, part, start: batch.start ?? cut, end: batch.end ?? cut + 10, pageId: 'u2-page' },
      activeIdentity: identite(cut, part),
    };
  }
  return s;
}

// Événements bruts tels que stockés dans IndexedDB (store « events », clé eventId).
// Seuls les champs projetés par src/part-summary-49.js sont présents.
function evenement(type, cut, seconde, extra = {}, part = 23) {
  const ts = `2026-10-02T08:00:${String(seconde).padStart(2, '0')}.000Z`;
  return { type, eventId: `u2-${type}-${part}-${cut}-${seconde}`, timestamp: ts, sessionId: 'u2-session', identity: identite(cut, part), ...extra };
}
function debutLot(id, cut, seconde, part = 23) {
  return evenement('batch-started', cut, seconde, { batch: { id, startedAt: `2026-10-02T08:00:${String(seconde).padStart(2, '0')}.000Z`, scope: { part, pageId: 'u2-page' } } }, part);
}

// Installé AVANT panel.js, dans la vraie page chrome-extension://.../panel.html.
// Seule chrome.runtime.sendMessage est remplacée. connect, DOM, CSS, IndexedDB
// et scripts du panneau restent réels. `options.fault` injecte une panne
// (test seulement), `options.trace` journalise le focus pour les diagnostics.
function installer(options) {
  const initial = options && options.initial ? options.initial : options;
  const copie = x => JSON.parse(JSON.stringify(x));
  const backend = globalThis.__u2 = {
    synthetic: true, state: copie(initial), calls: [], errors: {}, views: 0, trace: [],
    replace(s) { this.state = copie(s); }, fail(action, message) { this.errors[action] = message; },
  };
  if (!globalThis.chrome?.runtime?.id) throw Error('U2 : origine extension absente');

  // Journal de focus : focusin/focusout, changements hidden/disabled des boutons,
  // et tout changement d'activeElement relevé à chaque image (même silencieux).
  if (options && options.trace) {
    const t0 = performance.now(), nom = e => e ? (e.id || e.tagName) : null;
    const log = (type, detail) => { if (backend.trace.length < 400) backend.trace.push({ t: Math.round(performance.now() - t0), type, ...detail }); };
    addEventListener('focusin', e => log('focusin', { el: nom(e.target) }), true);
    addEventListener('focusout', e => log('focusout', { el: nom(e.target), vers: nom(e.relatedTarget) }), true);
    addEventListener('keydown', e => log('keydown', { touche: e.key, el: nom(e.target) }), true);
    addEventListener('click', e => log('click', { el: nom(e.target) }), true);
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(ms => {
        for (const m of ms) {
          const el = m.target;
          if (el.tagName === 'BUTTON' && el.id) log(m.attributeName, { el: el.id, valeur: el.hasAttribute(m.attributeName), actif: nom(document.activeElement) });
        }
      }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled'] });
    });
    // Transactions IndexedDB ouvertes par la page (mode) : relevé passif.
    backend.idb = [];
    const tx0 = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (stores, mode) { backend.idb.push({ stores: [].concat(stores).join(','), mode: mode || 'readonly' }); return tx0.apply(this, arguments); };
    let actif = null;
    const veille = () => { const a = nom(document.activeElement); if (a !== actif) { log('actif', { el: a, avant: actif }); actif = a; } requestAnimationFrame(veille); };
    requestAnimationFrame(veille);
  }

  // Panne injectée du stockage (cas « historique indisponible ») : test seulement.
  if (options && options.fault === 'indexeddb-indisponible') {
    IDBFactory.prototype.open = function () { throw new DOMException('Panne injectée par le banc U2 : stockage indisponible', 'UnknownError'); };
  }

  const send = async message => {
    if (message?.kind !== 'panel') throw Error('U2 : aucun message hors double autorisé');
    const { action, args } = message; backend.calls.push({ action, args: copie(args || {}) });
    if (backend.errors[action]) return { error: backend.errors[action] };
    const s = backend.state; let result = {};
    switch (action) {
      case 'view': backend.views++; result = copie(s); break;
      case 'list-tabs': result = []; break; // aucun onglet ESV, réel ou simulé
      case 'bandeau-etat': result = { on: false }; break;
      case 'bornes-partie': result = { last: null, source: null }; break;
      case 'native-health': case 'native-quality': result = null; break;
      case 'native-export-advice': result = { advised: false }; break;
      case 'settings': case 'bandeau': break;
      case 'start': s.batch = copie(initial.__running); break;
      case 'pause': s.batch.state = 'PAUSED'; s.notice = 'Pause synthétique U2'; break;
      case 'resume': s.batch.state = 'RUNNING'; break;
      case 'stop': s.batch.state = 'STOPPED'; break;
      case 'retry': s.batch.state = 'RUNNING'; break;
      case 'native-start': s.native = { id: 'U2-ECHO-SYNTHETIQUE', status: 'RUNNING', visits: [], incomplete: [] }; break;
      case 'native-pause': s.native.status = 'PAUSED'; break;
      case 'native-resume': s.native.status = 'RUNNING'; break;
      default: return { error: 'U2 : action non simulée ' + action };
    }
    return { result };
  };
  chrome.runtime.sendMessage = send;
  if (chrome.runtime.sendMessage !== send) throw Error('U2 : double non installé');
}

module.exports = { fixture, fixtureResume, identite, evenement, debutLot, installer };
