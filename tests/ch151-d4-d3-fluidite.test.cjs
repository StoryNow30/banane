'use strict';
/* CH-151 (D-380, D-381) — Lot D4 + D3 :
 *  - D4a : `BananeSettings.pilote.modeRapide === 'toujours'` ;
 *  - D4b : `poserPuisVerifier` appelle `apply` avec `{ clicHumain: 'gauche-recentre', selectionImage: true }`, et `clickPosition`
 *          utilise `selectImage` (sans l'attente `lecturesStables × sondageMs` de ~300 ms) tout en gardant 0 clic hors canevas
 *          et sans modifier d'un octet le lot (`tel-quel`) ;
 *  - D4c : en Constellation, changement de partie après un lot ayant laissé des différés non écrits → `suivant-dernier` appelé
 *          directement sans tentative `invalide-suivant` (avec `lien` en repli) ; sans différé restant → `invalide-suivant`
 *          tenté en premier ; et `relectureEntree` branche `tableListe` + `alertesGardeVoie` pour le filtre D1 (CH-152) ;
 *  - D3  : `correctionOuvrir` sur le cut déjà affiché dans ESV ne met pas Écho en pause et n'envoie pas `goToCut` (zéro flash) ;
 *          et `relectureCorriger` sur une pose déjà à < 0,5 mm d'un vert `valid` ne bloque pas 6 s. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const S = require('../src/settings.js');
const { K } = require('./fixtures.cjs');
const Hclic = require('./helpers/esv-clic.cjs');
const GOLDEN_CLIC = require('./fixtures/rapide-humain-50-base.json');
const { H: Hrel, PERMISSIF, apresLot, j } = require('./helpers/relecture-essais.cjs');
const { montage, fermer } = require('./helpers/file-parties-sw.cjs');
const { background } = require('./helpers/background-harness.cjs');
const { journal: journalCorrection } = require('./helpers/correction-journal.cjs');
const EC = require('../src/export-cache.js');
const CL = require('../src/correction-liste.js');
const LM = require('../src/liste-memoire.js');

test.afterEach(fermer);

test('D4a — pilote.modeRapide vaut « toujours » par défaut, repliCourt et gardes conservés', async () => {
  assert.equal(S.pilote.modeRapide, 'toujours');
  assert.deepEqual({ ...S.pilote.repliCourt }, { actif: true, silenceMs: 600 });
  assert.equal(S.pilote.imagesMin, 2);
  const ligne = S.describe().find(x => x.nom === 'Mode rapide (V3)');
  assert.equal(ligne?.valeur, 'tous les cuts');
  const { page } = require('./helpers/page.cjs'), F = require('./v242/fixtures.cjs'), L = require('../vendor/lidar.js');
  for (const cut of [0, 50, 102]) {
    const f = page(), pc = F.object([0, 0, 0], 'PointCloudOctree'), n = F.object([0, 0, 0], 'Points');
    n.geometry = { attributes: { position: F.buffer([[0, 0.01, 0.01], [0, 1.425, 0.01]]) } };
    pc.material = { clipBoxes: [], clipTask: 0, clipMethod: 0 }; pc.visibleNodes = [{ sceneNode: n }];
    f.ctx.viewer.scene.pointclouds = [pc]; f.ctx.Potree = F.enums;
    f.nodes.get('O2N3DCutDescription').textContent = `Cut ${cut} of part 23`;
    f.ctx.BananeLidar.capture = opts => L.capture(opts);
    const out = await f.call('capture', await f.call('state'));
    assert.equal(out.readStrategy.lecture, 'rapide', `cut ${cut} autrefois témoin lent`);
    assert.equal(out.readStrategy.regleLecture, 'toujours');
  }
});

test('D4b — clickPosition avec selectionImage:true utilise selectImage (< 100 ms), 0 clic hors canevas, lot tel-quel intact', async () => {
  const clics = r => r.journal.filter(x => x.quoi === 'canevas');
  const boutons = r => r.journal.filter(x => x.quoi === 'bouton').map(x => x.id === 'O2N3DCutLRClick' ? 'gauche' : 'droit');

  /* Vue active sur le rail droit (état normal après capture) : droit en direct, gauche via selectImage (~32–48 ms au lieu de 240+ ms). */
  const droite = await Hclic.jouer('rapide-vue-droite', { pilote: { modeRapide: 'toujours' }, options: { clicHumain: 'gauche-recentre', selectionImage: true } });
  assert.equal(droite.erreur, null);
  assert.deepEqual(boutons(droite), ['droit', 'gauche']);
  assert.deepEqual(clics(droite).map(c => c.cote), ['right', 'left']);
  assert.ok(droite.dureeMs > 0 && droite.dureeMs < 100, `attendu < 100 ms avec selectImage, obtenu ${droite.dureeMs} ms`);
  assert.equal(droite.horsVue.length, 0);
  for (const c of clics(droite)) assert.ok(Hclic.clicVisible(c, droite.vue, droite.fenetre));
  for (const s of ['left', 'right']) assert.ok(droite.ecartCibleMm[s] <= 1);

  /* Vue active sur le rail gauche : cible droite hors vue active → repli sans clic hors canevas, selectImage sur les deux rails (< 150 ms). */
  const gauche = await Hclic.jouer('rapide-vue-gauche', { pilote: { modeRapide: 'toujours' }, options: { clicHumain: 'gauche-recentre', selectionImage: true } });
  assert.equal(gauche.erreur, null);
  assert.deepEqual(gauche.etapes.filter(e => e[0] === 'apply-repli').map(e => e[1].side), ['right']);
  assert.ok(gauche.dureeMs > 0 && gauche.dureeMs < 150, `attendu < 150 ms sur repli selectImage, obtenu ${gauche.dureeMs} ms`);
  assert.equal(gauche.horsVue.length, 0);
  for (const c of clics(gauche)) assert.ok(Hclic.clicVisible(c, gauche.vue, gauche.fenetre));

  /* Lot par défaut (sans selectionImage, tel-quel) : trace identique à l'octet à l'empreinte de base. */
  const { horsVue: _h, vue: _v, fenetre: _f, ...lotBase } = await Hclic.jouer('rapide-vue-droite');
  assert.equal(JSON.stringify(lotBase), JSON.stringify(GOLDEN_CLIC.scenarios['rapide-vue-droite']));
});

