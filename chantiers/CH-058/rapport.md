# CH-058 — Où part le temps au fil de la journée (rapport, 06/11/2026)

Données : journaux des lots du 04/11 (Constellation 0-4, Orbite 6-15, Constellation 0-7) et du 05/11 (8-12), segments Écho du 04/11 (8) et du 05/11 (17). Agrégats : `agregats-2026-11-04.json` et `agregats-2026-11-05.json` (`tools/ch058-temps-journee.cjs`). Banc : `banc-etat.json` et `banc-export.json` (`tools/ch058-banc-etat.cjs`, Chromium 153, extension du dépôt chargée, état synthétique). Essais : `tests/ch058-outils.test.cjs` (4, 0,4 s).

## Verdict
- **ÉTABLI. Ce qui ne ralentit pas.**
  - Le temps par cut du lot : médiane de 2,3 à 6,7 s par partie, sans tendance dans la journée. Il est porté par la lecture LiDAR (`command:capture`, 1 à 3,4 s).
  - Le temps par cut de la relecture : 0,7 à 3,5 s.
  - `goto-cut` : 23 ms en médiane, plat de 10:00 à 11:15.
  - Le changement de partie : 9 à 16 s.
- **ÉTABLI. Ce qui ralentit : les étapes qui relisent tout IndexedDB.** Le magasin `events` garde toute la journée tant que le cache n'est pas vidé (187 000 événements le 04/11 à 18:04, 114 000 le 05/11).
  - **Début de relecture** : +0,17 s ± 0,05 par tranche de 10 000 événements (n = 28, les quatre journaux). Pour l'Orbite du 04/11 : 0,31 s à 8 000 événements, 4,78 s à 175 000.
  - **Écho** : tous les blocages de plus de 5 s du 05/11 tombent dans les 0 à 5 s qui suivent un export automatique de segment.
    - Durée du blocage : 5,5 s à 10:27 (294 visites), 8,1 s à 10:47, 10,7 s à 11:09 (892 visites).
    - File du collecteur : jusqu'à 345 messages.
    - Autour d'un export : p90 6,4 s, 26 % des événements à plus d'1 s.
    - Ailleurs : médiane 0,1 s, p90 0,5 s, maximum 2,1 s, 0,9 % à plus d'1 s.
- **PROBABLE.** Les 835 Mo du panneau le 05/11 viennent des mêmes lectures complètes : +214 Mo de tas par lecture au banc, à 150 000 événements. Ce n'est pas démontré à l'octet.

## Causes classées (gain mesuré au banc)
| # | Cause (code) | Mesure | Gain attendu |
|---|---|---|---|
| 1 | Export automatique Écho : `dataset()` (SW, via `exportManifest`) et `assembler`/`lireDirect` (panneau) lisent TOUT `events` et `records`, puis filtrent la session | Pour 0 / 50 000 / 100 000 / 150 000 événements de lot :<br>• SW : 0,38 / 1,17 / 2,12 / 2,74 s<br>• panneau : 0,33 / 1,11 / 2,99 / 4,10 s, et +28 à +214 Mo de tas | Lecture par session (index `nativeSessionId` ou intervalle de clés) : retour à la ligne « 0 événement ». À 150 000 événements, −2,4 s côté SW et −3,8 s côté panneau à chaque export (un toutes les 3 à 4 min) |
| 2 | Lecture complète d'`events` au début de relecture (`vertsAControler`), à la liste de corrections, en fin de lot (deux endroits), à chaque relevé de la liste ESV comparé au précédent (`validationsAriane`) et à chaque vol écrit de la deuxième passe | Terrain : +0,17 s par tranche de 10 000 événements (4,8 s au pire, à 175 000). Banc : 2,7 s pour 181 000 objets | Index par `batchId`/`type`, ou compteurs tenus au fil du lot : de 3 à 4,5 s gagnés par étape en fin de journée |
| 3 | Session Écho gardée dans l'état et réécrite à chaque `save()`. `close()` la laisse en FINISHED : seuls `discard()` ou un nouveau départ la retirent | `save()` : 18 / 50 / 120 / 205 ms pour 0,4 / 1 / 2 / 4 Mo.<br>Cycle de visite Écho réel : 60 / 145 / 326 / 589 ms.<br>Vue du panneau (une par seconde) : 9 / 31 / 59 / 117 ms | Écho : 7,3 sauvegardes par visite, soit ≈ 0,7 s de SW gagnée par visite à 2 Mo.<br>Lot lancé après une Écho : 8,3 sauvegardes par cut (borne basse), soit ≈ +0,85 s par cut évité. PROBABLE : calcul sur mesures, non observé (le 05/11, le lot précédait l'Écho) |
| 4 | `exportAdvice()` (toutes les 5 s) : `cloudIds.filter(…includes)` en O(n²) | 27 à 29 ms à 7 000 identifiants dans Chromium (240 ms sous Node) | Avec un `Set` : moins de 2 ms. Mineur (0,6 % du SW) |
| 5 | Panneau : rétention par la vue | 6,2 Mo de tas à 3,7 Mo d'état, plat sur 120 s, nœuds DOM (2 297) et écouteurs (95) plats | Aucun : pas de fuite mesurée |

