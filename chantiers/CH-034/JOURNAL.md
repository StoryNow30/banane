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

### 1.2 Rejeu hors ligne (ÉTABLI, 1/11, 42 min seul ; deux lancements en parallèle d'autres calculs ont été tués par la mémoire de la machine)
`tools/banc-differes.cjs rejouer`, profils `base` et `L1-se`, 889 captures retrouvées sur 889, liste d'ESV du lot fournie. **Fidélité : 646 poses du lot sur 646 rejouées à 0,8 mm** (médiane 0,48 mm, max 0,68 : la troncature du clic, CH-012), comme CH-012. Sorts : réel posé / base posé / L1-se posé 646 ; réel différé / base différé / L1-se différé 86 ; réel différé / base différé / **L1-se posé 82** ; réel posé par L1 / base différé / L1-se posé 75. Le banc L1-se pose 82 différés réels que le terrain n'a pas posés : le banc suppose les déplacements de vue réussis, le terrain les a tous refusés (CH-015 : 19 sur 19 « caméra immobile ») ; c'est l'écart banc / terrain connu, pas un désaccord du moteur. Le banc n'a pas été rejoué avec la recherche large branchée (elle n'y est pas : le banc n'appelle pas `commandLot`) : la mesure du levier est celle du § 2, faite directement sur les nuages et les poses réelles du journal, ce qui est plus fidèle au terrain que le banc pour cette question.

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

### 2.7 Sensibilité des seuils (lue après l'examen, sur tous les jeux ; aucune valeur livrée n'est changée)
| rapport × loin | réglage : fautes / justes différées | examen A | examen B | coût récents |
|---|---|---|---|---|
| **1,5 × 50 (livré)** | 13/13 ; 1/128 | 6/8 ; 0/12 | 1/1 ; 10/405 | 26/410 |
| 1,5 × 80 | 13/13 ; 1/128 | 6/8 ; 0/12 | 1/1 ; 8/405 | 19/410 |
| 2 × 50 | 13/13 ; 5/128 | 7/8 ; 0/12 | 1/1 ; 11/405 | 27/410 |
| 3 × 50 | 13/13 ; 6/128 | 7/8 ; 0/12 | 1/1 ; 16/405 | 33/410 |
Lecture : un rapport de 2 rattrape une faute de plus à l'examen pour 4 poses justes de plus différées au réglage ; une distance de 80 mm baisse le coût sans perdre de faute (toutes à plus de 100 mm). Ce sont des réglages à faire sur un lot neuf avec Écho, pas ici : les valeurs livrées restent celles du protocole (1,5 ; 50).

