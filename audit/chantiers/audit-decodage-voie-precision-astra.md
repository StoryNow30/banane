# Audit indépendant — choix de voie et précision des poses

Date : 21 octobre 2026. Audit de cadrage et de méthode, fondé sur les pièces accessibles ; aucune modification de l’extension, aucun push, merge, tag, release ni action dans ESV. Ce rapport ne constitue pas un audit de la test 17.

## Synthèse en dix lignes

1. **A, le choix de voie, est prioritaire** : une précision millimétrique sur le mauvais rail reste une erreur grave.
2. Le décodage global est une hypothèse pertinente, mais ne peut retrouver une paire absente des candidats ni deviner une voie cible indiscernable géométriquement.
3. La première expérience doit séparer trois causes : candidat manquant, mauvais classement, appuis contaminés.
4. Les 4 erreurs sur 22 poses jugées constituent une alerte solide sur le bloc examiné, pas une estimation représentative du lot entier.
5. Les 525 poses sont un sous-ensemble appris et sélectionné ; les deux plus gros lots en représentent 78,3 %.
6. Une deuxième passe qui réutilise ses propres décisions n’est pas un décodage global conjoint et peut renforcer une erreur.
7. **B ne part pas de zéro** : une hauteur apprise existe déjà en ombre, avec une évaluation documentée sur 621 cuts.
8. Son « zéro nouveau faux vert » à 10 mm ne signifie ni absence de dégradation ni réussite de la cible à 5 mm.
9. Les revisites actuelles mesurent surtout l’acceptation d’une pose affichée ; elles ne donnent pas le plafond de précision d’un pointage indépendant.
10. Décision recommandée : diagnostic oracle et décodage hors ligne pour A ; mesure indépendante et comparaison au modèle existant pour B ; aucune activation sur ces seules preuves.

### Statut des preuves et périmètre effectivement exécuté

- **VÉRIFIÉ — pièce** : contenu lu dans la branche demandée, commit `d344fe1fe55eb2570eca58efe03900d05d3f4d66`. Cela vérifie ce que la fiche rapporte, sans transformer son résultat en reproduction indépendante.
- **VÉRIFIÉ — calcul** : arithmétique recalculée ici à partir des comptes documentés, avec Python et les formules indiquées.
- **RAPPORTÉ** : chiffre du prompt sans pièce primaire retrouvée dans le périmètre consulté.
- **SUPPOSÉ / PROPOSÉ** : hypothèse, modèle ou critère de décision à tester ; jamais un résultat de rejeu.

Pièces lues : `fiches/APPRENTISSAGE_3_0.md`, `L1_APPRENTISSAGE.md`, `PASSATION_CAP5_A.md`, `PASSATION_CAP5_A3.md`, `PASSATION_CAP5_B.md`, `BRUIT_REFERENCE.md`, `HAUTEUR_APPRISE.md`, les éléments pertinents de `P1_CONVENTION.md`, les consignes terrain test 16, le manifeste des parties et `DECISIONS.md`. Lecture ponctuelle de `src/gcv2-l1.js` pour vérifier l’existence des chemins sous seuil, sans audit général du code.

Accès aux deux dépôts obtenu en lecture. La copie de `banane-data` sur sa branche principale est au commit `32b11b7e845c5af8a2b5a6b6eec79b00ff1bfb10`, daté du 29 septembre ; ses collections visibles s’arrêtent à septembre. Les lots et Échos d’octobre nécessaires à une reproduction ne sont pas présents dans cette copie. Les autres branches distantes ont été inventoriées, mais leurs données n’ont pas été intégralement examinées. `tools/juger` est absent de la branche source consultée ; les fiches renvoient à des scripts et sorties hors dépôt. Le texte intégral D-223 n’est pas dans cette branche, qui renvoie à la branche pilote, ni dans le `DECISIONS.md` de main consulté. Ses budgets sont donc pris comme exigences explicites du brief, corroborées partiellement par les fiches.

**Conséquence : audit documentaire, vérifications de cohérence et protocole réalisés ; rejeux terrain non reproduits et expériences proposées non exécutées.** Le cas de deuxième passe à p = 0,0058 et 165,6 mm reste rapporté par le brief, sans trace primaire retrouvée. Les réserves d’examen désignées dans le brief n’ont pas été ouvertes ni utilisées pour choisir les critères.

