# Développeur 1 — préparation V1 arrêtée sur la porte de version

Mission du 4 octobre 2026. **Le paquet installable n'est pas préparé : verify échoue avec les seuls changements de manifeste autorisés. Aucun commit de préparation n'est créé.** Le moteur, scripts, outils et tests restent ceux du candidat corrigé relu ; le travail documentaire est remis comme diff local pour examen.

| État | Résultat |
|---|---|
| Développement V1 | Recevable pour préparation selon relecture indépendante et D-073 ; deux réserves techniques closes sur les chemins examinés. |
| Paquet de test | **Non préparé**. Version proposée 4.9.0.1 / « 4.9.0 test 1 », locale/provisoire ; 5 échecs verify interdisent le commit puis la génération depuis ce commit. |
| Terrain V1 | **Non mesuré / non accepté**. Aucun navigateur, ESV ou essai sur le PC de Mic lancé. |

## Blocage concret et limite de périmètre

La mission autorise documents et champs de version uniquement, avec tous les scripts et tests identiques au candidat corrigé. Le manifeste local porte version=4.9.0.1, version_name=« 4.9.0 test 1 » et le libellé informatif action.default_title ; les autres champs sont identiques. Mais les tests existants imposent encore une stable 4.8.6, l'absence de version_name, le nom de paquet stable et la cohérence avec src/core.js, panneau et bridge.

`node tools/verify.cjs`, exécuté ici une fois avec Node v24.19.0, du 2026-10-04T06:27:12.046429Z au 06:28:17.860181Z : **code 1, 1067 tests, 1060 réussis, 5 échecs, 2 sautés, 0 annulé**. Les deux sautés correspondent au corpus Natif privé absent, pas à des réussites. Le banc est partiel. Sources fraîches : preuves/verify-preparation-execution.json, preuves/verify-preparation-comptes.json et preuves/verification-preparation.txt.

| Échec | Source du contrat inchangé |
|---|---|
| Stable exigée 4.8.6, sans version_name, affichée partout | tests/cohabitation-485.test.cjs:12-20 |
| Nom de paquet stable exigé ariane-v4.8.6.zip | tests/cohabitation-485.test.cjs:22-33 |
| Manifeste égal à core.VERSION, version 4.8.x et affichages cohérents | tests/package.test.cjs:5-17 |
| VERSION_NAME et affichages égaux au manifeste | tests/revue-globale-485.test.cjs:71-79 |
| Version officielle égale à core.VERSION, version 4.8.x | tests/settings.test.cjs:95-101 |

Ces cinq échecs sont dans les sorties complètes et leurs extraits (preuves/echecs-version-extraits.txt). `tools/verify.cjs:22-29` quitte au résultat des tests : ses vérifications suivantes de syntaxe/gel/baseline **ne sont pas exécutées dans ce passage**, et `audit/verification.json` n'est pas réécrit ; il reste historique, non livré comme résultat frais. L'intégrité octet pour octet ci-dessous est un contrôle distinct, pas un succès global verify.

Changer tests/core/affichages sortirait du périmètre actuel. Aucun test supprimé, résultat masqué, version interne harmonisée ou moteur modifié. La prochaine décision doit cadrer les métadonnées internes/affichages et les tests de version concernés, avec coordination des fichiers réservés par D-072 ; ce rapport ne demande pas de rouvrir les chronomètres ou les deux corrections closes. Garder le manifeste en 4.8.6 ne satisferait pas la livraison 4.9.0.N demandée.

Faute du zéro échec obligatoire, aucun commit, aucune extraction d'un commit de préparation et aucun paquet installable ne sont remis. Les contrôles CRC/manifeste unique/scripts du **paquet de test** sont donc non exécutés. Le test de construction temporaire du banc peut passer ; il n'est pas le paquet de transmission issu d'un commit. Aucun remplacement par une archive fabriquée depuis un arbre non commité. `tools/package.py:63-75` accepte déjà le nom 4.9.0 test N ; le générateur n'est pas modifié.

## Références et provenance rétablies

