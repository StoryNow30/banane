# Développeur 1 — débloquer l'identification de la version de test V1

4 octobre 2026. Même développeur 1, même chantier et même préparation autorisée par Mic. Lire cette consigne, le traitement de l'orchestrateur, puis ton rapport de préparation intact joint. D-073 demeure inchangé et figure dans les pièces.

## But

Préparer une version de test que le manifeste, le code, les affichages et les exports identifient correctement. La mission précédente autorisait le manifeste seul alors que le banc exige la cohérence de toutes ces identités : le périmètre était insuffisant. Ce complément autorise uniquement l'alignement des métadonnées de version et des contrôles qui leur correspondent, puis la génération du paquet. Aucun travail de pose ou accélération, aucune réouverture des deux corrections V1 closes.

L'orchestrateur a reproduit les cinq échecs sur les quatre fichiers concernés : 39 tests, 33 réussis, cinq échecs, un sauté pour le corpus privé absent. Le banc complet du développeur reste une preuve distincte : 1 060 réussis, cinq échecs, deux sautés, mode partiel. Un échec de version bloque le commit ; ne pas le supprimer ni présenter le paquet comme prêt.

## Reprise exacte

- Base : v4.8.6, 042aee649bc25b89c46a26def481f87f46d047ac.
- Candidat V1 relu : baa548d81a0bf7059ae1711163527a918cf2257d ; arbre 69aad6bcd0d8e63116c8491339ff7d46b43bd3d3.
- Retour de préparation intact joint : SHA-256 d664ea7c54f438b8133fdc6bfdc590bfbcc449e8dac842473cbf24f4e7e9aea1.
- Branche locale annoncée : sol/v1-preparation-test-2026-10-04 ; HEAD corrigé, préparation non commitée. Aucun paquet installable existant.

Réutiliser le vrai dépôt, les objets Git et les documents de préparation déjà présents. Vérifier le diff initial et l'intégrité des pièces. Le retour joint contient ton delta non commité, le bundle original, la livraison corrigée et les consignes ; ne pas recopier une nouvelle base complète. Ne pas appliquer le même delta deux fois. Si la session a perdu son checkout, restaurer depuis les vrais objets parent et corrigé déjà identifiés, puis appliquer le delta une fois. Une archive de fichiers seule ne recrée pas un objet Git parent. Ne pas inventer un commit annoncé.

La version 4.9.0.1 / « 4.9.0 test 1 » reste le candidat local proposé, absent de l'inventaire des 56 références lues. La réservation globale des numéros non publiés n'est pas confirmée. Préparer localement avec ce numéro, l'indiquer comme proposé et non déployé ; ne pas bloquer l'alignement et les contrôles sur ce point administratif. Toute collision connue doit être signalée avant installation.

## Périmètre autorisé par l'orchestrateur pour cette préparation

| Fichier | Seul changement autorisé |
|---|---|
| manifest.json | version, version_name, libellé informatif action.default_title, déjà proposés ; aucun autre champ |
| src/core.js | les valeurs des constantes VERSION et VERSION_NAME uniquement |
| background.js | les deux chaînes de repli VERSION et VERSION_NAME à la ligne 17 uniquement |
| src/bridge.js | le texte du bouton « Ariane ... · ouvrir » à la ligne 88 uniquement |
| panel.html | version dans title, bandeau et footer, sans structure ou mise en page modifiée |
| panel.js | le libellé home du tableau SOUS à la ligne 82 uniquement |
| tests/cohabitation-485.test.cjs | attentes de version/nom/affichage et références de version courante devenues obsolètes ; conserver les essais de cohabitation et toutes leurs garanties |
| tests/package.test.cjs | contrat de numérotation stable/test et cohérence des identités ; conserver contenu du paquet, permissions et contrôles de sources |
| tests/revue-globale-485.test.cjs | seulement une adaptation de contrat de version indispensable ; ses contrôles existants de cohérence doivent rester |
| tests/settings.test.cjs | assertion de format/cohérence de version, sans réglage modifié |
| Documents et sorties de vérification | avenant intact, méthode, fiches, rapport, historique des échecs et preuves de préparation |

Les lignes indiquées sont celles du candidat baa548d8. Si un autre littéral courant nécessaire est découvert, en donner le fichier, la ligne et l'effet avant de modifier un fichier hors tableau. Ne pas faire de remplacement global de « 4.8.6 » : commentaires historiques, références de banc et fixtures de versions antérieures restent historiques.

Coordination D-072 : pour ce complément, développeur 1 reçoit les seuls littéraux de version de panel.js/panel.html sur sa branche V1. Le résumé U1 et le panneau U2 ne sont pas intégrés ou modifiés ; les autres lignes du panneau restent sous leur responsabilité. La future intégration devra préserver la même identité de version sur la branche d'assemblage, sans appliquer un vieux fichier complet de panneau à la place du nouveau. Aucun travail concurrent sur ces mêmes littéraux dans ce checkout.

