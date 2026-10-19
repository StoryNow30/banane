# Voie prédite et « déplacer la vue » : mesure hors ligne pour la 5.0 (suite de D-141)

Branche `claude/50-voie-predite`, partie de `claude/50-base`. Mesure hors ligne seulement : **rien n'est activé dans l'extension**, rien sous `src/` n'est modifié (`src/engine.js` non plus), `DECISIONS.md` n'est pas touché. Outil : `tools/rejeu-voie-predite.cjs`. Essai : `tests/rejeu-voie-predite.test.cjs` (fixture synthétique : une voie droite fabriquée, aucune donnée réelle). Banc : `node tools/verify.cjs` : 1 798 réussis, 0 échec, 2 sautés (corpus natif absent).

Chiffres agrégés ; numéros de partie et de cut seulement ; aucune coordonnée absolue, aucun identifiant de projet. Les données (lots, jointures, listes) restent hors du dépôt.

Vocabulaire. **Différé** : cut que le lot a laissé sans pose (127 sur la partie 1 du second projet). **Tête de série** : premier cut d'une série de différés dont la voie est prédite par les cuts voisins posés. **Juste** : à ≤ 5 ou ≤ 10 mm de la pose finale de Mic (pire des deux rails). **Faux** : à plus de 10 mm. **Mauvaise voie** : à 100 mm ou plus (les trois fautes du lot, en zone d'ADV 2, étaient à 163–280 mm ; toutes les autres sont à moins de 30 mm).

## En bref

La question : si le moteur cherchait **centré sur la voie prédite** et non sur la pose de départ d'ESV, avec le contrat d'écartement et les gardes inchangés, combien des 127 différés seraient posés justes, combien faux, avec 0 pose sur la mauvaise voie, et combien exigent en plus de **déplacer la vue** ?

- **Chercher autour de la voie prédite existe déjà** dans le lot (`decideCut` relance le moteur sur des rails translatés sur la voie). Ce qui manque, c'est (1) que le clic puisse tomber hors de la vue, (2) un appui quand le lot en a perdu.
- **Sans déplacer la vue, les appuis du lot ne posent aucun des 127 différés.** Les 11 têtes de série ont une prédiction juste mais refusée par la vue, et sans tête il n'y a pas de série. Avec la vue déplacée, ces 11 têtes sont posées, **11 sur 11 à ≤ 10 mm** (médiane 3,7 mm), 0 faux.
- **En série** (chaque pose acceptée devient l'ancre du suivant), vue déplacée : **42 posés, 40 justes (25 à ≤ 5 mm), 2 faux (19 mm), 0 mauvaise voie** ; 21 de ces poses exigent un geste sur la vue (dézoom ≤ ×1,38 ; glissement ≤ 196 pixels).
- **Dérive en chaîne** : l'erreur reste à 3,5 mm en médiane jusqu'à 10 poses de chaîne ; au-delà, médiane 5,5 mm mais 2 poses fausses sur 10 (19 mm). Les deux fautes sont à plus de 10 poses de la tête.
- **Voisins validés de la liste d'ESV (B1) et prolongement des appuis ajoutent des poses (jusqu'à 61 sur 127) mais aussi des fautes (jusqu'à 7), dont une à 55 mm.** Même des appuis parfaits (poses de Mic) ne protègent pas : 96 posés, dont 6 faux et 1 sur la mauvaise voie. **Élargir la fenêtre de 30 à 50 ou 80 mm ajoute 3 poses sur la mauvaise voie** et défait des poses d'origine.
- **Règle sûre proposée** (section « Règle sûre proposée ») : seulement les cuts que le lot diffère, seulement l'étage où le moteur retrouve lui-même les deux rails autour de la voie, confiance ≥ 55, chaîne ≤ 10 poses, écartement à 10 mm des appuis. Résultat : **27 posés sur 127 (21 %), 21 à ≤ 5 mm, 27 à ≤ 10 mm, 0 faux, 0 mauvaise voie** ; 15 exigent un geste sur la vue. Aucun des 224 cuts déjà posés ne change.
- **Partie 29** (34 différés, isolés) : la règle ne pose rien et ne change aucun des 210 cuts posés, dans aucune des 50 variantes jouées.
- **Déplacer la vue** est la condition de tout le gain (0 sans lui), et son amplitude est petite : dézoom ≤ ×1,5 pour toutes les poses de la règle. Il se fait par rail, après la décision, sur la capture existante (le nuage contient déjà le bon rail : 126 cas sur 127). Le cahier des charges et les points à relever sur la maquette sont dans la section « Ce que demanderait « déplacer la vue » dans l'adaptateur ».

## Méthode

### Ce qui est rejoué

`tools/rejeu-voie-predite.cjs` appelle les **vrais modules**, en lecture seule, sur le vrai nuage de chaque cut :

- `Shadow.scientificProposeBoth` (`src/gcv1-shadow.js`) : `Candidate.propose` (`src/geometry-candidate-v1.js`) pour chaque rail, la politique S1, le calage de convention, puis la **garde d'écartement de la paire** (contrat 1 420–1 470 mm) ;
- `LotDecision.decideCut` (`src/lot-decision.js`) : garde de continuité (30 mm), garde d'écartement voisin (20 mm), **garde de paire** (rail repêché par S1 et calage de convention hors domaine), garde d'écartement bas, et surtout la **reprise depuis la voie** : le moteur est relancé sur des rails dont la pose de départ a été **translatée sur la voie prédite** (`seededRails`). La fenêtre d'analyse de ±180 mm, la grille de ±80 mm et la fenêtre verticale de ±40 mm se recentrent donc sur la voie ; le centre de recherche n'est plus la pose d'ESV. Vient ensuite le choix du minimum local près de la prédiction (15 mm) ;
- `LotDecision.commandRails` : la commande, avec le contrôle « la cible est dans la vue du rail » (KI-051).

Rien sous `src/` n'est modifié ni copié. La seule adaptation est une mémoire des résultats du moteur (même capture, même position de départ : même résultat), pour ne pas refaire des minutes de calcul à chaque variante. Les cuts sont rejoués **dans l'ordre du lot** (les `proposed` du journal), avec la mémoire d'appuis du lot : un cut posé devient appui du suivant (le lot valide tout ce qu'il pose).

