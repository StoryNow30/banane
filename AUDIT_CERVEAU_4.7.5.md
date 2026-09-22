# AUDIT DU CERVEAU DE PLACEMENT — 4.7.5

22 septembre 2026 · base `b9ef24f` (4.7.5) · outil `tools/brain-audit.cjs`
Suite de `AUDIT_SUPER_CERVEAU.md` (base 4.7.0), dont les trois modes d'échec
sont ici re-mesurés sur des données d'observation saine.

**Méthode.** Le moteur Pilote tel qu'il est livré (GCV1 runtime, S1, flanc
partiel, garde d'écartement) est rejoué sur l'entrée du banc — lecture complète
de la pose de départ, amendement n°2 — pour chaque visite de sept sessions. La
validation humaine n'est lue qu'après le calcul, pour juger. Un cut est
« appliqué » si le Pilote l'appliquerait : deux rails publiés, écartement dans
le contrat. « Faux » : un rail à plus de 10 mm de la validation humaine.
Unités de scène × 1000, non calibrées physiquement.

**Données.** 385 cuts, parties 13, 18, 19 et 20, collectes Natif 4.7.0 à 4.7.3
et relectures Natif de deux sessions Pilote. Ces données ont servi au réglage :
aucun chiffre ci-dessous ne démontre la généralisation (cahier §11).

---

## 1. Verdict

| Question | Réponse | Statut |
|---|---|---|
| Le banc prédit-il le Pilote ? | Oui : 23 décisions Pilote sur 23 reproduites à l'identique | MESURÉ |
| Le moteur applique-t-il des cuts faux ? | Non : 0 sur 76 cuts appliqués et jugés | MESURÉ |
| Ses placements sont-ils justes ? | **Non, biaisés** : écartement +4,5 mm, rail 2,8 mm trop bas | MESURÉ |
| D'où vient le biais ? | Convention : moteur au milieu de la bande de points, humain en enveloppe | ÉTABLI PAR MESURE, cause physique NON ÉTABLIE |
| Un modèle d'abstention (A1) a-t-il de quoi apprendre ? | Non : aucune erreur appliquée à attraper | MESURÉ |
| La bonne réponse est-elle calculée quand le moteur s'abstient ? | Oui pour 88 % des rails : un minimum local à ≤ 10 mm | MESURÉ |
| P2, plancher humain, mesurable ? | Non (1 cut commun entre sessions) ; borné à ≤ 1,6 mm latéral, 1,1 mm vertical | BORNE |

**Classe d'erreur dominante : la précision des placements appliqués, pas leur
justesse.** C'est elle que le chantier du §8 corrige.

## 2. Le Pilote est rejouable à l'identique

Les captures enregistrées par le Pilote (partie 18 en 4.7.1, partie 20 en 4.7.4)
rejouées dans le moteur de l'époque redonnent **23 décisions sur 23**, delta
compris. Le moteur est déterministe ; tout ce que le banc mesure sur des
captures Pilote vaut pour le Pilote.

Rejouées dans le moteur 4.7.5, les captures Pilote de la partie 18 donnent
2 cuts appliquables de plus (6704, 6707) et 1 rail de plus (6706) : c'est le
flanc partiel. Celles de la partie 20 ne changent pas : 8 paires sur 15 y sont
refusées par l'écartement, un rail posé sur une structure voisine à ≈ 115 mm.

## 3. Où vont les cuts

| Session | Partie | Version | Cuts | Sans entrée | Appliqués justes | Appliqués sans réf. | Faux | Écartement | Abstention |
|---|---|---|---|---|---|---|---|---|---|
| lot 1 | 13 | 4.7.0 | 32 | 14 | 6 | 0 | 0 | 0 | 12 |
| lot 2 | 18 | 4.7.1 | 41 | 12 | 8 | 3 | 0 | 1 | 17 |
| lot 3 | 18 | 4.7.1 | 111 | 94 | 4 | 3 | 0 | 0 | 10 |
| lot 4 | 19 | 4.7.2 | 105 | 27 | 23 | 27 | 0 | 2 | 26 |
| lot 5 | 20 | 4.7.3 | 67 | 12 | 31 | 8 | 0 | 9 | 7 |
| Pilote 1 relu | 18 | 4.7.1 | 14 | 12 | 0 | 1 | 0 | 0 | 1 |
| Pilote 2 relu | 20 | 4.7.4 | 15 | 0 | 4 | 1 | 0 | 4 | 6 |
| **Total** | | | **385** | **171** | **76** | **43** | **0** | **16** | **79** |

