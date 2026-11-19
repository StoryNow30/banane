# Ariane — lire en premier

**Seul document d'état** (D6, 29/09/2026) : ce qui est installé, ce qui est en
cours, où en sont les mesures. Le plan est dans `PLAN_SUITE.md`, les règles
dans `PASSATION_4.8.0.md`, les problèmes dans `KNOWN_ISSUES.md` (trié le
29/09). `PROJECT_STATE.md` n'est plus que l'historique.

## État au 18 novembre 2026 (soir) — « Vision 21 » : l'interface « Mix », « Glacier » par défaut, et le compteur des cuts appris à jour

- **« Vision 21 »** (18/11) = Vision 20 plus : l'interface **« Glacier »** (l'Instrument de la Vision 20, même rendu, nouveau nom) par défaut et l'interface alternative **« Mix »** au choix dans Réglages › Interface (CH-137, D-371, D-372, D-374) ; le **Cadran est retiré**. Mix : le gros chiffre et sa réglette à la place de l'anneau, les écrans neufs validés par l'opérateur (Constellation et son bilan, Aurore, couches, vue fil, relecture et bornes, rattrapage, Écho sans séance, bandeau « Réglages neufs »), un pied « Cache des exports », et en Constellation « Suivre dans Orbite » comme action pleine. Le **compteur des cuts appris** est régénéré sur 92 parties (CH-138, D-371) : **6 761 cuts corrigés** (contre 2 684 au 19/10) et **17 758 apprenables** ; les 13 parties déjà comptées rendent exactement l'ancien total. Détail : `CHANGELOG.md`.
- **Mesures** : audit de Mix sur les 38 scènes, 836 vues (320 à 720 px, deux thèmes) : 100 défauts au premier passage, tous corrigés dans `panel-mix.css`, **0 au contrôle**, sans toucher aux critères de mesure ; essais du panneau, les 36 fichiers qui montent le panneau, **68 sur 68 en Glacier et 68 sur 68 en Mix** ; verify et maquette ESV sur l'arbre intégré : voir `CHANGELOG.md`.
- **CH-131 clos (19/11)** : le paquet de la Vision 20 reconstruit et comparé à l'identique (1 111 fichiers, aucun écart de CRC) est fusionné dans le tronc et `main` sur demande de l'opérateur ; il n'apporte que l'outil de comparaison `chantiers/CH-131/comparer-crc.py` et son rapport, aucune ligne livrée.
- **Version officielle (19/11)** : `main` et l'étiquette `v5.0` désignent la **Vision 21**, sur décision de l'opérateur après son essai complet (six contrôles, tous bons). Le paquet officiel est celui dont le fichier `BUILD` porte le commit de cette version ; l'ancien point de `v5.0` (Vision 20, commit `a19c5ed5`) reste dans l'historique du dépôt.
- **Décisions** : D-375 — l'opérateur confie tout à OpenCode (tickets, intégration, verify, paquets, avance du tronc) ; Claude relit sur demande. CH-131 (paquet de la Vision 20 reconstruit et comparé à l'identique, 1 111 fichiers, aucune différence de CRC ni de taille) est rendu sur sa branche et en attente de fusion.
- **Relais de la télécommande redéployé le 19/11** (D-377), depuis GitHub Actions : la page servie passe de 24 465 à **19 459 octets**, identique octet pour octet à `telecommande/telephone.html`, avec les quatre onglets Orbite · Écho · Constellation · Aurore ; `signal-rendu.js` (122 841 octets) et `panel-signal.css` (94 088) servis sont eux aussi identiques au dépôt. Le téléphone n'a rien à refaire (même Worker, même appairage, même clé). Contrôle de l'opérateur sur son iPhone : « tout fonctionne » ; le jeton Cloudflare a été supprimé ensuite. CH-130 est clos (19/11).
- **A1 du lot du 18/11 — effet net du retrait du passage « branche », mesuré au banc et écarté** (CH-139) : le banc à zones de lot (plafonnement à 10, profil L1-se) donne 564 différés (29 > 50 mm) sur le livré, 596 avec l'ancre. Le retrait passe à 602 : **+6 différés, −3 justes, 0 erreur évitée** — donc le passage est gardé. Le terrain du 16 et 17/11 (6 fausses sur 6 sur branche) ne reproduit pas dans ce banc.
- **Lot du 18/11 (Vision 20) ingéré le 19/11** (CH-140) : 30 archives vérifiées (20 volumes + 10 Échos), `banane-data/collections/2026-11-18_v20_lot-parties6-15/`. Écho : 451 cuts vus, **96 corrigés**, 378 apprenables ; total **6 857 corrigés / 18 136 apprenables** (somme exacte des dix nouvelles sources ajoutée au total publié du 19/11 ; le recalcul complet sur 102 sources est en cours). Revue explicite par critères : **59 corrections sur 92 acceptées** ; les rejets viennent surtout de la capture (**82 cuts sur 451** ont un LiDAR complet). **D-379 : les parties 6 à 15 restent réservées**, donc rien n'est entraîné dessus ; jugement hors échantillon obtenu (8 parties, 50 cuts) : **78,6 %** des corrections de plus de 10 mm ont une hypothèse à 10 mm, 100 % au moins un rail. Journal : 9 défauts retenus, dont 3 revérifiés (767 validations sur 791 en preuve de navigation seule ; 758 clics hors canevas ; 3 coupes à plus de 15 mm validées sans pause) — `chantiers/CH-140/rapport-journal.md`.
- **Ariane 6 lancée le 19/11** (D-378) : plan validé tel quel, tronc `ariane6`, but « différés sous 5 % puis 3 % sur des lots non vus » ; lot A1 = CH-139 (mesure du motif « branche »), en cours.
- **En attente de l'opérateur** : garder les réglages d'un poste à l'autre (`chrome.storage.sync`, ou export et import) ; ouvrir ou non les correctifs 5.0.x des défauts du journal.
- **Ce que la Vision 21 ne couvre pas** : Mix, Glacier et la vue fil n'ont pas tourné dans Chrome à côté d'ESV ; les motifs confidentiels (`ARIANE_MOTIFS_INTERDITS`) ne sont pas posés sur le VPS ; en Mix, à 380 × 640, la ligne d'état de la tuile est à 20 px du haut pour un seuil écrit pour la tuile de Glacier (mesuré, non tranché).

