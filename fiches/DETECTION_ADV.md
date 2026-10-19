# Détection des ADV (5.0, nuit du 16 au 17 octobre 2026)

Chantier « détection des ADV », parti de la base 5.0. Point de départ : la règle de Mic « ADV avec ses marges », les zones d'ADV et les aiguilles qu'il a notées (fiche de méthode de la partie 29, sur la branche de pilotage), et le constat des deux fiches précédentes :
- `fiches/REGLES_METIER.md` (§ 3.3) : « aucun trait géométrique ne sépare une zone d'ADV » (écartement, cap, `flushPct`) ; seule la grappe de différés en donne une trace ;
- `fiches/VERTS_A_CONTROLER.md` (§ 8) : au second projet, les erreurs que la liste manque sont dans les zones d'ADV, hors de la fenêtre du lot.

**Ce qui change : le nuage de points, lui, montre l'ADV.** Dans la capture d'un cut, autour de chacun des deux rails posés, on voit l'aiguille, le contre-rail, le cœur ou le rail de la voie qui diverge : un **rail de plus**. Ce signal ne demande rien de nouveau à ESV : la capture est celle que le lot fait déjà.

**Rien n'est activé.** La zone `adv` est **en ombre** dans l'événement `regles-metier-ombre` : aucune règle, aucun verdict changé. Elle sert à la liste des verts à contrôler, qui fait entrer comme candidats les verts d'une zone d'ADV.

## 1. En bref

| | Résultat |
|---|---|
| **Signal retenu** | Un **rail de plus** dans le profil en travers de chaque rail posé (pas de 1 cm, ±40 cm) : un champignon de 3 à 16 cm de large, au niveau du dessus du rail, continu le long de la voie, avec un creux de part et d'autre. Le contre-rail d'une courbe, la chaussée d'un PN, un quai ou une rampe sont écartés. |
| **Zone** | Deux alertes à 3 cuts au plus ouvrent la zone ; elle grandit tant que les alertes se suivent à 10 cuts au plus. Plage à contrôler : **30 cuts avant la première alerte, 30 après la dernière** (Mic : « environ 20 à 40 cuts autour »). |
| **Zones de Mic retrouvées** | **8 sur 8** : partie 29 (2/2), partie 13 (2/2), partie 1 du second projet (4/4). **12 aiguilles sur 12** au second projet. |
| **Fausses alertes** | **Aucune plage sans ADV** sur les quatre parties étiquetées (lot et Écho). Une seule alerte isolée hors zone en partie 29 (cut 8087, 21 cuts après la fin de l'ADV2, jamais confirmée). Partie 12 (pas d'ADV, 6 PN) : 0 alerte sur 82 cuts. Aucun PN pris pour un ADV (0 alerte sur 218 cuts de PN). |
| **Au cut** (lot) | Noyau de l'aiguille (±10 cuts) : **22/22** en partie 29, **72/94** au second projet. Marges : 11/11 et 172/254. |
| **Gain sur la liste des verts** | Second projet : **33 erreurs sur 35** au lieu de 27, **20 gros écarts sur 20** au lieu de 15, pour **7 verts de plus** (84 au lieu de 77, 5,2 min au lieu de 4,8). Partie 29, parties 12, 13, 17 et 24 : liste inchangée, ou un vert de plus. |
| **Pose** | Inchangée. Prouvé par essai sur le service worker réel : commandes, rails, enregistrements, événements métier et décisions du lot identiques, octet pour octet, ombre active ou coupée. `src/engine.js` n'est pas touché. |
| **Réglages** | Figés le 17/10 (`datasets/reglages-figes.json`, `reglesMetier.valeurs.adv`, et `vertsAControler.valeurs.poids.adv` = 0). **Toutes les parties étiquetées ont servi à régler** : aucune n'a jugé ces seuils à l'aveugle. |

## 2. Les zones de Mic

