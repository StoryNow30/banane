# Garde A de la deuxième passe des différés : appuis faux

Tronc de départ : `claude/50-test17` à `5a68f22` (test 21, 4.9.5.21, passe livrée en ombre, D-251). Examen d'origine : `fiches/EXAMEN_PASSE_PARTIE0.md` (§ 4 garde A, § 5 verdict). Niveaux : ÉTABLI (mesuré ou lu dans le code), PROBABLE, SUPPOSÉ. Millimètres dans le repère profil de la pose de départ d'ESV ; « écart » = pire des deux rails, 3D, contre la pose finale de l'opérateur (juge de `tools/juger.cjs`, vérités de `datasets/garde-gcv2/verites`).

**Rien n'est rallumé** : `passeDifferesDefaut.ecriture` reste `false` (D-251). Pas de version, pas de paquet, pas de consigne.

## 1. Définition

Module pur `src/garde-passe-appuis.js` (`BananeGardePasseAppuis`, chargé par `importScripts` dans le service worker, `require` dans le banc). Une pose que la passe s'apprête à faire est **refusée** (« rien », le cut reste différé, motif `garde-appuis`) quand, à la fois :

1. le **déplacement du pire rail** par rapport à la pose de départ d'ESV (norme 3D du décalage [long, lat, vert] de chaque rail, le plus grand) est **strictement inférieur** à `deplacementMaxMm` (100 mm) ;
2. **aucune pose de la chaîne normale** du lot n'existe à `appuiNormalMaxCuts` cuts ou moins (4), avant ou après le cut.

