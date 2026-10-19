'use strict';
/* JEU CAUSAL de la GCV2, seconde moitié (séparée de tests/gcv2-jeu-causal.test.cjs pour rester sous 20 s par fichier sous charge) : contre-épreuves de
 * l'essai d'invariance (ce qui est ANTÉRIEUR à la décision change bien la sortie : l'essai n'est pas vide) et mode « rezoner ». Données SYNTHÉTIQUES
 * (tests/helpers/jeu-causal-echo.cjs). Même scénario que la première moitié. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const H = require('./helpers/jeu-causal-echo.cjs');
const G = require('../tools/gcv2-jeu.cjs');

const D = 5;                                   // cut dont on juge la décision
const json = x => JSON.stringify(x);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'jeu-causal-'));
/* Scénario : 8 cuts visités dans l'ordre (cut c à 10:00 + c min, 20 s) ; les cuts impairs validés après un déplacement de 12 mm, les pairs visités sans
 * action ; le lot a posé le cut 6 (20 mm) et différé le cut 7. `modif(v)` change une visite ; `extra` : visites ajoutées ; `lot` : options du journal. */
function scenario({ modif = () => {}, extra = [], lot = { poses: { 6: { lat: 20 } }, differes: [7] } } = {}) {
  const vs = [];
  for (let c = 1; c <= 8; c++) {
    const v = { cut: c, index: c, debut: 60 * c, ref: c % 2 ? { lat: 12 } : null, depart: lot.poses[c] ? { dl: lot.poses[c].lat / 1000, dr: lot.poses[c].lat / 1000 } : {} };
    modif(v); vs.push(v);
  }
  const d = tmp();
  H.ecrireEcho(d, [...vs, ...extra]);
  const j = H.ecrireJournal(path.join(d, 'journal.json'), lot);
  const r = G.construire({ projet: 9, partie: 91, echo: [d], journaux: [j] });
  fs.rmSync(d, { recursive: true, force: true });
  return r;
}
/* Ce que la décision du cut voit : lignes du jeu des cuts ≤ D, champs d'étiquette et de comportement de l'opérateur retirés ; et les champs du cas. */
const vue = (lignes, max = D) => lignes.filter(l => l.type === 'entete' || l.cut <= max).map(l => {
  const { etiquette, micRailMm, reference, visites, ...reste } = l; return reste; });
const vueCas = (cas, max = D) => cas.filter(c => c.cut <= max).map(c => ({ cut: c.cut, ariane: c.ariane, gMed: c.gMedCausalMm, zone: c.zoneCausale, genre: c.genreLot }));

let BASE = null;
const base = () => BASE || (BASE = scenario());

test('CONTRE-ÉPREUVES : une pose de départ antérieure change la médiane du cut 5 ; une validation antérieure change la relecture, jamais le jeu lot', () => {
  const a = base();
  const b = scenario({ modif: v => { if ([1, 3, 4].includes(v.cut)) v.depart = { dl: 0, dr: 0.004 }; } });
  assert.notEqual(b.cas.find(c => c.cut === D).gMedCausalMm, a.cas.find(c => c.cut === D).gMedCausalMm, 'la médiane causale lit les cuts déjà connus');
  assert.equal(b.cas.find(c => c.cut === 7).gMedCausalMm !== a.cas.find(c => c.cut === 7).gMedCausalMm, true);
  const e = scenario({ modif: v => { if ([6, 7, 8].includes(v.cut)) v.depart = { dl: 0, dr: 0.009 }; } });
  for (let c = 1; c <= D; c++) assert.equal(e.cas.find(x => x.cut === c).gMedCausalMm, a.cas.find(x => x.cut === c).gMedCausalMm, `cut ${c} : les poses de départ des cuts suivants n'entrent pas`);
  assert.notEqual(json(vue(b.lignes)), json(vue(a.lignes)));
  const c = scenario({ modif: v => { if (v.cut === 1) v.ref = { lat: 33 }; } });
  assert.notEqual(json(vue(c.lignes)), json(vue(a.lignes)), 'relecture : une validation finie avant la visite du cut 5 est un appui');
  assert.equal(json(vue(c.lignesLot)), json(vue(a.lignesLot)), 'lot : aucun appui humain, octet pour octet');
});

test('rezoner : recalculer les zones d\'un jeu déjà construit redonne exactement la construction (zones, rôles, traits, rupture de série)', () => {
  const d = tmp(), vs = [];
  for (let c = 1; c <= 8; c++) vs.push({ cut: c, index: c, debut: 60 * c, ref: c % 2 ? { lat: 12 } : null, depart: c === 6 ? { dl: 0.02, dr: 0.02 } : {} });
  H.ecrireEcho(d, vs); const j = H.ecrireJournal(path.join(d, 'journal.json'), { poses: { 6: { lat: 20 } }, differes: [7] });
  const r = G.construire({ projet: 9, partie: 91, echo: [d], journaux: [j] });
  /* on abîme les zones et les ruptures, puis on rezone : on retrouve la construction, octet pour octet */
  const abime = ls => ls.map(l => l.type === 'cut' ? { ...l, zone: 'pn', role: 'vert', contexte: l.contexte && l.contexte.voieH6 ? { ...l.contexte, voieH6: { ...l.contexte.voieH6, tous: l.contexte.voieH6.tous && { ...l.contexte.voieH6.tous, motifs: [...l.contexte.voieH6.tous.motifs, 'rupture-de-serie'], sure: false } } } : l.contexte } : l.type === 'hyp' ? { ...l, traits: { ...l.traits, zone: 'pn' } } : l);
  const z = G.rezoner({ projet: 9, partie: 91, echo: [d], journaux: [j], cas: r.cas.map(c => ({ ...c, zoneCausale: 'pn' })), lignes: abime(r.lignes), lignesLot: abime(r.lignesLot) });
  fs.rmSync(d, { recursive: true, force: true });
  assert.equal(json(z.lignes), json(r.lignes)); assert.equal(json(z.lignesLot), json(r.lignesLot)); assert.equal(json(z.cas), json(r.cas));
});
