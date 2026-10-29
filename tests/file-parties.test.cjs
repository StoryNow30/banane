'use strict';
/* CH-017 — FILE DE PARTIES, machine à états pure (src/file-parties.js). Un essai par motif de fin (tableau de l'architecture 5.0, module P, D-248),
 * partie sans rouge, 2 parties puis 3, reprise après redémarrage du service worker, registre borné, alerte non bloquante. Aucune donnée d'ESV. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const F = require('../src/file-parties.js');
const at = '2026-10-29T10:00:00.000Z';
const SEL = { status: 'ok', current: 23, parts: [22, 23, 24, 25, 26].map(part => ({ part, label: 'Part ' + part, current: part === 23 })) };
const ACTIONS_PERMISES = new Set(['demarrer-lot', 'changer-partie', 'retour-partie', 'arreter-activite', 'registre']);

function demarrer(n = 2) {
  const r = F.transition(null, { type: 'demarrer', id: 'f1', n, selecteur: SEL, courante: 23, lotArgs: { lotDecision: 'apply' }, at });
  assert.equal(r.refus, undefined, r.refus);
  return r;
}
/* Une partie jusqu'à la fin de sa relecture ; rend le résultat de la dernière transition. */
function partie(e, k, { motif = 'fin-normale', passe = 'finie', relecture = 'finie' } = {}) {
  const lotId = 'lot' + k, part = e.partie.part;
  let r = F.transition(e, { type: 'lot-demarre', lotId, part, at }); assert.equal(r.ignore, undefined, r.ignore);
  r = F.transition(r.etat, { type: 'lot-fin', lotId, motif, issue: motif, resume: { traites: 100, poses: 90, differes: 10, ecritsPasse: 0 }, at });
  if (r.etat.etat !== 'passe') return r;
  r = F.transition(r.etat, { type: 'passe-fin', lotId, issue: passe, ecrits: 0, at });
  if (r.etat.etat !== 'relecture') return r;
  return F.transition(r.etat, { type: 'relecture-fin', lotId, issue: relecture, corriges: 2, faits: 40, mode: 'corriger', at });
}

test('planifier : la partie affichée puis les suivantes du sélecteur ; refus en clair, jamais une file plus courte', () => {
  assert.deepEqual(F.planifier(SEL, 23, 3), { plan: [23, 24, 25] });
  assert.match(F.planifier(SEL, 25, 3).refus, /n’offre que 2 parties/);
  assert.match(F.planifier({ status: 'absent', parts: [] }, 23, 2).refus, /absent/);
  assert.match(F.planifier(null, 23, 2).refus, /pas encore relevé/);
  assert.match(F.planifier(SEL, 40, 2).refus, /n’est pas dans le sélecteur/);
  assert.match(F.planifier(SEL, 23, 0).refus, /un entier de 1 à/);
  assert.match(F.planifier(SEL, 23, F.MAX_PARTIES + 1).refus, /un entier de 1 à/);
});

test('2 parties : lot, passe, relecture, changement, lot, passe, relecture, fin « nombre-atteint » ; seules actions : démarrer un lot, changer de partie', () => {
  let r = demarrer(2), actions = [...r.actions];
  assert.deepEqual(r.actions, [{ type: 'demarrer-lot', part: 23, rang: 0 }]);
  r = partie(r.etat, 0); actions.push(...r.actions);
  assert.equal(r.etat.etat, 'changement');
  assert.deepEqual(r.actions, [{ type: 'registre', rang: 0 }, { type: 'changer-partie', vers: 24 }]);
  r = F.transition(r.etat, { type: 'changement-envoye', vers: 24, at }); assert.equal(r.etat.changement.tentatives, 1);
  r = F.transition(r.etat, { type: 'changement-ok', part: 24, cut: 1, at }); actions.push(...r.actions);
  assert.deepEqual(r.actions, [{ type: 'demarrer-lot', part: 24, rang: 1 }]);
  r = partie(r.etat, 1); actions.push(...r.actions);
  assert.equal(r.etat.etat, 'fin'); assert.equal(r.etat.motifFin.code, 'nombre-atteint'); assert.equal(r.etat.alerte, null);
  assert.deepEqual(r.etat.bilan.map(p => p.part), [23, 24]);
  assert.ok(actions.every(a => ACTIONS_PERMISES.has(a.type)), JSON.stringify(actions));
  assert.equal(F.vue(r.etat).bilan[1].relecture.corriges, 2);
});

