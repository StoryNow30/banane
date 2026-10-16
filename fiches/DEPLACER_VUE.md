# Déplacer la vue d'ESV : relevés, pièce coupée, relevé de l'Écho (5.0, suite de D-147)

Branche `claude/50-deplacer-vue`, partie de `claude/50-base` (2c878f1). **Rien n'est activé** : le réglage `deplacerVue.actif` est à `false` et seule la direction l'active, après les vérifications du § 6 sur le vrai ESV. `src/engine.js` n'est pas touché, `DECISIONS.md` non plus. Aucune adresse, aucun identifiant de projet, aucune coordonnée absolue.

Vocabulaire : comme `fiches/VOIE_PREDITE.md`. « L'opérateur » désigne la personne qui travaille dans ESV. **Vérifié** : mesuré ici (navigateur, maquette, essais). **Supposé** : hypothèse nommée, non mesurée sur le vrai ESV.

## En bref

- **La pièce existe et est coupée.** `amenerDansLaVue(cote, cible, attendu)` (`src/adapter-page.js`) amène la cible d'un rail dans sa vue par un geste humain : dézoom à la molette, ou glisser au bouton gauche ; au plus 3 gestes par rail ; caméra relue et cible reprojetée après chaque geste ; vue remise ensuite ; sinon le cut reste différé. Le lot ne s'en sert que par le réglage `deplacerVue` (coupé), et seulement pour un cut qui tient la règle prudente D-147.
- **Coupé, rien ne change** : mêmes commandes envoyées à ESV, octet pour octet, que `claude/50-base` sur un lot rejoué en VM (empreinte SHA-256), et même suite d'événements dans la page pour `apply` et `restore` (§ 3).
- **Les gestes sont ceux de Chromium** (vérifié, § 1.1) : même suite, même ordre, mêmes champs qu'un vrai glisser et un vrai cran de molette, sauf `isTrusted` (impossible à reproduire) et le `click` qui termine un vrai glisser (volontairement omis : un clic dans la vue d'ESV pose le rail courant).
- **La maquette ESV ne réagit à aucun geste** (vérifié, § 1.2) : elle n'écoute sur sa vue que le `click` de pose. Sur elle, la pièce refuse (« caméra immobile ») et le cut reste différé : c'est le comportement sûr. Elle ne dit donc rien de ce qu'ESV fait d'un dézoom ou d'un glisser.
- **Avec un modèle de navigation supposé** greffé sur la maquette (§ 1.3), la pièce pose deux rails décalés de 210 mm (hors de la vue de ±200 mm) à 0,5 mm près, en un cran de molette, et remet la vue exactement ; le cut suivant s'ouvre à l'échelle habituelle.
- **L'Écho relève maintenant les glissers et les crans de l'opérateur** (observation seule, actif par défaut, § 4) : longueur, direction, durée, bouton, clic final, crans, caméra avant et après. C'est ce relevé qui doit fixer la forme des gestes d'Ariane avant toute activation.

## 1. Relevés

### 1.1 Chromium : ce qu'un vrai geste produit (vérifié)

`node tools/releve-gestes-vue.cjs navigateur` : Chromium 141, page locale, gestes de **confiance** envoyés par le protocole du navigateur (comme une vraie souris), écoutés sur la fenêtre. Référence gardée dans `tests/fixtures/gestes-chromium.json`.

