# CH-118 : analyse des retouches de 5 à 50 mm (Échos des 11 et 12/11), avant tout correctif

Hors ligne, lecture seule. Outils : `outils/retouches.cjs`, `outils/traits-journal.cjs`, `outils/croiser.cjs` sur les tables de `tools/jointure-echo-orbite.cjs`. Données : lot « Vision 15 » du 12/11 (parties 0, 1, 2, 23) et lot du 11/11 (parties 15, 16, 17), Échos du 12/11. Repère : profil du rail ; latéral, vertical (+ = vers le haut, vérifié sur la matrice du repère), longitudinal ; écart = pose finale de l'opérateur − pose d'Ariane. Mauvaises voies (> 50 mm) exclues : CH-117.

## 1. Effectif (ÉTABLI)
- 126 posés avec une pose de l'opérateur observée (retouche ou validation sans mouvement) ; 22 à plus de 50 mm (exclus) ; **49 retouchés de 5 à 50 mm**, dont 17 à plus de 10 mm ; 45 à 2 mm ou moins (contraste).
- Longitudinal : 0,0 mm partout. Composante dominante du pire rail des 49 : latéral 25, vertical 24.
- Pas de biais d'écartement : Δécartement des 49 médiane −1,1 mm [−5,2 ; +5,7]. Pas de biais latéral commun (médiane +0,6 mm).
- Biais vertical : vertical commun des 49 médiane **+2,4 mm** (l'opérateur remonte) ; il vient d'une seule famille, § 2.

## 2. Biais 1 : rail à calage de convention refusé, posé brut, trop bas de dz (ÉTABLI sur ces lots)
- `src/placement-convention.js` refuse le calage quand |dz| ou |du| dépasse `maxShiftMm` = 8 mm (motif `shift-out-of-domain`) ; le rail est alors posé brut, au milieu de la bande de points.
- 18 rails jugés ont ce refus (dz proposé de 8,0 à 11,7 mm). **16 sont posés à la pose brute de GCV1 (écart pose − brut ≤ 0,5 mm) : 16 sur 16 retouchés**, remontés par l'opérateur de 7,8 à 13,0 mm ; **vertical de l'opérateur − dz proposé : médiane +0,3 mm, de −1,9 à +3,2**. Le latéral proposé (sign·du) suit aussi la retouche latérale (à 2 mm près sur 13 des 16).
- Les 2 refusés justes (0 mm) ne sont pas posés à la pose brute : l'un 189 mm ailleurs (autre chemin), l'autre déjà 9,3 mm plus haut. C'est le séparateur que CH-042 n'avait pas : « pose finale = pose brute du rail refusé ».
- Part : **15 des 49 cuts retouchés (31 %)**, **6 des 17 à plus de 10 mm (35 %)** ; tous en chemin `first-pass` (13) ou `deferred` repris (1, 8079), palier `STRONG_FACE`, zones alerte, marges, PN, courante.
- Population : 65 posés sur 1 034 (6,3 %) portent un rail refusé, tous les dz entre 8,0 et 12,1 mm ; 20 jugés, 45 sans référence (risque non mesuré).
- Ce qui a été lu avant (D-129, D-131, D-161, CH-042) : en octobre, « la convention exagère d'un tiers au-delà de 6 mm » (partie 17) et 16 refusés justes sur 70 (CH-042, sans le séparateur). Ici, rien n'exagère : PROBABLE que l'écart vienne des refusés posés par un autre chemin, à vérifier sur les anciens lots.

## 3. Biais 2 : latéral d'un seul rail, 5 à 13 mm (ÉTABLI comme constat, sans prédicteur trouvé)
- 32 rails retouchés sans refus : surtout un seul rail en latéral (5 à 40 mm), partie 16 (chemin `deferred` repris par la GCV2 dans le lot, 4002 à 5902) et quelques `choice`/`window` en ADV ; signe vers l'intérieur ou vers l'extérieur à parts presque égales.
- Même constat que CH-042 § 1 et § 9 (écartements faux à un rail, en appareil de voie, reproduits sur les voisins) : aucun levier proposé ici avant le banc de CH-116.
- 5 rails en vertical seul (6511 `PARTIAL_FACE`, 8684, 3913, 5141, 333) sans refus lisible dans l'ombre : à relire au banc.

## 4. Correctif proposé (accord de l'intégrateur le 12/11, quatre conditions)
- Étage : calage de convention. Variante éteinte par défaut : pour un rail hors domaine sur dz seul, appliquer le calage entier jusqu'à un domaine élargi (borne à figer avant le jugement, 13 mm couvre tous les dz observés) ; motif `shift-out-of-domain` gardé pour la garde de paire (D-044).
- Jugement : réglage figé ici (lots des 11 et 12/11), puis rejeu du vrai code sur les lots non vus (Échos des 05 au 10/11, garde GCV2 scellée), ricochet des appuis compris ; critères du ticket.

## 5. Condition 2 : le cas de D-129 et D-131 rejoué (partie 17 du 14/10, `tools/p1-plafond.cjs`, bras ajouté) — ARRÊT
- Rejeu fidèle (ÉTABLI) : parité avec le Pilote 268/268 ; le bras plafonné de D-131 redonne ses chiffres (posés jugés au premier passage, plus de 10 mm : 47 → 25 sur 188).
- **L'hypothèse « autre chemin » est réfutée sur ce lot** : 99 rails refusés jugés, tous posés à la pose brute. L'opérateur les remonte de 6,1 mm en médiane pour un dz de 9,3 : vertical − dz médian −3,6 mm [−8,8 ; +0,8], rapport 0,64. La convention exagère bien là, à toutes les tranches de dz (8 à 12 mm : −3,4 à −4,1). Sur les lots des 11 et 12/11, le rapport est près de 1 (§ 2). Cause du changement non établie (version 4.9.0.12 contre 5, ou geste de l'opérateur).
- Bras « domaine étendu » sur ce lot : plus de 10 mm 47 → 28 (26 gagnés, **7 perdus**), ≤ 10 mm 141 → 160 sur 188, médiane 7,05 → 5,96 mm, aucun au-delà de 50 mm, 4 justes à 2 mm déplacés de plus de 2 mm, 13 cuts dégradés de plus de 5 mm, **4 posés passés au-delà de 20 mm** (4732, 4733, 4750, 4751 : 12 à 20 mm → 20 à 31 mm ; le rail refusé y est DESCENDU de 12 à 20 mm par l'opérateur, ~200 points, calage proposé +9 à +12). Le plafond P1 fait pareil sur 3 d'entre eux.
- Critère du ticket « aucun posé passé au-delà de 20 mm » non tenu : **le patch s'arrête ici** (condition de l'intégrateur). Il est rangé, éteint, dans `domaine-etendu.patch` (levier, réglage, journal compact, essai, bras de l'outil P1 ouvert par `CH118_BRAS`) ; aucun fichier du tronc n'est changé.
- Conditions 3 et 4 (aiguillages et mauvaises voies, tableau par lot des 05 au 10/11) : non faites, puisque le patch est arrêté.
