# Examen de la partie 2:13 (projet 2, partie 13) — 19 octobre 2026

Test 8 (4.9.5.8, branche `claude/50-relecture-couverture`, `d58a6f1`). Partie neuve, donc **réservée** : elle est jugée avec les réglages figés, **aucun réglage n'a changé, rien sous `src/` n'a changé**, `src/engine.js` non touché, aucun commit. Les chiffres ne portent que des numéros de cut et des millimètres. Les heures sont celles de Paris. Même méthode que `EXAMEN_2-7.md`. 2:13 n'est **pas** ajoutée au compteur (l'orchestrateur s'en charge).

## 0. En bref

- **« Ça n'a rien lu » : cause donnée par Mic, confirmée par les données.** Mic avait l'Écho sur une autre fenêtre que celle où il travaillait. La relecture, elle, a bien lu : 79 cuts lus et 10 corrigés avant l'export de 12 h 45, sans erreur. L'Écho n'a rien enregistré pendant les 10,8 premières minutes (8 événements, 1 capture), puis il a été rechargé et la vraie revisite commence à 12 h 59.
- **La relecture n'était pas finie à l'export** : elle en était au cut 3606, 79 cuts sur 118. Elle n'a pas été coupée par l'Écho (le panneau refuse l'Écho tant qu'elle tourne). Tout indique qu'elle a repris et fini avant 12 h 46 56, mais **aucun export ne la montre** (pas de `relecture-fin`).
- **Les 3 PN étaient dans la sélection, avec leurs marges, mais la passe n'y était pas arrivée à l'export** (3606 contre 6622). Les 30 cuts de PN à lire étaient dans les 39 cuts restants.
- **Ce que l'Écho ne montre pas** : la pose de départ de la revisite était déjà déplacée sur au moins **55 cuts** (50 cuts dont 2 différés, plus 5 posés d'Orbite), dont **6 de plus de 10 mm** sûrs (3533, 3600, 3605, 3607 à 3609) et 8 autres possibles. L'Écho n'en voit que 16, dont 2 de plus de 10 mm. **L'étiquette Écho sous-estime donc la correction de Mic sur ces cuts** (§ 1.5).
- **Marge d'ADV** : Ariane 3501 (30 avant la première alerte 3531), Mic 3488 (43 avant), RM-2 aurait donné 3491 : **non, pas 3488** (3 cuts de moins). La zone d'ADV 3598 à 3705 de Mic n'est ouverte ni par le livré ni par RM-2 (§ 4).
- **Une question pour Mic** en fin de § 1.

## 1. Diagnostic « ça n'a rien lu »

Méthode : faits du journal et de l'Écho, une hypothèse à la fois, une preuve par hypothèse. Après le message du coordinateur, la cause (mauvaise fenêtre) est donnée ; je ne cherche plus de défaut de ce côté-là. Je garde les faits qui la confirment et les deux constats demandés.

### 1.1 La chronologie

| Heure | Fait | Source |
|---|---|---|
| 12:40:03 | Le lot démarre ; la relecture « corriger » est figée dans son scope | `batch-started` |
| 12:40:06 | Liste d'ESV du départ : 9 751 validés, 21 invalides, total 9 772 | liste, départ de partie |
| 12:41:57,5 | Fin du lot : dernier cut 9254 validé en place (Ctrl+Entrée) ; 19 posés, 2 différés (3533, 3600) | `batch-stopped-at-end` |
| 12:41:57,9 | La relecture part seule : mode « corriger », 118 cuts à lire dans 11 plages, 19 cuts du lot traversés, 373 s annoncées | `relecture-debut` |
| 12:42:05 | Première lecture (cut 0) | `relecture-ombre` |
| 12:44:14 | Plage ADV 3501–3563 finie : 62 cuts lus, 3 corrigés | |
| 12:44:17 à 12:44:50 | Plage écartement 3575–3582 : 8 lus, 6 corrigés | |
| 12:44:52 à 12:45:09 | Abords du différé 3598–3602 (5 lus), puis 3605 et 3606 (3606 corrigé à 12:45:09,096) | |
| **12:45:09,5** | **Export du lot**, pendant la capture du cut 3607 | dernier événement du journal |
| **12:46:56,8** | **L'Écho démarre ; ESV affiche le cut 9260** | Écho, période 1 |
| 12:46:56 à 12:57:41 | Période 1 de l'Écho : 8 événements, 1 capture en 10,8 minutes ; une seule visite, au cut 9260 | `observationPeriods` |
| 12:57:43 à 12:59:08 | Page rechargée (période 2) | |
| 12:59:21 | Période 3 : la vraie revisite. Visites des cuts 0, 1, 2, puis 3488 à 12:59:55 | |
| 13:02:30 | Première écriture vue par l'Écho (« vu » d'ESV) | |
| 13:07:45 | Fin de l'Écho : 267 visites, 254 cuts | |

La période 3 compte 6 161 événements et 481 captures en 8,4 minutes. La période 1 en compte 8. C'est la signature d'un Écho posé sur une fenêtre où personne ne travaille.

### 1.2 Les hypothèses, une à une