### 2.8 Soutien minimal de la paire concurrente, et un mode « choisir sûr » (lus après l'examen, sur les sorties déjà calculées ; 1/11 après-midi, pistes 1 et 2 de l'intégrateur)
**Question (écrite avant le balayage).** Les poses justes différées par D (règle affinée : 10 sur 417 à l'examen, 26 posés sur 410 sur les lots récents) le sont-elles par des paires concurrentes PAUVRES (peu de points de dessus ou de flanc sous le gabarit), que les fautes n'ont pas ? Si oui, exiger un soutien minimal de la paire concurrente (dessus ≥ T sur les deux rails, flanc ≥ F) baisse le coût sans perdre de faute. Même question pour un mode « choisir sûr » (C2) : remplacer la pose du lot seulement quand la meilleure paire large est loin (> 50 mm), UNIQUE (seconde paire loin d'elle à produit ≥ 1,5 × le sien), SOUTENUE (dessus ≥ T, flanc ≥ F), et que la pose du lot n'est aucune paire forte ou a un produit ≥ 1,5 × celui de la meilleure.
**Mesure (ÉTABLI sur les sorties, script `soutien-balayage` du scratchpad ; jeux : réglage 150 jugés, examen A 22, examen B 421, non jugés de la partie 20 549, récents 410).** Le soutien d'une paire est celui de ses deux cellules fortes (points de dessus et de flanc lus par le moteur).

| D affinée + soutien (T dessus, F flanc) | réglage : fautes / justes différées | examen A | examen B | non jugés p20 | coût récents |
|---|---|---|---|---|---|
| **0, 0 (livré)** | 13/13 ; 1/137 | 6/8 ; 0/14 | 1/1 ; 10/420 | 14/549 | 26/410 (6,3 %) |
| 60, 0 | 13/13 ; 1/137 | 6/8 ; 0/14 | 1/1 ; 3/420 | 13/549 | 10/410 (2,4 %) |
| 90, 0 | 13/13 ; 1/137 | 6/8 ; 0/14 | **0/1** ; **0/420** | 12/549 | 7/410 (1,7 %) |
| 100, 8 | 13/13 ; 1/137 | 6/8 ; 0/14 | 0/1 ; 0/420 | 12/549 | 6/410 |
| 120, 10 | 13/13 ; 1/137 | 6/8 ; 0/14 | 0/1 ; 0/420 | 11/549 | 3/410 |
| 150, 10 | 13/13 ; 1/137 | 6/8 ; 0/14 | 0/1 ; 0/420 | 5/549 | 1/410 |

| C2 « choisir sûr » (T, F) | réglage : fautes corrigées à 20 mm / justes remplacées > 50 mm | examen A | examen B | non jugés p20 remplacés | récents remplacés |
|---|---|---|---|---|---|
| 0, 0 | 12/13 ; 0 | 6/8 ; 0 | 1/1 ; **5** | 3/549 | 20/410 |
| **90, 0** | 12/13 ; 0 | 6/8 ; 0 | 0/1 ; **0** | 2/549 | 7/410 |
| 120, 10 | 12/13 ; 0 | 6/8 ; 0 | 0/1 ; 0 | 2/549 | 3/410 |
| 150, 10 | 12/13 ; 0 | 5/8 ; 0 | 0/1 ; 0 | 1/549 | 1/410 |

**Lecture.** Les poses justes différées (et les 5 poses justes que C remplaçait) sont toutes concurrencées par des paires dont un rail a moins de 90 points de dessus ; les 19 fautes de la partie 20 ont leur concurrente (le vrai rail) à 117 points et plus (§ 2.2). À T = 60 déjà, le coût tombe de 26 à 10 posés sur 410. La seule faute des couples du 26/10 (examen B) se perd dès T = 60 : sa concurrente est un rail pauvre. **Ce seuil est lu après l'examen** : il n'est pas prouvé hors échantillon ; les 19 fautes de la partie 20 sont dans le réglage ou dans l'examen A déjà ouvert. PROBABLE : T = 90 garde les fautes d'appareils de voie (rails complets) et ne diffère plus les poses justes. Décision : les clés `soutienTop` et `soutienFace` sont ajoutées au réglage, **livrées à 0** (= la règle examinée), avec le mode `choisir-sur` (C2) ; leur valeur recommandée pour un essai terrain (T = 90, F = 0) est écrite dans le rapport, à confirmer sur un lot neuf AVANT toute mise en défaut.
**Piste 3 (les 2 fautes non différées de l'examen A, ÉTABLI sur les sorties, pas de numéro ici).** L'une : la vraie paire est forte mais son produit vaut 1,54 × celui de la pose du lot (rapport 1,5 : à 1,6 elle serait différée ; § 2.7, rapport 2 : 7/8). L'autre : les deux paires ont le même soutien et des produits proches, la pose du lot est la meilleure par le gabarit : indécidable par le nuage seul. Aucun seuil ne la rattrape sans coût ; elle est du ressort de l'Écho.

### 2.9 Temps par cut : graines utiles seulement (ÉTABLI, 1/11)
Une graine est inutile si aucun des deux rails n'a 15 points au moins dans la fenêtre de ±180 mm du moteur autour d'elle (aucune cellule forte possible : dessus ≥ 15) ; le module ne relance plus le moteur sur ces graines (`grainesUtiles`, compte `grainesSautees` au journal). Aucun effet sur les cellules trouvées (paires identiques sur les 93 cuts chronométrés, même script que § 2.7) ; temps par cut, processus seul : médiane 3,5 s (avant 3,7), P90 5,6 s, maximum 8,2 s. Le gain est faible sur la partie 20 (nuages denses sur ±400 mm) ; il compte sur les nuages tronqués. Essais `tests/recherche-large.test.cjs` verts (7).

### 1.3 Le levier au banc (définition écrite avant le résultat, 1/11, 11:18)
Le banc (`tools/banc-differes.cjs`) reçoit l'option `--recherche-large JSON` (ou `BANC_RECHERCHE_LARGE`) : le module `src/recherche-large.js` est appelé sur chaque pose que chaque profil s'apprête à faire, comme le service worker : pose de la chaîne (`lot`), pose refaite de L1-s (`l1s-chaine`, `l1s-vue`), pose de la GCV2 dans le lot (`gcv2`), pose de la deuxième passe (mode « différer » forcé, après la garde A, si `passe:true`). `differer` → le cut est différé (source `recherche-large`, l'origine consignée), n'est ni appui ni voisin, et sous L1-se redevient un reste de la passe ; `remplacer` → la meilleure paire est posée si elle est dans la vue de chaque rail (sinon différé, `remplacer-hors-vue`), voisine mais jamais appui ; `garde` → la pose reste, le résumé est joint. Sans l'option : rejeu identique octet pour octet (essai `tests/banc-differes-recherche-large.test.cjs`, 3 essais : inchangé, différer, remplacer ; la passe gardée ou libre).
**Rejeu lancé à 11:18, seul sur la machine** : partie 20, profils `base` et `L1-se`, recette livrée de la passe (`BANC_LEVIERS` `deuxiemePasse:2`, `passe2Leviers:{sansVoieRien:true}` ; la passe réelle de ce lot était en ombre), levier aux valeurs livrées (`{actif:true}` : mode `differer`, 50 mm, 1,5, `sansPaireLoin`, soutien 0). Témoin : le même rejeu sans l'option (même recette de passe ; le rejeu du § 1.2 n'avait pas de passe). Jugement (script `juger-rejeu` du scratchpad) : sur les 172 posés réels jugés, par geste, ce que chaque profil fait du cut (posé à l'identique, déplacé, différé par le levier, remplacé) et la classe de SA pose contre la vérité ; sur les 549 posés non jugés, le coût (différés en plus) ; sur les 168 différés réels, ce que la passe en fait et ce que le levier retient en passe.
**Ce qu'on attend (écrit avant)** : base avec levier = les 19 fautes différées sur 21 vues directement au § 2 (13 + 6), sauf celles que la dynamique du lot change (un cut différé n'est plus appui des suivants : les suivants peuvent être posés autrement ou différés à leur tour) ; coût : 42 posés différés sur 721 au § 2.6 (règle du protocole), 26 attendus avec la règle affinée livrée ; la passe (piste 4) : combien des différés en plus elle pose, et si le levier retient en passe ce qu'il a différé dans le lot (même nuage, même concurrence : attendu oui pour la plupart, sauf si la GCV2 pose ailleurs).

### 2.10 Contrôle a posteriori de TOUTES les poses par le nuage (1/11, 11:30 ; piste 4 de l'intégrateur, ÉTABLI sur les sorties, script `controle-posteriori` du scratchpad)
**Question.** Sans Écho, l'écart entre la pose du lot et la meilleure paire forte du nuage dit-il quelque chose du taux de faute des posés non jugés ?
| Jeu | geste | n | sans paire forte | ≤ 10 mm | 10 à 20 | 20 à 50 | 50 à 100 | > 100 |
|---|---|---|---|---|---|---|---|---|
| partie 20 | faute | 21 | 0 | 2 | 0 | 0 | 0 | **19** |
| | moyenne | 11 | 0 | 6 | 2 | 3 | 0 | 0 |
| | fine | 65 | 0 | 63 | 2 | 0 | 0 | 0 |
| | acceptation | 75 | 0 | 73 | 1 | 0 | 0 | 1 |
| | **non jugé** | 549 | 19 | 500 | 17 | 5 | 0 | **8** |
| couples 26/10 | faute | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| | moyenne | 15 | 3 | 9 | 1 | 2 | 0 | 0 |
| | fine | 146 | 2 | 141 | 0 | 1 | 0 | 2 |
| | acceptation | 259 | 4 | 237 | 4 | 6 | 2 | 6 |
| lots .24 à .28 | non jugé | 410 | 18 | 327 | 25 | 15 | 8 | 17 |
**Lecture.** Sur la partie 20, la pose du lot est à plus de 100 mm de la meilleure paire forte pour 19 fautes sur 21 et 1 pose juste sur 151 : c'est le signal du levier. Étalonné sur les 172 jugés (fautes par classe d'écart : 19/20 au-delà de 100 mm, 2/144 à 10 mm au plus, 0 ailleurs) et appliqué aux 549 non jugés (8 au-delà de 100 mm, 500 à 10 mm au plus) : **14 fautes estimées sur 549 non jugés (2,6 %)**, dont 8 décelables par le levier et 7 (2/144 × 500) qui sont la part des fautes où la pose du lot EST la meilleure paire (indécidables par le nuage). Sur la partie 20 entière : 21 + 14 = 35 fautes estimées sur 721 posés (4,9 %), le levier en différant 19 + 8 = 27 ; reste 8 (1,1 %), SUPPOSÉ : l'étalonnage suppose que les non jugés se comportent comme les jugés à écart égal (les jugés sont concentrés sur les appareils de voie, l'estimation de la part indécidable est fragile : 2 cas). Sur les lots récents (410 posés), 25 poses sont à plus de 50 mm de leur meilleure paire forte (6,1 %) : trop pour être toutes des fautes au taux connu (2,9 %) ; ce sont les fausses alarmes des nuages pauvres (§ 2.8 : les couples du 26/10 ont 10 poses justes dans ce cas sur 421). **Ce contrôle est une estimation, pas une preuve** ; il justifie l'Écho ciblé sur les posés que le levier signale (27 cuts de la partie 20 au lieu de 721).

**Amendement au § 2.8 (lu en écrivant le § 2.10).** Le seuil de soutien absolu (dessus ≥ 90) n'isole pas des « concurrentes pauvres » dans un nuage dense : il écarte les NUAGES pauvres. Dans les couples du 26/10, à ce seuil, 122 fines sur 146 et 235 acceptations sur 259 n'ont plus AUCUNE paire forte soutenue (rails à 17 à 80 points de dessus, paire du lot comprise), contre 0 sur 172 dans la partie 20 (rails à 85 à 297 points). Un soutien RELATIF (concurrente ≥ r × les points de la paire du lot) ne sépare rien : les fautes ont des concurrentes aussi fournies que leur pose (202 à 284 contre 85 à 297), les poses justes des couples aussi (17 à 73 contre 19 à 80). Lecture honnête : avec `soutienTop:90`, le levier n'agit que sur les nuages denses (captures proches), où les fautes connues sont ; sur un nuage pauvre il s'abstient (absence de preuve), ce qui est sûr mais sans gain. La faute des couples (concurrente à 83 points) se perd à 90, pas à 60. Valeur à essayer sur le terrain : 60 (0 juste différée dans la partie 20, 3 sur 420 dans les couples, coût 10 sur 410), à confirmer sur un lot neuf ; livré 0.

### 2.11 Temps : graines sur les pics de densité (définition écrite avant la mesure, 1/11, 11:35 ; piste 1 de l'intégrateur)
**Constat (§ 2.7, § 2.9)** : 14 relances du moteur par cut posé, 3,5 s en médiane (processus seul), soit ~40 min de plus sur un lot de 700 posés. Les cellules de la meilleure paire viennent des graines 0 (474 cuts), ±120 (689), ±240 (233) et ±360 (8, dont 4 sur des fautes) : la portée ne peut pas être réduite sans perdre des fautes ; ce sont les relances SANS rail qu'il faut épargner.
**Levier** (`grainesMode:'pics'`, livré `'grille'`) : les points du nuage à la hauteur du dessus de rail (|vert| ≤ 50 mm du départ, |long| ≤ 500 mm) sont comptés en travers par cases de 10 mm ; un amas = cases contiguës (à une vide près) d'au moins 5 points, 15 au total ; une graine par amas à plus de 60 mm des graines prises, la graine 0 toujours (la relance du lot), bornée à ±400. Un rail (dessus ≥ 15 points pour une cellule forte) fait toujours un amas ; le ballast et les traverses sont sous la bande. Et la science du lot, quand elle est fournie (banc : toujours ; service worker : la passe), tient lieu de relance 0.
**Mesure (avant/après, mêmes cuts, même module)** : (a) les 21 fautes de la partie 20 : même meilleure paire (3 mm), même décision D, vraie paire en tête ; (b) les 172 jugés de la partie 20 et les 410 posés des lots récents : mêmes décisions D (fautes différées, justes différées, coût), relances et temps par cut avant/après. Critère : aucune décision changée sur les fautes, au plus 1 % de décisions changées ailleurs (et expliquées), temps divisé par 2 au moins.

**Première mesure (1/11, 14:24, les 21 fautes) et correctif** : pics tels que définis : relances 130 → 49, ms médiane 5 963 → 3 723, mais **3 fautes perdues** (vraie paire en tête 19 → 16) et 1 décision changée : sur ces 3 cuts, le vrai rail est à −130, −198 et −276 mm, dans un amas CONTINU large de plusieurs centaines de mm (dalle, appareil de voie) dont le centre pondéré seul était pris : pas de graine à moins de 60 mm du vrai rail. Correctif (essai rouge d'abord, `tests/recherche-large.test.cjs` essai 11) : un amas plus large que 120 mm reçoit une graine tous les 120 mm au plus, réparties sur sa largeur (aucun point à plus de 60 mm d'une graine) ; un amas étroit garde sa seule graine.
**Résultat (a), les 21 fautes, pics corrigés (ÉTABLI, 21:12)** : même meilleure paire (3 mm) 17 / 21, **même décision D 20 / 21, vraie paire en tête 20 (pics) contre 19 (grille)** : la seule décision changée l'est en faveur des pics (une faute que la grille GARDE, la vraie paire étant hors de ses graines, est DIFFÉRÉE par les pics qui la trouvent à −122 mm) ; relances 130 → 65 (médiane 6 → 3 par cut) ; ms médiane 5 963 → 3 915, total 138,5 s → 90,4 s (× 0,65 : le reste est le chargement de la capture et les relances avec rail, incompressibles ; dans l'extension, la science du lot tient lieu de relance 0, une relance de moins encore). Les 4 écarts de meilleure paire sont des paires à 3–6 mm l'une de l'autre (même rail, cellule voisine). Résultat (b), partie 20 entière et lots récents : en cours (calcul lancé 21:14).

