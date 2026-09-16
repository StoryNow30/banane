# Lot « arbitrage de paire » — laboratoire hors ligne

**Ceci est un laboratoire reproductible, pas une implémentation de production.**
Aucun fichier métier n'est touché : ni `src/geometry.js`, ni le cerveau, ni les
seuils du moteur, ni le runtime, ni la génération de candidats. Ce lot ajoute
seulement `tools/pair-lab.cjs`, ses tests et ce rapport. Aucune politique n'est
activée nulle part, et **aucun paramètre n'est retenu**.

```bash
node tools/pair-lab.cjs --output audit/pair-arbitration-lab-v1.json
node --test tests/pair-lab.test.cjs
```

**Unités.** Unités de scène, `physicalCalibrationStatus:
not-independently-verified`, affichées ×10⁻³. **Jamais converties en
millimètres.** La « relation de paire » est la distance entre les origines de
profil gauche et droite — **pas** un écartement de voie physique. **Aucune cible
fixe** : toute référence est estimée sur les données de la part elle-même.

---

## Addendum de réconciliation avec l'audit indépendant

### 1. 3×3 et non 2×2 — mon premier banc était incomplet

Ce que le corpus contient réellement, par rail, vérifié sur les 220 rails :

| champ | dimension | rails |
|---|---:|---:|
| `metrics.seed` | 2 | 220 |
| `metrics.surfaceIntersection` | 2 | 220 |
| `templateAmbiguity.alternative` | 2 | 220 |
| `proposal.delta` | 3 | 173 |

`surfaceIntersection` est distinct de la graine sur **219 rails sur 220**
(médiane 2.17 en y). `proposal.delta` n'existe que pour les 173 rails résolus —
soit 220 − 47.

**Mon premier banc n'utilisait que deux candidats par rail** : `proposal.delta`
(ou la graine à défaut) et l'alternative, soit 4 combinaisons. Il **ignorait
`metrics.surfaceIntersection`**. C'est une omission de ma part, pas une
divergence de données. Le décompte juste est celui de l'audit indépendant :
**3 candidats par rail, 9 combinaisons par cut**.

**Ce qui est reconstruit, et pourquoi ce n'est pas une invention.** Les trois
placements sont des couples (y, z) ; le banc les assemble en (0, y, z) pour les
comparer au delta 3D. La composante x de **tous** les deltas réellement produits
par le corpus vaut **exactement zéro** — la recherche du moteur est
bidimensionnelle. Verrouillé par test. Aucun autre candidat n'est fabriqué :
pas d'interpolation, pas de symétrisation, pas de nouvelle recherche.

### 2. Abstentions — 42 cuts, 47 rails

Mon rapport précédent écrivait « 47 abstentions » en parlant de **rails**.
Formulation ambiguë, corrigée. Les deux chiffres sont justes et comptent des
choses différentes :

| | |
|---|---:|
| rails en abstention | **47** sur 220 |
| cuts avec au moins un rail en abstention | **42** (part 17 : 5 · part 20 : 37) |
| dont un seul rail abstenu | 37 |
| dont les deux rails abstenus | 5 |

Contrôle : 37 + 2 × 5 = 47 rails. Le Pair Lab compte des cuts ; les deux bancs
sont d'accord.

### 3. Reproduction des chiffres de l'audit indépendant

À la convention d'évaluation de l'oracle (10 × 10⁻³), verrouillée par test :

| | audit indépendant | ce banc |
|---|---|---|
| part 17 récupérables | 26/26 | **26/26** |
| part 20 récupérables | 78/84 | **78/84** |
| non récupérables | 485, 1512, 1664, 1665, 3908, 3909 | **identiques** |
| abstentions part 20 récupérables | 31/37 | **31/37** |
| mauvais choix matériels part 20 | 1, 1422, 4568, 5123, 6576, 9041, 9044 | **identiques** |

Les sept mauvais choix avaient **tous** une bonne combinaison déjà exposée.

> La convention 10 × 10⁻³ est une métrique d'**évaluation de l'oracle**. Ce
> n'est pas un seuil de production et elle n'entre dans aucune décision du banc.

### 4. Étanchéité — vérifiée mécaniquement, pas affirmée

**Aucune valeur humaine dans la décision.** Le test efface entièrement la
référence humaine du jeu, rejoue la politique, et exige des décisions
identiques. Si l'ancre ou la porte lisaient une valeur humaine, ce test
tomberait. Les fonctions `settled`, `anchorFor`, `decide` ne référencent aucun
champ humain ; la référence n'entre que dans `measure`, après coup.

