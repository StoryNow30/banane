# Audit indépendant — GCV2 avant G1-c

**Date : 19 octobre 2026. Verdict : G1-c peut partir après P1.**

La conception en trois étages reste défendable. En revanche, les chiffres actuels ne prouvent ni une validation entièrement hors apprentissage, ni un usage « lot » entièrement sans information humaine, ni la tenue de toutes les portes de G0. V1 est une candidate de développement prometteuse. Elle n'est pas encore une candidate confirmée.

## Périmètre et degré de preuve

**VÉRIFIÉ** signifie : lu dans une version identifiée, exécuté sur une fixture, ou recalculé à partir des comptes publiés. « VÉRIFIÉ — publié » ne signifie jamais « recalculé sur le terrain ». Les jeux de bords de rails étant hors dépôt, je ne peux certifier les effectifs, les références ni les résultats individuels de terrain.

**SUPPOSÉ** signifie : risque plausible ou condition à démontrer. Je distingue le chemin de code démontré de son incidence terrain, inconnue. Les corrections et les tailles d'examen proposées sont des recommandations, pas des résultats mesurés.

| Repère | Version examinée |
|---|---|
| O | Branche claude/execute-prompt-00-18ra5a ; commit ec861e668419595be1461893f61674ea0bc1d3ba |
| B | Branche claude/50-g1b-apprendre ; commit 5ca9fd81bcc5ac173411ff551d2daa4fb56e27ad |
| G1-a | Branche claude/50-g1a-hypotheses ; commit 091e5fbc0a4f685e19729442a126c6c4d66f6782 |
| H6 | La référence distante claude/50-g1-h6 n'était pas disponible lors des vérifications. Audit de la proposition D-207 uniquement ; aucune certification de son implémentation. |

Sauf préfixe O, les références de lignes désignent B. Abréviations : **J** = tools/gcv2-jeu.cjs ; **A** = tools/gcv2-apprendre.cjs ; **R** = tools/relecture-autonome.cjs ; **F** = fiches/G1B_APPRENTISSAGE.md.

VÉRIFIÉ : J, R et tests/gcv2-jeu.test.cjs ne diffèrent pas entre les versions G1-a et B examinées. Aucun code de production n'a été modifié. Les sondes supplémentaires ont été exécutées en mémoire sur des données synthétiques.

Commande exécutée sous Node v24.19.0 :

~~~sh
node --test tests/gcv2-jeu.test.cjs tests/gcv2-apprendre.test.cjs tests/relecture-autonome.test.cjs
~~~

**Résultat vérifié : 42 essais réussis, 0 échec, 0 ignoré, environ 4,74 s.** Cela ne constitue ni un rejeu terrain ni l'exécution de toute la suite du dépôt.

## 1. Fuite : les protections locales existent, mais la chaîne complète reste poreuse

### F1 — La liste blanche protège le score, pas toute la fabrication de ses entrées

**Problème →** Un trait autorisé peut déjà contenir une information indisponible au moment de décider.

**Preuve — VÉRIFIÉ →** A, lignes 63–101 et 165–172 : lecture explicite des traits autorisés. J, lignes 146–306 puis 312–319 : génération des hypothèses séparée de leur étiquetage. Les essais changent les références et des champs interdits sans changer les scores. Mais le test dit « de bout en bout » appelle directement l'observateur et fournit une zone PN et un rôle vert constants : tests/gcv2-jeu.test.cjs, lignes 188–214, notamment 196. Il ne traverse pas toute l'extraction des visites ni la construction réelle des zones. Dans A, ligne 203, l'état « calculé » sert aussi à sélectionner les exemples, même s'il n'est pas un trait.

**Conséquence →** Pas de lecture directe de la pose finale cible trouvée dans la régression. La preuve actuelle ne couvre pas les fuites indirectes par les hypothèses, le contexte et la sélection.

**Correction proposée →** Ajouter un contrat temporel unique : pour une décision à t, changer les poses finales, visites, écritures et captures postérieures à t doit laisser identiques les candidats, traits, zone, rôle, scores et décision. Faire passer cet essai par l'extraction et la table réelles. Tester séparément l'invariance du moteur avec et sans observateur.

**Effort M — P1.**

### F2 — H4 est admissible en assistance chronologique, sous conditions encore incomplètes

**Problème →** « Validé avant la première visite » n'est fiable que si la pose et sa date représentent exactement l'état disponible alors.

**Preuve — VÉRIFIÉ →** J, lignes 93–124 : le cut cible est exclu ; les voisins humains doivent satisfaire t < début de première visite. C'est une bonne protection. Mais la pose retenue est la dernière référence de chaque voisin, datée par endedAt ou, à défaut, startedAt. Les poses attribuées au lot sont les poses de départ vues dans l'Écho, datées à moins l'infini. tools/jointure-echo-orbite.cjs, lignes 306–316 : la correction par écriture serveur peut retenir une écriture postérieure à la référence observée, sans la borner ici par la fin de visite.

