# CH-109 : rapport de l'exécutant

Branche `chantier/CH-109`, partie de `claude/50-test17` (af74285). Tout est mesuré sur la **maquette ESV** (extension réelle dans Chromium) ou dans le service worker en VM ; rien sur le vrai ESV.

## 1. Constat (maquette, Constellation de 2 parties, 12 cuts, F5 de la page ESV après le premier cut relu de la partie 23)

| Réglage | Relecture | File | Statut |
|---|---|---|---|
| Livré (pause et reprise éteintes) | « erreur » au cut 9 (« Adaptateur ESV sans réponse : page ESV rechargée… ») ; rien ne la reprend | note `relecture-arretee`, passe en `changement`, puis **s'arrête `esv-muet`** 12 s plus tard : le changement de partie n'a pas ré-équipé la page rechargée | ÉTABLI (maquette) |
| Pause allumée (`actif:true`, F5 = pause) | « en-pause », raison `esv`, au cut 9 ; **aucune reprise automatique** (le rechargement de CH-060/CH-107 ne sert qu'aux raisons `signal` et `points`) | reste en `relecture` **sans limite** (200 s observées) | ÉTABLI (maquette) |

Lecture pour le terrain (PROBABLE, les exports ne sont pas livrés) : partie 16 = première ligne (relecture perdue au F5) ; partie 17 = deuxième ligne (relecture en pause, la file attend).

## 2. Inventaire des attentes de la file sans limite ni sortie automatique (`background.js`, `fileTic`)

| Ligne (après CH-109) | Attente | Limite | Sortie |
|---|---|---|---|
| 4395 | lot ouvert (`RUNNING`, `PAUSED`, `PAUSED_ADAPTER_UNRESPONSIVE`) : `classerLot` rend null | aucune | la reprise automatique CH-043 après F5 ; si elle refuse (pose en vol, cut non retrouvé), le lot reste en pause et **la file attend sans limite** |
| 4399 | `engine.task` (boucle du lot encore en vol après la fin) | aucune | finit avec la boucle (pas vu bloquer) |
| 4404 | deuxième passe en cours (`passeDiff.cours` / `passeDiff.ecriture`) | aucune dans la file | bornes propres de la passe |
| 4405 | retour sur la partie du lot (CH-039) pas encore fait | aucune dans la file | l'action `retour-lot` a sa borne (`changementBorneMs`) et rend toujours un événement |
| 4418 | relecture `preparation` / `en-cours` | aucune dans la file | bornes propres de la relecture |
| 4418 | **relecture `en-pause`** (raisons `esv`, `points` après échec du rechargement, `signal` après échec, `redemarrage`, `mic`) | **aucune** | `esv` : **A** la reprend seule après un rechargement (borne 90 s) ; au-delà, et pour les autres raisons : l'opérateur (B, coupé, l'aurait close sauf `mic`) |
| 4389 | `fileP.action` (une action de la file en vol) | celles des appels ESV de l'action | pas vu bloquer |

## 3. Corrections (après la décision de l'opérateur, D-341 : « je choisi A »)

**A. Après un F5, la relecture reprend seule au cut où elle était** (livré allumé).
- `BananeSettings.relecturePause = { defautActif: true, defautF5: 'pause' }`, lu par `relectureRepriseReglage` quand l'opérateur n'a rien choisi. Un choix fait dans le panneau porte désormais la marque `v: 2` et l'emporte toujours. **Migration unique** : un « éteint » gardé sans marque (posé avant D-341) passe à « allumé » une fois, marque comprise ; le choix du F5 est gardé ; journal `relecture-pause-reglage-migre`.
- `relectureEsvRevenue` : une pause de raison `esv` attend que Chrome dise la page rechargée (`chargementEsv.gen` différente de celle du début du cut), puis l'onglet chargé, le ré-équipe (aucune commande ESV), attend ESV prêt (`chargementEsvPret`) et reprend par le chemin de « Reprendre » (mêmes contrôles). Délais de CH-060 (`relectureSignalEteint` : `sondageMs`, borne `attenteRepriseMs` = 90 s). Sans rechargement ou sans ESV prêt dans la borne, elle reste en pause avec son message. Si l'opérateur reprend ou arrête entre-temps, Ariane s'efface. Journal `relecture-esv-revenue`. Vaut dans et hors Constellation. Sans rechargement vu, jamais de reprise seule (ESV figé : l'opérateur fait F5, puis la reprise est seule).

**C. Le changement de partie de la file après un F5 attend qu'ESV revienne** (défaut, pas de réglage nouveau). `changerPartieEsv(…, {attendreEsv:true})`, seulement pour le changement de partie de la file : ESV muet ou en rechargement, Ariane attend l'onglet chargé, le ré-équipe et relit, dans la borne `changementBorneMs` (60 s) ; au-delà, l'arrêt `esv-muet` d'avant. Journal `file-parties-esv-attente` (`revenu` ou `muet`, durée, essais). Les autres appelants (Aurore, CH-043, retour sur la partie du lot) ne changent pas.

**B. Relecture en pause close au bout d'un délai** : non choisi par l'opérateur ; reste dans le code, **coupé** (`file.relecturePauseMaxMs: null`). Une pause demandée par l'opérateur (raison `mic`) ne serait jamais close.

## 4. Autres arrêts ou attentes sans fin (non corrigés)

