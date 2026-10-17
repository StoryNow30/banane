# Relecture autonome : ce qu'Ariane peut corriger seule (5.0, 17 octobre 2026)

Chantier `claude/50-zones-autonomes`, parti de `claude/50-base` (2d60d04). Cap de Mic (D-170) : « Ariane doit savoir faire elle-même la relecture que je fais en Écho ». Condition de la test 7 (D-173) : les règles métier doivent **agir**, pas seulement rester en ombre. Cette fiche dit, chiffres à l'appui, quelles corrections Ariane peut faire seule sans risque, et avec quels seuils.

Étude **hors ligne** : rien n'est changé à l'extension, aucune action dans ESV. `src/engine.js` n'est pas touché.

Conventions :
- les parties sont désignées par leur rang : « 1:29 » veut dire projet 1, partie 29 ;
- une **correction de Mic** est l'écart entre la pose que montrait ESV et sa dernière validation (pire des deux rails, en 3D). Un cut visité 0,8 s ou plus sans action compte comme une correction nulle (règle de Mic) ;
- **reproduit à 5 mm / à 10 mm** : la pose d'Ariane tombe à 5 / 10 mm de celle de Mic ;
- **correction juste** : Mic a corrigé de plus de 10 mm, et Ariane arrive à 10 mm de lui ;
- **cut abîmé** : Ariane agit sur un cut juste (Mic à 10 mm au plus) et le met à plus de 10 mm, ou elle aggrave un cut faux de plus de 5 mm ;
- **mauvaise voie** : Ariane agit et sa pose est à plus de 50 mm de celle de Mic (même seuil que G1) ;
- **erreur** : Ariane agit et sa pose reste à plus de 10 mm de Mic (porte du cahier : 9 % au plus) ;
- **abstention** : la décision d'Ariane diffère (pas de pose sûre). Ariane ne touche pas le cut.

## 1. En bref

| Question | Réponse |
|---|---|
| **Couverture** | La sélection « méthode de Mic » contient **94 %** des corrections de Mic de plus de 10 mm (625 sur 665) et 90 % de celles de plus de 5 mm. Ce qui tombe dehors : 40 corrections, **toutes sur des verts, toutes verticales, de 10 à 25 mm**, surtout en partie 17 (32). |
| **Reproduction (chiffre central)** | Sans règle, sur les cuts de la sélection qu'on peut rejouer : Ariane reproduit à 10 mm près **122 des 351** corrections de Mic de plus de 10 mm (en chaîne), abîme **9** cuts sur 1 445 et s'abstient sur 582. Elle **pose sur la mauvaise voie 4 fois** si on la laisse agir sur les cuts différés par le lot (partie 1 du second projet). |
| **Règle prudente** | Agir seulement si la pose d'Ariane s'écarte de la pose actuelle d'**au moins 8 mm**, sans déplacer un rail de **plus de 45 mm en travers**, avec un écartement à **15 mm au plus** de la médiane de la partie et une confiance présente, **sur un vert seulement** (jamais un cut posé ou différé par le lot). En validation croisée : **79 corrections justes, 0 mauvaise voie, 6 cuts abîmés sur 1 445** (0,4 %). |
| **Par type de zone** | **PN : 36 corrections justes sur 36 actions, 0 erreur, 0 abîmé** (borne haute 9,6 %). ADV : 11 justes sur 17, 18 % d'erreurs. Abords : 30 sur 37, 14 % d'erreurs. Verts hors zone : 2 actions seulement. |
| **SKIP** | Mic a écrit 25 SKIP dans les Échos qui portent les écritures. Aux cuts 0 à 3, la règle « aucun point » en retrouve **1 sur 4** (le cut 0). La moitié « un seul scanner » **ne se mesure pas** : tous les scanners arrivent dans un seul nuage d'ESV. |
| **Coût** | Toute la sélection : 117 à 781 verts en plus par partie, soit **3,5 à 31 minutes** de visites d'Ariane (7 à 47 minutes de Mic à 3,6 s). Les seuls PN : **0 à 4,6 minutes** par partie. |
| **Jugement (parties réservées 1:25 et 1:11)** | 0 mauvaise voie. Règle de service, toutes zones : 9 actions, 6 corrections justes, 1 cut abîmé (une erreur : 11 %, borne haute 43,5 %). Zone PN seule : **3 actions, 3 corrections justes, 0 erreur**. Trop peu d'actions pour démontrer la porte des 9 % : il en faut au moins 39 sans erreur. |
| **Test 7** | **Peut agir : la correction des verts de PN**, avec les seuils ci-dessus. **Reste en ombre** : ADV, abords, verts hors zone, tout cut du lot, et le SKIP. |

