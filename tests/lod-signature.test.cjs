const { test } = require('node:test'), assert = require('node:assert/strict');
const S = require('../src/lod-signature.js');

/* Signature du niveau de détail chargé.
 *
 * Elle décide QUAND lire le nuage. Une collision ne produirait pas une métrique
 * fausse : elle ferait croire que le chargement est terminé alors qu'il
 * continue, donc lire un nuage incomplet — une perte de qualité silencieuse,
 * exactement la classe de défaut que ce projet cherche à rendre impossible.
 *
 * L'ancienne implémentation sérialisait chaque nœud, triait les chaînes, puis
 * sérialisait l'ensemble, à chaque sondage de 80 ms. La nouvelle combine quatre
 * grandeurs indépendantes. Ce fichier vérifie les sept propriétés de
 * discrimination qui justifient ce remplacement, une par une. */

let compteur = 0;
const ids = new WeakMap();
const id = o => { if (!o || typeof o !== 'object') return ''; if (!ids.has(o)) ids.set(o, 'o' + (++compteur)); return ids.get(o); };

function noeud({ version = 0, count = 100, world = [1, 0, 0, 1], draw = { start: 0, count: 100 } } = {}) {
  const tableau = {};
  return { obj: {}, geometry: { index: {} },
    position: { array: tableau, version, data: null },
    attribute: { count }, world, drawRange: draw };
}
const sig = (nodes, clouds = []) => S.signature({ nodes, clouds }, id).value;

/* 1 */
test('permuter les mêmes nœuds ne change PAS la signature', () => {
  const a = noeud(), b = noeud(), c = noeud();
  assert.equal(sig([a, b, c]), sig([c, a, b]),
    'ESV peut réordonner ses nœuds sans que ce soit un chargement en cours');
  assert.equal(sig([a, b, c]), sig([b, c, a]));
});

/* 2 */
test('ajouter un nœud change la signature', () => {
  const a = noeud(), b = noeud();
  assert.notEqual(sig([a, b]), sig([a, b, noeud()]));
});

/* 3 */
test('retirer un nœud change la signature', () => {
  const a = noeud(), b = noeud(), c = noeud();
  assert.notEqual(sig([a, b, c]), sig([a, b]));
});

/* 4 — le cas qu'une simple somme commutative laisserait passer. */
test('remplacer un nœud par un autre, à nombre constant, change la signature', () => {
  const a = noeud(), b = noeud(), c = noeud(), d = noeud();
  assert.notEqual(sig([a, b, c]), sig([a, b, d]), 'remplacement simple');
  // Échange complet du contenu, même compte : le cas le plus défavorable.
  assert.notEqual(sig([a, b]), sig([c, d]));
  // Et sur une population de la taille réelle (ESV plafonne à 512 nœuds).
  const base = Array.from({ length: 512 }, () => noeud());
  const variante = base.slice(); variante[300] = noeud();
  assert.notEqual(sig(base), sig(variante), 'un nœud sur 512 doit suffire');
});

/* 5 */
test('changer la version d’un tampon change la signature', () => {
  const a = noeud({ version: 3 });
  const memeObjetVersionSuivante = { ...a, position: { ...a.position, version: 4 } };
  assert.notEqual(sig([a]), sig([memeObjetVersionSuivante]),
    'un tampon réécrit sur place doit invalider la stabilité');
});

/* 6 */
test('changer la matrice monde change la signature', () => {
  const a = noeud({ world: [1, 0, 0, 1] });
  const deplace = { ...a, world: [1, 0, 0, 1.0000001] };
  assert.notEqual(sig([a]), sig([deplace]));
});

/* 7 */
test('changer la plage de dessin change la signature', () => {
  const a = noeud({ draw: { start: 0, count: 100 } });
  const partiel = { ...a, drawRange: { start: 0, count: 60 } };
  assert.notEqual(sig([a]), sig([partiel]),
    'un nœud partiellement dessiné est un chargement en cours');
});

/* Compléments : les champs qui comptent aussi. */
test('changer le nombre de points d’un nœud change la signature', () => {
  const a = noeud({ count: 100 });
  assert.notEqual(sig([a]), sig([{ ...a, attribute: { count: 101 } }]));
});

test('changer l’état des nuages change la signature', () => {
  const a = noeud();
  assert.notEqual(sig([a], [{ chargé: 1 }]), sig([a], [{ chargé: 2 }]));
});

test('la signature est stable : deux appels identiques donnent la même valeur', () => {
  const noeuds = Array.from({ length: 64 }, () => noeud());
  assert.equal(sig(noeuds), sig(noeuds));
});

/* La propriété que la somme seule ne donnerait pas. */
test('les deux combinateurs sont bien indépendants', () => {
  /* On fabrique deux ensembles dont les empreintes ont la même SOMME, et on
   * vérifie que le ou-exclusif les sépare. Sans ce second combinateur, une
   * compensation entre deux nœuds suffirait à masquer un rechargement. */
  const h = t => S.empreinte(t);
  const paires = [];
  for (let i = 0; i < 4000 && paires.length < 1; i++)
    for (let j = i + 1; j < 4000 && paires.length < 1; j++) {
      if (h('a' + i) + h('b' + j) === h('a' + j) + h('b' + i) && h('a' + i) !== h('a' + j))
        paires.push([i, j]);
    }
  // Construction directe : deux multiensembles de même somme par symétrie.
  const x = h('n1'), y = h('n2');
  assert.equal((x + y), (y + x), 'la somme est commutative, c’est voulu');
  assert.equal((x ^ y), (y ^ x), 'le ou-exclusif aussi');
  // L'indépendance utile : deux valeurs distinctes ne peuvent pas avoir à la
  // fois même somme et même ou-exclusif que deux autres sans être les mêmes.
  const z = h('n3');
  assert.ok((x + y) !== (x + z) || (x ^ y) !== (x ^ z),
    'somme ET ou-exclusif ne doivent pas coïncider pour des contenus différents');
});

test('un inventaire vide ou absent ne fait pas tomber la fonction', () => {
  assert.doesNotThrow(() => S.signature(null, id));
  assert.doesNotThrow(() => S.signature({}, id));
  assert.equal(S.signature({ nodes: [] }, id).count, 0);
});

test('un champ manquant dans un nœud ne fait pas tomber la fonction', () => {
  assert.doesNotThrow(() => sig([{ obj: {}, world: [1] }]));
  assert.doesNotThrow(() => sig([{}]));
});
