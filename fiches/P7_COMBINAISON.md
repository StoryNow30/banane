# P7 — combinaison des quatre correctifs (différés en chaîne, voisins sûrs, graine d'écartement, garde de paire)

17 octobre 2026. Branche `claude/50-p7-combi`, partie de `claude/50-base` (d8a7bcd), qui fusionne les quatre branches de l'atelier P-7 jugées « tient » par leurs sceptiques. Seules les **parties d'apprentissage** sont lues (1:12, 1:13, 1:17, 1:24, 1:29, 2:1). Aucune partie réservée n'est lue, le mode `juger` n'est pas lancé, `src/engine.js` n'est pas modifié.

Conventions : **[FAIT]** mesuré, avec la commande (§ 6) ; **[HYP]** hypothèse ; **[NON MESURÉ]**. Cellule : **actions / justes / erreurs > 10 mm / abîmés / mauvaises voies / abstentions**, sur les 1 445 cuts visités de la sélection (351 corrections de Mic de plus de 10 mm).

## 1. En bref

| Mesure | Référence (règle de service) | H1 + H3 + H2 | Écart |
|---|---|---|---|
| validation croisée, toutes zones | 97 / 79 / 12 / 6 / 0 / 582 | **148 / 124 / 15 / 6 / 0 / 554** | **+45 justes, +3 erreurs, 0 abîmé, 0 mauvaise voie** |
| ADV | 17 / 11 / 3 / 1 / 0 / 310 | 48 / 40 / 4 / 1 / 0 / 293 | +29 justes, +1 erreur |
| abords | 41 / 30 / 8 / 4 / 0 / 220 | 60 / 45 / 10 / 4 / 0 / 209 | +15 justes, +2 erreurs |
| grappes | 43 / 35 / 6 / 3 / 0 / 366 | 83 / 70 / 8 / 3 / 0 / 343 | +35 justes, +2 erreurs |
| verts de PN | 36 / 36 / 0 / 0 / 0 | 36 / 36 / 0 / 0 / 0 | inchangé |
| différés du lot | 0 / 0 / 0 / 0 / 0 / 129 | 51 / 45 / 3 / 0 / 0 / 101 | +45 justes |