## Inventaire de ce qui grossit sans limite
Pour chaque élément : qui l'écrit, qui le lit, et comment le sortir.
- **IndexedDB `events`** (toute la journée, environ 0,86 Ko par événement).
  - Écrit par : `Engine.event`, `journalerSimple`, `nativeEvent`.
  - Lu en entier par : causes 1 et 2, `lotSeul` (export du journal), `export-cache`.
  - Sortie : index ou intervalles de clés. Rien n'est à retirer de la base.
- **IndexedDB `records`** (visite Écho : environ 40 Ko ; cut de lot : environ 7 Ko).
  - Lu en entier par : `dataset()`, `assembler`, `crossSessionIndex` (une fois par session), `discard`.
  - Sortie : index `nativeSessionId`.
- **`native.visits`** : 0,47 Mo pour 1 152 visites.
  - Écrit par : `visit-started` et `visit-ended`.
  - Lu par : le panneau (40 dernières visites, le compte, la raison), la continuité, l'export.
  - Sortie : garder les 40 dernières et le compte ; la liste complète est déjà dans `records` (`visitIndex`).
- **`native.cloudIds`** : 0,32 Mo pour 7 340 identifiants.
  - Ajout précédé d'un `includes` linéaire (native-session.js:400 et 445).
  - Lu par : `exportAdvice`, `exportManifest`, `discard`, le nettoyage du cache (background.js:2944).
  - Sortie : les clés du magasin `clouds` font foi ; garder un compte.
- **`native.exportState.exportedCloudIds` et `releasedCloudIds`** : 0,59 Mo.
  - Écrits par : `exportAck`.
  - Sortie : des compteurs, et l'ensemble des nuages en attente lu dans `clouds`.
- **`native.observationPeriods`** : 145 périodes, 0,10 Mo. Sortie : la période en cours et un compte.
- **La session Écho entière après `close()`** (1,5 Mo) : la sortir de l'état à la fin. L'export final est déjà écrit.
- **Bornés, sans action** :
  - `s.events` : 150 au plus ;
  - `batch` : 0,19 à 0,36 Mo, remplacé à chaque lot ;
  - `correction` : 0,01 à 0,09 Mo ;
  - `banane53Lectures` : 8 au plus.
- **Non mesuré** :
  - la mémoire du service worker hors état (`crossIndex`, structures de relecture) ;
  - les cartes de relecture et l'interface Signal du panneau (le banc n'ouvre que l'onglet Écho).

## Limites
- **Banc.**
  - La machine d'essai n'est pas le poste de l'opérateur (Windows, 14 cœurs) : l'ordre de grandeur vaut, pas le chiffre exact.
  - Les événements et les sessions du banc sont synthétiques, au poids moyen mesuré (0,86 Ko par événement ; 1,2 Mo pour 1 000 visites, contre 1,5 Mo sur le terrain).
- **Terrain.**
  - L'état au fil de la journée n'est pas journalisé. La taille de l'état Écho est lue dans chaque segment exporté. Le nombre d'événements dans IndexedDB est estimé par le rang au journal, multiplié par le rapport avant/après pli.
  - Aucun lot n'a tourné après une Écho dans ces données : la cause 3 côté lot est un calcul.
- **Essais.** Les essais ont été écrits après les outils : ils couvrent les fonctions pures (statistiques, agrégation, état synthétique). Le banc navigateur n'est pas un essai (2 à 4 min).
