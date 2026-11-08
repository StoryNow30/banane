# Architecture cible d'Ariane (D-299, D-300) — cadrage du 07/11

Fiche de référence pour tout chantier d'architecture après « Vision ». Elle décrit ce qui existe (relevé dans le code du tronc, `0719e40`), la cible, les règles de décision et l'ordre. Les décisions de l'opérateur priment (`DECISIONS.md`) ; cette fiche ne dégèle rien (D-293 tient).

## 1. Ce qui existe : trois lieux d'exécution

| Lieu | Ce qui y tourne (fichiers principaux) | Remarque |
|---|---|---|
| **Page d'ESV** (monde principal, injecté par `background.js`, `PAGE_FILES`) | adaptateur `src/adapter-page.js` ; lecture LiDAR `vendor/lidar.js` (gelé), `vendor/lidar-rust.js` + `vendor/ariane-lidar*.js` + `src/lidar-rust.js` (Rust, « Vision ») ; `src/native-lidar.js`, `src/merge-clouds.js`, `src/native-page.js`, `src/gestes-vue.js`, `src/deplacement-vue.js` | Les nuages appartiennent à ESV ; Ariane les lit ici. Pas d'isolement d'origine : pas de mémoire partagée. |
| **Service worker** (`background.js`, `importScripts`) | pilote du lot (`engine.js`, `file-parties.js`), géométrie et décision (`geometry.js` gelé, `geometry-candidate-v1.js`, `geometry-brain.js`, `gauge.js`, `lot-decision.js`, `gcv2-*.js`, `voie-*.js`, `recherche-large.js`, `regles-metier.js`, relectures et gardes), stockage et journal (`storage.js`, `journal-index.js`, `etat-morceaux.js`), sessions et exports (`native-session.js`, `export-cache.js`, `historique-parties.js`) | Le calcul de pose tourne ici, loin des points : chaque capture traverse de la page au service worker. Du WASM ici exige `'wasm-unsafe-eval'` dans `manifest.json` (accord écrit, D-296). Chrome peut arrêter le service worker au repos. |
| **Panneau** (`panel.html`, `src/ui5.js`) | commandes, progression, réglages, journal | Parle au service worker par messages. |

Rust : espace `ariane-rs/` (branche `chantier/CH-064`), un cœur WASM aiguillé par blocs de numéros. Dans le paquet : seule la lecture LiDAR (`ariane-lidar`), avec repli sur `vendor/lidar.js` et l'événement de journal `rust`.

## 2. Mesures qui fondent le cadrage
- Le Rust fait gagner environ −49 ms par cut au banc (PROBABLE par cut). Sur des coupes réelles rejouées en maquette, la lecture passe de 1,80 à 1,75 s (ÉTABLI, petit échantillon) : une lecture est surtout de l'attente.
- Le nettoyage du JavaScript a fait gagner environ −970 ms par cut (ÉTABLI au banc).
- Des fonctions portées perdent en WASM une fois les échanges comptés, de 4 à 100 fois (CH-069, CH-070, ÉTABLI au banc). La représentation décodée pèse environ 15 fois la trame (CH-069).
- Pauses fixes de la lecture « référence » : environ 306 s par journée le 05/11 (ÉTABLI ; fichiers gelés, D-293).

## 3. Cible : cinq blocs, deux langages
| Bloc | Rôle | Langage |
|---|---|---|
| Panneau | commandes, progression, réglages, journal | HTML/CSS + JS typé progressivement |
| Pilote | seul responsable de l'enchaînement : étapes, pause, reprise, annulation | JS typé |
| Adaptateur ESV | lire la bonne coupe, observer sa disponibilité, appliquer et vérifier la pose | JS typé |
| Moteur de calcul | des points aux candidats rails et à leurs scores | JS ou Rust/WASM, selon la mesure |
| Sessions et mesures | résultats, durées, reprise | JS typé |

