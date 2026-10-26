# Idées et angles morts pour la 5.0 — seconde récolte (15 octobre 2026)

Statut : **notes pour le cahier 5.0**, pas une spécification. Six angles de recherche menés à terme (surface d'ESV ; cerveau et géométrie ; données et apprentissage ; métier et opérateur ; fiabilité, plateforme et banc ; regard extérieur) : 56 idées et 51 angles morts, notés par trois juges indépendants (fondé et nouveau ; valeur pour l'opérateur ; faisable et sûr), regroupés en 12 idées ci-dessous. Remplace la première récolte (D-113, deux angles), dont le tableau des différés est repris en annexe. L'opérateur a validé les idées de la première récolte (D-114) ; celles-ci lui sont soumises. Aucune donnée de partie ni identifiant de projet ici.

Note pour l'opérateur. Base : code 4.9.5.1 (T951), DECISIONS D-085 à D-111, fiches, cahier 4.9, audits ESV locale et Écho, et les quatre exports de terrain des tests 15, 16 (deux parties) et 17 (environ 2 300 cuts proposés, 3 500 écritures observées). Chaque idée dit ce qui est **mesuré** (chiffre tiré d'un export ou ligne de code relue) et ce qui est **supposé**. Les lettres renvoient à tes trois attentes : **A** poser juste plus souvent, **B** traiter seule les zones difficiles, **D** apprendre de ses corrections.

Trois constats transversaux, qui portent la plupart des idées :

1. **La liste des coupes d'ESV est une archive exacte.** Le corps du PUT de validation égale la pose corrigée d'Ariane à une translation constante près (0,00 mm de dispersion sur 409 écritures), et la ligne N de la liste porte exactement la pose de départ du « Cut N » (écart 0,0 mm sur 100 % des cuts des quatre parties, b1-ombre). Donc la liste contient, en monde, les poses d'Ariane, les poses humaines faites ensuite, et la pose de départ de chaque cut, avant toute capture. Aujourd'hui on n'en lit qu'une fenêtre ±5 en dernier recours.
2. **Le moteur refuse plus souvent qu'il ne se trompe, et pour des raisons de modèle, pas de terrain.** Sur 399 différés joints au diagnostic : 29 % pour « flanc insuffisamment observé » sur un seul rail, 18 % pour « inclinaison hors domaine », 20 % pour la garde de paire. Trois portes dont aucune n'a été jugée contre la pose humaine depuis D-035 et D-044.
3. **Deux documents décrivent un moteur qui n'existe pas.** `src/geometry-candidate-v1.js:231` publie `delta=[0,sign*best.u,best.z]`, la graine du gabarit ; l'intersection des deux droites reste dans `metrics.surfaceIntersection` (l.168-178, écartée l.159-161). AUDIT_SUPER_CERVEAU § 1 affirme l'inverse. À corriger quoi qu'on fasse.

---

## 1. Les 12 idées à mettre en avant

Ordre : par effet attendu sur A, B, D, en tenant compte du coût et de ce qui est prouvé. Les doublons des six chercheurs sont regroupés.

### Idée 1. Relire la liste d'ESV après ton passage : la vérité terrain pour 100 % des cuts, sans Écho
*(regroupe donnees-1 et esv-7 ; nouveau ; D puis A)*

**Constat (mesuré).** ESV réécrit la ligne de la liste à chaque validation (statut, drapeaux, six bords ; c'est ce que l'observateur mime dans `applyWrite`, `src/esv-observer.js:138-144`). Sur le test 15, les 409 écritures de validation portent les six bords monde ; corps − pose d'Ariane = translation T constante, dispersion 0,00 mm. La table entière (≈ 9 000 lignes) est en mémoire de page (`addRows`, `esv-observer.js:130-141`) mais n'en sort que des comptes et une fenêtre ±10 ; elle est perdue au F5. Quand tu relis une partie après Orbite (D-097), chaque cut que tu corriges change ses bords : **liste(J+1) − écriture Ariane(J) = ta correction exacte, en monde**, sans séance Écho, sans geste. AUDIT_SUPER_CERVEAU § 4 : le dénominateur des faux verts « n'a jamais été compté » ; § 6 : seules 22 corrections Écho sur 91 sont rejouables.

**Proposition.** Étape 1 (outil, 4.9.5 possible) : exporter une fois par séance l'instantané compact de la table (indice, statut, drapeaux, six bords ; ≈ 0,5 Mo, 100 Ko zippé) ; `diff-liste.cjs` compare deux instantanés de la même partie, ou un instantané avec les écritures du journal précédent, et sort par cut l'écart latéral/vertical en repère profil, le statut, le délai. Étape 2 (extension, 5.0) : mémoire par partie des bords écrits par Ariane (cut → 6 nombres + heure + version, ≈ 30 Ko pour 500 cuts, `chrome.storage.local`, `unlimitedStorage` déjà dans le manifeste) ; à chaque chargement de liste d'une partie connue, événement `ecart-liste` par cut et compteur « corrections constatées » dans le panneau et CONTENU.txt.

**Effet.** D : chaque partie relue donne des centaines d'exemples (pose Ariane, pose humaine finale, nuage de départ déjà dans le corpus GCV1), 3 à 4 fois plus que l'Écho et insensible à ses 23 angles morts. A : premier taux réel de faux verts par partie. B : les cuts différés par Ariane puis posés par toi deviennent des références de zones difficiles.