Abstentions par rail : flanc 60, dessus insuffisant 15, ambiguïté 13, pente 10.

- **Sans entrée** : collectes 4.7.0–4.7.1 surtout (lecture Natif défaillante,
  corrigée en 4.7.2) ; encore 23 % en 4.7.2–4.7.3 (`no-qualified-snapshot`). Le
  Pilote n'est pas concerné : il lit sa propre capture.
- **Sans référence** : 145 rails qualifiés n'ont pas de validation humaine
  exploitable (`human-final-candidate-missing`), dont 27 cuts appliqués du lot 4.
  Un cut non validé ne peut pas juger le moteur : valider chaque cut reste la
  consigne qui rapporte le plus au banc.
- **Couverture parmi les cuts avec entrée** : partie 19, 50 / 78 (64 %) ;
  partie 20, 39 / 55 (71 %) en Natif, 5 / 15 sur la zone d'appareils de voie du
  Pilote 2.

## 4. Les placements appliqués : jamais faux, mais biaisés

**0 cut appliqué faux sur 76 jugés.** Au niveau du rail, 9 rails publiés sont
faux de 17 à 177 mm. **Aucun n'atteint l'application, et ce n'est pas
l'écartement qui les arrête** : dans les 9 cas, l'autre rail du cut s'abstient
(flanc ou dessus insuffisant) et l'exigence des deux rails suffit. Deux d'entre
eux ne sont faux que de 17 mm, écart que le contrat d'écartement, large de
65 mm, ne verrait pas. **Tout gain de couverture sur l'autre rail doit donc être
mesuré avec ces cas-là en tête.**

**Le biais.** Sur les 194 rails appliqués et jugés, toutes parties :

| | Médiane signée | Rails dans le sens du biais |
|---|---|---|
| Latéral (vers le champignon) | +2,1 mm, identique à gauche et à droite | 150 / 194 |
| Vertical | −2,8 mm (moteur plus bas) | 164 / 194 |
| **Écartement** (76 cuts) | **+4,5 mm** (p10 −1,3 · p90 +8,3) | — |

Écartement médian humain 1 438,4 mm, moteur 1 443,1 mm. Le biais latéral est de
même signe sur les deux rails dans le repère de chaque profil : les deux flancs
partent côté champ, l'écartement s'élargit d'autant (écart vérifié à 0,3 mm près
par la somme des deux erreurs latérales).

**L'explication mesurée.** GCV1 recale le gabarit U50 en minimisant la distance
médiane de ses ancres aux points : il le pose **au milieu** de la bande de points
LiDAR, épaisse de ±3 mm. L'écart moteur/humain suit la position des points :

- vertical : corrélation −0,74 avec le 90e centile des points du dessus ;
  l'humain pose le dessus du contour ≈ 1 mm au-dessus de ce centile ;
- latéral : corrélation −0,47 avec la médiane des points du flanc ; l'humain
  pose le flanc ≈ 2,6 mm côté voie de cette médiane.

L'opérateur pose le contour **en enveloppe** des points : le dessus au-dessus,
le flanc côté voie. Ce n'est pas un défaut de la géométrie gelée, c'est une
convention différente — et la référence du projet est la validation humaine.
Laquelle des deux est physiquement juste n'est pas établi
(`physicalCalibrationStatus`).

**Conséquence pour le chantier A1.** Défini par l'amendement n°1 comme modèle
d'abstention — prédire quand un placement publié est faux —, il n'a aujourd'hui
**rien à apprendre** : aucune erreur appliquée à intercepter. La classe
d'erreur qui coûte est la précision, sur 100 % des placements.

## 5. Les abstentions : la bonne réponse est presque toujours calculée

Pour chaque rail non résolu et référencé, la grille d'A_STAR (±80 mm autour de
la pose ESV et de la médiane des points) est reconstruite et ses minima locaux
énumérés, comme le prévoyait P0.

| Motif | Rails | Meilleur minimum à ≤ 10 mm de la vérité | Vérité à un minimum suivant | Absente |
|---|---|---|---|---|
| Flanc | 41 | 27 | 9 | 5 |
| Écartement | 32 | 14 | 14 | 4 |
| Dessus insuffisant | 13 | 7 | 3 | 3 |
| Ambiguïté | 12 | 7 | 5 | 0 |
| Pente | 7 | 6 | 0 | 1 |
| **Total** | **105** | **61** | **31** | **13** |

