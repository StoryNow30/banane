#!/usr/bin/env node
/* CH-023 : preuves de parcours dans les maquettes, sans connexion à ESV.
 * CHROMIUM=<exécutable> node maquettes/ui-5.0/parcours-signal.cjs --sortie <hors dépôt>
 * --balayage : en plus, toutes les largeurs entières de 360 à 600 px.
 * Les commandes de simulation du banc servent à finir une partie sans attendre
 * une durée fictive complète. Les commandes du panneau sont jouées au clic/clavier.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const argv = process.argv.slice(2), i = argv.indexOf('--sortie');
if (i < 0) throw Error('Préciser --sortie hors du dépôt');
const sortie = path.resolve(argv[i + 1]);
if (sortie.startsWith(path.resolve(__dirname, '../..') + path.sep)) throw Error('Sortie exigée hors dépôt');
fs.mkdirSync(sortie, { recursive: true });
const noms = ['Q-signal-b2', 'Q-signal-b3'];
const reussites = [], erreurs = [];
let nav;

async function repertorier(nom) {
  const p = await nav.newPage({ reducedMotion: 'reduce' });
  const u = pathToFileURL(path.join(__dirname, nom + '.html')); u.search = 'nu=1&fige=1&reduit=1';
  await p.goto(u.href);
  const r = await p.evaluate(() => {
    const A = window.ArianeMaquette, scenes = [...document.querySelectorAll('#sc-scene option')].map(e => e.value), commandes = new Set();
    for (const s of scenes) {
      A.scene(s); A.S.tiroir = true; document.documentElement.dataset.revue = 'v2'; A.rendre();
      for (const b of document.querySelectorAll('#fen [data-act]')) if (b.dataset.act) commandes.add(b.dataset.act);
      if (document.querySelector('[data-ouvrir]')) commandes.add('ouvrir-un-cut');
      if (document.querySelector('[data-examine]')) commandes.add('examiner-un-cut');
    }
    return { scenes, commandes: [...commandes].sort() };
  });
  await p.close(); return r;
}

async function parcours(nom, largeur, theme) {
  const p = await nav.newPage({ viewport: { width: largeur, height: largeur < 480 ? 480 : 760 }, reducedMotion: 'reduce' });
  const lib = `${nom} ${largeur} ${theme}`;
  p.on('pageerror', e => erreurs.push({ contexte: lib, erreur: e.message }));
  p.on('console', m => { if (m.type() === 'error') erreurs.push({ contexte: lib, erreur: m.text() }); });
  const charger = async (scene, opts = {}) => {
    const u = pathToFileURL(path.join(__dirname, nom + '.html'));
    u.search = new URLSearchParams({ nu: '1', fige: '1', reduit: '1', theme, taille: largeur < 480 ? 'compact' : 'normal', scene, ...opts }).toString();
    await p.goto(u.href); await p.evaluate(() => document.fonts.ready);
  };
  const etat = async mot => assert.equal(await p.locator('.etat .mot').textContent(), mot);
  const acte = act => p.locator(`#fen [data-act="${act}"]`).first();
  const bilan = test => reussites.push({ contexte: lib, test });
  try {
    await charger('pret', { fige: '0', cadence: 'rapide' });
    await acte('demarrer').click(); await etat('En cours');
    await p.evaluate(() => { window.ArianeMaquette.sim.lot.encours.attendu = .5; });
    await acte('pause').click(); await etat('Pause demandée');
    await p.waitForFunction(() => document.querySelector('.etat .mot')?.textContent === 'En pause');
    assert.ok(await p.evaluate(() => window.ArianeMaquette.sim.lot.cuts.length >= 1));
    await acte('reprendre').click(); await etat('En cours');
    await acte('arreter').click(); await etat('En cours');
    assert.equal(await acte('arreter').textContent(), 'Confirmer l’arrêt');
    await p.keyboard.press('Escape'); assert.equal(await acte('arreter').textContent(), 'Arrêter');
    await acte('arreter').click(); await acte('arreter').click(); await etat('Lot arrêté');
    assert.match(await p.locator('dl.fin').textContent(), /non traités/);
    assert.equal(await p.evaluate(() => !!window.ArianeMaquette.S.exportFait), false);
    bilan('lot : démarrer, attendre la fin du cut pour la pause, reprendre, annuler et confirmer l’arrêt');

    await charger('cours');
    const bouton = await acte('pause').elementHandle(), rail = await p.locator('.rail-cur').elementHandle();
    await acte('pause').focus();
    await p.evaluate(() => { const A = window.ArianeMaquette; A.sim.lot.cuts.push({ cut: 4880, statut: 'pose', dur: 8 }); A.rendre(); });
    assert.ok(await bouton.evaluate(e => e === document.querySelector('[data-act="pause"]') && e === document.activeElement));
    assert.ok(await rail.evaluate(e => e === document.querySelector('.rail-cur')));
    await p.keyboard.press('Control+k');
    await p.locator('#pal-q').fill('exporter');
    assert.equal(await p.locator('#pal-q').inputValue(), 'exporter');
    assert.equal(await p.locator('.cmd').getAttribute('aria-disabled'), 'true');
    await p.keyboard.press('Enter'); assert.equal(await p.locator('.palette').count(), 1);
    await p.locator('#pal-q').fill('introuvable'); assert.match(await p.locator('.cmds').textContent(), /Aucune commande/);
    await p.keyboard.press('Escape');
    assert.ok(await acte('pause').evaluate(e => e === document.activeElement));
    bilan('rendu et palette : identité du curseur et du bouton, focus conservé, commande grisée refusée');

    await charger('fin', { revue: 'v2', tiroir: '1' });
    await p.locator('[data-examine]').first().click();
    assert.equal(await p.locator('[data-examine]').first().getAttribute('aria-pressed'), 'true');
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('e');
    assert.equal(await p.locator('[data-examine]').first().getAttribute('aria-pressed'), 'false');
    await p.locator('[data-ouvrir]').first().click();
    assert.match(await p.locator('.barre-note').textContent(), /ouvert dans ESV/);
    await p.keyboard.press('Escape'); assert.equal(await p.locator('.poignee').getAttribute('aria-expanded'), 'false');
    bilan('tiroir V2 : lire le motif complet, examiner, annuler au clavier, ouvrir, fermer');

    await charger('pret'); await acte('reglages').click();
    await p.locator('[data-reg="Après le lot"]').selectOption('Rien');
    await p.keyboard.press('Escape'); await acte('reglages').click();
    assert.equal(await p.locator('[data-reg="Après le lot"]').inputValue(), 'Rien');
    const inverse = theme === 'clair' ? 'Sombre' : 'Clair';
    await p.locator(`[data-seg="Thème"][data-val="${inverse}"]`).click();
    assert.equal(await p.locator('html').getAttribute('data-theme'), inverse.toLowerCase());
    await p.locator('[data-seg="Thème"][data-val="Système"]').click();
    await p.emulateMedia({ colorScheme: 'dark' });
    await p.waitForFunction(() => document.documentElement.dataset.theme === 'sombre');
    await p.keyboard.press('Escape'); bilan('réglages : valeur gardée, thèmes clair/sombre/système, fermeture');

    await charger('cours', { reduit: '0' });
    assert.ok(await p.locator('.rail-cur').evaluate(e => getComputedStyle(e).transitionDuration.split(',').every(x => parseFloat(x) === 0)));
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    assert.ok(await p.locator('.rail-cur').evaluate(e => getComputedStyle(e).transitionDuration.split(',').some(x => parseFloat(x) > 0)));
    await p.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(await p.locator('.rail-cur').evaluate(e => getComputedStyle(e).transitionDuration.split(',').every(x => parseFloat(x) === 0)));
    bilan('mouvement réduit système vérifié sans la préférence manuelle, retour normal vérifié');

    await charger('pret'); await acte('cache').click();
    await p.keyboard.press('Escape'); assert.equal(await p.locator('.cache .ok').count(), 0);
    await acte('cache').click();
    const focusDans = await p.locator('.boite').evaluate(e => e.contains(document.activeElement)); assert.ok(focusDans);
    await p.locator('.boite [data-act="cache-vider"]').click();
    assert.match(await p.locator('.cache').textContent(), /Cache vidé/);
    bilan('cache : annuler garde le cache, confirmer affiche le résultat, données marquées fictives');

    await charger('incident'); await acte('passer').click(); await p.locator('.boite [data-act="fermer"]').click(); await etat('À toi');
    const avant = await p.evaluate(() => window.ArianeMaquette.sim.lot.cuts.length);
    await acte('passer').click(); await acte('passer-ok').click();
    assert.equal(await p.evaluate(() => window.ArianeMaquette.sim.lot.cuts.length), avant + 1);
    await etat('En cours');
    await charger('incident'); await acte('reessayer').click(); await etat('En cours');
    await charger('incident'); await acte('main').click(); await etat('En cours');
    await charger('interrompu'); await acte('archiver').click();
    assert.notEqual(await p.locator('.etat .mot').textContent(), 'En cours', 'Archiver une interruption ne relance pas une pose');
    bilan('incidents : trois sorties conservées, confirmation du passage, archivage sans relance');

    await charger('relecture-f5'); assert.ok(await acte('rel-reprendre').isDisabled());
    await charger('relecture'); await acte('rel-reprendre').click(); await etat('Relecture en cours');
    await acte('rel-pause').click(); await etat('Relecture en pause');
    await acte('rel-arreter').click(); await acte('rel-arreter').click(); await etat('Terminé');
    bilan('relecture : raison de reprise indisponible après F5, reprise/pause/arrêt jouables');

    await charger('echo', { fige: '0', cadence: 'rapide' });
    await p.evaluate(() => { window.ArianeMaquette.sim.echo.encours.attendu = .4; });
    await acte('echo-pause').click(); await etat('Écho en pause');
    const visites = await p.evaluate(() => window.ArianeMaquette.sim.echo.visites.length);
    await p.waitForTimeout(650); assert.equal(await p.evaluate(() => window.ArianeMaquette.sim.echo.visites.length), visites);
    await acte('echo-reprendre').click();
    await p.waitForFunction(n => window.ArianeMaquette.sim.echo.visites.length > n, visites);
    await acte('echo-terminer').click(); await etat('Aucune séance');
    await acte('reglages').click(); await acte('echo-abandon').click();
    await p.locator('.boite [data-act="fermer"]').click(); assert.equal(await p.evaluate(() => window.ArianeMaquette.sim.echo.visites.length > 0), true);
    await acte('reglages').click(); await acte('echo-abandon').click(); await acte('echo-abandon-confirmer').click();
    assert.equal(await p.evaluate(() => window.ArianeMaquette.sim.echo.visites.length), 0);
    bilan('Écho : pause effective, reprise de l’horloge, fin et abandon confirmé');

    await charger('file-eteinte', { nu: '0' });
    await acte('file-ouvrir').click(); assert.ok(await acte('file-preparer').isDisabled());
    assert.equal(await p.locator('[data-file="n"]').first().getAttribute('aria-disabled'), 'true');
    await p.locator('[data-file="allumee"][data-val="1"]').click();
    await p.locator('[data-file="n"][data-val="8"]').click(); assert.equal(await p.evaluate(() => window.ArianeMaquette.S.file.n), 8);
    await p.locator('[data-file="n"][data-val="3"]').click();
    await acte('file-preparer').click(); assert.equal(await p.evaluate(() => window.ArianeMaquette.S.file.en), false);
    await acte('file-lancer').click(); assert.equal(await p.evaluate(() => window.ArianeMaquette.S.file.n), 3);
    assert.equal(await p.locator('.file-etapes [aria-current="step"]').textContent(), '01');
    await p.locator('[data-sim="finir"]').click(); assert.equal(await p.locator('.file-etapes [aria-current="step"]').textContent(), '02');
    await p.locator('[data-sim="finir"]').click(); await p.locator('[data-sim="finir"]').click(); await etat('File terminée');
    assert.equal(await p.evaluate(() => window.ArianeMaquette.S.file.allumee), false);
    assert.equal(await p.evaluate(() => !!window.ArianeMaquette.S.exportFait), false);
    assert.match(await p.locator('.cache .q').textContent(), /3 lots/);
    bilan('file : éteinte par défaut, préparer sans lancer, trois parties, extinction finale sans export automatique');

    for (const cause of ['page', 'onglet', 'muet', 'refus']) {
      await charger('file-alerte', { nu: '0' }); await p.locator('[data-sim="cause"]').selectOption(cause); await etat('File arrêtée');
      await acte('file-reprise').click(); assert.equal(await p.evaluate(() => window.ArianeMaquette.S.file.en), false);
      assert.equal(await p.evaluate(() => window.ArianeMaquette.S.file.prete), true);
    }
    await charger('file-cours'); await acte('file-arreter').click(); await acte('file-arreter').click(); await etat('File arrêtée');
    bilan('file : quatre causes d’alerte, reprise préparée sans démarrage, arrêt volontaire confirmé');
    console.log(lib + ' : parcours complets');
  } finally { await p.close(); }
}

async function balayer(nom) {
  const p = await nav.newPage({ viewport: { width: 600, height: 760 }, reducedMotion: 'reduce' });
  const u = pathToFileURL(path.join(__dirname, nom + '.html')); u.search = 'nu=1&fige=1&reduit=1';
  await p.goto(u.href); await p.evaluate(() => document.fonts.ready);
  let controles = 0; const ecarts = [];
  for (let w = 360; w <= 600; w++) {
    await p.setViewportSize({ width: w, height: w < 480 ? 480 : 760 });
    const r = await p.evaluate(w => {
      const A = window.ArianeMaquette, R = document.documentElement;
      const liste = [...document.querySelectorAll('#sc-scene option')].map(e => ({ scene: e.value, nom: e.value }));
      for (const scene of ['cours', 'fin', 'echo', 'file-cours', 'file-fin', 'file-alerte']) liste.push({ scene, nom: scene + '-tiroir', tiroir: true });
      liste.push({ scene: 'fin', nom: 'fin-tiroir-v2', tiroir: true, revue: 'v2' });
      const ecarts = []; let n = 0;
      for (const theme of ['clair', 'sombre']) for (const cas of liste) {
        R.dataset.theme = theme; R.dataset.taille = w < 480 ? 'compact' : 'normal'; R.dataset.revue = cas.revue || 'v1';
        A.scene(cas.scene); A.S.tiroir = !!cas.tiroir; A.rendre();
        const z = document.getElementById('fen'), couche = z.querySelector('.boite,.palette,.feuille,.popover'); n++;
        const vis = e => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !e.closest('[inert]') && (!couche || couche.contains(e));
        for (const e of [document.documentElement, z, ...z.querySelectorAll('.barre,.instrument,.contenu-instrument,.corps,.cache,.boite,.palette,.feuille,.popover')]) {
          if ((e === document.documentElement || vis(e)) && e.scrollWidth > e.clientWidth + 1) ecarts.push({ largeur: w, theme, scene: cas.nom, cible: e === document.documentElement ? 'page' : e.className });
        }
        for (const e of z.querySelectorAll('button,input,select')) if (vis(e)) {
          const r = e.getBoundingClientRect(), q = z.getBoundingClientRect();
          if (r.left < q.left - 1 || r.right > q.right + 1) ecarts.push({ largeur: w, theme, scene: cas.nom, cible: e.getAttribute('data-act') || e.tagName });
        }
      }
      return { n, ecarts };
    }, w);
    controles += r.n; ecarts.push(...r.ecarts);
    if ((w - 360) % 60 === 0) console.log(`${nom} : balayage jusqu’à ${w} px`);
  }
  await p.close(); return { nom, largeurs: 241, controles, ecarts };
}

(async () => {
  nav = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--disable-gpu'] });
  const largeurs = argv.includes('--rapide') ? [360] : [360, 600];
  const themes = argv.includes('--rapide') ? ['sombre'] : ['clair', 'sombre'];
  try {
    const references = await Promise.all(['Q-signal', 'S-file-de-parties'].map(repertorier));
    const attendus = { scenes: [...new Set(references.flatMap(r => r.scenes))], commandes: [...new Set(references.flatMap(r => r.commandes))] };
    const conservation = [];
    for (const nom of noms) {
      const r = await repertorier(nom);
      assert.deepEqual(attendus.scenes.filter(s => !r.scenes.includes(s)), [], nom + ' : scène supprimée');
      assert.deepEqual(attendus.commandes.filter(c => !r.commandes.includes(c)), [], nom + ' : commande supprimée');
      conservation.push({ nom, scenesReference: attendus.scenes.length, scenesLivrees: r.scenes.length, commandesReference: attendus.commandes.length, commandesLivrees: r.commandes.length, manquants: 0 });
    }
    for (const nom of noms) for (const w of largeurs) for (const theme of themes) await parcours(nom, w, theme);
    const balayages = [];
    if (argv.includes('--balayage')) for (const nom of noms) balayages.push(await balayer(nom));
    fs.writeFileSync(path.join(sortie, 'parcours-mesures.json'), JSON.stringify({ navigateur: nav.version(), conservation, reussites, erreurs, balayages }, null, 2) + '\n');
    assert.equal(erreurs.length, 0, 'erreurs de page ou console');
    assert.ok(balayages.every(b => b.ecarts.length === 0), JSON.stringify(balayages.map(b => b.ecarts.slice(0, 5))));
    console.log(`${reussites.length} groupes de parcours réussis ; ${balayages.length ? 'aucun écart de balayage' : 'balayage non demandé'}`);
  } finally { await nav.close(); }
})().catch(e => { console.error(e.stack); fs.writeFileSync(path.join(sortie, 'parcours-echec.json'), JSON.stringify({ reussites, erreurs, echec: e.message }, null, 2) + '\n'); process.exitCode = 1; });
