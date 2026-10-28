# G1 — mémoire des différés, première version jugée hors ligne (16 octobre 2026)

Cap fixé par l'opérateur : « quand tu possèdes un lot Orbite et son Écho, un cut différé = un cut appris, qu'Ariane saura poser dans un contexte similaire ». Ce lot construit et **juge hors ligne** une première mémoire des différés. **Rien n'est activé dans l'extension, rien n'est changé sous `src/`** : les modules du moteur sont seulement lus (`geometry-candidate-v1.js` pour rejouer le moteur sur le vrai nuage, `lot-decision.js` pour la règle de reprise, `gauge.js`, `placement-convention.js`, `continuity-observer.js`).

Outils : `tools/memoire-differes.cjs` (construction des cas et jugement), essai `tests/memoire-differes.test.cjs` (fixture **synthétique**, parties 91 à 95, cuts et valeurs inventés). Les cas, les corpus et les jointures restent hors dépôt. Aucune coordonnée absolue : chaque position est un décalage, dans le repère profil du cut, par rapport à la pose de départ d'ESV.

## 1. Réponses en bref

236 cas : un par cut différé que l'opérateur a posé (127 au second projet, partie 1 ; 35 en partie 17 ; 40 en partie 24 ; 34 en partie 29). Chaque façon d'apprendre est jugée en **apprenant sur trois parties et en jugeant la quatrième**, les quatre tour à tour. Seuils : juste ≤ 5 mm, faux > 10 mm, **mauvaise voie > 50 mm**. Porte : 0 mauvaise voie et moins de 5 % de fausses parmi les poses proposées.