**Conséquence — SUPPOSÉ pour le terrain →** Une écriture tardive peut être antidatée ; une validation plus récente peut faire perdre un ancien appui pourtant disponible ; un départ Écho peut différer du véritable résultat du lot. L'effet n'est pas forcément optimiste, mais la causalité n'est pas prouvée. Un voisin humain d'une partie tenue à l'écart est légitime pour une assistance après ses validations ; il ne l'est pas pour une relecture autonome avant toute intervention humaine.

**Correction proposée →** Reconstruire les versions successives des appuis, avec la date effective de disponibilité de leur pose. À t, prendre la dernière version validée avant t. Refuser les dates ambiguës. Employer le vrai instant et la vraie pose du lot, surtout pour le premier passage. Nommer séparément « assistance chronologique » et « lot sans humain ». Étendre le même contrat à H6.

**Effort M — P1.**

### F3 — Le retrait de H4 après déduplication laisse une trace humaine dans le jeu « lot »

**Problème →** Retirer une origine n'annule pas son influence sur la géométrie ni sur la sélection des candidats.

**Preuve — VÉRIFIÉ, code et sonde synthétique →** J, lignes 206–221 : H4 passe avant H2 dans la déduplication ; une hypothèse voisine garde la position du premier candidat et fusionne ses origines. A, lignes 177–195 : le mode lot supprime les H4 purs et les balises H4 des candidats mixtes, mais conserve leur décalage et leurs autres traits.

Sur une fixture avec une cellule concurrente ajoutée, H2 seul avait un décalage latéral de **37,03 mm**. Un appui humain plaçant H4 à **37,33 mm** fusionne avec H2. Après appliquerUsage en mode lot, le candidat porte seulement l'origine H2 mais conserve **37,33 mm**. **Résidu humain démontré : 0,30 mm.** Le plafond de candidats peut aussi modifier la liste ; son impact terrain n'a pas été mesuré.

**Conséquence →** Les chiffres actuels « lot sans voisins humains » ne sont pas strictement tels qu'annoncés. Cette sonde ne permet pas de chiffrer le biais des 123 corrections justes publiées.

**Correction proposée →** Générer le jeu lot depuis les entrées sans aucun appui humain, avant déduplication, plafond et calcul des traits. Test attendu : modifier ou supprimer tous les appuis humains ne change aucun octet utile du jeu lot ni ses décisions. L'essai actuel de retrait, tests/gcv2-apprendre.test.cjs, lignes 209–220, ne suffit pas.

**Effort M — P1 pour toute conclusion sur le lot.** Un G1-c limité explicitement à l'assistance peut différer la validation du lot.

### F4 — Les zones peuvent lire des nuages postérieurs que le moteur a écartés

**Problème →** Le chemin « surface métier » contourne le filtrage temporel de l'entrée moteur.

**Preuve — VÉRIFIÉ, code et sonde synthétique →** R, lignes 227–246 : les chunks de toutes les visites sont réunis. L'entrée moteur passe par entreeSansFuite. Le tableau « tous », construit aux lignes 242–244, ne reprend pas ses contrôles de concordance de pose et de temps. R, lignes 176–181, emploie ce tableau pour la surface PN/ADV, avec un repli qui ignore la visibilité. La surface participe ensuite aux zones ; zone et rôle entrent dans A, lignes 206–214.

Sonde : à entrée moteur inchangée, ajouter 320 points de chaussée seulement dans « tous » laisse les sorties rails du moteur identiques, mais fait passer **coeurPN de false à true**, sidePoints de 2 à 322 et quadMin de null à 100.

**Conséquence →** Le chemin d'influence est démontré. L'incidence terrain de captures réellement postérieures reste SUPPOSÉE. Une zone obtenue après le geste expert peut décider après coup où V1 a le droit d'agir.

**Correction proposée →** Calculer les surfaces et zones depuis le même instant disponible que la décision. Une carte de zones de toute la partie est admissible si un prépassage réel l'a produite avant l'action. Sinon, la construire chronologiquement. Tester le pipeline complet avec des captures de visites suivantes et des captures après déplacement.

**Effort M — P1.**

### F5 — La médiane de partie n'est pas une lecture directe de la cible, mais sa disponibilité est à établir

**Problème →** Une statistique calculée sur les visites futures peut dépendre du parcours de l'expert.

**Preuve — VÉRIFIÉ →** J, lignes 327–338 : médiane des poses de départ de tous les cuts visités, hors lotValide et valeur 1 500 mm. Ce ne sont pas les poses finales. Mais R, ligne 404, utilise une autre population : cas calculés et exclusion de tous les cuts du lot. Les différés ne sont donc pas exclus de manière identique.

