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

## 2. Statut des chantiers (6 octobre, après D-078)

Vocabulaire : **accepté** = dit par Mic ; **livré** = remis ; **relu** = relu par une équipe autre que l'auteur ;
**à l'étude** = étude livrée, aucun code adopté. Un code réécrit par Claude Code n'est pas accepté d'office : il
attend sa relecture indépendante, puis Mic.

| # | Chantier | Statut | Ce qui manque avant acceptation |
|---|---|---|---|
| 1 | P2 | **Accepté** (D-071) | Rien ; ne pas refaire |
| 2 | V1 mesure par phase | Livré (GPT), testé terrain partie 23, **non accepté**. Diagnostic relu par A : 3 défauts de mesure confirmés. Réécriture (A, `37dd5df`) **relue par une équipe indépendante : acceptable pour adoption** (gel intact, 9 + 5 scénarios identiques octet pour octet, verify 0 échec). Correction (3) segments et ERROR (`6b9ed26`) : acceptable ; correction (2) chronologie concurrente (`86dc727`) : **réserves** (publie le chevauchement sans le supprimer ; critère D-073 à signer) ; patch d'export du panneau : acceptable après intégration par G. Branches envoyées, non fusionnées. **D-078 : réécriture et correction (3) adoptées pour test ; critère « lot rouvert » signé ; correction (2) non adoptée ; patch d'export à intégrer par G** | Signature de Mic du critère D-073 (chronologies concurrentes) ; intégration du patch d'export par G ; un `try/catch` autour de `timing.flush()` (mineur) ; plusieurs lots terrain ; couverture 100 % ; attestation du projet |
| 3 | Inventaire D-067 | Pas commencé (après V1 accepté) | V1 accepté. La liste des coupes d'ESV donnerait des comptes exacts (D-077) |
| 4 | V2 exports allégés + KI-068 | Pas commencé | Essai de faisabilité du fichier unique ; l'observateur passif simplifie les données (D-077) |
| 5 | V4 | Préparation relue. 0,3 % du cycle : levier de vitesse abandonné (D-076, D-078) ; gardé pour la clarté « seul GCV1 commande », après V3 | Après V3 |
| 6 | V3 capture | Étude faite (C) ; idée « lecture des points » (I1) prête ; lecteur gelé appelé avec son option de pause : **hors gel en test (D-078)** ; **aucun essai terrain** | A/A ; réservation de parties ; I1, puis I2, puis I3 ; 3 expériences au moins |
| 7 | U1 résumé de partie | Livré (GPT) puis réécrit (G) : comptes identiques à l'outil sur 14 lots réels (0 différence). **Deux relectures indépendantes : acceptable.** Bloc résumé replié par défaut (`3f8a79d`, branche envoyée). **Accepté (D-078)** | Rien (fusion et publication : décisions séparées) |
| 8 | U2 essais du vrai panneau | Banc réécrit (F) ; défauts 4.8.6 corrigés (focus après Pause/Reprendre ; tiroir Réglages à 200 %) ; requalifié contre `3f8a79d` : 24 sur 24 et 9 sur 9, 3 passes (Chromium 141 seulement ; branche `4da97cd` envoyée). **Accepté (D-078)** | Chromium 153 et Edge non mesurés |
| 9 | U3 raccourcis | Pas commencé | L'étude E a établi les actions réelles d'ESV (D = rail droit ; Maj+Espace = valider sans bouger) : décider l'action de D |
| 10 | Retour à une coupe | À l'étude : saut par l'événement interne d'ESV, essai au banc B | Résultat du banc ; conditions de sécurité D-067 |
| 11 | Étude 398/402 | À l'étude : rejeu direct sous 4.8.6 par un vérificateur indépendant : 398 et 402 posées à tort (159,9 et 273 mm, 0 appui) ; aucun lot réel de la partie 20 ne les contient ; levier « voisines » non vérifié | Décider du traitement (hors gel) ; levier voisines à essayer au banc |
| 12 | B1 voisins validés | À l'étude : la source existe (liste des coupes d'ESV) | Observateur passif ; partie neuve |
| 13 | B2 rails hors écran | À l'étude : déplacement par la caméra Potree | Tâche opérateur de 10 min |
| 14 | Apprentissage | À l'étude : recompte indépendant 902 rails exacts (partie 20 : 488, soit 54 %), au sommet de la zone 150 à 1 000 de D-067 ; l'estimation initiale de 500 à 650 est corrigée | Fiche de faisabilité non établie ; aucune activation |
| – | V5 (conditionnel) | Dérive confirmée (5,5 → 7,4 s sur 85 visites) ; cause non démontrée ; attend la mesure de V3 ; en 4.9 : diagnostics I4 seulement (D-078) | Mesure de V3 |
| – | B3 (conditionnel) | Dépend de B2 | B2 |
| – | Banc ESV local (privé) | Construit, confiné ; 113 sur 113 ; second jeu E1 à E6 : 24 sur 24 + 10 sur 10 ; saut par événement interne confirmé (partie en texte) | Relecture indépendante avant tout usage pour Ariane |

