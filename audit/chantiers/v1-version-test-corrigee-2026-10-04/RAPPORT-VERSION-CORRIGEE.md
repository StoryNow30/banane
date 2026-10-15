# V1 — identification corrigée et préparation du test local

4 octobre 2026. Le blocage des identités de version est résolu dans le périmètre documentaire/métadonnées du complément. **Développement V1 recevable pour préparation ; contrôle de version passé ; terrain non mesuré/non accepté.** Le paquet local est généré depuis le commit de préparation exact : son état, commit/arbre et SHA-256 figurent dans les preuves de livraison associées, pas dans une identité Git inventée à l'intérieur de son propre commit.

## Correction et périmètre

Le premier cadrage limitait le manifeste alors que les contrôles exigeaient un accord avec core, replis du service worker, panneau et bridge. La nouvelle consigne consignes/mission-v1-identite-test-2026-10-04.md autorise les seules valeurs de version et attentes correspondantes. Manifeste **4.9.0.1** ; nom **4.9.0 test 1** ; code, affichages et exports alignés. Réservation globale des numéros non publiés non vérifiée : candidat proposé localement, aucun déploiement. Inventaire antérieur : 56 références Git, aucune collision 4.9.0.1 connue.

Le tableau TABLEAU-LITTERAUX.md indique chaque valeur modifiée, ancienne/nouvelle et fonction, avec lignes du candidat baa548d8. Aucun remplacement global : commentaires, fixtures étrangères 4.8.x et documents historiques conservés. Sur panel.html, seulement title/bandeau/footer ; sur panel.js seulement SOUS.home ; aucun résumé U1 ou travail U2 intégré. Coordination D-072 : le développeur 1 reçoit ces seuls littéraux ; la future intégration doit reporter ces valeurs, sans écraser un nouveau panneau avec notre ancien fichier complet.

Les cinq fichiers runtime concernés (src/core.js, background.js, src/bridge.js, panel.html, panel.js) redeviennent **identiques octet pour octet** à baa548d8 après neutralisation des seuls littéraux autorisés. Source fraîche : preuves/runtime-normalise-identique.json. Aucun budget, instrumentation, ordre d'import, commande ESV, garde de propriétaire, seuil, algorithme, placement, santé ni coverage.complete modifié.

## Contrôles de version utiles conservés

Les quatre fichiers annoncés ont été adaptés : cohabitation-485, package, revue-globale-485, settings. Le contrat indépendant impose une version MV3 à trois nombres pour stable, quatre pour test, noms exactement liés au quatrième numéro et composantes bornées. Les stables historiques 4.8.0/4.8.6 sont vérifiées séparément. Une version de test sans nom, un numéro/nom incohérent, un mauvais préfixe, une chaîne non numérique ou une composante hors borne sont rejetés. Les noms de paquet historiques restent testés et les mauvais couples version/version_name sont refusés par tools/package.py inchangé. Permissions/hôtes, contenu de l'archive et exclusion des fixtures gardent leurs contrôles.

Cohabitation : stable 4.8.0, autre version de cette extension (fixture 4.8.6.0), autre propriétaire et intrusion restent couverts : refus avant injection, aucune commande étrangère, mise en sécurité/rechargement et reprises conservés. Les anciens noms des fixtures 4.8.6.1/.2 restent exacts. Les expressions attendues échappent les points de VERSION_NAME ; seules les étiquettes courantes changent.

Cinq autres littéraux nécessaires ont été découverts et signalés **avant modification**, suivant la clause de la mission : tests/securite-pose-485.test.cjs:33, tests/cohabitation-p2-485.test.cjs:57, tests/relecture-4716-version-lot.test.cjs:13, tests/ki069-e-securite-486.test.cjs:11, tests/reprise-intrusion-485.test.cjs:13. Seules leurs attentes de nom/version courant changent. Les garanties de pose complète, validation refusée, aucune navigation/raccourci, propriétaire exact sur 20 entrelacements, version de création du lot et reprise restent intactes. Détails dans TABLEAU-LITTERAUX.md et preuves/remplacements-litteraux.json.

