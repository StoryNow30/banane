# Candidate Generation Diagnostics V1

Lot hors ligne, **lecture seule**. `G.propose` n'est pas modifié ni
réimplémenté : il est appelé sans options et on lit ce qu'il **retourne**. Aucun
seuil, aucune règle, aucun correctif, aucun classifieur. Unités de scène, jamais
des millimètres ; `0,010` reste une convention d'évaluation de banc.

## L'instrumentation est déjà dans le moteur

`src/geometry.js` renvoie un message **distinct par point de sortie**. Ces
messages *sont* l'instrumentation : le banc les lit tels quels et **ne regroupe
pas** plusieurs causes sous un vague « no-candidate ». Chaque motif de la table
`EXIT_STAGES` est vérifié mot pour mot contre le source, et un test échoue si le
moteur gagne une sortie que la table ignore.

Deux sorties portent des messages **joints** : la branche `unsupported` en
concatène jusqu'à trois, et l'ambiguïté de gabarit suit. Les ranger en
« inconnu » aurait été exactement le regroupement à éviter — elles ont leurs
étapes propres, `appuis-manquants` et `ambiguite-gabarit`, toutes deux **après**
la construction des métriques, donc avec les trois familles déjà existantes.

| étape | rails |
|---|---:|
| `appuis-manquants` | 350 |
| `ajustement-post-recherche` | **64** |
| `ambiguite-gabarit` | 2 |

## 1. Les 64 `no-candidate` — cause par cause

| motif exact | rails | étape | ce que le moteur avait déjà fait |
|---|---:|---|---|
| `Plan de roulement non estimable.` | **63** | `ajustement-post-recherche` | **recherche de gabarit TERMINÉE** |
| `Intersection hors de la fenêtre expérimentale.` | **1** | `ajustement-post-recherche` | recherche + plan de roulement |

**Les 64 sortent après la recherche, sans exception.** Aucun à l'entrée, aucun au
filtrage de ROI, aucun au contour.

Le mécanisme exact, à `src/geometry.js:78-80` : la recherche a **convergé** sur un
placement, puis la bande du plan de roulement **autour de ce placement** contient
moins de 3 points, et `robustLine` rend `null`. Le moteur a donc choisi un
placement là où il n'y a pas de plan de roulement.

À cet abandon, `propose` ne renvoie ni `metrics`, ni `top`, ni `face` : le
placement interne n'est **pas observable**. Le banc le dit — `builtBeforeGivingUp`
vaut `null` partout — plutôt que de le reconstituer.

## 2. Concentration : trois sessions portent 62 des 64

| session | `no-candidate` | rails réussis | taux d'échec |
|---|---:|---:|---:|
| `3876864f…` | **17** | **0** | **100 %** |
| `d9ccb545…` | **35** | 19 | **64,8 %** |
| `0c58c033…` | **10** | 40 | **20,0 %** |
| `f938b9f8…` | 1 | 42 | 2,3 % |
| `92dbb85e…` | 1 | 31 | 3,1 % |
| 4 autres sessions | 0 | 44 | **0 %** |

**Ce n'est pas général.** Une session n'a produit **aucun** candidat sur ses 17
rails éligibles ; les six sessions saines restent sous 3,2 %.

Autres axes :

| axe | `no-candidate` |
|---|---|
| côté | **droite 58 · gauche 6** — alors que les réussites penchent à **gauche 120 · droite 56** |
| part | 1 : 53 · 2 : 10 · 8 : 1 |
| plage de cuts | 228 – 9 656, **non concentrée** |
| nœuds sources | `visibleNodes[].sceneNode.geometry` — **identique à 100 %** |
| chunks par rail | 1 : 54 · 2 : 10 |
| `lidarStatus` | `partial-interrupted` 50 · `not-captured` 7 · `partial-resource-limit` 7 |

Le biais de côté est **réel** et non un effet de population : les réussites
penchent dans l'autre sens.

## 3. Ce n'est ni l'entrée, ni le ROI

| grandeur | `no-candidate` (n=64) | rails réussis (n=176) |
|---|---|---|
| points fournis (médiane) | **1 506** | 1 709 |
| points en ROI, compteurs de la collecte (médiane) | 832 | — |
| points en ROI utile moteur (médiane) | **72** | 79 |
| minimum de ROI utile atteint | **64 / 64** | — |
| visibilité de découpe inconnue | **0 / 64** | — |
| sommets de contour (médiane) | **625** | — |

Les points sont **abondants et du même ordre** que sur les rails qui réussissent ;
tous franchissent le minimum de ROI utile exigé par la collecte ; aucun contour
n'est dégénéré ; aucune découpe n'est incertaine.

**L'échec se situe donc dans l'ajustement géométrique après la recherche de
gabarit**, pas à la capture, pas au ROI, pas au contour.

## 4. Les 45 `flank-only` sans candidat satisfaisant

### L'ancien découpage V1 était insuffisant — supersédé

Le premier diagnostic concluait à une « génération impossible » dès que

```
|humanY| > searchY  ||  |humanZ| > searchZ
```

**Cela ne prouve rien.** Le moteur possède plusieurs domaines, et `0,010` est une
convention de **satisfaction**, pas une appartenance au domaine :

| famille | domaine réellement atteignable | d'où il vient dans `geometry.js` |
|---|---|---|
| coarse / alternative | ±0,080 · ±0,040 | `search(0,0,searchY,searchZ,grid,true)` |
| seed | ±0,084 · ±0,044 | raffinement `search(best.u,best.z,.004,.004,.001)` |
| **surfaceIntersection** | **±0,090 · ±0,050** | `|surfaceU| ≤ searchY+.01`, `|surfaceZ| ≤ searchZ+.01` |

