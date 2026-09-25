# Cas documenté — pose de départ d'ESV décalée, partie 2 (4.7.14)

**24 septembre 2026.** Trois lots Pilote 4.7.14 sur la partie 2 (cuts 20–138),
une relecture Natif **ciblée** sur les cuts 110–138 (34 visites, D-048) et une
capture d'ESV au cut 112. Données : `banane-data`,
`collections/2026-09-24_v4.7.14_/`. Signalé par l'opérateur comme cas
exceptionnel, à documenter pour un correctif futur.

## Ce que l'opérateur voit

Dans la vue de gauche d'ESV, le couloir des rails fait un saut brutal ; d'un cut
à l'autre, le décalage se voit aussi dans la vue de profil. Le Pilote corrige
bien la plupart de ces cuts, mais pas tous.

## Ce que disent les données

**La pose de départ d'ESV n'est pas un ajustement.** Sur 87 des 102 cuts
capturés, les deux rails de départ sont posés à **1500 mm** d'écartement (hors
du contrat [1405, 1470] mm), décalés latéralement de 60 à 200 mm des vrais
rails. Les autres cuts portent d'autres écartements de départ (1351 à 1456 mm).

**Le Pilote corrige presque toujours.** Sur les 82 cuts appliqués des trois
lots, 75 sont déplacés de 50 mm ou plus depuis la pose d'ESV (médiane 125 à
148 mm selon le lot, jusqu'à 196 mm). Dans la zone relue, tous les cuts
appliqués sont justes, sauf deux :

| Cut | Étape | Erreur | Pourquoi |
|---|---|---|---|
| **114** | premier passage du moteur, **aucun appui** | **207,6 mm** (les deux rails), écartement 1431 mm admissible | voir ci-dessous |
| 137 | premier passage, aucun appui | 10,6 mm (rail gauche) | faux à la limite, moteur seul |

**Pourquoi 114 est passé.** À partir de 113, la pose de départ d'ESV change de
forme (écartements 1427, 1419, 1405, 1393 mm au lieu de 1500) et reste à 160 à
280 mm des rails (écarts de départ relus sur 115–126) : c'est le saut visible à
gauche. Au cut 114, le moteur, qui cherche autour de cette pose,
accroche une autre paire à 200 mm, d'écartement admissible. La garde de
continuité aurait dû la comparer à la voie des cuts précédents, mais elle
n'avait **aucun appui** dans les 3 cuts précédents :

- 111 et 112 ont été repris depuis la voie, justes, mais à 12 et 23,8 mm de la
  prédiction : au-delà des 10 mm qui font d'une reprise un appui en 4.7.14 ;
- 113 était hors de la vue d'ESV (différé) ; 110 est à 4 cuts, hors voisinage.

114 est ensuite devenu appui (faux) ; 115 à 117 s'appuyaient sur lui mais ont
été différés (garde à 40 mm, aucun minimum près de la prédiction). Aucune autre
pose fausse n'en a résulté.

## Avec la 4.7.15

Rejeu du lot avec les règles de la 4.7.15 (`chainMm` 15 mm, D-047), vue d'ESV
contrôlée avec les caméras du corpus :

| Cut | 4.7.14 (terrain) | 4.7.15 (rejeu) |
|---|---|---|
| 111 | reprise, pas appui | reprise, **appui** (12 mm ≤ 15) |
| 114 | appliqué, **faux 207,6 mm** | retiré par la garde (199,9 mm de la voie) ; position de la voie hors de la vue à gauche : **différé** (KI-053) |
| 115 | différé | reprise, dans la vue : **placé, juste (1,5 mm)** |
| 116 | refusé (écartement) | reprise, dans la vue : **placé, juste (2,6 mm)** |
| 117–121 | différés ou refusés | reprises justes (1,6 à 8,2 mm), mais hors de la vue à droite : différés |
| 137 | faux 10,6 mm | inchangé (premier passage sans appui) |

Sans la vue, la décision sur le lot placerait 34 cuts sur 42, 1 faux sur
19 jugés (137). Avec la vue, le faux de 207,6 mm devient un différé et deux
cuts justes sont gagnés.

**Correction du 24/09 (4.7.18, KI-057).** Ces deux gains s'appuyaient sur 113
et 114, dont les cibles sont hors de la vue : le Pilote ne pouvait pas les poser,
et le rejeu les retenait comme appuis à tort (constat B1 de la relecture
4.7.16). Avec la règle « appui = cut posé », 115 et 116 sont différés faute
d'appui. Le faux de 207,6 mm reste évité. Mesure :
`audit/appui-pose-2026-09-24.md`.

## Ce qui reste

1. **La vue d'ESV.** ESV centre sa vue sur sa propre pose de départ ; à 200 mm
   des rails, la bonne position sort de la vue (ndc de −1,04 à −1,25). Le
   recadrage est hors 4.8 (D-043, KI-051) ; ce cas en est un exemple de plus.
2. **Un premier passage sans appui n'est contrôlé par rien.** Piste proposée,
   mesurée à titre préliminaire seulement : une **garde d'écartement voisin**.
   L'écartement de la paire du moteur est comparé à la médiane des 3 derniers
   cuts appliqués (dans les 10 cuts précédents). L'écartement ne dépend pas de
   la pose d'ESV : la garde fonctionne sans appui de position, exactement le
   cas de 114. Sur les 5 lots Pilote relus (111 cuts appliqués jugés), le saut
   des cuts justes a une médiane de 2 mm, un p99 de 11,5 mm, un maximum de
   14,9 mm ; au-delà de 15 mm, seuls 114 (21,1 mm) et 1834 de la partie 34
   (24,6 mm) dépassent, tous deux faux, et 1 cut non jugé. Le contrat est tenu :
   l'écartement des voisins sert de **garde**, jamais de cible (D-033).
   Avant toute activation : mesure sur les 6 sessions Natif et tous les lots
   relus, puis décision de la direction.
3. **Arrêts de lot** : le lot 1 s'est arrêté au cut 24 (caméra déplacée pendant
   la capture), le lot 2 au cut 86 (« Vue ESV non recentrée sur le rail right »).
   L'opérateur a relancé chaque fois ; aucune pose touchée.

Relevés : `audit/acceptance-p2-2026-09-24-relecture-ciblee.json` (terrain,
4.7.14) et `audit/acceptance-p2-2026-09-24-regles-4715.json` (rejeu, règles
4.7.15, sans la vue).