**Conséquence — SUPPOSÉ pour la disponibilité réelle →** Pas de fuite directe de l'étiquette démontrée. En revanche, la population future des visites et les poses effectivement observées peuvent être indisponibles à t. La référence prudente et GCV2 n'ont pas nécessairement la même médiane.

**Correction proposée →** Fournir un instantané initial exhaustif et horodaté, ou utiliser une médiane causale des seuls appuis autorisés. Employer la même définition pour les deux méthodes. Modifier une visite future ne doit pas modifier une décision antérieure.

**Effort M — P1.**

### F6 — Absence de nuage, validations implicites et SKIP changent la population jugée

**Problème →** Interdire la durée de visite comme trait ne supprime pas le biais de disponibilité des exemples.

**Preuve — VÉRIFIÉ — publié/code →** O, fiches/RM4_ABSTENTIONS.md, lignes 155–157 et 181–183 : disponibilité incomplète, notamment sur les parties purgées ; O, DECISIONS.md, D-196 et D-201, ligne 2793 : perte d'exports et dépendance à la durée de visite. G1-a publie 406 grosses corrections avec nuage et 334 sans nuage ; 340/406 = 83,7 %, contre 340/740 = 45,9 %. A, ligne 203, exclut les cas non calculés. G0, ligne 62, indique 0,6 s pour une visite sans action ; J utilise le seuil de jointure de 0,8 s. R, ligne 230, calcule skipMic ; le filtrage A, lignes 198–223, n'en fait pas une exclusion explicite.

**Conséquence →** 83,7 % est un rappel conditionnel sur les données disponibles, pas un rappel global. La direction du biais de sélection reste inconnue. « Pas d'action pendant une courte visite » est une référence plus faible qu'une validation explicite. L'absence de propagation explicite de SKIP demande un test ; elle ne prouve pas à elle seule qu'un SKIP terrain a été appris.

**Correction proposée →** Publier le parcours complet : visités, nuage causal disponible, référence explicite/implicite, SKIP, exemples retenus, actions. Aligner le seuil de durée. Tester « validation puis SKIP ». Donner la sensibilité des résultats aux seules références explicites. Réconcilier aussi les 740 grosses corrections de G1-a avec les 741 de RM4. Ne pas affirmer qu'aucune GCV2 ne pourrait jamais agir sans nuage : c'est actuellement une limite du jeu construit, notamment à discuter pour les hypothèses de contexte.

**Effort M — P1 pour le périmètre et les exclusions ; P2 pour l'étude détaillée de sélection.**

## 2. Validation croisée : le score est bien séparé, ses dépendances ne le sont pas toutes

### V1 — Normalisation, calibrage et seuils respectent le pli extérieur, à entrées fixées

**Problème →** La portée de cette bonne séparation est plus étroite que celle annoncée pour toute la GCV2.

**Preuve — VÉRIFIÉ →** A, lignes 253–269 : codage ajusté sur l'apprentissage. Lignes 528–549 : scores internes obtenus sans la partie notée, calibrage de Platt et choix de τ/δ sur les parties d'apprentissage. Lignes 696–705 : séparation du pli extérieur. tests/gcv2-apprendre.test.cjs, lignes 107–139 : changer le pli jugé ne change pas les paramètres du modèle appris, son codage, son calibrage et ses seuils. Ces essais passent.

**Conséquence →** Je ne trouve pas de fuite directe du pli extérieur dans ces étapes, une fois le jeu et λ fixés. Le calibrage et les seuils sont bien des ajustements internes ; leur résultat interne ne doit pas être présenté comme une nouvelle mesure indépendante.

**Correction proposée →** Conserver cette organisation et étendre la frontière du pli à la fabrication des données et à toutes les dépendances apprises décrites ci-dessous.

**Effort S pour documenter, M pour étendre — P1.**

### V2 — La hauteur apprise fait déjà connaître quatre parties à l'étage des hypothèses

**Problème →** Un composant appris avant la validation croisée peut porter l'information des parties prétendument tenues à l'écart.

**Preuve — VÉRIFIÉ →** src/hauteur-apprise.js, lignes 8–16, 29–32 et 78 : modèle appris sur 1:17, 1:24, 1:29 et 2:1, coefficients globaux utilisés par défaut. J, lignes 131–135 et 274–285, l'utilise pour les hypothèses et leurs traits avant le découpage de G1-b. fiches/HAUTEUR_APPRISE.md, lignes 78–80, distingue elle-même les coefficients par pli de l'évaluation du modèle figé sur ses parties d'apprentissage.