- **92 rails sur 105 (88 %)** ont un minimum local à moins de 10 mm de la
  vérité ; la vérité sort de la fenêtre pour 4 seulement. Quand elle n'est pas
  au premier rang, elle est au deuxième 27 fois sur 31 (troisième 3 fois,
  quatrième 1 fois). L'hypothèse centrale du cahier (§3.3) tient sur ces données.
- **Flanc** : pour 27 rails sur 41, le moteur *avait* la bonne position et s'est
  tu faute de points de flanc. Problème de preuve, pas de recherche.
- **Écartement** : les 14 au premier rang sont le rail juste d'une paire
  refusée ; les 14 suivants sont le rail faux, dont la vérité est le minimum
  suivant. Problème de classement — c'est la zone des appareils de voie,
  où la pose ESV est loin (correction humaine médiane 56,6 mm sur la partie 20,
  > 40 mm pour 62 rails sur 95), et que la continuité de voie traite
  (amendement n°3).

## 6. Limites et chiffres annexes

- **P2 non mesurable** : un seul cut vu dans deux sessions (partie 18, 4815).
  Mais le moteur calé du §8 reproduit l'humain à 1,6 mm latéral et 1,1 mm
  vertical en médiane ; le bruit propre de l'humain ne peut pas dépasser cet
  écart. **Borne supérieure de P2 : ≈ 1,6 mm latéral, 1,1 mm vertical, médian.**
- **Temps moteur**, rejeu Node : médiane 152 ms par cut, p90 758 ms ; partie 20
  dense 520 ms, captures Pilote 2 844 ms. Hors engagement 4.8 ; donné pour la 4.9.
- Une seule journée de collecte, un seul opérateur, quatre parties.

## 7. Classes d'erreur et plus petit correctif

| Classe | Poids | Plus petit correctif | Statut |
|---|---|---|---|
| **Précision : convention enveloppe** | 100 % des placements appliqués ; écartement +4,5 mm | Calage : deux constantes apprises sur les validations | **Mené, §8** |
| Classement : appareils de voie | 16 cuts refusés + ambiguïtés ; partie 20 surtout | Continuité de voie (amendement n°3) | Observation hors ligne ; données d'autres parties requises |
| Preuve : flanc insuffisant | 60 rails, parties 13, 18, 19 | À instruire : accord avec la continuité ? | Non commencé ; attention aux rails faux de 17 mm (§4) |
| Justesse : erreurs appliquées | 0 | — | A1 sans objet |

## 8. Chantier mené : calage de convention

`src/placement-convention.js`, appliqué dans `src/gcv1-shadow.js` au rail
publié, après S1 et **avant** la garde d'écartement. Pour chaque rail publié :

- dessus : au 90e centile des points du dessus, **+ 1,0 mm** ;
- flanc : à la médiane des points du flanc, **− 2,6 mm** (côté voie) ;
- sous 6 points de flanc : aucune correction latérale ; sous 15 points de
  dessus, aucun calage ; au-delà de 8 mm de déplacement, aucun calage.

Deux constantes, ajustées par `tools/convention-fit.cjs` avec le module même qui
tourne dans le Pilote. Validation en retenant chaque session à tour de rôle
(ajustement sur les six autres) :

| Mesure (hors session d'ajustement) | Moteur 4.7.5 | Moteur calé |
|---|---|---|
| Latéral, médiane · p90 · max | 2,39 · 4,95 · 9,71 mm | **1,60** · 3,71 · 9,71 mm |
| Vertical, médiane · p90 · max | 2,83 · 6,14 · 8,00 mm | **1,13** · 2,84 · 7,00 mm |
| Écartement, médiane · p90 · max (76 cuts) | 4,67 · 8,25 · 11,03 mm | **2,34** · 5,24 · 7,85 mm |
| Biais : latéral · vertical · écartement | +2,1 · −2,8 · +4,5 mm | +0,3 · 0,0 · +0,4 mm |

Constantes stables d'une session retenue à l'autre : dessus +0,6 à +1,2 mm,
flanc −2,1 à −2,8 mm. Aucun rail ne franchit 10 mm (le pire reste à 9,7 mm,
inchangé). Un décalage latéral constant sous 6 points de flanc a été mesuré et
écarté : aucun gain (2,14 → 2,17 mm sur 38 rails) et un rail poussé au-delà de
10 mm.

Le calage ne choisit aucun candidat, ne connaît pas l'autre rail, ne vise aucun
écartement ; un rail non résolu le reste ; A_STAR, S1 et tous les seuils sont
inchangés, `geometry-candidate-v1.js` et `engine.js` intacts. La garde
d'écartement juge la paire calée. Chaque proposition porte le delta brut
(`gcv1.convention.rawDelta`).