## 1. Point A — diagnostic et conception minimale

### 1.1 Constats prioritaires

| Problème | Preuve et statut | Conséquence | Recommandation | Effort / priorité |
|---|---|---|---|---|
| Le graphe pourrait ne contenir aucune solution juste | VÉRIFIÉ — pièce : `L1_APPRENTISSAGE`, §1, décrit des mauvaises voies sans hypothèse sur la voie humaine | Un décodeur meilleur ne résout pas une absence de candidat | Mesurer le rappel oracle des paires avant tout réglage des transitions | S / P0 |
| Les voisins cohérents peuvent être faux ensemble | VÉRIFIÉ — pièce : `APPRENTISSAGE_3_0`, bloc 833–870, décrit des verts de chaîne faux de 125–166 mm | La cohérence n’est pas une preuve indépendante d’identité de voie | Tracer la provenance des appuis ; ne pas figer les poses automatiques comme vérité | M / P0 |
| Le jugement ne couvre pas le système complet | VÉRIFIÉ — pièce : 56 références explicites sur 336 cuts du lot ; 22 poses ajoutées jugées, toutes en ADV ; 126 verts jamais visités | Impossible d’appliquer directement le taux mesuré à toutes les poses | Échantillonner aussi les verts de chaîne et les poses sans correction apparente | M / P0 |
| Le rejeu n’est pas parfaitement causal | VÉRIFIÉ — pièce : liste ESV postérieure au lot ; témoin rejoué à 18 différés contre 28 réels, malgré 307/308 poses retrouvées | Une bonne parité sur les poses communes masque des poses ajoutées | Exiger un instantané pré-lot ; publier séparément les sensibilités avec/sans liste tardive | S–M / P0 |
| Le score p n’est pas le risque de la décision finale | VÉRIFIÉ — lecture ciblée : chemins `sous-tau-coherent` et `sous-tau-corrige` pouvant autoriser la pose sous le seuil initial | p faible n’établit pas à lui seul un bug ; p élevé ne certifie pas la sortie de la cascade | Journaliser le candidat réellement écrit, son chemin d’acceptation et son risque après toutes les règles | S / P0 |
| L’identité de voie est remplacée par un seuil de déplacement | VÉRIFIÉ — pièce : « mauvaise voie » opérationnalisée par >100 mm en travers dans l’examen | Mauvais rail proche et bonne voie très décalée peuvent être confondus | Conserver le proxy historique, ajouter une étiquette humaine de branche/paire cible | M / P0 |
| La séparation apprentissage/examen est incomplètement traçable | VÉRIFIÉ — pièces : les huit parties de réglage sont déclarées dans les consignes ; plusieurs ne figurent pas dans le manifeste de cette branche | Un outil peut traiter comme réservée une partie déjà utilisée pour choisir des règles | Réconcilier le manifeste avec tous les usages avant les prochains plis | S / P0 |

**Diagnostic — SUPPOSÉ.** Le cadrage local puis propagé explique plausiblement une partie des erreurs, mais trois problèmes sont mélangés : génération des candidats, identification de la voie cible, et décision avec abstention. Une erreur de 200 mm peut venir de chacun. Les ablations ci-dessous servent précisément à ne pas attribuer tout le gain potentiel au décodage global.

Deux voies physiques peuvent avoir chacune des rails bien soutenus et une géométrie continue. Dans ce cas, le nuage et la continuité ne suffisent pas à décider laquelle est demandée. Il faut une information de branche autorisée et fiable, ou une abstention. « Changement seulement en ADV » ne signifie pas « choisir n’importe quelle branche dans un ADV ».

### 1.2 Modèle explicite proposé

**SUPPOSÉ / PROPOSÉ : graphe en couches de paires physiques, résolu par programmation dynamique.** Pas de réseau neuronal requis pour ce premier test.