**Conséquence →** Les 11 plis ne sont pas une validation hors apprentissage de toute la chaîne. Pour quatre parties, des étiquettes ont déjà servi à une dépendance des candidats. L'ampleur et le sens du biais terrain ne sont pas mesurés. GCV1 figée peut être un point de départ légitime pour mesurer une amélioration conditionnelle, mais cela doit être nommé.

**Correction proposée →** Choisir explicitement : soit refaire les dépendances apprises dans les plis externes et internes ; soit qualifier ces résultats de développement conditionnel au moteur et à la hauteur figés, puis juger la chaîne complète sur de nouvelles parties jamais utilisées par aucun de ses composants. Inventorier aussi les réglages métier issus d'anciennes lectures d'étiquettes.

**Effort L pour une reconstruction complète par pli — P1 pour le choix et la preuve correspondant à la revendication.**

### V3 — Le choix de λ et des variantes sur les mêmes 11 parties crée un biais de sélection

**Problème →** Choisir le meilleur réglage sur une validation puis annoncer cette même validation comme performance finale est optimiste.

**Preuve — VÉRIFIÉ →** F, lignes 45 et 49–54 : choix de λ parmi 3, 30, 300 sur les 11 parties ; ajout des traits d'accord et comparaison des petits arbres. F, lignes 595–599 : choix des variantes de zones après lecture des résultats. L'adjectif « légèrement » appliqué au biais de λ n'est pas quantifié.

**Conséquence →** La séparation actuelle protège les coefficients, pas toutes les décisions de conception. Une validation imbriquée de λ corrigerait ce choix précis ; elle n'effacerait pas rétrospectivement toutes les décisions prises en regardant les résultats.

**Correction proposée →** Pour une estimation CV du procédé d'apprentissage, choisir λ uniquement dans chaque apprentissage extérieur, puis ajuster calibrage et seuils sans sa partie test. Pour le produit final, figer une seule procédure complète avant un examen neuf. Une CV imbriquée n'est pas indispensable pour la validité d'un véritable examen neuf d'un modèle déjà figé ; elle l'est si l'on veut attribuer à la CV actuelle une portée confirmatoire après sélection.

**Effort M — P1 pour la qualification et le protocole ; recalcul imbriqué selon la revendication retenue.**

### V4 — « Chaque partie pèse autant » ne décrit pas toutes les étapes

**Problème →** L'objectif d'apprentissage et la lecture finale ne pondèrent pas les mêmes unités.

**Preuve — VÉRIFIÉ →** A, lignes 429–432 : poids inverse du nombre d'hypothèses de chaque partie. Chaque partie a le même poids total, mais un cut avec plus d'hypothèses pèse davantage dans sa partie. Le choix des seuils et les bilans agrègent des comptes de cuts, notamment lignes 507–516 et 661–665. F, lignes 110–120 : les plis jugés vont de **21 à 563 cuts** ; 821 relève d'un autre périmètre de collecte. Avec huit parties du premier ensemble et trois du second, égaliser les parties n'égalise pas les deux projets.

**Conséquence →** Cette pondération peut être pertinente, mais elle ne permet pas de conclure simultanément sur un cut moyen, une partie moyenne et un projet moyen. Un petit pli influence beaucoup l'apprentissage, tandis qu'un grand pli domine les comptes finaux.

**Correction proposée →** Déclarer l'unité cible avant G1-c. Publier les résultats par partie, la moyenne des parties et les comptes cumulés ; séparer les deux ensembles. Si l'objectif est un poids égal par cut au sein de chaque partie, diviser aussi par le nombre de ses hypothèses. Ne changer les poids qu'en développement, pas après lecture du nouvel examen.

**Effort S en P1 pour déclarer l'objectif ; M en P2 pour les comparaisons de pondération.**

## 3. Portes et mesures : les comptes sont lisibles, mais la porte est moins forte que G0

### M1 — Les catégories ne s'additionnent pas ; la référence prudente est une approximation

**Problème →** « Justes », « abîmés », « erreurs » et « mauvaises voies » n'ont ni le même dénominateur ni des catégories exclusives.

**Preuve — VÉRIFIÉ →** A, lignes 630–655 : juste = correction expert > 10 mm et erreur finale ≤ 10 mm ; abîmé = départ à ≤ 5 mm et erreur finale > 10 mm ; erreur = toute action restant à > 10 mm ; mauvaise voie = erreur > 50 mm ou déplacement latéral > 45 mm. Les catégories peuvent se recouvrir. « Laissé faux » exclut les tentatives qui restent fausses. Les 6 abîmés et 5 mauvaises voies ne représentent donc pas les 26 erreurs sur 392 actions.

La règle prudente rejouée est un substitut : A, lignes 568–591. F, ligne 75, reconnaît **38 actions et 27 justes**, contre **40 et 29** dans D-190 sur les mêmes 528 cuts mesurables. Les anciennes catégories de R, lignes 433–439, sont par ailleurs organisées avec une priorité pour la mauvaise voie.