**Résultat (b), partie 20 entière et lots récents, pics corrigés (ÉTABLI, 22:20 ; pics calculés sous la charge de deux autres calculs, les grilles l'avaient été seules : le temps est biaisé CONTRE les pics)** :

| jeu | cuts | même meilleure paire (3 mm) | même décision D | changements (grille → pics) | ms médiane grille → pics |
|---|---|---|---|---|---|
| partie 20, tous les posés | 721 | 525 (73 %) | **708 (98,2 %)** | 5 différer → garde, 8 garde → différer | 3 366 → 2 140 (× 0,64) |
| lots récents (.24 p0, .28 p5 à p8) | 410 | 340 (83 %) | **403 (98,3 %)** | 4 différer → garde, 3 garde → différer | × 0,69 à × 0,94 selon le lot |

Sur les jugés de la partie 20, 3 décisions changent : **la faute gagnée** (garde → différer, vraie paire trouvée à −122 mm) et **2 fines différées de plus** (garde → différer, pose à 4 mm de la meilleure paire, une concurrente à moins de 1,5 × apparue par une cellule de perte légèrement différente). Les 17 autres changements sont sur des posés non jugés, dans les deux sens (9 → garde, 11 → différer) ; **un seul** vient d'une graine manquante (la paire décisive de la grille n'est dans aucune cellule des pics), les autres sont des effets de seuil : les graines diffèrent, les cellules trouvées diffèrent de quelques millimètres, leurs pertes aussi, et le rapport 1,5 ou la distance 50 bascule.
**Verdict contre les critères écrits** : fautes : tenu (0 perdue, 1 gagnée) ; décisions changées ailleurs : **1,8 % et 1,7 %, au-dessus du 1 % écrit**, expliquées (seuils) ; temps : × 0,64 au mieux, **pas ÷ 2** (les relances AVEC rail sont incompressibles : 2 à 4 par cut en médiane, sur 14 pour la grille brute, 6 à 7 pour la grille à graines utiles du § 2.9). **Les pics ne sont pas livrés par défaut** (`grainesMode:'grille'` reste) ; ils restent réglables (`'pics'`) pour un terrain où le temps gêne, au prix de ~2 % de décisions qui basculent par effet de seuil. La piste temps s'arrête ici : ce qui reste est le moteur lui-même (gelé) et la science du lot reprise comme relance 0 (livrée, § 2.10 : une relance de moins dans la passe et au banc).

