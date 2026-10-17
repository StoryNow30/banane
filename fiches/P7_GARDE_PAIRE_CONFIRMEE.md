# P7 : garde de paire confirmée par la voie

Essai du 17 octobre 2026, branche `claude/50-p7-garde-paire-confirmee`, partie de `claude/50-base` (d8a7bcd, qui contient ba3947b). Il teste l'hypothèse H5 du catalogue des échecs d'Ariane en ADV, aux abords et en grappes (diagnostic P7, hors dépôt). Le cap de Mic (D-170) : Ariane fait seule la relecture qu'il fait en Écho, et pose elle-même les cuts qu'elle lui laisse aujourd'hui.

Seules les six **parties d'apprentissage** sont lues : 1:12, 1:13, 1:17, 1:24, 1:29 et 2:1. Aucune partie réservée n'a été ouverte, et le mode `juger` n'a pas été lancé. `src/engine.js` et `src/lot-decision.js` ne sont pas modifiés.

Conventions :
- **[FAIT]** : mesuré ; le chiffre vient d'une commande du § 7 ;
- **[HYP]** : hypothèse, plausible mais non démontrée ;
- **[NON MESURÉ]** : ces données ne permettent pas de le mesurer.

Les parties sont désignées « 1:29 » (projet 1, partie 29). Toutes les distances sont en mm. Une cellule de bilan se lit **actions / justes / abîmés / erreurs > 10 mm / mauvaise voie / abstentions**.

## 1. En bref

| Question | Réponse |
|---|---|
| **Hypothèse** | Un cut que la **garde de paire** retire (`reason: 'pair-guard'`) est posé à la **pose du moteur** si celle-ci tombe à **N mm** de la voie des **voisins sûrs** ou de la **chaîne**. |
| **Verdict** | **Gain, mais petit et fragile.** Les quatre conditions de réussite tiennent en validation croisée. Le gain tient à **3 cuts** (1:24 : 5730 ; 1:29 : 3546 et 3553), tous des verts en grappe aux abords. La « confirmation » choisie est le **latéral seul** : elle n'écarte qu'**un** cut faux (1:24, 5711), qui n'a aucune voie. Elle ne contrôle pas la hauteur, l'axe où le moteur se trompe sous cette garde. |
| **Validation croisée** (`etudier --garde-paire-confirmee`) | **+2 corrections justes** (79 → 81), **−1 cut abîmé** (6 → 5 ; c'est aussi l'erreur de moins, 12 → 11), **0 mauvaise voie**. Gain net **+3**. Chaque pli choisit « latéral seul » : 10 mm, sauf le pli de 1:24, qui prend 5 mm. [FAIT] |
| **Décomposition** | Effet direct de la levée : **+3 justes**, 0 dégât. Effet indirect : la variante sobre relève le seuil X dans deux plis (1:17 : 10 → 12 mm ; 1:24 : 8 → 12 mm). En 1:24, cela fait perdre un vert juste (5757), ce qui annule le gain de la levée dans cette partie. En 1:17, cela retire un cut aggravé, posé par le lot (2420), compté à la fois abîmé et erreur. [FAIT] |
| **À la lettre** (règle de service de la référence + seuil choisi par chaque pli) | **+3 justes** (79 → 82), 0 abîmé, 0 erreur, 0 mauvaise voie. Avec 10 mm « latéral » imposé partout (sensibilité, pas un réglage) : +5 justes, 0 dégât. Garde levée **sans condition** : +5 justes, **+1 erreur** (1:24, 5711). [FAIT] |
| **ADV** | **Inchangé** : 11 justes sur 17 actions, 3 erreurs. Aucun cut de la garde de paire n'est en zone d'ADV. [FAIT] |
| **Abords** | 30 → **32** justes, abîmés 4 → 3 (le même cut 2420 fait passer les erreurs de 8 à 7). À la lettre : 30 → 33 justes, sans dégât. [FAIT] |
| **Grappes** | 35 → **37** justes, abîmés 3 → 2 (2420), erreurs 6 → 5. À la lettre : 35 → 38 justes. [FAIT] |
| **PN** | Verts de PN : **36 justes sur 36**, comme la référence. Zone PN tous genres : 36 justes sur 37, comme la référence. Un différé de PN (1:29, 1662) est levé et confirmé, mais la règle n'agit jamais sur un différé. [FAIT] |
| **Portée** | Sur les six parties, **13** cuts sont différés en chaîne par la garde de paire, dont 9 verts. La greffe en recalcule 13 sur 13 à l'identique. Les 13 donnent une pose du moteur au premier passage quand on lève la garde. [FAIT] |
| **Risques non levés** | Échantillon minuscule : 9 verts, dont 5 que Mic corrige de plus de 10 mm. Le seuil N et les axes sont réglés sur ces 9 cuts. Le lecteur de la relecture en ombre exige 2 appuis par défaut (`appuisMin`) : 2 des 3 cuts gagnés n'en ont qu'un ou aucun. [NON MESURÉ] : ce qu'il en garderait. |

