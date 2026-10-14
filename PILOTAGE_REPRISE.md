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
| 9 | U3 raccourcis | **Livré en 4.9.0.10 (D-093)** : `D` = cut de droite, `Maj + Espace` = valider (dits par Mic) ; essais hors ligne ; aucun raccourci ajouté | Essai terrain de la test 10 ; acceptation par Mic |
| 10 | Retour à une coupe | À l'étude : saut par l'événement interne d'ESV, essai au banc B | Résultat du banc ; conditions de sécurité D-067 |
| 11 | Étude 398/402 | À l'étude : rejeu direct sous 4.8.6 par un vérificateur indépendant : 398 et 402 posées à tort (159,9 et 273 mm, 0 appui) ; aucun lot réel de la partie 20 ne les contient ; levier « voisines » non vérifié | Décider du traitement (hors gel) ; levier voisines à essayer au banc |
| 12 | B1 voisins validés | À l'étude : la source existe (liste des coupes d'ESV) | Observateur passif ; partie neuve |
| 13 | B2 rails hors écran | À l'étude : déplacement par la caméra Potree | Tâche opérateur de 10 min |
| 14 | Apprentissage | À l'étude : recompte indépendant 902 rails exacts (partie 20 : 488, soit 54 %), au sommet de la zone 150 à 1 000 de D-067 ; l'estimation initiale de 500 à 650 est corrigée | Fiche de faisabilité non établie ; aucune activation |
| – | V5 (conditionnel) | Dérive confirmée (5,5 → 7,4 s sur 85 visites) ; cause non démontrée ; attend la mesure de V3 ; en 4.9 : diagnostics I4 seulement (D-078) | Mesure de V3 |
| – | B3 (conditionnel) | Dépend de B2 | B2 |
| – | Paquet test 2 (V1 + observateur passif + panneau) | **Prêt pour la séance terrain autorisée par D-078** : `ariane-4.9.0-test.2.zip`, SHA-256 `06b1f2f7…f5ab2`, tête `9355f1f` (`claude/49-test-2-final`, poussée) ; relecture indépendante de l'observateur ; essai dans un vrai Chromium contre le banc ESV (défauts trouvés et corrigés : liste de partie, numéro de tentative, déclenchement du résumé, ligne d'observateur absent) ; verify 1202/1200/0/2. Consigne : `consignes/seance-terrain-test-2-2026-10-06.md` | Séance terrain de Mic ; non vérifié : vrai serveur, Edge, lot Orbite complet |
| – | Paquet test 3 (V2 exports allégés + vidage du cache + grâce de 5 s + V1 correction 2) | **Prêt pour la séance terrain** : `ariane-4.9.0-test.3.zip`, SHA-256 `3612bd38…2fabba`, tête `3cbf304` (`claude/49-test-3`, poussée) ; relecture indépendante à 5 angles, constats corrigés et revérifiés ; verify 1296/1294/0/2. Consigne : `consignes/seance-terrain-test-3-2026-10-11.md` (dans la branche `claude/49-test-3`) | Séance terrain de Mic sur une partie neuve ; non vérifié : vrai serveur, Edge, lot Orbite complet ; décision à prendre : vidage automatique par défaut (recommandé : non) |
| – | Paquet test 4 (test 3 + vidage permis après un dernier cut différé) | **Prêt pour la séance terrain** : `ariane-4.9.0-test.4.zip`, SHA-256 `ddf94276…be8dd`, tête `0fcc4f6` (`claude/49-test-4`, poussée) ; défaut trouvé par Mic sur le terrain le 12 octobre (D-082) ; relectures ciblées (D-081), constats corrigés et revérifiés ; verify 1352/1350/0/2. Consigne : `consignes/seance-terrain-test-4-2026-10-12.md` (dans la branche `claude/49-test-4`) | Séance terrain de Mic ; non vérifié : vrai ESV, Edge, bouton Recharger, lot Orbite complet ; points ouverts : D-082 § 5 |
| – | Paquet test 5 (test 4 + borne d'écartement 1420 mm) : **référence de mesure de l'A/A** | **Prêt pour la séance terrain** : `ariane-4.9.0-test.5.zip`, SHA-256 `77dfb592…d3fc`, tête `1a88058` (`claude/49-test-5`, poussée) ; verify 1357/1355/0/2 ; sans relecture d'équipe (D-081 : changement de constante et de texte, essais complets). Consigne : `consignes/seance-terrain-test-5-2026-10-12.md` ; fiche : `fiches/FICHE_AA_V3.md` | Séance de Mic : installer, vider le cache, puis deux lots A/A ; non vérifié : long lot sur le vrai ESV, Edge, bouton Recharger |
| – | A/A calculé sur les exports reçus ; paquet test 6 (test 5 + V3, expérience I1 tirée cut par cut) ; dérive mesurée (V5) | **Prêt pour la séance terrain** : `ariane-4.9.0-test.6.zip`, SHA-256 `91b42406…a7b2`, tête `81e6e6f` (`claude/49-test-6`, poussée) ; verify 1372/1370/0/2 ; sans relecture d'équipe (D-081 : option de pause existante, mêmes points prouvés au banc). Outil `tools/perf-v3.cjs`. Consigne : `consignes/seance-terrain-test-6-2026-10-13.md` ; D-087 ; fiche suivante : `fiches/FICHE_V5.md` | Séance de Mic : un lot d'au moins 300 cuts ; décisions de Mic : T3 7 %, tolérance C1 8 points, méthode « tirage cut par cut », seuil V5 et lancement de V5 |
| – | Paquet test 10 (test 9 + fiche de départ des parties + raccourcis `D` / `Maj + Espace` écrits et essayés) | **Prêt pour la séance terrain** : `ariane-4.9.0-test.10.zip`, SHA-256 `09c32aaf…03949`, tête `2698492` (`claude/49-test-10`, poussée) ; verify 1442/1440/0/2 ; sans relecture par agent (D-093). Consigne : `consignes/seance-terrain-test-10-2026-10-13.md` ; fiche : `fiches/FICHE_U3_RACCOURCIS.md` | Séance de Mic : vérifier la ligne de fiche (validés + invalides = total, comparés à ESV) ; non vérifié : vrai ESV, Edge |
| – | Paquet test 9 (test 8 + mode rapide sur 9 cuts sur 10, allègement A des exports, étapes datées par la page) | **Prêt pour la séance terrain** : `ariane-4.9.0-test.9.zip`, SHA-256 `0d9637b0…5fba7`, tête `4faf5a2` (`claude/49-test-9`, poussée) ; verify 1424/1422/0/2 ; relecture indépendante (arrondi des points abandonné, perf-v3 par capture) ; banc ESV local : lecture par rail mesurée. Consigne : `consignes/seance-terrain-test-9-2026-10-13.md` ; D-091 | Séance de Mic : lots longs sans vidage ; analyse des lots du 13 octobre (4.9.0.8) selon le § 8 |
| – | **Premier lot terrain 4.9.0.8** (13 octobre, 112 cuts) | **Mode rapide : 2,44 s par cut contre 6,73 s (−64 %)**, part posée identique (84,8 %), écartement identique, aucun incident ; V5 : analyse et validation divisées par 2 à 4 ; D-090 | Décisions de Mic : généraliser le mode rapide (échantillon de référence 1/10), allègement A des exports ; lot d'au moins 300 cuts pour V5 |
| – | Paquet test 8 (test 7 + V5 : sauvegarde de l'état à taille constante) | **Prêt pour la séance terrain** : `ariane-4.9.0-test.8.zip`, SHA-256 `c58af027…53a4`, tête `e95dbae` (`claude/49-test-8`, poussée) ; verify 1407/1405/0/2 ; relecture indépendante (deux pertes sur panne d'IndexedDB corrigées) ; vrai Chromium : 104 ms → 1 ms par sauvegarde avec 600 visites. Moteur ré-épinglé (périmètre déclaré). Consigne : `consignes/seance-terrain-test-8-2026-10-13.md` ; D-089 | Séance de Mic : un lot d'au moins 300 cuts, puis un second sans vidage ; décisions de Mic : ré-épinglage du moteur, allègement des exports (−49 % du corpus sans perte mesurable) |
| – | Paquet test 7 (test 6 + mode rapide D-088 : sélection à l'image, lecture au signal de fin de chargement, pose sans recentrage) | **Prêt pour la séance terrain** : `ariane-4.9.0-test.7.zip`, SHA-256 `f2d01aef…876a`, tête `adfcd8d` (`claude/49-test-7`, poussée) ; verify 1391/1389/0/2 ; relecture indépendante (rien de bloquant, deux remarques appliquées) ; banc ESV local : points identiques, environ 3 s gagnées par cut. Consigne : `consignes/seance-terrain-test-7-2026-10-13.md` ; D-088 | Séance de Mic : un lot d'au moins 300 cuts (remplace la séance test 6) ; décision de Mic : trois changements dans un bras ; non vérifié : vrai ESV, carte graphique, Edge |
| – | Banc ESV local (privé) | Construit, confiné ; 113 sur 113 ; second jeu E1 à E6 : 24 sur 24 + 10 sur 10 ; saut par événement interne confirmé (partie en texte). **Rôle fixé avec Mic (6 octobre) : banc fonctionnel (nouvelles fonctions, parcours et erreurs d'ESV, cas où la pose dépend du chargement des points), pas banc de vitesse ; points complets seulement pour les coupes 0 à 3 de la partie 21, donc élargissement par collecte ciblée = décision de Mic** | Relecture indépendante avant tout usage pour Ariane ; essai de la vraie extension (F) |

**Chantiers obligatoires : 3 acceptés sur 14** (P2, U1, U2) ; 1 adopté pour test, non accepté (V1) ; 7 à l'étude ou préparés : V4, V3,
retour à une coupe, 398/402, B1, B2, apprentissage ; 3 non commencés : inventaire, V2, U3). Chiffre de comptage, pas
d'avancement : les chantiers n'ont ni la même taille ni la même part de terrain.

**Portes de la version 4.9.0 (cahier § 7), état du 13 octobre au soir (D-092) : mesurées sur le terrain, pas encore signées par Mic. Cycle médian −25 % : dépassé en interne (−53 à −64 % du rapide contre la référence), formalisation sur une partie neuve (§ 4) à faire ; C1 non dégradé : tenu ; C3 = 0 : tenu sur les lots reçus ; trois mesures publiées ensemble : partiel (durée totale et arrêts pour 100 cuts à publier) ; 0 capture perdue : tenu ; exports conformes : allégé rejoué 112/112 ; U1, U2 acceptés, U3 non commencé (action de `D` à fixer) ; V5 livré, aucune dérive vue ; audit d'Astra : retiré (D-094, Astra a quitté le projet) ; relecture ciblée du diff de moteur V5 : à décider (D-094 point 2). Le critère « 300 cuts en un lot » est levé par la direction (D-092). Ligne de l'ancien état :** 0 franchie sur 9. D-085 (12 octobre) : C4 est retiré des portes de la 4.9, la porte devient « C1 non dégradé » ; borne d'écartement 1420 mm (D-084, D-085).** Cycle médian −25 % ; C1 et C4 non dégradés ; C3 = 0 ;
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

Relecture proportionnée au risque (D-081, 12 octobre) : une relecture indépendante ciblée pour ce qui efface ou peut perdre des données, une seule pour la mesure et l'observateur, aucune équipe pour les textes et l'affichage ; essais complets à zéro échec dans tous les cas, puis séance terrain.

Mode économe en tokens (D-083, 12 octobre) : analyses d'exports faites sans agent ; au plus 4 agents et environ 25 appels par agent ; estimation et accord de Mic avant tout chantier de plus de 2 agents.

## 7. Observations de terrain de Mic (6 octobre, version 4.8.6), non mesurées

Poste pro sous Edge : Orbite lent quand une 2e fenêtre ESV est traitée en manuel. Même poste sous Chrome : plus de lenteur. Poste perso plus puissant : Orbite très rapide. À mesurer plus tard avec V1 (même lot, Edge puis Chrome, une puis deux fenêtres). Les mesures de vitesse se comparent sur un même poste et un même navigateur.

## 8. Recette d'analyse d'un lot terrain (D-091, 13 octobre) : pour toute session, quel que soit le modèle

Règles : données d'export **privées**, dans le scratchpad seulement (jamais dans un dépôt) ; aucun identifiant de projet ESV dans une
sortie ; analyse **sans agent** (D-083) ; réponse à Mic en français simple, courte, chiffres clés et décisions groupées.

1. **Recoller** les morceaux envoyés par Mic (script de découpe de la consigne test 9 : `….zip.001`, `.002`, `.003`, coupure brute) :
   `cat <nom>.zip.001 <nom>.zip.002 <nom>.zip.003 > <nom>.zip` (les fichiers reçus portent un préfixe aléatoire `xxxxxxxx-` : trier par
   suffixe). `sha256sum <nom>.zip` doit donner la ligne SHA-256 affichée chez Mic (majuscules chez lui). Sinon : redemander le morceau.
2. **Décompresser** dans un dossier neuf du scratchpad (`lotNN/x`), avec `unzip -q`. Contenu : journal, bilan (`ariane-bilan-v4-…-seg01.json`),
   diagnostic, corpus en segments, `CONTENU.txt`.
3. **Vitesse** : `node tools/perf-v3.cjs <bilan-seg01.json> --json <sortie>.json` depuis la branche `claude/49-test-9` (ou plus récente).
   La règle du lot est lue dans le journal (4.9.0.9 : « echantillon », un cut sur dix en référence) ; avant la 4.9.0.9 : « tirage ».
   Lecture par rail : juste depuis la 4.9.0.9 (heures de la page), à 0 s en rapide avant (artefact connu, D-090).
4. **Qualité par bras** (écartement, reports, incidents, fin de partie) : script privé `scratchpad/outils/verif-lot.cjs <bilan-seg01.json>`
   (bras par la règle du lot ; pour un lot mêlant deux règles, se fier à perf-v3, qui range chaque visite selon sa capture).
5. **Dérive (V5)** : comparer le cycle des premiers et derniers tiers du lot, et d'un lot à l'autre quand Mic n'a pas vidé le cache entre eux.
6. **Exports** : depuis la 4.9.0.9, chaque nuage allégé porte `exportLightening` (sondes sans information retirées ; points exacts).

## 9. État de reprise au 13 octobre (soir), après D-096 — pour toute session qui reprend

- **Pleins pouvoirs** de Mic jusqu'à la livraison de la 4.9 (D-096) ; **à demander** : fusion dans `main`, étiquette, publication, mise en production de la stable. Pas de PR sans demande. Économie de jetons (D-081, D-083).
- **Test 10 livrée à Mic** (`ariane-4.9.0-test.10.zip`, SHA-256 `09c32aaf…03949`, branche `claude/49-test-10`) : fiche de départ des parties + U3 écrit. Attente du lot terrain de Mic (ligne « Départs des parties » ; validés + invalides = total).
- **En cours** : agent B1 (modèle fort) sur `claude/49-test-11` (worktree `scratchpad/wt/T11`), mode ombre, fiche `fiches/FICHE_B1.md`. Déjà sur cette branche : correctif KI-070 (`8806f05`). Ne pas toucher T11 tant que l'agent n'a pas rendu son rapport.
- **Ensuite** : relire le diff de l'agent, `verify`, version 4.9.0.11 (manifest, core, panel, background, pont, essais `version-test*`, consigne, paquet) ; puis retour à une coupe ; activation de B1 selon l'ombre ; version stable 4.9.0 (portes du cahier § 7 à présenter à Mic) ; 4.9.5 déclarée ; 5.0 à redéfinir avec Mic (B2, B3, apprentissage, V4, C4).
- **Analyse d'un lot** : § 8 ci-dessus ; scripts privés `scratchpad/outils/verif-lot.cjs`, `scratchpad/lot14/parties.cjs` (fiches de départ), `scratchpad/lot14/offset.cjs` (translation monde − scène).
- **Données** : exports privés dans `scratchpad/lot14/{u,w,y,x,v,t,s}` (jamais dans un dépôt).

**Mise à jour (13 octobre, nuit).** Test 11 livrée (D-097) : B1 en ombre + KI-070, paquet dans le scratchpad `paquets/ariane-4.9.0-test.11.zip`. Session UX lancée (`session_01EkDdiR4LCbooBkVmQuxHfi`, branche `claude/ux-variantes`) : en attente du choix de Mic. Prochaines étapes : analyser le lot test 11 (notes `b1-ombre`), retour à une coupe, activer B1 selon l'ombre, intégrer l'UX choisie, puis stable 4.9.0 (merge/tag/publication : demander à Mic).

**Mise à jour (14 octobre, 03 h UTC).** Retour à une coupe livré (D-098, `claude/49-retour-coupe` 977108e, à fusionner dans la ligne de test avec la 4.9.0.12). UX : variante A « Accueil » retenue par Mic (`design/ux-2026-10/retenue/`) ; intégration au panneau en cours dans la session UX (`claude/ux-variantes`). Ensuite : 4.9.0.12 = test 11 + retour à une coupe + panneau UX ; lots test 11 de Mic à analyser (notes `b1-ombre`) ; activation de B1 selon l'ombre ; portes du cahier § 7 ; stable (merge/tag/publication : demander à Mic).
