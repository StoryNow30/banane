'use strict';
/* CH-063, piste 1 : lecture directe EN OMBRE (prototype, réglage `actif:false`). Le module ne remplace jamais la capture : il relit
 * les ressources de points qu'ESV a demandées elle-même, au plus une fois chacune, compare nœud à nœud aux points affichés, et s'arrête
 * à la première erreur ou lenteur. Aucune adresse n'est rendue. */
const test = require('node:test'), assert = require('node:assert/strict');
const LD = require('../src/lecture-directe.js');

const entree = (name, startTime, duration = 40) => ({ name, startTime, duration, responseEnd: startTime + duration, initiatorType: 'xmlhttprequest' });
const noeudVisible = arr => ({ sceneNode: { geometry: { attributes: { position: { array: Float32Array.from(arr) } } } } });
function banc({ reponses = {}, reglage = {}, visibles = [], duree = 10 } = {}) {
  const appels = []; let t = 1000;
  const fetch = async (url, init) => { appels.push({ url, init }); t += duree; const r = reponses[url]; if (r instanceof Error) throw r;
    return { ok: (r?.status ?? 200) === 200, status: r?.status ?? 200, json: async () => r?.corps ?? { noeuds: [] } }; };
  const L = LD.creer({ fetch, maintenant: () => t, reglage: { actif: true, ...reglage }, decodeur: LD.decodeurMaquette });
  const viewer = { scene: { pointclouds: [{ visibleNodes: visibles }] } };
  return { L, appels, viewer, avancer: x => { t += x; } };
}