### 2.13 Mémoire du service worker (ÉTABLI, 1/11, 21:40 ; piste 5 de l'intégrateur ; script `memoire-large` du scratchpad, `--expose-gc`)
**Question écrite avant la mesure** : la recherche large (jusqu'à 14 relances du moteur gelé sur 16 000 à 17 000 points) retient-elle de la mémoire d'un cut à l'autre, et quel pic ajoute-t-elle au service worker ? Mesure : 2 × 20 captures de deux fichiers de corpus de la partie 20, réglage livré (grille), tas V8 avant l'appel (après ramasse-miettes forcé), croissance du tas réservé pendant l'appel (majorant du pic : l'appel est synchrone, aucun échantillonneur ne peut tourner pendant lui), tas utilisé juste après l'appel avant ramasse-miettes (minorant), tas retenu après ramasse-miettes, RSS.

| | points (médiane) | ms (médiane) | croissance du tas réservé pendant l'appel | tas utilisé après l'appel, avant GC | retenu après GC | RSS après |
|---|---|---|---|---|---|---|
| fichier 1 (20 captures) | 17 169 | 2 692 | médiane 14,3 Mo, max 30,8 | médiane 20,9 Mo, max 36 | médiane 0, max 0,7 Mo | médiane +0,3 Mo, max +53,5 |
| fichier 2 (20 captures) | 15 973 | 2 593 | médiane 14,3 Mo, max 31,8 | médiane 21,5 Mo, max 36,9 | médiane 0, max 0,7 Mo | médiane +0,1 Mo, max +79,6 |

