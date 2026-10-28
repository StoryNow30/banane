# Causes des différés restants, 28/10/2026 (CH-007)

Outil : `node tools/diag-differes-causes.cjs --journal …` (lecture seule, le dossier vient de l'argument). Essai : `tests/diag-differes-causes.test.cjs`, 2/2, journal fictif. Les chiffres de la population 4.9.5.19 (cache du 23/10) ne sont pas mélangés à ceux-ci : autre version, population déjà servie au réglage de la garde.

## Population

Huit lots, versions 4.9.5.21 (parties 15 à 20), 4.9.5.22 (partie 0), 4.9.5.23 (partie 1). Journaux des collections `2026-10-26_v4.9.5.21_*`, `2026-10-26_v4.9.5.22_partie-0-lot`, `2026-10-26_v4.9.5.23_partie-1-lot`. Ce sont les parties déjà analysées dans `banane-data/outils/analyse-lots/` (p15, p1617, p182019, p01). Les archives 7z plus anciennes ne sont pas relues.

**1 344 cibles, 79 différés, 5,9 %.** Un cut hors cibles : partie 1, cut 0, premier passage non validé (le lot s'ouvre sur un cut déjà vert). Fragments : 0.

| Partie | Version | Différés / cibles |
|---|---|---|
| 15 | 4.9.5.21 | 1 / 46 |
| 16 | 4.9.5.21 | 0 / 108 |
| 17 | 4.9.5.21 | 2 / 43 |
| 18 | 4.9.5.21 | 5 / 83 |
| 19 | 4.9.5.21 | 0 / 13 |
| 20 | 4.9.5.21 | 4 / 74 |
| 0 | 4.9.5.22 | 39 / 597 |
| 1 | 4.9.5.23 | 28 / 380 |

## Causes

Une cause par différé. « Récupérable » veut dire : la passe a décidé « poserait » sans garde bloquante dans l'événement, ou la molette a échoué avec un glisser dans la limite. Ce n'est pas un jugement contre l'opérateur.

| Cause | Nombre | Part des cibles | Part des 79 | Récupérable |
|---|--:|--:|--:|---|
| passe-poserait | 28 | 2,1 % | 35 % | oui |
| ambiguïté | 15 | 1,1 % | 19 % | non |
| dessus insuffisant (`minTop`) | 15 | 1,1 % | 19 % | non |
| écartement hors contrat | 13 | 1,0 % | 16 % | non |
| nuage absent | 6 | 0,4 % | 8 % | non |
| pente | 1 | 0,1 % | 1 % | non |
| repère | 1 | 0,1 % | 1 % | non |

Motif du lot derrière les 28 « poserait » : sans appui 21, reprise sans minimum 7. Garde dans l'événement : 9 cuts (partie 1), 0 bloqué (5 `loin-du-depart`, 4 `appui-normal`). Les 19 autres n'ont pas de champ `garde` (la garde n'était pas encore journalisée).

Le reste a tous un « rien » de la passe. Les plus nombreux : `depart-le-plus-probable` (ambiguïté 6, dessus 8, écartement 5, nuage 3, pente 1) et `sans-approche` (ambiguïté 4, dessus 5, écartement 3, nuage 1, repère 1).

**ÉTABLI** : ces comptes, relus sur les journaux. **ÉTABLI par les rapports du 26/10, non recalculé ici** (`outils/analyse-lots/p01`, `p1617`, `p182019`) : les 28 « poserait » sont à ≤ 20 mm de la pose finale pour 25, entre 20 et 50 mm pour 3 (21,0 ; 21,4 ; 22,5), 0 au-dessus de 50 mm ; la garde recalculée en bloque 1, une pose juste (partie 20, 3,6 mm).

La molette n'est pas une cause de ces 79. Deux gestes seulement dans ces journaux (partie 0 cut 1651, partie 1 cut 2135), caméra immobile les deux fois. 1651 n'est pas resté différé. 2135 est dans les 28 « poserait ». Le gain de la vue est sur la 4.9.5.19 : `fiches/DIAG_DEPLACEMENT_VUE.md`.

## Ordre que les mesures suggèrent

Sous 5 % des 1 344 : au plus 67 différés, donc 12 à reprendre. Sous 3 % : au plus 40, donc 39 à reprendre.

1. **Écriture de la passe sur les 28 « poserait ».** 79 − 28 = 51, soit **3,8 %**. Sous 5 %, pas sous 3 %. Avec la garde du rapport (1 bloquée) : 52, soit 3,9 %, même lecture. L'écriture reste coupée (D-251) : ce chantier ne la rallume pas.
2. **Onze cuts manquent encore pour 3 %.** Les deux tas les plus gros que la passe laisse sont l'ambiguïté et le dessus insuffisant (15 chacun). Aucun levier déjà dans le journal ne les pose. Régler un seuil de `minTop` sur cette population n'est pas proposé : elle sert ici à l'examen du taux, pas au réglage.
3. **Nuage absent, 6 cuts** : non récupérables par un geste ou une passe (le rapport p01 en compte 5 à 0–2 points, plus le cut 4655 de la partie 15).
4. **Molette → glisser** : le patch de `fiches/DIAG_DEPLACEMENT_VUE.md`. Sur ces huit lots il ne change pas le 5,9 %. Sur la partie 0 du 23/10 il vise les 17 cuts hors-vue.
