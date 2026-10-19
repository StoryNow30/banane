'use strict';
/* G1-c-prep — l'évaluateur unique (tools/gcv2-evaluer.cjs) sur données SYNTHÉTIQUES (valeurs inventées, aucune donnée de terrain) :
 *  - RÉFÉRENCE EXACTE (M1) : la règle prudente est celle de tools/relecture-autonome.cjs, lue dans les réglages figés ; la fonction réelle `bilan` et l'évaluateur comptent pareil ;
 *  - PORTE UNIQUE (M2, M3) : chaque condition fait basculer l'issue ; effectif insuffisant → non démontré ; l'échec l'emporte ; la comparaison est appariée ;
 *  - RECOUVREMENTS, UNITÉ (V4), REGISTRE (F6) : catégories qui se recouvrent, trois lectures, parcours de population, « validation puis SKIP », 740 contre 741 ;
 *  - ÉVALUATION COMPLÈTE : λ imbriqué, témoin, annotation de Mic exact. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const RA = require('../tools/relecture-autonome.cjs');
const A = require('../tools/gcv2-apprendre.cjs');
const V = require('../tools/gcv2-evaluer.cjs');
const F = require('./helpers/gcv2-apprendre-fixture.cjs');

/* ------------------------------------------------------------------ fabriques de résultats */
const R = (partie, cut, zone, mic, etat, e = null, lat = 0, extra = {}) => ({ partie, cut, zone, role: 'vert', mic, etat, e: etat === 'agit' ? e : null, lat: etat === 'agit' ? lat : null, ref: 'validation', skip: false, ...extra });
/* Base : 4 parties de 30 cuts en PN. Cuts 0 à 24 : Mic corrige de 15 mm ; cuts 25 à 29 : Mic ne corrige rien. Référence : agit sur 0–19 (pose à 2 mm de Mic), laisse le reste.
 * Candidat : agit sur 0–23 (pose à 2 mm). 96 actions du candidat, 0 erreur : la borne de Wilson passe. */
function base({ parties = 4, taille = 30, agitRef = 20, agitCand = 24 } = {}) {
  const cand = [], ref = [];
  for (let p = 1; p <= parties; p++) for (let i = 0; i < taille; i++) {
    const mic = i < 25 ? 15 : 0, nom = `1:${p}`;
    ref.push(i < agitRef ? R(nom, i, 'pn', mic, 'agit', 2) : R(nom, i, 'pn', mic, 'laisse'));
    cand.push(i < agitCand ? R(nom, i, 'pn', mic, 'agit', 2) : R(nom, i, 'pn', mic, 'laisse'));
  }
  return { cand, ref };
}
const cp = x => x.map(r => ({ ...r }));
const porte = (c, r, options) => V.porteUnique({ candidat: c, reference: r, options });

test('Wilson : l\'effectif minimal est 39 actions sans erreur pour 9 % (repère de l\'audit) et 381 pour 1 %', () => {
  assert.equal(V.effectifMinimum(0.09), 39);
  assert.ok(V.wilsonHaut(0, 39) <= 0.09 && V.wilsonHaut(0, 38) > 0.09);
  assert.equal(V.effectifMinimum(0.01), 381);
  assert.ok(Math.abs(V.wilsonHaut(26, 392) - 0.0954) < 0.0005, 'GCV2 seule, G1-b : 26 sur 392 → 9,54 %');
  assert.ok(Math.abs(V.wilsonHaut(0, 257) - 0.0147) < 0.0005);
});

