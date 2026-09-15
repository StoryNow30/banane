# Cerveau de placement du champignon — V1

Banc : **321 / 321**, `geometryUnchanged: true`. Le moteur reste gelé octet pour
octet ; le cerveau est un **post-traitement** (`src/brain.js`), sans dépendance,
qui ne relit ni nuage ni contour.

**Unités de scène. Ce ne sont pas des millimètres** : `physicalCalibrationStatus`
ne l'atteste pas. Toutes les valeurs ci-dessous sont ×10⁻³ unités de scène.

## Corpus et découpage

Corpus de corrections humaines : **110 cuts, 220 rails**, parts 17 et 20.

| bloc | part | rails | rôle |
|---|---:|---:|---|
| développement | 20 | 168 | tout l'ajustement et tous les seuils |
| réservé | 17 | 52 | **une seule évaluation, réglages déjà figés** |

Les blocs sont des **parts entières**, pas des cuts tirés au hasard : deux cuts
voisins partagent la même voie et souvent le même geste. Un tirage aléatoire
aurait fait fuir l'information d'un bloc à l'autre.

## Ce que fait le cerveau

### 1. Il retire un biais vertical systématique

Sur les 173 rails où le moteur propose, l'humain place systématiquement plus
haut :

| résidu (humain − moteur) | moyenne | écart-type | rapport |
|---|---:|---:|---:|
| **vertical** | **+4,28** | 3,20 | **1,34** |
| latéral | −0,82 | 12,73 | 0,06 |

Le vertical domine sa propre dispersion → c'est un biais. Le latéral non → c'est
du bruit. **La règle d'ajustement rejette d'elle-même le latéral** (`|moyenne| /
écart-type ≥ 1`), elle n'est pas écrite à la main.

Le biais se retrouve dans les deux blocs séparément — part 17 : +3,52 ;
part 20 : +4,55 — et des deux côtés — gauche +4,66 ; droite +3,94.

### 2. Il tranche entre les candidats que le moteur expose déjà

Quand le moteur s'abstient pour « plusieurs placements concurrents », il a
pourtant produit trois positions : graine fine, intersection des surfaces,
meilleure alternative de grille grossière. Sur le développement, **la bonne
réponse est presque toujours parmi elles** — meilleur des trois : médiane 4,03,
29 sur 33 sous 10 — mais le moteur ne sait pas laquelle.

Le cerveau tranche par le **dévers** : le geste vertical humain est corrélé entre
les deux files (r = 0,46 ; écart gauche−droite 0,94 ± 9,67). Il retient le
candidat dont le vertical s'accorde avec le rail opposé résolu.

Le cerveau **n'invente aucun candidat**.

## Résultats

| mesure | développement (part 20) | **réservé (part 17)** |
|---|---:|---:|
| rails | 168 | 52 |
| propositions avant → après | 127 → 141 | 46 → 49 |
| erreur médiane avant | 5,20 | **4,24** |
| erreur médiane après | 3,06 | **2,77** |
| p90 avant → après | 9,66 → 7,15 | 6,40 → 5,24 |
| améliorés / dégradés | 93 / 34 | 32 / 14 |
| sélections | 14 | 3 |

Sur le bloc réservé, avec des réglages ajustés ailleurs : **erreur médiane
−35 %**, p90 −18 %, et 3 rails passent de « sans proposition » à « proposition »
(erreurs 3,72 / 3,29 / 2,26).

Témoin : ne rien déplacer donne une erreur médiane de 16,97. Le moteur seul fait
déjà 3,5 fois mieux ; le cerveau ajoute un tiers par-dessus.

## Ce qu'il ne faut PAS en conclure

- **14 rails sur 46 sont dégradés** par la correction de biais sur le bloc
  réservé. Le gain est sur la médiane et la moyenne, pas sur chaque rail.
- **Le sélecteur n'est pas fiable.** Sur le développement, **2 des 14 sélections
  étaient fausses de ~82** malgré les garde-fous — environ une sur sept. Le bloc
  réservé n'en a produit que 3, trop peu pour conclure quoi que ce soit sur sa
  fiabilité. Le chiffre honnête reste celui du développement.
- **Un seul bloc réservé, 52 rails, une seule part.** Ce n'est pas une
  validation large.
- Deux parts seulement (17 et 20), un seul type de profil (U50). Rien ne dit que
  le biais vaut ailleurs.

## Conséquence : une sélection n'est jamais appliquée seule

`src/engine.js` est gelé — le pilote ne peut pas être modifié. La sûreté vient
donc de ce que le cerveau **émet** : une sélection porte `confidence: 0` et
`confidenceStatus: 'non-calibrée-pour-la-sélection'`, ce qui déclenche la pause
du pilote quel que soit `minConfidence`. Une sélection est donc une piste
proposée en mode assisté, où l'opérateur la voit et tranche.

Verrouillé par `tests/brain.test.cjs` (19 tests), qui vérifie aussi qu'aucune
valeur de la correction humaine n'apparaît dans les entrées du cerveau.

## Une piste essayée et abandonnée

Un estimateur « physique » direct — ramener le contour sur les médianes du nuage
par bande (table, flanc actif) — donne une erreur médiane de **173** contre 5,20
pour le moteur. Les médianes du nuage sont dominées par des points loin de la
tête. Abandonné, et consigné ici pour que personne ne le retente en croyant à une
idée neuve.

## Reproduire

```bash
node tools/brain-dataset.cjs CHEMIN/banane-corrections-*.json --out jeu.json
node tools/brain-fit.cjs --input jeu.json --dev 20 --reserve 17 --out audit/brain-fit-v1.json
node --test tests/brain.test.cjs
```

## Ce qui manque pour aller plus loin

1. **D'autres parts.** Deux blocs ne permettent pas de dire si le biais est
   universel ou propre à ces voies.
2. **Un sélecteur fiable.** Il faudrait un signal qui sépare les bons choix des
   mauvais. Sur le développement, `nFace` les sépare partiellement — 40,6 points
   de flanc pour les bons contre 24,2 pour les mauvais — mais 26 lignes ne
   suffisent pas à en faire une règle.
3. **La calibration physique.** Tant qu'elle n'est pas attestée, aucun de ces
   chiffres ne peut être annoncé en millimètres.