**Conséquence →** La comparaison est homogène à l'intérieur du nouveau compteur, mais elle ne prouve pas exactement la supériorité sur la règle livrée. V1 utilise aussi ce substitut aux abords.

**Correction proposée →** Rejouer la vraie règle figée, avec ses données et ses gardes exacts, puis comparer les deux décisions cut par cut dans un seul évaluateur. Fournir aussi « erreur finale > 10 mm, action ou non », réparations, détériorations et causes d'abstention. Documenter les recouvrements.

**Effort M — P1.**

### M2 — La porte automatisée n'impose ni la borne de Wilson ni toutes les exigences de G0

**Problème →** Une étiquette « porte tenue » peut être plus forte que les conditions réellement évaluées.

**Preuve — VÉRIFIÉ →** A, lignes 790–798 : borneHaute est calculée mais absente de la condition ok. Une sonde avec 14 actions, aucune erreur et une référence égale retourne **tenue = true**, **borneHaute = false**, borne haute **21,53 %**.

Ce n'est pas une violation certaine de la porte ponctuelle décrite dans F, ligne 574 : elle demande un taux observé ≤ 9 %. C'est une ambiguïté à lever si Wilson doit constituer une preuve de risque ≤ 9 %. En outre, O, G0, ligne 73, demande erreur médiane par zone, différés et **0 mauvaise pose ajoutée** ; la porte codée ne les vérifie pas.

**Conséquence →** Deux abîmés contre quatre n'établissent pas zéro mauvaise pose ajoutée : les deux peuvent concerner d'autres cuts. F, ligne 548, montre déjà une partie à deux abîmés avec V1 contre un avec la règle prudente, malgré l'amélioration du total.

**Correction proposée →** Figer une seule porte écrite et exécutable. Je recommande : borne supérieure d'erreur à 95 % ≤ 9 %, zéro mauvaise voie observée, comparaison appariée des nouvelles mauvaises poses, médiane par zone et différés selon G0. Si l'effectif est insuffisant, résultat « non démontré ». Définir « mauvaise pose ajoutée » par rapport à la sortie réelle de la référence ; ne pas le remplacer par le seul nombre agrégé d'abîmés.

**Effort M — P1.**

### M3 — Wilson est arithmétiquement correct ; 2 411 cuts n'est pas l'exposition à l'action

**Problème →** Un grand nombre de cuts examinés peut donner une impression de sûreté excessive lorsque peu sont effectivement modifiés.

**Preuve — VÉRIFIÉ, recalcul à partir des comptes publiés →**

| Résultat | Numérateur / actions | Taux | Borne haute Wilson à 95 %, bilatéral |
|---|---:|---:|---:|
| GCV2 seule, erreurs en relecture | 26 / 392 | 6,63 % | 9,54 % |
| V1, erreurs en relecture | 9 / 257 | 3,50 % | 6,52 % |
| V1, erreurs au lot | 11 / 258 | 4,26 % | 7,47 % |
| V1, mauvaises voies en relecture | 0 / 257 | 0 % | 1,47 % |

La borne de 0/2 411 serait 0,159 %, mais répondrait au risque par cut présenté, pas au risque parmi les actions. La règle des trois citée dans F, ligne 589, donne environ 1,2 % pour 0/257 : c'est une autre convention, approximative et unilatérale, à ne pas confondre avec Wilson bilatéral.

**Conséquence →** « Zéro mauvaise voie sur le corpus » est une porte descriptive utile, pas une preuve de risque nul. Les cuts voisins sont corrélés ; les cinq mauvaises voies en relecture sont concentrées dans une même partie. L'hypothèse d'essais indépendants de Wilson n'est pas garantie.

**Correction proposée →** Conserver Wilson comme mesure descriptive conventionnelle et publier le nombre d'actions exposées par zone, rôle, partie et série. Ajouter une incertitude par regroupement de parties/séries et une comparaison appariée à la référence. Avec peu de parties, montrer les résultats individuels et ne pas donner au rééchantillonnage une précision qu'il n'a pas.

Repères calculés, sans garantie sous corrélation : **39 actions sans erreur** donnent une borne Wilson sous 9 % ; **381 actions sans événement** donnent une borne sous 1 %. Ces nombres ne remplacent pas plusieurs situations indépendantes.

**Effort M — P1 pour le dénominateur, la règle et la méthode d'incertitude par parties/séries ; P2 pour sa consolidation avec les observations en ombre.**

### M4 — Les gardes ne rendent pas la mauvaise voie « impossible par construction »

**Problème →** Une paire géométriquement plausible peut appartenir à la mauvaise voie.

