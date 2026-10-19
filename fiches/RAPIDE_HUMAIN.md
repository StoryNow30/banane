# Clic humain du mode rapide (D-157) : trois réglages, un garde-fou, mesures

Branche `claude/50-rapide-humain` (base `claude/50-base`, c2dc0e0), 17 octobre 2026. `src/engine.js` n'est pas touché, `DECISIONS.md` non plus. **Tout est coupé par défaut** : `pilote.rapide.clicHumain = 'tel-quel'` garde le comportement d'avant à l'octet près. Mic n'a qu'un réglage à choisir.

## Réponse courte

- **Les deux modes corrigés suppriment tous les clics hors vue** : 0 sur 185 cuts rapides en partie 29, 0 sur 205 en partie 1 du second projet. En `'tel-quel'`, le banc en retrouve **185 et 205**, autant que l'enquête : un par cut rapide, toujours le rail gauche.
- **Mêmes poses, mêmes décisions, aucun cut différé en plus** dans les deux lots. Les poses sont à 1 mm de la cible et à 0,45 mm au plus de celles de `'tel-quel'`.
- **Le coût est du temps de pose** : +0,32 s par cut rapide pour `'gauche-recentre'`, +0,65 s pour `'tout-recentre'`. Sur la durée réelle des lots, cela fait +9 % et +18 % en partie 29, et +6 % et +12 % en partie 1.
- **Recommandation : `'tout-recentre'`**, parce que Mic exige une trace humaine. `'gauche-recentre'` coûte moitié moins, mais garde un clic machinal sur le rail droit : il part moins d'une milliseconde après le bouton (§ 7).
- **Arrondi des demi-pixels** : Chromium prend l'entier inférieur. Sur les lots réels, l'écart de pose est toujours entre −1 et 0 pixel en horizontal et entre 0 et +1 en vertical (372 cuts sur 372). Ça donne un biais d'un demi-pixel, environ 0,19 mm par axe. La reprise à +0,5 vise le pixel le plus proche. Celle à −0,5 ne sert jamais, et une fois sur deux, une des deux reprises refait exactement le premier clic. Rien n'est modifié (§ 5).

## 1. Le problème

En mode rapide (9 cuts sur 10), la pose directe (`poseDirecte`, D-088) presse le bouton du rail gauche puis clique dans la même tâche, avec la caméra encore active. Après la capture, cette caméra est celle du rail **droit**. La cible gauche y projette vers NDC x ≈ −7 : le clic part à environ 2 100 px à gauche du canevas, hors de la fenêtre. ESV l'accepte et pose juste, mais un humain ne peut pas faire ce clic. L'enquête est dans le carnet de la session (`clic-hors-vue/RAPPORT.md`), et le constat dans D-157.

## 2. Le réglage `pilote.rapide.clicHumain`

Dans `src/settings.js`, `pilote.rapide`. Ce n'est pas une pièce du mode rapide : il ne figure pas dans `readStrategy.pieces`.

| Valeur | Ce que fait la pose d'un cut rapide | Surcoût par cut rapide (banc) |
|---|---|---|
| `'tel-quel'` (défaut) | Comme avant : rail gauche puis droit, en direct, depuis la vue active. Le clic gauche part hors de la fenêtre. | 0 |
| `'gauche-recentre'` | Rail **droit** d'abord, en direct : sa cible est dans la vue active. Puis rail gauche avec recentrage (sélection, attente, clic dans la vue). | +0,32 s (un recentrage) |
| `'tout-recentre'` | Les deux rails avec recentrage : exactement le chemin des cuts de référence (la même trace que `rapide.pose = false`). | +0,65 s (deux recentrages) |

Une valeur absente ou inconnue vaut `'tel-quel'`. Dans les deux modes corrigés, le mode est consigné par cut dans l'export (`readStrategy.clicHumain`). En `'tel-quel'`, la capture est celle d'avant.