**Coût.** 3 jours. **Risque.** Moyen : coordonnées monde gardées localement et exportées (les corps d'écriture le sont déjà dans le journal : à te dire clairement, cela dépasse l'accord D-096 « sans rien stocker d'autre »). « Inchangé » ne veut dire « juste » que si tu as relu toute la partie. Un autre opérateur ou une ré-extraction change aussi des lignes : garder `TreatedByOperator` et le délai ; les drapeaux sont pollués par Ariane elle-même (§ 2), donc ne compter que les lignes dont les bords diffèrent de plus de 1 mm de ce qu'elle a écrit.

**À mesurer d'abord.** Sur les exports des Échos 17/18/20 joints aux exports Orbite correspondants (D-097) : refaire la jointure cut par cut et vérifier qu'on retrouve la correction humaine à mieux que 1 mm. Aucun code extension avant.

**Quand.** Étape 1 en 4.9.5 ; étape 2 en 5.0, c'est le socle de D.

---

### Idée 2. Le calage de convention refusé et la garde de paire : 410 rails posés bruts avec un biais connu, 80 à 90 différés pour 2 cuts d'origine
*(regroupe dehors-2 et cerveau-3 ; nouveau ; A)*

**Constat (mesuré).** `src/placement-convention.js:39` : `maxShiftMm:8` ; au-delà `calibrate()` rend `applied:false` et `gcv1-shadow.js` applique le delta **brut**. Sur 1 520 cuts posés des quatre lots : 410 rails appliqués (13,5 %) portent `reason='shift-out-of-domain'` avec un dz médian de 9,4 mm (p10 8,3, p90 11,3) : la convention disait « ce rail est 9 mm trop bas », on l'a posé tel quel, alors que BRAIN_V1 mesure que tu poses déjà 3,5 à 4,7 mm plus haut que le moteur. La garde de paire (D-044 ; `src/lot-decision.js:210` `pairFlagged`, `:293` 'pair-guard') diffère un cut quand un rail est repêché par S1 **et** qu'un rail (pas forcément le même) a un calage hors domaine. Comptes vérifiés dans les journaux : 35, 6, 27 et 21 différés 'pair-guard', soit 89 sur 468 (19 %). Les décalages hors domaine relevés sont tous verticaux sauf 2 ; toute la distribution tient entre 8 et 12 mm, juste au-dessus d'un seuil ajusté sur −8,6/+6,6 mm. D-044 avait été justifiée par 2 cuts.

**Proposition.** (1) Mesurer sur les Échos 17/18 (qui ont tourné avec la même garde) l'erreur verticale à la pose humaine des rails à convention refusée contre les rails calés, et l'amplitude de ta correction sur les cuts 'pair-guard'. (2) Si l'erreur est confirmée : décalage plafonné (8 mm appliqués, reste consigné) ou domaine porté à 12 mm ; garde de paire portée par le seul rail repêché par S1, ou marge continue (S1 + dz > 10 mm) au lieu de S1 + refus binaire. Si ta correction sur ces cuts dépasse 10 mm, la garde est bonne et on le sait enfin.

**Effet.** A : jusqu'à 410 rails sur 3 040 posés 5 à 9 mm plus justes en vertical ; jusqu'à 89 différés sur 468 récupérés. C'est le plus gros levier bon marché vu dans ces exports.

**Coût.** 2 jours (1 de mesure, 1 de changement + rejeu). **Risque.** Moyen : au-delà du domaine mesuré, le rail peut être sur une mauvaise surface (mode E1) ; d'où la mesure d'abord et la garde d'écartement conservée. Changer le domaine touche toutes les poses calées : rejeu complet des quatre lots au banc obligatoire. `placement-convention.js` n'est pas gelé par `verify`, mais son empreinte peut entrer dans le `compositionHash` : ré-épinglage à déclarer. Touche D-044 : ton accord.

**À mesurer d'abord.** Jointure Écho ↔ Orbite par cut (C-03) sur 17/18 ; `tools/convention-fit.cjs` existe.

**Quand.** Mesure dès que la jointure C-03 est écrite (4.9.5) ; changement en 5.0.

---

### Idée 3. Deux positions calculées par rail, une seule appliquée : juger la graine contre l'intersection
*(dehors-1 ; nouveau ; A et D)*

**Constat (mesuré).** Voir constat transversal 3. Rejeu de `Candidate.propose` sur 343 rails exportés : écart intersection − graine en u : médiane −0,8 mm, p10 −7,1, p90 +5,7 ; |écart| > 3 mm sur 52 % des rails, > 5 mm sur 31 %. Personne n'a jamais mesuré lequel est le plus proche de ta pose.

**Proposition.** Hors ligne, sur les Échos 17/18/20 rejoués : erreur à la pose humaine de (a) la graine, (b) l'intersection, (c) leur moyenne, par classe de rail (flanc fort / partiel, PN, voie courante). Si (b) ou (c) gagne sur une classe, la 5.0 publie cet estimateur pour cette classe ; sinon |graine − intersection| devient un trait du score de doute (idée 8). Corriger AUDIT_SUPER_CERVEAU § 1 dans tous les cas.

**Effet.** A : un tiers des rails appliqués ont deux estimations qui divergent de plus de 5 mm ; choisir la bonne peut gagner plusieurs mm sans toucher la recherche. D : un signal de désaccord interne gratuit.

**Coût.** 1,5 jour. **Risque.** Faible : mesure hors ligne, aucun code moteur avant preuve. Si l'intersection est bruitée sur les flancs partiels (24 % des rails), le résultat ne vaudra que par classe.

**À mesurer d'abord.** Tout est hors ligne : Échos 17/18/20 + lecteur d'export + rejeu Node.

**Quand.** Mesure en 4.9.5 (aucune dépendance) ; décision en 5.0.

---

### Idée 4. Rail « dessus seul » : poser un rail à zéro point de flanc par le bord du dessus et le rail opposé
*(cerveau-1 ; nouveau ; A, le plus gros levier par cut)*

**Constat (mesuré dans les journaux, comptes de l'auteur non recomptés par les juges).** Première cause de différé : 114 cuts sur 399 (29 %) ont un rail candidat et l'autre abstenu « Flanc interne insuffisamment observé » avec 0 point de flanc et un dessus riche (topRows médian 37 à 44, soit plus de 2× `minTop`). Aucun chemin ne peut poser à 0 point de flanc : porte `geometry-candidate-v1.js:219` (`!face||faceCount<cfg.minFace`), flanc partiel ≥ 3 points (l.203), `lot-decision.js:76` `minFace:3`, `placement-convention.js:38` `faceFallbackMm:0`. Pourtant le delta publié est la graine (l.231), qui ne dépend pas du flanc. D-035 : 27 rails sur 41 justes au premier rang avec < 3 points de flanc, desserrage refusé « sans une autre preuve ». Dans 212 des 235 rails abstenus pour flanc, le rail opposé est un candidat : l'autre preuve est dans le cut.

**Proposition.** Estimateur « dessus seul » pour le rail sans flanc : latéral = bord intérieur de la bande de points du dessus (largeur de gabarit connue), vertical = 90e centile du dessus (convention) ; trois preuves obligatoires : accord de dévers avec le rail opposé (|Δz| ≤ 15 mm, règle déjà dans `src/brain.js`), écartement dans 1420–1470 **en admissibilité seulement** (D-033), écart à la voie ≤ 30 mm s'il y a des appuis. Statut publié distinct (`dessus-seul`) pour l'export et l'Écho. Jamais au passage à niveau détecté. Module après `gcv1-shadow`, comme `placement-convention` : moteur gelé intact.

**Effet.** A : jusqu'à 114 différés sur 399 (−29 %) si l'estimateur tient à 10 mm sur l'Écho. D : une classe d'exemples propre (rail sans flanc) aujourd'hui invisible.

**Coût.** 5 jours. **Risque.** Moyen : un bord de bande érodé (points manquants, végétation) donne un faux latéral ; c'est un estimateur qui POSE là où D-035 a refusé. Hors ligne, puis ombre un lot, puis actif.

**À mesurer d'abord.** Les 66 rails différés de l'Écho partie 17 (D-098) et les quatre lots au banc contre la pose humaine : erreur de l'estimateur, et combien franchissent les trois preuves. **Avant cela, l'idée 10 doit dire si la famine de flanc vient du nuage ou du niveau de détail chargé** : si c'est le LOD, le remède est ailleurs.

**Quand.** 5.0, après la mesure.

---

### Idée 5. La porte « inclinaison hors domaine » vient d'une borne de modèle, pas du terrain : 17 % des différés
*(regroupe cerveau-2 et dehors-4 ; nouveau ; A)*

**Constat (mesuré).** `robustLine` (`geometry-candidate-v1.js:12-20`) borne la pente à ±0,5 et `slopeLimited` déclenche l'abstention (l.216, 220). Rejeu de 343 rails : aucun plan de roulement n'atteint la borne ; les 30 cas viennent tous du **flanc** ; pente brute médiane du flanc 0,18, p90 0,47. La bande de flanc (l.165-166 : 9 à 34 mm sous le dessus, ±10 mm en u) attrape le congé du champignon (rayon 13 mm) : ce n'est pas une droite, la « pente » est un artefact du modèle. Terrain : 68 à 70 cuts différés avec ce motif sur 399-410 ; ils ne se groupent pas (5 % ont un autre « slope » à ±5 cuts, contre 49 % pour l'ensemble des différés) : défaut par cut, pas zone de voie. La pente ne sert qu'à refuser (le delta publié est la graine). D-035 : 6 sur 7 justes, « conservé, gain non mesuré », sur 10 rails.

**Proposition.** Mesure d'abord, sans code : sur les Échos, erreur des rails **appliqués** dont la pente brute vaut 0,3 à 0,5 contre < 0,3. Si pas de dégradation : relâcher la borne du flanc (porte conservée pour le dessus et au PN). Sinon : modéliser le flanc par le contour gabarit déjà disponible (`faceAnchors` l.55-57) ou calculer la pente sur la seule bande 14 à 30 mm, et abstenir sur la perte gabarit du flanc, pas sur la pente.

**Effet.** A : jusqu'à 68 différés sur 410 (17 %) sans perdre un rail juste si la mesure le confirme.

**Coût.** 2 à 3 jours. **Risque.** Moyen : fichier moteur épinglé par le CONTRACT de `gcv1-shadow.js` et partagé par S1 : ré-épinglage D-095 point 4 avec ton accord. Un rail usé en courbe a vraiment un flanc incliné : garder une abstention sur la perte. Petite correction : le 1/20 est l'inclinaison de pose du rail, pas la pente du flanc.

**À mesurer d'abord.** Échos 17/18 : erreur par tranche de pente brute.

**Quand.** Mesure en 4.9.5 ; changement en 5.0.

---

### Idée 6. Deux préalables à tout B1 actif : calibrer T sur la pose de départ, et étiqueter la provenance des appuis
*(regroupe esv-1, esv-2 et cerveau-7 ; nouveau ; A, condition de B)*

**Constat (mesuré).** (a) B1 ne lit aucun voisin tant qu'une écriture de validation n'a pas servi à mesurer T (`src/appuis-liste.js:11-18`, `background.js` `b1NoterEcriture`, 'sans-repere'). Or la ligne N est la pose de départ du cut N à 0,0 mm sur 100 % des cuts des quatre parties (constat transversal 1). Cuts aveugles : 4/515, 3/370, 4/824 et **23/593 sur le test 17, tous au début du lot de reprise après F5, exactement les différés revisités**. FICHE_B1 constat 3 (« appariement NON établi ») est dépassé par ces chiffres. (b) B1 prend pour appui toute ligne 'valid' (`appuis-liste.js:40`), le drapeau opérateur n'est que compté. Mesuré sur les fenêtres ±5 : **77 à 87 % des appuis sont des verts d'extraction jamais vus par un humain**, presque tout le reste sont les poses d'Ariane de la même séance (opérateur ≈ fraîches : 859/853, 620/620, 1 553/1 553), les voisins validés par un humain : 0 à 72 lignes sur 5 000. Et Ariane écrit `TreatedByOperator:true` dans ses 409 validations : dans ESV sa pose est indiscernable d'une pose humaine. METHODES_METIER § 1 : « un vert n'est pas forcément juste » ; D-102 : B1 en ombre a retiré une bonne pose ; KI-042/047 : le chaînage propage les faux.

**Proposition.** (a) T = bords de la ligne N (monde) − pose de départ du cut N (scène), dès le premier cut et après chaque F5 ou nouveau lot, puis contrôlée par les écritures comme aujourd'hui (`rigideMm`, `repereEcartMm`). (b) Quatre classes d'appui : 'extraction' (valid, non traité à l'ouverture), 'ariane-seance' (écriture vue dans la séance), 'ariane-anterieur' (mémoire par partie des cuts posés, idée 1 étape 2), 'humain' (traité à l'ouverture et absent des poses connues d'Ariane). Règles : jamais chaîner ni interpoler (D-099) sur ses propres poses non vérifiées ; en zone à risque, appuis humains seulement ; provenance consignée dans b1-ombre et dans le contexte Écho.

**Effet.** A : B1 et l'interpolation disponibles sur 100 % des cuts au lieu de 96–99 %, et surtout sur les lots de reprise ; faux verts d'extraction et erreurs d'Ariane non propagés. D : le corpus sait quelles poses sont humaines.

**Coût.** 1 jour (a) + 2 jours (b). **Risque.** Faible en ombre ; moyen en actif : la classe 'humain' est quasi vide hors Échos, B1 perdrait presque tous ses appuis. À mesurer sur les Échos 17/18/20 avant toute activation.

**À mesurer d'abord.** (a) déjà prouvé par les b1-ombre. (b) : sur les b1-ombre existants, rejouer la décision hypothétique avec chaque classe et compter ce qu'on perd et ce qu'on évite (les drapeaux sont dans la table de page, bits 1/2/4 de `fl`, `esv-observer.js:134`).

**Quand.** (a) en 4.9.5 avec l'activation de B1 ; (b) en ombre 4.9.5, règle en 5.0.

---

### Idée 7. Ombre GCV1 à chaque visite Écho : la proposition qu'Ariane aurait faite, consignée à côté de ta correction
*(regroupe donnees-2 et metier-7 ; nouveau ; D)*

**Constat (vérifié dans le code).** `src/continuity-observer.js:202` rend `no-anchor` sans ancre ; son commentaire (l.193-200) renvoie le témoin « depuis la pose ESV » à un rejeu hors ligne, qui exige les nuages (1,2 Mo par visite) et n'a pas été fait sur les Échos 17/18. AUDIT_ECHO § 0.3 : Écho n'a « aucune pose comparée » ; C-03 propose une jointure hors ligne qui ne couvre que les cuts qu'Ariane a visités : les cuts que tu corriges sans passage d'Ariane (verts d'extraction, ADV, PN) n'ont aucune proposition à comparer. En Écho le service worker est inoccupé ; moteur 152 ms médian (KI-040).

**Proposition.** À `visit-ended` (`src/native-session.js:294` `scheduleContinuity`), calculer aussi `Shadow.scientificProposeBoth` depuis la pose ESV (sans ancre) sur la même entrée `gatherInput`, **avant** de lire la référence humaine (ordre de `buildEngineInput` de `tools/native-offline-evaluate.cjs` : frontière anti-fuite). Consigner un bloc compact `ombreGCV1` : delta par rail, motif, confiance, topRows, faceCount, lossRatio, nStrongCompetitive, écartement ; puis `humanDeltaMm` par rail et par axe. Ajouter l'hypothèse B1 et l'interpolation des voisins (b1-voisins déjà interrogeable) : chaque séance Écho devient un banc des méthodes 5.0. Étendre `native-offline-evaluate.cjs` pour vérifier que le bloc égale le rejeu.

**Effet.** D : chaque visite Écho devient une ligne d'apprentissage lisible sans nuage, y compris sur les cuts qu'Ariane n'a jamais traités : c'est le jeu de « justesse » dont AUDIT_SUPER_CERVEAU § 6 dit qu'il a le plus de données. A : compte direct, par partie, des cuts où Ariane aurait eu faux de plus de 10 mm ; le critère d'activation de B1 (0 mauvaise pose ajoutée) se mesure en continu.

**Coût.** 2 jours (3 avec B1 et interpolation). **Risque.** Faible : aucune commande, aucun affichage ; +0,15 à 0,8 s de service worker par visite, hors file ; un essai doit garantir que la référence humaine n'entre jamais dans l'entrée moteur.

**À mesurer d'abord.** Rien à mesurer : à construire, puis prouver par rejeu = bloc consigné.

**Quand.** 5.0, dès qu'Écho parfait (AM-01/03) donne une pose de départ et une référence fiables.

---

### Idée 8. Cohérence avec les voisins posés : une mesure de qualité sans humain, et une liste courte « à relire » après chaque lot
*(regroupe donnees-3 et metier-6 ; nouveau ; A et D)*

**Constat (mesuré sur le test 15, 409 cuts posés).** Pour 356 rails ayant deux voisins posés à ±3 cuts : écart entre la pose d'Ariane et l'interpolation linéaire des voisins : latéral médiane 1,8 / P90 4,4 / max 12,2 mm ; vertical 3,0 / 9,6 / 34,3 mm ; 11 cuts > 15 mm, 5 > 20 mm, et les 8 pires sont groupés dans une même zone de 80 cuts, rail gauche, vertical : une zone que rien ne signale. Tes corrections sont à 2,8–4,5 mm médian de la même interpolation (D-098, D-100). Le désaccord V4.6/GCV1 et la confiance ne prédisent presque pas cet écart (Pearson 0,18 et −0,14 ; OFFLINE_EVALUATION : −0,05). La décision sur le lot ne regarde la voie que vers l'avant (`chainMm` 15, `lot-decision.js:76`), jamais après le lot ; la garde d'écartement voisin n'existe qu'avec appuis ; le résumé de partie ne liste que les différés (`panel.js:312-321`). Écartement posé p5–p95 : 1434–1448 mm sur un lot, quand le contrat accepte 1420–1470 ; quelques poses par partie sortent de cette bande.

**Proposition.** (1) Outil `coherence-voisins.cjs` sur un bilan : écart par rail à l'interpolation ±3 (voisins posés par Ariane, puis voisins validés de la liste via T), cuts > 15 mm, zones = suites de ≥ 3 cuts > 10 mm. (2) Dans l'extension, un seul score de suspicion par pose à la fin du lot : écart aux voisins, écart à la bande d'écartement de la partie (apprise sur les lignes valides), rail repêché par S1 (KI-043), convention refusée (idée 2), |graine − intersection| (idée 3), confiance. Section « poses à relire : N cuts » dans le panneau et CONTENU.txt (numéros et mm, aucune position). (3) Ces écarts servent d'étiquettes faibles pour GCV2 (négatifs > 15 mm, positifs < 5 mm) et de métrique de version au banc, sans humain.

**Effet.** A : tu relis 11 cuts sur 409 au lieu de tout ou rien, et une zone de faux verts probable est nommée. D : étiquettes gratuites sur chaque lot Orbite ; mesure comparable entre versions sans attendre un Écho.

**Coût.** 2 jours. **Risque.** Faible : un cut juste entouré de deux faux est signalé à tort (encore utile) ; ne jamais en faire une pose automatique (chantier D-098 à D-100, séparé) ; l'option « différer hors bande apprise » ne fait que différer plus, mais à rejouer au banc (C1).

**À mesurer d'abord.** Déjà fait pour (1) sur un lot ; à refaire sur les trois autres bilans ; puis, dès l'idée 1 ou la jointure C-03, vérifier que les cuts signalés sont bien ceux que tu corriges.

**Quand.** Outil en 4.9.5 ; section de panneau en 5.0.

---

### Idée 9. Une seconde passe qui serve à quelque chose : mémoire monde par partie, voie encadrée, et ne jamais revisiter sans source nouvelle
*(regroupe cerveau-8, esv-8, metier-3, dehors-10, metier-1 et cerveau-10 ; en partie prévu (D-053, D-098 à D-100) ; A et B)*

**Constat (mesuré).** D-109 : après F5, le lot 2 du test 17 a revisité 68 différés et en a re-différé 66 ; les motifs par rail sont identiques dans 65 cas sur 69 : le moteur est déterministe sur le même nuage, revisiter sans rien de neuf coûte 68 cycles pour 2 poses. Rien ne pouvait changer : la mémoire des appuis est celle du lot (`rememberAnchor`, `lot-decision.js:377`), `sameTrack` exige le même `frameId` (l.106), qui change à chaque F5 ; `retablirApresRechargement` (`background.js:504-516`) translate bien les appuis dans le nouveau repère, mais un nouveau lot ordinaire (celui lancé en D-109) n'hérite de rien ; la case « Reprise des différés » n'est offerte qu'après un lot FINI (`panel.js:686-691`), pas après un arrêt par F5. Sur les quatre lots, 326 des 468 différés sont « no-anchor » ; B1 en ombre aurait rendu une décision sur 241 d'entre eux (51 %), 31/105, 15/58, 37/120 et 16/106 différés ont un cut posé à ±3 des deux côtés. La voie encadrée (`framedNeighbours`, `predictFramed`, 6,4 mm au pire, D-053) ne joue jamais en avancée normale (aucun appui après le cut) et jamais après F5. KI-045 : moteur amorcé depuis la voie 141 justes / 3 faux contre 118 / 6 depuis la pose ESV ; la voie n'amorce aujourd'hui qu'APRÈS une abstention (stade 'window').

**Proposition.** (1) Règle de lot (B3) : la reprise ne revisite un différé que si une source nouvelle existe (voisins validés depuis, B1 actif, voie encadrée) et note sinon « déjà jugé, rien de neuf » ; le taux de re-différé devient le test d'activation de B1. (2) Mémoire par partie des cuts posés/validés en coordonnées monde (via T, quelques Ko, `chrome.storage`), relue au lot suivant et après F5 ; offrir la reprise des différés aussi après un arrêt par F5. (3) En reprise : prédiction encadrée des deux côtés (D-099 : ±3), relance du moteur depuis cette prédiction (`seededRails`, étape 'window' déjà existante), puis seulement l'interpolation si le moteur s'abstient encore ; pose proposée par B1 consignée (D-102 point 3). (4) Au premier passage, avec ≥ 2 appuis cohérents (lot ou liste, qui donne des lignes **après** le cut), lancer le moteur deux fois (pose ESV et prédiction) ; accord ≤ `chainMm` → pose ; désaccord → différé en consignant les deux (+0,15 s médian par cut, compatible mode rapide).

**Effet.** A et B : la moitié des différés ont des voisins qui permettraient une décision ; aujourd'hui la seconde passe ne sert à rien (66/68). Moins de faux à décalage commun (KI-042 : 117 à 273 mm, écartement dans le contrat, invisibles à la garde d'écartement). D : les poses B1 consignées deviennent jugeables.

**Coût.** (1) 0,5 jour ; (2)+(3) 3 jours ; (4) 2 à 4 jours. **Risque.** Moyen : appuis faux (KI-047, idée 6b indispensable avant) ; le désaccord doit toujours gagner sur l'accord ; en zone (D-101) l'interpolation exclue tant que les faux verts n'y sont pas mesurés. Rejeu des quatre lots au banc et 0 mauvaise pose ajoutée sur les Échos 17/18/20.

**À mesurer d'abord.** Les 241 décisions hypothétiques de b1-ombre contre ta pose : il faut un Écho sur l'une des parties 24 à 27, qui n'existe pas (question 7).

**Quand.** (1) en 4.9.5 ; (2) à (4) en 5.0, après l'idée 6.

---

### Idée 10. D'où vient la famine de flanc : du nuage ou du niveau de détail chargé ?
*(cerveau-9, complété par fiabilite-9 ; nouveau ; décide entre l'idée 4 et B2)*

**Constat (mesuré, comptes de l'auteur).** Autour de chaque tête de rail (±0,5 m le long, ±0,18 m latéral, ±0,10 m vertical) la capture ne contient que 78 à 94 points en médiane, **que le rail soit résolu ou non** (83 contre 78) : environ 40 sur le dessus, 0 à 10 sur le flanc. Le taux de différé est le même quelle que soit la règle de lecture (24,8 % au signal, 24,9 % au repli 800 ms) : attendre plus ne donne pas plus de points. Le lecteur gelé le dit : « le LOD chargé dépend de la vue ; aucun nœud supplémentaire n'est demandé au serveur » (`vendor/lidar.js:178`), borné à `maximumLoadedNodes` 512 (`adapter-page.js:239`). Ariane ne relève ni la profondeur d'octree des nœuds lus ni `viewer.getPointBudget()`. B2 (caméra) agit sur la vue, pas sur le budget.

**Proposition.** (1) 4.9.5 : consigner par capture la profondeur des nœuds lus et le budget de points (deux nombres, lecture seule). (2) Au banc B (vrai Potree) puis sur un lot de terrain en ombre : doubler ou quadrupler le budget pendant la seule capture et compter les points de flanc gagnés par rail. (3) Si le gain est net, l'adopter comme pièce du mode rapide (réversible, coupable par réglage) et le combiner à B2 ; sinon, arrêter d'y croire et investir dans l'idée 4.

**Effet.** A : si la famine est un effet du LOD, c'est le levier le moins cher sur les 114 + 70 différés « flanc » et « pente ».

**Coût.** 2 jours. **Risque.** Moyen : un budget plus haut charge ESV (mémoire, rendu, réseau) : à mesurer au banc avant tout terrain, jamais en Écho (passivité). Changer le budget est une commande sur Potree (état d'ESV modifié, pas une pose). La variante « relire les nœuds du cache LRU » (fiabilite-9) est écartée : `vendor/lidar.js` est gelé et les nœuds LRU peuvent être plus grossiers.

**À mesurer d'abord.** Improuvable hors ligne : la maquette n'a pas Potree ; le banc B est hors dépôt et à sauver (AUDIT_ESV_LOCALE § 9).

**Quand.** (1) en 4.9.5 ; (2)-(3) en 5.0.

---

### Idée 11. Écouter le bus d'événements d'ESV au lieu de deviner aux touches et aux compteurs
*(regroupe esv-4, esv-5, fiabilite-10, metier-8 ; nouveau ; D puis A)*

**Constat (vérifié).** Le relevé B du 15 octobre (AUDIT_ESV_LOCALE § 8) établit que `#globalcontainer` porte les événements jQuery `railPairSelected` (→ `loadCut(n,i)`), `railPairUpdated(…,'valid'|'skipped',…)`, `railPairSeen`, `loading`, `newPart`. Aucun module d'Ariane ne les écoute (grep : commentaires seulement, `adapter-page.js:594-595` ; `railPairSelected` n'est qu'émis par `goToCut`) ; l'observateur est injecté à `document_start` sans jQuery ; l'adaptateur lit déjà `$._data` (l.842). Écho ne reconnaît que Maj+Espace et le clic (`native-page.js:153-155`) : AUDIT_ECHO AM-01 (Ctrl+Entrée, Entrée → `PASS_NO_DECISION`, « fréquent sur le dernier cut »), AM-02/15/18. Orbite déduit la fin de partie du compteur et d'un silence (KI-063/067/069) et la fin de chargement du seul `Potree.numNodesLoading` (`adapter-page.js:211`, `:334`), qui s'éteint après ~10 min de page (D-109 : −71 % retombe à −50 %).

**Proposition.** Dans l'adaptateur (monde principal, après ESV), un écouteur passif, dans un try/catch (une exception dans un gestionnaire jQuery coupe les suivants) : relevé `esv-event` (nom, statut, index si présent, heure page), charge utile inconnue consignée brute (nombres et chaînes courtes). Usages, dans l'ordre de sûreté : (a) `railPairUpdated` → étiquette Écho indépendante de la touche, preuve locale de décision à croiser avec le 204 ; (b) `newPart` → clôture de lot immédiate au lieu de la déduction ; (c) `loading` → troisième source du signal de fin de chargement, **d'abord en ombre à côté de la règle actuelle**, car rien ne dit qu'il couvre les nœuds Potree plutôt que les rails du cut. Une séance en ombre pour relever les charges utiles, puis usage. Repli DOM conservé partout.

**Effet.** D : 0 validation humaine manquée ou ambiguë en Écho, réglé à la source. A : fins de partie sûres ; si `loading` tient, −70 % durable sans dépendre du compteur Potree (≈ 8 à 12 min par séance de 500 cuts).

**Coût.** 2 jours. **Risque.** Moyen : symboles internes d'ESV (KI-026), sens et moment des événements supposés (seul `railPairSelected` est lu) ; la maquette n'a qu'un `$` minimal inventé, elle prouve la plomberie, pas le sens ; il faut un point d'injection monde principal en Écho. Un `loading` qui finit avant les nœuds ferait lire un nuage incomplet : la relecture si la signature change (`adapter-page.js:386-388`) reste la ceinture.

**À mesurer d'abord.** 10 minutes de toi, console ouverte sur le vrai ESV : charge utile et moment de chacun des cinq événements (question 5). Ou une séance en ombre.

**Quand.** Écoute en ombre en 4.9.5 (remplace ou complète l'étape 1 d'Écho parfait) ; usages en 5.0.

---

### Idée 12. Carte de la partie depuis la liste entière, avant de visiter : séries de rouges, écartement, courbure, verts suspects, PN gradué
*(regroupe esv-3, cerveau-6, metier-2, dehors-5 ; l'intention est prévue (METHODES_METIER § 4.1, AUDIT_ECHO C-05), la source et les chiffres sont nouveaux ; B)*

**Constat (mesuré).** La table en page tient toutes les lignes avec statut et bords monde, mais `addRows` (`esv-observer.js:130-137`) jette `RailSpacing`, `TrajAzimuth`, `RailType`, `Success*`, `PK` (FICHE_B1 constat 1). Faits : les voisins ±5 des cuts traités sont invalides à 26 % contre 5,5 % dans la partie : un rouge est 5 fois plus souvent près d'un rouge, ta règle en chiffres ; 41/105, 16/58, 31/120, 22/106 différés sont dans des séries de 3 ou plus. Proxy de faux verts : parmi 416 voisins verts vus au moins 3 fois, 40 sont rejetés par la garde de cohérence 8 mm (`lot-decision.js:241`) dans toutes leurs fenêtres, dont 25 verts d'extraction ; 29 des 33 séries rejetées sont isolées, donc pas des courbes. `context()` refuse tout profil autre que U50 (`adapter-page.js:88`) alors que `RailType` le dirait avant le cut. Le lecteur PN calcule `flushPct` sur chaque cut mais ne le consigne qu'au-dessus de 50 % (`lot-decision.js:158-163`, `:278`) : 0 valeur dans les quatre exports. Le moteur ne regarde que ±0,18 m par rail et n'a aucune notion de « second rail », alors que la capture conserve ±0,4 m latéral (`native-lidar.js:11`). **Attention** : la pose de départ d'un cut invalide est une paire par défaut à exactement 1500 mm (90 % des cuts, 96/105 différés) : `RailSpacing` d'une ligne invalide vaut le gabarit, pas une mesure ; la détection ADV par écartement ne peut s'appuyer que sur les lignes valides.

**Proposition.** Un passage sur la table en page (quelques ms, lecture seule) : par ligne, écartement |G−D| des valides, écart à l'interpolation de ses voisins ±3, longueur de la série de rouges, azimut local (`TrajAzimuth` ou dérivé des bords), `RailType`. Sortie compacte au service worker : indices et millimètres seulement. Consigner `flushPct` à chaque cut. Côté nuage : profil latéral au niveau du champignon sur ±0,4 m, nombre de crêtes ≥ 3 cm ; ≥ 2 crêtes = ADV candidat. Usages : B : zones à marges connues avant le lot ; A : B1 et l'interpolation n'utilisent pas un vert suspect, le lot sait qu'un cut hors U50 arrive ; D : chaque cut du journal et chaque visite Écho porte sa zone, D-098 à D-100 refaites par zone (D-101).

**Effet.** B : condition préalable à toute méthode en zone ; rien n'est posé de plus tant que les méthodes par zone n'existent pas. Chiffre cible : 25 verts d'extraction suspects à faire juger et 35 différés 'pair-guard' expliqués ou non par la zone sur un lot.

**Coût.** 3 jours (+2,5 pour la signature nuage). **Risque.** Moyen : en courbe serrée une droite rejette à tort (interpolation locale, seuil mesuré) ; une singularité vraie ressemble à un faux vert : le critère sert à ne pas s'appuyer dessus, jamais à corriger seul. Hypothèses : `RailSpacing` d'une ligne valide = mesure ; sens de `Success*` jamais relevé ; « 1480 mm en ADV » à vérifier sur une partie contenant un ADV connu de toi.

**À mesurer d'abord.** Sur les Échos 17/18/20 : les verts que tu as corrigés étaient-ils « suspects » selon ce critère ? Relevé de 2 minutes des valeurs de `Success*` et `RailSpacing`.

**Quand.** Lecture et consignation en 4.9.5 (`flushPct`, champs gardés) ; carte en 5.0.

---

### Récapitulatif

| # | Idée | Pour | Coût (j) | Risque | Mesure préalable | Quand |
|---|------|------|----------|--------|------------------|-------|
| 1 | Relire la liste après ton passage | D, A | 3 | moyen (accord bords monde) | jointure Écho↔Orbite 17/18/20 | outil 4.9.5, extension 5.0 |
| 2 | Convention refusée et garde de paire | A | 2 | moyen (D-044, rejeu) | erreur verticale sur Échos | mesure 4.9.5, 5.0 |
| 3 | Graine contre intersection | A, D | 1,5 | faible | Échos rejoués | mesure 4.9.5 |
| 4 | Rail « dessus seul » | A | 5 | moyen (pose à 0 flanc) | 66 rails Écho 17 + idée 10 | 5.0 |
| 5 | Porte de pente du flanc | A | 2-3 | moyen (moteur épinglé) | erreur par pente brute sur Échos | mesure 4.9.5, 5.0 |
| 6 | T par la pose de départ ; provenance des appuis | A, cond. B | 1 + 2 | faible / moyen en actif | rejeu des b1-ombre par classe | 4.9.5 (a), 5.0 (b) |
| 7 | Ombre GCV1 en Écho | D | 2-3 | faible | aucune (preuve par rejeu) | 5.0 |
| 8 | Cohérence voisins, liste à relire | A, D | 2 | faible | refaire sur 3 bilans | outil 4.9.5, 5.0 |
| 9 | Seconde passe utile | A, B | 0,5 + 3 + 2-4 | moyen (KI-047) | Écho sur une partie 24-27 | règle 4.9.5, reste 5.0 |
| 10 | Famine de flanc : LOD ou nuage ? | A | 2 | moyen (charge ESV) | banc B | relevé 4.9.5, essai 5.0 |
| 11 | Bus d'événements ESV | D, A | 2 | moyen (KI-026) | 10 min de relevé | ombre 4.9.5, 5.0 |
| 12 | Carte de la partie depuis la liste | B | 3 (+2,5) | moyen | Échos + relevé champs | lecture 4.9.5, carte 5.0 |

Total si tout est retenu : environ 35 jours d'agent, dont une dizaine de pure mesure hors ligne qui peut commencer tout de suite sur les exports existants.

---

## 2. Angles morts du côté d'ESV

Faits observés sur le contrat ESV (DOM, écritures, liste, Potree), exploitables et non exploités. « Mesuré » = vu dans les exports ou au banc ; « supposé » = tiré du code ou du relevé, à confirmer.

1. **Appariement cut ↔ ligne établi (mesuré).** FICHE_B1 constat 3 dit « NON établi » ; b1-ombre dit geoMm = 0,0 mm (max 0) sur 100 % des cuts de quatre parties. À clore dans la fiche ; autorise la calibration de T sans écriture (idée 6a).

2. **ESV écrit `{SeenByOperator:true}` à chaque cut chargé (mesuré).** 515/515, 824/824, 370/370 écritures pour autant de cuts visités, toutes 204, rowIndex = cut, ~1,5 s après la validation précédente (événement `railPairSeen`). Deux conséquences jamais écrites : (a) **les cuts différés par Ariane sont marqués « vus par un opérateur » dans la base d'ESV** (105, 141, 108 par partie) ; le drapeau `SeenByOperator` ne permet plus de trouver les verts « jamais regardés » après un lot d'Ariane, il faut `TreatedByOperator` ; (b) c'est une preuve serveur de navigation horodatée, que les différés n'exploitent pas (`serverConfirmed:false` sur 100 % des preuves, `background.js:401` ne connaît ces écritures que pour ne pas les prendre pour un refus). Coût pour l'exploiter : 1 jour. La partie (a) est une décision de toi (question 2).

3. **Ariane écrit `TreatedByOperator:true` (mesuré).** Corps des 409 validations. Dans ESV, une pose d'Ariane est indiscernable d'une pose humaine ; le compteur « N on M treated » et la fiche de départ comptent ses poses comme traitées ; aucune relecture côté ESV ne retrouve « ce qu'Ariane a posé », seuls ses exports le savent (D-097). Toute règle sur ces drapeaux doit d'abord soustraire son propre passage : mémoire par partie (idée 1 étape 2).

4. **ESV relance lui-même une écriture refusée (mesuré).** Test 16 : deux validations en HTTP 502, chacune relancée par ESV (`attempt:2`) à 204 en 0,5 et 0,9 s ; Ariane avait déjà compté les cuts acceptés sur la navigation. D-110 (« jamais vu sur 924 écritures ») est dépassé : 2 refus sur ~3 500 écritures, 0 refus définitif. Le correctif D3 doit attendre la **chaîne** de tentatives (l'observateur a déjà `retryWindowMs` 15 s) et ne retenir que la dernière ; un D3 qui attend 500 ms la première réponse classerait ces deux cas « incertain » à tort. `rowIndex` est null sur un refus (`applyWrite` seulement en 2xx) : le lien cut ↔ écriture refusée se perd.

5. **Le 204 vu n'est pas la preuve de validation (mesuré).** `serverConfirmed:true` = 0 partout ; 924 écritures 204 appariées rowIndex = cut sur un seul test ; `withoutServerConfirmation` reste purement local (`background.js:1143`) ; le refus en attente est perdu si le service worker redémarre (D3 en mémoire seulement). Brancher le 204 observé et garder les refus dans `chrome.storage.session` : 1 à 2 jours, corrige aussi le « cut posé deux fois » après F5 (NOTES § 4), en veillant à ne pas recréer la double pose en sens inverse.

6. **Le rechargement de la liste est un audit serveur gratuit (mesuré).** Test 15 : +160 validés côté serveur entre deux chargements pour 161 validations d'Ariane (la dernière pendant la lecture des pages). Les fiches de départ sont gardées (`export-cache.js:193`) mais jamais comparées. Δ validés serveur contre validations d'Ariane depuis la fiche précédente → avis « N validations non retrouvées » : 0,5 jour. Attention : seuls les chargements au F5 sont des lectures fraîches ; les `list-summary` répétés chaque minute (13 à 15 copies identiques) sont des re-publications du service worker.

7. **Après chaque validation, ESV demande « reste-t-il des invalides ? » avec un projet `undefined` (mesuré).** `esv-observer.js:83` : 410 réponses sur 410 vides, 0,3 ms après l'écriture. ESV ne sait pas lui-même s'il reste des invalides : cause plausible du saut à la partie suivante au dernier cut (KI-069) et ~400 requêtes inutiles par lot. Ne rien attendre de ce contrôle.

8. **Champs de la liste jetés (vérifié).** `RailSpacing`, `TrajAzimuth`, `RailType`, `Success*`, `PK`. `RailType` dirait d'avance les cuts hors U50 que `context()` refuse en erreur (`adapter-page.js:88`). `Success*` n'a jamais été relevé. À inventorier une fois tous les champs d'une ligne : une raison d'échec ou un compte de points de l'extracteur serait l'étiquette de zone la moins chère qui soit (supposé : on ne sait pas s'ils existent).

9. **Le corps du PUT porte `RailOrientationLeft/Right` (radians, symétrique ±) et `RailType` (mesuré).** ESV calcule une orientation de rail à chaque validation ; rien dans `src/` ne la lit. Orientation par cut gratuite pour la courbure et un contrôle du repère profil ; champ à suivre dans l'empreinte du contrat.

10. **`RailSpacing` recalculé côté serveur ? (supposé).** Si ESV le recalcule à partir des bords écrits, la ligne relue après une écriture est un contrôle d'écartement serveur gratuit et la preuve d'enregistrement que D3 réclame. Une seule écriture observée suffit à le savoir.

11. **Potree : statut et durée des chargements de nœuds non relevés (vérifié).** ~3 nœuds nouveaux et 1,1 Mo par cut ; `PerformanceObserver` (`esv-observer.js:310`) compte et pèse seulement. L'hypothèse D-109 (compteur `numNodesLoading` qui ne redescend plus, peut-être un nœud en échec jamais décrémenté, supposé d'après Potree 1.8) est invérifiable avec les exports actuels ; `responseStatus` de `PerformanceResourceTiming` (Chrome ≥ 109) la rendrait vérifiable **en une ligne**, en 4.9.5. Et `numNodesLoading` seul n'est pas fiable : sur 5 pages sur 7, 0 % de lectures au signal au-delà de 10–15 min de page, quand une page l'a gardé 20 min (`tools/signal-age.cjs`).

12. **`fetch` n'est pas enveloppé (vérifié, `esv-observer.js:15`).** Une mise à jour d'ESV qui passerait ses écritures par `fetch` rendrait D3, B1 (fraîcheur) et la preuve d'écriture muets sans erreur visible : le compteur `fetch-rails` doit déclencher un avis dès qu'il devient non nul. Plus largement : une **empreinte du contrat** à « Connecter » (six boutons et titres, classes de rail, écouteurs par événement, version jQuery, champs d'une ligne, version Potree) comparée à celle de la version livrée, avis avant tout lot : 0,5 jour, lecture seule (esv-10 ; `tools/esv-contrat-releve.js` est sur la branche de la maquette, à rapatrier).

13. **Compteur « N on M treated » (mesuré).** Lisible sur 515/515 relevés, `objetsRail` = 2 partout, aucun texte « M cuts » jamais vu : la regex `TOTAL_CUTS` et le cas « plusieurs compteurs » (D-062) n'ont jamais servi ; M = nombre de cuts de la partie confirmé sur quatre parties. Relevé à alléger.

14. **Six boutons de navigation, deux utilisés (vérifié au relevé).** PreviousInvalid, Previous, Validate, Skip, Next, NextInvalid. Ariane n'utilise que NextInvalid et Validate. Visiter un cut vert (contrôle des faux verts, ta méthode « 1 à 2 verts autour d'un rouge ») ou revenir sur un différé est possible côté ESV et jamais essayé sur le vrai serveur ; revalider un vert déclencherait `railPairUpdated('valid')` et la même écriture (supposé, à vérifier au banc). Sans ce chemin, la méthode de l'opérateur n'est pas automatisable quelle que soit la qualité du moteur. Et chaque visite écrit `SeenByOperator`.

15. **Après F5, ESV repart du premier cut non validé de la partie (mesuré).** Ariane y revient par « cut non validé suivant » : 51 navigations sur le test 15 (`batch-rebased-after-reload.pas`, boucle jusqu'à `rafraichirPasMax` 400). Le saut direct (`goToCut`, D-098) existe en lecture seule et a été vérifié au banc sur ses deux chemins, jamais branché sur `retablirApresRechargement` ni sur « Reprendre » : 1 jour, repli automatique sur la marche.

16. **Le vrai Potree n'a jamais été mesuré ailleurs que chez toi.** La maquette (0,3 mm sur 515 cuts) prouve la pose, pas le chargement ; la seule copie du vrai code ESV + Potree (banc B) est hors dépôt, « durabilité non garantie » (AUDIT_ESV_LOCALE § 2, § 9). Tant qu'elle n'est pas à l'abri, aucune preuve automatique sur un vrai Potree n'est possible (idées 10 et 11).

17. **La pose de départ d'un cut invalide est un gabarit, pas une mesure (mesuré).** Écartement 1 499 à 1 501 mm sur 90 % des cuts ; « ExtractionStatus invalid » signifie « extraction absente », pas « extraction fausse » ; le rail le plus déplacé finit à 76–97 mm (médiane) de cette pose. Donc « pose de départ 44 mm » (D-098) compare à un repère vide, et la fenêtre de recherche ±80 mm (`searchY .08`) est centrée sur ce repère vide : l'écart aux voisins validés est connu avant même de charger le cut (idée 9 (4)).

18. **La vue n'est pas une donnée d'Écho (vérifié).** Orbite consigne la caméra à chaque capture (`adapter-page.js:142`, `cameraMovedDuringRead` `:241`) ; la référence humaine d'Écho (`native-session.js:215`) ne porte que les rails. La caméra au moment du VALIDATE (où tu regardes, à quel zoom) n'est jamais enregistrée alors que B2 doit choisir une vue. 1 jour, passif, +0,2 Ko par état ; lève aussi AM-12 (« vu et jugé bon » contre « pas regardé »), que le drapeau `SeenByOperator` déjà en table peut aussi servir.

19. **Classification des points : seulement 1 et 2 (mesuré).** Aucune classe « rail » côté ESV. En revanche l'**intensité** est dans chaque nœud, conservée par l'export allégé (D-091, contrairement à ce qu'une fiche affirmait), et discrimine le champignon : rapport médian 0,72 entre la bande posée et le reste de la fenêtre sur 221 rails, mais 20 % des rails > 1,5. Trait possible du score de doute, à mesurer sur les Échos (1,5 jour) ; pas plus.

---

## 3. Idées écartées et pourquoi

- **metier-4, mode « Revue » (Ariane pose sans valider, tu juges d'un geste)** : vrai gain potentiel sur ton poste le plus lourd, mais modifie la scène d'ESV sans validation, touches au sens non confirmé (U3), 6 jours sous-estimés ; la variante « afficher l'hypothèse dans le bandeau sans toucher la scène » est acceptable mais c'est une autre idée, à reprendre avec l'idée 8.
- **fiabilite-9, relire les nœuds du cache LRU de Potree** : exige de dégeler `vendor/lidar.js`, nœuds LRU peut-être plus grossiers, hypothèse non vérifiée ; l'idée 10 pose la même question sans ce risque.
- **donnees-7, test de point fixe** : le moteur est déterministe (65/69 motifs identiques au rejeu), signal probablement nul ; à tenter seulement comme trait de doute.
- **dehors-8, calibration conforme des seuils** : bonne règle pour « se régler seule », mais n'existe qu'au-dessus d'un score de doute et avec quelques centaines de rails par séance la garantie sera large ; fait partie du GCV2 prévu.
- **cerveau-4, GCV2 comme classeur de cellules du pool** : c'est la forme concrète du GCV2 déjà prévu (AUDIT_SUPER_CERVEAU § 7, A1) ; constat utile (111/235 rails abstenus ont une cellule STRONG écartée par `RATIO` 1,5) ; 10 jours et ≥ 500 corrections : dépend d'abord des idées 1 et 7.
- **cerveau-5, recherche de couple pour ADV** : seule idée qui attaque l'ADV par le moteur, mais KI-032/037 et D-033 la connaissent, aucun cut ADV étiqueté dans les exports, 19 + part de 22 cuts sur 399 : attend tes numéros de cuts ADV (question 4) et l'idée 12.
- **donnees-4, biais vertical par partie appris** : fidèle au point D, mais 2-3 mm en vertical ne changent presque rien à tes reprises, et un biais appris sur une zone appliqué à toute la partie est une erreur silencieuse ; dépend des étiquettes de l'idée 1.
- **dehors-6, modèle de voie global sur les 94 % de valides** : D-098 a mesuré que la régression sur plusieurs voisins fait moins bien que les deux plus proches ; l'idée 9 obtient la graine avec la fenêtre ±5 déjà en place ; le résidu comme détecteur de faux verts est repris dans l'idée 12.
- **dehors-3, continuité du dévers entre cuts** : signal vertical gratuit (27 % des paires consécutives > 8 mm) mais une erreur verticale de quelques mm déclenche rarement une reprise ; trait du score de doute (idée 8), pas un chantier ; vérifier d'abord que la pose de départ met les deux rails à la même hauteur.
- **dehors-7, apprentissage actif (relire dans l'ordre du doute)** : bon, mais rompt la passivité d'Écho et dépend de `goToCut` non vérifié sur ESV ; la partie mesure (AUC des signaux) est reprise dans l'idée 8, le reste attend la jointure C-03.
- **fiabilite-3, reprise automatique des pauses techniques** : 3 séances sur 4 finies en pause nécessitant un clic, mécanique présente, mais contredit la décision de direction du 27/09 (D-058) ; c'est une décision à te soumettre (question 8), pas un chantier à lancer.
- **fiabilite-7, fiche « santé de la page »** : relevés utiles pour comparer les séances (D-107/108 avaient confondu ESV et Ariane), aucun cut gagné sans la règle d'action, refusée en version automatique ; relevés (1)-(2) à glisser en 4.9.5 (1 jour).
- **fiabilite-2, fin de chargement par réseau + nœuds** : `PerformanceObserver` ne voit une ressource que finie, `fetch` non enveloppé : « N requêtes en vol » n'est pas mesurable ; reste un silence réseau proche du repli 800 ms. Le diagnostic « compteur bloqué 3 cuts de suite » est repris en § 5.
- **esv-6, prédicat par nœud Potree** : repose sur une lecture de Potree 1.8 non vérifiée ; sa partie (a) (`responseStatus`) est en § 2.11 et § 5.
- **fiabilite-4 et fiabilite-5** : déjà prévus (D-098, D3) ; ce qui manque est en § 2.5 et § 2.15 et § 5.
- **fiabilite-6, alléger le journal** : `phase-timing` = 42 à 50 % des octets (20 674 événements sur 36 994 sur un lot) ; vrai, utile pour que tu envoies tes exports, sans effet sur les poses : en § 5.
- **esv-9, esv-10, donnees-5** : petits et justes, repris en § 2.2, § 2.12, § 2.6 et § 5.
- **donnees-6, caméra de l'opérateur en Écho** : repris en § 2.18 ; valeur indirecte avant B2.
- **metier-5, contrôle en ombre des verts voisins d'un rouge** : c'est ta méthode en lecture seule, mais navigation vers des cuts verts jamais essayée sur ESV, ~50 min par partie sans ciblage, chaque visite écrit `SeenByOperator` : attend l'idée 12 et ta réponse (question 6).
- **fiabilite-1, fiabilite-8, donnees-8** : ce ne sont pas des idées 5.0 mais le socle : § 5.

---

## 4. Questions à l'opérateur

Seulement celles qui changent une décision.

1. **Export des bords monde (idées 1, 6, 9).** Le journal exporte déjà les corps d'écriture avec les six bords monde. Acceptes-tu qu'Ariane garde localement, par partie, les bords qu'elle a écrits, et exporte un instantané compact de la liste ? Cela dépasse D-096 (« sans rien stocker d'autre »). Sans oui, les idées 1 (étape 2), 6b et 9 (2) tombent.
2. **Trace dans ESV (§ 2.2, § 2.3).** Tes collègues voient dans ESV des cuts « vus par un opérateur » qu'aucun humain n'a regardés (les différés d'Ariane) et des poses d'Ariane marquées `TreatedByOperator`. Faut-il une marque distinctive, ou l'acceptes-tu tel quel ? Cela change si la 5.0 peut visiter des verts (idée 12, metier-5). **Répondu (D-114) : aucune marque distincte ; la trace doit rester exactement celle d'un traitement humain.**
3. **Toucher D-044 et ré-épingler le moteur (idées 2, 5).** Si la mesure sur les Échos montre que la garde de paire refuse des corrections justes et que la porte de pente écarte des rails justes, acceptes-tu de changer le domaine du calage (8 → plafonné ou 12 mm) et de ré-épingler `geometry-candidate-v1.js` (D-095 point 4) ?
4. **Numéros de cuts d'un ADV et d'un PN connus (idée 12, cerveau-5).** Sur une partie dont tu as l'export : sans cela, « 1480 mm en ADV » et la signature de crêtes restent des hypothèses.
5. **10 minutes de console sur le vrai ESV (idée 11, § 2.8, § 2.10).** Charge utile et moment des cinq événements jQuery ; valeurs de `Success*` et `RailSpacing` sur une ligne valide et une invalide ; est-ce que `RailSpacing` change après une validation d'Ariane ? L'outil de relevé en lecture seule existe. **Accepté (D-114) : « oui allons-y ».**
6. **Visiter des cuts verts (idée 12, metier-5).** Acceptes-tu qu'Ariane navigue sur des cuts valides, en lecture, pour contrôler les verts voisins d'un rouge, sachant que chaque visite écrit `SeenByOperator` ?
7. **Un Écho sur une des parties des tests 15 à 17 (idée 9).** Les 241 décisions hypothétiques de B1 déjà consignées ne sont jugeables que si tu relis l'une de ces parties en Écho (ou si l'idée 1 étape 1 permet de les retrouver dans la liste après ta relecture).
8. **Reprise automatique bornée après F5 / veille / redémarrage (fiabilite-3).** Le refus du 27/09 portait sur un rafraîchissement automatique ; une reprise automatique en liste blanche (page rechargée, lecture instable, redémarrage sans pose en cours, au plus 3 par lot) est-elle acceptable ? Sans oui, un lot ne survivra jamais seul à un F5.
9. **Protocole de relecture (idée 1).** Quand tu relis une partie après Orbite, relis-tu tous les cuts posés par Ariane ou seulement une partie ? « Inchangé » ne vaut « confirmé » que dans le premier cas.

---

## 5. Socle 4.9.5 nécessaire avant la 5.0

Ce qui doit être prêt, sans quoi les idées ci-dessus ne peuvent être ni mesurées ni prouvées.

**Preuve et banc**
- La maquette ESV dans la branche de livraison et dans `verify` (fiabilite-1) : `tests/esv-maquette` est absent de T951, `verify.cjs` dit lui-même `realESV: NOT_EXECUTED`, le CI ne tourne que sur une vieille branche. Deux niveaux : rejeu court (~40 cuts de 3 exports, échec si une issue change ou une pose bouge de plus de 1 mm) à chaque `verify` ; rejeu complet d'un export réel avant chaque paquet, comparé à la version précédente. Sans cela, chaque chantier 5.0 (idées 2, 4, 5, 9) ne sera jugé que par une séance de toi. ~4 jours, conflit de fusion possible sur `tools/verify.cjs`, Chromium dans l'environnement (saut explicite sinon).
- Campagne de pannes exécutable (fiabilite-8) : service worker arrêté en pleine capture / pose / validation, F5 à chaque étape, 500 puis 204, 502 relancé par ESV, nuage vide, onglet caché. Condition pour laisser Ariane seule. ~3 jours.
- Manifeste DEV/HOLDOUT par partie et promotion `usableForTraining` (donnees-8 ; CORPUS_V2 § 5 « reste à produire ») : tous les enregistrements sont `usableForTraining:false` et aucun outil ne fait la revue. Sans partition, GCV2 sera réglé sur des parties consommées.
- Sauver le banc B (vrai code ESV + Potree) : seule preuve possible pour les idées 10 et 11.

**Écho parfait et jointure**
- AM-01/AM-03 (pose de départ et référence fiables) : condition des idées 3, 4, 5, 7.
- Jointure Écho ↔ Orbite par cut (AUDIT_ECHO C-03), outil hors ligne : condition des mesures des idées 1, 2, 3, 5, 8. C'est le premier outil à écrire : une dizaine de mesures en dépendent.
- D3 tolérant la relance d'ESV (§ 2.4) et 204 observé → `serverConfirmed:true`, refus en attente dans `chrome.storage.session` (§ 2.5).

**Petits relevés en lecture seule, à glisser dans la 4.9.5 (chacun ≤ 0,5 jour)**
- `responseStatus` et durée des ressources ept-data (§ 2.11) : rend D-109 vérifiable.
- `flushPct` du lecteur PN consigné à chaque cut (idée 12).
- Profondeur des nœuds lus et `getPointBudget()` par capture (idée 10).
- Champs de liste gardés dans `addRows` : `RailSpacing`, `TrajAzimuth`, `RailType`, `Success*` (idée 12), et inventaire complet d'une ligne.
- Diagnostic « `numNodesLoading` identique > 0 sur 3 cuts de suite » (compteur bloqué).
- Avis si `fetch-rails` devient non nul ; empreinte du contrat à « Connecter » (§ 2.12).
- Écouteurs jQuery en ombre, charge utile brute (idée 11).
- Caméra au VALIDATE dans l'état observé d'Écho (§ 2.18) ; navigateur, GPU, mémoire dans l'export (fiabilite-7).
- Calibration de T sur la pose de départ (idée 6a) avec l'activation de B1.
- Règle « ne pas revisiter un différé sans source nouvelle » dans B3 (idée 9 (1)).
- Δ validés serveur contre validations d'Ariane au F5 (§ 2.6).

**Hygiène des exports**
- Replier `phase-timing` par visite à l'export (fiabilite-6) : −40 % sur le journal, c'est l'objectif 8c renvoyé à la 4.9.5 par D-110 sans que ce poste ait été nommé ; filtrer les événements Écho du journal Orbite (KI-068).
- Exports conservés par toi (D-097), avec version et date, pour toutes les parties relues.

**Documents à corriger**
- AUDIT_SUPER_CERVEAU § 1 (le delta publié est la graine, pas l'intersection).
- FICHE_B1 constat 3 (appariement établi à 0 mm).
- D-110 (2 refus sur ~3 500 écritures, relancés par ESV).
- Fiche intensité : le mode allégé la conserve (D-091).

---

## Annexe. D'où viennent les différés aujourd'hui (4 lots 4.9, 399 différés)

| Cause | Part | Preuve |
|---|---:|---|
| Un rail sans point de flanc, dessus riche (37 à 44 lignes) | 114 (29 %) | porte `src/geometry-candidate-v1.js:219` (`!face||faceCount<minFace`), flanc partiel ≥ 3 points (l. 203), `lot-decision.js:510 minFace:3` ; dans 212 des 235 rails abstenus pour flanc, le rail opposé est candidat |
| Pente du flanc « hors domaine » estimée librement sur 7 à 11 points | 70 (18 %) | `robustLine` (`geometry-candidate-v1.js:12-21`) ; le delta publié est la graine du gabarit (l. 231), la pente ne sert qu'à refuser ; D-035 : 6/7 jugés justes |
| Garde de paire (D-044) : décalage de convention entre 8 et 12 mm | 79 (20 %) | `lot-decision.js:619-626`, `placement-convention.js:417 maxShiftMm:8` ; 107 décalages relevés : médiane 9,2 mm, max 12,1 mm ; garde justifiée à l'origine par 2 cuts |
| Paire hors contrat avec deux candidats, ambiguïté | 19 + 22 | `gcv1-shadow.js:467-499` : rails résolus séparément, paire seulement contrôlée ; KI-032, KI-037 (ADV, contre-rail) |
| Sans appui (`no-anchor`) | 326 sur 470 | B1 en ombre aurait décidé sur 239 (51 %), justesse non mesurée |

Densité : 78 à 94 points par tête de rail quelle que soit l'issue (≈ 40 sur le dessus, 0 à 10 sur le flanc). Le lecteur ne lit que les nœuds déjà chargés pour la vue (`vendor/lidar.js:178`) ; profondeur LOD et `viewer.getPointBudget()` jamais consignés : famine du nuage ou du niveau de détail, on ne sait pas.