| Geste | Suite produite (déplacements regroupés) | Champs relevés |
|---|---|---|
| Glisser au bouton gauche | `pointerdown`, `mousedown`, (`pointermove`, `mousemove`)…, `pointerup`, `mouseup`, **`click`** | pointerdown : button 0, buttons 1, pressure 0,5 ; pointermove : button −1, buttons 1 ; mousemove : button 0, buttons 1 ; pointerup : buttons 0, pressure 0 ; mousedown et mouseup : detail 1 ; le `click` est un PointerEvent (detail 1) |
| Glisser qui finit hors de la vue | même suite ; le `click` part sur l'ancêtre commun (BODY) | |
| Glisser au bouton droit | `pointerdown`, `mousedown`, **`contextmenu`** (sous Linux, dès l'appui), déplacements, `pointerup`, `mouseup`, `auxclick` | buttons 2 |
| Cran de molette (dézoom) | `wheel` seul | deltaY +100, deltaMode 0, wheelDeltaY −120, buttons 0 ; un écouteur historique `mousewheel` le reçoit aussi |
| Cran de molette (zoom) | `wheel` | deltaY −100, wheelDeltaY +120 |

Ce que la page **ne peut pas** reproduire (vérifié) :

- `isTrusted` reste faux pour tout événement émis par une page (comme le `click` de pose d'aujourd'hui).
- Un `wheel` synthétique **n'atteint jamais** un écouteur historique `mousewheel` (0 sur 1 ; un vrai cran : 2 sur 2). Une visionneuse qui n'écoute que `mousewheel` ignorera le dézoom d'Ariane.
- Sans `wheelDeltaY`, Chromium donne à un `wheel` synthétique un `wheelDelta` de **+100 pour deltaY +100** (vrai cran : −120) : une visionneuse qui lit `wheelDelta` zoomerait dans le **mauvais sens**. `src/gestes-vue.js` fournit `wheelDeltaY` (vérifié : −120).
- Des `mousedown`/`mouseup` synthétiques ne produisent ni événement de pointeur ni `click`.
- `pointerrawupdate` n'est produit que s'il a un écouteur ; il n'est pas émis.

La suite d'Ariane (`src/gestes-vue.js`) est comparée à cette référence dans `tests/gestes-vue.test.cjs` : glisser identique sans le `click` final (avec `clicFinal:true`, identique au `click` près) ; molette identique. Le pointeur est d'abord amené au point du geste (`pointermove`, `mousemove`) : une visionneuse zoome souvent vers la dernière position lue sur `mousemove`.

### 1.2 Maquette ESV locale (vérifié sur la maquette, pas sur ESV)

`node tools/releve-gestes-vue.cjs maquette --maquette DOSSIER` : maquette de `claude/esv-locale-audit` (DOSSIER = racine d'une copie de cette branche), adaptateur de cette branche injecté comme le fait le service worker.

| Question | Maquette | Vrai ESV |
|---|---|---|
| Les gestes synthétiques sont-ils pris en compte par la vue ? | **Non** : 3 crans → caméra immobile (0 mm, zoom ×1,000) ; glisser de 200 px → 0 mm. La maquette n'a aucun écouteur de molette ni de glisser sur sa vue. `amenerDansLaVue` rend « camera-immobile » après un geste, ne clique pas, ne bouge aucun rail. | **Inconnu.** Dépend des types écoutés (`wheel` ou `mousewheel`, `mousedown` ou `pointerdown`) et d'un éventuel contrôle d'`isTrusted` (§ 6). |
| Déplacement en mm d'un glisser de N px à la vue habituelle | Aucun (vue sourde). Taille du pixel : **0,524 mm** (vue de 763 × 943 px pour 0,4 unité de scène). | **Supposé** si la vue suit la souris pixel pour pixel : N × taille du pixel, soit 0,38 mm/px à la vue de 1 042 px de la fiche VOIE_PREDITE (196 px → 75 mm), 0,54 mm/px à la vue de la partie 12. Une visionneuse de type Potree peut déplacer la vue en proportion de son rayon, pas du pixel : **gain inconnu**. La pièce mesure le gain sur son premier glisser et corrige les suivants ; l'Écho le mesurera sur les glissers de l'opérateur (`camera.deplacementMm` / `dxPx`). |
| Le zoom ou la translation persistent-ils au cut suivant ? | Non : la maquette recalcule la vue (centre et échelle) à chaque bouton de rail et à chaque cut (échelle relative au cut suivant : 1,000000). C'est un choix de la maquette. | **Inconnu.** L'Écho le dira (caméra avant et après chaque geste, puis la vue relevée par l'Écho au cut suivant). La pièce ne compte pas dessus : elle remet la vue elle-même et vérifie l'échelle. |
| Les nœuds du nuage se rechargent-ils ? Requêtes de lecture par geste ? | **0 requête** de nœuds par geste : la maquette charge les nœuds d'un cut une fois, au chargement du cut, quelle que soit la vue. Ce n'est pas une mesure d'ESV. | **Inconnu, à mesurer en premier** (§ 5) : Potree choisit ses nœuds avec la caméra ; un dézoom élargit la vue (nœuds de bord), un glisser la déplace. |
| Comment remettre la vue habituelle ? | Le bouton du rail suffit sur la maquette (vue recalculée). | **Supposé** : crans de molette dans l'autre sens (autant que de crans nets), et bouton du rail après un glisser. La pièce relit l'échelle et exige un écart d'au plus 2 % (`remiseTolerance`) ; sinon le lot s'arrête (« Vue ESV non restituée », état à réconcilier). |
| Taille du pixel après dézoom (seuil 0,9 mm) | ×1,1 : 0,58 ; ×1,25 : 0,66 ; ×1,38 : 0,72 ; ×1,5 : 0,79 mm. Seuil atteint à ×1,72. | Vue de 1 042 px : ×1,1 : 0,42 ; ×1,25 : 0,48 ; ×1,38 : 0,52 ; ×1,5 : 0,57 mm ; seuil à ×2,37. La pièce n'émet jamais un dézoom qui dépasserait 0,9 mm (elle prend le glisser s'il tient dans sa limite). |

### 1.3 Maquette + modèle de navigation supposé (la pièce jouée)

`tests/helpers/modele-navigation.js` greffe sur la vue une navigation orthographique **que j'ai écrite, pas celle d'ESV** : molette = zoom centré de 10 % par cran (`wheel`, ou `mousewheel` seul en variante), glisser gauche = translation 1 pour 1, amortissement sur 3 images, zoom gardé ou remis au recentrage. Résultats (outil, partie C) :

| Cas | Zoom gardé au recentrage | Zoom remis au recentrage |
|---|---|---|
| Cible à 260 mm (NDC 1,30), dézoom | 1 geste de 3 crans, facteur mesuré 1,100 par cran, NDC 0,977, pixel 0,698 mm ; vue remise par 3 crans inverses, écart d'échelle 0 | idem |
| Même cible, dézoom interdit (×1,01) | 1 glisser de 191 px vers la gauche, gain mesuré 1,00, NDC 0,799 ; vue recentrée par le bouton du rail | idem |
| Pose de deux rails décalés de 210 mm (`apply` avec le plan) | gauche : 1 cran (0,32 s) ; droit : déjà dans la vue grâce au zoom gardé ; posés à 210,5 et 210,4 mm ; 1 cran rendu | gauche et droit : 1 cran chacun ; posés à 210,5 et 210,4 mm ; 1 cran rendu |
| Cut suivant | échelle habituelle (1,000000) | idem |
| Erreurs de page | aucune | aucune |

Les mêmes cas, et ceux qui doivent échouer, sont dans `tests/deplacer-vue-page.test.cjs` (VM, horloge simulée) : vue sourde → « camera-immobile » ; écouteur `mousewheel` seul → « camera-immobile » ; cran presque sans effet → 3 gestes puis « gestes-epuises », vue remise ; cible à 600 mm → « hors-limites », aucun geste ; dézoom qui dépasserait 0,9 mm → glisser ; vue sourde dans `apply` → erreur **avant tout clic**, rien posé.

## 2. Méthode : la pièce et son branchement

### Dans la page (`src/adapter-page.js`, `src/gestes-vue.js`)

`amenerVue`, appelée par `clickPosition` entre `select` et la lecture de caméra qui sert au clic, seulement si le service worker a passé un plan :

1. caméra lue, cible projetée ; dans la vue (marge de 1 %) : rien ;
2. sinon : **dézoom** si la vue entière tient (zoom total ≤ `dezoomMax` ×1,5 et pixel ≤ `pixelMaxMm` 0,9 mm) ; nombre de crans d'après le facteur supposé (1,1) puis **mesuré** ; sinon **glisser** si le dépassement tient dans `glissementPxMax` (250 px), visant NDC 0,8, départ loin du rail sélectionné (au centre de la vue) ; sinon refus « hors-limites » ;
3. geste émis (suite de Chromium, crans espacés de 60 à 140 ms, glisser de 220 à 420 ms à pas de 16 ms, vitesse en cloche, positions entières), caméra attendue **immobile** (3 comparaisons à 80 ms, à 1 µm et 1e-6 d'échelle près), **relue**, cible **reprojetée** ;
4. au plus `gestesMax` (3) gestes ; caméra immobile, mauvais sens de molette, pixel trop grand : arrêt ; un rail déplacé par un geste : erreur (« État à réconcilier ») ;
5. après la pose des deux rails, `remettreVue` : crans nets rendus (par séries), bouton du rail après un glisser, échelle relue.

Avec un plan, la pose directe du mode rapide (P1) n'est pas employée sur ce cut. Une cible que la pièce n'amène pas fait lever `apply` avec « Vue ESV non amenée … rien n'a été posé » (premier rail) ; au second rail, le premier est déjà posé : « État à réconcilier », comme tout clic qui échoue aujourd'hui.

L'action de page `amenerDansLaVue` (permise par le pont) fait la même chose **sans jamais cliquer** et remet toujours la vue : c'est le pré-vol, et l'outil de relevé.

### Dans le service worker (`background.js`, `commandLot`)

Réglage `deplacerVue` (`src/settings.js`) : `actif:false`, `etages:['window']`, `regle:'prudente'`, `gestesMax:3`, `dezoomMax:1.5`, `glissementPxMax:250`, `pixelMaxMm:0.9`, `remiseTolerance:0.02`, `preVol:true`, formes de `molette` et de `glisser` (provisoires). Actif, pour un cut dont la commande du lot est refusée **seulement** par la vue (`hors-vue-left|right`, KI-051) :

1. étage permis (« window » : le moteur a retrouvé lui-même les deux rails autour de la voie) ;
2. **règle prudente D-147** (`regle:'prudente'`) : moteur recentré sur la voie du lot (même décision ; sa confiance), confiance ≥ 55 sur chaque rail, chaîne ≤ 10 poses, écartement à 10 mm des appuis, écart à la voie ≤ 30 mm, seuils lus dans `voiePrediteOmbre`. Sans elle, le rejeu D-147 donne 38 poses dont 1 fausse (étage « window » seul) au lieu de 27 sans faute ;
3. avec des vues élargies, la commande du lot doit passer (toutes les autres gardes inchangées) ;
4. geste nécessaire par rail, d'après la caméra de la capture (`vueNecessaire`) : dézoom ou glisser dans les limites, sinon refus ;
5. **pré-vol** : la page essaie le geste sur chaque rail concerné, sans rien poser, et remet la vue ; un échec laisse le cut **différé, comme aujourd'hui** ;
6. la commande devient celle du lot, avec le plan, qu'`apply` passe à la page.

Événements : `deplacer-vue` (phase `decision` : plan ou refus, ce que la règle a lu, pré-vol ; phase `pose` : rapport par rail et remise), `deplacer-vue-geste` (chaque geste et la remise, en direct). Ni position, ni cible : des NDC, des facteurs, des pixels, des comptes.

Essais : `tests/deplacer-vue-sw.test.cjs` (coupé), `tests/deplacer-vue-sw-actif.test.cjs` (plan, pré-vol, pose ; pré-vol refusé → différé, mêmes commandes qu'aujourd'hui), `tests/deplacer-vue-sw-regle.test.cjs` (règle non tenue → différé, aucune commande de plus). Service worker réel en VM, moteur et GCV1 réels, ESV simulé (le cut 112 a sa pose de départ à 230 mm de la voie : NDC 1,34, dézoom ×1,35).

## 3. Coupé, rien ne change : la preuve

- **Commandes à ESV** (`tests/deplacer-vue-sw.test.cjs`) : un lot de deux cuts (111 posé, 112 différé pour la vue), réglages livrés. Les commandes envoyées à la page, neutralisées des seuls identifiants et horloges, ont la **même empreinte SHA-256** que celles du code de `claude/50-base` (2c878f1) sur le même montage (`tests/fixtures/lot-sans-vue-50-base.json`, tirée de 2c878f1) ; mêmes actions, même nombre d'arguments (`apply` : 2), mêmes appels à ESV, mêmes événements, mêmes décisions (empreinte identique). Aucune action `amenerDansLaVue`, aucun événement `deplacer-vue`.
- **Événements dans la page** (`tests/deplacer-vue-page.test.cjs`, dernier essai) : `apply` puis `restore` sans option envoient exactement la même suite (boutons, clics, coordonnées, étapes) que l'adaptateur de `claude/50-base` (`tests/fixtures/apply-sans-vue-50-base.json`, tirée de 2c878f1), y compris quand la page croit le réglage actif : la page n'agit que sur le plan envoyé par le service worker.
- Le moteur (`src/engine.js`) ne connaît pas le réglage (essai).

Ce qui change même coupé, à savoir : la page reçoit un fichier de plus (`src/gestes-vue.js`, un objet global `BananeGestesVue`) ; le pont accepte l'action `amenerDansLaVue` (que seul le service worker envoie, réglage actif) ; et, en session Écho, le relevé des gestes (§ 4, écouteurs passifs).

## 4. Écho : relevé des glissers et de la molette de l'opérateur

Réglage `echo.gestesVue` (**actif**, observation seule ; `false` : aucun écouteur). Pendant une session Écho, l'adaptateur pose sur la fenêtre des écouteurs **passifs, en phase de capture** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `click`, `auxclick`, `contextmenu`, `wheel`) ; il n'empêche ni n'arrête rien, ne retient que les événements de confiance qui visent la vue d'ESV, lit la caméra au premier événement du geste (avant qu'ESV ne le traite) et quand elle est de nouveau immobile. Un événement `operator-gesture` par geste :

- **glisser** : bouton et masque de boutons, dx et dy nets (px), distance, longueur du trajet, nombre de pas, durée (ms), clic final (`click`), `auxclick`, menu contextuel, fin hors de la vue ; un simple clic de pose (déplacement < 3 px, bouton gauche) n'est pas relevé (l'Écho le consigne déjà) ;
- **molette** : série de crans (pause > 400 ms = nouvelle série) : nombre, sens, les 4 premiers deltaY, deltaMode, somme, wheelDeltaY, durée, intervalle médian ;
- **caméra** avant et après : taille du pixel (mm) et taille de la vue (px), déplacement de la caméra dans son propre repère (mm : droite, haut, profondeur), zoom ; jamais de position.

Il ne compte pas comme geste de correction : la pose de départ, les lectures LiDAR, les intentions et le classement de la visite sont inchangés (essai `tests/echo-gestes-vue.test.cjs`). Poids : environ **0,9 Ko** au journal (`native-operator-gesture`) et **0,43 Ko** dans la visite (32 gestes gardés au plus par visite, plus un compte jamais tronqué : `gestesVueResume`) ; non essentiel, il cède le premier sous charge.

Ce qu'il dira : le bouton réellement employé (D-043 disait « droit », D-147 dit « gauche ») ; si un glisser de l'opérateur se termine par un `click` (Chromium le fait) sans poser le rail ; le gain du glisser et le facteur par cran d'ESV ; la durée et le nombre de pas d'un glisser humain ; deltaY réel de la molette sur le poste (Edge, mise à l'échelle de l'écran) ; si le zoom survit au bouton du rail et au cut suivant (vue relevée par l'Écho à l'arrivée sur le cut) ; avec les relevés `resource` de l'observateur, les lectures de nuage pendant un geste (heure `debutMs`).

## 5. Risques pour la trace (D-151)

Le déplacement de vue n'écrit rien sur le serveur : il ne change ni les écritures, ni leurs champs, ni leur ordre (D-151 : identiques à l'humain). Ce qu'il peut changer :

1. **Lectures de nuage** (risque moyen de D-151, déjà ×1,4 à ×2,4) : chaque dézoom ou glisser peut faire charger des nœuds, et le **pré-vol double les gestes** (essai puis pose). L'opérateur fait lui aussi des gestes sur ces cuts (deux glissers par cut en médiane sur les cuts hors de la vue, VOIE_PREDITE), mais un seul passage. À mesurer avant d'activer ; si les lectures par geste comptent, couper le pré-vol (`preVol:false`) une fois la réponse d'ESV connue, au prix d'une erreur possible au second rail au lieu d'un différé.
2. **Événements synthétiques** : `isTrusted` faux, comme le `click` de pose. Invisibles du serveur, sauf télémétrie cliente d'ESV (TRACE_ESV, vérifications 1 et 2).
3. **Écarts de forme avec un geste humain** (côté page seulement) : pas de `click` à la fin du glisser ; pas de `pointerrawupdate` ; pas d'entrée du pointeur dans la vue (`pointerover`, `pointerenter`) ni de trajet depuis le bouton du rail : le pointeur « apparaît » au point du geste. Durées et pas sont provisoires tant que l'Écho ne les a pas relevés.
4. **Rythme** : un geste coûte 0,3 à 0,9 s (modèle supposé), le pré-vol autant : le cycle de ces cuts s'allonge, ce qui va plutôt vers le rythme humain.
5. **Déjà vrai aujourd'hui, à savoir** : la pose directe du mode rapide (P1) clique avec la caméra du rail précédent, à des coordonnées qui peuvent tomber hors de la vue visible ; un humain ne le peut pas. Ce n'est pas changé ici (le plan de vue désactive P1 sur le cut concerné).

## 6. À vérifier sur le vrai ESV avant que la direction active

Chaque point se fait sans rien valider, en observation, ou à la main par l'opérateur :

1. **Ce qu'écoute la vue.** Dans la console des outils de développement d'Edge, sur une coupe ouverte : `getEventListeners(viewer.renderer.domElement)`, puis `getEventListeners(document)` et `getEventListeners(window)`. Noter les types (`wheel`, `mousewheel`, `DOMMouseScroll`, `pointerdown`, `mousedown`, `mousemove`, `click`). **Si la molette n'est écoutée qu'en `mousewheel`, le dézoom d'Ariane n'agira pas** (§ 1.1) : le cut restera différé (sûr), et il faudra décider s'il est permis d'émettre un `mousewheel` synthétique, ce qu'aucun humain ne produit directement.
2. **`isTrusted`** : chercher `isTrusted` dans le code de la page (TRACE_ESV, vérification 2). Un contrôle sur la molette ou la souris rendrait la pièce inopérante (refus « camera-immobile », cut différé).
3. **Une session Écho de quelques cuts hors de la vue**, gestes de l'opérateur comme d'habitude, puis lecture des `operator-gesture` : bouton, `clic` après glisser (et le rail n'a pas bougé ?), crans par geste, deltaY, gain mm par px (`camera.deplacementMm[0] / dxPx`), zoom par cran, durées, nombre de pas. Régler `molette` et `glisser` dans `deplacerVue` sur ces valeurs.
4. **Persistance** : après un dézoom, le bouton du rail et le cut suivant remettent-ils l'échelle ? (même session : `camera.apres` puis la vue de la visite suivante). Si ESV remet l'échelle seul, la remise par crans inverses ne sert qu'au dernier rail.
5. **Remise symétrique** : n crans de dézoom puis n crans de zoom rendent-ils l'échelle d'origine à 2 % près ? Une visionneuse à facteur ×1,1 puis ×0,9 perd environ 1 % par aller-retour : à 3 crans, la remise peut dépasser la tolérance et le lot s'arrêterait (« Vue ESV non restituée »).
6. **Lectures** : pendant un geste manuel, onglet Réseau (journal conservé) ou relevés `resource` de l'observateur : combien de requêtes de nœuds par cran et par glisser ?
7. **Le glisser sur un rail** : un appui (mousedown) sur l'objet rail fait-il glisser le rail dans ESV ? La pièce part loin du rail sélectionné, mais l'autre rail ou un objet peut se trouver sous le point de départ. (La pièce lève une erreur si un rail a bougé, mais le rail aura bougé.)
8. **Taille de la vue** de l'opérateur (largeur en px) : elle fixe la taille du pixel (§ 1.2).
9. **Premier essai actif** : sur la maquette locale d'abord (la pièce doit y refuser proprement), puis un lot court sur une partie à voie décalée, l'opérateur présent, `preVol:true`, en relisant chaque `deplacer-vue` et `deplacer-vue-geste`.

## 7. Doutes

- Le modèle de navigation des essais est le mien : il prouve la logique de la pièce (boucle fermée, limites, remise), pas la réaction d'ESV. Une visionneuse amortie qui n'atteint jamais sa cible au bit près est couverte par la tolérance de stabilité ; une visionneuse qui bouge encore après 240 ms d'immobilité apparente ne l'est pas.
- La pièce mesure le facteur d'un cran et le gain du glisser sur le premier geste ; si ESV n'est pas linéaire (zoom vers le curseur, inertie), les gestes suivants corrigent, dans la limite de 3.
- Chromium termine un vrai glisser par un `click`. Si un glisser de l'opérateur ne pose pas le rail, c'est qu'ESV distingue ce clic d'un clic de pose ; on ne sait pas comment. Tant que ce n'est pas su, Ariane n'émet pas ce clic (`clicFinal:false`).
- La règle prudente est appliquée au cut décidé par le lot (reprise depuis la voie). Elle ne fait pas de la voie prédite une source de pose de plus : l'ombre `voie-predite-ombre` reste une ombre.
- Le pré-vol a lieu pendant l'analyse du cut, avant la pause éventuelle pour faible confiance : un pré-vol peut être fait pour un cut qui ne sera finalement pas posé.
- Le relevé de l'Écho lit la caméra au premier `pointerdown` ou au premier cran : si ESV a déjà bougé la vue à ce moment (autre écouteur en capture plus tôt), la caméra « avant » serait déjà décalée.
- Les fixtures de comparaison avec 50-base sont figées : un changement ultérieur légitime de la commande ou de la page les fera échouer ; il faudra les retirer de la nouvelle base (procédure au § 8).

## 8. Rejouer

```
node tools/releve-gestes-vue.cjs navigateur [--fixture tests/fixtures/gestes-chromium.json]   # Chromium : vrais gestes, synthétiques, suite d'Ariane
node tools/releve-gestes-vue.cjs maquette --maquette DOSSIER [--json SORTIE.json]            # maquette ESV (+ modèle supposé)
node --test tests/gestes-vue.test.cjs tests/deplacer-vue-page.test.cjs tests/deplacer-vue-sw.test.cjs \
     tests/deplacer-vue-sw-actif.test.cjs tests/deplacer-vue-sw-regle.test.cjs tests/echo-gestes-vue.test.cjs
```

Playwright et Chromium sont nécessaires pour l'outil (hors du banc) ; les essais tournent sous Node seul. Fixtures 50-base : produites en jouant `tests/helpers/vue-page.cjs` (apply puis restore, propositions de la fixture) et `tests/helpers/deplacer-vue-lot.cjs` (lot 111-112, réglages livrés) sur une copie de 2c878f1.