test('3 parties : trois lots, deux changements, bilan de trois parties ; la file s’éteint d’elle-même', () => {
  let r = demarrer(3); const changements = [];
  for (let k = 0; k < 3; k++) {
    r = partie(r.etat, k);
    const c = r.actions.find(a => a.type === 'changer-partie');
    if (c) { changements.push(c.vers); r = F.transition(r.etat, { type: 'changement-ok', part: c.vers, at }); }
  }
  assert.deepEqual(changements, [24, 25]);
  assert.equal(r.etat.etat, 'fin'); assert.deepEqual(r.etat.bilan.map(p => p.part), [23, 24, 25]);
  assert.equal(F.transition(r.etat, { type: 'oublier' }).etat, null, 'une file finie s’oublie');
});

test('partie sans rouge : comptée comme faite, la file continue (passe et relecture attendues) ; départ sur vert : continue en notant le motif', () => {
  for (const motif of ['partie-sans-rouge', 'depart-sur-vert']) {
    const r = partie(demarrer(2).etat, 0, { motif, relecture: 'non-lancee' });
    assert.equal(r.etat.etat, 'changement', motif);
    assert.deepEqual(r.etat.bilan[0].motifs.map(m => m.code), [motif, 'relecture-arretee']);
  }
});

test('un essai par motif d’arrêt du lot : écriture incertaine, refus propre au lot, arrêt par l’opérateur ; alerte sauf pour l’opérateur ; ni passe ni partie suivante', () => {
  for (const [motif, alerte] of [['ecriture-incertaine', true], ['refus-lot', true], ['operateur', false]]) {
    const r = partie(demarrer(3).etat, 0, { motif });
    assert.equal(r.etat.etat, 'arret', motif); assert.equal(r.etat.motifFin.code, motif);
    assert.equal(!!r.etat.alerte, alerte, motif); assert.deepEqual(r.actions, [], motif);
    assert.equal(r.etat.bilan.length, 1);
  }
  assert.match(F.MOTIFS['ecriture-incertaine'].texte, /contrôle le cut dans ESV/);
});

test('passe et relecture : arrêtées sans écriture en suspens, la file continue (motif noté) ; avec écriture en suspens, la file s’arrête', () => {
  let r = partie(demarrer(2).etat, 0, { passe: 'erreur' }); assert.equal(r.etat.etat, 'changement');
  assert.deepEqual(r.etat.bilan[0].motifs.map(m => m.code), ['fin-normale', 'passe-arretee']);
  r = partie(demarrer(2).etat, 0, { relecture: 'arretee' }); assert.equal(r.etat.etat, 'changement');
  assert.deepEqual(r.etat.bilan[0].motifs.map(m => m.code), ['fin-normale', 'relecture-arretee']);
  /* écriture en suspens à la fin de la passe */
  let e = F.transition(demarrer(2).etat, { type: 'lot-demarre', lotId: 'L', part: 23, at }).etat;
  e = F.transition(e, { type: 'lot-fin', lotId: 'L', motif: 'fin-normale', at }).etat;
  r = F.transition(e, { type: 'passe-fin', lotId: 'L', issue: 'erreur', ecritureEnSuspens: true, detail: 'cut 112', at });
  assert.equal(r.etat.etat, 'arret'); assert.equal(r.etat.motifFin.code, 'ecriture-incertaine'); assert.deepEqual(r.actions, []);
  /* et à la fin de la relecture */
  e = F.transition(e, { type: 'passe-fin', lotId: 'L', issue: 'finie', at }).etat;
  r = F.transition(e, { type: 'relecture-fin', lotId: 'L', issue: 'erreur', ecritureEnSuspens: true, at });
  assert.equal(r.etat.motifFin.code, 'ecriture-incertaine'); assert.deepEqual(r.actions, []);
  /* « suspens » lu au registre, à tout moment */
  r = F.transition(e, { type: 'suspens', detail: 'correction interrompue au cut 7', at });
  assert.equal(r.etat.motifFin.code, 'ecriture-incertaine'); assert.match(r.etat.alerte.detail, /cut 7/);
});