**Lecture.** Le module ne retient rien (< 1 Mo après ramasse-miettes : les cellules et paires rendues, résumées en millimètres par le journal) ; le pic transitoire est de 20 à 37 Mo par cut, de l'ordre d'une relance du moteur (les relances sont séquentielles, leurs tableaux de points sont libérables entre deux). Aucun cache de cellules par capture n'est nécessaire ni souhaitable (il retiendrait ~1 Mo par cut sans gain : chaque cut est consulté une fois dans le lot, une fois en passe, et la passe reprend la science du lot). Rien à livrer sur cette piste. (Les états « différer » de cette mesure n'ont pas de sens : la pose soumise est la pose de départ d'ESV, non celle du lot.)

### 1.4 Résultat du rejeu avec le levier (ÉTABLI, 1/11, 14:10 ; 2 h 20 seul ; témoin au § 1.5)
Levier livré (`{actif:true}`), profils base et L1-se, passe livrée (2 passes). Jugé par geste contre l'Écho (script `juger-rejeu`), sur les 172 posés réels jugés :

| Profil | geste | n | posé à l'identique | posé déplacé (> 1 mm) | différé (dont par le levier) | classes des poses du profil contre la vérité | mm des poses déplacées |
|---|---|---|---|---|---|---|---|
| base + levier | faute | 21 | 1 | 0 | **20** (14) | faute 1 | |
| | moyenne | 11 | 8 | 0 | 3 (0) | moyenne 7, fine 1 | |
| | fine | 65 | 50 | 4 | 11 (0) | fine 51, moyenne 3 | 26 25 7 6 |
| | acceptation | 75 | 57 | 0 | 18 (1) | acceptation 57 | |
| L1-se + levier + passe | faute | 21 | 2 | **12** | **7** (7) | **fine 12**, faute 2 | 3 2 1 3 5 3 4 3 5 4 4 2 |
| | moyenne | 11 | 9 | 2 | 0 | moyenne 8, fine 3 | 4 3 |
| | fine | 65 | 57 | 8 | 0 | fine 59, moyenne 6 | 10 26 25 5 0 7 6 11 |
| | acceptation | 75 | 70 | 4 | 1 (1) | acceptation 70, fine 3, moyenne 1 | 1 5 12 4 |

Comptes : base + levier : 621 posés, 268 différés (le levier en diffère 32 dans le lot, 14 sur des posés non jugés) ; L1-se + levier : 817 posés, 72 différés (le levier en diffère 23 dans le lot : 20 poses de la chaîne, 3 de la GCV2 ; la passe reprend 146 restes, en pose 78, le levier en retient 15 en passe ; 13 posés non jugés différés en plus ; 119 différés réels posés dont 63 par la passe).
**Lecture.** (1) Sous L1-se, le profil livré : **12 fautes sur 21 sont différées par le levier dans le lot puis POSÉES PAR LA GCV2 (passe) à 1 à 5 mm de la vérité** : la deuxième passe, avec les voisins validés et le transport, retrouve la vraie paire ; 7 restent différées ; 2 restent des fautes (les indécidables du § 2.8). C'est la réponse à la piste 4 : oui, la passe pose les cuts différés par le levier, et juste. (2) Prix : 2 fines deviennent moyennes (25 et 26 mm, cuts reposés par la passe), 1 acceptation devient moyenne (12 mm), 1 acceptation différée ; le témoin dira ce qui vient de la passe seule (le § 1.2, sans passe, avait déjà 4 fines déplacées : 10, 5, 0, 11). (3) Sous base (chaîne seule) : 20 fautes sur 21 différées, dont 6 par la dynamique des appuis (un cut différé n'est plus appui : les suivants sont différés à leur tour) ; mais 10 acceptations de plus différées par cette dynamique, 0 pose juste déplacée. (4) Temps : 1 415 consultations du module, 2 h 20 contre 42 min : ~4 s par consultation, d'où le § 2.11. Limite : réglage et examen sont confondus ici (même lot) ; la mesure hors échantillon est la garde des 12 lots (§ 7).

