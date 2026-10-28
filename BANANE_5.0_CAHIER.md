# ARIANE 5.0 — CAHIER DES CHARGES

Version 1 du 15 octobre 2026, soumise à la signature de l'opérateur. Rédigé par l'orchestrateur à partir de D-112 à D-116, de `fiches/IDEES_5.0.md` (seconde récolte, six angles, trois juges), de `fiches/METHODES_METIER_5.0.md`, des audits Écho et ESV locale et des quatre lots de terrain 4.9 (tests 15 à 17). Français simple. Aucune donnée de partie ni identifiant de projet.

Statut : **projet de cahier**. Il devient signé quand l'opérateur écrit « signé » ; les décisions ultérieures sont consignées dans `DECISIONS.md` et remplacent le texte sans le réécrire (règle de la 4.9).

---

## 1. Ce que la 5.0 doit changer pour l'opérateur

Trois attentes, formulées par l'opérateur (D-112), et ce qu'on mesurera :

| Attente | Aujourd'hui (4 lots 4.9, 1 892 cuts proposés) | Cible 5.0 | Mesure |
|---|---|---|---|
| **A. Poser juste plus souvent** | 1 520 posés, 399 différés (21 %) ; taux de faux verts jamais mesuré | différés ≤ 10 % ; faux verts mesurés sur chaque partie relue et en baisse | relevé de la liste après relecture (E1) ; perf-v3 |
| **B. Traiter seule les zones difficiles** (ADV, PN, voisinage des rouges) | zones non détectées ; méthodes métier non codées ; 326 différés « sans appui » | zones détectées avant le lot ; marges métier appliquées ; cuts en zone posés ou différés avec la raison « zone » | carte de la partie (M1) ; Écho sur les zones |
| **D. Apprendre des corrections sans réglage manuel** | Écho capture 22 corrections rejouables sur 91 ; Ariane ne consigne pas ce qu'elle aurait posé | chaque relecture de l'opérateur devient des centaines d'exemples ; GCV2 réglé sur des parties d'apprentissage, jugé sur des parties réservées | manifeste de corpus ; métriques du banc |

