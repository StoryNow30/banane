# CH-064 — Inventaire du calcul portable en Rust (D-295, 06/11/2026)

**But.** D-295 demande de porter en Rust tout le calcul pur qui peut l'être, au bit près, et toujours hors du paquet. Le pourcentage final se calcule sur ce tableau. Il couvre les 71 fichiers JS du paquet : `background.js`, `panel.js`, `panel-lancement.js`, `vendor/*.js` et `src/*.js`.

**Méthode.** Le tableau est produit par `node tools/ch064-inventaire.cjs --md …`, et les tailles sont lues dans le dépôt (ÉTABLI).
- **Analyse syntaxique.** Chaque fichier est analysé pour relever ses fonctions nommées et leurs marqueurs d'impureté : chrome, DOM, stockage, horloge, réseau, Potree, async, aléa, variables `let` de module. Les marqueurs se propagent d'une fonction à celles qui l'appellent dans le même fichier.
- **Ce qui reste pur.** `globalThis.Banane*`, `Date.parse`, `new Date(x)` et `URL` ne rendent pas une fonction impure : ils deviennent des entrées, ou se reproduisent au bit près.
- **Vérification à la main.** Les fonctions douteuses ont été relues, ainsi que les crates des équipes : chef (branche courante), D, E et L (leurs branches).
- **Limites.** Les parts des fichiers mixtes sont ESTIMÉES. L'analyse ne voit pas `this.*`. Les commentaires et les constantes comptent dans la catégorie de leur fichier. L'**octet** est l'unité juste, car les lignes du dépôt sont très denses.
- **J4.** Lors du relevé, `origin/chantier/CH-068` n'existait pas encore. Ses six fichiers sont comptés « en cours » d'après la répartition de l'intégrateur.

**Statuts.** On distingue quatre statuts :
- **porté** : parité au bit sur le corpus réel ;
- **en cours** : confié à une équipe ;
- **portable non porté** : calcul pur, entrées → sortie, sans effet ;
- **non portable** : DOM, `chrome.*`, ESV, orchestration, horloge ou aléa, ou bien colle de moins d'un kilo-octet.

Un fichier mixte affiche son statut principal ; ses parts explicites en sont retranchées.