- **Lot de la file en pause après un refus de la reprise automatique CH-043** (ligne 4395, `classerLot` rend null pour un lot ouvert). Scénario : F5 pendant le lot d'une partie de Constellation alors qu'une pose est en vol (ou le cut affiché n'est pas retrouvé après le rechargement) ; CH-043 refuse la reprise et laisse le lot `PAUSED_ADAPTER_UNRESPONSIVE` avec son message ; le tic de la file attend un lot clos et attend donc sans limite, jusqu'au clic sur « Reprendre » ou « Arrêter ». SUPPOSÉ (lu dans le code, pas reproduit).
- **« Pose refusée par la page … remise impossible »** (partie 17, cut 338), établi par le code : en mode `tout-recentre`, `apply` pose le gauche puis le droit ; chaque rail commence par `select(side)`, un clic sur le bouton de sélection du rail qui ne déplace rien, puis l'attente du recentrage. « Vue ESV non recentrée sur le rail left » est levée avant tout clic de pose : rien n'a bougé ni été écrit. `restore` refait le même `select('left')` et échoue de même : « remise impossible » alors qu'il n'y a rien à remettre ; l'intention reste, la file s'arrête `ecriture-incertaine`. Sur le rail droit, le gauche serait déjà posé (non validé) : vrai cas à réconcilier. Proposition (non codée) : après une remise impossible, relire l'état (lecture seule) ; rails identiques à 1 mm à la pose d'avant et aucune écriture observée pour ce cut : effacer l'intention et rendre `correction-refusee`.

## Preuves (toutes mesurées le 11/11 sur la branche)

- Rouge puis vert, en VM :
  - A : `tests/ch109-relecture-pause-defaut.test.cjs` (défaut D-341, migration unique, choix de l'opérateur respecté) et `tests/ch109-relecture-esv-revenue.test.cjs` (reprise seule au cut 110 après rechargement, sans revoir 108 et 109 ; sans rechargement, la passe reste en pause avec son message ; l'opérateur qui reprend pendant l'attente passe avant).
  - C : `tests/ch109-file-relecture-pause.test.cjs`, 2 essais (ESV revenu dans la borne : partie suivante lancée ; muet toute la borne : `esv-muet` après la borne).
  - B : 4 essais, réglage coupé.
- Maquette : `tests/esv-maquette/ch109-constellation-relecture.test.cjs`, 2/2.
  - C, pause à l'ancien défaut : relecture en erreur au F5 ; le changement de partie attend ESV 557 ms ; file finie sur 23 et 24.
  - Réglages livrés : pause au cut 9, reprise SEULE au cut 9, 2,6 s après, sans clic ; cuts relus 4 et 9, une fois chacun ; la file change de partie seule et finit ; aucun SKIP.
  - Avant C, la même scène arrêtait la file `esv-muet` (constat du point 1).
- Essais maquette voisins verts, sur l'état d'avant A et C : `file-parties`, `relecture-signal-eteint`, `serie-captures-vides` (4/4).
- VM, tous les `tests/*.test.cjs` (3 516, 6 fichiers en parallèle) : 3 507 verts. Restent :
  - `ch094-reprise-apres-ecriture-refusee` n° 2 : passe seul (6/6), échec de temps sous charge ;
  - `scan-identite` : échoue aussi sur le tronc af74285 (motifs dans `tests/ch107-outils.test.cjs`), hors de ce chantier ;
  - `pose-lot-inchanges-4959` : corrigé, la nouvelle clé `relecturePause` est sortie de l'empreinte et affirmée à part.
- Parité de la relecture (`tools/parite-relecture-sw.cjs`, référence af74285 ; le montage de base garde l'ancien défaut de la pause) : relevés identiques (SHA-256 9984fe77…).
- Fichiers de décision, `src/adapter-page.js`, `manifest.json`, version : diff vide.
- Typage : `tools/typage-ch075.cjs` vert ; la référence de `src/file-parties.js` est refaite sur 3feab9e (à refaire sur le tronc si l'intégration ne garde pas ce commit).
- Maquette, hors sujet : avec `partie2` absent, le lot de la partie 24 finit en ERROR même sans F5 ; les essais prennent `partie2=6`. La relecture de la partie 24 finit en erreur sur la maquette, même sans F5 (non étudié).

## 5. Patch de la remise (chemin d'écriture, à part) : `chantiers/CH-109/remise.patch`

Accepté par l'intégrateur, il l'applique lui-même. Ce que fait le patch :
- `remettrePose` : quand la remise échoue, il relit l'état ESV en lecture seule. Si le cut est le même, que les deux rails sont à moins de 1 mm de la pose d'avant et qu'aucune écriture n'a été vue pour ce cut depuis la pose, il n'y a rien à remettre : l'intention est effacée et la raison est rendue (`correction-refusee`, journal `remise-sans-objet`). Sinon, l'arrêt d'avant reste.
- Nouveau relevé local `ecrituresParCut` (dernière écriture vue par ligne, aucune requête vers ESV).
- `poserPuisVerifier` passe l'heure de la pose à la remise.

Essai joint, `tests/ch109-remise-sans-objet.test.cjs` :
- rouge sans le code : le cas du rail gauche s'arrêtait en erreur ;
- vert avec le patch, 2/2 : rail gauche, rien n'a bougé, la passe continue ; rail droit, le gauche est déjà posé, l'arrêt reste avec l'intention gardée.

Avec le patch, mesuré sur la branche : 240 essais de la relecture et de la file verts, et parité de la relecture identique (9984fe77…).
