# P0 — mesures hors ligne (plan 5.0, lot P)

Trois mesures chiffrées, faites sans toucher au moteur (rien sous `src/`, `src/engine.js` intact) : (b) convention refusée et garde de paire, (a) graine contre intersection, (c) pente brute du flanc. Chacune a son outil sous `tools/` et son essai sous `tests/`. Chaque mesure se termine par une **recommandation** ; la décision reste à Mic. Elle touche D-044 (question 2 du cahier ; D-122 : « oui, si les mesures le justifient »).

| Mesure | Recommandation | Variante | Pourquoi, en un chiffre |
|---|---|---|---|
| **(b) Convention refusée** | **Changer** (P1, première moitié) | **Décalage plafonné à 8 mm** ; ne pas porter le domaine à 12 mm | Rails posés bruts : 36 % corrigés de plus de 10 mm par Mic (35 sur 98), 10 % avec le plafond (10 sur 98). Cuts posés corrigés de plus de 10 mm : 47 → 25 sur 188 |
| **(b) Garde de paire (D-044)** | **Ne pas changer** | — | Sans la garde, 4 à 5 cuts sur 12 seraient posés avec plus de 10 mm d'erreur ; aucune variante ne récupère des cuts sans mauvaise pose. La porte de P1 (≥ 50 sur 89, 0 mauvaise pose) est hors d'atteinte |
| **(a) Graine / intersection / moyenne** | **Ne pas changer** | La graine reste l'estimateur publié | L'intersection est plus éloignée de Mic de 1,9 mm en médiane (partie 17) et la moyenne de 0,6 mm ; à égalité sur la partie 20. Aucune classe de rail où un autre estimateur gagne. P5 : pas de trait M6 (AUC 0,55) ; corriger quand même AUDIT_SUPER_CERVEAU § 1 (S8) |
| **(c) Pente du flanc** | **Ne pas changer** (P2 : ne pas relâcher la borne, ne pas passer à la bande 14–30 mm) | — | Rails appliqués à pente 0,3–0,5 : 19 % corrigés de plus de 10 mm contre 10 % sous 0,3 ; graine des rails au-delà de 0,5 : 33 % à plus de 10 mm |

**Conséquence sur le plan** : P1 se réduit au seul plafond du décalage de convention (1 jour, rejeu des quatre lots) ; la garde de paire reste telle quelle. P2 n'a pas de raison d'être lancé sur ces mesures. P5 : le rapport se résume à « la graine » ; il reste à corriger la fiche d'audit.

---

## 1. Données utilisées

Tout vient d'un même projet ESV (D-123 : rien de ceci ne vaut pour un second projet tant qu'il n'est pas rejoué).

**Pose finale de Mic (la vérité terrain)**

