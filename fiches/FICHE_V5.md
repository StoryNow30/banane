# Fiche de reprise : V5, stockage incrémental (13 octobre 2026)

**But.** Supprimer la dérive de vitesse au fil d'un lot. Cahier § 6 V5 : chantier conditionnel, lancé seulement si V1 montre une dérive sur un long lot ; seuil et longueur
du « long lot » à fixer par l'opérateur. Minimum de sortie : pas de perte de données (classe KI-064), lecture des anciens formats, décisions identiques.

**La mesure (D-087, exports reçus, sans agent).** Lots d'au moins 150 cuts, médianes par tiers du lot (1er / 2e / 3e) :

| Lot | Cycle | Analyse | Décision | Pose | Validation | Non expliqué | Capture (page) |
|---|---|---|---|---|---|---|---|
| 4.9.0.4, 299 cuts | 6,3 / 6,9 / 8,2 s | 0,34 / 0,61 / 1,01 s | 47 / 107 / 179 ms | 0,88 / 1,16 / 1,52 s | 0,34 / 0,78 / 1,32 s | 79 / 196 / 329 ms | 4,79 / 4,70 / 4,73 s |
| 4.9.0.3, 190 cuts | 7,0 / 8,2 / 9,6 s | 0,96 / 1,12 / 1,57 s | 97 / 143 / 210 ms | 0,99 / 1,30 / 1,58 s | 0,49 / 0,98 / 1,34 s | 126 / 232 / 341 ms | 4,34 / 4,92 / 5,18 s |
| 4.9.0.2, 154 cuts | 7,1 / 7,4 / 7,6 s | 1,17 / 1,13 / 1,12 s | 54 / 88 / 123 ms | 0,80 / 1,00 / 1,17 s | 0,21 / 0,50 / 0,72 s | 60 / 140 / 188 ms | 4,65 / 4,57 / 4,47 s |

La dérive est d'abord dans le **service worker** (analyse, décision, pose, validation : dans les trois lots) ; la capture, dans la page ESV, ne dérive pas dans deux lots sur trois
(+0,8 s dans le lot 4.9.0.3, cause non établie). Du 1er au 3e tiers : +30 % et +38 % sur le cycle des deux plus longs lots.

**Cause probable (lecture du code, à démontrer par un essai rouge).** `src/engine.js:105` `save()` écrit **tout** l'état (`K.clone(this.s)` puis `chrome.storage.local.set`), et
`event()` (`src/engine.js:106-115`) l'appelle **à chaque événement** (environ 30 par cut : étapes de capture, observations d'ESV, résultats). Or l'état garde **tous les enregistrements
depuis le dernier vidage** (`s.records`, environ 3,8 Ko chacun, déjà écrits aussi dans IndexedDB par `putRecord`), plus `s.batch` (226 Ko en fin de lot) et les 150 derniers
événements (154 Ko). Mesure locale (Node) : 0,39 Mo et 7 ms par sauvegarde au départ, 2,0 Mo et 30 ms avec 432 enregistrements, hors écriture `chrome.storage`. Coût total
quadratique ; il continue d'un lot à l'autre tant que le cache n'est pas vidé.

**Options (une seule par version de test).**
1. **V5a, faible risque** : les événements d'information (`adapter-progress`, `esv-observation`, `esv-releve`) ne déclenchent plus `save()` ; ils sont déjà écrits dans IndexedDB
   (`putEvent`). Environ 60 % des sauvegardes en moins ; la taille par sauvegarde grandit toujours.
2. **V5b, risque de perte à maîtriser** : `s.records` et `s.incomplete` sortent de l'état (IndexedDB seul, compteurs et identifiants dans l'état) ; `s.batch.processed` borné. Taille
   de l'état constante. Tous les lecteurs de `s.records` (exports, bilan, panneau, reprise) lisent IndexedDB.
3. Les deux, dans cet ordre, en deux versions.

**Décisions de l'opérateur.** (1) Seuil de dérive : proposé **+10 % du 1er au 3e tiers sur un lot d'au moins 150 cuts** ; mesuré +30 % et +38 % : V5 est déclenché. (2) Lancer la
conception de V5 maintenant (pendant la séance test 6), pour une version 4.9.0.7 après la mesure de la 4.9.0.6.

**À ne pas relire.** Les rapports de missions A à G, `verification.txt`, les exports déjà analysés (chiffres ci-dessus).

**Modèle et effort.** Conception et code : niveau fort, élevé ; essais rouges d'abord (dérive reproduite sur un lot simulé de 400 cuts : temps de `save()` par rang de cut) ; une relecture
niveau fort du diff (le code touche l'enregistrement) ; aucun autre agent.