### 1.5 Témoin : la passe seule, sans le levier (ÉTABLI, 1/11, 21:05 ; 1 h 16 ; même banc, mêmes leviers de passe, levier absent ; réponse à la piste 4)
Même rejeu que le § 1.4 sans `--recherche-large`. Jugé par geste (script `juger-rejeu`), sur les 172 posés réels jugés :

| Profil | geste | n | posé à l'identique | posé déplacé (> 1 mm) | différé | classes des poses du profil contre la vérité | mm des poses déplacées |
|---|---|---|---|---|---|---|---|
| base, sans levier | faute | 21 | 15 | 0 | 6 | faute 15 | |
| | moyenne | 11 | 9 | 0 | 2 | moyenne 8, fine 1 | |
| | fine | 65 | 47 | 0 | 18 | fine 46, moyenne 1 | |
| | acceptation | 75 | 67 | 0 | 8 | acceptation 67 | |
| L1-se + passe, sans levier | faute | 21 | 18 | 3 | 0 | **faute 19**, fine 2 | 2 1 239 |
| | moyenne | 11 | 10 | 1 | 0 | moyenne 9, fine 2 | 4 |
| | fine | 65 | 61 | 4 | 0 | fine 61, moyenne 4 | 10 5 0 11 |
| | acceptation | 75 | 74 | 1 | 0 | acceptation 74, fine 1 | 1 |

Comptes : base 646 posés, 243 différés ; L1-se 838 posés, 51 différés ; la passe reprend 83 restes et en pose 35 ; 117 différés réels posés (35 par la passe) ; 0 posé non jugé différé.

**Levier contre témoin, profil livré (L1-se + passe), partie 20 entière (ÉTABLI, même lot que le réglage : lecture conservatrice, la mesure hors échantillon est la garde du § 7)** :

| | témoin | levier | différence |
|---|---|---|---|
| fautes restantes (sur 21) | 19 | 2 | **−17** |
| fautes reposées justes (≤ 10 mm) | 2 (dont une reposée à 239 mm) | 12 (toutes par la passe, 1 à 5 mm) | +10 |
| fautes différées | 0 | 7 | +7 (sans pose, D-264 respecté) |
| fines devenues moyennes | 4 (10, 5, 0, 11 mm : dues à la passe seule) | 6 (+ 26 et 25 mm) | **+2** |
| acceptations devenues moyennes | 0 | 1 (12 mm) | **+1** |
| acceptations différées | 0 | 1 | +1 |
| posés non jugés différés | 0 | 15 (13 par le levier) | +15 (549 posés) |
| différés finaux (sur 889) | 51 | 72 | +21 |
| durée du rejeu (seul) | 4 576 s | 8 374 s | × 1,83 |

**Lecture.** (1) La passe seule ne corrige presque rien des fautes (2 sur 21, une seule par déplacement net) : c'est bien le levier qui les retire du lot, et la passe qui les repose ensuite avec les voisins validés. (2) Le prix propre au levier est petit et chiffré : 2 fines → moyennes (25, 26 mm), 1 acceptation → moyenne (12 mm), 1 acceptation différée, 13 posés non jugés différés (2,4 % des non jugés ; le § 2.10 estime ~14 fautes cachées parmi eux, donc ces 13 sont en partie des fautes). Les 4 fines → moyennes du témoin ne viennent pas du levier (déjà au § 1.2 sans passe). (3) Solde sur la partie 20 : −17 fautes, +3 moyennes, +21 différés ; bilan de pose à l'opérateur : 17 fautes de moins contre 21 cuts de plus à poser à la main et 3 retouches de plus. (4) Piste 4 tranchée : oui, la deuxième passe pose les cuts différés par le levier (12 de 21, 1 à 5 mm), sans que le levier ait besoin de poser lui-même (modes « choisir » écartés, D-264 tenu). (5) Temps : × 1,83 sur le rejeu complet (le banc consulte le module à chaque pose, 1 415 fois) ; dans l'extension, la consultation n'a lieu qu'à la pose du lot : coût réel ~4 s par cut consulté (§ 1.4), d'où la piste temps du § 2.11.

