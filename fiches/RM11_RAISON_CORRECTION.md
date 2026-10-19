# RM-11 — Raison de la correction : conception (19 octobre 2026, à valider par Mic)

Mission RM-11 du plan de suite 5.0, chantier E3 du cahier 5.0, réponse 4 de Mic à l'audit Écho (D-112). **Conception seulement : aucun code de l'extension ne change.** Cette fiche et une maquette sont soumises à Mic. Rien ne se développe avant son accord.

Mic a dit : « Si c'est bien fait, pourquoi pas. » La fonction est donc **facultative, coupée par défaut, et ne doit jamais le ralentir**.

Maquette (hors dépôt, à ouvrir dans un navigateur) : `scratchpad/rm11/maquette-raison.html`. Les touches 1 à 6 et 0 y marchent, pour essayer.

## 1. En bref

| Question | Réponse proposée |
|---|---|
| Étiquettes | 6 : rail voisin, ADV, PN, nuage diffus ou pauvre, hauteur seulement, autre |
| Touches | `1` à `6` (rangée du haut, lues par leur place), `0` = effacer et finir la collante |
| Défaut | aucune raison, aucun geste. Absent veut dire **inconnu**, jamais « bon » |
| Collante | deux fois la même touche : la raison reste pour les cuts suivants, jusqu'à une autre raison ou `0` |
| Jamais bloquant | rien à répondre, aucune fenêtre, aucune attente, aucune touche retenue |
| Où c'est consigné | champ `raisonCorrection` de la visite Écho ; côté **étiquette**, jamais côté traits |
| Coût estimé | environ 0,6 s par raison posée à la touche, 0 s pour le défaut et pour une collante reportée ; de l'ordre de +1 à +4 % du temps total |
| Porte | au moins 80 % des corrections de plus de 10 mm étiquetées, sans ralentir |
| Point à lever avant tout | relever dans ESV si les chiffres 1 à 6 et 0 y font déjà quelque chose |

## 2. Ce que Mic fait aujourd'hui, et les contraintes

Sources : `fiches/FICHE_U3_RACCOURCIS.md`, `src/early-input.js`, `src/native-page.js`, `src/adapter-page.js`, D-112 et D-114 du fichier des décisions.

- **Touches d'ESV ou d'Ariane déjà en jeu** : `Maj+Espace` (valider), `D` (cut de droite), `Z` et `S` (suivant, précédent), `Maj+Z`, `Q`, `A`, `G` et les flèches (déplacements, liste `editingKeys`), `Entrée`, `Ctrl+Entrée`, `Ctrl+flèches` (passer sans valider), `Maj+Retour arrière` (SKIP), `F5`. Le clavier de Mic est français : le relevé du 23 septembre note `Z` sous le code `KeyW`.
- **Écho est passif** : la garde native relève chaque frappe (`code`, modificateurs, cible) et ne retient rien. Ariane n'envoie rien à ESV en Écho. La trace dans ESV reste celle d'un humain (D-114). La fonction ne doit pas changer cela.
- **Où est l'interface** : D-112 point 4 dit « sur l'interface d'Écho (panneau Ariane), pas dans ESV ». L'affichage et les boutons sont donc dans le panneau. Le clavier est lu là où est le focus, c'est-à-dire dans ESV, parce que Mic n'en sort pas. ESV ne reçoit rien de plus et n'affiche rien de plus.
- **Rythme** : Mic fait 3 à 6 cuts par minute (donnée de Mic). Un vert passé sans correction dure en médiane 0,6 à 2,4 s selon la mesure (RELECTURE_OMBRE, VERTS_A_CONTROLER).
- **La touche est déjà vue** : une frappe de chiffre est déjà consignée aujourd'hui comme événement `operator-event` (code `Digit1`, sans le caractère), mais comme événement **non essentiel**, qui cède sous charge. Il faudra la rendre essentielle (§ 7).

## 3. Les étiquettes

