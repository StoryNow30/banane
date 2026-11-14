'use strict';
/* Vision 18 (D-355, opérateur, 14/11) — L'AJUSTEMENT DE HAUTEUR « aj5 » DE CH-121 EST LIVRÉ ÉTEINT, AVEC UN INTERRUPTEUR D'ESSAI.
 * Service worker réel en VM (tests/helpers/perf-production.cjs), chrome.storage.local en mémoire ; panneau réel (tools/audit-qualite-480.cjs).
 *  - Livré : le levier `ajustementFin` de la recette vaut null ; rien de gardé = coupé ; l'étage n'a alors aucun réglage (la commande est rendue telle quelle).
 *  - L'interrupteur (actions `ajustement-hauteur-etat`, `ajustement-hauteur`) : gardé dans storage.local, oui ou non seulement ; allumé, l'étage prend le réglage
 *    FIGÉ de l'essai (`AJ_ESSAI` de src/gcv2-l1.js : celui jugé par CH-121, hauteur seule, poses de la chaîne seulement, voisins à la pose de la décision).
 *  - Un levier réglé pour une mesure (`reglerLeviers`, parité) passe devant l'interrupteur.
 *  - Relu après un redémarrage du service worker ; stockage illisible : coupé.
 *  - Panneau : une case, décochée tant que le service worker n'a pas répondu « allumé » ; un clic garde le choix. */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { production, memoire } = require('./helpers/perf-production.cjs');
const { panneau } = require('../tools/audit-qualite-480.cjs');
const Settings = require('../src/settings.js');
const CLE = 'banane58AjustementHauteur', j = x => JSON.parse(JSON.stringify(x));
const ESSAI = { c: 5, lateral: false, seulChaine: true, voisinsDecision: true };

test('recette livrée : ajustementFin coupé ; réglage figé de l\'essai = celui jugé par CH-121', () => {
  const L1 = require('../src/gcv2-l1.js');
  assert.equal(L1.LEVIERS_LIVRES.ajustementFin, null);
  assert.ok(Object.isFrozen(L1.AJ_ESSAI)); assert.deepEqual({ ...L1.AJ_ESSAI }, ESSAI);
});

test('rien de gardé : coupé, l\'étage n\'a aucun réglage ; allumé : le réglage figé de l\'essai ; oui ou non seulement', async () => {
  const local = memoire(), b = production({ local });
  assert.deepEqual(j(await b.api('ajustement-hauteur-etat')), { actif: false });
  assert.equal(b.get('ajustementFinReglage')(), null);
  assert.deepEqual(j(await b.api('ajustement-hauteur', { actif: true })), { actif: true });
  assert.equal(local.m[CLE], true);
  assert.deepEqual(j(b.get('ajustementFinReglage')()), ESSAI);
  await assert.rejects(b.api('ajustement-hauteur', { actif: 'oui' }), /oui ou non/);
  await assert.rejects(b.api('ajustement-hauteur', {}), /oui ou non/);
  assert.equal(local.m[CLE], true, 'un refus ne change rien');
  assert.deepEqual(j(await b.api('ajustement-hauteur', { actif: false })), { actif: false });
  assert.equal(local.m[CLE], false); assert.equal(b.get('ajustementFinReglage')(), null);
});

test('un levier réglé pour une mesure passe devant l\'interrupteur, et le retour aux livrés rend la main', async () => {
  const b = production({ local: memoire() }), G = b.ctx.BananeGcv2L1, mesure = { c: 4.4, lateral: true };
  try {
    G.reglerLeviers({ ajustementFin: mesure });
    assert.deepEqual(j(b.get('ajustementFinReglage')()), mesure);
    await b.api('ajustement-hauteur', { actif: true });
    assert.deepEqual(j(b.get('ajustementFinReglage')()), mesure);
  } finally { G.reglerLeviers(null); }
  assert.deepEqual(j(b.get('ajustementFinReglage')()), ESSAI);
});

