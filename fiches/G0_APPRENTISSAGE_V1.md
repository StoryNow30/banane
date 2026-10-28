# G0 — première étude d'apprentissage du « méga cerveau » (16 octobre 2026)

Lot G0 du cahier 5.0 (§ G0 et E5). Question : sur les corrections de l'opérateur, quelles poses d'Ariane sont fausses, et où ? Rien n'est changé à l'extension : tout est hors ligne, rien sous `src/`.

Outils : `tools/apprentissage-g0.cjs` (l'étude, essai `tests/apprentissage-g0.test.cjs`) et `tools/g0-enrichir-jeu.cjs` (ajoute au jeu E5 les traits que le jeu v1 ne porte pas, essai `tests/g0-enrichir-jeu.test.cjs`). Les deux essais tournent sur des fixtures **synthétiques** (parties 91 à 99, cuts inventés). Aucune donnée brute, aucune coordonnée absolue et aucun identifiant de projet dans le dépôt : les jeux utilisés restent hors dépôt.

## 1. Réponses en bref

| Question | Réponse | Porte |
|---|---|---|
| **1. Faux verts d'Ariane** : quels traits ? | Des indices **modestes mais de même sens dans les trois parties** : décalage vertical de convention `abs(dz)`, déplacement vertical d'Ariane depuis la pose d'ESV, confiance du moteur (basse), peu de lignes du sommet, écart aux voisins. Aucun trait ni modèle (logistique ou arbre à 2 niveaux) ne sépare bien : AUC de 0,45 à 0,69 en validation croisée par partie. **Rappel à 5 % des cuts signalés : 8 % en cumulé (6 fautes sur 75), de 0 % à 11 % selon la partie ; à 10 % : 17 %.** Le score M6 fait pareil ou mieux (11 % et 20 %). | **Non atteinte** (60 % des fautes dans 5 % des cuts). Elle est même **impossible par construction** sur les parties 17 et 24 : 24,5 % et 30 % des posés sont fautifs, 5 % des cuts ne peuvent en contenir que 21 % et 19 %. |
| **2. Détecteur de PN** | Sur la partie 29, `flushPct` ≥ 30 retrouve 22 des 24 cuts de passage du journal, **sans aucune fausse alerte** (précision 100 %, rappel 92 %, AUC 0,96). Sans `flushPct`, les traits de la liste ne suffisent pas (3 passages sur 24). Marge recommandée autour du cœur détecté : **4 cuts avant, 6 après**. | Atteinte **sur une seule partie** (4 PN). À confirmer. |
| **3. Écartement dans un PN** | Règle « écartement à plus de 10 mm de la médiane » : **54 mauvais objets sur 54**, tenue en validation croisée 12 → 13 et 13 → 12 (0 manqué ; une seule correction à plus de 10 mm non signalée, en partie 12 ; aucune fausse alerte contre les corrections de plus de 10 mm). Sur les **verts d'extraction** des parties Ariane elle est **juste mais courte** : partie 29, 19 signalés dont 18 justes, mais seulement 22 % des cuts corrigés de plus de 10 mm ; partie 17, elle se trompe (21 justes sur 92). | Atteinte sur les parties humaines ; **non atteinte** comme détecteur général de verts d'extraction faux. |
| **4. Correction verticale apprise** | Le biais est **prévisible par convention** et de signe stable : sur les rails à convention refusée, l'opérateur **remonte** la pose (+6,1 mm en médiane partie 17, +1,8 partie 24, +3,6 partie 29). Il ne l'est ni par zone (partie 29 seule, n = 24 et 48) ni par `dz`. La magnitude change beaucoup d'une partie à l'autre. Corriger les rails refusés de la valeur apprise sur les autres parties : **cuts corrigés de plus de 10 mm 75 → 63 (−16 %)**, tout le gain est dans la partie 17 (47 → 33). | **Non atteinte** (« 0 mauvaise pose ajoutée ») : 4 cuts passent au-dessus de 10 mm. Avec +3 mm fixe : 1 seul, mais le chiffre est choisi après coup. |

Les effectifs sont **petits** : 7 faux verts en partie 29, 21 en partie 24, 47 en partie 17. Les intervalles donnés (amorçage à 90 %) sont larges, voire dégénérés quand il n'y a qu'une poignée de fautes.

## 2. Données et méthode

### 2.1 Jeux utilisés

| Partie | Nature | Cuts | Posés avec référence | > 10 mm | > 5 mm |
|---:|---|---:|---:|---:|---:|
| 17 | lot Orbite 4.9.0.12 + Écho de l'opérateur | 795 | 192 | 47 (24,5 %) | 132 (68,8 %) |
| 24 | lot Orbite 4.9.0.15 + Écho de 1 h 36 (jointure v2) | 263 | 70 | 21 (30,0 %) | 46 (65,7 %) |
| 29 | lot Orbite 4.9.5.3 + Écho soigné de l'opérateur (2 sessions) | 821 | 198 | 7 (3,5 %) | 96 (48,5 %) |
| 12 | poses d'extraction ESV d'un opérateur débutant, corrigées par l'opérateur | 107 | — | — | — |
| 13 | poses d'extraction ESV, même opérateur | 224 | — | — | — |

- Format `ariane-jeu-apprentissage-v1` (E5). Après l'audit 5.0, la jointure de la partie 24 a été refaite par cadre de scène (I2) et rejouée avec D-143 : toutes les sorties de cette étude sont identiques, à un cut avec référence près (207 → 206, un différé ouvert juste après un rechargement de page) ; voir `fiches/JOINTURE_ECHO_ORBITE.md`. La partie 24 a été rejouée avec la jointure v2 et la règle « visité sans action = bon » à 0,8 s (65 validations observées + 5 visités sans action = 70 posés avec référence). La partie 29 porte la règle sous `regleVisiteBon` : l'outil l'applique avec le seuil de 0,8 s (6 cuts de plus que sans la règle, 198 posés avec référence au lieu de 192 ; 7 faux verts dans les deux cas).
- Partie 12 : le PN 7276–7289, confirmé par l'opérateur (D-136), manquait à l'en-tête du jeu ; il a été ajouté à la copie de travail (6 PN au lieu de 5).
- **Faux vert** : cut posé par Ariane dont la correction de l'opérateur dépasse **strictement** 10 mm en 3D (plus grand des deux rails), repère profil. Idem pour 5 mm. Les posés sans référence ne comptent pas (ils ne sont pas supposés bons, sauf la règle des 0,8 s).
- **Rouge** : cut du journal Orbite (posé, différé ou autre). La distance au rouge le plus proche et la grappe (liaison simple, trou ≤ 5 cuts) se calculent sur le journal complet de la partie, pas seulement sur les cuts joints à l'Écho (partie 24 : 515 rouges, 133 joints).

### 2.2 Extension « g0-traits-v1 » du jeu

Le jeu v1 ne porte que la convention en booléen, la confiance, le motif, le déplacement d'Ariane et un voisinage minimal. `tools/g0-enrichir-jeu.cjs` ajoute, **uniquement des traits d'Ariane ou de la pose de départ, jamais de la référence humaine** :

- `traits.g0.rails` (par rail) : `dzMm`, `duMm` (décalage de la convention), `conventionAppliquee`, `lossRatio`, `topRows`, `faceCount`, `nClusters`, `nStrongCompetitive`, `slopeLimited`, `s1Change`… (dernière observation GCV1 en ombre) ;
- distance au rouge le plus proche, taille et rang dans la grappe ;
- depuis la table M6 (`coherence-voisins.cjs`) : écart aux voisins posés, écartement de la pose, hors bande, score M6 ;
- `contexte.ecartementInitialMm` et `contexte.deniveleLocalMm` : écartement et dénivelé local des deux rails à la **première visite de l'Écho**, avant toute action. Pour un vert d'extraction, c'est la pose d'ESV. Pour un rouge, c'est le gabarit (1 500 mm) : ces deux traits ne servent que pour les verts d'extraction.

Les essais vérifient que changer seulement la référence humaine ne change aucun trait (frontière anti-fuite) et que la sortie ne contient aucune coordonnée.

### 2.3 Mesures et validation

- **Chaque trait seul** : AUC par partie (probabilité qu'un faux vert ait une valeur plus haute qu'un bon cut ; 0,5 = aucun pouvoir) et taux de faux verts par tranche. Un trait est dit **de signe stable** si son AUC est du même côté de 0,5 (de plus de 0,02) dans toutes les parties où elle se calcule. Une AUC n'est donnée qu'avec au moins 20 cuts renseignés et 3 cuts de chaque classe.
- **Modèles lisibles** : régression logistique (pénalité L2, 4 traits au plus, traits choisis sur l'apprentissage seulement : signe stable, écart d'AUC d'au moins 0,06, pas de doublon corrélé à plus de 0,8) et arbre de profondeur 2. Chaque partie d'apprentissage pèse autant. Un trait n'entre dans un modèle que s'il est renseigné pour au moins 60 % des cuts de **toutes** les parties concernées : `flushPct` et les zones (partie 29 seule) n'entrent donc jamais dans un modèle appris d'une partie à l'autre, ils sont mesurés.
- **Validation croisée par partie** : apprendre sur une partie, juger sur une autre (17 → 29, 29 → 17, 17 → 24, 24 → 17, 24 → 29, 29 → 24) et « les deux autres → une » (trois essais). Jamais la même partie des deux côtés (l'outil le vérifie et s'arrête sinon). Le modèle appris sur toutes les parties est donné à lire, **non jugé**.
- **Rappel à 5 % et 10 %** : on classe les posés de la partie jugée par score, on signale les ⌈5 %⌉ (ou 10 %) premiers, on compte les faux verts attrapés (un lien à la frontière compte au prorata). Pour 5 % de 198 cuts : 10 cuts ; de 192 : 10 cuts ; de 70 : 4 cuts. Intervalle d'amorçage à 90 % (1 000 tirages, graine fixe). On donne aussi la **part des cuts à signaler pour attraper 60 % des fautes**.
- **Référence** : le score M6 (D-126) est calculé sur les mêmes cuts. On retrouve la mesure de D-126 : AUC 0,71 sur la partie 17 (rappel de 9 % à 10 cuts signalés, 10,6 % à 5 % des 232 posés au journal).

## 3. Q1 — Les faux verts d'Ariane

### 3.1 Les traits, un par un

AUC par partie (17 / 24 / 29), faux verts à plus de 10 mm. Un trait dont l'AUC est sous 0,5 prédit le risque quand il est **bas**.

| Trait | > 10 mm : 17 / 24 / 29 | > 5 mm : 17 / 24 / 29 | Signe stable (> 10 mm) |
|---|---|---|---|
| décalage vertical de convention `abs(dz)` (plus grand des rails) | 0,71 / 0,53 / 0,66 | 0,75 / 0,55 / 0,57 | oui |
| déplacement vertical d'Ariane depuis la pose d'ESV | 0,63 / 0,79 / 0,54 | 0,64 / 0,75 / 0,56 | oui |
| confiance du moteur (plus faible des rails) | 0,37 / 0,24 / 0,44 | 0,29 / 0,32 / 0,39 | oui, **bas = risque** |
| lignes du sommet vues | 0,37 / 0,29 / 0,46 | 0,27 / 0,23 / 0,45 | oui, **bas = risque** |
| candidats forts concurrents | 0,57 / 0,55 / 0,61 | 0,56 / 0,46 / 0,53 | oui (> 10 mm seulement) |
| écart aux voisins posés (M6, cuts avec voisins) | 0,58 / 0,58 / — | 0,73 / 0,64 / 0,59 | oui |
| taille de la grappe de rouges | 0,60 / 0,63 / 0,45 | 0,70 / 0,65 / 0,57 | non (> 10 mm), oui (> 5 mm) |
| distance au rouge le plus proche | 0,46 / 0,41 / 0,50 | 0,40 / 0,36 / 0,44 | non (> 10 mm), oui (> 5 mm), **bas = risque** |
| calage de convention refusé (booléen) | 0,68 / 0,45 / 0,52 | 0,70 / 0,47 / 0,54 | **non** |
| rail repêché par S1 | 0,50 / 0,61 / 0,55 | 0,50 / 0,57 / 0,52 | non |
| pente du flanc limitée | 0,50 / 0,55 / 0,49 | 0,51 / 0,59 / 0,51 | non |
| motif / étage de la décision B1 autre que le premier passage | 0,50 / 0,59 / 0,51 | 0,52 / 0,62 / 0,57 | non |
| écartement hors bande p5–p95 | 0,52 / 0,45 / 0,52 | 0,49 / 0,54 / 0,54 | non |

Taux de faux verts par tranche (trois parties confondues) :

| Trait | Tranches (> 10 mm) | Tranches (> 5 mm) |
|---|---|---|
| `abs(dz)` | ≤ 4,5 mm : 5 % · 4,5–6,5 : 9 % · 6,5–8,5 : 18 % · **> 8,5 : 33 %** (38/115) | 43 % · 46 % · 68 % · **81 %** |
| convention refusée | refusée **30 %** (44/145) · appliquée 10 % (31/315) | 79 % · 51 % |
| déplacement vertical d'Ariane | ≤ 11 mm : 9 à 13 % · **> 11,4 : 31 %** (36/115) | 48 % · 56 % · 58 % · 76 % |
| confiance min | ≤ 63 : 19 à 20 % · **> 63 : 5 %** (5/102) | 70 % · 61 % · 66 % · 38 % |
| écart aux voisins (M6) | ≤ 2,9 mm : 6 % · **> 7,8 : 38 %** (21/55) | 51 % · 64 % · 72 % · **93 %** |
| taille de la grappe | — | ≤ 2 : 44 % · 2–9 : 54 % · 9–29 : 70 % · **> 29 : 75 %** |
| distance au rouge | — | à 1 cut : **67 %** (199/296) · au-delà : 45 à 47 % |
| S1 / pente limitée | 35 % (7/20) / 33 % (5/15) | 80 % / 93 % — mais **15 à 20 cuts seulement** |

Traits connus pour la **partie 29 seule** (mesurés, jamais appris d'une partie à l'autre) :

- **PN et marges** : 0 faux vert à plus de 10 mm sur les 24 posés en PN (les 7 sont hors PN : 7/174 = 4 %). À plus de 5 mm, 71 % en PN (17/24) contre 45 % hors PN : le PN n'est pas dangereux pour la grosse faute, mais pour la petite. Cohérent avec D-134 (1/37 en zone, 6/164 hors zone).
- **ADV** : 1 faux vert sur 12 posés (8 %) contre 6 sur 186. La distance à l'aiguille n'est pas évaluable (12 posés en ADV).
- **`flushPct`** : aucun lien avec les faux verts (AUC 0,46 ; 2/46 au-dessus de 12 contre 5/120 à zéro).

### 3.2 Les modèles, validation croisée par partie, > 10 mm

« Logistique » : 4 traits au plus choisis sur l'apprentissage. Rappel : faux verts attrapés parmi les cuts signalés. Dernière colonne : part des cuts à relire pour attraper 60 % des fautes.

| Apprentissage → jugée | Fautes | Logistique AUC | 5 % des cuts (IC 90 %) | 10 % | 60 % des fautes à | M6 AUC | M6 5 % | M6 10 % | M6 60 % à |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 24 → 17 | 47 | 0,66 | 2/47 = 4 % (0–11 %) | 9/47 = 19 % | 46 % | 0,71 | 4/47 = 9 % | 8/47 = 17 % | 39 % |
| 29 → 17 | 47 | 0,67 | 5/47 = 11 % (4–15 %) | 6/47 = 13 % | 40 % | 0,71 | 9 % | 17 % | 39 % |
| 24+29 → 17 | 47 | 0,69 | 4/47 = 9 % (4–16 %) | 9/47 = 19 % | 42 % | 0,71 | 9 % | 17 % | 39 % |
| 17 → 24 | 21 | 0,67 | 2/21 = 10 % (4–19 %) | 4/21 = 19 % | 47 % | 0,72 | 3/21 = 14 % | 6/21 = 29 % | 29 % |
| 29 → 24 | 21 | 0,45 | 2/21 = 10 % (0–20 %) | 2/21 = 10 % | 66 % | 0,72 | 14 % | 29 % | 29 % |
| 17+29 → 24 | 21 | 0,56 | 2/21 = 10 % (4–20 %) | 4/21 = 19 % | 59 % | 0,72 | 14 % | 29 % | 29 % |
| 17 → 29 | 7 | 0,66 | 0/7 | 0/7 | 51 % | 0,54 | 1/7 = 14 % | 1/7 | 51 % |
| 24 → 29 | 7 | 0,55 | 0/7 | 1/7 = 14 % | 49 % | 0,54 | 14 % | 14 % | 51 % |
| 17+24 → 29 | 7 | 0,53 | 0/7 | 0/7 | 54 % | 0,54 | 14 % | 14 % | 51 % |

**Cumul « les deux autres → une »** (trois essais, 75 fautes) : logistique **6/75 = 8 % à 5 %** et **13/75 = 17 % à 10 %**. Même cumul pour M6 : 8/75 = 11 % et 15/75 = 20 %. L'arbre à 2 niveaux est moins bon encore (AUC 0,47 à 0,59, rappel à 5 % entre 0 et 13 %). **Aucun modèle appris ne bat M6.**

> 5 mm : mêmes constats (AUC de 0,62 à 0,75 pour le modèle, 0,66 à 0,77 pour M6). Cumul : 21/274 = 8 % à 5 % et 40/274 = 15 % à 10 %. Il faut relire 47 à 60 % des cuts pour attraper 60 % des fautes à 5 mm.

### 3.3 La porte du cahier

« Au moins 60 % des fautes dans 5 % des cuts ou moins » :

- **Non atteinte** : de 0 à 11 % selon la partie pour les modèles appris (9 à 14 % pour M6), 8 % en cumulé. Les intervalles d'amorçage ne contiennent jamais 60 %.
- **Plafond arithmétique** (rappel maximal d'un classement parfait à 5 % des cuts) : partie 17, 10 cuts pour 47 fautes = **21 %** ; partie 24, 4 cuts pour 21 fautes = **19 %** ; partie 29, 10 cuts pour 7 fautes = 100 % (porte possible ; 5 fautes sur 7 devraient tomber dans 10 cuts). À 5 mm : 8 à 10 %. La porte n'a de sens que quand les faux verts sont moins de 8,3 % des cuts posés : c'est le cas de la partie 29 (3,5 %), pas des parties 17 et 24.
- Une porte plus réaliste pour une liste triée (relire « d'abord » les cuts les plus suspects) : 60 % des fautes dans **moins de 40 % des cuts**. M6 y arrive sur les parties 17 (39 %) et 24 (29 %), pas sur la 29 (51 %). Les modèles appris : 40 à 66 %.

### 3.4 Règles apprises, en clair

Arbre à 2 niveaux appris sur les trois parties (descriptif, non jugé), > 10 mm :

- déplacement vertical d'Ariane ≤ 13,8 mm **et** `abs(dz)` ≤ 6,7 mm : **5 %** de faux verts (10 cuts sur 214) ;
- déplacement vertical ≤ 13,8 mm **et** `abs(dz)` > 6,7 mm : **22 %** (39/178) ;
- déplacement vertical > 13,8 mm et peu de lignes du sommet (≤ 36) : **58 %** (14/24) ; avec plus de lignes : 27 % (12/44).

Régression logistique, par ordre de poids : `abs(dz)` (+), déplacement vertical d'Ariane (+), confiance du moteur (−), lignes du sommet (≈ 0).

À 5 mm : plus la perte de gabarit est faible (rapport de perte ≤ 8,1) et le déplacement vertical grand (> 10 mm), plus on se trompe (83 % de cuts à plus de 5 mm, 86/103).

Lecture : **Ariane se trompe surtout quand elle a beaucoup déplacé la pose verticalement ou quand la convention proposait un grand décalage vertical (refusé ou non)**. Ce sont des signaux de fond, pas des alarmes : même le tiers le plus risqué (`abs(dz)` > 8,5 mm) n'a que 33 % de faux verts.

## 4. Q2 — Détecteur de PN

### 4.1 Partie 29 (flushPct, 4 PN)

Population : les 236 cuts du journal (rouges), dont 24 dans le **passage** des 4 PN (28 cuts de passage en tout, 4 étant des verts hors journal sans `flushPct`).

| `flushPct` ≥ | Signalés | Dans un passage | Hors PN | Précision | Rappel |
|--:|--:|--:|--:|--:|--:|
| 10 | 73 | 23 | 50 | 32 % | 96 % |
| 20 | 29 | 22 | 7 | 76 % | 92 % |
| **30 à 80** | **22** | **22** | **0** | **100 %** | **92 %** |
| 90 | 20 | 20 | 0 | 100 % | 83 % |

- AUC de `flushPct` pour « passage de PN » : **0,96**. Les 2 passages manqués sont les **deux bords du passage du PN2** (3345, `flushPct` 10 ; 3352, `flushPct` 0) : la part au ras est basse à l'entrée et à la sortie.
- **Un PN laissé de côté à la fois** (seuil choisi sur les trois autres PN et un bloc de rouges hors PN) : 92 % des passages retrouvés (22/24), 7 fausses alertes sur 210 rouges hors PN. Les 7 viennent d'un seul pli, où le seuil appris tombe à 20 ; avec 30 ou plus, aucune. **Le seuil n'est pas critique entre 30 et 80.**
- **Sans `flushPct`** (logistique sur rapport de perte, déplacement d'Ariane, distance au rouge, un PN laissé de côté à la fois) : AUC 0,83, mais les 24 meilleurs scores ne contiennent que 3 passages sur 24. Les traits de la liste seuls ne détectent pas un PN ; `flushPct` est le trait qui compte.

### 4.2 Parties 12 et 13 (poses d'extraction, pas de `flushPct`)

Il n'y a pas de lot Orbite : l'indice disponible est l'écartement de la pose de départ (voir Q3). Règle « écartement à plus de 10 mm de la médiane » :

| Partie | Signalés | Dans un PN | Précision | PN touchés | Rappel des cuts de PN |
|---:|--:|--:|--:|--:|--:|
| 12 | 30 | 29 | 97 % | 6/6 | 30 % |
| 13 | 29 | 21 | 72 % | 6/6 | 22 % |

Chaque PN contient au moins un cut signalé (12 sur 12), mais la règle ne marque qu'un **sous-ensemble** des cuts d'un PN (seuls les cuts mal extraits) : elle trouve où est un PN, pas son étendue. La précision de la partie 13 est plus basse parce que 8 cuts signalés sont hors PN : 4 dans la zone d'ADV1 (4650–4653) et 4 juste après la zone d'ADV2 (4957–4960).

### 4.3 Marge recommandée avant et après

Le **parcours de l'opérateur** confirme les plages : sur les 16 PN (4 + 6 + 6), aucun cut n'est validé juste avant ni juste après la plage, et 234 cuts sur 251 des plages sont validés (les autres sont survolés). Ses plages sont donc bien l'étendue de son contrôle.

Marge entre le **cœur détecté par `flushPct` ≥ 50** et la plage contrôlée par l'opérateur (partie 29) :

| PN | Plage de l'opérateur | Cœur détecté | Avant | Après |
|---|---|---|--:|--:|
| PN1 | 1652–1667 | 1656–1663 | 4 | 4 |
| PN2 | 3342–3355 | 3346–3350 | 4 | 5 |
| PN3 | 5978–5992 | 5981–5986 | 3 | 6 |
| PN4 | 6466–6478 | 6470–6474 | 4 | 4 |

Couverture : avec **4 avant et 6 après**, les 4 PN de la partie 29 sont couverts ; avec 4 et 4, 2 sur 4. Par rapport au **passage** de la fiche de l'opérateur (cuts rouges consécutifs), ses marges sont 3 à 4 avant et 3 à 6 après. Sur les parties 12 et 13, le cœur marqué par l'écartement est plus petit que le vrai PN, donc les marges mesurées (2 à 10) sont gonflées ; elles ne servent qu'à vérifier que 10 cuts de chaque côté couvrent tout (12 PN sur 12).

**Recommandation : cœur détecté (`flushPct` ≥ 50) étendu de 4 cuts avant et 6 après.** Elle est asymétrique, comme les relevés : D-134 comptait 5/17 cuts à plus de 10 mm après la sortie d'un PN contre 2/13 avant l'entrée. Quatre PN : à confirmer sur d'autres parties.

## 5. Q3 — Détecteur d'erreur d'extraction ESV dans un PN

### 5.1 Parties humaines 12 et 13

« Écartement de la pose de départ à plus de 10 mm de la médiane de la partie » contre les **mauvais objets** (correction de 25 mm ou plus) :

| Partie | Cuts | Mauvais objets | Trouvés | Manqués | « Fausses alertes » | Écart maximal des autres | Écart minimal des mauvais |
|---:|--:|--:|--:|--:|--:|--:|--:|
| 12 | 106 | 28 | 28 | 0 | 2 | 30,2 mm | 19,5 mm |
| 13 | 222 | 26 | 26 | 0 | 3 | 22,6 mm | 22,7 mm |

**54 sur 54.** Les 5 « fausses alertes » sont des cuts corrigés de 10 à 25 mm (réglage large) : contre les corrections de plus de 10 mm, il y a 0 fausse alerte. Aucun des 198 cuts non touchés n'est signalé (D-135 : 0 sur 199).

**Validation croisée** (seuil appris par le meilleur F1 sur une partie, jugé sur l'autre avec sa propre médiane) :

| Apprentissage → jugée | Seuil appris | Plage des seuils optimaux | Trouvés | Fausses alertes | Manqués | Au seuil de 10 mm |
|---|--:|---|--:|--:|--:|---|
| 12 → 13 | 17,8 mm | 16,5 à 19,0 | 26/26 | 1 | 0 | 26 / 3 / 0 |
| 13 → 12 | 17,8 mm | 13,0 à 22,5 | 28/28 | 1 | 0 | 28 / 2 / 0 |

**La règle tient en validation croisée 12 → 13**, avec un seuil appris de 17,8 mm plutôt que 10 : le seuil de 10 mm retrouve tous les mauvais objets, mais un seuil de **16,5 à 19 mm** (plage optimale commune aux deux parties) en retrouve autant avec moins de fausses alertes (les réglages larges de 10 à 25 mm ne sont plus signalés). Les deux parties sont du même opérateur : la généralité reste à montrer.

### 5.2 Verts d'extraction des parties Ariane (hors journal, pose d'ESV)

| Partie | Verts | > 10 mm | ≥ 25 mm | Signalés à 10 mm | Justes (> 10) | Rappel (> 10) | Trouvés (≥ 25) | AUC (> 10) |
|---:|--:|--:|--:|--:|--:|--:|--:|--:|
| 17 | 372 | 126 | 16 | 92 | 21 | 17 % | 4/16 | 0,42 |
| 24 | 96 | 47 | 8 | 4 | 3 | 6 % | 0/8 | 0,46 |
| 29 | 534 | 83 | 39 | 19 | 18 | 22 % | 14/39 | 0,62 |

Signalés à d'autres seuils (justes parmi les corrigés > 10 mm) : partie 17, à 15 mm 9 (5), à 20 mm 4 (4) ; partie 29, à 15 mm 15 (14), à 20 mm 12 (11) ; partie 24, à 7,5 mm 11 (6).

- **Partie 29** : la règle est **précise** (18 justes sur 19, 95 %) mais **courte** : elle rate la moitié des gros écarts. Les 39 écarts de 25 mm ou plus sont de deux sortes. **10 sont latéraux** (30 à 38 mm sur un seul rail, surtout en PN et en ADV) : l'écartement change, la règle les voit. **29 sont verticaux** (26 à 45 mm sur un rail, souvent par séries : cuts 267–309 et 3475–3563) : l'écartement ne bouge presque pas, la règle ne les voit pas.
- **Partie 17** : à 10 mm la règle signale un quart des cuts (92 sur 372) et se trompe trois fois sur quatre : la dispersion naturelle des écartements est plus grande (95 % des cuts sont entre 1 426 et 1 449 mm, contre 1 432 et 1 445 en partie 29). À 15 mm elle redevient correcte. **Un seuil fixe de 10 mm ne se transporte pas d'une partie à l'autre.**
- **Piste non apprise : le dénivelé local** (hauteur du rail gauche moins hauteur du rail droit, comparée à la médiane des cuts voisins à ±10). Elle voit les sauts verticaux : AUC pour les ≥ 25 mm de **0,90 (partie 17), 0,80 (partie 24), 0,86 (partie 29)**. À 10 mm, ajoutée à l'écartement : partie 29, 31 des 39 gros écarts (53 signalés, 46 des 83 corrections > 10 mm) ; partie 17, les 16 (127 signalés, soit un tiers des verts). À 15 mm : partie 29, 27/39 pour 38 signalés. Seuil et valeur à valider : non appris, une seule mesure par partie.

## 6. Q4 — Correction verticale apprise

Convention de signe de la fiche : **correction = pose de l'opérateur − pose d'Ariane**, repère profil. « + » : l'opérateur remonte la pose. L'« erreur » de `P0_MESURES.md` (pose publiée − pose de l'opérateur) est l'opposée : −6,5 mm d'erreur sur les rails refusés de la partie 17 = +6,5 mm de correction de l'opérateur. Le −2 mm de D-134 pour la partie 29 est une correction (l'opérateur descend Ariane) ; je trouve **−1,2 mm de moyenne par rail** sur les 198 posés avec référence (−1,8 sur les rails que l'opérateur a réellement déplacés).

### 6.1 Où est le biais ?

Moyenne / médiane de la correction verticale (mm), nombre de rails entre parenthèses :

| Groupe | Partie 17 | Partie 24 | Partie 29 | Signe |
|---|---|---|---|---|
| tous les rails | +0,6 / 0,0 (384) | −2,5 / 0,0 (140) | −1,2 / 0,0 (396) | **instable** |
| convention refusée | **+4,9 / +6,1** (99) | **+2,1 / +1,8** (37) | **+3,7 / +3,6** (21) | **positif, stable** |
| convention appliquée | −1,0 / 0,0 (281) | −3,7 / −1,5 (92) | −1,5 / 0,0 (353) | négatif (petit) |
| rail gauche, tous | +1,2 / 0,0 | −3,2 / 0,0 | −1,3 / 0,0 | instable |
| refusée, rail gauche | +5,9 / +6,3 (63) | +3,3 / +2,9 (11) | +2,6 / +1,5 (12) | positif |
| refusée, rail droit | +3,2 / +3,1 (36) | +1,6 / +0,9 (26) | +5,2 / +4,9 (9) | positif |
| PN (marges comprises) | — | — | −0,6 / 0,0 (48) | une seule partie |
| ADV (marge élargie comprise) | — | — | −1,5 / 0,0 (24) | une seule partie |
| hors zone | — | — | −1,3 / 0,0 (324) | une seule partie |

- **Par partie** : le biais global change de signe (+0,6 ; −2,5 ; −1,2). Il n'est pas stable.
- **Par convention** : quand le calage de convention est **refusé**, l'opérateur remonte la pose dans les trois parties, de **+1,8 à +6,1 mm** en médiane. C'est le seul biais de signe stable. Sa **taille** ne l'est pas (écart de 1 à 3 entre les parties). Quand il est appliqué, la correction est légèrement négative en moyenne et nulle en médiane (la moitié des rails n'est pas touchée).
- **Par zone** : rien de net sur la partie 29 (PN −0,6, ADV −1,5, hors zone −1,3 en moyenne, tous 0,0 en médiane). Non jugeable entre parties : les zones n'existent que pour la partie 29.
- **Par `dz`** : la correction ne suit pas le décalage prédit par la convention. Pente de la correction sur `dz`, rails refusés : −0,62 (partie 17), +0,95 (partie 24), −0,59 (partie 29) ; corrélations −0,08, +0,22, −0,20. Le grand décalage prédit n'annonce pas une correction plus grande de l'opérateur.

### 6.2 Gain d'une correction apprise sur une partie et appliquée à l'autre

Correcteur retenu : **rails à convention refusée seulement**, décalage = médiane de la correction sur les rails refusés des parties d'apprentissage ; tous les autres rails : 0. Cuts corrigés de plus de 10 mm, avant → après :

| Apprentissage → jugée | Valeur apprise | > 10 mm | > 5 mm | Cuts améliorés / aggravés | Passés au-dessus de 10 mm |
|---|--:|---|---|--:|--:|
| 24+29 → 17 | +2,8 mm | 47 → 33 | 132 → 127 | 50 / 12 | 0 |
| 17+29 → 24 | +5,4 mm | 21 → 24 | 46 → 52 | 8 / 14 | 4 |
| 17+24 → 29 | +4,7 mm | 7 → 6 | 96 → 91 | 10 / 5 | 0 |
| **Cumul** | | **75 → 63 (−16 %)** | 274 → 270 | 68 / 31 | **4** |
| 29 → 17 seul | +3,6 mm | 47 → 31 | 132 → 127 | 49 / 13 | 0 |
| 17 → 24 seul | +6,1 mm | 21 → 24 | 46 → 53 | 8 / 15 | 4 |
| 24 → 17 seul | +1,8 mm | 47 → 39 | 132 → 131 | 50 / 9 | 0 |

Les autres correcteurs (même valeur sur tous les rails, par convention appliquée ou refusée, par côté, linéaire en `dz`) sont dans le JSON de l'outil. La variante linéaire en `dz` donne 75 → 62, sans mieux que la constante (75 → 63) : `dz` n'apporte rien. **Corriger tous les rails d'une valeur moyenne aggrave** (75 → 81 en cumulé : 112 cuts aggravés contre 58 améliorés) : le biais n'existe que sur les rails refusés. Les correcteurs fondés sur les moyennes (rails appliqués compris) améliorent le nombre de cuts à 5 mm (274 → 247) mais aggravent 144 cuts pour en améliorer 206.

**Grille de décalages fixes** sur les rails refusés (choisis après coup : un ordre de grandeur, pas une validation) :

| Décalage | Partie 17 (> 10 mm) | Partie 24 | Partie 29 | Total | Passés au-dessus de 10 mm |
|--:|---|---|---|---|--:|
| +1 mm | 47 → 42 | 21 → 21 | 7 → 6 | 75 → 69 | 1 |
| +2 mm | 47 → 39 | 21 → 21 | 7 → 6 | 75 → 66 | 1 |
| **+3 mm** | **47 → 32** | 21 → 21 | 7 → 6 | **75 → 59** | **1** |
| +4 mm | 47 → 30 | 21 → 22 | 7 → 6 | 75 → 58 | 2 |
| +5 mm | 47 → 29 | 21 → 23 | 7 → 6 | 75 → 58 | 4 |
| +6 mm | 47 → 29 | 21 → 24 | 7 → 6 | 75 → 59 | 7 |

Le gain est **concentré sur la partie 17** (99 rails refusés, 26 % des rails) ; il est nul sur la partie 24 et de 1 cut sur la partie 29 (21 rails refusés, 5 % des rails). Plafond (correcteur appris sur la partie jugée elle-même, non valide) : 47 → 29, 21 → 21, 7 → 6.

## 7. Ce qui pourrait en sortir

### (a) Liste « à relire » dans le panneau

- **Porte (60 % des fautes dans 5 % des cuts) : non atteinte.** Meilleur résultat appris : 11 % à 5 % des cuts sur une partie, 8 % en cumulé ; M6 : 11 %. Pas de gain d'apprendre plutôt que de garder le score M6 de D-126.
- Le panneau « à relire » **reste suspendu** (D-126). Une liste *triée* (relire d'abord les plus suspects) attraperait 60 % des fautes à plus de 10 mm en relisant 30 à 50 % des cuts avec M6 (40 à 66 % avec les modèles appris) : c'est une aide à l'ordre de relecture, pas une alarme.
- La porte n'a de sens que si les faux verts sont rares (moins de 8,3 % des posés). À réécrire quand les parties à 25–30 % de faux verts auront disparu (P1 / convention) ou pour une cible « fautes à plus de 15 mm ».

### (b) Règles métier d'Orbite

| Règle proposée | Données | Porte |
|---|---|---|
| **PN** : un rouge dont `flushPct` ≥ 50 ouvre une zone de prudence (garde, repli) ; plage de contrôle = cœur étendu de 4 cuts avant et 6 après ; chaque cut de la plage est visité. | Partie 29 : précision 100 %, rappel 92 %, 4 PN couverts sur 4 | **Atteinte sur une partie** (porte proposée : précision ≥ 95 % et rappel ≥ 90 % sur au moins deux parties). |
| **Extraction suspecte** : un vert dont l'écartement de départ sort de la médiane de la partie de plus de 10 à 18 mm devient un cut à visiter (en priorité dans un PN). | Parties 12/13 : 54/54, tenue en validation croisée ; partie 29 : 18 justes sur 19 | Atteinte sur les parties humaines ; **non atteinte** en général : seuil non transportable (partie 17), rappel de 22 % sur les verts d'extraction de la partie 29. |
| **Vertical** : un rail à convention refusée est remonté de ~3 mm. | Gain concentré sur la partie 17 (47 → 32) | **Non atteinte** (« 0 mauvaise pose ajoutée » du cahier : 4 cuts passent au-dessus de 10 mm en validation croisée, 1 avec +3 mm choisi après coup). À poser en **ombre P8**, pas en activation. |
| **Visite** : ne pas laisser vert un cut dont le dénivelé local sort de la médiane de plus de 15 mm. | AUC 0,80 à 0,90 sur trois parties | Non évaluée au sens d'une porte ; **à valider** (une mesure par partie). |

### (c) Traits pour GCV2

Porte proposée : signe stable sur les trois parties et AUC moyenne d'au moins 0,60 pour les fautes à plus de 10 mm.

| Trait | Entre dans GCV2 ? |
|---|---|
| décalage vertical de convention `abs(dz)` | **Oui** (0,71 / 0,53 / 0,66). Préférable au booléen « convention refusée » (0,68 / 0,45 / 0,52), qui n'est pas stable. |
| déplacement vertical d'Ariane depuis la pose d'ESV | **Oui** (0,63 / 0,79 / 0,54) |
| confiance du moteur (basse) | **Oui** (0,63 / 0,76 / 0,56 en sens inverse) |
| lignes du sommet vues (peu) | **Oui** (0,63 / 0,71 / 0,54) |
| écart aux voisins (M2, M4 : contexte) | Oui pour les fautes à plus de 5 mm (0,73 / 0,64 / 0,59) ; limite pour 10 mm |
| grappe de rouges, distance au rouge | Oui pour les fautes à plus de 5 mm (0,57 à 0,70) ; non pour 10 mm |
| candidats forts concurrents | À garder à l'œil (0,57 / 0,55 / 0,61, AUC moyenne 0,58) |
| `flushPct` | Trait de **contexte PN** (détecteur de zone), pas trait de faute |
| rail repêché S1, pente limitée, étage B1 | Non : signe instable, 15 à 40 cuts seulement |
| écartement et dénivelé local de départ | Traits d'**extraction** (vert à contrôler), pas de pose d'Ariane |

## 8. Ce qu'il manque en données

- **Faux verts (Q1)** : pour tenir un rappel de 60 % à ±10 points (90 %), il faut environ **65 fautes dans la partie jugée**. À 3,5 % de faux verts (régime de la partie 29), cela fait 1 900 posés relus, soit **une dizaine de parties** relues comme la 29 (Écho soigné de l'opérateur, chacune ≈ 200 posés avec référence). À 25 % (régime 17/24), 260 posés suffisent (une partie et demie), mais la porte à 5 % y est impossible. Pour **entraîner** un modèle de 8 traits sans tâtonner, compter 10 à 20 fautes par trait, soit 80 à 160 faux verts : **2 à 4 parties** de type 17 (47 faux verts) ou **12 à 23** de type 29 (7 chacune). Si les 500 corrections que G1 demande sont 500 posés relus, à 3,5 % de faux verts cela ne ferait que 18 fautes à plus de 10 mm. **Le nombre de corrections ne suffit pas : ce qui compte, c'est le nombre de fautes d'Ariane qu'elles contiennent.**
- **Version** : les trois parties viennent de trois versions (4.9.0.12, 4.9.0.15, 4.9.5.3). Le taux de convention refusée passe de 23 % à 5 % ; les traits changent de loi d'une partie à l'autre. **Une partie par version courante** est plus utile qu'une quatrième ancienne.
- **PN (Q2)** : 4 PN avec `flushPct` ; établir une précision d'au moins 95 % demande une quarantaine de cuts de passage sans fausse alerte (22 cuts sans erreur donnent seulement 90 % en borne basse à 90 %), soit **8 PN** ; pour estimer aussi le rappel, viser **20 PN**, soit **5 parties** avec relevé S6 et plages données par l'opérateur. Les PN des parties 17 et 24 n'ont pas de plage donnée : demander à l'opérateur de les relire ou recalculer `flushPct` sur les nuages archivés.
- **Écartement (Q3)** : 54 mauvais objets mais **un seul opérateur** et un seul projet (D-123). Il faut une partie d'un **autre opérateur** et le **second projet ESV** annoncé, ainsi qu'un seuil exprimé en fonction de la dispersion de la partie.
- **Biais vertical (Q4)** : le signe est stable (3 parties sur 3), la **taille** (1,8 à 6,1 mm) non. Pour la fixer à ±1 mm (90 %), avec un écart entre parties de 2,2 mm, il faut **13 parties** environ, chacune avec une centaine de rails refusés. Il faudrait aussi connaître les causes (P1, nouvelle version du calage).
- **Zones et raison de la correction** : M1 (zones) n'existe que pour la partie 29 ; la raison de la correction (E3) n'existe pas. Sans elles, ni la zone ni la cause ne s'apprennent.

## 9. Limites

- **Un seul projet ESV, un seul opérateur humain** (parties 12 et 13), et **trois parties** pour Ariane. La validation croisée par partie est la bonne mesure, mais elle repose sur trois points.
- **Effectifs** : partie 29, 7 faux verts ; partie 24, 70 posés. Tout rappel de la partie 29 est un multiple de 14 % (1/7). L'amorçage rééchantillonne les cuts jugés : avec une poignée de fautes l'intervalle est dégénéré (0 à 0 %).
- **Les références de l'opérateur** ne sont pas une vérité indépendante (voir `E5_METRIQUES.md`). Les parties 17 et 24 sont des relectures moins soignées que la 29, ce qui peut gonfler leur taux de faux verts : l'effet « soin » ne se sépare pas de l'effet « version » (D-134).
- **Traits M6** : l'écart aux voisins utilise des voisins posés avant *et après* le cut : il vaut pour une liste établie à la fin du lot, pas pendant. Il est absent d'environ la moitié des posés (pas de voisin à ±3).
- **Traits d'une seule partie** (zones, `flushPct`, distance à l'aiguille) : mesurés, jamais appris entre parties.
- **Seuils choisis après coup** : la grille de décalages fixes (Q4) et les seuils d'écartement 15 à 20 mm sont des ordres de grandeur.
- La **distance au rouge** est calculée sur le journal Orbite (les cuts que le lot a traités) : c'est une approximation des rouges de la carte ESV, qui compterait aussi les rouges laissés à un autre lot.

## 10. Rejouer l'étude

```
node tools/jeu-apprentissage.cjs --jointure table.json --avec-hors-journal --sortie jeu.jsonl
node tools/coherence-voisins.cjs --journal J.json --bilan B.json --partie N --jointure table.json --sortie m6.json
node tools/g0-enrichir-jeu.cjs --partie N --jeu jeu.jsonl --journal J.json --m6 m6.json --echo dossier-echo --sortie jeu-enrichi.jsonl
node tools/apprentissage-g0.cjs --jeu a.jsonl --jeu b.jsonl --jeu c.jsonl [--questions 1,2,3,4] [--bootstrap 1000] [--json sortie.json]
```

Les jeux sont des données privées (cuts de terrain) : ils restent hors dépôt. L'outil d'étude accepte aussi des jeux non enrichis (il n'utilise alors que les traits du jeu v1).