**Preuve — VÉRIFIÉ →** O, G0, ligne 51, formule cette impossibilité. A, lignes 232–237, vérifie déplacement latéral, changement de dévers et écartement estimé. F, ligne 70 : écartement approché, écart > 1 mm dans 0,3 % du contrôle publié ; dévers absolu absent ; présence dans la vue non vérifiable. Les cinq mauvaises voies publiées suffisent à invalider une garantie absolue pour la chaîne actuelle.

**Conséquence →** Le dévers conservé et le bon écartement ne déterminent pas l'identité de la voie. La branche « médiane ± 15 mm OU plage absolue » exige aussi une médiane fiable. Une petite erreur d'approximation peut changer une décision près du seuil.

**Correction proposée →** Retirer la promesse d'impossibilité. Vérifier les positions exactes de la paire, sa visibilité et le sens précis du garde de dévers avant de compter une action comme exécutable. Tester les frontières de seuils et les médianes anormales. Pour les différés, ajouter la preuve d'identité de série décrite ci-dessous.

**Effort M — P1 pour le contrat et le rejeu exact ; P2 pour la concordance avec l'exécution en ombre.**

### M5 — « 2 138 corrigés appris » compte des sources déclarées apprises, pas les exemples utilisés

**Problème →** Le compteur mélange appartenance à une source et participation effective à l'ajustement.

**Preuve — VÉRIFIÉ →** tools/compteur-gcv2.cjs, lignes 88–106 : les comptes d'une source entière sont affectés à son état « appris », sans jointure aux cuts retenus par A. O, fiches/COMPTEUR_GCV2.md, ligne 24, compte 507 corrigés de 1:17 comme appris ; F, ligne 115, ne compte que 197 cuts jugés au total pour cette partie. Ces 507 corrections ne peuvent donc pas toutes être les exemples retenus dans ce jeu G1-b.

**Conséquence →** Le volume annoncé ne mesure pas directement la quantité de corrections effectivement apprises par le score. Le nombre exact reste non vérifiable sans les jeux.

**Correction proposée →** Distinguer « collectés », « issus de sources passées en apprentissage », « retenus après filtres », « corrigés effectivement utilisés » et « réservés ». Produire ce registre depuis les identifiants exacts consommés par l'entraînement.

**Effort S en P1 pour rectifier la revendication ; M en P2 pour automatiser le registre.**

## 4. Variantes après coup : les quatre parties proposées ne constituent pas quatre examens vierges

### E1 — L'historique de consultation contredit la qualification générale « à l'aveugle »

**Problème →** Une partie peut n'avoir jamais ajusté les coefficients tout en ayant influencé les choix humains.

**Preuve — VÉRIFIÉ →** O, DECISIONS.md :

- D-199, ligne 2777 : les deux témoins ont été lus avant le gel final du chaînage.
- D-199, ligne 2778, puis D-202, lignes 2800–2803 : deux réglages sont comparés sur 2:6 ; le choix futur du prix 100 en tient compte.
- D-203, ligne 2811 : lecture des fiches de 2:6 avant de figer N.
- D-206, ligne 2838 : nouvelle connaissance de vérité terrain sur 2:6.
- D-201, ligne 2791 : résultat des témoins déjà publié pour G1-a.

**Conséquence →** 1:11 et 1:25 restent utiles comme témoins de régression. 2:6 reste utile comme diagnostic. Leur réunion ne suffit pas à effacer le choix après coup de V1. Cela ne prouve pas que tous les réglages GCV2 ont été ajustés dessus ; cela interdit de les présenter comme quatre parties entièrement vierges.

**Correction proposée →** Publier un registre des consultations, avec leur objet et leur date. Reclasser ces trois parties comme déjà exposées. **SUPPOSÉ :** 2:7 pourrait être vierge ; vérifier son historique avant de la qualifier ainsi, sans ouvrir ses résultats pour décider.

**Effort S — P1.**

### E2 — Un nouvel examen doit figer le candidat, le volume et la règle d'arrêt

**Problème →** Pré-déclarer V1+ après V1 n'autorise pas à tester les deux puis retenir celle qui passe sur les mêmes réserves.

**Preuve — VÉRIFIÉ →** O, D-205, ligne 2832 : V1 unique et aucun remplacement sur les mêmes parties après échec. D-207, lignes 2850–2855 : nouveau générateur H6, nouveau garde et V1+. Ce sont des changements du candidat complet, même si V1+ est déclarée avant son calcul.

**Conséquence →** L'examen ne corrige le biais de sélection que si le candidat et sa procédure sont gelés avant une évaluation indépendante. Une nouvelle CV ne rend pas les anciennes réserves vierges.

**Correction proposée →** Pour G1-c, garder V1 avec ses corrections de validité, ou attendre une V1+ entièrement définie et choisie sur le développement. Dans les deux cas : un seul candidat, un seul jeu confirmatoire neuf. Une comparaison confirmatoire de plusieurs candidats demande un plan de multiplicité distinct, pas une variante de secours.