L'entretien automatique avait supprimé le checkout précédent. Un clone Git récupère les véritables objets, puis le bundle de correction fourni est vérifié et importé une fois ; aucun commit n'est fabriqué sous un SHA annoncé. Base/tag v4.8.6 = **042aee649bc25b89c46a26def481f87f46d047ac** ; HEAD corrigé = **baa548d81a0bf7059ae1711163527a918cf2257d** ; arbre = **69aad6bcd0d8e63116c8491339ff7d46b43bd3d3** ; parent exact = 042aee64… ; origin/main documentaire = **18a355eb02a00b20b2adaeb1d84648854664972e**. Ces références restent distinctes. La branche locale isolée est sol/v1-preparation-test-2026-10-04 ; aucune écriture dans main.

Le ZIP base historique c96278b4… n'est pas téléchargé ni annoncé revalidé ici : les vrais objets Git parent/code suffisent à rétablir cette chaîne, et la livraison corrigée jointe donne le candidat. Bundle original conservé, prérequis parent 042aee64… explicitement nécessaire pour import. Commandes réellement exécutées et objets : COMMANDES.md, preuves/commit-corrige.txt, preuves/arbre-corrige.txt, preuves/provenance-git.json et journaux d'import.

Intégrité des pièces reçues : ZIP de mission 704940618f78c770beffe3dd2a4ca445dd9ed45f83ee8ae17f3126a42e8bd3b9 ; correction 863ea03e77a5bb18d2ad9d2998cef59cc27b267c8785df444c804f41f7111145 ; relecture 6fe2b89dfdd17cc51ac40f25eedef37d072f527ead3f86edc422a6bb53df48db. CRC et SHA256SUMS internes contrôlés ; 329 empreintes de correction conformes. Les archives historiques sont conservées intactes autour du delta, aucune nouvelle base entière n'est recopiée.

## Changements locaux et intégrité

Avant préparation, les 16 fichiers protégés/associés et 5 empreintes V1 correspondent à la livraison corrigée. Après préparation : **15/16 protégés restent identiques**, le manifeste constitue la seule exception de métadonnées expressément autorisée ; **5/5 scripts V1 identiques**. Sur les **589 fichiers** de l'arbre corrigé, **587 sont identiques** ; seuls manifest.json et audit/verification.txt changent. Les nouveaux fichiers sont l'avenant D-073 et les documents de préparation. Tous les scripts de production, outils et tests restent inchangés. Sources : preuves/integrite-avant.json, preuves/proteges-v1-apres.json, preuves/arbre-integrite-apres.json ; delta/PREPARATION-NON-COMMITEE.patch.

L'inventaire récupéré lit les manifestes de **56 références Git** (branches distantes et tags) ; aucune ne porte 4.9.0.1. La direction n'a pas fourni le registre des réservations non publiées : **numéro proposé localement, réservation globale non vérifiée**, aucun déploiement implicite. Source : preuves/versions-connues.json.

D-073 copié intact dans consignes/avenant-D073-presentation-mesures-v1-2026-10-04.md, sans modifier cahier, DECISIONS ou historiques. Le registre du code comporte D-065 comme dernier numéro ; D-066 à D-072 absents ne sont pas inventés. Les pièces originales fournies sont conservées en sources/consignes-originales ; leur intégration et celle de D-073 au registre partagé restent à versionner par la direction. Cet avenant local reste **non commité** puisque verify a échoué.

## Anciennes preuves utilisées, distinctes des contrôles frais

Les chronomètres et décisions restent ceux du candidat relu. **Aucun nouveau J1 ni rejeu privé exécuté ici**, aucune différence de comportement ou rupture de provenance ne l'imposant. Les preuves fournies du 3 octobre sont conservées et datées :