**Cuts réservés 9031–9047.** Ils sont exclus du socle d'ancrage et du balayage.
Le test vérifie qu'en les retirant entièrement du jeu, l'ancre de chaque part
est **inchangée** — preuve qu'ils n'y contribuent pas. Le balayage ne compte que
les 93 cuts hors réserve.

**K n'est pas choisi.** Le balayage complet est livré ; aucune valeur n'a été
retenue, et aucune n'a été arrêtée au vu des cuts réservés. Le réglage relève de
la revue.

---

## Ce que montrent les données

### Causes d'abstention

47 rails, 21 % :

| n | motif |
|---:|---|
| 37 | Plusieurs placements concurrents du champignon sont géométriquement plausibles |
| 7 | Grand déplacement isolé : le second rail ne confirme pas ce placement |
| 3 | flanc interne insuffisamment observé / inclinaison hors domaine |

`lossRatio` médian : **1.25** en abstention, **20.89** en résolution. Les 7
« le second rail ne confirme pas » montrent que le moteur possède déjà une
notion de paire, mais s'en sert uniquement pour **refuser**, jamais pour
**départager**.

### Deux échelles disjointes

| écart latéral entre candidats | médiane | extrêmes |
|---|---:|---|
| intra-famille (surface vs graine) | 2.17 | p90 5.13, max 16.20 |
| inter-famille (alternative vs graine) | 42.50 | p10 16.90, min 4.00 |

**La relation de paire peut trancher entre familles, pas entre variantes fines
d'une même famille.** C'est la clé de lecture des résultats ci-dessous.

### Les signaux changent de régime selon la part

Sur la combinaison la plus proche de l'humain :

| part | `pairMinusInitial` médian | \|y gauche\| médian |
|---|---:|---:|
| 17 | **+5.01** | 4.50 |
| 20 | **−45.88** | 38.00 |

L'avertissement de l'audit est confirmé : une règle bâtie sur une seule part
serait fausse sur l'autre. **L'ancre par part y répond** — c'est la raison de ce
choix de conception, pas une commodité.

---

## Politique candidate, hors ligne

```
ancre, dispersion ← médiane et écart absolu médian de la relation de paire
                    des cuts de la MÊME PART où lossRatio ≥ R des deux côtés,
                    cut jugé retiré, cuts réservés exclus

si les deux rails sont fortement discriminés  → ne rien changer
sinon, parmi les 9 combinaisons exposées :
    si |paire − ancre| de la meilleure > K × dispersion  → abstention
    sinon                                                → retenir la meilleure
```

`R = 5`, socle minimal de 5 cuts. Ce sont des **paramètres de laboratoire**, pas
des seuils du moteur.

### Balayage — chiffres périmés, voir le tour 2

> **Les chiffres publiés ici au premier tour étaient faussés par une erreur de
> ma part** : l'ancre était calculée sur le couple `(surface, surface)` alors
> que le moteur applique `(graine, graine)`. Corrigé au tour 2. Les tableaux
> corrigés, et la politique « famille seulement », sont plus bas.

### Cas impossibles à départager

Six cuts ne sont récupérables avec **aucune** des neuf combinaisons : 485, 1512,
1664, 1665, 3908, 3909. Sur 3908, les neuf combinaisons sont à 86–193 de
l'ancre ; la meilleure erreur atteignable est 161. **Le bon placement n'est pas
exposé.** La porte de plausibilité s'y ferme, ce qui est le comportement voulu :
aucune règle d'arbitrage ne peut les sauver sans un candidat de plus, ce que ce
lot s'interdit.

---

## Ce qui n'est pas établi

- **Deux parts, un seul chantier.** 110 cuts. Ce n'est pas un échantillon
  indépendant de la voie.
- **La comparaison reste défavorable à l'alternative** : elle est en grille
  grossière (pas 0.003) quand la graine dispose de son affinage `surface`. Les
  erreurs mesurées de l'alternative sont des **majorants**.
- **La référence humaine est candidate, non revue** (`PLACEMENT_LAB.md`).
- **La politique est inerte sans socle d'ancrage.** Sur la session terrain du
  16/09 (part 8), aucun cut n'atteint `lossRatio ≥ 5` des deux côtés — pas même
  le cut 40 (4.67 / 27.20). Le socle est vide : **la politique n'y démarrerait
  pas**. C'est la limite opérationnelle la plus sérieuse.