Je propose comme **plancher pratique, non comme garantie statistique**, les **cinq prochaines parties admissibles réellement nouvelles**, couvrant les deux ensembles et les zones actives ; 2:7 peut compter si son absence d'exposition est démontrée. Le nombre de parties ne suffit pas : fixer aussi les expositions minimales par zone et la précision recherchée. Ne pas sélectionner les parties en fonction de leurs bonnes performances.

Avant l'ouverture : figer les empreintes du moteur, du générateur, des dépendances apprises, des paramètres, de la référence prudente, des zones, du protocole et de l'évaluateur. Prévoir « échec », « succès » et « non démontré ». Arrêt anticipé possible pour sécurité selon une règle écrite ; aucun arrêt anticipé pour succès sur un simple Wilson relu après chaque partie. Si le volume prévu ne suffit pas, un nouveau plan confirmatoire est nécessaire, ou une méthode séquentielle valide définie d'avance. Ne pas continuer à ajouter des parties jusqu'à ce que la même borne passe.

**Effort M — P1.**

## 5. Cas complexes : H6 est une piste pertinente, le garde de série doit apporter une preuve indépendante

### H1 — H6 répond au manque de candidats ; le déplacement commun ne prouve pas la bonne voie

**Problème →** Une translation de paire peut reprendre l'erreur d'un appui, traverser une bifurcation ou se prolonger au-delà de la zone décalée.

**Preuve — VÉRIFIÉ — proposition seulement →** O, D-206, ligne 2840 : 53 des 57 manques concernent une même zone à déplacement commun de 130 à 250 mm. D-207, lignes 2851–2852 : translation du voisin sûr, lissage de série et garde relatif à la voie de référence. Le code H6 n'était pas accessible. **SUPPOSÉ :** sa qualité et son anti-fuite restent à démontrer.

**Conséquence →** H6 est cohérente avec la cause observée. Mais une paire translatée garde son écartement et son dévers, même sur une mauvaise branche. Si le candidat et le garde dérivent du même unique appui, leur accord peut être circulaire. Un lissage symétrique utilisant des voisins validés plus tard serait une fuite.

**Correction proposée →** Exiger avant une action sur différé :

1. Un appui validé, daté et réellement disponible, avec identité de série ; aucune auto-validation d'une pose précédente de GCV2.
2. Une propagation dans le bon repère et la bonne direction locale, limitée en distance et interrompue aux bifurcations, ruptures ou changements de série.
3. Une confirmation indépendante de la simple translation : support local des deux rails ou plusieurs appuis cohérents, absence d'une voie concurrente plausible. Sans preuve suffisante, abstention.
4. Les gardes exacts de paire et de visibilité ; la voie de référence doit être définie sans la référence finale cible.
5. Des essais adverses : appui sur la mauvaise branche, appuis contradictoires, premier cut sans ancre, ancre tardive, fin de décalage, courbe, entrée/sortie d'ADV, nuage incomplet et propagation longue.
6. Une réussite sur plusieurs séries décalées de parties nouvelles. Les 53 cuts d'un même épisode ne sont pas 53 validations indépendantes du mécanisme.

**Effort L — P1 si V1+ entre en G1-c ; P2 si G1-c reste strictement V1 sans différés.**

### H2 — Déplacer le repère du garde ne doit pas déplacer la définition du succès

**Problème →** L'ancienne métrique compte comme mauvaise voie tout mouvement latéral > 45 mm depuis H0, même si une correction H6 de 150 mm est juste.

**Preuve — VÉRIFIÉ →** A, lignes 635 et 648. D-207 propose un garde relatif à la série, mais ne suffit pas à définir une nouvelle mesure comparable.

**Conséquence →** H6 peut être condamnée automatiquement par l'ancienne métrique ou paraître sûre par une nouvelle définition trop permissive. Ni l'un ni l'autre ne juge l'identité réelle de la voie.

**Correction proposée →** Séparer avant tout calcul : amplitude depuis H0, violation du corridor de série, erreur finale > 50 mm, et erreur d'identité de voie si elle peut être annotée indépendamment. Conserver l'erreur finale et les nouveaux dégâts dans la porte. Documenter toute rupture de comparabilité ; ne pas rebaptiser une violation pour annoncer zéro mauvaise voie.

**Effort M — P1 pour V1+ ; P2 si H6 reste exploratoire.**

### H3 — Apprendre des cas complexes ne signifie pas devoir agir dessus

**Problème →** L'absence de candidat juste et l'interdiction d'action sont confondues avec une exclusion de l'apprentissage.

