# CH-059 — Un état sauvegardé à taille constante : rapport (06/11/2026)

## Ce qui est fait
1. **`src/etat-morceaux.js`** (nouveau, module pur) et **`src/storage.js`** : à l'écriture, les listes qui grossissent sont coupées en morceaux de taille fixe sous leurs propres clés de `chrome.storage.local`. Listes suivies : Écho `visits`, `cloudIds`, `observationPeriods`, `incomplete`, `qualityRails` (objet), `exportState.exportedCloudIds` et `releasedCloudIds` ; Correction `records`, `cloudIds`, `sequence` ; lot `processed`, `sequence`, `deferred`, `skipped`, `paused`, `interrupted`, `manuallyCompleted`. Seul un morceau **changé** est réécrit, dans **le même `set`** que l'état. À la lecture, `getState()` recolle les listes : l'état en mémoire est celui d'avant, le moteur, l'Écho, le panneau et les exports n'y voient rien. Pas de nouveau magasin IndexedDB : changer la version de la base casserait le retour arrière.
2. **`src/native-session.js`** : des ensembles sont tenus à côté de `cloudIds`, `exportedCloudIds` et `releasedCloudIds`, hors de l'état. Ils remplacent les `includes` faits à chaque ajout et la recherche de `exportAdvice`, qui était quadratique et que le panneau appelle à chaque rafraîchissement.
3. **Patch du moteur** `chantiers/CH-059/engine.patch` (voir `NOTE_INTEGRATEUR.md`) : `save()` passe l'état vivant au magasin qui copie lui-même (`copieALaSauvegarde`), au lieu d'en faire une copie entière. Il n'est pas appliqué, `src/engine.js` est intact.
4. `background.js` charge le module ; `tests/pose-lot-inchanges-4959.test.cjs` gagne une exception justifiée pour `src/storage.js` et `src/etat-morceaux.js`.

## Mesures
- **ÉTABLI, essai rouge puis vert** (`tests/ch059-etat-borne.test.cjs`). Journée Écho simulée : 3 parties, 240 visites, 4 captures par visite, vidages `-auto`. On mesure les octets écrits par sauvegarde :
  - sur le tronc : 13,9 Ko après 20 visites, puis **169,5 Ko** après 240 ;
  - sur la branche : **5,3 Ko** en début comme en fin de journée (300 visites : 5,3 Ko contre 208 Ko sur le tronc).
- **ÉTABLI, vrai Chromium 153** (`tools/ch059-banc-chromium.cjs`, vraie extension, vrai `chrome.storage.local`). État synthétique bâti sur la composition mesurée le 05/11 (1 152 visites, 7 340 nuages, listes d'export, lot) ; 25 sauvegardes, médianes de 3 passages :

| état en mémoire | tronc (copie + `set`) | morceaux, sans patch | morceaux + patch |
|---|---|---|---|
| début, 0,43 Mo | 11,4 à 12,8 ms | 7,2 à 8,4 ms | 6,4 à 6,9 ms |
| fin, 2,23 Mo | **144 à 154 ms** (max 396) | 16,8 à 19,7 ms | **7,7 à 8,1 ms** |

  - Avec le patch, une sauvegarde de fin de journée coûte autant qu'une sauvegarde du matin.
  - Sans le patch, la copie entière que fait le moteur garde un coût qui suit la taille de l'état en mémoire.
  - Il reste 381 Ko écrits. C'est le reste de l'état, borné, et ici en grande partie du remplissage synthétique.
- **ÉTABLI, rien n'est perdu** :
  - `tools/ch059-parite-export.cjs`, tronc contre branche, et contre la branche avec le patch : horloge et identifiants figés, 120 visites, 720 nuages, vidages `-auto`, redémarrage au milieu. Ce qui entre dans l'export Écho (zip et `-auto`) est **identique** : `dataset()`, manifeste, plan, conseil. L'état en mémoire l'est aussi.
  - `tools/parite-relecture-sw.cjs`, tronc contre branche patchée : relevés identiques.
  - Redémarrage du service worker en pleine Écho (essai) : l'état relu est égal à la mémoire, la session reprend et l'index des visites continue.
  - Maquette ESV : verte.
- **ÉTABLI, retour arrière** (`tools/ch059-retour-arriere.cjs`, vers l'arbre `2bc1f56`) :
  - l'ancien paquet relit l'état **sans planter**. Il voit des listes vides, comme `records` en D-089 ;
  - il reprend la session et ajoute 5 visites ;
  - à la remise à jour, les **95 visites** sont relues dans l'ordre, sans doublon de nuage, et l'export se fait.
  - Limite, SUPPOSÉ sans gravité : pendant le retour arrière, l'ancien paquet numérote ses visites à partir de 0. Il ne purge pas non plus les nuages d'avant s'il abandonne la session.

## Pas fait, et pourquoi
- **Regrouper les sauvegardes par cut** : une sauvegarde coûte maintenant environ 8 ms, état de fin de journée compris. Regrouper demanderait de changer l'ordre des écritures du moteur, qui sont faites avant chaque commande. Le gain n'est pas mesuré : il faut le nombre de sauvegardes par cut, que mesure CH-058.
- **`view()` du moteur** copie encore tout l'état pour le panneau à chaque rendu (`src/engine.js`). Ce n'est pas l'objet du ticket. À croiser avec la mémoire du panneau mesurée par CH-058 (835 Mo).
- **PROBABLE**, vu en node : le temps par visite monte encore un peu dans la journée, hors sauvegarde. Le profil montre des lectures et copies d'IndexedDB (`getRecord`, `all`), à confirmer par CH-058.

## Interdits respectés
- `src/engine.js` n'est pas touché ; son changement est livré en patch.
- Aucun fichier de décision ne change : le diff de `src/lot-decision.js`, `src/gcv2*.js` et `src/geometry*.js` est vide.
- Aucun nom, code projet ESV ni capture.