test('D4b — poserPuisVerifier transmet { clicHumain: "gauche-recentre", selectionImage: true } à apply', async () => {
  const { b, lot } = await Hrel.lotRelecture({ mode: 'corriger', decisions: { 109: 14 }, reglagesProposes: PERMISSIF });
  const p = await Hrel.finPasse(b);
  assert.equal(p.etat, 'finie', p.message);
  assert.equal(p.corriges, 1);
  const poses = apresLot(b, lot).filter(c => c.action === 'apply');
  assert.equal(poses.length, 1);
  assert.deepEqual(j(poses[0].args[2]), { clicHumain: 'gauche-recentre', selectionImage: true });
});

test('D4c — Constellation : saut direct à suivant-dernier si différés restants > 0, invalide-suivant gardé si 0 différé restant', async () => {
  /* Cas 1 : 2 différés du lot, 1 seul écrit par la 2e passe → 1 différé restant connu : suivant-dernier d'emblée, 0 refus invalide-suivant. */
  const M1 = montage(); await M1.vie();
  Object.assign(M1.adapter, { gestes: true, reste: 1, total: 10 });
  await M1.demarrer(2);
  await M1.jusqua(() => M1.etat()?.etat === 'lot' && M1.etat()?.k === 0 && M1.etat()?.partie?.lotId, 3000, 'lot 0');
  const lotId1 = M1.etat().partie.lotId;
  M1.b.get('passeDiff').planifie.add(lotId1);
  M1.b.get('passeDiff').vue = { lotId: lotId1, mode: 'ecriture', etat: 'finie', differes: 2, posees: 1, demandees: 1, ecrites: 1, cut: null, message: null };
  M1.clore({ deferred: [{ cut: 7 }, { cut: 8 }] });
  await M1.jusqua(() => M1.etat()?.etat === 'relecture', 3000, 'relecture 0');
  M1.relire();
  await M1.jusqua(() => M1.etat()?.etat === 'lot' && M1.etat()?.k === 1, 3000, 'lot partie 24');
  const t1 = M1.journal('file-parties-changement').filter(e => !e.retour);
  assert.deepEqual(t1.map(x => [x.mode, x.issue]), [['suivant-dernier', 'ok']]);
  assert.ok(!M1.adapter.calls.some(c => c.startsWith('changerPartie:invalide-suivant')), 'aucun essai invalide-suivant inutile');

  /* Repli lien préservé si suivant-dernier est sans effet avec différés restants > 0. */
  const M2 = montage(); await M2.vie();
  Object.assign(M2.adapter, { gestes: true, reste: 1, total: 10, sansEffet: ['suivant-dernier'] });
  M2.adapter.identity.cut = 9;
  await M2.demarrer(2);
  await M2.jusqua(() => M2.etat()?.etat === 'lot' && M2.etat()?.k === 0 && M2.etat()?.partie?.lotId, 3000, 'lot 0 repli');
  M2.clore({ deferred: [{ cut: 7 }] });
  await M2.jusqua(() => M2.etat()?.etat === 'relecture', 3000, 'relecture 0 repli');
  M2.relire();
  await M2.jusqua(() => M2.etat()?.etat === 'lot' && M2.etat()?.k === 1, 5000, 'lot partie 24 par lien');
  const t2 = M2.journal('file-parties-changement').filter(e => !e.retour);
  assert.deepEqual(t2.map(x => [x.mode, x.issue]), [['suivant-dernier', 'sans-effet'], ['lien', 'ok']]);

  /* Cas 2 : 1 différé du lot, 1 écrit par la 2e passe → 0 différé restant : invalide-suivant reste tenté en premier. */
  const M3 = montage(); await M3.vie();
  Object.assign(M3.adapter, { gestes: true, reste: 0, total: 10 });
  await M3.demarrer(2);
  await M3.jusqua(() => M3.etat()?.etat === 'lot' && M3.etat()?.k === 0 && M3.etat()?.partie?.lotId, 3000, 'lot 0 tout écrit');
  const lotId3 = M3.etat().partie.lotId;
  M3.b.get('passeDiff').planifie.add(lotId3);
  M3.b.get('passeDiff').vue = { lotId: lotId3, mode: 'ecriture', etat: 'finie', differes: 1, posees: 1, demandees: 1, ecrites: 1, cut: null, message: null };
  M3.clore({ deferred: [{ cut: 7 }] });
  await M3.jusqua(() => M3.etat()?.etat === 'relecture', 3000, 'relecture 0 tout écrit');
  M3.relire();
  await M3.jusqua(() => M3.etat()?.etat === 'lot' && M3.etat()?.k === 1, 3000, 'lot partie 24 par invalide-suivant');
  const t3 = M3.journal('file-parties-changement').filter(e => !e.retour);
  assert.deepEqual(t3.map(x => [x.mode, x.issue]), [['invalide-suivant', 'ok']]);
});