### Le témoin refait le lot réel

La variante `temoin` n'a aucune option. Elle retrouve le lot :

| | partie 1 (second projet) | partie 29 |
|---|---:|---:|
| cuts rejoués (décidés au journal) | 351 | 244 |
| même issue que le lot (posé ou différé) | 351 | 244 |
| même étage de décision que le journal | 351 | 244 |
| pose d'Ariane retrouvée (cuts posés avec référence), écart maximal | 0,51 mm (165) | 0,53 mm (198) |
| posés / différés | 224 / 127 | 210 / 34 |
| faux verts rejoués (> 10 mm) | 10, dont 3 à plus de 100 mm | 6 |

Les 10 faux verts de la partie 1 et leurs trois poses sur la mauvaise voie (163–280 mm) sont ceux de D-141 : le rejeu est fidèle jusqu'à ses fautes. (6 faux en partie 29 contre 7 dans D-141 : un cas au ras du seuil, 9,8 mm ici, est classé autrement selon la référence.)

### Les sources de prédiction

| Source | Ce qui prédit la voie | Rôle |
|---|---|---|
| **lot** (la prédiction consignée à chaque décision, « l'ombre de voie ») | les 2 derniers cuts posés et validés, à 3 cuts au plus (`gap` 3) | ce que le lot sait déjà |
| **prolongement** | les derniers cuts posés sur `gap` cuts (6 et 10 sur la partie 1 ; 20 sur la partie 29 seulement), 1 ou 2 appuis | prolonge la voie quand l'avalanche a perdu les appuis |
| **B1** | les voisins **validés de la liste d'ESV** (±5 lignes, cohérents à 8 mm, 3 au moins), lus avec la translation monde − scène **T** calibrée sur la pose de départ des cuts rigides | une mémoire de voie qui ne dépend pas de ce que le lot a posé |
| **plafond** | les poses de Mic des cuts voisins du lot | appuis parfaits : ce qu'ils permettraient. **Jamais une règle** (lit l'avenir). |

« T » n'est pas une prédiction en soi : c'est le repère qui permet de lire B1 dès le premier cut (S6, « T calibrée sur la pose de départ »). Ici elle est estimée par cadre de scène sur les cuts dont les deux rails donnent la même translation (comme `rigideMm` de B1) : 129 cuts, écart maximal de 1,33 mm sur la partie 1 ; 35 cuts, 0 mm sur la partie 29.

Les lignes de B1 sont reconstruites depuis la pose de départ de la première visite de l'Écho, pour les cuts valides à l'ouverture (hors du lot). **B1 rejoué retrouve l'ombre consignée par le lot** (événement `b1-ombre`) pour 124 différés sur 127 : 8 étages « window », 8 « choice », 1 « premier passage », 65 « toujours différé » et 45 « sans effet » dans le journal ; le rejeu en perd trois « window ».

### Seconde chance, jamais première