- **État** : paire gauche/droite candidate, identité de branche si observable, positions en repère commun, provenance et qualité de preuve. Dédupliquer les mêmes paires issues de plusieurs hypothèses pour ne pas fabriquer des votes indépendants.
- **Émissions** : coût lié au soutien direct des deux rails, forme du champignon, résidus d’ajustement et ambiguïté locale. Conserver les règles métier existantes. La preuve du nuage soutient la présence d’un rail, pas à elle seule son appartenance à la voie cible.
- **Transitions** : continuité géométrique en fonction de la distance physique entre cuts, et non du seul écart de numéro ; compatibilité d’écartement, de dévers et de branche. Les seuils s’apprennent sur les plis internes. Une transition de branche exige une topologie admissible ; un classement ADV incertain ne doit pas autoriser un saut arbitraire.
- **Appuis** : poses humaines explicites et disponibles avant la décision comme observations fortes ; poses automatiques comme observations faillibles. Ne pas compter à nouveau, dans l’émission puis la transition, la même information déjà injectée par le voisinage.
- **Données manquantes** : un état non observable conserve éventuellement une hypothèse latente, mais interdit toute pose. Une longue interruption réinitialise l’incertitude ; elle ne permet pas de sauter gratuitement vers une branche différente.
- **Décodage** : minimiser la somme des coûts locaux et des transitions sur la zone entière ; coût de l’ordre de T×K² avec K candidats par cut. La génération des candidats peut rester le coût dominant.
- **Abstention** : exiger une preuve directe sur les deux rails et une marge suffisante face au meilleur chemin imposant une autre paire physique au cut considéré. Comparer simplement les deux meilleurs chemins complets est insuffisant : ils peuvent différer ailleurs, ou représenter la même paire à quelques dixièmes de millimètre.
- **Contrôle d’incertitude** : tester également stabilité aux perturbations raisonnables des coûts, suppression d’appuis et inversion de l’ordre de parcours. Calibrer le seuil d’acceptation sur des groupes distincts de l’apprentissage.

Le décodeur peut garantir le respect des contraintes formellement codées, pas un taux terrain ≤1 %. Un seuil de marge ne devient pas une probabilité par changement de vocabulaire. La formulation risque/couverture est celle de la prédiction sélective [S1] ; les garanties statistiques nécessitent des hypothèses de représentativité et de dépendance adaptées.

**Point de conception impératif.** La deuxième passe n’est pas équivalente à ce modèle : elle enrichit les voisins au fil des décisions. Elle peut donc dépendre de l’ordre et se confirmer elle-même. Pour exploiter le futur avant une écriture définitive, la zone doit être observée puis décodée avant toute écriture sur ses cuts ambigus. Un calcul global tardif ne défait pas les verts déjà écrits. Première validation uniquement hors ligne, puis éventuellement en ombre selon les règles existantes.

## 2. Point A — expérience discriminante, mesures et collecte

### 2.1 La plus petite expérience qui tranche

**PROPOSÉ : un bloc d’ADV déjà d’apprentissage, complet et avec ses abords**, incluant les quatre erreurs connues, les verts de chaîne et les cuts sans référence à compléter. Ne pas choisir seulement les cuts où le nouveau modèle gagne.

1. Geler captures, liste pré-lot lorsqu’elle existe, repères, règles et tables de candidats. Distinguer candidats indépendants des décisions et candidats générés par les voisins déjà posés.
2. Avec la référence utilisée uniquement pour juger, chercher pour chaque cut si une paire admissible de la bonne voie existe à ≤10 mm. Mesurer aussi les seuils 5 et 20 mm. Un oracle choisit parmi les candidats existants ; il ne crée pas une pose à partir de la vérité.
3. Comparer sur le même bloc : local figé ; deux passes ; décodeur global sur exactement les mêmes candidats. Publier erreurs et abstentions sur l’union des décisions, puis sur leurs intersections.
4. Diagnostic supplémentaire, clairement non déployable : remplacer les appuis automatiques par des appuis humains corrects. Il mesure la part du problème liée à la contamination, sans compter ce résultat comme performance du système.
5. Si la paire correcte manque, tester séparément un élargissement de la génération fondé uniquement sur le nuage. Refaire ensuite la comparaison local/global avec ce nouveau jeu commun.
6. Enlever chaque appui automatique suspect à tour de rôle ; perturber un appui, modifier l’ordre et supprimer des captures. Le graphe doit s’abstenir quand la preuve devient insuffisante, plutôt que choisir systématiquement la voie majoritaire.