test('porte unique : la base passe, et chaque condition fait basculer l\'issue', () => {
  const { cand, ref } = base();
  const ok = porte(cand, ref);
  assert.equal(ok.issue, 'succes', ok.raisons.join(' ; '));
  assert.equal(ok.conditions.wilson.suffisant, true); assert.ok(ok.conditions.wilson.haut <= 0.09);
  assert.equal(ok.candidat.actions, 96); assert.equal(ok.reference.actions, 80);
  assert.deepEqual(ok.cuts, 120);

  /* 1. mauvaise voie : une pose à 55 mm sur un cut que la référence laisse faux (donc ni « ajoutée » ni autre condition) */
  let c = cp(cand); c[20] = R('1:1', 20, 'pn', 15, 'agit', 55, 5);
  let p = porte(c, ref); assert.equal(p.issue, 'echec'); assert.deepEqual(p.raisons, ['mauvaise voie observée', 'une partie a une mauvaise voie']); assert.equal(p.conditions.mauvaiseVoie.valeur, 1);
  /* … ou un rail déplacé de plus de 45 mm en travers, avec une pose finale juste */
  c = cp(cand); c[20] = R('1:1', 20, 'pn', 15, 'agit', 3, 50);
  p = porte(c, ref); assert.equal(p.issue, 'echec'); assert.ok(p.raisons.includes('mauvaise voie observée')); assert.equal(p.conditions.mauvaiseVoie.cuts[0].lat, 50);
  /* … à 45 mm exactement, ce n'est pas une mauvaise voie */
  c = cp(cand); c[20] = R('1:1', 20, 'pn', 15, 'agit', 3, 45); assert.equal(porte(c, ref).conditions.mauvaiseVoie.valeur, 0);

  /* 2. Wilson imposé : 12 erreurs à 12 mm sur 96 actions (12,5 %), sans mauvaise voie, sans pose ajoutée (la référence laisse ces cuts à 15 mm), justes encore ≥ référence */
  c = cp(cand); let n = 0;
  for (let i = 0; i < c.length && n < 12; i++) if (c[i].cut >= 20 && c[i].cut <= 23) { c[i] = R(c[i].partie, c[i].cut, 'pn', 15, 'agit', 12); n++; }
  p = porte(c, ref); assert.equal(n, 12);
  assert.equal(p.issue, 'echec'); assert.deepEqual(p.raisons, ['borne de Wilson > 9 %']); assert.equal(p.conditions.wilson.ok, false);
  assert.ok(p.conditions.wilson.taux > 0.09 && p.conditions.poseAjoutee.ok && p.conditions.justes.ok && p.conditions.mauvaiseVoie.ok, 'seule la borne de Wilson échoue');
  /* le taux observé seul (G1-b : « ≤ 9 % ») aurait passé : 5 erreurs sur 96 = 5,2 %, mais la borne dépasse 9 % */
  c = cp(cand); n = 0; for (let i = 0; i < c.length && n < 5; i++) if (c[i].cut >= 20 && c[i].cut <= 23) { c[i] = R(c[i].partie, c[i].cut, 'pn', 15, 'agit', 12); n++; }
  p = porte(c, ref); assert.ok(p.conditions.wilson.taux < 0.09 && p.conditions.wilson.haut > 0.09); assert.equal(p.issue, 'echec', 'la borne est IMPOSÉE, pas seulement calculée');

  /* 3. mauvaise pose ajoutée : le candidat pose à 12 mm un cut que la référence laisse à 0 mm */
  c = cp(cand); c.find(r => r.cut === 27 && r.partie === '1:2').etat = 'agit'; Object.assign(c.find(r => r.cut === 27 && r.partie === '1:2'), { e: 12, lat: 0 });
  p = porte(c, ref); assert.equal(p.issue, 'echec'); assert.deepEqual(p.raisons, ['mauvaise pose ajoutée']); assert.equal(p.conditions.poseAjoutee.cuts[0].partie, '1:2'); assert.equal(p.conditions.poseAjoutee.cuts[0].cut, 27);
  assert.ok(p.conditions.wilson.ok && p.conditions.justes.ok, 'les autres conditions tiennent');

  /* 4a. justes < référence */
  c = base({ agitCand: 19 }).cand; p = porte(c, ref); assert.equal(p.issue, 'echec'); assert.deepEqual(p.raisons, ['moins de corrections justes que la référence']); assert.equal(p.conditions.justes.candidat, 76);
  /* 4b. erreur médiane d'une zone active au-dessus de la référence : le candidat pose à 9 mm (juste, pas une erreur) là où la référence pose à 2 mm */
  c = cp(cand).map(r => r.etat === 'agit' ? { ...r, e: 9 } : r); p = porte(c, ref);
  assert.equal(p.issue, 'echec'); assert.deepEqual(p.raisons, ["erreur médiane d'une zone active au-dessus de la référence"]); assert.equal(p.conditions.medianeParZone.zones.pn.ok, false);
  assert.ok(p.conditions.justes.ok && p.conditions.wilson.ok && p.conditions.mauvaiseVoie.ok);
});

test('porte unique : effectif insuffisant → non démontré (ni succès ni échec), et un échec certain l\'emporte', () => {
  /* 30 actions sans aucune erreur : même sans erreur, la borne de Wilson ne peut pas tomber à 9 % */
  const { cand, ref } = base({ parties: 1, agitRef: 20, agitCand: 24 });
  assert.equal(cand.filter(r => r.etat === 'agit').length, 24);
  let p = porte(cand, ref);
  assert.equal(p.issue, 'non-demontre'); assert.equal(p.conditions.wilson.suffisant, false); assert.equal(p.conditions.wilson.ok, null);
  assert.match(p.raisons[0], /24 actions exposées : au moins 39/);
  /* aucune action du tout : non démontré aussi (rien n'est démontré) */
  p = porte(cand.map(r => ({ ...r, etat: 'laisse', e: null, lat: null })), ref); assert.equal(p.issue, 'echec', 'moins de justes que la référence : échec certain');
  const rien = ref.map(r => ({ ...r, etat: 'laisse', e: null, lat: null }));
  assert.equal(porte(rien, rien).issue, 'non-demontre');
  /* une mauvaise voie sur un petit effectif : échec, pas « non démontré » */
  const c = cp(cand); c[20] = R('1:1', 20, 'pn', 15, 'agit', 80, 5);
  p = porte(c, ref); assert.equal(p.issue, 'echec');
  /* 39 actions sans erreur suffisent */
  const grand = base({ parties: 1, taille: 60, agitRef: 38, agitCand: 39 });
  const ref60 = grand.ref.map((r, i) => i < 38 ? R(r.partie, r.cut, 'pn', 15, 'agit', 2) : (i < 50 ? R(r.partie, r.cut, 'pn', 15, 'laisse') : R(r.partie, r.cut, 'pn', 0, 'laisse')));
  const cand60 = ref60.map((r, i) => i < 39 ? R(r.partie, r.cut, 'pn', 15, 'agit', 2) : r);
  p = porte(cand60, ref60); assert.equal(p.conditions.wilson.actions, 39); assert.equal(p.conditions.wilson.suffisant, true); assert.equal(p.issue, 'succes', p.raisons.join(';'));
});