test('redémarrage du service worker : le choix gardé est relu ; valeur autre que true ou stockage illisible : coupé', async () => {
  const local = memoire(); local.m[CLE] = true;
  const b = production({ local });
  assert.equal(b.get('ajustementFinReglage')(), null, 'avant la première lecture : coupé');
  assert.deepEqual(j(await b.api('ajustement-hauteur-etat')), { actif: true });
  assert.deepEqual(j(b.get('ajustementFinReglage')()), ESSAI);
  const l2 = memoire(); l2.m[CLE] = 'oui';
  assert.deepEqual(j(await production({ local: l2 }).api('ajustement-hauteur-etat')), { actif: false });
  const casse = { get: async k => { if ([].concat(k ?? []).includes(CLE)) throw Error('stockage'); return {}; }, set: async () => {} };
  assert.deepEqual(j(await production({ local: casse }).api('ajustement-hauteur-etat')), { actif: false });
});

test('le lot relit le choix sans appel de plus : la lecture des choix du lot porte la clé de l\'essai', async () => {
  const lus = [], m = memoire(); m.m[CLE] = true;
  const local = { ...m, get: async k => { lus.push(k); return m.get(k); } };
  const b = production({ local });
  await b.get('choixDuLot')();
  const avecCle = lus.filter(k => [].concat(k ?? []).includes(CLE));
  assert.equal(avecCle.length, 1, 'une seule lecture porte la clé'); assert.ok(avecCle[0].includes('banane50GrappeDifferes'), 'c\'est celle des choix du lot');
  assert.deepEqual(j(b.get('ajustementFinReglage')()), ESSAI, 'lu avec les choix du lot');
  assert.ok(!('ajustementHauteur' in j(await b.api('choix-lot-etat'))), 'les choix du lot gardent leurs clés');
});

test('service worker : l\'étage et la passe lisent ce réglage, jamais la recette livrée seule', () => {
  const src = fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8');
  assert.doesNotMatch(src, /LEVIERS_LIVRES\??\.ajustementFin/);
  assert.match(src, /function ajustementFinCommande\([^)]*\)\{[\s\S]{0,300}const R=ajustementFinReglage\(\);[\s\S]{0,1500}G\.ajusterPoseFinale\(capture,decal,R\)/);
  assert.match(src, /function passeDiffAjustementFin\([^)]*\)\{[\s\S]{0,300}const R=ajustementFinReglage\(\);[\s\S]{0,600}G\.ajusterPoseFinale\(r\.capture,decal,R\)/);
});

test('panneau : une case « à l\'essai », décochée par défaut, cochée si le service worker le dit ; un clic garde le choix', async () => {
  const HTML = fs.readFileSync(path.join(__dirname, '../panel.html'), 'utf8');
  assert.match(HTML, /<input id="ajustement-hauteur" type="checkbox"> Ajuster la hauteur des poses sur le dessus du rail<\/label>/);
  assert.match(HTML, /id="ajustement-note">Coupé par défaut\. À l’essai/);
  assert.doesNotMatch(HTML, /id="ajustement-hauteur"[^>]*checked/);
  const etat = { current: { identity: { part: 23, cut: 120 } }, batch: null }, enr = [];
  const ouvrir = actif => panneau(etat, { globals: { BananeSettings: Settings }, reponses: { 'choix-lot-etat': { clicHumain: 'tel-quel', regleGrappeDifferes: false },
    'ajustement-hauteur-etat': { actif }, 'ajustement-hauteur': args => { enr.push(args); return { actif: args.actif }; } } });
  let p = await ouvrir(false); await p.attendre(); assert.equal(p.$('ajustement-hauteur').checked, false);
  p.$('ajustement-hauteur').checked = true; await p.$('ajustement-hauteur').onclick(); await p.attendre();
  assert.deepEqual(j(enr), [{ actif: true }]); assert.equal(p.$('ajustement-hauteur').checked, true);
  assert.match(p.$('notice').textContent, /Ajustement de hauteur allumé/);
  p = await ouvrir(true); await p.attendre(); assert.equal(p.$('ajustement-hauteur').checked, true);
  /* Ancien service worker (aucune réponse) : la case reste décochée, rien n'est demandé de plus. */
  p = await panneau(etat, { globals: { BananeSettings: Settings } }); await p.attendre();
  assert.equal(p.$('ajustement-hauteur').checked, false); assert.equal(p.appels.filter(a => a.action === 'ajustement-hauteur').length, 0);
});
