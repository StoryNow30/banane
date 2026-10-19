# Plan de la suite 5.0 : règles métier, puis méga cerveau GCV2 (19 octobre 2026)

Écrit le 19 octobre 2026 au matin, au niveau le plus fort, sur demande de Mic : prendre connaissance de tout le contexte, élaborer la suite du plan des règles métier, puis attribuer chaque mission à un niveau de modèle avant qu'il lance le développement de la GCV2. Mic a validé le plan de développement proposé la veille (D-191, D-192). Ce plan complète `fiches/PLAN_5.0.md` (tableau de bord du 15 octobre) et suit `fiches/ORGANISATION_DEV_5.0.md` (rôles, niveaux, économie de jetons). La conception de la GCV2 est dans `fiches/G0_GCV2_CONCEPTION.md`.

Règle du dépôt : aucun identifiant de modèle. Les niveaux sont ceux de l'organisation : **éclair** (coût 1), **rapide** (20), **fort** (40), **le plus fort** (100). L'effort va de bas à maximal.

## 0. Où on en est

- **Code** : base `claude/50-base` (da9debf, 4.9.5.7, test 7). La test 8 (`claude/50-relecture-couverture`, d58a6f1) est remise à Mic, **pas fusionnée**. Le compteur GCV2 et la table sans lot sont sur `claude/50-compteur-gcv2` (6645a0e), **pas fusionnés**.
- **Actif au choix de Mic dans le panneau** : la relecture de fin de lot en mode « corriger » sur les verts de PN, d'ADV et d'abords, avec la règle prudente (8 mm au moins, 45 mm en travers au plus, écartement à 15 mm de la médiane, chaîne + hauteur apprise ; D-174, D-180) ; la règle grappe ; Maj+Espace sur place.
- **En ombre** (calculé et consigné, jamais appliqué) : hauteur apprise au lot, voie prédite, mémoire des différés, faux vert « hauteur ambiguë », règles métier du lot (`pn-chaque-cut`, `grappe-differes`, `zone-validation-en-place`), convention P1, combinaison P-7.
- **Mesuré** : règle prudente en validation croisée : 79 corrections justes, 0 mauvaise voie, 6 cuts abîmés sur 1 445 (RELECTURE_AUTONOME) ; sur les parties réservées 14, 15 et 16 : 29 des 35 corrections de Mic de plus de 10 mm reproduites, 0 mauvaise voie, 2 abîmés, 6 laissés faux, 87 abstentions (D-190). Partie 11 : les 17 corrections d'Ariane tiennent, 15 oublis expliqués et couverts par la test 8 (D-185, D-186).
- **Données** : 10 Échos archivés, **1 631 cuts corrigés** (527 de plus de 10 mm), 3 250 apprenables (D-188) ; Mic en apporte chaque jour.
- **Ouvert** : la première zone d'ADV de la partie 11 (6362–6424) n'est pas détectée ; les marges d'ADV (entrée, fin, chaînage) ne sont pas mesurées sur les notes de Mic ; 7 des 42 grosses corrections des parties 14 à 16 tombent hors de toute zone ; 39 des 118 grosses corrections sont des abstentions du moteur ; le final de la partie 15 manque.

## 1. Règle des parties : examen, puis apprentissage

Mic aura « toujours de nouvelles parties inédites ». La réserve permanente n'est donc pas nécessaire ; la règle devient une **rotation** :

1. **Toute partie nouvelle est d'abord un examen.** Elle entre réservée dans `datasets/manifeste-parties.json` ; on la juge avec les réglages et les paramètres **figés** (règle prudente, puis GCV2) : c'est la seule mesure honnête de ce qu'Ariane ferait sur du jamais-vu.
2. **Après le jugement et une décision écrite**, elle passe en apprentissage : chaque cut corrigé devient un exemple (cap de Mic : un cut corrigé = un cut appris). Rien n'est perdu.
3. **Deux témoins fixes**, jamais appris : **1:25** et **1:11** (déjà réservées, avec un Écho ; RELECTURE_AUTONOME § 2.1). Ils servent à comparer entre elles les versions successives de la GCV2 sur une base qui ne bouge pas. Sans témoin, deux versions jugées sur des parties différentes ne se comparent pas.
4. **Le manifeste reste la loi** : aucun outil de réglage ne lit une partie réservée ; une partie qui a servi à régler ne juge plus.

