# G1-c-prep — l'évaluateur de la GCV2 au niveau exigé par l'audit externe (19 octobre 2026)

Chantier `claude/50-g1c-prep` (depuis `claude/50-g1b-apprendre`, 6f950a9). Réponse aux P1 de l'audit externe (audit externe du 19 octobre, dossier `audit/chantiers/` du dépôt pilote ; D-210) qui touchent l'**évaluateur** : M1, M2, M3, M4, M5, V3, V4, F6, G1, plus les empreintes du protocole (`fiches/PROTOCOLE_G1C.md` § 1) et la règle D-211 sur les références incertaines. Étude **hors ligne** : rien sous `src/` ne change, `tools/gcv2-jeu.cjs` n'est pas touché (le chantier H6 le modifie), aucune action dans ESV. Le **jeu causal** (F1 à F5) n'est pas ici.

Tous les chiffres ci-dessous sont des chiffres de **développement** : les 11 parties d'apprentissage, en validation croisée. Aucune partie d'examen, aucun témoin, aucune partie 2:6, 2:7 ou 2:13 n'a été lue. Ils ne prouvent rien sur le jugement G1-c.

## 1. Ce qui a changé

| Pièce | Changement |
|---|---|
| `tools/gcv2-evaluer.cjs` (nouveau) | L'**évaluateur unique** : référence exacte (M1), porte unique (M2, M3), trois lectures par unité (V4), recouvrements des catégories, registre de population (F6, M5), référence incertaine (D-211). Commandes `controle`, `valider`, `rapport`, `registre`. |
| `tools/gcv2-apprendre.cjs` | **λ imbriqué** (`--lambdas 3,30,300`, V3) ; option `reference` (la règle prudente exacte remplace le substitut) ; `garderCuts` (un résultat par cut) ; `lambdaTemoin` ; identifiants des exemples (mode `exemples`, M5) ; « score de paire » (G1) ; un cut dont la référence est « incertaine » n'est jamais un exemple. Sans ces options, les **chiffres** de G1-b ne bougent pas : un essai épingle l'empreinte du JSON de la validation (relevée sur d1ea7c5). Le **texte** du rapport a changé (score de paire, porte de G1-b déclarée non contraignante) : l'essai octet pour octet a été re-épinglé pour le texte seulement. |
| `tools/compteur-gcv2.cjs` | Colonne **« utilisés comme exemples »** (M5), d'après `datasets/gcv2-exemples.json`. La colonne de Mic (« un cut corrigé = un cut appris », D-188) reste la colonne principale. |
| `tools/gcv2-empreintes.cjs`, `datasets/gcv2-g1c-empreintes.json` | SHA-256 de la chaîne figée, des jeux et des cas (protocole § 1). |
| `datasets/gcv2-exemples.json` | Identifiants (partie, cut) des 2 411 exemples retenus. Aucune coordonnée. |
| `datasets/compteur-gcv2.json`, `fiches/COMPTEUR_GCV2.md` | Régénérés avec la colonne nouvelle (§ 6.4). |
| Essais | `tests/gcv2-evaluer.test.cjs`, `tests/gcv2-empreintes.test.cjs`, ajouts à `gcv2-apprendre.test.cjs` et `compteur-gcv2.test.cjs` ; chaque fichier tourne en moins de 20 s. |
| Fiches | « probabilité de couple » → **score de paire** (G1) ; toute mention « impossible par construction » retirée (M4) : G1-b § 11 dit maintenant que les zéro mauvaise voie des variantes viennent du choix des variantes après lecture, pas d'une garantie ; `G0_APPRENTISSAGE_V1.md` dit « arithmétiquement hors d'atteinte » pour une porte de rappel. `G0_GCV2_CONCEPTION.md` est dans le dépôt pilote : l'orchestrateur s'en charge. |

## 2. La règle prudente exacte (M1) et le contrôle D-190