| fichier | lignes | octets | statut | équipe | part portable non portée | raison / fonctions |
|---|---:|---:|---|---|---|---|
| background.js | 4596 | 504393 | non portable (mixte) | — | 212 l / 24010 o | Service worker : chrome.*, files, horloge, état de session (25 variables de module). ~30 fonctions pures ≥ 300 o, surtout de la colle : obsFields 291–317, relectureCalculer 3730–3763 (assemble relecture-ombre + critère + lot, globalThis.Banane* à passer en entrée), avisDepartSurVert 1338–1344, repriseAnchors 2781–2791, lotSignalRefus 863–877, lotSignalTrou 835–841, translationRails 1102–1108, passeDiffReglage 2109–2115, reglesResume 2599–2605. ESTIMÉ. |
| panel-lancement.js | 13 | 1220 | non portable | — | 0 | DOM pur (écran de lancement), < 15 lignes. |
| panel.js | 1861 | 184160 | non portable (mixte) | — | 103 l / 10508 o | Panneau : DOM, Blob, chrome.runtime. Pures ≥ 300 o : profilVoie 242–262, dessinerVoie 224–241 (chaîne SVG), commandeDerniere 416–430, tempsParCut 477–488, activiteLot 400–409, verifierSanteExportee 1480–1489, libellesOnglets 981–987. ESTIMÉ, intérêt faible. |
| src/adapter-page.js | 1596 | 156653 | non portable (mixte) | — | 38 l / 3339 o | Page ESV : DOM, Potree, viewer, horloge (49 Date.now). Petites pures : refusalDetail 513–523, lectureDuCut 186–191, niveauNoeud 379–383, sameRailPose 98–99, projectToView 506–510, noterClicHorsVue 603–605. Intérêt faible ; fichier interdit aux exécutants. |
| src/appuis-liste.js | 114 | 8684 | en cours | J4 | 0 | Assigné à CH-068 (J4, lancé le 06/11). Fichier entièrement pur (17 fonctions). |
| src/brain.js | 152 | 8606 | portable non porté | — | 152 l / 8606 o | Pur en entier : corrigerRail 89–150, corrigerPaire 75–87, candidatsExposes 63–70, ambigue 71–72. Correction du « cerveau » sur la proposition V4.6 ; appelé par geometry-brain.js. |
| src/bridge.js | 178 | 17856 | non portable | — | 0 | Pont page ↔ service worker : DOM, messages. Pures (reply, tooBig, obsCopy) < 1 Ko de colle. |
| src/carte-relecture.js | 71 | 8472 | non portable | — | 0 | Carte DOM de la relecture ; texteReglages 27–32 seule pure (< 1 Ko). |
| src/continuity-observer.js | 214 | 15065 | portable non porté (mixte) | D (partie) | 175 l / 12019 o | D porte fitAt 82–86, predict 90–96, translated 97–104 (aides.rs). Restent purs non portés : gatherInput 119–148, summarise 149–168, validated 48–58 et selectAnchors 70–81 (Date.parse seul), startRails 173–181, near, cutoffOf, inputSummary, poseEqual. Non portables tels quels : proposeFrom 184–189, observe 200–212 (horloge injectée par défaut, appellent GCV1). |
| src/core.js | 97 | 7700 | portable non porté (mixte) | — | 82 l / 6380 o | Pures : pairCorpus 63–89, expectedPoses 47–58 (appelée par commandRails), manualDecision 90–95, equalPoses 30–32, parse 59–62, cutId/cutKey/identity. Non portables : uid 8 et reference 33–46 (Date, Math.random). |
| src/correction-liste.js | 273 | 25879 | en cours | E | 0 | E porte construire, couverture, statutDe, visitesFusionnees, apprenabilite, bilan, parcours ; lotDe et instant (Date.parse) suivent. Rien de pur hors couverture relevé. |
| src/deplacement-vue.js | 146 | 13389 | portable non porté (mixte) | — | 129 l / 12166 o | Pures : juger 66–77, detailRemise 125–133, detailDeplacement 111–116, gesteJournal, sequence 60–64, resume, reglages, classes noterRemise/noterDeplacement. Non portable : deplacer 80–96 (async, émet les gestes). |
| src/early-input.js | 34 | 3015 | non portable | — | 0 | Écoute clavier de la page (DOM, messages). |
| src/engine.js | 1158 | 100007 | non portable | — | 0 | Moteur gelé : classe async, horloge (27 new Date). 16 petites aides pures (deferEligibility 388–408, closureSummary 1131–1145, expectedTransition 345–362, deferTransition 414–428 : ~92 l, 7,7 Ko) mais plusieurs lisent this.* : non portables telles quelles. |
| src/esv-observer.js | 394 | 33114 | non portable (mixte) | — | 107 l / 7907 o | install 204–392 intercepte le réseau de la page (non portable). Pures : classify 79–91, listSummary 120–130, applyWrite 171–178, nearest 180–188, voisins 191–202, inventaireChamps, gardeExtras, addRows, writeBody, clés (URL à analyser : à reproduire). |
| src/etat-morceaux.js | 105 | 9419 | en cours | E | 0 | E porte decouper, clesARelire, recoller (+ aides). Couvert en entier. |
| src/export-cache.js | 251 | 19047 | non portable (mixte) | — | 97 l / 7405 o | IndexedDB (supprimer, lire, ecrire), Intl (heureParis). Pures : refus 53–73, ficheDepart 196–208, capturesAGarder 89–103, texte 173–183, refusCapture 42–49, nuagesNommes, ajouterDepart. |
| src/faux-vert-ombre.js | 67 | 4508 | en cours | D | 0 | D porte evaluer (+ signaux, bande, seuilsDe). Couvert. |
| src/file-parties.js | 301 | 26309 | portable non porté | — | 301 l / 26309 o | Machine à états pure en entier : transition 107–189, alertes 253–268, reprise 198–218, planifier 71–81, completerBilan, classerLot, vue, arreter. |
| src/file-prioritaire.js | 100 | 7932 | portable non porté | — | 100 l / 7932 o | Pur (ordonner 70–90, apprendreTaux, classe, plages). Non chargé par le manifeste ni le service worker : outils et essais seulement (ÉTABLI par grep). |
| src/garde-apres-differe.js | 60 | 5134 | en cours | D | 0 | Couvert (reglage, voisinsDifferes, juger). |
| src/garde-passe-appuis.js | 59 | 4856 | en cours | D | 0 | Couvert (reglage, deplacementMm, appuiNormalCuts, juger). |
| src/gauge.js | 112 | 7412 | porté | chef | 0 | assessPair et aides (ariane-geometrie/jauge.rs). |
| src/gcv1-export.js | 279 | 16672 | portable non porté (mixte) | — | 265 l / 15802 o | Pures : deferralResult 129–173, runtimeResult 175–208, selectDeferOperation 109–128, linkedEvents 16–32, findCapture 40–53, railView 210–223 ; buildDiagnostic 225–261 pur si exportedAt est passé. Non portable : buildCorpusPlan 263–276 (async getCloud). |
| src/gcv1-shadow-bootstrap.js | 6 | 393 | non portable | — | 0 | Une affectation globale. |
| src/gcv1-shadow.js | 622 | 36984 | en cours (mixte) | D | 51 l / 3910 o | D porte scientificProposeBoth (+ AvecReservoir) et ses aides 110–520. Restent purs non portés : toRuntimeRails 525–570, compactRuntimeRails 572–576 (lisent la variable de module convention : à passer en entrée). Non portables : configure/state/armOnce/disarm 75–108, proposeBoth 578–612 (état, new Date). |
| src/gcv2-l1.js | 1028 | 97698 | en cours | J4 | 0 | Assigné à CH-068. Presque tout pur ; à signaler : variable de module LEVIERS (reglerLeviers 587), Date.now pour rech.ms dans deciderL1e 778–779 (mesure, à garder en JS ou passer en entrée). |
| src/gcv2-l1e.js | 84 | 6659 | en cours | J4 | 0 | Assigné à CH-068. Pur en entier. |
| src/gcv2-parametres-l1.js | 6 | 36547 | données | J4 (lecture) | 0 | Données (coefficients figés de la GCV2, 6 lignes, 36,5 Ko) : pas du calcul ; à embarquer ou à passer en entrée par J4. |
| src/geometry-brain.js | 100 | 5331 | non portable | — | 0 | Colle à état de module (etat, dernier) autour de brain.js et V4.6. |
| src/geometry-candidate-v1.js | 264 | 16913 | porté | chef | 0 | GCV1 (ariane-geometrie/gcv1.rs). |
| src/geometry.js | 130 | 9925 | porté | chef | 0 | V4.6 (ariane-geometrie/v46.rs). |
| src/gestes-vue.js | 187 | 16150 | portable non porté (mixte) | — | 148 l / 12969 o | Pures : evenement 140–162, finirGlisser 170–176, finirMolette 177–181, ecartCamera 108–114, apres, approche, besoin, memeCamera. Non portables : sequenceMolette/Glisser/ClicDroit 53–86 (Math.random), construire/emettre 88–100 (DOM). |
| src/hauteur-apprise.js | 109 | 7368 | en cours | D | 0 | D porte evaluer (+ groupe, signaux, signalRail, modeleDe, correctionRail). Couvert. |
| src/historique-parties.js | 111 | 8539 | portable non porté (mixte) | — | 98 l / 7962 o | Pures : historique 77–108, ficheFin 43–51, ajouterFin 53–59, finDe, comptes (Date.parse / ISO seulement). Non portables : lireFins, noterFin (stockage, variable file). |
| src/journal-index.js | 126 | 12692 | en cours (mixte) | E | 0 | E porte creer et le calcul des clés (journal, journalAppliquer, clesNatif, clesParType). Restent en JS : lireCles 117–123 et la partie IndexedDB d'equiper 43–108 (ESTIMÉ ~30 l). |
| src/level-crossing.js | 113 | 8184 | en cours | D | 0 | Couvert (frameOf, detect, edgeOf, positionAt, read). |
| src/liste-memoire.js | 229 | 15974 | en cours (mixte) | E | 0 | E porte compacter, decompacter, ajouter, comparer, bordsCorps, choisirTable, empreinte, nomFichier, texteResume, actif. Non portables : file, lire, noterEcriture, demanderTable, apresChargement, resume, instantanes, effacer, exportPanneau (chrome, async). |
| src/lod-signature.js | 61 | 3272 | portable non porté | — (périmètre nominal de L) | 61 l / 3272 o | Pur : signature 53–59, jeton 46–52, empreinte 38–42. Dans la liste des modules de CH-064-L, non porté (L n'a porté que la boucle). |
| src/lot-decision.js | 583 | 48040 | en cours (mixte) | D | 107 l / 8748 o | D porte decideCut et toutes ses aides 81–422. Non couverts (lot.rs le dit) : rememberAnchor 439–443, commandsPositions 450–455, holdAnchor 460–463, promoteAnchors 467–472, viewCameras 483–489, inView 490–493, deferRails 496–500, fauxVertActivation 505–514, hauteurActivation 522–537 (BananeSettings à passer en entrée), commandRails/commandRailsBase 538–581 (appelle core.expectedPoses). |
| src/manual-page.js | 160 | 11950 | non portable | — | 0 | Mode manuel côté page : async, horloge. |
| src/manual-session.js | 145 | 13607 | non portable | — | 0 | Session manuelle : async, horloge, stockage. |
| src/merge-clouds.js | 55 | 4704 | portable non porté | — (périmètre nominal de L) | 55 l / 4704 o | Pur : merge 4–25, compactNodes 45–52. Listé pour CH-064-L, non porté. |
| src/native-export.js | 387 | 20939 | portable non porté | — | 387 l / 20939 o | Format d'export compact, pur en entier : compact 162–185, expand 207–225, createInterner 62–88, foldRefs/unfoldRefs 91–122, stripDerived/restoreDerived 125–151, deltaMetadonnees 329–346, evenementsParReference, rehydraterEvenements, empreinte, alleger. |
| src/native-lidar.js | 414 | 36077 | non portable (mixte) | — (périmètre nominal de L) | 58 l / 4337 o | capture 160–408 (async, horloge, uid aléatoire) et prepareNode/directReader/sourceUnchanged (nœuds Potree) : non portables. Pures : coverageFrom 69–81, coverageAccumulator 57–65, rawRoiBounds 102–112, profileLines 23–31, matrixValid, coverage, inBox, draw. ESTIMÉ. |
| src/native-page.js | 286 | 24195 | non portable | — | 0 | File d'entrée côté page : async, horloge. Petites pures (metricSnapshot, clés) < 4 Ko, colle. |
| src/native-reconstruction.js | 89 | 6872 | portable non porté | — | 89 l / 6872 o | Pur (Date.parse seulement) : reconstruireRail 52–81, couvertureDansRepere 40–49, reconstruireCut. Non chargé à l'exécution : outils et essais (ÉTABLI par grep). |
| src/native-session.js | 995 | 101096 | non portable (mixte) | E (dataset) | 309 l / 29108 o | E porte l'assemblage de dataset 954–992. Pures non portées : classify 513–564, chooseGeometry 478–512 (Date.parse, this.partialReason), health 823–859, accountQuality 778–819, referenceFromWrite 640–652, mergeMetrics 154–168, referenceParEcriture 45–56, redactedEvent 292–300, railDelta, exportAdvice, visitRelation. handle 301–477 (178 l, 21,7 Ko) est le cœur de la session : async + état, non portable tel quel. |
| src/part-summary-49.js | 259 | 18369 | portable non porté | — | 259 l / 18369 o | Module déclaré pur : summarize 200–256, buildLots 126–149, outcomes 165–189, projectEvent 82–96, linkContexts 153–162, fromJournal. |
| src/perf-phase.js | 333 | 24791 | non portable | — | 0 | Chronométrage : horloge, enveloppe des méthodes, état de module. |
| src/phase-pli.js | 135 | 9726 | portable non porté | — | 135 l / 9726 o | Pur : plierGroupe 48–72, plier 74–97, deplierGroupe 104–119, deplier 121–132, eligible. |
| src/placement-convention.js | 134 | 9506 | porté | chef | 0 | calibrate, bandOffsets, quantile, template (convention.rs) ; plafondMode lit BananeSettings, passé en entrée. |
| src/raison-correction.js | 131 | 10657 | portable non porté | — | 131 l / 10657 o | Module déclaré pur : appuyer 81–92, vue 121–127, lireFrappe 39–47, heriter, appliquer, autreGeste, derniereValidation (Date.parse). |
| src/recherche-large.js | 209 | 19066 | en cours | J4 | 0 | Assigné à CH-068. decider 159–200 mesure ms par Date.now (à passer en entrée). |
| src/regles-metier.js | 240 | 22137 | en cours (mixte) | D | 77 l / 6783 o | D porte surface, railsDePlus, resumer, doitDifferer, evenement. Laissés en JS par D (Map/Set hors VBA, metier.rs le dit) mais purs : creerMemoire 137, evaluer 171–184, noter 186–200, lignes 205–227, zonePN 144–153, zoneADV 157–166, grappeDe, vusSansChaussee. |
| src/relecture-critere.js | 146 | 14097 | en cours | D | 0 | Couvert (reglages, correctionPermise, juger). |
| src/relecture-ombre.js | 231 | 23686 | en cours | D | 0 | Couvert (selection, juger, poseCalculee, skipOmbre, confiance…). |
| src/relecture-pause.js | 49 | 5262 | non portable | — | 0 | Carte DOM de la pause. |
| src/relecture-signal.js | 51 | 5250 | en cours | D | 0 | Couvert (reglage, lectureDe, creer, observer, recharge, bilan). |
| src/serie-captures-vides.js | 58 | 4775 | portable non porté | — | 58 l / 4775 o | Détecteur déclaré pur : observer 36–55, reglage 21–28, bilan, creer, fermer, attendre, differer. |
| src/settings.js | 614 | 67818 | non portable | — | 0 | Constantes (réglages gelés) + describe 564–608 (texte). Les seuils lus par la décision passent en entrée. |
| src/signal-rendu.js | 776 | 96885 | non portable (mixte) | — | 373 l / 40603 o | Rendu pur du panneau. Modèles de vue (portable, intérêt de présentation) : modele 117–224, ongletCorrectionModele 667–709, ongletFileModele 582–617, fileModele 237–273, modeleEcho 289–306, commandes 449–472, ciblesBornes 44–54… Les *Html (270 l, 40 Ko de chaînes HTML) comptés non portables (présentation). allureLot 30–37 lit l'horloge. |
| src/storage.js | 81 | 7764 | non portable | — | 0 | IndexedDB et chrome.storage. |
| src/ui5-variante.js | 4 | 389 | non portable | — | 0 | Une constante globale. |
| src/ui5.js | 583 | 53032 | non portable (mixte) | — | 78 l / 8259 o | Panneau : DOM, chrome, horloge. Modèles purs : correctionDuPanneau 229–258, fileDuPanneau 187–213, lignesEcho 55–63, departsFile 217–224, statutsLot 51–54. calculAr/calculSig mêlent horloge et messages. |
| src/verts-a-controler.js | 173 | 15492 | en cours | E | 0 | E porte liste, signaux, duree, lignesDeInstantane, compacter ; noter, classer, plages, plagesPN appelés par liste. Couvert. |
| src/voie-b1-ecart.js | 164 | 15147 | en cours | J4 | 0 | Assigné à CH-068. Pur en entier. |
| src/voie-recentree.js | 367 | 27944 | en cours | J4 | 0 | Assigné à CH-068. Pur en entier (32 fonctions). |
| src/zip-writer.js | 208 | 10870 | non portable (mixte) | — | 38 l / 1614 o | Pures : crc32 46–51 et crcTable 35–44 (table paresseuse, pure de fait), dateDos 55–62 (UTC), u16/u32/cat, nomValide, coutEntree. La compression passe par CompressionStream('deflate-raw') du navigateur : aucun deflate dans le dépôt (ÉTABLI), non portable au bit près sans réécrire zlib. createZip/lire/preparer : Blob, flux. |
| vendor/capture-core.js | 155 | 7775 | porté (mixte) | chef | 89 l / 5061 o | Porté : point, affine, multiply, inverse, rebase, vector, matrix (ariane-capture). Restent purs non portés : identity, distance, translation, compose 66–76, worldMatrix 77–84, rotation 85–90, railState 91–95, equalRails 96–99, serialRail 100–106, reference 107–122, attribute 124–152 (lecteur de tampon Potree, au bord du non portable). |
| vendor/lidar.js | 315 | 21194 | non portable (mixte) | L | 22 l / 1027 o | Porté : boucle par point de capture() (l. 232–265, ESTIMÉ ~34 l). Le reste de capture() (162–304), inventory, clipSnapshot, boxVisible, cameraSnapshot, inspectNode lisent les objets Potree vivants de la page : non portable. Pures portables : profileLines 99–114, reportedBox 115–119, inRoi 120. |

### Totaux (71 fichiers, 23937 lignes, 2231243 octets)

| catégorie | lignes | % lignes | octets | % octets |
|---|---:|---:|---:|---:|
| porté | 740 | 3.1 | 48670 | 2.2 |
| en cours | 4794 | 20.0 | 408320 | 18.3 |
| portable non porté | 4384 | 18.3 | 352078 | 15.8 |
| non portable | 14013 | 58.5 | 1385628 | 62.1 |
| données | 6 | 0.0 | 36547 | 1.6 |

Calcul pur identifié (porté + en cours + portable non porté) : 809068 o ; part déjà portée ou en cours : 56.5 % en octets.

**Lecture des totaux** (ESTIMÉ pour les fichiers mixtes) :
- Le calcul pur identifié fait 809 Ko. 56,5 % sont portés ou en cours, dont la tranche J4, comptée en entier (175 Ko).
- Le lot de présentation, optionnel (500–549, 86,7 Ko), est surtout de la colle. Sans lui, le calcul pur fait 722 Ko, dont 63 % sont portés ou en cours.
- « 100 % du calcul portable » = les lots ci-dessous, faits.

## Ce que les équipes ne couvrent pas, alors que c'est pur (lu dans les crates)
- **D** :
  - `lot-decision` : mémoire des appuis, `commandRails`, activations (~107 lignes, 8,7 Ko ; `lot.rs` le dit) ;
  - `regles-metier` : `creerMemoire`, `evaluer`, `noter`, `lignes` (~6,8 Ko), laissés en JS à cause de Map et Set ;
  - `gcv1-shadow` : `toRuntimeRails` (3,9 Ko) ;
  - `continuity-observer` : 20 lignes portées sur 214.
- **E** : le reste pur de `native-session` (`classify`, `chooseGeometry`, `health`, `accountQuality`…, ~309 lignes, 29 Ko).
- **L** : seule la boucle par point de `capture()` est portée. `merge-clouds`, `lod-signature` et les fonctions pures de `native-lidar` ne le sont pas.
- **Chef** : il reste dans `capture-core` `compose`, `worldMatrix`, `rotation`, `railState`, `equalRails`, `serialRail`, `reference` et `attribute` (~5 Ko).
- **`zip-writer`** : le dépôt n'a aucun deflate, la compression passe par le `CompressionStream` du navigateur (ÉTABLI). Seuls `crc32` et les en-têtes sont portables.
- **Points communs à traiter** :
  - `Date.parse` doit être fourni au bit près de V8 dans `ariane-js` : plusieurs lots en dépendent.
  - `gcv2-l1` et `recherche-large` lisent `Date.now` pour mesurer une durée : à passer en entrée.
  - `gcv2-l1` lit la variable de module `LEVIERS`.
  - `file-prioritaire.js` et `native-reconstruction.js` ne sont chargés ni par le manifeste ni par le service worker : seulement par les outils et les essais (ÉTABLI par grep).

## Lots proposés (portable non porté), numéros de fonction du cœur sans chevauchement
Blocs déjà pris : 0–49 chef, 50–99 D (dont J4, CH-068 : 61–65), 100–149 E ; 150–199 libre. Tailles ESTIMÉES ; la somme des lots égale le total « portable non porté ».

| bloc | crate proposée | contenu | lignes | octets | remarques |
|---|---|---|---:|---:|---|
| 200–249 | ariane-export | `native-export` (entier), `phase-pli` (entier), pures de `gcv1-export` (avec `exportedAt` en entrée) et d'`export-cache`, `crc32` | 922 | 55 486 | Sérialisation : ordre des clés et `String(nombre)` d'ariane-js ; voisin du `dataset` de E |
| 250–299 | ariane-session | pures de `native-session`, `part-summary-49` (entier), pures d'`historique-parties`, `native-reconstruction`, pures de `core` (`expectedPoses`, `pairCorpus`) et d'`esv-observer` (table observée) | 944 | 76 598 | `Date.parse` au bit près ; méthodes à `this` : l'enregistrement passe en entrée |
| 300–349 | ariane-file | `file-parties` (machine à états réductrice), `file-prioritaire`, `serie-captures-vides`, `raison-correction` | 590 | 49 673 | Déjà écrits « purs » ; la façade persiste l'état rendu |
| 350–399 | ariane-vue | `deplacement-vue`, pures de `gestes-vue` | 277 | 25 135 | Peu de calcul ; `Math.random` et l'émission restent en JS |
| 400–449 | ariane-lot (dépend d'ariane-decision) | restes de `lot-decision`, `regles-metier`, `gcv1-shadow` et `continuity-observer` listés ci-dessus, `brain.js` (entier), et `relectureCalculer` (`background.js` 3730–3763, seule pièce de décision du lot 500–549) | 562 + ≈ 34 | 40 066 + ≈ 3 500 | Modules de décision : garde GCV2, parités de la relecture et de L1se obligatoires ; de préférence à D après sa fusion |
| 450–499 | ariane-nuage (suite d'ariane-lidar et d'ariane-capture) | pures de `native-lidar`, `lod-signature`, `merge-clouds`, `profileLines`, `reportedBox` et `inRoi` de `vendor/lidar.js`, reste de `capture-core` | 285 | 18 401 | Périmètre nominal de L et du chef |
| 500–549 | ariane-rendu (optionnel) | modèles de vue de `signal-rendu` et `ui5`, pures de `panel.js`, `background.js` et `adapter-page.js` | 804 − ≈ 34 | 86 719 − ≈ 3 500 | Présentation et colle ; `background.js` et `adapter-page.js` sont interdits aux exécutants : la façade y serait posée par l'intégrateur |

Inventaire élargi à D-296 (tout ce qui peut passer en Rust, pas seulement le calcul pur) : `inventaire-d296.md`.

Hors lots : `gcv2-parametres-l1.js` (données, 36,5 Ko), à lire par J4. Ce n'est pas du calcul.
