# CH-127 : cible et règle, écrites et poussées avant le premier rejeu (15/11)

Aucun rejeu d'aucun des trois réglages n'a été fait sous N au moment d'écrire ce fichier. Tronc : `claude/50-test17` à 49f7004 (Vision 18, N allumé d'office). Réglages pris tels que figés, non retouchés.

## Patchs recalés sur le tronc (contexte seul)
Les trois patchs d'origine ne s'appliquent plus : la dernière ligne de l'objet `LEVIERS_V4` de `src/gcv2-l1.js` (et sa copie dans `tests/gcv2-l1-cap5.test.cjs`) n'est plus `rechListe…});` mais `ajustementFin:null});` (clés de CH-124 et CH-121 ajoutées depuis). Recalage par `git apply -3`, puis résolution mécanique : les lignes ajoutées par le réglage sont recopiées telles quelles après `ajustementFin:null,`. **Seule différence avec les lignes d'origine, déclarée** : la paire retirée / ajoutée qui ferme l'objet porte sur `ajustementFin:null});` → `ajustementFin:null,` au lieu de `rechListeZones:null});` → `rechListeZones:null,` (même transformation, une virgule à la place de la fermeture ; aucune ligne de logique). Comparaison des lignes `+`/`-` par `diff` : aucun autre écart (ÉTABLI).

| réglage | patch figé (sha256) | patch recalé (sha256) | autres écarts | essais ciblés avec le patch |
|---|---|---|---|---|
| v4BS-sd, base | `CH-123/base/generateurs-ch120-7d7dcd1.patch` `e1a4447c…` | `v4BS-sd-base-generateurs-tronc.patch` `f9578b69…` | fermeture de l'objet (2 fichiers) | ch120-generateurs 4/4, gcv2-l1-cap5 4/4 |
| v4BS-sd | `CH-123/hors-pool-v4.patch` `37ef892a…` | `v4BS-sd-hors-pool-v4-tronc.patch` `681999a6…` | **aucun** (lignes identiques) | ch123-hors-pool 7/7, ch124-ancre 11/11 |
| gTE | `CH-120/generateurs.patch` (pointe, 9df07b5) `368a6b9b…` | `gTE-generateurs-tronc.patch` `16d79edc…` | fermeture de l'objet (2 fichiers) | ch120-generateurs 6/6, gcv2-l1-cap5 4/4, ch124-ancre 11/11 |
| B' | `CH-122/puce-bprime.patch` `2d00a249…` | `Bprime-puce-tronc.patch` `a53ab521…` | fermeture de l'objet ; la ligne d'exports retirée garde son voisin de contexte du tronc (`…LEVIERS_V7,ajusterPoseFinale,AJ_DEFAUT,AJ_ESSAI,…`), lignes `+`/`-` identiques | module chargé (pas d'essai propre à la puce dans le patch) |

Leviers : v4BS-sd = `CH-123/leviers-v4BS-sd.json` ; gTE = `communs` + `{"genTronques":true,"genEcartement":true}` de `CH-120/reglages-figes.json` (les clés `genNouveauMm`, `genLargeSnapMm` de la pointe restent `null`, sans effet sur gTE) ; B' = `{"puce":<modèle B>}`, modèle `CH-122/modeles/B/puce-figeB-0511.json` (appris sur les 6 lots réglables) pour la garde d'octobre, modèle du pli `puce-figeB-<lot>.json` pour chaque lot du corpus (validation croisée « un lot dehors », comme CH-122).

## Cible chiffrée (SUPPOSÉ, avant tout rejeu)
Gain compté : différés du tronc reposés à 10 mm au plus de la vérité (garde et corpus séparés, puis réunis).

| réglage | différés reposés justes attendus sous N (corpus) | fourchette | octobre | issue attendue de la règle |
|---|---|---|---|---|
| v4BS-sd | **7** | 4 à 9 | 0 cut changé | proposé (PROBABLE seulement : 9 poses sans N, toutes à 1,4-5,5 mm de la pose finale et à 6,9 mm au plus de l'axe ; N ne devrait en refuser aucune ; la passe fidèle peut en poser 2 de toute façon) |
| gTE | **12** | 8 à 17 | les 3 mauvaises voies nouvelles (2-11 8283, 8284 ; 0-2310-lot2 1169) refusées par N si N juge ces cuts | **écarté**, par (c) : sans N il perdait 8 justes et en déplaçait 2 au-delà de 10 mm ; ces cuts sont près de l'axe, N ne les touche pas |
| B' | **20** si le corpus est rejoué | 10 à 40 | les 5 mauvaises voies nouvelles (143-213 mm) refusées par N si N juge ; les 21 justes de reglage-9 passés à 23-35 mm restent (moins de 75 mm de l'axe) | **écarté dès la garde**, par (c) |