- **`R = 5` et le socle de 5 ne sont pas optimisés** : choix de départ.
- Aucun gain de temps, aucune qualité géométrique absolue mesurés.

## Série terrain — lecture qualitative seulement

Les cuts 40 et 101–107 du 16/09 n'ont contribué ni à la conception ni à l'ancre.
Avec une ancre **forcée** sur le cut 40, hors règle :

| cut | ratio G/D | combinaison la plus proche | paire | moteur | humain |
|---|---|---|---:|---:|---:|
| 101 | 1.21 / 1.13 | alternative / alternative | 1444.21 | 1595.91 | **1440.66** |
| 102 | 1.62 / 1.92 | alternative / alternative | 1448.69 | 1592.83 | — |
| 103 | 1.60 / 2.17 | alternative / alternative | 1449.59 | 1597.70 | — |
| 104 | 1.40 / 2.50 | alternative / alternative | 1453.04 | 1594.24 | **1447.16** |
| 105 | 1.69 / 1.75 | alternative / alternative | 1453.21 | 1601.22 | — |

Cohérent avec le corpus historique. Ce n'est **pas** une mesure : deux
références humaines seulement, `partial` toutes les deux, et une ancre hors
règle.

## Prochaines étapes — rien n'est engagé

1. **Arbitrer la famille, pas la variante fine.** Devrait conserver les
   corrections et supprimer les 10 régressions.
2. **Ancre locale** plutôt que par part : la relation dérive le long de la voie
   (cuts 3174–3180 de la part 17).
3. **Re-mesurer l'alternative en grille fine**, pour lever le biais de
   comparaison.
4. Évaluer sur une part qui n'a servi ni à concevoir ni à ancrer.

**Le benchmark indépendant archivé dans `StoryNow30/banane-data` et la collecte
Natif V4.6 ne sont pas utilisés ici** : la politique doit être figée avant de
s'en servir, sous peine de régler le banc sur ses propres données de validation.

**Aucune modification runtime. Aucun seuil touché. Aucun paramètre retenu.**

---

# Tour 2 — arbitrer la famille, pas la variante fine

Ce tour n'a qu'un objet : isoler l'effet « famille seulement ». **`R = 5`, le
socle minimal, `K`, l'ancre et la porte de plausibilité sont inchangés.**

## Une erreur du tour 1, corrigée

L'ancre était calculée sur la relation de paire du couple `(surface, surface)`,
présenté comme « le couple que le moteur applique ». **C'est faux.** Sur les
**173 rails résolus, `proposal.delta` est strictement égal à `metrics.seed`** —
écart 3D nul, latéral nul. `surfaceIntersection` est exposé comme diagnostic et
n'est **jamais appliqué**.

L'ancre porte désormais sur `(graine, graine)`. Les chiffres du tour 1 en sont
modifiés ; ceux qui suivent les remplacent.

## Familles — partition structurelle, pas métrique

| famille | placements | nature |
|---|---|---|
| `best` | `metrics.seed`, `metrics.surfaceIntersection` | le meilleur de grille grossière et son affinage |
| `alternative` | `templateAmbiguity.alternative` | **une autre cellule grossière, par construction** |

La séparation vient du **champ lu**, donc de la construction du moteur — pas
d'un seuil que j'ajouterais. Un critère de distance aurait été un seuil nouveau :
le moteur garantit `alternativeSeparation` contre `coarseBest`, pas contre la
graine affinée, et **29 rails sur 220** ont une alternative à moins de 0.02 de
leur graine. Verrouillé par test.

## « Laisser le moteur choisir la variante fine » — formalisation

C'est le point critique du tour, et il se règle sans règle nouvelle :

- **représentant de `best` = la graine.** Formulation exacte (corrigée au tour 3,
  voir plus bas) : la graine est **utilisée comme représentant** de la famille
  `best`, choix cohérent avec `proposal.delta === metrics.seed` sur les **173
  rails que le moteur a effectivement résolus**. Sur un rail **abstenu**, le
  moteur n'a **rien appliqué** : on ne peut donc pas dire qu'il « avait déjà
  décidé d'appliquer la graine » sur ce rail-là. Le banc n'invente pour autant
  aucune règle graine-contre-surface : il reprend un représentant **observé
  ailleurs** plutôt que d'arbitrer la variante fine ;
- **représentant de `alternative` = l'alternative**, seul placement exposé de
  cette famille.

`surfaceIntersection` n'est jamais choisi par le banc ; un test l'interdit
explicitement. Les 47 rails abstenus ne portent **aucun** `delta` : vérifié par
test.