test('porte unique : comparaison APPARIÉE — autant d\'abîmés des deux côtés, mais pas les mêmes cuts', () => {
  const { cand, ref } = base({ parties: 4, taille: 30, agitRef: 20, agitCand: 24 });
  /* deux cuts où Mic corrige à peine (2 mm) : la référence en abîme un (cut 100), le candidat un autre (cut 101) */
  const X = (partie, cut, etat, e) => R(partie, cut, 'pn', 2, etat, e);
  ref.push(X('1:1', 100, 'agit', 12), X('1:1', 101, 'laisse')); cand.push(X('1:1', 100, 'laisse'), X('1:1', 101, 'agit', 12));
  const p = porte(cand, ref);
  assert.equal(p.candidat.abimes, 1); assert.equal(p.reference.abimes, 1, 'les totaux d\'abîmés sont égaux : l\'ancienne lecture « abîmés ≤ référence » passait');
  assert.equal(p.issue, 'echec'); assert.deepEqual(p.raisons, ['mauvaise pose ajoutée']);
  assert.deepEqual(p.conditions.poseAjoutee.cuts.map(c => c.cut), [101], 'le cut 101 est la mauvaise pose ajoutée ; le 100 est une pose que le candidat évite');
  /* la référence qui pose déjà à plus de 10 mm n'est pas « battue » : mêmes poses des deux côtés, aucune ajoutée */
  const meme = porte(cand.map(r => r.cut === 101 ? { ...r, etat: 'agit', e: 12 } : r), ref.map(r => r.cut === 101 ? { ...r, etat: 'agit', e: 12 } : r));
  assert.equal(meme.conditions.poseAjoutee.valeur, 0);
  /* cuts sans vis-à-vis : listés, jamais comptés */
  const q = porte([...cand, R('1:9', 1, 'pn', 15, 'agit', 2)], ref); assert.equal(q.nonApparies.length, 1);
});

test('porte unique : zones actives (celles où le candidat agit, ou imposées), par partie et actions exposées', () => {
  const { cand, ref } = base();
  /* zone ADV : le candidat n'y agit jamais ; la référence y fait passer l'erreur de 3 à 1 mm. Zone inactive : pas comparée. */
  for (let i = 0; i < 20; i++) { cand.push(R('1:1', 200 + i, 'adv', 3, 'laisse')); ref.push(R('1:1', 200 + i, 'adv', 3, 'agit', 1)); }
  let p = porte(cand, ref);
  assert.equal(p.conditions.medianeParZone.zones.adv.actif, false); assert.equal(p.conditions.medianeParZone.zones.adv.ok, true);
  assert.equal(p.conditions.medianeParZone.zones.adv.candidat > p.conditions.medianeParZone.zones.adv.reference, true, 'la médiane y est pire, mais la zone n\'est pas active');
  assert.equal(p.issue, 'succes', p.raisons.join(';'));
  /* si le protocole impose ADV comme zone active : échec */
  p = porte(cand, ref, { zonesActives: ['pn', 'adv'] }); assert.equal(p.issue, 'echec');
  /* actions exposées par zone, rôle et partie */
  p = porte(cand, ref);
  assert.equal(p.exposition.total.candidat, 96); assert.equal(p.exposition.parZone.candidat.pn, 96); assert.equal(p.exposition.parZone.reference.adv, 20); assert.equal(p.exposition.parRole.candidat.vert, 96);
  assert.deepEqual(Object.keys(p.exposition.parPartie.candidat).sort(), ['1:1', '1:2', '1:3', '1:4']);
  /* une partie peut rater la condition 4 sans faire échouer la porte si le total la tient — mais c'est écrit */
  const b = base(); const cc = b.cand.map(r => r.partie === '1:1' && r.cut >= 15 && r.cut < 24 ? { ...r, etat: 'laisse', e: null, lat: null } : r);   // 1:1 : 15 actions (réf. 20)
  const dd = cc.map(r => r.partie === '1:2' && r.cut === 24 ? R(r.partie, r.cut, 'pn', 15, 'agit', 2) : r);
  p = porte(dd, b.ref);
  assert.equal(p.conditions.parPartie.parties['1:1'].candidat.justes, 15); assert.equal(p.conditions.parPartie.parties['1:1'].reference.justes, 20);
  assert.ok(p.conditions.parPartie.parties['1:1'].ratees.includes('justes < référence'), 'écrit par partie');
  assert.equal(p.conditions.justes.ok, true, 'le total tient'); assert.equal(p.issue, 'succes', p.raisons.join(';'));
  /* une mauvaise voie sur une seule partie met fin à l'examen en échec */
  const mv = cp(b.cand); mv.find(r => r.partie === '1:3' && r.cut === 21).etat = 'agit'; Object.assign(mv.find(r => r.partie === '1:3' && r.cut === 21), { e: 70, lat: 0 });
  p = porte(mv, b.ref); assert.equal(p.issue, 'echec'); assert.equal(p.conditions.parPartie.ok, false); assert.ok(p.conditions.parPartie.parties['1:3'].ratees.includes('mauvaise voie'));
});

