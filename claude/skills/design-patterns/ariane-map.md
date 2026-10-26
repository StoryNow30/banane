# Patrons dans Ariane

Lu dans le code le 19/10/2026 (branche `claude/design-patterns-ariane-69osmz`). Seuls `src/core.js`, `src/brain.js`, `src/storage.js`, `src/bridge.js`, `src/geometry-candidate-v1.js` (en-tête), `manifest.json`, `README.md` et les statuts de `src/manual-session.js` / `src/native-session.js` ont été lus. Les lignes « À vérifier » sont des pistes, pas des constats.

**Corrigé le 19/10/2026 (session UI 5.0, branche `claude/50-ui-5.0`, code de la 4.9.5 test 9)** : le panneau (`panel.html`, `panel.js`, `src/carte-relecture.js`, `src/raison-correction.js`) et le répartiteur de `background.js` ont été lus ; les corrections sont marquées « Corrigé » plus bas, et le panneau a sa propre section.

## Contraintes

- **Gelés :** `src/geometry.js` et `src/geometry-candidate-v1.js` (empreintes vérifiées, README) ; `src/engine.js` (« gelé », commentaire de `src/brain.js`). Ne pas les modifier : un patron se pose autour, comme `brain.js` post-traite le moteur. **Corrigé** : depuis D-217 (19/10/2026) le gel de `src/engine.js` et de `src/lot-decision.js` est levé pour le chemin du lot sur les portions de test, sous banc de rejeu ; la géométrie reste gelée. Lire D-217 avant de refuser un refactor de ces deux fichiers ; un refactor ne change toujours aucune sortie.
- **Pas de build ni de dépendance :** modules UMD `(function(root,factory){…})`, JS sans compilation, chargé tel quel dans Edge.
- **Vérification :** `node tools/verify.cjs` (Node 22+). Les tests sont dans `tests/*.test.cjs`.
- **Message `chrome.runtime` :** 64 Mo maximum (voir budget dans `src/bridge.js`).

## Déjà en place (à conserver comme référence de style)

| Patron | Où | Constat |
|---|---|---|
| Facade | `src/storage.js` (`BananeStorage3`) | Une API pour IndexedDB (clouds/events/records) et `chrome.storage.local` |
| Proxy (distant) + Command | `src/bridge.js` | Relais page ↔ service worker ; liste blanche d'actions `allowed`, `pending` avec délai, réponse bornée |
| Observer + file bornée | `src/bridge.js` (`relayObservation`, `obsFlush`) | Relais de l'observateur ESV, file de 100 entrées, trous signalés par un jalon `gap` |
| Strategy (par fonction) | `src/brain.js` (`DEFAULTS`, `corrigerPaire`) | Paramètres figés + journal par rail ; abstention plutôt que choix |
| Chain of Responsibility (implicite) | `corrigerRail` dans `src/brain.js` | Gardes successives : biais → ambiguïté → candidats → dévers → plausibilité ; chacune peut s'abstenir |
| Memento (implicite) | `reference`, `expectedPoses` dans `src/core.js` | Poses avant/après conservées ; « Revenir aux positions initiales » du mode assisté |
| Prototype (simple) | `clone` dans `src/core.js` | Copie profonde par JSON |
| Flyweight (de fait) | nuages stockés une fois, référencés par `lidarCaptureId` | État volumineux partagé par identifiant |

## Pistes d'application (à vérifier avant d'agir)