Conséquence mécanique : l'arbitrage porte sur 4 combinaisons de familles, pas 9.

> **Ce que cette formalisation ne garantissait pas.** Elle préserve la variante
> fine, mais **pas la famille** d'un rail que le moteur avait déjà résolu.
> `settled` est une condition de **cut** : voir le tour 3.

## Résultats — 93 cuts hors réserve, ancre corrigée

> **Colonne « récup. » périmée — voir le tour 3.** Le compteur `recovered` de ces
> deux tableaux était **faux** : il comptait tout cut arbitré sur lequel le
> moteur n'appliquait rien, **sans regarder l'erreur obtenue**. Les tableaux
> recalculés sont plus bas. Les autres colonnes restent exactes.

**Politique fine (9 combinaisons)** — celle du tour 1 :

| K | arbitré | abstenu | inchangé | récup. | corrections | **régressions** |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 32 | 25 | 36 | 16 | 2 | **6** |
| 2 | 39 | 18 | 36 | 20 | 2 | **7** |
| 3 | 47 | 10 | 36 | 26 | 2 | **7** |
| 5 | 52 | 5 | 36 | 29 | 4 | **7** |
| 10 | 53 | 4 | 36 | 30 | 4 | **7** |

**Politique « famille seulement » (4 combinaisons)** :

| K | arbitré | abstenu | inchangé | récup. | corrections | **régressions** |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 21 | 36 | 36 | 12 | 2 | **0** |
| 2 | 30 | 27 | 36 | 16 | 2 | **0** |
| 3 | 39 | 18 | 36 | 20 | 2 | **0** |
| 5 | 50 | 7 | 36 | 28 | 2 | **0** |
| 10 | 53 | 4 | 36 | 30 | 2 | **0** |

**Les régressions disparaissent entièrement, à tous les K.** Verrouillé par test.

### Les corrections matérielles sont conservées