**Critère de faisabilité proposé, non certification** : sur les quatre mauvaises voies documentées, le prototype doit en poser correctement au moins trois et différer la dernière, sans nouvelle mauvaise voie ni erreur >50 mm sur les références du bloc ; couverture à moins de 5 points de pourcentage du témoin sur le même univers. Si les candidats corrects manquent, no-go pour le décodage seul et priorité à la génération. Ce critère est volontairement un test de mécanisme sur données connues, pas une preuve de généralisation.

### 2.2 Validation ensuite, sans fuite

Leave-one-party-out externe : tous les lots et toutes les visites d’une même partie restent dans le même pli. Si des parties partagent physiquement les mêmes rails ou captures, regrouper aussi cette acquisition. Dans chaque pli, réapprendre tous les paramètres dépendant des données et choisir les seuils sur des plis internes par partie. Ne pas seulement sélectionner une configuration dont les règles ont déjà été inventées sur la partie externe. Cette dernière procédure est une analyse de robustesse rétrospective, pas un examen intact [S2].

Puis geler modèle, candidats, seuils, métriques et critères avant l’ouverture des deux parties neuves prévues au brief. Examiner les deux sans ajustement entre elles. Les résultats du premier examen ne doivent pas servir à améliorer le second sous la même étiquette « hors apprentissage ». Une réserve jamais entraînée mais consultée à chaque itération devient un témoin de régression, pas un test final indépendant.

**Mesures demandées à l’outil de jugement**, une ligne par cut et par configuration : état initial et date de capture ; zone ; identité de paire ; source de décision ; candidats et soutien par rail ; motif d’acceptation/abstention ; provenance des appuis ; pose proposée ; référence explicite et qualité de jointure ; erreur de chaque rail et erreur maximale ; mauvaise branche humaine ; absence de référence. Agréger par partie, zone, source de décision et profondeur de propagation.

Fixer le dénominateur de chaque indicateur : couverture = cuts posés / cuts initialement éligibles ; risque sélectif = erreurs / poses jugées dans un échantillon représentatif des acceptées. Publier aussi les cuts à nuage vide dans la couverture totale, même s’ils restent exclus du compteur historique de « différés posables ». Les références manquantes ne sont ni des succès ni des abstentions. Ajouter la longueur maximale des séries de mauvaises voies et la proportion de blocs touchés.

### 2.3 Ce que valent les nombres disponibles

| Calcul refait | Résultat | Écart / interprétation |
|---|---:|---|
| Somme du tableau test 16 | 525 jugées, 407 ≤5 mm, 510 ≤10 mm | Aucun écart avec les totaux publiés |
| 407/525 | 77,5238 % | Conforme à 77,5 % arrondi ; ≤5 n’est pas strictement <5 |
| 510/525 | 97,1429 % | Conforme à 97,1 % arrondi |
| Poids des deux plus gros lots | 411/525 = 78,2857 % | Moyenne dominée par deux lots |
| Moyenne non pondérée des huit lots ayant au moins une référence | 67,067 % à ≤5 mm | 10,46 points sous la moyenne par pose ; ce n’est pas une moyenne par partie, car une partie a deux lots |
| 4/22 | 18,1818 % | Taux du sous-ensemble jugé, toutes poses en ADV |
| Wilson bilatéral 95 %, 4/22 | 7,3069–38,5166 % | Conforme à 7,3–38,5 % ; descriptif sous approximation binomiale |
| 0 erreur sur 22, borne haute unilatérale 95 % | 12,7305 % | Même un zéro n’aurait pas établi ≤1 % |

**VÉRIFIÉ — calcul sous hypothèse binomiale indépendante.** Avec zéro erreur, borne haute = 1−0,05^(1/n) : 299 observations indépendantes sont nécessaires pour passer sous 1 %, 99 pour passer sous 3 % [S3]. Avec 0/525, cette borne serait 0,569 %, mais elle n’est pas une certification ici : données de réglage, sélection des jugés, répétition spatiale et regroupement par partie.

299 cuts adjacents ne valent pas 299 observations indépendantes. Un petit nombre de parties ne permet pas de mesurer précisément le risque sur une nouvelle partie. Rapporter des intervalles par blocs/parties en complément ; un bootstrap avec zéro erreur partout ne doit pas produire une fausse certitude à borne zéro. Si l’on utilise un plan par grappes, prévoir sa taille à partir de la dépendance observée ou échantillonner largement des situations distinctes.