test('sensibilité de la porte : références explicites seulement, sans SKIP — lecture seule, même porte', () => {
  const { cand, ref } = base();
  for (const r of [...cand, ...ref]) { r.ref = r.cut % 2 ? 'validation' : 'visite-bon'; r.skip = r.cut === 3; }
  const s = V.sensibilites(cand, ref);
  assert.deepEqual(s.map(x => x.nom.slice(0, 22)), ['références explicites ', 'sans les cuts marqués ', 'références explicites,']);
  assert.ok(s[0].cuts < 120 && s[0].cuts > 40, 'seulement les références explicites');
  assert.ok(s.every(x => ['succes', 'echec', 'non-demontre'].includes(x.issue)));
  assert.equal(s[1].cuts, 120 - 4, 'les 4 cuts 3 (un par partie) sont retirés');
});

test('recouvrements : une mauvaise voie par déplacement latéral peut être juste ; un abîmé est toujours une erreur ; erreur finale > 10 mm, action ou non', () => {
  const rs = [
    R('1:1', 1, 'pn', 15, 'agit', 3, 0),          // juste
    R('1:1', 2, 'pn', 15, 'agit', 3, 50),         // juste ET mauvaise voie (rail déplacé de 50 mm en travers)
    R('1:1', 3, 'pn', 15, 'agit', 20, 0),         // erreur
    R('1:1', 4, 'pn', 15, 'agit', 60, 0),         // erreur ET mauvaise voie
    R('1:1', 5, 'pn', 2, 'agit', 12, 0),          // abîmé ET erreur
    R('1:1', 6, 'pn', 2, 'agit', 70, 0),          // abîmé ET erreur ET mauvaise voie
    R('1:1', 7, 'pn', 2, 'agit', 3, 0),           // aucune catégorie
    R('1:1', 8, 'pn', 15, 'abstient'), R('1:1', 9, 'pn', 15, 'laisse'), R('1:1', 10, 'pn', 1, 'laisse'),
  ];
  const r = V.recouvrements(rs);
  assert.equal(r.actions, 7); assert.deepEqual(r.categories, { justes: 2, abimes: 2, erreurs: 4, mauvaiseVoie: 3 });
  const combo = Object.fromEntries(r.combinaisons.map(c => [c.categories, c.n]));
  assert.equal(combo['juste'], 1); assert.equal(combo['juste + mauvaise voie'], 1); assert.equal(combo['erreur'], 1); assert.equal(combo['erreur + mauvaise voie'], 1);
  assert.equal(combo['abîmé + erreur'], 1); assert.equal(combo['abîmé + erreur + mauvaise voie'], 1);
  assert.ok(Object.keys(combo).some(k => k.startsWith('aucune')));
  assert.ok(!Object.keys(combo).some(k => k.includes('juste') && k.includes('erreur')), 'un juste n\'est jamais une erreur');
  assert.ok(r.categories.mauvaiseVoie + r.categories.justes > r.categories.erreurs, 'les catégories ne s\'additionnent pas');
  /* erreur finale > 10 mm, action ou non : 3 erreurs d'action (20, 60, 12 → 4 avec le 70) + 2 grosses corrections sans action */
  assert.equal(r.erreurFinaleSup10.parActionErreur, 4); assert.equal(r.erreurFinaleSup10.sansAction, 2); assert.equal(r.erreurFinaleSup10.total, 6);
  assert.deepEqual(r.erreurFinaleSup10.dont, { abstentions: 1, laisses: 1 });
  assert.equal(r.reparations, 2); assert.equal(r.deteriorations, 2); assert.equal(r.causesAbstention.abstient, 1);
  assert.equal(V.erreurFinale(rs[8]), 15, 'sans action, l\'erreur finale est celle de la pose de départ');
});

