'use strict';
/* CH-134 : les scènes de l'audit et de l'équivalence (vrai panneau, API Chrome simulée, données fabriquées de chantiers/CH-104/outils/capturer.cjs).
 * Les 13 scènes de CH-129, ses scènes en plus (capture de l'opérateur, Constellation 7 sur 8, statistiques, Réglages, détails ouverts), la
 * Constellation arrêtée sur une correction interrompue (CH-132), la relecture en pause avec ses bornes (CH-133). `actions` : gestes de Signal. */
const path = require('node:path');
const R = path.resolve(__dirname, '../../..');
const { E, lot, FICHES } = require(R + '/chantiers/CH-104/outils/capturer.cjs');
const clone = o => JSON.parse(JSON.stringify(o));
const plan = [1, 2, 3, 4, 5, 6, 7, 8], P = (part, rang) => ({ part, rang, issueLot: 'fin', motifs: ['fin-normale'], resume: { poses: 80 + rang * 7, differes: 3 + rang % 4 }, passe: null, relecture: { issue: 'finie', corriges: 2 + rang % 3 }, alertes: [] });
const vueF = (etat, rang, o = {}) => ({ id: 'file-1', etat, n: 8, plan, rang, enCours: { part: plan[rang], rang, lot: etat === 'lot' }, changement: null, bilan: plan.slice(0, rang).map((p, i) => P(p, i)), motifFin: null, alerte: null, reprises: 0, ...o });
const relCap = { ...clone(E.relecture.rel), passe: { ...E.relecture.rel.passe, faits: 153, total: 324, corriges: 11 } };
const plan2 = [13, 14, 15, 16, 17], P2 = (part, rang) => ({ part, rang, issueLot: 'fin', motifs: ['fin-normale'], resume: { poses: 80 + rang * 7, differes: 4 }, passe: null, relecture: { issue: 'finie', corriges: 2 }, alertes: [] });
const arret = { id: 'file-1', etat: 'arret', n: 5, plan: plan2, rang: 2, enCours: null, changement: null, bilan: [P2(13, 0), P2(14, 1), { ...P2(15, 2), interrompue: true, relecture: { issue: 'arretee', corriges: 1 }, motifs: ['ecriture-incertaine'] }],
  motifFin: { code: 'ecriture-incertaine', texte: 'correction interrompue au cut 2475 : à contrôler dans ESV' }, alerte: { texte: 'Correction interrompue au cut 2475 : contrôle ce cut dans ESV, puis clique sur « J’ai contrôlé le cut 2475 ».' }, reprise: { rang: 2, part: 15, reste: 3 }, reprises: 0 };
const RI = E['relecture-interrompue'];
const relPause = { ...clone(E['relecture-pause'].rel), passe: { ...E['relecture-pause'].rel.passe, pauseRaison: 'points', bornesProposees: { debut: 4796, fin: 4811 }, totalPartie: 5200 }, repriseReglage: { actif: true, f5: 'pause' } };
const SCENES = {
  repos: { state: E.pret.state }, cours: { state: E.cours.state }, pause: { state: E.pause.state }, toi: { state: E.toi.state },
  rattrapage: { state: E.rattrapage.state }, relecture: { state: E.relecture.state, rel: E.relecture.rel }, fin: { state: E.fin.state },
  constellation: { ...E['file-cours'], onglet: 'file' }, passage: { ...E['file-passage'], onglet: 'file' }, 'file-fin': { ...E['file-fin'], onglet: 'file' },
  aurore: { state: E.aurore.state, onglet: 'correction' }, panne: { state: E.panne.state }, erreur: { state: lot('ERROR', 4811, { activeIdentity: null }) },
  capture: { state: { ...E.relecture.state, current: { identity: { part: 2, cut: 4801 } }, fileParties: vueF('relecture', 1) }, rel: relCap },
  'lot-file': { state: { ...E.cours.state, fileParties: vueF('lot', 6) } },
  file7: { state: { ...E['file-cours'].state, fileParties: vueF('lot', 6) }, fiches: FICHES, onglet: 'file' },
  stats: { state: { ...E['file-cours'].state, fileParties: vueF('lot', 6) }, fiches: FICHES, onglet: 'file', actions: ['sg:stats'] },
  reglages: { state: E.pret.state, actions: ['sg:reglages'] },
  'cours-details': { state: E.cours.state, actions: ['sg:details'] },
  'file-arret': { state: { ...RI.state, fileParties: arret }, rel: { ...clone(RI.rel), passe: { ...RI.rel.passe, cut: 2475 }, correctionInterrompue: { cut: 2475, part: 15, origine: 'relecture' } }, fiches: FICHES, onglet: 'file' },
  'rel-bornes': { state: E['relecture-pause'].state, rel: relPause },
};
/* L'API Chrome simulée, avant le chargement du panneau ; `vue` : la vue du lot gardée (chrome.storage.local, CH-134). */
async function preparer(page, sc, { vue = null } = {}) {
  const state = JSON.parse(JSON.stringify({ connection: { status: 'ready', observedAt: 't', message: null, tabId: 1 }, ...sc.state, fileParties: sc.state.fileParties ?? null }).replace(/"MAINTENANT-(\d+)"/g, (_, s) => JSON.stringify(new Date(Date.now() - s * 1000).toISOString())));
  await page.addInitScript(({ state, rel, fiches, vue }) => {
    const rep = { view: state, 'list-tabs': [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }], 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false }, 'raison-choix-etat': { actif: false, touches: 'chiffres' },
      'relecture-choix-etat': { mode: 'corriger' }, 'relecture-etat': rel, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches } }, st = vue ? { banane51VueLot: vue } : {};
    window.fetch = async () => ({ json: async () => ({ totaux: { tous: { corriges: 2731 } }, creeLe: '2026-10-20T08:00:00Z' }) });
    window.chrome = { runtime: { id: 'essai', getURL: p => new URL(p, location.href).href, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }), sendMessage: async m => ({ result: m.action in rep ? rep[m.action] : {} }) },
      storage: { local: { get: async () => ({ ...st }), set: async o => { Object.assign(st, o); } } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: 600, height: 760 }), update: async () => ({}) } };
  }, { state, rel: sc.rel || { choix: 'corriger', lot: null, passe: null }, fiches: sc.fiches || [], vue });
}
module.exports = { SCENES, preparer };
