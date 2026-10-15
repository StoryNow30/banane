# Fiche B1 + 398/402 — voisins validés lus dans la liste des coupes d'ESV (D-095, 13 octobre 2026)

Statut : **accord de Mic reçu le 13 octobre 2026** pour lire, en lecture seule, les bords et le statut des cuts voisins dans la liste des coupes qu'ESV charge au démarrage
(« complètement ok »), avec les pleins pouvoirs de décision de l'orchestrateur jusqu'à la livraison de la 4.9. Branche de travail : `claude/49-test-11` (depuis `claude/49-test-10`).

## But
Alimenter `decideCut({validated})` (`src/lot-decision.js` : `consistentValidated`, D-054 : ±5 cuts, 8 mm, au moins 3 voisins cohérents, jamais une cible d'écartement) avec des voisins
validés par l'opérateur, en dernier recours et comme garde de continuité au premier passage. Cas visés : 398 et 402 de la partie 20, posés à tort sous la 4.8.6 (159,9 et 273 mm, 0 appui) ;
cuts différés « sans appui ». Porte du cahier : sur une partie neuve, C1 en hausse, 0 faux ajouté ; deux rails ou rien.
Aujourd'hui `background.js` (~ligne 816) appelle `L.decideCut({capture:…})` SANS `validated` : rien ne l'alimente.

## Constats établis par l'orchestrateur (13 octobre, sur des données réelles)
1. **Source** : la liste d'une partie est un GET `…/rails/<table>` paginé (1 000 lignes par page), que `src/esv-observer.js` (monde PRINCIPAL, `document_start`) intercepte déjà
   pour compter (`listSummary`). Chaque ligne porte : `RowKey`, `PK`, `ExtractionStatus` (`valid`/`invalid`/`skipped`), `TreatedByOperator`, `SeenByOperator`, `Success*`,
   `XLeftEdge`, `YLeftEdge`, `ZLeftEdge`, `XRightEdge`, `YRightEdge`, `ZRightEdge` (coordonnées MONDE, en mètres), `RailSpacing`, `TrajAzimuth`, etc. Exemple réel :
   `private` — `scratchpad/missions/B_ESV/banc/originaux/DONNEES/PROJET_GET.har` (11 pages de 1 000 lignes ; ne JAMAIS recopier d'identifiant de projet ni de table dans le dépôt).
2. **Repère** : les coordonnées d'Ariane sont « scene-relative » (translation absolue omise, `coordinateSystem` des captures). Mesuré sur un lot réel de 125 cuts validés : le corps
   de l'écriture de validation d'ESV (PUT `…/rails/<table>/<id>`, que l'observateur relève : `esv-observation` `kind:'write'`, `body.XLeftEdge…`) moins la position corrigée d'Ariane
   (`records[].rails.*.corrected.positionSceneRelative`) donne une **translation constante** (même valeur à 1 mm près sur les cuts bien appariés, aucune rotation) : monde = scène + T.
   Script de mesure : `/tmp/claude-0/-home-user/cc0e4631-960e-5f55-b126-e7123e84b5ca/scratchpad/lot14/offset.cjs <repo> <export décompressé>` (export du lot 14h : `scratchpad/lot14/s`). T est constante par page (`sceneFrameId`). Elle se calibre donc à la première validation de la séance.
3. **Appariement cut ↔ ligne** : NON établi. Ne pas supposer que le numéro de cut d'ESV est l'indice de la ligne. À instruire et à PROUVER (voir étape 2).
   > Note du 15 octobre 2026 : Dépassé : les b1-ombre des quatre lots 4.9 (tests 15 à 17) donnent geoMm = 0,0 mm sur 100 % des cuts : la ligne N de la liste porte la pose de départ du cut N (D-115).
4. **Fraîcheur** : la copie de la liste lue au chargement ne voit pas les validations faites pendant la séance (celles d'Ariane sont déjà connues du moteur comme appuis posés ;
   `promoteAnchors`).

## Étapes (mode OMBRE d'abord : aucune pose ne change dans la version livrée à Mic)
1. **Observateur** (`src/esv-observer.js`) : à la lecture d'une page de liste, garder EN MÉMOIRE de la page (jamais postée en bloc, jamais stockée, jamais d'URL) une table compacte
   par partie : clé de ligne, ordre, statut, drapeaux opérateur, bords gauche/droit (monde). Les messages du pont et l'export n'en reçoivent que des résumés. Mémoire bornée.
   Aucune requête émise, aucun en-tête lu, aucun original modifié (contrat du fichier inchangé).
2. **Appariement et repère** : retrouver la ligne du cut courant par la géométrie (position initiale de ses rails dans la scène + T contre les bords des lignes) et/ou par l'indice,
   et mesurer sur le banc et sur les lots l'accord des deux méthodes. T est calibrée par la première écriture de validation de la séance (observateur : `write`) ; sans T :
   aucun voisin.
3. **Appuis** : pour le cut courant, les voisins ±`validatedWindow` dont le statut est validé par un opérateur (`TreatedByOperator`/`ExtractionStatus` à définir par les données),
   convertis en scène (− T), au format `{identity:{part,cut,frameId}, positions:{left:[x,y,z], right:[x,y,z]}}` attendu par `consistentValidated`.
4. **Ombre** : à chaque décision, calculer `decideCut` AVEC `validated` en plus de la décision réelle, et consigner un événement `b1-ombre` (cut, voisins candidats / gardés, étape et
   position hypothétiques, écart à la pose réelle en mm, sans position absolue). La pose réelle reste celle d'aujourd'hui. Un réglage (`settings.js`) `appuisListe: 'ombre'|'actif'|'off'`,
   livré à `'ombre'`.
5. **Rejeu hors ligne** : 398 et 402, et les lots disponibles (voir `PILOTAGE_REPRISE.md` § 8, exports reçus), pour compter justes perdus / faux ajoutés avant tout passage à `'actif'`.
6. **Essais** : unitaires (table, appariement, repère, format des appuis), service worker réel (VM), banc ESV local si utile ; `node tools/verify.cjs` à zéro échec.

## Règles à respecter
- `src/engine.js`, `src/geometry.js`, `vendor/capture-core.js`, `vendor/lidar.js` : **gelés** (baseline `audit/v4.6.0-engine-baseline.json`). Ne pas les modifier.
- Aucun identifiant de projet ESV (motif six chiffres, souligné, six chiffres, souligné, une lettre, souligné) dans le dépôt, les consignes ou les sorties. Données d'export privées, dans le scratchpad.
- Aucun nom de modèle dans les commits. Pied de commit : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` et `Claude-Session: https://claude.ai/code/session_01RpfEZY6gJiLAEGcHEiExbv`.
- Pas de PR, pas de fusion, pas d'étiquette.