## 2. Ce qui a été fait

### 2.1 Le correctif

- **`src/garde-paire-confirmee.js`** : un module **pur** de post-traitement, **coupé par défaut** (`actif` doit valoir `true`). La fonction `lever({ decision, capture, science, anchors, poses, Shadow, options })` ne fait rien sur une décision autre que la garde de paire. Sur un cut que la garde retire, elle procède ainsi :
  - elle relance la **décision livrée sans la garde de paire** (`LotDecision.decideCut`, option livrée `pairGuard: false`). Seule une pose au **premier passage** compte : c'est la proposition du moteur, gardes d'écartement livrées comprises. Une reprise depuis la voie ou un choix ne compte pas ;
  - elle compare cette paire à deux voies, rail par rail, dans le repère profil de la pose d'ESV :
    - la voie de la **chaîne** : appuis de prédiction livrés (voie encadrée si possible, sinon les deux plus proches à 3 cuts) ;
    - la voie des **voisins sûrs** : poses actuelles à ±5 cuts. Jamais le cut lui-même, jamais un différé du lot, jamais une pose fictive à 1 500 mm, jamais une pose de Mic. La garde de cohérence livrée s'applique (`consistentValidated` : 3 voisins au moins, alignés à 8 mm) ;
  - elle **pose la paire du moteur** si l'une des voies tombe à `nMm` au plus sur le pire des deux rails. L'écart se mesure en latéral seul (`axes: 'l'`), ou en latéral et vertical (`'lv'`).

  La voie n'est qu'une **garde**, jamais une cible (D-033) : la pose est celle du moteur. Elle n'est **jamais un appui** de la chaîne (`anchor: false`), si bien qu'une levée fausse ne se propage pas. Une panne rend la décision reçue telle quelle. `confirme(voies, { nMm, axes })` rejoue la confirmation, et `GRILLE` donne les seuils essayés : 5, 10 et 20 mm, en `l` et en `lv`.
- **`tools/relecture-autonome.cjs`**, option **`--garde-paire-confirmee`**, coupée par défaut :
  - `extraire --garde-paire-confirmee --table T` (la relecture rejouée) : pour un cut que la chaîne diffère par la garde de paire, on consigne `chaineGardePaire`. Il a la même forme que `chaine` : la paire du moteur et sa hauteur apprise, plus les écarts aux deux voies. Le reste de l'extraction est inchangé, puisque la levée n'est jamais un appui ;
  - le mode **`garde-paire`** fait la même chose sur une extraction **existante**. Il ne recalcule que ces cuts : l'Écho est relue pour eux seuls (lecteur léger), et les appuis de la chaîne sont refaits depuis les poses du cas. Il **garde l'ancien cas** si la capture ne se rebâtit pas, ou si la décision recalculée diffère (étape, motif, appuis, écart à la voie, proposition du moteur) ;
  - `etudier --garde-paire-confirmee` : le seuil (N, axes, ou « garde maintenue ») entre dans la grille de la règle prudente. Il se règle **en validation croisée par partie**, comme le reste. À gain égal, la validation garde la garde, puis prend le seuil le plus strict. Elle n'agit que sur la variante **en chaîne** ;
  - `etudier` donne aussi, avec ou sans l'option, des bilans **tous genres** de la règle de service, par type de zone, par genre et dans les grappes. Avec l'option, il ajoute le **détail** des cuts de la garde de paire et une table de **sensibilité** au seuil ;
  - `comparer` : deux études des mêmes parties, par partie et par groupe ;
  - le fichier de réglages porte un bloc `gardePaireConfirmee` seulement si la règle de service lève la garde, et `regleDuReglage` le relit. Un lecteur qui ignore ce bloc garde la garde.