| Façon | Posés | ≤ 5 mm | ≤ 10 mm | Faux (> 10 mm) | Mauvaise voie | Abstentions | Porte |
|---|---:|---:|---:|---:|---:|---:|---|
| Témoin D-141 : pool du moteur, paire la moins chère sous contrat | 166 | 29 | 62 | 104 (62,7 %) | 48 | 70 | non |
| Témoin : pool élargi, même règle | 226 | 69 | 104 | 122 (54,0 %) | 90 | 10 | non |
| **(a) choix dans le pool** (seuils sûrs appris hors partie) | 11 | 4 | 5 | 6 (54,5 %) | 6 | 225 | **non** |
| (a) dans le pool élargi | 0 | — | — | — | — | 236 | aucun seuil sûr |
| **(b) décalage de voie, mémoire de la série** (réglage sûr appris hors partie) | **56** | **41** | **53** | **3 (5,4 %)** | **0** | 180 | **0 mauvaise voie tenue ; 5,4 % de fausses, de peu au-dessus de 5 %** |
| **(c) voisin le plus proche** (cas d'autres parties) | 6 | 0 | 1 | 5 (83,3 %) | 0 | 230 | non |

Lecture :

- **(a) ne se transfère pas.** Le bon candidat est souvent dans le pool, mais ce que l'opérateur prend n'est pas ce qui se déduit des traits des candidats : un classement appris ailleurs pose 169 cuts sur 236 si on ne lui demande aucune prudence, et 89 sont faux (26 sur la mauvaise voie). Avec des seuils sûrs, il ne reste que 11 poses, dont 6 sur la mauvaise voie (toutes en partie 1, apprises sur des parties à petits décalages).
- **(b) est la seule façon qui s'approche de la porte.** Elle ne devine pas : elle reprend la voie que l'opérateur vient de tracer en corrigeant les cuts précédents de la série, puis demande au moteur de poser le rail sur l'unique minimum qualifié près de cette voie (la règle de reprise « depuis la voie » du lot, à 15 mm). Hors partie : 56 poses, 53 à moins de 10 mm de l'opérateur (dont 41 à moins de 5 mm), 3 fausses, **aucune sur la mauvaise voie**. La borne haute à 95 % du taux de fausses est de 14,6 % : **la porte n'est pas démontrée**, seulement approchée. Il faudrait environ 73 poses sans aucune fausse, ou 110 avec une seule, pour l'établir.
- **(c) n'apporte rien** : les contextes de deux parties différentes ne se ressemblent pas assez pour que le rang du candidat choisi se transmette.
- **Une abstention reste obligatoire** à la tête de chaque série (aucune pose de l'opérateur avant elle), et sur toutes les séries courtes : 40 séries de 1 ou 2 cuts (45 cas) ne reçoivent presque aucune pose (1). Le gain tient à 5 séries de 8 cuts ou plus (132 cas, 56 % des cas).
- **Recommandation** (§ 8) : ne rien activer ; poser (b) en ombre, dans le lot et dans l'Écho, et accumuler des parties neuves à longues séries ; laisser (a) et (c) de côté jusqu'à ce que (b) ait donné la voie à choisir autour de laquelle choisir.

## 2. Données et cas

| Partie | Cas | Séries | Écart de l'opérateur au départ (médiane / P90, plus grand des deux rails) | Pool du moteur : les 2 rails à ≤ 5 / ≤ 10 mm de l'opérateur | Cellule forte à ≤ 10 mm de l'opérateur | Pool élargi : ≤ 5 / ≤ 10 mm |
|---:|---:|---:|---|---|---:|---|
| 1 (second projet) | 127 | 10 | 191 / 222 mm | 26 / 42 | 26 | 113 / 127 |
| 17 | 35 | 16 | 69 / 117 mm | 20 / 30 | 29 | 22 / 32 |
| 24 (jointure refaite par cadre, voir plus bas) | 40 | 8 | 78 / 101 mm | 23 / 35 | 20 | 26 / 39 |
| 29 | 34 | 24 | 41 / 64 mm | 21 / 33 | 10 | 22 / 33 |

- **Séries** (différés qui se suivent à 10 cuts près) : 40 séries de 1 à 2 cuts (45 cas), 13 de 3 à 7 cuts (59 cas), 5 de 8 cuts ou plus (132 cas : 21, 79 et 8 en partie 1 ; 8 et 16 en partie 24).
- **Le pool du moteur de ces parties contient la réponse de l'opérateur à 10 mm près aux deux rails** dans 33 % des cas du second projet et dans 86 à 97 % des cas des trois autres parties. Mais la cellule « forte » (au moins 15 lignes de dessus et 6 points de flanc) n'est à ≤ 10 mm de l'opérateur aux deux rails que dans 20 % des cas de la partie 1, 29 % de la partie 29, 50 % de la partie 24 et 83 % de la partie 17 : l'opérateur pose souvent sur une cellule à flanc partiel, que le moteur sait mal valider.
- **Contrôle contre D-141** : sur la partie 1, le rejeu donne 42 cas avec une cellule du pool à ≤ 10 mm aux deux rails (D-141 : 41) et 26 avec une cellule forte (D-141 : 25) ; la sélection conjointe sous contrat d'écartement rend 22 justes (≤ 10 mm) pour 66 fausses (D-141 : 20 pour 66).
- **Référence de l'opérateur.** Écriture serveur de validation comme arbitre (D-143) : au second projet, le cut 428 (seul changement sur 765) porte la bonne pose du rail droit. Les parties 17 et 29 sont identiques ligne pour ligne avec ou sans la correction. La partie 24, rejouée depuis avec la correction de D-143, n'a aucune référence corrigée.
- **Partie 24 : jointure refaite (audit I2), chiffres inchangés.** La jointure a été refaite avec une translation par cadre de scène et rejouée avec D-143 (aucune référence corrigée), puis les cas de la partie 24 reconstruits et le jugement relancé : mêmes 40 cas, même réponse de l'opérateur, rapport identique (voir `fiches/JOINTURE_ECHO_ORBITE.md`, vérifications après l'audit 5.0). La réserve qui suit est levée ; elle est gardée pour mémoire. Ancienne réserve, **jointure à confirmer** : la jointure Écho-Orbite de cette partie estimait une seule translation de scène alors que le repère de scène n'est pas le même d'un rechargement à l'autre (résidu au P90 de plusieurs dizaines de mètres, première visite d'un autre repère) ; elle était à refaire par cadre de scène, puis la partie 24 à rejouer avec D-143 avant de la laisser peser dans G0 et G1. Elle compte pour 40 des 236 cas.
- **Fichier de cas de la partie 24.** Deux fichiers existent hors dépôt : `cas-24.jsonl` et `cas-24-ancien.jsonl`. C'est **`cas-24.jsonl`** que lisent les rapports finaux de cette fiche : il a été reconstruit avec `--reprendre-pools` après l'enrichissement du contexte (champ de voie décalée de la réponse, écartement des voisins). `cas-24-ancien.jsonl` est la construction précédente : mêmes pools, même jointure, mêmes poses de l'opérateur, sans ces deux champs ; les chiffres de pool et de jugement de la partie 24 sont identiques avec l'un ou l'autre. Aucun des deux ne vient d'une jointure rejouée avec D-143.
- **Pool élargi** : la recherche du moteur (±80 mm de côté, ±40 mm de haut, points gardés à ±180 mm de côté) rejouée sur 21 fenêtres décalées de −360 à +360 mm de côté et de −80 à +80 mm de haut, candidats dédoublonnés à 1,5 mm. Il compte 81 à 473 candidats par rail en médiane (1 572 au P90 en partie 1) : la proximité d'un candidat y est facile (127 cas sur 127 à ≤ 10 mm en partie 1) et **ne prouve rien tant qu'on ne sait pas choisir**.

