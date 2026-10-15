# Dossier de passation Ariane — pour un modèle sans accès au dépôt

Généré depuis la branche `main` du dépôt `banane` (tête : 50b2bcb). Ce fichier est autonome : lis-le en entier avant de répondre.

## 0. Ton rôle

Tu aides la **direction** (l'opérateur, qui travaille dans les SIG) à **orchestrer, décider et cadrer** la version 4.9 d'Ariane :
brainstorm, cahier des charges, choix d'ordre et de portes chiffrées, grilles d'essai, prompts de développement. Tu n'as ni le dépôt
ni ESV : tu ne peux ni exécuter d'outil ni vérifier du code. Donc :
- **N'invente aucun chiffre ni aucun comportement d'ESV.** Les chiffres viennent des scripts du projet (rapports, `verify`, portes) ; ce
  dossier en donne l'état. Marque tes affirmations **VÉRIFIÉ** (lu dans ce dossier) ou **SUPPOSÉ** (déduit).
- Ce que tu produis est une **proposition** : la direction la relit, puis Claude (Opus pour le code risqué, Sonnet pour le bien spécifié)
  la vérifie contre le code et écrit ou **réécrit** le code. Ne prétends pas qu'un changement est fait, testé ou livré.
- Réponses courtes, en français. Une chose à la fois : le quota de la direction est limité.

## 1. Le projet en dix lignes

- **Ariane** (ex-Banane) est une extension Edge/Chrome (Manifest V3) qui pose des **rails** sur des coupes LiDAR (« cuts ») affichées dans
  la page web **ESV LiDAR**. Une **partie** est une suite de cuts numérotés de 0 à M−1.
- **Écho** observe le travail de l'opérateur (relecture) ; **Orbite** enchaîne automatiquement un **lot** de cuts : capture, décision,
  pose des deux rails, validation, cut suivant. « Deux rails ou rien » : sans pose fiable des deux rails, le cut est **différé** et
  l'opérateur le traite.
- Trois composants : un **adaptateur** injecté dans la page ESV (`src/adapter-page.js`, monde principal), un **pont** (`src/bridge.js`),
  un **service worker** (`background.js`) qui pilote le lot. Le **moteur** (`src/engine.js`) est **épinglé** (ne pas le modifier) ; la
  décision (`src/lot-decision.js`, `src/gauge.js`) ne change que sur décision datée de la direction, avec les portes J1.
- **Mesures** : C1 = part des cuts posés, C3 = poses hors contrat d'écartement (doit être 0), C4 = taux de **faux** (erreur > 10 mm, latéral
  ou vertical, contre le travail de l'opérateur à la relecture). Les rapports viennent de `tools/acceptance-report.cjs` ; l'analyse des
  exports lourds se fait chez l'opérateur (`tools/analyse-locale.cjs`, page `reducteur-exports.html`).
- **Portes** : `node tools/verify.cjs` (essais), portes J1 (`tools/portes-j1.cjs`), paquet reproductible (trois constructions identiques),
  puis la direction pose l'étiquette. **Ni merge, ni étiquette, ni publication sans l'accord de la direction.**

## 2. État au 30 septembre 2026

- **Stable : Ariane 4.8.5** (étiquette `v4.8.5` = `323356c`, publiée). Retour arrière : 4.8.0 (`v4.8.0`).
- **4.8.6 test 1 en essai** (branche `claude/banane-486-ki069`, décision D-065 non encore dans `main`) : corrige KI-069, voir §6.
- **Mesures 4.8.5** : lots 25 et 33 (test 1) C1 85,2 % et 84,0 %, C3 0 ; C4 partie 25 : 2 faux sur 62 jugés, **validé sur l'expertise de la
  direction** (pas une mesure conforme à la porte : moins de 100 jugés). 4.8.0, parties 21 à 24 : 1 faux sur 353 jugés.
- **Astra** (auditeur d'orchestration, autre modèle) est indisponible environ une semaine. Grok relit des diffs.
- **Décision de la direction (30/09), option B, chemin normal** : la porte de la 4.9.0 reste **cycle médian −25 %** (donc le chantier V3),
  C1 et C4 non dégradés ; aucun raccourci de périmètre ni de procédure ; « pas pressé, la meilleure version ». Chemin : 4.8.5 stable →
  **cahier 4.9 v0.2** (chantiers ordonnés, portes chiffrées) → audit d'Astra → **signature de la direction** → chantiers.

## 3. Règles de collaboration (non négociables)

- Décisions numérotées `D-0xx` dans `DECISIONS.md` ; une décision de la direction est citée telle quelle.
- Aucun code ni capture d'écran d'ESV dans les dépôts. Aucun identifiant de modèle dans les fichiers du dépôt.
- Pas de VALIDATE ni de SKIP automatique d'un cut non résolu ; cuts 9033 et 9241 exclus ; écartement [1405, 1470] mm en admissibilité seulement.
- Commits avec `Co-Authored-By` et `Claude-Session` ; un commit par chantier, préfixé `[Vn]`.

## 4. Ce que la direction attend de toi pour la 4.9

Un **brouillon de cahier 4.9 v0.2** à partir de `PLAN_SUITE.md` §3 et des mesures (§ « Mesures »), des **portes chiffrées** discutables, un
**ordre** des chantiers, des **risques** et des **questions ouvertes** ; puis, chantier par chantier, un **prompt de développement** précis
que Claude exécutera. Signale toute incohérence entre ce dossier et ce que tu supposes.

## 5. Contenu de ce dossier (recopié tel quel)

1. `LIRE_EN_PREMIER.md` (état) · 2. `PASSATION_4.8.0.md` (règles) · 3. `PLAN_SUITE.md` (plan, chantiers 4.9) · 4. `DECISIONS.md` D-057 à D-064 ·
5. `KNOWN_ISSUES.md`, lignes KI-061, KI-063, KI-066 à KI-069 · 6. `audit/lots-20-24-33-2026-09-29.md` (mesures) · 7. `consignes/analyse-locale.md`
(chaîne d'analyse) · 8. `consignes/demarrage-session-49.md` (décision B et ordre) · 9. `BANANE_4.9_CAHIER.md` (brouillon 0.1 du 24/09).

## 6. Point d'actualité : KI-069 / 4.8.6

Au dernier cut à valider d'une partie, Orbite valide avec le bouton d'ESV « valider et passer au suivant » : ESV charge alors la partie
suivante (terrain, partie 36 : « Cut 8785 of part 36 », « 8760 on 8786 treated » ; M = nombre de cuts, dernier cut = M−1). Correctif en essai
(4.8.6 test 1) : sur le dernier cut **certain** (N = M−1, M lu dans le compteur), Orbite valide par le raccourci d'ESV **Ctrl+Entrée**, qui valide
sans avancer (hypothèse de l'opérateur, à confirmer sur le terrain), vérifie l'effet (identité inchangée, compteur N → N+1) et ferme le lot ;
pas de repli automatique vers « valider et suivant ». Hors périmètre : export alourdi (KI-068), détection « lot terminé sauf différés ».

---


# ═══ LIRE_EN_PREMIER.md ═══

# Ariane — lire en premier

**Seul document d'état** (D6, 29/09/2026) : ce qui est installé, ce qui est en
cours, où en sont les mesures. Le plan est dans `PLAN_SUITE.md`, les règles
dans `PASSATION_4.8.0.md`, les problèmes dans `KNOWN_ISSUES.md` (trié le
29/09). `PROJECT_STATE.md` n'est plus que l'historique.

## État au 29 septembre 2026

| | |
|---|---|
| **Version stable** | **Ariane 4.8.5**, étiquette `v4.8.5` (`323356c`), publication GitHub « Ariane 4.8.5 — stable » du 29/09 avec `ariane-v4.8.5.zip` (SHA-256 `cf4401bf003d3a3ba7902c65062b84ef9a853ff3a60f2e7f84f0c47ff304484d`, vérifiée sur la publication) ; feu vert de la direction le 29/09 (D-063) ; à installer à la place de la 4.8.0 : `consignes/installation-4.8.5.md` |
| **Retour arrière** | **Ariane 4.8.0**, étiquette `v4.8.0` (`fabd77e`, paquet `38aa29a2…`, reconstruit à l'identique le 29/09) ; `RETOUR_ARRIERE.md` |
| **En cours** | 4.8.5 publiée ; la suite (4.9) démarre selon `consignes/demarrage-session-49.md`. Les paquets de test 1 et 2 et le premier candidat (`8911282`) ne sont pas des versions : ni étiquetés ni publiés |
| **Portes de J1** | `node tools/portes-j1.cjs` (`audit/portes-j1/`) : depuis D2 (29/09), toutes VERTES : 633 cuts inchangés ; 8 jeux : 707, 711 refusés, 718 posé, 0 juste perdu |
| **Mesures 4.8** | `audit/rapport-sortie-4.8.md` : C1 tenu (parties 9 et 12 : 79,3 % et 79,2 %), C4 4 faux sur 161 jugés, C3 0 hors contrat. Après la sortie : partie 11, 44 jugés, 0 faux ; partie 15, C1 76,5 %, **C4 non mesuré** (D-060) |
| **Mesures 4.8.5** | `audit/rapport-sortie-4.8.5.md` : lots 25 et 33 (test 1) : C1 85,2 % et 84,0 %, C3 0 ; C4 partie 25 : 2 faux sur 62 jugés, **validé sur l'expertise de la direction**, sans mesure conforme à la lettre (moins de 100 jugés, D-063) ; lot 33 sans relecture (« RAS ») |
| **Problèmes ouverts** | KI-067 corrigé (D3, D-062), **non exercé en réel** (lots 25 et 33 sous le test 1) ; KI-068 (export du journal d'Orbite alourdi par Écho), accepté pour la 4.8.5 |
| **Prochaine tâche de l'opérateur** | installer la 4.8.5 à la place de la 4.8.0 (`consignes/installation-4.8.5.md`), puis désactiver les versions de test |

## Démarrer avec Ariane 4.8.0 (version stable)

**Banane devient Ariane.** Le mode Natif devient **Écho** (Ariane observe ton
travail dans ESV et l'enregistre), le mode Pilote devient **Orbite** (Ariane
place et valide les rails d'un lot de cuts). Version officielle **4.8.0**,
validée par la direction le 28/09 (D-058), avec les corrections de l'audit
qualité d'Astra (D-059).

Installe `ariane-v4.8.0.zip` **final du 28/09** (`38aa29a2…`, empreinte dans
`PASSATION_4.8.0.md` ; le paquet du matin, `d3874290…`, est remplacé) dans
Edge **par-dessus la 4.7.21** ou le paquet du matin, dans le même dossier
(bouton « Recharger » de la page des extensions) : ne supprime pas
l'extension, sinon le stockage en cours est perdu. Termine ou arrête le lot en
cours avant, puis **recharge la page ESV**. Vérifie **4.8.0** sous ARIANE sur
l'accueil, et **Ariane 4.8.0 · ouvrir** sur le bouton blanc au bas d'ESV.

**Nouvelle permission « Téléchargements »** : Ariane enregistre ses fichiers
par le gestionnaire de téléchargements d'Edge, qui lui dit si chaque fichier
est bien écrit. Écho ne supprime plus rien de son stockage sans cette
confirmation, et chaque export te dit s'il est enregistré.

**Taille de la fenêtre d'ESV** : Ariane pose les rails en cliquant dans la
vue d'ESV ; plus cette vue est large, plus la pose est précise. Garde-la
d'au moins 600 pixels de large (la 4.8.0 finale tolère jusqu'à 300 ; en
dessous, la pose peut être refusée et le message le dit).

### Ce que l'audit qualité a fait corriger (D-059)

- Écho ne purge plus un nuage LiDAR tant que le fichier qui le contient n'est
  pas confirmé écrit (KI-064).
- En fin de lot, le bouton principal est **« Tout télécharger pour
  l'analyse »** ; s'il manque un fichier ou une capture, le message le dit et
  reste affiché.
- La tuile « Couverture » compte comme le rapport (C1) : posés sur tous les
  cuts du lot, dernier cut compris.
- Écho n'est plus proposé pendant une reprise manuelle d'Orbite ; couleurs
  d'état plus lisibles.

### Ce que la 4.8 change sur le terrain

- **ESV lent : F5 puis « Reprendre ».** Quand les nuages n'apparaissent pas
  ou que la vue ne se recentre pas, Ariane redemande d'abord le recentrage
  (trois fois), puis se met en pause et te demande de rafraîchir ESV (F5).
  ESV repart alors du premier cut non validé : clique sur « Reprendre »,
  Ariane revient seule au cut du lot avec « cut non validé suivant », **sans
  rien valider**, rattache le lot à la nouvelle page et reprend. Même chose
  après « adaptateur sans réponse ». Si le F5 tombe **pendant une pose**,
  Ariane ne sait pas si le rail a été posé : contrôle le cut dans ESV,
  clique sur « Archiver le résultat interrompu », puis sur « Reprendre ».
  En Écho : « Connecter » puis « Reprendre ».
- **Plus d'arrêt sur un silence d'ESV** : Ariane attend jusqu'à environ
  70 s (« ESV ne répond pas encore… ») et reprend seule ; « Pause » et
  « Arrêter » restent respectés ; une annulation en retard ne coupe plus le
  lot suivant (KI-063).
- **Tout télécharger pour l'analyse** : journal, bilan, diagnostic et corpus
  en un clic, dans les détails d'Orbite. C'est ce qu'il faut m'envoyer après
  un lot. Edge peut demander d'autoriser plusieurs téléchargements.
- **Fichiers `ariane-…`** : les exports s'appellent désormais
  `ariane-journal-v4-…`, `ariane-bilan-v4-…`, etc. Les anciens restent lisibles.
- **Interface** : « Masquer / Afficher les détails », « partie » partout,
  légende SKIP seulement si un SKIP a servi, bouton d'ouverture blanc et
  discret dans ESV.
- **Ce qui ne change pas** : le moteur, la décision sur le lot, les contrôles
  avant commande, le contrat d'écartement, les formats de données.

En cas de problème, reviens à la 4.7.21 (`RETOUR_ARRIERE.md`).

Historique des versions précédentes : `CHANGELOG.md`, `PASSATION_4.7.21.md`, `audit/historique/lire-en-premier-4.7.21.md`.


# ═══ PASSATION_4.8.0.md ═══

# Passation — Ariane au 28/09/2026 (4.8.0 validée, audit qualité intégré)

À lire en premier par la conversation qui reprend. Remplace `PASSATION_4.7.21.md`
(gardé pour l'historique, ses règles restent valables). Banane s'appelle
désormais **Ariane** ; Natif → **Écho**, Pilote → **Orbite** (D-058).

## Contexte

- Extension Chrome/Edge MV3 qui place les rails sur le LiDAR d'ESV. Utilisateur :
  SIG, parle français, opérateur terrain et direction du projet.
- Dépôts : `StoryNow30/banane` (branche `claude/banane-48-cahier`),
  `StoryNow30/banane-data` (branche `claude/banane-47-gate-audit-vaktr1`).
- **4.8.0 validée par la direction le 28/09** (D-058) ; **audit qualité
  d'Astra** le même jour (`audit/chantiers/audit-qualite-480.md`) : un P1
  (KI-064) et des P2 corrigés **dans la 4.8.0**, avant sa sortie ; la
  version reste 4.8.0 (direction ; D-059 ; réponse :
  `audit/chantiers/qualite-480/reponse.md`). Retour arrière : 4.7.21
  (`RETOUR_ARRIERE.md`).
- Reste, **sur autorisation explicite** : merge dans `main`, étiquette `v4.8.0`.

## Paquet

`ariane-v4.8.0.zip` final, SHA-256
`38aa29a28bc0695258dd444adb2844752a340ef3c6de30c22939ef6b8575e25b`, construit
depuis `fabd77e` par `git archive` + `tools/package.py`, reproductible (deux
constructions identiques ; inclut la pose au pixel près, KI-065, essai
terrain du 28/09 ; remplace `76e435e9…`, depuis `c21636c`) ; chargé dans Chromium comme extension MV3 :
service worker 4.8.0, cerveau actif, `lot-decision-v6`, vues sans erreur ;
téléchargements confirmés (4 fichiers) ou refus signalés
(`tools/navigateur-telechargements.cjs`). Copie, captures et vidéo : banane-data
`travail/2026-09-28_ariane-480-final/`. Le premier paquet 4.8.0 du matin
(`d3874290…e1b1fe58f`, depuis `a68201a`) est **remplacé** : il garde KI-064.

## Règles non négociables

Celles de `PASSATION_4.7.21.md`, sans changement : pas de reset destructif,
force push, merge, tag ni release sans autorisation explicite ; contrat
d'écartement [1405, 1470] mm en admissibilité seulement ; les deux rails ou
rien ; pas de VALIDATE/SKIP automatique d'un cut non résolu ; `src/engine.js`
épinglé ; parties de validation jamais utilisées pour régler (rotation,
D-057) ; essais < 10 s par fichier ; `node tools/verify.cjs` à 0 avant chaque
commit ; commits avec `Co-Authored-By` et `Claude-Session`, aucun identifiant
de modèle dans les fichiers.

## Corrections de l'audit qualité (D-059)

- Téléchargements par `chrome.downloads` (permission `downloads`) : chaque
  fichier est confirmé écrit ou signalé ; Écho ne purge que les segments
  confirmés (`panel.js` saveBlob/writeSegments, `src/native-session.js`
  ackExported).
- « Tout télécharger pour l'analyse » en action principale de fin de lot,
  bilan fichier par fichier ; couverture du panneau = C1 ; Écho indisponible
  pendant une reprise manuelle ; contrastes WCAG ; vue du panneau allégée
  avant copie (`vuePanneau` dans `background.js`).
- Outils : `tools/perf-lot.cjs` (intervalles GCV1 / décision / complète),
  `tools/navigateur-telechargements.cjs` (Chromium réel, hors banc).
- Reportés : C02 en 4.8.x ; C01, P01 stockage, P03, U04, provenance D04 en
  4.9 (`BANANE_4.9_CAHIER.md` §2).

## Ce que la 4.8.0 a livré

- **Noms** Ariane / Écho / Orbite (interface, messages, exports `ariane-…` ;
  identifiants internes et formats inchangés).
- **ESV lent : F5 puis « Reprendre »** (option 1, D-058) :
  `retablirApresRechargement`, `rebaserLot`, `reprendreLot` dans
  `background.js`. Retour au cut du lot par « cut non validé suivant »
  (400 pas au plus), sans rien valider ; appuis translatés dans le nouveau
  repère (vérifiés sur les deux rails à 1 mm), sinon écartés.
- **Page rechargée ou fermée pendant une commande** : erreur Chrome traduite
  en « adaptateur sans réponse » dans `callSur` (code `ESV_PAGE_ABSENTE`).
  Pose interrompue : réconciliation, « Archiver le résultat interrompu »,
  puis « Reprendre ».
- **ESV muet** (KI-063) : attente longue une fois le lot en route, Pause et
  Arrêter respectés ; cut de fin muet sans pose : `stoppedAtEnd.issue`
  `fin-sans-pose` ; annulations ciblées (`requestId`, `sentAt`).
- **Interface** : bouton blanc discret dans ESV, « Tout télécharger pour
  l'analyse », détails repliables, « Arrêter » toujours cliquable.
- **Rapport de sortie** : C1 tenu (objectif 79 %), C2 publié sans plancher,
  C3, C4 (faux isolés typés), C5 tenus (`audit/rapport-sortie-4.8.md`).

## Validation (28/09)

- Rejeu du code final sur tous les lots reçus : parties 12, 11, 9 (4.7.18 et
  4.7.19), 633 cuts, décisions identiques ligne à ligne ; moteur et décision
  sur le lot inchangés depuis la 4.7.21.
- Sept revues de code sur la reprise ; chaque constat a son essai rouge sans
  le correctif. Après l’audit et l’essai du 28/09 : 870 essais, 868 passés, 2 sautés (corpus natif absent).
- **Simulé seulement** : le rechargement d'ESV et les textes d'erreur de
  Chrome. À surveiller au premier lot terrain (bilan et journal via « Tout
  télécharger pour l'analyse »).

## 4.8.5 (prévu)

- Lire la fin de partie dans ESV (« N on M treated », photo du 27/09 : 6593
  on 6732, partie 14).
- D-054 (voisins validés), choix à un appui (7738, 7026), garde de premier
  passage à 20 mm de la voie (7743, 1834) : au banc, puis sur une partie neuve.
- Biais vertical (partie 9) : hypothèse à chercher au banc (D-057).
- P2 : 4.9 (D-057).

## Skills

Les skills installés sur l'ordinateur de l'utilisateur ne sont pas visibles
d'une session cloud. Pour les partager : pousser leurs dossiers (`SKILL.md`
et fichiers) dans `banane/.claude/skills/<nom>/`, ou les envoyer en pièce
jointe.

## Consommation

Réponses courtes, sorties filtrées, un banc ciblé à la fois.


# ═══ PLAN_SUITE.md ═══

# Plan de la suite — 4.8.5, 4.9 (plan vivant)

Seul plan en vigueur ; `NEXT_TASKS.md` et `PLAN_4.8.md` sont clos. Règles de
pilotage : D-060, D-061. Diagnostic et portes : `audit/chantiers/audit-orchestration-485.md` ;
contre-regard d'Astra et suites données : `audit/chantiers/audit-orchestration-485-astra.md`.
Ta fiche pas à pas : `consignes/operateur-suite.md`.

## 0. Jalons

| Jalon | Contenu | Porte |
|---|---|---|
| **J0** clôture 4.8.0 — **faite** | étiquettes créées et vérifiées ; qualité finale validée par l'expertise de la direction, **C4 de la partie 15 non mesuré** (D-060) | clôture documentaire : le rapport de sortie le dit ; la mesure enregistrée reprend en J2 |
| **J1** 4.8.5 test 1 | chantiers D1 à D7 ci-dessous | § 1 (définition de « fini ») pour chaque chantier ; banc : 633 cuts inchangés, 8 jeux : seuls 707, 711, 718 changent |
| **J2** terrain 4.8.5 — **fait** (D-063 : lots 25 et 33 sous le test 1 ; C4 de la partie 25 validé sur l'expertise de la direction, moins de 100 jugés) | un lot sur une partie neuve, puis sa relecture | C1 ≥ 79 % ; C3 = 0 ; C4 : **au moins 100 posés jugés** et ≥ 80 % des posés, pris dans l'ordre du lot sans choix, ≤ 2 faux / 100 jugés, chacun typé, les posés non jugés listés, borne haute de Clopper–Pearson publiée (information) ; 0 interruption non reprenable ; **chaque refus de la garde examiné** à la relecture : aucun refus d'une pose qui aurait été juste, sauf décision nommée |
| **J3** 4.8.5 stable — **fait** (D-064 : `v4.8.5` sur `323356c`, publiée le 29/09) | audit Astra du diff, étiquette | portes J2 + aucun P1 d'Astra |
| **J4** 4.9.0 | vitesse, exports, qualité (4.9 a et c) | § 3 |
| **J5** 4.9.5 | cuts difficiles (4.9 b) | § 3 |

## 1. Définition de « fini » pour tout chantier de développement

1. Travail sur `claude/banane-48-cahier`, un commit (ou plus) par chantier, préfixé par son identifiant (`[D2]`…).
2. Un **essai rouge** avant le correctif : il échoue sans le changement, passe avec.
3. `node tools/verify.cjs` à 0 ; aucun fichier d'essais au-delà de 7 s seul.
4. Banc : rejeu des 633 cuts de validation (parties 9, 11, 12) et des 8 jeux du banc 4.8.5 ; toute décision changée est listée et attendue.
5. Revue de code (skill `code-review`, niveau haut) sur le diff du chantier ; constats corrigés ou écrits.
6. Documents : `CHANGELOG.md`, `KNOWN_ISSUES.md`, `DECISIONS.md` si une règle change.
7. Pas de paquet tant qu'un chantier du paquet n'est pas fini.

## 2. 4.8.5 — chantiers de développement

| # | Chantier | Fichiers | Effort | Dépend de |
|---|---|---|---|---|
| KI-066 | Numéros de segment Écho | `panel.js`, `background.js`, `src/native-session.js` | **fait** (`bea32f0`, essais `budget-liberation`, `echo-vidage-audit-480`) ; part dans le paquet (D7) | — |
| D1 | Numérotation et cohabitation | `manifest.json`, `src/core.js`, `panel.html`, `panel.js`, `background.js`, `tools/package.py` | S | — |
| D2 | Garde d'écartement bas à 1 420 mm | `src/lot-decision.js`, `tools/acceptance-report.cjs` | S–M | — |
| D3 | Fin de partie après un différé (KI-067) | `background.js` | M | D4 (preuve de fin de partie) |
| D4 | Instrumentation passive | `src/adapter-page.js`, `background.js` | M | D1 (même fichier) |
| D5 | Outils de portes | `tools/perf-lot.cjs`, nouvel outil de portes | S–M | — (en premier : les portes avant le code) |
| D6 | Documents et état | rapport de sortie, `KNOWN_ISSUES.md`, `LIRE_EN_PREMIER.md` | S | J0 pour les chiffres |
| D7 | Revue, paquet, essai Chromium | — | S | D1 à D6 |

**D1 — Numérotation et cohabitation.**
- Manifeste `4.8.5.1`, nom « Ariane 4.8.5 TEST », `version_name` « 4.8.5 test 1 » ; la version affichée dans le panneau, les exports et le zip en découle (`ariane-4.8.5-test.1.zip`).
- Avant d'injecter quoi que ce soit, Ariane regarde si la page ESV porte déjà l'adaptateur d'une autre version. Si oui, elle refuse : « Une autre Ariane (4.8.0) est active dans cet onglet : désactive-la dans edge://extensions, puis F5 sur ESV ».
- **Vérifier avant d'injecter** : aujourd'hui `equiperOnglet` injecte les fichiers, puis vérifie la version (Astra, VÉRIFIÉ).
- **Adaptateur à propriétaire unique** : l'adaptateur de la version de test n'obéit qu'à l'extension qui l'a installé, et garde ses propres modules dès l'installation. Aujourd'hui, il accepte les commandes de n'importe quel canal. Sans cela, une 4.8.0 activée après la version de test réinjecterait ses fichiers par-dessus : le seul refus côté test ne suffit pas (Astra).
- Essais (rouges sans correctif) : 4.8.0 connectée puis TEST → refus, rien d'injecté ; TEST connectée puis réinjection 4.8.0 et commande d'un canal étranger → aucune action ESV, mise en sécurité dite ; même version → connexion ; nom et version du paquet.
- Limite : la 4.8.0 ne peut plus changer ; « une seule Ariane active » reste la règle (D-060).

**D2 — Garde d'écartement bas (D-060).**
- Dans la décision sur le lot : un premier passage **sans appui** dont la paire est sous 1 420 mm est différé (motif « écartement bas au premier passage »). Garde seulement, jamais une cible. Le motif « écartement bas » est affiché dans le panneau, pour que l'opérateur trouve ces cuts à la relecture.
- La règle est consignée dans la décision (nouvelle version de la décision) pour que le rejeu la relise ; les lots anciens se rejouent avec leurs règles.
- Essais : 1 405 et 1 414,5 mm refusés ; 1 426 mm accepté ; avec un appui, non concerné ; parité des lots anciens.
- Porte : 633 cuts de validation inchangés ; 8 jeux : 707 et 711 refusés, 718 posé en ricochet, 0 juste perdu.

**D3 — Fin de partie après un différé (KI-067).**
- Dans un lot « jusqu'à la fin de la partie », si ESV quitte la page juste après le « suivant sans décision » d'un cut sans pose : **pause**, avec un message clair : « ESV a quitté la page après le différé du cut N ; fin de partie probable : F5, puis Reprendre ».
- **Preuve de fin** : à la reprise, ESV affiche une autre partie **et** le dernier geste du lot était la navigation depuis N. Alors le lot se clôt, « Fin du lot : ESV a quitté la partie après le cut N », et N est retenu comme fin de la partie. Une autre partie ouverte à la main, sans cette navigation, protège le lot sans rien affirmer sur la fin.
- **Le compteur « N on M » n'est pas une preuve** : il compte les cuts traités, pas le rang du cut, et sa signification n'est pas établie (Astra, VÉRIFIÉ : `cutLabel` lit un identifiant). Aucune commande n'est renvoyée.
- **Onglet sorti d'ESV** pendant une lecture : erreur reprenable, comme une page absente. Aujourd'hui, `callSur` renvoie une erreur distincte (Astra, VÉRIFIÉ).
- Dans un lot borné, ou sur un cut posé : comportement actuel, car l'incertitude y est réelle.
- Essais : dernier différé, reprise sur une autre partie → lot clos et fin retenue ; sans reprise → pause et message, aucune commande renvoyée ; autre partie ouverte à la main au milieu d'un cut → arrêt de protection, aucune fin retenue ; onglet hors ESV → erreur reprenable ; F5 pendant un lot → pause reprenable (non-régression).
- Réserve : le moteur (épinglé) gère le différé ; la correction se fait dans son enveloppe (`background.js`), avec une revue dédiée.

**D4 — Instrumentation passive (D-061).**
- À chaque capture, sans commande ni écriture dans ESV :
  - le texte « N on M treated » s'il est lisible (M = nombre de cuts de la partie) ;
  - le nombre de cuts voisins dont la page garde les rails, dans la structure que l'adaptateur lit déjà pour le cut courant (des nombres, pas les poses).
- Rangés dans le journal ; format inconnu → champ absent, jamais d'erreur.
- Chaque relevé porte l'identité du cut et l'heure : jamais de réemploi d'une valeur précédente ; format inconnu → champ absent. Essai : format reconnu → absent → inconnu → changement de cut.
- Usage : (a) **qualifier** la signification du compteur sur le premier lot (information, pas une preuve de fin) ; (b) **premier signal seulement** pour les voisins validés en ligne (D-054) : B1 exigera en plus l'identité des cuts, leur statut validé, des coordonnées lisibles et leur fraîcheur (Astra, constat 6).

**D5 — Outils de portes (en parallèle).**
- `tools/perf-lot.cjs` : décomposition du cycle par phase (script du 28/09 intégré).
- Un outil qui rejoue les 633 cuts et les 8 jeux à partir de la recette banane-data et imprime chaque porte de J1 en vert ou en rouge.

**D6 — Documents et état.**
- Rapport de sortie 4.8 complété avec les parties 11 et 15 (chiffres de J0).
- `KNOWN_ISSUES.md` trié (entrées V4.4 à 4.6 closes ou marquées obsolètes).
- `LIRE_EN_PREMIER.md` redevient le seul état.
- Pour le paquet : CHANGELOG 4.8.5 et une note de 10 lignes pour toi (ce qui change, ce qu'il faut regarder).

**D7 — Revue, paquet, essai Chromium.**
- Revue de code sur tout le diff 4.8.5, puis `verify` et banc.
- Paquet reproductible (deux constructions identiques).
- Chargement dans Chromium avec la 4.8.0 à côté : refus attendu quand les deux sont actives.
- Livraison dans banane-data `travail/…_ariane-485-test1/`.

D8 (« Relire ce lot dans Écho ») : non retenu par la direction (28/09).

**Ordre** (revu après Astra) : **D5 d'abord** (les portes existent avant le code) et D6 (clôture J0) ; puis D1 → D2 → D4 → D3 en série (`background.js` commun) ; enfin D7, paquet test 1, puis toi (J2). Astra relit le diff pendant J2. Un test 2 seulement en cas de panne au terrain.

**Hors 4.8.5** : garde de voie à 20 mm (sauf si, rejouée après D2, elle ne perd plus aucun juste) ; choix à un appui (7738, 7026) et biais vertical des passages à niveau : banc de fond pendant J2, sans code.

**Après le lot J2** (avec son résultat ; pas de test 3 avant) :
- **(a) Message de fin de partie contradictoire** quand M est connu et que le
  cut n'est pas M−1 : « M cuts relevés : le dernier serait le M−1 », puis « le
  cut N pourrait être le dernier de la partie ; saisis-le comme dernier cut ».
  **Corrigé avant l'étiquette** (relecture indépendante de D-062, 29/09) pour
  une partie supérieure affichée : « la partie compte M cuts, son dernier cut
  est le M−1 ; le cut N n'est pas le dernier. Rien n'est retenu », sans
  invitation ; l'invitation reste quand M est inconnu.
- **(b) « Lot terminé, sauf les différés »** : quand le compteur D4 donne total
  − traités = nombre de cuts différés du lot, clore proprement (« Fin du lot : il
  ne reste que N cuts différés ») au lieu d'une pause « Adaptateur ESV sans
  réponse ». Constaté sur le lot 25 (29/09, test 1 : total − traités = 12 =
  différés), `audit/lot-485-p25-2026-09-29.md` de la branche
  `claude/banane-48-cahier`.

**D9 — registre de rotation des parties** : `audit/rotation-parties.md` (fait le
29/09), à tenir à jour à chaque lot ; le lot J2 suivant prend une partie neuve
avec au moins ~200 cuts non validés (la partie 25 était validée à 99 %).

## 3. 4.9 — chantiers de développement

Préalable : cahier 4.9 v0.2 (ordonné, portes chiffrées), écrit par
l'orchestrateur après la 4.8.5 stable et l'audit d'orchestration d'Astra ;
signé par la direction. Découpage proposé : **4.9.0** = a + c ; **4.9.5** = b.

| # | Chantier | Objectif et porte | Effort | Dépend de |
|---|---|---|---|---|
| V1 | Mesure par phase dans l'extension | horodatage de chaque phase dans le journal ; tableau de bord `perf-lot` | S | — (premier) |
| V2 | Export sans doublon, compressé | le bilan renvoie au corpus au lieu de recopier le LiDAR ; compression dans le navigateur ; lecture des anciens formats gardée. Porte : taille −40 %, rapports identiques | M | V1 |
| V3 | Capture plus rapide | une expérience par cycle (attente de stabilité, lectures par vue, préchargement du cut suivant), réglée dans une version de test. Porte : capture médiane −30 %, 0 capture perdue, C1 et C4 inchangés | M–L | V1 |
| V4 | Comparaison V4.6 à la demande (P03) | retirer le calcul V4.6 du chemin du lot. Porte : décisions identiques, analyse plus courte (mesurée) | S–M | V1 |
| V5 | Stockage incrémental (P01) | seulement si un long lot montre une dérive de mémoire | L | V1, mesure |
| U1 | Résumé de partie (U04) | lots, cuts distincts, différés restants | M | — |
| U2 | Essais du vrai panneau (C02) | clavier, focus, mouvement réduit, 200 % | M | — |
| U3 | Raccourcis `D`, `Maj+Espace` | — | S | — |
| B1 | Voisins validés en ligne (D-054) | si D4 montre les rails voisins dans la page : les brancher (code prêt), en dernier recours. Porte : partie neuve, C1 en hausse, 0 faux ajouté | M | D4 |
| B2 | Décentrer la vue d'ESV (D-049) | une tâche de 10 min pour savoir déplacer la vue, puis prototype en version de test. Porte : zones décalées des parties 2, 11 et 33 posées, 0 faux ajouté | L | tâche de 10 min |
| B3 | Coordinateur de lot (C01) | seulement si B2 l'exige | L | B2 |
| P2 | Précision humaine (KI-038) | 30 cuts reposés en aveugle, une fois (15 min) | S | — |

**Ordre de la 4.9.0** : **P2 au premier cycle** (avant toute conclusion sur la précision, Astra), V1, puis V2 et V4, puis V3 (un réglage par cycle). U1 à U3 en parallèle, sur des fichiers distincts, **seulement si le budget de l'opérateur le permet**.

**Porte de version 4.9.0** : cycle médian −25 % (V3, V4 et le reste ensemble), C1 et C4 non dégradés. La capture seule ne suffit pas : elle pèse 48 % du cycle, et −30 % sur la capture n'en retire qu'environ 14 %.

**Ordre de la 4.9.5** : B1 dès que les données de D4 le permettent, puis B2
après sa tâche de 10 min, puis B3 si besoin. Stable aux portes.

**Après la 4.9** : régresseur appris (données qualifiées par la rotation) ; 5.0 multi-session.

## 4. Qui fait quoi

| Acteur | 4.8.5 | 4.9 |
|---|---|---|
| Direction | décisions de la fiche de chaque cycle ; étiquettes | signature du cahier 4.9 v0.2 |
| Opérateur | J0 ; un lot et sa relecture (J2) | un lot par cycle ; P2 (15 min) ; tâche décentrage (10 min) |
| Orchestrateur | D1 à D7, mesures, fiches de décision | tous les chantiers ; cahier 4.9 v0.2 |
| Astra | audit de l'orchestration (maintenant) ; diff 4.8.5 avant la stable | recalcul de toute règle née d'un banc ; diff avant chaque stable |

**Sessions parallèles** : l'orchestrateur peut confier D5, V1 ou U1 à U3 à une
session séparée : fichiers distincts, même définition de « fini ». Jamais deux
chantiers sur `background.js` en même temps.


# ═══ DECISIONS.md — D-057 à D-064 ═══

## D-064 - 4.8.5 stable : feu vert, étiquette et publication

**29 septembre 2026, direction** : « feu vert ». La 4.8.5 devient la version
stable : `main` fusionné (`da89e8b`), étiquette `v4.8.5` sur `323356c` (le
code du paquet), publication GitHub « Ariane 4.8.5 — stable » avec
`ariane-v4.8.5.zip` (SHA-256 `cf4401bf…484d`, empreinte de la publication
vérifiée par l'orchestrateur, identique aux trois constructions). Cible de
retour : 4.8.0 (`v4.8.0`, `fabd77e`). Installation :
`consignes/installation-4.8.5.md`.

## D-063 - Préparer la 4.8.5 stable ; C4 validé sur l'expertise de la direction (partie 25)

**29 septembre 2026, direction** : « go » pour préparer la 4.8.5 stable.

- **Porte C4** : la relecture de la partie 25 (test 1 : 62 posés jugés,
  2 faux, cuts 112 et 113) est jugée suffisante pour la porte C4 de la 4.8.5.
  La qualité est validée **sur l'expertise de la direction**, sans mesure
  conforme à la lettre de la porte (moins de 100 posés jugés) : le rapport de
  sortie le dit (`audit/rapport-sortie-4.8.5.md`), comme D-060 pour la 4.8.0.
- **Lot 33** (test 1) : pas de relecture ; observation de l'opérateur « RAS »
  (non enregistrée).
- **Moteur de décision identique** entre le test 1 et le test 2 (aucun
  changement de `src/lot-decision.js` ni de `src/engine.js` entre `36b8242` et
  `0d29e54`) : la validation de la partie 25 vaut pour le code du test 2. Les
  lots 25 et 33 ont tourné sous le test 1 : le code de fin de partie de
  D-062 (test 2) n'a pas été exercé en réel.
- **Candidat stable** : même code que `0d29e54` (test 2) ; seuls la version
  et le nom changent (`4.8.5`, « Ariane », conventions de D-061). Paquet
  reproductible, portes J1, `verify` à 0, CHANGELOG, retour arrière vers la
  4.8.0, fiche d'installation. **Ni merge, ni étiquette, ni publication** sans
  accord de la direction.
- **KI-068** consigné sans changement de code (export du journal d'Orbite
  alourdi par les données d'Écho) ; correction après la 4.8.5.
- Détail et chiffres : `audit/lot-485-p25-2026-09-29.md` et
  `audit/lots-20-24-33-2026-09-29.md`, branche `claude/banane-48-cahier`.
- **Amendement (29/09, relecture indépendante de D-062)** : D-062 est jugée
  conforme, sauf un message à corriger avant l'étiquette (texte seul) : partie
  supérieure affichée, M connu, cut N ≠ M−1 → « la partie compte M cuts, son
  dernier cut est le M−1 ; le cut N n'est pas le dernier ; rien n'est retenu »,
  sans inviter à saisir N ; l'invitation reste quand M est inconnu. Nouveau
  paquet candidat ; le premier (`8911282`, `ac931b5d…`) n'est ni étiqueté ni
  publié. `SUITE` et la commande `next` restent telles quelles (`next` est
  inatteignable après une pose). Les portes J1 de `8911282` valent pour le
  candidat corrigé : aucun changement de `src/lot-decision.js`,
  `src/engine.js` ni `src/gauge.js` entre les deux.

## D-062 - Fin de partie mémorisée seulement sur preuve M−1 ; mise en sécurité pendant une pose (4.8.5 test 2)

**29 septembre 2026, direction**, après la livraison du paquet test 1 ;
appliquée par la version de test 2 (`4.8.5.2`, « 4.8.5 test 2 ») ; le
paquet test 1 déjà livré n'est pas modifié.

- **(a) Total de la partie** : le total M affiché par ESV est le nombre de
  cuts de la partie ; la numérotation part de 0 ; le dernier cut est M−1
  (confirmé par la direction).
- **(b) Fin de partie après un différé** : la fin de partie n'est mémorisée
  que si, à la reprise, ESV affiche une partie **supérieure** ET le cut du
  dernier différé est **M−1**, M relevé par l'instrumentation passive (D4).
  Sinon le lot se ferme sans rien mémoriser, et le panneau dit que ce cut
  pourrait être le dernier, à saisir comme dernier cut si l'opérateur veut le
  retenir.
- **(c) Mise en sécurité pendant une pose** : la pose en cours va à son
  terme ; la validation suivante est refusée ; le lot passe en pause.
- **(d) Risque restant, accepté par la direction** : « autre Ariane pendant
  une pose : la pose se termine, la validation est refusée, l'opérateur
  contrôle le cut ».

## D-061 - Pilotage de la suite : une version de test à la fois, portes chiffrées, instrumentation passive

**28 septembre 2026, direction** : « je valide toutes tes décisions », sur
l'audit de l'orchestration (`audit/chantiers/audit-orchestration-485.md`).

- **Cadence** : une seule version de test sur le terrain à la fois ; cycle de
  2 à 3 jours (paquet → un lot et sa relecture → mesure et fiche de décision →
  décisions). Pas de nouveau paquet sans retour du précédent, sauf panne
  bloquante.
- **Temps de l'opérateur** : un créneau d'environ 1 h 15 par cycle, dont 20 à
  30 min d'attention ; une seule tâche par cycle (un lot, puis sa relecture) ;
  le reste par l'instrumentation ou une tâche de 10 min au plus.
- **Instrumenter au lieu d'inspecter** : les versions de test relèvent
  passivement des textes et états d'ESV (compteur « N on M treated », présence
  des rails d'autres cuts dans la page), sans aucune commande ni modification
  d'ESV, et les rangent dans le journal. Aucun code d'ESV dans les dépôts.
- **Portes de la 4.8.5 stable** : C1 ≥ 79 % ; C3 : 0 hors contrat ; C4
  évaluable (≥ 80 % des posés jugés), au plus 2 faux pour 100 jugés, chacun
  typé ; 0 interruption non reprenable ; refus de la garde à 1 420 mm comptés
  (0 à 2 attendus).
- **Amendement après le contre-regard d'Astra (28/09, soir)** : le plafond
  « 0 à 2 refus de la garde » n'est plus une porte : chaque refus est examiné
  à la relecture (aucun refus d'une pose qui aurait été juste, sauf décision
  nommée). **Décidé par la direction** : C4 exige au moins 100 posés jugés, pris
  dans l'ordre du lot sans choix, les posés non jugés listés ; **D8 (« Relire ce
  lot dans Écho ») non retenu**. Chaque mesure publie aussi la borne haute de
  Clopper–Pearson à 95 % (information, pas une porte) : 2 faux sur 100 jugés
  donnent 7,0 %, et la 4.8 elle-même (4 faux sur 161) 6,2 %. Démontrer un taux
  sous 2 % demanderait 183 jugés sans faux, 277 avec un, 359 avec deux : c'est
  un objectif cumulé sur plusieurs parties, pas une porte de version (Astra,
  deuxième passe, calcul refait par l'orchestrateur).
  (`audit/chantiers/audit-orchestration-485-astra.md`).
- **Ordre des portes** : code gelé → banc et essais → essai terrain d'une
  version de test → audit indépendant (Astra) avant toute version **stable**
  → décision de la direction en dernier.
- **Numérotation** : version stable = étiquette `vX.Y.Z`, jamais
  reconstruite ; version de test = manifeste `4.8.5.N`, nom « Ariane 4.8.5
  TEST », `version_name` « 4.8.5 test N » ; un nouveau paquet prend N+1.
- **Étiquettes** : créées par la direction sur GitHub (la session ne peut pas
  en pousser) ; l'orchestrateur prépare une branche `release/vX.Y.Z` sur le
  commit à étiqueter.
- Plan de développement et fiche de l'opérateur : `PLAN_SUITE.md`,
  `consignes/operateur-suite.md`.

## D-060 - 4.8.0 fusionnée et stable ; 4.8.5 : garde d'écartement à 1 420 mm, KI-066 et KI-067

**28 septembre 2026, direction**, sur l'audit d'orchestration
(`audit/orchestration-480-485-490-2026-09-28.md`) : « je valide tout ».

- **Fusion** (« go fusion ») : `main` avancé à la branche (avance rapide,
  `64f2d6e`) ; banane-data : `main` avancé de même (`ddc3282`). Étiquettes
  `v4.8.0` sur `fabd77e` (le code du paquet `38aa29a2…`), `v4.7.21` sur
  `ead1cd1` (cible de retour arrière) et `v4.7.0` sur `5928be4` : refusées à
  la session (HTTP 403, la session ne pousse que des branches) ; **créées par
  la direction le 28/09** avec leurs publications GitHub (zip joint à
  `v4.8.0`), vérifiées par l'orchestrateur (`git ls-remote --tags`).
- **La 4.8.0 reste la version stable** de l'opérateur, installée dans ESV.
  Les versions de test (4.8.5…) s'installent à côté, chacune depuis son
  propre dossier, **une seule Ariane active à la fois** (interrupteur de la
  page des extensions, puis F5 sur ESV) : l'adaptateur est injecté dans la
  page ESV, commune à toutes les extensions. Une version de test porte un nom
  distinct et refuse de se connecter si une autre Ariane est active dans
  l'onglet.
- **Qualité finale de la 4.8.0** : relectures de la partie 15 et des 37 cuts
  restants de la partie 11 faites par l'opérateur le 28/09, mais sans
  l'observation Écho active : **validée à 100 % par l'expertise de la
  direction, non enregistrée**. C4 de la partie 15 reste donc non mesuré ; la
  partie 15 n'entre pas au banc comme partie jugée (pas de référence
  enregistrée). La mesure enregistrée reprend avec la partie neuve de la 4.8.5.
- **4.8.5** : KI-066 et KI-067 y entrent (le paquet 4.8.0 validé reste
  intact) ; **garde d'écartement bas à 1 420 mm** sur les premiers passages
  sans appui (garde seulement, jamais une cible ; banc : faux 10 → 9, 0 juste
  perdu, `audit/relecture-p11-2026-09-28.md` §5). Partie de validation de la
  4.8.5 : une partie jamais passée par Ariane, choisie par l'opérateur.
  *Mise en œuvre (D2, 29/09, orchestrateur)* : `lot-decision-v7` ;
  « sans appui » = aucun appui de prédiction (voie encadrée comprise) ; un
  refus n'est jamais reposé par Ariane (ni reprise, ni ornière). Limite
  connue : sur une voie réellement étroite (1 405 à 1 419 mm), sans appui,
  tous les premiers passages seraient refusés ; chaque refus est examiné à la
  relecture (porte J2).
- **Audit de l'orchestration de la suite** confié à Astra
  (`consignes/chantier-9-auditeur.md`).

## D-059 - Audit qualité 4.8 (Astra) : P1 et P2 locaux corrigés dans la 4.8.0, avant sa sortie

**28 septembre 2026.** Audit indépendant de la 4.8.0 demandé par la direction
(code, performances, données, UX/UI ; `consignes/chantier-8-auditeur.md`).
Rapport : `audit/chantiers/audit-qualite-480.md`. Un P1 : Écho purgeait ses
nuages sans preuve de téléchargement (KI-064).

- **Le P1 est corrigé avant la sortie**, par le téléchargement confirmé
  (`chrome.downloads`) plutôt que par la seule neutralisation de la purge :
  la purge garde son rôle (session qui repart de zéro) sans risque de perte.
- **Les P2 locaux sont corrigés dans la même version** (D02, D03, U01, U02,
  U03, P01 pour la vue du panneau, P02, texte de D04) : chacun est petit, et
  deux touchent ce que l'opérateur envoie pour l'analyse.
- **La version reste 4.8.0** (direction : « ça restera une 4.8.0 pas
  .1 ») : les corrections entrent dans la 4.8.0 avant sa sortie. Le paquet
  du matin du 28/09 (`d3874290…`, construit depuis `a68201a`) est **remplacé**
  et ne doit plus être installé ; le nouveau paquet 4.8.0 a sa propre
  empreinte (`PASSATION_4.8.0.md`). Aucune règle métier ni décision sur le
  lot ne change ; la validation D-058 porte sur ce qui est inchangé.
- **Reportés** (réponse : `audit/chantiers/qualite-480/reponse.md`) :
  C02 en 4.8.x ; C01, P01 (stockage), P03, U04 et la provenance de D04 en
  4.9 (`BANANE_4.9_CAHIER.md` §2). La question P03 (comparaison V4.6 à chaque
  cut) et les budgets de latence et de mémoire (questions 3 et 4 de l'audit)
  restent à la direction.
- La fluidité réelle dans ESV et la mémoire sur un long lot ne sont pas
  certifiées : première mesure avec la session de
  `consignes/chantier-8-operateur.md`.

## D-058 - 4.8.0 : Ariane, Écho, Orbite ; C1 atteint ; ESV rafraîchi ; revue d'interface

**27 septembre 2026, direction.** « Comme la 4.8 est un tournant majeur, le
nom de Banane devient ARIANE ; Natif devient Écho ; Pilote devient Orbite » ;
« 79 % c'est comme 80 %, donc objectif atteint, c'est la même moyenne sur les
autres lots » ; « je valide tout le reste » ; « je donne donc le go pour la
4.8 » (photos et vidéo du menu à montrer avant la livraison définitive).

- **Noms** : Ariane (l'extension), Écho (observation du travail manuel, ex-
  Natif), Orbite (lots automatiques, ex-Pilote). Renommés : interface,
  messages, bouton d'ouverture et bandeau dans ESV, manifeste, noms des
  fichiers exportés (`ariane-…`). **Inchangés** : identifiants internes,
  clés de stockage, champs `format` des exports (les outils reconnaissent un
  export par son contenu), noms des dépôts. Le moteur épinglé garde ses
  textes ; le service worker les traduit vers le panneau.
- **C1** : objectif intermédiaire retenu comme atteint à 79 % (parties 9 et
  12 : 79,3 % et 79,2 %). Rapport de sortie : `c1Seuil` 79.
- **ESV lent** (nuages absents, vue qui ne se recentre pas) : le remède est de
  rafraîchir ESV. Après F5, ESV repart du premier cut non validé (direction,
  27/09). **Option 1 retenue** : Ariane se met en pause et le dit ; après F5,
  « Reprendre » revient au cut du lot par « cut non validé suivant » sans
  rien valider, rattache le lot à la nouvelle page (appuis translatés dans le
  nouveau repère, écartés si la translation ne se vérifie pas) et reprend.
  Le rafraîchissement automatique (option 2) a été écrit puis retiré : cinq
  revues de code y trouvaient chaque fois une nouvelle interaction (lectures
  du panneau, pause, arrêt, rechargement en cours) ; la direction avait
  prévu ce repli (« vraiment juste si tu ne trouves aucune solution »).
- **Fin de partie lue dans ESV** : le panneau d'ESV affiche « N on M
  treated » (photo du 27/09 : 6593 on 6732, partie 14). Le lire donnerait la
  fin de partie dès le premier lot : **4.8.5**. Le correctif KI-063 suffit
  pour la 4.8 (direction).
- **Revue d'interface** (skills `artifact-design`, `code-review`) : libellés,
  cohérence, export complet en un clic ; deux défauts de la revue de code
  corrigés avant livraison.
- **Validation (28/09)** : « si tu as suffisamment tout rejoué et tout reçu et
  trouvé aucun potentiel bug je valide la 4.8 ». Rejoué avec le code final :
  tous les lots reçus (parties 9, 11, 12 ; 633 cuts), décisions identiques
  ligne à ligne. Sept revues de code sur la reprise ; la dernière trouvait
  encore la page rechargée **pendant** une commande (erreur Chrome classée
  ERROR, non reprenable) et « Arrêter » grisé pendant une reprise : corrigés,
  chacun avec son essai rouge sans le correctif. Reste simulé seulement :
  le rechargement d'ESV et les textes d'erreur de Chrome (à confirmer au
  premier lot terrain).

## D-057 - Sortie 4.8 : faux isolés tolérés, lot arrêté compté, P2 en 4.9, rotation réglage / validation

**26 septembre 2026, direction**, après la relecture de la partie 12
(`audit/relecture-p12-2026-09-26.md`).

- **Seuil C4 de sortie : faux isolés expliqués tolérés.** « Ne pas exiger zéro
  rail faux sur la 4.8, on a déjà considérablement réduit l'écart avec les
  précédentes versions. » Zéro faux reste la cible, pas une condition de
  sortie. Chaque faux des lots de validation est nommé avec son type dans le
  rapport de sortie ; D-042 s'applique toujours (un type qui se répète appelle
  un correctif). Mesure : 4 faux sur 161 cuts jugés (parties 9 et 12).
- **Un lot arrêté en cours de route compte** (C1 et C4 sur ce qu'il a traité),
  s'il est relu. Un reliquat qui repasse sur les différés d'un lot de la même
  partie est compté par partie, pas en plus (`c1:false`).
- **P2 (précision humaine) reporté en 4.9.** « Banane pose exactement comme un
  autre opérateur l'aurait fait. » C2 est publié comme écart à la relecture de
  l'opérateur, sans plancher humain, et dit comme tel.
- **Rotation réglage / validation adoptée** (« je valide à 100 % »). Chaque
  partie neuve est d'abord une partie de validation : sa mesure est consignée
  avant tout réglage ; ensuite seulement elle entre au banc de réglage, et la
  partie neuve suivante devient la validation. Parties 9 et 12 : mesures
  consignées, elles passent au réglage pour la 4.8.5.
- **Reportés en 4.8.5** : voisins validés comme appuis, en dernier recours
  (D-054, relecture de la partie 9) ; les pistes des faux 7738 (choix à un
  appui, 2e du type après 7026) et 7743 (premier passage à 27,7 mm de la
  voie) ; le biais vertical aux passages à niveau (« je ne le trouve pas mais
  on analysera » : au banc, aucun calage).
- **Feuille de route** : 4.9 (vitesse, UI/UX, code, cerveau, vue réduite, P2
  refait) ; après la 4.9, le « méga cerveau » (précision apprise) ; 5.0
  multi-session ; suivi mobile en lecture seule, éventuellement en 5.5.
- **Interface** : bouton d'ouverture dans ESV redessiné en blanc, discret
  (contrôle Edge du 26/09 : rien d'autre à redire).


# ═══ KNOWN_ISSUES.md — lignes KI-061, KI-063, KI-066 à KI-069 ═══

| N° | Gravité | État | Description |
|---|---|---|---|
| KI-069 | Moyenne | Ouvert (retour terrain du 30/09, 4.8.5 stable) ; à traiter dans le cahier 4.9 | **Au dernier cut à valider d'une partie, Orbite valide ET fait quitter la partie.** Terrain, partie 36 : ESV affiche « Cut 8785 of part 36 » et « 8760 on 8786 treated » (validés 8760 + invalides 26 = 8786 : M est bien le nombre de cuts, le dernier cut est M−1 = 8785). L'adaptateur valide par la commande d'ESV « valider et passer au suivant » (`buttonValidateRailAndNext`, `decisionAndNext`) ; il n'y a plus de cut non validé après le 8785 dans la partie, donc ESV charge la partie suivante. Idem pour un différé (commande « suivant »). Le lot se ferme (KI-061, KI-067, D-062) : aucun cut de la partie suivante n'est traité, mais l'opérateur se retrouve dans la partie suivante. **Piste de l'opérateur** : sur le dernier cut, valider sans avancer (raccourci Ctrl+Entrée d'ESV, à confirmer sur le terrain ; l'adaptateur connaît aussi `buttonValidateRail()`), et ne pas envoyer « suivant » après un différé. Le dernier cut de la partie est certain quand le cut vaut M−1 (M lu par le relevé passif, D-062) ; quand le dernier cut non validé est plus tôt (partie 25 : 8338 pour M = 8530), il n'est pas détectable avant que la partie ne change. Chantier petit à moyen, en 4.9, à valider avec ESV. |
| KI-068 | Moyenne | Ouvert, accepté pour la 4.8.5 (D-063) ; contournement `tools/filtrer-journal.cjs` (branche `claude/banane-48-cahier`) ; correction prévue après la 4.8.5 | **L'export du journal d'Orbite embarque les visites et événements d'Écho de toute la session.** Le journal exporté après des relectures Écho porte aussi leurs visites et leurs événements : **1,03 Go pour le lot 33** (786 Mo de visites, 245 Mo d'événements ; 56 070 des 60 798 événements viennent d'Écho) contre 3,5 Mo pour le lot 25, exporté avant les relectures. Aucune erreur du lot : c'est l'export qui ne filtre pas. Contournement : `node tools/filtrer-journal.cjs` (1,03 Go → 7,8 Mo sur le lot 33). Correction prévue après la 4.8.5 : export d'Orbite limité aux événements et visites du lot. `audit/lots-20-24-33-2026-09-29.md` (branche `claude/banane-48-cahier`). |
| KI-067 | Basse | Corrigé en 4.8.5 (D3 au test 1 ; D-062 au test 2 : fin mémorisée seulement si ESV affiche une partie supérieure et que le cut vaut M−1). **Non exercé en réel** : les lots 25 et 33 ont tourné sous le test 1 et ne sont pas passés par ce chemin (D-063) | **Fin de partie après un différé : pause « navigation incertaine » au lieu de « Fin du lot ».** Lot Orbite 4.8.0 de la partie 15 (106 → fin de partie) : les derniers cuts (9054–9056) n'ont aucun point LiDAR et sont différés ; le « suivant sans décision » envoyé depuis 9056 fait quitter la page à ESV (Chrome : page mise en cache arrière). Le moteur (épinglé) le lit comme une navigation sans progression (`DEFER_NO_PROGRESS`) : pause « Navigation sans décision transmise sur le cut 9056… », l'opérateur arrête. Rien n'est posé ni perdu ; la fin de partie n'est pas retenue. La sortie après une VALIDATION est déjà close proprement (KI-061, `lotExitOf`). Correctif proposé (`background.js`) : dans un lot « jusqu'à la fin de la partie », une page ESV quittée juste après le différé clôt le lot par « Fin du lot : ESV a quitté la partie après le cut N », sans renvoi de commande. `audit/lot-4800-p15-2026-09-28.md`. |
| KI-066 | Basse | Corrigé dans le code (`bea32f0`) ; livré avec la 4.8.5 test 1 | **Numéros de segment Écho répétés.** Le compteur des vidages automatiques comptait les vidages, pas les fichiers : après un vidage de 9 fichiers, le suivant repartait trop bas (deux « auto-seg04 » le 28/09, partie 11). Rien de perdu : la fusion lit le contenu (1 730 nuages, 0 manquant). Correctif : l'acquittement dit le nombre de fichiers écrits (`ackExported(…, {fichiers})`). `tests/budget-liberation.test.cjs`, `tests/echo-vidage-audit-480.test.cjs`. |
| KI-063 | Haute | Corrigé en 4.8.0 ; à confirmer sur le terrain | **Pilote 4.7.21 : arrêts en pleine session, et passage à la partie suivante.** Terrain du 26/09, parties 13 et 14 (bilans « INTERRUPTION A VOIR » et « LOT 14 INTERRUPTION ») : cinq lots, trois causes (`audit/interruptions-4721-2026-09-26.md`). (1) **ESV lent au recentrage** (3 lots) : « Vue ESV non recentrée » après 12 s sur des cuts où ESV mettait 17 à 19 s à lire le nuage ; 4.8.0 : clic de sélection répété (3 fois, sans effet sur la scène), pause reprenable en lecture, délai de pose du bridge porté à 90 s. (2) **Silence pris pour une fin de partie** (partie 13, 6629 → 6758 annoncé, ESV muet 30 s, puis partie 14) : la 4.7.21 closait le lot après environ 18 s et retenait 6629 comme fin de la partie ; 4.8.0 : relectures pendant environ 70 s avec un message au panneau, lot clos seulement si ESV montre une autre partie, fin retenue seulement sur une sortie de partie observée (le plus loin des cuts vus). (3) **Annulation tardive** (partie 14, cut 410, « Export interrompu. ») : un « Arrêter » resté sans réponse revenait 45 s plus tard en annulation globale et coupait le lot suivant ; 4.8.0 : pas d'annulation d'une annulation, annulation de délai ciblée (`requestId`), annulation périmée ignorée par la page (`sentAt`). « Continue vers la partie suivante » : inévitable sans fin connue (KI-061), la fin constatée évite la répétition. Partie 11 (4.7.20) : pauses et arrêt de l'opérateur, pas de Banane. Essais : `tests/ki063-arrets-4800.test.cjs`. **4.8.0 (D-058, option 1)** : ESV lent se règle par F5 ; Ariane se met en pause et le demande ; « Reprendre » revient alors du premier différé au cut du lot sans rien valider et rattache le lot à la nouvelle page (`tests/esv-lent-pause-4800.test.cjs`, `tests/esv-rafraichi-*-4800.test.cjs`, `tests/revue-*-4800.test.cjs`). Rafraîchissement automatique écrit puis retiré (cinq revues de code). F5 ou onglet fermé **pendant** une commande (lecture, pose) : l'erreur de connexion de Chrome devient « adaptateur sans réponse » (reprenable), jamais ERROR ; « Arrêter » reste cliquable pendant une action (`tests/revue-7a-4800.test.cjs`, `tests/revue-7b-4800.test.cjs`, septième revue). |
| KI-061 | Haute | Atténué en 4.7.20 ; cause côté ESV à observer sur le terrain | **Fin de partie : le Pilote passait dans la partie suivante.** Terrain du 25/09, partie 6 (4.7.19), reliquat 526–8131 : après la validation de 7634, ESV affiche 8131 (dernier cut du lot) puis l'adaptateur ne répond plus, même 8 minutes plus tard ; l'opérateur voit ESV passer à la partie suivante. Même scène en partie 3 (4.7.18, 8209, attribuée alors à KI-059). Cause : dans un reliquat, le dernier cut non validé n'est pas `scope.end` ; sa validation (« valider et charger le cut non validé suivant ») fait changer ESV de partie, et l'arrêt au dernier cut de la 4.7.19 ne joue pas ; `src/engine.js` (épinglé) ne contrôle la cible qu'après un différé. 4.7.20 (`background.js`) : cible d'une validation hors du lot (autre partie, au-delà de la borne) → lot clos, rien de traité hors du lot ; lecture d'état muette → deux nouvelles lectures à 3 s ; toujours muette juste après une navigation vers la fin du lot → lot clos avec un message clair au lieu d'une panne. Le Pilote ne peut pas savoir d'avance qu'un cut est le dernier non validé : le passage d'ESV à la partie suivante n'est pas empêché, il est constaté. Essais : `tests/lot-fin-4720.test.cjs`, `tests/lot-reprise-4720.test.cjs`. |


# ═══ audit/lots-20-24-33-2026-09-29.md ═══

# Lots 20 à 24 (4.8.0) et 33 (4.8.5.1) — 29/09/2026

Sources : exports allégés par la page `tools/navigateur/reducteur-exports.html` (lots et relectures des parties 20 à 25,
`LOT_20_A_25.7z`) et, pour la partie 33, le journal filtré par `tools/filtrer-journal.cjs` (1,03 Go → 7,8 Mo) et le
diagnostic. Données archivées : `banane-data/collections/2026-09-29_lots-20-25-33-reduits/`. Rapports :
`tools/analyse-locale.cjs` (mode léger, identique au mode complet : `tests/analyse-locale.test.cjs`).

## Résultats par lot

| Lot | Version | Cuts | Posés | C1 | Refus d'écartement | Différés | Jugés | Faux (> 10 mm) | Cycle médian |
|---|---|---|---|---|---|---|---|---|---|
| p20 | 4.8.0 | 84 | 65 | 77,4 % | 9 | 7 | non évaluable (repère) | — | 6,0 s |
| p21 | 4.8.0 | 213 | 181 | 85,0 % | 10 | 22 | 177 | **1** (cut 4835, 10,55 mm vertical) | 9,7 s |
| p22 | 4.8.0 | 47 | 38 | 80,9 % | 0 | 9 | 36 | 0 | 12,0 s |
| p23 (lot 1) | 4.8.0 | 47 | 37 | 78,7 % | 0 | 10 | 34 | 0 | 14,5 s |
| p23 (reprise) | 4.8.0 | 6 | 4 | 66,7 % | 0 | 2 | 3 | 0 | 12,8 s |
| p24 | 4.8.0 | 130 | 107 | 82,3 % | 1 | 19 | 103 | 0 | 13,9 s |
| p25 | 4.8.5.1 | 81 | 69 | 85,2 % | 5 | 7 | 62 | **2** (112, 113) | 6,7 s |
| p33 | 4.8.5.1 | 100 | 84 | 84,0 % | 4 | 12 | pas de relecture | — | 8,7 s |

C3 (posés hors contrat) : 0 sur les huit lots.

**4.8.0, parties 21 à 24** : 353 posés jugés, 1 faux (0,28 % ; borne haute de Clopper–Pearson 95 % ≈ 1,6 %), C1 groupé
(20 à 24) 432 / 527 = 82,0 %. **4.8.5.1, parties 25 et 33** : C1 groupé 153 / 181 = 84,5 %. Le lot 25 (2 faux sur 62) ne se
distingue pas de façon nette des lots 4.8.0 (test exact de Fisher, p = 0,06) ; les deux versions partagent le même
moteur de décision, la garde 1 420 mm n'ayant jamais joué. **La piste de dérive en chaîne** (cuts 108 à 114 du lot 25)
n'est pas retrouvée dans les lots 21 à 24 (un seul faux, isolé) : elle reste une observation locale, sans chantier.

**Partie 20** : relecture inutilisable, repère incompatible (frameId différent, translation unique vérifiée sur 0 des 84 cuts
comparés). Cause non identifiée ; relecture à refaire seulement si la mesure de la 4.8.0 l'exige.

## Lot 33 (journal 4.8.5.1 : c'est le test 1, pas le test 2)

- 100 cuts de 14:43 à 14:59 (16 min, 375 cuts/h), 84 posés, 4 refus d'écartement hors contrat (prédits 1 553, 1 507,
  1 564 et 1 312 mm), 12 différés. Écartements posés : 1 429,5 à 1 451,2 mm. Garde 1 420 mm : jamais déclenchée.
- La partie 33 compte 7 005 cuts d'après le compteur d'ESV (« N on M treated », M = 7 005). Après le différé du cut 5882,
  ESV a navigué vers le cut **7004 = M − 1**, le dernier de la partie, et l'adaptateur a été perdu pendant sa capture (message
  « page en cache de navigation avant/arrière »). Le lot s'est arrêté là (STOPPED, sans erreur), sans traiter le cut 7004.
  Impossible de dire si ESV ou l'opérateur a quitté la page ; cohérent avec la règle « dernier cut = M − 1 ».
- Le texte « M cuts » n'est pas relevé par le test 1 : la question reste ouverte (test 2 requis).

## KI-068 — l'export du journal d'Orbite embarque les données d'Écho

Le journal exporté après plusieurs relectures d'Écho porte aussi leurs événements et leurs visites : 1,03 Go pour le lot 33
(786 Mo de visites, 245 Mo d'événements, dont 60 798 événements dont 56 070 d'Écho) contre 3,5 Mo pour le lot 25 exporté avant
les relectures. Aucune erreur de code du lot : c'est l'export qui ne filtre pas. Contournement : `tools/filtrer-journal.cjs`.
À corriger dans la version suivante (export d'Orbite limité aux événements et visites du lot) ; à ajouter à `KNOWN_ISSUES.md`.


# ═══ consignes/analyse-locale.md ═══

# Analyse locale des exports (quand ils pèsent des Go)

Deux voies, selon ce que l'ordinateur de l'opérateur permet :

- **Sans rien installer ni exécuter (poste de travail restreint)** : la page
  `tools/navigateur/reducteur-exports.html` (assemblée par
  `python3 tools/navigateur/construire-reducteur.py`), à ouvrir dans Edge. L'opérateur y dépose
  un dossier à la fois ; elle garde le journal et le diagnostic d'un lot (compressés), allège une
  relecture (visites seules), écarte le corpus et le bilan. Un lot de 200 Mo devient 0,6 Mo ; une
  relecture de 72 Mo, 0,4 Mo ; 990 Mo de relecture, environ 1 Mo. Les rapports que j'en tire sont
  identiques à ceux des exports complets (`tests/reducteur-exports.test.cjs`, et comparaison sur des
  exports réels). Rien ne quitte le navigateur.
- **Avec Node.js** : le kit ci-dessous, qui fait tout d'un coup et calcule aussi les extraits.

Un lot Orbite pèse environ 1,2 Mo par cut visité, une relecture Écho autant par
visite. Au-delà de quelques centaines de cuts, l'envoi est impossible (la session
n'a ni le disque ni le canal). L'analyse se fait donc chez l'opérateur, et seuls
les résultats (quelques centaines de Ko) sont envoyés.

- **Kit** : `banane-data/travail/2026-09-29_analyse-locale/ariane-analyse-locale.zip`,
  mode d'emploi pas à pas dans le zip (`LISEZMOI.txt`). Construit par
  `python3 tools/kit-analyse-locale.py`.
- **Outil** : `node tools/analyse-locale.cjs DOSSIER_RACINE` (un sous-dossier par lot,
  un par relecture ; le numéro de la partie est le premier nombre du nom). Sortie :
  `resultats/resultats-ariane-AAAA-MM-JJ.json.gz` (rapports d'acceptation, temps,
  extraits du journal) et `resultats/RESUME.md`.
- **Mode léger** (`acceptance-report.cjs --leger`) : les points bruts sont écartés dès la
  lecture ; les rapports sont identiques au mode complet (essai
  `tests/analyse-locale.test.cjs`, et comparaison sur des exports réels). Le rejeu hors
  ligne (`--rejeu-lot`) l'exclut : il reste réservé aux échantillons complets.
- **Conservation** : l'opérateur garde ses exports bruts. Pour une étude qui exige le
  rejeu, on lui demande un échantillon (quelques dizaines de cuts), pas le lot entier.
- **Lecture des résultats** : `gunzip` puis JSON ; `lots[].acceptation.rapport` est le
  rapport d'acceptation, `lots[].perf.mesures` les temps, `lots[].extraits` la fin de lot,
  les pauses, les erreurs et le relevé passif (`releve.couples` : « total du compteur /
  texte M cuts »).


# ═══ consignes/demarrage-session-49.md ═══

# Démarrage de la session de développement 4.9

À lancer **après** la 4.8.5 stable (fusionnée, étiquette créée par la direction), dans une **session neuve** :
un contexte court coûte bien moins de quota qu'une longue conversation. Plugins : **Superpowers** (obra) et
**Modern Web Guidance** (Google Chrome) ; playwright en option. Modèle : **Sonnet** par défaut ; **Opus**
seulement pour la conception de V3 et la relecture avant étiquette. Copie le bloc tel quel.

## Décision de la direction (30/09/2026) : option B, par le chemin normal

La porte de la 4.9.0 reste **cycle médian −25 %** (donc V3), avec C1 et C4 non dégradés. « Je veux le chemin normal, le
plus naturel, afin d'en faire la meilleure version, je ne suis pas pressé. » Aucun raccourci de périmètre ni de
procédure : la durée suit le quota, pas l'inverse.

**Chemin :** 4.8.5 stable → (Astra de retour) → la session 4.9 écrit d'abord le **cahier 4.9 v0.2** (documents seuls,
pas de code : chantiers ordonnés, portes chiffrées, à partir de `PLAN_SUITE.md` §3 et des mesures des lots 20 à 33) →
audit d'orchestration d'Astra → **signature de la direction** → chantiers, dans l'ordre ci-dessous. Le périmètre du
plan reste entier (U1 à U3, V5, B1 à B3 compris) ; l'ordre et les portes décident ce qui se fait quand, pas le budget.

## Ordre des chantiers, une chose à la fois, un commit par chantier

1. **P2** (30 cuts reposés en aveugle, 15 min de l'opérateur) et **V1** (mesure par phase) : en premier.
2. **V2 + KI-068** (remonté) : export sans doublon et limité au lot ; le lot 33 a pesé 1,03 Go pour 100 cuts.
3. **V4** (comparaison V4.6 à la demande), puis **V3** (capture plus rapide, un seul réglage par cycle, version de test).
4. **U1 à U3** en parallèle sur des fichiers distincts quand le cycle le permet ; **V5** seulement si un long lot
   montre une dérive de mémoire ; puis la 4.9.5 (**B1 à B3**).

## Règles de quota

- Une seule session de développement à la fois ; pas de session de relecture en parallèle.
- L'analyse des exports passe par les scripts (`tools/analyse-locale.cjs`, page `reducteur-exports.html`) : lire
  `RESUME.md` et les tableaux, jamais les fichiers bruts ; l'opérateur envoie les fichiers allégés.
- Réponses courtes ; les décisions de l'opérateur groupées dans un seul message par cycle.
- Astra (relecture d'orchestration, quota séparé) et Grok (relecture de diff) font les revues qui ne demandent pas le dépôt.

```text
Tu reprends Ariane (ex-Banane), extension Edge MV3 qui pose les rails sur ESV LiDAR, pour développer la 4.9.
Tu es l'orchestrateur : code, bancs, paquets, documents. Réponses courtes, en français ; je suis l'opérateur et la
direction, et mon quota est limité : une seule chose à la fois, aucun travail parallèle.

DÉPÔTS : StoryNow30/banane (pars de la tête de main, 4.8.5 stable fusionnée) et StoryNow30/banane-data.
Vérifie d'abord l'état : branche, tête, étiquettes (v4.8.5 stable ; v4.8.0 = fabd77e, retour arrière).

LIS, DANS CET ORDRE, SANS RIEN DE PLUS :
1. PASSATION_4.8.0.md (règles non négociables) ;
2. DECISIONS.md, D-057 à la dernière ;
3. PLAN_SUITE.md §3 (les chantiers 4.9, l'ordre, la porte) et consignes/demarrage-session-49.md (décision B, chemin normal) ;
4. KNOWN_ISSUES.md, KI-066 à KI-068 ;
5. audit/lots-20-24-33-2026-09-29.md (état des mesures) et consignes/analyse-locale.md (comment j'envoie les exports).

PREMIÈRE TÂCHE, SANS CODE : écris le cahier 4.9 v0.2 (docs/ ou la racine, selon les conventions du dépôt) : chantiers
ordonnés, dépendances, portes chiffrées, mesures de départ tirées de audit/lots-20-24-33-2026-09-29.md ; puis arrête-toi :
il passe à l'audit d'Astra et à ma signature avant tout code.
ENSUITE, une fois signé : P2 et V1 ; puis V2 avec KI-068 ; puis V4 ; puis V3, un réglage par cycle, en version de test ;
U1 à U3, V5, B1 à B3 selon l'ordre du cahier. Un commit par chantier, préfixé [Vn]. Skills : test-driven-development, systematic-debugging, verification-before-completion
(Superpowers) ; chrome-extensions (Modern Web Guidance) pour tout ce qui touche à l'injection dans la page ; code-review
sur chaque diff.

PORTE DE LA 4.9.0 : cycle médian −25 %, C1 et C4 non dégradés (mesurés sur mes lots, exports allégés).

RÈGLES : `node tools/verify.cjs` à 0 avant chaque commit (chaîne les commandes avec `&&`) ; src/engine.js épinglé ;
écartement [1405, 1470] mm en admissibilité seulement ; deux rails ou rien ; pas de VALIDATE ni de SKIP automatique
d'un cut non résolu ; cuts 9033 et 9241 exclus ; aucune capture d'écran ni code d'ESV dans les dépôts ; pas de merge,
d'étiquette, de publication ni de force push sans mon accord ; commits avec Co-Authored-By et Claude-Session ; aucun
identifiant de modèle dans les fichiers.

Commence par vérifier que les plugins Superpowers et Modern Web Guidance sont chargés (liste tes plugins) ; puis dis-moi
en 5 lignes l'état que tu trouves et ton premier pas.
```


# ═══ BANANE_4.9_CAHIER.md (brouillon 0.1) ═══

# BANANE 4.9 — CAHIER DES CHARGES (brouillon)

Version du cahier : **0.1 — ouvert le 24 septembre 2026, non signé**
Base prévue : la version 4.8.0 publiée.

Ce brouillon réunit ce que la direction et les amendements du cahier 4.8 ont
renvoyé à la 4.9. Il sera ordonné, chiffré et signé après la sortie de la 4.8.
D'ici là, un chantier ne s'ajoute ici que sur décision datée dans
`DECISIONS.md`.

Frontière fixée à la signature de la 4.8 (cahier 4.8, §1) : **4.9 — Pilot
Fast**, le chantier vitesse ; **5.0** — multi-session, multi-onglets,
multi-parties.

Les invariants de la 4.8 restent la loi : écartement [1405, 1470] mm en
admissibilité seulement, jamais une cible ; jamais un rail appliqué seul ;
jamais de VALIDATE ou de SKIP automatique sur un cut non résolu ; cuts 9033 et
9241 exclus ; aucune pose humaine dans l'entrée d'une décision sans amendement.

---

## 1. Décentrer la caméra d'ESV pour atteindre le champignon (D-049)

### 1.1 Le besoin

**Idée de la direction, 24 septembre 2026.** Quand l'écart est trop grand et
que la correction à effectuer tombe hors de la caméra d'ESV, il faut un outil
qui **décentre la caméra**, pour que le super cerveau aille chercher dans le
nuage de points la portion où placer le champignon, puis que le Pilote y pose
le rail.

Aujourd'hui, le Pilote clique la cible dans la vue orthographique qu'ESV centre
sur sa propre pose de départ (±0,2 unité de scène). Quand cette pose est loin
des rails, la bonne position sort de la vue et le cut est différé (KI-051,
D-043) ; l'opérateur le pose à la main, en dézoomant et en déplaçant la vue au
clic droit.

### 1.2 Cas mesurés

| Partie | Pose de départ d'ESV | Cuts retrouvés par la voie mais hors de la vue |
|---|---|---|
| 33 (4.7.10, KI-051) | 13 à 21 cm des rails | 8090–8095, retrouvés avec les appuis du lot précédent ; 10 cuts différés en tête du lot 2 (8090–8099) |
| 2 (4.7.14, KI-054) | gabarit à 1500 mm, 60 à 200 mm des rails ; saut à partir de 113 | 114 et 117–121 : positions justes au rejeu (1,5 à 8,2 mm), vue dépassée de 4 à 11 % (ndc −1,04 à −1,11) |
| 9 (4.7.18, KI-051) | 18 à 22 cm du rail gauche, 12 à 16 cm du droit (fin de partie) | 8504–8506 trouvés hors de la vue ; vue supposée corrigée, la voie continue : 8507–8526, 19 décidés, 17 justes sur 18 jugés (0,8 à 6,4 mm), le 18e (8516) mal relu ; relecture Natif du 25/09 (`audit/relecture-p9-2026-09-26.md`) |

Dans ces cas, les points étaient dans la capture : seul le clic manquait. Pour
un écart plus grand, les points du vrai rail peuvent aussi sortir de la
capture ; l'outil doit couvrir les deux.

### 1.3 Ce qui est demandé

1. **Déclencheurs**, chacun journalisé :
   - la position retrouvée par la voie est hors de la vue (`hors-vue-left`,
     `hors-vue-right` aujourd'hui) ;
   - la paire du moteur est retirée par une garde (continuité, écartement
     voisin) et aucun minimum qualifié n'existe près de la prédiction dans la
     capture ;
   - la pose de départ d'ESV est à plus d'un seuil de la prédiction de la voie
     (seuil à mesurer).
2. **Décentrage** : déplacer la vue d'ESV (translation, dézoom si nécessaire)
   vers la position prédite par la voie, sans changer de cut ; attendre que la
   caméra soit immobile et que le nuage soit chargé.
3. **Nouvelle capture** sur la vue décentrée, puis décision sur le lot relancée
   sur cette capture (moteur relancé depuis la voie, choix).
4. **Pose** par clic dans la vue décentrée, **les deux rails ou aucun** ; relecture
   de la pose à 1 mm avant toute validation, écartement relu dans le contrat.
5. **Retour** : vue remise dans un état connu avant le cut suivant ; si ESV ne
   recentre pas, le lot s'arrête proprement (erreur de capture actuelle « Vue
   ESV non recentrée »), sans pose touchée.
6. **Repli** : tout échec (caméra qui bouge, nuage non chargé, clic refusé,
   pose relue différente) diffère le cut ; jamais de pose partielle, jamais de
   VALIDATE.
7. **Variante à étudier** : clic en deux temps (le rail est d'abord amené en
   bord de vue, la vue est recadrée, puis le rail est posé), si ESV ne permet
   pas de déplacer la vue par programme.

### 1.4 Préalables

- **Inspection d'ESV par l'opérateur** : comment ESV déplace et zoome la vue,
  quels symboles internes le permettent (KI-026 : dépendance à des symboles
  ESV), comment savoir que le nuage est chargé. Même méthode que la fiche du
  chantier 1 (`consignes/chantier-1-operateur.md`).
- **Garde de capture** : aujourd'hui, une caméra qui bouge pendant la capture
  arrête le lot (« La caméra a changé pendant l'export », partie 2, cut 24). Le
  décentrage doit être terminé et stable avant toute capture.
- **Temps** : chaque décentrage ajoute un chargement du nuage ; mesuré avec
  l'instrumentation par phase du chantier vitesse (§2).

### 1.5 Acceptation

- Sur les lots relus des parties 2 et 33, et sur au moins un lot neuf : les
  cuts aujourd'hui différés « hors de la vue » sont placés, **0 faux ajouté**
  (latéral ou vertical > 10 mm, D-038).
- Aucun cut placé avec un seul rail ; aucun VALIDATE sans pose relue.
- Temps ajouté par cut décentré mesuré et publié.

---

## 2. Autres chantiers déjà renvoyés à la 4.9

| Chantier | Origine |
|---|---|
| **Vitesse du Pilote** (Pilot Fast) : instrumentation par phase (capture, analyse, sélection, clic, validation, navigation, chargement du nuage suivant) avant toute optimisation | Cahier 4.8, §1, décision de signature |
| Raccourcis clavier `D` et `Maj+Espace`, sur mesure | Cahier 4.8, §5.5 |
| Chantier 1 : revenir à un cut, aller au cut précédent | Amendement n°10, point 7 ; inspection d'ESV non faite |
| Le Pilote se déplace seul sur les cuts voisins et lit la pose des cuts déjà validés, comme appuis | Direction, 24/09 ; exige un amendement au test I (poses humaines en entrée) |
| Recadrage de la vue d'ESV | D-043, KI-051 — repris au §1 |
| Faux placés par le moteur sans aucun appui (398, 402 de la partie 20) | Bilan des curseurs (D-047) : aucun curseur ne les touche |
| Régresseur de position appris | Cahier 4.8, §4 ; `PLAN_4.8.md` |
| Coordinateur de lot et transitions nommées autour du moteur épinglé (enveloppes de `background.js`) | Audit qualité 4.8, C01 (`audit/chantiers/audit-qualite-480.md`) |
| État sauvegardé sans historiques volumineux, enregistrements incrémentaux ; export paginé | Audit qualité 4.8, P01 (stockage), §3 |
| Comparaison V4.6 à chaque cut, ou à la demande (seul GCV1 commande Orbite) | Audit qualité 4.8, P03 ; décision de la direction |
| Résumé de partie : lots, cuts distincts, différés restants, inconnus | Audit qualité 4.8, U04 |
| Provenance du rapport de sortie : commit, empreintes et commande de chaque entrée du manifeste ; partie réservée avant réglage | Audit qualité 4.8, D04 |
| Essais du vrai panneau dans Chromium (clavier, focus, mouvement réduit, 200 %) | Audit qualité 4.8, C02 (4.8.x) |