| Partie | Zone (marges de Mic comprises) | Aiguilles | Source |
|---|---|---|---|
| 29 | ADV1 : 6558–6678 (passage de Mic d'un seul tenant ; fiche : aiguille au 6638, changement de voie 6658–6678) | 6638 | fiche de méthode, rapport p29 § 5 |
| 29 | ADV2 : 7954–8066 | 8003 | fiche de méthode |
| 13 | ADV1 : 4644–4713 | 4682 | fiche de méthode |
| 13 | ADV2 : 4911–4963 (fin confirmée par Mic) | entre 4935 et 4936 | réponses de Mic du 16/10 |
| 1, 2ᵉ projet | Z1 : 116–165 | 136 | fiche de méthode |
| 1, 2ᵉ projet | Z2 : 271–670 (fin non déclarée : prise au dernier cut que Mic a traité) | 287, 320, 552, 616, 626 | fiche de méthode, jeu du second projet |
| 1, 2ᵉ projet | Z3 : 2911–3036 | 2932, 3012 | fiche de méthode |
| 1, 2ᵉ projet | Z4 : 5496–6185 (fin non précisée : même règle) | 5520, 5591, 6159, 6160 | fiche de méthode, jeu du second projet |
| 12 | aucune zone d'ADV notée | — | — |

Rôle d'un cut, pour les mesures :
- **noyau** : à 10 cuts au plus d'une aiguille ;
- **marge** : le reste de la zone de Mic ;
- **PN** : dans un PN de Mic ;
- **hors zone** : tout le reste.

## 3. Les pistes essayées

Chaque piste n'utilise que ce qu'Ariane a au moment du cut :
- la capture du cut (le nuage autour des deux rails, ±50 cm le long de la voie, ±40 cm de chaque rail) ;
- la proposition du moteur (pool de candidats, écartement prédit) ;
- les différés du lot ;
- pour les verts, l'écartement de la pose de départ (fenêtre de B1).

Deux sources :
- **lot** : les captures du lot, celles que le lot lit au moment du cut (parties 29 et 1 du second projet) ;
- **Écho** : la capture de la première visite de Mic. Elle couvre aussi des verts, mais elle est plus pauvre : lecture passive, souvent partielle, un seul rail parfois.

Taux d'alerte par rôle (alertes / cuts), et AUC du noyau contre PN et hors zone (0,5 : aucun pouvoir) :

| Partie | Source | Piste | Noyau | Marge | PN | Hors zone | AUC noyau |
|---|---|---|--:|--:|--:|--:|--:|
| 29 | lot | **rail de plus** | **22/22** | **11/11** | **0/26** | **1/186** | **1,00** |
| 29 | lot | cut différé | 7/22 | 4/11 | 2/26 | 22/186 | 0,60 |
| 29 | lot | grappe de différés (règle `grappe-differes`) | 8/22 | 3/11 | 0/26 | 2/186 | 0,68 |
| 29 | lot | deux minima concurrents (2 grappes dans le pool) | 1/22 | 0/11 | 0/26 | 0/186 | 0,52 |
| 29 | lot | minima concurrents forts (3 ou plus) | 7/22 | 0/11 | 8/26 | 70/186 | 0,48 |
| 29 | lot | écart de l'écartement prédit à la médiane | — | — | — | — | 0,82 |
| 29 | lot | variation de l'écartement prédit d'un cut à l'autre | — | — | — | — | 0,73 |
| 29 | lot | largeur du ballast (part du profil extérieur au niveau des traverses) | — | — | — | — | 0,01 |
| 1, 2ᵉ projet | lot | **rail de plus** | **72/94** | **172/254** | — | **0/3** | **0,88** |
| 1, 2ᵉ projet | lot | cut différé | 26/94 | 101/254 | — | 0/3 | 0,64 |
| 1, 2ᵉ projet | lot | grappe de différés | 22/94 | 98/254 | — | 0/3 | 0,62 |
| 1, 2ᵉ projet | lot | deux minima concurrents | 11/94 | 51/254 | — | 0/3 | 0,56 |
| 1, 2ᵉ projet | lot | écart de l'écartement prédit | — | — | — | — | 0,29 |
| 1, 2ᵉ projet | lot | variation de l'écartement prédit | — | — | — | — | 0,72 |
| 1, 2ᵉ projet | lot | largeur du ballast | — | — | — | — | 0,13 |
| 1, 2ᵉ projet | jeu | variation de l'écartement de départ (verts compris) | — | — | — | — | 0,68 |
| 13 | jeu | écart de l'écartement de départ | — | — | — | — | 0,39 |
| 13 | jeu | variation de l'écartement de départ | — | — | — | — | 0,32 |

Lecture :
- **Rail de plus** : seul signal fort et stable. Il est vu là où Mic place l'ADV, et presque jamais ailleurs.
- **Écartement** : il ne se transporte pas. En partie 29, l'écartement prédit est faussé au noyau (AUC 0,82) ; au second projet, c'est l'inverse (0,29). En partie 13, l'écartement de départ est normal dans l'ADV (déjà noté). Sa variation d'un cut à l'autre plafonne à 0,68–0,73.
- **Minima concurrents** dans le pool du moteur : sans pouvoir. Deux grappes de minima sont rares partout ; trois minima forts ou plus sont aussi fréquents hors zone.
- **Grappe de différés** : elle voit un tiers du noyau, et rien des marges. C'est la trace d'un ADV dans un lot, pas sa reconnaissance.
- **Largeur du ballast** : part du profil extérieur (de −40 à −10 cm) au niveau du ballast plutôt qu'en contrebas. Elle va **à l'envers** de l'idée de départ : dans les ADV de ces deux lots, le profil extérieur est plus bas qu'ailleurs (AUC 0,01 et 0,13). Le signal dépend du site (talus, piste, autre voie) et ne repose que sur quelques dizaines de cuts groupés autour de six aiguilles. Il n'est pas retenu, et il n'a pas été essayé en combinaison avec le rail de plus.

## 4. Le détecteur retenu : « rail de plus »

Fonction `railsDePlus` de `src/regles-metier.js`, appelée par `surface()` sur la capture du cut. Elle lit **tous** les points de la capture, visibles ou non : la fenêtre d'ESV coupe souvent les rails voisins. La surface « au ras » des PN garde ses points visibles : elle ne change pas.

Pour chaque rail posé :
1. **Repère du rail** (celui du lecteur de PN) : le long de la voie, latéral positif vers l'autre rail, hauteur relative à la pose de départ.
2. **Profil en travers** : pas de 1 cm de −40 à +40 cm, points à ±50 cm le long de la voie, de −40 à +20 cm en hauteur. Pour chaque pas (3 points au moins), on note :
   - le 90ᵉ centile de la hauteur ;
   - la **continuité** : la part des tranches de 10 cm le long de la voie où un point dépasse −3 cm.
3. **Classe** d'un pas :
   - **haut** : 90ᵉ centile au-dessus de −3 cm et continuité d'au moins 50 % ;
   - **mi-haut** : haut mais discontinu ;
   - **bas** : au-dessus de −8 cm ;
   - **creux** : en dessous ;
   - **vide**.
4. **Rail de plus** : une suite de pas hauts, hors de la tête du rail posé (−9 à +3 cm), qui remplit **toutes** ces conditions :
   - large de 3 à 16 cm ;
   - elle ne touche ni le bord de la fenêtre ni la tête (on ne saurait pas l'en séparer) ;
   - ce n'est pas le **contre-rail d'une courbe** : début à 6,5 cm au plus et fin à 12,5 cm au plus, côté voie. En partie 29, il court sur des centaines de cuts, d'un côté puis de l'autre ;
   - elle est bordée des deux côtés par un pas bas, creux ou vide, après au plus 3 pas mi-hauts ;
   - un creux est à 5 pas au plus d'un de ses bords. C'est ce qui sépare un champignon d'une rampe ou d'un remblai : en partie 29, de 1791 à 2080, une surface qui monte côté voie donnait 15 fausses alertes à l'Écho et 4 au lot avant cette condition.
5. **Côté plat écarté** : si plus de la moitié des pas hors de la tête sont hauts, c'est une chaussée de PN ou un quai au ras.

Elle rend le nombre de rails de plus et, par côté, leurs bornes en centimètres. Jamais une position.

Coût : 7 ms en moyenne par capture, 29 ms au plus (80 captures du second projet, 17 000 points en moyenne). Ce calcul est fait avec la surface du PN, au moment de la décision du cut.

Concordance : le module de l'extension et la règle de l'étude (`scratchpad/adv/regle.cjs`, hors dépôt) donnent le même compte sur les **596 captures** des deux lots.

## 5. La zone `adv` (en ombre)

- **Alerte** : un cut du lot dont la capture montre au moins un rail de plus.
- **Ouverture** : deux alertes à 3 cuts au plus. Une alerte seule reste « non confirmée ».
- **Extension** : tant que les alertes se suivent à 10 cuts au plus.
- **Plage à contrôler** : de 30 cuts avant la première alerte à 30 cuts après la dernière. Dans un lot qui avance, les 30 cuts d'avant sont déjà passés : la plage sert à la liste des verts, calculée en fin de lot.
- **Événement** `regles-metier-ombre` :
  - `surface.advRails` : nombre de rails de plus du cut ;
  - `zone.adv` : `alerte`, `alerte-non-confirmee`, `marge-apres`, `dans-la-zone`, ou rien ;
  - `zone.advControle` : la plage ;
  - les seuils `adv` figurent au premier événement du lot.
- **Aucune règle** ne lit la zone. Le verdict `aurait` est celui des autres règles.
- **Verts de la fenêtre de B1** : un vert dans la plage est signalé avec la raison `adv`, comme `pn`.

## 6. Rappel et fausses alertes, par partie

Rejeu avec le module de l'extension (`tools/regles-metier.cjs`, option `--adv`). Lot : dans l'ordre du lot. Écho : dans l'ordre des cuts, comme si un lot les avait tous vus.

| Partie | Source | Zones de Mic retrouvées | Aiguilles couvertes | Plages sans ADV | Cuts des zones de Mic dans une plage | Cuts des plages hors zones de Mic | Alertes : noyau / marge / PN / hors zone |
|---|---|--:|--:|--:|--:|--:|---|
| 29 | lot | **2/2** | **2/2** | **0** | 187/234 | 28 | 22/22 · 11/11 · 0/26 · 1/186 |
| 29 | Écho | **2/2** | **2/2** | **0** | 222/234 | 62 | 21/30 · 42/110 · 0/52 · 0/398 |
| 1, 2ᵉ projet | lot | **4/4** | **12/12** | **0** | 764/1266 | 102 | 72/94 · 172/254 · — · 0/3 |
| 1, 2ᵉ projet | Écho | **4/4** | **12/12** | **0** | 715/1266 | 107 | 39/144 · 94/276 · — · 0/19 |
| 13 | Écho | **2/2** | **2/2** | **0** | 123/123 | 65 | 10/33 · 16/50 · 0/66 · 0/5 |
| 12 | Écho | pas d'ADV | — | **0** | — | 0 | — · — · 0/74 · 0/8 |

Plages reconnues :
- **partie 29**, lot : 6530–6601 et 6603–6674 (ADV1, passage de Mic 6558–6678), 7972–8042 (ADV2, 7954–8066) ;
- **second projet**, lot : 105–167 (Z1), 256–689 (Z2), 2899–3042 (Z3), 5488–5625 et 6128–6214 (Z4). Le milieu de Z4 (5626–6127) n'a ni cut du lot ni aiguille notée ;
- **partie 13**, Écho : 4617–4716 (ADV1) et 4904–4991 (ADV2).

Lecture :
- **Au niveau de la zone**, rappel de 100 % sur les trois parties qui ont des ADV, et zéro plage sans ADV. Le critère « 80 % de rappel et peu de fausses alertes sur deux parties au moins » est tenu.
- **Au niveau du cut**, le noyau est vu à 100 % en partie 29 et à 77 % au second projet (lot). À l'Écho, il descend à 30–70 %, parce que la capture de Mic est partielle.
- **Les marges** ne sont pas toutes vues : la voie qui diverge sort de la fenêtre de ±40 cm. En partie 13, l'ADV1 n'a aucune alerte de 4664 à 4676, entre l'entrée de la zone et l'aiguille. Ce sont les marges de 30 cuts qui couvrent ce trou.
- **Les cuts des plages hors zones de Mic** (28 à 107) sont surtout des marges qui débordent la zone notée par Mic (6530–6557 avant le passage de 6558 ; 4617–4643 avant l'ADV1 de la partie 13). Mic dit lui-même que ses marges vont de 20 à 40 cuts.
- **Zone 2 du second projet** : la plage 256–689 colle à la zone « bordélique » de Mic (271–670).
- **PN** : aucun cut de PN ne donne d'alerte (0 sur 218), à l'Écho comme au lot. La condition « côté plat » les écarte.

Parties sans liste d'ADV (zones **à faire confirmer par Mic**) :

| Partie | Source | Alertes | Plages reconnues |
|---|---|--:|---|
| 17 | lot | 17/268 | 4526–4589, 5463–5531 |
| 24 | lot | 6/515 | 8272–8360 (les deux zones « à confirmer » de la fiche des règles métier, 6569–6585 et 8518–8535, ne donnent aucune alerte) |
| 18 | lot | 57/421 | alertes confirmées en 6905–6918, 6953–6962, 7087–7103, 7116–7147 |
| 23 | lot | 15/621 | 3231–3237, 3280–3289 |
| 25 | lot | 3/454 | 239–242 |
| 26 | lot | 44/370 | 2874–2883, 2904–2909, 2943–2960, 3642–3647, 3663–3665, 4106–4111, 4125–4132 |
| 27 | lot | 8/524 | 7464–7466, 8429–8434 |
| 28 | lot | 0/188 | — |

Pour les parties 18 à 28, ce sont les suites d'alertes confirmées, sans les marges (balayage de l'étude, même règle).

## 7. Branchement sur la liste des verts à contrôler

- **Module** `src/verts-a-controler.js` :
  - nouvelle entrée `zonesADV` (plages à contrôler) ;
  - un vert de la plage devient **candidat**, même loin de tout cut du lot, comme un vert de PN ;
  - nouveau terme de score `adv`, de poids **0** (livré) : la zone fait entrer les verts, c'est leur géométrie (écartement, hauteur, dénivelé) qui décide ;
  - libellé de plage « ADV a–b ». Ordre des libellés : PN, puis différé, puis ADV, puis grappe.
- **Service worker**, action `verts-a-controler` : les plages viennent des événements `regles-metier-ombre` (`zone.advControle`), fondues comme celles des PN. La liste exportée porte `zonesADV`.
- **Outil** `tools/verts-a-controler.cjs` : `extraire --regles` lit `zonesADV.plages` ; terme `adv` dans l'étude (poids 0 dans la grille).

**Gain mesuré** (`tools/verts-a-controler.cjs` et ses tables, mêmes réglages que la fiche des verts, zones du rejeu ci-dessus) :

| Partie | Sans zone d'ADV : verts, erreurs > 10 mm, gros écarts, minutes | Avec zone d'ADV (poids 0) | Erreurs encore manquées en zone d'ADV |
|---|---|---|---|
| **1, 2ᵉ projet** | 77 verts, 27/35, 15/20, 4,8 min | **84 verts, 33/35, 20/20, 5,2 min** | 160 (13 mm), 5549 (12 mm) |
| 29 | 121, 63/83, 38/39, 7,5 min | identique | 6604 (11 mm) |
| 13 (sans lot) | 29, 27/29, 26/26, 1,8 min | identique | 4650 (15 mm), 4960 (12 mm) |
| 12 (sans lot) | 37, 30/31, 28/28, 2,3 min | identique (aucune zone) | — |
| 17 | 188, 67/126, 16/16, 11,6 min | 189, 67/126, 16/16, 11,7 min | 5527–5529 (10 à 24 mm) |
| 24 | 63, 37/47, 8/8, 3,9 min | identique | — |

Au second projet, la zone retrouve 157, 158, 159 (zone 1), 594 (zone 2), 5550 et 5551 (zone 4) : **6 des 8 erreurs** que la liste manquait, dont les **5 gros écarts**. Elles avaient toutes un écartement ou une hauteur qui sortait : il leur manquait d'être candidates.

Poids essayés pour le terme `adv` (« contrôler toute la zone ») :

| Poids | 2ᵉ projet | 29 | 13 | 17 |
|---|---|---|---|---|
| **0 (livré)** | 84 verts, 33/35 | 121, 63/83 | 29, 27/29 | 189, 67/126 |
| 0,25 | 118, 34/35 | 123, 63/83 | 29, 27/29 | 202, 69/126 |
| 0,5 | 156, 35/35 (9,6 min) | 138, 63/83 | 33, 29/29 | 218, 69/126 |
| 1 | 396, 35/35 (24 min) | 260, 64/83 | 146, 29/29 | 277, 70/126 |

Un poids non nul revient à relire toute la zone, comme Mic le fait. Le poids 0,5 trouve toutes les erreurs au second projet et en partie 13, mais il double la liste du second projet et n'apporte rien en partie 29. **Livré à 0, à décider avec Mic.** Marges de 20 au lieu de 30 cuts : 31/35 au lieu de 33/35 au second projet, le reste inchangé.

Effet sur les verts signalés par l'ombre (fenêtre de B1, raison `adv`) : 37 de plus au second projet, 7 en partie 29, 10 en partie 17, pour une seule erreur de plus. Ces signalements restent dans le journal. La liste de fin de lot ne les reprend pas : elle trie par le score.

## 8. La pose ne change pas

- `tests/detection-adv-sw.test.cjs` : service worker réel en VM, moteur et GCV1 réels, ESV simulé, lot 112–115. La capture de l'essai (partie 23, cut 2855) montre un rail de plus de chaque côté : 114 est une alerte seule, 115 la confirme (plage 84–145).
  - Ombre livrée contre ombre coupée : mêmes commandes ESV dans le même ordre, mêmes rails, mêmes enregistrements, mêmes événements métier, **décisions du lot identiques octet pour octet**.
  - Aucune règle d'ADV dans l'événement. Les verdicts sont ceux des autres règles. Aucune position.
- `tests/regles-metier-ombre-sw.test.cjs`, `-actif-sw`, `-panne-sw`, `-verts-sw`, `tests/b1-sw-ombre.test.cjs` : inchangés, ils passent avec la zone.
- `tests/verts-a-controler-sw.test.cjs` :
  - la liste lit la zone dans le journal (vert 130 de l'instantané : « ADV 84–145 ») ;
  - un vert loin du lot et de toute zone reste dehors ;
  - aucune commande à ESV, aucun message à l'onglet ;
  - décisions identiques, liste active ou coupée.
- `tests/regles-metier.test.cjs` et `tests/verts-a-controler.test.cjs` : détecteur et zone sur une voie fabriquée (rail de plus vu ; contre-rail de courbe, chaussée de PN et rampe écartés ; confirmation, marges, verdicts inchangés ; verts candidats et libellé).
- `tests/reglages-figes.test.cjs` : les seuils figés concordent avec le module ; poids `adv` nul.
- Aucun fichier de `src/` autre que le module ne lit les règles métier. `src/engine.js` n'est pas touché : le verify compare son empreinte à la référence.

## 9. Réglages figés et parties

`datasets/reglages-figes.json`, entrée `reglesMetier`, clé `adv` (version `adv-rail-de-plus-v1`, 17/10).

Choisis **après avoir vu** les parties 29, 13 et 1 du second projet :
- le saut de 3 pas mi-hauts et le creux à 5 pas (d'abord 1 et 3 : même rappel par zone, moins d'alertes par cut, une aiguille de moins au second projet) ;
- la condition de bord (sans elle, une plage sans ADV en partie 29, de 1911 à 2062) ;
- les marges de 30 cuts (20 : 31/35 au lieu de 33/35 sur la liste du second projet) ;
- le poids nul du terme `adv`.

Pris de la règle des PN sans réglage : deux alertes à 3 cuts au plus pour confirmer.

Toutes les parties étiquetées ont servi. Les parties 17 et 24 n'ont pas de liste d'ADV. **Aucun chiffre de cette fiche n'est un jugement à l'aveugle.** Le jugement viendra des parties suivantes, en ombre, contre ce que Mic notera.

## 10. Limites et doutes

- **Petits effectifs.** 8 zones de Mic dans trois parties, et un seul projet en plus du premier. Peu de cuts hors zone au second projet (3 au lot, 19 à l'Écho) : sa mesure de fausses alertes repose sur la partie 29 et la partie 12.
- **Fin des zones 2 et 4** du second projet : non déclarée, prise au dernier cut que Mic a traité. Le compte de « cuts couverts » en dépend.
- **ADV1 de la partie 29** : la fiche dit 6638–6678, mais Mic l'a parcourue de 6558 à 6678 d'un seul tenant, et le lot y voit des rails de plus dès 6560. La zone de cette fiche est donc 6558–6678. **À confirmer par Mic** : y a-t-il un second appareil vers 6560 ?
- **Ce que la zone ne voit pas** :
  - un ADV où l'extraction a réussi (aucun rouge) : Orbite n'y passe pas, comme pour les PN ;
  - la voie qui diverge au-delà de ±40 cm : la capture ne la contient plus ;
  - la partie de l'ADV entre deux alertes à plus de 10 cuts (partie 13, ADV1).
- **Une pose d'ESV décalée** (le rail posé n'est pas sur le vrai rail, second projet, 545–560) fait voir le vrai rail comme un rail de plus. C'est arrivé dans une zone d'ADV ; ailleurs, ce serait une fausse alerte. Ce cas n'a pas été mesuré à part.
- **Captures de l'Écho** : lecture passive, souvent partielle. Elles servent à juger le signal sur des cuts que le lot n'a pas vus, pas à le régler.
- **Temps** : 7 ms par cut dans la décision du lot (29 ms au plus). Négligeable devant le moteur, mais c'est du temps pris au moment du cut.

- **Suite (RM-1, 19/10)** : le détecteur figé rejoué sur les parties d'apprentissage notées depuis (1:15, 1:16, 2:11 en plus), et pourquoi il ne voit pas, au lot, la première ADV de 2:11 : `fiches/RM1_ADV.md`. Aucun réglage changé.

## 11. Ce que Mic doit décider

1. **Les zones reconnues hors liste** (§ 6) : parties 17, 24, 18, 23, 25, 26, 27. Sont-ce des ADV ?
2. **Les marges** : 30 cuts de part et d'autre te conviennent-elles ?
3. **« ADV avec ses marges : contrôler chaque cut »** : faut-il faire entrer dans la liste tous les verts de la zone (poids 0,5 ou 1 : de 2 à 5 fois plus de verts au second projet), ou seulement les verts suspects (livré) ?
4. **Une règle d'ADV pour le lot** (différer les cuts que le lot validerait dans une zone d'ADV, comme `pn-chaque-cut`) : elle n'est **pas** codée. À mesurer d'abord : au second projet, 9 faux verts sur 179 posés en zone 2 (fiche du second projet).

## 12. Rejouer

```
node tools/regles-metier.cjs lot --partie 1:29 --journal J.json --corpus SEG01.json [--corpus …] --jeu jeu-p29.jsonl \
     --pn 1652-1667,3342-3355,5978-5992,6466-6478 --adv 6558-6678:6638,7954-8066:8003 --sortie lot-p29.json
node tools/regles-metier.cjs lot --partie 2:1 … --pn 405-409 \
     --adv 116-165:136,271-670:287+320+552+616+626,2911-3036:2932+3012,5496-6185:5520+5591+6159+6160 --sortie lot-pr2p1.json
node tools/regles-metier.cjs echo --partie 1:13 --echo "dossier de l'Écho" --jeu jeu-p13.jsonl --pn … --adv 4644-4713:4682,4911-4963:4935 --sortie echo-p13.json
node tools/regles-metier.cjs rapport lot-p29.json lot-pr2p1.json echo-p13.json …     (table « Zones d'ADV »)
node tools/verts-a-controler.cjs extraire … --regles lot-p29.json --sortie t-1-29.json   (la table porte zonesADV)
node tools/verts-a-controler.cjs rejeu t-1-29.json t-2-1.json …
```

- Les entrées (journaux, corpus, Échos, jeux, tables) restent hors dépôt. Les sorties ne portent que des comptes et des numéros de cut.
- Lancer sous `nice -n 10`, avec le verrou des calculs lourds. Le rejeu des six parties prend quelques minutes.
- Les scripts de l'étude (profils codés, pistes comparées, balayage des autres lots, gain par poids) sont restés hors dépôt, dans le dossier de travail.