test('unité déclarée : trois lectures (par partie, moyenne des parties, cumul des cuts), projets séparés', () => {
  const rs = [];
  /* 1:1 : 10 cuts, 4 actions (1 erreur) ; 1:2 : 100 cuts, 40 actions, 0 erreur ; 2:1 : 20 cuts, aucune action */
  for (let i = 0; i < 10; i++) rs.push(i < 4 ? R('1:1', i, 'pn', 15, 'agit', i === 0 ? 12 : 2) : R('1:1', i, 'pn', 0, 'laisse'));
  for (let i = 0; i < 100; i++) rs.push(i < 40 ? R('1:2', i, 'pn', 15, 'agit', 2) : R('1:2', i, 'pn', 0, 'laisse'));
  for (let i = 0; i < 20; i++) rs.push(R('2:1', i, 'pn', 0, 'laisse'));
  const u = V.lecturesParUnite(rs);
  assert.deepEqual(Object.keys(u), ['tous', 'projet 1', 'projet 2']);
  assert.equal(u.tous.parties, 3); assert.equal(u['projet 1'].parties, 2); assert.equal(u['projet 2'].parties, 1);
  assert.equal(u.tous.cumulCuts.visites, 130); assert.equal(u.tous.cumulCuts.agit, 44); assert.equal(u.tous.cumulCuts.erreurs, 1);
  assert.equal(u['projet 1'].parPartie['1:1'].agit, 4); assert.equal(u['projet 1'].parPartie['1:2'].agit, 40); assert.equal(u['projet 2'].parPartie['2:1'].agit, 0);
  /* moyenne des parties ≠ cumul des cuts : 1:1 a un taux d'erreur de 25 %, 1:2 de 0 % — la moyenne des taux (12,5 %) n'est pas le taux cumulé (2,3 %) */
  assert.equal(u['projet 1'].moyenneParties.tauxErreur, 0.125); assert.ok(Math.abs(u['projet 1'].cumulCuts.taux - 1 / 44) < 1e-9);
  assert.equal(u['projet 1'].moyenneParties.agit, 22); assert.equal(u.tous.moyenneParties.partiesAvecAction, 2, 'une partie sans action n\'entre pas dans le taux moyen');
  assert.equal(u['projet 2'].moyenneParties.tauxErreur, null);
});

test('registre : visités → référence → nuage → exemples → actions ; validation puis SKIP ; bande 0,6–0,8 s', () => {
  const cas = (cut, ref, etat, o = {}) => ({ cut, mic: ref ? { ref, rails: { left: [0, o.mic || 0, 0], right: [0, 0, 0] } } : { ref: null, raison: o.raison || 'trop-court' }, ariane: { etat }, skipMic: !!o.skip, dwellPremiereS: o.dwell ?? 2 });
  const cs = [cas(1, 'validation', 'calcule', { mic: 15 }), cas(2, 'validation', 'sans-nuage', { mic: 15 }), cas(3, 'visite-bon', 'calcule'), cas(4, null, 'calcule', { dwell: 0.7 }), cas(5, null, 'calcule', { dwell: 0.3 }),
    cas(6, 'validation', 'calcule', { skip: true, mic: 3 }), cas(7, null, 'sans-nuage', { raison: 'deplace-sans-validation', dwell: 0.7 }), cas(8, 'visite-bon', 'calcule', { skip: true }), cas(-1, 'validation', 'calcule'), cas(9, 'validation', 'calcule', { mic: 10.0036 })];
  const l = V.registrePartie({ partie: '1:5', cas: cs, exemples: [1, 3, 6, 8, 9], actions: [1, 9], actionsReference: [1] });
  assert.equal(l.visites, 9, 'le cut -1 n\'est pas un cut visité');
  assert.deepEqual(l.reference, { explicite: 4, implicite: 2, incertaine: 0, aucune: 3 }); assert.deepEqual(l.aucuneParRaison, { 'trop-court': 2, 'deplace-sans-validation': 1 });
  assert.deepEqual(l.nuage, { avec: 7, sans: 2, autre: 0 }); assert.equal(l.referenceEtNuage, 5);
  assert.equal(l.exemples, 5); assert.equal(l.actions, 2); assert.equal(l.actionsReference, 1);
  /* « validation puis SKIP » : le SKIP n'est pas propagé, le cut garde sa référence explicite et reste un exemple (le registre le montre) */
  assert.deepEqual(l.skip, { total: 2, referenceExplicite: 1, referenceImplicite: 1, sansReference: 0, retenusCommeExemples: 2 });
  assert.deepEqual(l.grossesCorrections, { total: 3, avecNuage: 2, sansNuage: 1, retenuesCommeExemples: 2 }, '10,0036 mm dépasse 10 mm dans l\'extraction');
  assert.equal(l.seuilVisite.trop_courtsDansLaBande, 1, 'une visite de 0,7 s sans validation (cut 4) : acceptée à 0,6 s, refusée à 0,8 s ; le cut 7 est refusé pour une autre raison');
  assert.equal(l.seuilVisite.utilise, 0.8); assert.equal(l.seuilVisite.g0, 0.6);
  const t = V.sommeRegistre([l, l]);
  assert.equal(t.visites, 18); assert.equal(t.reference.explicite, 8); assert.equal(t.skip.retenusCommeExemples, 4); assert.equal(t.partie, 'total'); assert.equal(t.seuilVisite.trop_courtsDansLaBande, 2);
  assert.ok(/total/.test(V.rapportRegistre([l, t])));
});