test('relecture non lancée parce qu’ESV affiche une autre partie : retour sur la partie du lot, une fois (D-261) ; la seconde fois, motif noté et la file continue', () => {
  let e = F.transition(demarrer(2).etat, { type: 'lot-demarre', lotId: 'L', part: 23, at }).etat;
  e = F.transition(e, { type: 'lot-fin', lotId: 'L', motif: 'fin-normale', at }).etat;
  e = F.transition(e, { type: 'passe-fin', lotId: 'L', issue: 'finie', at }).etat;
  let r = F.transition(e, { type: 'relecture-fin', lotId: 'L', issue: 'non-lancee', horsPartie: true, at });
  assert.equal(r.etat.etat, 'relecture'); assert.deepEqual(r.actions, [{ type: 'retour-partie', vers: 23 }]);
  r = F.transition(r.etat, { type: 'relecture-fin', lotId: 'L', issue: 'non-lancee', horsPartie: true, at });
  assert.equal(r.etat.etat, 'changement'); assert.deepEqual(r.etat.bilan[0].motifs.map(m => m.code), ['fin-normale', 'relecture-arretee']);
});

test('changement de partie : chaque motif d’échec arrête la file avec alerte et bilan ; une autre partie atteinte est ignorée', () => {
  const avant = partie(demarrer(3).etat, 0).etat;
  for (const motif of ['changement-impossible', 'commande-absente', 'esv-muet', 'onglet-ferme']) {
    const r = F.transition(avant, { type: 'changement-echec', motif, detail: 'essai', at });
    assert.equal(r.etat.etat, 'arret'); assert.equal(r.etat.motifFin.code, motif); assert.ok(r.etat.alerte); assert.equal(r.etat.bilan.length, 1);
  }
  assert.equal(F.transition(avant, { type: 'changement-ok', part: 26, at }).ignore, 'partie atteinte différente de la partie demandée');
  const r = F.transition(avant, { type: 'lot-refuse', at }); assert.ok(r.ignore, 'hors état');
});

test('lot qui ne démarre pas : arrêt « lot-non-demarre » ; bouton « Arrêter la file » et onglet fermé, de tout état actif', () => {
  let r = F.transition(demarrer(2).etat, { type: 'lot-refuse', detail: 'Écho est actif', at });
  assert.equal(r.etat.motifFin.code, 'lot-non-demarre');
  const etats = [demarrer(2).etat];
  let e = F.transition(etats[0], { type: 'lot-demarre', lotId: 'L', part: 23, at }).etat; etats.push(e);
  e = F.transition(e, { type: 'lot-fin', lotId: 'L', motif: 'fin-normale', at }).etat; etats.push(e);
  e = F.transition(e, { type: 'passe-fin', lotId: 'L', issue: 'finie', at }).etat; etats.push(e);
  e = F.transition(e, { type: 'relecture-fin', lotId: 'L', issue: 'finie', at }).etat; etats.push(e);
  assert.deepEqual(etats.map(x => x.etat), ['lot', 'lot', 'passe', 'relecture', 'changement']);
  for (const x of etats) for (const [type, code] of [['arreter', 'operateur'], ['onglet-ferme', 'onglet-ferme']]) {
    r = F.transition(x, { type, at }); assert.equal(r.etat.etat, 'arret'); assert.equal(r.etat.motifFin.code, code);
    assert.deepEqual(r.actions, [{ type: 'arreter-activite' }]);
  }
  assert.ok(F.transition(r.etat, { type: 'arreter', at }).ignore, 'une file arrêtée ne s’arrête pas deux fois');
});

test('événements d’un autre lot ou hors état : ignorés, l’état ne bouge pas ; démarrer deux fois : ignoré', () => {
  const e = F.transition(demarrer(2).etat, { type: 'lot-demarre', lotId: 'L', part: 23, at }).etat;
  for (const ev of [{ type: 'lot-fin', lotId: 'X', motif: 'fin-normale' }, { type: 'passe-fin', lotId: 'L' }, { type: 'changement-ok', part: 24 }, { type: 'lot-demarre', lotId: 'M', part: 23 }]) {
    const r = F.transition(e, { ...ev, at }); assert.ok(r.ignore, JSON.stringify(ev)); assert.equal(r.etat, e); assert.deepEqual(r.actions, []);
  }
  assert.ok(F.transition(e, { type: 'demarrer', id: 'f2', n: 2, selecteur: SEL, courante: 23, at }).ignore);
  assert.equal(F.transition(e, { type: 'lot-fin', lotId: 'L', motif: 'inconnu', at }).etat.motifFin.code, 'refus-lot', 'motif inconnu : arrêt, jamais une suite');
});

