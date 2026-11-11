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
| 4347 | lot ouvert (`RUNNING`, `PAUSED`, `PAUSED_ADAPTER_UNRESPONSIVE`) : `classerLot` rend null | aucune | la reprise automatique CH-043 après F5 ; si elle refuse (pose en vol, cut non retrouvé), le lot reste en pause et **la file attend sans limite** |
| 4351 | `engine.task` (boucle du lot encore en vol après la fin) | aucune | finit avec la boucle (pas vu bloquer) |
| 4356 | deuxième passe en cours (`passeDiff.cours` / `passeDiff.ecriture`) | aucune dans la file | bornes propres de la passe |
| 4357 | retour sur la partie du lot (CH-039) pas encore fait | aucune dans la file | l'action `retour-lot` a sa borne (`changementBorneMs`) et rend toujours un événement |
| 4370 | relecture `preparation` / `en-cours` | aucune dans la file | bornes propres de la relecture |
| 4370 | **relecture `en-pause`** (raisons `esv`, `points` après échec du rechargement, `signal` après échec, `redemarrage`, `mic`) | **aucune** | **B** (réglable) pour toutes sauf `mic` |
| 4341 | `fileP.action` (une action de la file en vol) | celles des appels ESV de l'action | pas vu bloquer |

## 3. Corrections, prêtes, livrées à l'ancien défaut (accord écrit de l'opérateur requis)

**A. Défaut de la pause et de la reprise** — `BananeSettings.relecturePause = { defautActif: false, defautF5: 'pause' }` (proposé : `defautActif: true`). Lu par `relectureRepriseReglage` seulement quand aucun choix n'est gardé dans `banane51RelecturePauseReglage` ; un choix gardé l'emporte toujours. Attention : un opérateur qui a déjà décoché le réglage dans le panneau garde son « éteint ».

**B. Relecture en pause dans une Constellation** — `BananeSettings.file.relecturePauseMaxMs = null` (proposé : `300000`, 5 min, plus que les 90 s du rechargement automatique). Réglé : une relecture de la file en pause plus longtemps est close « interrompue » (`fileRelectureInterrompre`) : aucune commande ESV, rien d'écrit ; cuts non relus (du cut gardé à la fin de la sélection, plages sautées exclues) dans `relecture-fin` et au bilan de la partie (`relecture.nonRelus`) ; la file passe à la partie suivante (motif `relecture-arretee`). Une pause demandée par l'opérateur (« Pause », raison `mic`) n'est jamais close. Hors Constellation, rien ne change (seul le tic de la file la clôt).

## 4. Autres arrêts ou attentes sans fin vus (non corrigés)

- **Changement de partie après un F5** (constat ligne 1) : la file s'arrête `esv-muet` parce que `changerPartieEsv` lit ESV sans ré-équiper la page rechargée. Scénario : F5 pendant la relecture, réglages livrés. Avec B, même chose si l'opérateur ne reconnecte pas ESV.
- **Lot de la file en pause après un refus de la reprise automatique CH-043** : la file attend sans limite (ligne 4347).
- **Pause `esv` sans reprise automatique** : même dans une Constellation, la relecture ne repart pas seule après un F5 (A la met en pause ; il faut « Connecter » puis « Reprendre »). Le chemin de reprise de CH-060 (sans rechargement) pourrait servir ; non fait.

## Preuves (toutes mesurées le 11/11 sur la branche)

- Rouge puis vert : `tests/ch109-relecture-pause-defaut.test.cjs` (A, 3 rouges sur 4 avant le code, 4/4 après) ; `tests/ch109-file-relecture-pause.test.cjs` (B, 2 rouges sur 3 avant le code, 4/4 après).
- Maquette : `tests/esv-maquette/ch109-constellation-relecture.test.cjs`, 3/3 : livré (erreur au F5, file arrêtée `esv-muet`) ; A (pause au cut 9, panneau « Reprendre la relecture au cut 9 », reprise au cut 9, cuts relus 4 et 9 une fois chacun, file finie) ; A + B à 20 s (close 20,5 s après la pause, non relus [9], file finie, aucun SKIP). Essais maquette voisins verts : `file-parties`, `relecture-signal-eteint`, `serie-captures-vides` (4/4).
- VM : 255 essais de la relecture, de sa pause, de la file, des réglages et du typage, verts.
- Parité de la relecture (`tools/parite-relecture-sw.cjs`, référence af74285, réglages à l'ancien défaut) : relevés identiques (SHA-256 9984fe77…).
- Fichiers de décision, `manifest.json`, version : diff vide. `tools/typage-ch075.cjs` : référence de `src/file-parties.js` refaite sur 3feab9e (à refaire sur le tronc si l'intégration ne garde pas ce commit).
- Maquette, hors sujet : avec `partie2` absent, le lot de la partie 24 finit en ERROR même sans F5 ; les essais prennent `partie2=6`. La relecture de la partie 24 finit en erreur sur la maquette, même sans F5 (non étudié).