test('D4c — relectureEntree branche tableListe (liste-memoire) et alertesGardeVoie vers BananeRelectureOmbre.selection', async () => {
  const local = Hrel.S && require('./helpers/perf-production.cjs').memoire();
  /* Table de 200 lignes : cuts 111–113 rouges avant le lot (concordance 100 %), bosse de 5 mm au cut 105 (dans une ADV 100–110),
   * et alerte garde-voie-ombre au cut 102 : les verts lisses d'ADV sont filtrés sauf autour de l'alerte (102 ± 3) et la bosse (105). */
  const total = 200, st = Array(total).fill(0), fl = Array(total).fill(0), ed = [];
  for (let i = 0; i < total; i++) {
    if (i >= 111 && i <= 113) st[i] = 1;
    const bosse = i === 105 ? 50 : 0;
    ed.push(i * 10000, bosse, 0, i * 10000, 14350, 0);
  }
  const snap = LM.compacter({ st, fl, ed }, { partie: 23, at: '2026-11-20T08:00:00Z', version: '5', cle: 'cle23' });
  local.m[LM.CLE_INDEX] = [{ partie: 23, at: snap.at }];
  local.m[LM.PRE_INST + 23] = snap;

  const { b } = await Hrel.lotRelecture({ mode: 'coupee', local });
  const batchId = b.get('engine').s.batch.id;
  await b.store.putEvent({ eventId: K.uid(), timestamp: new Date().toISOString(), type: 'regles-metier-ombre', schema: 1, portee: 'cut', batchId, identity: { part: 23, cut: 111 }, zone: { advControle: [95, 110] } });
  for (const cut of [101, 102]) await b.store.putEvent({ eventId: K.uid(), timestamp: new Date().toISOString(), type: 'garde-voie-ombre', schema: 1, batchId, identity: { part: 23, cut }, auraitPause: true, motif: 'voie:22mm>15mm' });
  local.m[Hrel.CLE] = 'ombre';
  b.get('engine').s.batch.scope.relecture = 'ombre';
  await b.api('relecture-lancer');
  const p = await Hrel.finPasse(b);
  assert.equal(p.etat, 'finie', p.message);
  assert.ok(b.ctx.BananeRelectureFiltreListe, 'BananeRelectureFiltreListe chargé dans le service worker');
  const debut = Hrel.evenements(b, 'relecture-debut')[0];
  assert.ok(Array.isArray(debut.filtresListe) && debut.filtresListe.length > 0, `cuts lisses filtrés attendus, obtenu : ${JSON.stringify(debut.filtresListe)}`);
  assert.equal(debut.filtresListeCompte, debut.filtresListe.length);
  const relus = Hrel.evenements(b, 'relecture-ombre').map(e => e.identity.cut);
  assert.ok(relus.includes(105), 'la bosse de 5 mm au cut 105 reste visitée');
  assert.ok(relus.includes(101) && relus.includes(102), 'les cuts couverts par garde-voie-ombre restent visités');
  assert.ok(!relus.includes(96) && !relus.includes(97), `les verts lisses d'ADV loin des alertes sont écartés : ${relus.join(',')}`);
});

