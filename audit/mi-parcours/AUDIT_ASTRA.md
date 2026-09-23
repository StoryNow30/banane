# Audit à mi-parcours — audit indépendant (GPT-6 Astra)

*Transmis par la direction le 23 septembre 2026, versé tel quel. Instantané
audité : commit `8ad1bec`. Archives `.7z` de banane-data non ouvertes par
l'auditeur.*

## 1. Résumé pour décideur

* [VÉRIFIÉ] Les deux audits du cerveau totalisent 565 différés sur 958 enregistrements de cuts, soit 59 % ; ce sont des visites d'audit, pas 958 cuts indépendants. audit/brain-audit-2026-09-22.json#/sessions/*/cuts ; audit/brain-audit-2026-09-23.json#/sessions/*/cuts
* [VÉRIFIÉ] Dans le relevé du 23 septembre, 177 enregistrements sont sans entrée qualifiée, 91 ont au moins un rail en abstention, et 31 sont refusés par la garde d'écartement. audit/brain-audit-2026-09-23.json#/sessions/*/cuts
* [VÉRIFIÉ] Les diagnostics de minima locaux suggèrent que certaines abstentions pourraient être récupérables, mais ne prouvent ni la présence du bon candidat ni l'existence d'une paire admissible. tools/brain-audit.cjs:126-146 ; JSON détaillés ci-dessous
* [VÉRIFIÉ] La continuité montre un gain hors ligne prometteur ; les données restent concentrées sur peu de parties et un même opérateur, avec des ancres humaines antérieures. audit/continuity-observer-2026-09-23.json#/modes/observer ; audit/continuity-observer-2026-09-23-p24.json#/modes/observer
* [VÉRIFIÉ] Le critère de cut « faux » mesure surtout l'erreur latérale ; il ne suffit donc pas à démontrer « sans dégradation de qualité ». tools/brain-audit.cjs:76-78,101-104
* [SUPPOSÉ] Le gel de GCV1 n'est pas l'obstacle principal : la qualification de l'entrée, la décision sur des hypothèses de séquence et la faiblesse du protocole de validation pèsent davantage aujourd'hui.
* Verdict : [SUPPOSÉ] 90 % n'est pas étayé comme engagement 4.8. Je recommande un seuil provisoire de 80 % de tous les cuts distincts d'un lot complet déclaré, avec un garde-fou qualité indépendant ; garder 90 % comme aspiration à réévaluer après validation sur plusieurs parties.

Audit limité au commit 8ad1bec demandé. Je n'ai pas ouvert les archives .7z de banane-data ; les calculs ci-dessous viennent du code et des JSON du dépôt.

## 2. Causes des différés

Les causes « sans entrée », « abstention » et « garde » sont des catégories exclusives par enregistrement de visite dans ces audits. Les motifs d'abstention sont comptés par rail : leur somme peut dépasser le nombre de cuts différés. Les identifiants distincts sont dédupliqués au sein des parties, mais les catégories restent comptées sur les visites.