**Les deux modes corrigés ne cliquent jamais hors de la partie visible du canevas.** La partie visible, c'est le point du clic avec ses NDC dans ±0,99 (la marge du lot, KI-051, et de « déplacer la vue »), et dans la fenêtre quand la page en donne la taille (`innerWidth`, `innerHeight`).

- **Pose directe** : la cible est contrôlée dans la vue active **avant** de presser le bouton du rail. La caméra ne change pas quand on le presse (D-088), donc le contrôle vaut pour le clic. Hors de la partie visible, rien n'est pressé ni cliqué : le rail passe par la pose avec recentrage, le repli existant (`apply-repli` au journal).
- **Après recentrage** (référence, repli, rail gauche de `'gauche-recentre'`, restauration) : le clic hors de la partie visible est refusé comme une cible hors de la vue, avec le même message (« Position proposée hors de la vue »), et sans clic. Avant, la borne était [-1, 1] ; elle passe à ±0,99 dans les modes corrigés. Le lot diffère déjà ces cuts avant la pose (KI-051, même marge, mêmes caméras), donc ce refus ne doit pas se voir en lot.

**L'ordre est vérifié.** Le rail droit est bien celui dont la vue est active :

- dans le code : la capture sélectionne le rail gauche puis le droit (`capture`, boucle `['left','right']`), et rien ne sélectionne de rail entre la capture et la pose ;
- dans les lots : la dernière caméra de la capture (`camera`) est celle du rail droit pour **210 cuts posés sur 210** en partie 29 et **224 sur 224** en partie 1 (relevé par le banc sur les caméras du corpus) ;
- et si la vue active était celle du gauche (pose assistée, reprise), `'gauche-recentre'` le voit avant de presser : le rail droit est recentré aussi, sans clic hors vue (essai « vue active sur le rail gauche »).

## 3. Garde-fou `clic-hors-vue`, quel que soit le mode

Il ne change rien. Il compte.

- **Page** (`src/adapter-page.js`) : chaque clic de pose calculé hors de la partie visible (même définition) est relevé, avec le rail, le chemin (`directe` ou `recentre`), l'essai (1 à 3, reprises décalées comprises), la raison (`hors-canevas`, `marge`, `hors-fenetre`), le mode du cut, les NDC et les coordonnées. Le relevé part **après la réponse** de l'application ou de la restauration (message `banane3:clic-hors-vue`, comme le relevé D4). Le clic part comme avant.
- **Pont** (`src/bridge.js`) : relais au service worker.
- **Service worker** (`background.js`) : journal seul, `store.putEvent` sans attente, jamais `engine.event`. Ni décision, ni commande, ni fenêtre d'événements du moteur n'en dépendent.
  - Un compteur par lot : `batch.clicsHorsVue.total`.
  - Les **cinq premiers clics** du lot en exemples : événement `clic-hors-vue`, un par relevé, avec le total courant.
  - Un **bilan** à la fin du lot s'il y en a eu : `clic-hors-vue-bilan` (total, exemples, état du lot). Aucun événement veut dire aucun clic hors vue.
  - Hors lot (Écho, pose assistée) : un compteur pour la vie du service worker, cinq exemples.
- **Poids** : en `'tel-quel'`, sur un lot de 200 cuts rapides, environ 5 petits événements et un bilan, au lieu d'un événement par cut.

## 4. Mesures sur le banc

**Méthode** (`tools/rapide-humain.cjs`, à partir de `tools/cycle-ombre.cjs`, `fiches/CYCLE_OMBRE.md`) :