**Règle de l'opérateur (D-116)** : tous les chantiers ont la **même importance**. L'ordre ci-dessous n'est qu'un ordre de dépendances techniques (ce qu'il faut mesurer avant de construire), jamais un ordre de valeur. Les **méthodes métier** sont d'importance n° 1 ou 2 dans la réalisation : elles ont leur lot propre (M).

Deux cerveaux en parallèle (D-116) : **combler les lacunes du super cerveau actuel** (lot P) pendant qu'on **conçoit le méga cerveau GCV2** (lot G).

---

## 2. Règles non négociables

Reprises de la 4.9 (`BANANE_4.9_CAHIER.md` § 2.2), inchangées : `src/engine.js` épinglé ; deux rails ou rien ; aucune validation ni SKIP automatique d'un cut non résolu ; écartement [1405, 1470] mm en admissibilité seulement, jamais une cible ; parties de validation jamais utilisées pour régler ; pas de reset, force push, fusion dans main, étiquette ni publication sans accord explicite de l'opérateur ; `node tools/verify.cjs` à 0 avant chaque commit ; aucun identifiant de modèle, aucune capture ni code d'ESV dans les dépôts ; essais courts.

Ajoutées pour la 5.0 :

1. **Trace dans ESV identique à celle d'un humain** (D-114). Ariane n'écrit jamais elle-même sur le serveur : elle déclenche les commandes d'ESV. Aucune marque distinctive. Toute nouvelle action (visite d'un vert, saut direct) est d'abord relevée sur la maquette puis acceptée par l'opérateur.
2. **Écho reste passif** : aucune commande, aucun changement de caméra ou de budget Potree pendant une session Écho.
3. **Toute pose nouvelle passe par trois états** : hors ligne (banc, rejeu d'exports) → ombre sur le terrain (décision consignée, rien posé) → actif. Porte d'activation : **0 mauvaise pose ajoutée** sur les Échos et les relectures disponibles, rejeu des quatre lots 4.9 sans régression.
4. **Parties d'apprentissage et parties réservées** séparées par un manifeste (E4). GCV2 ne voit jamais une partie réservée.
5. **Données privées** : exports, bords monde, adresses, identifiants restent chez l'opérateur et dans le scratchpad ; le dépôt ne porte que des comptes, des millimètres et des numéros de cuts.
6. **Mémoire locale des bords écrits** (E1 étape 2) : au-delà de D-096 (« sans rien stocker d'autre »), **demande un accord explicite de l'opérateur** (question 1).

---

## 3. Périmètre

**Inclus** : lots M, P, E, G, F ci-dessous ; B2 (caméra), V4 (comparaison V4.6 à la demande, état de préparation de D-095), C4 retravaillé (D-085), méthodes métier, interpolation entre voisins (D-098 à D-100), les 12 idées de `fiches/IDEES_5.0.md`.

**Retiré** (D-112) : « plusieurs sessions, onglets et parties ». **À trancher** (question 9 de D-112) : Orbite et Écho en même temps ; recommandation de l'orchestrateur : non en 5.0, car cela exige des états séparés par onglet (c'est le multi-onglets retiré) et contredit « un seul onglet ESV pendant Écho ».

**Préalable** : le socle 4.9.5 (§ 4). Aucun chantier 5.0 qui pose n'est activé avant que le banc du § 4 tourne.

---

## 4. Socle 4.9.5 (préalable, en cours)

| # | Élément | État au 15 octobre | Reste |
|---|---|---|---|
| S1 | Écho parfait : toutes les validations, dernière référence, pose de départ, reprise après F5, export en volumes, écritures jointes | fait en 4.9.0.18 → .20 (branche `claude/49-echo-corrections`) | fusion en **4.9.5 test 2** (en cours), séance terrain, Ctrl+Entrée et Ctrl+flèche à observer |
| S2 | D3 écriture refusée (sans attente, tolérant la relance d'ESV) et diagnostic du signal de fin de chargement (D-109) | 4.9.5.1 | fusion en 4.9.5 test 2 ; séance 30 min sans F5 puis F5 |
| S3 | Jointure Écho ↔ Orbite par cut, hors ligne (AUDIT_ECHO C-03) | à écrire | **premier outil** : une dizaine de mesures du lot P en dépendent |
| S4 | Maquette ESV dans `verify` (rejeu court ≈ 40 cuts à chaque verify ; rejeu complet avant chaque paquet) ; campagne de pannes exécutable | maquette sur `claude/esv-locale-audit`, hors verify | ~4 + 3 jours |
| S5 | Banc B (vrai code ESV + Potree, privé) sauvé dans `banane-banc` | hors dépôt, durabilité non garantie | à faire par l'opérateur avec l'orchestrateur |
| S6 | Petits relevés en lecture seule (≤ 0,5 j chacun) : `responseStatus` des nœuds, `flushPct` par cut, profondeur des nœuds et budget de points, champs de liste gardés (RailSpacing, TrajAzimuth, RailType, Success*), compteur bloqué, avis `fetch-rails`, empreinte du contrat ESV, écouteurs jQuery en ombre, caméra au VALIDATE, T calibrée sur la pose de départ, « ne pas revisiter un différé sans source nouvelle », Δ validés serveur au F5 | à faire | regroupés en une ou deux versions de test |
| S7 | Hygiène des exports : `phase-timing` replié (−40 %) ; filtrage Écho hors journal Orbite | KI-068 corrigé en .18 | repli à faire |
| S8 | Documents à corriger : AUDIT_SUPER_CERVEAU § 1 (graine, pas intersection), FICHE_B1 constat 3, D-110, fiche intensité | à faire | 0,5 j |

**Porte 4.9.5 → 5.0** : S1 à S4 et S6 livrés et vérifiés sur le terrain ; S3 produit sa première table (Écho 17/18/20 joints aux lots Orbite).

---

## 5. Chantiers 5.0

Chaque chantier : but, source (idée ou décision), dépendances, livrable, **porte de sortie** (critère mesurable), coût estimé en jours d'agent. Même importance pour tous.

### Lot M — Méthodes métier (importance n° 1 ou 2)

**M1. Carte de la partie avant le lot** (idée 12 ; METHODES_METIER § 4.1). Lire la table entière de la liste d'ESV (lecture seule, quelques ms) : écartement des lignes valides, écart de chaque ligne à l'interpolation de ses voisins ±3, longueur des séries de rouges, azimut local, type de rail. Côté nuage : profil latéral sur ±0,4 m, nombre de crêtes (≥ 2 = ADV candidat). Sortie : zones (ADV candidat, PN, série de rouges, vert suspect) et marges métier (§ 1 de la fiche). Dépend de S6 (champs gardés, `flushPct`), des numéros de cuts ADV/PN connus de l'opérateur (question 3). Porte : sur les Échos disponibles, les verts corrigés par l'opérateur sont « suspects » dans la carte à ≥ 70 % ; les ADV connus sont détectés. Coût : 3 j (+2,5 pour la signature nuage).

**M2. Provenance des appuis** (idée 6b). Quatre classes de voisin : extraction (vert jamais vu par un humain), Ariane-séance, Ariane-antérieur (mémoire par partie, E1), humain. Règles : jamais chaîner ni interpoler sur ses propres poses non vérifiées ; en zone à risque, appuis humains seulement. Porte : rejeu des b1-ombre par classe sans perte de bonne décision ; 0 propagation d'un faux vert mesurée sur Écho. Coût : 2 j (+1 j pour T calibrée dès le premier cut, S6).

**M3. Méthodes par zone**. À partir de la fiche § 1 et de M1 : en voie courante, interpolation ±3 (D-098 à D-100) seulement hors zone ; en série de rouges, toute la série puis 2 à 3 verts de chaque côté revérifiés ; en ADV, marge avant la pointe et après l'appareil (nombre à fixer avec l'opérateur), recherche de couple (idée écartée cerveau-5 reprise ici si M1 détecte l'ADV) ; au PN, lecteur `flushPct` gradué, biais vertical mesuré. Refaire les mesures de D-098 à D-100 **par zone**. Porte : sur les Échos par zone, erreur médiane ≤ 5 mm en voie courante, méthode ADV/PN mesurée (pas de cible chiffrée avant les premières mesures). Coût : 4 j de mesure + 4 j de code.

**M4. Seconde passe utile** (idée 9). (1) Ne revisiter un différé que si une source nouvelle existe (règle B3, S6). (2) Mémoire par partie des cuts posés en monde, relue au lot suivant et après F5 ; reprise des différés offerte aussi après un arrêt par F5. (3) En reprise : prédiction encadrée des deux côtés, relance du moteur depuis cette prédiction, interpolation seulement si le moteur s'abstient encore. (4) Au premier passage avec ≥ 2 appuis cohérents : moteur lancé deux fois (pose ESV et prédiction), accord → pose, désaccord → différé avec les deux. Dépend de M2, E1 étape 2 (accord, question 1). Porte : taux de re-différé < 20 % (66/68 aujourd'hui) ; 0 mauvaise pose ajoutée sur Écho. Coût : 0,5 + 3 + 2 à 4 j.

**M5. Visiter des verts en lecture** (metier-5, idée 12). Contrôler les verts voisins d'un rouge comme l'opérateur le fait, en lecture seule, ciblé par M1. Dépend de la question 4 (chaque visite marque « vu »). Porte : relevé maquette puis séance en ombre : 0 écriture autre que `SeenByOperator`. Coût : 2 j.

**M6. Liste « poses à relire » et score de doute** (idée 8). À la fin d'un lot : écart aux voisins, écart à la bande d'écartement de la partie, rail repêché par S1, convention refusée, |graine − intersection|, confiance → une section « N cuts à relire » dans le panneau et CONTENU.txt. Porte : sur les relectures de l'opérateur (E1), les cuts corrigés sont dans la liste à ≥ 60 % pour ≤ 5 % des cuts posés. Coût : 2 j (outil hors ligne d'abord).