## Preuves fraîches

| Contrôle | Résultat |
|---|---|
| 18 fichiers ciblés, isolés, délai inchangé 7000 ms | 91 tests, 90 réussis, 0 échec, 0 annulé, 1 sauté (corpus privé absent) |
| Neuf fichiers V1 parmi ces ciblés | 43 tests, 43 réussis, aucun sauté |
| verify, Node v24.19.0, 04/10 07:11:33.063812Z → 07:12:41.942980Z | 1067 tests, 1065 réussis, 0 échec, 2 sautés, mode partiel, code 0 |
| Syntaxe et gels du verify final | 38 fichiers runtime ; géométrie inchangée ; moteur conforme baseline V4.6.0 |
| Gels/instrumentation/générateur relus par SHA-256 | 18 fichiers sensibles identiques à baa548d8 |
| Exports simulés journal-meta, dataset-meta, journal, dataset | version 4.9.0.1, v1TimingExport conservé ; aucun navigateur/IndexedDB/ESV réel |
| Règles de rejeu déduites de version | rulesFor et lotRules historiques choisissent les mêmes règles pour 4.8.6 et 4.9.0.1 |

Les ciblés ont précédé verify, sans exécutions simultanées des deux bancs, sans délai relevé. Le contrôle du libellé action.default_title a été resserré ensuite pour exiger la frontière de nom ; il est couvert par le verify final. Aucun échec caché ; les résultats rouges précédents (1060/5/2) et ceux de l'orchestrateur (33/5/1 ciblés) restent conservés comme preuves datées dans la livraison. Deux tests privés sautés ne sont pas des réussites ; **banc partiel**, pas environnement complet ni terrain certifié.

Sources : preuves/cibles/resultats.json et comptes.json ; preuves/verify-final-execution.json ; preuves/verification-final.json/txt ; preuves/gels-et-instrumentation.json ; preuves/identites-exports-simules.json. Le banc final et ses audits sont dans le commit de préparation, avant génération du paquet.

Intégrité protégée : **14/16 fichiers protégés identiques**, manifest.json et panel.js ont leurs seules exceptions de métadonnées autorisées. **3/5 scripts V1 identiques** ; background.js et src/bridge.js ont seulement les chaînes de version autorisées et leur reste est identique après neutralisation. Source : preuves/proteges-et-v1.json. Les empreintes gelées et référence J1 historique 4.8.0 restent inchangées ; aucune baseline réécrite.

## Métadonnées des sorties et décisions

VERSION est utilisé pour étiqueter état/export/enregistrements (src/engine.js:10-13,584,814,1010,1054), lot.extensionVersion (background.js:901), exports (background.js:923-926) et identité de l'adaptateur (src/adapter-page.js:196,223,717,729). VERSION_NAME nomme les interfaces et messages de cohabitation (background.js:17,308-317 ; src/adapter-page.js:779). Ces derniers changent le nom de produit affiché, **pas la garde ou le refus**.

Le moteur, décision de lot, adaptateur, stockage, cerveau, géométrie et outils de mesure restent octet pour octet identiques. Les contrôles de version de l'analyste utilisent des seuils antérieurs à la 4.8.6 ; les deux versions choisissent les mêmes règles (tools/acceptance-report.cjs:342-375). Aucun effet métier différent trouvé dans ces lectures/probes Node ; aucune nouvelle décision de pose revendiquée. Les études terrain restent nécessaires pour les temps réels.

Le vrai candidat corrigé baa548d81a0bf7059ae1711163527a918cf2257d, arbre 69aad6bcd0d8e63116c8491339ff7d46b43bd3d3, parent 042aee649bc25b89c46a26def481f87f46d047ac a été réutilisé. Le delta initial était identique au retour intact d664ea7c… ; il n'a pas été appliqué deux fois. Branche locale sol/v1-preparation-test-2026-10-04, main documentaire 18a355eb02a00b20b2adaeb1d84648854664972e distinct du code ; aucun changement de main. Aucun numéro de décision Mic nouveau créé.