- **Partie 17**, Écho du 14 octobre : 14 fichiers `ariane-native-v4-2026-10-14T08-31-15-auto-seg01.json` … `ariane-native-v4-2026-10-14T09-16-44-seg01.json` (1,3 Go). Jointure déjà faite avec le journal : `p17.json` (table de l'outil de jointure, 266 cuts joints sur 268). `jointure17.json` est la même table sans les poses et `coh17.json` le score de la fiche M6 : ni l'un ni l'autre n'a servi.
- **Partie 20**, session native du 23 septembre (4.7.6), 35 fichiers `banane-native-v4-2026-09-23T07-05-03-auto-seg01.json` … `banane-native-v4-2026-09-23T07-23-34-seg03.json`. C'est la seule « Écho 20 » trouvée. Elle précède le calage de convention, et la partie 20 a servi à ajuster ses deux constantes (audit du 22/09, autre session) : on s'en sert comme second jeu, pas comme jeu strictement indépendant pour la convention.
- **Partie 24**, Écho de 5 minutes : `seg01.json` (dossier `echo1`). Sept cuts joints avec référence (dont un seul rail refusé, aucun 'pair-guard') : « pour mémoire ».
- **Écho 18 : introuvable.** Aucun export Écho de la partie 18 sur la machine. La partie 18 n'a que son journal Orbite.

**Ce qu'Ariane a fait (journaux Orbite 4.9.0.x, avec nuages)**

| Lot | Journal | Corpus GCV1 |
|---|---|---|
| partie 17 | `ariane-journal-v4-1791961043712.json` | `ariane-gcv1-corpus-2026-10-14T06-57-26-seg01.json` à `seg05` |
| partie 24 | `ariane-journal-v4-1792049294982.json` | `ariane-gcv1-corpus-2026-10-15T07-28-20-seg01.json` à `seg06` |
| partie 26 (lot b) | `ariane-journal-v4-1792054421874.json` | `ariane-gcv1-corpus-2026-10-15T08-53-44-seg01.json` à `seg06` |
| parties 25–26 | `ariane-journal-v4-1792057530100.json` | `ariane-gcv1-corpus-2026-10-15T09-45-45-seg01.json` à `seg14` |
| partie 27 | `ariane-journal-v4-1792061427006.json` | `ariane-gcv1-corpus-2026-10-15T10-50-33-seg01.json` à `seg10` |
| partie 18 | `ariane-journal-v4-1791963286943.json` | `ariane-gcv1-corpus-2026-10-14T07-34-53-seg01.json` à `seg08` |
| partie 23 | `ariane-journal-v4-1791982131061.json` | (non rejoué) |
| partie 5 | `ariane-journal-v4-1791831094714.json` | (non rejoué) |

Les « quatre lots 4.9 » du cahier se retrouvent : parties 24, 26 (lot b), 25–26 et 27 pour les 405 différés (106 + 59 + 132 + 108) et les 89 'pair-guard' (35 + 6 + 27 + 21 événements, soit 84 cuts par la formule de la garde, 82 au journal) ; parties 24, 26 (lot b), 27 et 18 pour les 1 520 cuts posés et les « 410 rails » (390 dans des cuts posés au premier passage, 420 tous étages confondus ; le cahier arrondit à 410).

## 2. Méthode

**Une ligne par rail** (`tools/p0-commun.cjs`) : ce que le moteur d'ombre a publié, la convention (appliquée ou refusée, avec ses décalages `duMm` et `dzMm` que le journal consigne même refusés), l'étage et le motif de la décision du lot, les mesures de `Candidate.propose` (graine, intersection, pentes brutes), et la pose finale de Mic. Trois sources de lignes, de même forme :

1. **Journal d'Orbite + table de jointure** (partie 17) : ce qu'Ariane a réellement fait. La pose de Mic, dans le repère profil de la pose de départ d'ESV, est le déplacement d'Ariane plus l'écart humain (cut posé), ou l'écart mesuré à la première visite (cut différé). 456 rails sur 536 ont une référence.
2. **Rejeu de `Candidate.propose` sur les nuages du corpus GCV1** (même configuration que l'ombre : graine médiane, fenêtre recentrée, flanc partiel gardé). Contrôle : la graine rejouée retombe exactement sur le delta de l'étage A\* du journal sur 489 rails sur 489 ; l'écart de pose entre le delta publié du journal et la pose d'Ariane est de 0,3 mm en médiane (0,7 au plus) sur les cuts du premier passage.
3. **Rejeu d'un Écho** (parties 17 hors journal, 20) : l'Écho fournit le nuage et la pose de Mic ; seules 136 visites sur 814 (partie 17) ont un nuage complet (export compact), d'où 143 rails de référence hors journal. Les cuts « posés » de ces jeux sont **hypothétiques** (ceux que la garde actuelle ne signale pas).

**Erreur** = pose publiée (ou variante) moins pose de Mic, en millimètres, dans le repère profil du rail : verticale, latérale, 3D. « Mauvaise pose » = plus de 10 mm en 3D (le `WRONG_MM` de `convention-fit.cjs`). Pour un cut, l'erreur du pire rail. Les intervalles sont à 95 % par rééchantillonnage (graine fixe) ; le test des signes est exact, bilatéral.

**Variantes de la mesure (b)**, simulées à partir de la pose brute et des décalages consignés :

| | décalage appliqué | garde de paire |
|---|---|---|
| S0 | actuel : tout ou rien, domaine 8 mm | D-044 : un rail repêché par S1 et un calage hors domaine sur l'un des deux rails |
| S1 | plafonné à 8 mm par axe (le reste consigné) | actuelle |
| S2 | tout ou rien, domaine 12 mm | actuelle (domaine 12) |
| S3 | plafonné à 8 mm | portée par le seul rail repêché (le même rail repêché et hors domaine) |
| S4 | domaine 12 mm | seul rail repêché |
| S5 | plafonné à 8 mm | marge continue : rail repêché et dz > 10 mm |
| S6 | plafonné à 8 mm | aucune (borne haute de ce qu'on peut récupérer) |

L'écartement d'une pose récupérée est l'écartement publié plus la variation des décalages latéraux (somme des `duMm`, vérifiée à 0,3 mm près, 0,9 au pire, sur 239 paires rejouées) ; il doit rester dans le contrat 1420–1470 mm.

## 3. Mesure (b) — convention refusée et garde de paire

Outil : `tools/p0b-convention.cjs` ; essai : `tests/p0-mesures.test.cjs`.

### 3.1 Combien de rails, et le « biais de 9 mm »

Dans les huit journaux, 1 222 rails sur 6 689 rails candidats (18 %) portent `shift-out-of-domain` ; leur dz médian est de 9,4 mm (P10 8,3, P90 11,1, maximum 12,7). Presque tous sont verticaux (de 0 à 6 refus pour le latéral par lot).

**Le « 9 mm » est le décalage que la convention prédit, pas l'erreur réelle.** Sur les 98 rails refusés de la partie 17 que Mic a validés (posés bruts au premier passage), le rail brut est trop bas de **6,5 mm** en médiane (vertical signé −6,49), pas de 9 ; la valeur absolue médiane est de 7,1 mm.

Le déplacement vertical réel de Mic, rapporté au dz prédit (partie 17, 376 rails posés avec décalage) :

| dz prédit | rails | dz médian | Mic déplace de | rapport |
|---|---:|---:|---:|---:|
| < 2 mm | 69 | 0,8 | 1,0 | 1,2 |
| 2–4 | 73 | 3,1 | 3,5 | 1,1 |
| 4–6 | 72 | 5,0 | 4,6 | 0,9 |
| 6–8 | 63 | 7,1 | 3,3 | 0,5 |
| 8–10 | 73 | 8,9 | 5,9 | 0,7 |
| 10–12 | 26 | 10,6 | 6,9 | 0,7 |

La convention est juste jusqu'à 6 mm environ ; au-delà, dz exagère d'un tiers (pente de la régression 0,46 sur la partie 17, 0,58 sur l'ensemble des jeux). Un décalage de 9 à 11 mm appliqué en entier dépasserait donc la cible de 2 à 3 mm.

### 3.2 Rails refusés contre rails calés (partie 17, rails posés au premier passage, pose de Mic connue)

| Groupe | rails | vertical signé (méd.) | \|vertical\| méd. | 3D méd. | 3D P90 | > 5 mm | > 10 mm |
|---|---:|---:|---:|---:|---:|---:|---:|
| calés | 277 | −0,1 | 2,3 | 3,3 | 9,3 | 108 | 18 (6 %) |
| **refusés, posés bruts (aujourd'hui)** | **98** | **−6,5** | **7,1** | **8,1** | **13,9** | **75** | **35 (36 %)** |
| refusés, décalage plafonné à 8 mm | 98 | +1,5 | 4,5 | 4,9 | 9,9 | 48 | 10 (10 %) |
| refusés, domaine 12 mm / calage plein | 98 | +3,2 | 4,5 | 5,3 | 11,1 | 50 | 15 (15 %) |

L'intervalle à 95 % de l'erreur verticale absolue médiane est de 5,9 à 8,1 mm pour les refusés et de 1,1 à 3,7 mm pour les calés. Sur les mêmes rails, le plafond rapproche de Mic 62 rails et en éloigne 34 (Δ médian de l'erreur 3D −4,7 mm, intervalle −6,4 à −1,8, test des signes p = 0,006).

Balayage du plafond (rails refusés, partie 17) : sans calage, 35 rails à plus de 10 mm ; plafond 4 mm : 15 ; **6 mm : 9** ; **8 mm : 10** ; 10 mm : 15 ; sans plafond : 15. Le plateau va de 6 à 8 mm : on garde 8 mm, la borne actuelle du domaine.

Même sens ailleurs (petits effectifs) : 7 rails refusés hors journal (Écho 17) : −5,9 mm brut, 1 rail à plus de 10 mm avec le plafond contre 3 sans ; 3 rails refusés à la partie 20 : −8,0 mm brut, 0 mm de biais avec le plafond.

### 3.3 Les variantes de poses (partie 17, 188 cuts posés au premier passage avec Mic aux deux rails)

| Variante | cuts > 5 mm | cuts > 10 mm | face à S0 : > 5 mm gagnés / perdus | > 10 mm gagnés / perdus |
|---|---:|---:|---:|---:|
| S0 actuel | 128 | 47 (25 %) | — | — |
| **S1 plafond 8 mm** | **110** | **25 (13 %)** | **28 / 10** | **25 / 3** |
| S2 domaine 12 mm | 110 | 28 (15 %) | 28 / 10 | 26 / 7 |

Sur les trois jeux réunis (354 cuts) : S0 172 et 61 ; S1 152 et 37 (gagnés 32 et 28, perdus 12 et 4) ; S2 151 et 40 (33 et 29, perdus 12 et 8). Les variantes S3 à S6 ont les mêmes poses que S1 pour les cuts déjà posés : elles ne diffèrent que par les cuts récupérés. **Aucun cut posé aujourd'hui n'est différé par un plafond** (écartement hors contrat en plus : 0 sur 227). Le plafond bat le domaine 12 mm parce qu'un calage appliqué en entier à 10–12 mm dépasse la cible (paragraphe précédent).

Ampleur : environ 390 rails des quatre lots (14 % des rails posés au premier passage) seraient relevés, de 8 mm au plus (aujourd'hui : posés bruts, sans aucun décalage).

### 3.4 La garde de paire : amplitude de la correction de Mic

Douze cuts 'pair-guard' de la partie 17 ont tous la pose de Mic ; ajoutés les 3 hors journal et le 1 de la partie 20 : 15 cuts sur les 89 du cahier au total ont une référence. Ce qu'Ariane aurait posé sans la garde, mesuré à Mic (cuts, pire rail, partie 17) :

| Pose sans la garde | médiane | P90 | maximum | cuts > 5 mm | **cuts > 10 mm** |
|---|---:|---:|---:|---:|---:|
| brute (aucun calage) | 7,7 | 14,7 | 21,1 | 11 / 12 | 4 / 12 |
| celle du moteur aujourd'hui | 8,5 | 13,7 | 26,8 | 11 / 12 | **5 / 12** |
| décalage plafonné à 8 mm | 6,7 | 10,9 | 26,8 | 10 / 12 | 4 / 12 |

Trois jeux réunis (15 cuts) : 6 / 15 à plus de 10 mm en brut, 7 / 15 avec la pose actuelle, 5 / 15 plafonné ; maximum 50 mm.

**Lecture** : la correction de Mic dépasse 10 mm pour un tiers à deux cinquièmes de ces cuts, et 5 mm pour presque tous. À titre de comparaison, la part de cuts posés à plus de 10 mm est de 25 % aujourd'hui et de 13 % avec le plafond. La garde attrape donc une population nettement plus mauvaise que la moyenne, sans être infaillible : sur les 12, 7 à 8 cuts auraient été posés avec moins de 10 mm. L'ordre de grandeur de ce que S1 déplace sur le rail repêché est faible (médiane 2,1 mm).

### 3.5 Cuts 'pair-guard' récupérés par variante

Partie 17, 12 cuts, tous avec la pose de Mic (écartement dans le contrat dans tous les cas) :

| Variante | cuts récupérés | dont mauvaise pose (> 10 mm) | > 5 mm |
|---|---:|---:|---:|
| S0, S1 (garde inchangée) | 0 | — | — |
| S2 domaine 12 mm | 11 | **5** | 9 |
| S3 plafond + seul rail repêché | 5 | **3** | 4 |
| S4 domaine 12 + seul rail repêché | 11 | **5** | 9 |
| S5 plafond + marge continue (dz > 10) | 8 | **4** | 7 |
| S6 plafond, sans garde | 12 | **4** | 10 |

Comptage mécanique sur les quatre lots du cahier (84 cuts signalés par la formule, sans pose de Mic) : S2 et S4 récupèrent 83 (82 dans le contrat d'écartement), S3 28, S5 66, S6 84. Les variantes S2, S4, S5 et S6 passent donc le chiffre de la porte (≥ 50 sur 89), mais **aucune ne passe la seconde moitié (0 mauvaise pose)** : là où on peut vérifier, un cut récupéré sur trois (S6) à trois sur cinq (S3) est faux de plus de 10 mm. Aucun signal simple ne trie les bons des mauvais : l'écart de la pose du moteur à la prédiction des voisins, que la décision du lot consigne, ne distingue pas les cuts posés faux (AUC 0,53 sur 126 cuts posés qui en portent un, 34 corrigés de plus de 10 mm) ; deux des quatre cuts 'pair-guard' faux avaient un écart aux voisins de 3 à 6 mm.

### 3.6 Recommandation (b)

1. **Changer le décalage de convention : plafonner à 8 mm** (variante S1). Le reste du décalage est consigné (`conventionCalibration` garde déjà `duMm` et `dzMm`). Gain mesuré : cuts à plus de 10 mm 47 → 25 sur 188 (25 gagnés, 3 perdus), rails refusés à plus de 10 mm 35 → 10 sur 98. À éviter : élargir le domaine à 12 mm (moins bon, 28 cuts) ou appliquer le décalage en entier (15 rails sur 98 à plus de 10 mm).
2. **Ne pas toucher à la garde de paire (D-044).** Elle écarte des cuts dont un tiers à deux cinquièmes seraient posés à plus de 10 mm, contre 13 % des cuts posés avec le plafond ; même la variante la plus favorable (S6, plus de garde) poserait 4 cuts faux sur 12. Si l'on veut récupérer ces cuts, ce n'est pas la règle de la garde qu'il faut changer mais lui fournir une autre preuve (P3 « dessus seul », ou une pose voisine cohérente).
3. Porte de P1 : « ≥ 50 des 89 récupérés sans mauvaise pose » **non atteinte** sur les données qu'on a. Elle est atteinte en nombre (S2/S4/S5/S6) mais pas en justesse.
4. Activation : plafond seul → rejeu des quatre lots au banc sans régression, ce que la mesure ne remplace pas (les cuts dont la pose change modifient les appuis des suivants, voir les limites). Accord de Mic requis : le plafond change une règle de D-044 (le domaine de la garde reste à 8 mm, la garde elle-même est inchangée).

## 4. Mesure (a) — graine contre intersection contre moyenne

Outil : `tools/p0a-estimateurs.cjs`. Le moteur publie la **graine** du gabarit (`metrics.seed`) ; l'**intersection** des deux nappes ajustées (`metrics.surfaceIntersection`) est calculée et jetée ; la **moyenne** est le milieu des deux. Erreur 2D (latéral, vertical) à la pose de Mic, avant calage de convention.

Partie 17 (451 rails avec mesures et pose de Mic) :

| Estimateur | 2D médiane | P90 | rails > 10 mm | contre la graine, rail par rail |
|---|---:|---:|---:|---|
| **graine** | **6,4** | 13,9 | 94 | — |
| intersection | 8,4 | 15,5 | 161 | pire sur 319, meilleure sur 123 ; Δ médian +1,9 mm [1,5 ; 2,2], p < 0,001 |
| moyenne | 6,7 | 14,1 | 116 | pire sur 292, meilleure sur 146 ; Δ médian +0,6 mm [0,4 ; 0,9], p < 0,001 |

Partie 20 (365 rails) : graine 5,1 ; intersection 5,4 (Δ 0, [−0,14 ; 0,08], p = 0,79) ; moyenne 4,9 (meilleure sur 194, pire sur 138 ; Δ −0,13 mm [−0,26 ; −0,01], p = 0,002). Sur cette partie le nuage donne une intersection voisine de la graine (écart médian 2,9 mm contre 4,6 sur la 17).

Par classe de rail (jeux réunis, 959 rails) :

| Classe (points de flanc) | rails | intersection contre graine (Δ médian 2D) | moyenne contre graine |
|---|---:|---|---|
| fort (≥ 6) | 856 | **+0,9 mm** (pire sur 529 / meilleure sur 310) | +0,2 mm (471 / 360) |
| partiel (3 à 5) | 64 | **+1,3 mm** (43 / 21) | +0,2 mm (38 / 25) |
| nul (< 3) | 39 | identiques (intersection = graine quand il n'y a pas de flanc) | identiques |

Aucune classe ne donne un gagnant autre que la graine. La classe « passage à niveau » n'est pas mesurable : les numéros de cuts de passages à niveau ne sont pas connus (question 3 du cahier, réponse attendue). Après centrage du biais (retrancher à chaque estimateur sa médiane signée), les écarts se réduisent (moyenne −0,1 mm, intersection +0,6 mm) : la moyenne ne devient pas meilleure, elle devient égale.

**Trait de doute** (P5, si pas de gagnant) : |graine − intersection| prédit mal la correction de Mic : AUC 0,55 pour « pose publiée corrigée de plus de 10 mm » (376 rails, 53 corrigés), écart médian 4,6 mm si corrigé, 4,4 mm sinon. Les points de flanc (AUC 0,44) et la pente du flanc (0,58) ne font pas mieux. **Ce n'est pas un trait utile pour M6.**

### Recommandation (a)

**Ne pas changer.** La graine est l'estimateur publié ; ni l'intersection ni la moyenne ne la battent de façon cohérente d'une partie à l'autre (la moyenne gagne 0,1 mm sur la partie 20, perd 0,6 mm sur la 17). P5 : publier « la graine pour toutes les classes » ; ne pas ajouter |graine − intersection| au score M6. **Corriger AUDIT_SUPER_CERVEAU § 1** dans tous les cas (S8) : il décrit l'inverse du code (le delta publié est la graine, l'intersection n'est que diagnostic).

## 5. Mesure (c) — erreur par tranche de pente brute du flanc

Outil : `tools/p0c-pente.cjs`. Pente brute = `face.rawSlope` de `Candidate.propose` avant l'écrêtage à ±0,5 (la borne qui déclenche `slopeLimited`). Rails « appliqués » = publiés au premier passage (partie 17), ou publiables au rejeu (parties 17 hors journal et 20).

Répartition : pente brute du flanc médiane 0,11, P90 0,37, P99 0,61 ; 192 rails sur 1 179 au-dessus de 0,3 et 32 au-dessus de 0,5.

Erreur de la pose publiée (3D, mm), rails appliqués, jeux réunis :

| \|pente\| du flanc | rails appliqués | 3D médiane | P90 | > 10 mm | graine seule, tous rails de la tranche : 2D médiane (> 10 mm) |
|---|---:|---:|---:|---:|---|
| 0–0,1 | 370 | 2,4 | 9,8 | 36 (10 %) | 5,3 (69 sur 427) |
| 0,1–0,2 | 185 | 2,7 | 9,4 | 18 (10 %) | 6,0 (36 sur 209) |
| 0,2–0,3 | 111 | 3,6 | 10,0 | 12 (11 %) | 5,6 (28 sur 128) |
| **0,3–0,4** | 62 | 5,4 | 13,4 | 12 (19 %) | 6,3 (20 sur 79) |
| **0,4–0,5** | 39 | 4,4 | 11,6 | 7 (18 %) | 6,3 (12 sur 50) |
| **> 0,5 (jamais appliqué)** | 3 | — | — | — | 7,5 (9 sur 27, 33 %) |

Comparaisons (jeux réunis) : pose publiée des rails à pente 0,3–0,5 contre ceux sous 0,3 : médiane 4,9 mm contre 2,7 mm, 19 % contre 10 % à plus de 10 mm (AUC 0,62) ; partie 17 seule : 5,5 mm contre 4,7 mm sous 0,3, 22 % contre 13 % à plus de 10 mm ; partie 20 seule : 3,3 mm contre 1,9 mm. Pour la graine seule, l'écart n'est pas net (5,7 mm sous 0,3 contre 6,3 mm entre 0,3 et 0,5, AUC 0,53). **Au-delà de 0,5**, la graine des rails que le moteur refuse a une erreur médiane de 7,5 mm (contre 5,7) et un tiers à plus de 10 mm (AUC 0,66).

Variante « pente sur la seule bande 14–30 mm » : la pente de la bande est plus bruyante (69 rails au-dessus de 0,5 contre 32), et les tranches ne séparent pas mieux l'erreur. Elle ne fait pas mieux que la pente de 9 à 34 mm.

Cuts différés pour la pente (quatre lots, journal) : 83 portent le motif ; **70 sont bloqués par la seule pente du flanc** (le chiffre « 68 » du cahier) ; 41 d'entre eux auraient une pente de la bande 14–30 mm sous 0,5. Avec la pose de Mic (partie 17, 8 cuts bloqués par la seule pente) : si la borne était levée, la graine du pire rail serait à 7,7 mm en médiane, **2 cuts sur 8 à plus de 10 mm** ; sur les rails refusés par la seule pente, 8 sur 22 à plus de 10 mm (jeux réunis).

### Recommandation (c)

**Ne pas changer** : ne pas relâcher la borne du flanc (P2), ne pas passer à la bande 14–30 mm. La porte « pas de dégradation » n'est pas satisfaite : au-dessus de 0,3, la pose publiée est moins juste (19 % à plus de 10 mm contre 10 %), et la graine des rails refusés l'est encore moins. Le comptage mécanique laisserait récupérer environ 40 des 70 cuts, mais avec un quart de mauvaises poses sur le peu de cuts vérifiables. P2 n'est pas à lancer sur ces mesures ; à rouvrir si l'Écho de plusieurs parties donnait, pour la tranche 0,3–0,5, une erreur égale à celle des pentes faibles.

## 6. Limites

- **Un seul projet, une seule vraie partie d'Ariane avec Écho.** La pose de Mic existe pour la partie 17 (Orbite et Écho du même lot), un peu pour la 20 (session native de septembre, 4.7.6, partie qui a déjà servi à ajuster la convention) et la 24 (4 cuts). Les 98 rails refusés viennent presque tous de la partie 17 ; la partie 20 en a 3, la 24 en a 1. Des lots de rails plus usés ou moins usés donneront d'autres proportions (la partie 20 a 7 rails refusés sur 399).
- **Douze cuts 'pair-guard' avec référence** (quinze avec les autres jeux), sur 89 : les conclusions sur la garde sont des ordres de grandeur, pas une preuve. L'Écho de la partie 24 que Mic a fait avec les tests 19/20 (124 visites, 103 validations, D-122) n'est pas ici : il permettrait de juger trente-cinq autres cuts 'pair-guard'.
- **Simulation statique.** Une variante change la pose d'un cut, donc les appuis des cuts suivants (D-044 le notait : retirer un appui change les décisions suivantes) ; la chaîne n'est pas rejouée. La garde d'écartement voisin (± 20 mm) n'est pas rejouée ; seule l'admissibilité de l'écartement (1420–1470 mm) l'est, par une approximation de 0,3 mm. Le rejeu des quatre lots au banc reste obligatoire avant toute activation.
- **Mic n'a pas relu tous les cuts posés** : 38 des 230 cuts posés de la partie 17 sont « passés sans décision ». Sans référence, ils sortent des chiffres ; si Mic passe plus volontiers les cuts qui lui semblent justes, les erreurs sont légèrement surestimées. Depuis D-122, « inchangé » vaut « confirmé » pour les prochains Échos.
- **Référence de Mic = pose de la dernière validation**, pas une vérité de terrain indépendante (un écart de 2 à 3 mm est du bruit de pose manuelle). Seuil « mauvaise pose » = 10 mm en 3D, celui de `convention-fit.cjs`.
- **Rejeu d'Écho** : la partie 17 hors journal n'a que 136 visites sur 814 avec nuage complet ; les cuts « posés » de ces rejeux sont hypothétiques.
- **Classe passage à niveau absente** de (a) et (c) : numéros de cuts de PN inconnus. Au-delà de 0,5 on ne dispose que de 27 rails avec la pose de Mic.
- Les chiffres du cahier (410 rails, 89 'pair-guard', 68 'pente') sont retrouvés à quelques unités près ; les définitions exactes du cahier (quel étage, quel événement) ne sont pas écrites, d'où 390 / 420 pour 410, 82 cuts / 89 événements, 70 pour 68.

## 7. Ce qui manque

- **Écho 18** : aucun export trouvé. **Écho 24 long** (124 visites) : à rapatrier (D-122 point 5).
- Numéros de cuts de PN et d'ADV (question 3) pour la classe « passage à niveau » de (a) et (c).
- Un second projet ESV (D-123) pour savoir si le plafond de 8 mm tient hors de ce projet.
- Une relecture complète de la liste d'ESV après passage de Mic (idée 1) donnerait la pose de Mic pour les 89 cuts 'pair-guard' et les ~420 rails refusés, au lieu de 15 et ~110.

## 8. Reproduire

Lignes de chaque source (une fois, quelques minutes ; pour un Écho de 1 Go : `node --max-old-space-size=8000`) :

```
node tools/p0-commun.cjs --journal J.json --jointure table.json --corpus DOSSIER_CORPUS --etiquette LOT --sortie lignes-LOT.json
node tools/p0-commun.cjs --echo DOSSIER_ECHO --etiquette ECHO --sortie lignes-ECHO.json
```

Puis, sur une ou plusieurs sources (`--ensemble` ajoute les jeux réunis, `--json` donne tout le détail) :

```
node tools/p0b-convention.cjs --lignes lignes-LOT.json [lignes-ECHO.json] [--ensemble]
node tools/p0a-estimateurs.cjs --lignes lignes-LOT.json [--ensemble]
node tools/p0c-pente.cjs --lignes lignes-LOT.json [--ensemble]
```

La table de jointure vient de `node tools/jointure-echo-orbite.cjs --echo DOSSIER_ECHO --journal J.json --sortie table.json` (voir `fiches/JOINTURE_ECHO_ORBITE.md`). Aucune donnée brute n'est dans le dépôt : les lignes contiennent des déplacements en millimètres dans le repère du rail, jamais de coordonnée absolue, et l'essai (`tests/p0-mesures.test.cjs`) ne fonctionne que sur des lignes synthétiques et sur une capture déjà versionnée.
