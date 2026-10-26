'use strict';
/* Test 17 — montage des essais de l'habillage du panneau (src/ui5.js) : les trois fichiers de l'habillage chargés en vm contre une page minimale (un faux élément pour
 * chaque `id` de panel.html), un faux `ArianePanel` (l'état du panneau est celui que l'essai pose), un faux stockage de Chrome. Aucun navigateur : le DOM est le
 * strict nécessaire à ce que l'habillage lit et écrit. Données fabriquées. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const racine = path.resolve(__dirname, '../..'), lire = f => fs.readFileSync(path.join(racine, f), 'utf8');
const IDS = [...lire('panel.html').matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);

function element(id) {
  const e = { id, hidden: false, disabled: false, checked: false, open: false, value: '', textContent: '', className: '', dataset: {}, style: {}, clics: 0, scrollTop: 0, innerHTML: '', ecoutes: {},
    classList: { liste: new Set(), toggle(c, on) { on ? this.liste.add(c) : this.liste.delete(c); }, contains(c) { return this.liste.has(c); }, add(c) { this.liste.add(c); } },
    click() { e.clics++; e.onclick?.(); }, addEventListener(type, f) { (e.ecoutes[type] ||= []).push(f); }, getAttribute: () => null,
    querySelectorAll: () => [], querySelector: () => null, appendChild() {}, focus() { e.focuses = (e.focuses || 0) + 1; } };
  return e;
}

/* `stockage` : contenu de chrome.storage.local au départ ; `etat` : état du panneau (`ArianePanel.state()`). */
async function monter({ stockage = {}, etat = null, fenetre = { width: 560, height: 820 } } = {}) {
  const els = Object.fromEntries(IDS.map(id => [id, element(id)])), ecrits = [], envoyes = [];
  els['relecture-arreter'].hidden = true;   /* caché au départ dans panel.html : visible seulement pendant la relecture */
  const body = element('body'); body.dataset.window = 'home';
  const hote = element('ui5'), champ = element('ui5-q'), fenetres = [];
  const hooks = [];
  const document = { body, activeElement: null, readyState: 'complete', getElementById: id => id === 'ui5' ? hote : id === 'ui5-q' ? (hote.innerHTML.includes('id="ui5-q"') ? champ : null) : els[id] || null, createElement: () => hote, addEventListener: (t, f) => (body.ecoutes[t] ||= []).push(f) };
  const ctx = { console, setTimeout, clearTimeout, document, Event: class { constructor(t) { this.type = t; } }, getComputedStyle: () => ({}),
    fetch: async () => ({ json: async () => JSON.parse(lire('datasets/compteur-gcv2.json')) }),
    chrome: { runtime: { getURL: p => 'chrome-extension://test/' + p, sendMessage: async m => { envoyes.push(m); return {}; } },
      storage: { local: { get: async () => ({ ...stockage }), set: async o => { Object.assign(stockage, o); ecrits.push(o); } } },
      windows: { getCurrent: async () => ({ id: 7, type: 'popup', ...fenetre }), update: async (id, o) => { fenetres.push(o); } } },
    ArianePanel: { state: () => ctx.etatPanneau, voieDuLot: () => ({ cuts: [], classe: () => null, ecart: () => null }), travailDuLot: () => null, visitesNatif: () => [],
      apres: f => { hooks.push(f); } },
    etatPanneau: etat };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['src/ui5-variante.js', 'src/signal-rendu.js', 'src/ui5.js']) vm.runInContext(lire(f), ctx, { filename: f });
  await new Promise(r => setTimeout(r, 30));   /* l'initialisation lit le stockage et le compteur */
  const rendu = s => { ctx.etatPanneau = s; for (const h of hooks) h(s); };
  return { ctx, els, hote, champ, document, body, ecrits, envoyes, fenetres, hooks, rendu, stockage, ui: ctx.ArianeUi5, attendre: ms => new Promise(r => setTimeout(r, ms)) };
}
module.exports = { monter, element, IDS };