### Lot P — Poser juste : combler le super cerveau actuel

**P0. Mesures hors ligne d'abord** (idées 2, 3, 5 ; dépend de S3). Sur les Échos 17/18/20 joints : (a) graine contre intersection contre moyenne, par classe de rail ; (b) erreur verticale des rails à convention refusée (410 rails, biais ~9 mm) contre rails calés, amplitude de la correction de l'opérateur sur les 89 cuts 'pair-guard' ; (c) erreur des rails appliqués par tranche de pente brute du flanc. Livrable : une note chiffrée par mesure. Porte : décision écrite pour chacune (changer / ne pas changer). Coût : 1,5 + 1 + 1 j. **Aucun code moteur avant ces notes.**

**P1. Convention refusée et garde de paire** (idée 2). Si P0(b) confirme : décalage plafonné (8 mm appliqués, reste consigné) ou domaine porté à 12 mm ; garde de paire portée par le seul rail repêché, ou marge continue. Touche D-044 : accord de l'opérateur (question 2). Porte : rejeu des quatre lots au banc sans régression ; 0 mauvaise pose ajoutée sur Écho ; ≥ 50 des 89 différés 'pair-guard' récupérés. Coût : 1 j.

**P2. Porte de pente du flanc** (idée 5). Si P0(c) ne montre pas de dégradation : relâcher la borne pour le flanc (gardée pour le dessus et au PN), ou pente calculée sur la seule bande 14 à 30 mm, abstention sur la perte du gabarit. Ré-épinglage du moteur de géométrie (D-095 point 4) : accord de l'opérateur. Porte : idem P1 ; ≥ 40 des 68 différés « pente » récupérés. Coût : 2 à 3 j.

