# CH-064 — Inventaire D-296 : tout ce qui peut passer en Rust/WASM (06/11/2026)


Reproductible : `node tools/ch064-inventaire.cjs --d296` recalcule les totaux depuis `inventaire-d296.json` (part de chaque fichier par catégorie) et signale tout fichier dont la taille a changé depuis le relevé. Établi par analyse syntaxique puis lecture (même méthode que `inventaire-100.md`) ; parts des fichiers mixtes ESTIMÉES.
Critère (D-296, opérateur) : on compte tout ce qui peut techniquement passer en Rust/WASM dans une extension Chrome, y compris le parsing, la sérialisation, les index, la compression, les empreintes et les machines à états. Reste en JS seulement ce qui relève d'une de ces raisons : **API Chrome** (chrome.*, IndexedDB, chrome.storage), **DOM**, **page ESV** (objets Potree vivants, viewer, DOM d'ESV), **asynchrone ou orchestration** (await, files, minuteries, état de session réparti), **coût de traversée**.

## Ce qui change par rapport au premier inventaire
- Deviennent portables : la lecture de l'horloge (Date.now, new Date() passés en entrée), l'aléa (Math.random en entrée ou générateur Rust : octets différents), l'état de module d'un module de calcul (tenu dans le WASM), les constantes, les chaînes HTML, le format zip, la segmentation JSON, les aides pures du moteur gelé.
- Restent non portables : les minuteries, await et flux (Blob, CompressionStream lu par flux), les messages, chrome.*, IndexedDB, le DOM, la page ESV, l'état de session réparti (variables de module de background.js, panel.js, ui5.js, des cartes, de native-page, manual-page, liste-memoire, historique-parties, export-cache, perf-phase, storage, bridge).
- **Empreintes** : aucun SHA ni `crypto.subtle` dans le code exécuté (grep, ÉTABLI ; « sha256 » n'apparaît que comme donnée dans gcv2-parametres-l1.js). Les empreintes sont des hachages légers et synchrones : FNV-1a 32 bits (liste-memoire `empreinte`, lod-signature `empreinte`, boucle finale d'adapter-page `empreinteContrat`), cyrb53 (native-export `empreinte`), tirage `Math.imul` (adapter-page `lectureDuCut`). Portables au bit près (ariane-js a déjà `Math.imul`-équivalents à fournir), sans gain attendu.
- **Compression** : le dépôt ne contient aucun deflate ; zip-writer délègue à `CompressionStream('deflate-raw')` (ÉTABLI). Un deflate Rust est du code NEUF (0 ligne JS à porter) : l'archive resterait valide, mais les octets compressés ne seront pas forcément ceux de Chrome (zlib natif, réglages non exposés). En vitesse, CompressionStream est natif : aucun gain n'est attendu (SUPPOSÉ) ; l'apport serait un deflate synchrone. crc32 (boucle par octet, JS) est portable au bit près.
- **Coût de traversée** : seules les mesures faites sont citées. `capture.point` : 26 µs par appel en WASM contre moins de 0,1 µs en JS ; `calibrate` : 1,0 ms contre 0,5 ms en JS ; traversée JSON.parse 10,2 ms/Mo, JSON.stringify 11,9 ms/Mo, encodage VBA 8,0, décodage 11,5, cœur 2,5 ms/Mo (`chantiers/CH-064/etape-1-rapport.md`) ; CH-064-E : `construire` plus lent en WASM qu'en JS à cause de la traversée. Aucune de ces mesures ne rend une fonction techniquement impossible à porter : la colonne « coût de traversée » reste donc à 0, et la traversée sert à qualifier le gain (« sans gain attendu », « gain non établi »).
- **Gain** : aucune part non portée n'a de mesure qui promette un gain. « gain non établi » = travail proportionnel au volume traversé (native-export, merge-clouds, continuity-observer, brain, coverage de native-lidar) ; « sans gain attendu » = quelques µs par appel, ou sortie renvoyée au JS pour le DOM. Les deux comptent dans le portable D-296.

