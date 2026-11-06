# CH-059 — Un état sauvegardé à taille constante : rapport (06/11/2026)

## Ce qui est fait
1. **`src/etat-morceaux.js` (nouveau, module pur) et `src/storage.js`.** À l'écriture, les listes qui grossissent sont coupées en morceaux de taille fixe, rangés sous leurs propres clés de `chrome.storage.local`. Listes concernées :
   - Écho : `visits`, `cloudIds`, `observationPeriods`, `incomplete`, `qualityRails`, `exportState.exportedCloudIds` et `releasedCloudIds` ;
   - Correction : `records`, `cloudIds`, `sequence` ;
   - lot : `processed`, `sequence`, `deferred`, `skipped`, `paused`, `interrupted`, `manuallyCompleted`.

   Comment c'est écrit et relu :
   - Seul un morceau **changé** est réécrit, dans **le même `set`** que l'état qui le désigne.
   - Aucun morceau n'est retiré en cours de route. Ceux qui ne servent plus sont retirés **au démarrage**, avant que l'état ne serve. L'index `banane3MorceauxIndex` sert à les retrouver.
   - À la lecture, `getState()` recolle les listes. L'état en mémoire est celui d'avant : le moteur, l'Écho, le panneau et les exports ne voient aucune différence.
   - Pas de nouveau magasin IndexedDB : changer la version de la base casserait le retour arrière.
2. **`src/native-session.js`.** Des ensembles sont tenus à côté de `cloudIds`, `exportedCloudIds` et `releasedCloudIds`, hors de l'état. `exportAdvice` devient linéaire : avant, il croisait les deux listes avec `includes`.
3. **Patch du moteur** `chantiers/CH-059/engine.patch`, voir `NOTE_INTEGRATEUR.md`. `save()` passe l'état vivant au magasin, qui le copie lui-même avant toute attente ; plus de copie entière de l'état. Le patch n'est pas appliqué : `src/engine.js` est intact.
4. **Autres fichiers.** `background.js` charge le module. `tests/pose-lot-inchanges-4959.test.cjs` gagne une exception justifiée pour `src/storage.js` et `src/etat-morceaux.js`.

## Mesures
**ÉTABLI, essais rouges puis verts** (`tests/ch059-etat-borne.test.cjs`). On compte les octets écrits par sauvegarde.

| cas | tronc | branche |
|---|---|---|
| journée Écho de 240 visites, 3 parties, vidages `-auto` | 13,9 Ko après 20 visites, 169,5 Ko après 240 | 5,3 Ko |
| lot de 200 cuts après une Écho fermée de 120 visites | 86 à 119 Ko | moins de 20 Ko |

**ÉTABLI, vrai Chromium 153** (`tools/ch059-banc-chromium.cjs`, vraie extension).
- L'état est synthétique, sur la composition du 05/11 : 2,19 Mo dont `native` 1,65 Mo (visites 0,58, nuages 0,34, export 0,63, périodes 0,09) et lot 0,42 Mo. Le début de journée fait 0,19 Mo.
- Chiffres : médiane de `save()` sur 25 sauvegardes, plage sur 3 passages. Le coût par cut multiplie cette médiane par les sauvegardes par cut mesurées par CH-058 : 7,3 par visite Écho, 8,3 par cut de lot.

| moment | tronc | morceaux sans patch | morceaux + patch |
|---|---|---|---|
| début de journée | 7,0 à 7,7 ms (51 à 64 ms par cut) | 3,7 à 4,9 ms | 3,4 à 4,0 ms (25 à 33 ms par cut) |
| fin de journée | **146 à 164 ms (1,06 à 1,36 s par cut)** | 16,7 à 17,7 ms (122 à 147 ms par cut) | **6,2 à 7,0 ms (45 à 58 ms par cut)** |

- Avec le patch, une sauvegarde de fin de journée coûte deux fois celle du matin, contre vingt fois sur le tronc.
- Écrit à chaque sauvegarde : 159 Ko d'état (dont environ 130 Ko de remplissage synthétique), plus 27 Ko de morceaux changés.

**ÉTABLI, écriture atomique.** Essai d'arrêt du service worker après 1, 4, …, 40 écritures, avec des lots remplacés en route. L'état relu est toujours **exactement le dernier écrit**, sans morceau absent ni périmé. L'arrêt *pendant* un `set` repose sur l'atomicité de `chrome.storage.local.set` : PROBABLE, non mesuré ici.

**ÉTABLI, rien n'est perdu.**
- Export Écho : `tools/ch059-parite-export.cjs` compare le tronc à la branche, puis à la branche avec le patch. Horloge et identifiants figés, 120 visites, 720 nuages, redémarrage au milieu. Ce que reçoit le zip est identique : `dataset()`, manifeste, plan `-auto`, conseil, et l'état en mémoire.
- Relecture : `tools/parite-relecture-sw.cjs`, relevés identiques.
- Redémarrage en pleine Écho : la session reprend, l'index des visites continue.
- Maquette ESV : verte.
- `exportAdvice` : même résultat qu'avant à 20 000 identifiants, en temps linéaire.

**ÉTABLI, retour arrière en pleine Écho vers l'arbre `2bc1f56`** (`tools/ch059-retour-arriere.cjs`). Session de 100 visites, 600 nuages, dont 60 en attente.
- Sans parade, l'ancien paquet relisait `cloudIds` vide. Son vidage automatique comme son export final n'emportaient **aucun des 60 nuages en attente, sans le dire** : c'est une perte dans le zip, pas dans IndexedDB.
- **Parade appliquée** : les nuages pas encore exportés restent aussi écrits en ligne. Leur nombre est borné par le seuil de vidage. Mesuré : l'ancien paquet exporte alors 60 nuages, comme la branche, et les 100 visites d'IndexedDB.
- Écarts qui restent dans un export fait par l'ancien paquet :
  - le résumé `session.visits` est vide ;
  - `declaredCloudIds` ne liste que les 60 nuages en attente, contre 600 sur la branche. La fusion des segments contrôle l'union des listes déclarées, et les segments antérieurs déclarent les leurs : SUPPOSÉ sans perte.
- L'ancien paquet numérote aussi ses nouvelles visites à partir de 0.
- À la remise à jour, les 105 visites sont relues dans l'ordre, sans nuage en double.

## Pas fait, et pourquoi
- **Regrouper les sauvegardes par cut.** Il faudrait changer l'ordre des écritures du moteur, qui sont faites avant chaque commande. Le gain qui reste est d'environ 50 ms par cut en fin de journée.
- **`view()` du moteur** copie encore tout l'état pour le panneau (`src/engine.js`). À croiser avec l'aller-retour de vue mesuré par CH-058 (117 ms).
- **Relecture complète d'IndexedDB** (export, liste des corrections) : confiée à CH-058. Les lectures d'événements et de visites ne sont pas touchées ici.

## Interdits respectés
- `src/engine.js` n'est pas touché ; son changement est livré en patch.
- Le diff des fichiers de décision est vide : `src/lot-decision.js`, `src/gcv2*.js`, `src/geometry*.js`, `src/adapter-page.js`, `manifest.json`.
- Aucun nom, code projet ESV ni capture.