La règle prudente n'est plus un substitut rejoué sur le jeu. `tools/gcv2-evaluer.cjs` appelle les **vraies fonctions** de `tools/relecture-autonome.cjs` (`lignes`, `regleDuReglage`, `agit`, `bilan`) sur les cas de l'extraction, avec les réglages figés du dépôt (`datasets/relecture-reglages-proposes.json`). Aucune fonction de `relecture-autonome.cjs` n'a été modifiée : elles étaient déjà exportées. Le résultat est ensuite comparé **cut par cut**, dans le même évaluateur, à celui de la GCV2 (clé : partie et cut).

**Contrôle sur 1:14, 1:15, 1:16** (528 cuts mesurables, vraies tables de zones) :

| Lecture | cuts | Mic > 10 mm | actions | justes | abîmés | mauvaise voie | laissés faux | abstentions | erreurs |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| D-190 | 528 | 35 | 40 | 29 | 2 | 0 | 6 | 87 | 2 |
| fonction `bilan` de `relecture-autonome` | 528 | 35 | 40 | 29 | 2 | 0 | 6 | 87 | 2 |
| évaluateur, cut par cut | 528 | 35 | 40 | 29 | 2 | 0 | 6 | 87 | 2 |
| substitut de G1-b (jeu) | 528 | | 38 | 27 | 2 | 0 | 8 | 87 | |

**D-190 est retrouvé exactement** : 40 actions, 29 justes, 2 abîmés. L'écart de G1-b (38 et 27) vient de **deux cuts**, tous deux en PN, où Mic corrigeait de plus de 33 mm :

| Partie | Cut | Mic | Règle exacte | Substitut | Cause |
|---|--:|--:|---|---|---|
| 1:14 | 8641 | 33,8 mm | agit, pose à 4,6 mm de Mic | laisse | la pose de la chaîne (étage `crossing`) n'est **pas parmi les hypothèses du jeu** ; le substitut lit l'A\* du moteur, 74 mm plus loin, que ses gardes refusent |
| 1:16 | 5891 | 34,2 mm | agit, pose à 7,3 mm de Mic | laisse | même cause |

Le substitut lisait donc « la chaîne sans appui comme l'A\* du moteur » (G1-b § 3.3) ; l'écart de deux actions et deux justes est tout entier là. Sur l'ensemble des 2 411 cuts, la pose de la chaîne manque aux hypothèses du jeu pour **27 cuts**, tous à l'étage `crossing`. C'est un défaut du jeu (candidats absents), à traiter par le chantier du jeu causal, pas ici.

Deux autres écarts, publiés sans les masquer :

- **Médiane d'écartement.** La règle exacte prend la médiane de `lignes` (cuts hors lot, valeurs de départ des cuts calculés) ; le jeu a la sienne (`gMedMm`, arrondie à 0,1 mm). Elles diffèrent sur 6 parties sur 11 (1:15 : 1 438,9 contre 1 439,9 mm ; 1:17 : 1 436,7 contre 1 437,3 ; 1:24 : 1 439,5 contre 1 439,9 ; 2:1 : 1 436,15 contre 1 436,0 ; 2:11 : 1 435,1 contre 1 434,8 ; 1:29 : 1 437,7 contre 1 437,6). C'est le point F5 de l'audit : deux populations pour la même statistique. Il ne change pas D-190 (1:14 à 1:16 : une seule partie diffère, 1:15, sans effet sur les 12 actions). Il sera réglé par la médiane causale, identique pour V1 et la règle prudente, du jeu causal.
- **Mic exact.** Le jeu arrondit la correction de Mic à 0,01 mm ; l'extraction la garde exacte. L'évaluateur mesure avec la valeur **exacte** pour toutes les méthodes. C'est ce qui sépare **740** (G1-a, jeu) de **741** (RM-4, extraction) grosses corrections : le cut 405 de 2:1 vaut 10,0036 mm, soit 10,0 dans le jeu (pas plus de 10 mm) et plus de 10 mm dans l'extraction. Pas d'autre écart sur les 4 567 cuts. Le registre (§ 6) donne 741, dont 407 avec nuage et 334 sans.

## 3. La porte unique (M2, M3)

`porteUnique` de `tools/gcv2-evaluer.cjs` est la **seule** porte, écrite et exécutable, telle que `fiches/PROTOCOLE_G1C.md` § 3. Le candidat est comparé à la règle prudente exacte, **cut par cut**. L'ancienne « porte de G1-b » de `gcv2-apprendre` (qui calculait la borne de Wilson sans l'imposer) est conservée dans le rapport, étiquetée « non contraignante ».