| cut | avant | après | familles retenues |
|---|---:|---:|---|
| 5123 | 67.12 | **7.44** | best / alternative |
| 6576 | 82.11 | **6.27** | alternative / best |
| 9041 *(tenue à l'écart)* | 100.96 | **5.86** | alternative / best |

Les trois repassent sous la convention d'évaluation. Verrouillé par test.

## Les pertes — rapportées entièrement

**1. Six récupérations perdues** à K = 3 (conception) : cuts 3174, 3175, 3176,
3179, 9108, 5465. La politique fine les atteignait à 3.87–8.95 ; « famille
seulement » s'y abstient. Ce sont des abstentions maintenues, pas des mauvais
placements — mais ce sont des pertes de couverture réelles.

**2. Deux corrections perdues sur la tenue à l'écart** : 9045 (6.18 → 2.65) et
9044 (11.22 → 9.07). Toutes deux étaient des échanges de variante fine.

**Lecture honnête de ces deux pertes.** Elles relèvent du même phénomène que les
sept régressions : la paire n'a pas la résolution du fin, et ses choix à cette
échelle sont fortuits. La politique fine gagnait 2 corrections supplémentaires et
en payait 7 régressions. « Famille seulement » renonce aux deux côtés du hasard.

**3. Couverture moindre à K faible** : 12 récupérations contre 16 à K = 1, 20
contre 26 à K = 3. L'écart se referme à K = 10 (30 contre 30).

## Artefact de politique figé — **supersédé**

L'artefact `audit/pair-arbitration-policy-v1.json`, SHA
`33a654200bcd5ff688c41b149a00dede0ad65786bcebfbdc0cf7d76d8fad714f`, est
**provisoire et supersédé** par les deux artefacts du tour 3. Il a été retiré du
dépôt pour qu'aucun tiers ne le score par erreur ; il reste consultable dans
l'historique, au commit `4d4e73c`.

## Chantier séparé, documenté et non résolu ici

**Absence d'ancre sur une part nouvelle.** La politique exige un socle d'au moins
5 cuts fortement discriminés dans la part. Sur la session terrain du 16/09
(part 8), **aucun cut n'atteint `lossRatio ≥ 5` des deux côtés** — pas même le
cut 40 (4.67 / 27.20). Le socle est vide et **la politique n'y démarre pas**.

C'est la limite opérationnelle la plus sérieuse de cette première politique.
Elle est **documentée et laissée ouverte** : ce sera un chantier distinct, après
gel de celle-ci.

## Rappel de périmètre

Aucun changement runtime, `geometry.js`, cerveau, seuil moteur ou génération de
candidats. `banane-data`, le benchmark indépendant archivé et la collecte Natif
V4.6 **ne sont pas utilisés** : la politique doit être figée avant de s'en
servir, sous peine de se régler sur ses propres données de validation.

---

# Tour 3 — revue Astra du code : deux défauts mécaniques, corrigés

Astra a relu directement `tools/pair-lab.cjs`. Les deux défauts signalés sont
réels et vérifiables dans le code du tour 2. Aucun paramètre n'a été touché :
`R = 5`, `minBase = 5`, le balayage de K, l'ancre, la dispersion et la porte de
plausibilité sont **identiques** au tour 2.

## Défaut 1 — « rail déjà résolu » : contradiction entre le code et le rapport

Le rapport affirmait qu'un rail déjà résolu conservait sa décision. **C'est faux
au niveau de la famille.** `decideFamily()` n'immobilise que les cuts où
`settled(row, R)` est vrai — et `settled` est une condition de **cut**, qui exige
que les **deux** rails soient discriminés :

```js
return l.status === 'candidate' && r.status === 'candidate'
  && Math.min(l.lossRatio ?? -Infinity, r.lossRatio ?? -Infinity) >= R;
```

Sur un cut à un rail abstenu, les quatre couples de familles sont donc parcourus
et le rail déjà `candidate` peut changer de famille.

### La mesure d'abord — combien de décisions gelées le font réellement ?

Sur les 110 cuts, variante du tour 2 :

| K | cuts arbitrés | cuts déplaçant un rail déjà résolu | rails déplacés | cuts concernés |
|---:|---:|---:|---:|---|
| 1 | 22 | **2** | 2 | 5123 (droit), 6576 (gauche) |
| 2 | 35 | **4** | 4 | 1665 (g), 5123 (d), 6576 (g), 9041 (g) |
| 3 | 51 | **5** | 5 | 1665 (g), 5123 (d), 6576 (g), 9041 (g), 9106 (g) |
| 5 | 62 | **5** | 5 | *idem* |
| 10 | 65 | **5** | 5 | *idem* |

Décomposition des 110 cuts selon ce que `settled` protège, à `R = 5` :

| catégorie | cuts |
|---|---:|
| `settled` des deux côtés — jamais arbitrés | 41 |
| **deux** rails déjà `candidate`, mais `lossRatio < R` | **27** |
| **un** rail `candidate` + un rail `unresolved` | **37** |
| aucun rail `candidate` | 5 |

Les 64 cuts des deux lignes du milieu portent un rail que le moteur a résolu et
que `settled` ne protège pas.

**Le cas le plus net est le cut 9106** : son rail gauche a un `lossRatio` de
**11.55**, largement au-dessus de `R = 5`, et se fait pourtant déplacer de `best`
vers `alternative` — uniquement parce que son partenaire droit s'abstient
(`lossRatio` 1.18). Le résultat sort à **48.26** de la référence humaine.

### Les deux variantes, explicitement distinctes

Le banc expose désormais `VARIANTS = ['pair-joint', 'lock-resolved-rail']`. Seul
l'ensemble des familles ouvertes par rail change ; tout le reste est commun.

| variante | familles ouvertes pour un rail `candidate` | pour un rail `unresolved` |
|---|---|---|
| `pair-joint` | `best`, `alternative` | `best`, `alternative` |
| `lock-resolved-rail` | `best` **seulement** — donc sa graine | `best`, `alternative` |

**Conséquence assumée de `lock-resolved-rail`** : sur les 27 cuts dont les deux
rails sont `candidate` sans être `settled`, la seule option ouverte est le couple
que le moteur applique déjà. Il n'y a rien à arbitrer, et le banc le dit
explicitement — décision `moteur`, motif `aucun-rail-abstenu` — plutôt que de le
confondre avec une abstention ou avec un cut fortement discriminé.

**Le banc ne choisit pas entre les deux variantes.** Les deux sont mesurées,
figées et livrées.

## Défaut 2 — le compteur `recovered` était faux

Dans `sweep()`, tout cut arbitré avec `!engineApplies(row)` incrémentait
`recovered`, **indépendamment de son erreur par rapport à la référence humaine**.
Un cut sorti à 48.26 y était compté comme « récupéré ». Trois compteurs distincts
le remplacent :

| compteur | définition |
|---|---|
| `arbitratedAbstention` | cuts arbitrés sur lesquels le moteur n'appliquait rien |
| `recoveredAtOracleTolerance` | … dont l'erreur finale **≤ 0.010** |
| `arbitratedButOutsideTolerance` | … dont l'erreur finale **> 0.010** |

`0.010` reste la **convention d'évaluation** de l'oracle, reprise du banc
indépendant : elle sert à **compter**, jamais à décider. Aucune règle ne la lit.

Deux compteurs s'ajoutent pour la symétrie — `unchanged` (arbitrage qui retombe
exactement sur ce que le moteur appliquait) et `untouchedSettled` /
`untouchedNothingToArbitrate`. Un test vérifie que les compteurs **se referment
sans reste** à chaque K et pour chaque variante.