| Symptôme probable | Patron | Fichier à ouvrir | Prudence |
|---|---|---|---|
| **Corrigé** : 70 tests `if(action===…)` à la suite dans `dispatch` (`background.js:2513` à `:2735`, fichier de 2 735 lignes) et 17 `kind===` ; pas « ~50 » | table `{action: handler}` (Command léger) | `background.js` | Garder l'ordre des gardes (`await ready`, vérification de l'expéditeur, `background.js:2729`). Ne pas confondre avec la liste blanche `allowed` de `src/bridge.js`, qui est celle des commandes envoyées à la PAGE ESV |
| `manual-session.js` et `native-session.js` gèrent chacun statuts, pause, reprise, fin avec des chaînes (`STARTING`, `RUNNING`, `PAUSED`, `INTERRUPTED_RECOVERED`) | table de transitions (State léger) ou cycle de vie commun (Template Method) | les deux fichiers | Ne pas fusionner leurs provenances (`explicit-manual-session` ≠ `native-passive-observation`) |
| Politique d'un lot « figée à la création » (continuer/différer ou pause) | Strategy résolue à la création, jamais modifiée après | `src/engine.js` (gelé) | Lire seulement ; si modification nécessaire, demander |
| Gardes d'écartement, de confiance et de paire dans `src/gauge.js` et le moteur | Chain of Responsibility explicite | `src/gauge.js` | Chaque garde garde son test dédié (`tests/gauge-*.test.cjs`) |
| Exports (diagnostic GCV1, natif, manuel, zip) construits pas à pas | ~~Builder~~ **Corrigé : non confirmé dans le panneau.** `exportToutZip` (`panel.js:1558`) enchaîne quatre exports derrière un assistant `volumesZip` ; aucune étape optionnelle à 8 paramètres. Règle du skill « moins de 3 variantes : garder le `if` ». Piste non retenue | `src/gcv1-export.js`, `src/native-export.js`, `src/export-cache.js`, `panel.js` | Les manifestes portent SHA-256 : aucune sortie ne doit changer |
| Adaptation d'ESV (API de la page) | Adapter / Facade | `src/adapter-page.js` | Aucune API serveur supposée (README) |

## Panneau (lu le 19/10/2026, 4.9.5 test 9)

| Symptôme constaté | Patron | Où | Prudence |
|---|---|---|---|
| `render(s)` fait 292 lignes (`panel.js:561` à `:852`) et commence par `if(which==='native')` (`:573`) puis `else if(which==='automatic')` (`:603`) ; 13 états de lot (`NOMS_ETAT`, `panel.js:413`) décident chacun d'un jeu de boutons | **State en table** : `état → {phrase, action principale, autres}`, fonction pure, sans classe | futur `src/panel-etat.js` (nouveau panneau) | Table + une fonction `ecranDe(s)` testable sans navigateur ; le vieux `render` n'est pas refactoré (il reste le panneau « ancien ») |
| Quatre cartes de choix (clic, grappe, relecture, raison) refont chacune le même cycle : valeur gardée dans le navigateur, lue au démarrage, figée dans le lot, affichée « Dernier lot / Prochain lot » (`majChoixLot`, `changerChoixLot`, `changerChoixRaison`, `src/carte-relecture.js`) | **Command en table** : un profil = une liste d'appels `api(action, args)` existants | futur `src/panel-profils.js` | Le profil n'ajoute AUCUNE action au service worker ; un essai compare la liste des appels à ceux de l'ancien panneau |
| `src/carte-relecture.js` rafraîchit seule, par un minuteur de 1 à 4 secondes, en parallèle du `refresh()` du panneau | rien à faire | `src/carte-relecture.js` | Deux boucles de lecture sur le même état ; le nouveau panneau n'en ajoute pas une troisième (il lit `view` et `relecture-etat`) |
| Les exports vivent dans la fermeture de `panel.js` (`exportToutZip`, `exportComplet`, `saveBlob`…) | **Facade** : exposer deux fonctions sans changer leur comportement | fin de `panel.js` | Octets identiques : un essai exécute le même export par l'ancien et le nouveau chemin et compare les volumes |

## Règles de refactor propres au dépôt

1. Un refactor ne change aucune sortie : comparer `audit/verification.txt` avant/après.
2. Un commit de refactor ne contient aucun changement de comportement ni de numéro de version.
3. Sur terrain/ESV, rien ne remplace la vérification réelle : dire « non vérifié dans ESV » quand c'est le cas.