- J1 référence 4.8.6 démarré 17:32:28.307693Z, 780,429 s, code 0 ; candidat démarré 17:48:44.906239Z, 836,975 s, code 0. Comparaison intégrale dérivée : 633 lignes de validation, 8 jeux a–h, 13 sessions/1398 lignes ; 12 sorties secondaires identiques, relevés égaux hors code/faitLe. Empreintes rattachent l'arbre instrumenté au vrai commit baa548d8 (pas une exécution prétendument post-commit).
- Verify développeur du 3 octobre à 18:03:43.093750Z : 1067 tests, 1065 réussis, 0 échec, 2 sautés, code 0, mode partiel ; 43 tests ciblés réussis. Ce résultat ancien ne couvre pas le manifeste proposé aujourd'hui.
- Relecture indépendante du 3 octobre : 43 ciblés réussis, verify partiel 1065/0/2 ; J1 contrôlé sur sorties dérivées, corpus privé **non rejoué** ; elle n'avait pas le parent Git pour importer le bundle. La trace orchestrateur contrôlait le véritable objet commit ; l'import parent est prouvé séparément ici.

Sources : historiques/META-CORRECTION.json, historiques/comparison-j1.json, historiques/RAPPORT-RELECTURE.md et archives/Developpeur_1_V1_CORRIGE_2026-10-03.zip (preuves et consignes intactes). P2 accepté : aucun recalcul P2 ni mission P2 rouverte.

Le rapport V1 conservé est joint intact, ainsi que PREMIER-RAPPORT-RECONSTITUE-ET-INVENTAIRE.md. Ce dernier signale que le premier rapport original du contrôle préalable n'était pas récupérable (ancienne tentative 502). Il n'est pas annoncé original. Les preuves conservées de p11 altéré et de son échec sont jointes ; les octets privés de l'ancienne copie altérée ne sont pas présents dans cette livraison reçue et ne sont pas fabriqués. Aucun export brut n'est placé dans ce ZIP.

## Préparation documentaire et questions restantes

FICHE-MESURE-PROPOSEE.md expose le but de chaque action, les lots proposés 50/50/150 à faire adopter, les exclusions/réservations, conditions machine/ESV, contrôles initiaux/arrêts, métriques, coût de mesure et limites. ATTESTATION-LOT.md relie explicitement identité déclarée et tous les fichiers/segments effectivement enregistrés. La méthode corrigée et la proposition historique restent intactes, joints à côté.

La lecture des chemins existants confirme que Journal et Bilan conservent événements V1 et v1TimingExport ; conserver les bruts, tous les segments et métadonnées. Le budget segmenté ne garantit pas une taille maximale ni un seul fichier ; le journal n'est pas segmenté. Réducteur Relecture supprime les événements : aucune version allégée pour cette étude. Sources : panel.js:633-695,931-946,970-992 ; background.js:921-926 ; tools/reducteur-exports-core.js:34-74 ; KNOWN_ISSUES.md:36,50-51. Cette lecture n'est pas un essai IndexedDB/navigateur.

D-073 organise la présentation seulement : pas de projectId inventé, pas de zéro artificiel pour chevauchement, aucun assouplissement de coverage.complete (tools/perf-phases.cjs:64-80). Les critères proposés pour une future admission déclarée/chevauchée exigent décision distincte ; pertes, conflits, ambiguïtés et écritures non prouvées restent incomplets. Bornes D5/V1 séparées ; 48 %/63 % historiques non confirmés/infirmés ; après pose = état, pas LiDAR ; coût asynchrone inconnu. KI-069 documenté, inchangé.

À décider : périmètre précis pour résoudre le blocage version, réservation de numéro, nombre/taille/budget/projets/parties des lots, accès/séance terrain, éventuelle admission de catégories à la porte. A/A puis blocs alternés et tolérances liées au bruit restent à cadrer avant V3. Inventaire D-067 après acceptation V1 avant V2 ; aucun inventaire, intégration U1/U2/V4, V2/V3/V5 ou apprentissage lancé ici.

Le ZIP de retour et tous ses fichiers sont vérifiés CRC/SHA-256 et sauvegardés. Arrêt pour examen du blocage et relecture du delta local. Aucun commit, push, merge, tag, publication, écriture banane-data ou essai ESV effectué.
