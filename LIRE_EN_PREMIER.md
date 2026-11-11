# Ariane — lire en premier

**Seul document d'état** (D6, 29/09/2026) : ce qui est installé, ce qui est en
cours, où en sont les mesures. Le plan est dans `PLAN_SUITE.md`, les règles
dans `PASSATION_4.8.0.md`, les problèmes dans `KNOWN_ISSUES.md` (trié le
29/09). `PROJECT_STATE.md` n'est plus que l'historique.

## État au 11 novembre 2026 — « Vision 14 »

- **Nom et version** : l'extension s'appelle « Vision » (manifeste `5`) ; les paquets d'essai sont nommés « Vision N » et fabriqués par `python3 tools/package.py --output <fichier>.zip` ; le fichier `BUILD` du paquet porte le commit. Dernier paquet : **Vision 11** (build `30bb2cd`, 10/11), version sans nouveauté : capacité du préchauffage et corrections (D-317). Entrées détaillées : `CHANGELOG.md` (Vision 5 à 14).
- **Cap** : D-299 et D-300 (JavaScript orchestre, Rust seulement là où il gagne : la lecture LiDAR) ; D-306 (tous les exécutants sont des sessions Claude, plus de Cursor ni de Codex) ; D-311 (lot en orbite fluide : tout préchargé à l'avance) ; D-312 (chantiers en parallèle, verify et maquette dans la machine de l'exécutant).
- **« Vision 12 »** (10/11) = Vision 11 plus deux corrections du moteur avec l'accord écrit de l'opérateur (D-318) : reprise après un arrêt du service worker (CH-091) et reprise après une écriture refusée (CH-094), appliquées et prouvées. **En attente** : CH-093 (préchauffage au passage à la relecture), PRÊT sur sa branche, non intégré : son bilan de temps est nul ou négatif en maquette, décision de l'opérateur avant de l'allumer.
- **« Vision 13 »** (10/11) = Vision 12 plus les corrections de l'audit du 10/11 (D-319) : quatre défauts du moteur et de l'adaptateur (CH-096, patchs de `src/adapter-page.js` et `src/core.js`), neuf du service worker et du panneau (CH-097), le bouton « SKIP explicite » masqué (D-320), et l'étude de la mémoire de la page (CH-098, sans correction : relevé de console `chantiers/CH-098/releve-console.js`). Lot de terrain « Vision 12 » mesuré le 10/11 : le préchauffage tient tout le lot et survit à un 502 ; la mémoire de la page monte d'environ 0,66 Mo par cut (cause SUPPOSÉE hors d'Ariane) et la garde `tasMaxMo` finit par couper le préchauffage.
- **« Vision 14 »** (11/11) = Vision 13 plus le panneau refait en « Graphite » (D-333 à D-336 ; CH-104 le panneau, CH-105 la molette du nombre de parties de 1 à 20, CH-106 la relecture critique et ses corrections). Seuls le rendu du panneau, ses feuilles de style et la police changent ; moteur, adaptateur, géométrie, décision du lot, service worker et manifeste : différence vide depuis Vision 13. Maquettes de référence : `maquettes/bento/`. Détail : `CHANGELOG.md`.
- **En cours (10/11)** : étude « coupes non résolues » (D-321, D-322 ; cadrage `fiches/CADRAGE_COUPES_NON_RESOLUES_2026-11-10.md`, CH-099 recherche large rejouée hors ligne, CH-100 trois mesures) : tout reste hors ligne, aucune règle de pose ne change sans accord écrit ; interface du panneau rouverte (D-323, CH-101 : trois propositions, aucune intégration avant le choix écrit de l'opérateur).
- **Mesures de terrain** : les exports de lots et leurs bilans sont dans `banane-data` (`collections/2026-11-0x_v5_vision*-essai`), lus par `node tools/bilan-lot.cjs <zips>`. Étude de l'attente des coupes voisines : `chantiers/CH-090/etude.md`. Relecture en adversaire de Vision 8 à 10 : `chantiers/CH-092/rapport.md`. Audit du projet entier (10/11) : `fiches/AUDIT_PROJET_2026-11-10.md`.
- Les sections ci-dessous sont l'historique (3 novembre : Ariane 5 ; 29 septembre : 4.8.5).

## État au 3 novembre 2026 — Ariane 5

**Version officielle : Ariane 5** (manifeste `5`), étiquette `v5` sur le tronc `claude/50-test17` (`ae65426`), paquet `ariane-v5.zip` (SHA-256 `81e30bc27151215181db4a85e2080171595b2030182359ccce2914ae8061b9b1`), notice : `NOTICE_UTILISATION.md`. Décisions D-276 à D-278. Terrain : Constellation 25-26 sans veille (voir D-278). Le tableau ci-dessous (29 septembre) est l'état historique de la 4.8.5.

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