### 2.12 « Et sur la partie fine ? » (ÉTABLI, 1/11, 14:15 ; 65 fines, 11 moyennes, 75 acceptations de la partie 20 ; script `partie-fine` du scratchpad)
**Biais de la pose du lot (correction de l'opérateur = vérité − pose, mm, repère profil du départ).** Fines : lat gauche +1,0 ± 0,8 (IC 95), lat droite −0,9 ± 0,8, vert +0,9 / +1,2 ± 0,7, médianes 0,0 à 0,8, translation commune des deux rails 0,1 ± 0,7, écartement −1,9 ± 0,8 : rien au-dessus du plancher de bruit de la référence (1 mm, § 0.4) ; pas d'effet de zone (61 fines sur 65 en ADV) ni de moitié de partie (première/seconde : 1,5 / 0,6 mm). Moyennes : lat gauche −10 ± 9, porté par 3 cuts à 20 à 32 mm (ADV, rail gauche) : pas un décalage constant. **Aucune correction fixe ou apprise ne réduit la classe fine.**
**La meilleure paire forte du nuage comme raffinement.** Sur les fines, la cellule brute du moteur (meilleure paire) est en moyenne 3,2 / 3,8 mm PLUS BAS et 2,7 mm plus dedans (rail droit) que la pose de la chaîne, et plus loin de la vérité : 7,2 mm contre 4,8 (paire du lot à 15 mm : 7,1). La chaîne (correction d'écartement, appuis) fait MIEUX que la cellule brute : « pose = meilleure paire » dégrade 43 fines sur 65 (8 deviennent moyennes), en améliore 9. Sur les moyennes : 7 sur 11 deviendraient fines (corrélation 0,97 en travers à gauche), mais la règle conditionnelle « pose à plus de T mm de la meilleure paire → la prendre » donne, T = 10 : 9 cuts déplacés, 5 moyennes → fines, 1 fine → moyenne, **1 acceptation → faute**, 1 acceptation → moyenne ; T = 20 : 3 moyennes → fines, 1 acceptation → faute. Rejetée (D-262 : aucun cut dégradé) ; ce cas (acceptation → faute) est une pose juste dont la meilleure paire forte est un autre rail : exactement ce que le mode `choisir` a montré à l'examen.
**Plafond.** Erreur 3D des fines : médiane 4,8 mm [0 ; 8,4] : sous les 6 mm mesurables ; fine → acceptation dépend du geste de l'opérateur (retouches de 2 à 8 px, § 4), pas de la pose. Moyennes : 11 sur 172 (6,4 %) ; gain maximal théorique 6,4 points ; atteignable par le nuage : 3 sur 11 (celles à plus de 20 mm de la meilleure paire), au prix ci-dessus. **Verdict : la partie fine est au plancher ; le gisement est les fautes et 3 moyennes.**

## 8. Lot neuf « Aurore » (parties 10 et 11, 4.9.5.30, sans levier ; ordre de l'opérateur relayé le 1/11 à 21:04 ; hors échantillon strict)
Collection `banane-data` du 1/11 (3 volumes du journal, un Écho de 43 visites), lue en place, rien copié. Parties 10 (152 cibles, 139 posés, 13 différés) et 11 (74 posés sur 74). Reproduit avec `tools/juger-lot.cjs` (ÉTABLI) : 21 jugés sur 213 posés, tous corrigés par l'opérateur (liste de l'Aurore, biaisée vers les cuts signalés) : écart médian 3,57 mm, max 25,43 ; fine 20, moyenne 1, faute 0.

### 8.1 Les 6 « poserait » de la passe : six écritures JUSTES, et un artefact de mesure (ÉTABLI, 21:45)
**Fait.** Dans la 4.9.5.30 la passe 1 a ÉCRIT (événements `passe-differes-ecriture`, résultat « ecrit ») 6 des 13 différés de la partie 10, tous en appareil de voie, à 47 à 106 mm du départ d'ESV (étages first-pass, choice, deferred ; 0 à 1 appui). `juger-lot` les juge « poserait » à 54,7 mm en médiane, 3 sur 6 au-delà de 50 mm. **C'est un artefact.** La base de l'Écho pour ces cuts est « première visite » (le lot n'a pas posé, l'Écho ne connaît pas de pose d'Ariane) ; or à la première visite l'Écho a vu un écartement de 1 431,3 / 1 434,5 / 1 435,0 / 1 436,8 / 1 435,3 / 1 429,0 mm : celui ÉCRIT par la passe (1 431,2 / 1 434,4 / 1 435,0 / 1 436,7 / 1 435,2 / 1 428,8), pas celui du départ (1 500,0 pour les six). La correction de l'opérateur est donc relative à la pose de la passe : **0 ; 2,6 ; 2,2 ; 8,2 ; 4,2 ; 3,2 mm** (deux validées sans aucun mouvement). `juger-lot` (fonction `ombreDe`) ajoute le décalage de la passe à cette correction et mesure ainsi le DÉPLACEMENT de la passe depuis le départ (49,6 ; 46 ; 49,3 ; 110 ; 66 ; 60), pas son erreur. Conclusion : **6 écritures sur 6 sont fines (max 8,2 mm)**, en appareil de voie, à 0 ou 1 appui. Correction proposée à l'intégrateur (outil de mesure, pas touché ici) : quand le cut a un `passe-differes-ecriture` « ecrit », l'écart de l'ombre est la correction de l'opérateur seule. Le même artefact frappe toute mesure « poserait » d'un lot où la passe écrit (D-259).
**Le levier sur ces 6 poses** (module, pose de la passe soumise, vérité = pose + correction) : réglage livré : 1 différée sur 6 (fausse alarme : « pose sans paire forte », meilleure paire à 139 mm, pose juste à 2,6 mm ; nuage de 4 919 points) ; soutien 60 : la même ; **soutien 90 : 0 sur 6** ; « choisir-sur » à 90 : 0 remplacement ; graines « pics » : mêmes décisions, relances 4 à 6 → 2 à 3. Aucune faute à rattraper : le levier ne peut que coûter ici.

### 8.2 Le levier sur les 219 poses du lot (213 du lot + 6 de la passe ; ÉTABLI, 21:50 ; script `aurore-decisions` du scratchpad)
Nuages de 4 469 points en médiane (partie 20 : 17 169) : des captures trois à quatre fois plus pauvres.

