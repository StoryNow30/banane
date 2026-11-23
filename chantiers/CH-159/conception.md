# CH-159 — Conception : cas particuliers de relecture (saut borné avec inspection des voisines) et seuil de qualité de 10 % par portion

**Tronc** : `ariane6` · **Branche** : `chantier/CH-159` · **Base** : `050cb2cd` (après CH-158 / bêta 2) · **Phase** : **Implémentation** (décisions d'opérateur verrouillées en **D-382**, 23/11/2026).

---

## 0. Décisions opérées (23/11/2026, D-382) — écarts obligatoires avec la conception initiale

L'opérateur a tranché les six questions ouvertes du § 7 le 23/11/2026 (**D-382**). L'implémentation suit les signaux et l'algorithme d'inspection des voisines décrits aux § 3 et § 4 avec les quatre écarts obligatoires suivants par rapport aux recommandations initiales :

1. **Choix 1C retenu (au lieu du Niveau A seul) — Envoi d'un vrai SKIP à ESV sur saut borné confirmé (révise D-241)** :
   - Lorsqu'un saut borné (cas 1 à 4) est confirmé dans les bornes ($M = 2$ voisines saines de chaque côté, $1 \le k \le K_{\max}$), Ariane envoie un vrai SKIP à ESV via `adapter.skipAndNext`, **uniquement** après passage des cinq gardes obligatoires (`peutEnvoyerSkipBorne`), et **jamais sur un vert déjà validé dans ESV (`valid`, verrou anti-vert-validé)**.
   - Le Niveau A (abstention sans envoi de commande SKIP, exclusion de `ctx.chaine` et consignation) reste le repli dès qu'un saut n'est pas confirmé ou que la coupe est déjà `valid` dans ESV.
2. **Choix 2A retenu (au lieu d'une abstention systématique) — Cas 5 (deux scanners / rail poli) en relecture seulement** :
   - En relecture seulement, Ariane pose d'après la sous-nappe non déformée identifiée par géométrie (séparation de sous-nappes, `rawDelta`, accord avec le rail opposé + écartement de référence, continuité avec les voisines saines, fidélité au gabarit U50), sans modifier `src/placement-convention.js` ni le moteur du lot.
   - Si les sous-nappes ne peuvent pas être départagées de façon fiable, Ariane s'abstient (pas de SKIP, pas de correction inventée) et journalise.
   - Les attributs de couleur (`rgba`, `color`, `rgb` copiés avec leurs 3 ou 4 composantes) et de source (`pointSourceID`, `pointSourceId`, `source`, `chain`, `chainId`, `chainID`, `scannerId`, `scannerID`) sont ajoutés au lecteur LiDAR (`vendor/lidar.js`, `vendor/lidar-rust.js`, `tests/lidar.js`) pour les prochaines captures et servent en appoint journalisé s'ils sont présents.
3. **Bornes verrouillées ($M = 2$, $K_{\max} = 4 / 5 / 4 / 6$)** :
   - **$M = 2$ voisines saines** de chaque côté (et non $M = 3$ dans le tampon amont).
   - $K_{\max} = 4$ (lacune de cœur d'aiguille), $K_{\max} = 5$ (nappes séparées), $K_{\max} = 4$ (rail invisible), $K_{\max} = 6$ (décalibration). Au-delà de $K_{\max}$ sans réapparition d'un rail normal : **ne pas sauter**, reprendre coupe par coupe (`reprendre-coupe-par-coupe`).
4. **Portions fixes de 10 000 ER ($1\text{ ER} = 1\text{ coupe}$), définition d'échec et passage à la partie suivante sur dépassement de 10 %** :
   - Découpage en tranches fixes par partie d'au plus $10\,000$ ER ; taux calculé sur **toutes les coupes** de la portion (y compris celles non visitées).
   - Un **échec** est une coupe de la portion qui, à l'issue de la relecture de cette portion, reste non résolue : encore différée (`defer` encore ouvert), ou correction de relecture refusée ou en erreur (écriture / validation non confirmée). Ne sont **pas** des échecs : un SKIP borné confirmé (transmis ou décidé), une abstention de critère, une correction acceptée et confirmée, un cut déjà validé laissé tel quel.
   - Si une portion dépasse $10\,\%$ d'échecs : **arrêter le reste de la partie courante et passer à la partie suivante** par le chemin existant (`src/file-parties.js` / `changerPartie`), en journalisant le motif `qualite-portion`.

---

## 1. Confirmation de l'état actuel du code (ÉTABLI)

La relecture intégrale des fichiers du produit confirme point par point l'état des lieux du ticket, sans élargissement implicite :

1. **`src/relecture-ombre.js` — `skipOmbre` (l. 266–276, D-172)** :
   - La fonction `skipOmbre(captures, { min = 2 })` lit `capture.quality.perRail` (si les comptes `left` et `right` sont des entiers) ou à défaut `capture.pointsSceneRelative.length`.
   - Elle ne rend `raison: 'aucun-point'` que si au moins `min` captures complètes de suite (`2` par défaut) ont **`total === 0`** (aucun point ni à gauche ni à droite). Si un seul rail a 0 point et l'autre a des points (`left: 0, right: 12`), `total > 0` et `raison` vaut `null` (vérifié dans `tests/relecture-ombre.test.cjs` l. 133).
   - Elle ne rend **jamais** `'un-scanner'` : tous les scanners arrivent fusionnés dans un seul nuage Potree d'ESV (`cloud-0`), et les captures d'ESV ne portent que `intensity` et `classification` dans `attributes` (ni `pointSourceID` ni `scannerId` ; `pointSources` contient `[indiceNoeudOctree, indicePoint]`).
   - **Consigné seulement** : dans `background.js` (l. 4492–4515), une première capture vide déclenche une seconde capture, `skipOmbre` est noté dans l'événement `relecture-ombre`, et `src/relecture-critere.js` (l. 142) bloque la correction (`regle: 'skip'`), doublé par la garde `premiereVide` (`background.js` l. 4504). **Aucune commande SKIP n'est envoyée à ESV.**
2. **`src/settings.js` (l. 523) et `src/faux-vert-ombre.js` (l. 19–66) — `fauxVertOmbre`** :
   - Réglage gelé à `{ actif: true, differer: false, dzMinMm: 11, epaisseurMinMm: 14 }`.
   - Évalué dans `src/lot-decision.js` (l. 397–420) sur chaque coupe posée par le lot : signale `'differer'` (motif `'hauteur-ambigue'`) lorsqu'un même rail cumule un décalage vertical de calage `|dzMm| >= 11 mm` (appliqué ou refusé) et une épaisseur du dessus `q90 - q10 >= 14 mm` dans `bandOffsets`.
   - **Consigné seulement** dans l'observation de décision du lot (`differer: false` dans `commandRails`). Il n'est pas appelé par la passe de relecture (`relectureCalculer`).
3. **`src/gcv2-l1.js` (l. 582, 607, 748–752, 852–857, 954–966) — `brancheEcartement`** :
   - Le levier `brancheEcartement: [1380, 1520]` (avec `branche: true`, `brancheDernier: true`, `brancheMm: 8`, `brancheVertMm: 60`, `brancheMaxCuts: 6`, `brancheExtrapCuts: 2`) sert dans `deciderL1e` à **valider** en dernier recours un cut différé du lot sous le motif `'branche'` lorsque chaque rail trouve une hypothèse du nuage proche de sa `voieGeometrique` interpolée ou prolongée.
   - Il ne sert jamais à détecter ni à sauter une lacune de cœur d'aiguille. De plus, `relectureCalculer` (`background.js` l. 4191–4224) s'appuie sur `Shadow.scientificProposeBoth` et `L.decideCut`, et n'appelle pas `src/gcv2-l1.js`.
4. **Seuil de 10 % d'échec par portion d'au plus 10 000 ER et qualité cible de 95 %** :
   - **Absents du produit** : aucun module de `src/`, aucun réglage de `src/settings.js` ni de `datasets/relecture-reglages-*.json` ne définit de portion de 10 000 ER, de comptage d'échecs par portion, ni de seuil à 10 % ou de cible à 95 %.

---

## 2. Ce que « SKIP » veut dire concrètement en relecture, et pourquoi

Dans le code actuel et l'historique des décisions (D-172, D-241, D-264, D-319, D-320), l'expression « ne pas poser ; sauter de façon bornée » recouvre **trois niveaux d'action distincts** qu'il faut séparer sans ambiguïté :

| Niveau | Mécanisme concret dans Ariane | Effet dans ESV | Compatibilité avec les règles actuelles |
|---|---|---|---|
| **Niveau A — Abstention bornée en relecture + neutralisation d'appui + consigne (`skipOmbre` étendu)** | La coupe est inspectée en relecture ; si le cas particulier (1 à 4, ou 5 sans source saine) est confirmé par l'inspection des coupes voisines sur une fenêtre bornée $\le K_{\max}$, `skipOmbre.raison` reçoit le motif (`'lacune-coeur'`, `'nappes-separees'`, `'rail-invisible'`, `'decalibration'`, `'artefact-scanner'`). `relecture-critere.js` refuse toute correction (`corriger: false, regle: 'skip'`), et **`relectureCalculer` n'ajoute pas la pose de cette coupe à la chaîne d'appuis `ctx.chaine`**. | **Aucune écriture dans ESV** (la coupe est laissée dans son état, `SeenByOperator` seulement). Aucune commande `SKIP` envoyée. | **100 % conforme** à `CLAUDE.md` (« Ariane n'envoie jamais SKIP »), D-172, D-241 et D-264. Empêche Ariane d'écraser un cut en zone non posable et évite de contaminer les coupes voisines par un appui faux. |
| **Niveau B — Saut de navigation borné après confirmation sur la coupe de sortie** | Lorsqu'une coupe $c$ déclenche un cas 1 à 4 confirmé en amont ($c-1, c-2$), la passe inspecte la coupe de sortie $c + k$ ($1 < k \le K_{\max}$) ; si $c + k$ retrouve un rail normal aligné avec l'amont, les coupes intermédiaires $c+1 \dots c+k-1$ de la lacune/anomalie sont sautées (ou visitées sans calcul de correction). | Aucune écriture de pose ni de `SKIP` dans ESV ; gain de temps de capture/pose sur l'intérieur de la lacune si les coupes intermédiaires ne sont pas capturées. | Conforme à l'interdit d'écriture `SKIP`, mais change la trace de visite (`SeenByOperator` sur les coupes intermédiaires si non visitées). |
| **Niveau C — Envoi de la commande `SKIP` à ESV (`Shift+Backspace` / `buttonSkipRail()`)** | Appeler `skipAndNext` (`src/adapter-page.js` l. 369–375, 1417) pour faire écrire `ExtractionStatus: 'skipped'` par ESV sur la ligne. | **Modifie le statut serveur de la coupe en `skipped`.** | **Interdit par `CLAUDE.md` l. 14 et D-241**, et **dangereux en relecture** : la relecture visite des coupes **déjà `valid` (vertes)** dans ESV (`relectureGarde` exige `ligne.statut === 'valid'`). Envoyer `SKIP` à ESV sur un vert détruirait sa validation dans ESV ; l'envoyer sur un différé rouge violerait D-241 et l'interdiction de toucher aux différés du lot en relecture. |

### Pourquoi le Niveau A (complété le cas échéant par l'inspection amont/aval du Niveau B) est le sens naturel du code actuel
1. **En relecture, Ariane ne traite que des coupes déjà `valid` (vertes) pour décider si elle les corrige (`apply` + `Maj+Espace`) ou si elle les laisse intactes.** Les coupes `differe` ou `lot` ne sont jamais corrigées en relecture (`src/relecture-critere.js` l. 144–146 : `jamais: ['cut différé par le lot', 'cut posé par le lot']`).
2. Aujourd'hui, deux défauts se produisent en relecture sur les cas 1 à 5 :
   - **Risque 1 (fausse correction)** : sur un cut vert situé dans une lacune de cœur, une nappe dédoublée ou une décalibration, `relectureCalculer` trouve parfois un candidat accidentel à $\ge 8\text{ mm}$ de la pose d'ESV et **écrase la pose d'ESV** par une pose fausse ;
   - **Risque 2 (contamination de la chaîne `ctx.chaine`)** : dans `background.js` (l. 4202–4203), toute décision `first-pass`, `window` ou `crossing` sur un cut `vert` entre dans `ctx.chaine`, **même si la coupe n'est pas corrigée** ! Un cut en lacune de cœur ou en nappe dédoublée pollue ainsi la prédiction `window` des coupes suivantes.
3. Avec un **SKIP borné de relecture (Niveau A/B)** :
   - Le cas est détecté par ses signaux géométriques et **confirmé par l'inspection des coupes voisines** (avant et après la fenêtre bornée) ;
   - Toute correction est bloquée sur les coupes du saut (`regle: 'skip'`, motif explicite dans `skipOmbre`) ;
   - Aucune pose issue d'une coupe sautée n'entre dans `ctx.chaine` (les appuis sautent par-dessus la fenêtre bornée en conservant les derniers appuis sains d'avant la lacune).

*(Voir Question 1 en § 7 pour faire trancher par l'opérateur entre Niveau A, Niveau B et Niveau C).*

---

## 3. Conception détaillée des Cas 1 à 5

### Principe commun de l'algorithme d'inspection des voisines (fenêtre glissante en relecture)

En relecture aujourd'hui (`background.js` l. 4454–4536), la boucle traite `sel.cuts[ci]` coupe par coupe sans visibilité sur les captures des coupes suivantes $c+1 \dots c+K$.
Pour **inspecter les coupes voisines afin de confirmer un saut borné** (et ne pas confondre une anomalie locale avec un rail normal décalé), la conception repose sur deux sources d'inspection complémentaires :

1. **Inspection rapide sur la table des bords en mémoire (`tableListe` de `src/liste-memoire.js`, déjà passée à `relectureEntree`)** :
   - Disponible instantanément (0 ms, sans déplacer la caméra 3D) sur toute la fenêtre $[c - M,\, c + K + M]$ ;
   - Donne pour chaque coupe voisine son statut (`valid`/`invalid`), ses drapeaux opérateur, son écartement 3D `ecartement(e)`, sa flèche locale `flecheMm` (`src/relecture-filtre-liste.js`) et la voie des voisins valides `voieDeListe` (`src/gcv2-l1.js` l. 922).
2. **Inspection 3D par tampon d'anticipation borné (lookahead de 1 à $K_{\max}$ coupes dans `relecturePasse`)** :
   - Lorsqu'une coupe $c$ présente un signal suspect (cas 1 à 4) et que les voisines amont ($c-1, c-2$, gardées dans un tampon circulaire des $M = 3$ dernières coupes capturées) étaient saines :
   - Avant de prendre une décision sur $c$, la relecture peut différer le verdict de $c$ de $k \le K_{\max}$ pas (ou inspecter jusqu'à $c + K_{\max}$ dans la même plage) :
     - Si le rail normal réapparaît à $c + k$ ($1 \le k \le K_{\max}$) avec un support fort (`topRows >= 15`, `faceCount >= 6`, `residual <= 4 mm`) et une trajectoire cohérente avec l'amont ($c - 1, c - 2$), **le saut borné sur $[c,\, c + k - 1]$ est confirmé** : toutes les coupes de $[c,\, c + k - 1]$ sont marquées en SKIP borné (aucune correction, aucun ajout à `ctx.chaine`), et la relecture reprend normalement en $c + k$.
     - Si au contraire les coupes $c \dots c + K_{\max}$ forment toutes un rail fort, continu et parallèle sur une nouvelle trajectoire cohérente, ce n'est **pas** une lacune ni un artefact ponctuel, mais un rail normal (qui suit alors la règle prudente habituelle).

---

### Cas 1 — Lacunes de cœur d'aiguille

1. **Phénomène physique** :
   Dans la traversée du cœur d'un appareil de voie (pointe de cœur / lacune entre les pattes-de-lièvre et la pointe), le champignon de l'un des deux rails s'interrompt physiquement sur quelques dizaines de centimètres à un mètre, ou se divise entre rail porteur, pointe de cœur et contre-rail, tandis que le rail opposé (côté contre-rail extérieur) reste continu.
2. **Signaux mesurables déjà présents dans le code et les captures** :
   - **Zone** : `c.zone === 'adv'` (ou `surface.advRails > 0` dans `src/regles-metier.js` via `railsDePlus`, qui détecte la présence d'un 3e ou 4e rail dans $\pm 40\text{ cm}$).
   - **Asymétrie franche entre rail porteur continu et rail en lacune (`science.rails`)** :
     - Un rail $s_{\text{sain}}$ est résolu et fort (`next.status === 'candidate'`, `next.topRows >= 15`, `next.faceCount >= 6`, `!next.slopeLimited`, écart à la chaîne d'appuis $\le 8\text{ mm}$) ;
     - Le rail opposé $s_{\text{coeur}}$ présente l'un des trois symptômes de lacune :
       1. *Interruption du champignon* : `next.status !== 'candidate'` (motifs `'minTop'`, `'flank'`, `'rsf'`) ou `publishedWeak === true` (`faceCount < 6`), ou absence de toute cellule forte dans le couloir attendu par l'écartement de référence `gRef` ($\pm 15\text{ mm}$) depuis $s_{\text{sain}}$ ;
       2. *Conflit patte-de-lièvre / pointe de cœur* : `next.motif === 'ambiguity'` ou `competitive.nClusters >= 2` autour du cœur, avec deux candidats forts séparés latéralement de $20\text{ à }120\text{ mm}$ ;
       3. *Décrochage d'écartement (pincement ou élargissement de cœur)* : la paire proposée tombe hors de l'écartement nominal (`|ecartementMm - ecartementRefMm| > 8 mm` dans `relecture-critere.js`, ou `pairGaugeRejected === true` dans `gcv1-shadow.js`, tout en restant dans la bande d'appareil de voie `[1380, 1520] mm`).
3. **Algorithme d'inspection des voisines** :
   - **Entrée** : coupe $c$ en zone `'adv'` présentant un rail sain $s_{\text{sain}}$ continu avec $c-1, c-2$ et un rail opposé $s_{\text{coeur}}$ en symptôme de lacune.
   - **Vérification amont** ($c-1, c-2$) : au moins une coupe amont dans $[c-2, c-1]$ a ses deux rails sains et cohérents en écartement ($|\Delta g| \le 8\text{ mm}$).
   - **Vérification aval** ($c+1 \dots c+K_{\text{lacune}}$) : dans un horizon borné de $K_{\text{lacune}}$ coupes, une coupe $c+k$ retrouve sur $s_{\text{coeur}}$ un candidat fort (`topRows >= 15`, `faceCount >= 6`), à l'écartement nominal de $s_{\text{sain}}$ ($|\Delta g| \le 8\text{ mm}$), et aligné avec la droite/courbe reliant $c-1$ à $c+k$ (flèche d'interpolation $\le 15\text{ mm}$).
   - **Décision** : si l'encadrement amont et aval est confirmé sur $k \le K_{\text{lacune}}$ coupes, les coupes $c \dots c+k-1$ sont classées `skipOmbre.raison = 'lacune-coeur'` : aucune pose/correction n'est écrite et aucune d'elles n'entre dans `ctx.chaine`.
4. **Bornes proposées (à soumettre à l'opérateur)** :
   - Fenêtre maximale de saut de lacune : $K_{\text{lacune}} = 4$ coupes (soit $\sim 1,0\text{ m}$ au pas de $0,25\text{ m}$, extensible à $5$ ou $6$ selon le pas réel des coupes en ADV) ;
   - Voisines d'encadrement : $M_{\text{amont}} = 2$ coupes avant, $M_{\text{aval}} = 2$ coupes après la reprise.
5. **Risques de faux positifs et parades** :
   - *Faux positif principal* : en ADV, une pose initiale d'ESV restée sur la mauvaise branche sur plusieurs coupes consécutives alors que le rail de la bonne branche est bien continu et visible dans le nuage.
   - *Parade* : si sur les coupes $c \dots c+k$, une paire de candidats forts (`topRows >= 15`, `faceCount >= 6`, `lossRatio <= 1.5`) existe à l'écartement nominal ($|\Delta g| \le 8\text{ mm}$) et suit continûment les voisines sans perte de support ni pincement d'écartement, il s'agit d'un rail normal à corriger et **non** d'une lacune.

---

### Cas 2 — Nappes de scanners nettement séparées

1. **Phénomène physique** :
   Les deux scanners (ou deux passes/faisceaux LiDAR) produisent sur un même rail deux nappes de points distinctes décalées en hauteur ($\Delta z$) et/ou en travers ($\Delta u$), donnant un champignon dédoublé (« double toit » ou « double flanc »). Poser sur ce nuage revient soit à caler sur la nappe haute (`q90 + 1 mm`), soit à flotter entre les deux nappes.
2. **Signaux mesurables déjà présents dans le code et les captures** :
   - **Épaisseur verticale de la bande du dessus (`src/placement-convention.js` `bandOffsets`, `src/faux-vert-ombre.js`, `src/hauteur-apprise.js`)** :
     - `epaisseurDessusMm = q90(top) - q10(top)` anormalement élevée (ex. $\ge 14\text{ mm}$, seuil déjà figé dans `fauxVertOmbre.REGLE.epaisseurMinMm = 14`, contre $3\text{ à }6\text{ mm}$ sur une nappe unique).
   - **Résidu d'ajustement des droites de surface (`src/geometry.js` l. 99–121, `src/geometry-candidate-v1.js`)** :
     - `top.residual > maxResidual` ($0,004\text{ m} = 4\text{ mm}$, qui déclenche déjà la raison `'Nappes dispersées.'` dans `src/geometry.js` l. 121) ou `face.residual > 0.004 m`.
   - **Épaisseur latérale du flanc et bimodalité de `bandOffsets.top` / `bandOffsets.face`** :
     - Dans le tableau `b.top` (ou `b.face`) déjà calculé par `Convention.bandOffsets(capture, side, delta)` : séparation nette en deux groupes de points distants d'au moins $\delta_{\text{sep}}$ (ex. $\ge 8\text{ mm}$) avec un creux intermédiaire et au moins $20\,\%$ des points dans chaque nappe (ce qui distingue deux nappes séparées d'un simple point isolé de bruit).
   - **Décalage de calage de convention (`science.rails[side].conventionCalibration`)** :
     - `|dzMm|` élevé (ex. $\ge 8\text{ mm}$, causant `shift-out-of-domain`, ou $\ge 11\text{ mm}$ dans `fauxVertOmbre`) ou `|duMm|` élevé, provoqué par le tirage de `q90` vers la nappe supérieure.
3. **Algorithme d'inspection des voisines** :
   - Lorsqu'une coupe $c$ présente un signal de nappes séparées sur au moins un rail (`epaisseurDessusMm >= seuilEpaisseur` ou `residual > 4 mm` avec bimodalité franche des écarts `top` ou `face`) :
   - Inspecter les coupes voisines amont ($c-2, c-1$) et aval ($c+1 \dots c+K_{\text{nappes}}$) :
     - Comparer la hauteur $z$ et le travers $u$ des deux modes de la coupe $c$ avec la trajectoire des coupes voisines où la nappe est unique (`epaisseurDessusMm < 10 mm`, `residual <= 4 mm`).
     - Si la séparation des nappes dure au plus $K_{\text{nappes}}$ coupes avant retour à une nappe normale (et si le Cas 5 ne permet pas d'isoler avec certitude la source non déformée, voir Cas 5 ci-dessous), sauter de façon bornée les coupes $[c,\, c+k-1]$ (`skipOmbre.raison = 'nappes-separees'`), sans corriger ni alimenter `ctx.chaine`.
4. **Bornes proposées (à soumettre à l'opérateur)** :
   - Seuil de séparation inter-nappes : écart entre les deux modes $\Delta z \ge 8\text{ mm}$ (ou `epaisseurDessusMm >= 14 mm` avec `top.residual >= 4 mm`) ou $\Delta u \ge 8\text{ mm}$ sur le flanc, chaque mode contenant $\ge 20\,\%$ des points de la bande (et au moins $5$ points) ;
   - Fenêtre maximale de saut borné : $K_{\text{nappes}} = 5$ coupes, avec inspection de $M = 2$ voisines de part et d'autre.
5. **Risques de faux positifs et parades** :
   - *Faux positif 1 — Passage à niveau (`zone === 'pn'`)* : la chaussée et l'ornière ajoutent des points près du dessus du rail. *Parade* : exclure ou durcir le test de bimodalité lorsque `coeurPN === true` ou `flushPct >= 50 %` (`src/regles-metier.js`).
   - *Faux positif 2 — Bruit isolé au-dessus du rail* : quelques points parasites au-dessus du champignon. *Parade* : `q90 - q10` et un seuil de population minimale de $20\,\%$ dans chaque mode ignorent par construction moins de $10\,\%$ de points aberrants.

---

### Cas 3 — Rail invisible

1. **Phénomène physique** :
   Sur une ou plusieurs coupes, au moins l'un des deux rails est invisible dans le nuage LiDAR (masqué par de la végétation, du ballast haut, un obstacle, un coffret, ou une zone d'ombre complète des scanners sur le champignon), alors même que le nuage de la coupe est bien chargé en mémoire (il y a des points de ballast, de traverse ou sur l'autre rail).
2. **Signaux mesurables déjà présents dans le code et les captures** :
   - **Limite actuelle de `skipOmbre`** : `skipOmbre` ne voit que `total === 0` (`left === 0` ET `right === 0` dans la grande boîte $0,5 \times 0,4 \times 0,3\text{ m}$). Dès qu'il y a $15$ points de ballast dans la boîte ou que seul le rail gauche est invisible, `skipOmbre` rend `raison: null`.
   - **Signaux existants d'invisibilité d'au moins un rail (`src/gcv1-shadow.js`, `src/native-lidar.js`, `src/placement-convention.js`)** :
     - `science.rails[side].ok === false` (motif `'Trop peu de points autour du champignon.'`, `pointsLocal < 8` dans la boîte utile $\pm 180\text{ mm} \times \pm 100\text{ mm}$) ;
     - ou `science.rails[side].next.status !== 'candidate'` avec `astar.motif` dans `['rsf', 'minTop', 'flank']`, **`competitive.nStrongPool === 0`** (aucune cellule forte dans toute la grille) et, à la position prédite par les coupes voisines (`seededRails` / `bandOffsets`), `pointsDessus < 15` (ou $< 8$) et `pointsFlanc < 3` ;
     - dans `capture.railObservations[side]` (si présent) : `coverage.status === 'insufficient'` avec `exclusionReasons` contenant `'engine-useful-point-count-below-minimum'` ou `'longitudinal-coverage-insufficient'`.
3. **Algorithme d'inspection des voisines** :
   - **Étape 1 (distinction avec un défaut de chargement Potree)** : si toute la scène est vide (`pointsSceneRelative.length === 0` sur deux captures), c'est déjà le motif `'aucun-point'` (D-172) et, à partir de 3 coupes vides consécutives, la garde CH-107 (`relecturePointsVides`, `background.js` l. 4524) met la passe en pause et recharge ESV. Le cas `'rail-invisible'` concerne le cas où **le nuage de la coupe est chargé** (l'autre rail ou l'environnement a des points, ou une recapture a confirmé le nuage), mais le profil d'au moins un rail est absent.
   - **Étape 2 (vérification à la position prédite par les voisines)** : pour ne pas déclarer « invisible » un rail qui a simplement ripé hors de la fenêtre de départ ($\pm 180\text{ mm}$), évaluer `bandOffsets` (ou `soutienRail` de `src/gcv2-l1.js` l. 320) **à la position interpolée/extrapolée depuis les coupes voisines saines** ($c-1, c-2$ et $c+1 \dots c+K_{\text{invisible}}$).
   - **Étape 3 (confirmation par encadrement borné)** : si sur $[c,\, c+k-1]$ ($k \le K_{\text{invisible}}$), le rail reste sans support (`pointsDessus < minTop`, `pointsFlanc < minFace`, `nStrongPool === 0`) même autour de la corde des voisines, puis réapparaît en $c+k$ avec un support fort (`topRows >= 15`, `faceCount >= 6`) aligné avec l'amont, marquer $[c,\, c+k-1]$ en `skipOmbre.raison = 'rail-invisible'` (aucune correction, aucun ajout à `ctx.chaine`).
4. **Bornes proposées (à soumettre à l'opérateur)** :
   - Seuil d'invisibilité sur un rail (évalué à la pose de départ ET à la pose prédite par les voisines) : `nStrongPool === 0` et (`pointsDessus < 10` ou (`pointsDessus < 15` et `pointsFlanc < 3`)) ;
   - Fenêtre maximale de saut borné : $K_{\text{invisible}} = 4$ coupes, avec encadrement par $M = 2$ coupes voisines où les deux rails sont visibles et forts.
5. **Risques de faux positifs et parades** :
   - *Faux positif 1 — Rail très décalé en ADV ou en courbe* : invisible à la pose de départ d'ESV, mais bien présent à $150\text{ mm}$ de là. *Parade* : toujours tester le soutien du nuage autour de la voie prédite par les voisines (et de la liste `tableListe`) avant de conclure à l'invisibilité.
   - *Faux positif 2 — Chargement tardif d'une feuille d'octree Potree* : si le nombre total de points du côté concerné est très bas (ex. `< 64` points dans la ROI), faire une seconde lecture de confirmation (comme le fait déjà `background.js` l. 4493 pour `captureVide`) avant de déclarer le rail invisible.

---

### Cas 4 — Décalibration (notamment à faible vitesse)

1. **Phénomène physique** :
   Lorsque le véhicule de mesure roule à faible vitesse, freine, s'arrête ou repart, la centrale inertielle / odométrie peut dériver ou osciller sur quelques mètres. Les plans de coupe successifs ou les balayages LiDAR successifs à l'intérieur d'une même coupe ne sont plus géométriquement cohérents : le rail semble serpenter brutalement d'une coupe à l'autre, s'incliner fortement, ou s'étaler en éventail le long des $1,0\text{ m}$ de profondeur longitudinale de la coupe.
2. **Signaux mesurables déjà présents dans le code et les captures** :
   - **Signaux cinématiques et de liste inter-coupes (`src/ancre-trajectoire.js`, `src/relecture-filtre-liste.js`, `src/gcv2-l1.js` `voieDeListe`)** :
     - **Pas longitudinal $\Delta s$ très court ou irrégulier (faible vitesse / arrêt)** : dans `serie(Lg)` (`src/ancre-trajectoire.js` l. 48–60), l'abscisse cheminée $\Delta s_k = s[k] - s[k-1]$ entre plans de coupe successifs (ou le rapport entre $\Delta s_k$ et le pas médian de la partie, typiquement $\sim 0,25\text{ m}$) chute ou fluctue fortement, ou la variation de cap $|\Delta \theta_k| = |\text{th}[k] - \text{th}[k-1]|$ présente des oscillations de signe opposé d'une coupe à l'autre ;
     - **Défaut de rigidité monde ↔ scène** : dans `voieDeListe` (`src/gcv2-l1.js` l. 927) ou `ancre-trajectoire.js` (`rigideMaxMm: 2`, `calageMaxMm: 5`), l'écart de translation entre rail gauche et rail droit `rigideMm` dépasse $2\text{ mm}$, ou le résidu d'ajustement linéaire sur les voisines `residuMm` dépasse un seuil élevé (ex. $> 15\text{–}20\text{ mm}$) ;
     - **Ondulation locale (flèche alternée)** : `evaluerCut` (`src/relecture-filtre-liste.js` l. 30–41) mesure `flecheMm` et `ecartRefMm` élevés sur plusieurs coupes consécutives.
   - **Signaux intra-coupe dans le nuage LiDAR (`src/geometry-candidate-v1.js`, `src/gcv1-shadow.js`, `src/relecture-critere.js`)** :
     - **Pente hors domaine (`slopeLimited`)** : `top.slopeLimited === true` ou `face.slopeLimited === true` (motif `'slope'` dans `gcv1-shadow.js` l. 187 : inclinaison $|\text{rawSlope}| > 0,5$) ;
     - **Dispersion longitudinale avant / arrière de la coupe** : dans le repère local du rail ($q[0] \in [-0,5 ; +0,5]\text{ m}$ le long de la voie), les points de la moitié avant ($q[0] > +0,1\text{ m}$) et de la moitié arrière ($q[0] < -0,1\text{ m}$) donnent deux positions latérales ou verticales décalées de plus de $\delta_{\text{long}}$ (ex. $\ge 8\text{–}10\text{ mm}$ sur $1\text{ m}$) ;
     - **Torsion de la paire (`src/relecture-critere.js` l. 169–176)** : incohérence entre le déplacement des deux rails (`dl = |ec.left.lat - ec.right.lat| > 6 mm` ou `dv = |ec.left.vert - ec.right.vert| > 6 mm`) ou saut d'écartement (`|ecartementMm - ecartementRefMm| > 8 mm`).
3. **Algorithme d'inspection des voisines** :
   - Une coupe $c$ est candidate au motif `'decalibration'` si elle combine :
     (a) une anomalie géométrique intra-coupe (`slopeLimited`, `residual > 4 mm`, distorsion longitudinale avant/arrière, ou incohérence `dl`/`dv`/écartement entre les deux rails), **et**
     (b) une anomalie cinématique ou d'oscillation sur les coupes voisines $[c-2,\, c+2]$ (pas longitudinal $\Delta s$ comprimé/irrégulier à faible vitesse, ou résidu de trajectoire élevé sur 2 à $K_{\text{decal}}$ coupes consécutives).
   - **Inspection amont/aval** : vérifier sur $[c - M,\, c + K_{\text{decal}} + M]$ que la perturbation est bornée ($\le K_{\text{decal}}$ coupes) et encadrée par des coupes où le résidu intra-coupe ($\le 4\text{ mm}$), l'écartement ($|\Delta g| \le 8\text{ mm}$) et la régularité de la voie reviennent à la normale.
   - **Décision** : sauter de façon bornée la plage décalibrée (`skipOmbre.raison = 'decalibration'`), sans corriger aucune coupe de cette plage et en purgeant/gelant les appuis pris dans la zone décalibrée.
4. **Bornes proposées (à soumettre à l'opérateur)** :
   - Fenêtre maximale de saut borné : $K_{\text{decal}} = 6$ coupes (ou davantage si un arrêt à faible vitesse couvre plus de coupes : voir Question 3 en § 7) ;
   - Voisines d'encadrement : $M = 2$ coupes saines avant et après.
5. **Risques de faux positifs et parades** :
   - *Faux positif* : courbe serrée ou entrée d'appareil de voie où la pose d'ESV dérive fortement par rapport à la corde.
   - *Parade* : dans une courbe réelle à vitesse normale, le pas inter-coupes $\Delta s$ est régulier, l'écartement des deux rails reste stable autour de la référence, et chaque rail individuel reste net dans sa coupe (`residual <= 4 mm`, `!slopeLimited`). Exiger la conjonction d'une dégradation de la qualité géométrique (résidu / pente / torsion / écartement) évite de classer une vraie courbe en décalibration.

---

### Cas 5 — Deux scanners : en cas d'artefact (ex. rail poli / déformé), s'appuyer sur la source non déformée

1. **La contrainte technique du nuage unique d'ESV (ÉTABLI)** :
   - Comme le rappelle `src/relecture-ombre.js` (l. 269–270) et comme l'ont établi `fiches/RELECTURE_AUTONOME.md` (§ 6) et `chantiers/CH-016.rapport.md` (l. 7) :
     1. ESV fusionne tous les scanners dans **un seul nuage Potree** (`clouds` n'a qu'une entrée `cloud-0`) ;
     2. Les tampons WebGL/Potree d'ESV ne portent **pas d'attribut `pointSourceID` ni `scannerId`** (seuls `intensity` et `classification` existent dans `attributes`) ;
     3. `pointSources` contient `[nodeIndex, pointIndex]` (l'indice du nœud d'octree Potree, qui regroupe spatialement les points des deux scanners dans le même cube d'octree).
   - **Conséquence directe** : il est impossible de filtrer les points par un identifiant matériel `scanner === 1` ou `scanner === 2`. Une « source non déformée » ne peut être identifiée que par **la géométrie des sous-ensembles de points dans le repère du rail et leur cohérence avec l'autre rail et les coupes voisines** (éventuellement croisée avec `intensity` si la capture complète est présente, bien que la capture légère de CH-148 en relecture n'ait besoin que des coordonnées).
2. **Comment l'artefact d'un scanner sur deux (ex. rail poli) se manifeste géométriquement dans le nuage fusionné** :
   - Les deux scanners d'un véhicule de mesure visent chaque rail sous deux angles d'incidence opposés / croisés.
   - Lorsqu'un rail est poli (réflexion spéculaire, multi-trajet ou saturation optique d'un scanner sous son angle d'incidence), **un seul des deux faisceaux** est déformé :
     - Le **faisceau sain (source non déformée)** forme une nappe compacte conforme au gabarit U50 (dessus horizontal plat, flanc interne vertical, faible dispersion $\le 3\text{ mm}$), alignée avec les coupes voisines $c-1, c+1$ et à l'écartement nominal `gRef` de l'autre rail ;
     - Le **faisceau déformé (source avec artefact)** ajoute :
       - soit une **excroissance / bavure verticale ou oblique** au-dessus ou sur le bord du champignon (qui gonfle `epaisseurDessusMm` dans `bandOffsets` et tire le 90e centile `q90` vers le haut de $+5\text{ à }+15\text{ mm}$, comme documenté dans `fiches/FAUX_VERTS.md` § 3.3),
       - soit un **second amas (cluster) décalé en travers** ou à forte pente (`slopeLimited`),
       - soit une déformation d'un seul rail de la paire alors que l'autre rail est intact.
3. **Trois méthodes concrètes pour identifier et exploiter la « source non déformée » sans identifiant de scanner** :
   - **Méthode 5.1 — Décomposition bimodale de la bande du rail (séparation géométrique des deux nappes sur le même rail)** :
     - Dans le repère profil du rail $(u, z)$, lorsque les points autour du champignon présentent une dispersion anormale (`epaisseurDessusMm` élevée, `residual` élevé ou deux modes dans l'histogramme des résidus au gabarit), partitionner les points en deux sous-nappes $S_1, S_2$ (par exemple par séparation autour de la vallée de l'histogramme vertical/latéral, ou par `spatialClusters` des minima locaux dans `src/gcv1-shadow.js` l. 323) ;
     - Qualifier chaque sous-nappe par trois critères objectifs :
       1. *Fidélité de forme au gabarit U50* : perte `templateLoss` et résidu `robustLine` ($\le 3,5\text{ mm}$, `!slopeLimited`, `topRows >= 15`, `faceCount >= 6`) ;
       2. *Continuité avec les coupes voisines saines* ($c-1, c-2$ et $c+1$) : écart $(u, z)$ minimal à la position prédite par les voisines (`predictFramed` / `O.predict` dans `src/lot-decision.js`) ;
       3. *Accord d'écartement avec l'autre rail* : écartement 3D à moins de $\pm 6\text{ mm}$ de la référence locale `ecartementRefMm`.
     - La sous-nappe qui satisfait ces trois critères est la **source non déformée**.
   - **Méthode 5.2 — Arbitrage entre pose brute du minimum (cœur de la nappe dense) et pose calée au 90e centile (sensible à la queue d'artefact)** :
     - Comme l'a établi `fiches/FAUX_VERTS.md` (§ 3.2 : 21 faux verts vérifiés où *« calage appliqué, la pose brute était plus juste »*), la grille de `geometry-candidate-v1.js` utilise la **médiane** des distances aux ancres (`loss` par `median`, robuste à $< 50\,\%$ de points déformés) et trouve donc le centre de la source non déformée (`rawDelta`), tandis que le calage `q90 + 1 mm` (`placement-convention.js`) est tiré par les $10\text{ à }30\,\%$ de points hauts de la source déformée.
     - Sans toucher à `src/placement-convention.js` (interdit par le ticket), la relecture dispose déjà dans `science.rails[side]` des **deux** positions : la pose calée `next.delta` et la pose brute `next.rawDelta` (ou `conventionCalibration.rawDelta`, `src/gcv1-shadow.js` l. 496), ainsi que de la correction `hauteurApprise` (`src/hauteur-apprise.js`, qui retranche justement une fonction linéaire de `epaisseurDessusMm`).
   - **Méthode 5.3 — Appui sur le rail non déformé de la paire + écartement de référence** :
     - Si l'un des deux rails (`left` ou `right`) est exempt d'artefact (faible résidu, faible épaisseur, cohérent avec les voisines) et que le second rail est trop déformé pour que ses deux sous-nappes soient séparables, le rail sain + l'écartement de référence local `ecartementRefMm` + la pente verticale des voisines déterminent la position attendue du rail déformé (principe de `ramenerRail` dans `src/gcv2-l1.js` l. 630).
4. **Point d'attention vis-à-vis de l'interdit sur le placement** :
   - Le brief impose : *« Ne change rien au placement (calage haut q90 + 1 mm, face, fenêtre de flanc) : l'opérateur a retiré cette étape. »*
   - Il faut donc que l'opérateur tranche (voir Question 2 en § 7) ce que la relecture doit faire dans le Cas 5 :
     - **Option 5A (choisir / poser sur la source non déformée en relecture, sans toucher à `placement-convention.js`)** : en relecture seulement, lorsque l'artefact d'un scanner est détecté sur un rail, évaluer la pose sur la sous-nappe saine (ou `rawDelta` / rail opposé + écartement, confirmé par les coupes voisines) et l'utiliser comme `poseCalculee` de relecture ;
     - **Option 5B (ne pas modifier le calcul de pose, utiliser la source non déformée uniquement comme juge de cohérence / abstention)** : si la pose standard (calée avec `q90 + 1 mm`) s'écarte de la source non déformée (confirmée par les voisines), s'abstenir de corriger le cut vert en relecture (`skipOmbre.raison = 'artefact-scanner'`) pour ne jamais dégrader un rail poli.

---

## 4. Conception du Cas 6 — Seuil d'au plus 10 % d'échec par portion d'au plus 10 000 ER et qualité cible de 95 %

Aujourd'hui, aucun concept de « portion de 10 000 ER », de « taux d'échec par portion » ni de « qualité cible de 95 % » n'existe dans le code. Voici l'analyse des définitions possibles et du comportement en cas de dépassement.

### 4.1 Définition d'une « portion d'au plus 10 000 ER »

Une **ER** désigne une coupe (`cut`, élément de rail / ligne de la partie dans ESV, numérotée de `0` à `total - 1`).
Trois conventions de découpage d'une partie (ou d'une suite de parties) en portions d'au plus $N_{\max} = 10\,000$ ER sont possibles :

1. **Découpage par tranches fixes dans chaque partie (`Option 6A-tranches`)** :
   - Toute partie de taille `total <= 10 000` ER forme **une seule portion** `[0, total - 1]` (c'est le cas de la grande majorité des parties ESV, dont les parties 20, 21 et 22).
   - Si une partie dépasse $10\,000$ ER (ex. $14\,500$ ER), elle est découpée en tranches contiguës d'au plus $10\,000$ ER : soit des blocs fixes de $10\,000$ (`[0..9999]`, `[10000..14499]`), soit $\lceil \text{total} / 10\,000 \rceil$ tranches équilibrées ($\sim 7\,250$ ER chacune).
2. **Découpage par fenêtre glissante (`Option 6A-glissante`)** :
   - Le seuil de 10 % est vérifié sur toute fenêtre contiguë d'au plus $10\,000$ ER de la partie.
3. **Population de référence (dénominateur du pourcentage)** :
   - **Dénominateur D1 (`totalPortion`)** : toutes les ER de la portion (ex. toutes les coupes `0` à `total - 1` de la partie, qu'elles aient été traitées par le lot, laissées vertes d'origine ou visitées en relecture) ;
   - **Dénominateur D2 (`relusPortion`)** : uniquement les coupes sélectionnées et évaluées par la passe de relecture dans cette portion (`sel.cuts`).

### 4.2 Définition d'un « échec » et articulation entre le plafond de 10 % et la cible de 95 %

Il faut distinguer la **mesure en ligne** (pendant qu'Ariane tourne seule sur ESV, sans vérité humaine Écho) et la **mesure hors ligne** (en rejeu contre un Écho de l'opérateur) :

1. **En exécution en ligne (dans l'extension, à la fin du lot et de la relecture)** — candidats au numérateur « échecs » :
   - $E_{\text{diff}}$ : coupes restées **non résolues (différées)** après le lot et la 2e passe (toujours `invalid` dans ESV) ;
   - $E_{\text{skip}}$ : coupes **sautées en relecture (SKIP borné)** au titre des cas 1 à 5 et de `aucun-point` (rail non posable de façon fiable) ;
   - $E_{\text{refus}}$ : coupes où la relecture voulait corriger (`critere.corriger === true`) mais où la correction a échoué ou a été refusée (`action === 'correction-refusee'`, `'correction-incertaine'`, `erreurCapture`, `erreurCalcul`) ;
   - $E_{\text{abst}}$ *(optionnel)* : coupes visitées en relecture où le jugement voit un écart $\ge 5\text{ mm}$ (`verdict === 'je corrigerais'`, ou sans pose calculée `poseCalculee === null`) mais où la règle prudente `relecture-critere.js` refuse de corriger (confiance trop basse, déplacement $> 45\text{ mm}$, incohérence des deux rails).
2. **En évaluation hors ligne (rejeu avec vérité terrain / Écho)** :
   - Une ER dont l'écart final à la référence de l'opérateur dépasse le seuil de tolérance (ex. $> 10\text{ mm}$, ou $> 5\text{ mm}$), ou qui est restée non résolue / abîmée.
3. **Articulation entre « au plus 10 % d'échec par portion » et « qualité cible 95 % »** :
   - **Qualité globale / nominale cible = 95 %** (soit au plus **5 % d'échec** sur l'ensemble des portions / du lot) ;
   - **Seuil maximal toléré localement = 10 % d'échec sur chaque portion d'au plus 10 000 ER** (soit au moins **90 % de qualité** sur la pire portion ; aucune portion ne doit dépasser 10 % d'échec).

### 4.3 Que faire si le seuil de 10 % est dépassé sur une portion ?

Trois comportements sont possibles dans l'extension :

- **Comportement 6C-1 — Consigner et alerter dans le panneau et le journal (non bloquant)** :
  - Émettre un événement `relecture-qualite-portion` (et enrichir `relecture-fin`) avec, pour chaque portion : `{ debut, fin, totalEr, relus, echecs, detailEchecs, tauxEchecPct, qualitePct, cible95Atteinte, seuil10Depasse }` ;
  - Si `tauxEchecPct > 10 %` (ou si `qualitePct < 95 %`), afficher un **avis explicite dans le panneau** (ex. *« Portion 0–4820 : 11,4 % d'échecs (seuil 10 % dépassé, qualité 88,6 % pour une cible de 95 %) — contrôle manuel requis »*) sans interrompre la passe ni la file de parties (cohérent avec D-245 : *« rien n'arrête la file à part un bouton d'arrêt »*).
- **Comportement 6C-2 — Basculer la portion en mode `ombre` ou mettre la relecture en pause** :
  - Dès que le compteur d'échecs de la portion courante dépasse $10\,\%$ de la taille de la portion (ou des coupes relues), mettre la relecture en pause au point de reprise (`issue = 'pause-qualite'`) ou couper l'écriture (`modeEffectif = 'ombre'`) sur le reste de la portion.
- **Comportement 6C-3 — Arrêter la relecture (et la Constellation le cas échéant)** :
  - Arrêter immédiatement la passe avec un motif explicite `'seuil-echec-portion-depasse'`.

*(Voir Questions 4, 5 et 6 en § 7 pour faire trancher ces trois points par l'opérateur).*

---

## 5. Fichiers qui changeraient, essais à ajouter et protocole de mesures hors git (parties 20–22)

### 5.1 Fichiers qui changeraient (une fois la conception validée)

Conformément aux interdits du ticket et de `CLAUDE.md`, **aucun fichier de placement ni de géométrie gelée** (`src/placement-convention.js`, `src/geometry*.js`, `src/engine.js`, `src/lot-decision.js`, `src/gcv2*.js`, `src/adapter-page.js`, `manifest.json`) n'a besoin d'être modifié si l'on opère dans la couche de relecture :

1. **`src/relecture-ombre.js`** (ou un nouveau module pur dédié appelé par lui, ex. `src/relecture-cas-particuliers.js`) :
   - Étendre ou compléter `skipOmbre` pour évaluer, sur une fenêtre bornée de coupes consécutives `[c - M .. c + K]`, les signaux des cas 1 (`lacune-coeur`), 2 (`nappes-separees`), 3 (`rail-invisible`), 4 (`decalibration`) et 5 (`artefact-scanner` / sélection de la source non déformée), tout en conservant `aucun-point` (D-172) à l'identique.
   - Ajouter la fonction pure de calcul du bilan de qualité par portion d'au plus 10 000 ER (`bilanPortions(entree, resultatsCuts, options)`).
2. **`src/relecture-critere.js`** :
   - `juger` bloque déjà toute correction dès que `e.skipOmbre?.raison` est non nul (l. 142 : `if (e.skipOmbre?.raison) return non('skip', ...)`). Vérifier que les nouveaux motifs de `skipOmbre.raison` sont transmis et documentés sans ouvrir aucune brèche dans `correctionPermise`.
3. **`src/settings.js`** :
   - Ajouter les réglages gelés (désactivables par clé `actif: false` pour garantir le retour au comportement actuel au bit près) des bornes $K_{\max}$, des seuils des cas 1 à 5 et des paramètres de portion (`portionMaxEr: 10000`, `seuilEchecMaxPct: 10`, `qualiteCiblePct: 95`, action sur dépassement).
4. **`background.js`** (section `relecturePasse`, l. 4401–4560) :
   - Alimenter le tampon borné d'inspection des voisines (coupes amont/aval et `tableListe`) ;
   - Empêcher qu'une coupe marquée en SKIP borné (cas 1 à 4, ou 5 en abstention) n'entre dans `ctx.chaine` (l. 4202–4203) ;
   - Calculer et journaliser le bilan par portion dans `relecture-fin` (et `relecture-qualite-portion`), et déclencher l'action retenue par l'opérateur si le seuil de 10 % est dépassé.

### 5.2 Essais à ajouter (rouges d'abord, puis verts)

Dans un nouveau fichier `tests/ch159-relecture-cas-particuliers-et-portions.test.cjs` (et vérification de non-régression sur `tests/relecture-ombre.test.cjs`, `tests/relecture-critere.test.cjs`, `tests/ch152-relecture-filtre-et-confiance.test.cjs`, `tests/ch158-relecture-adv-et-trous.test.cjs`) :

1. **Non-régression stricte** : réglage coupé ou captures normales $\rightarrow$ sorties de `selection()`, `juger()`, `skipOmbre()` et `relectureCritere.juger()` identiques octet pour octet à `050cb2cd`.
2. **Cas 1 (lacune de cœur d'aiguille)** :
   - Essai positif : en zone `adv`, rail extérieur fort et continu sur $c-1 \dots c+3$, rail côté cœur en perte de support / pincement sur $c, c+1$ puis fort et réaligné en $c+2, c+3$ $\rightarrow$ `skipOmbre.raison === 'lacune-coeur'` sur $c, c+1$, `corriger: false`, aucune entrée dans `ctx.chaine`.
   - Essai négatif (anti-faux-positif) : en zone `adv`, les deux rails sont forts, continus et à l'écartement nominal sur $c-1 \dots c+3$ mais décalés de $20\text{ mm}$ par rapport à la pose d'ESV $\rightarrow$ **pas** de SKIP, la coupe est corrigée normalement.
3. **Cas 2 (nappes séparées)** :
   - Essai positif : capture à double nappe verticale ($\Delta z = 14\text{ mm}$, `epaisseurDessusMm >= 14`, `residual > 4 mm`, deux modes peuplés à $> 20\,\%$) sur $c, c+1$, encadrée par des coupes à nappe unique en $c-1$ et $c+2$ $\rightarrow$ `skipOmbre.raison === 'nappes-separees'`.
   - Essai négatif : nappe unique fine (`epaisseurDessusMm = 4 mm`) ou cœur de PN franc $\rightarrow$ pas de SKIP `'nappes-separees'`.
4. **Cas 3 (rail invisible)** :
   - Essai positif : nuage chargé (rail droit à $1\,200$ points, ballast présent), mais rail gauche sans champignon (`nStrongPool === 0`, `pointsDessus < 10` même autour de la prédiction des voisines) sur $c, c+1$, encadré par deux rails forts en $c-1$ et $c+2$ $\rightarrow$ `skipOmbre.raison === 'rail-invisible'`.
   - Essai négatif : rail gauche décalé de $35\text{ mm}$ mais bien visible et fort autour de la prédiction des voisines $\rightarrow$ pas de SKIP `'rail-invisible'`.
5. **Cas 4 (décalibration à faible vitesse)** :
   - Essai positif : grappe de 3 coupes à pas $\Delta s$ comprimé / résidu élevé / `slopeLimited` ou torsion `dl > 6 mm`, encadrée par des coupes stables $\rightarrow$ `skipOmbre.raison === 'decalibration'`.
6. **Cas 5 (deux scanners, artefact / rail poli)** :
   - Essai positif : sur un rail dont une sous-nappe est déformée (queue haute de points de rail poli tirant `q90`) tandis que la source non déformée concorde avec l'autre rail et les coupes voisines $c-1, c+1$ $\rightarrow$ appui sur la source non déformée (selon l'option 5A ou 5B validée par l'opérateur).
7. **Cas 6 (portions de 10 000 ER, seuil de 10 % et cible de 95 %)** :
   - Découpage d'une partie de $4\,500$ ER (1 portion) et d'une partie de $14\,000$ ER (2 portions $\le 10\,000$ ER) ;
   - Calcul exact du taux d'échec et de la qualité par portion ; Franchissement du seuil de $10\,\%$ et vérification de l'action (alerte / pause / arrêt selon la décision de l'opérateur).

### 5.3 Protocole de mesures de rejoue hors git sur les parties 20–22

Une fois les questions du § 7 tranchées et le code écrit, la rejoue hors git sera exécutée sur l'export v6 des **parties 20, 21 et 22** (depuis `banane-data`, sans jamais verser d'UUID, de coordonnées ni d'extrait de journal dans `banane`) et rapportera dans `chantiers/CH-159/rapport.md` le tableau suivant :

1. **Comptage des SKIP par cas et par partie (P20, P21, P22 et total)** :
   - `aucun-point` (D-172) ;
   - Cas 1 (`lacune-coeur`) ;
   - Cas 2 (`nappes-separees`) ;
   - Cas 3 (`rail-invisible`) ;
   - Cas 4 (`decalibration`) ;
   - Cas 5 (`artefact-scanner` : nombre de coupes sauvées par la source non déformée vs nombre de coupes sautées).
2. **Effet sur la sélection et la structure des plages (référence : CH-158 / bêta 2)** :
   - Nombre de coupes relues (`total`), traversées (`traverses`) et filtrées par la liste (`filtresListe`) ;
   - Taux de trous de 1 à 3 coupes et taux de coupes isolées (vérification qu'ils restent au niveau atteint en CH-158 : $\sim 5\,\%$ et $\sim 4,5\,\%$) ;
   - Effet sur le nombre de corrections émises en relecture et sur le temps estimé (`tempsEstimeS`) et mesuré.
3. **Bilan de qualité par portion d'au plus 10 000 ER sur P20, P21, P22** :
   - Nombre de portions par partie et taille en ER de chaque portion ;
   - Nombre et pourcentage d'échecs par portion, qualité mesurée (vis-à-vis de la cible de 95 %) et liste des portions dépassant le seuil de 10 %.

---

## 6. Hors périmètre rappelé

- **Aucun changement au placement** : l'étape 2 est retirée par l'opérateur. Ne pas modifier `src/placement-convention.js`, ni le calage haut `q90 + 1 mm`, ni l'offset de flanc (`-2,6 mm`), ni les fenêtres de flanc (`bandOffsets`).
- **Aucun changement aux fichiers protégés du moteur et du lot** : `src/engine.js`, `src/geometry*.js`, `src/lot-decision.js`, `src/gcv2*.js`, `src/adapter-page.js`, `manifest.json`, la version, le paquet, ni le tronc `ariane6`.
- **Aucune donnée terrain ni document restreint** dans le dépôt, les essais ou les commits.

---

## 7. Questions ouvertes à trancher par l'opérateur avant toute implémentation (RÈGLE D'ARRÊT)

Conformément à la règle d'arrêt prioritaire du ticket, plusieurs décisions métier ne sont pas tranchées par les règles ci-dessus et ne doivent pas être inventées par défaut. Voici les questions numérotées soumises à l'opérateur :

1. **Sens concret de « SKIP / sauter de façon bornée » en relecture (Cas 1 à 4)** :
   En relecture, Ariane visite principalement des coupes **déjà `valid` (vertes)** dans ESV (et traverse ou lit en ombre les différés du lot). Quand un cas 1 à 4 est détecté et confirmé par les voisines sur une fenêtre bornée :
   - **Choix 1A (Abstention bornée en relecture + exclusion de la chaîne d'appuis + consigne)** : Ariane n'écrit aucune pose sur ces coupes (`corriger: false, regle: 'skip'`), ne les utilise pas comme appuis dans `ctx.chaine`, consigne le motif dans `skipOmbre.raison`, et n'envoie aucune commande `SKIP` à ESV (respect strict de D-241 et préservation du statut dans ESV) ;
   - **Choix 1B (Abstention + saut de visite 3D des coupes intermédiaires)** : comme 1A, mais dès que la coupe d'entrée $c$ et la coupe de sortie $c+k$ ($k \le K_{\max}$) confirment la lacune/anomalie, la relecture saute directement à $c+k$ sans capturer en 3D les coupes intermédiaires $c+1 \dots c+k-1$ ;
   - **Choix 1C (Envoi réel du statut `skipped` à ESV via `Shift+Backspace` / `buttonSkipRail()`)** : faut-il lever l'interdit D-241 pour envoyer réellement `SKIP` à ESV, et si oui, sur quels rôles de coupes (`differe` rouges seulement, ou aussi `vert` au risque d'annuler leur validation existante) ?

2. **Conduite à tenir dans le Cas 5 (deux scanners avec artefact / rail poli) sans toucher au placement (`placement-convention.js`)** :
   Puisque `placement-convention.js` (`q90 + 1 mm`) ne doit pas être modifié :
   - **Choix 2A (Poser en relecture grâce à la source non déformée)** : autorises-tu la relecture à calculer sa pose sur la sous-nappe non déformée (identifiée par sa conformité au gabarit U50, son accord d'écartement avec l'autre rail et sa continuité avec les coupes voisines, par exemple via la pose brute avant calage `rawDelta` ou en masquant les points de la sous-nappe déformée dans la copie locale de capture passée à `relectureCalculer`) ?
   - **Choix 2B (Abstention / SKIP borné en cas de désaccord)** : préfères-tu qu'on ne modifie jamais la pose proposée et que la source non déformée serve uniquement de garde pour **s'abstenir de corriger** (`skipOmbre.raison = 'artefact-scanner'`) dès que l'artefact dévie la pose calée ?

3. **Bornes numériques du saut borné ($K_{\max}$ coupes consécutives) et de l'inspection des voisines ($M$ coupes)** :
   Valides-tu les bornes suivantes, ou souhaites-tu d'autres valeurs ?
   - Inspection des voisines : **$M = 2$ coupes** saines en amont et **$M = 2$ coupes** saines en aval ;
   - Longueur maximale du saut borné $K_{\max}$ :
     - Cas 1 (lacune de cœur d'aiguille) : **$K_{\text{lacune}} = 4$ coupes** (ou autre valeur ?) ;
     - Cas 2 (nappes séparées) : **$K_{\text{nappes}} = 5$ coupes** (ou autre valeur ?) ;
     - Cas 3 (rail invisible) : **$K_{\text{invisible}} = 4$ coupes** (ou autre valeur ?) ;
     - Cas 4 (décalibration à faible vitesse) : **$K_{\text{decal}} = 6$ coupes** (ou une borne plus large pour couvrir un ralentissement / arrêt complet ?).
   - Et si l'anomalie dépasse $K_{\max}$ coupes consécutives sans retrouver de rail normal : faut-il **arrêter de sauter** (reprendre l'évaluation coupe par coupe) ou **alerter / mettre en pause** ?

4. **Définition exacte d'une « portion d'au plus 10 000 ER » (Cas 6)** :
   - **Choix 4A (Découpage)** : tranches fixes par partie (`[0..9999]`, `[10000..total-1]`, soit 1 portion unique pour toute partie $\le 10\,000$ coupes), tranches équilibrées $\lceil \text{total} / 10\,000 \rceil$, ou fenêtre glissante de $10\,000$ coupes ?
   - **Choix 4B (Dénominateur du taux)** : le taux d'échec est-il rapporté au **nombre total de coupes (ER) de la portion dans la partie** (`totalPortion`, ex. toutes les coupes de la partie) ou au **nombre de coupes visitées par la relecture** dans cette portion (`relusPortion`) ?

5. **Définition exacte d'un « échec » compté dans le seuil de 10 % et la cible de 95 % (Cas 6)** :
   - **En exécution réelle dans l'extension (sans Écho humain)**, quelles coupes comptent comme un « échec » au numérateur :
     - (a) les coupes restées **différées (non résolues)** après le lot et la 2e passe ?
     - (b) les coupes **sautées en SKIP borné** (cas 1 à 5 + `aucun-point`) ?
     - (c) les **corrections de relecture en échec / refusées** par la page ou la garde (`correction-refusee`, `correction-incertaine`, erreur de capture) ?
     - (d) les coupes visitées où la relecture voit un écart $\ge \text{seuil}$ mais où **`relecture-critere.js` s'abstient** (confiance, cohérence, déplacement $> 45\text{ mm}$) ?
   - **En rejeu hors git sur les parties 20–22**, si l'on compare à une référence ou au journal du lot, quel critère précis en millimètres ou en statut définit l'échec d'une ER ?

6. **Action à déclencher lorsqu'une portion dépasse 10 % d'échec (ou reste sous la cible de 95 %)** :
   - **Choix 6A (Alerte et journalisation non bloquantes)** : consigner le bilan dans `relecture-fin` / `relecture-qualite-portion` et afficher une alerte visible dans le panneau sans arrêter la passe ni la Constellation ;
   - **Choix 6B (Pause ou repli en mode `ombre`)** : mettre la relecture en pause au point de reprise (ou basculer `corriger` $\rightarrow$ `ombre` sur le reste de la portion) ;
   - **Choix 6C (Arrêt de la passe)** : arrêter immédiatement la relecture en erreur avec le motif de dépassement des 10 %.