test('740 contre 741 : même population, Mic arrondi à 0,01 mm dans le jeu et exact dans l\'extraction', () => {
  const cas = [{ cut: 1, mic: { ref: 'validation', rails: { left: [0.0, 10.0036, 0], right: [0, 0, 0] } } }, { cut: 2, mic: { ref: 'validation', rails: { left: [0, 12, 0], right: [0, 0, 0] } } }, { cut: 3, mic: { ref: null } }];
  const jeu = { partie: '9:1', cuts: [1, 2, 3].map(c => ({ cut: { cut: c, etiquette: { micMaxMm: c === 1 ? 10 : c === 2 ? 12 : null } } })) };
  const r = V.reconcilierGrosses([{ jeu, cas }]);
  assert.equal(r.cas, 2); assert.equal(r.jeu, 1); assert.deepEqual(r.ecarts, [{ partie: '9:1', cut: 1, micExact: 10.0036, micJeu: 10 }]);
});

/* ------------------------------------------------------------------ référence exacte */
/* Une partie inventée par tools/relecture-autonome.cjs (essai) : un PN (cuts 50 à 56), un lot (45 et 46), et un cut (60) où la pose d'Ariane s'écarte de 12 mm d'un Mic qui n'a rien corrigé. */
function partieDeLEssai() {
  const { cas, table } = RA.essai();
  const L = RA.lignes({ cas, table, designation: '9:1' });
  const cuts = L.lignes.map(l => ({ cut: { cut: l.cut, zone: l.zone, role: l.genre === 'pose' ? 'rouge' : l.genre === 'differe' ? 'differe' : 'vert', etiquette: { micMaxMm: l.mic } } }));
  return { cas, table, jeu: { partie: '9:1', entete: { gMedMm: L.gMed }, cuts }, lignes: L };
}
test('référence exacte : les vraies fonctions de relecture-autonome, lues dans les réglages figés, cut par cut', () => {
  const { cas, table, jeu } = partieDeLEssai(), reglages = V.reglagesDuDepot();
  const avecTable = V.referenceExacte({ jeu, cas, reglages, table }), pseudo = V.referenceExacte({ jeu, cas, reglages });
  assert.equal(avecTable.resultats.size, 31, 'tous les cuts de l\'essai ont une référence et un nuage');
  assert.deepEqual([...pseudo.resultats.values()].map(r => [r.cut, r.etat, r.zone, r.role]), [...avecTable.resultats.values()].map(r => [r.cut, r.etat, r.zone, r.role]),
    'la table minimale (le lot lu dans le jeu) donne les mêmes décisions que la vraie table');
  assert.equal(avecTable.zonesDifferentes, 0);
  const a = avecTable.resultats;
  assert.equal(a.get(60).etat, 'agit', 'cut 60 : la pose s\'écarte de 12 mm (≥ 8 mm), dans le périmètre'); assert.ok(a.get(60).e > 10, 'et c\'est un abîmé : Mic n\'avait rien corrigé');
  assert.equal(a.get(45).role, 'rouge'); assert.notEqual(a.get(45).etat, 'agit', 'jamais sur un cut posé par le lot');
  /* le compte de l'évaluateur est celui de la fonction `bilan` de tools/relecture-autonome.cjs */
  const C = V.controleD190({ parties: [{ jeu, cas, table }], reglages, attendu: { ...V.ATTENDU_D190 } });
  assert.equal(C.accordReelMien, true, C.ecartsReelMien.join(','));
  assert.equal(C.reel.agit, C.mien.agit); assert.equal(C.reel.abimes, C.mien.abimes); assert.equal(C.reel.justes, C.mien.justes);
  assert.equal(C.accordAttendu, false, 'les chiffres de D-190 ne sont pas ceux de cette partie inventée : le contrôle le dit');
  assert.ok(C.ecartsAttendu.includes('visites'));
  const ok = V.controleD190({ parties: [{ jeu, cas, table }], reglages, attendu: { ...C.reel } });
  assert.equal(ok.accordAttendu, true);
  assert.match(V.rapportControle(C), /fonction `bilan` de relecture-autonome/);
  /* les réglages font bouger la règle : écart minimal à 20 mm, le cut 60 n'est plus corrigé (la règle est bien lue dans les réglages, pas recopiée) */
  const strict = JSON.parse(JSON.stringify(reglages)); for (const z of Object.keys(strict.zones)) strict.zones[z].seuilMm = 20;
  assert.equal(V.referenceExacte({ jeu, cas, reglages: strict, table }).resultats.get(60).etat, 'laisse');
  /* une zone repassée en ombre n'agit plus */
  const ombre = JSON.parse(JSON.stringify(reglages)); ombre.zones.pn.corriger = false; ombre.zones.abords.corriger = false; ombre.zones.adv.corriger = false;
  assert.equal([...V.referenceExacte({ jeu, cas, reglages: ombre, table }).resultats.values()].filter(r => r.etat === 'agit').length, 0);
  /* comparaison cut par cut */
  const cmp = V.comparerCutParCut([...a.values()], [...a.values()].map(r => r.cut === 60 ? { ...r, etat: 'laisse', e: null } : r));
  assert.equal(cmp.communs, 31); assert.equal(cmp.differences.length, 1); assert.equal(cmp.differences[0].cut, 60);
});