Les sources nouvelles (B1, prolongement, fenêtre) ne s'appliquent **qu'aux cuts que le lot diffère** (« dernier recours », comme la règle d'emploi de B1). La décision du lot est d'abord prise telle quelle ; les règles de premier passage ne changent pas. Un premier essai qui appliquait le prolongement à tous les cuts (la garde de continuité jugée sur des appuis à 10 ou 20 cuts) retirait de 13 à 35 poses justes de la partie 29 : c'est la preuve qu'il ne faut pas toucher au premier passage.

### Mémoire des appuis : réelle ou « en série »

- **réelle** : les appuis sont ceux du lot réel. Les poses nouvelles ne servent à personne. Mesure le centrage seul (et les têtes de série).
- **en série** : chaque pose acceptée par le rejeu devient l'ancre du cut suivant (après validation, comme dans le lot). Mesure la chaîne et son **risque de dérive**. Chaque pose porte sa **profondeur de chaîne** (0 : pose du moteur seul ; 1 : prédite par des appuis de profondeur 0 ; etc.).

### Fenêtre

La **fenêtre d'acceptation** autour de la voie prédite est la garde de continuité (`guardMm`, 30 mm au lot) et le choix du minimum (`chooseMm`, 15 mm) ; la grille du moteur reste ±80 mm, recentrée. La fenêtre est balayée à 10, 15, 20 mm (resserrement, sur les poses nouvelles) et 50, 80 mm (élargissement de la seconde chance).

### Vue

`seule` : la cible doit déjà tomber dans la vue du rail (|NDC| ≤ 0,99), comme l'adaptateur. `deplacee` : on admet la pose et on mesure ce qu'il aurait fallu : dans la vue ou non, sinon le **dézoom** nécessaire (facteur sur la demi-largeur de la vue, la cible tombant à la marge de 1 %) et le **glissement** équivalent en pixels (vue de 1 042 × 944 px, 0,38 mm par pixel) et en millimètres, par rail, le pire des deux.

### Jugement

La vérité est la pose finale de Mic (grain de 2 à 4 mm, référence corrigée par l'écriture serveur, D-143), dans le repère profil de la pose de départ d'ESV. Aucune pose de Mic n'entre dans la décision d'un cut, sauf dans la variante `plafond`.

## Résultats, partie 1 du second projet (127 différés)

### Sources de prédiction, mémoire et vue

| Configuration | Posés | ≤ 5 mm | ≤ 10 mm | Faux | dont ≥ 50 mm | Mauvaise voie | Dans la vue sans geste | Exigent un geste |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Lot réel** (le témoin) | 0 | 0 | 0 | 0 | 0 | 0 | – | – |
| B1 seul, **sans déplacer la vue** | 16 | 10 | 13 | 3 | 0 | 0 | 16 | 0 |
| Vue déplacée, appuis du lot, têtes de série | 11 | 7 | 11 | 0 | 0 | 0 | 0 | 11 |
| … **en série** | 42 | 25 | 40 | 2 | 0 | 0 | 21 | 21 |
| + B1, têtes seulement | 25 | 16 | 24 | 1 | 0 | 0 | 14 | 11 |
| + B1, **en série** | 58 | 35 | 53 | 5 | 0 | 0 | 37 | 21 |
| Prolongement sur 6 cuts, têtes seulement / en série | 14 / 46 | – | 13 / 42 | 1 / 4 | – | 0 | – | – |
| Prolongement sur 10 cuts, têtes seulement / en série | 14 / 46 | – | 13 / 42 | 1 / 4 | – | 0 | – | – |
| Prolongement sur 10 cuts, 1 appui, en série | 45 | – | 43 | 2 | – | 0 | – | – |
| B1 + prolongement sur 10 cuts, en série | 61 | 36 | 54 | 7 | 1 | 0 | 40 | 21 |
| *Plafond* : poses de Mic comme appuis, sans chaîne | 96 | – | 90 | 6 | – | **1** | – | – |

Lecture.

- **Sans geste sur la vue, les appuis du lot ne posent rien** parmi ces 127 différés : les 11 têtes sont dehors, et sans tête il n'y a pas de série (la règle proposée, sans geste, en pose 0). Seul B1 en pose 16 sans geste, dont 3 fausses.
- **La tête de série est exacte** : 11 poses à 3,7 mm en médiane (P90 6,9 ; maximum 7,6). La prédiction brute (extrapolation de deux appuis) n'est qu'à 12 mm de Mic en médiane (P90 27) : elle sert à **placer la fenêtre**, pas à poser. C'est le moteur recentré qui ramène la pose à quelques millimètres.
- **La chaîne multiplie par 4** (11 → 42), et 30 de ces 42 poses sont des cuts « sans ancre » du lot réel (11 têtes, 30 suites, 1 autre).
- **B1 et le prolongement font gagner des poses, jamais en sécurité** : chaque source apporte au moins 1 faute, et la meilleure combinaison (61 posés) en compte 7, dont une à 55 mm (une pose choisie, étage « choice », sur un appui prolongé). Le prolongement à 6 ou à 10 cuts donne les mêmes comptes : la limite n'est pas la distance des appuis.
- **Aucune des variantes ne produit de pose sur la mauvaise voie** parmi les 127 différés, sauf les appuis parfaits (1) et les fenêtres élargies (3, ci-dessous). Les 3 poses sur la mauvaise voie du lot réel (299, 302, 315) restent telles quelles : elles sont des premiers passages sans voisin, hors de portée d'une seconde chance.
- **Aucun des 224 cuts posés ne change** (0 déplacé de plus de 1 mm, 0 retiré) dans aucune de ces variantes.

### Largeur de la fenêtre

Resserrer la fenêtre (règle « étage window, chaîne ≤ 10 », avec un écart maximal de la pose à la voie) :

| Écart maximal à la voie | Posés | ≤ 10 mm | Faux | Mauvaise voie | Cuts d'origine changés |
|---|---:|---:|---:|---:|---:|
| 10 mm | 8 | 8 | 0 | 0 | 0 |
| 15 mm | 26 | 26 | 0 | 0 | 0 |
| 20 mm | 28 | 28 | 0 | 0 | 0 |
| **30 mm (garde actuelle)** | 29 | 29 | 0 | 0 | 0 |

Élargir la fenêtre de la seconde chance (appuis du lot, en série, sans la règle) :

| Fenêtre | Posés | ≤ 10 mm | Faux | Mauvaise voie | Cuts d'origine changés |
|---|---:|---:|---:|---:|---|
| **30 mm (garde actuelle)** | 42 | 40 | 2 | 0 | 0 |
| 50 mm | 49 | 43 | 6 | **3** | 1 déplacé, 2 retirés |
| 80 mm | 50 | 44 | 6 | **3** | 1 déplacé, 2 retirés |

**La fenêtre actuelle de 30 mm est la bonne limite haute** : au-delà, des poses tombent sur la mauvaise voie, même centrées sur la voie prédite, et des cuts déjà posés bougent (la chaîne leur donne de nouveaux appuis). Cela confirme D-141 (élargir la recherche donne plus de fausses poses que de justes) : centrer ne dispense pas de garder la fenêtre étroite. En deçà de 15 mm on perd presque tout : la pose est à 7,6 mm de la voie extrapolée en médiane (P90 14,8 mm) et chaque refus casse la chaîne.

### Dérive en chaîne (appuis du lot, en série, vue déplacée)

| Profondeur de chaîne | Posés | Écart à Mic : médiane | P90 | Maximum | Faux |
|---|---:|---:|---:|---:|---:|
| 1 | 4 | 4,3 mm | 6,9 | 7,6 | 0 |
| 2 | 3 | 2,3 | 2,3 | 2,3 | 0 |
| 3 à 5 | 14 | 3,6 | 7,1 | 8,0 | 0 |
| 6 à 10 | 11 | 3,7 | 6,2 | 10,0 | 0 |
| 11 à 20 | 10 | 5,5 | 19,0 | 19,4 | **2** |

Jusqu'à 10 poses de chaîne, aucune dérive visible. Au-delà, deux fautes sur dix (cuts à 11 et 20 poses de la tête). Les séries réelles atteignent 18 poses (370 → 390) : elles s'arrêtent d'elles-mêmes à la première faute ou au premier cut où le moteur ne trouve plus de minimum unique.

### Pourquoi 76 différés restent différés

Avec la règle proposée, sur les 100 différés restants : 76 sans ancre (la chaîne s'est rompue), 15 sans minimum qualifié près de la prédiction, 1 garde d'écartement, 8 refusés par la règle (4 étage « choice », 2 écartement, 2 profondeur). **La plupart n'ont pas de prédiction** : c'est le manque de mémoire de voie qui limite, pas la fenêtre de recherche. Les appuis parfaits (plafond) montrent le plafond théorique : 96 sur 127.

## Résultats, partie 29 (34 différés, 210 cuts posés)

Les différés de la partie 29 sont isolés, sans tête de série : le déplacement de la vue ne leur apporte rien, et le recentrage ne doit rien casser.

| Configuration | Posés | ≤ 10 mm | Faux | Mauvaise voie | Cuts posés changés |
|---|---:|---:|---:|---:|---:|
| Vue déplacée, appuis du lot, réelle ou en série | 0 | 0 | 0 | 0 | **0** |
| Prolongement sur 6 / 10 cuts | 2 / 3 | 2 / 3 | 0 | 0 | **0** |
| B1 | 12 | 10 | 2 | 0 | **0** |
| B1 + prolongement | 14 | 12 | 2 | 0 | **0** |
| Règle proposée | 0 | 0 | 0 | 0 | **0** |
| Règle avec B1 | 2 | 1 | 1 | 0 | **0** |

**Aucun des 210 cuts posés ne change** (ni déplacé de plus de 1 mm, ni retiré, ni nouvel appui qui en déferait un) dans aucune des 50 variantes jouées, fenêtres de 10 à 80 mm comprises. (Sur la partie 1, une fenêtre élargie à 50 ou 80 mm change 3 cuts posés : la partie 29 n'a pas de série pour le faire apparaître.) Deux fautes de B1 (12 et 23 mm) ne sont pas évitables par un trait connu. **B1 n'est pas dans la règle proposée.**

## Règle sûre proposée

**« Recentrage prudent sur la voie »** : une seconde chance pour un cut que le lot diffère, jamais un premier passage, jamais un cut déjà posé.

1. **Prédiction** : les deux derniers cuts posés et validés du lot, à 3 cuts au plus (la voie du lot, inchangée). Le lot relance le moteur sur les rails translatés sur cette voie.
2. **En série** : une pose acceptée par la règle devient appui du cut suivant (comme un cut posé par le lot). Si trois cuts de suite sont refusés, il n'y a plus d'appui : on s'arrête, comme aujourd'hui.
3. **Étage** : seulement quand **le moteur retrouve lui-même les deux rails** autour de la voie (étage « window »). Pas de choix du minimum local près de la prédiction (étage « choice », critère plus lâche : 5 points de dessus, 3 de flanc) : c'est lui qui apporte presque toutes les fautes (5 sur 16 posés, contre 2 sur 44).
4. **Confiance** : ≥ 55 sur chaque rail (un rail retenu par S1 n'a pas de confiance calibrée et n'est pas jugé sur ce seuil).
5. **Fenêtre** : l'écart de la pose à la voie reste dans la garde de 30 mm du lot (pas de fenêtre élargie : 50 et 80 mm donnent 3 poses sur la mauvaise voie).
6. **Zone d'ADV** : l'écartement de la paire doit rester à 10 mm de celui des appuis (la garde du lot est à 20 mm). Le rejeu l'applique à toutes les poses nouvelles ; les 27 sont d'ailleurs toutes en zone d'ADV au sens de la fiche de Mic (724 des 765 cuts y sont), si bien que la condition « jamais en ADV sans deux rails cohérents » s'applique à tout le lot mesuré.
7. **Chaîne** : au plus 10 poses nouvelles consécutives sans pose du moteur seul. Au-delà, le cut est différé et l'opérateur reprend (le lot n'écrit rien de plus).
8. **Vue** : la pose n'est possible que si la vue peut être déplacée dans les limites de la mesure (dézoom ≤ ×1,5 ou glissement ≤ 250 pixels) ; sinon le cut reste différé. La pose se fait sur la capture existante.
9. **Hors règle** : B1 et le prolongement des appuis, qui restent en ombre (ils ajoutent au moins 1 faute à chaque essai).

**Chiffres**

| | Partie 1 (127 différés) | Partie 29 (34 différés) |
|---|---|---|
| Posés | **27** (21 %) en 4 séries de 8, 7, 7 et 5 cuts : 9 têtes, 18 suites | 0 |
| Justes à ≤ 5 / ≤ 10 mm | 21 / 27 (écart à Mic : médiane 3,5 mm, P90 6,4, maximum 10,0) | – |
| Faux / mauvaise voie | **0 / 0** | 0 / 0 |
| Exigent un geste sur la vue | 15 (dézoom ≤ ×1,1 : 11 ; ≤ ×1,25 : 13 ; ≤ ×1,5 : 15 ; glissement médian 11 px, P90 118, maximum 196) | – |
| Cuts posés changés | **0** sur 224 | **0** sur 210 |
| Sans geste sur la vue | **0** poses | – |

Variantes proches, toutes à 0 faux et 0 mauvaise voie : étage « window » + chaîne ≤ 10 : 29 posés ; + confiance ≥ 55 sans plafond de chaîne : 30 ; + écartement ≤ 10 mm sans plafond de chaîne : 28. Sans plafond de chaîne ni confiance ni écartement : 38 posés mais 1 faux (19 mm, à 11 poses de la tête). Chaîne ≤ 5 : 19 ; ≤ 8 : 27 ; ≤ 15 : 34 (1 faux).

**Ce que la règle ne dit pas.** Les seuils (55, 10 mm, 10 poses) sont lus sur ces deux parties : avec 27 poses, « 0 faux » laisse jusqu'à 11 % de fautes possibles (règle des trois) ; elle doit passer un lot neuf **en ombre** (cahier 5.0, règle 3 : « 0 mauvaise pose ajoutée ») avant toute activation. Elle ne corrige pas les trois poses sur la mauvaise voie du lot réel (premiers passages sans voisin) : c'est le rôle de M6 et du score d'écartement.

## Ce que demanderait « déplacer la vue » dans l'adaptateur

Rien n'est écrit dans l'extension. Ce qui suit est le cahier des charges que la mesure permet de fixer, et la liste de ce qu'il reste à vérifier sur la maquette d'ESV avant d'écrire une ligne.

### Ce qui existe déjà

- Le clic de pose (`clickPosition`, `src/adapter-page.js`) sélectionne le rail (`select` : clic sur le bouton du rail, attente que la vue ESV se recentre sur lui et soit immobile sur trois lectures), lit la caméra courante (`cameraSnapshot`), projette la cible (`projectToView`) et **refuse** si une composante du NDC sort de [-1, 1] (« Position proposée hors de la vue »). Le pixel entier du clic fixe la précision : 0,38 mm par pixel à la vue habituelle (±0,2 m sur 1 042 px), tolérance de pose de 1 mm, avertissement au-delà de 0,9 mm par pixel.
- La décision sur le lot applique la même règle avec une marge de 1 % (`VIEW_MARGIN`, 0,99) et diffère le cut sinon (`hors-vue-left`, `hors-vue-right`, KI-051).
- Chaque rail a **sa propre vue**, recentrée sur sa pose de départ : les deux rails ne sont jamais dans la même vue (entraxe de 1,4 à 1,5 m pour une vue de 0,4 m). Un déplacement de vue se fait donc **par rail**, après `select`, avant la lecture de la caméra qui sert au clic.
- Le clic lit la caméra **au moment du clic** : si la vue a bougé, la cible est reprojetée avec la nouvelle caméra. Seule manque la pièce qui amène la cible dans la vue.
- D-043 et D-049 : l'opérateur dézoome et déplace la vue (D-043 écrit « au clic droit » ; la consigne de ce chantier dit « glisser latéral au clic gauche » : **à trancher** sur la maquette avant de coder le geste). Le dossier de passation (§ 1.3, 1.4) donne déjà les préalables : inspection d'ESV, garde de capture, temps de chargement.

### Ce que la mesure apporte de neuf

1. **La capture n'a pas à être refaite.** Le nuage capturé à la vue habituelle contient déjà les points du bon rail dans 126 cas sur 127 (boîte de capture de ±400 mm ; le décalage de Mic ne dépasse pas 274 mm). La séquence « décentrer, recapturer, décider, cliquer » du dossier de passation se réduit à **décider sur la capture existante, amener la vue, cliquer**. Pas de chargement de nuage supplémentaire par cut, et la garde « la caméra a changé pendant l'export » ne joue pas, puisque la vue ne bouge qu'après la capture. **À une condition** : la vue doit être **remise à l'état habituel avant la navigation vers le cut suivant**, sinon la capture suivante se ferait sur une vue dézoomée (nœuds et budget de points différents). C'est le point à mesurer en premier (avant-dernière ligne du tableau ci-dessous).
2. **L'amplitude est petite.** Pour les 27 poses de la règle proposée, 15 exigent un geste : un dézoom d'au plus ×1,1 suffit pour 11 d'entre elles, ×1,25 pour 13, ×1,5 pour les 15 (maximum ×1,38) ; ou un glissement médian de 11 pixels (P90 118 px, maximum 196 px, soit 75 mm).
3. **Le besoin vient par séries, mais pas à chaque cut.** La tête de série l'exige (c'est pourquoi le lot l'avait refusée) ; ensuite la voie glisse d'un cut à l'autre autour du bord de la vue : sur les 27 poses, 12 sont déjà dans la vue. Un geste « à la demande », décidé cut par cut, est donc plus juste qu'un dézoom permanent.

### Règles du cahier 5.0 qui s'appliquent

- **Trace dans ESV identique à celle d'un humain** (règle 1, D-114) : Ariane ne fait que déclencher des commandes d'ESV, n'écrit jamais sur le serveur et ne laisse aucune marque distinctive. Toute nouvelle action est d'abord **relevée sur la maquette**, puis acceptée par Mic. Le déplacement de la vue est une action nouvelle.
- **Écho passif** (règle 2) : aucun changement de caméra pendant une session Écho. Le déplacement de la vue n'existe qu'en Orbite (lot), jamais en Écho.
- **Trois états** (règle 3) : hors ligne (cette fiche) → ombre sur le terrain (la décision et le geste qui serait nécessaire sont consignés, rien n'est posé ni déplacé) → actif. Porte : 0 mauvaise pose ajoutée, rejeu des lots sans régression.

### Gestes autorisés : humains seulement

- **Dézoom** : événements `wheel` sur le canvas d'ESV (même cible que le `click` d'aujourd'hui), quelques crans, un cran à la fois, avec la cadence d'un humain (plusieurs dizaines de ms entre crans). À petit facteur seulement (au plus ×1,5, soit 0,58 mm par pixel).
- **Glissement de la vue** : `pointerdown`/`mousedown`, une série de `pointermove`/`mousemove` à pas réguliers et courts, `pointerup`/`mouseup`, avec la durée et la forme d'un glisser humain. **Jamais de `click` à la fin d'un glisser** (ESV poserait le rail) : l'Écho de Mic montre précisément des « pointerdown sans clic ».
- Ni écriture directe dans la caméra (`viewer.camera…`), ni appel d'une fonction interne d'ESV, ni déplacement instantané. Les événements d'Ariane restent non fiables (`isTrusted: false`) et ignorés par l'observateur humain de l'Écho, comme le `click` d'aujourd'hui.
- **Trace identique à celle d'un humain** : mêmes types d'événements, même ordre, même nombre de pas et mêmes durées que les glissers de Mic. Aujourd'hui l'Écho ne garde que le **nombre** de `pointerdown` et de `mousedown` (deux glissers par cut en médiane sur les cuts hors vue, contre 1,5 dans la vue) ; il faut y ajouter, en observation seulement, la longueur du glisser en pixels, le nombre de pas, la durée, les crans de molette et la caméra avant/après, avant de fixer ces valeurs. Sans cela on copierait un geste qu'on n'a pas mesuré.

### La pièce à écrire (non commencée)

`amenerDansLaVue(cote, cible, attendu)`, appelée dans `clickPosition` entre `select` et la lecture de la caméra :

1. lire la caméra, projeter la cible ; si elle est dans la vue (marge de 1 %), ne rien faire ;
2. sinon calculer le geste le plus petit : dézoom si le dépassement est faible, glissement sinon ;
3. émettre **un** geste humain, attendre que la caméra soit immobile (trois lectures, comme `select`), relire, recalculer ;
4. au plus trois gestes par rail ; au-delà, ou si la caméra ne bouge pas, ou si la pose du rail a changé, **différer le cut** (jamais de pose partielle : les deux rails ou aucun, comme aujourd'hui) ;
5. journaliser un événement `vue-deplacee` (côté, geste, dézoom ou pixels, NDC avant/après, durée), sans coordonnée absolue ;
6. **remettre la vue** : si le dézoom ou la position survivent au `select` et à la navigation, rejouer le geste inverse (molette dans l'autre sens, glisser en retour) avant la validation, et relire la caméra ; si elle n'est pas revenue, arrêter le lot proprement (« vue non restituée »), comme aujourd'hui pour « Vue ESV non recentrée ».

### À mesurer sur la maquette avant d'activer quoi que ce soit

| Question | Pourquoi |
|---|---|
| La molette et le glisser synthétiques (`isTrusted: false`) sont-ils pris en compte par les écouteurs d'ESV ? Quel bouton déplace la vue (gauche ou droit) ? | Le `click` l'est ; rien ne dit que la molette et le glisser le soient. D-043 et la consigne se contredisent sur le bouton. |
| Facteur de zoom par cran de molette ; le zoom est-il centré sur le curseur ? | Fixe le nombre de crans et l'endroit du pointeur. |
| Sensibilité du glisser : le fond bouge-t-il de 1 pixel par pixel en vue orthographique ? | Fixe la longueur du glisser. |
| Le nuage chargé change-t-il avec la vue (nœuds en plus ou en moins) après la capture ? | La décision a déjà sa capture ; la pose ne doit pas dépendre d'un rechargement. |
| Le zoom et la position de la vue persistent-ils après `select` et après la navigation au cut suivant ? | S'ils persistent, il faut les restituer avant la capture suivante (sinon la capture change). S'ils ne persistent pas, un geste par rail et par cut, sans restitution. |
| Le pixel reste-t-il sous 0,9 mm ? | Au-delà, le clic est refusé (« agrandis la fenêtre d'ESV »). Un dézoom de ×2 donne 0,77 mm par pixel, ×2,3 la limite. |

Aucune de ces questions ne demande de toucher à la pose ni de valider quoi que ce soit : une séance en observation (gestes de Mic enregistrés avec leur amplitude) y répond.

## Limites

- **Un seul projet décalé, un seul opérateur.** Le second projet, partie 1, fournit tous les différés « voie décalée » (127). La partie 29 n'en a que 34 et sert de contrôle de non-régression, pas de preuve de gain.
- **Vérité terrain = la pose de Mic**, au grain de 2 à 4 mm, jamais lue pour décider. Les 59 posés sans référence de Mic ne sont pas jugés ; les différés le sont tous.
- **B1** : la liste de l'ouverture n'est pas dans les exports. Les lignes sont reconstruites depuis la **pose de départ de la première visite de Mic** (l'Écho), pour les cuts hors du lot (valides à l'ouverture). Les lignes de cuts que Mic n'a pas visités manquent ; le rejeu retrouve néanmoins l'ombre consignée pour 124 différés sur 127.
- **Pas de nouveau nuage.** La vue déplacée n'a pas de capture propre : on décide sur la capture faite à la vue habituelle, qui contient les points du bon rail (126 cuts sur 127). Un rail dont les points seraient hors de la capture (au-delà de ±400 mm) n'est pas couvert.
- **« Dans la vue » est mesuré, pas essayé.** La caméra de la capture donne la vue ESV ; ce que fait ESV d'un dézoom ou d'un glissement n'est pas observé (tableau des questions plus haut). Le pixel est calculé à 0,38 mm à la vue habituelle ; il grandit avec le dézoom.
- **Le chaînage est rejoué avec le vrai module de décision, pas observé** : en réel, le lot ne pose pas ces cuts. Le risque de dérive est mesuré contre Mic, sur ce lot, sur 10 poses de profondeur au plus pour la règle.
- **Les seuils de la règle sont choisis sur ces deux parties** : ils sont lus ici, pas validés sur une troisième. Intervalle à 90 % de « 0 faux sur 27 » : jusqu'à environ 8 % (règle des trois, 11 % à 95 %).
- **Prolongement, chiffres sans détail de vue** : les lignes « prolongement » du premier tableau viennent des comptes du journal d'exécution (posés, justes, faux, mauvaise voie) ; la vue et le détail ≤ 5 mm n'y sont pas repris.
- **Plafond** : les appuis parfaits viennent de Mic après coup ; ils ne bornent que ce que la prédiction pourrait valoir, jamais une règle. Même parfaits, ils laissent une pose sur la mauvaise voie.

## Rejouer

```
node tools/rejeu-voie-predite.cjs --essai                       # fixture synthétique, sans donnée
node tools/rejeu-voie-predite.cjs --liste                       # variantes connues
node tools/rejeu-voie-predite.cjs \
   --corpus SEG1.json --corpus SEG2.json ...  \                  # corpus GCV1 du lot (nuages)
   --journal JOURNAL.json --jointure JOINTURE.json \             # journal Orbite, jointure Écho-Orbite (pose de Mic)
   [--lignes LISTE.jsonl] [--zones JEU.jsonl] [--cache MEMOIRE.json] \
   --variantes temoin,vue-serie,regle-wc-e10-p10 \
   --sortie SORTIE.json [--detail DETAIL.json] [--csv MODELE-{id}.csv]
node tools/rejeu-voie-predite.cjs --rapport SORTIE1.json SORTIE2.json   # tables
```

- `--lignes` : une ligne JSON par cut `{cut, statut: "valid"|"invalid", left: [x, y, z], right: [x, y, z]}` (pose de départ en coordonnées monde, d'après la liste d'ESV ou l'Écho). Nécessaire pour B1 seulement. Hors dépôt.
- `--zones` : le jeu d'apprentissage (`zone.adv`), pour les variantes qui jugent la zone d'ADV.
- `--cache` : mémoire des résultats du moteur (5 Ko par rail et par position) ; elle évite de refaire six minutes de calcul pour un lot de 350 cuts.
- `--csv` : un fichier par variante, une ligne par cut (étage, source, jugement, écart à Mic, dézoom, glissement en pixels et en millimètres) : c'est le tableau « pour chaque pose acceptée, est-elle dans la vue, sinon de combien faut-il déplacer ».
- Mémoire : 6 Go de tas pour un lot de 350 cuts (`NODE_OPTIONS=--max-old-space-size=6000`).
- Essai : `node --test tests/rejeu-voie-predite.test.cjs`.
