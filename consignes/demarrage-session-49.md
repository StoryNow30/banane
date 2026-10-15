# Démarrage de la session de développement 4.9

> **Remplacé le 30/09 par** `demarrage-developpeur-sol.md`, `demarrage-orchestrateur-sol.md` et `demarrage-analyste-luna.md` (le développeur de la 4.9 est une session Sol ; ce fichier visait une session Claude). Gardé pour l'historique et la décision B.


À lancer **après** la 4.8.5 stable (fusionnée, étiquette créée par la direction), dans une **session neuve** :
un contexte court coûte bien moins de quota qu'une longue conversation. Plugins : **Superpowers** (obra) et
**Modern Web Guidance** (Google Chrome) ; playwright en option. Modèle : **Sonnet** par défaut ; **Opus**
seulement pour la conception de V3 et la relecture avant étiquette. Copie le bloc tel quel.

## Décision de la direction (30/09/2026) : option B, par le chemin normal

La porte de la 4.9.0 reste **cycle médian −25 %** (donc V3), avec C1 et C4 non dégradés. « Je veux le chemin normal, le
plus naturel, afin d'en faire la meilleure version, je ne suis pas pressé. » Aucun raccourci de périmètre ni de
procédure : la durée suit le quota, pas l'inverse.

**Chemin :** 4.8.5 stable → (Astra de retour) → la session 4.9 écrit d'abord le **cahier 4.9 v0.2** (documents seuls,
pas de code : chantiers ordonnés, portes chiffrées, à partir de `PLAN_SUITE.md` §3 et des mesures des lots 20 à 33) →
audit d'orchestration d'Astra → **signature de la direction** → chantiers, dans l'ordre ci-dessous. Le périmètre du
plan reste entier (U1 à U3, V5, B1 à B3 compris) ; l'ordre et les portes décident ce qui se fait quand, pas le budget.

## Ordre des chantiers, une chose à la fois, un commit par chantier

1. **P2** (30 cuts reposés en aveugle, 15 min de l'opérateur) et **V1** (mesure par phase) : en premier.
2. **V2 + KI-068** (remonté) : export sans doublon et limité au lot ; le lot 33 a pesé 1,03 Go pour 100 cuts.
3. **V4** (comparaison V4.6 à la demande), puis **V3** (capture plus rapide, un seul réglage par cycle, version de test).
4. **U1 à U3** en parallèle sur des fichiers distincts quand le cycle le permet ; **V5** seulement si un long lot
   montre une dérive de mémoire ; puis la 4.9.5 (**B1 à B3**).

## Règles de quota

- Une seule session de développement à la fois ; pas de session de relecture en parallèle.
- L'analyse des exports passe par les scripts (`tools/analyse-locale.cjs`, page `reducteur-exports.html`) : lire
  `RESUME.md` et les tableaux, jamais les fichiers bruts ; l'opérateur envoie les fichiers allégés.
- Réponses courtes ; les décisions de l'opérateur groupées dans un seul message par cycle.
- Astra (relecture d'orchestration, quota séparé) et Grok (relecture de diff) font les revues qui ne demandent pas le dépôt.

```text
Tu reprends Ariane (ex-Banane), extension Edge MV3 qui pose les rails sur ESV LiDAR, pour développer la 4.9.
Tu es l'orchestrateur : code, bancs, paquets, documents. Réponses courtes, en français ; je suis l'opérateur et la
direction, et mon quota est limité : une seule chose à la fois, aucun travail parallèle.

DÉPÔTS : StoryNow30/banane (pars de la tête de main, 4.8.5 stable fusionnée) et StoryNow30/banane-data.
Vérifie d'abord l'état : branche, tête, étiquettes (v4.8.5 stable ; v4.8.0 = fabd77e, retour arrière).

LIS, DANS CET ORDRE, SANS RIEN DE PLUS :
1. PASSATION_4.8.0.md (règles non négociables) ;
2. DECISIONS.md, D-057 à la dernière ;
3. PLAN_SUITE.md §3 (les chantiers 4.9, l'ordre, la porte) et consignes/demarrage-session-49.md (décision B, chemin normal) ;
4. KNOWN_ISSUES.md, KI-066 à KI-068 ;
5. audit/lots-20-24-33-2026-09-29.md (état des mesures) et consignes/analyse-locale.md (comment j'envoie les exports).

PREMIÈRE TÂCHE, SANS CODE : écris le cahier 4.9 v0.2 (docs/ ou la racine, selon les conventions du dépôt) : chantiers
ordonnés, dépendances, portes chiffrées, mesures de départ tirées de audit/lots-20-24-33-2026-09-29.md ; puis arrête-toi :
il passe à l'audit d'Astra et à ma signature avant tout code.
ENSUITE, une fois signé : P2 et V1 ; puis V2 avec KI-068 ; puis V4 ; puis V3, un réglage par cycle, en version de test ;
U1 à U3, V5, B1 à B3 selon l'ordre du cahier. Un commit par chantier, préfixé [Vn]. Skills : test-driven-development, systematic-debugging, verification-before-completion
(Superpowers) ; chrome-extensions (Modern Web Guidance) pour tout ce qui touche à l'injection dans la page ; code-review
sur chaque diff.

PORTE DE LA 4.9.0 : cycle médian −25 %, C1 et C4 non dégradés (mesurés sur mes lots, exports allégés).

RÈGLES : `node tools/verify.cjs` à 0 avant chaque commit (chaîne les commandes avec `&&`) ; src/engine.js épinglé ;
écartement [1405, 1470] mm en admissibilité seulement ; deux rails ou rien ; pas de VALIDATE ni de SKIP automatique
d'un cut non résolu ; cuts 9033 et 9241 exclus ; aucune capture d'écran ni code d'ESV dans les dépôts ; pas de merge,
d'étiquette, de publication ni de force push sans mon accord ; commits avec Co-Authored-By et Claude-Session ; aucun
identifiant de modèle dans les fichiers.

Commence par vérifier que les plugins Superpowers et Modern Web Guidance sont chargés (liste tes plugins) ; puis dis-moi
en 5 lignes l'état que tu trouves et ton premier pas.
```