- Le vrai `background.js` (moteur et GCV1 réels) rejoue chaque lot en entier : 245 visites en partie 29, 351 en partie 1 du second projet. Il sert les vrais nuages, et chaque capture répond après la durée relevée au journal.
- Chaque **application** passe par le **vrai `src/adapter-page.js`**, contre une page ESV simulée (`tests/helpers/esv-clic.cjs`). Pour chaque cut, elle porte les rails de départ et les deux caméras de la capture : matrices, projection, rectangle du canevas 1 042 × 944 px, fenêtre de 2 133 × 1 080 px. La vue active est la dernière caméra de la capture.
- Le bouton d'un rail change le côté tout de suite, et la caméra à l'image suivante. Le clic pose le rail du côté courant, au point où le rayon de la caméra active coupe le plan de coupe, sur l'entier inférieur de Chromium.
- La pose obtenue est rendue au service worker, ainsi que les relevés `clic-hors-vue`.
- Les attentes de la page sont de vraies minuteries. Elles sont multipliées, comme les captures, par le rapport de vitesse de la machine (`cycle-ombre.cjs etalon`) : **1,9** en partie 29 et **2,4** en partie 1. Les temps ci-dessous sont **ramenés au terrain** (divisés par ce rapport).
- Les trois modes ont tourné **en même temps**, un processus par mode, sur la même charge (4 cœurs). Le verrou `lourd.lock` était posé et la priorité basse (`nice 10`). La charge allait de 1 à 4,7, à cause d'une autre session.

**Calage** : la pose d'un cut de référence dure **646 ms** au banc, contre **664 à 673 ms** au journal des deux lots. La pose directe dure 0,3 ms au banc, contre 3,7 ms en médiane au journal. Le banc retrouve exactement les poses et les différés du terrain : 210 / 34 en partie 29, 224 / 127 en partie 1.

| | Partie 29 : `tel-quel` | `gauche-recentre` | `tout-recentre` | Partie 1 (2ᵉ projet) : `tel-quel` | `gauche-recentre` | `tout-recentre` |
|---|---:|---:|---:|---:|---:|---:|
| Pose d'un cut rapide, médiane | 0,3 ms | **323 ms** | **646 ms** | 0,3 ms | **323 ms** | **646 ms** |
| Pose d'un cut de référence, médiane | 646 ms | 646 ms | 646 ms | 646 ms | 646 ms | 646 ms |
| Temps par cut rapide en plus | 0 | +0,32 s | +0,65 s | 0 | +0,32 s | +0,65 s |
| Durée du lot au banc, écart à `tel-quel` (ramené au terrain) | 0 | +69 s | +118 s | 0 | +66 s | +171 s |
| Durée du lot sur le terrain : journal + temps de pose en plus | 647 s | **707 s (+9 %)** | **767 s (+18 %)** | 1 065 s | **1 131 s (+6 %)** | **1 197 s (+12 %)** |
| Cycle médian sur le terrain (journal), cut rapide | 2,02 s | ≈ 2,34 s | ≈ 2,67 s | 2,57 s | ≈ 2,89 s | ≈ 3,22 s |
| **Clics hors de la partie visible** | **185** (rail gauche, 185 cuts rapides sur 185) | **0** | **0** | **205** (rail gauche, 205 sur 205) | **0** | **0** |
| Relevés `clic-hors-vue` : page / compteur du lot / bilan | 185 / 185 / 185 | 0 / – / aucun | 0 / – / aucun | 205 / 205 / 205 | 0 / – / aucun | 0 / – / aucun |
| Événements `clic-hors-vue` au journal | 5 exemples et 1 bilan | 0 | 0 | 5 exemples et 1 bilan | 0 | 0 |
| Poses à 1 mm de la cible | 210 / 210 (max 0,53 mm) | 210 / 210 (0,53) | 210 / 210 (0,53) | 224 / 224 (0,51) | 224 / 224 (0,51) | 224 / 224 (0,51) |
| Poses identiques à `tel-quel` à 1 mm près | – | **210 / 210** (écart max 0,45 mm) | **210 / 210** (0,45 mm) | – | **224 / 224** (0,41 mm) | **224 / 224** (0,41 mm) |
| Décisions du lot identiques à `tel-quel` | – | oui | oui | – | oui | oui |
| Cuts différés (en plus) | 34 | 34 (**+0**) | 34 (**+0**) | 127 | 127 (**+0**) | 127 (**+0**) |
| Replis (`apply-repli`), erreurs de la page | 0, 0 | 0, 0 | 0, 0 | 0, 0 | 0, 0 | 0, 0 |
| Vue active au début de la pose : rail droit | 210 / 210 | 210 / 210 | 210 / 210 | 224 / 224 | 224 / 224 | 224 / 224 |

