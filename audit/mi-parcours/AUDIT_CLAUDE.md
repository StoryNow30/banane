# Audit à mi-parcours du cahier 4.8 — audit interne (Claude)

**23 septembre 2026.** Instantané : dépôt `banane`, commit `8ad1bec`, plus trois
mesures faites pour cet audit (scellées jusqu'au retour de l'audit indépendant) :
décomposition des différés, plafond de récupération, Pilote en deux passages.
Auteur : l'assistant qui a conduit le projet ; c'est une limite, d'où l'audit
indépendant en parallèle.

## 1. Verdict

L'objectif de 90 % n'est pas atteint et **ne le sera pas par la voie suivie
jusqu'ici**, qui ajoute des correctifs locaux de quelques points chacun. Mais
les données disent autre chose que « le moteur ne sait pas » : **dans la
majorité des différés, le moteur a calculé la bonne position et ne la choisit
pas**, parce qu'une coupe isolée ne permet pas de distinguer le rail de son
voisin (contre-rail, aiguille), et que la science gelée s'abstient à juste
titre. L'information qui tranche existe : c'est la voie, le long du lot. Le
cerveau doit passer de la décision coupe par coupe à la décision sur le lot.
Cela demande de lever, par amendement, la règle « la prédiction ne fait que
déplacer la fenêtre ».

## 2. Où en est-on

| Mesure | Valeur | Source |
|---|---|---|
| Pilote terrain 4.7.6, partie 19 | 15 cuts appliqués sur 29 (52 %) | collecte 23/09 matin |
| Banc, cuts avec entrée moteur, 10 sessions | 362 appliqués sur 567 (64 %) | `brain-audit-2026-09-22/23.json` |
| Banc, cuts sans entrée moteur | 326 sur 893 (37 %) | idem |
| Faux appliqués (> 10 mm) | 0/76 (22/09), 8/118 (23/09, partie 20), 0/70 (partie 24) | amendements n°4, n°6 ; audit partie 24 |
| Précision des justes après calage | latéral 1,3 mm, vertical 0,7–0,9 mm | amendements n°6, n°8 |

Qualité : tenue et améliorée. Couverture : loin du compte, et très variable
selon la partie (31 à 97 % des cuts avec entrée).

## 3. D'où viennent les différés

### 3.1 Sur le terrain, le Pilote ne manque presque jamais de points