**Go/no-go proposé pour une preuve de risque** : borne haute unilatérale 95 % ≤1 % pour les mauvaises voies et ≤3 % pour les poses >50 mm, échantillonnage représentatif et dépendance traitée ; zéro pose sans preuve directe dans le nuage ; aucun cas catastrophique nouveau inexpliqué ; perte de couverture ≤2 points face au témoin sur l’univers fixé. Si les bornes sont trop larges : résultat inconclusif, donc pas de go terrain. Ces deux bornes à 95 % sont individuelles ; exiger une garantie conjointe à 95 % demande un ajustement. Par exemple, partager 5 % en deux donne, à zéro erreur et sous indépendance, 368 observations pour 1 % et 122 pour 3 %.

### 2.4 Utiliser au mieux le temps humain

**PROPOSÉ — collecte de diagnostic** : blocs complets d’ADV enchaînés, bifurcations avec deux paires plausibles, limites ADV/abords, séquences d’appuis automatiques et longues interruptions. Relire aussi les verts de chaîne. Consigne : identifier la branche voulue, confirmer explicitement les deux rails ou indiquer « indécidable / absent du nuage », sans forcer une pose.

**Collecte d’estimation séparée** : tirage fixé avant de voir les erreurs, stratifié par zone et source de décision. Conserver les probabilités d’inclusion pour estimer le risque global ; ne pas utiliser directement le taux d’un échantillon enrichi en anomalies. Un bloc de 40–60 cuts peut trancher une cause ; il ne certifie pas le budget de 1 %.

Les trois faux progrès à éviter sont : **(1)** choisir ou recalibrer sur les mêmes parties, y compris avec des listes post-lot ; **(2)** améliorer les chiffres en jugeant seulement les nouveaux posés faciles et en oubliant les verts de chaîne ; **(3)** renforcer une voie fausse par des appuis autocorrélés, puis présenter la marge du graphe comme une confiance indépendante.

## 3. Point B — plafond de précision et modèle minimal

### 3.1 Le cadrage doit intégrer les travaux déjà présents

| Problème | Preuve et statut | Conséquence | Recommandation | Effort / priorité |
|---|---|---|---|---|
| Le brief laisse penser que la régression de pose reste à inventer | VÉRIFIÉ — pièce : `HAUTEUR_APPRISE`, modèle linéaire par groupe, enveloppe ±5 mm, évaluation sur 621 cuts | Risque de refaire une expérience déjà menée | Prendre ce modèle comme témoin obligatoire | S / P0 |
| « Zéro nouveau » dépend du seuil | VÉRIFIÉ — pièce : 85→61 faux verts à 10 mm, zéro nouveau ; six nouveaux à 9 mm et trois à 11 mm | Pas de garantie d’absence de dégradation | Mesurer transitions aux seuils 3/5/7/10/20/50 mm et erreurs continues | S / P0 |
| Revisiter n’est pas repointer indépendamment | VÉRIFIÉ — pièce : 15/19 validations espacées identiques à <0,5 mm ; pose précédente toujours visible | Ancrage et absence de geste réduisent artificiellement les écarts | Repointage indépendant dans un lecteur hors ligne, sans affichage de la pose précédente | M / P0 |
| Lissage des voisins utilisé comme bruit | VÉRIFIÉ — pièce : résidus latéraux 1,52 mm et verticaux 2,33 mm, très variables par séance | Mélange bruit, défaut réel, erreur de référence et corrélation spatiale | Le traiter comme indicateur de dispersion, pas comme borne absolue du bruit | S / P1 |
| Une correction peut modifier les décisions suivantes | VÉRIFIÉ — pièce : `P1_CONVENTION`, ricochet avec un nouveau posé jugeable à 29 mm | Amélioration isolée ≠ amélioration en chaîne | Évaluer d’abord à décisions gelées, puis en boucle complète avec appuis cohérents | M / P0 |

**VÉRIFIÉ — calcul** sur les comptes de la hauteur apprise : 319→281 cuts >5 mm sur 621 signifie 302→340 cuts ≤5 mm, soit **48,63→54,75 %**, gain de **6,12 points**. Ce résultat porte sur une autre population et d’autres versions que les 525 poses. Il ne faut ni soustraire ni extrapoler les deux taux comme une progression commune vers 90 %.