Réponse à la question de Mic (« c'est-à-dire ? », D-191) : oui, c'est utile, et avec la rotation ça ne coûte aucune correction.

## 2. Cycle quotidien des corrections de Mic

| Étape | Qui | Niveau / effort | Sortie |
|---|---|---|---|
| 1. Archiver l'export (banane-data : zips d'origine, `SHA256SUMS`, `NOTES.md`, ligne d'`INDEX.md`, analyse d'identité ; jamais le code de projet ESV) | mesureur | éclair / bas | commit poussé |
| 2. Compteur GCV2 et jointure (`compteur-gcv2.cjs`, `jointure-echo-orbite.cjs`, `relecture-autonome.cjs extraire`) | mesureur | éclair / bas | tables, `fiches/COMPTEUR_GCV2.md` |
| 3. Juger la partie, réglages figés : relecture (lot + Écho) ou règle prudente (Écho seul, `table --sans-lot`, `juger --juger-partie-reservee`) ; dès G1-c, la GCV2 figée aussi | mesureur | rapide / bas | table de jugement |
| 4. Décider : lire les tables, écrire la décision, passer la partie en apprentissage, répondre à Mic | orchestrateur | fort / haut, 15 min | `DECISIONS.md` |
| 5. Réentraîner (dès G1-b) quand trois parties nouvelles sont entrées, ou une fois par semaine ; juger sur les témoins et les réservées ; passer les parties en « appris » dans le compteur | développeur, puis orchestrateur | rapide / moyen, puis fort | `datasets/gcv2-parametres.json` daté, fiche |

Budget : au plus **20 % d'une fenêtre de 5 h par jour** pour ce cycle (règle 7 de l'organisation). Aucune lecture d'export par un modèle : des scripts, puis des tables.

## 3. Missions règles métier

Ordre des dépendances ; deux chantiers au plus en parallèle (un lourd, un léger). Branche : `claude/50-<code>`. Chaque mission rend un rapport de dix lignes avec des chiffres, et une fiche quand elle mesure.