### Un cas (`ariane-memoire-differes-cas-v1`)

| Bloc | Contenu (aucune coordonnée absolue) |
|---|---|
| `serie` | identifiant, rang, longueur |
| `contexte` | étage et motif d'abstention (par rail), proposition du moteur, voisins posés (nombre, plus proche, écart M6), grappe de rouges, prédiction de voie (voie du lot rapportée au cut, ancres, commande refusée ; B1 : règle, étage hypothétique, appuis ; état de T), écartement (départ, voisins posés), zone (ADV : rôle, distance ; PN), relevés S6 |
| `rails.<côté>` | **pool** : par candidat, position finale (calage de convention compris) et position brute en mm, perte, points de dessus, points de flanc, forte / partielle / pente / fenêtre, balises, `moteur: 1` s'il vient du pool du moteur ; **nuage** : points gardés, médiane latérale et verticale des points, dessus et flanc sous le gabarit posé au départ |
| `geometrie` | écartement de départ et axes des deux rails (pour calculer l'écartement d'une paire) |
| `voisinsMic`, `departsVoisins`, `posesVoisines` | poses des cuts voisins (l'opérateur, départ d'ESV, Ariane et l'opérateur) rapportées au repère de ce cut |
| `reponse` | pose de l'opérateur dans le repère du cut (décalage latéral et vertical), son décalage par rapport à la voie du lot, écartement, candidat du pool le plus proche (du pool du moteur, du pool élargi) et sa distance |

La frontière anti-fuite est tenue par l'essai : rien de `etiquette` (jeu d'apprentissage) ni de `reponse` ne passe dans le contexte, et le descripteur de (c) ne change pas quand on change la réponse de l'opérateur.

## 3. Méthode

### 3.1 Les trois façons d'apprendre