### 3.2 Ce qu’on peut et ne peut pas dire du plafond

Le pixel annoncé et documenté à environ 0,386 mm ne paraît pas limitant pour 5 mm. Mais la résolution du nuage n’est pas la taille du pixel : densité, direction des tirs, épaisseur apparente du dessus, points manquants, recalage et convention de référence comptent également.

**SUPPOSÉ — modèle de mesure** : référence humaine = position cible + biais de convention + erreur de pointage ; la position cible elle-même doit être définie précisément sur le champignon. Un modèle entraîné sur les corrections peut apprendre le biais de convention. Il peut se rapprocher de la référence sans devenir plus juste physiquement. La métrologie distingue répétabilité, biais et incertitude [S4].

L’estimation σ = écart-type des différences entre deux pointages / √2 n’est valable que si les pointages sont indépendants, de variance comparable et dans le même repère. Les revisites actuelles ne satisfont pas manifestement cette indépendance. Avec corrélation ρ entre visites, Var(différence)=2σ²(1−ρ) : un fort ancrage donne une petite différence même si l’erreur absolue reste importante.

Les résidus autour d’une courbe lisse ne sont pas une borne supérieure générale : les défauts réels peuvent les gonfler, tandis qu’un biais lent commun aux voisins peut disparaître dans le lissage. La valeur de fin de geste de 0,75 mm ne constitue pas non plus une borne inférieure prouvée de l’erreur humaine.

**Expérience minimale proposée** : 60 cuts de voie correctement identifiée, répartis sur au moins quatre parties et plusieurs densités ; 30 proches de 3–7 mm, 15 nettement meilleurs, 15 à 7–15 mm. Deux pointages indépendants de chaque paire, ordre aléatoire, délai entre séances, même convention et même nuage, sans affichage de la pose précédente ni de la prédiction. Troisième pointage sur 20 cas tirés à l’avance. ESV n’est pas modifié : un lecteur hors ligne suffit ; s’il n’existe pas, cette mesure reste à préparer. Les 60 cuts forment un pilote de mesure, pas une certification de 90 %.

Mesurer différences signées par axe, dispersion robuste, désaccord de voie, covariance entre rails, biais de séance et erreur maximale par cut. Le bruit sur deux rails corrélés ne se déduit pas du bruit d’un rail en les traitant indépendamment. Comparer ensuite à des ajustements géométriques sur sous-échantillons de lignes de scan, plutôt qu’à un simple bootstrap de points corrélés. Une référence indépendante est nécessaire pour isoler un biais systématique ; deux pointages du même opérateur ne suffisent pas.

**Plafond chiffré aujourd’hui : indéterminé.** Les données documentées rendent un gain fin plausible, mais ne prouvent ni que 90 % <5 mm est atteignable ni qu’il est impossible. Estimer ce plafond par simulation des erreurs mesurées, en conservant leurs corrélations et leurs variations par séance, et en séparant accord avec l’humain et exactitude physique.

### 3.3 Modèle minimal et repli

**PROPOSÉ** : comparer correction nulle, correction constante verticale par groupe et modèle linéaire vertical existant. N’ajouter une régression latérale que si les résidus signés montrent un signal reproductible hors partie. Une médiane de valeur absolue de 3,6 mm ne dit pas qu’il faut monter ou descendre de 3,6 mm.

Cible : référence finale moins pose actuelle, par rail et par axe, uniquement après confirmation de la bonne voie. Traits disponibles avant décision : épaisseur et quantiles du dessus, résidu de forme, soutien du flanc, indicateur de calage appliqué/refusé, qualité du repère et observabilité. Ne pas injecter identité de partie, correction future ou voisin humain indisponible à l’exécution. La fiche existante documente déjà un échec du nombre brut de points comme variable transférable entre acquisitions : en faire d’abord un indicateur de qualité, pas une règle universelle.

Régularisation vers zéro, nombre de paramètres limité, apprentissage robuste et pondération par partie ; plafond et facteur d’application sélectionnés dans les plis internes. Repli à correction nulle si preuve insuffisante, domaine de traits inconnu, convention ambiguë, voie incertaine ou gain prédit trop proche de son incertitude. Recontrôler les deux rails et les contraintes métier après correction, sans modifier leurs seuils.