## Tableaux recalculés — 93 cuts hors réserve, tous les K

Lecture des colonnes : `arbAbst` = cuts arbitrés sans placement moteur préalable,
dont `récup ≤ tol` et `hors tol` ; `arbAppl` = cuts arbitrés que le moteur avait
déjà placés, dont `corr.`, `régr.` et `inch.` ; `rails dépl.` = rails déjà
résolus déplacés hors de leur graine.

**Politique fine (9 combinaisons, variante fine arbitrée)**

| K | moteur | abst. | arbitré | arbAbst | **récup ≤ tol** | **hors tol** | arbAppl | corr. | **régr.** | inch. | rails dépl. |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 36 | 25 | 32 | 16 | **16** | **0** | 16 | 2 | **6** | 8 | 17 |
| 2 | 36 | 18 | 39 | 20 | **19** | **1** | 19 | 2 | **7** | 10 | 21 |
| 3 | 36 | 10 | 47 | 26 | **23** | **3** | 21 | 2 | **7** | 12 | 23 |
| 5 | 36 | 5 | 52 | 29 | **26** | **3** | 23 | 4 | **7** | 12 | 25 |
| 10 | 36 | 4 | 53 | 30 | **26** | **4** | 23 | 4 | **7** | 12 | 26 |

**Famille seulement — variante `pair-joint`**

| K | moteur | abst. | arbitré | arbAbst | **récup ≤ tol** | **hors tol** | arbAppl | corr. | **régr.** | inch. | rails dépl. |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 36 | 36 | 21 | 12 | **12** | **0** | 9 | 2 | **0** | 7 | 2 |
| 2 | 36 | 27 | 30 | 16 | **15** | **1** | 14 | 2 | **0** | 12 | 3 |
| 3 | 36 | 18 | 39 | 20 | **17** | **3** | 19 | 2 | **0** | 17 | 4 |
| 5 | 36 | 7 | 50 | 28 | **25** | **3** | 22 | 2 | **0** | 20 | 4 |
| 10 | 36 | 4 | 53 | 30 | **26** | **4** | 23 | 2 | **0** | 21 | 4 |

**Famille seulement — variante `lock-resolved-rail`**

| K | moteur | *(dont rien à arbitrer)* | abst. | arbitré | arbAbst | **récup ≤ tol** | **hors tol** | arbAppl | corr. | **régr.** | rails dépl. |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 59 | *23* | 22 | 12 | 12 | **12** | **0** | 0 | 0 | **0** | **0** |
| 2 | 59 | *23* | 19 | 15 | 15 | **15** | **0** | 0 | 0 | **0** | **0** |
| 3 | 59 | *23* | 16 | 18 | 18 | **17** | **1** | 0 | 0 | **0** | **0** |
| 5 | 59 | *23* | 8 | 26 | 26 | **25** | **1** | 0 | 0 | **0** | **0** |
| 10 | 59 | *23* | 6 | 28 | 28 | **26** | **2** | 0 | 0 | **0** | **0** |

Les régressions restent nulles dans les **deux** variantes, à tous les K.

### Ce que le compteur corrigé change dans la lecture du tour 2

À K = 3, le tour 2 annonçait **20 récupérations** pour « famille seulement ». Il
y en a **17** sous la convention d'évaluation ; les **3 autres** ressortent
au-dessus : 1665 à 12.75, **9106 à 48.26**, 1668 à 10.34. La politique fine
annonçait 26 récupérations : il y en a 23, mêmes trois débordements.

Le cut 9106 est le même que celui du défaut 1 : c'était un rail à `lossRatio`
11.55 déplacé par son partenaire abstenu, et l'ancien compteur l'annonçait
« récupéré ».

## Comparaison complète des deux variantes

### Cuts qui décident différemment