- L'essai a été lancé deux fois : avant et après une accélération de la lecture des propositions (`varDe`, 2 486 s puis 1 413 s). Les deux sorties sont identiques champ par champ. [FAIT]
- **Sans l'option, l'étude rend à l'identique** tous les champs de la base. C'est vérifié champ par champ contre l'outil de la base, sur les cas d'origine : central, validation croisée, règle figée, sobre, par type, courbe. Ça l'est aussi entre les cas d'origine et les cas greffés : 0 champ différent. [FAIT]

### 2.2 Branchement dans la relecture

- La base n'a pas de passe de relecture vivante. Sa relecture est celle que rejoue l'outil (`poseAriane`, `extraire`), et sa règle est le fichier de réglages relu par `regleDuReglage`. C'est là que l'option est branchée, coupée. Le fichier proposé (`datasets/relecture-reglages-proposes.json`) **n'est pas modifié**.
- Le lecteur de règle de la relecture en ombre (`src/relecture-critere.js`) n'existe que sur `claude/50-relecture-ombre`. Il n'est **pas touché**. Il exige par défaut 2 appuis (`appuisMin`) et ne connaît pas le bloc `gardePaireConfirmee` : il garderait donc la garde (§ 6).

### 2.3 Essais

- `tests/garde-paire-confirmee.test.cjs` : 11 essais sur le cut de corpus des essais de la décision, avec une science marquée pour la garde de paire. Ils couvrent :
  - l'option coupée ;
  - jamais sur une autre décision ;
  - la voie des voisins confirme ;
  - une voie à 30 mm ne confirme pas ;
  - la hauteur seule (`l` ou `lv`) ;
  - la voie de la chaîne et le « ou » ;
  - sans voie ;
  - une autre garde livrée qui retire encore la paire ;
  - une panne ;
  - `confirme`.

  Ils ont été lancés **rouges d'abord** (module absent : 1 échec de chargement), puis verts.
- `tests/relecture-autonome-garde-paire.test.cjs` : 7 essais sur données synthétiques. Ils couvrent :
  - la proposition avec et sans l'option ;
  - les règles et le bilan ;
  - l'étude sans l'option, identique ;
  - l'étude avec l'option : seuil appris sans la partie jugée, sensibilité, comparaison ;
  - les réglages proposés relus ;
  - la greffe sans cible ;
  - le voisinage actuel.

  Ils ont été lancés **rouges d'abord** contre l'outil de la base (7 échecs sur 7), puis verts.
- Avec `tests/relecture-autonome.test.cjs`, les 27 essais passent. `tests/package.test.cjs`, `tests/hauteur-apprise.test.cjs` et `tests/lot-decision-chaine.test.cjs` passent aussi (14 essais) : ils lisent tous les fichiers de `src/`. Le verify complet n'a pas été lancé. [FAIT]

## 3. Méthode