## État au 18 novembre 2026 — « Vision 20 » (paquet précédent, conservé dans l'historique) : la 5.0 était close (D-370) ; `main` et l'étiquette `v5.0` désignent maintenant la Vision 21

- **« Vision 20 »** (18/11, dernier paquet, 5.0 close) = Vision 19.1 plus : l'**interface « Instrument » par défaut** (CH-134, direction A choisie par l'opérateur, D-368) avec dans Orbite un bouton **« Vue fil »** (derniers cuts, plus récent en haut) ; l'**interface « Cadran »** au choix dans Réglages › Interface (CH-135, tirée du prototype Figma de l'opérateur, mêmes boutons et mêmes ordres) ; les **bornes de la relecture** en pause et après un arrêt (CH-133, D-366) ; **aj5 allumé par défaut** (D-367) ; la **recette totale** (CH-136 : le réglage aj5 « perdu » venait d'un autre poste, donc d'un stockage local neuf ; bandeau « Réglages neufs sur ce poste », hors lot ; trois corrections du service worker). Interface validée par l'opérateur (D-370) sur le dessin Figma de l'interface réelle (D-369). Détail et preuves : `CHANGELOG.md`.
- **En attente de l'opérateur** : garder les réglages d'un poste à l'autre (`chrome.storage.sync`, ou export et import) ; relais de la télécommande à redéployer ; suppression éventuelle de la branche `chantier/CH-136` (un commit y citait les caractéristiques de deux postes ; il n'est ni au tronc ni sur `main`). Validation du plan d'Ariane 6 (`fiches/PLAN_ARIANE_6.md`, proposition, D-373 ; la règle « branche » de D-368 y est le lot A1).
- **Après la 5.0 (18/11)** : fait depuis — interface alternative « Mix » (CH-137) et compteur des cuts appris (CH-138) livrés dans la Vision 21, ci-dessus.

## État au 17 novembre 2026 — « Vision 19 »