**Aucune règle de repli apprise ne garantit de ne jamais aggraver une pose juste inconnue.** La correction nulle garantit seulement de ne rien changer ; une correction bornée garantit au mieux une borne sur l’aggravation. Si chaque rail bouge d’au plus c en distance euclidienne dans un repère fixe, l’erreur maximale du cut augmente d’au plus c. Un plafond par axe doit être converti en norme. Une garantie conditionnelle de maintien sous 5 mm nécessiterait une borne valide sur l’erreur initiale laissant cette marge, rarement disponible ici.

## 4. Point B — protocole, critères et données supplémentaires

**Étape 1 : décisions et identité de voie gelées.** Recalculer les poses de la version cible et construire les résidus sur les mêmes cuts. Séparer les anciennes versions : leurs corrections ne sont pas automatiquement les résidus de la nouvelle. Toutes les variantes sont évaluées sur un ensemble commun ; la correction nulle est comptée comme résultat, pas retirée du dénominateur.

**Étape 2 : validation imbriquée par partie et, si possible, par acquisition.** Les familles explorées sur tout l’historique restent exploratoires, même si leurs coefficients passent par une validation croisée. Geler une famille avant l’examen neuf. Conserver une validation par partie et les résultats de la pire partie, en plus du cumul [S2].

**Étape 3 : bruit et transitions.** Donner erreurs signées et absolues, médiane/P90/P95, proportion strictement <5 mm et proportion ≤5 mm séparées. Tableau apparié : <5→≥5, ≥5→<5, ≤10→>10 et transitions graves. Publier résultats sur toutes les poses de bonne voie, puis sur les seules poses effectivement corrigées. Donner les résultats conditionnels et le rendement global « bonne voie et <5 mm » sur l’ensemble éligible.

**Étape 4 : boucle complète hors ligne.** Les appuis doivent refléter les poses réellement produites, ou leur séparation doit être justifiée explicitement. Mesurer les décisions nouvelles, perdues, erreurs de voie et propagation. Un modèle qui ne crée aucune pose en calcul isolé peut changer la décision des voisins s’il est intégré plus tôt. Aucun test terrain ni geste automatique de validation n’est prescrit ici.

### Critères proposés, à figer avant l’examen

| Niveau | Go | No-go ou inconclusif |
|---|---|---|
| Recherche utile | Gain apparié ≥5 points à <5 mm, intervalle par groupes du gain au-dessus de zéro ; P95 non dégradé | Gain seulement sur données de réglage ou incertitude recouvrant zéro |
| Objectif 90 % | Borne basse unilatérale 95 % du taux <5 mm ≥90 %, sur population définie et référence qualifiée | Taux ponctuel à 90 % mais borne basse inférieure : cible non démontrée |
| Dégradation | Zéro nouvelle mauvaise voie, zéro nouvelle erreur >50 mm observés ; risque de nouvelles erreurs >10 mm explicitement borné | Un seul nouveau cas grave inexpliqué bloque ; zéro cas ne prouve pas risque nul |
| Tolérance fine proposée | Borne haute 95 % du taux de passages ≤10→>10 ≤1 % parmi les cuts initialement ≤10 mm | Échantillon trop faible ou dépendant pour établir cette borne |
| Couplage | Aucune décision ajoutée/perdue inattendue, aucun appui incohérent ; budgets A conservés | Gain isolé accompagné de ricochets non qualifiés |

Le seuil de 1 % pour les nouvelles erreurs >10 mm est une **proposition d’évaluation**, pas une décision métier existante. Si l’exigence reste littéralement « aucune aggravation individuelle », aucune correction non nulle ne peut recevoir cette garantie générale. Ne pas remplacer cette exigence par une promesse statistique sans le dire.

**Données prioritaires** : cuts correctement identifiés à 3–7 mm, calages refusés, dessus épais, sessions de densités différentes, et un échantillon de poses déjà très bonnes pour détecter les dégradations. Les grosses erreurs de voie alimentent A, pas la régression fine de B. Ne sélectionner que les grosses retouches créerait un modèle qui corrige trop les poses déjà bonnes. Conserver « référence acceptée sans déplacement » comme une catégorie distincte du repointage indépendant, sans la rejeter automatiquement.