| # | Condition | Comment elle est codée |
|---|---|---|
| 1 | 0 mauvaise voie | aucune action avec une erreur finale > 50 mm ou un rail déplacé de plus de 45 mm en travers |
| 2 | **borne haute de Wilson à 95 % de l'erreur parmi les actions ≤ 9 %** | **imposée**. Une action est une erreur si sa pose reste à plus de 10 mm de Mic. |
| 3 | 0 mauvaise pose ajoutée, **appariée** | aucun cut que la référence laisse ou pose à 10 mm de Mic (son erreur finale ≤ 10 mm) et que le candidat pose à plus de 10 mm. Le total des abîmés ne suffit pas : deux abîmés contre quatre peuvent concerner d'autres cuts (essai : autant d'abîmés des deux côtés, mais une pose ajoutée). |
| 4a | corrections justes ≥ référence | Mic > 10 mm et pose à 10 mm ou moins |
| 4b | erreur médiane ≤ référence sur chaque **zone active** | erreur finale, action ou non, sur tous les cuts mesurables de la zone ; zone active = zone où le candidat agit (ou liste imposée) |
| 5 | par partie | aucune partie avec une mauvaise voie (arrêt pour sécurité, protocole § 4) ; les autres conditions sont publiées par partie, sans faire échouer la porte si le total les tient |

**Trois issues.** `echec` si l'une des conditions 1, 3, 4, 5 échoue, ou si l'effectif suffit et la borne dépasse 9 %. `non-demontre` si rien n'échoue mais que l'effectif est insuffisant pour la condition 2 : moins de **39 actions** (39 actions sans aucune erreur donnent une borne de Wilson sous 9 % ; 38 non). `succes` sinon. Un échec certain l'emporte toujours sur « non démontré ». L'essai fait basculer chaque condition une à une.

**Actions exposées** (publiées par zone, rôle et partie) : voir § 5 et le rapport de `valider`.

**Définitions et recouvrements (M1).** Les catégories ne s'additionnent pas.
- *juste* : l'outil agit, Mic > 10 mm, pose à 10 mm ou moins. *Abîmé* : agit, Mic ≤ 5 mm, pose à plus de 10 mm. *Erreur* : agit, pose à plus de 10 mm. *Mauvaise voie* : agit, pose à plus de 50 mm ou rail déplacé de plus de 45 mm en travers.
- Un juste n'est jamais une erreur ; un abîmé est toujours une erreur ; une mauvaise voie est presque toujours une erreur (sauf déplacement latéral seul, qui peut être « juste » : l'essai le montre). Sur les données : V1 a 131 justes, 2 abîmés-erreurs, 7 autres erreurs et 120 actions « sans catégorie » (déjà à 10 mm, Mic ≤ 10 mm) ; aucun recouvrement juste-mauvaise voie, car aucune mauvaise voie.
- **Erreur finale > 10 mm, action ou non** : V1 en laisse 279 (9 par une action en erreur ; 270 grosses corrections sans action, dont 33 abstentions et 237 laissées) ; la règle prudente 299 (10 ; 289 dont 217 abstentions et 72 laissées).

### Résultat sur les 11 parties (V1, développement, λ imbriqué)

| Usage | Issue | Raisons |
|---|---|---|
| **relecture** | **ÉCHEC** | 3 mauvaises poses ajoutées ; erreur médiane en PN au-dessus de la référence |
| **lot** (jeu non régénéré sans appui humain : F3, lecture indicative) | **ÉCHEC** | mêmes raisons |

