# CH-034 : journal de recherche (la pose d'Ariane en Orbite, fidèle à l'Écho)

Une entrée par piste : définition écrite avant, résultat, décision. Qualifications : ÉTABLI = compté par un script sur les exports ; PROBABLE = lecture de comptes ; SUPPOSÉ = hypothèse nommée. Aucun numéro de cut isolé, aucune coordonnée, aucun identifiant ESV ici : les tables par cut restent hors du dépôt (scratchpad ou `banane-data`). Commencé le 1/11/2026.

## 0. Cartographie des leviers (écrite le 1/11, avant tout code)

### 0.1 La chaîne de pose, de bout en bout, et ce qui la règle

| Étape | Ce qui se passe (code) | Ce qui règle le résultat | Ce que le corpus en dit |
|---|---|---|---|
| **a. Lecture de la page ESV** | `src/adapter-page.js` : état du cut (deux rails U50, contour du profil, repère profil↔scène), caméra orthographique de la vue du rail (±0,2 unité de scène, donc chaque rail a sa vue, l'autre projette à NDC ≈ 7), liste des coupes de la partie (`src/esv-observer.js`, `src/liste-memoire.js` : statut, bords monde, `RailSpacing`, `TrajAzimuth`), événements jQuery `railPairSelected`, `railPairUpdated`, `railPairSeen` (en ombre, `esvEvents`). | Rien n'est réglable ici : c'est le contrat ESV. Ce qui N'EST PAS exploité pour poser : la liste (B1 en ombre), les événements, l'écartement du projet (`RailSpacing` : relevé seul). | Le journal porte l'instantané de la liste au chargement (`ariane-liste-partieN-*.json`), les comptes de `b1-ombre` (889 sur la partie 20), les `esv-event`. |
| **b. Capture LiDAR** | `src/native-lidar.js` : points dans une ROI de 0,5 × 0,4 × 0,3 m autour de chaque rail, nœuds chargés par la vue seulement (`maxNodes` 512, `maxPointsPerRail` 50 000) ; mode rapide neuf cuts sur dix (`modeRapide:'echantillon'`), `stabiliteMs` 800. | Le nuage que voit le moteur est **celui de la vue d'ESV à l'instant de la capture** : hors de la vue (±200 mm), moins de points. | Les corpus `ariane-gcv1-corpus-*` portent le nuage capturé de chaque cut (889 sur 889 retrouvés pour la partie 20) : tout rejeu voit exactement ce que le lot a vu. |
| **c. Moteur GCV1 (gelé)** | `src/geometry-candidate-v1.js` : gabarit U50 (dessus + flanc interne) cherché sur une grille de 3 mm dans **±80 mm latéral, ±40 mm vertical** autour de la pose de départ d'ESV (`searchY`, `searchZ`), points lus dans ±180 mm ; perte = médiane des carrés des plus proches points ; raffinement à 1 mm ; nappes dessus et flanc par droites robustes ; abstention si dessus < 15 points, flanc < 6, pente limitée, rapport de perte du second minimum < 1,5 (ambiguïté), intersection hors fenêtre. `src/gcv1-shadow.js` : S1 (repêchage), calage de convention (`placement-convention.js`, domaine ±8 mm), garde d'écartement de paire (1 420–1 470). | Gelé (empreinte contrôlée). La **fenêtre ±80 mm** est la borne de D-265 : la vérité des 21 fautes est à 74–281 mm. Le flanc interne et le dessus sont les deux seules surfaces lues ; un rail dont le flanc est hors de la vue est abstenu. | Le rejeu `base` du banc (`tools/banc-differes.cjs`) retrouve la pose du lot à 0,8 mm sur 646/646 (CH-012) : le moteur est rejouable hors ligne sur les vrais nuages. |
| **d. Décision du lot (chaîne)** | `src/lot-decision.js` : appuis = cuts posés ET validés du lot (`anchorRule:'placed'`), 2 plus proches à 3 cuts (`gap` 3 ; 10 sous L1) ; garde de continuité 30 mm à la voie prédite ; garde d'écartement voisin 20 mm ; garde de paire ; garde d'écartement bas 1 420 ; **reprise depuis la voie** (moteur relancé sur rails translatés sur la voie : `window`), puis **choix** d'un minimum local à 15 mm de la voie (`choice`), ornière au PN (`crossing`) ; voie encadrée (appuis des deux côtés) en reprise. | `DEFAULTS` du module (figés, sous garde). Le premier passage (moteur seul, continuité ≤ 30 mm) pose 516/721 de la partie 20 ; `window`/`choice`/`crossing` posent 129 ; L1 51. | `gcv1-shadow-observed.lotObservation` : étage, appuis, candidats (6 au plus), écart à la voie, par cut. CH-015 : faute selon les appuis : 46 % sans appui, 12 % avec 1, 3 % avec 2. |
| **e. GCV2 L1-se (différés)** | `src/gcv2-l1.js` : 12 hypothèses au plus par rail (H0 départ, H1 astar, H2 cellules du réservoir, H3 chaîne/voie, H4 voisins, H5 écartement médian, H6 décalage des voisins validés du lot) ; modèle logistique figé (`gcv2-parametres-l1.js`, usage « lot ») → p(10 mm) par hypothèse ; meilleure paire = produit des p sous contrainte d'écartement ; τ, δ par zone ; L1-e : correction d'écartement à la référence des lignes valides non touchées de la liste, voie des voisins, consensus, recherche recentrée en ADV et abords (leviers v5/v6 : `vetoVoieAbsMm` 100, `voieIncoherenteMm` 40, `sansVoieRien`…). | `LEVIERS_LIVRES` (≈ 90 leviers, figés hors banc) et les paramètres appris (G1-b, 19/10, parties 12–29 et 2:1, 2:10, 2:11). **Ne s'applique qu'aux cuts que la chaîne ne pose pas** (D-221). | Le banc rejoue L1-se à l'identique (parité `parite-l1se-sw.cjs`). `lotObservation.l1` par cut : état, motif, p, hypothèse, paire. |
| **f. Commande, vue, clic** | `commandRails` : cible dans la vue du rail (NDC ±0,99) sinon `hors-vue` → différé, sauf `deplacerVue` (clic droit, test 25) ; `clickPosition` : clic au pixel (0,499 mm par pixel à la vue habituelle du lot ; 0,386 en séance Écho), **troncature par Chromium** (biais −0,25 mm par axe, ÉTABLI CH-012), reclic ±½ pixel si l'écart dépasse 1 mm ; mode rapide : pose directe sans recentrage (`clicHumain:'tel-quel'`). | `pilote.rapide.clicHumain`, `deplacerVue` (geste, dezoomMax 1,5, pixelMaxMm 0,9). Le zoom n'est jamais changé **pour cliquer plus fin** : seulement dézoomé pour atteindre une cible hors vue. | Journal : `applied-verified.observed.vueFin.pixelMm` par cut ; `clic-hors-vue` ; `deplacer-vue` (19 refus « caméra immobile » sur la partie 20 : la molette ne marchait pas ; clic droit allumé depuis la test 25, jamais vu dans un export). |
| **g. Gardes avant validation** | `gardeApresDiffereCommande` (R3 : cut−1 ou cut−2 différé ET appuis < 2 → différé, test 25+), `fauxVertOmbre` (fermé), `reglesMetier` (ombre), `hauteurApprise` (ombre, `appliquer:false`). | `lot.gardeApresDiffere`, réglages d'ombre. | La partie 20 est ANTÉRIEURE à R3 : rejouable hors ligne (CH-015 : 38 signalés, 13 fautes sur 21 rattrapées). Aucun lot avec R3 n'a d'Écho. |
| **h. Différé** | Navigation sans décision (`defer-intent`, jamais SKIP) ; le cut reste rouge, repris par la passe ou l'opérateur. | Politique `defer`. | 168 différés sur 889 (partie 20) ; motifs (`classerMotif`) ; passe en ombre sur chacun. |
| **i. Deuxième passe** | En fin de lot, la GCV2 redécide chaque différé avec les poses d'avant ET d'après (transport), garde A des appuis (déplacement > 100 mm sans appui normal à 4 cuts → rien), plafond 10 écritures. | `passeDifferesDefaut` (écriture ON depuis la test 24, D-259). | `passe-differes-ombre` : 80 « poserait » sur 168 (partie 20), tous jugés : 2/80 > 50 mm, 3/80 > 20 mm. Partie 6 (31/10) : 2 écrits à ≈ 111 et 115 mm, non jugés. |
| **j. Relecture / correction** | Après le lot : visite des zones à risque, correction « corriger » par défaut (test 27) ; `relecture-ombre` juge « je corrigerais » au-delà de 5 mm. | `relectureDefaut`. Hors du périmètre « pose en autonomie » mais elle réécrit des poses du lot : la mesure `juger-lot` ferme sa fenêtre avant elle. | `relecture-ombre` (1 107 sur la partie 20), corrections (92). |

### 0.2 Les leviers, et ce que le corpus permet d'en mesurer

| Levier | Où il agit | Mesurable hors ligne sur le corpus ? | État de l'art (à ne pas rejouer) |
|---|---|---|---|
| L1. **Politique de différé et gardes (R3, racines, chaîne cassée)** | g | **Oui, apparié** : rejeu `base` fidèle + Écho de la partie 20 ; coût (différés en plus) sur tous les lots sans Écho (.24 à .28). | R1/R2/R3 réglées sur la partie 20 (CH-015), jamais validées hors échantillon ; H14 réfutée (CH-033). |
| L2. **Génération de candidats hors ±80 mm** (le nuage) | c | **Oui** : les nuages des 21 fautes sont dans le corpus ; on peut chercher le gabarit sur toute la ROI (±180 mm lus, ±500 mm longitudinal) et voir si la bonne voie y est, et avec quel signal qui la distingue. | D-265 : 0/21 dans les candidats actuels ; CH-033 : aucune référence indépendante dans la chaîne. **Non fait** : chercher dans le nuage au-delà de ±80 mm. |
| L3. **Seconde estimation indépendante du même nuage** (autre méthode : ornière/plan de roulement, symétrie des deux rails, écartement de projet) | c, d | Oui (nuage présent) ; puissance limitée aux 172 jugés. | Ornière (`level-crossing.js`) en dernier recours seulement. |
| L4. **Liste d'ESV comme référence indépendante** (voisins sains, écartement de projet `RailSpacing`) | a, d, e | Oui : instantané de la liste dans l'export ; CH-033 a mesuré la portée des sains (12/13 fautes sans sain à 200 cuts d'un côté). | H10–H13 réfutées par couverture ; L1-e lit déjà l'écartement des lignes valides. |
| L5. **Pixel et zoom au clic** | f | Partiellement : le pixel par cut est au journal ; l'effet du zoom se **simule** (résidu de troncature) mais ne se mesure qu'au terrain. | Arrondi du clic : −1,8 pt à 3 mm, non retenu (D-266). Oracle § 0.4 : le pixel (0,5 mm) est sous le bruit de la référence (1 mm) : gain attendu nul sur « fine », petit sur « sous 5 ». |
| L6. **Paramètres de la chaîne** (gap, guardMm, chooseMm, minTop…) | d | Oui (banc), mais ces fichiers sont sous garde et le gain fin est borné par l'oracle. | Curseurs 4.7 (D-047, D-050). |
| L7. **Apprentissage L1 sur les corrections de l'opérateur** (réapprentissage des paramètres, τ/δ) | e | Oui : `tools/gcv2-jeu.cjs` + `gcv2-apprendre.cjs` ; mais le corpus jugeable des poses L1 est petit (51 posés L1 sur la partie 20). | Paramètres de G1-b (19/10). CH-012 (H7–H9) sans gain. |
| L8. **Deuxième passe : ne poser que le sûr** | i | Oui : 80 poserait jugés (partie 20) ; les écritures réelles (.24+) sans Écho. | Garde A réglée sur la seule partie 0. |
| L9. **Déplacement de vue** (atteindre la cible hors vue) | f | Non mesurable hors ligne (la vue n'est pas rejouée) ; seulement le nombre de cuts concernés (29 différés de la partie 20 avec geste, 0 des 21 fautes). | CH-018, CH-031 : clic droit allumé, jamais observé sur ESV. |
| L10. **Hauteur apprise / correction verticale** | d | Oui (ombre consignée) ; mais 0 faute verticale sur la partie 20, et le vertical est l'axe où la référence est la moins bonne (1,26 à 4,1 mm). | H7 non répliquée. |

### 0.3 Le corpus jugeable (ÉTABLI, 1/11)
- **Partie 20, lot du 28/10 (4.9.5.23, L1-se, R3 absente)** : 889 cibles, 721 posés, 168 différés ; 172 jugés (97 corrigés, 75 contrôlés bons) ; 21 fautes, toutes latérales, 0 verticale. 20 volumes ; nuages des 889 cuts retrouvés (rejeu possible). Écho du 29/10 : 447 visites, 393 cuts distincts, **168/168 différés visités, 177/721 posés**, concentrés près des différés (biais : les taux des jugés ne sont pas ceux de la partie).
- Huit couples lot + Écho antérieurs (26/10) : 452 jugés, 1 faute (CH-033) : servent de **témoin de fausses alarmes**, pas de rappel.
- Lots .24 à .28 (29 au 31/10, R3 et passe en écriture) : **aucun Écho** : mesures de coût seulement (différés que créerait une garde, cuts écrits par la passe).
- Conséquence sur la puissance : toute règle réglée sur les 21 fautes d'une seule partie (4 épisodes) et examinée sur 9 fautes se juge sur des intervalles de ±30 points. Un gain « significatif » hors échantillon au sens de D-262 (intervalle excluant 0 sur le taux de fautes) demande un Écho sur les posés d'au moins une partie récente ; ce journal dit, pour chaque conclusion, combien de jugés il faudrait.

### 0.4 Le plafond : l'oracle du bruit (calcul, SUPPOSÉ gaussien indépendant par axe et par rail ; graine 20261101, 200 000 tirages)
Un poseur **parfait** (écart vrai nul), mesuré par geste à travers le bruit de la référence (`fiches/BRUIT_REFERENCE.md`) :

| Bruit de la référence (lat ; vert, mm par rail) | mesuré sous 3 mm | sous 5 mm | fine (≤ 10) | faute |
|---|---|---|---|---|
| séance stricte (1,01 ; 1,26) | 93 % | 100 % | 100 % | 0 |
| toutes séances (1,5 ; 2,3) | 50 % | 92 % | 100 % | 0 |
| pire séance verticale (1,6 ; 4,1) | 20 % | 56 % | 97 % | 0 |

Et une pose d'erreur vraie latérale e (même sur les deux rails), bruit strict : e = 4 mm → 62 % « sous 5 » ; e = 6 → 2 % ; e = 8 → 94 % « fine » ; e = 10 → 22 % « fine » ; e ≥ 12 → 0.
- Lecture : la **classe « fine »** (≤ 10 mm) est insensible au bruit : une pose mesurée « moyenne » ou « faute » est une vraie erreur ; les 11 moyennes (6,4 %) et les 21 fautes (12,2 %) de la partie 20 sont le gisement réel ; les 65 « fines » (37,8 %) ne sont pas distinguables d'une pose parfaite sous ce bruit sauf au-delà d'environ 6 mm d'erreur vraie.
- « Acceptation » (43,6 %) n'est pas une mesure de distance : c'est le geste de l'opérateur (D-270). Le gain atteignable en acceptation n'a pas d'oracle ; il se mesure seulement apparié entre versions.
- Donc la pose « parfaite » atteignable se lit : **faute → 0, moyenne → 0, fine qui ne dépasse pas ~6 mm d'erreur vraie**. Rien sous 3 mm n'est mesurable (D-270).

### 0.5 Ordre des pistes (décision du 1/11)
1. Reproduire la base et obtenir un rejeu fidèle de la partie 20 (banc) : condition de toute mesure appariée. (§ 1)
2. **L2 / L3 : le nuage** : les 21 fautes ont-elles leur vrai rail dans le nuage capturé, et un signal qui le distingue ? C'est la seule piste qui n'a pas été tentée et qui vise les fautes (D-270 : « poser sur la bonne voie quand c'est possible »). (§ 2)
3. **L1 : gardes et politique de différé** : la seule piste qui agit sur les fautes à coup sûr (différer), à chiffrer par geste et en coût de différés sur les lots récents. (§ 3)
4. L4, L8, L5, L7 ensuite ; L9 et L10 : impasses documentées sauf fait nouveau.

## 1. Base reproduite et rejeu (1/11)

### 1.1 Tableau standard de la partie 20 (ÉTABLI, `tools/juger-lot.cjs`, 1 min 42)
Identique à CH-015 et CH-033 : 889 cibles, 721 posés, 168 différés ; 172 jugés ; acceptation 75 (43,6 % [36,4 ; 51,1]), fine 65 (37,8 %), moyenne 11 (6,4 %), faute 21 (12,2 % [8,1 ; 17,9]) ; latéral : moyenne 5, faute 21 ; vertical : moyenne 17, faute 0 ; sous 5 mm 63,4 %. Budget D-223 : plancher 2,9 % [1,9 ; 4,4], jugés insuffisants pour trancher. Passe en ombre : 80 « poserait » jugés, médiane 3,25 mm, 2 > 50 mm.

### 1.2 Rejeu hors ligne (en cours)
`tools/banc-differes.cjs rejouer`, profils `base` et `L1-se`, 889 captures retrouvées sur 889, liste d'ESV du lot fournie. Fidélité attendue (CH-012) : 646/646 à 0,8 mm. Résultat à écrire ici.

## 2. Piste L2 : le nuage lui-même (1/11)

### 2.1 Question écrite avant la mesure
Pour les 21 fautes de la partie 20 (vérité de l'opérateur à 107–391 mm de la pose du lot, D-265 : hors des ±80 mm de la recherche du moteur), **le vrai rail est-il dans le nuage capturé**, et le moteur, relancé autour de lui, y trouverait-il une cellule forte ? Si non : impasse (la vue ou le nuage manquent) ; si oui : un levier « génération de candidats hors ±80 mm » existe et il faut mesurer s'il distingue le vrai rail du faux.
Méthode : capture du cut (corpus du lot, 889/889), vérité = pose validée par l'opérateur transportée dans le repère profil de la pose de départ (`micDepuisDepart` de la jointure ; même règle que `juger-lot`) ; moteur gelé relancé sur le rail translaté à la vérité, puis à la pose du lot (`scientificProposeBothAvecReservoir`, réservoir de cellules) ; soutien du nuage à chaque pose (`soutienRail`, points de dessus et de flanc sous le gabarit) ; cellule la plus proche (8 mm) et sa perte (médiane des carrés des distances au gabarit).

### 2.2 Résultat (ÉTABLI, 21 cuts, 42 rails ; script `recherche` du scratchpad, sortie hors dépôt)
- **Le vrai rail est dans le nuage sur 42 rails sur 42** : 160 à 340 points dans ±40 mm de la vérité ; soutien sous le gabarit à la vérité : dessus 117 à 299 points (seuil du moteur 15), flanc 18 à 81 (seuil 6). La ROI de capture (±400 mm en travers, `native-lidar` `bounds`) contient le vrai rail ; seul le moteur ne regarde pas au-delà de ±180 mm (points) et ±80 mm (recherche).
- **Le moteur relancé à la vérité trouve une cellule forte à 1 à 13 mm de la vérité sur 39 rails sur 42** (les 3 autres : cellule forte à moins de 8 mm absente, minimum de la relance à 9 à 11 mm). Donc un rail U50 complet, bien lu, pas un bord de nuage.
- **La pose fausse est aussi un rail** : cellule forte à la pose sur 40 rails sur 42, dessus 44 à 272 points. Ces cuts sont des zones d'appareils de voie (CH-015 : 90 % des fautes en ADV) : deux rails réels à 100 à 400 mm l'un de l'autre, et le moteur, borné à ±80 mm, ne voit que celui qui est près de la pose de départ d'ESV.
- **Signal qui les distingue, lu dans le seul nuage** : sur 39 rails comparables, **la perte du gabarit est plus petite à la vérité qu'à la pose fausse pour 31** (rapport médian 0,46 ; 8 rails ont la pose fausse mieux ajustée, rapport 1,2 à 3,4). Soutien du dessus nettement plus faible à la pose fausse sur 8 cuts (44 à 147 points contre 220 à 299 à la vérité : un rail d'aiguille, pas un rail courant). PROBABLE : le vrai rail est en général le mieux ajusté au gabarit U50 ; la pose fausse est souvent un rail partiel (lame, contre-rail).
- Ce que cela ne dit pas : rien sur les posés justes (un second rail fort existe-t-il aussi près d'eux ? c'est le coût) ; une seule partie, 4 épisodes.

### 2.3 Levier dérivé : « recherche large » (définition écrite avant la mesure)
Le moteur gelé est relancé sur des graines régulièrement espacées en travers (0, ±120, ±240, ±360 mm ; portée ±400 = la ROI), sur le nuage capturé ; union des cellules **fortes** (seuils du moteur : dessus ≥ 15, flanc ≥ 6, rapport de perte ≤ 1,5, pente dans le domaine, fenêtre) de toutes les relances, dédoublonnées à 3 mm ; paires admissibles = écartement 1 420 à 1 470 mm ; classées par produit des pertes. Deux variantes, qui ne lisent que le nuage :
- **D (différer)** : si la paire du lot n'est pas la meilleure paire large ET qu'une paire large au moins aussi bonne (produit des pertes ≤ 1,5 × celui de la paire du lot) est à plus de 50 mm d'elle : le cut est différé (ambiguïté large, l'équivalent du rapport de perte 1,5 du moteur, étendu à ±400 mm).
- **C (choisir)** : la meilleure paire large remplace la pose du lot si elle est à plus de 50 mm d'elle et si la seconde paire large à plus de 50 mm de la meilleure a un produit ≥ 1,5 × (sinon : différer).
**Séparation réglage / examen (CH-033, reprise) : réglage = partie 20, cuts < 8 000 (150 jugés, 13 fautes) ; examen = partie 20, cuts ≥ 8 000 (22 jugés, 8 fautes) et les 8 autres couples du 26/10 (452 jugés, 1 faute ; fausses alarmes) ; coût = posés signalés ou déplacés sur les lots .24 à .28 (sans Écho).** Les seuils ci-dessus (50 mm, 1,5, graines) sont fixés AVANT la lecture du réglage ; s'ils changent sur le réglage, le changement est écrit ici avant l'examen, et l'examen n'est ouvert qu'une fois. Graine des intervalles : 20261101.
**Critères de succès, écrits avant :**
- D : sur l'examen, fautes différées ≥ 5 sur 9 ; fines et acceptations différées ≤ 10 % des jugés non fautifs de l'examen ; posés signalés ≤ 8 % des posés des lots récents.
- C : fautes corrigées (pose large à 20 mm au plus de la vérité) ≥ 5 sur 9 ; **aucune** fine ni acceptation déplacée de plus de 20 mm (D-262 : aucun cut dégradé) ; sur les lots récents, poses déplacées de plus de 50 mm ≤ 3 % des posés.
- Puissance : avec 9 fautes à l'examen, « ≥ 5 sur 9 » a une borne basse de Wilson à 25 % : l'examen ne peut pas établir un rappel, seulement exclure un levier nul ; ce que l'examen peut établir, c'est l'absence de dégradation sur 474 jugés (borne haute à 0 sur 474 : 0,8 %).
Coût de calcul : 14 relances du moteur par cut (environ 1 à 2 min) ; le réglage (150 cuts) tourne en trois processus.

## 3. Piste L1 : gardes et politique de différé, par geste (1/11, exploration sur la partie 20 entière)

Script `gardes-geste` (scratchpad, sortie hors dépôt) : pour chaque posé, ce que le lot savait avant de valider (étage, appuis, différés précédents, rails non résolus, confiance, L1, déplacement depuis le départ), et le geste de l'opérateur s'il est jugé. R1 à R3 sont celles de CH-015 (retrouvées à l'identique : R3 38 signalés, 32 jugés, 13 fautes) ; les autres sont des variantes **lues sur les mêmes 172 jugés : réglage, pas examen** (toute la partie 20 ; aucun examen possible du rappel ailleurs : 1 faute sur 452 jugés dans les 8 autres couples).

| Règle « différer si… » | posés signalés (coût, 721) | fautes évitées (21) | moyennes évitées (11) | fines perdues (65) | acceptations perdues (75) |
|---|---|---|---|---|---|
| R1 : cut−1 ou cut−2 différé | 41 (5,7 %) | 13 | 3 | 14 | 5 |
| R3 : R1 et appuis < 2 (livrée test 25) | 38 (5,3 %) | 13 | 3 | 11 | 5 |
| R2 : R1 et appuis = 0 | 22 (3,1 %) | 10 | 2 | 5 | 2 |
| R3 avec cut−3 | 48 (6,7 %) | 14 | 6 | 14 | 6 |
| racine (appuis = 0) | 123 (17,1 %) | 13 | 4 | 6 | 5 |
| appuis < 2 | 247 (34,3 %) | 18 | 6 | 25 | 20 |
| L1 (posé par la GCV2) | 70 (9,7 %) | 6 | 2 | 18 | 8 |
| L1 sous τ (validée par correction, voie, consensus…) | 32 (4,4 %) | 3 | 1 | 11 | 3 |
| moteur : deux rails non résolus | 88 (12,2 %) | 5 | 1 | 16 | 7 |
| confiance min < 30 et appuis < 2 | 73 (10,1 %) | 8 | 3 | 6 | 3 |
| R3 ou L1 sous τ | 63 (8,7 %) | 15 | 4 | 18 | 8 |
| déplacement depuis le départ > 80 mm | 530 (73,5 %) | 10 | 11 | 61 | 68 |

Lecture (PROBABLE) : (1) **le déplacement depuis la pose de départ d'ESV n'est pas un signal** : 74 % des posés sont à plus de 80 mm du départ (l'extraction d'ESV est loin presque partout). (2) Aucune règle lue dans la chaîne ne dépasse R3 sans coûter plus de fines et d'acceptations qu'elle n'évite de fautes : R3 reste la meilleure de cette famille (13 fautes pour 16 jugés justes perdus et 38 différés). (3) Les 8 fautes que R3 manque sont des premiers passages avec 2 appuis ou plus : **invisibles à toute garde de chaîne** ; seule une référence hors chaîne (le nuage large, § 2) peut les voir.

## 4. Piste L5 : le pixel du clic et le zoom (1/11, ÉTABLI sur la partie 20)
- Pixel de la vue au clic : **0,499 mm sur 721 posés sur 721** (même vue tout le lot ; `vueFin.pixelMm`). Troncature de Chromium : biais −0,25 mm par axe (CH-012).
- Les 65 poses « fines » (130 rails) : 35 rails non touchés (0 mm) ; sur les 95 rails retouchés, correction latérale médiane 1,2 mm (P75 3,8, P90 6,1), verticale 1,3 mm (P75 2,9, P90 4,7) ; **11 rails retouchés de moins d'un pixel (0,5 mm) en latéral, 17 en vertical**. Les retouches fines valent 2 à 8 pixels : ce n'est pas le pixel qui les cause.
- Ce qu'un zoom ×2 au clic rendrait (calcul) : pixel 0,25 mm, biais de troncature −0,12 mm par axe au lieu de −0,25 : un gain au plus de 0,13 mm par axe, sous le bruit de la référence (1 mm) et sous la tolérance de fin de réglage de l'opérateur (0,75 mm). L'oracle (§ 0.4) le confirme : rien n'est mesurable sous 6 mm d'erreur vraie, et le clic arrondi simulé (D-266) n'a rien gagné.
- **Décision : impasse mesurée, pas de levier.** Un zoom au clic ajouterait des gestes de vue (lectures de nœuds, remise de vue : CH-018) pour un gain inférieur au bruit. Détour : aucun ; le gisement « fine » n'existe pas (§ 0.4), seuls « moyenne » et « faute » comptent.

### 2.4 Résultat du RÉGLAGE (partie 20, cuts < 8 000 ; 150 jugés : 13 fautes, 9 moyennes, 60 fines, 68 acceptations ; seuils inchangés : 50 mm, rapport 1,5, graines 0 à ±360 par 120)
| Variante | fautes (13) | moyennes (9) | fines (60) | acceptations (68) |
|---|---|---|---|---|
| D : différé pour ambiguïté large | **13** (9 par concurrence, 4 parce que la pose du lot n'est aucune paire forte) | 1 | **0** | 1 |
| C : remplacée par la meilleure paire large | **12, toutes à 20 mm au plus de la vérité** ; 1 différée | 0 (1 différée) | **0** | 0 (1 différée) |
- ÉTABLI sur le réglage : la recherche large ne touche aucune pose fine ni acceptée ; elle retire ou corrige toutes les fautes du réglage. 4 fautes sur 13 ont une pose du lot qui n'est **aucune paire forte** de la recherche large (le lot a posé sur une cellule faible : L1 corrigée ou chaîne).
- Les seuils ne sont pas modifiés. L'examen (§ 2.3) est ouvert une fois, ci-dessous, après ce commit.

### 2.5 EXAMEN (ouvert une fois, 1/11 ; seuils du § 2.3 inchangés ; scripts du scratchpad, sorties hors dépôt)
**A. Partie 20, cuts ≥ 8 000** (22 jugés : 8 fautes, 2 moyennes, 5 fines, 7 acceptations) :
| Variante | fautes (8) | moyennes (2) | fines (5) | acceptations (7) |
|---|---|---|---|---|
| D différé | **6** (5 concurrence, 1 pose sans paire forte) ; 2 gardées | 0 | **0** | **0** |
| C remplacé | **6, toutes à 20 mm au plus de la vérité** ; 2 gardées | 0 | 0 | 0 |
Les 2 fautes gardées : la pose du lot est une paire forte et la paire de la vérité, présente, a un produit de pertes de plus de 1,5 × le sien (le faux rail est ici le mieux ajusté).

**B. Les 8 autres couples du 26/10** (421 jugés : 1 faute, 15 moyennes, 146 fines, 259 acceptations) :
| Variante | faute (1) | moyennes (15) | fines (146) | acceptations (259) |
|---|---|---|---|---|
| D différé | **1** (pose sans paire forte) | 5 (2 pose sans paire forte, 3 aucune paire forte) | 5 (1 concurrence, 2 pose sans paire forte, 2 aucune paire forte) | 18 (6 concurrence, 8 pose sans paire forte, 4 aucune paire forte) |
| C remplacé | 1, à 20 mm | 0 | **1 remplacée à plus de 50 mm de la vérité** | **4 remplacées à plus de 50 mm** |

**Critères écrits avant (§ 2.3), verdict :**
- **D (différer) : TIENT.** Fautes différées à l'examen : **7 sur 9** (critère ≥ 5 ; Wilson [45 ; 94] %) ; fines et acceptations différées : 23 sur 417 (5,5 %, critère ≤ 10 %) ; aucune pose jugée déplacée. ÉTABLI sur l'examen.
- **C (choisir) : NE TIENT PAS.** 7 fautes sur 9 corrigées à 20 mm, mais 5 poses justes (1 fine, 4 acceptations) remplacées par une paire à plus de 50 mm de la vérité : le critère « aucune dégradation » tombe. Mode rejeté pour l'autonomie (il reste dans le module, jamais livré allumé) ; il demanderait une seconde preuve (voisins, liste) avant de déplacer une pose : non cherché ici.
- Puissance : 9 fautes à l'examen ; l'absence de dégradation est établie sur 439 jugés non fautifs (0 déplacé ; borne haute de Wilson 0,9 %).

**Coût (D), partie 20 entière (721 posés, dont 549 non jugés) :** différés par D : 21 jugés (19 fautes, 1 moyenne, 1 acceptation) + 40 non jugés (7 concurrence, 14 pose sans paire forte, 19 aucune paire forte) = 61 (8,5 %) ; sans la branche « aucune paire forte » : 42 (5,8 %). Parmi les 549 posés non jugés, 21 sont signalés par concurrence ou absence de paire forte : PROBABLE, des fautes que l'Écho n'a pas vues (CH-015 : 544 posés sans Écho). Coût sur les lots récents : § 2.6.

**Ajustement écrit APRÈS l'examen (conservateur, module `src/recherche-large.js`) :** la branche « aucune paire forte nulle part » (nuage pauvre : 9 jugés des couples, 0 faute ; 19 non jugés de la partie 20 ; 0 au réglage) rend désormais `garde` au lieu de `differer` : l'absence de paire forte n'est pas une preuve contre la pose. Effet : fautes différées inchangées (7 sur 9), fines et acceptations différées 17 sur 417 (4,1 %), coût partie 20 : 42 posés (5,8 %). Toute autre valeur de seuil reste celle du § 2.3.

**Temps de calcul** (14 relances du moteur par cut, 3 processus en parallèle sur cette machine) : médiane 3,4 s, P90 7,5 s, max 33 s par cut ; seul, de l'ordre de 1,5 à 3 s (SUPPOSÉ : à mesurer au terrain, champ `ms` de l'événement `recherche-large`). Le réglage `zones` permet de limiter aux zones d'appareils de voie si le coût gêne.

## 5. Piste L8 : la deuxième passe (1/11, ÉTABLI sur les journaux, module `src/recherche-large.js`)
- Partie 6 du 31/10 (4.9.5.28), 2 cuts écrits par la passe à ≈ 111 et 115 mm du départ : **la pose écrite n'est aucune paire forte de leur nuage** (recherche large : 13 et 30 cellules fortes sur le rail gauche, 3 et 18 sur le droit, 1 et 5 paires au contrat, la meilleure à plus de 100 mm de la pose écrite). PROBABLE : les deux écritures sont fausses ; à juger à l'Écho. La garde A les avait laissées (loin du départ : > 100 mm, appuis non regardés).
- Partie 0 de la test 24 (29/10), 2 cuts écrits (déplacements 54 et 38 mm) : paires fortes uniques (« garde », rapport 0,48 et 1,0).
- Décision : la recherche large garde aussi la passe (clé `passe:true` du réglage, mode « différer » seul : une pose de la passe sans paire forte ou concurrencée n'est pas écrite, motif `recherche-large`). Branchée après la garde A, essai `tests/recherche-large-passe-sw.test.cjs`.
- L'apprentissage des paramètres L1 sur les corrections (piste L7) n'est pas lancé : le gisement des fautes est traité par le nuage, et 51 posés L1 jugés sur la partie 20 ne suffisent pas à réapprendre un modèle (puissance).

### 2.6 Coût sur les lots récents et règle affinée (1/11, après l'examen)
**Coût de D (règle du protocole) sur les lots .24 à .28, sans Écho** (`--tous`, 410 posés avec nuage) : partie 0 de la test 24 : 19 sur 232 (8,2 %) ; file du 31/10 : partie 5 : 0 sur 37 ; partie 6 : 13 sur 97 ; partie 7 : 4 sur 21 ; partie 8 : 7 sur 23. **Total 43 sur 410 (10,5 %) : le critère de coût (≤ 8 %) n'est pas tenu par la règle du protocole.** 31 de ces 43 viennent de la branche « pose du lot sans paire forte », surtout aux étages `choice` (12 sur 56 posés : le choix du lot accepte un minimum à 5 points de dessus, le moteur en exige 15 pour une cellule forte) et `gcv2-l1` (7 sur 42) ; premier passage : 8 sur 252.

**Règle affinée, lue APRÈS l'examen (déclarée ici, à confirmer sur un lot neuf) :** une pose sans paire forte n'est différée que si la meilleure paire large est à plus de 50 mm d'elle ; une paire forte proche ne contredit pas la pose. Mesure appariée, même seuils ailleurs :

| Jeu | règle du protocole : différés (fautes / moyennes / fines / acceptations / non jugés) | règle affinée |
|---|---|---|
| Réglage, partie 20 < 8 000 (150 jugés) | 13/13, 1, 0, 1 | **13/13**, 0, 0, 1 |
| Examen A, partie 20 ≥ 8 000 (22) | 6/8, 0, 0, 0 | **6/8**, 0, 0, 0 |
| Examen B, 8 couples (421) | 1/1, 2, 3, 14 | **1/1**, 0, 2, 8 |
| Partie 20, 549 posés non jugés | 21 | 14 |
| Lots .24 à .28, 410 posés | 43 (10,5 %) | **26 (6,3 %)** |

- ÉTABLI (apparié) : la règle affinée différe les mêmes fautes (13 sur 13 au réglage, 7 sur 9 à l'examen) et deux fois moins de poses justes (10 sur 417 à l'examen, 2,4 % ; coût 6,3 % sur les lots récents, sous le critère de 8 %).
- Elle est livrée comme défaut du réglage (`sansPaireLoin:true`), la règle du protocole restant accessible (`sansPaireLoin:false`). Parce qu'elle a été choisie en regardant l'examen, son coût est PROBABLE, pas ÉTABLI hors échantillon : un lot neuf avec Écho le confirmera (critère de retour arrière du rapport).

## 6. Piste L4 : ce que la page d'ESV expose (1/11, ÉTABLI sur le journal de la partie 20, lecture seule)
- Ce qu'Ariane lit déjà sans l'exploiter pour poser : la liste des coupes (statut, bords monde, `RailSpacing`, `TrajAzimuth`, `RailType`), les événements `railPairSelected` / `railPairUpdated` / `railPairSeen` (ombre `esvEvents`), les voisins validés de la liste (B1, ombre `b1-ombre` sur 889 cuts). Les réponses du serveur à une validation ne portent que le statut (observateur passif : corps réduit aux nombres et courtes chaînes).
- **B1 en ombre sur les 172 jugés** (voisins `valid` de la liste à ±5 lignes, repère calibré) : les fautes ont des lignes valides autour d'elles (médiane 4 dans la fenêtre), mais B1 **ne change rien pour 16 fautes sur 21** (« inchangé » ou garde du premier passage sans effet), retirerait 2 poses, en ajouterait 2, en déplacerait 1 (à 140 mm de la pose réelle, sens non jugé) ; sur les 75 acceptations et 65 fines, 12 poses ajoutées (sans vérité pour les juger). PROBABLE : les lignes valides voisines des fautes sont de la même chaîne décalée (extraction d'ESV ou poses du lot déjà validées), comme CH-033 l'a vu pour la continuité : la liste n'est pas une référence indépendante dans ces zones. L'écartement de projet (`RailSpacing`) est déjà la référence de L1-e (lignes valides non touchées).
- **Décision : pas de levier dans la page** au-delà de ce que L1-e lit ; la référence indépendante est le nuage (§ 2). Rien qui contourne un contrôle d'ESV n'a été regardé.
- Temps par cut en processus seul (93 jugés des cuts 6 380 à 6 620, le rejeu du banc tournant à côté sur un autre cœur) : médiane 3,7 s, P90 6,4 s, max 9,9 s (14 relances du moteur). ÉTABLI sur cette machine ; la machine de l'opérateur n'est pas mesurée. Leviers de coût : `zones`, `porteeMm`, `pasMm`.
