# Running Surface Failure Lab V1

Lot hors ligne, **lecture seule**, branche `lab-running-surface-failure-v1`,
partie de `3256d8b`. Aucun runtime, `geometry.js`, moteur, Brain, Pair
Arbitration, seuil, DEFAULT ou politique n'est modifié. **Aucune correction n'est
proposée, aucun seuil ni rayon n'est choisi, aucune hypothèse n'est adoptée.**

**Question unique.** Pourquoi la recherche choisit-elle un placement `best`
autour duquel moins de trois points permettent ensuite d'estimer le plan de
roulement ?

## Le traceur — instrumentation secondaire, vérifiée

`G.propose` n'expose pas `best` quand il abandonne avant ses métriques. Un
traceur hors ligne rejoue donc les étapes internes. Il n'est **jamais** traité
comme le moteur : il appelle directement `G.median`, `G.robustLine` et
`C.point`, et ne reproduit que ce que le moteur n'exporte pas — filtrage local,
ancres, fonction de perte, boucles de recherche. L'accumulation flottante
`u += step` est reproduite telle quelle : la remplacer par `u₀ + i·step`
donnerait une grille différente au dernier bit.

| vérification | valeur |
|---|---:|
| rails confrontés | **239** |
| contrôles exécutés | **2 527** |
| rails où le moteur publie ses métriques | 176 |
| **divergences inexpliquées** | **0** |

Les contrôles portent sur : motif de sortie, points locaux retenus, ancres,
coarse best, refined best, seed, `lossRatio`, alternative, `topRows`, résidu et
pente du plan de roulement. **Toute divergence fait échouer le banc** — le
programme sort en code 1 et un test l'exige.

## Populations

| cohorte | rails | définition |
|---|---:|---|
| échec | **63** | sortie exactement `Plan de roulement non estimable.` |
| témoin | **176** | `G.propose` atteint normalement un candidat |

Le 64ᵉ `no-candidate` sort ailleurs (`Intersection hors de la fenêtre
expérimentale.`) : il est **hors** de cette population, pas absorbé en silence.
Les témoins servent **descriptivement** — aucun classifieur, aucun seuil appris.

## Échec contre témoin — la comparaison qui tranche

| grandeur (médiane) | échec | témoin |
|---|---:|---:|
| points locaux retenus | **71** | 75 |
| ancres de dessus / de flanc | 7 / 5 | 7 / 5 |
| largeur de tête | 0,0640 | 0,0640 |
| **`topRows` au refined best** | **0** | **41** |
| **fraction de la grille offrant ≥ 3 lignes** | **0,000** | **0,272** |
| perte du refined best | 0,0007 | 0,0000 |
| `best.z` retenu | **−0,0430** | −0,0030 |
| `best.z ≤ −0,040` | **38 / 63** | **0 / 176** |
| coarse collé à la borne en z | **39 / 63** | **0 / 176** |
| z médian du nuage local | **+0,0069** | −0,0068 |
| **écart z (nuage − placement)** | **+0,0429** | −0,0042 |

`topBand` vaut **0,012**. L'écart médian des échecs vaut donc **3,6 fois la
bande** ; celui des témoins reste **dedans**.

**L'entrée n'est pas en cause** : autant de points locaux, mêmes ancres, même
largeur de tête. Le contour est reconnu normalement.

## Réponses aux neuf questions

**1. Un même mécanisme, ou plusieurs ?** — **Un mécanisme dominant, et deux
marges.**

| famille | rails |
|---|---:|
| **`aucun-support-nulle-part-sur-la-grille`** | **56** |
| `support-ailleurs-mais-perte-nettement-superieure` | 5 |
| `raffinement-a-quitte-le-support` | 2 |

Dans **56 cas sur 63**, il n'existe **aucun** placement, sur toute la grille de
recherche, offrant ≥ 3 lignes. La question « la recherche a-t-elle mal choisi »
ne se pose donc même pas : il n'y avait rien à choisir.

**2. Le coarse best a-t-il parfois assez de support alors que le refined le
perd ?** — **Oui, mais 2 fois sur 63.** C'est réel et reproductible, ce n'est pas
le mécanisme principal.

**3. Existe-t-il généralement un placement voisin avec `topRows ≥ 3` ?** —
**Non : 7 sur 63** (11 %). Dans 56 cas, aucun.

**4. Quelle différence de perte l'en sépare ?** — Pour ces 7 : distance médiane
**0,0041**, écart de perte médian **4,3×10⁻⁵**, **ratio médian 1,51**
(min 1,12 · max 2,83). Le meilleur placement supporté coûte au mieux **1,09×** la
perte du best. **Aucun** voisin supporté n'est à perte quasi égale — le compteur
`voisin-supporte-a-perte-quasi-egale` vaut **0**.

**5. La recherche optimise-t-elle un minimum incompatible avec la condition de
support ?** — Dans **56 cas la question est vide** : aucun placement compatible
n'existe. Dans les **7** restants, oui, il en existe un, mais **strictement plus
coûteux**. La fonction de perte et la condition finale portent donc bien sur des
objets différents — mais ce désaccord n'est pas la cause majoritaire.