test('D3 — correctionOuvrir sur le cut déjà affiché ne met pas Écho en pause et n’envoie pas goToCut', async () => {
  const b = background({ globals: { BananeCore3: K, BananeSettings: S, BananeExportCache: EC, ArianeCorrectionListe: CL } });
  b.adapter.identity.part = 5; b.adapter.identity.cut = 14;
  b.adapter.ping = async function () { return { version: K.VERSION, pageId: this.identity.pageId, proprietaire: 'test', label: { part: this.identity.part, cut: this.identity.cut, pageId: this.identity.pageId } }; };
  b.adapter.goToCut = async function (cible) { this.calls.push('goToCut:' + cible.cut); this.identity.cut = cible.cut; return { resultat: 'confirme', chemin: 'evenement', emissions: 1, identiteAvant: { part: 5, cut: 14 }, identiteApres: { part: 5, cut: cible.cut } }; };
  await b.api('connect', { tabId: 1 });
  for (const e of journalCorrection()) await b.store.putEvent({ eventId: K.uid(), ...e });
  b.fonction(`engine.s.batch=${JSON.stringify({ id: 'B1', state: 'COMPLETED', scope: { part: 5 } })}`);
  await b.api('correction-liste');
  await b.api('correction-demarrer');
  const periodAvant = b.fonction('engine.s.native.currentPeriodId');
  b.adapter.calls.length = 0;

  const r = await b.api('correction-ouvrir', { part: 5, cut: 14 });
  assert.equal(r.ok, true);
  assert.equal(r.resultat, 'deja-affiche');
  assert.deepEqual(b.adapter.calls.filter(x => /^(nativePause|nativeResume|goToCut)/.test(x)), [], 'aucune pause Écho ni goToCut sur la coupe déjà affichée');
  assert.equal(b.fonction('engine.s.native.status'), 'RUNNING');
  assert.equal(b.fonction('engine.s.native.currentPeriodId'), periodAvant, 'la période Écho reste continue sans flash');
  assert.equal(b.fonction('engine.s.correction.courant.cut'), 14);
  assert.equal(b.store.events.filter(e => e.type === 'correction-ouvrir').at(-1).resultat, 'deja-affiche');
});