| Audit / partie | Visites / cuts distincts | Sans entrée qualifiée | Abstention d'au moins un rail — motifs par rail | Refus écartement | Rails sans instantané qualifié (détail) | Proximité des minima aux références humaines* |
|---|---|---|---|---|---|---|
| 22 sept. — P13 | 32 / 28 | 14 | 12 cuts : flanc 13, minTop 2, ambiguïté 2, pente 2 | 0 | 18 : 12 sans snapshot qualifié, 6 sans snapshot pré-correction ; 10 cuts avec un côté manquant, 4 avec les deux | n=18 ; 15 à ≤10 mm, 10 à ≤5 mm, 0 hors fenêtre |
| 22 sept. — P18 | 166 / 154 | 118 | 28 cuts : flanc 28, minTop 4, ambiguïté 1, pente 1 | 1 | 216 : 210 sans snapshot qualifié, 6 sans snapshot pré-correction ; 20 cuts avec un côté manquant, 98 avec les deux | n=25 ; 22 à ≤10 mm, 8 à ≤5 mm, 0 hors fenêtre |
| 22 sept. — P19 | 105 / 99 | 27 | 26 cuts : flanc 18, minTop 3, ambiguïté 4, pente 6 | 2 | 36 : 31 sans snapshot qualifié, 5 sans snapshot pré-correction ; 18 cuts avec un côté manquant, 9 avec les deux | n=23 ; 21 à ≤10 mm, 12 à ≤5 mm, 0 hors fenêtre |
| 22 sept. — P20 | 82 / 75 | 12 | 13 cuts : flanc 1, minTop 6, ambiguïté 6, pente 1 | 13 | 23 : 22 sans snapshot qualifié, 1 sans snapshot pré-correction ; 1 cut avec un côté manquant, 11 avec les deux | n=39 ; 34 à ≤10 mm, 18 à ≤5 mm, 4 hors fenêtre |
| 22 sept. — total | 385 / 356 | 171 | 79 cuts : flanc 60, minTop 15, ambiguïté 13, pente 10 | 16 | 293 rails : 275 sans snapshot qualifié, 18 sans snapshot pré-correction | n=105 ; 92 à ≤10 mm, 48 à ≤5 mm, 4 hors fenêtre |
| 23 sept. — P19 | 174 / 170 | 72 | 38 cuts : flanc 22, minTop 15, ambiguïté 11, fenêtre 1, pente 1 | 5 | 101, tous sans snapshot qualifié ; 43 cuts avec un côté manquant, 29 avec les deux | n=19 ; 18 à ≤10 mm, 10 à ≤5 mm, 0 hors fenêtre |
| 23 sept. — P20 | 399 / 368 | 105 | 53 cuts : flanc 14, minTop 28, ambiguïté 15, fenêtre 1, pente 2 | 26 | 153, tous sans snapshot qualifié ; 57 cuts avec un côté manquant, 48 avec les deux | n=92 ; 66 à ≤10 mm, 42 à ≤5 mm, 27 hors fenêtre |
| 23 sept. — total | 573 / 538 | 177 | 91 cuts : flanc 36, minTop 43, ambiguïté 26, fenêtre 2, pente 3 | 31 | 254 rails, tous sans snapshot qualifié | n=111 ; 84 à ≤10 mm, 52 à ≤5 mm, 27 hors fenêtre |

Sources des recomptages — [VÉRIFIÉ] : 22 sept. P13 audit/brain-audit-2026-09-22.json#/sessions/0/cuts, P18 #/sessions/1/cuts, #/sessions/2/cuts, #/sessions/5/cuts, P19 #/sessions/3/cuts, P20 #/sessions/4/cuts, #/sessions/6/cuts. 23 sept. P19 audit/brain-audit-2026-09-23.json#/sessions/1/cuts, P20 #/sessions/0/cuts, #/sessions/2/cuts. Totaux recalculés sur ces tableaux de cuts.

Lecture de la récupérabilité — [VÉRIFIÉ] « Sans entrée » signifie que le snapshot n'a pas passé la qualification prévue ; cela ne prouve pas que les points LiDAR sont physiquement absents. Les rapports n'enregistrent pas assez d'information pour séparer absence réelle de points et échec de capture/qualification. Pour les références analysables, la métrique des minima locaux donne les proximités indiquées, mais une proximité à 10 mm n'est pas la preuve que le bon candidat est sélectionnable, que les deux rails forment une paire admissible, ou que l'application est sûre. tools/brain-audit.cjs:43-46,85-91,126-146 ; tools/placement-lab.cjs:145-151

Réponse à A — [SUPPOSÉ] La part potentiellement récupérable est donc réelle mais non quantifiée de façon fiable. Les tableaux quantifient l'observation non qualifiée et les abstentions ; ils ne permettent pas de conclure que les 92 ou 84 minima proches correspondent à autant de cuts récupérables. En particulier, le 23 septembre compte 27 références hors des fenêtres signalées par l'audit. audit/brain-audit-2026-09-22.json et audit/brain-audit-2026-09-23.json, métrique des références non résolues et des fenêtres.

## 3. Constats, du plus grave au moins grave

### 1. Critère qualité trop faible pour soutenir « sans dégradation »

Sévérité : critique — [VÉRIFIÉ]. Le code de l'audit enregistre aussi une erreur verticale, mais classe le cut « faux » selon le seuil latéral de 10 mm. tools/brain-audit.cjs:76-78,101-104 ; l'étude de continuité reprend également un classement « faux » latéral tools/continuity-seed-study.cjs:170-178. Dans le relevé du 23 septembre, j'ai recompté 10 enregistrements classés faux, dont 5 dépassent aussi 10 mm verticalement ; « zéro faux » ne signifie donc pas zéro erreur pertinente sur les deux coordonnées.

Sévérité : critique — [VÉRIFIÉ]. La référence est une pose humaine observée après validation, pas une vérité terrain indépendante : tools/placement-lab.cjs:118-151. Les unités physiques reposent sur une conversion scène×1000 et ne sont pas vérifiées indépendamment dans ce protocole tools/placement-lab.cjs:145-151.