**(a) Choix dans le pool.** Une régression logistique à 15 traits lisibles (perte relative au minimum, points de dessus, points de flanc, forte / partielle / pente / fenêtre, candidat du moteur ou non, |latéral| et |vertical| par rapport au départ, rang de perte, minimum local, minimum de perte) donne la probabilité qu'un candidat soit à moins de 5 mm de l'opérateur. Par cut, on retient la meilleure **paire** de candidats dont l'écartement est dans le contrat (1 420 à 1 470 mm), pondérée par un a priori d'écartement (médiane et dispersion de l'écartement de l'opérateur sur les cas d'apprentissage). La paire n'est posée que si sa note dépasse un seuil et si elle domine la meilleure paire distincte (à plus de 10 mm). Les deux seuils sont choisis **sur les parties d'apprentissage seulement** (chaque partie notée par un modèle appris sur les autres) : le choix qui pose le plus de justes avec 0 mauvaise voie et moins de 2 % de fausses ; sinon, aucune pose.

**(b) Décalage de voie, mémoire de la série.** Pour un cut de la série, on regarde les `K` cuts précédents de la série que l'opérateur a corrigés. Deux « voies de référence » sont essayées :

- **D, le départ** : la pose de l'opérateur suit-elle un décalage constant par rapport à la pose de départ d'ESV ? Prédiction = médiane des décalages des `K` derniers cuts.
- **M, les poses de l'opérateur** : la voie prolongée depuis les dernières poses de l'opérateur (droite des appuis dans le repère du cut, comme `predict` du moteur).

La mémoire ne sert que si sa **dispersion** est sous une porte apprise (plage des décalages pour D, éloignement en cuts pour M ; en option, erreur de la même méthode sur le cut précédent, que l'opérateur vient de corriger). Puis, au choix, on pose la prédiction elle-même (« brut ») ou on **rejoue le moteur recentré sur la voie** : on garde les candidats du pool élargi à 15 mm de la voie (au moins 5 points de dessus, 3 de flanc, pente non limitée), exactement comme la reprise « depuis la voie » de `lot-decision.js`, et on ne pose que s'il n'y a qu'un minimum (minima distincts à plus de 20 mm) et si l'écartement de la paire est dans le contrat. **Rejeu du moteur recentré.** Pour que le jugement n'ait pas besoin du nuage, le recentrage lit le pool élargi calculé à la construction (fenêtres décalées par pas de 120 mm de côté et 80 mm de haut) au lieu de relancer le moteur exactement sur la voie apprise : la voie est toujours à 60 mm de côté et 40 mm de haut, au plus, du centre d'une fenêtre, soit dans le rayon de recherche du moteur (±80 mm et ±40 mm). Dans les fenêtres décalées, seuls les candidats à au moins 15 points de dessus, 3 points de flanc et pente non limitée sont gardés (c'est plus strict que la règle du lot, à 5 points de dessus, pour ces candidats). Un rejeu centré exactement serait un peu plus fidèle ; il ne changerait pas les candidats, seulement leurs cellules.

Les réglages essayés (144 en tout : base, `K` de 1 à 3, porte de dispersion 3 / 6 / 10 mm, test du cut précédent, mémoire minimale, brut ou moteur) sont **fixés avant le jugement** et peu nombreux, pour limiter la chance de choisir par hasard.

**(c) Voisin le plus proche.** Un descripteur numérique du contexte (étage et motifs, voisins, écart aux voisins, écartement de départ, dénivelé, `flushPct`, PN et ADV, nombre de cellules fortes, rapports de perte, points de dessus et de flanc) sert à retrouver, **parmi les cas d'autres parties seulement**, les `k` plus semblables. Deux transferts sont essayés : le *rang* (parmi les cellules fortes du pool, par perte) du candidat que l'opérateur a pris chez les voisins, appliqué au pool du cas ; ou le *décalage* de l'opérateur des voisins, recalé sur l'unique cellule forte proche. Distance maximale, `k` et accord exigés sont choisis sur les parties d'apprentissage.

### 3.2 Jugement sans tricher

1. **Partie par partie** : chaque partie est jugée avec des réglages appris sur les trois autres (l'outil refuse de juger s'il n'y a pas au moins deux parties, et un essai vérifie que changer les réponses de la partie jugée ne change pas les réglages appris).
2. **(b) à l'intérieur d'une série.** Une série est jouée **en ligne** : l'opérateur corrige le premier cut, Ariane apprend et pose la suite. La pose d'un cut ne dépend que des cuts plus anciens de sa série (essai). Deux variantes de mémoire : **idéale** (l'opérateur a tout corrigé avant le cut suivant) et **avec propagation**, qui est la plus proche du terrain : un cut qu'Ariane a posé entre dans la mémoire **tel qu'elle l'a posé**, faux compris ; seuls les cuts qu'elle a différés y entrent avec la pose de l'opérateur. C'est la variante retenue dans les chiffres de cette fiche, sauf mention. Deux protocoles de choix des réglages : *partie par partie* (ci-dessus) et *série par série* (la série jugée prend les réglages choisis sur toutes les autres séries, y compris celles de sa propre partie : moins sévère). Enfin, **mémoire figée** aux `K` premiers cuts corrigés (non jugés), jugement sur les suivants.
3. **Mesure.** Par cut, l'erreur est le plus grand des deux rails en 3D, contre la pose de l'opérateur. Juste ≤ 5 mm, ≤ 10 mm ; faux > 10 mm ; **mauvaise voie > 50 mm** ; abstention. Borne haute de Wilson à 95 % pour le taux de fausses.
4. **Porte** : 0 mauvaise voie et moins de 5 % de fausses parmi les posées. Avec peu de poses, une porte « tenue » ne prouve rien : 0 fausse sur 20 poses laisse une borne haute de 16 %.

## 4. Résultats détaillés

### 4.1 (b) mémoire de voie de la série

Réglage sûr appris hors partie (0 mauvaise voie et moins de 2 % de fausses sur les parties d'apprentissage), mémoire avec propagation :

| Partie jugée | Posés | ≤ 5 mm | ≤ 10 mm | Faux | Mauvaise voie | Abstentions | Porte |
|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 52 | 40 | 50 | 2 (3,8 %, borne haute 13,0 %) | 0 | 75 / 127 | tenue |
| 17 | 1 | 0 | 0 | 1 | 0 | 34 / 35 | non |
| 24 | 1 | 0 | 1 | 0 | 0 | 39 / 40 | tenue (1 pose) |
| 29 | 2 | 1 | 2 | 0 | 0 | 32 / 34 | tenue (2 poses) |
| **Total** | **56** | **41** | **53** | **3 (5,4 %, borne haute 14,6 %)** | **0** | 180 / 236 | **non (5,4 % ≥ 5 %)** |

Les quatre réglages appris hors partie sont les mêmes à une porte de dispersion près : voie prolongée depuis les poses de l'opérateur, 3 derniers cuts, dispersion ≤ 6 ou 10 mm, moteur recentré à 15 mm. Série par série : 48 posés, 45 à ≤ 10 mm (35 à ≤ 5 mm), 3 fausses (6,3 %), 0 mauvaise voie. Par longueur de série (série par série) : 1 à 2 cuts, 1 posé ; 3 à 7 cuts, 7 posés dont 6 justes et 1 fausse ; **8 cuts et plus, 40 posés dont 38 justes** (2 fausses, 5,0 %).

**Ce que coûte la porte.** Le même réglage choisi au *gain net* (justes − 3 fausses − 30 mauvaises voies, sans exiger la porte) pose 69 cuts, 58 à ≤ 10 mm, 11 fausses (15,9 %), 0 mauvaise voie hors partie ; série par série 83 posés, 67 justes, 16 fausses (19,3 %). Neuf des onze fausses (hors partie) viennent des parties 17, 24 et 29 : un réglage appris au second projet se trompe sur des séries courtes et sur des départs proches de la vérité.

**Mémoire figée aux `K` premiers cuts** (réglage appris hors partie, mémoire non mise à jour) : `K = 1` 8 posés, 8 justes, 0 faux ; `K = 2` 5 posés, 4 justes, 1 faux ; `K = 3` 1 posé. La mémoire doit **glisser** avec la série : une mémoire figée ne sait plus poser dès que le cut s'éloigne des cuts corrigés.

**Mémoire idéale** (l'opérateur a tout corrigé avant le cut suivant) : le même protocole ne retient que 9 poses (7 justes, 2 fausses). Les réglages « sûrs » choisis sur les parties d'apprentissage dépendent beaucoup du mode de simulation : **le choix du réglage est instable à cette taille de données**, ce qui est une raison de plus de ne rien activer.

**D ou M ?** La prédiction brute (avant recalage) de la pose de l'opérateur par le décalage constant au départ (D, un cut mémorisé) est à 24 mm en médiane au second projet (46 cuts sur 117 à ≤ 10 mm), contre 10 mm pour la voie prolongée depuis la pose de l'opérateur précédente (M, deux cuts mémorisés : 61 sur 117 à ≤ 10 mm, 101 à ≤ 20 mm). Le départ d'ESV y bouge d'un cut à l'autre, comme D-141 l'avait vu : l'hypothèse « décalage constant par rapport à la pose de départ » est **fausse au second projet**. Elle est meilleure sur les trois autres parties (médiane 6,5 à 10 mm pour D contre 12 à 18 mm pour M) : leurs départs sont proches de la vérité et stables dans la série. La mémoire utile, au second projet, est donc la continuité de la voie de l'opérateur, pas un écart constant.

### 4.2 (a) choix dans le pool

- Partie 1 jugée avec des réglages appris sur les parties 17, 24 et 29 : 11 poses, 5 justes, 6 sur la mauvaise voie. Le modèle appris sur les trois parties à petits décalages préfère les candidats proches du départ (poids négatifs sur |latéral| et |vertical|), ce qui est faux là où la voie entière est décalée de 150 mm.
- Les trois autres parties, jugées avec la partie 1 dans l'apprentissage : aucun seuil sûr n'existe sur les parties d'apprentissage, donc aucune pose.
- **Classement seul (aucun seuil)**, pour lire ce que valent les traits : pool du moteur, 169 posés, 80 à ≤ 10 mm, 89 faux ; pool élargi, 210 posés, 115 à ≤ 10 mm, 95 faux (33 sur la mauvaise voie). C'est mieux que le témoin (D-141 : 62 justes pour 104 fausses), pas assez pour poser.
- Traits dominants, de signe stable d'une partie jugée à l'autre : plus de points de dessus (+), perte plus basse (−), fenêtre d'analyse du moteur satisfaite (−), éloignement vertical du départ (−).

### 4.3 (c) voisin le plus proche

6 poses sur 236, 1 juste. Sur 472 rails, le candidat que l'opérateur prend est la cellule forte de plus faible perte du pool du moteur dans 102 cas (22 %), une autre cellule forte dans 75 (16 %), et **aucune cellule forte à ≤ 5 mm** dans 295 (62 %) : il n'y a pas de rang stable à transmettre d'une partie à l'autre. Le transfert par décalage échoue pour une autre raison : le décalage de l'opérateur au second projet (médiane 191 mm) n'a pas d'équivalent dans les autres parties (41 à 78 mm).

### 4.4 Associer (b) et (a)

« (b) puis (a) » (la mémoire d'abord, le choix dans le pool sinon) : 66 posés, 58 justes, 8 fausses dont 5 sur la mauvaise voie. Les 5 poses sur la mauvaise voie viennent de (a). **Ne pas associer.**

## 5. Ce que cela apprend sur les différés

1. **La réponse est dans le pool, le moteur le sait mal.** Aux parties 17, 24 et 29, le pool du moteur a la pose de l'opérateur à 10 mm près aux deux rails dans 86 à 97 % des cas ; le moteur s'abstient pourtant (garde de paire, ambiguïté, flanc partiel). Un classement appris ne retrouve la bonne paire que dans la moitié des cas et se trompe de voie quand le contexte change (partie 1).
2. **La voie est la clé, pas le candidat.** Pour une série, la pose de l'opérateur est mieux prédite par la voie de ses cuts précédents (10 mm en médiane au second projet) que par n'importe quel candidat classé ou par un décalage constant au départ. Le moteur, rejoué autour de cette voie, retrouve ensuite le rail à moins de 5 mm de l'opérateur dans 41 cas sur 56 (accord au grain de l'opérateur, 2 à 4 mm).
3. **Une série ne s'apprend qu'à partir d'un cut corrigé et ne rapporte que si elle est longue.** Le gain tient aux cinq séries de 8 cuts ou plus. Les séries courtes (1 à 2 cuts : 40 séries) restent entièrement à l'opérateur.
4. **Aucune pose sur la mauvaise voie avec (b)**, dans tous les protocoles (idéal, propagation, série par série, gain net). Les témoins en font 48 (pool du moteur) et 90 (pool élargi), et (a) 6 : la garde de voie vient bien de la mémoire.
5. **Têtes de série.** La première pose d'une série n'a pas de mémoire. Au second projet, onze têtes avaient une prédiction de voie du lot juste à 10 mm (7 à ≤ 5 mm) mais hors de la vue ESV (D-141) : « déplacer la vue » reste le moyen de les atteindre, et la mémoire de série ne le remplace pas.

### Limites à garder en tête

- 236 cas, dont 127 (54 %) d'une seule partie, et 132 cas dans 5 séries : les intervalles sont larges, la porte n'est pas démontrée, et un réglage appris sur le second projet n'est jugé que sur lui-même quand on le juge série par série.
- Les trois parties plus anciennes ont presque toutes des différés isolés (40 séries de 1 ou 2 cuts) : elles ne disent presque rien sur la mémoire de série.
- Le jugement suppose que **l'opérateur corrige les différés avant que le cut suivant soit décidé**, ce que le terrain ne fait pas aujourd'hui (Orbite passe, puis l'opérateur relit) ; il suppose aussi que les poses de l'opérateur sur les cuts d'une série sont lisibles par Ariane (liste d'ESV relue ou Écho de la séance).
- Les cuts posés par Ariane entre deux différés d'une même série ne sont pas dans les cas : la mémoire n'en profite pas (estimation prudente).
- Les poses sont jugées contre la pose finale de l'opérateur, qui a un grain de 2 à 4 mm : le seuil de 5 mm est serré, celui de 10 mm raisonnable.

## 6. Dans l'extension, plus tard et en ombre d'abord

Rien de ce qui suit n'est livré. C'est ce que **voudrait dire** une mémoire des différés dans Ariane.

### 6.1 Mémoire de la séance (volatile)

- **Série courante** : numéro du premier cut, derniers cuts corrigés par l'opérateur (jusqu'à 3), pour chacun le décalage de l'opérateur par rapport à la pose de départ et sa pose dans le repère du cut suivant. Fin de série quand l'écart au différé suivant dépasse 10 cuts.
- **Vérification de la mémoire** : à chaque nouveau cut corrigé, l'erreur qu'aurait eue la mémoire sur ce cut (le test « du cut précédent » du réglage). Si elle dépasse la porte de dispersion (6 à 10 mm), la mémoire se tait et la série revient à l'opérateur.
- **Source des poses de l'opérateur** : l'Écho de la séance (`humanFinalReference` de chaque validation, avec l'écriture serveur comme arbitre, D-143) ou la liste d'ESV relue (mémoire de liste E1, B1 : `consistentValidated` exige déjà au moins 3 voisins cohérents à ±5 cuts et 8 mm). **Le point dur** : aujourd'hui B1 lit la liste au chargement, qui ne voit pas les validations faites pendant la séance ; il faudrait une relecture fraîche à chaque cut corrigé, ou un lot qui s'arrête en tête de série pour que l'opérateur corrige un cut, puis reprend.
- **Ne jamais** s'appuyer sur un cut non corrigé par l'opérateur, sauf le cut qu'Ariane a elle-même posé (propagation), et alors l'inscrire comme tel.

### 6.2 Mémoire de la partie (durable, exportée)

- Un **cas** par différé que l'opérateur a posé, au format de cet outil : contexte d'Ariane, pool réduit du moteur (par exemple les 24 meilleurs candidats avec leurs traits), réponse de l'opérateur dans le repère du cut. C'est ce qu'il faut pour refaire le jugement sans le nuage. Les nuages sont déjà exportés (corpus en mode allégé) : le pool élargi peut être recalculé hors ligne.
- Ce qu'il **faudrait consigner en plus** : (1) le pool réduit du moteur à la décision (le journal `gcv1-shadow-observed` garde aujourd'hui les comptes et les meilleures cellules, pas le pool) ; (2) pour chaque différé, la pose que la mémoire aurait proposée, son écart à la voie, sa raison d'abstention ; (3) la source de la référence de l'opérateur (écriture serveur, état de T) ; (4) la série à laquelle le cut appartient.
- **Mémoire entre parties** : pas avant d'avoir plusieurs parties à longues séries. (a) et (c) n'ont pas de place tant qu'ils ne se transfèrent pas.
- Hypothèse à mesurer plus tard : les séries d'une même zone d'ADV (partie 1, zone 2) partagent peut-être un décalage de voie qu'une mémoire de zone pourrait reprendre à la série suivante.

### 6.3 En ombre

1. Événement `memoire-differes-ombre` pour chaque cut différé : série (identifiant, rang), mémoire disponible (nombre de cuts, base, dispersion), position prédite (décalage au départ, mm), candidat du pool retenu (rang, perte, points de dessus et de flanc) ou raison d'abstention. **Aucune commande, aucune pose.**
2. À la relecture de l'opérateur (Écho), la jointure rapproche cet événement de la pose de l'opérateur : écart, juste / faux / mauvaise voie. Même rangement que `b1-ombre`.
3. **Porte d'activation proposée** : sur des parties **neuves** (jamais vues pour régler), au moins 73 poses proposées sans aucune fausse, ou 110 avec une seule ; 0 mauvaise voie ; réglage figé avant la partie. Activation d'abord en suggestion à l'opérateur (E2), jamais en pose directe.

## 7. Résumé chiffré par partie jugée

| Façon | Partie 1 | Partie 17 | Partie 24 | Partie 29 |
|---|---|---|---|---|
| Témoin pool du moteur | 88 posés, 22 justes, 66 faux (48 mauvaise voie) | 30, 21, 9 (0) | 31, 11, 20 (0) | 17, 8, 9 (0) |
| (a) pool du moteur, seuils sûrs | 11, 5, 6 (6) | 0 | 0 | 0 |
| (a) pool du moteur, sans seuil | 71, 21, 50 (26) | 29, 16, 13 (0) | 38, 21, 17 (0) | 31, 22, 9 (0) |
| (b) réglage sûr, partie par partie | 52, 50, 2 (0) | 1, 0, 1 (0) | 1, 1, 0 (0) | 2, 2, 0 (0) |
| (c) voisin | 0 | 3, 1, 2 (0) | 3, 0, 3 (0) | 0 |

Format : posés, justes (≤ 10 mm), faux (> 10 mm), entre parenthèses la mauvaise voie (> 50 mm).

## 8. Recommandation

1. **N'activer aucune des trois façons.** Aucune ne tient la porte de façon démontrée ; (a) et (c) échouent nettement.
2. **Poser (b) en ombre** (§ 6.3) : c'est la seule façon qui pose juste (53 sur 56 à ≤ 10 mm hors partie, 0 mauvaise voie) et son taux de fausses (5,4 %) est à une pose de la porte. Elle réutilise la reprise « depuis la voie » du lot avec, pour appuis, les poses de l'opérateur au lieu des seules poses d'Ariane : peu de code nouveau, pas de modèle appris à maintenir.
3. **Condition de terrain** : (b) ne vaut que si Ariane **voit** les corrections de l'opérateur pendant le lot (relecture fraîche de la liste d'ESV, ou lot qui s'arrête en tête de série). À définir avec l'opérateur avant toute activation : c'est un changement de façon de travailler, pas un réglage.
4. **Données à réunir** : des parties neuves à longues séries (au moins 5 séries de 8 cuts ou plus, hors second projet) ; la partie 24 rejouée avec la correction de D-143 ; la mesure de ce que l'opérateur gagne réellement (temps) à corriger un cut de tête de série pour que le reste soit posé.
5. **Laisser (a) et (c)** : (a) pourra être repris **autour** de la voie de (b) (choisir le candidat près de la voie plutôt que dans tout le pool) quand il y aura assez de séries pour apprendre ce choix ; (c) demande des parties qui se ressemblent.
6. **Complément déjà identifié** (D-141) : « déplacer la vue » pour les têtes de série, que la mémoire ne couvre pas.

## 9. Outil et reproduction

```
node tools/memoire-differes.cjs construire --partie N --jeu jeu.jsonl --jointure table.json \
     --corpus seg1.json [--corpus seg2.json …] [--diagnostic diag.json] [--reprendre-pools ancien.jsonl] --sortie cas-N.jsonl
node tools/memoire-differes.cjs juger --cas cas-a.jsonl --cas cas-b.jsonl … [--propagation] [--json rapport.json]
```

- `construire` rejoue le moteur sur le vrai nuage (lecture seule), environ 10 à 20 s par cut sur les gros corpus ; `--reprendre-pools` réutilise les pools d'un fichier de cas précédent (mise à jour de la référence de l'opérateur en quelques secondes).
- `juger` : sans `--propagation` la mémoire est idéale ; avec, c'est la variante proche du terrain, **celle des chiffres de cette fiche**. Quelques minutes pour 236 cas.
- Essai : `node --test tests/memoire-differes.test.cjs` (construction sur une capture fabriquée dont la pose de l'opérateur est connue, y compris hors de la fenêtre du moteur ; jugement sur cinq parties fabriquées ; garde-fous anti-fuite).
- Les jeux d'apprentissage enrichis (traits de G0), les jointures, les corpus et les cas restent hors dépôt.