test('reprise après redémarrage du service worker : registre d’abord ; départ du lot rejoué ou rattaché ; changement rejoué une fois ou conclu', () => {
  const d = demarrer(3).etat;
  assert.deepEqual(F.reprise(d, { ongletPresent: true, at }).actions, [{ type: 'demarrer-lot', part: 23, rang: 0 }], 'lot jamais créé : départ rejoué');
  let r = F.reprise(d, { ongletPresent: true, lotFile: { id: 'L', rang: 0, part: 23 }, at });
  assert.deepEqual(r.actions, []); assert.equal(r.etat.partie.lotId, 'L', 'lot créé avant l’arrêt : rattaché, jamais un second lot');
  r = F.reprise(d, { ongletPresent: true, ecritureEnSuspens: true, detailSuspens: 'pose au cut 9', at });
  assert.equal(r.etat.motifFin.code, 'ecriture-incertaine'); assert.deepEqual(r.actions, []);
  r = F.reprise(d, { ongletPresent: false, at }); assert.equal(r.etat.motifFin.code, 'onglet-ferme');
  /* en plein lot, passe ou relecture : la file reprend l'observation seulement */
  const enLot = F.transition(d, { type: 'lot-demarre', lotId: 'L', part: 23, at }).etat;
  r = F.reprise(enLot, { ongletPresent: true, ecritureEnSuspens: true, at });
  assert.equal(r.etat.etat, 'lot', 'lot ouvert : son propre classement à la fin décidera'); assert.deepEqual(r.actions, []); assert.equal(r.etat.reprises, 1);
  /* en plein changement */
  let ch = partie(d, 0).etat; ch = F.transition(ch, { type: 'changement-envoye', vers: 24, at }).etat;
  r = F.reprise(ch, { ongletPresent: true, partieAffichee: 24, at });
  assert.equal(r.etat.etat, 'lot'); assert.deepEqual(r.actions, [{ type: 'demarrer-lot', part: 24, rang: 1 }]);
  r = F.reprise(ch, { ongletPresent: true, partieAffichee: 23, at }); assert.deepEqual(r.actions, [{ type: 'changer-partie', vers: 24 }]);
  ch = F.transition(ch, { type: 'changement-envoye', vers: 24, at }).etat;
  r = F.reprise(ch, { ongletPresent: true, partieAffichee: 23, at }); assert.equal(r.etat.motifFin.code, 'changement-impossible', 'deux tentatives au plus');
  r = F.reprise(ch, { ongletPresent: true, partieAffichee: 23, ecritureEnSuspens: true, at }); assert.equal(r.etat.motifFin.code, 'ecriture-incertaine');
  assert.deepEqual(F.reprise(null, {}), { etat: null, actions: [] });
});

test('état gardé relu champ par champ : illisible = aucune file', () => {
  const e = demarrer(2).etat;
  assert.deepEqual(F.relire(JSON.parse(JSON.stringify(e))), e);
  for (const x of [null, 'x', { ...e, v: 2 }, { ...e, etat: 'bizarre' }, { ...e, plan: [] }, { ...e, k: 5 }, { ...e, bilan: null }, { ...e, plan: [-1] }]) assert.equal(F.relire(x), null);
});

test('classer un lot clos : écriture en suspens d’abord ; pause et lot ouvert : la file attend', () => {
  assert.equal(F.classerLot({ etat: 'RUNNING' }), null);
  assert.equal(F.classerLot({ etat: 'PAUSED_ADAPTER_UNRESPONSIVE' }), null);
  assert.equal(F.classerLot({ etat: 'COMPLETED' }), 'fin-normale');
  assert.equal(F.classerLot({ etat: 'COMPLETED', ecritureEnSuspens: true }), 'ecriture-incertaine');
  assert.equal(F.classerLot({ etat: 'FINISHED_WITH_UNCONFIRMED_ACTIONS' }), 'ecriture-incertaine');
  assert.equal(F.classerLot({ etat: 'STOPPED', stoppedAtEnd: { issue: 'partie-sans-rouge' } }), 'partie-sans-rouge');
  assert.equal(F.classerLot({ etat: 'STOPPED', stoppedAtEnd: { issue: 'depart-sur-vert' } }), 'depart-sur-vert');
  assert.equal(F.classerLot({ etat: 'STOPPED', stoppedAtEnd: { issue: 'dernier-cut-valide' } }), 'fin-normale');
  assert.equal(F.classerLot({ etat: 'STOPPED', arretOperateur: true }), 'operateur');
  assert.equal(F.classerLot({ etat: 'STOPPED' }), 'refus-lot');
});