- **Données** : les cas extraits (`zones/cas/cas-P-N.jsonl`) et les tables (`adv/tables/t-P-N.json`) des six parties d'apprentissage, hors dépôt. Les cas portent la décision du lot **en chaîne** : les appuis sont les poses qu'Ariane vient de donner aux cuts précédents visités par Mic, dans l'ordre des cuts, jamais une pose de Mic.
- **Greffe** (`garde-paire`, sous le verrou partagé des calculs lourds) : 1:24, 1:29 et 1:17 ont des cuts différés en chaîne par la garde de paire, les trois autres parties n'en ont aucun. Pour 1:17, la source d'Écho est incomplète (`echo17/x`). Les deux cuts concernés s'y rebâtissent pourtant à l'identique. Les fichiers greffés sont dans `p7/gpc/cas/`, hors dépôt.
- **Référence** : `etudier` **sans** l'option, avec le même outil et les mêmes cas. **Essai** : la même commande **avec** `--garde-paire-confirmee`, sur les cas greffés.
- **Validation croisée par partie** : on laisse une partie de côté, on règle sur les cinq autres (seuil X, confiance, voie, cohérence, écartement, étapes, cuts posés, et pour l'essai le seuil de la garde de paire), puis on mesure sur la partie laissée. Les chiffres « règle de service » sont ceux de la variante **sobre** de chaque pli, comme dans `fiches/RELECTURE_AUTONOME.md`.
- **Jugement** :
  - **juste** : Mic corrige de plus de 10 mm, Ariane arrive à 10 mm de lui ;
  - **erreur** (colonne « erreurs > 10 mm » de l'outil) : Ariane agit et pose à plus de 10 mm de Mic. Un cut abîmé à plus de 10 mm y compte aussi ;
  - **abîmé** : Mic à 10 mm au plus, Ariane au-delà (ou aggravé) ;
  - **mauvaise voie** : plus de 50 mm d'écart à Mic.
- **Critère de réussite** fixé avant la mesure :
  - 0 mauvaise voie ;
  - plus de corrections justes nettes en ADV, aux abords ou en grappes ;
  - les cuts abîmés n'augmentent pas de plus de 0,2 % des visités (2,9 cuts sur 1 445) ;
  - aucune régression sur la PN (36 sur 36).

## 4. Résultats

### 4.1 Référence et essai, par type de zone (validation croisée, règle de service, tous genres) [FAIT]

| Groupe | Référence | Essai (`--garde-paire-confirmee`) | Δ justes | Δ abîmés | Δ erreurs | Δ mauvaise voie |
|---|---|---|--:|--:|--:|--:|
| zone PN | 37 / 36 / 1 / 1 / 0 / 37 | 37 / 36 / 1 / 1 / 0 / 36 | 0 | 0 | 0 | 0 |
| verts de PN | 36 / 36 / 0 / 0 / 0 / 24 | 36 / 36 / 0 / 0 / 0 / 24 | 0 | 0 | 0 | 0 |
| zone ADV | 17 / 11 / 1 / 3 / 0 / 310 | 17 / 11 / 1 / 3 / 0 / 310 | 0 | 0 | 0 | 0 |
| abords | 41 / 30 / 4 / 8 / 0 / 220 | 39 / 32 / 3 / 7 / 0 / 217 | **+2** | −1 | −1 | 0 |
| vert-hors-zone | 2 / 2 / 0 / 0 / 0 / 15 | 2 / 2 / 0 / 0 / 0 / 15 | 0 | 0 | 0 | 0 |
| grappes | 43 / 35 / 3 / 6 / 0 / 366 | 42 / 37 / 2 / 5 / 0 / 362 | **+2** | −1 | −1 | 0 |
| genre vert | 92 / 79 / 2 / 8 / 0 / 294 | 92 / 81 / 2 / 8 / 0 / 291 | +2 | 0 | 0 | 0 |
| genre posé | 5 / 0 / 4 / 4 / 0 / 159 | 3 / 0 / 3 / 3 / 0 / 159 | 0 | −1 | −1 | 0 |
| genre différé | 0 / 0 / 0 / 0 / 0 / 129 | 0 / 0 / 0 / 0 / 0 / 128 | 0 | 0 | 0 | 0 |
| **toutes zones** (1 445 visités, 351 corrections de Mic > 10 mm) | **97 / 79 / 6 / 12 / 0 / 582** | **95 / 81 / 5 / 11 / 0 / 578** | **+2** | **−1** | **−1** | **0** |

### 4.2 Par partie (validation croisée) [FAIT]

Règle de chaque pli : seuil X de la variante sobre, référence → essai, et seuil de la garde de paire choisi par l'essai.

| Partie | Règle | PN | ADV | Abords | Vert-hors-zone | Grappes | Toutes zones |
|---|---|---|---|---|---|---|---|
| 1:12 | X 8 → 8 ; 10 mm `l` | 20/20/0/0/0/6 → idem | — | — | 1/1/0/0/0/0 → idem | — | 21/21/0/0/0/6 → idem |
| 1:13 | X 8 → 8 ; 10 mm `l` | 9/9/0/0/0/15 → idem | 8/3/1/3/0/15 → idem | — | — | — | 17/12/1/3/0/30 → idem |
| 1:17 | X 10 → **12** ; 10 mm `l` | — | 1/1/0/0/0/27 → idem | 7/2/2/3/0/123 → **4/2/1/2/0/123** | 0/0/0/0/0/11 → idem | 5/1/2/3/0/96 → 3/1/1/2/0/96 | 8/3/2/3/0/161 → **5/3/1/2/0/161** |
| 1:24 | X 8 → **12** ; **5 mm** `l` | — | — | 4/1/0/2/0/15 → **3/1/0/2/0/14** | — | idem abords | 4/1/0/2/0/15 → 3/1/0/2/0/14 |
| 1:29 | X 10 → 10 ; 10 mm `l` | 8/7/1/1/0/8 → 8/7/1/1/0/7 | 2/2/0/0/0/37 → idem | 30/27/2/3/0/80 → **32/29/2/3/0/78** | 1/1/0/0/0/4 → idem | 32/31/1/1/0/65 → 34/33/1/1/0/62 | 41/37/3/4/0/129 → **43/39/3/4/0/126** |
| 2:1 | X 8 → 8 ; 10 mm `l` | 0/0/0/0/0/8 → idem | 6/5/0/0/0/231 → idem | 0/0/0/0/0/2 → idem | — | 2/2/0/0/0/190 → idem | 6/5/0/0/0/241 → idem |

- 1:12, 1:13 et 2:1 n'ont aucun cut de la garde de paire. Leur règle porte le seuil, sans aucun effet.
- 1:24 : la levée pose 5730 (juste, 9,6 mm de Mic). Le seuil sobre relevé de 8 à 12 mm fait perdre 5757 (vert juste, Mic 15,7 mm) et 5763 (vert reproduit à 4,3 mm, Mic 7,9 mm) : 0 gain net dans la partie.
- 1:17 : aucune levée (5755 et 5792 ne sont pas confirmés à 10 mm). Le seuil sobre relevé de 10 à 12 mm retire 3 actions : 2420 (posé par le lot, aggravé : le cut abîmé et l'erreur de moins), 756 (posé, zone grise) et 5106 (vert reproduit à 7,2 mm, Mic 5,5 mm).
- 1:29 : la levée pose 3546 et 3553, justes à 3,6 et 3,4 mm de Mic.

### 4.3 Les 13 cuts de la garde de paire [FAIT]

C'est la paire du moteur, garde levée, avec la hauteur apprise (variante `chaine+h`). « Voie l ; lv » donne l'écart de la paire à la voie, sur le pire rail, en latéral seul puis en latéral et vertical. « — » signifie qu'il n'y a pas de voie : pas d'appui de chaîne, ou moins de 3 voisins sûrs cohérents.

| Partie | Cut | Zone | Genre | Mic | Levée : écart à Mic | Chaîne l ; lv (appuis) | Voisins l ; lv (gardés) | Confirmée (pli) | Issue (règle du pli) |
|---|--:|---|---|--:|--:|---|---|---|---|
| 1:17 | 5755 | abords | vert | 7,8 | 11,6 | — | 16,3 ; 16,3 (5) | non | laissé (5–10) |
| 1:17 | 5792 | abords | vert | 4,1 | 7,1 | — | 15,4 ; 15,4 (3) | non | laissé juste |
| 1:24 | 5711 | abords, grappe | vert | 13,9 | **17,6** | — | — (0) | non | laissé faux |
| 1:24 | 5715 | abords, grappe | différé | 102,7 | 8,8 | — | 11,3 ; 11,3 (4) | non | laissé faux |
| 1:24 | 5716 | abords, grappe | différé | 106,2 | 8,0 | — | 10,5 ; 10,5 (5) | non | laissé faux |
| 1:24 | 5720 | abords, grappe | vert | 12,6 | 2,8 | 15,4 ; 51,6 (1) | 7,1 ; 12,6 (5) | non (5 mm) | laissé faux |
| 1:24 | 5727 | abords, grappe | différé | 100,4 | 11,2 | 9,5 ; 44,6 (2) | 5,3 ; 8,2 (3) | non | laissé faux |
| 1:24 | 5730 | abords, grappe | vert | 16,7 | 9,6 | 2,3 ; 9,6 (1) | 13,6 ; 13,6 (4) | **oui** | **juste** (≤ 10) |
| 1:24 | 5732 | abords, grappe | vert | 16,6 | 9,4 | 8,4 ; 45,4 (1) | 5,7 ; 14,0 (4) | non (5 mm) | laissé faux |
| 1:29 | 410 | abords | vert | 0 | 5,7 | — | — (0) | non | laissé juste |
| 1:29 | 1662 | PN, grappe | différé | 39,9 | 8,2 | 1,7 ; 16,5 (1) | 3,2 ; 9,6 (8) | oui | laissé faux (différé) |
| 1:29 | 3546 | abords, grappe | vert | 35,1 | 3,6 | 0,5 ; 13,1 (2) | 4,1 ; 13,2 (5) | **oui** | **juste** (≤ 5) |
| 1:29 | 3553 | abords, grappe | vert | 26,1 | 3,4 | — | 1,9 ; 33,3 (5) | **oui** | **juste** (≤ 5) |

- **[FAIT]** Le moteur est à 10 mm de Mic sur 10 des 13 cuts : 5 verts que Mic corrige (5720, 5730, 5732, 3546 et 3553), 3 différés (5715, 5716 et 1662), et 2 verts que Mic ne corrige pas ou peu (410 à 5,7 mm, 5792 à 7,1 mm, zone grise). Il est à plus de 10 mm sur 3 cuts : 5711 (17,6), 5755 (11,6) et 5727 (11,2).
- **[FAIT]** Avec la hauteur apprise, le catalogue change : 410 n'est plus un cut abîmé (5,7 mm de Mic au lieu de 10,4). 5755 l'est encore (11,6), mais sa paire ne bouge que de 8 mm, sous le seuil de service de 1:17 (10 à 12 mm).
- **[FAIT]** **La hauteur ne confirme pas les cuts justes.** Les justes que Mic abaisse de 26 à 35 mm (3546, 3553, 5732) sont à 13 à 45 mm des voies en vertical, parce que les voies sont elles-mêmes hautes. Les voisins sûrs sont des poses actuelles d'ESV, que Mic corrige aussi dans ces grappes. La chaîne de 1:24 s'appuie sur les différés voisins. C'est pourquoi chaque pli choisit `l` : en `lv`, la levée ne gagne rien à 5 mm et un seul cut à 10 mm.
- **[FAIT]** **Ce que la confirmation filtre réellement** : dans la mesure, un seul cut qui change le bilan, 5711 (une erreur). Il n'a ni appui de chaîne ni 3 voisins sûrs cohérents. Elle écarte aussi 5755 (voisins à 16 mm), qui serait abîmé avec un seuil X de 8 mm, mais le seuil de 1:17 (10 à 12 mm) ne l'aurait pas touché. Les deux cuts que la garde évite d'abîmer selon le catalogue (410 et 5755) ne seraient donc pas abîmés par la règle de service, avec ou sans confirmation.

### 4.4 À la lettre et sensibilité [FAIT]

Règle de service de chaque pli de la **référence**, avec un seuil de garde de paire ajouté, mesurée sur la partie laissée de côté. Rien n'est réglé ici.

| Seuil ajouté | Toutes zones | Abords | Grappes | PN (verts) | ADV |
|---|---|---|---|---|---|
| aucun (référence) | 97 / 79 / 6 / 12 / 0 / 582 | 41 / 30 / 4 / 8 / 0 / 220 | 43 / 35 / 3 / 6 / 0 / 366 | 36 / 36 / 0 / 0 / 0 | 17 / 11 / 1 / 3 / 0 |
| choisi par chaque pli (10 mm `l`, 5 mm `l` pour 1:24) | 100 / **82** / 6 / 12 / 0 / 578 | 44 / 33 / 4 / 8 / 0 / 217 | 46 / 38 / 3 / 6 / 0 / 362 | 36 / 36 / 0 / 0 / 0 | inchangé |
| 10 mm `l` partout | 102 / **84** / 6 / 12 / 0 / 575 | 46 / 35 / 4 / 8 / 0 / 214 | 48 / 40 / 3 / 6 / 0 / 359 | inchangé | inchangé |
| 20 mm `l` partout | 102 / 84 / 6 / 12 / 0 / 571 | 46 / 35 / 4 / 8 / 0 / 210 | 48 / 40 / 3 / 6 / 0 / 357 | inchangé | inchangé |
| garde levée **sans condition** | 103 / 84 / 6 / **13** / 0 / 569 | 47 / 35 / 4 / **9** / 0 / 208 | 49 / 40 / 3 / **7** / 0 / 356 | inchangé | inchangé |

Pente avec les règles de l'essai (seuil X déjà relevé ; table de sensibilité de `etudier`), en corrections justes : garde maintenue 78 ; 5 mm `lv` 78 ; 10 mm `lv` 79 ; 20 mm `lv` 82 ; 5 mm `l` 81 ; 10 mm `l` 83 ; 20 mm `l` 83. Abîmés : 5 partout. Mauvaise voie : 0 partout.

## 5. Conditions de réussite

| Condition | Essai (validation croisée) | À la lettre |
|---|---|---|
| 0 mauvaise voie | **tenue** (0) | tenue (0) |
| plus de justes nettes en ADV, abords ou grappes | **tenue** : abords +2 justes, net +3 ; grappes +2, net +3 ; ADV 0 | tenue : abords et grappes +3, net +3 |
| abîmés : + 0,2 % des visités au plus | **tenue** : −1 | tenue : 0 |
| PN sans régression (36 sur 36) | **tenue** : 36 sur 36 | tenue |

**Verdict mesuré : gain.** Il est petit (+2 à +3 corrections justes sur 351) et repose sur 3 cuts de deux parties. **[HYP]** Sur des parties neuves, l'effet se jouera sur la même structure : des verts en grappe retirés par la garde de paire, avec une voie à moins de 10 mm en travers. Il pourrait aussi bien être nul.

## 6. Limites et risques

- **Échantillon** : 9 verts de la garde de paire en tout, dont 5 que Mic corrige de plus de 10 mm. Le choix `l` contre `lv` et celui de N reposent sur ces cuts. La validation croisée par partie est honnête mais grossière : le pli de 1:24 ne voit pour s'entraîner que les 5 verts de 1:17 et 1:29.
- **La confirmation latérale est faible.** Sur ces données, elle équivaut presque à « il existe une voie » : tous les verts levés ont une voie à moins de 10 mm en travers, sauf 5755 et 5792 (16 et 15 mm), et 5711 et 410, sans voie. Elle ne dit rien de la **hauteur**, où se trouvent les échecs du moteur sous cette garde (5711 : 17 mm en vertical ; 5755 : 11 mm). **[HYP]** Une confirmation verticale utile demanderait une voie qui ne soit pas elle-même fausse en hauteur, par exemple des voisins **corrigés** par Ariane plutôt que les poses actuelles d'ESV. **[NON MESURÉ]**
- **Effet de bord de la variante sobre** : l'option change le seuil X de deux plis. Dans l'essai, une partie du gain (1:17 : 2420, un cut abîmé de moins) et une partie de la perte (1:24 : 5757, un juste de moins) ne viennent pas de la levée mais de ce relèvement. La mesure « à la lettre » isole la levée : +3 justes, 0 dégât.
- **Chaîne rejouée** : elle suit l'ordre de visite de Mic, comme dans la fiche. Les appuis de la greffe sont refaits depuis les poses du cas, et une reprise depuis la voie est jugée appui sur l'écart consigné. Les 13 décisions recalculées sont identiques au cas (étape, motif, appuis, écart à la voie, moteur à 0,05 mm près).
- **Relecture en ombre** : son lecteur exige par défaut 2 appuis. Des 3 cuts gagnés, seul 3546 en a 2 ; 5730 en a un, 3553 aucun. **[NON MESURÉ]** : ce que donnerait l'option une fois branchée dans ce lecteur. Le branchement n'est pas fait (§ 2.2).
- **Invariants** : la voie sert de garde, la pose est celle du moteur (D-033 respecté). La garde de paire est une décision mesurée (D-044 : 241 et 409 arrêtés sans juste perdu). La lever, même sous confirmation, demande l'accord de Mic et de la direction.
- **Parties réservées** : non lues. Le résultat n'est qu'en apprentissage.

## 7. Rejouer

Tout est hors dépôt, dans le dossier `p7/gpc/` du scratchpad. Les fichiers ne portent que des numéros de cut, des mm, des comptes et des codes.

```
# greffe (sous le verrou des calculs lourds, ≈ 3 min) → p7/gpc/cas/cas-1-{24,29,17}.jsonl
p7/gpc/greffe.sh 24 29 17
# référence (≈ 3 min) et essai (≈ 25 min sous charge), six parties d'apprentissage
p7/gpc/etudier.sh tools/relecture-autonome.cjs "" p7/gpc/res/ref.json p7/gpc/res/ref.txt
p7/gpc/etudier.sh tools/relecture-autonome.cjs p7/gpc/cas p7/gpc/res/essai.json p7/gpc/res/essai.txt --garde-paire-confirmee
node tools/relecture-autonome.cjs comparer --ref p7/gpc/res/ref.json --essai p7/gpc/res/essai.json
# à la lettre et sensibilité (lit ref.json, essai.json et les cas greffés)
node p7/gpc/lettre.cjs ; node p7/gpc/lettre.cjs 10:l ; node p7/gpc/aveugle.cjs 10:l
```

`etudier.sh` passe les six parties d'apprentissage, avec `--partie P:N --cas … --table adv/tables/t-P-N.json [--skip …]`, à `nice -n 10`.