## 2. Données et méthode

### 2.1 Parties

- **Apprentissage** (manifeste des parties) : 1:12, 1:13, 1:17, 1:24, 1:29 et 2:1. Elles seules servent à régler.
- **Réservées avec une Écho** : 1:25 (lot Orbite 4.8.5.1 du 29/09, Écho de Mic le même jour) et 1:11 (deux lots Orbite 4.7.20 et 4.8.0, Écho du 28/09). Ce sont les seules réservées qui ont une Écho : les parties 2 à 9 du second projet n'en ont pas encore. Elles ne servent qu'au jugement, après le gel des réglages (commit `fde3d43`). Leurs cas ont été extraits avant le gel, mais aucun résultat n'en a été lu avant.

### 2.2 Ce qu'on rejoue, cut par cut

Pour chaque cut que Mic a visité dans l'Écho (`tools/relecture-autonome.cjs extraire`) :
- **ce qu'Ariane voyait** : la pose que montrait ESV et les points capturés pendant la première visite de Mic, **avant son premier geste** (entrée sans fuite, la frontière de l'ombre « mémoire des différés »). Jamais la pose de Mic ;
- **ce qu'Ariane aurait proposé** : le moteur livré, la décision du lot (gardes de paire et d'écartement comprises), puis la hauteur apprise. Deux façons :
  - *seul* : le cut visité seul ;
  - *en chaîne* : avec pour appuis les poses qu'Ariane vient de donner aux cuts précédents de la relecture (jamais une pose de Mic) ;
- **ce que Mic a fait** : sa dernière validation (corrigée par l'écriture serveur, D-143), ou une correction nulle par la règle des 0,8 s.

Un cut est **jugeable** s'il a une référence de Mic et un nuage. Sur 2 582 cuts visités avec une référence, un tiers n'a pas de nuage dans l'Écho (visites trop brèves, ou nuages purgés par l'export : 169 cuts sur 199 en partie 24, 361 en partie 17).

### 2.3 La sélection « méthode de Mic »

Calculée sans rien savoir de Mic, avec les modules livrés :
- **PN avec leurs marges** : zones reconnues par les règles métier (`src/regles-metier.js`), 4 cuts avant et 6 après ;
- **ADV avec leurs marges** : zones reconnues par le rail de plus, 30 cuts de part et d'autre ;
- **abords des rouges** : une grappe (3 rouges ou plus, trous de 5 cuts au plus) est prise en entier avec 3 cuts de marge ; un rouge isolé, avec le cut d'avant et celui d'après ; un différé, avec 2 cuts de part et d'autre ;
- **liste « À contrôler »** (`src/verts-a-controler.js`, réglages livrés) ;
- les **verts** sont compris partout.