Principe : **la mesure donne déjà combien** Mic a corrigé (écart à sa pose finale). L'étiquette ne sert que pour ce que la mesure ne dit pas : **pourquoi**. Chaque étiquette est donc justifiée par la décision de la GCV2 qu'elle éclaire.

| Touche | Code | Sens pour Mic | Ce que la GCV2 en apprend | Ce que la mesure seule ne dit pas |
|---|---|---|---|---|
| `1` | `rail-voisin` | la pose de départ était sur le rail voisin ou la mauvaise voie | **garde-fou** : confirme que « plus de 45 mm en travers » est bien une mauvaise voie, règle la voie prédite (hypothèse H3), compte les vraies mauvaises voies (porte : 0) | un grand déplacement latéral peut être une mauvaise voie ou une simple grosse erreur sur la bonne voie |
| `2` | `adv` | dans un aiguillage | **zone** : vérité terrain pour juger le détecteur d'ADV (RM-1 : première ADV manquée de la partie 11 ; RM-2 : marges de 20 cuts) ; une série collante donne le début et la fin | la zone d'ADV détectée par Ariane est justement ce qu'on veut juger |
| `3` | `pn` | dans un passage à niveau | **zone** : même usage pour les PN, dont la confusion PN pris pour ADV (partie 16) ; la règle prudente fait déjà 36 sur 36 en PN | idem |
| `4` | `nuage-pauvre` | le nuage est diffus ou trop pauvre pour voir le rail | **cause d'une hypothèse manquante** : sépare « aucune hypothèse possible, la GCV2 doit s'abstenir » de « le signal existait, l'étage 1 ne l'a pas repris ». Dit où le rappel atteignable (G1-a) ne peut pas monter | une correction faite sans aucun appui du nuage ressemble à toute autre grosse correction |
| `5` | `hauteur` | seule la hauteur était à reprendre | **transformation** : cibles propres pour la hauteur apprise ; part des corrections expliquées par la seule hauteur (70 des 85 faux verts, biais vertical d'environ 9 mm) | un déplacement vertical peut venir de la convention ou d'un nuage mal lu |
| `6` | `autre` | une raison qui n'est pas dans la liste | **couverture de la liste** : si « autre » dépasse 20 % des raisons posées, la liste est à revoir. N'apprend rien d'autre | — |

**Choix à signaler à Mic.** Le cahier et la ligne RM-11 citent aussi « bon tel quel ». Je ne le propose pas comme touche, pour deux raisons : c'est déjà le **défaut** (pas de geste, pas de déplacement, visite d'au moins 0,8 s : le compteur en a 553 + 1 559), et une touche de plus ralentit. S'il le veut quand même, il prend la place de `5` (« hauteur seulement »), la plus déductible de la mesure. Les deux sont possibles ; je recommande la liste ci-dessus.

**Un seul code par cut.** Un cut d'ADV avec nuage pauvre porte un seul code. Mic choisit la cause qu'il juge principale ; la zone vient mieux de la collante (§ 4).