**P3. Rail « dessus seul »** (idée 4). Estimateur pour le rail sans flanc : latéral par le bord intérieur de la bande du dessus, vertical par le 90e centile ; trois preuves obligatoires (dévers avec le rail opposé ≤ 15 mm, écartement 1420–1470 en admissibilité, écart à la voie ≤ 30 mm si appuis) ; statut distinct ; jamais au PN détecté. Module après `gcv1-shadow`, moteur gelé intact. Dépend de P4 (si la famine vient du LOD, remède ailleurs). Porte : erreur ≤ 10 mm sur les 66 rails différés de l'Écho 17 et sur les Échos suivants ; ombre un lot ; 0 mauvaise pose ajoutée. Coût : 5 j.

**P4. Famine de flanc : nuage ou niveau de détail ?** (idée 10). Relever profondeur des nœuds et budget de points (S6) ; au banc B puis en ombre sur un lot, doubler le budget pendant la seule capture et compter les points de flanc gagnés. Jamais en Écho. Porte : réponse chiffrée ; si gain net, pièce réversible du mode rapide combinée à B2. Coût : 2 j.

**P5. Estimateur choisi par classe** (idée 3). Si P0(a) donne un gagnant par classe, le publier pour cette classe ; sinon |graine − intersection| devient un trait de M6. Corriger AUDIT_SUPER_CERVEAU § 1 dans tous les cas (S8). Coût : 1 j.

**P6. B2 caméra et V4** (D-095). B2 : décentrer la vue pour gagner des points de flanc, mesuré par P4 ; V4 : comparaison V4.6 à la demande, repris dans l'état de D-095. Porte : B2 mesuré au banc B avant tout terrain. Coût : 3 j + 1 j.

**P7. C4 retravaillé** (D-085). Règle de qualité de la 4.9 retirée des portes ; à redéfinir à partir des mesures de E1 (faux verts réels) et non d'un seuil a priori. Coût : 1 j après E1.

### Lot E — Écho, données, apprentissage

**E1. Relire la liste après la relecture de l'opérateur** (idée 1). Étape 1 (outil, dès la 4.9.5) : export d'un instantané compact de la table (indice, statut, drapeaux, six bords ; ≈ 0,5 Mo), outil `diff-liste` entre deux instantanés ou avec le journal précédent : par cut, écart latéral/vertical en repère profil, statut, délai. Étape 2 (extension, 5.0, **accord question 1**) : mémoire par partie des bords écrits par Ariane ; à chaque chargement de liste d'une partie connue, événement `ecart-liste` par cut et compteur « corrections constatées ». Protocole de relecture à préciser avec l'opérateur (question 7). Porte : sur un Écho et sa partie Orbite, la correction humaine retrouvée à mieux que 1 mm. Coût : 3 j.

**E2. Ombre GCV1 à chaque visite Écho** (idée 7). À la fin de chaque visite, calculer la proposition qu'Ariane aurait faite depuis la pose ESV, **avant** de lire la référence humaine (frontière anti-fuite), et consigner un bloc compact (delta, motif, confiance, points) puis l'écart à la pose humaine ; y ajouter l'hypothèse B1 et l'interpolation. Porte : le bloc consigné égale le rejeu hors ligne ; +0,8 s au plus par visite hors file. Coût : 2 à 3 j.

**E3. Raison de la correction** (D-112 point 4 ; AUDIT_ECHO C-06). Sur le panneau d'Ariane, après une validation en Écho : quatre pastilles ou touches (rail voisin/ADV, PN, nuage diffus, autre) et « bon tel quel ». Jamais dans ESV. Porte : ≥ 80 % des corrections d'une séance étiquetées sans ralentir l'opérateur (mesure du temps par cut avant/après). Coût : 1,5 j.

