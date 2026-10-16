# P1 — plafond du calage de convention (plan 5.0)

P1 se réduisait, après P0 (D-129), à un seul changement : un rail dont le décalage de convention sort du domaine mesuré (plus de 8 mm sur un axe) reçoit ce décalage **limité à 8 mm**, au lieu d'être refusé et posé brut. Ce changement est livré **derrière un réglage coupé par défaut** : le comportement de terrain ne change pas tant que Mic n'a pas décidé. Cette fiche donne ce qui a été codé, le rejeu hors ligne des lots avec le réglage activé contre désactivé, ses limites et ce qu'il reste à vérifier sur le terrain.

**En un coup d'œil**

| | Résultat |
|---|---|
| Gain mesuré (partie 17, pose de Mic) | cuts posés au premier passage corrigés de plus de 10 mm : **47 → 25 sur 188** (25 gagnés, 3 perdus) ; de plus de 5 mm : 128 → 110 ; médiane du pire rail 7,05 → 5,76 mm. Mêmes chiffres que la simulation de P0 |
| Cuts posés en plus / en moins (6 lots, 2 263 cuts) | **11 en plus, 3 en moins** (net +8) ; 4 lots 4.9 seuls : 9 en plus, 3 en moins |
| Pose nouvelle hors des rails refusés | **non satisfait à la lettre** : 8 des 11 cuts posés en plus ne portent aucun rail refusé ; ils changent par ricochet (les appuis voisins ont bougé de quelques millimètres) |
| Mauvaise pose ajoutée | **1 sur 1 jugeable** : un cut posé en plus (partie 17) avec 29 mm d'erreur à la pose de Mic. Les 10 autres n'ont pas de référence |
| Garde de paire (D-044) | code inchangé ; 104 cuts différés pour 'pair-guard' → 103 (un cut de passage à niveau échappe à la garde par l'écartement, voir § 4.4) |
| Réglage | `conventionPlafond` dans `src/settings.js`, **faux** |

## 1. Ce qui a été codé

- `src/placement-convention.js` (seul fichier de `src/` qui porte la logique) : quand le décalage mesuré dépasse `maxShiftMm` (8 mm) sur un axe et que le plafond est actif, `calibrate` rend un calage **appliqué** à 8 mm au plus par axe, **dans le signe** du décalage mesuré. Le résultat consigne :
  - `capped: true` (le plafond a joué), `capMm` (8) ;
  - `duMm`, `dzMm` : le décalage **mesuré en entier** (comme pour un rail refusé) ;
  - `appliedDuMm`, `appliedDzMm` : ce qui a été posé ;
  - `restDuMm`, `restDzMm` : le reste **non appliqué**, en mm, de même signe que le décalage mesuré (nul sur un axe qui n'a pas dépassé).
  Un rail dans le domaine, ou non calable (dessus sous-observé), donne exactement le même résultat qu'avant ; il n'y a pas de champ `capped` à `false`, il est simplement absent.
- Le motif `reason: 'shift-out-of-domain'` **reste** sur un rail plafonné bien qu'il soit appliqué. C'est voulu : la garde de paire (D-044, `src/lot-decision.js`, `pairFlagged`) lit ce motif pour savoir qu'un rail est hors du domaine mesuré. Ainsi la garde n'a pas été touchée et voit les mêmes rails qu'avant.
- `src/settings.js` : `conventionPlafond = false` (commentaire : ne pas activer sans l'accord de Mic), et une ligne dans `describe()` pour le panneau.
- Le réglage est lu au moment de l'appel (global `BananeSettings`, chargé avant le module dans le service worker). L'option `calibrate(..., { plafond: true|false })` prime sur le réglage (outils et essais).
- Rien d'autre : ni `src/engine.js`, ni la garde de paire, ni le domaine de 8 mm, ni la bande de 12 mm, ni la borne de pente, ni `lot-decision.js`, ni `gcv1-shadow.js`.

## 2. Essais

- `tests/placement-convention-plafond.test.cjs` (10 cas) :
  - **réglage coupé** : sur 151 cas synthétiques (rails dans le domaine, au bord, hors domaine vertical, latéral, les deux, signes positifs et négatifs, profil miroir, flanc ou dessus sous-observé, options explicites), le résultat de `calibrate` est identique **octet pour octet** (`JSON.stringify`) à la référence produite par le module de la base 5.0 (`tests/corpus/p1-convention-reference.json`, fixture synthétique). Même chose avec le réglage absent, faux, ou `plafond:false` forcé alors que le réglage global est actif ;
  - **réglage activé** : les rails dans le domaine ou non calables sont inchangés ; les 68 rails hors domaine du jeu sont plafonnés à 8 mm par axe, avec le bon signe, le bon `rawDelta`, le delta posé égal au brut plus le décalage plafonné, et le reste = mesuré − appliqué ; à la borne exacte, rien n'est plafonné ; `maxShiftMm` fait le plafond ; l'option explicite prime ;
  - **dans le moteur** (capture déjà versionnée) : le rail refusé est posé plafonné, le rail calé ne bouge pas, l'écartement de la paire est jugé sur les positions plafonnées, et le retour au réglage coupé redonne exactement la sortie d'avant ;
  - **garde de paire** : une décision sur le lot avec un rail plafonné et un rail repêché reste « différé, pair-guard », comme avec le même rail refusé.
- `tests/p1-plafond.test.cjs` (4 cas) : l'outil de rejeu, sur un lot synthétique d'un cut.

## 3. Méthode du rejeu (`tools/p1-plafond.cjs`)

Le rejeu réutilise les outils existants : `tools/acceptance-report.cjs` (lecture d'un lot, règles du Pilote qui l'a produit, rejeu de la décision sur le lot avec les mêmes appuis), `tools/p0-commun.cjs` (jointure à la pose de Mic, erreur 3D).

1. **Désactivé** : la science GCV1 consignée dans le diagnostic du lot, telle quelle. *Contrôle* : la décision rejouée retombe sur la décision consignée par le Pilote pour **2 262 observations sur 2 263** (un seul écart, partie 24, présent aussi sans plafond).
2. **Activé** : pour chaque observation dont un rail avait un calage refusé (710 cuts sur 2 263), le moteur d'ombre est relancé sur le nuage du corpus avec le plafond : rail plafonné, **puis écartement de la paire recalculé** sur les positions plafonnées. La décision sur le lot est rejouée avec ces rails, plafond actif aussi dans la reprise depuis la voie. *Contrôle* : le même relancement **sans** plafond redonne la science consignée pour **710 observations sur 710**.
3. Chaque cut est comparé sur sa **dernière observation** : posé ou différé, motif, position. Les cuts dont la décision ou la pose change sont rangés selon qu'ils portent eux-mêmes un rail refusé ou non.
4. Avec la table de jointure de la partie 17 (Écho joint), les cuts jugés à la pose de Mic : erreur 3D du pire rail, avant et après. Cette référence n'entre dans aucun calcul du moteur.

Lots : les « quatre lots 4.9 » du cahier — parties 24, 26 (lot b), 25–26 et 27 — plus la partie 18 (cuts posés de P0) et la partie 17 (la seule avec l'Écho joint). Aucune donnée brute dans le dépôt : la sortie ne contient que des comptes, des millimètres et des numéros de partie et de cut.

## 4. Résultats

### 4.1 Cuts posés et différés, lot par lot

Cuts distincts, dernière observation. « Rail refusé » : le cut a, à l'une de ses observations, un rail au calage refusé.

| Lot | cuts | dont rail refusé | posés (off → on) | différés (off → on) | différé → posé / posé → différé | posés en plus : avec / sans rail refusé | pair-guard | posés déplacés (dont sans rail refusé) |
|---|---:|---:|---|---|---|---|---|---|
| partie 24 | 515 | 177 | 408 → 410 | 107 → 105 | 4 / 2 | 1 / 3 | 35 → 35 | 133 (15) |
| partie 26 (lot b) | 370 | 71 | 311 → 311 | 59 → 59 | 0 / 0 | 0 / 0 | 6 → 6 | 68 (6) |
| parties 25–26 | 454 | 155 | 381 → 385 | 73 → 69 | 4 / 0 | 1 / 3 | 21 → 21 | 141 (16) |
| partie 27 | 235 | 38 | 129 → 129 | 106 → 106 | 1 / 1 | 1 / 0 | 14 → 13 | 17 (3) |
| **4 lots 4.9** | **1 574** | **441** | **1 229 → 1 235** | **345 → 339** | **9 / 3** | **3 / 6** | **76 → 75** | **359 (40)** |
| partie 18 | 421 | 157 | 385 → 386 | 36 → 35 | 1 / 0 | 0 / 1 | 16 → 16 | 141 (5) |
| partie 17 | 268 | 112 | 232 → 233 | 36 → 35 | 1 / 0 | 0 / 1 | 12 → 12 | 98 (3) |
| **6 lots** | **2 263** | **710** | **1 846 → 1 854** | **417 → 409** | **11 / 3** | **3 / 8** | **104 → 103** | **598 (48)** |

- **Posés en plus : 11** (net +8). **Posés en moins : 3.** Aucun cut posé n'est perdu à cause de son propre rail refusé ; les 3 pertes sont des cuts voisins (ricochet).
- 787 rails refusés sont plafonnés (tous). Le décalage ajouté au rail brut est de 8,1 à 8,5 mm en médiane, 11,3 mm au plus (3D, deux axes). Le reste non appliqué est de 1,1 à 1,4 mm en médiane en vertical.
- **Près de 600 cuts posés (près d'un tiers des cuts posés) bougent**, 550 parce qu'ils portent un rail refusé, 48 par ricochet. Le déplacement d'un cut qui porte un rail refusé est celui du décalage (8 mm en médiane).

### 4.2 Partie 17 avec l'Écho joint : l'erreur à la pose de Mic

Cuts posés au premier passage, Mic vu aux deux rails (188). Erreur 3D du pire rail à la pose finale de Mic.

| | > 5 mm | **> 10 mm** | médiane | P90 |
|---|---:|---:|---:|---:|
| réglage désactivé | 128 | **47** | 7,05 mm | 12,69 mm |
| réglage activé | 110 | **25** | 5,76 mm | 10,87 mm |
| gagnés / perdus | 28 / 10 | 25 / 3 | | |

C'est **exactement** la simulation de P0 (47 → 25, 25 gagnés, 3 perdus ; 128 → 110), obtenue ici avec le vrai code (rail plafonné par le moteur, écartement recalculé, décision rejouée) et non plus par simulation à partir des décalages consignés. Sur les 192 cuts posés des deux côtés quel que soit l'étage (premier passage, fenêtre, choix), 48 → 27 au-delà de 10 mm (25 gagnés, 4 perdus).

### 4.3 Cuts posés en plus : leur pose

Sur les 11, **un seul** a une pose de Mic aux deux rails (cut 4557 de la partie 17, étage « choix par la voie ») : il est posé avec **29 mm d'erreur** (aucun de ses rails n'est refusé). Pour les 10 autres (parties 24, 25–26, 27 et 18), aucune pose de Mic n'est disponible aux deux rails. Ces 11 cuts étaient différés avec le motif « pas de minimum qualifié près de la prédiction » (7) ou « plusieurs minima près de la prédiction » (3), et un par la garde de paire (§ 4.4).

Mécanisme (vérifié sur le cut 4557) : les appuis voisins ont bougé de quelques millimètres parce que leurs rails refusés sont maintenant plafonnés ; la position prédite par la voie se déplace d'autant, un minimum local faible (rapport de perte 3,7) passe sous le seuil de choix, et le cut est posé. Même mécanisme, en sens inverse, pour les 3 cuts perdus (parties 24 et 27) : la prédiction s'éloigne du minimum qui était retenu.

### 4.4 La garde de paire

Le code de la garde est inchangé et le test le montre. Dans le rejeu, 104 cuts différés pour 'pair-guard' deviennent 103 : le cut 4293 de la partie 27, un passage à niveau, avait un rail repêché et un rail refusé. Avec le plafond, le décalage latéral ajouté sort l'écartement prédit du contrat : la paire est refusée par l'écartement (les deux rails passent « non résolus »), la garde de paire ne s'applique plus parce qu'il n'y a plus de rail repêché, et le repli du passage à niveau (existant) pose la paire de l'ornière, à 1 438 mm. Ce n'est pas un contournement du code de la garde, mais un cut 'pair-guard' sur 104 qui est posé ; sa pose n'est pas jugeable. Le nombre de paires refusées par l'écartement passe de 59 à 60 (dernière observation, 6 lots).

## 5. Portes du cahier, état

| Porte (cahier, P1 et § activation) | État |
|---|---|
| Rejeu des quatre lots au banc sans régression | **Pas sans mouvement** : 3 posés perdus, 11 gagnés, 598 poses déplacées de 8 mm en médiane. Aucune perte d'un cut qui porte lui-même un rail refusé |
| 0 mauvaise pose ajoutée sur Écho | **Non démontré** : un cut posé en plus est jugeable, et il est faux de 29 mm. Les 10 autres ne sont pas jugeables |
| Aucune pose nouvelle hors des rails refusés | **Non** : 8 cuts posés en plus sur 11 n'ont pas de rail refusé (ricochet par les appuis) |
| ≥ 50 des 89 'pair-guard' récupérés | **Hors du périmètre livré** (la garde ne change pas, conformément à D-129) ; 1 sur 104 échappe à la garde |
| Gain sur la pose de Mic | **Oui** : 47 → 25 cuts à plus de 10 mm sur 188 |

La lecture à proposer à Mic : le plafond réduit nettement les poses fausses de la partie 17 (près de moitié), au prix d'un petit nombre de cuts dont la décision bascule par ricochet, dans les deux sens. Le seul de ces cuts jugeable est mauvais. Le solde net sur les cuts posés est positif (+8 sur 2 263), mais il n'est pas démontré que ces poses en plus soient bonnes.

## 6. Limites

- **Un seul projet** (D-123), et une seule partie avec l'Écho joint. La pose de Mic n'existe pour aucun des quatre lots 4.9 : leurs chiffres sont des comptes de décisions, pas des erreurs. Partie 24 : 4 cuts avec Mic, 3 > 5 mm → 2, 1 > 10 mm → 1.
- **Rejeu statique des appuis, dernière observation.** Le rejeu suit l'ordre et les appuis du lot, mais pas les gestes de Mic, ni les ré-observations intermédiaires d'un cut revisité. Le lot réel avec le plafond actif irait peut-être autrement (une pose en plus change aussi les appuis de ses voisins).
- **Rails refusés relancés sur le nuage du corpus** : le contrôle sans plafond retrouve la science consignée sur 710 observations sur 710, ce qui valide la méthode ; les rails non refusés gardent leur science consignée.
- **Un cut parmi les jugeables** pour la qualité des poses en plus : trop peu pour conclure dans un sens ou dans l'autre.
- La référence de Mic est la pose de sa dernière validation, sans vérité indépendante (limites de P0 inchangées). Les chiffres de la partie 17 sont sur les 188 cuts qu'il a relus.
- Le journal compact du Pilote (`gcv1.convention`, `src/gcv1-shadow.js`) ne reprend pas les champs ajoutés (`capped`, `rest*`, `applied*`) : il montre `applied: true`, `reason: 'shift-out-of-domain'` et les décalages mesurés en entier. Le diagnostic GCV1 (`scientificRail.conventionCalibration`) les garde tous. Les outils P0 restent valables sur de tels journaux (`rawDelta` et le motif suffisent à retrouver la population des rails refusés).
- Le réglage ne se bascule pas depuis le panneau : c'est une constante de `src/settings.js`. L'activer, c'est la changer et publier une version (hors du périmètre de ce chantier : le manifeste n'a pas bougé).

## 7. À vérifier sur le terrain avant d'activer

1. **Un lot réel avec le plafond actif**, relu par Mic : mesurer, comme pour la partie 17, les cuts à plus de 10 mm ; surtout les **cuts posés en plus** (ricochet) et les **cuts perdus**. C'est le point qui manque : la qualité de ces poses.
2. L'**Écho 18** (introuvable) et l'**Écho 24 long** (124 visites, D-122 point 5) donneraient la pose de Mic pour des centaines de cuts des lots rejoués ici.
3. Un **second projet** ESV (D-123) pour savoir si le plafond de 8 mm tient hors du projet de mesure.
4. Décider si les cuts posés en plus par ricochet sont acceptables, ou s'il faut les écarter (par exemple ne pas laisser le choix par la voie s'appuyer sur un appui dont le calage a été plafonné). Ce serait un autre chantier : il touche `src/lot-decision.js`, hors du périmètre de P1.
5. Avant l'activation : l'accord de Mic, un numéro de version, et la mention dans `DECISIONS.md` (non faite ici).

## 8. Reproduire

```
# un lot : dossier avec le journal, le diagnostic GCV1 et les segments du corpus (JSON ou volumes zip)
node --max-old-space-size=6000 tools/p1-plafond.cjs --lot DOSSIER=LIBELLE [--jointure table.json] --json sortie.json
# somme de plusieurs lots
node tools/p1-plafond.cjs --fusion sortie-A.json sortie-B.json …
```

La table de jointure de la partie 17 vient de `tools/jointure-echo-orbite.cjs` (voir `fiches/JOINTURE_ECHO_ORBITE.md`). Chaque lot demande de 1 à 5 minutes et moins de 6 Go. Les essais (`tests/placement-convention-plafond.test.cjs`, `tests/p1-plafond.test.cjs`) n'emploient que des fixtures synthétiques et une capture déjà versionnée.