test('réglage : coupé par défaut ; un réglage illisible est refusé, jamais deviné', () => {
  assert.equal(LD.REGLAGE_DEFAUT.actif, false);
  assert.equal(LD.reglage(undefined).actif, false);
  assert.equal(LD.reglage({ actif: true }).ok, true);
  assert.equal(LD.reglage({ actif: 'oui' }).ok, false);
  assert.equal(LD.reglage({ actif: true, maxRequetesParCut: 0 }).ok, false);
});
test('coupé : aucune requête, aucune adresse retenue', async () => {
  const appels = []; const L = LD.creer({ fetch: async u => { appels.push(u); }, maintenant: () => 0, reglage: {}, decodeur: LD.decodeurMaquette });
  L.observer([entree('http://h/x/ept-data/1/2/n.json', 10)]);
  const r = await L.lireEnOmbre({ viewer: {}, depuisMs: 0 });
  assert.equal(r.etat, 'coupe'); assert.equal(appels.length, 0); assert.equal(L.etat().adressesRetenues, 0);
});
test('seules les ressources de points qu\'ESV a demandées depuis le début du cut sont relues, une fois chacune, depuis le cache', async () => {
  const pts = [1.5, 2.25, 3, 4, 5, 6];
  const b = banc({ reponses: { 'http://h/a/ept-data/1/2/n.json': { corps: { noeuds: [{ positions: pts }] } } }, visibles: [] });
  b.L.observer([entree('http://h/a/ept-data/1/1/n.json', 5), entree('http://h/a/ept-data/1/2/n.json', 50), entree('http://h/a/ept-data/1/2/n.json', 60), entree('http://h/a/rails/T', 55)]);
  const r = await b.L.lireEnOmbre({ viewer: b.viewer, depuisMs: 20 });
  assert.equal(b.appels.length, 1);
  assert.equal(b.appels[0].init.cache, 'force-cache');
  assert.equal(r.requetesEsv, 2); assert.ok(r.requetes <= r.requetesEsv);
  assert.ok(!JSON.stringify(r).includes('http'), 'aucune adresse dans le résumé');
});
test('identité : chaque nœud relu doit être, au bit près, un nœud affiché ; manquants et surplus comptés', async () => {
  const a = [10.001, 20.002, 30.003, 10.5, 20.5, 30.5], b2 = [11, 21, 31, 11.25, 21.25, 31.25];
  const loc = LD.decodeurMaquette({ noeuds: [{ positions: a }, { positions: b2 }] });
  const ok = banc({ reponses: { 'u/ept-data/n': { corps: { noeuds: [{ positions: a }, { positions: b2 }] } } }, visibles: loc.map(x => noeudVisible(x)) });
  ok.L.observer([entree('u/ept-data/n', 30)]);
  const r1 = await ok.L.lireEnOmbre({ viewer: ok.viewer, depuisMs: 0 });
  assert.deepEqual([r1.etat, r1.noeudsRelus, r1.identiques, r1.manquants, r1.surplus, r1.identite], ['fini', 2, 2, 0, 0, true]);
  const faux = Float32Array.from(loc[1]); faux[2] += 1e-3;
  const ko = banc({ reponses: { 'u/ept-data/n': { corps: { noeuds: [{ positions: a }, { positions: b2 }] } } }, visibles: [noeudVisible(loc[0]), noeudVisible(faux), noeudVisible([0, 0, 0])] });
  ko.L.observer([entree('u/ept-data/n', 30)]);
  const r2 = await ko.L.lireEnOmbre({ viewer: ko.viewer, depuisMs: 0 });
  assert.deepEqual([r2.identiques, r2.surplus, r2.manquants, r2.identite], [1, 1, 2, false]);
});
test('arrêt à la première erreur : plus aucune requête ensuite, jusqu\'au rechargement de la page', async () => {
  const b = banc({ reponses: { 'u/ept-data/1': { status: 502 }, 'u/ept-data/2': {} } });
  b.L.observer([entree('u/ept-data/1', 10), entree('u/ept-data/2', 11)]);
  const r = await b.L.lireEnOmbre({ viewer: b.viewer, depuisMs: 0 });
  assert.equal(r.etat, 'arrete'); assert.equal(r.motif, 'erreur-http'); assert.equal(b.appels.length, 1);
  b.L.observer([entree('u/ept-data/3', 100)]);
  const r2 = await b.L.lireEnOmbre({ viewer: b.viewer, depuisMs: 90 });
  assert.equal(r2.etat, 'arrete'); assert.equal(b.appels.length, 1);
});
test('arrêt à la première lenteur anormale (au-delà du seuil réglé)', async () => {
  const b = banc({ duree: 1500, reglage: { lenteurMs: 1000 } });
  b.L.observer([entree('u/ept-data/1', 10), entree('u/ept-data/2', 11)]);
  const r = await b.L.lireEnOmbre({ viewer: b.viewer, depuisMs: 0 });
  assert.equal(r.etat, 'arrete'); assert.equal(r.motif, 'lenteur'); assert.equal(b.appels.length, 1);
});
test('plafond de requêtes par cut, jamais au-delà de celles d\'ESV', async () => {
  const b = banc({ reglage: { maxRequetesParCut: 2 } });
  b.L.observer([1, 2, 3, 4].map(i => entree('u/ept-data/' + i, 10 + i)));
  const r = await b.L.lireEnOmbre({ viewer: b.viewer, depuisMs: 0 });
  assert.equal(b.appels.length, 2); assert.equal(r.plafond, true); assert.equal(r.etat, 'fini');
});
test('sans décodeur (format réel d\'ESV inconnu) : rien n\'est demandé', async () => {
  const appels = []; const L = LD.creer({ fetch: async u => { appels.push(u); }, maintenant: () => 0, reglage: { actif: true }, decodeur: null });
  L.observer([entree('u/ept-data/1', 10)]);
  const r = await L.lireEnOmbre({ viewer: {}, depuisMs: 0 });
  assert.equal(r.etat, 'sans-decodeur'); assert.equal(appels.length, 0);
});
test('les nœuds affichés sont ceux de l\'instant de la capture, pas ceux qu\'ESV charge pendant la relecture', async () => {
  const a = [1, 2, 3, 4, 5, 6], loc = LD.decodeurMaquette({ noeuds: [{ positions: a }] });
  const visibles = [noeudVisible(loc[0])], viewer = { scene: { pointclouds: [{ visibleNodes: visibles }] } };
  const fetch = async () => { visibles.push(noeudVisible([9, 9, 9])); return { status: 200, json: async () => ({ noeuds: [{ positions: a }] }) }; };
  const L = LD.creer({ fetch, maintenant: () => 0, reglage: { actif: true }, decodeur: LD.DECODEURS.maquette });
  L.observer([entree('u/ept-data/1', 1)]);
  const r = await L.lireEnOmbre({ viewer });
  assert.deepEqual([r.identiques, r.manquants, r.identite], [1, 0, true]);
});
test('les relectures d\'Ariane, vues à leur tour par l\'API de mesure, ne comptent jamais comme des requêtes d\'ESV (pas d\'emballement)', async () => {
  const b = banc({ reponses: { 'u/ept-data/1': { corps: { noeuds: [] } } } });
  b.L.observer([entree('u/ept-data/1', 10)]);
  await b.L.lireEnOmbre({ viewer: b.viewer });
  b.L.observer([entree('u/ept-data/1', 30)]);            /* l'entrée de la relecture d'Ariane elle-même */
  const r = await b.L.lireEnOmbre({ viewer: b.viewer });
  assert.equal(r.requetesEsv, 0); assert.equal(b.appels.length, 1);
  b.L.observer([entree('u/ept-data/1', 50)]);            /* ESV redemande la même ressource : elle compte de nouveau */
  const r2 = await b.L.lireEnOmbre({ viewer: b.viewer });
  assert.equal(r2.requetesEsv, 1); assert.equal(b.appels.length, 2);
});