Lecture :

- **La seule différence entre les modes est le temps de pose**, et il est fixe : un recentrage coûte 323 ms (quatre sondages à 80 ms, la règle des trois lectures stables). La durée du lot au banc suit, à la charge près. On a mesuré +69 s et +66 s pour +60 s et +66 s attendus (185 et 205 cuts × 0,323 s), puis +118 s et +171 s pour +120 s et +132 s attendus. Le +171 s est plus haut que prévu parce que l'autre session chargeait la machine.
- **Les cycles absolus du banc ne sont pas ceux du terrain** : 3 à 6 s, une fois ramenés. Trois lots tournaient en même temps sur 4 cœurs chargés, et le calcul du service worker y est plus lent que le rapport de vitesse mesuré seul. C'est pourquoi la durée du lot sur le terrain est donnée par le journal, plus le temps de pose en plus, qui ne dépend pas de la charge.
- **Les poses diffèrent de moins d'un pixel** (0,45 mm au plus) entre `'tel-quel'` et les modes corrigés. Le rail gauche n'est plus cliqué depuis la même caméra, donc il tombe sur une autre phase du pixel. Les décisions suivantes du lot n'en sont pas changées.
- Le coût de `'tout-recentre'` (+0,65 s par cut rapide) rapproche le cycle de celui de l'opérateur (D-151) : 2,67 s contre 2,22 s chez lui en partie 29, et 3,22 s contre 3,26 s en partie 1.

Sorties brutes (hors dépôt) : `banc-p29.json` et `banc-p1.json`, dans le carnet de la session.

## 5. Arrondi des demi-pixels (`DECALAGES_CLIC`), sans modification