Les marges `.004` et `.01` sont **citées** depuis le moteur ; aucune borne n'est
modifiée ni proposée.

**L'ancien compteur `hors-fenetre-de-recherche` = 25 vaut donc uniquement comme
diagnostic V1**, et il est publié dans l'artefact sous `supersededDiagnostic`.

### La preuve conservatrice

Un cas n'est `generation-unreachable-by-bounds` que si, en donnant au moteur
**l'enveloppe la plus permissive que son propre code autorise**, la distance de
la référence humaine à ce domaine reste **strictement** supérieure à 0,010.

La distance inclut la composante **x** : tous les candidats du moteur ont
`x = 0` — sa recherche est bidimensionnelle — donc un écart humain en x compte
intégralement. L'omettre surestimerait l'accessibilité.

```
d = hypot( |hx| , max(0, |hy| − boundY) , max(0, |hz| − boundZ) )
```

### Nouveau découpage, correctement prouvé

| classe | rails | historique | final | distance au domaine le plus permissif |
|---|---:|---:|---:|---|
| **`generation-unreachable-by-bounds`** | **21** | 11 | 10 | min 10,81 · méd 17,02 · max 84,79 ×10⁻³ |
| **`outside-nominal-window-but-not-proven-unreachable`** | **4** | 1 | 3 | min 5,43 · méd 7,59 · max 7,98 ×10⁻³ |
| `familles-divergentes-toutes-fausses` | 20 | 13 | 7 | 0 — toutes dans le domaine grossier |
| `famille-absente` | 0 | — | — | — |
| `candidats-concordants-tous-faux` | 0 | — | — | — |
| `correction-humaine-ambigue` | 0 *(voir l'angle mort)* | — | — | — |

**Les 25 anciens se redistribuent exactement : 21 + 4.** Quatre cas sortaient des
bornes nominales mais restaient à **5,43–7,98×10⁻³** d'un domaine atteignable :
les appeler « génération impossible » était faux.

Pour les 21 prouvés, le domaine le plus permissif est **toujours**
`surfaceIntersection`, et la preuve est **recalculable depuis la seule référence
humaine** — vérifié par test, avec les quatre distances par famille publiées, pas
seulement la meilleure.

### Cas de frontière vérifiés

| cas synthétique | hors bornes nominales | prouvé impossible |
|---|---|---|
| juste au-delà de `searchY`, atteignable au seed raffiné | oui | **non** |
| hors coarse, dans l'enveloppe `surfaceIntersection` | oui | **non** |
| hors de tout domaine mais à moins de 0,010 | oui | **non** |
| au-delà de 0,010 de tout domaine permissif | oui | **oui** |
| pile à 0,010 *(dépassement strict exigé)* | oui | **non** |
| écart en **x** seul, y et z dans les bornes | **non** | **oui** |

Le dernier cas est celui que le découpage V1 ne pouvait pas voir : il ne
regardait que y et z. Il ne se présente pas dans ce corpus — 0 rail sur 45 — mais
la logique le traite.

### Angle mort à ne pas prendre pour un résultat

Le détecteur de correction humaine ambiguë ne voit que les visites **rejouables**.
Le cut **1/2891**, dont les deux références humaines droites divergent de
9,851×10⁻³, lui **échappe** parce que sa seconde visite est `excluded`. Le
comptage à zéro signifie donc « aucune contradiction **détectable ici** », et
non « aucune contradiction n'existe ». Le champ `knownBlindSpot` de l'artefact
le dit, et un test l'impose.

## 5. Ce qui doit être réglé avant toute politique Flank Recovery

Constats, pas recommandations de valeurs — aucun seuil n'est proposé.

1. **L'ajustement post-recherche est le vrai point faible.** 64 rails perdent
   leurs trois familles alors que les points sont abondants. Tant que la
   recherche peut converger là où il n'y a pas de plan de roulement, une
   politique de récupération n'aura simplement **rien** à arbitrer sur ces rails.
2. **Une session à 100 % d'échec n'est pas un bruit de fond.** `3876864f…` n'a
   produit aucun candidat. Il faut savoir ce que cette session a de particulier
   avant de mesurer quoi que ce soit sur elle.
3. **Le biais droite/gauche est inversé entre échecs et réussites.** Il doit être
   expliqué : une asymétrie non comprise contaminerait toute statistique de paire.
4. **21 corrections humaines sont hors d'atteinte, preuve à l'appui.** Aucune
   politique bâtie sur les candidats exposés ne les atteindra : c'est un sujet de
   génération, pas d'arbitrage. Quatre autres sortent des bornes nominales sans
   être hors d'atteinte — elles relèvent de la qualité de placement, et les
   confondre avec les précédentes fausserait le dimensionnement du problème.
5. **Les contradictions humaines ne sont pas toutes visibles.** Le détecteur a un
   angle mort documenté ; la qualification des références doit être traitée avant
   de leur faire porter une évaluation de politique.

## Artefacts

- `tools/candidate-generation-diagnostics.cjs` ;
- `audit/candidate-generation-diagnostics-v1.json`, format
  `banane-candidate-generation-diagnostics-v1` — une ligne par rail
  `no-candidate` et par rail `flank-only` insatisfait ;
- `tests/candidate-generation-diagnostics.test.cjs` — **17 tests**.

Empreinte du contenu, horodatage exclu :
`fd9004413836b986627b94d065f6a67f233ca14a81a562975d8525d2f8f1be7f`.

```bash
node tools/candidate-generation-diagnostics.cjs \
  --corpus historical-original <dossier-679> \
  --corpus final-complementary <dossier-1486> \
  --output audit/candidate-generation-diagnostics-v1.json
node --test tests/candidate-generation-diagnostics.test.cjs
```