test('registre des écritures : une entrée par partie, remplacée et non doublée, bornée aux 50 dernières ; cuts triés et dédoublonnés', () => {
  let R = [];
  for (let i = 0; i < 60; i++) R = F.registreAjouter(R, { fileId: 'f', part: i, rang: 0, lotId: 'l' + i, poses: [3, 1, 3, -2, 'x'], passe: [9], corriges: [{ cut: 4, ecartMm: 12.34 }, { cut: 'x' }] });
  assert.equal(R.length, F.MAX_REGISTRE); assert.equal(R[0].part, 10);
  assert.deepEqual(R.at(-1).poses, [1, 3]); assert.deepEqual(R.at(-1).corriges, [{ cut: 4, ecartMm: 12.3 }]);
  R = F.registreAjouter(R, { fileId: 'f', part: 59, rang: 0, lotId: 'l59', poses: [7] });
  assert.equal(R.length, F.MAX_REGISTRE); assert.deepEqual(R.at(-1).poses, [7]);
});

test('alerte non bloquante (seuils proposés, non décidés) : différés hors passe au-delà de 2 fois la médiane, plus de 5 % corrigés, au moins 1 refus ; elle n’arrête rien', () => {
  const prec = [{ resume: { traites: 100, differes: 5, ecritsPasse: 0 } }, { resume: { traites: 100, differes: 7, ecritsPasse: 2 } }];
  assert.deepEqual(F.alertes({ resume: { traites: 100, differes: 10, ecritsPasse: 0 }, relecture: { corriges: 5 } }, prec), []);
  const a = F.alertes({ resume: { traites: 100, differes: 13, ecritsPasse: 1, refus: 1 }, relecture: { corriges: 6 } }, prec);
  assert.deepEqual(a.map(x => x.code), ['differes', 'corriges', 'refus']);
  assert.deepEqual(F.alertes({ resume: { traites: 100, differes: 50 } }, []).map(x => x.code), [], 'première partie : aucune médiane, pas d’alerte de différés');
  /* l'alerte est notée au bilan, la file continue */
  let r = demarrer(2), e = F.transition(r.etat, { type: 'lot-demarre', lotId: 'L', part: 23, at }).etat;
  e = F.transition(e, { type: 'lot-fin', lotId: 'L', motif: 'fin-normale', resume: { traites: 10, refus: 2 }, at }).etat;
  e = F.transition(e, { type: 'passe-fin', lotId: 'L', issue: 'finie', at }).etat;
  r = F.transition(e, { type: 'relecture-fin', lotId: 'L', issue: 'finie', corriges: 0, at });
  assert.equal(r.etat.etat, 'changement'); assert.deepEqual(r.etat.bilan[0].alertes.map(x => x.code), ['refus']);
});

test('aucune suite d’événements ne produit une autre action que démarrer un lot, changer de partie, revenir à la partie, arrêter, noter le registre', () => {
  const types = ['lot-demarre', 'lot-fin', 'passe-fin', 'relecture-fin', 'changement-envoye', 'changement-ok', 'changement-echec', 'lot-refuse', 'suspens', 'arreter'];
  const motifs = Object.keys(F.MOTIFS);
  let graine = 7; const hasard = n => (graine = (graine * 1103515245 + 12345) % 2147483648) % n;
  for (let essai = 0; essai < 300; essai++) {
    let e = demarrer(1 + hasard(4)).etat;
    for (let i = 0; i < 30 && e; i++) {
      const type = types[hasard(types.length)], lotId = e.partie?.lotId || 'L' + i;
      const r = F.transition(e, { type, lotId, part: e.changement?.vers ?? e.partie?.part, vers: e.changement?.vers, motif: motifs[hasard(motifs.length)],
        issue: ['finie', 'arretee', 'erreur', 'non-lancee'][hasard(4)], horsPartie: hasard(2) === 0, ecritureEnSuspens: hasard(5) === 0, at });
      for (const a of r.actions) assert.ok(ACTIONS_PERMISES.has(a.type), a.type);
      if (r.etat) assert.ok([...F.ACTIFS, ...F.TERMINAUX].includes(r.etat.etat));
      e = r.etat;
    }
  }
});