Raison commune : N ne refuse qu'au-delà de 75 mm de l'axe ; il retire les mauvaises voies nouvelles, pas les dégradations de 10 à 50 mm ni les justes perdus en différé.

## Règle de décision (recopiée du ticket, § 4, sans changement)
Un réglage n'est proposé que si, garde et corpus réunis : (a) 0 pose nouvelle à plus de 50 mm de la vérité ; (b) au plus une pose nouvelle jugée sur dix à plus de 10 mm ; (c) aucun cut juste du tronc ne passe au-delà de 10 mm et aucun n'est perdu (différé) sans être compensé au moins trois fois par des différés reposés justes dans le même groupe de lots ; (d) aucune pose de la chaîne déplacée. Sinon il reste écarté, et c'est un résultat. Octobre est « vu » pour ces trois réglages : un succès reste PROBABLE jusqu'à l'examen vierge.

### Lecture de la règle, fixée avant tout résultat
- **Référence** : le tronc, N allumé, mêmes réglages de banc (corpus : `BANC_ZONES=journal`, `BANC_PASSE_PLAFOND=10`, `deuxiemePasse:2`, `passe2Leviers:{sansVoieRien:true}` ; garde : leviers de la base). Vérité : pose finale du corpus (hors exclusions) ; en octobre, `datasets/garde-gcv2/verites/`. Juge : pire rail 3D.
- **Pose nouvelle** : tout cut posé (et écrit) par le réglage dont la pose diffère de celle du tronc de plus de 1 mm, ou que le tronc ne pose pas. Une pose nouvelle sans vérité n'est pas jugée ; leur nombre est rapporté. Un refus de N est un différé (ce n'est pas une pose).
- **Juste du tronc** : cut que le tronc pose à 10 mm au plus de sa vérité. « Passe au-delà de 10 mm » : posé à plus de 10 mm sous le réglage. « Perdu » : non posé sous le réglage (différé, refus de N compris).
- **Groupe de lots** : corpus, l'étiquette du lot (`0411`, `0511`, `0611`, `0811a`, `0811b`, `1111`, `1211`) ; octobre, les groupes de `datasets/garde-gcv2/base-test18.json`. Compensation : différés du tronc reposés à 10 mm au plus, dans ce même groupe, au moins trois par juste perdu.
- **Pose de la chaîne déplacée** : cut posé par la chaîne au tronc (profil L1-se, source autre que la GCV2) dont la pose ou l'état change sous le réglage.
- **Ricochets** (R3) : cuts changés hors de ceux que le réglage décide lui-même ; comptés et jugés à part, et soumis aux mêmes points (a) à (d).
- **Refus de N** : comptés en plus et en moins contre le tronc, par cut.
- **Arrêt à la garde (R1)** : si la garde d'octobre seule viole (a), la première moitié de (c) (un juste au-delà de 10 mm) ou (d), le réglage est écarté sans rejeu du corpus : ces comptes ne peuvent que croître. Pour (b) et pour les justes perdus de (c), garde et corpus sont réunis.
- **Où N se tait** : pour chaque pose nouvelle, je note si N a jugé (ancre présente, non muette) ou s'est tu. Si un réglage ne tient (règle) que sur les poses où N a jugé, je le dis, et la condition « pose nouvelle seulement si N a jugé » est déclarée comme une garde en plus, sans retoucher le réglage ; elle n'est pas appliquée en cachette au jugement.
- **Éteint = tronc** avant chaque jugement : patch recalé appliqué, clés du réglage absentes, 4 016 sur 4 016 et 2 362 sur 2 362, ligne entière hors durées.
- Si au moins deux réglages passent : assemblage, mêmes étapes, même règle (§ 5 du ticket). Tout réglage retenu : jugement unique de l'intégrateur sur les examens vierges par CH-116 (non lus ici).
