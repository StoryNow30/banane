#!/usr/bin/env node
/* CH-022 : joue les commandes d'une maquette Signal comme l'opérateur (clics et clavier), sans figer
 * la simulation, et vérifie que chaque geste mène à l'état attendu.
 *   CHROMIUM=/opt/pw-browsers/chromium node maquettes/ui-5.0/outils/jouer-signal.cjs Q-signal Q-signal-2 Q-signal-3
 * Sortie : une ligne par geste (ok / ÉCHEC) ; code 1 au moindre échec ou à la moindre erreur de console. */
'use strict';
const path = require('node:path');
const { chromium } = require('playwright');

const ICI = path.resolve(__dirname, '..');
const NOMS = process.argv.slice(2);

(async () => {
  const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  let echecs = 0;
  for (const nom of NOMS) {
    const page = await nav.newPage({ viewport: { width: 1200, height: 900 } });
    const erreurs = []; page.on('pageerror', (e) => erreurs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
    const url = (q) => 'file://' + path.join(ICI, nom + '.html') + '?nu=1&cadence=rapide&' + q;
    const mot = () => page.locator('#fen .mot').innerText();
    const clic = (sel, force = false) => page.locator('#fen ' + sel).first().click({ force, timeout: 5000 });
    const etapes = [];
    const ok = async (lib, f) => { try { const r = await f(); etapes.push([lib, r === false ? 'ÉCHEC' : 'ok']); if (r === false) echecs++; } catch (e) { etapes.push([lib, 'ÉCHEC ' + e.message.split('\n')[0]]); echecs++; } };
    const attendre = async (texte, ms = 12000) => { await page.waitForFunction((t) => document.querySelector('#fen .mot')?.textContent === t, texte, { timeout: ms }); return true; };

    await page.goto(url('scene=pret'));
    await ok('Prêt → Démarrer → En cours', async () => { await clic('[data-act="demarrer"]'); return (await mot()) === 'En cours'; });
    await ok('le rail avance (un cut posé en moins de 12 s)', async () => { const a = await page.locator('#fen .compte .chiffre').innerText(); await page.waitForFunction((x) => document.querySelector('#fen .compte .chiffre')?.textContent !== x, a, { timeout: 12000 }); return true; });
    await ok('Pause → Pause demandée → En pause', async () => { await clic('[data-act="pause"]'); if ((await mot()) !== 'Pause demandée') return false; return attendre('En pause'); });
    await ok('Reprendre → En cours', async () => { await clic('[data-act="reprendre"]'); return (await mot()) === 'En cours'; });
    await ok('Ctrl K ouvre la palette, Échap la ferme', async () => { await page.keyboard.press('Control+k'); const o = await page.locator('#fen .palette').count(); await page.keyboard.press('Escape'); return o === 1 && (await page.locator('#fen .palette').count()) === 0; });
    await ok('palette : taper « reg » puis Entrée ouvre les réglages', async () => { await page.keyboard.press('Control+k'); await page.keyboard.type('reg'); await page.keyboard.press('Enter'); return (await page.locator('#fen .feuille').count()) === 1; });
    await ok('Échap ferme les réglages', async () => { await page.keyboard.press('Escape'); return (await page.locator('#fen .feuille').count()) === 0; });
    await ok('Écho verrouillé pendant le lot : le clic dit pourquoi', async () => { await clic('[data-act="activite:echo"]', true); return /après/.test(await page.locator('#fen .barre-note').innerText()); });
    await ok('Arrêter → Terminé', async () => { await clic('[data-act="arreter"]'); return (await mot()) === 'Terminé'; });
    await ok('Voir ce qui reste ouvre le tiroir', async () => { await clic('[data-act="tiroir"].principal, .principal[data-act="tiroir"]'); return (await page.locator('#fen .tiroir[data-ouvert="1"]').count()) === 1; });
    await page.goto(url('scene=fin&revue=v2&tiroir=1'));
    await ok('V2 : ↓ puis E marque le premier cut examiné', async () => { await page.keyboard.press('ArrowDown'); await page.keyboard.press('e'); return (await page.locator('#fen .ligne.examine').count()) === 1; });
    await ok('Exporter puis Vider le cache (confirmation)', async () => { await page.keyboard.press('Escape'); await clic('.actions [data-act="exporter"]'); await clic('.cache [data-act="cache"]'); const b = await page.locator('#fen .boite').count(); await clic('[data-act="cache-vider"]'); return b === 1 && /vidé/i.test(await page.locator('#fen .cache').innerText()); });
    await page.goto(url('scene=incident'));
    await ok('À toi → Passer ce cut… demande confirmation, puis reprend', async () => { await clic('[data-act="passer"]'); const b = await page.locator('#fen .boite').count(); await clic('[data-act="passer-ok"]'); return b === 1 && (await mot()) === 'En cours'; });
    await page.goto(url('scene=sans-esv'));
    await ok('Sans ESV → Choisir un onglet → Connecter → Prêt', async () => { await clic('.principal[data-act="esv"]'); await page.goto(url('scene=esv')); await clic('[data-act="esv-connecter"]'); return (await mot()) === 'Prêt'; });
    await page.goto(url('scene=echo-vide'));
    await ok('Écho : Démarrer l’observation → En observation → Terminer', async () => { await clic('[data-act="echo-demarrer"]'); if ((await mot()) !== 'En observation') return false; await clic('[data-act="echo-terminer"]'); return (await mot()) === 'Aucune séance'; });
    await page.goto(url('scene=file-eteinte').replace('nu=1&', ''));
    await ok('File : ouvrir, allumer, 2 parties, Préparer, Lancer', async () => { await clic('[data-act="file-ouvrir"]'); await clic('[data-file="allumee"][data-val="1"]'); await clic('[data-file="n"][data-val="2"]'); await clic('[data-act="file-preparer"]'); await clic('.principal[data-act="file-lancer"]'); return (await mot()) === 'En cours' && /Partie 1 sur 2/.test(await page.locator('#fen .phrase').innerText()); });
    await ok('File : finir les deux parties → File terminée', async () => { await page.click('.notes [data-sim="finir"]'); await page.click('.notes [data-sim="finir"]'); return (await mot()) === 'File terminée'; });
    await page.goto(url('scene=file-cours').replace('nu=1&', ''));
    await ok('File : provoquer un arrêt → File arrêtée, Préparer la reprise', async () => { await page.click('.notes [data-sim="arret"]'); if ((await mot()) !== 'File arrêtée') return false; await clic('[data-act="file-reprise"]'); return (await mot()) === 'Prêt'; });
    await page.goto(url('scene=cours&largeur=360&taille=compact'));
    await ok('Compact : le tiroir ouvert couvre l’instrument et garde l’état sur la poignée', async () => { await clic('.poignee'); await page.waitForTimeout(400); const t = await page.locator('#fen .tiroir').boundingBox(), b = await page.locator('#fen .barre').boundingBox(); return Math.abs(t.y - (b.y + b.height)) <= 2 && await page.locator('#fen .etat-mini').isVisible(); });
    for (const [l, r] of etapes) console.log(`${nom} · ${r === 'ok' ? 'ok    ' : r + ' '} ${l}`);
    if (erreurs.length) { echecs++; console.log(`${nom} · erreurs de console : ${[...new Set(erreurs)].join(' | ')}`); }
    await page.close();
  }
  await nav.close();
  console.log(echecs ? `${echecs} échec(s)` : 'tout est jouable');
  process.exit(echecs ? 1 : 0);
})();
