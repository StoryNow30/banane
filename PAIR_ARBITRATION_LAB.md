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

### Balayage complet — 93 cuts hors réserve

| K | arbitré | abstenu | inchangé | récupérations | corrections | **régressions** | p90 récup. | max récup. |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 48 | 9 | 36 | 26 | 9 | **10** | 9.17 | 10.34 |
| 2 | 50 | 7 | 36 | 27 | 10 | **10** | 9.17 | 10.34 |
| 3 | 52 | 5 | 36 | 29 | 10 | **10** | 9.66 | 48.26 |
| 5 | 53 | 4 | 36 | 30 | 10 | **10** | 10.58 | 48.26 |
| 10 | 54 | 3 | 36 | 31 | 10 | **10** | 12.75 | 48.26 |

### Ce que ces chiffres disent vraiment

**Les grosses corrections sont réelles** : 6576 (82.11 → 5.89), 5123
(67.12 → 8.18), et sur la tenue à l'écart 9041 (100.96 → 5.86). Ce sont les
outliers du terrain, et la paire les tranche.

**Les 10 régressions sont réelles aussi, et je ne les minimise pas.** Elles sont
toutes petites — 3.73 → 4.85, 5.87 → 8.81, 2.37 → 6.53 — et toutes **entre
variantes fines d'une même famille**. C'est la conséquence directe des deux
échelles : la paire n'a pas la résolution pour choisir entre `graine` et
`surface`, distantes de ~2, et elle s'en mêle quand même.

Mon premier banc en 2×2 affichait **zéro régression** : c'était un artefact du
jeu de candidats appauvri, pas une qualité de la politique.

**Piste que cela ouvre, non implémentée** : n'utiliser la paire que pour choisir
la **famille** par rail, et laisser le moteur choisir la variante fine à
l'intérieur. Cela devrait conserver les corrections et supprimer les
régressions. À tester au prochain tour.

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
