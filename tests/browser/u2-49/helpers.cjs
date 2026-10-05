'use strict';
// Outils des scénarios du banc. Interactions clavier uniquement ; focus() ne sert
// qu'à fixer le point de départ d'une séquence.
const assert = require('node:assert/strict');
class Blocked extends Error { constructor(message) { super(message); this.name = 'Blocked'; } }

const focusId = p => p.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);

async function key(p, id, touche = 'Enter') {
  const e = p.locator('#' + id);
  assert.ok(await e.isVisible(), id + ' visible'); assert.ok(await e.isEnabled(), id + ' disponible');
  await e.focus(); await p.keyboard.press(touche);
}
async function until(p, fn, arg) { await p.waitForFunction(fn, arg, { timeout: 2000, polling: 20 }); }
async function calls(p, action) { return p.evaluate(a => __u2.calls.filter(c => c.action === a), action); }
async function tick(p) { const n = await p.evaluate(() => __u2.views); await until(p, n => __u2.views > n, n); }
async function trace(p) { return p.evaluate(() => globalThis.__u2?.trace || []); }

// Commande rendue : ni désactivée, ni cachée (display:none, visibility, tiroir
// <details> fermé : contenu non rendu). checkVisibility suit ces trois cas ;
// getClientRects seul compte à tort le contenu d'un <details> fermé.
// Les pages d'extension MV3 interdisent eval : le filtre est posé une fois par page.
const SELECTEUR = 'button,input,select,summary,a[href],[tabindex]';
async function rendu(p) {
  await p.evaluate(() => { globalThis.__u2rendu = e => !e.disabled && e.tabIndex >= 0 && e.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }); });
}

async function available(p) {
  await rendu(p);
  return p.evaluate(sel => [...document.querySelectorAll(sel)].filter(__u2rendu)
    .map(e => ({ id: e.id || e.closest('details')?.id || e.textContent.trim(), tag: e.tagName, tabindex: e.tabIndex })), SELECTEUR);
}
const courant = p => p.evaluate(() => { const e = document.activeElement; return { id: e.id || e.closest('details')?.id || e.textContent.trim(), tag: e.tagName, tabindex: e.tabIndex }; });

async function tabOrder(p) {
  const expected = await available(p);
  assert.ok(expected.length > 0);
  assert.ok(expected.every(e => e.tabindex === 0), 'pas de tabindex positif');
  await p.evaluate(sel => { [...document.querySelectorAll(sel)].find(__u2rendu)?.focus(); }, SELECTEUR);
  const seen = [];
  for (let i = 0; i < expected.length; i++) {
    const cur = await courant(p); seen.push(cur);
    const style = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return { width: s.outlineWidth, style: s.outlineStyle }; });
    // Le Tab précédent établit :focus-visible ; le premier focus programmatique n'est pas évalué.
    if (i > 0) assert.ok(parseFloat(style.width) > 0 && style.style !== 'none', 'focus clavier visible : ' + cur.id);
    if (i < expected.length - 1) await p.keyboard.press('Tab');
  }
  assert.deepEqual(seen, expected, 'ordre Tab DOM visible/disponible');
  const reversed = [];
  for (let i = expected.length - 1; i >= 0; i--) { reversed.push(await courant(p)); if (i > 0) await p.keyboard.press('Shift+Tab'); }
  assert.deepEqual(reversed, [...expected].reverse(), 'retour inverse sans piège');
  return seen;
}

async function focusAvailable(p) {
  const id = await focusId(p);
  assert.notEqual(id, 'BODY', 'focus perdu sur body'); assert.notEqual(id, 'HTML');
  assert.ok(await p.evaluate(() => { const e = document.activeElement; return !e.disabled && e.getClientRects().length > 0; }), 'focus sur commande disponible');
  return id;
}

// Zoom navigateur de l'onglet du panneau (même mécanisme que Ctrl + / menu de zoom :
// niveau de zoom de l'hôte, portée par origine par défaut).
async function zoomLevel(p) {
  return p.evaluate(async () => { const t = await chrome.tabs.getCurrent(); return t?.id ? chrome.tabs.getZoom(t.id) : null; });
}
async function zoomReset(p) {
  return p.evaluate(async () => { const t = await chrome.tabs.getCurrent(); if (!t?.id) return null; await chrome.tabs.setZoom(t.id, 0); return chrome.tabs.getZoom(t.id); });
}
async function zoom200(p) {
  const before = await p.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
  let initial, zoom;
  try {
    initial = await zoomLevel(p);
    zoom = await p.evaluate(async () => {
      const t = await chrome.tabs.getCurrent(); if (!t?.id) throw Error('tab id absent');
      await chrome.tabs.setZoom(t.id, 2); return chrome.tabs.getZoom(t.id);
    });
  } catch (e) { throw new Blocked('Zoom navigateur via chrome.tabs.setZoom refusé : ' + e.message); }
  // Sans ce garde, un zoom resté d'un scénario précédent (portée par origine)
  // rend la mesure impossible : métriques déjà à 200 % avant setZoom.
  if (initial !== 1) throw new Blocked('Zoom initial différent de 100 % (' + initial + ') : mesure impossible');
  if (zoom !== 2) throw new Blocked('getZoom ne confirme pas 200 % : ' + zoom);
  try { await until(p, b => devicePixelRatio > b.dpr * 1.8 || innerWidth < b.width * .6, before); }
  catch (e) { throw new Blocked('getZoom confirme 2 mais le changement de métriques CSS/DPR n’est pas obtenu : ' + e.message); }
  const after = await p.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
  return { method: 'chrome.tabs.setZoom(2), chrome.tabs.getZoom() et métriques CSS ; viewport inchangé', initial, zoom, before, after };
}