test('D3 — relectureCorriger sur une pose déjà à < 0,5 mm d’un vert valid rend deja-conforme sans bloquer 6 s', async () => {
  /* Règle ultra-basse (seuilMm 0.1) + décision à 0,2 mm (< 0,5 mm) ou jugement forcé avec rails à 0,2 mm, attenteEcritureMs 6 000 ms, ecriture null. */
  const reglagesBas = structuredClone(PERMISSIF);
  const { b, adapter, lot, local } = await Hrel.lotRelecture({
    mode: 'corriger',
    decisions: { 109: 14 },
    reglagesProposes: reglagesBas,
    relecture: { attenteEcritureMs: 6000 },
    esv: (a, sw) => {
      a.ecriture = null;
      /* Le critère juge sur 14 mm, mais la commande ramenée est à +0,2 mm (< 0,5 mm) de la pose actuelle d'ESV (cas A3 : pose quasi identique sur vert valid). */
      const L = sw.ctx.BananeLotDecision;
      const origCmd = L.commandRails.bind(L);
      const Q = sw.ctx.BananeRelectureCritere;
      sw.ctx.BananeRelectureCritere = {
        ...Q,
        juger(args, reglages) {
          const out = Q.juger(args, reglages);
          /* Forcer seulement le déclencheur de la correction : la commande reste quasi identique (0,2 mm), pour atteindre D3. */
          return out.regle === 'seuil' && args?.jugement?.pireMm === 14 ? { ...out, corriger: true } : out;
        }
      };
      sw.ctx.BananeLotDecision = {
        ...L,
        commandRails(args) {
          const r = origCmd(args);
          if (r?.action === 'lot' && Math.abs(args?.decision?.fromPredictionMm - 14) < 1e-6) {
            return { ...r, rails: { left: { ...r.rails.left, delta: [0, 0.0002, 0] }, right: { ...r.rails.right, delta: [0, 0.0002, 0] } } };
          }
          return r;
        }
      };
    }
  });
  const t0 = Date.now();
  const p = await Hrel.finPasse(b);
  const dureeMs = Date.now() - t0;
  assert.equal(p.etat, 'finie', p.message);
  assert.ok(dureeMs < 2500, `aucun blocage de 6 s attendu, durée mesurée : ${dureeMs} ms`);
  assert.equal(p.refusees, 0, 'un cut déjà conforme ne compte pas comme refus');
  assert.equal('banane50RelectureIntention' in local.m, false, 'aucune intention incertaine laissée');
  assert.equal(apresLot(b, lot).filter(c => c.action === 'apply').length, 0, 'aucun apply inutile');
  assert.equal(adapter.majEspace.length, 0, 'aucun Maj+Espace inutile');
  const e109 = Hrel.evenements(b, 'relecture-ombre').find(e => e.identity.cut === 109);
  assert.equal(e109.action, 'deja-conforme');
  assert.match(e109.raisonAction, /0,5 mm/);
});