| réglage | différés / 219 | motifs | à vérité connue (27) différés | coût |
|---|---|---|---|---|
| livré (soutien 0) | **20 (9,1 %)** | 10 sans paire forte, 10 concurrence | 4 : moyenne 25,4 ; fines 8,5 ; 2,9 ; 2,6 | au-dessus du critère de 8 % |
| soutien 60/0 | 11 (5,0 %) | 5 / 6 | 3 : fines 8,5 ; 2,9 ; 2,6 | |
| soutien 90/0 | **0** | | 0 | nul |

**Lecture.** (1) Zéro faute parmi 27 poses à vérité connue : sur ce lot le levier n'a rien à rattraper, et le réglage livré différerait 20 poses (9,1 %), dont 3 justes connues. **Le seuil 90/0 tient sur ce lot neuf** : 0 différé, 0 coût ; mais il tient par absence (aucune faute à rattraper ; sur la partie 20 le soutien 90 rattrape encore 19 fautes sur 21 et perd celle des couples, § 2.8). Soutien 60 : coût 5 %, 3 justes différées. (2) **Le contrôle a posteriori du § 2.10 ne se transfère pas** : 18 poses sur 192 sont à plus de 100 mm de la meilleure paire forte, et les 3 jugées parmi elles sont justes (25,4 ; 8,5 ; 2,9 mm) ; sur la partie 20 cette situation était une faute 19 fois sur 20. Dans ces nuages pauvres, la meilleure paire forte est souvent ailleurs que le rail validé : le nuage seul ne suffit pas à juger une pose ici, ni à la contredire. (3) Pour un lot comme celui-ci, la règle de terrain la plus sûre est le soutien 90 (ou 60 avec 5 % de coût) ; le levier livré à 0 est fait pour les nuages riches de la partie 20.

### 8.3 La partie fine de ce lot avec les signaux du lot (ÉTABLI sur 27 vérités : 21 jugés + 6 écritures de la passe ; 21:45 ; script `aurore-fine` du scratchpad)
Vérité = validation de l'opérateur (base « ariane » pour les 21, pose de la passe + correction pour les 6). Écart signé = pose − vérité, repère profil du départ (+ vert = vers le haut).

| | gauche lat | gauche vert | droite lat | droite vert |
|---|---|---|---|---|
| moyenne ± IC 95 | +0,8 ± 1,1 | **+1,0 ± 0,7** | −0,5 ± 2,2 | **+1,6 ± 0,7** |
| médiane [min ; max] | +1,4 [−5,2 ; +6,7] | +1,0 [−5,4 ; +5,4] | 0,0 [−25,2 ; +7,2] | +1,1 [−0,1 ; +8,0] |
| signes > +0,5 / < −0,5 (sur 27) | 14 / 5 | 15 / 1 | 12 / 8 | **19 / 0** |

Pire rail 3D de la pose : médiane 3,3 mm, moyenne 4,5 ± 1,8 (26 fines, 1 moyenne à 25,4 mm : rail droit à −25 mm latéral, étage deferred, 0 appui). Meilleure paire forte du nuage contre la vérité : médiane 9,3 mm, moyenne 40 mm (jusqu'à 337 : dans ces nuages pauvres, la meilleure paire est souvent un autre rail) : **le nuage ne raffine pas la pose, il la dégrade** (comme au § 2.12, en pire).
**Structure des corrections de 1 à 5 mm.** (1) Latéral : aucune direction (signes 14/5 et 12/8, IC contenant 0 sur les deux rails), aucune différence entre partie 10 et 11, ADV ou non, étage, appuis, passe ou lot, densité, ordre (tous les IC se recouvrent). (2) **Vertical : une direction, l'opérateur ABAISSE les rails de 1,0 (gauche) et 1,6 mm (droite)** ; 19 corrections sur 27 vers le bas et 0 vers le haut sur le rail droit (binomial : p < 10⁻⁵). Sur la partie 20 (§ 2.12), le biais vertical était de même taille et de **sens contraire** (l'opérateur montait les rails de 0,9 / 1,2 mm). Une correction fixe est donc exclue ; une correction apprise par lot vaudrait ~1 mm, sous le plancher mesurable de 6 mm (§ 0.4) : gain nul sur les gestes. La hauteur apprise de la 4.9.5.30 n'a appliqué que +0,1 / +0,2 mm ici (son plafond est 5 mm ; ses paramètres sont ceux d'un autre site). (3) Corrélations de Spearman (|écart| ou écart signé contre densité du nuage, flush, points de dessus et de flanc, dz de la hauteur apprise, ordre du cut, écartement ; 64 tests, n de 7 à 27) : rien au-dessus de ce que 64 tests produisent par hasard, sauf, SUPPOSÉ, deux pistes à n = 14 : le dz mesuré de la hauteur apprise contre l'écart vertical restant du rail droit (ρ = −0,78) et les points de flanc du rail droit (ρ = +0,59 à +0,66) : à revoir avec 100 vérités, pas avec 14.
**Réponse à l'opérateur.** Sur ce lot, la classe fine est au plancher (3,3 mm médian, bruit de la référence 1 mm, rien de mesurable sous 6 mm) ; un modèle simple ne reproduit que le biais vertical de ~1 mm, qui change de signe d'un lot à l'autre : il n'y a pas de gain à livrer ici. Le gisement reste les fautes (0 sur ce lot, 21 sur la partie 20) : c'est le lot qui décide, pas la partie fine.
