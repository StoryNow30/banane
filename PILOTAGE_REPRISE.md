# Pilotage de la reprise Ariane 4.9 — état, propriétaires, statuts

Tenu par l'orchestrateur Claude Code depuis le 4 octobre 2026 (D-074). Ce fichier remplace, pour la conduite
courante, les états dispersés dans les livraisons de l'intérim. Les textes signés (cahier, besoins, avenants) ne
sont pas réécrits. Ordre de lecture des règles : D-066, D-067, D-068, D-072, D-073, D-074, puis le cahier signé
`BANANE_4.9_CAHIER.md` et `consignes/besoins-4.9-2026-09-30.md`.

## 1. Références vérifiées le 4 octobre au soir

| Objet | Référence | Vérification |
|---|---|---|
| `main` (documentaire) | `18a355eb02a00b20b2adaeb1d84648854664972e` | `git ls-remote` : inchangé |
| Base 4.8.6 stable | `042aee649bc25b89c46a26def481f87f46d047ac` | parent de `main`, présent |
| V1 candidat relu | `baa548d81a0bf7059ae1711163527a918cf2257d` | bundle livré, importé |
| V1 paquet test 4.9.0.1 | `1ba79d446676eb7fe882125faaf632208e369aaa` | bundle livré, importé ; paquet SHA-256 `c7c0567d…6fd1f` déclaré |
| U1 corrigé | arbre `978d5bc633a35feb283d4c1326e0f8ebba2e477d` | patch complet appliqué sur 4.8.6 : arbre identique |
| U2 préparation | arbre `aab863f2ed7d0a45c9189e243a7aec9dfb805586` | patch appliqué sur 4.8.6 : arbre identique au `deliveryTree` |
| Passation reçue | 95 fichiers, `SHA256SUMS` | 94 conformes ; `00_DEMARRAGE_CLAUDE_CODE.md` modifié après le calcul des empreintes (instruction de Mic, contenu lu et appliqué) |

Les commits U1 (`0bcc4c5`) et U2 (`39dd8d4`) d'origine ne sont pas recréés : seuls leurs arbres le sont.
Branches locales d'import : `livre/v1-test-1ba79d4`, `livre/v1-corrige-baa548d`, `livre/u1-corrige`,
`livre/u2-preparation` (non envoyées : ce sont des copies des livraisons). Les branches de travail `claude/…` sont
envoyées sur GitHub au fur et à mesure (D-075), jamais `main`, sans fusion.

## 2. Statut des chantiers

Vocabulaire : **accepté** = dit par Mic ; **livré** = remis, relu ou non ; **en cours** = mission active ;
**à cadrer** = rien d'autorisé au-delà du cadrage. Aucun pourcentage d'avancement ni date de sortie.

| Chantier | Statut | Ce qui manque avant acceptation |
|---|---|---|
| P2 | **Accepté** (D-071) | Rien ; ne pas refaire |
| V1 mesure par phase | Livré, testé terrain partie 23, **non accepté** | Relecture du diagnostic, correctifs de mesure (proposés, non adoptés), plusieurs lots, couverture 100 %, décisions identiques |
| U1 résumé de partie | Livré et relu (27 essais), **non accepté** | Contrôle dans le vrai panneau ; réécriture en cours |
| U2 essais du vrai panneau | Banc livré ; 20 PASS, `focus-pause` FAIL dès 4.8.6, 2 zooms BLOCKED (headless) | Exécution à fenêtre ; diagnostic du focus et des zooms |
| V4 | Préparation et relecture livrées | Périmètre : seule la paire comparative est candidate ; gain réel à chiffrer avec V1 |
| Inventaire D-067 | À faire après V1 accepté, avant V2 | Acceptation V1 |
| V2, V3, U3 | À cadrer / dépendances | V1 ; A/A et réservations avant V3 ; action de `D` avant U3 |
| V5, B3 | Conditionnels | Mesure de dérive (V5) ; besoin issu de B2 (B3) |
| Retour à une coupe, 398/402, B1, B2 | Dans la 4.9 (D-068), à cadrer | Études en cours ; environnement 398/402 à qualifier |
| Apprentissage | Dans la 4.9 (D-066), activation conditionnelle | Inventaire, seuils approuvés, aucune activation |
| Banc ESV local | En construction (privé, hors dépôt) | Relecture indépendante avant tout usage pour Ariane |

## 3. Missions lancées le 4 octobre (espaces séparés, une branche par auteur)

| Mission | But | Branche locale | Écrit en production |
|---|---|---|---|
| A — V1 | Relire le diagnostic, réécrire le code V1, préparer les correctifs (non adoptés) | `claude/49-v1-reecriture`, `claude/49-v1-corrections-proposees` | voir § 4 |
| B — ESV | Banc ESV local depuis les originaux, confiné | hors dépôt | rien |
| C — Performance | Coûts du cycle, capture, V4 réévalué | aucune | rien |
| D — Géométrie | Repères, données, candidats, confiance, apprentissage, 398/402 | aucune | rien |
| E — Fonctions | Identité, sauvegarde, navigation, raccourcis, hors écran, exports | aucune | rien |
| F — Qualification U1/U2 | Vrai panneau sous fenêtre, focus, zooms, résumé | `claude/49-u2-qualification` | outils de banc seulement |
| G — Panneau | Réécrire U1 ; propriétaire unique du panneau | `claude/49-panneau-reecriture` | voir § 4 |

Chaque auteur livre un rapport et s'arrête ; une autre équipe relit. L'orchestrateur relit chaque diff ; Mic
accepte, fusionne, étiquette et publie. Les branches de travail sont envoyées sur GitHub (D-075) ; envoyée ne veut pas dire acceptée.

## 4. Propriétaires des fichiers de production

| Fichiers | Propriétaire |
|---|---|
| `src/engine.js`, placement, transformations de coordonnées, lecteur LiDAR (`audit/v4.4.0-frozen-engine-hashes.json`) | **Gelés** : personne |
| `background.js` (crochets de mesure), `src/bridge.js`, `src/core.js`, `src/perf-phase.js`, `tools/perf-lot.cjs`, `tools/perf-phases.cjs` | Mission A |
| `panel.js`, `panel.html`, `panel.css`, `src/part-summary-49.js` | Mission G (seul). Le correctif d'export V1 qui touche `panel.js` est un patch de A, intégré par G après accord |
| `tests/browser/u2-49/**`, `tools/navigateur-panneau-49.cjs` | Mission F |
| `src/adapter-page.js` et autres `src/` | Personne pour l'instant : lecture seule |
| Documents de pilotage (`PILOTAGE_REPRISE.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`, `consignes/`) | Orchestrateur |

## 5. Pièces absentes ou non rejouables

Six bruts de la partie 23 (empreintes et analyses seulement) ; rapport indépendant de la relecture du paquet V1
avant terrain (déclarée validée par Mic) ; rapports P2 complets (D-071 consigne l'acceptation) ; objets commits U1/U2
d'origine ; corpus natif privé (`datasets/native/`) : verify tourne en mode partiel, 2 essais sautés, non réussis.

## 6. Règles de preuve

Verify à zéro échec avant chaque commit ; sautés et bloqués distincts des réussites ; un chiffre sans source s'écrit
« non mesuré » ; un résultat local ne vaut pas gain terrain ; aucun code, capture ou donnée d'ESV ni identifiant de
modèle dans les fichiers du dépôt ; aucune écriture dans banane-data.