Gels absolus : engine, géométrie, cerveau, décision de lot, adaptateur ESV, garde de propriétaire, commandes et stockage métier inchangés. Aucun changement d'algorithme, seuil, ordre, instrumentation, règle coverage.complete, budget de 250 ms ou outil tools/package.py. Pas de baseline ou d'empreinte gelée réécrite pour obtenir un succès. Le changement des versions peut modifier les étiquettes des exports et messages ; le documenter comme identité du produit testé, pas comme nouveau résultat de pose.

## Contrôles qui doivent rester utiles

Adapter les tests de version pour qu'ils vérifient un contrat réel de cohérence, pas simplement la nouvelle constante copiée dans chaque assertion. Conserver les cas stables historiques séparés et tester le nom de test exact associé au quatrième numéro. Une version ou un nom incohérent doit être refusé. Ne pas accepter n'importe quelle chaîne ou retirer les assertions pour obtenir zéro.

Conserver les garanties de cohabitation avec la stable 4.8.0, avec une autre version de la même extension et avec un propriétaire étranger : refus avant injection, absence de commande ESV étrangère, protection et message de rechargement inchangés dans leur sens. Les attentes portant sur la version courante peuvent utiliser VERSION/VERSION_NAME ; les fixtures d'une autre version gardent leur rôle. Examiner aussi les assertions suivantes du même fichier qui portent littéralement 4.8.6, pas seulement les deux premiers échecs.

Garder le résultat rouge du retour de préparation. Vérifier le diff à la fois depuis l'arbre de préparation non commité et depuis baa548d8 : seuls les littéraux autorisés, tests de version, métadonnées et documents changent. Donner un tableau de chaque littéral modifié, son ancienne/nouvelle valeur et sa fonction. Les blocs d'instrumentation et les règles de pose doivent rester identiques.

Rejouer les quatre fichiers de tests version/cohabitation concernés et les contrôles V1 pertinents, puis node tools/verify.cjs à zéro échec avant chaque commit. Les tests sautés restent distingués des réussites, le mode partiel est explicite. Ne pas augmenter les délais du banc ou lancer les deux bancs simultanément pour masquer un problème de charge.

Conserver les preuves J1 du candidat corrigé du 3 octobre, datées, comme preuve de comportement de ce code. Le nouveau paquet doit être relié à ce candidat par le diff limité. Ne pas prétendre un J1 neuf ni remplacer la référence historique 4.8.0. Vérifier et documenter si le changement de version n'affecte que des métadonnées des sorties ; aucune différence de décision ne peut être tolérée. Si une différence métier, une rupture de provenance ou un effet au-delà des métadonnées est trouvé, arrêt et signalement précis ; aucun périmètre élargi silencieusement.

## Commit et paquet

Après les contrôles, faire le commit local de préparation descendant du vrai candidat corrigé, avec les documents et la version. Conserver les fichiers rouges en preuves datées, sans les présenter comme le résultat final de verify.

Générer depuis git archive <commit_de_preparation>, extraction neuve puis tools/package.py inchangé. Donner commit, arbre, version, commande exacte et SHA-256. Vérifier CRC, manifeste unique à la racine, tous les scripts requis, identité cohérente et absence de données privées. Les documents que le générateur exclut restent joints dans le ZIP de livraison, pas ajoutés manuellement dans l'extension après sa génération.

Aucun push, fusion, étiquette, publication ou dépôt dans banane-data. Aucun navigateur, essai ESV ou test sur le PC de Mic. Aucun développement U1/U2/V4/V3, apprentissage ou nouveau chantier.

## Fiche de mesures

Conserver ta proposition 50/50/150 coupes comme PROPOSITION, sans la transformer en programme adopté : aucun lot, projet, partie ou seuil de dérive n'est approuvé. Les deux règles D-073 concernent la présentation seulement ; coverage.complete reste inchangé. Après fermeture de ce blocage, l'orchestrateur fera examiner le paquet et regroupera les décisions pour les mesures. Le plan proposé ne lance aucune séance.

## Livraison

Remettre UN ZIP : Developpeur_1_V1_VERSION_TEST_CORRIGEE_2026-10-04.zip. Inclure résumé simple, paquet local de test s'il est réellement préparé, rapport du blocage résolu ou restant, fiches et D-073 intacts, tableau des littéraux, diff limité depuis baa548d8, objets Git/bundle avec prérequis exacts, preuves fraîches, historique rouge, commande de génération, README et SHA256SUMS.

Vérifier CRC et empreintes. Sauvegarder durablement et fournir un lien cliquable téléchargeable ; un chemin local ou « ZIP joint » ne suffit pas. Signaler précisément une sauvegarde échouée en conservant la copie. Puis arrêt pour contrôle de l'orchestrateur et relecture indépendante du nouveau diff limité. Le terrain reste non mesuré/non accepté. Ne pas se déclarer accepté et ne pas lancer la séance.