### 2. Les échantillons ne démontrent pas la généralisation

Sévérité : élevée — [VÉRIFIÉ]. Les rapports contiennent 385 visites pour 356 identifiants distincts le 22 septembre, puis 573 pour 538 le 23 ; les cuts voisins, revisites et séries d'une même partie ne sont pas des essais indépendants. audit/brain-audit-2026-09-22.json#/sessions/*/cuts ; audit/brain-audit-2026-09-23.json#/sessions/*/cuts

Sévérité : élevée — [VÉRIFIÉ]. L'audit antérieur décrit une journée, un opérateur et quatre parties AUDIT_CERVEAU_4.7.5.md:147-154. Le protocole P2 prévoit au moins 30 repositionnements aveugles, mais l'issue de suivi indique que P2 n'est toujours pas mesuré BANANE_4.8_CAHIER.md:184-198 ; KNOWN_ISSUES.md:42.

### 3. Les gains de continuité sont prometteurs, mais dépendent d'ancres humaines

Sévérité : élevée — [VÉRIFIÉ]. Sur 252 cas jugés du relevé de continuité corrigé, ESV obtient 118 bons et 6 faux ; l'observateur, 141 bons et 3 faux. Sur P24, 105 cas sont jugés : 59 bons ESV contre 68 avec continuité, sans faux selon le critère latéral ; le recalcul montre 9 refus de garde, 3 abstentions convertis en bons, et 3 bons perdus. audit/continuity-observer-2026-09-23.json#/modes/observer/*/rows ; audit/continuity-observer-2026-09-23-p24.json#/modes/observer/*/rows

Sévérité : élevée — [VÉRIFIÉ]. L'observateur exclut le cut courant et ses ancres sont des cuts humains validés antérieurs, de la même partie et proches dans la séquence. Il s'agit donc bien d'une entrée disponible avant le cut cible, mais elle partage l'opérateur et le biais de validation humaine des références. src/continuity-observer.js:27-80,105-147 ; DECISIONS.md D-036, lignes 3–31.

Sévérité : élevée — [VÉRIFIÉ]. Les rapports de continuité excluent les cuts 9033 et 9241, présents comme faux dans l'audit du cerveau du 23 septembre. Je ne peux pas déterminer à partir des relevés seuls si cette différence de périmètre est intentionnelle pour chaque comparaison ; elle doit être explicitée avant de comparer les taux. audit/brain-audit-2026-09-23.json#/sessions/1/cuts ; audit/continuity-observer-2026-09-23.json#/excludedCuts

### 4. GCV1 gelé limite certaines hypothèses, sans expliquer à lui seul le faible taux d'application

Sévérité : élevée — [VÉRIFIÉ]. Les paramètres de recherche gelés sont notamment ±80 mm latéral, ±40 mm vertical, grille de 3 mm. L'enveloppe d'exécution ajoute un centre uMed tout en gardant l'origine, donc il est inexact de décrire la recherche comme centrée uniquement sur la pose ESV. src/geometry-candidate-v1.js:7-10,71-89 ; src/gcv1-shadow.js:156-159,405-410. Le relevé du 23 septembre marque 27/111 références hors fenêtres. audit/brain-audit-2026-09-23.json, métrique des références non résolues.

Sévérité : élevée — [VÉRIFIÉ]. Six cas de décalage commun de 117 à 273 mm sont répertoriés comme un problème que la garde d'écartement ne détecte pas. KNOWN_ISSUES.md:34 La garde d'écartement est bien une condition d'admissibilité, sans cible nominale dans le code. src/gauge.js:16-42

Conclusion sur le gel — [SUPPOSÉ]. Il limite la génération de candidats pour les grands décalages et empêche de modifier le cœur gelé. Mais la qualification de l'entrée touche 171 visites sur 385 et 177 sur 573 dans ces relevés. L'observation, la décision séquentielle et les validations indépendantes sont donc des blocages plus immédiats que le seul gel. Une génération de nouvelles hypothèses autour de la séquence peut être testée hors du module gelé, sans choisir un écartement-cible. src/gcv1-shadow.js:30-70,156-159 ; JSON des deux audits.

### 5. Les améliorations partielles ne sont pas encore des preuves de couverture sûre

Sévérité : moyenne à élevée — [VÉRIFIÉ]. Le flanc partiel fait passer les applications enregistrées de 56 à 113 sur l'échantillon avec/sans fonction, mais le relevé ultérieur contient deux cuts faux auxquels le flanc partiel a contribué. La comparaison initiale ne vaut donc pas validation indépendante. audit/resolution-partial-flank-2026-09-22.json ; BANANE_4.8_CAHIER.md:747-881