**E4. Manifeste DEV / RÉSERVÉ et promotion des exemples** (donnees-8 ; CORPUS_V2 § 5). Par partie : apprentissage ou réservée (rotation D-057) ; outil de revue qui passe `usableForTraining` ; GCV2 ne voit jamais une partie réservée. Porte : manifeste versionné, 0 fuite vérifiée par un essai. Coût : 1,5 j.

**E5. Jeu d'apprentissage et métriques du banc**. `tools/jeu-apprentissage` (existe sur la branche de la maquette) : pose de départ, référence humaine, écart en repère profil, points par rail, voisins, zone (M1), raison (E3). Métriques publiées à chaque version : erreur médiane/P90 par zone, différés par cause, faux verts estimés (M6), 0 mauvaise pose ajoutée. Porte : métriques calculées sur les Échos existants et les relectures E1. Coût : 2 j.

**E6. Caméra au VALIDATE et contexte Écho** (§ 2.18 des angles morts). La vue au moment de la validation entre dans l'état observé (+0,2 Ko) : nécessaire à B2 et lève « vu et jugé bon » contre « pas regardé ». Coût : 1 j.

### Lot G — Méga cerveau GCV2

**G0. Spécification de GCV2 à partir des mesures** (après P0, E1, E2, E5). Forme retenue à l'audit : classeur des cellules du pool de candidats (111 des 235 rails abstenus ont une cellule forte écartée par le ratio 1,5), contexte des voisins (M2, M4), mémoire de la voie, confiance calibrée (abstention apprise), plusieurs hypothèses consignées. Entrées : jeu E5 ; sorties : pose, confiance, raison. Livrable : fiche de conception relue par l'opérateur. Coût : 3 j.

**G1. GCV2 hors ligne puis en ombre**. Entraînement sur les parties d'apprentissage, jugement sur les réservées ; ombre sur au moins deux lots de terrain avec E2 actif. Porte : erreur médiane ≤ GCV1 sur toutes les zones, différés ≤ GCV1, 0 mauvaise pose ajoutée sur les réservées. Coût : 10 j, ≥ 500 corrections disponibles (d'où E1).

**G2. Activation par porte, réversible** (réglage, retour à GCV1 en un clic). Coût : 1 j.

### Lot F — Fiabilité et plateforme

**F1. Bus d'événements d'ESV** (idée 11). Écouteur passif sur les événements jQuery (`railPairUpdated`, `railPairSelected`, `railPairSeen`, `loading`, `newPart`) : d'abord en ombre (S6), puis usages : étiquette Écho indépendante de la touche, clôture de lot immédiate à `newPart`, troisième source du signal de fin de chargement (en ombre à côté de la règle actuelle). Dépend du relevé console de l'opérateur (accepté, D-114). Porte : une séance en ombre sans exception ; concordance ≥ 99 % entre événement et touche sur Écho. Coût : 2 j.

**F2. Banc dans verify et campagne de pannes** (S4, poursuivi) : service worker arrêté en pleine capture/pose/validation, F5 à chaque étape, 500 puis 204, 502 relancé, nuage vide, onglet caché. Porte : la campagne tourne à chaque paquet. Coût : compris dans S4.

**F3. Reprise automatique bornée** (fiabilite-3 ; question 6). Liste blanche : page rechargée, lecture instable, redémarrage sans pose en cours ; au plus 3 par lot. Contredit le refus du 27/09 (D-058) : décision de l'opérateur. Coût : 1,5 j.

**F4. Preuve serveur** (§ 2.5 et 2.6 des angles morts) : 204 observé → `serverConfirmed`, refus en attente dans `chrome.storage.session`, Δ validés serveur contre validations d'Ariane au F5. Coût : 1,5 j.

**F5. Saut direct après F5** (§ 2.15) : `goToCut` branché sur la reprise, repli automatique sur la marche. Coût : 1 j.

---

## 6. Portes de version

- **5.0 test N** : chaque chantier livré en ombre d'abord ; une seule nouveauté active par version de test ; consigne terrain ; export analysé avant la suivante.
- **Activation** d'un chantier qui pose (P1, P2, P3, M3, M4, G2) : rejeu des quatre lots 4.9 au banc sans régression ; 0 mauvaise pose ajoutée sur tous les Échos et relectures disponibles ; différés et erreur médiane publiés par zone (E5).
- **5.0 stable** : lots M, P, E, F livrés ; G au moins en ombre sur deux lots ; métriques E5 publiées ; fusion, étiquette et publication par l'opérateur.

