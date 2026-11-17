'use strict';
/* CH-135 : LES SCÈNES DU VRAI PANNEAU EN CADRAN (et en instrument pour comparer). Chaque scène : panel.html chargé avec une API Chrome simulée (aucun message
 * réel, données fabriquées : états de chantiers/CH-104/outils/capturer.cjs), la présentation choisie par le geste des Réglages
 * (`sg:choix:variante:cadran`), le thème (`sg:choix:theme:clair`), puis les gestes de la scène. Sert à la page de démonstration et à l'audit.
 * Usage : const {SCENES,ouvrirScene}=require('./scenes.cjs'). */
const path = require('node:path');
const R = path.resolve(__dirname, '../../..');
const { ouvrirPanneau } = require(R + '/tests/helpers/panneau-local.cjs');
const { E, MESURE, lot, id } = require(R + '/chantiers/CH-104/outils/capturer.cjs');
const A = (nom, gestes, x = {}) => ({ ...E[nom], gestes: [...(E[nom].actions || []), ...gestes], ...x });
/* Ordre de la page : Orbite, relecture, rattrapage, Constellation, Aurore, Écho, couches. */
const SCENES = {
  repos: A('pret', []), cours: A('cours', []), pause: A('pause', []), arrete: A('lot-arrete', []), fin: A('fin', []),
  toi: A('toi', []), muet: A('panne', []), erreur: { state: lot('ERROR', 4811, { activeIdentity: null }), gestes: [] },
  'sans-onglet': A('sans-onglet', []),
  relecture: A('relecture', []), 'relecture-pause': A('relecture-pause', []), 'relecture-interrompue': A('relecture-interrompue', []),
  rattrapage: A('rattrapage', []),
  constellation: A('file-cours', ['sg:onglet-file']), 'constellation-passage': A('file-passage', ['sg:onglet-file']), 'constellation-arret': A('file-arret', ['sg:onglet-file']),
  'constellation-fin': A('file-fin', ['sg:onglet-file']), 'constellation-stats': A('file-fin', ['sg:onglet-file', 'sg:stats']), 'constellation-repos': A('file-repos', ['sg:onglet-file']),
  aurore: A('aurore', []), 'aurore-vide': A('aurore-vide', []),
  echo: A('echo', []),
  details: A('cours', ['sg:details']), tiroir: A('tiroir', []), menu: A('menu', []), palette: A('palette', []), reglages: A('reglages', []), esv: A('esv', []),
  'boite-file': A('boite-file', []), tech: A('tech', []),
};
async function ouvrirScene(nav, sc, { largeur = 600, hauteur = 760, variante = 'cadran', theme = 'sombre', echelle = 1 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: echelle }), page = await ctx.newPage(), erreurs = [];
  page.on('pageerror', x => erreurs.push(x.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FILE_NOT_FOUND/.test(m.text())) erreurs.push('console: ' + m.text()); });
  const state = JSON.parse(JSON.stringify({ connection: sc.connexion || { status: 'ready', observedAt: 't', message: null, tabId: 1 }, ...sc.state, fileParties: sc.state.fileParties ?? null })
    .replace(/"MAINTENANT-(\d+)"/g, (_, s) => JSON.stringify(new Date(Date.now() - s * 1000).toISOString())));
  const onglets = sc.onglets || [{ id: 1, title: 'ESV', pret: true, utilise: true, index: 0, windowId: 1, active: true }];
  await page.addInitScript(({ state, rel, fiches, onglets, file }) => {
    const rep = { view: state, 'list-tabs': onglets, 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false }, 'raison-choix-etat': { actif: false, touches: 'chiffres' },
      'relecture-choix-etat': { mode: 'corriger' }, 'relecture-etat': rel, 'bandeau-etat': { on: false }, 'fiches-depart': { fiches } }, st = {};
    window.__appels = [];
    window.fetch = async () => ({ json: async () => ({ totaux: { tous: { corriges: 2731 } }, creeLe: '2026-10-20T08:00:00Z' }) });
    window.chrome = { runtime: { id: 'essai', getURL: p => new URL(p, location.href).href, connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} } }),
      sendMessage: async m => { window.__appels.push(m.action || m.kind); return { result: m.action in rep ? rep[m.action] : {} }; } },
      storage: { local: { get: async () => ({ ...st }), set: async o => { Object.assign(st, o); } } }, windows: { getCurrent: async () => ({ id: 1, type: 'normal', width: 600, height: 760 }), update: async () => ({}) } };
    if (file) window.__file = file;
  }, { state, rel: sc.rel || { choix: 'corriger', lot: null, passe: null }, fiches: sc.fiches || [], onglets, file: sc.file ?? null });
  await ouvrirPanneau(page, sc.hash || '#automatic'); await page.waitForTimeout(700);
  if (variante !== 'signal') await page.evaluate(v => window.ArianeUi5.agir('sg:choix:variante:' + v), variante);
  if (theme === 'clair') await page.evaluate(() => window.ArianeUi5.agir('sg:choix:theme:clair'));
  for (const g of sc.gestes || []) { await page.evaluate(g => window.ArianeUi5.agir(g), g); await page.waitForTimeout(150); }
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }); await page.waitForTimeout(450);
  return { ctx, page, erreurs };
}
/* Mesure de CH-104 (débordement, troncature, contraste 4,5:1), plus : rien sous 11 px. */
const PETIT = () => { const P = document.querySelector('#ui5 .sg-fen'), out = []; if (!P) return out;
  const zones = [P, ...document.querySelectorAll('#ui5-tech')];
  for (const Z of zones) for (const e of Z.querySelectorAll('*')) { if (!e.getClientRects().length || e.closest('svg')) continue; if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || Number(s.opacity) === 0) continue; const t = parseFloat(s.fontSize); if (t < 11) out.push(`SOUS 11 PX ${e.tagName.toLowerCase()}.${String(e.className || '').split(' ')[0]} « ${e.textContent.trim().slice(0, 24)} » ${t}px`); }
  return [...new Set(out)]; };
module.exports = { SCENES, ouvrirScene, MESURE, PETIT };