// Débordement, troncature, puis accès de chaque commande rendue après défilement
// (hit-test au centre, hors recouvrement de la barre d'actions collante).
async function mesure(p) {
  const result = await p.evaluate(() => ({
    width: innerWidth, scroll: document.documentElement.scrollWidth,
    truncated: [...document.querySelectorAll('p,label,button,summary,.lbl,small,b,li span')].filter(e => e.checkVisibility())
      .filter(e => { const s = getComputedStyle(e); return ['hidden', 'clip'].includes(s.overflowX) && e.scrollWidth > e.clientWidth + 1; })
      .map(e => e.id || e.textContent.trim().slice(0, 60)),
  }));
  await rendu(p);
  const ids = await p.evaluate(() => {
    document.querySelectorAll('[data-u2-control]').forEach(e => e.removeAttribute('data-u2-control'));
    return [...document.querySelectorAll('button,input,select,summary')].filter(__u2rendu).map((e, i) => { e.setAttribute('data-u2-control', String(i)); return String(i); });
  });
  const masquees = [];
  for (const id of ids) {
    const el = p.locator('[data-u2-control="' + id + '"]');
    await el.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'nearest' }));
    const hit = await el.evaluate(e => {
      const b = e.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2, at = document.elementFromPoint(x, y);
      return { ok: b.width > 0 && b.height > 0 && b.left >= -1 && b.right <= innerWidth + 1 && y >= 0 && y < innerHeight && e.contains(at),
        id: e.id || e.textContent.trim().slice(0, 60), boite: [b.x, b.y, b.width, b.height].map(Math.round), touche: at ? (at.id || at.tagName + '.' + at.className) : null };
    });
    if (!hit.ok) masquees.push(hit);
  }
  return { ...result, commandes: ids.length, masquees };
}
async function layout(p, etape = 'tel que rendu') {
  const r = await mesure(p);
  const debordants = r.scroll > r.width + 1 ? await p.evaluate(w => [...document.querySelectorAll('body *')].filter(e => e.checkVisibility())
    .filter(e => e.getBoundingClientRect().right > w + 1).filter(e => ![...e.children].some(c => c.getBoundingClientRect().right > w + 1))
    .slice(0, 8).map(e => ({ el: e.id || e.tagName + '.' + e.className, texte: e.textContent.trim().slice(0, 50), droite: Math.round(e.getBoundingClientRect().right), styleBlanc: getComputedStyle(e).whiteSpace })), r.width) : [];
  r.debordants = debordants;
  assert.ok(r.scroll <= r.width + 1, `[${etape}] débordement horizontal ` + JSON.stringify({ width: r.width, scroll: r.scroll, debordants }));
  assert.deepEqual(r.truncated, [], `[${etape}] texte tronqué`);
  assert.deepEqual(r.masquees, [], `[${etape}] commande masquée ` + JSON.stringify(r.masquees));
  return r;
}
// Tiroirs <details> de la vue ouverts au clavier (Entrée sur summary), puis même contrôle.
async function ouvrirTiroirs(p) {
  const fermes = await p.evaluate(() => {
    const vue = document.querySelector('.vue:not([hidden])') || document;
    return [...vue.querySelectorAll('details:not([open])')].filter(d => d.checkVisibility()).map((d, i) => { d.setAttribute('data-u2-tiroir', String(i)); return String(i); });
  });
  for (const i of fermes) { await p.locator(`[data-u2-tiroir="${i}"] > summary`).focus(); await p.keyboard.press('Enter'); }
  const ouverts = await p.evaluate(() => [...document.querySelectorAll('[data-u2-tiroir]')].filter(d => d.open).length);
  assert.equal(ouverts, fermes.length, 'tiroirs ouverts au clavier');
  return ouverts;
}
async function layoutTiroirsOuverts(p) { const ouverts = await ouvrirTiroirs(p); return { tiroirsOuverts: ouverts, ...(await layout(p, 'tiroirs ouverts')) }; }

module.exports = { assert, Blocked, key, until, calls, tick, trace, available, tabOrder, focusId, focusAvailable,
  zoomLevel, zoomReset, zoom200, mesure, layout, ouvrirTiroirs, layoutTiroirsOuverts };