- **« Vision 19 »** (17/11, dernier paquet) = Vision 18 plus : le **panneau revu après une journée de terrain** (CH-129, D-361, D-362 : une seule mise en page de 320 à 720 px, phrases courtes, avis en ligne ambre, quatre tailles de texte, quatre réglages retirés de l'écran à valeur gardée, troisième palette « Signal », Constellation épurée avec son bilan derrière un bouton à icône) ; la **télécommande complète** (CH-130 : le téléphone dessine le vrai panneau, adresse du relais mise dans le paquet hors dépôt ; relais à redéployer) ; la **deuxième passe qui passe au cut suivant après un refus avant toute écriture** (D-363, plafond de 10 inchangé). Lu sur le premier lot de terrain de la Vision 18 (16/11) : aucun défaut du calcul. Détail : `CHANGELOG.md`.
- **« Vision 18 »** (14/11) = Vision 17 plus : le **levier de voie allumé d'office** (CH-124, D-355 : une pose à plus de 75 mm de l'axe de la voie relevée, déduit de la trajectoire du véhicule par la liste d'ESV, est laissée à l'opérateur ; corpus : poses à plus de 50 mm 29 → 0, différés 571 → 603, 0 faute) ; l'**ajustement de hauteur « aj5 » éteint, avec une case d'essai** dans les réglages (CH-121) ; le **panneau épuré** avec les palettes Glacier et Sarcelle et leur bascule (CH-115, D-353, D-354). Détail et preuves : `CHANGELOG.md` ; programme et verdicts de tous les chantiers « GCV2.1 » : `chantiers/PROGRAMME_GCV21.md` ; audits : `chantiers/AUDIT_GCV21.md` ; reprise d'une session : `fiches/PASSATION_SESSION.md` § 0. À faire après ce paquet : resceller la base de `tools/garde-gcv2.cjs` (elle rend « 1 » pour les 13 refus d'octobre, expliqués un à un), juger la reprise après refus (N+, non couverte par D-355), demander à l'opérateur un Écho sur un lot neuf riche en aiguillages.
- **Nom et version** : l'extension s'appelle « Vision » (manifeste `5`) ; les paquets d'essai sont nommés « Vision N » et fabriqués par `python3 tools/package.py --output <fichier>.zip` ; le fichier `BUILD` du paquet porte le commit. Dernier paquet : **Vision 11** (build `30bb2cd`, 10/11), version sans nouveauté : capacité du préchauffage et corrections (D-317). Entrées détaillées : `CHANGELOG.md` (Vision 5 à 14).
- **Cap** : D-299 et D-300 (JavaScript orchestre, Rust seulement là où il gagne : la lecture LiDAR) ; D-306 (tous les exécutants sont des sessions Claude, plus de Cursor ni de Codex) ; D-311 (lot en orbite fluide : tout préchargé à l'avance) ; D-312 (chantiers en parallèle, verify et maquette dans la machine de l'exécutant).
- **« Vision 12 »** (10/11) = Vision 11 plus deux corrections du moteur avec l'accord écrit de l'opérateur (D-318) : reprise après un arrêt du service worker (CH-091) et reprise après une écriture refusée (CH-094), appliquées et prouvées. **En attente** : CH-093 (préchauffage au passage à la relecture), PRÊT sur sa branche, non intégré : son bilan de temps est nul ou négatif en maquette, décision de l'opérateur avant de l'allumer.
- **« Vision 13 »** (10/11) = Vision 12 plus les corrections de l'audit du 10/11 (D-319) : quatre défauts du moteur et de l'adaptateur (CH-096, patchs de `src/adapter-page.js` et `src/core.js`), neuf du service worker et du panneau (CH-097), le bouton « SKIP explicite » masqué (D-320), et l'étude de la mémoire de la page (CH-098, sans correction : relevé de console `chantiers/CH-098/releve-console.js`). Lot de terrain « Vision 12 » mesuré le 10/11 : le préchauffage tient tout le lot et survit à un 502 ; la mémoire de la page monte d'environ 0,66 Mo par cut (cause SUPPOSÉE hors d'Ariane) et la garde `tasMaxMo` finit par couper le préchauffage.
- **« Vision 14 »** (11/11) = Vision 13 plus le panneau refait en « Graphite » (D-333 à D-336 ; CH-104 le panneau, CH-105 la molette du nombre de parties de 1 à 20, CH-106 la relecture critique et ses corrections). Seuls le rendu du panneau, ses feuilles de style et la police changent ; moteur, adaptateur, géométrie, décision du lot, service worker et manifeste : différence vide depuis Vision 13. Maquettes de référence : `maquettes/bento/`. Détail : `CHANGELOG.md`.
- **« Vision 15 »** (11/11, dernier paquet) = Vision 14 plus les pannes de la Constellation du 11/11 : chargement des points réparé (CH-110, D-342, D-343), relecture qui ne court plus sur des cuts vides (CH-107), reprise seule de la relecture après F5 et changement de partie qui attend ESV (CH-109, D-341), « remise impossible » sans objet qui ne bloque plus la file (CH-109), caméra changée relue au lieu de l'ERREUR (D-344) ; panneau « Épure, un caractère par panneau » (CH-108, D-339). Moteur, géométrie et décision du lot inchangés. Détail : `CHANGELOG.md`.
- **« Vision 16 »** (12/11) = Vision 15 plus la télécommande iPhone (CH-111, D-345). **« Vision 17 »** (12/11, dernier paquet) = Vision 16 plus la règle « voie des cuts sûrs » en ombre, deux réglages côte à côte (CH-112, CH-114, D-347), et la fin du faux avis de contrat d'ESV (D-348). Apprentissage des Échos du 12/11 (CH-113) : cible non atteinte, levier A gardé en patch non appliqué. Panneau : nouvelle passe de design en cours (CH-115, D-349, D-350 : direction B « Brume » à retravailler). Détail : `CHANGELOG.md`.
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
