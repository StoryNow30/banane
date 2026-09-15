# Phase A : audit préalable Banane V3 TEST

Audit effectué le 9 septembre 2026 avant le code de l'extension V3.
`banane_v3_corpus.zip` contient des données et scripts d'analyse, aucun manifest
d'extension. Le paquet V2.4.2 et ses sources sont disponibles séparément ; cette
base est conservée intacte. L'inventaire détaillé est dans `audit/inventory.md`
(chemin, type, taille, validité JSON, rôle, métadonnées) et `inventory.json`,
avec les listes internes des douze archives inspectées et les SHA-256.

## A1. Sources et exclusions

78 fichiers sources, paquets et éléments de corpus inventoriés. Paquets observés :
V2, V2.1 (deux archives), V2.2, V2.3, V2.3.1, V2.4, V2.4.1, V2.4.2. La V2.4.2
locale contient le correctif de collecte et ses 32 tests ; aucun travail de
correction de son bug historique n'est requis. Les modules de calcul de matrices
et d'export LiDAR seront repris. La nouvelle session applicative remplace le
panneau de collecte pour permettre persistance et pilotage externe.

`upload/banane-references-1788886355979.json` est invalide : chaîne non terminée,
ligne 1422, colonne 15, caractère 35220. Son contenu tronqué est exclu ; aucune
statistique historique de 35 références n'est substituée aux données lisibles.
Les directives R2_D_05 et R2_I_06 sont disponibles en DOCX et en extraction texte.
Aucun HAR, source JavaScript natif ESV ou contrat API de validation n'est présent.

## A2. Identité et correspondance

Règle : associer un LiDAR et une référence par `lidarCaptureId`, vérifier part,
cut, profil, session, visite, repère et états initiaux, puis garder la correspondance
des rails indépendamment de leurs positions et de l'ordre des objets.

| Donnée | Rôle constaté | Limite |
|---|---|---|
| part + cut | Cible dans le contexte ESV ouvert | Aucun identifiant de projet observé ; pas une clé globale |
| shape | Type de profil, U50 dans le corpus apparié | Paramètre de contexte, pas un identifiant de cut |
| captureId / lidarCaptureId | Lien explicite LiDAR / référence | Ne prouve pas un enregistrement serveur |
| sessionId / visitId / sceneFrameId | Contexte et repère des captures | Change après rechargement ou reconstruction ; ne pas utiliser pour confondre deux projets |
| recordId | Déduplication d'opérations | Un export cumulatif n'est pas une nouvelle opération |
| matrices / coordonnées / rotation | État mesurable et mutable | Ne doivent pas invalider une correction légitime |
| suffixe / timestamp / ordre des objets | Présentation ou propriété volatile | Aucune autorité d'identité |

Le sens G/D est la convention ESV des exports. Sur les dix couples U50, le
contour gauche a un centre Y local positif et le droit négatif : c'est une
signature géométrique observée des dessins miroirs, pas une règle universelle.
L'adaptateur réel utilisera cette signature lorsqu'elle est non ambiguë, puis
conservera les correspondances d'objets. Une permutation de liste est tolérée ;
un remplacement d'objets doit être reconnu sans ambiguïté ou suspendre l'écriture.
La cible réelle est bornée à l'onglet/page de test choisi et à part/cuts affichés.
Après rechargement, aucun lot ne reprend silencieusement : projet serveur inconnu.

## A3–A4. Couples et comptages

Définition : un couple est une référence explicite contenant deux états sur le
même cut/profil, indépendamment du nombre de fichiers. Une seule correction
observée constitue un couple partiel quant aux rails modifiés ; zéro mouvement
ne prouve pas qu'un rail a été contrôlé. Le LiDAR et sa densité sont un axe séparé.

| Part/cut | LiDAR avant | Référence contenant l'après | Rails modifiés | Statut |
|---|---|---|---|---|
| 23/2855 | …1885642 | …1935420 et cumuls | G + D | Couple + géométrie |
| 23/2856 | …2234335 | …2279203 et cumuls | G + D | Couple ; droit moins chargé |
| 23/2857 | …2362360 | …2372337 et cumuls | G + D | Couple + géométrie ; suffixe 337 |
| 23/2858 | …2415172 | …2424049 et cumuls | G + D | Couple + géométrie |
| 23/2859 | …2465953 | …2475109 et cumuls | G + D | Couple + géométrie |
| 23/2860 | …2528253 | …2539498 et cumuls | G + D | Couple + géométrie |
| 23/2864 | …2588137 | …2596856 et cumuls | G + D | Couple + géométrie |
| 23/2865 | …2689157 | …2696962 et cumuls | G + D | Couple + géométrie |
| 23/2866 | …2754049 | …2761196 et cumul | G + D | Couple + géométrie |
| 23/2867 | Non fourni | …2963289 | G + D | Couple sans LiDAR |
| 23/2972 | …2957128 | …2963289 | G + D | Couple + géométrie |
| 23/1 | Identifié par captureId, non fourni | …1163692 | Aucun mouvement | Couple explicite sans LiDAR |
| 23/2854 | …1501408 et …1540787 | …1532178, récupération | G + D | Comparaison diagnostique, exclue de l'évaluation principale |
| 23/2852, 2853 | LiDAR avant fourni | Aucun après correspondant | Inconnu | Avant seul |
| 20/3392 | Exports 2.4 vides et 2.4.1 chargés | États corrigés décrits, pas de paire explicite liée | Non certifié | Diagnostic seulement |