JavaScript orchestre ; Rust calcule là où il gagne (D-300) : un **traitement complet par appel** (recevoir les points, préparer les structures, calculer, rendre les candidats), jamais une suite de petits appels.

## 4. Règles d'architecture
1. **Un seul pilote** décide de l'action suivante ; aucun autre module n'enchaîne d'action vers ESV.
2. **Chaque échange porte l'identité** (partie, coupe) et un **identifiant d'opération** ; un résultat dont l'identité ou l'opération n'est plus active est rejeté, jamais appliqué.
3. **États observés, pas pauses fixes.** Pour chaque étape, écrire : ce qui prouve qu'elle est finie (bonne coupe ET bonne opération, pas seulement « des rails sont là »), le délai maximal, et l'arrêt explicite (pause motivée) si la preuve n'arrive pas. Ariane n'envoie jamais SKIP et ne valide jamais un cut non résolu.
4. **Conventions communes, pas interface unique** : mêmes types d'unités (m, mm), de repères (scène, monde), d'identifiants, d'erreurs et d'annulation ; chaque calcul garde les entrées et sorties qui lui conviennent.
5. **Données près du calcul** : une copie au plus entre le lieu des points et le moteur ; pas de décodage en représentation lourde ; réutiliser les structures tant que les points et les paramètres n'ont pas changé.
6. **Moteur interchangeable** : chaque calcul porté a une implémentation JS de référence, un réglage pour choisir, un repli automatique et une parité au bit près.
7. **Preuve sur le parcours complet** : un changement entre dans un paquet s'il gagne sur le lot entier (durée, fluidité, mémoire) à poses identiques ; un gain local qui se perd dans les échanges ne compte pas.

## 5. Règle d'entrée du Rust (« gain seulement »)
Un calcul passe en Rust si, mesuré au banc puis sur le parcours : (a) parité au bit près sur le corpus réel, Node et Chromium ; (b) gain net, échanges et initialisation compris ; (c) haute eau sous le plafond de 256 Mio sur les plus grosses entrées réelles ; (d) un appel par traitement complet. Sinon il reste en JS, chiffres au rapport. Le Rust existant qui gagne reste ; on n'ouvre plus de portage fonction par fonction.

## 6. Ordre (D-299)
1. **Typage limité** (CH-075) : un module, types distincts unités/repères/identifiants, sans changer le code exécuté.
2. **Mesure d'une journée réelle avec « Vision »** : durée par étape (navigation, chargement d'ESV, attentes d'Ariane, lecture, calcul, pose, validation), profil de performance de Chrome ciblé, mémoire par processus.
3. **Attentes** : remplacer les pauses fixes que la mesure désigne, selon la règle 4.3, après décision écrite sur les fichiers gelés.
4. **Lieu du moteur** : si la mesure le justifie (fluidité, réutilisation, débit), essayer un moteur hors du service worker, par exemple un document hors écran de l'extension ou un Worker, avec transfert des tampons dont Ariane est propriétaire (jamais ceux d'ESV). À comparer au coût du trajet page → moteur.

## 7. Pistes écartées dans les contraintes actuelles
Réécriture générale ; moteur natif hors du navigateur ; calcul sur carte graphique (pas de double précision : parité au bit près impossible) ; serveur distant (données terrain hors du dépôt `banane-data` interdites) ; anticipation de la coupe suivante tant qu'ESV n'offre pas de signal fiable de changement de coupe. À rouvrir si une contrainte change. Question pour l'opérateur : une API officielle d'ESV existe-t-elle ?

## 8. Questions ouvertes, à trancher par la mesure
- Où va le temps d'une coupe sur le vrai ESV : attente d'ESV, attentes d'Ariane, calcul ? (étape 2)
- Combien coûte le trajet d'une capture de la page au service worker, en temps et en mémoire ?
- Le service worker est-il le bon lieu pour le moteur, ou faut-il rapprocher le calcul des points ?
