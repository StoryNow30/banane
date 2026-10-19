# Patrons dans Ariane

Lu dans le code le 19/10/2026 (branche `claude/design-patterns-ariane-69osmz`). Seuls `src/core.js`, `src/brain.js`, `src/storage.js`, `src/bridge.js`, `src/geometry-candidate-v1.js` (en-tête), `manifest.json`, `README.md` et les statuts de `src/manual-session.js` / `src/native-session.js` ont été lus. Les lignes « À vérifier » sont des pistes, pas des constats.

## Contraintes

- **Gelés :** `src/geometry.js` et `src/geometry-candidate-v1.js` (empreintes vérifiées, README) ; `src/engine.js` (« gelé », commentaire de `src/brain.js`). Ne pas les modifier : un patron se pose autour, comme `brain.js` post-traite le moteur.
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
| ~50 lignes de comparaison `kind===` / `action===` dans `background.js` | table `{kind: handler}` (Command léger) | `background.js` | Garder la liste blanche et l'ordre des gardes |
| `manual-session.js` et `native-session.js` gèrent chacun statuts, pause, reprise, fin avec des chaînes (`STARTING`, `RUNNING`, `PAUSED`, `INTERRUPTED_RECOVERED`) | table de transitions (State léger) ou cycle de vie commun (Template Method) | les deux fichiers | Ne pas fusionner leurs provenances (`explicit-manual-session` ≠ `native-passive-observation`) |
| Politique d'un lot « figée à la création » (continuer/différer ou pause) | Strategy résolue à la création, jamais modifiée après | `src/engine.js` (gelé) | Lire seulement ; si modification nécessaire, demander |
| Gardes d'écartement, de confiance et de paire dans `src/gauge.js` et le moteur | Chain of Responsibility explicite | `src/gauge.js` | Chaque garde garde son test dédié (`tests/gauge-*.test.cjs`) |
| Exports (diagnostic GCV1, natif, manuel, zip) construits pas à pas | Builder | `src/gcv1-export.js`, `src/native-export.js`, `src/export-cache.js` | Les manifestes portent SHA-256 : aucune sortie ne doit changer |
| Adaptation d'ESV (API de la page) | Adapter / Facade | `src/adapter-page.js` | Aucune API serveur supposée (README) |

## Règles de refactor propres au dépôt

1. Un refactor ne change aucune sortie : comparer `audit/verification.txt` avant/après.
2. Un commit de refactor ne contient aucun changement de comportement ni de numéro de version.
3. Sur terrain/ESV, rien ne remplace la vérification réelle : dire « non vérifié dans ESV » quand c'est le cas.