Dans les neuf cumuls V2.4.2 du lot : 55 occurrences, 11 records uniques,
44 doublons retirés, 10 couples LiDAR/avant/après (20 rails), 1 couple sans
LiDAR, 0 couple ne modifiant qu'un seul rail, 0 capture déclarée incomplète.
En ajoutant les sources antérieures lisibles : 12 couples explicites uniques
(dont le cut 1 sans mouvement et sans nuage), plus une récupération 2854 ;
16 cibles part/cut identifiées. Le 2867 manque dans les LiDAR, pas dans les
références. Les suffixes 972/605 ne sont pas reçus. Aucun rapprochement par 049.

## A5. Workflow

Le workflow opérateur décrit reste G, d, D, Shift+Espace. Les anciennes sources
contiennent les boutons ESV `O2N3DCutLRClick`, `O2N3DCutRRClick`,
`O2N3DCutValidate3DRail`, `O2N3DCutNextInvalid3DRail` et un clic canvas projeté.
Ces éléments sont des traces d'intégration de versions précédentes, pas un essai
réel concluant de V3. Les commandes manuelles de capture conservent leur sens.
Export des références avant ou après validation possible si l'après a été acquis.

## A6. Géométrie et évaluation prévue

Les dix couples appariés décrivent des translations, avec matrices linéaires et
rotations inchangées. Axes conservés : X local longitudinal, Y latéral, Z vertical
du profil incliné ; unités métriques selon ESV, sans étalon indépendant. Les
ordres de grandeur du U50 et des points sont cohérents avec cette convention.
Le droit du 2856 ne contient que 25 points dans la fenêtre de champignon avant
(|Y|<100 mm, |Z|<40 mm et boîtes de découpe), contre 179 à gauche. Aucun seuil
de densité ne sera présenté comme preuve de précision ; les aberrants et la
présence des deux surfaces devront intervenir dans l'estimation.

Premier candidat : recherche géométrique robuste guidée par le profil exporté,
puis estimation des surfaces supérieure et interne sur plusieurs points. La
cible métier reste l'intersection des plans au milieu des nappes (R2_D_05), pas
un sommet de la polyligne. Comparaison à une base simple calculée uniquement sur
les exemples de réglage. Proposition calculée sans accès à l'après cible.

Réglage : 2855, 2856, 2857, 2858, 2859, 2860, 2864. Évaluation réservée pour ce
développement : 2865, 2866, 2972. Les métadonnées de tous ces exemples ont déjà
été inspectées ; aucun algorithme V3 n'a encore été réglé sur eux. Ce partage
reste minuscule et géographiquement corrélé. Il n'est pas une mesure de robustesse
générale. Les réglages finaux et résultats seront consignés séparément.

## A7. Architecture et décision

- Modules mathématiques et lecteur LiDAR issus de V2.4.2.
- Identité et adaptateur ESV dans le contexte principal de la page ; pont isolé
  vers le service worker, limité aux onglets ESV et aux actions connues.
- Géométrie pure, parser de corpus et comparaison indépendants de la page.
- Machine de collecte distincte de la machine de lot TEST ; vérification après
  chaque action et snapshot de restauration avant validation.
- IndexedDB côté extension pour les nuages et événements ; état léger dans
  chrome.storage.local. Pas de copie du nuage dans chaque entrée de journal.
- Fenêtre d'extension réouvrable par l'icône Edge, trois modes et pilotage du lot.
- Validation via commande native observée et lecture du changement de cible.
  Une navigation observée sera nommée ainsi ; sans contrat serveur identifié,
  aucune réussite de persistance serveur ne sera inventée.

Faits : sources accessibles, corpus apparié, translations mesurables, lecture
LiDAR démontrée par fichiers. Hypothèses : signature U50 G/D, disponibilité des
commandes natives dans ESV actuel, reconnaissance après reconstruction d'objets.
Blocages localisés : accès à une session ESV de test et preuve serveur absents.
Décision : poursuivre directement Phase B, implémenter les trois modes et tester
la chaîne simulée ; livrer l'intégration réelle comme non vérifiée jusqu'à l'essai
dans ESV. Aucune autorisation par cut ajoutée en automatique TEST.