**Preuve — VÉRIFIÉ →** A, lignes 198–223, construit les exemples sans exclure les différés pour le seul motif de leur rôle. La restriction V1 intervient dans appliquerVariante, lignes 619–626, au niveau de la décision. Une hypothèse fausse peut fournir une étiquette négative utile.

**Conséquence →** Les cas complexes exploitables peuvent déjà apprendre au score à rejeter de mauvaises hypothèses. H6 augmente la possibilité de les corriger ; elle n'est pas nécessaire pour qu'ils contribuent à apprendre la prudence.

**Correction proposée →** Publier par rôle les exemples effectivement appris, les cas sans candidat juste et les actions autorisées. Garder les différés difficiles dans le développement, même si V1 n'agit pas dessus. Cela permet de poursuivre G1-c sur V1 sans prétendre résoudre le décalage de voie.

**Effort S — P1 pour clarifier le périmètre.**

## 6. Avis global : conserver G0, corriger ses contrats de preuve

### G1 — Le produit des probabilités de rails n'est pas automatiquement une probabilité de paire

**Problème →** Deux rails partagent le nuage, la zone, les appuis et les causes d'erreur ; leurs succès ne sont pas indépendants.

**Preuve — VÉRIFIÉ →** A, lignes 456–475, maximise le produit des scores ; O, G0, lignes 52 et 58, parle de probabilité de couple et de confiance calibrée. Le calibrage par rail ne démontre ni celui du produit, ni celui du meilleur couple retenu après sélection. F reconnaît des limites de calibrage au niveau de la paire.

**Conséquence — SUPPOSÉ pour l'écart terrain →** Le produit peut bien classer les candidats tout en donnant une confiance trop élevée ou trop basse. Le bon Brier de toutes les hypothèses, avec les cas faciles et H0, ne suffit pas pour les actions finalement exécutées.

**Correction proposée →** Avant G1-c, nommer le produit « score de paire » tant que son calibrage n'est pas démontré. Juger empiriquement la décision finale, par usage et zone. Avant l'ombre, vérifier la fiabilité sur les couples gagnants puis sur les actions ; si nécessaire, calibrer leur succès conjoint dans les plis internes, sans utiliser l'examen.

**Effort S puis M — P1 pour la revendication ; P2 pour le calibrage de paire.**

### G2 — La séparation hypothèses / score / décision mérite d'être conservée

**Problème →** Les résultats actuels pourraient conduire soit à activer trop vite, soit à remplacer inutilement toute l'architecture.

**Preuve — VÉRIFIÉ →** Les hypothèses sont inspectables, le score utilise une liste blanche, la CV du score possède une vraie séparation extérieure, et les variantes après coup sont reconnues comme telles. Les défauts démontrés portent surtout sur la causalité des entrées, la portée de la validation, la fidélité de la référence et le contrat de jugement.

**Conséquence →** Je ne vois pas de motif imposant un nouveau moteur ou un modèle plus complexe avant G1-c. En revanche, « rien d'appris » pour les hypothèses doit devenir « générateur figé, avec dépendances apprises identifiées », puisque la hauteur apprise intervient déjà.

**Correction proposée →** Conserver les trois étages, une abstention explicite et une candidate unique. Donner à chaque entrée sa provenance et son instant de disponibilité. Faire porter l'examen sur toute la chaîne figée, pas seulement sur les coefficients logistiques.

**Effort M — P1 pour les contrats ; P3 pour l'extension à davantage de projets et d'opérateurs.**

## Conditions concrètes de départ de G1-c

Les P1 ci-dessus peuvent être regroupés en six livrables vérifiables :

1. **Jeu causal** : zones, rôles, médiane et voisins reconstruits à l'instant de décision ; essai complet couvrant les données futures ; jeu lot régénéré sans humains si cet usage est jugé.
2. **Déclaration de validation** : inventaire des composants déjà appris, portée exacte des 11 plis, traitement de λ et choix explicite entre CV complète et examen neuf d'une chaîne figée.
3. **Référence exacte et porte unique** : règle prudente réellement rejouée ; comparaison appariée ; définitions stables ; garde géométrique vérifiable ; borne et insuffisance d'effectif traitées explicitement.
4. **Registre de population** : exemples réellement retenus, références implicites, SKIP, nuages manquants et compteur d'apprentissage correctement nommé.
5. **Examen neuf pré-déclaré** : parties déjà exposées reclassées, un seul candidat, volume et règle d'arrêt fixés avant ouverture.
6. **Périmètre H6 décidé** : V1 sans différés, ou V1+ avec preuve de série et métriques redéfinies avant le calcul. Aucun remplacement après échec sur le même examen.

Ce sont des conditions pour lancer un jugement confirmatoire crédible, pas une demande d'activer la GCV2. Les résultats de terrain restent à recalculer par l'équipe disposant des jeux après correction des chemins concernés.

**G1-c peut partir après P1**