**Ce qui se passe.** `DECALAGES_CLIC = [[0,0],[.5,.5],[-.5,-.5]]` décale les reprises d'un demi-pixel. Un `MouseEvent` synthétique de Chromium garde l'**entier inférieur** de `clientX` et `clientY` (relevé dans Chromium 141 pendant l'enquête : −2 307,6 donne −2 308, et 132,6 donne 132). ESV calcule son rayon à partir de ces entiers.

**Vérifié sur les lots réels.** On compare la pose relue (`applied-verified`) à la cible (pose de départ plus le delta proposé), pour les cuts posés sur proposition du moteur. L'écart, ramené en pixels de l'écran, a exactement la signature de l'entier inférieur :

| | horizontal (px) | vertical (px) |
|---|---|---|
| Partie 29, 182 cuts, rails gauche et droit | toujours dans ]−1 ; 0], médianes −0,51 et −0,56 | toujours dans [0 ; 1[, médianes +0,47 et +0,49 |
| Partie 1 du 2ᵉ projet, 190 cuts | toujours dans ]−1 ; 0], médianes −0,47 et −0,53 | toujours dans [0 ; 1[, médianes +0,47 et +0,53 |

C'est l'observation de la 4.8.0 (« −1 à 0 pixel en horizontal, 0 à +1 en vertical », commentaire de `DECALAGES_CLIC`) : elle ne vient pas d'ESV mais de Chromium.

**Ce que ça change :**

1. **Un biais d'un demi-pixel sur chaque pose**, soit environ 0,19 mm par axe à 0,384 mm par pixel. Les deux rails sont posés un peu vers la gauche de l'écran : l'écartement ne change pas, l'axe de la voie se décale de 0,19 mm. Ils sont aussi posés un peu plus haut, environ +0,19 mm en hauteur. C'est sans effet sur le seuil de 1 mm de la pose, et minime devant les seuils de 5 et 10 mm des faux verts (D-158, D-160). Au plus, l'écart vaut un pixel par axe, soit 0,54 mm : la première pose est toujours acceptée dans la vue habituelle. Au banc, il y a eu **0 reprise** sur les 434 cuts posés de chaque mode. Au journal, les reprises ne sont pas consignées, mais l'écart relevé ne dépasse jamais un pixel par axe : il n'en demande pas.
2. **Les reprises ne valent pas ce que dit le commentaire.** `floor(x + 0,5)` est le pixel **le plus proche** : la 2ᵉ reprise est la seule utile. `floor(x − 0,5)` vaut `floor(x)` ou `floor(x) − 1` : la 3ᵉ reprise n'est jamais meilleure que la 2ᵉ. Sur chaque axe, les trois clics ne visent que deux pixels. La 2ᵉ reprise refait exactement le 1ᵉʳ clic quand les deux parties fractionnaires sont sous 0,5 (une fois sur quatre), et la 3ᵉ le refait quand elles sont toutes deux au-dessus (une fois sur quatre). **Une fois sur deux, une reprise refait le même clic au même pixel**, quelques millisecondes après. Ces reprises n'arrivent qu'avec une fenêtre d'ESV rétrécie (à partir de 0,9 mm par pixel environ, le cas de la 4.8.0). Le pixel le plus proche (2ᵉ essai) suffit alors : 0,48 mm par axe au plus.
3. **Aucun effet sur la marge de 0,99** : elle laisse 5 pixels au bord du canevas, et l'arrondi en retire au plus un.
4. **Aucune trace fractionnaire** : l'événement porte déjà des entiers, comme un vrai clic.

**Correction possible, non faite, à décider** : viser l'entier le plus proche (`Math.round`) et faire des reprises d'un pixel entier. Le biais disparaîtrait et les reprises ne se répéteraient plus. Mais chaque pose bougerait d'un pixel au plus, et `'tel-quel'` ne serait plus identique à l'octet.

## 6. Essais

- `tests/rapide-humain.test.cjs` (page, ESV simulé `tests/helpers/esv-clic.cjs`, neuf scénarios) :
  - `'tel-quel'`, par défaut, explicite ou inconnu, donne la même trace à ESV que le code de base, **octet pour octet** : boutons pressés, événements du canevas, étapes, poses, durée et erreur. L'empreinte `tests/fixtures/rapide-humain-50-base.json` a été prise avec le `src/adapter-page.js` de `claude/50-base`, avant toute modification ;
  - modes corrigés : aucun clic hors de la partie visible dans les neuf scénarios, poses à 1 mm ;
  - l'ordre de `'gauche-recentre'`, sa durée (un recentrage au lieu de deux), et le cas où la vue active est celle du gauche ;
  - `'tout-recentre'` donne la même trace que `rapide.pose = false`, sauf les clics entre 0,99 et 1 ou hors de la fenêtre, qu'il refuse ;
  - le relevé de la page (raison, chemin, essai), et rien en mode corrigé ;
  - `readStrategy.clicHumain` en mode corrigé, rien en `'tel-quel'`.
- `tests/clic-hors-vue-sw.test.cjs` : relais du pont, compteur, cinq exemples, bilan unique, champs revérifiés, et un petit lot réel identique avec et sans relevé (décisions, commandes, événements du moteur).
- `tests/rapide-humain-banc.test.cjs` : l'outil de banc sur deux cuts synthétiques.
- `tests/v3-turbo.test.cjs` lit la nouvelle clé à part. Les montages de page (`tests/helpers/page.cjs`, `tests/incident-3560.test.cjs`) rangent le nouveau message.

## 7. Recommandation

**`'tout-recentre'`**, si la règle de Mic (« la trace doit être exactement celle d'un humain ») passe avant le débit. C'est le chemin des cuts de référence, déjà employé en lot réel (un cut sur dix) : pour chaque rail, le bouton, une attente que la vue suive (environ 0,3 s), puis un clic au milieu de la vue. Il coûte +0,65 s par cut rapide, soit +12 à +18 % de durée de lot, avec 0 clic hors vue, les mêmes poses, les mêmes décisions et 0 différé en plus.

**`'gauche-recentre'`** coûte moitié moins : +6 à +9 % de durée de lot. Il supprime aussi tous les clics hors de la fenêtre. Mais le rail droit reste posé à la machine : bouton pressé puis clic **dans la même milliseconde**, alors qu'un humain met au moins quelques centaines de millisecondes. Il change aussi l'ordre des gestes (droit avant gauche). On ne sait pas dans quel ordre l'opérateur pose ses rails. C'est un bon compromis si Mic juge que seule la position du clic compte.

**`'tel-quel'`** reste le défaut tant que Mic n'a pas tranché (D-157).

Dans tous les cas, le garde-fou `clic-hors-vue` dira au terrain combien il en reste : environ un par cut rapide en `'tel-quel'`, zéro dans les modes corrigés. Pour activer un mode, il suffit de changer `clicHumain` dans `src/settings.js` (une version, une consigne). Rien d'autre ne bouge.

## 8. Doutes

- **La page ESV est simulée.** La caméra qui suit à l'image suivante, le rayon depuis le rectangle du canevas et l'entier inférieur viennent du banc ESV local (D-088), de l'essai Chromium de l'enquête et de la vérification sur 372 poses réelles (§ 5). La taille de la fenêtre d'ESV n'est pas consignée : 2 133 × 1 080 est supposée. Un panneau qui couvrirait une partie du canevas n'est pas vu (le contrôle `elementFromPoint` reste à relever une fois dans ESV, comme le disait l'enquête).
- **Le temps d'un recentrage vient du code d'Ariane** : quatre sondages à 80 ms. Au banc, une référence prend 646 ms contre 664 à 673 au terrain. Un ESV plus lent à recentrer (KI-063) coûterait plus cher dans les modes corrigés.
- **Les cycles absolus du banc sont trop longs** (trois lots en parallèle sur une machine chargée). La durée sur le terrain est donc estimée par le journal plus le temps de pose en plus, et non mesurée. Une seule exécution par mode, sans répétition.
- **Les modes corrigés ne corrigent que la position du clic.** `isTrusted` reste faux pour tous les clics d'Ariane, comme avant. En `'gauche-recentre'`, le rail droit garde un clic dans la milliseconde qui suit le bouton.
- **La marge de 0,99 s'applique aussi après recentrage** dans les modes corrigés (avant : [-1, 1]). Une cible entre 0,99 et 1 de sa vue arrête la pose (« Position proposée hors de la vue »), au lieu d'être cliquée au bord. Le lot diffère déjà ces cuts avec la même marge : 0 cas au banc. Hors lot (pose assistée), ce refus pourrait se voir.
- **Les gestes de « déplacer la vue »** (molette, glisser, coupés par défaut) ne passent pas par ce garde-fou. Ils sont construits dans la vue par `src/gestes-vue.js`.
- **Le bilan de fin de lot** part quand le lot est clos (fin naturelle, arrêt, dernier cut, nouveau lot). Un lot laissé en pause puis abandonné n'a pas de bilan : ses exemples portent le total courant, et le compteur reste dans l'état du lot.
- Les deux lots ont servi à tout mesurer. Il n'y a pas de partie neuve.

## 9. Rejouer

```
node tools/cycle-ombre.cjs etalon --corpus SEG… --journal JOURNAL.json --pas 8 --sortie ETALON.json
nice -n 10 node tools/rapide-humain.cjs banc --parallele --echelle E --corpus SEG… --journal JOURNAL.json --sortie BANC.json
```

`E` est le rapport de l'étalon (`rapportDesSommes`). Poser le verrou `lourd.lock` pendant le banc. Corpus et journaux restent hors dépôt.
