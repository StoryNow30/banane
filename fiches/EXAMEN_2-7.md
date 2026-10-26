# Examen de la partie 2:7 (projet 2, partie 7) — 19 octobre 2026

Partie neuve, donc **réservée** (rotation D-192). Elle est jugée avec les réglages figés. **Aucun réglage n'a changé, rien sous `src/` n'a changé.** Les chiffres ne portent que des numéros de cut et des millimètres. Même méthode que `EXAMEN_2-6.md`.

## Données

- Écho de l'opérateur du 19/10 (4.9.5.8) : 1 106 visites, 960 cuts vus, 826 avec une pose finale de l'opérateur. 33 zips lus (30 segments de session), sauvegardes cumulatives puis export final de 09 h 54 UTC.
- Lot Orbite du 16/10 (4.9.5.3) : 151 cuts invalides au départ (9 640 validés, 151 invalides, total 9 791), dont 130 posés et 21 différés. Jointure : 150 cuts joints, 1 cut du journal que l'opérateur n'a pas vu (le cut 3290). La translation entre les deux repères est constante par cadre de scène, résidu 0,0 mm : l'Écho et le lot sont bien la même partie. À 09 h 21, l'Écho compte 21 invalides : ce sont les 21 différés du lot.
- Écart de l'opérateur = le plus grand des deux rails, en 3D (repère profil). Un cut visité 0,8 s ou plus sans action compte pour une correction nulle (règle de l'opérateur).
- « Corrigé » veut dire : l'opérateur a validé après avoir déplacé un rail (étiquette Écho). Les seuils 5 mm et 10 mm se lisent sur l'écart mesuré.
- 259 cuts sur 960 n'ont pas de nuage (27 %) : le moteur ne peut rien calculer pour eux.

### Zones de l'opérateur (notes, bornes corrigées par l'opérateur le 19/10)