Relecture, condition par condition : 0 mauvaise voie sur 260 actions (**tenu**) ; 9 erreurs sur 260 (3,5 %), borne de Wilson **6,4 %** (**tenu**, effectif suffisant) ; **3 mauvaises poses ajoutées** (**non tenu**) : 1:15 cut 5919, ADV (Mic 5,3 mm, la règle le laisse à 5,3, V1 pose à 26,7 mm) ; 1:16 cuts 7419 et 7423, PN (Mic 0, V1 pose à 12,5 et 10,2 mm, la règle laisse à 0) ; justes 131 contre 112 (**tenu**) ; médiane PN **2,005 contre 1,808 mm** sur 458 cuts (**non tenu** ; ADV 0 contre 0, abords 5,424 contre 5,424). Sur les seuls 172 cuts où l'une des deux méthodes agit en PN, la médiane est de 3,175 contre 3,14 mm : l'écart est petit et vient de poses que V1 déplace de quelques millimètres là où Mic n'avait presque rien à corriger. Il n'en reste pas moins une condition du protocole non tenue ; **sa définition (tous les cuts mesurables de la zone) a été écrite avant les résultats et n'est pas changée après lecture**.

Au lot : 0 mauvaise voie sur 258 actions, 11 erreurs (4,3 %, Wilson 7,5 %), justes 123 contre 112, 3 poses ajoutées (1:15 cut 7107 ADV ; 1:16 cut 7419 PN ; 2:1 cut 2932 ADV, où la règle posait à 6,3 mm un cut que V1 laisse à 42,5 mm), médiane PN 2,02 contre 1,808.

**Sensibilité** (même porte, sous-ensembles de cuts, lecture seule) : références explicites seulement : relecture ÉCHEC (2 poses ajoutées), lot ÉCHEC (1) ; sans les cuts SKIP : ÉCHEC (3 ; 2) ; références explicites sans SKIP : relecture ÉCHEC (2), lot **succès** (0 ajoutée). La conclusion ne tient donc pas à la seule définition des références.

**Lecture honnête.** Les chiffres de G1-b (« porte tenue » pour V1 : 0 mauvaise voie, 3,5 %, justes 128 contre 107, abîmés 2 contre 4) étaient exacts, mais la porte unique, plus stricte, ne les confirme pas : la comparaison appariée trouve trois poses que V1 abîme et que la règle laisse en l'état, et la médiane de PN est un peu plus haute. C'est un résultat de développement, sur des parties qui ont servi à choisir V1 (D-204) : il dit seulement qu'**au départ de G1-c, V1 ne tient pas la porte unique sur ses propres parties d'apprentissage**. Aucun réglage n'est changé d'après ce constat ; la décision (garder V1, ou un autre candidat sur de nouvelles parties) revient à l'orchestrateur et au protocole (§ 4 : jamais une seconde candidate sur les mêmes parties).

## 4. λ imbriqué (V3)

λ est choisi **dans chaque pli extérieur**, parmi 3, 30 et 300, par la validation interne de **ses seules parties d'apprentissage** (perte logistique hors-échantillon des 10 mm, au niveau des hypothèses, chaque partie pèse autant ; à égalité, le plus petit λ). Le calibrage de Platt, les seuils τ et δ et le modèle final sont ensuite appris avec ce λ, **sans la partie jugée**. Essais : l'espion ne voit jamais la partie jugée ; changer la partie jugée ne change ni le λ de son pli, ni ses critères internes, ni son modèle, ni ses seuils.

λ choisi par pli (relecture) : 300 pour 1:12, 1:14, 1:17, 1:24, 1:29, 2:11 ; 30 pour 1:13, 1:15, 1:16, 2:1, 2:10. Au lot : 300 pour 1:17 et 1:24, 30 ailleurs. Les écarts de perte interne entre 30 et 300 sont de l'ordre de 0,001 à 0,007 : le choix de λ compte peu.

**Écart avec G1-b** (V1, mêmes 11 plis, mêmes 2 411 cuts) :

| Lecture | actions | justes | abîmés | mauvaise voie | erreurs | Wilson haut |
|---|--:|--:|--:|--:|--:|--:|
| G1-b publié (λ = 30, substitut, Mic arrondi), relecture | 257 | 128 | 2 | 0 | 9 (3,5 %) | 6,5 % |
| λ = 30, règle exacte, Mic exact (nouvel évaluateur) | 257 | 128 | 2 | 0 | 9 (3,5 %) | 6,5 % |
| **λ imbriqué** | **260** | **131** | **2** | **0** | **9 (3,5 %)** | **6,4 %** |
| G1-b publié, lot | 258 | 123 | 2 | 0 | 11 (4,3 %) | 7,5 % |
| λ imbriqué, lot | 258 | 123 | 2 | 0 | 11 (4,3 %) | 7,5 % |