Sévérité : moyenne — [VÉRIFIÉ]. Le calage de convention améliore les médianes latérale et verticale rapportées (2,8→1,3 mm ; 3,1→0,7 mm), mais il est dérivé de données du même opérateur et ne démontre pas une hausse de couverture. BANANE_4.8_CAHIER.md:1015-1029 ; src/placement-convention.js:36-40,67-101 ; KNOWN_ISSUES.md:39

### 6. Les critères et dénominateurs sont insuffisamment stabilisés

Sévérité : élevée — [VÉRIFIÉ]. C1 promet 90 % des cuts d'un lot, mais ne fixe pas explicitement si l'unité est l'identifiant de cut distinct, la visite, le cut avec entrée qualifiée, ou le cut final après revisite. Le chiffre de référence donné est 46/74, soit 62,2 %, mais il ne résout pas cette ambiguïté pour les audits actuels. BANANE_4.8_CAHIER.md:34-45,312-333

Sévérité : élevée — [VÉRIFIÉ]. P0 a changé de nature : le critère annoncé porte sur des paires admissibles proches de la référence, alors que certains résultats mis en avant portent sur des minima locaux proches. Ces métriques ne prouvent pas la même chose. BANANE_4.8_CAHIER.md:158-172 ; tools/brain-audit.cjs:126-146

Sévérité : moyenne — [VÉRIFIÉ]. Huit amendements sont listés sur deux jours d'audit. La traçabilité est utile et la correction de l'étude de continuité invalide a été documentée ; toutefois, la redéfinition d'entrées, critères et périmètres rend les comparaisons successives difficiles. BANANE_4.8_CAHIER.md:551-560,747-881,1102-1345 ; KNOWN_ISSUES.md:37

## 4. Recommandations classées par gain de couverture attendu sans perte de qualité

| Rang | Recommandation | Mesure qui la prouverait | Coût / risque |
|---|---|---|---|
| 1 — potentiel élevé, confiance faible | Tester en navigateur une recherche multi-hypothèses sur la séquence : conserver plusieurs paires candidates par cut, propager les hypothèses de voie sur un lot entier, puis comparer au traitement cut par cut. Ne jamais noter une paire selon sa proximité à 1435 mm ou à l'écartement des voisins ; la plage [1405,1470] reste une garde. | Comparaison appariée sur une partie entièrement tenue à l'écart, avec mêmes entrées ESV : couverture sur tous les cuts, taux de faux séparé latéral/vertical, et nombre de différés. Le gain hors ligne de continuité (+23 bons sur 252 ; +9 sur 105 en P24) justifie le test, pas une activation en pilote. [VÉRIFIÉ pour les gains observés ; SUPPOSÉ pour le gain futur.] audit/continuity-observer-2026-09-23.json#/modes/observer/*/rows ; ...-p24.json#/modes/observer/*/rows | Coût élevé : stockage et calcul local, worker navigateur, journalisation des hypothèses. Risque élevé : suivre la mauvaise branche ; dans ce cas, différer le cut. |
| 2 — potentiel élevé mais à mesurer | Instrumenter puis corriger le chemin de qualification des snapshots, par côté : raison, présence, visibilité, capture pré-action et déduplication. Ne compter comme récupéré que ce qui peut être capturé proprement avant mouvement humain. | Sur un lot pilote complet, comparer le taux d'entrée qualifiée par côté et par cut avec le nombre de différés évités, tout en excluant toute entrée post-correction. Les audits montrent de nombreuses étiquettes no-qualified-snapshot, mais ne disent pas lesquelles sont corrigibles. [VÉRIFIÉ pour les comptes ; SUPPOSÉ pour le gain.] tools/placement-lab.cjs:50-103 ; JSON des audits | Coût faible à moyen. Risque faible si on ne change que l'éligibilité ; risque de faux contexte si une capture post-action est admise. |
| 3 — potentiel moyen, résultat inconnu | Sauvegarder les minima et paires candidates complets pour chaque rail, afin de distinguer absence d'observation, bon rail non sélectionné, et paire refusée par la garde. Tester ensuite des scores d'évidence géométrique, sans transformer l'écartement en préférence. | Rejouer les différés et les 31 refus de garde du 23 septembre ; mesurer combien donnent une paire de deux rails jugée indépendamment correcte et admissible. Les seuls minima proches ne répondent pas à cette question. [VÉRIFIÉ pour les refus et la limite des relevés ; SUPPOSÉ pour le potentiel.] tools/brain-audit.cjs:126-146 ; src/gcv1-shadow.js:450-509 ; src/gauge.js:16-42 | Coût moyen à élevé. Risque moyen à élevé : associer deux bons candidats entre eux peut quand même produire une mauvaise paire. |
| 4 — maintien avec validation renforcée | Garder le flanc partiel activé, mais ne pas élargir ses seuils sur la seule base de l'étude actuelle. | Nouveau lot indépendant : comparer avec/sans flanc, mesurer couverture deux rails, erreurs latérales et verticales et qualité des références. [VÉRIFIÉ pour le gain historique et les deux faux ultérieurs ; SUPPOSÉ pour le résultat futur.] audit/resolution-partial-flank-2026-09-22.json ; BANANE_4.8_CAHIER.md:747-881 | Coût faible à moyen. Risque moyen : faux soutien sur flanc incomplet. |
| 5 — gain de couverture faible ou nul | Garder le calage de convention comme correction de précision, et le valider sur une partie, un jour et idéalement un opérateur différents. Ne pas le présenter comme progrès C1. | Mesurer médianes, p90 et erreurs maximales latérales et verticales sur des références indépendantes. [VÉRIFIÉ pour l'amélioration sur l'échantillon connu ; SUPPOSÉ pour sa généralisation.] BANANE_4.8_CAHIER.md:1015-1029 ; KNOWN_ISSUES.md:39 | Coût faible. Risque faible à moyen : convention ou échelle de scène propres à l'échantillon. |
| Préalable qualité | Fixer avant la prochaine mesure le dénominateur C1, un seuil d'erreur bidimensionnel, un protocole de vérité terrain/répétabilité, et un holdout par partie. Effectuer les 30 repositionnements aveugles prévus. | Publier la matrice cut par cut : identifiant unique, entrée qualifiée, paire appliquée, garde, différé, erreur latérale et verticale, référence et revisites. [VÉRIFIÉ : les lacunes actuelles sont documentées ; SUPPOSÉ : le protocole réduira le risque de conclusion erronée.] BANANE_4.8_CAHIER.md:184-198,312-333,410-421 ; KNOWN_ISSUES.md:42 | Coût moyen. Risque faible ; peut révéler une couverture plus basse que celle espérée. |

