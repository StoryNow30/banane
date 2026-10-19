# Jugement à l'aveugle des marges de RM-2 sur 2:6 (19 octobre 2026)

2:6 est une partie réservée. Les réglages sont figés. Rien n'a été réglé sur elle et rien ne doit l'être d'après ce rapport. Les chiffres sont rapportés tels quels.

## 1. Résultat en bref

| Réglage | Grosses corrections de Mic (> 10 mm) hors zone + marge | Cuts à relire | Rapport aux marges livrées | Cuts des zones de Mic couverts (ADV + PN) |
|---|--:|--:|--:|--:|
| Marges livrées (référence) | **5 sur 35** | 464 | × 1,00 | 301 sur 360 (83,6 %) |
| Prix 200 (`datasets/marges-zones-proposees.json`) | **5 sur 35** | 548 | × 1,18 | 333 sur 360 (92,5 %) |
| Prix 100 (`marges-prix100.json`) | **5 sur 35** | 532 | × 1,15 | 323 sur 360 (89,7 %) |

- Les trois réglages laissent les **mêmes 5 grosses corrections** hors zone (§ 3). Les marges proposées n'en rattrapent aucune sur 2:6 : elles coûtent 68 à 84 cuts de plus.
- Couverture des zones de Mic, ADV seules (6 zones notées sauf l'aiguille isolée, 337 cuts) : livré 280 (83,1 %), prix 200 310 (92,0 %), prix 100 301 (89,3 %).
- Toutes les aiguilles de Mic (3505, 3723, 4756, et l'aiguille isolée 4650) sont dans la sélection, y compris avec les marges livrées.

## 2. Entrées et chiffres de contrôle

- Cas de 2:6 refaits avec `tools/relecture-autonome.cjs extraire` sur l'Écho `echo p6 08h48` : 431 cuts, 376 calculés, 55 sans nuage, 0 erreur, 366 avec référence. Mêmes comptes que le premier examen. Fichier : `scratchpad/p2-6/cas-2-6.jsonl`.
- Table refaite avec `table --journal` (journal du lot du 16/10, lot 16h42) : lot de 83 cuts (11 différés), PN 1, ADV 4, 431 cuts à l'Écho. Mêmes comptes que le premier examen. Fichier : `scratchpad/p2-6/table-2-6.json`.
- Prix 100 sur les 11 parties d'apprentissage (chaînage imposé comme pour le prix 200 : `adv.trou=30`, `adv.gap=40`) : **14 hors zone** (54 avant), **5 532 cuts à relire** contre 5 930 au prix 200, soit **398 de moins**. Les chiffres de RM-2 (§ 8 de la fiche) sont retrouvés. Marges obtenues : ADV 40 avant, 30 après, chaînage 40, trou 30, cœur de PN seul oui, **liste 4** (7 au prix 200), abords inchangés. Seule la marge de la liste change par rapport au prix 200. Fichier : `scratchpad/p2-6/marges-prix100.json`.
- Pour la référence, un fichier de travail `scratchpad/p2-6/marges-livrees.json` porte les marges livrées dans le format de la proposition (copie de la proposition avec `marges` = `livre`).
- Les trois jugements sont faits avec `juger --juger-partie-reservee`. Sorties : `juge-livrees|p200|p100.txt` et `.json`.
- Le dépôt n'est pas touché (`git status` du worktree vide, rien sous `src/`).

## 3. Les 5 grosses corrections encore hors zone (identiques pour les trois réglages)

| Cut | Correction de Mic | Plage la plus proche (livré / prix 200 et 100) | Zone notée par Mic la plus proche | Cut du lot le plus proche |
|--:|--:|---|---|---|
| 3931 | 37,5 mm | ADV 3643–3755 / 3633–3755, 176 cuts après sa fin | ADV 3670–3752, 179 cuts après | 3727 (posé), 204 cuts avant |
| 3932 | 41,2 mm | idem, 177 cuts après | idem, 180 cuts après | 3727, 205 cuts |
| 3933 | 33,9 mm | idem, 178 cuts après | idem, 181 cuts après | 3727, 206 cuts |
| 3934 | 37,6 mm | idem, 179 cuts après | idem, 182 cuts après | 3727, 207 cuts |
| 3935 | 38,5 mm | idem, 180 cuts après | idem, 183 cuts après | 3727, 208 cuts |

Faits sur ces cinq cuts (rien n'en est tiré pour les marges) :

- Ce sont **cinq cuts de suite**, de 34 à 41 mm : la plus grosse zone de corrections hors sélection de 2:6.
- Ils ne sont dans **aucune zone notée par Mic**. Sa zone notée la plus proche finit en 3752, la suivante commence en 4423.
- Le lot Orbite n'est pas passé par là : son dernier cut avant 4450 est le 3727. Aucune plage d'ADV ni de PN n'est donc relevée (les zones se relèvent sur les cuts du lot).
- Dans le nuage de l'Écho, quatre de ces cinq cuts ont un **cœur de chaussée** (3931, 3932, 3933, 3935 : chaussée affleurante 100 %, quarts 99 à 100), aucune alerte d'ADV. Le cut 3934 est sans nuage. Un tel signal ouvrirait une zone de PN s'il était vu sur des cuts du lot ; ici il ne l'est pas.
- Une hypothèse seulement, à ne pas régler sur 2:6 : un PN que le lot n'a pas visité.

## 4. Les zones de Mic, réglage par réglage

Fichier de notes de travail : `scratchpad/p2-6/notes-2-6.json` (hors dépôt). L'aiguille isolée 4650 y est un point (un seul cut).

| Zone de Mic | Cuts à l'Écho | Couverts, livré | Couverts, prix 200 | Couverts, prix 100 |
|---|--:|--:|--:|--:|
| ADV 3359–3442 | 84 | 72 | 84 | 84 |
| ADV 3478–3535 (aiguille 3505) | 58 | 13 | 31 | 22 |
| ADV 3670–3752 (aiguille 3723) | 83 | 83 | 83 | 83 |
| ADV 4423–4477 | 55 | 55 | 55 | 55 |
| ADV 4723–4779 (aiguille 4756) | 57 | 57 | 57 | 57 |
| aiguille isolée 4650 | 1 | 1 | 1 | 1 |
| PN 7935–7957 | 23 | 21 | 23 | 22 |
| **Total (sans l'aiguille 4650)** | **360** | **301** | **333** | **323** |

Ce qui change et ce qui ne change pas :

- **3359–3442** : la plage livrée (3367–3433) manque 12 cuts. Les marges proposées (prix 200 et 100 pareils) donnent 3357–3455 : tout est couvert, avec 13 cuts de débord à la fin.
- **3478–3535** : **aucune plage d'ADV ni de PN n'est relevée** dans les cuts du lot. Les cuts couverts le sont par les abords du lot (10) et par la liste « À contrôler » (3 cuts livrés ; 21 avec la marge de 7 du prix 200 ; 12 avec la marge de 4 du prix 100). L'aiguille 3505 est dans la sélection dans tous les cas. Reste hors sélection : 27 cuts au prix 200, 36 au prix 100, 45 en livré.
- **3670–3752, 4423–4477, 4723–4779, 4650** : couverts en entier par les trois réglages. Les marges proposées n'y ajoutent que des débords.
- **PN 7935–7957** : plage 7936–7956 identique pour les trois. Les bords 7935 et 7957 ne sont couverts que par la marge de la liste : aucun en livré (21 sur 23), les deux au prix 200 (23), un seul au prix 100 (22).

### Débords

Débord d'une plage = cuts de la plage en dehors de la zone notée par Mic (avant / après).

| Plage | Livré | Prix 200 et prix 100 |
|---|---|---|
| ADV 3359–3442 | 3367–3433 : 0 / 0 (elle manque 8 au début et 9 à la fin) | 3357–3455 : 0 / 13 |
| ADV 3670–3752 | 3643–3755 : 27 / 3 | 3633–3755 : 37 / 3 |
| ADV 4423–4477 | 4422–4483 : 1 / 6 | 4412–4483 : 11 / 6 |
| ADV 4723–4779 | 4619–4788 : 104 / 9 (le début couvre l'aiguille isolée 4650) | 4609–4788 : 114 / 9 |
| PN seul 3435–3445 | absent | présent (cœur de chaussée seul, au bord de l'ADV 3359–3442, sans zone notée par Mic) |
| PN 7935–7957 | 7936–7956 : 0 / 0 | idem |

- Cuts à relire en dehors des zones de Mic (aiguille 4650 non comptée comme zone) : **171** en livré, **223** au prix 200, **217** au prix 100. Cuts à relire dans les zones de Mic : 293, 325, 315.
- Le gain de couverture (+32 cuts au prix 200, +22 au prix 100) coûte +52 et +46 cuts de débord. Le plus gros débord est celui de l'ADV 4723–4779 (104 cuts avant en livré), dont une partie sert l'aiguille isolée 4650.

## 5. Lectures et limites

- Sur 2:6, les trois réglages sont à égalité pour le critère de la mission (5 hors zone) ; ils diffèrent seulement par le coût (464, 548, 532) et par la couverture des zones de Mic (83,6 %, 92,5 %, 89,7 %).
- Les 5 grosses corrections de 2:6 sont toutes dans un passage que ni le lot ni Mic (dans ses notes) ne désignent comme zone. Elles ne ressemblent pas aux cas de la fiche § 7, qui sont près d'un rouge du lot ou d'une alerte.
- La couverture des zones de Mic est calculée sur les cuts présents dans la table de 2:6 (431 cuts à l'Écho), pas sur tous les numéros de la zone.
- 35 grosses corrections ici ; le compteur du premier examen en donnait 32 (il laisse de côté les cuts à étiquette « ambigu »).
- Aucun réglage n'a été modifié d'après ce résultat. 2:6 reste jugée une fois.

## 6. Fichiers (tous sous `scratchpad/p2-6/`)

`cas-2-6.jsonl`, `table-2-6.json` (à garder), `marges-prix100.json`, `etude-prix100.json`, `log2-prix100.txt`, `marges-livrees.json`, `notes-2-6.json`, `juge-livrees|p200|p100.{txt,json}`, `notes-p200|p100.{txt,json}`, `analyse.cjs` et `analyse.json` (débords, détail par zone, détail des cuts hors zone), `etape1.sh`.
Le journal extrait (`jn/`) est supprimé.