**Chaîne normale** = les voisins de la décision du lot : cuts validés par CE lot (même partie, même repère) dont la commande n'est pas une pose de L1. Dans le service worker, c'est `l1Voisins` (`b.processed` hors `lotCommands[cut].l1`) ; dans le banc, `E.valides` (poses de source `lot`, plus les cuts réellement posés sans nuage). Ne comptent donc **pas** : les poses de la GCV2 dans le lot (marquées `l1`), celles de la chaîne refaite par L1-s (`l1s-vue`, `l1s-chaine`, marquées `l1` aussi), et celles de la passe (elles ne passent pas par le lot ; leur transport, `l1eTransport`/`E.validesL1`, n'est pas lu par la garde). [ÉTABLI, lu dans le code et éprouvé par les essais]

Sur les poses de la passe au banc de T21a, cette définition retrouve exactement les distances de l'examen (1135 : 5 cuts ; 1328 : 28 ; 1329 : 27 ; 1331 : 25 ; 1332 : 24 ; 1350 : 1 ; 9521 : 8 ; 9522 : 7). Avec les poses `l1s-*` comptées en plus, un seul cut change (290, de 8 à 1 cut), sans effet : il est à 206 mm du départ. [ÉTABLI]

**Réglage** : `lot.passeDifferes.gardeAppuis = { actif: true, deplacementMaxMm: 100, appuiNormalMaxCuts: 4 }` (`src/settings.js`, dans `passeDifferesDefaut`). Lecture comme les autres clés de la passe : clé absente = valeur livrée, clé par clé ; `false` ou `actif: false` coupe la garde (elle est alors mesurée et journalisée, motif `garde-coupee`, jamais bloquante) ; toute autre valeur, ou une clé illisible (seuil non fini ou ≤ 0, nombre de cuts non entier ou négatif), **coupe la passe entière** (`passeDiffReglage().mode = 'off'`) : jamais de passe sans sa garde par erreur de réglage. Module absent : passe coupée aussi. Un décalage illisible est refusé (la garde ne laisse passer que ce qu'elle a mesuré).

Motifs de `garde.motif` : `garde-appuis` (refusée), `loin-du-depart` (déplacement ≥ 100 mm, appuis non regardés), `appui-normal` (chaîne normale à 4 cuts ou moins), `garde-coupee`.

## 2. Branchement

- **Service worker** (`background.js`, `passeDiffOmbre`) : après la décision « valider » et la commande acceptée, avant le transport et la liste des poses. Le décalage est calculé une ligne plus tôt qu'avant (même formule, arrondi au centième de mm), puis `passeDiffGarde(rg, b, identity, decal)`. Refus : événement `passe-differes-ombre` `decision: 'rien'`, `motif: 'garde-appuis'`, avec `decal` et `garde: { bloque, motif, deplacementMm, appuiNormalCuts }` ; la pose n'entre ni dans le transport ni dans la liste à écrire. Pose permise : l'événement « poserait » porte aussi `garde`. **Même chemin en ombre et en écriture** : l'écriture ne reçoit que les poses que l'ombre a gardées, et une relance refait les décisions (donc la garde). Un cut refusé reste « différé » et est redécidé à la passe suivante, comme un « rien » de la GCV2. Diff de `background.js` : 10 lignes ajoutées, 5 retirées, dans `importScripts` (module chargé avant `src/gcv2-parametres-l1.js`), `passeDiffReglage`, une fonction `passeDiffGarde` neuve, et 4 lignes de `passeDiffOmbre`.
- **Banc** (`tools/banc-differes.cjs`) : même garde au même endroit de la deuxième passe ; refus consigné dans `passe2: { passe, motif: 'garde-appuis', garde }` (le cut reste `differe`), pose permise : `passe2: { passe, garde }`. Garde lue dans `src/settings.js` ; pour la mesure seulement, argument `gardeAppuis` de `rejouerLot` ou variable `BANC_GARDE_APPUIS` (JSON, `false` coupe). Consignée dans l'en-tête (`l1e.gardeAppuis`).
- **Parité** (`tools/parite-l1se-sw.cjs --passe`) : refuse un rejeu de référence dont l'en-tête n'a pas la garde du service worker (« refais-le avec le banc courant »).

## 3. Essais (rouges d'abord)

| Fichier | Essais | Rouge (sans le code) | Vert |
|---|---|---|---|
| `tests/garde-passe-appuis.test.cjs` (pur) | 7 : les 5 poses fausses de la partie 0 refusées (décalages du banc, appui de l'examen) ; 1350 (D 43,8 mm, appui à 1 cut) passe ; 901 loin du départ ; limites 100 mm strict, 99,99 mm, 4 cuts passe, 5 cuts refusé, aucun appui refusé, avant ou après ; GCV2 dans le lot et passe ne comptent pas ; lecture du réglage ; décalage illisible | 0/1, « Cannot find module » | 7/7 |
| `tests/passe-differes-garde-appuis-{ombre,gcv2,coupee,passe,seuil,ecriture-refus,ecriture}-sw.test.cjs` (service worker en vm, un lot par fichier ; montage `tests/helpers/garde-appuis.cjs`) | 8 : ombre livrée (garde journalisée) ; voisins marqués L1 = GCV2 dans le lot, refus « rien » journalisé, rien vers ESV ; garde coupée ; pose de la passe à 2 cuts + GCV2 dans le lot à 1 cut ne suffisent pas (appuiNormalMaxCuts lu) ; seuil de déplacement lu ; écriture rallumée : refus jamais écrit (même après « Relancer ») ; seule la pose permise est écrite ; réglage illisible ou module absent : passe coupée | 0/8 (`background.js` du tronc) | 8/8 |
| `tests/banc-differes-garde-appuis.test.cjs` (banc, lot synthétique) | 3 : garde livrée, en-tête ; GCV2 dans le lot (2) et passe (3) ne comptent pas, refus aux deux passes, garde coupée ; `BANC_GARDE_APPUIS`, réglage illisible = erreur, lot hors passe inchangé | 0/3 (banc du tronc) | 3/3 |

Mutations vérifiées (sur la première version des essais du service worker, un seul fichier, mêmes assertions) : banc qui compte `E.validesL1` (GCV2 dans le lot et passe) → 2 échecs ; banc sans refus → 1 ; service worker qui compte tous les cuts traités et le transport → 3 ; service worker sans refus → 3. Essais adaptés : `tests/passe-differes-reglage.test.cjs` et `tests/passe-differes-ombre-defaut.test.cjs` (clé `gardeAppuis` dans le réglage livré), `tests/pose-lot-inchanges-4959.test.cjs` (module neuf de `src/`, lu par la passe seulement), `tests/helpers/passe-differes.cjs` (crochet `surPasse`).

## 4. Rejeu des 12 lots avec la garde

Banc `tools/banc-differes.cjs rejouer --chrono`, code `acf24f9` figé hors dépôt, profils `base` et `L1-se`, passe livrée (2 passes, `sansVoieRien`), garde livrée, mêmes journaux, corpus et listes que la base de T21a (manifeste `datasets/garde-gcv2/manifeste.json`), un lot à la fois, 26/10 de 07 h 52 à 09 h 38, journal hors dépôt. Comparaison cut par cut contre les rejeux de la base scellée (`base-test18.json`).

| Lot | Poses de la passe : base → garde | Fausses (> 50 mm) arrêtées | Bonnes (≤ 10 mm) perdues | Poses nouvelles | Refus consignés | Hors passe changés |
|---|---|---|---|---|---|---|
| 2-6, 2-7, 2-13, 2-19, 2-20 f228 | 0 → 0 | — | — | — | — | 0 |
| 2-11 | 1 → 1 | — | 0 / 1 | — | — | 0 |
| 2-17 | 3 → 1 | — | **2 / 3** (9521, 9522) | — | 9521, 9522 | 0 |
| 2-18 | 8 → 8 | — | 0 / 3 | — | — | 0 |
| 2-20 fd70 | 1 → 1 | — | 0 / 1 | — | — | 0 |
| 3:0 | 6 → 6 | — | 0 / 5 | — | — | 0 |
| Partie 0, lot 1 | 7 → 7 | **1 / 1** (1135) | 0 / 6 | 1132 (4,7 mm, passe 2) | (1135, voir plus bas) | 0 |
| Partie 0, lot 2 | 12 → 8 | **4 / 4** (1328, 1329, 1331, 1332) | 0 / 8 | — | 1328, 1331, 1334 | 0 |
| **Total** | **38 → 32** | **5 / 5** | **2 / 27** | 1 bonne | | **0** |

[ÉTABLI au banc]

- **Critère proposé tenu** : 0 pose **de la passe** à plus de 50 mm (5 → 0) ; 2 bonnes perdues sur 27 (≤ 2). Les deux pertes sont celles que l'examen prévoyait (2-17, appui normal à 8 et 7 cuts, D 93,5 et 57,5 mm). Aucune pose de la passe déplacée : les 32 poses restantes sont au millimètre près celles de la base, sauf 1132, nouvelle.
- **Partie 0, lot 2** : la garde refuse 1328 (D 27,4 mm, chaîne normale à 28 cuts) ; sans elle dans le transport, 1329 et 1332 ne sont plus « valider » ; 1331 (80,4 mm, 25 cuts) et 1334 (90,9 mm, 22 cuts ; non posé dans la base) sont refusés par la garde. Les 8 bonnes poses (290, 901, 1119, 1122, 1166 à 1169) restent, toutes « loin du départ » (197 à 226 mm).
- **Partie 0, lot 1** : 1135 n'est plus posée ; sa ligne du banc porte la décision de la passe 2 (« rien », `veto-voie-absolue`), le banc ne garde que la dernière. Que la passe 1 l'ait refusée par la garde est **PROBABLE, déduit** (la passe 1 décide 671 et 750 à l'identique de la base avant 1135, donc dans le même état ; la base y valide 1135 à D 48,0 mm, chaîne normale à 5 cuts). 1350 passe (appui à 1 cut). Sans 1135 dans le transport, la passe 2 pose 1132 à 4,7 mm de l'opérateur.
- **Colonne « sans passe » : 0 cut changé** sur les 12 lots (profil `base` identique, profil `L1-se` identique hors passe), comme attendu : la garde n'est lue que dans la passe.

**Garde de non-régression** (`node tools/garde-gcv2.cjs --base datasets/garde-gcv2/base-test18.json --rejeux <ces rejeux>`) : **retour 1**, un seul recul bloquant : « reglage-9, avec passe : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 516 sur 518 » (9521, 9522). Toutes les colonnes « sans passe » et « GCV2 dans le lot » sont identiques à la base, cut par cut (perdus 0, dégradés 0, nouveaux 0). Colonne « avec passe » : 9 lots, 12 → 14 sans pose, > 50 mm 0 → 0 ; 3:0 identique ; partie 0, 79 → 83 sans pose, **> 20 mm 13 → 8, > 50 mm 10 → 5, mauvaise voie 10 → 5** ; les 5 qui restent sont les poses de la GCV2 dans le lot (colonne « sans passe » : 5, budget D-223 déjà dépassé en base, D-250/D-251). [ÉTABLI]

Le critère « 0 pose à plus de 50 mm en colonne avec passe » n'est donc tenu que **pour les poses de la passe** : sur la partie 0, la colonne garde les 5 poses fausses de la GCV2 dans le lot, que la garde A ne touche pas (garde C de l'examen, chantier de la priorité 1 de D-250). La garde de non-régression rend 1 parce qu'elle bloque toute bonne pose perdue cut par cut ; faire passer ces deux pertes demande une décision : accepter le critère « ≤ 2 bonnes perdues sur 27 » en resellant la base (avec la garde) ou affiner la garde. Rien n'est resellé ici.

## 5. Parité et verify

- **Parité banc / service worker de la passe** (`tools/parite-l1se-sw.cjs --passe`, garde livrée des deux côtés, rejeu de référence = celui du § 4) sur **la partie 0, lot 2** (le lot des quatre poses fausses et de trois refus) : 91 cuts rejoués, **0 ligne différente** ; passe : 66 différés, 8 poses, réparties 5 + 3 par passe dans le service worker comme au banc ; 37 min, le 26/10 à 10 h 09. [ÉTABLI] La parité sur 2-17 (les deux bonnes perdues) a été lancée puis arrêtée pour libérer la machine (demande de l'orchestrateur) : non faite.
- **Parité de la relecture** (`tools/parite-relecture-sw.cjs`, référence = tronc `5a68f22`) : **45 relevés sur 45 identiques**, 0 écart. [ÉTABLI]
- **verify complet**, lancé quand aucun autre verify, banc ni parité ne tournait (26/10, 11 h 31 à 11 h 40) : **2 631 essais, 2 629 réussis, 0 échec, 0 annulé, 2 ignorés** (corpus natif absent, comme au tronc ; ignoré n'est pas réussi). Relevé : `audit/verification.*`. Un premier verify (11 h 13) avait **1 annulé** : le fichier d'essais du service worker, à 5 lots simulés, dépassait les 20 s par fichier ; il est découpé en 7 fichiers d'un lot chacun (mêmes assertions, rouges sur le `background.js` du tronc : 0/8).
- Garde de non-régression : voir § 4 (retour 1, les deux pertes de 2-17, colonne « sans passe » inchangée).

## 6. Ce qui reste SUPPOSÉ ou non mesuré

- **Seuils fixés sur une seule partie** (5 poses fausses de la partie 0 du 23/10, deux lots dont un de reprise) : 100 mm et 4 cuts sont choisis après coup ; 4 cuts est juste (1135 est à 5 ; à 6 cuts, 4 sur 5 seulement). Généralisation : SUPPOSÉ. Un second lot de reprise, ou une ADV avec des poses de la GCV2 dans le lot fausses, est à mesurer.
- **Coût mesuré sur 27 bonnes poses** (12 lots), 2 perdues (7 %) ; sur l'ombre du terrain (57 bonnes du lot 1 de la partie 0), l'examen calcule 0 bloquée, sans rejeu. Les pertes sont des poses proches du départ dans des passages où la chaîne normale s'est arrêtée plus de 4 cuts : c'est le type même des poses fausses ; la garde ne sait pas les distinguer.
- **La cause n'est pas traitée** : les voisins faux viennent de la GCV2 dans le lot (`sous-tau-coherent`, garde C de l'examen) ; ils restent dans la colonne « avec passe » et servent encore de transport aux poses que la garde laisse passer (D ≥ 100 mm, ou chaîne normale proche).
- La garde n'est éprouvée qu'au banc et dans le service worker en vm ; jamais au terrain.

## 7. Recommandation pour rallumer l'écriture

1. Garder la passe en ombre pour la prochaine version de terrain : l'ombre journalise maintenant `garde` sur chaque décision, ce qui donne la mesure au terrain (refus, D, distance à la chaîne normale) sans risque.
2. Rallumer l'écriture (nouvelle version, décision de l'opérateur) seulement quand : (a) l'ombre persistante de T21d a couvert au moins un lot de reprise avec ADV et ses refus sont lus contre l'Écho ; (b) la garde de non-régression est verte, soit en resellant la base avec la garde (décision explicite : 2 bonnes perdues sur 27 acceptées), soit avec une garde affinée qui garde 9521 et 9522 sans laisser passer les cinq ; (c) `ecritureMax` bas (10) pour les premières parties, et contrôle a posteriori des cuts écrits (T21a, `tools/controle-passe.cjs`).
3. En parallèle, la garde C (ne pas laisser les poses `sous-tau-coherent` servir d'appui ou de transport à la passe) traite la cause ; elle touche la GCV2 dans le lot et passe par la garde de T21a.

## 8. Reproduire

Hors dépôt (`scratchpad/parGardeA`) : `suite.sh` (rejeu des 12 lots ; `suite-3-0.sh` a repris le 3:0, dont les données avaient été effacées pendant la suite), `parite.sh` (parité du service worker ; `parite/par-0-2310-lot2.out`), `scripts/tableau.py` (tableau du § 4), `scripts/appuis.py` (distances de la chaîne normale), journaux `rejeux/journal.log`, `parite/journal.log`, rapport `garde/garde.md`. Données extraites supprimées après usage.