**6. Pourquoi la droite est-elle surreprésentée ?** — **Ce n'est pas un bug de
signe, et il y a preuve directe.** `sign` suit le côté de façon parfaitement
régulière dans les deux cohortes : gauche → +1, droite → −1, sans exception sur
239 rails. Surtout, **56 rails droits réussissent avec ce même signe −1** : une
arithmétique fautive ne produirait pas 56 succès. Le traceur n'a par ailleurs
aucun branchement sur le côté — un seul chemin de code, vérifié par test.
L'asymétrie est donc une propriété de la **population observée**, pas du calcul :
les captures défaillantes se trouvent massivement du côté droit, dans trois
sessions et une grappe de cuts.

**7. Qu'est-ce qui distingue `3876864f…` ?** — Elle est la **seule session en
échec total** : **17 échecs, 0 candidat**. Les autres sessions produisent des
candidats normalement (`f938b9f8` 42, `0c58c033` 40, `92dbb85e` 31…). Sur ses
rails, le z médian du nuage local vaut **+0,0099** contre **≈ −0,007** partout où
le moteur fonctionne. Le même décalage vertical s'observe sur `d9ccb545`
(**+0,0069** en échec contre **−0,0068** en témoin **dans la même session**) :
le phénomène n'est donc pas « une session cassée », mais **des captures
décalées**, denses dans certaines sessions.

**8. Familles reproductibles ?** — **Oui, trois**, celles du tableau ci-dessus,
calculées sans aucune valeur humaine et recalculables depuis l'artefact seul
(vérifié par test). La grappe **part 1 / rail droit / cuts 5083–5276** compte
**50 échecs, tous** `aucun-support-nulle-part-sur-la-grille`.

**9. Premier prototype géométrique expérimental ?** — Le mécanisme à étudier
est :

> **l'accord vertical entre le nuage LiDAR observé et la pose de profil sur
> laquelle le gabarit est ancré.**

C'est lui, et lui seul, qui rend la bande du plan de roulement vide : le nuage se
trouve au-dessus du placement d'environ 0,043 en médiane, la recherche descend
jusqu'à la borne basse de sa fenêtre sans jamais le rejoindre, et la condition
finale de support ne peut plus être satisfaite nulle part. **Aucune valeur
nouvelle n'est proposée** — ni pour `topBand`, ni pour `searchZ`, ni pour aucun
autre paramètre.

## Hypothèses testées — compatibilités, jamais des conclusions

| hypothèse | cas compatibles |
|---|---:|
| `aucun-placement-supporte-sur-toute-la-grille` | **56** |
| `minima-concurrents` | 56 |
| `best-colle-a-une-borne-de-recherche` | 49 |
| `minimum-dans-zone-sans-support-superieur` | 7 |
| `raffinement-quitte-une-zone-supportee` | 2 |
| `voisin-supporte-a-perte-quasi-egale` | **0** |

Un drapeau vrai signale une **compatibilité observée**, pas une cause établie.

## Tranche dégradée et référence humaine

Les **63** échecs sont **causalement admissibles**. Les 10 de la session
`0c58c033…` sont tous `before-last-lossless-snapshot`. **La tranche tardive
dégradée n'explique rien** — confirmé, pas supposé.

La référence humaine n'entre que dans `postHocEvaluation`. Constat utile :
**aucun** des 63 seeds reconstitués par le traceur n'aurait été satisfaisant
(0 / 63 sous la convention d'évaluation). Ces échecs ne sont donc **pas** un
simple problème de publication : le placement interne était lui aussi faux.

## Limites

- Le traceur reste une **instrumentation secondaire**. Il concorde avec le moteur
  sur tout ce que celui-ci publie, mais sur les 63 rails d'échec le moteur ne
  publie **rien** au-delà du motif de sortie : la concordance y est vérifiée sur
  ce seul motif, et sur les 176 témoins pour tout le reste.
- La grappe de cuts, le côté et les sessions sont **corrélés** : ce lot ne les
  sépare pas, et ne peut donc pas attribuer l'asymétrie à l'un plutôt qu'à l'autre.
- Le ratio 1,05 qui sépare deux familles est une **convention de description du
  banc**, publiée comme telle : ce n'est ni un paramètre moteur ni une valeur
  proposée.
- La cause physique du décalage vertical n'est **pas** établie ici. Les notes
  opérateur mentionnent des décorrélations de scan ; ce lot mesure le décalage,
  il ne l'explique pas.

## Artefacts

- `tools/running-surface-failure-lab.cjs` ;
- `audit/running-surface-failure-lab-v1.json` — une ligne par rail, blocs
  séparés `engineObserved`, `diagnosticTrace`, `localSupportLandscape`,
  `sessionSideContext`, `degradationContext`, `postHocEvaluation` ;
- `tests/running-surface-failure-lab.test.cjs` — 20 tests.

Empreinte du contenu, horodatage exclu :
`7bec521ab069d09ba5aa6b6937e85653fd271320b9fb3007ab39146961a82183`.

```bash
node tools/running-surface-failure-lab.cjs \
  --corpus historical-original <dossier-679> \
  --corpus final-complementary <dossier-1486> \
  --output audit/running-surface-failure-lab-v1.json
node --test tests/running-surface-failure-lab.test.cjs
node tools/verify.cjs
```