**Honnêteté sur les effectifs.** Le compteur donne 757 corrections de plus de 10 mm sur 12 parties (4 998 cuts à l'Écho). À 80 % étiquetées, cela fait environ 600 raisons, répartition inconnue. Les raisons rares (mauvaise voie) seront quelques dizaines. **La GCV2 n'apprend pas un classeur de raisons.** Elle s'en sert pour diagnostiquer, juger les détecteurs de zone et régler des garde-fous. Si, après trois séances, aucune mesure n'utilise les étiquettes, la fonction est retirée.

## 4. Le geste

**Où se tape la raison.** Au clavier, dans ESV, sans lâcher ce qu'on fait. Les chiffres de la rangée du haut sont lus par leur code physique (`Digit1` à `Digit6`, `Digit0`), donc sans `Maj` sur un clavier français ; le pavé numérique (`Numpad1` à `Numpad6`, `Numpad0`) marche aussi. `Maj` est toléré, parce que Mic le tient déjà pour `Maj+Espace`. `Ctrl`, `Alt` et `Meta` annulent la lecture. Une touche tenue (`repeat`) ne compte qu'une fois. Dans un champ de texte, rien n'est lu. Un clic sur une pastille du panneau fait la même chose, en secours.

**Pourquoi les chiffres.** Aucune touche d'ESV ou d'Ariane connue n'est un chiffre. La main gauche, déjà sur `ZQSD` et `Maj+Espace`, les atteint en montant d'une rangée. Les lettres autour (`E`, `R`, `F`, `X`…) sont inconnues du côté d'ESV et plus dangereuses.

**À relever avant tout développement (2 minutes, par Mic).** Personne n'a le code des gestionnaires clavier d'ESV (D-112 : « relevé à confirmer »). Mic appuie une fois sur `1`, `2`, `3`, `4`, `5`, `6`, `0`, avec et sans `Maj`, sur un cut qu'il ne valide pas, et dit si quelque chose bouge (caméra, rail, liste). Écho consigne déjà les frappes et les changements de rails : la séance se rejoue ensuite à l'export. Si ESV réagit à un chiffre, on bascule la table des touches (réglage `echo.raison.touches`) vers, dans l'ordre : `Alt+chiffre`, puis le pavé numérique seul. Ariane **ne retient jamais** une touche en Écho : elle ne peut donc pas masquer une touche d'ESV.

**Les cinq règles du geste.**

1. **Défaut sans geste.** Pas de touche, pas de raison. Aucune pastille n'est « en attente ».
2. **Jamais bloquant.** Aucune fenêtre, aucune confirmation, aucun délai. `Maj+Espace`, `D` et toutes les autres touches passent exactement comme avant. Un chiffre mal tapé s'efface avec `0`.
3. **À quel cut va la touche.** Au cut affiché, avant la validation ou pendant la correction. Une touche tapée dans les **500 ms qui suivent** une validation, avant tout autre geste sur le cut suivant, est rattachée au cut qui vient d'être validé, avec la marque `apresValidationMs`. Ce délai est un réglage ; le premier essai mesure le vrai délai des frappes, et on le corrige au besoin.
4. **Collante.** Un appui : raison pour ce cut seul. Deux appuis sur la même touche en moins de 600 ms sur le même cut : la raison devient **collante** et s'applique aux cuts suivants. Une raison tapée seule sur un cut a priorité sur la collante **pour ce cut** ; la collante reprend ensuite. `0` efface la raison du cut et finit la collante. La collante s'arrête seule si la partie change, si le cut visité est à plus de 30 cuts du précédent, si Écho est mis en pause ou terminé. Elle survit à un F5 (état gardé par le service worker, comme la reprise automatique). Un rappel doux apparaît dans le panneau après 40 cuts collants ; il n'arrête rien.
5. **Retour visible, sans tirer l'œil.** Panneau : la rangée de pastilles montre la raison du cut et la collante (maquette). Bandeau d'ESV, s'il est activé : « raison : ADV (collante) ». Aucun son, aucune fenêtre.

**Réglage.** « Raison de la correction », coupé par défaut, dans le panneau d'Écho. Lu au démarrage d'Écho et gardé jusqu'à la fin de la séance, comme les choix du lot (clic humain, relecture).

## 5. Où c'est consigné, et compatibilité

### 5.1 Le champ

Dans la visite Écho (`banane-native-visit-v2`), un champ **facultatif** :

```json
"raisonCorrection": {
  "format": "ariane-raison-v1",
  "code": "adv",
  "source": "touche",
  "serie": null,
  "poseeA": "2026-10-19T09:12:03.412Z",
  "eventSeq": 18432,
  "apresValidationMs": null,
  "historique": [ { "code": "hauteur", "source": "touche", "poseeA": "…" } ]
}
```

- `code` : `rail-voisin`, `adv`, `pn`, `nuage-pauvre`, `hauteur`, `autre`. Codes stables, lisibles dans un export.
- `source` : `touche` (tapée sur ce cut) ou `collante` (reportée). Dans une série, `serie` porte son numéro et `eventSeq` l'événement qui l'a ouverte.
- `apresValidationMs` : nombre si la touche est arrivée après la validation, sinon `null`.
- `historique` : les changements de raison sur la visite (6 au plus), pour un `0` ou une correction de frappe.
- **Absent ou `null` = inconnu.** Ni « bon », ni « autre ». Une raison absente n'est jamais remplie par un outil.

Résumé de séance, dans l'en-tête de l'export (une fois) : `raisonSeries` = liste de `{ serie, code, partie, cutDebut, cutFin, nCuts, finPar }`. `finPar` vaut `touche-0`, `autre-raison`, `changement-partie`, `saut`, `pause` ou `fin-seance`. C'est directement l'étendue d'une zone d'ADV ou de PN, utile à RM-1 et RM-2.

L'état de la collante en cours vit dans l'état Écho du service worker (`native.raison`), sauvegardé avec lui.

### 5.2 Format et outils existants

- **Export** : champ additif, `format` de la visite inchangé. Les lecteurs qui ne le connaissent pas l'ignorent. Le compactage (`src/native-export.js`) ne filtre pas les champs de visite : un essai d'aller-retour le prouve (§ 8).
- **`tools/jointure-echo-orbite.cjs`** : la ligne d'un cut gagne `raisonHumaine` = `{ code, source, serie, apresValidation }`, lue sur la visite qui porte la référence humaine, à défaut sur la dernière visite du cut qui en a une. Colonne CSV ajoutée **à la fin** (`raison`, `raisonSource`), pour ne rien décaler. Le résumé gagne `raison` : comptes par code, **couverture** (corrections de plus de 10 mm et de plus de 5 mm, avec raison par touche, avec raison collante, sans), et séries. Il gagne aussi, par cut, la durée de visite et le temps entre le dernier geste de rail et la validation (§ 6, mesure de base).
- **`tools/jeu-apprentissage.cjs`** : `etiquette.raisonHumaine` recopié ; `absents` perd « raison de la correction (E3) » quand des raisons existent.
- **`tools/gcv2-jeu.cjs`** : `etiquette.raison` sur la ligne `cut`, au même niveau que `etiquette.mic`. `hypothesesDuCut` ne la reçoit pas. `FORMAT` du jeu inchangé (champ additif). `tools/compteur-gcv2.cjs` peut afficher une colonne « avec raison » (facultatif).
- **Orbite** : ne lit pas ce champ. Les lots ne sont pas touchés.

### 5.3 Règle anti-fuite : la raison est une étiquette, jamais un trait

Une raison est une **information humaine**, posée parce que Mic a vu et corrigé. Elle appartient à l'**étiquette** (la sortie qu'on veut deviner), pas aux **traits** (l'entrée dont la GCV2 dispose quand elle décide). Cette règle s'applique même à une collante posée au cut N et reportée au cut N+1 : Ariane, au moment de décider, n'a pas la raison de Mic.

1. `hypothesesDuCut` et toute fonction qui fabrique des traits ne reçoivent ni la raison, ni la collante, ni son numéro de série.
2. Le champ est lu seulement dans `etiquette`. Il n'entre jamais dans `traits`, `contexte`, `zone`, `role`, `moteur`.
3. **La zone d'entrée reste celle du détecteur.** Une raison `adv` ou `pn` ne remplace jamais la zone du jeu, même en collante. Elle sert à **juger** le détecteur, pas à l'alimenter.
4. La raison ne définit pas « juste » ou « faux » : cela reste la distance à la pose finale de Mic (classes ≤ 5, ≤ 10, > 10, > 50 mm).
5. Absent n'est pas une classe. Les cuts sans raison ne sont ni négatifs ni « bon ». Ils sont exclus de toute mesure qui porte sur les raisons. Mic en pose moins quand il est pressé : le manque n'est pas aléatoire.
6. Usages permis : trier les mesures par raison ; juger les détecteurs de zone ; mesurer les causes d'hypothèse manquante ; régler des garde-fous ; former un modèle auxiliaire hors ligne, jamais un trait du score de justesse.
7. La raison n'est copiée ni dans `startPose`, ni dans `beforeEstablished`, ni dans les captures LiDAR, ni dans ce que `src/` envoie à ESV ou à Orbite.
8. **Essais qui le prouvent** : (a) changer la raison d'une visite ne change aucun trait, aucune ligne `hyp` ni `rail` du jeu ; (b) la liste blanche des traits de `gcv2-apprendre` refuse tout nom contenant « raison » ; (c) un essai de recherche de texte échoue si `raisonCorrection` apparaît dans un fichier de `src/` hors de la liste prévue (§ 7). C'est la même méthode que pour la référence humaine (`tests/gcv2-jeu.test.cjs`).

## 6. Le coût

### 6.1 Ce qu'on sait

| Mesure | Valeur | Source |
|---|---|---|
| Cuts à l'Écho, 12 parties | 4 998 ; corrigés de plus de 5 mm : 1 519 (30 %) ; de plus de 10 mm : 757 (15 %) | `fiches/COMPTEUR_GCV2.md` |
| Visite d'un vert relu | 3,6 à 3,7 s en moyenne (3,4 à 5,5 s selon la partie), médiane 1,3 à 2,8 s | `fiches/VERTS_A_CONTROLER.md` § 5 |
| Intervalle entre deux arrivées sur un cut | médiane 1,86 s, moyenne 3,6 s ; pause de plus de 10 s toutes les 21,5 visites | `fiches/RELECTURE_OMBRE.md` |
| Rythme d'un cut corrigé | 3 à 6 par minute, soit 10 à 20 s | Mic, supposé valable pour un cut corrigé |
| Variation d'une partie à l'autre | environ ± 25 % | `fiches/VERTS_A_CONTROLER.md` § 5 |

La durée d'une visite **corrigée** n'est pas dans les fiches. Elle se calcule sur les exports déjà reçus (§ 7, étape 0), avant tout développement.

### 6.2 Estimation

Une frappe de plus, la main déjà au clavier : **0,4 à 0,9 s, milieu 0,6 s**. C'est une hypothèse, à mesurer. Défaut : 0 s. Collante reportée : 0 s. Pas de chiffre mesuré sur Mic ici.

| Cas | Raisons posées à la touche | Temps ajouté par cut visité (0,6 s) | Part de la visite moyenne de 3,6 s |
|---|---|---|---|
| Étiqueter 80 % des corrections de plus de 10 mm (**porte**) | environ 12 % des cuts | 0,07 s | environ +2 % |
| Étiqueter 80 % des corrections de plus de 5 mm (suivi) | environ 24 % des cuts | 0,15 s | environ +4 % |
| Même cas à 0,9 s | 24 % des cuts | 0,22 s | environ +6 % |

Sur un **cut corrigé** de 10 à 20 s, une raison à 0,6 s ajoute **3 à 6 %** à ce cut. Pour une partie lourde comme 1:29 (122 grosses corrections, 404 de plus de 5 mm, environ 49 minutes à 3,6 s par cut), la porte coûte environ **1 minute** et le suivi à 5 mm environ **3 minutes**. Les séries collantes baissent ce nombre : une frappe double par série au lieu d'une par cut. Le gain n'est pas chiffrable sans données de séries.

**Conséquence.** Étiqueter toutes les petites corrections serait un ralentissement réel. La cible porte donc sur les corrections de plus de 10 mm. Les corrections de 5 à 10 mm sont suivies sans objectif, celles de moins de 5 mm sont du bruit de référence (`fiches/BRUIT_REFERENCE.md`) et ne demandent aucune raison.

### 6.3 La porte, définie pour pouvoir la mesurer

- **Étiquetée** : la visite qui porte la référence (ou la dernière avec raison) a un `raisonCorrection`. On publie trois chiffres : par touche, collante, sans.
- **Objectif** : au moins 80 % des corrections de plus de 10 mm sont étiquetées, par touche ou collante.
- **Sans ralentir**, par deux contrôles. (1) *Dans la séance* : sur les cuts corrigés de taille voisine, le temps entre le dernier geste de rail et la validation ne dépasse pas, avec raison, celui des cuts sans raison de plus de 0,6 s en médiane. (2) *Avant/après* : cuts par minute, pour des parties du même type, dans la marge de variation entre parties (± 25 %). Seuil de coupure : plus de +5 % sur le cycle d'un cut corrigé, ou plus de +2 % sur le temps total ; au-delà, on limite à `1` à `5` sur les corrections de plus de 10 mm, ou on coupe.
- **Mic reste juge** : s'il le sent plus lent, la fonction se coupe, quels que soient les chiffres.

## 7. Plan de développement (version de test, à part de la test 8)

**Branche et paquet** : une branche de développement dédiée (`claude/50-rm11-dev`), partie de la base de la test 8 quand elle sera figée, et un paquet d'essai **à part**. La test 8 en cours n'est pas touchée. Numéro de version attribué par l'orchestrateur. Rien ne démarre sans le « oui » de Mic à cette fiche et le relevé des touches (§ 4).

**Niveau** : rapide, effort moyen (ligne RM-11 du plan, environ 250 k jetons). **Relecture forte limitée à `src/native-session.js`** : c'est le chemin d'enregistrement des visites d'Écho, et une erreur ici abîmerait des données.

### Fichiers touchés

| Fichier | Changement |
|---|---|
| `src/raison-correction.js` (nouveau) | module pur, sans DOM : catalogue (codes, libellés, touches), lecture d'une frappe, états (posée, collante, effacée), règle du délai de grâce, fin de série |
| `src/settings.js` | `echo.raison` : `actif: false`, `touches`, `graceMs: 500`, `doubleAppuiMs: 600`, `sautCuts: 30`, `rappelCollanteCuts: 40` ; lignes dans les réglages affichés |
| `src/native-page.js` | une ligne : la frappe d'un chiffre de raison est un événement **essentiel** (ne cède pas sous charge). Rien d'autre |
| `src/native-session.js` | traitement de la frappe dans `operator-event` ; héritage de la collante à `visit-started` ; `native.raison` ; en-tête `raisonSeries`. **Tout dans un `try`, jamais bloquant**, comme `observeMemoire` |
| `background.js` | état transmis au panneau, réglage lu et gardé, texte du bandeau |
| `panel.html`, `panel.js`, `panel.css` | bloc « Raison de la correction » (pastilles, ligne de collante, bande des 24 derniers cuts, aide des touches, couverture), tel que la maquette ; lecture clavier aussi quand le panneau a le focus |
| `src/early-input.js`, `src/adapter-page.js`, `src/bridge.js` | **aucun changement** (la garde native relève déjà les frappes ; rien n'est retenu, rien n'est émis) |
| `tools/jointure-echo-orbite.cjs` | `raisonHumaine`, couverture, séries, durées de visite, colonne CSV finale |
| `tools/jeu-apprentissage.cjs`, `tools/gcv2-jeu.cjs` | `etiquette` seulement ; `absents` mis à jour |
| `fiches/` | mise à jour de `JOINTURE_ECHO_ORBITE.md` ; consigne de séance terrain |

`manifest.json` ne change pas, sauf la version du paquet.

### Essais (tous hors ligne, sans ESV)

1. `tests/raison-correction.test.cjs` : module pur. Touches `Digit` et `Numpad`, `Maj` toléré, `Ctrl`, `Alt`, `Meta` et `repeat` ignorés, champ de texte ignoré ; un appui, deux appuis (collante), `0` ; priorité d'une raison seule sur la collante ; fin de série par chaque cause ; délai de grâce.
2. `tests/echo-raison.test.cjs` : dans `native-session`, sur le modèle de `echo-4918.test.cjs` : le champ est écrit ; la collante passe à la visite suivante ; elle survit à un F5 ; **la visite est identique à l'octet près quand la fonction est coupée** (référence figée avant).
3. `tests/raison-touches.test.cjs` : dans `src/early-input.js` en VM (modèle de `u3-raccourcis.test.cjs`) : aucun chiffre n'est retenu, aucune touche connue d'ESV n'est utilisée, rien n'est émis vers ESV.
4. `tests/raison-fuite.test.cjs` : les trois essais du § 5.3 (traits inchangés, liste blanche, recherche de texte).
5. `tests/jointure-echo-orbite-raison.test.cjs` et un cas dans `tests/native-export.test.cjs` : aller-retour avec le champ ; couverture ; colonne finale.
6. `tests/panel-raison.test.cjs` : identifiants du panneau, états, étiquettes d'accessibilité, mêmes contrôles que `panel-h.test.cjs`.
7. Un essai de non-blocage : 10 000 frappes de raison dans `native-session` n'allongent pas le traitement d'un cut au-delà de la marge existante, et une erreur dans le module n'empêche pas d'enregistrer la visite.
8. `verify` complet **une fois** à la livraison (une quinzaine de minutes), pas à chaque étape.

### Étapes

0. **Mesure de base** (0,5 j) : ajouter à la jointure la durée de visite et le temps geste-validation, les calculer sur les Échos reçus. Donne la référence « sans raison » de la § 6.
1. Relevé des touches par Mic (2 minutes, § 4).
2. Module pur et essais 1 et 4.
3. `native-session`, réglage, essais 2, 3, 7.
4. Panneau et essai 6.
5. Outils et essai 5.
6. Relecture forte de `native-session.js`, `verify`, paquet d'essai et consigne.

### Portes

- **MINIMUM** : fonction coupée = comportement et visites identiques ; aucune touche d'ESV doublée ou détournée (essai 3) ; aucune écriture ni commande vers ESV ; aucune raison dans les traits (essai 4) ; jamais bloquant (essai 7).
- **OBJECTIF** : séance d'Écho d'au moins 150 cuts, avec une zone d'ADV, par Mic : au moins 80 % des corrections de plus de 10 mm étiquetées, sans dépasser les seuils de coupure du § 6.3, et au moins une série collante pour juger le geste.

## 8. Risques

| Risque | Parade |
|---|---|
| ESV réagit déjà à un chiffre | relevé avant tout ; table des touches réglable ; `Alt+chiffre` en repli |
| Mic oublie une collante | ligne et pastille bleue dans le panneau, mot dans le bandeau, fins automatiques, rappel à 40 cuts |
| Touche attribuée au mauvais cut après la validation | délai de 500 ms seulement, marque `apresValidationMs`, mesure du vrai délai au premier essai ; ces cas sont écartés des mesures si le doute persiste |
| Raisons posées surtout quand Mic a le temps | absent = inconnu, jamais une classe ; couverture publiée à chaque export |
| Lassitude : de moins en moins de raisons dans la séance | couverture par tranche de 50 cuts dans la jointure ; arrêt de la fonction si elle tombe sous 40 % |
| Le panneau n'est pas sous les yeux de Mic | bandeau d'ESV ; question posée à Mic |
| Peu d'exemples de raisons rares | dit en § 3 ; usage diagnostique, pas un classeur |

## 9. Ce que Mic doit relire et décider

1. Veut-il la fonction (facultative, coupée par défaut) ?
2. Les six étiquettes. Veut-il « bon tel quel » à la place de « hauteur seulement » ?
3. Les touches `1` à `6` et `0`, et le relevé de 2 minutes dans ESV.
4. La collante par double appui. Le délai de 500 ms après la validation.
5. La cible : 80 % des corrections de plus de 10 mm, et non de toutes.
6. Où est le panneau pendant qu'il travaille ? Active-t-il le bandeau d'ESV ?
7. Le seuil de coupure : plus de +5 % sur un cut corrigé, ou plus de +2 % au total.

À reporter dans le fichier des décisions par l'orchestrateur quand Mic aura répondu.