[FAIT] La validation croisée et la greffe « à la lettre » (règle de service de chaque pli, rien n'est appris) donnent **exactement** les mêmes chiffres : chaque pli choisit la combinaison avec 1 appui au moins, et garde les seuils des verts de la référence (X 8/8/10/8/10/8 mm, G 15/15/10/15/100/15 mm). Il n'y a donc aucun effet indirect du seuil X dans la combinaison, à la différence de H1 seule dans sa branche.

La garde de paire confirmée (H5) ajoute +5 justes à 10 mm en latéral (+3 à 5 mm), sans dégât, à la lettre. En validation croisée, elle relève le seuil des verts de la règle figée (X 8 → 10 mm) : elle n'est pas retenue (§ 3.3).

## 2. Ce qui est combiné, et comment

| Hypothèse | Branche | Cuts touchés | Façon d'agir |
|---|---|---|---|
| H1 différés en chaîne | `claude/50-p7-differes-en-chaine` | différé du lot **posé** par la chaîne | admis avec au moins 1 appui ; jugé sans les limites D (voie) et G (écartement) des verts |
| H3 voisins sûrs | `claude/50-p7-voisins-surs-differes` | différé du lot que la chaîne **diffère** | la décision livrée est reprise avec les poses actuelles des voisins comme appuis validés ; agit sans les seuils des verts |
| H2 graine d'écartement | `claude/50-p7-graine-ecartement-fictive` | différé que la chaîne diffère, pose de départ **fictive** | le moteur livré est relancé depuis une graine à l'écartement des voisins ; agit sans les seuils des verts |
| H5 garde de paire | `claude/50-p7-garde-paire-confirmee` | cut retiré par la garde de paire (des verts ici) | pose du moteur si la voie la confirme à N mm |

- [FAIT] H1 et H3/H2 ne se recouvrent pas : H1 agit quand la chaîne pose, H3 et H2 quand elle diffère.
- [FAIT] H3 et H2 se recouvrent sur 3 cuts. La reprise des voisins passe d'abord, comme dans le banc du catalogue (`p7/eval2.cjs`, variante `voisGauge`). À la lettre : H3 + H2 = +23 justes, contre 13 + 12 séparément.
- Dans l'outil, un seul choix de la grille réunit les trois façons (`combiDifferes`), avec 1 ou 2 appuis pour la chaîne. La validation croisée choisit entre lui et « jamais un différé ».
- **Choix de méthode** (fait avant la mesure, signalé) : avec la valeur combinée, les différés admis ne comptent pas dans les 90 % de la variante sobre (méthode de H3 et H2). Sans cela, le seuil des verts monte sans rien gagner, comme l'a mesuré le sceptique de H1 (X de 8 à 10–12 mm, un vert juste perdu en 1:24, un cut posé retiré en 1:17).

## 3. Résultats [FAIT]

### 3.1 Greffes à la lettre (aucun réglage appris)

| Combinaison | Toutes zones | Δ justes | Δ erreurs | Δ abîmés | Mauvaises voies |
|---|---|--:|--:|--:|--:|
| référence | 97 / 79 / 12 / 6 / 0 / 582 | 0 | 0 | 0 | 0 |
| H1 | 120 / 101 / 13 / 6 / 0 / 582 | +22 | +1 | 0 | 0 |
| H3 | 115 / 92 / 14 / 6 / 0 / 564 | +13 | +2 | 0 | 0 |
| H2 | 110 / 91 / 13 / 6 / 0 / 569 | +12 | +1 | 0 | 0 |
| H5 (10 mm, latéral) | 102 / 84 / 12 / 6 / 0 / 575 | +5 | 0 | 0 | 0 |
| H1 + H3 | 138 / 114 / 15 / 6 / 0 / 564 | +35 | +3 | 0 | 0 |
| H1 + H2 | 133 / 113 / 14 / 6 / 0 / 569 | +34 | +2 | 0 | 0 |
| H3 + H2 | 125 / 102 / 14 / 6 / 0 / 554 | +23 | +2 | 0 | 0 |
| **H1 + H3 + H2** | **148 / 124 / 15 / 6 / 0 / 554** | **+45** | **+3** | **0** | **0** |
| H1 + H3 + H2 + H5 (10 mm, l) | 153 / 129 / 15 / 6 / 0 / 549 | +50 | +3 | 0 | 0 |
| H1 + H3 + H2 + H5 (5 mm, l) | 151 / 127 / 15 / 6 / 0 / 551 | +48 | +3 | 0 | 0 |

Les gains s'additionnent, au recouvrement H3/H2 près. Les seuils de H5 (10 et 5 mm, latéral) sont ceux que sa validation croisée choisissait : ce n'est pas une mesure « à la lettre » pure pour H5.

### 3.2 Validation croisée de H1 + H3 + H2

- Total, zones, grappes : tableau du § 1.
- Par partie (Δ justes / Δ erreurs) : 1:12 0/0 ; 1:13 0/0 ; 1:17 +2/+1 ; 1:24 +4/+1 ; 1:29 +15/+1 ; 2:1 +24/0.
- Règle figée (six parties) : verts X 8 mm, D 45 mm, G 15 mm, différés « combinaison, 1 appui ». **La règle des verts est celle de `datasets/relecture-reglages-proposes.json`, inchangée.**
- Chiffre central (chaîne+h, agir partout, sans règle) : 122 → 145 justes sur 351, 9 abîmés dans les deux cas, 0 mauvaise voie.

### 3.3 Avec la garde de paire (H1 + H3 + H2 + H5), en validation croisée

- **146 / 126 / 14 / 5 / 0 / 551** : +47 justes, +2 erreurs, −1 abîmé, 0 mauvaise voie contre la référence ; +2 justes, −1 erreur, −1 abîmé contre la combinaison sans H5.
- Chaque pli lève la garde à 10 mm en latéral, sauf celui de 1:24 (5 mm). Mais la variante sobre relève le seuil des verts : X 10 → 12 mm en 1:17, 8 → 12 mm en 1:24, et **X 8 → 10 mm dans la règle figée**. Le « −1 abîmé » est le cut posé 2420 (1:17) retiré par ce seuil ; le vert juste 5757 (1:24) est perdu de même. L'effet propre de H5 : 3 verts justes (1:24 5730, à 9,6 mm ; 1:29 3546 et 3553).
- Lecture : H5 se combine, mais il change la règle des verts dans la règle figée pour 2 à 5 justes. **Il n'est pas retenu dans les réglages figés** (§ 5).

### 3.4 Les 51 actions sur des différés (combinaison, règle de service de chaque pli)

| Chemin | Actions | Justes | Erreurs | > 50 mm de Mic | Cible à plus de 200 mm de la pose d'ESV | Rail déplacé de plus de 45 mm en travers |
|---|--:|--:|--:|--:|--:|--:|
| chaîne (H1) | 23 | 22 | 1 | 0 | 5 | 16 |
| voisins sûrs (H3) | 18 | 13 | 2 | 0 | 1 | 11 |
| graine (H2) | 10 | 10 | 0 | 0 | 1 | 10 |
| total | 51 | 45 | 3 | 0 | 7 | 37 |

Les 3 erreurs : 1:24 cut 5722 (chaîne, 14,7 mm) ; 1:17 cut 5793 (voisins, 13,1 mm) ; 1:29 cut 8005 (voisins, 22 mm). Erreurs parmi les actions sur différés : 3/51 = 5,9 % (Wilson 2,0–15,9 %). 0 mauvaise voie sur 51 (borne haute de Wilson 7,0 %).

Erreurs parmi toutes les actions, par zone : ADV 4/48 = 8,3 % (Wilson 3,3–19,6 %) ; abords 10/60 = 16,7 % (9,3–28,0 %) ; PN 1/38 ; toutes zones 15/148 = 10,1 % (6,2–16,0 %). La porte du cahier (erreur ≤ 9 %) n'est franchie par aucune zone en borne haute.

## 4. Limites

- **En échantillon pour la conception** [FAIT] : les quatre hypothèses, leurs restrictions (« pose fictive », « différés seulement ») et la levée des limites D et G ont été choisies en lisant ces mêmes parties (catalogue P7). La validation croisée ne règle que l'activation et les seuils. Il faut un jugement sur des parties neuves.
- **Concentration** [FAIT] : 24 des 45 justes sont en 2:1, dont une chaîne de cuts consécutifs dans une seule zone d'ADV ; 15 en 1:29. 1:12 et 1:13 n'ont aucun différé.
- **Invariant de voie** [FAIT] : 37 des 51 actions déplacent un rail de plus de 45 mm en travers, alors que le lecteur de la relecture (`src/relecture-critere.js`, branche de la relecture en ombre) impose 45 mm au plus (D-159). La graine utilise l'écartement comme graine et comme garde (au bord de D-033). Rien ne peut agir sans l'accord de Mic et de la direction.
- **Vue d'ESV** [NON MESURÉ] : 7 cibles à plus de 200 mm de la pose d'ESV (D-156).
- **Ordre de la chaîne** [NON MESURÉ] : le rejeu suit les cuts visités par Mic, triés par numéro ; la passe d'Ariane suivrait sa propre sélection.
- **Propagation** [HYP] : une racine fausse en chaîne (D levé) pourrait poser plusieurs cuts sur la mauvaise voie ; aucun cas ne le teste.
- **Capture** [NON MESURÉ] : 1:17 a des cas non rebâtis (source d'Écho absente) ; ce qu'Ariane ferait avec sa propre capture complète.
- **Définition d'un cut abîmé** [FAIT] : le code (hérité de la base) compte « abîmé ou aggravé » avec Mic à 5 mm au plus ; les fiches disent 10 mm. Les écarts ci-dessus ne changent pas (même cut dans la référence et la combinaison).

## 5. Réglages figés avant le jugement

`datasets/relecture-reglages-p7-combinaison.json` (statut `fige-avant-jugement`) : la règle des verts de `datasets/relecture-reglages-proposes.json`, inchangée, plus le bloc `differesCombines` (chaîne avec 1 appui au moins, étapes first-pass, window, choice, crossing, sans limites de voie ni d'écartement ; voisins sûrs ; graine). Garde de paire maintenue. `jamais` garde « cut différé par le lot » : un lecteur qui ignore le bloc reste fermé. `regleDuReglage` le relit.

## 6. Rejouer

Dossier de travail hors dépôt (`p7/combi` du bloc-notes de session) :

1. Greffe de la garde de paire (sous le verrou des calculs lourds, 3 parties, ~3 min) : `greffe-gp.sh 24 29 17`.
2. Cas fusionnés, contrôlés octet pour octet contre les cas de l'étude : `node fusion-cas.cjs`.
3. Contrôle de la fusion (règles de chaque branche, aucun réglage) : `node repro.cjs` — base 36 bilans, H1 90, greffe H1 84, H3 90, H2 90, H5 90 : 0 écart.
4. Référence : `etudier.sh res/ref` (196 s) ; ses 4 120 feuilles sont égales à celles de l'étude publiée (`node inclus.cjs zones/etude.json res/ref.json`).
5. Combinaison : `etudier.sh res/combi3 --differes-en-chaine --voisins-surs-differes --graine-ecartement-fictive --leger` (240 s) ; avec la garde de paire : `… --garde-paire-confirmee --leger` (1 971 s).
6. À la lettre : `lettres.sh` (10 s), puis `node resume.cjs res/ref.json res/lettre/*.json`, et `node detail.cjs res/combi3.json`.
7. Essais : `node --test tests/p7-combinaison.test.cjs` et les essais des quatre branches (86 sur 86).
