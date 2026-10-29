'use strict';
/* CH-017 — montage des essais du PILOTE de la file de parties : service worker réel en VM (tests/helpers/perf-production.cjs), FAUX ADAPTATEUR qui
 * connaît `changerPartie` (l'interface proposée pour src/adapter-page.js), et LOT SIMULÉ au niveau du moteur : `engine.startBatch` est remplacé par
 * un lot qui reste RUNNING jusqu'à ce que l'essai le close (`clore`), la relecture par un état posé à la main (`relire`). Le chemin « Démarrer » du
 * service worker (toutes ses gardes, le scope figé) est le vrai. Le sujet est la file, pas le lot : le lot réel tourne dans l'essai navigateur
 * (tests/esv-maquette/file-parties.test.cjs).
 * Deux « vies » du service worker partagent l'ESV simulé, chrome.storage.local et le magasin ; `tuer()` gèle la vie courante (ses accès au stockage,
 * au magasin et à ESV restent sans réponse, comme un service worker arrêté), `vie()` en démarre une nouvelle sur ce qui a été écrit. */
const { production, memoire } = require('./perf-production.cjs');
const { MemoryStore, SimulatedESV } = require('../fixtures.cjs');
const S = require('../../src/settings.js');
const jamais = () => new Promise(() => {});
const attendre = ms => new Promise(r => setTimeout(r, ms));
const FICHE = { actif: true, ticMs: 15, passeGraceMs: 40, relectureAttenteMs: 3000, changementBorneMs: 600, pollMs: 15 };
const LOT_ARGS = { testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', unresolvedPolicy: 'defer', lotDecision: 'apply', geometryEngine: 'geometry-candidate-v1' };

/* Faux adaptateur : parties 23 à 26 dans le sélecteur ; « changerPartie » répond tout de suite (accusé de demande) et la page affiche la partie
 * demandée 30 ms plus tard (variante « rechargement » : autre page). Réglages : `capacite` (false : adaptateur d'aujourd'hui), `refus`, `bloque`
 * (la page ne change jamais de partie), `muet` (ping sans réponse). */
class EsvParties extends SimulatedESV {
  constructor() { super(); Object.assign(this, { parts: [23, 24, 25, 26], capacite: true, refus: null, bloque: false, muet: false }); this.identity.cut = 5; }
  async ping(o) {
    if (this.muet) throw Error('Adaptateur ESV sans réponse (essai).');
    const r = await super.ping();
    if (this.capacite) r.capacites = ['changerPartie'];
    if (o?.contrat) r.selecteurParties = { status: 'ok', current: this.identity.part, parts: this.parts.map(part => ({ part, label: 'Part ' + part, current: part === this.identity.part })) };
    return r;
  }
  async changerPartie({ part }) {
    this.calls.push('changerPartie:' + part);
    if (this.refus) return { ok: false, raison: this.refus };
    if (!this.parts.includes(part)) return { ok: false, raison: 'partie-absente' };
    const de = { part: this.identity.part, cut: this.identity.cut };
    if (part === this.identity.part) return { ok: true, deja: true, mode: 'lien', de, vers: part };
    if (!this.bloque) setTimeout(() => { this.identity = { ...this.identity, part, cut: 1, pageId: 'page-' + part }; }, 30);
    return { ok: true, mode: 'lien', de, vers: part };
  }
}

/* Tous les montages ouverts : `fermer()` gèle chaque vie à la fin d'un essai (le tic de la file s'éteint, le processus peut finir). */
const ouverts = [];
function fermer() { for (const M of ouverts.splice(0)) for (const v of M.vies) v.geler?.(); }
function montage({ fiche = FICHE, adapter = new EsvParties() } = {}) {
  const local = memoire(), store = new MemoryStore(), vies = [];
  const M = { adapter, local, store, vies, lots: [] };ouverts.push(M);
  M.vie = async () => {
    const v = { n: vies.length + 1, gelee: false };
    const loc = { get: k => v.gelee ? jamais() : local.get(k), set: o => v.gelee ? jamais() : local.set(o), remove: k => v.gelee ? jamais() : local.remove(k) };
    const magasin = new Proxy(store, { get: (c, p) => { const x = c[p]; return typeof x === 'function' ? (...a) => v.gelee ? jamais() : x.apply(c, a) : x; }, set: (c, p, x) => { c[p] = x; return true; } });
    const b = production({ adapter, local: loc, store: magasin });
    b.ctx.BananeSettings = { ...b.ctx.BananeSettings, file: fiche };
    const envoyer = b.ctx.chrome.tabs.sendMessage, onglet = b.ctx.chrome.tabs.get;
    b.ctx.chrome.tabs.sendMessage = async (id, m) => v.gelee ? jamais() : envoyer(id, m);
    b.ctx.chrome.tabs.get = async id => { if (v.gelee) return jamais(); if (M.ongletFerme) throw Error('No tab with id: ' + id); return onglet(id); };
    v.b = b; vies.push(v); M.b = b;
    await b.get('ready');
    /* Lot simulé : il reste RUNNING jusqu'à `clore` ; son scope est celui que le vrai « Démarrer » a calculé. */
    const eng = b.get('engine');
    eng.startBatch = async a => { const lot = { id: 'lot-' + (M.lots.length + 1), state: 'RUNNING', scope: JSON.parse(JSON.stringify(a)), processed: [], deferred: [], skipped: [], manuallyCompleted: [], interrupted: [] };
      eng.s.batch = lot; M.lots.push(lot); return eng.view(); };
    v.geler = () => { v.gelee = true; b.ctx.BananeSettings = { ...b.ctx.BananeSettings, file: { ...fiche, actif: false } }; };
    return b;
  };
  M.tuer = () => vies.at(-1).geler();
  M.engine = () => M.b.get('engine');
  M.etat = () => M.b.get('fileP').etat;
  M.jusqua = async (pred, ms = 3000, quoi = 'condition') => { const fin = Date.now() + ms; while (Date.now() < fin) { if (pred()) return; await attendre(5); } throw Error('délai dépassé : ' + quoi + ' ; état ' + JSON.stringify(M.etat()?.etat) + ' ' + JSON.stringify(M.etat()?.motifFin)); };
  /* Clôt le lot courant ; `stoppedAtEnd` par défaut : fin de partie atteinte. */
  M.clore = (champs = {}) => { const lot = M.engine().s.batch; Object.assign(lot, { state: 'STOPPED', stoppedAtEnd: { issue: 'dernier-cut-valide', reason: 'dernier-cut', cut: 9, at: new Date().toISOString() }, processed: [{ cut: 5 }, { cut: 6 }], deferred: [{ cut: 7 }] }, champs); return lot; };
  /* La relecture du lot courant, finie (ou dans l'état donné). */
  M.relire = (champs = {}) => { const lot = M.engine().s.batch; M.b.get('relecture').passe = { gen: 99, lotId: lot.id, mode: 'corriger', modeEffectif: 'corriger', etat: 'finie', total: 4, faits: 4, corriges: 1, refusees: 0, ...champs }; };
  M.demarrer = async (n, extra = {}) => { await M.b.api('connect', { tabId: 1 }); await M.b.api('settings', { mode: 'automatic-test' }); return M.b.api('file-demarrer', { n, lotArgs: LOT_ARGS, ...extra }); };
  /* Une partie normale : lot clos en fin de partie, pas de passe (profil hors L1-se en VM : « absente »), relecture finie. */
  M.partie = async (rang) => {
    await M.jusqua(() => M.etat()?.etat === 'lot' && M.etat()?.k === rang && M.etat()?.partie?.lotId, 3000, 'lot de rang ' + rang);
    M.clore(); await M.jusqua(() => M.etat()?.etat === 'relecture', 3000, 'relecture attendue'); M.relire();
  };
  M.commandesEsv = () => M.b.commands.map(c => c.action);
  M.journal = type => M.store.events.filter(e => e.type === type);
  return M;
}
module.exports = { montage, fermer, EsvParties, FICHE, LOT_ARGS, attendre, S };