## Anciennes preuves J1 réutilisées

Pas de nouveau J1 ni rejeu privé. Preuves du 3 octobre rattachées au candidat corrigé : référence 4.8.6 démarrée 17:32:28.307693Z (780,429 s, code 0), candidat démarré 17:48:44.906239Z (836,975 s, code 0). 633 lignes de validation, 8 jeux a–h, 13 sessions/1398 lignes ; 12 fichiers secondaires identiques, relevés égaux hors code/faitLe. Le rattachement des sources à baa548d8 est conservé (l'arbre testé avant commit a ses empreintes ; ce n'est pas un J1 annoncé post-commit).

Le verify développeur du 3 octobre (1065 réussis, 0 échec, 2 sautés) et la relecture indépendante du 3 octobre restent historiques, distincts des contrôles frais. La relecture examinait les résultats J1 dérivés sans rejouer le corpus privé et ne disposait pas du parent pour importer le bundle. Ici la vraie chaîne Git est disponible et conservée, aucun SHA annoncé fabriqué.

Sources : archives/RETOUR-PREPARATION-INTACT.zip → historiques/META-CORRECTION.json, comparison-j1.json et archives/Developpeur_1_V1_CORRIGE_2026-10-03.zip ; rapport indépendant et trace orchestrateur intacts. Premier rapport V1 disponible et résumé du premier contrôle conservés ; le tout premier rapport original demeure indisponible dans les pièces reçues, aucune preuve absente n'est inventée. Aucun export privé brut ajouté.

## Paquet et documents

La commande réelle de génération, commit/arbre, taille, CRC et SHA-256 sont dans COMMANDES.md et preuves/package-integrite.json de la transmission. Procédure : commit local descendant de baa548d8 après verify à zéro, git archive de ce commit, extraction dans un dossier neuf, tools/package.py inchangé lancé depuis cette extraction. Le paquet et les documents associés proviennent du même commit ; aucun fichier ajouté/modifié dans l'extension après génération. Les documents audit/chantiers exclus par le générateur sont joints autour du paquet.

D-073 et fiches initiales restent intacts, sans réécriture du cahier signé ou des historiques. DECISIONS.md s'arrête à D-065 ; D-066 à D-072 absents ne sont pas inventés ni réinsérés. L'intégration du registre et des avenants demeure à versionner par la direction. Le README de test et TEST_V1_PREPARATION.md rendent les anciens conseils historiques explicitement secondaires à cette préparation.

Proposition **50/50/150** inchangée, pas programme adopté. Aucun projet/partie/lot/budget ou seuil de dérive approuvé. D-073 : présentation seulement, pas assouplissement de coverage.complete ; contrôles de santé/pertes/écritures non prouvées maintenus. Projet déclaré distinct du projet observé ; chevauchements réels publiés, pas zéro fictif ; coût asynchrone inconnu. Bornes D5/V1 séparées, 48 %/63 % historiques non confirmés/infirmés ; après pose = lecture d'état, pas LiDAR. Conserver les exports complets, journal et v1TimingExport, tous segments/dictionnaires, pas de purge sans preuve d'enregistrement. KI-069 reste documenté, aucun nouveau correctif.

## Arrêt et limites

Paquet de test local pour contrôle de l'orchestrateur et relecture indépendante du diff limité ; **terrain non mesuré/non accepté**. Réservation globale à confirmer avant installation ; lots/accès/séance et éventuels critères de porte à adopter distinctement. Aucun navigateur, ESV/PC Mic, push, merge, tag, publication, écriture banane-data, intégration U1/U2/V4, chantier V2/V3/V5 ou apprentissage exécuté. P2 reste accepté. Après remise du ZIP vérifié, arrêt de cette mission.