| Hypothèse | Verdict | Preuve |
|---|---|---|
| La relecture n'a pas démarré | **Non** | `relecture-debut` à 12:41:57,9, 8 s après la fin du lot |
| Elle a démarré mais n'a rien lu | **Non** | 79 `relecture-ombre`, 79 captures, 85 `goToCut`, 0 erreur de capture ou de calcul, 0 SKIP |
| Elle a lu sans poser | **Non** | 10 corrections : 10 `apply`, 10 `validerMajEspace`, 10 écritures « valid » 2xx d'ESV sur les cuts 3528, 3529, 3534, 3576, 3578 à 3582 et 3606 ; ESV est resté sur le même cut ; 0 garde refusée, 0 correction refusée |
| Elle s'est arrêtée sur une erreur | **Non** | Aucun événement d'arrêt, de panne ni de `relecture-fin`. Rythme régulier : 2,36 s par cut, écart médian 1,7 s, plus long écart 9,1 s |
| Le mode Écho coupe la relecture | **Non, c'est l'inverse** | `native-start` est dans `PENDANT_RETOUR`, donc dans `RELECTURE_BLOQUE` (`background.js`, lignes 1923 et 2023) : le panneau **refuse** l'Écho tant que la passe tourne. Seul « Arrêter » l'arrête. Que l'Écho ait démarré à 12:46:56 veut dire que la passe était déjà finie ou arrêtée |
| L'Écho n'a pas de nuages | **Non** | 1 891 objets de nuage dans les 7 segments des sauvegardes automatiques, 1 408 avec `pointsSceneRelative` ; 223 cuts sur 254 calculables (88 %) ; médiane de 5 morceaux de nuage et 2 198 points par rail à la première visite |
| Les captures sont anormales | **Non** | Voir § 1.4 |
| **Mic regardait une autre fenêtre** | **Retenue** (donnée par Mic) | Période 1 vide, ESV au 9260 (dernier cut de la sélection) à 12:46:56, page rechargée à 12:57:43, revisite à 12:59:21 ; poses de départ déjà déplacées (§ 1.5) |

### 1.3 Pourquoi « 78 sur 118 »

L'export a été pris **au milieu de la passe**, pendant la capture du cut 3607. Le résumé du lot (CONTENU.txt) dit 78 relus et 9 corrigés ; le journal, écrit un instant plus tard, a 79 lectures et 10 corrections. L'écart est le cut 3606, corrigé à 12:45:09,096 : le résumé a été lu juste avant. Il restait **39 cuts** : 3607 à 3609, 3610, 3612, 3656 à 3659, et les 30 cuts de PN (6622–6637, 7738–7750, 9244–9260, sans les cuts posés par le lot).

Après l'export, **la passe a très probablement repris et fini** (elle n'a jamais été arrêtée par l'export). Trois indices, aucune preuve directe :

1. L'Écho ne démarre pas tant que la passe tourne : elle était finie ou arrêtée à 12:46:56.
2. ESV affichait alors le cut **9260**, qui est le dernier cut de la dernière plage (PN 9244–9260). Un arrêt par « Arrêter » l'aurait laissé près du cut 3607. Le temps colle : 39 cuts à 2,36 s font environ 92 s, plus les sauts entre plages ; l'Écho démarre 107 s après l'export.
3. Des cuts hors des notes de Mic étaient déjà affichés avant la revisite, et sont exactement des cuts de la passe : 6622, 6636, 6637, 7738, 9244, 9259, 9260 (bords des plages de PN, hors de ce que Mic note) et l'îlot 3656–3659, entouré de cuts jamais affichés (3613–3655 et 3660–3705). ESV n'écrit « vu » qu'à la première apparition d'un cut ; l'Écho n'en a écrit aucun sur ces cuts. Réserve : Mic a pu regarder un peu plus large que ses notes dans l'autre fenêtre.

Ce que la passe a **fait** après l'export (corrigé ou non) est inconnu : il n'y a aucun journal après 12:45:09,5.

### 1.4 L'Écho de 2:13 contre celui de 2:7 du matin (même version 4.9.5.8)

| | 2:13 (13 h) | 2:7 (matin) |
|---|---|---|
| Visites, durée d'écoute | 267, 20,8 min | 1 106, 153,2 min |
| Captures par visite | 1,81 | 1,64 |
| Captures échouées, dégradation | 0, niveau FULL seul | 0, niveaux FULL et DEGRADED |
| Premier état qualifié par rail (gauche / droit) | 86 % / 78 % | 68 % / 62 % |
| Latence médiane de la première capture qualifiée (gauche / droite) | 205 / 392 ms | 375 / 660 ms |
| Cuts sans nuage | 31 sur 254 (12 %) | 259 sur 960 (27 %) |
| Fin de capture par `RESOURCE_LIMIT` | 163 sur 483 (34 %) | 379 sur 1 809 (21 %) |

Les captures sont **normales, voire meilleures**. Seule différence : plus de captures coupées par la limite de ressources, ce qui va avec le rythme de la revisite (1,9 s par visite).

### 1.5 Constat 2 : les corrections de Mic que l'Écho ne peut pas montrer

**Méthode.** La liste d'ESV de 12:40:06 donne la pose de chaque cut avant le lot. Sur les 91 cuts que l'Écho a affichés pour la première fois (ESV a écrit « vu » à sa visite), la pose de départ de l'Écho égale la liste à **0,06 mm** près : la comparaison est donc fiable. Pour les 162 cuts déjà affichés avant la revisite, l'écart entre la pose de départ de l'Écho et la liste dit ce qui a bougé avant 12:59.

