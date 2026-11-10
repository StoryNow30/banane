# Audit du projet entier — 10/11/2026

Demande de l'opérateur : « lis l'intégralité de ce projet et trouve tout ce qui est cassé, incohérent, inefficace ou plus nécessaire ; corrige ce dont tu es sûr et liste le reste ». Cinq relecteurs en lecture seule (service worker ; moteur, adaptateur et modules de décision ; panneau, page et réglages ; essais et outils ; documents et données), plus des croisements par script. Leurs rapports complets ne sont pas dans le dépôt ; cette fiche en garde l'essentiel.

**Comment lire les qualifications.** « Vérifié » : l'intégrateur a relu le code ou relancé la commande. « Rapporté » : établi par un relecteur (fichier et ligne donnés), non revérifié par l'intégrateur. PROBABLE et SUPPOSÉ gardent leur sens habituel. Les numéros de ligne valent pour le tronc au 10/11.

**Ce qui n'a PAS été lu** est en § 7 : l'audit ne couvre pas tout, et le dit.

## 1. Corrigé cette nuit (sûr, prouvé par un essai ou sans effet sur l'exécution)

| Quoi | Où | Preuve |
|---|---|---|
| Plafond « du lot » du préchauffage compté pour la vie de la page (1,2 Go, octets décodés : épuisé vers 800 nœuds, puis plus rien jusqu'au F5) → fenêtre glissante de 10 min | `src/prechauffage-anticipation.js`, `src/prechauffage.js`, `src/settings.js` | 2 essais rouges puis verts (`tests/ch090-capacite.test.cjs`) |
| Après un 502 vu par l'observateur, le préchauffage ne repartait pas (avec ligne de base) ; régression sans ligne de base | `src/prechauffage.js` | essais vm et navigateur (`ch092-prechauffage-noeud-bloque`, `ch095-noeud-bloque`) |
| Opération lointaine plafonnée à 32 nœuds : moins bonne que l'opération proche à 4 chargements à la fois → plafond propre, 96 | `src/prechauffage.js`, `src/settings.js` | maquette : 56/56 et 412 ms contre 33/56 et 728 ms |
| Diminutif de l'opérateur dans un commentaire d'un fichier injecté dans la page | `src/settings.js:482`, `background.js:2621` | grep ; garde de pose verte |
| Commentaires de réglage contraires à la valeur livrée (`ecritureMax`, `sautMin`) | `src/settings.js:262`, `src/prechauffage.js:54` | lecture |
| Documents d'entrée figés au 28/10 (4.9.5.23, Cursor, passe en ombre) remis à l'état courant | `fiches/PASSATION_SESSION.md`, `LIRE_EN_PREMIER.md`, `AGENTS.md`, `chantiers/MODELE.md` | lecture croisée avec D-303, D-306, D-317, D-318 |
| Deux cas d'essai sautés à chaque passage depuis Vision 6 et 9 (« sans le patch ») retirés | `tests/ch080-adaptateur.test.cjs`, `tests/ch088-adaptateur.test.cjs` | 8 sautés → 6 |
| Suite de la maquette instable sous charge (2 essais d'interface rouges dans la suite, verts seuls) → deux fichiers à la fois, les sensibles un par un | `tests/esv-maquette/essais.cjs` | suite complète verte après réglage |

## 2. À trancher par l'opérateur : règles et confidentialité

1. **Un bouton « SKIP explicite » existe et envoie SKIP à ESV** (`panel.html:177`, `panel.js:887` et `:1433`, `background.js:4581`, `src/engine.js:1169`), sur clic de l'opérateur, dans une pause. `CLAUDE.md` dit « Ariane n'envoie jamais SKIP », « aucune exception ». Vérifié (le bouton et la commande existent). De plus (rapporté, effet PROBABLE) : ce SKIP relaie le raccourci sans `which` ni `keyCode`, que les deux autres raccourcis règlent parce qu'ESV les lit : il est probablement sans effet dans ESV, puis l'état est noté comme envoyé. Choix : retirer le bouton, ou écrire l'exception dans la règle et réparer la frappe.
2. **Le panneau dit que la deuxième passe est « en ombre, sans rien écrire dans ESV » alors qu'elle écrit** (`panel.html:249`, `src/signal-rendu.js:511`, `panel.js:564`) : le réglage livré est `ecriture:true`, plafonné à 10 cuts (D-259). Vérifié. Recommandation : corriger le libellé (« pose et valide jusqu'à 10 cuts en fin de lot »).
3. **`CLAUDE.md` est périmé sur trois points** (vérifié) : ligne 15 (« la deuxième passe est en ombre… le défaut du dépôt reste `false` ») ; lignes 3 et 26 (Cursor et GLM au présent, contre D-306). Texte proposé pour la ligne 15 : « La deuxième passe écrit, plafonnée à 10 cuts par lot (D-259, `passeDifferesDefaut` : `ecriture:true`, `ecritureMax:10`). Lever le plafond ou la couper demande une décision écrite de l'opérateur. »
4. **Le diminutif de l'opérateur reste** (vérifié par grep, sans casse) : comme valeur de donnée écrite au journal (`background.js:4051`, `pauseRaison`) et dans une chaîne (`:2655`) ; dans des fichiers gardés au bit près (`src/regles-metier.js:6`, `src/voie-recentree.js:256-258` : nom de paramètre ; `src/gcv2-parametres-l1.js:4` : nom de champ) ; dans 20 outils de `tools/`, des tickets et trois fichiers de `datasets/`. D-254 a abandonné ce retrait ; `CLAUDE.md:13` l'interdit toujours. À trancher : quelle règle vaut, et pour quels fichiers.
5. **Identifiants de terrain (UUID) dans 43 fichiers suivis** de septembre (`audit/acceptance-p*`, `audit/brain-audit-*`, `audit/continuity-*`, `audit/native-*`, `audit/chantiers/qualite-480/*`, `datasets/automatic/offline-evaluation-v4.3.0.json`…) ; trois sont exigés par `tools/package.py` et partent dans le paquet. Rapporté (grep). Les déplacer vers `banane-data` casse des outils et des essais : chantier à part.
6. **Captures d'écran d'outils tiers dans `design/`** (rapporté, images vues par le relecteur) : `design/ui-next/reference-1-apercu.jpg` et `reference-2-consommation.jpg` (tableau de bord d'un service tiers, noms de produits et montants lisibles) ; `design/references/ux-2026-10/porsche-*.jpg` ; deux captures du panneau avec des numéros de lot. Aucune capture d'ESV trouvée.
7. **Le paquet installé embarque tout le dépôt hors essais** (vérifié sur le zip : `chantiers/` 230 fichiers, `tools/` 158, `fiches/` 110, `consignes/` 74, `datasets/`, `maquettes/`, les 44 documents de la racine dont `DECISIONS.md`) : environ 16 Mo dont 2,5 Mo servent à l'exécution. Rien n'est exposé à la page ESV (aucune ressource accessible au web). À trancher : paquet minimal, ou archive lisible comme aujourd'hui.

## 3. Cassé, non corrigé (fichiers protégés ou comportement à décider)

Moteur et adaptateur (fichiers gelés : accord écrit nécessaire ; aucun chemin trouvé vers un SKIP automatique ni vers la validation d'un cut sans décision) :
1. **« Archiver le résultat interrompu » puis « Reprendre » après une validation non confirmée, sans F5 : lot en ERREUR** (« Cannot read properties of null »), rien n'est envoyé à ESV. `src/engine.js:287-313, 987` ; `background.js:1441-1444`. Rapporté ÉTABLI (reproduit sur le moteur seul).
2. **Un clic de pose de plus peut partir après « Arrêter »** : dans `clickPosition`, le `catch` avale « Action interrompue. » dès le deuxième essai. `src/adapter-page.js:677`. Rapporté (lecture, chemin étroit) ; pas de validation ensuite.
3. **Les quatre étapes `maj-espace-*` ne sont jamais postées au journal** : `validerMajEspace` reçoit `progress` à la place de `options`. `src/adapter-page.js:1199, 1656`. Rapporté ÉTABLI ; journal seulement.
4. **« Niveau de détail non stabilisé » suivi d'une erreur de lecture n'est plus reconnu comme passager** : lot en ERREUR au lieu de la pause reprenable. `src/core.js:22-31`. Mécanisme rapporté ÉTABLI, déclencheur SUPPOSÉ.
5. Observés par les chantiers de la nuit, hors ticket : un lot déjà tombé en ERREUR sur « Capture avant déjà ouverte » n'est pas réparé au redémarrage (CH-091) ; un lot dont la porte de sortie échoue après le dernier cut garde sa liste sans pause, et `init()` lève si IndexedDB refuse aussi son événement de reprise (CH-094) ; `trouEchec` de l'adaptateur ne retrouve pas le nœud en échec en forme commune (CH-095, PROBABLE pour ESV).

Service worker et panneau (non protégés ; à corriger avec un essai rouge, dans une version à part) :
6. **Un lot en ERREUR n'est jamais « clos » pour le service worker** alors qu'il l'est pour le panneau : vidage du cache refusé, écran gardé éveillé, reconnexion après F5 refusée avec un message faux, audit de liste attribué au lot mort. `background.js:210`, `:3259` (liste en double), `src/export-cache.js`, `src/perf-phase.js:31` contre `src/file-parties.js` et `panel.js:850/866/920`. Rapporté ÉTABLI.
7. **Écho : au-delà d'environ 125 000 événements, le réveil échoue** (`Math.max(...events)`, `src/native-session.js:90-91`) et toute action avec lui. Mécanisme ÉTABLI, seuil atteint SUPPOSÉ.
8. **Alertes de la file sans données** : `fileResume` (`background.js:4132`) ne fournit ni `refus` ni `ecritsPasse` que lit `src/file-parties.js:270-283` ; l'alerte « refus » ne sort jamais. Rapporté ÉTABLI.
9. **Toute action du panneau refusée écrase l'avis du lot** (`background.js:4671`) ; cas suivi de bout en bout : `build` échoue à chaque ouverture du panneau pendant Écho. Rapporté ÉTABLI.
10. **Signal sous-compte les « verts à contrôler » au-delà de 12 plages** et affiche une ligne vide (`src/ui5.js:134-135` recompte dans le DOM que `panel.js:348-349` tronque). Rapporté ÉTABLI (lu, non reproduit).
11. Mineurs : `esv-releve` et `clic-hors-vue` perdus avant `ready` (`background.js:4637`) ; libellé d'une visite Écho non rafraîchi après une écriture tardive (PROBABLE) ; heure de la machine au lieu de Paris (`src/relecture-pause.js:23`).

## 4. Inefficace (rien n'est mesuré sur le terrain sauf mention)

1. **Export du diagnostic GCV1 quadratique** (`src/gcv1-export.js:225-232`) : journal synthétique, 10 000 événements 1,3 s, 20 000 6,0 s, 40 000 23,7 s (mesuré par le relecteur). Correction simple : index par proposition.
2. **État du lot réécrit en entier à chaque sauvegarde** : `batch.lotCommands` et `batch.lotPosed` absents de la découpe (`src/etat-morceaux.js`) ; lot synthétique de 5 000 cuts : 1,7 Mo et 27,6 ms par sauvegarde. La mémoire de la liste d'ESV est relue et réécrite en entier à chaque validation (`src/liste-memoire.js:130-143`).
3. **Par cut** : trois sauvegardes d'état sans changement et six lectures d'état de la page (`src/engine.js:960, 975-1035`) ; le nuage relu deux fois (`background.js:2575` et `:1743`) ; la seconde vue clonée en entier puis ses points jetés, et la capture sérialisée une fois de plus pour la mesurer (`src/merge-clouds.js`) ; le bord d'ornière calculé à chaque cut même hors passage à niveau (`src/lot-decision.js:160-165`). C'est la piste des « 240 ms d'orchestration » : à profiler avant de toucher.
4. **Panneau** : chaque seconde, rendu complet du panneau caché puis reconstruction complète de Signal par lecture de ce DOM ; deux sondages parallèles de `relecture-etat`, qui re-télécharge et re-parse un fichier du paquet à chaque fois (`background.js` vers `:3549`).
5. **Écho** : `exportManifest` charge toute la séance pour rendre des comptes, à chaque segment (`src/native-session.js:929-946`).
6. **Essais** : l'arbre synthétique de Potree est recopié dans 10 fichiers et l'observateur dans 7 (une monture commune existe, `tests/ch092-prechauffage-monture.cjs`) ; 19 fichiers d'essais durent plus de 12 s, deux frôlent le délai de 20 s (`ch084-validation-sur-place`, `ch065-geometrie-elaguee`), rouges sur une machine lente.
7. **Lecture d'entrée d'une session** : environ 130 Ko avant de travailler, dont plus de la moitié décrivait un état révolu (allégé en § 1 ; une page d'état unique reste à faire).
8. Préchauffage, avec un nœud bloqué : l'arbre est reparcouru à chaque image tant que les places réelles de Potree sont prises (PROBABLE, non reproduit).

## 5. Plus nécessaire (suppression = décision de l'opérateur ; rien n'a été supprimé)

Code livré qui ne tourne plus :
- **Mode « Correction »** retiré en 4.5.4 : `src/manual-page.js` (non injecté), `src/manual-session.js` chargé mais inatteignable (`manual-end`, `manual-download` sans appelant), branches mortes dans `src/bridge.js`, `src/early-input.js`, `src/adapter-page.js:19` et `:1383`.
- **Voie `fetch` du préchauffage** (`src/prechauffage.js`, environ 100 lignes) : remplacée par la voie potree depuis Vision 8 (nos requêtes recevaient 401) ; `prechauffer.octetsMax` et `coupesSansCache` sont sans effet.
- **`src/file-prioritaire.js`, `src/native-reconstruction.js`** : outils hors ligne rangés sous `src/`, chargés par aucun fichier d'exécution. **`src/ui5-variante.js`** : pose une variable que personne ne lit. **Deux polices** non référencées (99 Ko).
- **Options jamais sélectionnées** dans les modules de décision (fichiers gardés, liste seulement) : 12 options `lab` de `geometry-candidate-v1.js`, 27 leviers de `gcv2-l1.js` avec `deciderL1Ref`, `gaugeChoice` et `gaugeTargetStudy` de `lot-decision.js`, `signe` et `corriger` de `gcv2-l1e.js`, `src/recherche-large.js` (inerte, `actif:false`), l'ombre `ombreVerticale` sans lecteur.
- Réglages définis et jamais lus : `reader.boundsLabel`, `reader.usefulBoundsLabel`, `echo.validateKeys`.

Outils, essais, données :
- 6 outils cités par aucun fichier : `tools/analyze-incidents.cjs`, `evaluate-session.cjs`, `build-windows.py`, `plot-part7.py`, `check-originals.py`, `dossier-passation-externe.py` ; deux échouent à l'exécution (dossiers disparus). 21 outils ne sont cités que par des chantiers clos.
- `.github/workflows/gcv1-shadow-v1.yml` exige 390 essais (le relevé en compte 3 400) : il échouerait s'il partait.
- `tests/incidents/…dataset-v3….json` (14 Mo) est lu par un seul essai ; 13 `.patch` de chantiers ne sont plus cités par aucun code.
- `hub/boite/` : 7 fichiers sur le tronc, alors que le protocole dit qu'elle n'y existe jamais.

Documents :
- À la racine, sans aucune citation : `GCV1_RUNTIME_PORT_MAP.md`, `GCV1_RUNTIME_SHADOW_REPORT.md`, `NOTES_4.9.0.md`, `PASSATION_BANANE.md`, `PILOTAGE_SESSIONS.md`. Cités seulement par des documents révolus : `AUDIT_CERVEAU_4.7.5.md`, `AUDIT_SUPER_CERVEAU.md`, `CHANGELOG_V45R.md`, `CORPUS_V2_NATIF.md`, `DATA_REGISTRY.md`, `FEUILLE_DE_ROUTE_49.md`, `PASSATION_4.7.19/20/21.md`, `PILOTAGE_REPRISE.md`, `PLACEMENT_LAB.md`, `PLAN_4.8.md`, `TEST_V1_PREPARATION.md`, `BANANE_5.0_CAHIER.md`. Proposition : un dossier `archives/`. (14 documents de la racine sont exigés par `tools/package.py` : ils restent.)
- `consignes/` : environ 25 fichiers adressés à des rôles disparus ; `fiches/PASSATION_CODEX.md` ; `fiches/DEMARRAGE_SESSION_PRINCIPALE.md` (cite des fichiers absents et un chantier arrêté par D-257) ; `design/` (25 Mo) et `maquettes/ui-5.0` : maquettes rejetées (D-257).

## 6. Incohérent (à corriger au fil de l'eau, sans risque sauf mention)

- **Seuils en double dans les modules de décision** (fichiers gardés) : anomalie d'écartement de L1-e écrite 15–40 mm dans `src/gcv2-l1e.js:28` et son en-tête, 10–45 mm dans ce qui s'exécute (`src/gcv2-l1.js:555`) ; bornes 1420/1470 recopiées hors de `src/gauge.js` (égales aujourd'hui) ; deux définitions opposées de la référence d'écartement de la liste. Rapporté ÉTABLI.
- **Commentaires contraires aux réglages livrés** (une vingtaine) : « coupé par défaut » pour la série de captures vides, le signal éteint de la relecture, la file, CH-062, CH-084, « déplacer la vue », tous livrés allumés ; éveil « system » (livré `display`) ; cerveau « éteint par défaut » (allumé) ; « éteinte à la livraison » dans `panel.html:207` et `:312`. Corrigibles sans risque dans les fichiers non gardés.
- **Réglages lus mais absents de `src/settings.js`** (les défauts du code jouent) : `releves.auditSilenceMs`, `lot.partieChangeeParEsv`, `lot.preuveServeurJointeMs`, `deplacerVue.remiseEchecsMax`, `echo.reprise`, `export.videDelta`, `prechauffer.oubliMs`, `prechauffer.loin.captureMaxMs`.
- **Nom** : le manifeste dit « Vision », l'interface et la notice disent « Ariane 5 » ; `CHANGELOG.md` s'intitule « Banane V4 TEST ».
- **Chaîne de vérification** : le verify exige TypeScript installé (`npm ci`), non dit dans `CLAUDE.md` ; la CI n'installe pas Chromium, donc environ 16 fichiers d'essais navigateur s'y sautent en silence et son verdict « vert » ne les couvre pas ; un clone peu profond fait échouer `typage-ch075`.
- **Pilotage** : `hub/PROTOCOLE.md`, `fiches/RESEAU_IA.md`, `hub/telegram/INSTALLATION.md` et `tools/hub.cjs` proposent encore Cursor et GLM ; 12 tickets intégrés sans rapport et 9 chantiers intégrés sans ticket ; `DECISIONS.md` : D-225 à D-229 absents mais cités, D-097 à D-099 en double (rien à réécrire, à savoir).
- Vérifié sans défaut : les listes fermées du préchauffage sont identiques entre l'observateur, la page et le service worker ; les cinq permissions du manifeste servent ; toutes les commandes citées par `CLAUDE.md` existent ; aucun `require` cassé.

## 7. Ce qui n'a pas été lu

- Service worker : `src/appuis-liste.js`, `verts-a-controler.js`, `relecture-ombre.js`, `relecture-critere.js`, `gestes-vue.js`, `continuity-observer.js`, `gcv1-shadow*.js`, `raison-correction.js` (pas du tout) ; plusieurs modules lus sans leurs commentaires.
- Décision : `deciderL1e` (`src/gcv2-l1.js:634-836`) non vérifié branche par branche ; `src/gcv2-parametres-l1.js`, `src/native-lidar.js`, `vendor/` survolés ; les gestes de vue de l'adaptateur sans leurs cas limites.
- Panneau et page : `src/signal-rendu.js` après la ligne 330 ; une partie de `src/prechauffage.js` ; les CSS croisés par script seulement.
- Essais : pas lus ligne à ligne (croisements seulement). Documents : 5 fiches sur 110 lues en entier, `consignes/` et `chantiers/` par grep ; `DECISIONS.md` avant D-300 non relu.
- Aucun de ces défauts n'a été cherché sur un vrai ESV : tout vient de la lecture du code, d'essais en machine et de la maquette.

## 8. Ordre proposé

1. Tes décisions du § 2 (points 1 à 4 : cinq minutes).
2. « Vision 12 » : les deux corrections du moteur déjà accordées (D-318), plus, si tu l'accordes, les points 1 à 4 du § 3 (même fichier, mêmes preuves).
3. Un chantier « service worker » : § 3 points 6 à 11, chacun avec son essai rouge.
4. Un profil Chrome du cycle d'une coupe, puis seulement les points du § 4 qu'il confirme.
5. Un chantier de ménage : § 5 (après ta liste de ce qui peut partir), puis les commentaires et réglages du § 6.