Dans les parties 12 et 13 (parties d'un opérateur humain, sans lot), il n'y a pas d'abords : seulement PN, ADV et liste.

## 3. Couverture

| Partie | Cuts visités par Mic (avec référence) | Corrections de Mic > 10 mm | dans la sélection | PN | ADV | abords | liste | hors sélection |
|---|--:|--:|--:|--:|--:|--:|--:|---|
| 1:12 | 103 | 31 | 31 (100 %) | 30 | 0 | 0 | 1 | — |
| 1:13 | 189 | 29 | 29 (100 %) | 21 | 8 | 0 | 0 | — |
| 1:17 | 756 | 203 | 171 (84 %) | 0 | 17 | 144 | 10 | 32 verts, verticales : 18 de 10–15 mm, 14 de 15–25 mm |
| 1:24 | 206 | 108 | 107 (99 %) | 0 | 0 | 107 | 0 | 1 vert, verticale, 10–15 mm |
| 1:29 | 760 | 122 | 115 (94 %) | 13 | 21 | 77 | 4 | 7 verts, verticales : 5 de 10–15 mm, 2 de 15–25 mm |
| 2:1 | 568 | 172 | 172 (100 %) | 14 | 158 | 0 | 0 | — |
| **total** | 2 582 | 665 | **625 (94 %)** | | | | | 40 ; > 5 mm : 1 178 sur 1 310 dans la sélection (90 %) |

Ce qui manque est fait de **petites corrections de hauteur sur des verts loin de tout rouge**, surtout dans la partie 17 (lot de la 4.9.0). Aucune grosse correction (25 mm et plus) ni aucune correction latérale ne tombe hors de la sélection.

## 4. Reproduction cut par cut (chiffre central)

Ariane pose partout où elle a une pose, sans règle. Cuts jugeables de la sélection seulement.

| Partie | Jugeables | Mic > 5 mm | Mic > 10 mm | Reproduit à 5 mm | Reproduit à 10 mm | dont Mic > 10 mm | Abîmés | Mauvaise voie | Abstentions |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1:12 (seul) | 73 | 28 | 24 | 22 | 24 | 21 | 0 | 0 | 11 |
| 1:13 (seul) | 139 | 26 | 21 | 14 | 15 | 10 | 0 | 0 | 48 |
| 1:17 (seul) | 290 | 144 | 59 | 24 | 42 | 7 | 1 | 0 | 174 |
| 1:24 (seul) | 30 | 29 | 24 | 1 | 7 | 4 | 0 | 0 | 19 |
| 1:29 (seul) | 485 | 252 | 88 | 75 | 139 | 40 | 2 | 0 | 175 |
| 2:1 (seul) | 428 | 183 | 135 | 8 | 25 | 8 | 0 | **4** | 274 |
| 1:12 (chaîne) | 73 | 28 | 24 | 24 | 25 | 21 | 0 | 0 | 6 |
| 1:13 (chaîne) | 139 | 26 | 21 | 16 | 17 | 12 | 1 | 0 | 30 |
| 1:17 (chaîne) | 290 | 144 | 59 | 26 | 47 | 10 | 2 | 0 | 161 |
| 1:24 (chaîne) | 30 | 29 | 24 | 1 | 8 | 4 | 0 | 0 | 15 |
| 1:29 (chaîne) | 485 | 252 | 88 | 86 | 164 | 51 | 6 | 0 | 129 |
| 2:1 (chaîne) | 428 | 183 | 135 | 21 | 41 | 24 | 0 | 0 | 241 |

Ce qu'on lit :
- **Dans les PN des parties humaines (12 et 13), Ariane refait les corrections de Mic** : les poses d'extraction à 30–40 mm y sont reprises à 1 à 5 mm près.
- **Les 4 poses sur la mauvaise voie** sont toutes des cuts que le lot avait **différés**, dans la zone d'ADV « bordélique » du second projet : Mic les a déplacés de 136 à 274 mm en travers (bon rail hors de la vue, D-156). Seule, la décision les valide où ils sont. D'où la règle : **jamais un cut différé par le lot**.
- **Les abstentions dominent** là où Mic corrige le plus (ADV du second projet, grappes des parties 17 et 29) : Ariane n'y a pas de pose sûre, comme pendant le lot. La relecture ne fait pas mieux que le lot sur ces cuts.
- **La chaîne d'appuis aide** : plus de corrections reproduites et aucune mauvaise voie, contre quelques cuts abîmés de plus.

## 5. Règle de correction prudente

### 5.1 Forme de la règle

Ariane remplace la pose actuelle par la sienne **seulement si** toutes ces conditions tiennent, sinon elle laisse le cut :
1. l'écart à la pose actuelle (le plus grand |latéral| ou |vertical| des deux rails) atteint **X mm** ;
2. aucun rail ne bouge de plus de **D mm** en travers (jamais de changement de voie) ;
3. la confiance du moteur atteint **Y** sur les deux rails (absente : refus) ;
4. les deux rails restent cohérents (différence des deux rails ≤ **C mm**) ;
5. l'écartement de la pose est à **G mm** au plus de la médiane de la partie ;
6. l'étape de décision est permise ; jamais un cut **différé** par le lot ; un cut **posé** par le lot seulement si c'est permis.

Ce sont exactement les conditions du lecteur de la passe de relecture (`src/relecture-critere.js`, chantier `claude/50-relecture-ombre`), mesurées de la même façon.

**Choix de la règle** : on cherche dans une grille (4 façons de poser, X de 3 à 20 mm, Y de 0 à 80, D de 30 à 60 mm, C et G de 6 mm à sans limite, étapes, cuts posés ou non) celle qui fait le plus de corrections justes, **nettes des cuts abîmés**, avec **0 mauvaise voie** et des cuts abîmés **≤ 1 %** des jugeables, sur l'ensemble et sur chaque partie d'apprentissage. À égalité : la plus prudente.

Le **gain net** remplace « les corrections justes seules » : à la lettre, la règle garde les cuts posés par le lot, qui n'apportent rien (0 correction juste, 8 erreurs, 6 abîmés sur 31 actions, en validation croisée).

**Validation croisée par partie** : on laisse une partie de côté, on choisit la règle sur les cinq autres, on la mesure sur celle laissée. Puis on fige la règle sur les six.

### 5.2 Règle de la procédure, et règle de service

La procédure choisit **X = 3 mm** : le plus bas de la grille. Mais entre 3 et 8 mm, Ariane bouge surtout des verts déjà justes, dans le bruit de la référence (zone grise de 3,6 à 6,4 mm, D-158) : ces déplacements ne se jugent pas, et chacun est une écriture dans ESV. On garde donc une **règle de service** : la même, avec le seuil le plus haut qui garde au moins 90 % des corrections justes en apprentissage. Ce choix est fait sur les seules parties d'apprentissage, avant le jugement.

**Règle de service figée** :

| Réglage | Valeur |
|---|---|
| Écart minimal X | **8 mm** |
| Rail déplacé en travers, au plus (D) | **45 mm** |
| Écartement à la médiane de la partie (G) | **15 mm** |
| Confiance (Y) | présente (0) |
| Cohérence des deux rails (C) | sans limite (100 mm) |
| Étapes | toutes celles qui posent (`first-pass`, `window`, `choice`, `crossing`) |
| Façon de poser | décision du lot **en chaîne**, plus la **hauteur apprise** |
| Cuts | **verts seulement** ; jamais un cut posé ou différé par le lot |

### 5.3 Validation croisée

Règle de la procédure (X appris sans la partie) :

| Partie jugée | Règle apprise sans elle | Jugeables | Mic > 10 mm | Agit | Corrections justes | Reproduit à 5 mm | Erreurs > 10 mm (part ; Wilson) | Abîmés | Mauvaise voie |
|---|---|--:|--:|--:|--:|--:|---|--:|--:|
| 1:12 | X 3, D 45, G 15, verts seuls | 73 | 24 | 41 | 21 | 24 | 0 (0 % ; ≤ 8,6 %) | 0 | 0 |
| 1:13 | X 3, D 45, G 15, verts seuls | 139 | 21 | 55 | 12 | 16 | 3 (5 % ; ≤ 14,9 %) | 1 | 0 |
| 1:17 | X 3, D 45, G 10, verts et posés | 290 | 59 | 84 | 6 | 20 | 9 (11 % ; ≤ 19,1 %) | 2 | 0 |
| 1:24 | X 3, D 45, G 15, verts seuls | 30 | 24 | 8 | 1 | 1 | 4 (50 % ; ≤ 78,5 %) | 0 | 0 |
| 1:29 | X 6, D 45, verts et posés | 485 | 88 | 77 | 39 | 39 | 7 (9 % ; ≤ 17,6 %) | 5 | 0 |
| 2:1 | X 3, D 45, G 15, verts seuls | 428 | 135 | 47 | 5 | 6 | 0 (0 % ; ≤ 7,6 %) | 0 | 0 |
| **total** | | 1 445 | 351 | 312 | **84** | 106 | 23 (7 % ; ≤ 10,8 %) | 8 (0,6 %) | **0** |

Règle de service (seuil relevé dans chaque pli, sur les seules parties d'apprentissage du pli) :

| Partie jugée | Seuil appris sans elle | Agit | Corrections justes | Reproduit à 5 mm | Erreurs > 10 mm (part ; Wilson) | Abîmés | Mauvaise voie |
|---|---|--:|--:|--:|---|--:|--:|
| 1:12 | 8 mm, verts seuls | 21 | 21 | 20 | 0 (0 % ; ≤ 15,5 %) | 0 | 0 |
| 1:13 | 8 mm, verts seuls | 17 | 12 | 12 | 3 (18 % ; ≤ 41 %) | 1 | 0 |
| 1:17 | 10 mm, verts et posés | 8 | 3 | 2 | 3 (38 % ; ≤ 69 %) | 2 | 0 |
| 1:24 | 8 mm, verts seuls | 4 | 1 | 1 | 2 (50 % ; ≤ 85 %) | 0 | 0 |
| 1:29 | 10 mm, verts et posés | 41 | 37 | 27 | 4 (10 % ; ≤ 22,5 %) | 3 | 0 |
| 2:1 | 8 mm, verts seuls | 6 | 5 | 3 | 0 (0 % ; ≤ 39 %) | 0 | 0 |
| **total** | | **97** | **79** | 65 | 12 (12 % ; ≤ 20,4 %) | 6 (0,4 %) | **0** |

- La règle de service fait **trois fois moins d'actions** pour 5 corrections justes de moins.
- Les cuts abîmés viennent surtout des plis où la règle apprise touchait encore les cuts posés (1:17 et 1:29). Figée sur les six parties, la règle les exclut.
- Le taux d'erreur parmi les actions dépasse 9 % **toutes zones confondues** : il vient des abords et des ADV (§ 5.4).

Pour mémoire : une règle choisie zone par zone fait moins bien en validation croisée (76 corrections justes, 15 erreurs) ; à la lettre (justes seules), 87 justes, 24 erreurs, 8 abîmés.

### 5.4 Par type de zone (verts, règle de service, validation croisée)

| Zone | Verts jugeables | Mic > 10 mm | Agit | Corrections justes | Erreurs > 10 mm (Wilson) | Abîmés | Mauvaise voie | Minutes d'Ariane (6 parties, 2,4 s) | Décision |
|---|--:|--:|--:|--:|---|--:|--:|--:|---|
| **PN** | 167 | 49 | 36 | **36** | **0 (0 % ; ≤ 9,6 %)** | 0 | 0 | 11,6 | **agir** |
| ADV | 359 | 37 | 17 | 11 | 3 (18 % ; ≤ 41 %) | 1 | 0 | 43 | ombre |
| abords | 362 | 76 | 37 | 30 | 5 (14 % ; ≤ 28 %) | 1 | 0 | 51,8 | ombre |
| verts hors zone (liste) | 22 | 9 | 2 | 2 | 0 (0 % ; ≤ 66 %) | 0 | 0 | 1,8 | ombre |

**Critère d'une zone qui agit**, fixé avant le jugement : en validation croisée sur ses verts, 0 mauvaise voie, cuts abîmés ≤ 1 % des visités, erreur ≤ 9 % des actions, au moins 10 corrections justes, et au moins une correction juste pour 2 minutes de visites d'Ariane.
- **PN** : passe tout. Les 36 corrections viennent des parties 12 (20), 13 (9) et 29 (7). Les parties 17 et 24 n'ont pas de vert de PN jugeable, le second projet un seul.
- **ADV** : trop d'erreurs, et peu de gain pour beaucoup de visites.
- **Abords** : 14 % d'erreurs ; ce sont surtout des corrections de hauteur où Ariane bouge le bon rail sans arriver à 10 mm de Mic (parties 17 et 24, lots de la 4.9.0).
- **Verts hors zone** : trop peu de cas pour conclure.

### 5.5 Courbe gains/dégâts

Règle figée, seuil X variable, six parties, en échantillon :

| X (mm) | Agit | Corrections justes | Reproduit à 10 mm | Erreurs > 10 mm | Abîmés | Mauvaise voie |
|--:|--:|--:|--:|--:|--:|--:|
| 3 | 406 | 89 | 193 | 17 | 1 | 0 |
| 4 | 273 | 88 | 167 | 15 | 1 | 0 |
| 5 | 204 | 87 | 140 | 13 | 1 | 0 |
| 6 | 148 | 85 | 112 | 11 | 1 | 0 |
| **8** | **102** | **84** | 91 | 8 | 1 | 0 |
| 10 | 90 | 80 | 83 | 7 | 1 | 0 |
| 12 | 86 | 79 | 80 | 6 | 0 | 0 |
| 15 | 77 | 72 | 72 | 5 | 0 | 0 |
| 20 | 67 | 64 | 64 | 3 | 0 | 0 |
| 30 | 37 | 36 | 36 | 1 | 0 | 0 |

Au-dessus de 8 mm, chaque millimètre de seuil coûte des corrections justes ; en dessous, il n'ajoute presque que des petits déplacements dans le bruit. La règle figée, partie par partie (en échantillon) : 1:12, 21 justes sur 21 actions ; 1:13, 12 sur 17 ; 1:17, 6 sur 11 ; 1:24, 1 sur 4 ; 1:29, 39 sur 43 ; 2:1, 5 sur 6 ; un seul cut abîmé, aucune mauvaise voie.

## 6. SKIP (D-172)

Règle de Mic : SKIP seulement si **aucun point** ne s'affiche, ou si **un seul scanner** s'affiche. Relevé : `tools/relecture-autonome.cjs skip` (SKIP écrits par Mic, points retenus par rail, nuages sources des points).

| Partie | SKIP de Mic | dont cuts 0–3 | Retrouvés par « aucun point » | Fausses alertes |
|---|--:|--:|--:|--:|
| 1:12 | 0 | 0 | 0 | 1 |
| 1:13 | 1 (4944, zone d'ADV) | 0 | 0 | 1 |
| 1:24 | 0 | 0 | 0 | 0 |
| 1:29 | 1 (8556) | 0 | 0 | 1 |
| 2:1 | 23 | 4 (0, 1, 2, 3) | 1 (le cut 0) | 0 |

- Les parties 17, 25 et 11 n'ont pas les écritures serveur : on ne connaît pas leurs SKIP.
- **« Aucun point »** retrouve le cut 0 du second projet (13 captures, toutes vides). Les 3 fausses alertes sont des visites brèves, d'une ou deux captures vides ou « indisponibles » : la règle doit exiger plusieurs captures complètes et vides.
- **« Un seul scanner » ne se mesure pas** : dans toutes les Échos, les points viennent d'un seul nuage d'ESV ; les scanners n'y sont pas séparés. Les cuts 1 à 3 du second projet ont environ 4 000 points par rail, contre 8 000 à 10 000 aux cuts 4 et 5 : c'est un indice, pas une mesure.
- Les 19 autres SKIP du second projet sont dans les zones d'ADV, au titre d'une règle que Mic ne prévoit pas pour la 5.0.

**Le SKIP reste en ombre.** Pour le juger, la capture devrait relever le scanner de chaque point.

## 7. Coût en temps

Visites en plus par partie : les verts de la sélection (Ariane n'en visite aucun aujourd'hui). Mic : 3,6 s par vert. Ariane : cycle de 1,8 à 2,4 s.

| Partie | Verts en plus (PN / ADV / abords / liste) | Minutes de Mic | Minutes d'Ariane | dont PN |
|---|---|--:|--:|--:|
| 1:12 | 117 (116 / 0 / 0 / 1) | 7 | 3,5–4,7 | 3,5–4,6 |
| 1:13 | 298 (110 / 188 / 0 / 0) | 17,9 | 8,9–11,9 | 3,3–4,4 |
| 1:17 | 453 (0 / 117 / 303 / 33) | 27,2 | 13,6–18,1 | 0 |
| 1:24 | 781 (24 / 83 / 672 / 2) | 46,9 | 23,4–31,2 | 0,7–1 |
| 1:29 | 545 (38 / 182 / 316 / 9) | 32,7 | 16,4–21,8 | 1,1–1,5 |
| 2:1 | 510 (2 / 504 / 4 / 0) | 30,6 | 15,3–20,4 | 0,1 |
| 1:25 (réservée) | 136 (27 / 103 / 5 / 1) | 8,2 | 4,1–5,4 | 0,8–1,1 |
| 1:11 (réservée) | 98 (0 / 89 / 9 / 0) | 5,9 | 2,9–3,9 | 0 |

- **Toute la sélection en ombre** ajoute **3 à 31 minutes** de lot par partie. C'est autant de temps que Mic passe aujourd'hui en Écho sur ces verts, mais le lot s'allonge d'autant.
- **La seule zone qui agit (PN)** coûte **0 à 4,6 minutes** par partie.
- Les chiffres de la liste « À contrôler » ne comptent que les verts relus par Mic : au terrain, elle sera un peu plus longue (VERTS_A_CONTROLER, § 4).

## 8. Jugement sur les parties réservées

Règle figée, appliquée sans rien toucher (`juger --juger-partie-reservee`). Parties 1:25 et 1:11.

**Couverture** : en 1:25, les 21 corrections de Mic de plus de 10 mm sont toutes dans la sélection (4 en PN, 17 en ADV). En 1:11, 39 sur 103 seulement : les 64 autres sont des corrections latérales de verts (55 de 25 mm et plus), dans des zones où la pose de départ d'ESV était décalée de 10 à 25 cm et que le lot n'avait pas touchées (travail manuel de Mic, relecture du 28/09). 50 d'entre elles (plus de 45 mm) dépasseraient de toute façon le déplacement permis en travers.

| Partie | Jugeables | Mic > 10 mm | Agit | Reproduit à 5 mm | Reproduit à 10 mm | Corrections justes | Abîmés | Mauvaise voie | Abstentions | Erreur parmi les actions (Wilson 95 %) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| 1:25, toutes zones | 122 | 19 | 9 | 5 | 7 | 6 | 1 | **0** | 42 | 1 sur 9 : 11 % (≤ 43,5 %) |
| 1:11, toutes zones | 57 | 27 | 0 | 0 | 0 | 0 | 0 | **0** | 32 | — |
| **zone PN seule (test 7)** | | | **3** | 3 | 3 | **3** | 0 | **0** | | **0 sur 3 (≤ 56 %)** |
| règle de la procédure (X 3 mm), toutes zones | 179 | 46 | 28 | 7 | 11 | 6 | 1 | 0 | 74 | 1 sur 28 : 3,6 % (≤ 17,7 %) |

- Les 3 corrections de PN (1:25, cuts 3084, 3085 et 8211) : Mic avait déplacé ces verts de 22 à 32 mm ; Ariane arrive à 3,3 à 4,9 mm de lui.
- Le cut abîmé (1:25, cut 228, zone d'ADV, qui reste en ombre) : Mic n'y touche pas, Ariane le déplace de 19 mm, à l'étape `choice` (choix parmi des candidats), confiance nulle. Rien n'est réglé d'après ce cas.
- En 1:11, il n'y a pas de PN reconnu ; dans les ADV, Ariane s'abstient sur 32 des 57 cuts jugeables.
- Sans règle (agir partout) : 1:25, 80 actions, 11 corrections justes, 3 abîmés (2,5 %) ; 1:11, 25 actions, 2 justes, 0 abîmé. La règle prudente retire donc bien des dégâts.

**Porte du cahier** : 0 mauvaise voie, **tenue**. Erreur ≤ 9 % : **non démontrée**, faute d'actions. Pour que la borne haute de Wilson passe sous 9 %, il faut au moins **39 actions sans erreur**, ou 60 avec une seule. Les parties réservées disponibles n'en donnent que 3 en PN.

## 9. Recommandation pour la test 7

**Peut agir (avec l'accord de Mic) : la correction des verts de PN.**
- Ariane visite chaque cut d'un PN reconnu, marges comprises (4 cuts avant, 6 après), y compris les verts.
- Elle recalcule la pose (décision du lot en chaîne, hauteur apprise) et **corrige seulement** si l'écart atteint 8 mm, qu'aucun rail ne bouge de plus de 45 mm en travers et que l'écartement reste à 15 mm de la médiane. Sinon elle laisse le cut.
- Jamais un cut posé ou différé par le lot.
- Chiffres : en validation croisée, **36 corrections justes sur 36 actions, 0 erreur, 0 cut abîmé, 0 mauvaise voie** ; sur les parties réservées, 3 sur 3. Coût : 0 à 5 minutes par partie.
- Chaque correction doit être notée au journal (pose avant, pose après, écart), pour que la prochaine Écho de Mic la juge. C'est elle qui donnera les 39 actions qui manquent à la porte.

**Reste en ombre** (visite, calcul, note ; rien n'est modifié) :
- **ADV** : 18 % d'erreurs, gain faible, coût élevé, et c'est là que vivent les poses sur la mauvaise voie (bon rail hors de la vue) ;
- **abords des rouges** : 14 % d'erreurs ;
- **verts hors zone** : trop peu de cas ;
- **cuts posés par le lot** : la relecture n'y apporte rien (0 correction juste, 6 abîmés) ;
- **cuts différés par le lot** : 4 poses sur la mauvaise voie si on les touche ;
- **SKIP** : « un seul scanner » ne se mesure pas.

**Pour le chantier de la passe de relecture** (`claude/50-relecture-ombre`) :
- le fichier `datasets/relecture-reglages-proposes.json` est au format qu'il lit (`ariane-relecture-reglages-1`). Seule la zone `pn` a `corriger: true` ;
- **attention** : son lecteur n'accepte aujourd'hui dans `etagesPermis` que `window`, `choice` et `crossing`. Avec `first-pass` dans la liste, il refuse la liste entière et reprend le défaut `["window"]`. Or la plupart des corrections de PN se font à l'étape `first-pass` ou `crossing`. Il faut accepter `first-pass`, sans quoi la règle ne corrigera presque rien ;
- la règle a été mesurée avec la hauteur apprise ajoutée à la pose, et en chaîne (appuis : les poses de la relecture). Une pose sans hauteur apprise, ou avec les seuls appuis du lot, n'a pas été mesurée.

## 10. Doutes et limites

- **Un tiers des cuts visités n'a pas de nuage** dans l'Écho (visites brèves, nuages purgés). Les cuts « visités 0,8 s sans action » y sont nombreux : le taux de cuts abîmés est mesuré surtout sur des visites longues. Il peut être un peu optimiste.
- **Les preuves de la zone PN viennent surtout des parties humaines 12 et 13** (poses d'extraction à 30–40 mm). Sur les lots Orbite, peu de verts de PN sont jugeables (7 en partie 29, 1 au second projet).
- **Le jugement sur parties réservées est maigre** : deux parties anciennes (4.7.20 à 4.8.5), 3 actions en PN. Il ne démontre rien sur le taux d'erreur ; il montre seulement qu'aucune pose ne part sur la mauvaise voie.
- **Deux choix s'écartent de la lettre de la demande**, tous deux faits avant le jugement et sur les seules parties d'apprentissage : le gain net (correction juste moins cut abîmé) au lieu des corrections justes seules, et le seuil de service de 8 mm au lieu des 3 mm de la procédure (bruit de la référence).
- **La chaîne d'appuis** suit l'ordre des cuts que Mic a visités, pas exactement celui qu'Ariane suivrait. Les zones des parties 12 et 13 sont reconnues sur les cuts que Mic a visités (pas de lot).
- **L'étape `choice`** a produit le cut abîmé de la partie réservée, et plusieurs en apprentissage. On ne l'a pas retirée après coup : ce serait régler sur une partie réservée.
- La référence de Mic a un bruit de 1 à 2,3 mm par axe (D-158) : le seuil de 10 mm a un sens, celui de 5 mm comme taux seulement.
- Le SKIP « un seul scanner » ne peut pas être jugé avec les captures actuelles.

## 11. Rejouer

```
node tools/relecture-autonome.cjs essai
node tools/relecture-autonome.cjs extraire --partie 1:29 --echo "dossier Écho 1" --echo "dossier Écho 2" --jeu jeu.jsonl --sortie cas-1-29.jsonl
node tools/relecture-autonome.cjs skip     --partie 1:29 --echo "dossier Écho 1" --echo "dossier Écho 2" --sortie skip-1-29.jsonl
node tools/relecture-autonome.cjs table    --partie 1:25 --echo DOSSIER --journal journal.json --cas cas-1-25.jsonl --sortie t-1-25.json
node tools/relecture-autonome.cjs etudier  --partie 1:12 --cas cas-1-12.jsonl --table t-1-12.json --skip skip-1-12.jsonl … (les six parties) \
     --json etude.json --reglages datasets/relecture-reglages-proposes.json --date 2026-10-17
node tools/relecture-autonome.cjs juger    --reglages datasets/relecture-reglages-proposes.json --partie 1:25 --cas … --table … \
     --partie 1:11 --cas … --table … --juger-partie-reservee --json jugement.json
```

- Les tables de partie (`t-*.json`) sont celles des verts à contrôler (`tools/verts-a-controler.cjs extraire`) pour les parties d'apprentissage ; `table` les construit pour les autres. Elles portent les bords des rails : **hors dépôt**, comme les cas, les Échos et les journaux.
- `etudier` refuse une partie réservée (manifeste des parties). `juger` ne règle rien.
- Les sorties ne portent que des numéros de cut, des millimètres, des comptes et des minutes.
- Lancer sous `nice -n 10`. L'extraction lit les Échos : 1 à 5 minutes par partie (la 29 : 12 minutes). L'étude prend 3 minutes.
- Essais : `tests/relecture-autonome.test.cjs` (données synthétiques).