| Cuts déjà affichés, pose de départ changée de plus de 1 mm | Cuts | ≥ 10 mm | 5 à 10 mm | 1 à 5 mm |
|---|--:|--:|--:|--:|
| Posés par Orbite (déplacement du lot) | 19 | 18 | 0 | 1 |
| Corrigés par la passe avant l'export | 10 | 10 | 0 | 0 |
| **Mic, autre fenêtre (sûr)** : la passe n'a pas pu les écrire | **50** | **6** | 12 | 32 |
| Possibles (cuts que la passe pouvait corriger après l'export) | 19 | 8 | 2 | 9 |
| Total | 98 | | | |

- **Les 6 sûrs de plus de 10 mm** : 3533 (36,5 mm, différé), 3600 (45,3 mm, différé), 3605 (10,4 mm, le moteur ne pose rien), 3607 (29,0), 3608 (31,3), 3609 (31,8) (zone « à contrôler », où la passe ne corrige jamais).
- **Les 8 possibles de plus de 10 mm** : 3610 (21,7), 3658 (28,1), 7741 (36,4), 7745 (33,3), 7746 (34,0), 7747 (27,8), 7748 (30,3), 7749 (38,6). La passe pouvait les corriger après l'export (PN, abords, écartement) ; Mic aussi. Je ne peux pas les séparer (voir la question).
- **Cinq cuts posés par Orbite** ont une pose de départ qui s'écarte de la pose d'Orbite : 3611 (6,8 mm, rail gauche), 6626 (5,5 et 2,8), 7742 (7,5 et 4,2), 7743 (3,1), 9248 (3,9). Les 14 autres posés sont à la pose d'Orbite à 0,1 mm près. Ce sont des bornes basses (je compare des longueurs, pas des vecteurs).
- **Les petites corrections** (« de l'ordre de quelques mm », dit Mic) sont là : 44 cuts de 1 à 7,6 mm, dont 27 relus par la passe (de 2,1 à 6,2 mm). Pour ces 27, le déplacement vaut le « pire écart » que la passe avait calculé à 0,4 mm près (médiane, maximum 2,7 mm). Ce sont des recentrages à la pose du moteur, sous le seuil de 8 mm de la règle.
- Les cuts de Mic dans l'autre fenêtre se lisent aussi dans ce qu'ESV a déjà affiché : 3488 à 3500 et 3564 à 3572, hors de la sélection de la passe, étaient affichés avant la revisite, et 3573 et 3574 ne l'étaient pas. Mic s'était arrêté à 3572, comme il le note.

**Conséquence pour l'étiquette.** Sur ces cuts, la revisite part d'une pose déjà corrigée. L'Écho voit « visité sans action », donc une correction de **0 mm**, alors que la correction réelle est celle du tableau. Exemples : 3533 et 3600 sont étiquetés 0 mm ou sans référence, pour 36,5 et 45,3 mm. **La correction mesurée dans l'Écho est sous-estimée** sur au moins 55 cuts (50 cuts dont 2 différés, 5 posés), jusqu'à 19 de plus. Si 2:13 entre un jour au compteur, il faut compter ces cuts avec la pose de la liste de 12:40, ou les laisser de côté. Le fichier `table-par-cut.json` donne, cut par cut, l'écart « départ de l'Écho contre liste de 12:40 ».

### 1.6 Ce que j'ai vérifié en plus (pas des causes de « rien lu »)

**« Cuts d'Ariane mémorisés : 18 » alors que le lot a 21 invalides : normal, avec un petit défaut.**
- 21 invalides = 19 posés + 2 différés. Les différés n'écrivent rien : 19 écritures attendues.
- La mémoire en garde 18. Le 19e, le cut 9254 (validé en place), a écrit sa ligne à 12:41:58,036, soit 0,4 s **après** que le lot est passé à `STOPPED` (12:41:57,611). `listeNoterEcriture` (`background.js`, ligne 1380) ne note que si le lot est `RUNNING`.
- Pour la même raison, les 10 écritures de la passe (état `STOPPED`) ne sont jamais mémorisées.
- **Défaut mineur, prouvé.** Effet : la comparaison « liste relue contre bords écrits par Ariane » ne verra ni le dernier cut du lot ni les corrections de la passe, ce qui est justement ce que la fiche attend pour savoir si Mic a repris les corrections d'Ariane. **Sans effet sur « rien lu ».**
- **Correctif proposé (non appliqué)** : dans `listeNoterEcriture`, accepter aussi `dansGrace(b)` (la fenêtre qui suit la fin du lot) et `relecture.passe?.etat==='en-cours'`, avec `partie: b.scope.part`.
- **Essai qui le reproduirait** : une variante de `tests/relecture-sw-corriger.test.cjs` avec un lot de quelques cuts dont le dernier est validé en place après `STOPPED`, puis une correction de la passe ; après la passe, `LM.resume(...).memorises` doit valoir (poses + 1 + corrections). Aujourd'hui il vaut poses seules.

**Cut 0 : « différé » à tort dans la table (outil, sans effet sur la pose).** `construireTable` (`tools/relecture-autonome.cjs`, ligne 322) classe « différé » tout cut qui a une décision sans validation. Le cut 0 était vert au départ (événements `depart-sur-vert`) : la table compte 3 différés au lieu de 2. Correctif proposé : ne classer « différé » que les cuts de `closureSummary.deferredCuts` (ici 3533 et 3600). Dans cet examen, je traite le cut 0 comme un vert.

**Rejeu hors ligne contre passe en direct.** Sur les 22 cuts comparables, le rejeu hors ligne et le « pire écart » de la passe s'accordent à 0,1 mm (médiane, cuts dont le départ n'a pas bougé), sauf le cut **3540** : 2,0 mm en direct, 10,5 mm hors ligne. Les appuis de la chaîne diffèrent. C'est l'unique « action » de la règle figée (§ 5.4).

### 1.7 Cause la plus probable, et ce qui reste incertain

**Cause.** L'Écho était attaché à une fenêtre où Mic ne travaillait pas ; il a enregistré 8 événements en 10,8 minutes. La relecture, elle, a fonctionné. Aucun défaut de la relecture ou de l'Écho n'explique « rien lu ».

**Incertain.**
- Ce que la passe a lu et corrigé **après** 12:45:09,5 (pas de journal).
- Qui a corrigé les 8 cuts « possibles » du § 1.5 (3610, 3658, 7741, 7745 à 7749).
- La part de la revisite faite dans l'autre fenêtre, avant 12:59.

### 1.8 Question pour Mic

> **Quand tu as lancé l'Écho, vers 12 h 47, que disait la carte « Relecture » ? Elle disait « Relecture finie : N cuts relus, X corrigés » ? Si oui, quels sont N et X ?**
>
> Si X vaut 10, la passe n'a rien corrigé après l'export : les PN 7741 et 7745 à 7749 sont tes corrections. Si X est plus grand (jusqu'à 18), la passe a corrigé des cuts de PN et d'abords après l'export. N vaut 118 si elle a fini.

## 2. Pourquoi les 3 PN n'ont pas été contrôlés

| | PN 1 | PN 2 | PN 3 |
|---|---|---|---|
| Notes de Mic | 6623–6635 | 7739–7752 | 9245–9258 |
| Cœur vu par le lot (règles métier) | 6626–6631 (cœur confirmé au 6627) | 7742–7744 (confirmé au 7743) | 9248–9254 (confirmé au 9249) |
| Cuts posés par le lot dans le cœur | 6 | 3 | 7 |
| Plage de contrôle (4 avant, 6 après) | 6622–6637 | 7738–7750 | 9244–9260 |
| Dans la sélection de la relecture | 13 sur 13 | **12 sur 14** (7751 et 7752 manquent) | 14 sur 14 |
| Cuts de la plage lus par la passe avant l'export | **0** | **0** | **0** |
| Verts « à contrôler » listés par Ariane | 6625, 6632 | 7740, 7741, 7745 à 7749 | 9247, 9255 |

- **Le détecteur de PN les a vus pendant le lot.** Les 3 cœurs sont ouverts par les cuts posés (`regles-metier-ombre` : « cœur » puis « cœur non confirmé » sur le premier cut de chaque PN). L'Écho confirme : le détecteur retrouve **3 PN sur 3**, 41 cuts de PN sur 41, aucune zone de PN sans PN de Mic.
- **Le lot a lu des cuts dans ces plages** : 6 + 3 + 7 = 16 cuts posés (déplacements de 26 à 43 mm). La règle `pn-chaque-cut` aurait différé 13 d'entre eux ; elle est en ombre. Mic a laissé ces poses : sur les 5 cuts de PN qu'il a visités assez longtemps (6631, 7742, 9249, 9252, 9253), l'Écho dit 0 mm.
- **Les verts de ces plages sont dans la sélection** (plages `pn`, 10 cuts à lire dans chacune), avec marge avant et après. Mic va 2 cuts plus loin que la marge sur le PN 2 (7751, 7752) : c'est le seul trou de couverture.
- **La passe n'y était pas arrivée à l'export** : elle en était au 3606, les plages de PN viennent en dernier. Position atteinte 3606 contre 6623 : **0 cut de PN lu avant l'export**. C'est la réponse à « oubliés » : à 12:45 les verts de PN n'étaient pas encore lus. Ils étaient prévus.
- **Après l'export** : probablement lus (§ 1.3). Sur les verts de PN, les cuts qui avaient une grosse erreur d'origine sont 7741 et 7745 à 7749 (28 à 39 mm de décalage de départ à la revisite). Ariane les avait **tous listés** « à contrôler », en tête de sa liste (score 4,3 à 2,0). Ils étaient déjà corrigés quand l'Écho est arrivé ; on ne sait pas par qui.
- Dans les PN 1 et 3, les verts n'avaient pas de grosse erreur : au plus 5,0 mm de déplacement (6623, 6632 à 6635, 9246, 9247, 9256, 9258), et 4,3 mm corrigés dans l'Écho au cut 9260.

## 3. Rouges isolés

Rouges isolés du lot : les cuts 1, 3531 et 3611 (posés) et les **deux différés** 3533 et 3600. Les trois grappes (6626–6631, 7742–7744, 9248–9254) ne sont pas isolées. Le cut 0 était vert au départ.

| Cut | Lot | Ce qu'en a fait la relecture | Ce qu'en a fait Mic (mm) |
|---|---|---|---|
| **3533** (différé) | Différé : gauche ambigu | Lu comme différé : jamais touché (règle) ; pas de pose du moteur. Voisin 3534 corrigé (13,7 mm), 3532 lu sans pose possible | **36,5 mm** de décalage déjà fait à la revisite (autre fenêtre) ; l'Écho voit 0 mm. 3532 : 7,6 mm. 3534 : repris de 0 mm dans l'Écho |
| **3600** (différé) | Différé, isolé | 5 cuts lus (3598 à 3602), aucun corrigé. Le moteur voyait 43,3 mm au cut 3600, mais la règle interdit un différé | **45,3 mm** déjà faits (même ordre que le moteur) ; l'Écho : visite trop courte. Voisins : 3599 5,3 mm, 3601 4,3 mm, 3598 et 3602 inchangés |
| 3531 | Posé 36,6 mm, paire avec 3533 | Traversé. 3530 lu (2,5 mm, rien) ; 3532 lu sans pose | 0,0 mm (visite d'1 s, aucun geste) ; 3530 : 0,0 ; 3532 : 7,6 |
| 3611 | Posé 44,1 mm | Plage 3610–3612 **non lue à l'export** (en attente derrière 3606) | Rail gauche déplacé de 6,8 mm en plus d'Orbite avant la revisite. Voisins déjà très déplacés : 3607 29,0 ; 3608 31,3 ; 3609 31,8 ; 3610 21,7 ; 3612 8,3 |
| 1 | Posé 3,6 mm | Traversé ; 0 et 2 lus (écarts moteur 2,2 et 4,4 mm), rien corrigé | 0,0 mm ; voisins 0 et 2 : 2,6 et 3,1 mm avant la revisite |

Lecture. Les deux différés valent 36,5 et 45,3 mm : le lot a eu raison de les différer. La relecture ne peut pas les corriger, et ne l'a pas fait. **Les verts 3607 à 3609, juste avant 3610 et 3611, sont à 29 à 32 mm et dans la liste « à contrôler » (zone `vert-hors-zone`) : la passe les lit mais ne corrige jamais cette zone** (choix de D-180). Parmi les grosses erreurs que la sélection voyait, ce sont avec 3577 (18,1 mm) et 3605 (10,4 mm), où le moteur ne pose rien, celles que la règle ne pouvait pas écrire.

## 4. Marges d'ADV

Alertes « rail de plus » vues par le lot : 3531 (2 rails, non confirmée), 3533 (1 rail, confirme la zone), 3611 (1 rail, seule). Le lot ne capture que ses 21 rouges : les cuts verts autour ne donnent aucune alerte. C'est pourquoi la zone du lot est étroite.

| En cuts | Début | Fin | Avant la 1re alerte (3531) | Après la dernière (3533) |
|---|--:|--:|--:|--:|
| Ariane, marges livrées (30 / 30) | **3501** | 3563 | 30 | 30 |
| RM-2 proposé (40 / 30) | **3491** | 3563 | 40 | 30 |
| Mic | **3488** | 3572 | 43 | 39 |
| Mic moins livré | 13 cuts de plus | 9 de plus | | |
| Mic moins RM-2 | **3 cuts de plus** (3488 à 3490) | 9 de plus (3564 à 3572) | | |

- **La proposition de RM-2 n'aurait pas donné 3488.** Elle donne 3491, à 3 cuts. Pour atteindre 3488 depuis 3531, il faut 43 cuts. C'est plus que les 13 à 31 cuts relevés dans les notes de Mic des parties précédentes (RM-2 § 1) : 2:13 est du côté long.
- À la fin, RM-2 ne change rien (30 après) : 3563 contre 3572 chez Mic.
- Sur les captures de l'Écho (qui voient aussi les verts), la première alerte est à 3526 : les marges livrées donnent 3496 (8 cuts de moins que Mic), RM-2 donne **3486, qui couvre 3488**. La dernière alerte (3661) plus 30 donne 3691 pour une fin de zone de Mic à 3705 (14 cuts de moins). Le détecteur sur l'Écho relie les deux zones de Mic en une plage 3496–3691.
- **Zone 3598–3705 de Mic** : le lot n'a qu'une alerte seule (3611), donc ni le livré ni RM-2 (`alerteSeule: false`, prolongement à 30 cuts : 3611 est à 48 cuts de la zone) n'ouvrent cette zone. Elle est couverte à 17 cuts sur 108 seulement par le plan réel de la passe (abords des rouges, cut isolé 3611, zones d'écartement) ; l'outil de RM-2 n'a pas la zone d'écartement, d'où ses 8 cuts ci-dessous. Les 91 cuts de 3613 à 3655 et de 3660 à 3705 n'avaient **jamais été affichés** avant la revisite. L'outil de RM-2 (`marges-zones.cjs notes`, lecture seule) : zone 3488–3572 couverte à 63 puis 73 cuts sur 85 (livré, proposé) ; zone 3598–3705 à 8 puis 12 sur 108.
- Pour la fin de zone, Mic termine 39 cuts après la dernière alerte, contre 11 à 22 dans ses notes précédentes : lui aussi du côté long.
- Mic note aussi : « le contrôle est pas mal avec une prise de marge commençant à 3501 ». La fin à 3572 n'est pas atteinte (3563).
- 2:13 est réservée : je n'ai rien réglé.

## 5. Bilan chiffré

### Données

- Écho de Mic (4.9.5.8) : 267 visites, 254 cuts, 5 zips (4 sauvegardes automatiques, 7 segments, plus l'export final). Pose finale de Mic (règle de Mic : visité 0,8 s ou plus sans geste = correction nulle) pour **101 cuts** : 19 validations observées et 82 visites sans geste. 149 visites trop courtes, 3 après un rechargement de page, 1 hors cut : sans pose finale.
- Lot Orbite : 21 invalides au départ (9 751 validés, 21 invalides, total 9 772), dont 19 posés et 2 différés. Jointure : 22 cuts du journal joints (les 21, plus le cut 0). La translation entre les deux repères est constante, 38 paires, résidu médian 0,0 mm : l'Écho et le lot sont bien la même partie.
- Écart de Mic = le plus grand des deux rails, en 3D, repère profil, **mesuré dans l'Écho** (donc depuis la pose de départ de la revisite). Voir § 1.5 pour ce qui s'est passé avant.
- 31 cuts de l'Écho sans nuage.

### Zones de Mic (notes du jour)

- ADV : 3488–3572 (85 cuts) et 3598–3705 (108 cuts). Aucune aiguille notée.
- PN : 6623–6635, 7739–7752, 9245–9258 (13, 14 et 14 cuts).
- Mic a visité dans l'Écho : 0–2, 3488–3582, 3598–3705, 6622–6637, 7738–7752, 9244–9260 (254 cuts).

### 5.1 Orbite contre Mic (les 21 invalides)

| | Cuts | Pose finale par l'Écho | Écart vu par l'Écho | Écart avec la pose de départ de la revisite (borne basse) |
|---|--:|--:|---|---|
| Posés par Orbite | 19 | 6 (3531, 6631, 7742, 9249, 9252, 9253) | 0,0 mm sur les 6 | 14 cuts à 0,0 ; 5 déplacés de 3,1 à 7,5 mm ; **3 au-dessus de 5 mm** (3611, 6626, 7742) ; **0 au-dessus de 10 mm** |
| Différés par Orbite | 2 | 1 (3533, 0 mm) | 0 mm (étiquette « visité sans action ») | **36,5 mm et 45,3 mm** : les 2 au-dessus de 10 mm |

- **Orbite a posé 19 cuts, aucun à plus de 10 mm de Mic** (borne basse), 14 à l'identique et 3 au-dessus de 5 mm (16 %, 2:7 : 13,8 %). Comme en 2:6, aucun posé au-dessus de 10 mm. Échantillon petit : 19 cuts.
- **Orbite a différé 2 cuts ; les deux demandent plus de 10 mm.** Comme en 2:7, le lot a raison de différer.
- Les poses d'Orbite dans les PN déplacent le rail de 26 à 43 mm : Mic les a peu reprises (4 d'entre elles de 3 à 8 mm : 6626, 7742, 7743, 9248).

### 5.2 Les verts qu'Orbite n'a pas touchés (223 cuts vus par Mic, hors cuts corrigés par la passe)

| | Écho seul | Avec la pose de départ de la revisite (borne basse) |
|---|--:|--:|
| Corrigés (au moins 1 mm) | 15 | 82 |
| Au-dessus de 5 mm | 2 | 27 |
| Au-dessus de 10 mm | **2** (3577 : 18,1 ; 3657 : 26,2) | **14** |

Les 14 au-dessus de 10 mm (borne basse) : 3577 (18,1), 3605 (10,4), 3607 à 3609 (29,0, 31,3, 31,8), 3610 (21,7), 3657 (26,2), 3658 (28,1), 7741 (36,4), 7745 à 7749 (33,3, 34,0, 27,8, 30,3, 38,6). Six sont hors de portée de la passe (3577, 3605, 3607 à 3609, 3657) ; 8 sont dans le groupe « possibles » du § 1.5.

Les corrections vues par l'Écho : 16 cuts avec une étiquette « corrigé » (13 de 1,6 à 4,9 mm ; 3580 à 9,5 mm ; 3577 à 18,1 ; 3657 à 26,2). **13 sont dans la zone d'ADV 3573–3662 que personne n'avait lue** (11 dans 3613–3662, 2 dans 3573–3574).

### 5.3 La relecture « corriger »

| | Valeur |
|---|--:|
| Cuts à lire (plan) | 118 (11 plages) |
| Cuts lus à l'export | **79** au journal (78 sur la carte) |
| Corrigés | **10** au journal (9 sur la carte), par zone : ADV 3 sur 62, écartement 7 sur 10, abords 0 sur 7 |
| Écarts écrits (pire écart avant correction) | 12,1 à 28,0 mm (médiane 23,6) |
| Erreurs, gardes refusées, corrections refusées | 0 |
| Restait à lire | 39 (dont 30 de PN) |

**Justes contre Mic.** Les 10 cuts corrigés ont, à la revisite, une pose de départ égale à celle de la passe à 2,2 mm près : Mic ne les avait pas retouchés dans l'autre fenêtre. Dans l'Écho :

| Corrigés par la passe | Cuts | Écart de Mic dans l'Écho |
|---|--:|---|
| Pose finale de Mic connue | 6 | 3534, 3578, 3579, 3581, 3582 à **0 mm** ; 3580 à **9,5 mm** (rail gauche) |
| Visite trop courte, aucun geste | 4 | 3528, 3529, 3576, 3606 : inconnu (aucune reprise vue) |

- **6 sur 6 à 10 mm ou moins de Mic, 5 sur 6 à 5 mm ou moins**, erreur 0 sur 6 (borne de Wilson à 95 % : ≤ 39,0 %). 4 non mesurés.
- **Les 69 cuts lus et non corrigés** : 67 verts et 2 différés (3533, 3600). Pour 30 des 67 verts, Mic a déplacé la pose avant la revisite : 27 recentrages de 2,1 à 6,2 mm (sous le seuil de 8 mm de la règle, rien à reprocher), et 3 cuts où le moteur ne pose rien (3532, 3577, 3605). **Laissés à plus de 10 mm : 4** — 3577 (18,1) et 3605 (10,4) parce que le moteur ne pose rien, et les 2 différés (3533, 3600) que la règle interdit. **Aucun cut posable n'a été laissé faux.**

### 5.4 La règle prudente figée

Règle figée (`datasets/reglages-figes.json`, `datasets/relecture-reglages-proposes.json`) : variante `chaine+h`, agir à 8 mm ou plus, 45 mm au plus en travers, écartement à 15 mm de la médiane, jamais sur un cut posé ou différé par le lot. Outil : `relecture-autonome.cjs juger --juger-partie-reservee`, table du lot.

| | Valeur |
|---|--:|
| Cuts mesurables (pose du moteur et pose de Mic, dans la sélection hors ligne) | 40 |
| Grosses corrections de Mic parmi eux (> 10 mm) | **0** |
| Actions de la règle | 1 |
| Reproduites à 5 mm / 10 mm | 0 / 0 |
| Cuts abîmés | 1 (le cut 3540 : Mic 0 mm, la règle 10,5 mm) |
| Mauvaises voies (> 50 mm) | 0 |
| Erreur parmi les actions | 1 sur 1, Wilson ≤ 100 % |
| Abstentions, laissées fausses | 7, 0 |
| Pour mémoire, règle à 3 mm | 8 actions, 0 reproduite, 1 abîmé |

- **Ce jugement ne juge rien.** Aucune grosse correction n'est mesurable dans les 40 cuts. Sur les 14 grosses corrections de verts (§ 5.2), 3 ont une pose finale dans l'Écho mais sont hors de la sélection hors ligne (3577, 3657, 3658 ; pour 3658 l'Écho voit 0 mm, la pose de départ étant déjà déplacée) et 11 n'ont pas de pose finale (visites trop courtes : 3605, 3607 à 3610, 7741, 7745 à 7749).
- **L'« abîmé » du cut 3540 est un désaccord entre le rejeu et la passe réelle** : en direct, la passe a lu 3540 à 2,0 mm et n'a rien fait (§ 1.6). Le rejeu hors ligne ne reproduit pas ce cas.
- **La passe réelle** (la règle en service) a fait 10 actions : 6 mesurées contre Mic, 0 erreur (§ 5.3). Porte figée (0 mauvaise voie, erreur ≤ 9 %) : 0 mauvaise voie, **tenue** ; erreur de 0 sur 6 mesurées, **non démontrée** (il faut 39 actions sans erreur).

### 5.5 Les zones contre les notes de Mic

Détecteur de zones lu sur les captures de l'Écho (`regles-metier.cjs echo`, ADV `adv-rail-de-plus-v1`). Les aiguilles ne sont pas notées par Mic ; j'ai posé un repère au centre des alertes du lot (3532 et 3611) pour que l'outil tourne. Cela ne change que le classement « noyau / marge » des alertes.

| | Résultat |
|---|---|
| PN de Mic retrouvés | **3 sur 3** ; 41 cuts de PN sur 41 ; 0 zone sans PN ; 3 cœurs seuls non confirmés (6626, 7742, 9248) |
| Zones d'ADV de Mic retrouvées | **2 sur 2** ; 171 cuts de Mic sur 193 couverts |
| Plages d'ADV sans zone de Mic | 0 (une seule plage, 3496–3691, qui relie les deux zones de Mic) |
| Alertes noyau / marge / PN / hors zone | 28 sur 40 / 26 sur 127 / **0 sur 37** / 6 sur 19 (3573 à 3575, 3579 à 3581) |
| PN pris pour de l'ADV | Non : 0 alerte dans les cuts de PN |

Sur la sélection **du lot seul** (ce que la passe a réellement lu) :

| Zone de Mic | Cuts | Dans la sélection | Lus ou posés avant l'export | Vus par Mic |
|---|--:|--:|--:|--:|
| ADV 3488–3572 | 85 | 63 | 63 | 85 |
| ADV 3598–3705 | 108 | **17** | 8 | 108 |
| PN 6623–6635 | 13 | 13 | 6 (les posés) | 13 |
| PN 7739–7752 | 14 | 12 | 3 (les posés) | 14 |
| PN 9245–9258 | 14 | 14 | 7 (les posés) | 14 |

Autres constats :
- **Le gros écart est la zone d'ADV 3598–3705**, ouverte par une alerte seule. Sur l'Écho, le détecteur la voit.
- **La zone d'écartement 3575–3582, hors des notes de Mic**, contenait de vraies erreurs : la passe en a corrigé 6 (3576, 3578 à 3582 ; 12,1 à 25,7 mm) : 5 mesurés dans l'Écho (4 à 0 mm, 1 à 9,5 mm) et 1 non mesuré. Mic a corrigé 3577 (18,1 mm), où le moteur ne pose rien.
- Le détecteur lève aussi 6 alertes dans le trou 3573–3597, entre les deux zones de Mic (3573 à 3575, 3579 à 3581).

### 5.6 Les grosses corrections hors zone

Seize cuts ont une correction de Mic de plus de 10 mm (Écho et départ déplacé, borne basse), hors cuts du lot et hors corrections de la passe : 3533, 3577, 3600, 3605, 3607, 3608, 3609, 3610, 3657, 3658, 7741, 7745, 7746, 7747, 7748, 7749.

- **Hors de la sélection de la passe : 0.** Les 16 sont dans les 118 cuts prévus.
- Pourquoi la passe n'en a corrigé aucun : 2 différés (3533, 3600), 2 verts sans pose du moteur (3577, 3605), 3 verts en zone « à contrôler » où elle ne corrige jamais (3607 à 3609), 1 abstention du moteur (3657), 8 non lus à l'export (3610, 3658, 7741, 7745 à 7749).
- Par zone de Mic : ADV 3488–3572 : 1 (3533) ; ADV 3598–3705 : 8 (3600, 3605, 3607 à 3610, 3657, 3658) ; PN 7739–7752 : 6 ; hors notes : 1 (3577).
- Dans la zone 3598–3705, l'Écho voit les petites corrections des cuts que personne n'avait lus (3613 à 3620 et 3660 à 3662, 1,6 à 4,9 mm).

## Lecture

- « Rien lu » : **fausse alerte de fenêtre**, pas de défaut. La relecture a lu 79 cuts en 3 minutes, posé 10 corrections avec preuve, et n'était pas finie à l'export. Elle semble avoir fini avant l'Écho.
- Les 3 PN étaient prévus, avec marges, et pas lus à 12:45. À la revisite, leurs verts à grosse erreur (7741, 7745 à 7749) étaient corrigés ; on ne sait pas par qui.
- Les deux différés (3533, 3600) ont été corrigés de 36,5 et 45,3 mm par Mic dans l'autre fenêtre. L'Écho les voit à 0 mm : **l'étiquette sous-estime**.
- Pour l'ADV : 2:13 a une marge longue chez Mic (43 cuts avant). RM-2 la rate de 3 cuts, et ne voit pas du tout la zone 3598–3705, qui n'a qu'une alerte seule au lot.
- La relecture « corriger » : 10 corrections, 6 mesurées dans l'Écho, toutes à 10 mm ou moins de Mic. Peu de cas pour la porte.

## Limites

- Une partie, un seul opérateur ; 10 corrections, 6 mesurées.
- Les corrections faites dans l'autre fenêtre sont lues par la **pose de départ** de la revisite comparée à la liste d'ESV de 12:40. Je compare des longueurs de déplacement, pas des vecteurs : les chiffres sont des bornes basses. Pour les cuts que ni Mic ni la passe ne signent (19 « possibles »), l'auteur est inconnu.
- Aucun journal après 12:45:09,5. Ce que la passe a fait de 12:45 à 12:46 n'est lu que par ses traces dans l'Écho.
- 149 visites de l'Écho sont trop courtes (< 0,8 s) : pas de pose finale. 13 des 19 posés d'Orbite sont dans ce cas.
- La zone 3598–3705 vient des notes de Mic sans aiguille ; la zone 3488–3572 compte la marge de Mic. Les notes ne disent pas si 3598 est un début de marge ou un début de zone ; j'ai lu les deux plages comme « avec marges », comme dans les notes des autres parties.
- La table `table-2-13.json` compte le cut 0 comme différé (§ 1.6).
- Les chiffres « avec lot » et « Écho seul » ne se comparent pas à la lettre : les cuts du lot sont exclus de la règle.

## Fichiers gardés

Dans le dossier de travail (hors dépôt, ils portent des bords de rail) : `cas-2-13.jsonl` (cas extraits) et `table-2-13.json` (table avec lot). S'y ajoutent `table-par-cut.json` (numéros de cut et millimètres seulement), `scripts/` et ce fichier. Les extractions (lot, Écho, jointure, jeu, rejeux) sont effacées.

## Rejouer

```
python3 -I -c "import zipfile; zipfile.ZipFile('<zip du lot>').extractall('lot')"
node --max-old-space-size=9000 tools/relecture-autonome.cjs extraire --partie 2:13 --echo "<dossier Écho>" --sortie cas-2-13.jsonl
node --max-old-space-size=9000 tools/relecture-autonome.cjs table --partie 2:13 --echo "<dossier Écho>" --journal lot/ariane-journal-v4-*.json --cas cas-2-13.jsonl --sortie table-2-13.json
node tools/jointure-echo-orbite.cjs --echo "<dossier Écho>" --journal lot/ariane-journal-v4-*.json --partie 13 --visite-sans-action-bonne --sortie jointure.json
node tools/relecture-autonome.cjs juger --reglages datasets/relecture-reglages-proposes.json --partie 2:13 --cas cas-2-13.jsonl --table table-2-13.json --juger-partie-reservee
node tools/jeu-apprentissage.cjs --jointure jointure.json --avec-hors-journal --sortie jeu.jsonl
node tools/regles-metier.cjs echo --partie 2:13 --echo "<dossier Écho>" --jeu jeu.jsonl --pn 6623-6635,7739-7752,9245-9258 --adv 3488-3572:3532,3598-3705:3611 --juger-partie-reservee
node tools/marges-zones.cjs notes --proposition datasets/marges-zones-proposees.json --partie 2:13 --cas cas-2-13.jsonl --table table-2-13.json --notes notes-2-13.json --juger-partie-reservee   # arbre RM-2
```

Les scripts de ce dossier (`scripts/`) lisent le journal, l'Écho et la liste d'ESV de 12:40 ; ils ne sortent que des numéros de cut et des millimètres : `j1`–`j6` (journal du lot), `e1`–`e3` (Écho), `vu.cjs`, `dep.cjs`, `analyse.cjs`, `bilan.cjs`, `cachees.cjs`, `zones.cjs`.