## 5. Arbitrage, ordre de travail et décisions demandées

**A ouvre le plus grand bond utile**, car il traite des erreurs de 150–200 mm et la contamination du voisinage. B améliore un autre régime : quelques millimètres lorsque le bon objet est déjà choisi. Le gain réalisable de chacun reste à mesurer ; il n’est pas justifié d’annoncer un pourcentage global de progrès.

| Ordre | Travail concret | Sortie attendue | Effort |
|---|---|---|---|
| 1 | Réunir les lots/Échos d’octobre et sorties de jugement ; réconcilier manifeste et dates des listes | Jeu causal, dénominateurs explicites, sources reproductibles | S–M |
| 2 | Diagnostic oracle sur un bloc déjà appris | Parts candidat manquant / mauvais classement / contamination / cible ambiguë | S |
| 3 | Comparaison locale, deux passes et graphe sur candidats identiques | Preuve ou réfutation de l’intérêt spécifique du décodage | M |
| 4 | Courte collecte de références indépendantes pour B | Dispersion du pointage et convention, sans modification ESV | M |
| 5 | Comparaison au modèle de hauteur déjà documenté | Gain fine précision apparié, dégradations et domaine valide | S–M |
| 6 | Gel puis examen des deux parties neuves prévues | Verdict hors apprentissage, éventuellement inconclusif | M |

Avec un seul opérateur : consacrer d’abord une séance aux ambiguïtés de voie du bloc diagnostique et aux verts de chaîne ; réserver ensuite deux passages courts aux 60 cuts de précision. Le calcul hors ligne n’a pas besoin de mobiliser l’opérateur. Ne pas utiliser les parties réservées pour sélectionner les premiers cas de diagnostic.

**Décision immédiate recommandée : autoriser la préparation de ces deux expériences hors ligne, en priorité A, sans activation ni changement des règles métier.** Le rapport lui-même ne donne pas un go de déploiement. La condition qui manque pour reproduire les chiffres est l’accès au paquet d’octobre : archives complètes, empreintes, versions/réglages, listes pré-lot lorsqu’elles existent, vérités explicites et sorties de jugement. Si l’instantané pré-lot est définitivement absent, conserver le lot comme diagnostic et publier cette limite ; ne pas inventer la causalité.

### Références méthodologiques et commandes de traçabilité

- [S1] Geifman et El-Yaniv, *Selective Classification for Deep Neural Networks*, 2017 : https://arxiv.org/abs/1705.08500 — distinction entre risque sélectif et couverture ; ne donne pas de garantie automatique pour des cuts corrélés.
- [S2] Documentation officielle scikit-learn, *Nested versus non-nested cross-validation* : https://scikit-learn.org/stable/auto_examples/model_selection/plot_nested_cross_validation_iris.html — séparation du choix et de l’évaluation.
- [S3] NIST, *Exact Binomial Confidence Limits* : https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/exacbici.htm — limites exactes sous modèle binomial.
- [S4] NIST, *Gauge R & R studies* : https://www.itl.nist.gov/div898/handbook/mpc/section4/mpc4.htm — répétabilité, reproductibilité et biais.

Commandes exécutées : `git clone --depth 1 --branch claude/50-apprentissage-3-0 …`, `git rev-parse HEAD`, `git ls-remote --heads …`, lectures `cat`/`sed`/`rg` des pièces ci-dessus ; clonage de la branche principale du dépôt de données et inventaire de `collections/`. Les clones sont restés inchangés. Aucun script de rejeu, aucune suite de tests de l’extension ni apprentissage terrain n’a été lancé.

Recalculs reproductibles : pourcentages = 100×numérateur/dénominateur ; borne zéro erreur = 100×(1−0,05^(1/n)) ; taille minimale = plafond(log(0,05)/log(1−risque)). Wilson utilise z=1,95996398454, centre `(p+z²/(2n))/(1+z²/n)` et demi-largeur `z×sqrt(p(1−p)/n+z²/(4n²))/(1+z²/n)`. Les comptes du tableau test 16 ont été extraits et resommés ; aucune coordonnée terrain ni identité personnelle n’est reproduite dans ce rapport.