- PN 1065–1079 et PN **1957–1972** (le premier jet des notes disait « 1975 », corrigé par l'opérateur).
- ADV 3131–3228 (marge comprise, avec les aiguilles 3149, 3161, 3162 et 3219), 3514–3579 (3545), 4373–4444 (4410), 4466–4532 (4504), 4713–4875 (4724, 4743, 4851), 5502–5716 (5525, 5638, 5685), 5794–5850 (5819).
- ADV **5867–5928 : début supposé.** l'opérateur ne connaît que la fin (5928) et l'aiguille 5897. Le début 5867 est une marge de 30 cuts avant l'aiguille. Les chiffres de cette zone se lisent avec cette réserve.
- Grappe d'invalides 3260–3304, que l'opérateur « laisse sans aucun trou » : ce n'est pas une zone d'ADV dans ses notes. Elle est mesurée à part.
- Total : 8 zones d'ADV (800 cuts, 15 aiguilles), 2 PN (31 cuts). Aucune autre borne manquante.

## 1. Orbite contre l'opérateur (les 151 invalides de départ)

| | Cuts | Vus par l'opérateur | Avec pose finale | Corrigés par l'opérateur | Écart > 5 mm | Écart > 10 mm |
|---|--:|--:|--:|--:|--:|--:|
| Posés par Orbite | 130 | 129 | 123 | 31 (+ 5 « ambigus ») | **17** | **7** |
| Différés par Orbite | 21 | 21 | 21 | 17 (+ 4 « ambigus ») | **21** | **21** |

- **Orbite a posé 130 cuts et en a différé 21.** Un seul cut posé n'a pas été vu par l'opérateur (3290).
- **Posés** : l'opérateur en corrige 31 sur 123 avec pose finale. **17 dépassent 5 mm (13,8 %) et 7 dépassent 10 mm (5,7 %)**, médiane 0 mm. Les 7 : cuts 3175 (14,4 mm), 4410 (11,5), 4438 (12,5), 4473 (11,1), 4850 (25,2), 5637 (49,5) et 5819 (38,7). Quatre d'entre eux touchent une aiguille de l'opérateur (4410, 4850 à côté de 4851, 5637 à côté de 5638, 5819) ; trois sont « ambigus » (3175, 4410, 5819). Tous sont en ADV. C'est moins sûr qu'en 2:6 (3 sur 67 au-dessus de 5 mm, aucun au-dessus de 10 mm).
- **Différés** : les 21 sont corrigés de plus de 10 mm (médiane 59,6 mm, maximum 90,9 mm, surtout en latéral). Motifs de différé d'Orbite (par rail) : écartement hors contrat 20, candidats 15, ambigu 5, flanc 2. Le lot a raison de différer ces cuts.
- **Verts qu'Orbite n'a pas touchés** (810 cuts vus par l'opérateur, 682 avec pose finale) : l'opérateur en corrige **346**, dont **155 de plus de 5 mm** et **57 de plus de 10 mm**.

Répartition par zone de la sélection « méthode de l'opérateur » (PN avec marges, ADV avec marges, abords des rouges, liste « À contrôler », sinon hors zone), lue sur le lot :

| Zone | Posés (avec pose finale) | corrigés | > 5 mm | > 10 mm | Différés (> 10 mm) | Verts avec pose finale | corrigés | > 5 mm | > 10 mm |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| PN | 13 | 3 | 2 | 0 | 0 | 15 | 11 | 6 | 3 |
| ADV | 63 | 16 | 10 | 5 | 13 (13) | 318 | 156 | 61 | 21 |
| Abords | 47 (54 posés) | 12 | 5 | 2 | 8 (8) | 72 | 46 | 22 | 7 |
| Liste « À contrôler » | 0 | 0 | 0 | 0 | 0 | 8 | 7 | 7 | 7 |
| Hors zone | 0 | 0 | 0 | 0 | 0 | 269 | 126 | 59 | 19 |
| Total | 123 | 31 | 17 | 7 | 21 (21) | 682 | 346 | 155 | 57 |

Même chose par zone des notes de l'opérateur (le lot est lu avec les zones de l'opérateur, pas avec celles du détecteur) :

| Zone (notes de l'opérateur) | Posés (avec pose finale) | > 5 mm | > 10 mm | Différés | dont > 10 mm | Verts avec pose finale | corrigés | > 5 mm | > 10 mm |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| PN 1065–1079 | 5 (5) | 0 | 0 | 0 | 0 | 10 | 8 | 5 | 3 |
| PN 1957–1972 | 8 (8) | 2 | 0 | 0 | 0 | 8 | 5 | 1 | 0 |
| ADV 3131–3228 | 28 (22) | 2 | 1 | 1 | 1 | 52 | 22 | 7 | 0 |
| Grappe 3260–3304 | 11 (10) | 1 | 0 | 1 | 1 | 29 | 19 | 14 | 7 |
| ADV 3514–3579 | 1 (1) | 0 | 0 | 1 | 1 | 61 | 38 | 23 | 8 |
| ADV 4373–4444 | 14 (14) | 3 | 2 | 2 | 2 | 48 | 25 | 8 | 1 |
| ADV 4466–4532 | 14 (14) | 3 | 1 | 2 | 2 | 49 | 18 | 7 | 1 |
| ADV 4713–4875 | 18 (18) | 3 | 1 | 4 | 4 | 112 | 52 | 26 | 8 |
| ADV 5502–5716 | 14 (14) | 2 | 1 | 6 | 6 | 175 | 77 | 33 | 21 |
| ADV 5794–5850 | 9 (9) | 1 | 1 | 3 | 3 | 43 | 24 | 7 | 0 |
| ADV 5867–5928 (début supposé) | 1 (1) | 0 | 0 | 1 | 1 | 55 | 30 | 14 | 4 |
| Hors notes de l'opérateur | 7 (7) | 0 | 0 | 0 | 0 | 40 | 28 | 10 | 4 |
| Total | 130 (123) | 17 | 7 | 21 | 21 | 682 | 346 | 155 | 57 |

Lecture : en PN, les posés d'Orbite sont justes (0 sur 13 au-dessus de 10 mm). En ADV, 5 posés sur 63 passent 10 mm. Les grosses corrections de l'opérateur sont surtout ailleurs : 21 différés et **57 verts que le lot n'a pas touchés**, dont 21 en ADV, 7 aux abords, 7 sur la liste « À contrôler » (7 de ses 8 verts avec pose finale), 3 en PN et 19 hors de toute zone de la sélection.

### La grappe 3260–3304

- Dans la grappe, le lot n'a que **12 cuts invalides** : 11 posés (3262–3265, 3276, 3286, 3290, 3291, 3293, 3294, 3302) et 1 différé (3275). Les 33 autres cuts de la grappe sont verts. L'opérateur en a visité 44 sur 45 (le seul trou est le cut 3290, un posé du lot).
- **Posés** : 2 corrigés (3286 de 7,6 mm, 3302 de 2,1 mm), aucun au-dessus de 10 mm.
- **Différé 3275** : corrigé de 40,8 mm (écartement 1 511,6 mm, hors contrat).
- **Verts** : 19 corrigés sur 29 avec pose finale, 14 au-dessus de 5 mm et **7 au-dessus de 10 mm : les cuts 3266 à 3272**, en latéral, qui s'amenuisent vers le différé : 38,9, 27,3, 24,0, 22,9, 16,2, 14,6, 10,1 mm. Puis 3273 à 3274 sont à 6,2 et 7,6 mm. Ces 9 cuts étaient verts (non touchés par Orbite) et juste avant le différé 3275 : le glissement latéral se prolonge dans le différé.
- Le détecteur d'ADV lève 7 alertes dans la grappe (3260, 3261, 3263, 3264, 3268, 3271, 3273) : voir la partie 3.

## 2. Moteur contre la pose finale de l'opérateur, règle prudente figée

Règle figée (`datasets/reglages-figes.json`, `datasets/relecture-reglages-proposes.json`) : variante `chaine+h`, agir si la pose du moteur s'écarte d'au moins 8 mm de la pose de départ, rail déplacé de 45 mm au plus en travers, écartement à 15 mm de la médiane, jamais sur un cut posé ou différé par le lot. Outil : `relecture-autonome.cjs juger --juger-partie-reservee`, table construite avec le journal du lot.

| | Valeur |
|---|--:|
| Cuts mesurables (pose du moteur et pose de l'opérateur, dans la sélection) | 444 |
| Grosses corrections de l'opérateur (> 10 mm) | **46** (85 avec pose finale sur toute la partie, dont 26 sans pose du moteur faute de nuage) |
| Actions de la règle | **16** |
| Actions ramenées à 10 mm ou moins de l'opérateur | **15** sur 16 (la 16e, cut 3547, est un petit déplacement dans le gris : l'opérateur 0 mm, règle 8,5 mm) |
| Actions reproduites à 5 mm ou moins | 14 sur 16 |
| Grosses corrections justes (l'opérateur > 10 mm, règle à 10 mm ou moins) | **12** |
| Mauvaises voies (> 50 mm) | **0** |
| Cuts abîmés | **0** |
| Erreur parmi les actions | **0 sur 16 = 0 %**, borne de Wilson à 95 % : **≤ 19,4 %** |
| Part de cuts abîmés, borne de Wilson | ≤ 0,9 % des cuts mesurables |
| Abstentions | 106 |
| Grosses corrections laissées fausses | 34 |

- Les 16 actions : 2 en PN (2 justes : cuts 1072 et 1074, l'opérateur à 38,1 et 33,8 mm), 5 en ADV (3 justes), 5 aux abords (3 justes), 4 sur la liste « À contrôler » (4 justes : 3271, 3548, 4828, 5687).
- Les 12 corrections justes : 1072, 1074, 3266, 3268, 3271, 3548, 4825, 4828, 5522, 5604, 5606, 5687. Trois sont dans la grappe 3260–3304 (3266, 3268, 3271).
- Par zone de l'opérateur : grappe 3 actions, ADV 3514–3579 2, ADV 4373–4444 1, ADV 4466–4532 1, ADV 4713–4875 3, ADV 5502–5716 4, PN 1065–1079 2, aucune ailleurs.
- Avec les seuls types qui agissent (PN, ADV, abords) : 12 actions, 8 justes, 0 erreur, borne ≤ 24,2 %.
- Pour mémoire, la règle de la procédure (seuil 3 mm) : 121 actions, 37 à 5 mm, 39 à 10 mm, 13 justes, 0 abîmé, 0 mauvaise voie (borne ≤ 3,1 %).
- Si le moteur agissait partout où il pose, sans règle : 338 actions, 22 corrections justes, 4 cuts qui restent faux (plus de 10 mm), 0 cut abîmé.
- Parmi les 106 abstentions, 21 sont de grosses corrections ; 13 autres grosses corrections sont laissées parce que la règle n'agit pas (seuil de 8 mm, écartement, voie).

**Porte figée** (0 mauvaise voie, erreur parmi les actions ≤ 9 %) :
- 0 mauvaise voie : **tenue**.
- Erreur 0 % (0 sur 16) : **tenue en valeur**. Mais la borne de Wilson (≤ 19,4 %) est au-dessus de 9 % : 16 actions ne prouvent pas la porte. Il en faudrait au moins 39 sans erreur.

Variante sans lot (même méthode que D-190 : zones reconnues sur tous les cuts visités, sans classe du lot, donc ni abords ni liste) : 217 cuts mesurables, 25 grosses corrections de l'opérateur, 14 actions, 13 à 10 mm (9 à 5 mm), 11 justes, **1 cut abîmé** (le cut 5653 : l'opérateur 0 mm, la règle le déplace de 12,3 mm), 0 mauvaise voie, erreur 1 sur 14 = 7,1 % (≤ 31,5 %), 68 abstentions, 14 laissées fausses. Elle reste sous 9 % en valeur. Elle ne voit que 349 cuts de sélection (2 plages d'ADV et 2 PN) contre 619 avec le lot.

## 3. Zones reconnues contre les notes de l'opérateur

Détecteur d'ADV figé (`regles-metier.cjs echo`, version `adv-rail-de-plus-v1`) lu sur les captures de l'Écho, 6 plages pour 8 zones :

| Zone de l'opérateur | Plage reconnue | Cuts de la zone couverts | Aiguilles |
|---|---|--:|---|
| ADV 3131–3228 | 3117–3303 | 98 sur 98 | 3149, 3161, 3162, 3219 couvertes |
| ADV 3514–3579 | 3484–3577 | 64 sur 66 (3578 et 3579 manquent) | 3545 couverte |
| ADV 4373–4444 | 4380–4538 | 65 sur 72 (4373–4379 manquent) | 4410 couverte |
| ADV 4466–4532 | 4380–4538 (même plage) | 67 sur 67 | 4504 couverte |
| ADV 4713–4875 | 4689–4880 | 163 sur 163 | 4724, 4743, 4851 couvertes |
| ADV 5502–5716 | 5493–5717 | 215 sur 215 | 5525, 5638, 5685 couvertes |
| ADV 5794–5850 | 5788–5933 | 57 sur 57 | 5819 couverte |
| ADV 5867–5928 (début supposé) | 5788–5933 (même plage) | 62 sur 62 | 5897 couverte |
| PN 1065–1079 | PN 1068–1074 (contrôle 1064–1080) | 15 sur 15 | — |
| PN 1957–1972 | PN 1960–1967 (contrôle 1956–1973) | 16 sur 16 | — |

- **Zones d'ADV retrouvées : 8 sur 8. Aiguilles couvertes : 15 sur 15** (3219 et 5897 comprises). 791 cuts sur 800 des zones d'ADV sont dans une plage. **PN de l'opérateur retrouvés : 2 sur 2.**
- **Fausses plages d'ADV : 0** (aucune plage sans zone de l'opérateur). 212 cuts de plages sur 1 003 sont hors des zones de l'opérateur : marges de 30 cuts, deux liaisons (4445–4465 entre 4444 et 4466, 5851–5866 entre 5850 et 5867) et la grappe 3260–3303 (44 cuts).
- **Plages qui fusionnent deux zones de l'opérateur** : 4373–4444 et 4466–4532 forment une seule plage, de même 5794–5850 et 5867–5928. Le détecteur retrouve donc les zones, mais pas la coupure entre elles.
- **Alertes** (rails de plus) : 56 sur des cuts du noyau d'aiguille, 101 en marge, **0 dans les deux PN (0 sur 23 cuts)**, 9 hors de toute zone de l'opérateur : sept dans la grappe (3260, 3261, 3263, 3264, 3268, 3271, 3273) et deux avant la zone 4713 (4699 et 4705).
- **PN vus comme des PN, pas pris pour une ADV** : aucune plage d'ADV ne touche un PN de l'opérateur, aucune alerte d'ADV dans les cuts des PN. Dans le PN 1065–1079, l'opérateur corrige 8 verts (3 de plus de 10 mm : 1069–1074, dont 1072 à 38,1 mm et 1074 à 33,8 mm). La règle y agit 2 fois, 2 justes.
- **La grappe 3260–3304 ressemble à une ADV non notée.** Le détecteur la relie à la zone 3131–3228 (plage 3117–3303) et y lève 7 alertes ; l'opérateur y corrige 7 verts de plus de 10 mm. **Question à l'opérateur** : y a-t-il un rail de plus ou une aiguille dans la grappe ?
- **Cœur de PN isolé au cut 5361** (non confirmé : un seul cœur) : le cut 5364 est corrigé de 14,4 mm, hors de toute note. À confirmer par l'opérateur.

Grosses corrections de l'opérateur (> 10 mm, 85 cuts avec pose finale) : **70 dans les zones d'ADV de ses notes**, 3 dans un PN (1069–1074), **12 hors de ses notes** : 3266–3275 (la grappe, 10 cuts), 4927–4929 (26,5, 43,5 et 40,7 mm en latéral) et 5364 (14,4 mm). Seules 4 sont hors de toute plage du détecteur : 4927–4929 et 5364.

Sélection de zones construite sur le lot (PN et ADV reconnus sur les seuls cuts du lot, plus les abords) :
- ADV reconnues : 4380–4443, 4471–4535, 4715–4797, 5493–5649, 5788–5851 ; PN 1068–1070 (contrôle 1064–1076) et 1960–1967 (contrôle 1956–1973). Zones d'ADV de l'opérateur retrouvées : **5 sur 8**. Manquent 3131–3228, 3514–3579 (2 cuts du lot) et 5867–5928 (2 cuts du lot). Aiguilles couvertes par les plages : 7 sur 15. PN de l'opérateur retrouvés : 2 sur 2, aucune fausse plage.
- Cuts des zones de l'opérateur (ADV et PN, 831) dans la sélection complète (abords et liste compris) : 533 sur 831. Grosses corrections de l'opérateur hors sélection : **19 sur 85** : 3272, 3514–3519, 4826, 4927–4929, 5654–5656, 5688, 5877–5880. Toutes sont des verts, en latéral.
- Avec la reconnaissance sans lot (cuts visités seulement) : plages 5546–5718 et 5788–5933 seulement, **3 zones sur 8**, 4 aiguilles sur 15, PN 2 sur 2, aucune fausse plage. Cuts des zones de l'opérateur dans la sélection : 321 sur 831 ; grosses corrections hors sélection : 48 sur 85. Les captures de première visite, avant le premier geste de l'opérateur, donnent moins d'alertes que la meilleure capture du détecteur.

## Lecture

- Le lot Orbite est juste sur ce qu'il diffère (21 sur 21 sont de grosses corrections) mais moins sûr sur ce qu'il pose que dans 2:6 : 7 posés sur 123 dépassent 10 mm, dont 4 à une aiguille.
- Le détecteur d'ADV retrouve toutes les zones, toutes les aiguilles (15 sur 15) et les deux PN sur les captures de l'Écho, sans fausse plage et sans prendre un PN pour une ADV. Il fusionne seulement deux couples de zones voisines. Dans le lot seul, il manque 3 zones sur 8, parce que le lot y a deux cuts ou presque aucune alerte.
- La règle prudente ne se trompe pas ici (0 abîmé, 0 mauvaise voie, 15 actions sur 16 à 10 mm de l'opérateur ; sans lot, 1 abîmé sur 14), mais elle n'agit que sur 16 cuts et en laisse 34 de plus de 10 mm. La porte n'est ni infirmée ni démontrée.
- Les grosses corrections hors zone sont peu nombreuses mais nettes : la grappe 3260–3274, les cuts 4927–4929 et le cut 5364.

## Limites

- Une seule partie, un seul opérateur expert ; peu d'actions (16).
- 259 cuts de l'Écho n'ont pas de nuage ; 26 des 85 grosses corrections n'ont pas de pose du moteur et ne sont pas mesurables.
- Bornes de zones : la zone de l'aiguille 5897 a un **début supposé** (marge de 30 cuts, 5867). Le PN 1957–1972 et la zone 3131–3228 ont été corrigés par l'opérateur après le premier jet de ses notes. Le fichier de notes archivé dans les données n'a pas été mis à jour.
- La grappe 3260–3304 n'est pas une zone de l'opérateur : ses chiffres sont à part, et la mention « ressemble à une ADV » est une hypothèse du détecteur, pas une note de l'opérateur.
- Les chiffres « avec lot » et « sans lot » ne se comparent pas à la lettre : les cuts du lot sont exclus de la règle.

## Compteur GCV2 (source `p2-7`)

Source `p2-7` ajoutée (projet 2, partie 7, état « en-file »). Le manifeste n'est pas modifié : 2:7 reste réservée tant que la décision n'est pas écrite.

| | Partie 2:7 | Total du compteur |
|---|--:|--:|
| Cuts corrigés | 394 | **2 684** (2 290 avant) |
| dont plus de 5 mm | 186 | 1 705 |
| dont plus de 10 mm | 78 | 835 |
| Validés tels quels | 141 | 694 |
| Visités sans action (0,6 s ou plus) | 321 | 1 880 |
| SKIP (non comptés) | 1 | 19 |
| Sans pose finale (non comptés) | 103 | 681 |
| Apprenables | 856 | **5 258** (4 402 avant) |

Appris (GCV2 entraînée) : 2 138 corrigés, 4 024 apprenables. En file : 546 corrigés (2:6 et 2:7), 1 234 apprenables. La partie 1:17 est lue par `--racine-supplementaire` (7z extrait, 14 segments, puis effacé). Le compteur compte les cuts corrigés par l'étiquette de l'Écho, d'où 78 cuts de plus de 10 mm ici contre 85 dans la partie 1 de ce rapport (cuts à étiquette « ambigu » laissés de côté, et cuts visités sans action).
Commit poussé : `6f950a9` sur `claude/50-g1b-apprendre`. Essais du compteur et du manifeste : 17 réussis sur 17.

## Fichiers gardés (pour le jugement G1-c)

Dans le dossier de travail (hors dépôt, ils portent des bords de rail) : `cas-2-7.jsonl` (cas extraits), `table-2-7.json` (table avec lot), `table-sanslot.json`, `jointure.json`, `jeu.jsonl`, `regles-echo.json`, `jugement-lot.json`, `jugement-sanslot.json`, `notes-2-7.json`.

## Rejouer

```
python3 -I rm4/jextraire.py "<dossier lot Orbite>" jn
node --max-old-space-size=14000 tools/relecture-autonome.cjs extraire --partie 2:7 --echo "<dossier Écho>" --sortie cas-2-7.jsonl
node --max-old-space-size=14000 tools/relecture-autonome.cjs table --partie 2:7 --echo "<dossier Écho>" --journal jn/<journal> --cas cas-2-7.jsonl --sortie table-2-7.json
node --max-old-space-size=14000 tools/relecture-autonome.cjs table --partie 2:7 --echo "<dossier Écho>" --sans-lot --cas cas-2-7.jsonl --sortie table-sanslot.json
node tools/jointure-echo-orbite.cjs --echo "<dossier Écho>" --journal jn/<journal> --partie 7 --visite-sans-action-bonne --sortie jointure.json
node tools/relecture-autonome.cjs juger --reglages datasets/relecture-reglages-proposes.json --partie 2:7 --cas cas-2-7.jsonl --table table-2-7.json --juger-partie-reservee
node tools/jeu-apprentissage.cjs --jointure jointure.json --avec-hors-journal --sortie jeu.jsonl
node tools/regles-metier.cjs echo --partie 2:7 --echo "<dossier Écho>" --jeu jeu.jsonl --pn 1065-1079,1957-1972 --adv 3131-3228:3149+3161+3162+3219,3514-3579:3545,4373-4444:4410,4466-4532:4504,4713-4875:4724+4743+4851,5502-5716:5525+5638+5685,5794-5850:5819,5867-5928:5897 --juger-partie-reservee
```

Les lectures de l'Écho prennent plus de 4 Go de mémoire pour cette partie : les lancer une par une, avec `--max-old-space-size`.