| K | 1 | 2 | 3 | 5 | 10 |
|---|---:|---:|---:|---:|---:|
| cuts divergents (sur 110) | 27 | 28 | 29 | 29 | 29 |

L'écrasante majorité (27) sont les cuts à deux rails `candidate` non `settled` :
`pair-joint` les arbitre, `lock-resolved-rail` rend la main au moteur. Les
divergences restantes sont les cuts 1665 et 9106, à un rail abstenu, où
`pair-joint` déplace le rail résolu et `lock-resolved-rail` s'abstient.

### Gains et pertes de `lock-resolved-rail` face à `pair-joint`

| K | récup ≤ tol | hors tol | corrections | régressions | rails résolus déplacés |
|---:|---|---|---|---|---|
| 1 | 12 → **12** | 0 → **0** | 2 → **0** | 0 → 0 | 2 → **0** |
| 2 | 15 → **15** | 1 → **0** | 2 → **0** | 0 → 0 | 3 → **0** |
| 3 | 17 → **17** | 3 → **1** | 2 → **0** | 0 → 0 | 4 → **0** |
| 5 | 25 → **25** | 3 → **1** | 2 → **0** | 0 → 0 | 4 → **0** |
| 10 | 26 → **26** | 4 → **2** | 2 → **0** | 0 → 0 | 4 → **0** |

**Gain.** Les récupérations sous tolérance sont **exactement les mêmes cuts** —
vérifié par différence d'ensembles, pas seulement par comptage. `lock` supprime
en revanche les débordements 1665 (12.75) et 9106 (48.26).

