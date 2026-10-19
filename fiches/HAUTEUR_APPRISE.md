# Hauteur apprise : la meilleure correction de hauteur, en ombre (chantier 5.0, 17 octobre 2026)

Le chantier « faux verts » (`FAUX_VERTS.md`) a montré que **70 des 85 faux verts viennent de la hauteur du rail** (convention verticale) et que, pour 81 cas sur 85, l'opérateur garde le minimum d'Ariane et ne corrige que la hauteur. Une correction « a + b × épaisseur du dessus » ferait passer les faux verts de 85 à 66, mais en créerait 7 nouveaux. Ce chantier cherche **la meilleure correction de hauteur possible**, sur **tous** les cuts posés avec une référence, et la livre **en ombre** : la décision consigne la hauteur corrigée à côté de la pose réelle ; la pose, la commande et l'étage ne changent pas.

Conventions : **[V]** vérifié (mesuré) ; **[S]** supposé. Aucun identifiant de projet, aucune coordonnée absolue. « 1:17 » = projet 1, partie 17 ; « 2:1 » = projet 2, partie 1. Correction verticale = pose de l'opérateur − pose d'Ariane, repère profil du rail, « + » = l'opérateur remonte.

## 1. Réponses en bref

| Question | Réponse |
|---|---|
| **Meilleur modèle** | **Linéaire par groupe de calage, avec une enveloppe prudente.** Correction = part × (a + b × épaisseur du dessus), bornée à ± 5 mm. Rails calés : a = 3,28, b = −0,50, **part 0,5** (on n'applique que la moitié de la droite apprise). Rails refusés (`shift-out-of-domain`) : a = 17,89, b = −1,14, part 1. Abstention : ornière d'un PN, calage ni appliqué ni refusé hors domaine, moins de 15 points du dessus. [V] |
| **Faux verts (validation croisée par partie)** | **85 → 61 : 24 corrigés, 0 nouveau.** 1:17 47 → 28 ; 1:24 21 → 19 ; 1:29 7 → 4 ; 2:1 10 → 10. Cuts à plus de 5 mm : 319 → 281. [V] |
| **Stable ?** | Oui pour l'enveloppe : choisie sur les trois parties d'apprentissage, elle est **la même dans les quatre plis** (part 0,5 / 1, plafond 5 mm). Les coefficients des rails calés bougent peu (a 2,95 à 3,99 ; b −0,45 à −0,62) ; ceux des rails refusés davantage (a 11,2 à 19,4 ; b −0,66 à −1,26), mais le plafond de 5 mm les rend presque équivalents. [V] |
| **Bruit de la référence** | **Aucune transition n'est franche** : les 24 cuts corrigés étaient entre 10,1 et 14,2 mm, ils passent entre 5,9 et 9,8 mm ; tout se joue dans la bande de bruit vertical (2 à 4 mm par axe). Le « 0 nouveau » dépend du seuil : à 9 mm, 114 → 85 avec **6 nouveaux** ; à 11 mm, 66 → 47 avec **3 nouveaux**. [V] |
| **P8 ou hauteur apprise ?** | **Garder les deux en ombre**, mais **seule la hauteur apprise est candidate à l'activation**. P8 (3,6 mm sur les rails refusés) : 85 → 68, 18 corrigés, **1 nouveau** (et 3,6 mm a été choisi sur trois des quatre parties). La branche « rails refusés » de la hauteur apprise fait aussi bien (85 → 68, 17 corrigés) **sans nouveau** ; la branche « rails calés » ajoute 7 corrigés. [V] |
| **Ombre sans effet** | Prouvé : essais octet pour octet, et rejeu des quatre lots réels (1 380 cuts) : **décisions et commandes identiques** avec et sans l'ombre. Chemin ouvert pour l'essai seulement : il ne change que la hauteur (1 026 commandes, 5 mm au plus) et n'ajoute **aucune pose**. [V] |
| **Coût** | Le modèle touche presque tous les posés (606 cuts sur 621, souvent de moins de 1 mm). Sur 2:1, où l'opérateur ne touche presque rien, l'écart vertical médian passe de 0 à 0,3 mm (3D : 0 à 0,6 mm), sans aucun faux vert de plus. [V] |

## 2. Données et méthode

| Partie | Version du lot | Posés avec référence | Faux verts | Rails calés / refusés / autres | Bruit vertical de la référence |
|---|---|--:|--:|---|--:|
| 1:17 | 4.9.0.12 | 192 | 47 | 281 / 99 / – | 3,8 à 4,1 mm |
| 1:24 | 4.9.0.15 | 70 | 21 | 92 / 37 / – | 3,8 à 4,1 mm |
| 1:29 | 4.9.5.3 | 198 | 7 | 353 / 21 / – | 2,0 à 2,1 mm |
| 2:1 | 4.9.5.3 | 161 | 10 | 299 / 4 / – | 2,0 à 2,1 mm |

Total : 621 cuts, 1 242 rails jugés (1 025 calés, 161 refusés, 56 sans calage lisible). Mêmes jeux, lots et règle « avec référence » que `FAUX_VERTS.md` (mêmes 85 faux verts). Bruit : `BRUIT_REFERENCE.md`.

- **Outil** `tools/hauteur-apprise.cjs` (essai `tests/hauteur-apprise-outil.test.cjs`, fixtures synthétiques).
  - `extraire` calcule les signaux **avec le module de l'extension** (`src/hauteur-apprise.js`, `signaux`) sur la capture du lot, la science du cut du journal et la pose posée. La référence humaine est rangée à part : changer la correction de l'opérateur ne change aucun signal (essai anti-fuite).
  - `etudier` essaie les familles de modèles sous une enveloppe, en validation croisée par partie (§ 3).
  - `preuve` rejoue un lot avec et sans l'ombre (§ 5).
- **Faux vert** : plus grand des deux rails, 3D, plus de 10 mm. On ne corrige que la hauteur : l'écart latéral et longitudinal reste celui de la référence.
- **Validation croisée par partie** : apprendre sur trois parties, juger la quatrième.
  - **Imbriquée** : l'enveloppe (part par groupe et plafond, 120 combinaisons) est choisie sur les trois parties d'apprentissage seulement ; critère : faux verts après − avant + 10 × nouveaux, puis le plus petit écart vertical médian. C'est l'estimation honnête.
  - **Enveloppe fixe** : celle choisie sur les quatre parties, coefficients appris sur trois. Pour la famille linéaire, elle est identique à l'imbriquée.
- **Transitions franches** : un cut corrigé « franchement » passe de plus de 10 + σ à moins de 10 − σ (σ = bruit vertical de la partie) ; un nouveau franc fait l'inverse.

## 3. Étude

### 3.1 Signaux

| Signal | Utilisé ? | Ce qui a été vu |
|---|---|---|
| Épaisseur du dessus (90e − 10e centile, à la pose décidée) | **Oui** | Corrélation avec la correction verticale : −0,31 à −0,59 sur le premier projet (rails calés et refusés), +0,06 sur 2:1. Pente apprise stable sur les rails calés. [V] |
| Calage appliqué ou refusé | **Oui** (le groupe) | Rails refusés : l'opérateur remonte (médiane +6,1 / +1,8 / +3,6 mm ; +7,4 sur 2:1, 4 rails). Rails calés : médiane 0, il descend les dessus épais. [V] |
| Décalage mesuré du calage `dz` | Non | En plus de l'épaisseur : pas de gain (exploration : 85 → 62 avec 9 nouveaux, contre 85 → 64 et 7 nouveaux sans lui, sans enveloppe). [V] exploration hors outil |
| Points du dessus | **Abstention seulement** (< 15) | Comme variable du modèle, il ne se transporte pas d'un projet à l'autre (densité différente) : appris sur le premier projet, il ferait 10 → 111 faux verts sur 2:1. [V] exploration |
| Quantiles de la bande (médiane, 10e, 90e) | Non | Modèles équivalents sans enveloppe (85 → 59 à 63, 7 à 10 nouveaux) ; avec enveloppe en validation imbriquée, moins bons (médiane seule : 85 → 75, 3 nouveaux ; médiane et 90e : 85 → 69, 2 nouveaux). [V] exploration |
| Version, partie | Non | Version et partie vont ensemble (deux parties par version) : un effet de version ne se sépare pas d'un effet de partie, et la partie n'existe pas pour une partie neuve. Les coefficients appris sans 1:17 (4.9.0) restent proches de ceux appris avec. [V] |
| Profil du rail | Non | Les quatre parties sont toutes en U50 : rien à apprendre. [V] |
| Pondération par le bruit de la partie | Non | Apprendre en pondérant par 1/σ² : moins bon en validation imbriquée (85 → 73, 2 nouveaux). [V] exploration |

### 3.2 Familles de modèles (validation croisée imbriquée, cumul des 4 parties)

| Famille | Faux verts | Corrigés | Nouveaux | > 5 mm | Cuts touchés |
|---|---|--:|--:|---|--:|
| Aucune correction | 85 → 85 | 0 | 0 | 319 → 319 | 0 |
| P8 (3,6 mm, rails refusés), enveloppe choisie sur l'apprentissage | 85 → 84 | 2 | 1 | 319 → 310 | 57 |
| P8 appris (médiane des rails refusés) | 85 → 85 | 2 | 2 | 319 → 312 | 57 |
| **Linéaire par groupe** | **85 → 61** | **24** | **0** | **319 → 281** | 606 |
| Par morceaux (médiane par classe d'épaisseur 0–8–10–12–14 mm) | 85 → 69 | 17 | 1 | 319 → 299 | 313 |
| Linéaire sans enveloppe (le levier de `FAUX_VERTS.md`) | 85 → 64 à 66 | 26 à 28 | 7 | — | — |

Les familles P8 ne gagnent rien en validation imbriquée parce que le pli 1:17 refuse toute correction (sans 1:17, les rails refusés sont rares). P8 tel qu'il est consigné est comparé au § 4.

### 3.3 Le modèle retenu, par partie (validation croisée imbriquée)

| Partie | Faux verts avant → après | Corrigés | Nouveaux | Francs (corrigés / nouveaux) | > 5 mm | Écart vertical médian à la pose de l'opérateur (par rail) | Écart 3D médian (par cut) | Seuil 9 mm (nouveaux) | Seuil 11 mm (nouveaux) |
|---|---|--:|--:|---|---|---|---|---|---|
| 1:17 | **47 → 28** | 19 | **0** | 0 / 0 | 132 → 111 | 3,62 → 2,97 mm | 7,28 → 5,92 | 62 → 42 (5) | 36 → 20 (3) |
| 1:24 | **21 → 19** | 2 | **0** | 0 / 0 | 46 → 41 | 4,01 → 2,86 mm | 7,37 → 6,97 | 25 → 24 (1) | 19 → 17 (0) |
| 1:29 | **7 → 4** | 3 | **0** | 0 / 0 | 96 → 85 | 1,60 → 1,52 mm | 4,87 → 4,62 | 16 → 8 (0) | 3 → 2 (0) |
| 2:1 | **10 → 10** | 0 | **0** | 0 / 0 | 45 → 44 | 0 → 0,30 mm | 0 → 0,60 | 11 → 11 (0) | 8 → 8 (0) |
| **Total** | **85 → 61** | **24** | **0** | 0 / 0 | 319 → 281 | | | 114 → 85 (6) | 66 → 47 (3) |

Coefficients des quatre plis (appris sans la partie jugée) : sans 1:17, calés 3,99 / −0,62, refusés 11,15 / −0,66 ; sans 1:24, 2,95 / −0,45 et 18,90 / −1,19 ; sans 1:29, 3,14 / −0,48 et 19,30 / −1,23 ; sans 2:1, 3,62 / −0,53 et 19,38 / −1,26. Enveloppe : part 0,5 / 1, plafond 5 mm dans les quatre plis.

Le modèle figé (appris sur les quatre parties, coefficients arrondis, le même que le module), rejoué sur les quatre parties : **85 → 60** (25 corrigés, 0 nouveau) ; 1:17 47 → 27, 1:24 21 → 19, 1:29 7 → 4, 2:1 10 → 10. Ce chiffre est **en échantillon**.

### 3.4 Ce que fait le modèle figé

| Épaisseur du dessus | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 mm |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| Rail calé | +0,1 | −0,4 | −0,9 | −1,4 | −1,9 | −2,4 | −2,9 | −3,4 mm |
| Rail refusé | +5 | +5 | +5 | +4,2 | +1,9 | −0,3 | −2,6 | −4,9 mm |

- Rail calé : un dessus fin ne bouge pas, un dessus épais descend de quelques millimètres (le calage le monte au 90e centile, l'opérateur le pose plus bas). Sur les 1 025 rails calés : médiane −0,3 mm, 80 % entre −1 et +0,2 mm.
- Rail refusé : posé brut, il est remonté de 5 mm au plus (P8 : 3,6 mm), moins si le dessus est épais, et descendu au-delà de 16 mm (cas 4732, 4733, 4750, 4751 de 1:17, que l'opérateur descend). Sur les 161 rails refusés : médiane +3,9 mm, 58 au plafond.
- La moitié seulement de la droite est appliquée aux rails calés : avec la droite entière, 1:17 gagne un peu plus mais crée des faux verts (cumul 85 → 63 avec 5 nouveaux, enveloppe fixe).

## 4. Comparaison avec P8

| Variante | Faux verts | Corrigés | Nouveaux | > 5 mm | Cuts touchés | Par partie |
|---|---|--:|--:|---|--:|---|
| P8 tel que consigné (3,6 mm, rails refusés, tous étages) | 85 → 68 | 18 | **1** | 319 → 305 | 149 | 1:17 47 → 31 ; 1:24 21 → 21 (1 corrigé, 1 nouveau) ; 1:29 7 → 6 ; 2:1 10 → 10 |
| Hauteur apprise, rails refusés seuls (validation croisée) | 85 → 68 | 17 | 0 | 319 → 301 | 148 | 1:17 47 → 32 ; 1:24 21 → 20 ; 1:29 7 → 6 ; 2:1 10 → 10 |
| Hauteur apprise, rails calés seuls (validation croisée) | 85 → 78 | 7 | 0 | 319 → 301 | 582 | 1:17 47 → 43 ; 1:24 21 → 20 ; 1:29 7 → 5 ; 2:1 10 → 10 |
| **Hauteur apprise complète** (validation croisée) | **85 → 61** | **24** | **0** | 319 → 281 | 606 | voir § 3.3 |

- P8 est mesuré **en échantillon** pour 1:17, 1:24 et 1:29 (3,6 mm est la médiane de 1:29, entre les deux autres) ; la hauteur apprise est mesurée en validation croisée. La comparaison est donc plutôt favorable à P8, et la hauteur apprise reste devant.
- Sur les rails refusés, les deux font le même travail ; la hauteur apprise évite le nouveau faux vert de 1:24 parce qu'elle remonte moins un dessus épais.
- **Recommandation** : garder **les deux en ombre**. P8 ne coûte rien, il est déjà dans les exports et sert de témoin sur les parties neuves. **Seule la hauteur apprise a un chemin d'activation** (P8 n'en a pas) ; on n'appliquerait jamais les deux, puisqu'elles se cumuleraient sur les rails refusés.

## 5. L'ombre et la preuve « sans effet »

### 5.1 Où elle vit

- `src/hauteur-apprise.js` : module pur (signaux, correction, abstention, pose corrigée). Il ne lit que la capture, la science du cut et la décision.
- `src/lot-decision.js`, `decideCut` : la décision qui pose reçoit une clé `hauteurApprise`. Pour chaque rail, elle contient le groupe, l'épaisseur, les points du dessus, la correction (ou l'abstention et son motif), la pose réelle (`reelle`, celle de `positions`) et la pose corrigée (`corrigee`, repère profil du rail). C'est une **copie ajoutée après** la décision de base, dans un `try` : une panne ne change rien. Elle est consignée avec la décision (`lotObservation` de l'événement `gcv1-shadow-observed`). Le service worker charge le module avant `lot-decision.js`.
- `src/settings.js`, réglage `hauteurApprise = { actif: true, appliquer: false, plafondMm: 5, pointsDessusMin: 15, etages, applique, refuse }`. Il est actif **pour consigner seulement**, et une ligne figure dans la liste des réglages du panneau.
- **Chemin d'activation, coupé** : `commandRails` passe par `hauteurActivation`. Il ne s'ouvre que si `appliquer` vaut `true` (livré à `false`, épinglé par les essais et `reglages-figes`). Ouvert, il garde l'action, les rails et leur latéral, et ne change que la **hauteur** des rails d'une commande qui pose, de la correction consignée. La cible corrigée est relue dans la vue du rail ; sans caméra ou hors de la vue, la commande reste telle quelle. Il ne crée jamais de pose et ne touche pas un cut différé. **Il change la pose : seul l'opérateur l'ouvrira, après une mesure sur des parties neuves.**
- Réglages figés : `datasets/reglages-figes.json`, entrée `hauteurApprise` (2026-10-17, parties 1:17, 1:24, 1:29, 2:1, toutes d'apprentissage au manifeste).

### 5.2 Preuve

- **Essais** `tests/hauteur-apprise.test.cjs` (captures versionnées de `tests/corpus`). Ils vérifient que :
  - la décision est identique octet pour octet avec et sans le réglage, au premier passage et en reprise depuis la voie, à six réglages dont un modèle « fort » et un plafond de 50 mm ;
  - la commande est identique tant que le chemin est coupé, même avec une consigne démesurée ou fausse ;
  - ouvert pour l'essai, le chemin ne change que `delta[2]` de la correction exacte, garde l'action, le latéral et le statut, laisse un cut différé tel quel, et ne fait rien sans caméra ou hors de la vue ;
  - l'ombre ne modifie rien de ce qu'elle lit, et une panne de l'ombre laisse la décision de base ;
  - seuls le module, `lot-decision.js` et `settings.js` nomment l'ombre, et `src/engine.js` ne la connaît pas.

  Les essais P8 et faux vert tiennent la nouvelle ombre à l'écart. L'essai « déplacer la vue » compare toujours les commandes du service worker à l'empreinte de la base 5.0 : elles restent identiques avec l'ombre active (seule la consigne est retirée de l'empreinte des décisions).
- **Rejeu des quatre lots réels** (`tools/hauteur-apprise.cjs preuve`) : chaque cut est redécidé dans l'ordre du lot avec les réglages livrés, puis sans `hauteurApprise` [V] :

| Lot | Cuts redécidés | Décisions identiques (hors clé) | Commandes identiques | Ombres consignées | Rails corrigés (médiane ; vers le haut / le bas) | Abstentions (calage / étage / dessus) | Chemin ouvert (essai) : hauteur seule / inchangées / poses ajoutées / autres |
|---|--:|--:|--:|--:|---|---|---|
| 1:17 | 268 | 268 | 268 | 232 | 456 (−0,6 mm ; 95 / 361) | 4 / 2 / 0 | 231 / 37 / **0** / **0** |
| 1:24 | 515 | 515 | 515 | 383 | 694 (−0,4 mm ; 175 / 519) | 10 / 10 / 6 | 372 / 143 / **0** / **0** |
| 1:29 | 245 | 245 | 245 | 213 | 359 (−0,3 mm ; 86 / 273) | 25 / 4 / 1 | 207 / 38 / **0** / **0** |
| 2:1 | 352 | 352 | 352 | 238 | 356 (+0,1 mm ; 237 / 119) | 33 / 2 / 8 | 216 / 136 / **0** / **0** |

  Sur les 1 380 cuts, **décisions et commandes sont identiques** avec et sans l'ombre. Chemin ouvert, pour l'essai seulement : 1 026 commandes ne changent que de hauteur, de 5 mm au plus ; les autres restent identiques (cut différé, corrections nulles ou cible corrigée hors de la vue). Aucune pose n'est ajoutée et rien d'autre ne change. L'étage rejoué concorde avec le journal pour 1 333 cuts sur 1 380.

- `src/engine.js` n'est pas touché.

## 6. Doutes et limites

- **Le gain est dans le bruit.** Aucune des 24 corrections ne franchit le seuil au-delà du bruit vertical de la référence (2 à 4 mm par axe) : chaque cut corrigé, pris seul, peut l'être par hasard. Ce qui est plus solide, c'est la baisse de l'écart vertical médian sur le premier projet (1:17 3,62 → 2,97 mm ; 1:24 4,01 → 2,86 mm), mesurée sur des centaines de rails. [V] pour la mesure, [S] pour la lecture
- **« 0 nouveau » tient au seuil de 10 mm.** À 9 mm, 6 nouveaux ; à 11 mm, 3 nouveaux. La porte « aucune mauvaise pose ajoutée » n'est donc tenue que de justesse. [V]
- **Choix faits en voyant les quatre parties** : les familles essayées, la grille d'enveloppes, la pénalité de 10 par nouveau faux vert et les classes du modèle par morceaux. La validation imbriquée protège le choix de l'enveloppe, pas celui de la famille. Le chiffre honnête pour une partie neuve reste **supposé** : il ne se jugera qu'en ombre, sur une partie réservée, avec les réglages figés.
- **Le premier projet pèse lourd.** 99 des 161 rails refusés viennent de 1:17 (4.9.0, 23 % de calages refusés). Avec la 4.9.5 (5 % de refusés), la branche « rails refusés » comptera moins, et c'est elle qui fait l'essentiel du gain. Sur 2:1, l'opérateur ne corrige presque rien : le modèle n'y gagne rien et déplace les rails de 0,3 mm en médiane.
- **L'opérateur n'a pas la même convention d'une partie à l'autre** : sur 1:24, il pose plus bas que sur 1:17 et 1:29 ; sur 2:1, il garde la hauteur d'Ariane. Un modèle commun ne peut suivre que la tendance moyenne. [V]
- **Activation, avant de l'ouvrir** : l'appui mémorisé du cut garde la pose de la décision (non corrigée), à 5 mm au plus en hauteur ; l'ombre « faux vert » est calculée sur la pose non corrigée ; la vue n'a que 2 mm de marge (KI-051), d'où la relecture de la cible corrigée. [S]
- **Rejeu** : les appuis sont les cuts posés du lot, aux poses d'Ariane ; la preuve porte sur l'égalité avec et sans l'ombre, pas sur la fidélité au lot.

## 7. Rejouer

```
node tools/hauteur-apprise.cjs extraire --partie 1:29 --jeu jeu-p29e.jsonl --journal ariane-journal-v4-….json --corpus seg01.json … --sortie cas-29.jsonl
node tools/hauteur-apprise.cjs etudier --cas cas-17.jsonl --cas cas-24.jsonl --cas cas-29.jsonl --cas cas-p2-1.jsonl --json etude.json
node tools/hauteur-apprise.cjs preuve --partie 1:29 --jeu … --journal … --corpus … --json preuve-29.json
```

Lancer sous `nice -n 10`, avec le verrou des rejeux lourds. `extraire` prend moins d'une minute par partie, `etudier` quelques secondes, `preuve` 5 à 15 minutes par partie. Les jeux, lots et sorties restent hors dépôt (données de terrain).