**Chantiers obligatoires : 3 acceptés sur 14** (P2, U1, U2) ; 1 adopté pour test, non accepté (V1) ; 7 à l'étude ou préparés : V4, V3,
retour à une coupe, 398/402, B1, B2, apprentissage ; 3 non commencés : inventaire, V2, U3). Chiffre de comptage, pas
d'avancement : les chantiers n'ont ni la même taille ni la même part de terrain.

**Portes de la version 4.9.0 (cahier § 7) : 0 franchie sur 9.** Cycle médian −25 % ; C1 et C4 non dégradés ; C3 = 0 ;
trois mesures publiées ensemble ; 0 capture perdue ; exports conformes (petit fichier à zéro différence) ; U1 à U3
livrés ; V5 selon la mesure ; audit Astra du diff. Aucune n'est mesurée sur la 4.9.

**Pourquoi aucun pourcentage** : le cahier et l'instruction de reprise l'interdisent tant que la base de calcul
n'existe pas. Il n'y a pas encore de mesure de gain, et la sortie dépend de cycles terrain successifs (A/A, au moins
trois expériences V3, une partie neuve de validation). L'avenant D-067 avait compté 11 à 16 cycles de 2 à 3 jours, soit
3 à 7 semaines avant délais, sans promettre de date ; ce calcul n'a pas été refait.

## 3. Missions (4-5 octobre) et état au 5 octobre, soir

| Mission | Statut | Livrable | Branche locale (envoyée ?) |
|---|---|---|---|
| A — V1 | Livrée ; relue par une équipe indépendante (réécriture acceptable) | Réécriture, correctifs 2 et 3, patch d'export, plan de l'observateur passif | `claude/49-v1-reecriture` (`37dd5df`), `claude/49-v1-corrections-proposees` (`86dc727`) : envoyées, non fusionnées |
| B — ESV | Livrée ; relecture indépendante à faire | Banc confiné, matrice, 2 jeux de données | hors dépôt |
| C — Performance | Livrée ; contre-vérifiée (errata) | `missions/C_PERF/RAPPORT.md` (privé) | aucune |
| D — Géométrie | Livrée ; contre-vérifiée (errata : 902 rails exacts, 398/402 rejoué) | `missions/D_GEOM/RAPPORT.md` (privé) | aucune |
| E — Fonctions | Livrée ; contre-vérifiée (errata) | `missions/E_FONCTIONS/RAPPORT.md` (privé) | aucune |
| F — Qualification | Livrée ; requalifiée après `3f8a79d` | Banc réel + rapport | `claude/49-u2-qualification` (`4da97cd`, envoyée) |
| G — Panneau | Livrée ; relue (2 relectures indépendantes : acceptable) ; patchs de F et repli appliqués | `3f8a79d` | `claude/49-panneau-reecriture` (envoyée) |
| Lecture directe d'ESV (orchestrateur) | Livrée | `missions/ANGLES_ESV_RAPPORT.md` (privé) | aucune |

Chaque auteur livre un rapport et s'arrête ; une autre équipe relit. L'orchestrateur relit chaque diff ; Mic
accepte, fusionne, étiquette et publie. Les branches de travail sont envoyées sur GitHub (D-075) ; envoyée ne veut
pas dire acceptée.

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