**Perte, énoncée sans l'atténuer.** Les trois corrections matérielles du tour 2 —
5123 (67.12 → 7.44), 6576 (82.11 → 6.27) et 9041 (100.96 → 5.86, sur la tenue à
l'écart) — passent **toutes** par le déplacement d'un rail déjà résolu.
`lock-resolved-rail` ne peut donc pas les produire : elle rend la main au moteur,
qui reste à 67.12, 82.11 et 100.96. Verrouillé par test.

C'est un arbitrage réel, pas un choix évident : `lock` évite deux placements très
mauvais, `pair-joint` répare trois placements très mauvais. **Le banc ne tranche
pas.** Les deux artefacts sont livrés.

### Pertes de couverture, par catégorie de cut

La couverture ne veut pas dire la même chose selon que le moteur avait ou non
placé les deux rails. Les 93 cuts de conception se scindent en **34 cuts que le
moteur ne place pas** et **59 qu'il place déjà**.

**Sur les 34 cuts que le moteur ne place pas** — c'est la couverture qui compte,
puisque c'est là que la politique apporte quelque chose :

| K | fine | `pair-joint` | `lock-resolved-rail` | cuts que `lock` décline en plus |
|---:|---:|---:|---:|---|
| 1 | 16 | 12 | **12** | — |
| 2 | 20 | 16 | **15** | 1665 |
| 3 | 26 | 20 | **18** | 1665, 9106 |
| 5 | 29 | 28 | **26** | 1665, 9106 |
| 10 | 30 | 30 | **28** | 1665, 9106 |

Trois énoncés, tous vérifiés par test :

1. **La couverture de `lock` est strictement incluse** dans celle de
   `pair-joint` : elle ne place jamais un cut de plus.
2. **Ce qu'elle décline en plus est exactement l'ensemble des cuts où
   `pair-joint` déplaçait un rail déjà résolu** — 1665 et 9106. C'est la
   définition du contrat, pas un résultat empirique.
3. **Tous ces cuts-là ressortaient hors tolérance** sous `pair-joint` : 1665 à
   12.75, 9106 à 48.26. **Aucune récupération sous tolérance n'est perdue, à
   aucun K.**

**La réciproque du point 3 est fausse, et il faut le dire.** Tous les placements
hors tolérance ne disparaissent pas avec `lock` : le cut **1668** ressort à
**10.34** dans les **deux** variantes, à K ≥ 3. Son erreur ne vient pas d'un rail
déplacé mais de l'absence du bon placement parmi les candidats exposés —
c'est la limite déjà identifiée au tour 1, que ni l'une ni l'autre variante ne
corrige. Verrouiller le rail résolu supprime deux débordements sur trois, pas
les trois.

La perte de couverture de « famille seulement » face à la politique **fine**
subsiste et reste celle du tour 2 : à K = 3, six cuts — 3174, 3175, 3176, 3179,
5465, 9108 — que le fin atteignait entre 3.87 et 8.95. L'écart se referme
entièrement à K = 10 (30 contre 30 pour `pair-joint`, 28 pour `lock`).

**Sur les 59 cuts que le moteur place déjà**, `lock-resolved-rail` en arbitre
**zéro**, à tous les K, par construction. Ce n'est pas une perte de couverture au
sens où la politique laisserait un cut sans placement : le moteur en a déjà posé
un. C'est le renoncement à toute correction — chiffré plus haut : les trois
corrections matérielles.

### Deux contrats, pas deux réglages

Les deux variantes n'expriment pas deux valeurs d'un même paramètre, mais deux
contrats différents sur ce que la politique a le droit de faire :

| | `pair-joint` | `lock-resolved-rail` |
|---|---|---|
| **contrat** | la relation de paire arbitre le **couple** ; une décision moteur isolée peut être révisée si la paire la contredit | une décision moteur, même faible, n'est **jamais** révisée ; la politique ne parle que là où le moteur s'est tu |
| **peut réparer** | un mauvais placement moteur (5123, 6576, 9041) | rien |
| **peut abîmer** | un rail que le moteur avait bien résolu (9106, `lossRatio` 11.55) | rien |
| **couverture** | plus large de 2 cuts au plus | strictement incluse |

Choisir entre elles, c'est choisir **si Banane est autorisée à contredire le
moteur sur un rail qu'il a résolu**. Cette question ne se tranche pas par un
comptage sur 93 cuts : elle relève de la revue et de l'exploitation. Les deux
artefacts sont donc figés et livrés côte à côte, et le banc n'en désigne aucun.

## Terminologie corrigée

Ne subsiste plus, ni dans le code ni ici, la formule « le moteur avait déjà
décidé d'appliquer la graine » appliquée à un rail **abstenu**. La formulation
retenue est : *la graine est utilisée comme représentant de `best`, choix
cohérent avec `proposal.delta === metrics.seed` sur les 173 rails effectivement
résolus ; sur un rail abstenu le moteur n'a rien appliqué.* Les 47 rails abstenus
ne portent aucun `delta` — vérifié par test, et 173 + 47 = 220.

## Artefacts figés — deux, un par variante

```bash
node tools/pair-lab.cjs --freeze audit/pair-arbitration-policy-pair-joint-v1.json --variant pair-joint
node tools/pair-lab.cjs --freeze audit/pair-arbitration-policy-lock-resolved-rail-v1.json --variant lock-resolved-rail
```

| artefact | SHA-256 du contenu canonique |
|---|---|
| `audit/pair-arbitration-policy-pair-joint-v1.json` | `af2721d297937fefa73cd132567b32e8f5d001d4dc6d1a14e5bf2e00cc58ff1f` |
| `audit/pair-arbitration-policy-lock-resolved-rail-v1.json` | `21d57823da2615875e330c0a3b226191e505e43881329bd0f23b246c0fd87a36` |
| ~~`audit/pair-arbitration-policy-v1.json`~~ | ~~`33a654200bcd5ff688c41b149a00dede0ad65786bcebfbdc0cf7d76d8fad714f`~~ — **supersédé**, retiré du dépôt |

Corpus source, inchangé :
`e4bbad2f064eeebb78f25cf171daf6e3c6e38cb238f613468bb61ef6583119cd`.

Le champ `variant` entre désormais dans l'empreinte, de sorte que deux artefacts
ne puissent jamais se confondre. Le SHA reste **recalculable par un tiers** :

```
sha256( JSON.stringify({format, policy, variant, source, parameters, reserved, decisions}) )
```

L'horodatage en est exclu. Chaque décision gelée porte en plus `railStatus` et,
lorsqu'elle arbitre, la liste `resolvedRailsMoved` — un tiers peut donc vérifier
le défaut 1 sans relire le code.

## Ce que le tour 3 n'a pas touché

`R = 5`, `minBase = 5`, le balayage `K ∈ {1, 2, 3, 5, 10}`, l'ancre, la
dispersion et la porte de plausibilité sont **inchangés**. Aucun K n'est retenu.
Les cuts 9031–9047 restent en évaluation finale, exclus du socle d'ancrage et de
tout réglage. Aucun fichier runtime, `geometry.js`, cerveau, seuil moteur ou
génération de candidats n'est modifié. `banane-data`, le benchmark indépendant
archivé et la collecte Natif V4.6 ne sont pas utilisés.

L'absence d'ancre sur une part nouvelle reste **documentée et non résolue** ; les
deux variantes la partagent à l'identique.