---

## 7. Questions à l'opérateur (changent une décision)

1. **Bords monde en mémoire locale et instantané de la liste** (E1 étape 2, M2, M4) : au-delà de D-096. Oui / non ?
2. **Toucher D-044 et ré-épingler le moteur de géométrie** si P0 le justifie (P1, P2) ?
3. **Numéros de cuts d'un ADV et d'un PN connus**, sur une partie dont j'ai l'export (M1, M3).
4. **Visiter des cuts verts en lecture** (M5), sachant que chaque visite les marque « vus » ?
5. **Un Écho sur l'une des parties 24 à 27** (juge les 241 décisions hypothétiques de B1), ou la relecture E1 de l'une d'elles.
6. **Reprise automatique bornée** après F5, veille ou redémarrage (F3), malgré le refus du 27/09 ?
7. **Protocole de relecture** : relis-tu tous les cuts posés par Ariane ou une partie ? « Inchangé » ne vaut « confirmé » que dans le premier cas (E1).
8. **Orbite et Écho en même temps** : recommandation « non en 5.0 » (§ 3). D'accord ?
9. **Marges métier** : combien de cuts avant la pointe d'aiguille et après la fin de l'appareil (M3) ?

---

## 8. Plan de développement

Détail des rôles, modèles et coûts dans `fiches/ORGANISATION_DEV_5.0.md`. Ici l'ordre et les dépendances. Durées en jours d'agent (un agent = une session de travail bornée), à lisser sur les fenêtres de 5 h de l'opérateur.

| Phase | Contenu | Dépend de | Jours | Versions |
|---|---|---|---|---|
| **0. Socle** (en cours) | S1+S2 → 4.9.5 test 2 ; S3 jointure ; S6 relevés ; S7 ; S8 | — | 1 + 2 + 3 + 1 + 0,5 | 4.9.5 test 2, test 3 |
| **1. Banc** | S4 maquette dans verify, campagne de pannes ; S5 banc B sauvé | 0 | 7 | 4.9.5 test 4 |
| **2. Mesures** | P0 (a, b, c) ; E1 étape 1 ; M6 outil ; E5 métriques | S3 | 3,5 + 1,5 + 1 + 2 | aucune (outils) |
| **3. Écho et données** | E2, E3, E6, E4, F1 ombre | 0, 1 | 2,5 + 1,5 + 1 + 1,5 + 2 | 5.0 test 1, test 2 |
| **4. Métier et appuis** | M1, M2, M3 mesures par zone, M4 (1)(2), M5 (si oui), E1 étape 2 (si oui) | 2, 3, questions 1, 3, 4 | 5,5 + 3 + 4 + 3,5 + 2 + 2 | 5.0 test 3, test 4 |
| **5. Poser juste** | P1, P2, P5 (selon P0) ; P4 ; P3 ; P6 ; P7 | 2, 1, question 2 | 1 + 2,5 + 1 + 2 + 5 + 4 + 1 | 5.0 test 5 à test 7 |
| **6. Méthodes actives** | M3 code, M4 (3)(4), M6 panneau | 4, 5 | 4 + 5 + 1 | 5.0 test 8, test 9 |
| **7. Méga cerveau** | G0, G1 (ombre), G2 | 2, 3, 4, ≥ 500 corrections | 3 + 10 + 1 | 5.0 test 10 à test 12 |
| **8. Fiabilité** | F3 (si oui), F4, F5, F1 usages | 1 | 1,5 + 1,5 + 1 + 1 | répartis |
| **9. Stable** | portes § 6, documents, publication par l'opérateur | tout | 2 | 5.0 |

Total : environ **95 jours d'agent**, dont une quinzaine de pure mesure hors ligne. Les phases 2, 3 et 8 avancent en parallèle de 1 ; 4 et 5 en parallèle entre elles ; 7 commence quand E1 a produit assez de corrections, pas avant.

Rythme attendu : une version de test tous les deux à trois jours de terrain de l'opérateur ; un cycle « export → analyse → version suivante » ne doit pas coûter plus d'une demi-fenêtre de 5 h à l'orchestrateur.

---

## 9. Ce qui n'est pas dans ce cahier

Multi-sessions, suivi mobile (5.5 éventuelle), toute écriture directe sur le serveur d'ESV, toute modification de `src/engine.js` hors correctif de défaut avéré avec ré-épinglage accordé.