La règle exacte et le Mic exact **ne changent pas** V1 (les mêmes 257/128 qu'en G1-b) ; le λ imbriqué ajoute **3 actions et 3 justes** en relecture et ne change rien au lot. Le biais de sélection de λ, que G1-b qualifiait de « léger », est donc **mesuré** : il ne gonflait pas les chiffres (le λ imbriqué est même un peu meilleur). Il ne dit rien des autres choix après coup (les variantes de D-204).

## 5. Unité déclarée : la partie (V4)

**L'unité du jugement est la partie.** Trois lectures sont publiées pour chaque méthode, projets 1 et 2 séparés ; **les poids de l'apprentissage ne changent pas** (chaque partie pèse autant, dont le poids est réparti sur ses hypothèses).

Relecture, V1 contre la règle prudente exacte :

| Ensemble | Lecture | Méthode | actions | justes | abîmés | erreurs (part) | Wilson haut |
|---|---|---|--:|--:|--:|--:|--:|
| 11 parties | cumul des cuts | V1 | 260 | 131 | 2 | 9 (3,5 %) | 6,4 % |
| | | règle | 141 | 112 | 4 | 10 (7,1 %) | 12,6 % |
| | moyenne des parties | V1 | 23,6 | 11,9 | 0,2 | taux moyen 7,9 % | |
| | | règle | 12,8 | 10,2 | 0,4 | taux moyen 12,2 % | |
| Projet 1 (8) | cumul | V1 | 229 | 117 | 2 | 9 (3,9 %) | 7,3 % |
| | | règle | 128 | 103 | 3 | 9 (7,0 %) | 12,8 % |
| Projet 2 (3) | cumul | V1 | 31 | 14 | 0 | 0 | 11,0 % |
| | | règle | 13 | 9 | 1 | 1 (7,7 %) | 33,3 % |

La moyenne des taux (7,9 %) n'est pas le taux cumulé (3,5 %) : de petites parties à quelques actions pèsent autant que de grosses. Le projet 2 n'a que 31 actions de V1 : sous l'effectif minimal de 39, il ne démontre rien à lui seul. Par partie (actions de V1 | de la règle ; justes) : 1:12 38 | 20 ; 23 | 20 — 1:13 35 | 17 ; 18 | 12 — 1:14 32 | 17 ; 15 | 15 — 1:15 19 | 12 ; 6 | 6 — 1:16 45 | 11 ; 11 | 8 — 1:17 5 | 5 ; 3 | 3 — 1:24 4 | 4 ; 1 | 1 — 1:29 51 | 42 ; 40 | 38 — 2:1 11 | 6 ; 7 | 5 — 2:10 4 | 0 ; 0 | 0 — 2:11 16 | 7 ; 7 | 4. **Actions exposées par zone** (V1 | règle) : PN 169 | 65, ADV 49 | 34, abords 42 | 42, hors zone et liste 0 | 0 ; par rôle : verts 260 | 141, rouges et différés 0 | 0.

## 6. Registre de population (F6, M5)

### 6.1 Le parcours, en total (4 567 cuts visités sur les 11 parties)

| Étape | Cuts |
|---|--:|
| visités | 4 567 |
| avec référence explicite (validation de Mic) | 2 690 |
| avec référence implicite (visité sans action, seuil 0,8 s) | 1 063 |
| avec référence incertaine (D-211, règle neuve) | 0 |
| sans référence | 814 (trop court 798, déplacé sans validation 12, hors cut 3, après page perdue 1) |
| avec nuage | 2 648 (sans nuage : 1 919) |
| avec référence **et** nuage | 2 411 |
| **exemples retenus** par l'apprentissage | **2 411** |
| actions de V1 | 260 (règle prudente : 141) |

Tout cut avec référence et nuage est un exemple et est jugé une fois. Le tableau par partie est dans la sortie de `valider` et `registre` (colonnes : visités, explicite, implicite, incertaine, sans référence, avec et sans nuage, référence et nuage, exemples, actions, SKIP, grosses corrections, bande 0,6-0,8 s).

### 6.2 SKIP et « validation puis SKIP »

38 cuts portent un SKIP de Mic : 19 avec référence explicite, 18 avec référence implicite, 1 sans référence. **33 sont retenus comme exemples.** Le SKIP n'est donc **pas propagé** : un cut validé puis passé en SKIP garde sa validation, ou son « visité sans action », et sert d'exemple (essai sur fixture). L'effet sur la porte est publié : sans les cuts SKIP ou avec les références explicites seulement, la porte donne le même échec, sauf pour le lot en références explicites sans SKIP, qui passe (§ 3). Cela ne prouve pas qu'un SKIP de terrain a été appris à tort (un SKIP peut suivre une validation légitime) ; la question se pose pour 38 cuts sur 4 567.

### 6.3 Seuil de visite sans action : 0,6 s ou 0,8 s

La cible G0 et le compteur de Mic disent **0,6 s** ; le jeu (et donc G1-a, G1-b, ce chantier) a ses références implicites au seuil de **0,8 s** (`DUREE_VISITE_DEFAUT_S` de `tools/jointure-echo-orbite.cjs`, appelé par `extraire`). **Je ne les ai pas alignés.** Raison : aligner veut dire changer la jointure (hors de mon périmètre) et ré-extraire puis reconstruire le jeu des 11 parties (de l'ordre d'un quart d'heure de calcul par grosse partie, 15 min pour 1:15), ce que le chantier du jeu causal fait de toute façon ; il doit prendre 0,6 s à ce moment-là. Ce que ça change se mesure déjà : **252 cuts** (sur 798 refusés « trop court ») ont une première visite de 0,6 à 0,8 s ; ils deviendraient des références implicites (borne basse : la jointure compare la visite la plus longue, ici on ne voit que la première). Ils ne changeraient pas la porte (ils ne sont pas jugés aujourd'hui), mais ajouteraient des exemples « H0 juste ».

### 6.4 740 contre 741, et la colonne du compteur

740 (G1-a) contre 741 (RM-4) : voir § 2, un seul cut (2:1, cut 405, 10,0036 mm). 741 = 407 avec nuage + 334 sans nuage.

Colonne **« utilisés comme exemples »** du compteur (corrigés dont le nuage existe et que l'apprentissage a retenus ; la colonne de Mic reste la colonne principale) :

| Partie | 1:12 | 1:13 | 1:14 | 1:15 | 1:16 | 1:17 | 1:24 | 1:29 | 2:1 | 2:10 | 2:11 | **Total** |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Corrigés (appris) | 55 | 74 | 48 | 107 | 133 | 507 | 180 | 605 | 340 | 12 | 77 | **2 138** |
| Utilisés comme exemples | 43 | 50 | 46 | 86 | 124 | 119 | 29 | 438 | 259 | 12 | 65 | **1 271** |

Sur 2 138 corrigés « appris », **1 271 (59 %)** ont servi d'exemple. La différence est faite des cuts sans nuage : 1:17 en perd 388 sur 507, 1:24 151 sur 180 (les Échos n'ont plus leurs nuages). Les parties 2:6 et 2:7 (en file) n'ont pas encore d'identifiants : « — ». Les comptes des 11 sources sont identiques à ceux de `compteur-gcv2.json` avant ce chantier (contrôle à la fusion) ; je n'ai pas relu 2:6 ni 2:7 : leurs lignes sont reprises telles quelles.

### 6.5 Référence incertaine (D-211)

Quand la pose de départ d'une visite de l'Écho est **déjà déplacée** par rapport à la ligne de la liste d'ESV du départ de partie (cas de 2:13 : Mic avait corrigé dans une autre fenêtre, l'Écho n'a vu que la revisite), le cut ne vaut pas « correction nulle ». Il est classé **« référence incertaine »**, compté à part dans le parcours (visités → référence explicite / implicite / **incertaine** → nuage → retenus), **exclu des exemples** (`construireCas`), exclu de la référence prudente (traité comme sans référence) et des grosses corrections. Essais sur fixture pour chaque point.

**Détection.** L'outil ne peut pas la détecter seul : le cas de l'extraction ne porte que la pose de départ de la première visite, pas la liste d'ESV du début de session. `detecterReferenceIncertaine({ poseDepartVisite, poseListeDebut, seuilMm })` calcule l'écart (pire des deux rails, mm) entre ces deux poses et rend `incertaine: true` au-dessus du seuil (0,5 mm, celui de « rail déplacé » de la jointure), ou `null` « non évaluable » si la liste manque (jamais deviné). **Signal proposé pour l'extraction** (hors de ce chantier) : lire la ligne de la liste d'ESV du départ de partie (ou, à défaut, la première pose observée du cut dans l'Écho de session) et écrire `mic.ref = 'incertaine'` dans le cas, et `reference: 'incertaine'` dans le jeu. L'évaluateur, le registre et l'apprentissage lisent déjà ce signal. La règle est écrite pour les parties à venir ; aucune des 11 parties n'en contient (0 au registre).

## 7. Empreintes (protocole § 1)

`datasets/gcv2-g1c-empreintes.json` : SHA-256 de `src/engine.js`, `src/hauteur-apprise.js`, `datasets/reglages-figes.json`, `datasets/gcv2-parametres.json`, `datasets/gcv2-variantes.json`, `datasets/relecture-reglages-proposes.json`, du manifeste des parties, des zones et du lot (`src/regles-metier.js`, `src/verts-a-controler.js`, `src/lot-decision.js`, `src/gcv1-shadow.js`, `src/native-session.js`), des outils d'évaluation, plus les **11 jeux** et les **11 cas** (chemin relatif à leur racine, hors dépôt). Les empreintes des jeux sont celles que les paramètres exportés nomment déjà. `tools/gcv2-jeu.cjs` est marqué **provisoire** (H6 et le jeu causal le modifient) : la vérification le signale sans échouer ; il faudra le reconsigner avant l'ouverture. `node tools/gcv2-empreintes.cjs verifier --racine-jeux … --racine-cas …` rend un code non nul au moindre écart. Un essai vérifie qu'un fichier changé, absent ou ajouté est détecté. **Ce fichier doit être réécrit (`ecrire`) si un outil listé change encore avant l'ouverture.**

## 8. Écarts et limites

- Chiffres de **développement** sur 11 parties apprises ; V1 a été choisi après coup (D-204) sur ces mêmes parties. Ils ne sont pas un jugement.
- L'usage « lot » reste indicatif : le jeu lot est filtré après coup (F3), non régénéré sans appui humain.
- Définition de l'erreur médiane (tous les cuts mesurables de la zone) : choisie avant les résultats ; une autre (sur les cuts où une méthode agit) est publiée à titre d'information et donne un écart minime en PN.
- « Effectif insuffisant » = moins de 39 actions. Au-dessus, une borne qui dépasse 9 % est un échec, pas un « non démontré ».
- Jeu : 27 cuts sans pose de chaîne parmi les hypothèses (`crossing`) ; médiane d'écartement du jeu différente de celle de la règle sur 6 parties ; Mic arrondi à 0,01 mm. À traiter par le jeu causal.
- Seuil de 0,8 s non aligné sur 0,6 s (§ 6.3).
- `e` de V1 vient du jeu (arrondi à 0,01 mm) ; celui de la règle, de l'extraction (exact) : l'écart est inférieur au centième de millimètre.

## 9. Reproduire

```
node tools/gcv2-evaluer.cjs controle --jeu … --cas … --table …        # D-190 : 40, 29, 2
node tools/gcv2-evaluer.cjs valider --jeu … --cas … --usage relecture --lambdas 3,30,300 --lambda-temoin 30 --sortie E.json
node tools/gcv2-apprendre.cjs exemples --jeu … --sortie datasets/gcv2-exemples.json
node tools/compteur-gcv2.cjs --donnees … --exemples datasets/gcv2-exemples.json
node tools/gcv2-empreintes.cjs ecrire --racine-jeux … --racine-cas … --date AAAA-MM-JJ
```
Une validation imbriquée complète prend de 40 à 60 minutes par usage (trois λ par pli), sous `nice`.