Toutes ces propositions respectent les contraintes indiquées : la garde d'écartement reste une règle d'admissibilité, aucun rail n'est appliqué seul, et il n'y a ni validation ni SKIP automatique. L'architecture envisagée reste une extension locale au navigateur.

## 5. Verdict sur l'objectif de 90 %

[SUPPOSÉ] Je réviserais 90 % comme engagement du cahier 4.8, tout en le gardant comme aspiration de long terme. Les échantillons disponibles ne justifient pas une promesse de 90 % « sans perte de qualité » : le taux d'entrée qualifiée est faible dans plusieurs relevés, les taux de visites ne sont pas des taux par cut distinct, et le contrôle qualité n'est pas indépendant.

Pour le prochain jalon, je fixerais un seuil provisoire de 80 % de cuts distincts parmi tous les cuts d'un lot complet déclaré. Les cuts sans entrée qualifiée, différés, refusés par la garde ou de résultat technique inconnu restent au dénominateur ; une visite répétée ne compte pas comme un nouveau cut. Les deux rails doivent être appliqués et respecter la garde. La qualité doit être un critère séparé, mesuré latéralement et verticalement sur des références indépendantes. Le taux sur cuts à entrée qualifiée peut être publié comme diagnostic, jamais comme dénominateur principal.

[SUPPOSÉ] 80 % est un seuil de passage provisoire, pas une prédiction ni une garantie statistique. Le chiffre est proche des 47,8 % d'enregistrements appliqués du relevé du 23 septembre, mais ce taux inclut des visites répétées et des résultats non référencés ; il ne valide donc pas encore 50 % de cuts distincts de qualité acceptable. audit/brain-audit-2026-09-23.json#/sessions/*/cuts

Je ne réexaminerais l'engagement de 90 % qu'après des essais sur plusieurs parties indépendantes, dont une avec aiguillage, un lot pilote complet, la répétabilité aveugle prévue par P2 et un critère qualité défini avant l'essai. [SUPPOSÉ] Cette étape permettrait de distinguer une limite du moteur d'un déficit d'observation et d'estimer une couverture généralisable. BANANE_4.8_CAHIER.md:184-198,410-421