| Code | Mission | Entrées | Livrable | Porte | Niveau / effort | Jetons | Attend |
|---|---|---|---|---|---|---|---|
| RM-1 | **Première ADV de la partie 11** (6362–6424) : pourquoi « rail de plus » ne la voit pas ; variante du détecteur (seconde alerte, forme du cœur, écartement) | nuages de la partie 11 (banane-data), ADV notées par Mic (parties 11, 15, 16, 29), `DETECTION_ADV.md` § 6 | mesure ; variante en ombre si elle tient | la zone détectée **sans fausse zone nouvelle** sur toutes les parties d'apprentissage ; rappel et fausses alertes de DETECTION_ADV § 6 inchangés ou meilleurs | rapide / haut ; **fort relit** (touche la sélection) | 300 k + 100 k | rien |
| RM-2 | **Marges de zone d'après les notes de Mic** : entrée d'ADV (il commence avant la première alerte), fin (8309 contre 8290), chaînage, PN pris pour une ADV (partie 16, 1678–1702) | notes de Mic archivées (parties 11, 14, 15, 16, 29), tables sans lot | proposition de marges, par zone | aucune correction de Mic de plus de 10 mm hors zone + marge sur ces parties, sans doubler le temps de relecture | rapide / moyen | 200 k | rien |
| RM-3 | **Verts hors zone** : les grosses corrections verticales hors de toute zone (40 dans l'étude, 7 sur les parties 14 à 16) ; la règle prudente chaîne + hauteur apprise serait-elle sûre sur « vert hors zone » ? | cas des parties d'apprentissage, `relecture-autonome.cjs etudier` | mesure en validation croisée ; réglage proposé fermé par défaut | 0 mauvaise voie ; erreur ≤ 9 % (Wilson) ; sinon reste en ombre | rapide / moyen | 250 k | rien ; **Mic décide** l'ouverture |
| RM-4 | **Abstentions en zone** : classer les abstentions du moteur sur toutes les parties (écartement hors contrat, rail absent, ambiguïté, sommet, flanc) et la part des grosses corrections perdues par cause | cas de toutes les parties | table par cause et par zone ; entrée de G1-a | table publiée | rapide / bas | 150 k | rien |
| RM-5 | **Mesure terrain de la test 8** : à chaque couple lot + Écho en mode corriger, cuts corrigés par Ariane repris par Mic (> 5, > 10 mm), oublis, durée | jointure (existe) | outil `bilan-relecture.cjs` (table), puis une ligne par partie | tableau publié à chaque export | rapide / moyen pour l'outil, puis éclair / bas | 150 k, puis 30 k par export | premier export test 8 |
| RM-6 | **Métriques par zone à chaque version** (E5 branché) : erreur médiane et P90 par zone (PN, ADV, abords, hors), différés par cause, faux verts, sur les tables avec et sans lot | E5, tables | `tools/metriques-zones.cjs`, section dans la fiche de version | calculées sur tous les Échos archivés | rapide / moyen | 200 k | RM-4 |
| RM-7 | **Hauteur apprise au lot** : juger l'ombre (`ombreVerticaleRefusee`, hauteur apprise) sur les lots des parties 10 et 11 et les suivants, contre les Échos | journaux des lots, Échos | mesure ; proposition d'activation réversible (`appliquer:true`) pour une test 9 | 0 nouveau faux vert ; gain net sur les parties jugées | rapide / moyen ; **fort relit** | 150 k + 100 k | Échos de lots ; **Mic décide** |
| RM-8 | **Voie prédite et mémoire des différés** : juger les deux ombres sur les premiers couples lot + Écho du second projet (parties 2 à 9) ; si la règle sûre tient, concevoir « déplacer la vue » (action nouvelle dans ESV) | Échos des parties 2 à 9 (à recevoir), `VOIE_PREDITE.md`, `OMBRES_VOIE.md` | mesure ; fiche de conception de l'adaptateur | règle sûre tenue sur les parties jugées (VOIE_PREDITE « règle sûre ») | rapide / moyen (mesure) ; **fort / haut** (conception) ; relecteur fort | 200 k + 150 k + 150 k | Échos du projet 2 ; **Mic décide** l'action dans ESV |
| RM-9 | **Fusions** : `claude/50-relecture-couverture` → `claude/50-base` après un premier couple lot + Écho de la test 8 sans régression (RM-5) ; `claude/50-compteur-gcv2` → `claude/50-base` (outils seuls) | RM-5, accord de Mic | fusions, verify complet | 0 échec ; moteur identique à la base V4.6.0 | éclair / bas | 60 k chacune | RM-5 ; **Mic** |
| RM-10 | **Manifeste** : écrire la rotation du § 1 (examen → apprentissage, témoins 1:25 et 1:11) ; passer 1:14, 1:15, 1:16 et 2:10 en apprentissage (jugées en D-189 et D-190, aucun réglage changé) | § 1, D-189, D-190 | `datasets/manifeste-parties.json`, essai | essai « 0 fuite » passe | éclair / bas | 40 k | **Mic** confirme le passage |
| RM-11 | (facultatif) **Raison de la correction** (E3) : pastilles sur le panneau en Écho (rail voisin ou ADV, PN, nuage diffus, autre, bon tel quel), consignées dans la visite ; étiquettes de raison pour la GCV2 | D-112, E3 du cahier | panneau, essai | ≥ 80 % des corrections étiquetées sans ralentir Mic | rapide / moyen | 250 k | **Mic décide** s'il veut cliquer |

Ce qui ne figure plus : la SKIP « un seul scanner » (ne se mesure pas, Mic dit de ne pas en tenir compte) ; « laisser les zones à Mic » (refusé, D-168) ; le plafond de 40 en ADV, le cut isolé et la liste entière (faits dans la test 8).

## 4. Missions GCV2

Conception : `fiches/G0_GCV2_CONCEPTION.md`. En une phrase : la GCV2 ne remplace pas le moteur de géométrie, c'est la couche qui **choisit, corrige et doute** au-dessus de lui, apprise sur les corrections de Mic, avec des garde-fous qui ne s'apprennent pas.

| Code | Mission | Livrable | Porte | Niveau / effort | Jetons | Attend |
|---|---|---|---|---|---|---|
| G0 | Conception (fait le 19/10) | `G0_GCV2_CONCEPTION.md` | relue par Mic | le plus fort / haut | fait | — |
| G1-a | **Jeu d'hypothèses** : `tools/gcv2-jeu.cjs` : une ligne par (partie, cut, rail, hypothèse) avec les traits sans fuite et l'étiquette (écart à la pose finale de Mic) ; **rappel atteignable** (part des grosses corrections pour lesquelles une hypothèse au moins est à 10 mm) | jeu `.jsonl` hors dépôt (bords des rails), fiche des comptes, essai anti-fuite | rappel atteignable publié par zone ; **≥ 60 %** sinon l'étage des hypothèses s'enrichit avant tout apprentissage | rapide / moyen ; **fort relit** l'anti-fuite | 400 k + 100 k | G0 relue |
| G1-b | **Apprentissage** : `tools/gcv2-apprendre.cjs` (Node pur, aucune dépendance) : régression logistique calibrée, option petits arbres, validation croisée par partie, seuils τ et δ ; export `datasets/gcv2-parametres.json` (coefficients, seuils, version, parties, empreinte du jeu) | paramètres, fiche de résultats | en validation croisée : **0 mauvaise voie**, erreur ≤ 9 %, corrections justes ≥ règle prudente, abîmés ≤ | rapide / haut ; **fort relit** la méthode | 600 k + 150 k | G1-a |
| G1-c | **Jugement** : `gcv2-juger` sur les réservées et les deux témoins, par zone, contre GCV1 + règle prudente (D-190 comme référence) | fiche, décision | porte du cahier : erreur médiane ≤ GCV1 par zone, différés ≤, 0 mauvaise pose ajoutée | rapide / bas ; **fort décide** | 150 k | G1-b |
| G1-d | **Module et ombre** : `src/gcv2.js` (pur, le même code hors ligne et en ligne) ; ombre `gcv2-ombre` dans le lot et la relecture ; preuve « sans effet » ; concordance rejeu = ombre | module, essais, fiche | pose inchangée (preuve) ; concordance 100 % ; ≤ +0,3 s par cut | rapide / haut ; **relecteur fort obligatoire** (décision de pose) | 700 k + 200 k | G1-c |
| G1-e | **Ombre au terrain** sur au moins deux lots et leurs Échos ; bilan | tables, décision | GCV2 en ombre ≥ GCV1 sur le terrain, 0 mauvaise voie | éclair / bas ; fort décide | 100 k | G1-d, terrain |
| G2 | **Activation réversible** : réglage `gcv2.actif`, par zone et par rôle (relecture d'abord, lot ensuite), retour GCV1 en un clic ; consigne ; version de test | réglage, essai, consigne | essai ; séance de terrain | rapide / moyen ; fort relit | 150 k + 50 k | G1-e ; **Mic active** |

Total GCV2 : ≈ 2,1 M au niveau rapide et ≈ 0,7 M au niveau fort, hors orchestration. G1-a peut commencer tout de suite (les données existent) ; RM-4 l'alimente ; RM-1 et RM-2 tournent en parallèle sur une autre branche.

## 5. Niveaux : attribution et règles de passage

| Niveau | Missions |
|---|---|
| **éclair** (bas) | archives, compteur, jointures, bilans par export (RM-5 en régime), fusions sans logique nouvelle (RM-9), manifeste (RM-10), ombre au terrain (G1-e), paquets et SHA |
| **rapide** (bas à haut) | toutes les mesures et tous les outils hors ligne (RM-2, RM-3, RM-4, RM-6, RM-7, RM-8 mesure, G1-a, G1-b, G1-c), le code des modules (G1-d, G2, RM-11) |
| **fort** (haut) | l'orchestrateur du cycle quotidien et de la GCV2 (briefs, lecture des tables, décisions, synthèses pour Mic) ; relecteur de tout diff qui touche la sélection, la décision de pose ou le code gelé (RM-1, RM-7, G1-a anti-fuite, G1-b méthode, G1-d, G2) ; conception de RM-8 |
| **le plus fort** (haut) | seulement sur décision de Mic : arbitrage si la validation croisée de G1-b contredit la conception G0, ou refonte de la conception |

**Règle de Mic (D-194)** : une petite tâche qui touche le code ou un essai part au niveau rapide, jamais chez l'orchestrateur. **Astra** (relecteur externe, via Mic) audite les premiers résultats d'apprentissage : entre G1-b et G1-c.

Règles de passage : une mission monte d'un niveau quand elle touche la pose, la décision ou le code gelé, ou quand le développeur est bloqué deux fois ; elle ne descend jamais sous le niveau de sa relecture. Le brief est complet d'emblée (but, fichiers, règles absolues, porte, format du rapport) ; les rapports sont des tables ; aucun gros fichier lu en entier ; verify une fois par commit.

## 6. Le modèle de la session GCV2

Recommandation pour la session que Mic va lancer :

- **Session (orchestrateur et relecteur) : niveau fort, effort haut.** C'est le poste qui écrit les briefs, relit les diffs de G1-d, lit les tables et décide. Une erreur à ce poste coûte une séance de terrain.
- **Développeurs : niveau rapide, effort moyen** (haut pour G1-b et G1-d), en sous-agents ou sessions distantes, un chantier par branche et par worktree.
- **Mécanique : niveau éclair, effort bas** (archives, compteur, verify, paquets).
- **Le plus fort : pas pour développer.** La conception est faite (G0) ; il revient sur un seul point de passage, après les résultats de G1-b, si Mic le demande.

## 7. Ce que Mic décide

1. La relecture de `G0_GCV2_CONCEPTION.md` (forme retenue, ordre relecture puis lot, témoins 1:25 et 1:11).
2. Le passage en apprentissage des parties 14, 15, 16 et 10 (RM-10).
3. L'ouverture éventuelle des verts hors zone (RM-3), l'activation de la hauteur apprise au lot (RM-7), l'action « déplacer la vue » dans ESV (RM-8), la raison de la correction (RM-11).
4. Les fusions dans `claude/50-base` (RM-9) et, le moment venu, l'activation de la GCV2 (G2). Fusion dans `main`, étiquette et publication restent à lui.
5. La zone 4006–4071 de la partie 16 (ADV ou non), le final de la partie 15.

## 8. Calendrier indicatif (le terrain fixe le rythme)

| Semaine | Règles métier | GCV2 | Terrain |
|---|---|---|---|
| 19–25 octobre | RM-1, RM-2, RM-4, RM-10 ; RM-5 à chaque export | G1-a (rappel atteignable), début de G1-b | test 8 en « Corriger » et en « Ombre » sur des parties neuves ; Échos |
| 26 octobre – 1er novembre | RM-3, RM-6, RM-7 ; RM-9 (couverture) si RM-5 est propre | G1-b, G1-c | Échos du projet 2 (parties 2 à 9) si Mic les a |
| 2–8 novembre | RM-8 (mesure, puis conception si la règle tient) | G1-d, relecture forte | test 9 (hauteur apprise au lot si RM-7 tient) |
| 9–15 novembre | fusions restantes | G1-e en ombre sur deux lots ; G2 préparé | lots en ombre GCV2, Échos |

Chaque version de test ne porte qu'une nouveauté active ; tout le reste est en ombre ; l'export est analysé avant la version suivante (cahier § 6).