## Méthode
Même analyse que le premier inventaire (acorn, fonctions de premier niveau, marques propagées par appel), avec des marques séparées pour horloge, minuteries, Blob/flux, Potree/viewer. Ordre de priorité de la raison : page ESV (pour les scripts de la page : adapter-page, native-page, manual-page, esv-observer, early-input, vendor/lidar.js, native-lidar.js) > API Chrome > DOM > orchestration. Le reste d'un fichier (constantes, commentaires, enveloppe) va au portable si les fonctions portables font au moins la moitié des octets de fonctions, sinon à la raison dominante. Parts des équipes reprises du premier inventaire. Déplacements à la main : createZip vers le portable ; cœur de writeSegments (ESTIMÉ 40 l / 3 500 o) et blobJson vers le portable ; gcv2-parametres-l1.js en données. Tout chiffre de fichier mixte est ESTIMÉ.

## 1. Tableau révisé

| fichier | lignes | octets | statut | équipe | part portable D-296 non portée | raison / fonctions | raison du non-portable |
|---|---:|---:|---|---|---|---|---|
| background.js | 4596 | 504393 | non portable : API Chrome (mixte) | — | 331 l / 35925 o, sans gain attendu | Pures et colle (obsFields, relectureCalculer, avis*, reglage*), plus les fonctions qui ne lisent que l'horloge (Date.now en entrée). Toutes de quelques µs par appel. | API Chrome 3780 l / 415896 o ; asynchrone ou orchestration 485 l / 52572 o. API Chrome (chrome.storage 74 lectures, chrome.tabs) pour la masse appelante ; orchestration (files, minuteries, état de session : 25 variables de module). |
| panel.js | 1861 | 184160 | non portable : API Chrome (mixte) | — | 212 l / 19652 o, sans gain attendu | Pures (profilVoie, dessinerVoie, tempsParCut…), blobJson, cœur de writeSegments (découpe en segments, comptes d'octets : ESTIMÉ 40 l). JSON.stringify en Rust ne gagne rien : faire entrer l'objet coûte déjà 8,0 ms/Mo (VBA) + 2,5 (cœur) contre 11,9 ms/Mo pour JSON.stringify en JS (étape 1). | API Chrome 1301 l / 129759 o ; DOM 259 l / 26398 o ; asynchrone ou orchestration 89 l / 8351 o. API Chrome (chrome.runtime, chrome.downloads) ; DOM (render, render*, majX). |
| panel-lancement.js | 13 | 1220 | non portable : DOM | — | 0 |  | DOM 13 l / 1220 o. DOM. |
| vendor/capture-core.js | 155 | 7775 | portable D-296 non porté (mixte) | chef | 89 l / 5061 o, sans gain attendu | identity, distance, translation, compose, worldMatrix, rotation, railState, equalRails, serialRail, reference, attribute. Coût mesuré d'un appel fin : capture.point 26 µs en WASM contre moins de 0,1 µs en JS : à n'appeler qu'en lot, depuis Rust. | — |
| vendor/lidar.js | 315 | 21194 | non portable : page ESV (mixte) | L | 120 l / 7064 o, sans gain attendu | profileLines, reportedBox, inRoi ; inventory, clipSnapshot, boxVisible, cameraSnapshot, inspectNode ne lisent que leurs arguments (sans gain : ils lisent des objets de la page). | page ESV 161 l / 11930 o. page ESV : capture() hors boucle et diagnostic lisent Potree, viewer, document. |
| src/adapter-page.js | 1596 | 156653 | non portable : page ESV (mixte) | — | 58 l / 4915 o, sans gain attendu | refusalDetail, lectureDuCut (tirage par Math.imul), projectToView, niveauNoeud… (µs). | page ESV 1519 l / 150189 o ; asynchrone ou orchestration 19 l / 1549 o. page ESV (DOM d'ESV, Potree, viewer : capture, amenerVue, goToCut, validateInPlace, empreinteContrat) ; orchestration (sleep, waitFor). |
| src/appuis-liste.js | 114 | 8684 | en cours | J4 | 0 |  | — |
| src/brain.js | 152 | 8606 | portable D-296 non porté | — | 152 l / 8606 o, gain non établi | corrigerRail, corrigerPaire : calcul sur les propositions, volume d'entrée petit (SUPPOSÉ). | — |
| src/bridge.js | 178 | 17856 | non portable : DOM (mixte) | — | 10 l / 1147 o, sans gain attendu | reply, tooBig, obsCopy. | API Chrome 24 l / 2227 o ; DOM 128 l / 13093 o ; asynchrone ou orchestration 16 l / 1389 o. DOM (bandeau, pastille injectés) ; API Chrome (chrome.runtime) ; orchestration (relais). |
| src/carte-relecture.js | 71 | 8472 | non portable : DOM (mixte) | — | 7 l / 726 o, sans gain attendu | texteReglages. | API Chrome 10 l / 1440 o ; DOM 42 l / 5066 o ; asynchrone ou orchestration 12 l / 1240 o. DOM ; API Chrome ; orchestration. |
| src/continuity-observer.js | 214 | 15065 | portable D-296 non porté (mixte) | D (partie) | 194 l / 13675 o, gain non établi | Tout le reste : gatherInput, summarise, validated, selectAnchors, startRails, proposeFrom et observe (horloge passée en paramètre, déjà injectable). | — |
| src/core.js | 97 | 7700 | portable D-296 non porté | — | 97 l / 7700 o, sans gain attendu | pairCorpus, expectedPoses, identités, uid et reference (Math.random et Date.now à passer en entrée : octets différents pour uid). | orchestration : rien (uid/reference deviennent portables). |
| src/correction-liste.js | 273 | 25879 | en cours | E | 0 |  | Rien. Mesure de CH-064-E : construire est plus lent en WASM qu'en JS, à cause de la traversée. |
| src/deplacement-vue.js | 146 | 13389 | portable D-296 non porté (mixte) | — | 129 l / 12166 o, sans gain attendu | juger, detail*, sequence, resume. | asynchrone ou orchestration 17 l / 1223 o. orchestration : deplacer (async, émet les gestes). |
| src/early-input.js | 34 | 3015 | non portable : page ESV | — | 0 |  | page ESV 34 l / 3015 o. page ESV (écoute clavier dans la page). |
| src/engine.js | 1158 | 100007 | non portable : asynchrone ou orchestration (mixte) | — | 125 l / 9924 o, sans gain attendu | Aides pures (deferEligibility, closureSummary, expectedTransition, deferTransition…, ~125 l) si l'état this.* leur est passé ; fichier gelé, interdit aux exécutants. | asynchrone ou orchestration 1033 l / 90083 o. orchestration (classe async : init, run, analyze, defer*, validateAndNext…). |
| src/esv-observer.js | 394 | 33114 | non portable : page ESV (mixte) | — | 107 l / 7907 o, sans gain attendu | classify, listSummary, applyWrite, nearest, voisins, clés de table (URL à reproduire). | page ESV 287 l / 25207 o. page ESV : install 204–392 intercepte les requêtes de la page. |
| src/etat-morceaux.js | 105 | 9419 | en cours | E | 0 |  | — |
| src/export-cache.js | 251 | 19047 | portable D-296 non porté (mixte) | — | 185 l / 14903 o, sans gain attendu | refus, capturesAGarder, ficheDepart, texte, heureParis (Intl : fuseau Europe/Paris à reproduire). | asynchrone ou orchestration 66 l / 4144 o. orchestration et IndexedDB par storage.js (supprimer, lire, ecrire, lireDeparts, noterDepart). |
| src/faux-vert-ombre.js | 67 | 4508 | en cours | D | 0 |  | — |
| src/file-parties.js | 301 | 26309 | portable D-296 non porté | — | 301 l / 26309 o, sans gain attendu | Machine à états réductrice, entier. Une transition par événement : µs. | — |
| src/file-prioritaire.js | 100 | 7932 | portable D-296 non porté | — | 100 l / 7932 o, sans gain attendu | Entier (hors exécution : outils, essais). | — |
| src/garde-apres-differe.js | 60 | 5134 | en cours | D | 0 |  | — |
| src/garde-passe-appuis.js | 59 | 4856 | en cours | D | 0 |  | — |
| src/gauge.js | 112 | 7412 | porté | chef | 0 |  | — |
| src/gcv1-export.js | 279 | 16672 | portable D-296 non porté (mixte) | — | 265 l / 15802 o, sans gain attendu | deferralResult, runtimeResult, selectDeferOperation, linkedEvents, buildDiagnostic. | asynchrone ou orchestration 14 l / 870 o. orchestration : buildCorpusPlan (async getCloud). |
| src/gcv1-shadow-bootstrap.js | 6 | 393 | portable D-296 non porté | — | 6 l / 393 o, sans gain attendu | Une affectation (rien à porter de fait). | — |
| src/gcv1-shadow.js | 622 | 36984 | en cours (mixte) | D | 120 l / 8068 o, sans gain attendu | toRuntimeRails, compactRuntimeRails, configure/state/armOnce/disarm (état de module, tenable dans le WASM), proposeBoth (new Date en entrée). | — |
| src/gcv2-l1.js | 1028 | 97698 | en cours | J4 | 0 |  | — |
| src/gcv2-l1e.js | 84 | 6659 | en cours | J4 | 0 |  | — |
| src/gcv2-parametres-l1.js | 6 | 36547 | données (portables, à part) | J4 (lecture) | 0 | Données (coefficients figés, 36,5 Ko) : embarquables dans la crate J4. | — |
| src/geometry-brain.js | 100 | 5331 | portable D-296 non porté | — | 100 l / 5331 o, sans gain attendu | Enveloppe à état de module autour de brain.js (tenable dans le WASM). | — |
| src/geometry-candidate-v1.js | 264 | 16913 | porté | chef | 0 |  | — |
| src/geometry.js | 130 | 9925 | porté | chef | 0 |  | — |
| src/gestes-vue.js | 187 | 16150 | portable D-296 non porté (mixte) | — | 176 l / 15474 o, sans gain attendu | evenement, finir*, ecartCamera, approche, besoin, sequence* (Math.random : en entrée, ou générateur Rust, octets différents). | DOM 11 l / 676 o. DOM : construire, emettre (événements synthétiques). |
| src/hauteur-apprise.js | 109 | 7368 | en cours | D | 0 |  | — |
| src/historique-parties.js | 111 | 8539 | portable D-296 non porté (mixte) | — | 98 l / 7962 o, sans gain attendu | historique, ficheFin, ajouterFin, finDe, comptes. | asynchrone ou orchestration 13 l / 577 o. orchestration : lireFins, noterFin (stockage, variable file). |
| src/journal-index.js | 126 | 12692 | en cours (mixte) | E | 0 |  | asynchrone ou orchestration 37 l / 4000 o. orchestration : equiper (IndexedDB par magasin, async), lireCles. |
| src/level-crossing.js | 113 | 8184 | en cours | D | 0 |  | — |
| src/liste-memoire.js | 229 | 15974 | en cours (mixte) | E | 0 | Part pure couverte par E (heureCompacte et nomFichier compris). | API Chrome 27 l / 2163 o ; asynchrone ou orchestration 50 l / 3260 o. API Chrome (apresChargement) ; orchestration (file, lire, noterEcriture, demanderTable, resume, effacer, exportPanneau). |
| src/lod-signature.js | 61 | 3272 | portable D-296 non porté | — (périmètre nominal de L) | 61 l / 3272 o, sans gain attendu | signature, jeton, empreinte (FNV-1a 32 bits, BigInt). | — |
| src/lot-decision.js | 583 | 48040 | en cours (mixte) | D | 107 l / 8748 o, sans gain attendu | Mémoire des appuis, commandRails, activations (BananeSettings en entrée). | — |
| src/manual-page.js | 160 | 11950 | non portable : asynchrone ou orchestration (mixte) | — | 1 l / 147 o, sans gain attendu | constructeur. | asynchrone ou orchestration 159 l / 11803 o. orchestration (async, minuteries : start, tick, input, finish). |
| src/manual-session.js | 145 | 13607 | non portable : asynchrone ou orchestration (mixte) | — | 3 l / 208 o, sans gain attendu | running, active. | asynchrone ou orchestration 142 l / 13399 o. orchestration (session manuelle : handle, close, dataset async). |
| src/merge-clouds.js | 55 | 4704 | portable D-296 non porté | — (périmètre nominal de L) | 55 l / 4704 o, gain non établi | merge, compactNodes : copie de tableaux de points ; le passage des tampons coûte autant que la copie (SUPPOSÉ). | — |
| src/native-export.js | 387 | 20939 | portable D-296 non porté | — | 387 l / 20939 o, gain non établi | compact, expand, interner, fold/unfoldRefs, stripDerived, empreinte (cyrb53) : travail proportionnel au volume, comme la traversée (8,0 + 2,5 ms/Mo d'entrée mesurés) : gain non établi. | — |
| src/native-lidar.js | 414 | 36077 | non portable : page ESV (mixte) | — (périmètre nominal de L) | 102 l / 8165 o, gain non établi | coverageFrom, coverageAccumulator, rawRoiBounds, profileLines, matrixValid, uid (aléa en entrée). L'accumulateur par point ne gagne qu'appelé depuis la boucle Rust de L (capture.point : 26 µs par appel isolé). | page ESV 312 l / 27912 o. page ESV : capture 160–408, prepareNode, directReader, sourceUnchanged (nœuds Potree vivants). |
| src/native-page.js | 286 | 24195 | non portable : asynchrone ou orchestration (mixte) | — | 49 l / 4545 o, sans gain attendu | metricSnapshot, poseQualified, clés, quantile. | asynchrone ou orchestration 237 l / 19650 o. orchestration (file d'entrée, flush, minuteries) dans la page ESV. |
| src/native-reconstruction.js | 89 | 6872 | portable D-296 non porté | — | 89 l / 6872 o, sans gain attendu | Entier (hors exécution). | — |
| src/native-session.js | 995 | 101096 | non portable : asynchrone ou orchestration (mixte) | E (dataset) | 323 l / 30768 o, sans gain attendu | classify, chooseGeometry, health, accountQuality, referenceFromWrite, mergeMetrics, redactedEvent…, iso/failPeriod/newPeriod/establishBefore (horloge en entrée). | asynchrone ou orchestration 633 l / 65274 o. orchestration : handle 301–477, receive, observe*, start, close, ackExported, exportManifest/Plan (async, file de continuité, IndexedDB par storage.js). |
| src/part-summary-49.js | 259 | 18369 | portable D-296 non porté | — | 259 l / 18369 o, sans gain attendu | Entier. | — |
| src/perf-phase.js | 333 | 24791 | non portable : asynchrone ou orchestration (mixte) | — | 43 l / 3352 o, sans gain attendu | observeMethod, enqueue, utf8Size (TextEncoder : à reproduire), clés. | asynchrone ou orchestration 290 l / 21439 o. orchestration (enveloppe les méthodes du moteur, minuteries, état de module partagé). |
| src/phase-pli.js | 135 | 9726 | portable D-296 non porté | — | 135 l / 9726 o, sans gain attendu | Entier. | — |
| src/placement-convention.js | 134 | 9506 | porté | chef | 0 | Porté : mesure calibrate 1,0 ms en WASM contre 0,5 ms en JS (traversée). | — |
| src/raison-correction.js | 131 | 10657 | portable D-296 non porté | — | 131 l / 10657 o, sans gain attendu | Entier. | — |
| src/recherche-large.js | 209 | 19066 | en cours | J4 | 0 |  | — |
| src/regles-metier.js | 240 | 22137 | en cours (mixte) | D | 77 l / 6783 o, sans gain attendu | creerMemoire, evaluer, noter, lignes (Map/Set à encoder). | — |
| src/relecture-critere.js | 146 | 14097 | en cours | D | 0 |  | — |
| src/relecture-ombre.js | 231 | 23686 | en cours | D | 0 |  | — |
| src/relecture-pause.js | 49 | 5262 | non portable : DOM (mixte) | — | 2 l / 137 o, sans gain attendu | muet, pluriel. | API Chrome 10 l / 1129 o ; DOM 27 l / 2954 o ; asynchrone ou orchestration 10 l / 1042 o. DOM ; API Chrome ; orchestration. |
| src/relecture-signal.js | 51 | 5250 | en cours | D | 0 |  | — |
| src/serie-captures-vides.js | 58 | 4775 | portable D-296 non porté | — | 58 l / 4775 o, sans gain attendu | Entier. | — |
| src/settings.js | 614 | 67818 | portable D-296 non porté | — | 614 l / 67818 o, sans gain attendu | Constantes et describe : embarquables, mais lues partout en JS (chaque lecture traverserait). | — |
| src/signal-rendu.js | 776 | 96885 | portable D-296 non porté | — | 776 l / 96885 o, sans gain attendu | Entier : modèles de vue et chaînes HTML (*Html), allureLot (horloge en entrée). La chaîne rendue revient au JS pour le DOM. | — |
| src/storage.js | 81 | 7764 | non portable : API Chrome (mixte) | — | 2 l / 205 o, sans gain attendu | enFile, morceauxApi. | API Chrome 79 l / 7559 o. API Chrome (IndexedDB, chrome.storage). |
| src/ui5-variante.js | 4 | 389 | portable D-296 non porté | — | 4 l / 389 o, sans gain attendu | Une constante. | — |
| src/ui5.js | 583 | 53032 | non portable : API Chrome (mixte) | — | 147 l / 13357 o, sans gain attendu | correctionDuPanneau, fileDuPanneau, lignesEcho, departsFile, patchNoeud/morpher (diff d'arbres décrits en objets), calculSig. | API Chrome 397 l / 36998 o ; DOM 7 l / 394 o ; asynchrone ou orchestration 32 l / 2283 o. API Chrome (calculAr, instantane, agir…) ; DOM ; orchestration. |
| src/verts-a-controler.js | 173 | 15492 | en cours | E | 0 |  | — |
| src/voie-b1-ecart.js | 164 | 15147 | en cours | J4 | 0 |  | — |
| src/voie-recentree.js | 367 | 27944 | en cours | J4 | 0 |  | — |
| src/zip-writer.js | 208 | 10870 | portable D-296 non porté (mixte) | — | 104 l / 5484 o, sans gain attendu | createZip (format zip : en-têtes locaux, répertoire central), crc32 et sa table, dateDos, nomValide, coutEntree. Le deflate n'est pas dans le dépôt : un deflate Rust remplacerait CompressionStream('deflate-raw') par du code neuf (0 ligne JS à porter) ; archive valide, mais octets compressés pas forcément identiques à ceux de Chrome. Vitesse : CompressionStream est natif ; un gain n'est pas attendu (SUPPOSÉ), l'apport serait d'être synchrone. | asynchrone ou orchestration 104 l / 5386 o. orchestration : lire, preparer (flux Blob, async). |

## 2. Totaux D-296 (71 fichiers, 23937 lignes, 2231243 octets)

| catégorie | lignes | % lignes | octets | % octets |
|---|---:|---:|---:|---:|
| porté | 740 | 3.1 | 48670 | 2.2 |
| en cours | 4794 | 20.0 | 408320 | 18.3 |
| portable D-296 non porté | 6511 | 27.2 | 562947 | 25.2 |
| données (portables, à part) | 6 | 0.0 | 36547 | 1.6 |
| non portable : API Chrome | 5628 | 23.5 | 597171 | 26.8 |
| non portable : DOM | 487 | 2.0 | 49801 | 2.2 |
| non portable : page ESV | 2313 | 9.7 | 218253 | 9.8 |
| non portable : asynchrone ou orchestration | 3458 | 14.4 | 309534 | 13.9 |
| non portable : coût de traversée | 0 | 0.0 | 0 | 0.0 |

Lecture : la raison « API Chrome » l'emporte par priorité dès qu'une fonction appelle, même de loin, chrome.storage ; dans background.js et ui5.js, l'essentiel de ces lignes est aussi de l'orchestration (les deux raisons valent, la première est retenue). ESTIMÉ.

Dont, dans « portable D-296 non porté » : gain possible (SUPPOSÉ) 0 l / 0 o ; gain non établi 890 l / 56089 o ; sans gain attendu 5621 l / 506858 o.
Portable D-296 au total (porté + en cours + non porté + données) : 12051 l / 1056484 o, soit 47.3 % des octets ; déjà porté ou en cours : 43.3 % de ce portable.

## 3. Lots supplémentaires (blocs à partir de 550, par 50)
Écart D-296 par rapport au premier inventaire : +2 127 l / +210 869 o de portable non porté. Il est réparti ainsi (la somme égale l'écart ; crc32 et ses aides, 38 l / 1 614 o, quittent le lot 200 pour ariane-zip) :

| bloc | crate | contenu | lignes | octets | gain |
|---|---|---|---:|---:|---|
| 550–599 | ariane-zip | zip-writer : createZip (en-têtes locaux, répertoire central), crc32 + table, dateDos (UTC), nomValide, coutEntree ; deflate Rust NEUF à la place de CompressionStream (archive valide, octets compressés pas forcément identiques) | 104 | 5 484 | sans gain attendu en vitesse (SUPPOSÉ) ; apport : synchrone |
| 600–649 | ariane-json | panel.js : cœur de writeSegments (découpe en segments, comptes d'octets, en-tête replié : ESTIMÉ) et blobJson ; s'appuie sur native-export (lot 200) et sur String(nombre) d'ariane-js | 44 | 3 887 | sans gain attendu : entrer l'objet coûte 8,0 + 2,5 ms/Mo contre 11,9 ms/Mo pour JSON.stringify |
| 650–699 | ariane-empreinte | FNV-1a 32 bits, cyrb53, tirage Math.imul : fonctions communes appelées par les lots 100 (E), 200, 450 et la page. Octets déjà comptés dans ces lots ; à mettre plutôt dans ariane-js, sans numéro du cœur | (~30) | (~2 000) | sans gain attendu |
| 700–749 | ariane-reglages | settings.js (constantes, describe), ui5-variante.js, gcv1-shadow-bootstrap.js | 624 | 68 600 | sans gain attendu : lues partout en JS |
| 750–799 | ariane-html | signal-rendu.js entier hors modèles déjà au lot 500 (chaînes *Html, allureLot avec l'horloge en entrée), reste pur d'ui5.js (patchNoeud, morpher, calculSig) | 472 | 61 380 | sans gain attendu : la chaîne revient au JS pour le DOM |
| 800–849 | ariane-moteur-aides | engine.js : aides pures si l'état this.* leur est passé (deferEligibility, closureSummary, expectedTransition, deferTransition…). Fichier gelé, interdit aux exécutants : à décider par l'opérateur | 125 | 9 924 | sans gain attendu |
| 850–899 | ariane-colle | fonctions pures ou à horloge seule des fichiers d'orchestration : background.js, panel.js (hors ariane-json), adapter-page.js, bridge, carte-relecture, core (uid, reference), export-cache (Intl Europe/Paris à reproduire), gestes-vue (sequence*, aléa), manual-*, native-page, native-session (iso, périodes), perf-phase (utf8Size), relecture-pause, storage | 466 | 42 198 | sans gain attendu |
| extension de 400–449 | ariane-lot | gcv1-shadow (configure, state, armOnce, disarm, proposeBoth), continuity-observer (proposeFrom, observe), geometry-brain.js | 188 | 11 145 | sans gain attendu (gcv1-shadow, geometry-brain) ; non établi (continuity-observer) |
| extension de 450–499 | ariane-nuage | vendor/lidar.js (inventory, clipSnapshot, boxVisible, cameraSnapshot, inspectNode : lisent leurs arguments), native-lidar (uid, normalizeTermination) | 142 | 9 865 | sans gain attendu : ils lisent des objets Potree copiés pour l'occasion |

Remarque : une fois les lots 200–549 et 550–899 faits, il ne resterait en JS que les 1 174 759 o (1 175 Ko) classés non portables (API Chrome, DOM, page ESV, orchestration). La part portable D-296 dont un gain est démontré par une mesure reste le porté du chef et de L et les décisions de D (mesures de leurs bancs, hors de cet inventaire).