Les 13 cuts différés du Pilote 4.7.6 sur la partie 19 (9241 exclu à la
demande de l'opérateur) :

| Cause | Cuts | Points sur le rail en cause |
|---|---|---|
| Ambiguïté d'un rail, l'autre résolu | 6 | dessus 84 à 122, flanc 7 à 11 |
| Écartement hors contrat (1 286 à 1 311 mm : un rail sur le champignon voisin) | 4 | dessus 76 à 112, flanc 11 à 17 |
| Écartement à 1 471 mm (1 mm au-delà du contrat) | 1 | — |
| Flanc et dessus insuffisants | 1 | flanc 0, dessus 4 et 15 |
| Aucune donnée | 1 | — |

**11 sur 13 sont des problèmes de choix, pas d'observation.**

### 3.2 Sur le banc, la bonne position est presque toujours calculée

Rails en abstention ou refusés par l'écartement, référence humaine fiable,
10 sessions (205 rails) :

| Où est la vraie position ? | Rails | Part |
|---|---|---|
| Meilleur minimum du moteur (rang 0) | 104 | 51 % |
| Deuxième minimum (rang 1) | 52 | 25 % |
| Rang 2 ou plus | 6 | 3 % |
| Aucun minimum à 10 mm ou moins | 13 | 6 % |
| Hors de la fenêtre de recherche (pose ESV trop loin) | 30 | 15 % |

Par motif : les refus d'écartement ont la vérité au rang 0 ou 1 pour 59 rails
sur 80 (l'autre rail a pris le mauvais champignon) ; les ambiguïtés, 23 sur
28 ; le manque de flanc, 44 sur 52 ; `minTop`, 24 sur 37.

La partie 24 (4.7.7, mesurée après coup, moteur tel que le Pilote l'exécute)
confirme : 83 cuts appliqués sur 124 avec entrée (67 %), 0 faux, 52 cuts sans
entrée sur 176 (30 %) ; parmi les rails non appliqués jugés, la vérité est au
rang 0 ou 1 pour 43 sur 52, hors fenêtre pour 7.

**Plafond** : parmi les cuts non appliqués et jugeables, 96 sur 142 (68 %) ont
la vérité au rang 0 ou 1 sur leurs deux rails. Si ce ratio vaut pour tous les
non appliqués, un choix parfait porterait la couverture des cuts avec entrée de
64 % à environ 88 %. Un choix parfait n'existe pas ; le plafond réaliste est
plus bas, mais **l'essentiel du chemin vers 90 % est du choix**.

### 3.3 Le tiers sans entrée est d'abord un artefact du banc Natif

37 % des cuts du banc n'ont pas d'entrée moteur : aucun instantané « qualifié ».
La qualification est centrée sur la pose ESV (±18 cm utiles) ; quand la pose
ESV est loin du rail, l'instantané n'est pas qualifié alors que la capture
(±40 cm) contient le rail — c'est ce qu'a montré la partie 22. Le Pilote lit
toute la zone chargée et n'a pas ce filtre. Le banc sous-estime donc ce que le
Pilote peut faire, et il ne mesure pas la même chose que le terrain.

## 4. Ce qui a marché

- Le calage de convention : un vrai gain de qualité, validé sur cuts inédits.
- La garde d'écartement : elle arrête les mauvais champignons ; aucun faux
  appliqué sur la partie 24.
- L'ingénierie : reproductibilité (parité Pilote 29/29, observation 176/176),
  collecte robuste, exports complets.
- La continuité : sur 357 cuts jugés (entrée corrigée), 177 justes et 6 faux
  depuis la pose ESV contre 209 et 3 par continuité ; et, sans aucune position
  humaine, un Pilote en deux passages avec garde fait 222 justes et 4 faux
  contre 199 et 7 sur 392 cuts jugés (mesure de cet audit, §6).

## 5. Ce qui n'a pas marché

1. **La doctrine « le plus petit apprentissage » a produit des rustines.**
   Flanc partiel, calage, amorce : chacun juste, chacun de quelques points.
   Aucun n'attaque la cause dominante, le choix entre champignons.
2. **Le gel de la science empêche de traiter cette cause.** La fenêtre est
   centrée sur la pose ESV, la garde d'ambiguïté s'abstient dès que deux minima
   sont proches en perte, et la règle du n°3 interdit à la continuité de faire
   plus que déplacer la fenêtre. Ces trois règles sont prudentes une par une ;
   ensemble, elles interdisent d'utiliser la seule information qui tranche.
3. **On a beaucoup mesuré hors ligne, peu sur le terrain.** Une seule mesure
   Pilote depuis la 4.7.6 (29 cuts). L'engagement porte sur des lots Pilote ;
   la plupart des preuves viennent de rejeux Natif, dont l'entrée diffère.
4. **La conduite a été trop rapide.** Huit amendements en deux jours ;
   plusieurs affirmations corrigées après coup (P5 « 0 sur 76 » puis 8 sur 118 ;
   l'étude de continuité, relue et corrigée ; « 9 faux devenus justes », en
   réalité 7). La relecture indépendante a été la bonne réponse ; elle doit
   devenir la règle avant toute conclusion.
5. **Le dénominateur de C1 n'est pas fixé.** « Cuts d'un lot » au §2, « cuts
   avec entrée » ou « cuts jugés » dans les relevés : on ne compare pas les
   mêmes choses d'un amendement à l'autre.
6. **P2 n'est toujours pas mesuré**, et un seul opérateur fournit toutes les
   références.

## 6. Mesure faite pour cet audit : le Pilote en deux passages

Sans aucune position humaine, même entrée que la 4.7.7, jugé aux règles du
banc. Premier passage depuis la pose ESV ; garde de continuité sur les cuts
appliqués (voisins appliqués à ±3 numéros, des deux côtés, > 30 mm → retiré) ;
second passage des cuts non appliqués depuis la droite des voisins retenus,
jamais depuis un cut du second passage.

| Session | Jugés | Pose ESV seule | Deux passages | Retirés par la garde |
|---|---|---|---|---|
| Partie 22 | 8 | 0 juste · 0 faux | 3 · 0 | 0 |
| Partie 20 courte | 52 | 31 · 0 | 31 · 0 | 0 |
| Partie 19 relecture | 25 | 11 · 0 | 13 · 0 | 0 |
| Partie 24 | 119 | 70 · 0 | 78 · 0 | 1 (juste) |
| Partie 20 longue | 188 | 87 · 7 | 97 · 4 | 4 (4 faux) |
| **Total** | **392** | **199 · 7** | **222 · 4** | 5 |

La garde retire 4 faux sur 5 retraits (398, 400, 402, 405). Restent faux : 241,
409 et 983, que la garde n'a pas contredits, et 407 (second passage, 144 mm).
Couverture des cuts jugés : 51 % → 57 %. **Utile, sûr, insuffisant** : le
second passage ne fait que déplacer la fenêtre ; il ne tranche pas les
ambiguïtés.

## 7. Recommandations, par gain attendu

1. **Décider sur le lot, pas sur la coupe** (gain attendu : le plus grand).
   Utiliser la continuité de POSITION comme critère de choix entre les minima
   que le moteur calcule déjà, sur les cuts ambigus ou refusés par
   l'écartement, dans un second passage après le lot, avec voisins des deux
   côtés et garde. Ce n'est pas une cible d'écartement : c'est la position du
   champignon, prédite par la voie. Demande un amendement levant la règle « la
   prédiction ne fait que déplacer la fenêtre ». À mesurer d'abord hors ligne
   sur les 142 cuts jugés (plafond 96).
2. **Mesurer sur le terrain, en Pilote.** Deux ou trois lots Pilote sur des
   parties à appareils de voie, relus en Natif. Fixer C1 sur les cuts du lot
   Pilote, dénominateur écrit, et le rapporter par partie.
3. **Aligner le banc sur le Pilote.** Retirer du banc le filtre de
   qualification centré sur la pose ESV, ou le rapporter à part ; sinon le
   tiers « sans entrée » brouille toute conclusion.
4. **Mesurer P2** (30 cuts replacés en aveugle), sans quoi aucune cible d'erreur
   n'est publiable.
5. **Objectif** : garder 90 % comme cap, mais déclarer un objectif
   intermédiaire vérifiable — 80 % des cuts de lots Pilote, 0 faux au-delà de
   10 mm — et ne revenir à 90 % qu'après la mesure de la recommandation 1.