test('référence exacte : une ligne mesurable manque → erreur claire, jamais un repli silencieux sur le substitut', () => {
  const { cas, table, jeu } = partieDeLEssai(), ex = V.referenceExacte({ jeu, cas, table });
  const f = V.fournisseurReference({ '9:1': ex });
  assert.equal(f({ partie: '9:1', cut: 60 }).cut, 60);
  assert.throws(() => f({ partie: '9:1', cut: 9999 }), /n'a pas de ligne mesurable/);
  assert.throws(() => f({ partie: '9:2', cut: 1 }), /n'a pas de ligne mesurable/);
});

/* ------------------------------------------------------------------ évaluation complète (jeu synthétique + cas assortis) */
function casDuJeu(lignes, numero) {
  return lignes.filter(l => l.type === 'cut').map(c => {
    const rails = {}, pose = {}; for (const s of ['left', 'right']) { rails[s] = { statut: 'candidate', confiance: 70, pose: c.etiquette.mic[s].map((v, i) => i ? v * 0.9 : v), hauteurMm: 0 }; pose[s] = rails[s]; }
    return { format: 'ariane-relecture-autonome-cas-v1', projet: 9, partie: numero, cut: c.cut, visites: 1, dwellPremiereS: 2, mic: { ref: c.reference, rails: c.etiquette.mic }, skipMic: c.cut % 17 === 3,
      ariane: { etat: 'calcule', stage: 'first-pass', ecartementDepartMm: 1450, ecartementPoseMm: 1450, rails, chaine: { stage: 'first-pass', ecartementPoseMm: 1450, rails: pose }, surface: null } };
  });
}
test('évaluation complète : λ imbriqué, témoin à λ fixe, référence exacte, porte, unités, registre — et Mic exact', () => {
  const noms = [1, 2, 3], lignes = noms.map(n => F.jeuSynthetique({ partie: `9:${n}`, graine: n, cuts: 50 }));
  const parties = lignes.map((l, i) => { const j = A.jeuDeLignes(l); j.sha256 = 'x'.repeat(63) + (i + 1); return j; });
  const casParPartie = Object.fromEntries(noms.map((n, i) => [`9:${n}`, casDuJeu(lignes[i], n)]));
  /* Mic exact : 10,0036 mm dans l'extraction, 10,0 dans le jeu */
  const j1 = lignes[0].find(l => l.type === 'cut' && l.etiquette.micMaxMm > 12);
  const c1 = casParPartie['9:1'].find(c => c.cut === j1.cut); c1.mic.rails.left = [0, 10.0036, 0]; c1.mic.rails.right = [0, 0, 0]; j1.etiquette.micMaxMm = 10;
  const E = V.evaluer({ parties, casParPartie, usage: 'relecture', lambdas: [10, 300], lambdaTemoin: 10 });
  assert.equal(E.format, V.FORMAT_EVAL); assert.deepEqual(E.parties, ['9:1', '9:2', '9:3']); assert.deepEqual(E.lambdas, [10, 300]);
  assert.ok(['succes', 'echec', 'non-demontre'].includes(E.porte.issue));
  assert.equal(E.porte.cuts, E.nCas); assert.equal(E.porte.nonApparies.length, 0, 'mêmes cuts pour le candidat et la référence');
  assert.ok(E.temoin && E.temoin.lambda === 10 && ['succes', 'echec', 'non-demontre'].includes(E.temoin.porte.issue), 'le témoin à λ fixe passe par la même porte');
  for (const p of E.parties) { assert.ok([10, 300].includes(E.lambdaParPli[p].choisi)); assert.deepEqual(Object.keys(E.lambdaParPli[p].criteres), ['10', '300']); }
  /* la référence est celle de relecture-autonome : les résultats de la référence sont ceux de referenceExacte */
  const ex = V.referenceExacte({ jeu: parties[0], cas: casParPartie['9:1'] });
  const dansE = E.cuts.reference.filter(r => r.partie === '9:1');
  assert.ok(dansE.length > 0 && dansE.every(r => { const s = ex.resultats.get(r.cut); return s && s.etat === r.etat; }));
  /* Mic exact annoté sur le candidat, la référence et la GCV2 seule */
  for (const jeu of ['candidat', 'reference', 'gcv2Seule']) { const r = E.cuts[jeu].find(x => x.partie === '9:1' && x.cut === j1.cut); if (r) assert.equal(r.mic, 10.0036, jeu); }
  assert.ok(E.cuts.candidat.every(r => 'ref' in r && 'skip' in r), 'référence et SKIP annotés pour la sensibilité');
  assert.equal(E.sensibilites.length, 3);
  assert.deepEqual(Object.keys(E.unites.candidat), ['tous', 'projet 9']);
  assert.equal(E.registre.parPartie.length, 3); assert.equal(E.registre.total.visites, 150);
  assert.equal(E.registre.total.exemples, E.nCas, 'chaque exemple retenu est jugé une fois');
  assert.equal(E.publieG1b.agit, 257);
  const texte = V.rapportEvaluation(E);
  assert.match(texte, /Porte unique : (SUCCÈS|ÉCHEC|NON DÉMONTRÉ)/); assert.match(texte, /Écart du λ imbriqué avec G1-b/); assert.match(texte, /Registre de population/); assert.match(texte, /Unité déclarée : la partie/);
  assert.ok(!/probabilité de (couple|paire)/i.test(texte), 'on parle de score de paire');
  /* sans cas pour une partie : refus net */
  assert.throws(() => V.evaluer({ parties, casParPartie: { '9:1': casParPartie['9:1'] }, usage: 'relecture' }), /cas de l'extraction manquent/);
});

test('ligne de commande : arguments et refus', () => {
  const a = V.argsCli(['valider', '--jeu', 'a.jsonl', '--jeu', 'b.jsonl', '--cas', 'c.jsonl', '--usage', 'lot', '--lambdas', '3,30,300', '--lambda-temoin', '30', '--variante', 'V2', '--sortie', 'e.json']);
  assert.deepEqual(a.jeux, ['a.jsonl', 'b.jsonl']); assert.deepEqual(a.lambdas, [3, 30, 300]); assert.equal(a.lambdaTemoin, 30); assert.equal(a.variante, 'V2'); assert.equal(a.usage, 'lot');
  assert.throws(() => V.argsCli(['valider', '--inconnu']), /argument inconnu/);
  assert.throws(() => V.argsCli(['valider', '--jeu']), /valeur manquante/);
});

/* ------------------------------------------------------------------ référence incertaine (D-211) */
test('référence incertaine : détectée par l\'écart à la liste d\'ESV du départ, classée à part au registre, exclue des exemples et de la référence', () => {
  const m = (...v) => v;
  /* détection : la pose de départ de la visite est déjà déplacée par rapport à la ligne de la liste d'ESV du départ de partie */
  const liste = { left: m(0, 0, 0), right: m(0, 1400, 0) };
  assert.equal(V.detecterReferenceIncertaine({ poseDepartVisite: { left: m(0, 0, 0.2), right: m(0, 1400, 0) }, poseListeDebut: liste }).incertaine, false, 'à 0,2 mm : le départ est celui de la liste');
  const d = V.detecterReferenceIncertaine({ poseDepartVisite: { left: m(0, 0, 0), right: m(0, 1400, 12) }, poseListeDebut: liste });
  assert.equal(d.incertaine, true); assert.equal(d.ecartMm, 12); assert.equal(d.seuilMm, V.SEUIL_REFERENCE_INCERTAINE_MM);
  assert.equal(V.detecterReferenceIncertaine({ poseDepartVisite: { left: m(0, 0, 3), right: m(0, 1400, 0) }, poseListeDebut: liste, seuilMm: 5 }).incertaine, false, 'seuil réglable');
  const sans = V.detecterReferenceIncertaine({ poseDepartVisite: { left: m(0, 0, 0), right: m(0, 1400, 0) }, poseListeDebut: null });
  assert.equal(sans.incertaine, null); assert.match(sans.raison, /indisponible/, 'sans la liste d\'ESV, le signal n\'est pas évaluable : dit, pas deviné');
  /* registre : ni explicite, ni implicite, ni exemple, ni grosse correction avec référence */
  const cas = (cut, ref, extra = {}) => ({ cut, mic: ref === 'incertaine' ? { ref, rails: { left: [0, 0, 0], right: [0, 0, 0] } } : { ref, rails: { left: [0, 15, 0], right: [0, 0, 0] } }, ariane: { etat: 'calcule' }, skipMic: false, ...extra });
  const l = V.registrePartie({ partie: '9:1', cas: [cas(1, 'validation'), cas(2, 'visite-bon'), cas(3, 'incertaine'), cas(4, 'validation', { referenceIncertaine: true })], exemples: [1, 2] });
  assert.deepEqual(l.reference, { explicite: 1, implicite: 1, incertaine: 2, aucune: 0 }); assert.equal(l.referenceEtNuage, 2, 'une référence incertaine n\'entre pas dans « référence et nuage »');
  assert.equal(l.grossesCorrections.total, 2, 'ni dans les grosses corrections (les cuts 1 et 2 seulement)');
  assert.match(V.rapportRegistre([l]), /réf\. incertaine/);
  /* la référence prudente ne traite pas un cut incertain comme une correction nulle : pas de ligne mesurable */
  const { cas: cs, table, jeu } = partieDeLEssai();
  const cs2 = cs.map(c => c.cut === 55 ? { ...c, mic: { ref: 'incertaine', rails: c.mic.rails } } : c);
  const ex = V.referenceExacte({ jeu, cas: cs2, table });
  assert.equal(ex.resultats.has(55), false); assert.equal(ex.resultats.size, 30);
  /* l'apprentissage : un cut dont la référence du jeu est « incertaine » n'est jamais un exemple */
  const lignes = F.jeuSynthetique({ partie: '9:1', graine: 3, cuts: 30 }), avant = A.construireCas(A.jeuDeLignes(lignes), 'relecture');
  const cible = avant[0].cut; lignes.find(x => x.type === 'cut' && x.cut === cible).reference = 'incertaine';
  const apres = A.construireCas(A.jeuDeLignes(lignes), 'relecture');
  assert.equal(apres.length, avant.length - 1); assert.ok(!apres.some(k => k.cut === cible));
});
