# Examen de la partie 2:6 (projet 2, partie 6) — 19 octobre 2026

Partie neuve, donc **réservée** (rotation D-192). Elle est jugée avec les réglages figés. **Aucun réglage n'a changé, rien sous `src/` n'a changé.** Les chiffres ne portent que des numéros de cut et des millimètres.

## Données

- Écho de Mic du 19/10 (4.9.5.8) : 458 visites, 431 cuts vus, 366 avec une pose finale de Mic, 16 segments cumulatifs lus.
- Lot Orbite du 16/10 (4.9.5.3) : 83 cuts invalides au départ (9 801 validés, 83 invalides, total 9 884). Jointure : 80 cuts joints, 3 cuts du journal que Mic n'a pas vus. La translation entre les deux repères est constante, résidu 0,0 mm : l'Écho et le lot sont bien la même partie.
- Écart de Mic = le plus grand des deux rails, en 3D (repère profil). Un cut visité 0,8 s ou plus sans action compte pour une correction nulle (règle de Mic).
- « Corrigé » veut dire : Mic a validé après avoir déplacé un rail (étiquette Écho). Les seuils 5 mm et 10 mm se lisent sur l'écart mesuré.

## 1. Orbite contre Mic (les 83 invalides de départ)

| | Cuts | Vus par Mic | Corrigés par Mic | Écart > 5 mm | Écart > 10 mm |
|---|--:|--:|--:|--:|--:|
| Posés par Orbite | 72 | 69 (67 avec pose finale) | 10 | **3** | **0** |
| Différés par Orbite | 11 | 11 | 11 (9 corrigés, 2 « ambigus ») | **11** | **11** |

- **Orbite a posé 72 cuts et en a différé 11.** Parmi les 72 posés, 3 n'ont pas été vus par Mic.
- **Posés** : Mic en a corrigé 10 sur 69. Trois seulement dépassent 5 mm (cuts 831 à 6,2 mm, 1034 à 5,8 mm, 4488 à 9,9 mm, tous trois dans les abords des rouges) et aucun ne dépasse 10 mm. Médiane 0 mm. Aucun faux vert dans les posés.
- **Différés** : les 11 sont corrigés de plus de 10 mm (médiane 48 mm, de 28 à 68 mm, surtout en latéral). Motifs de différé d'Orbite (par rail) : écartement hors contrat 14, candidats 5, ambigu 2, flanc 1. Cela confirme que le lot a raison de différer ces cuts.
- **Verts qu'Orbite n'a pas touchés** (351 cuts vus par Mic, 288 avec pose finale) : Mic en corrige **133**, dont **57 de plus de 5 mm** et **24 de plus de 10 mm**.

Répartition par zone (zones de la sélection « méthode de Mic », lue sur le lot : PN avec marges, ADV avec marges, abords des rouges, liste « À contrôler », sinon hors zone) :

| Zone | Posés (vus) | dont Mic > 5 mm | Différés | dont > 10 mm | Verts avec pose finale | corrigés | > 5 mm | > 10 mm |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| PN | 12 | 0 | 0 | 0 | 4 | 3 | 2 | 1 |
| ADV | 51 | 0 | 9 | 9 | 207 | 95 | 35 | 14 |
| Abords | 6 | 3 | 2 | 2 | 22 | 12 | 7 | 1 |
| Liste « À contrôler » | 0 | 0 | 0 | 0 | 3 | 3 | 3 | 3 |
| Hors zone | 0 | 0 | 0 | 0 | 52 | 20 | 10 | 5 |

Lecture : les posés d'Orbite sont justes en PN et en ADV (0 sur 61 avec pose finale au-dessus de 5 mm). Les grosses corrections de Mic sont ailleurs : 11 différés, et 24 verts que le lot n'a pas touchés, dont 14 en ADV et 5 hors de toute zone.

## 2. Moteur contre la pose finale de Mic, règle prudente figée

Règle figée (`datasets/reglages-figes.json`, `datasets/relecture-reglages-proposes.json`) : variante `chaine+h`, agir si la pose du moteur s'écarte d'au moins 8 mm de la pose de départ, rail déplacé de 45 mm au plus en travers, écartement à 15 mm de la médiane, jamais sur un cut posé ou différé par le lot. Outil : `relecture-autonome.cjs juger --juger-partie-reservee`, table construite avec le journal du lot.

| | Valeur |
|---|--:|
| Cuts mesurables (pose du moteur et pose de Mic) | 274 |
| Grosses corrections de Mic (> 10 mm) | **27** (35 avec la pose finale, 8 sans pose du moteur) |
| Actions de la règle | **14** |
| Actions ramenées à 10 mm ou moins de Mic | **14** sur 14 |
| Actions reproduites à 5 mm ou moins | 13 sur 14 |
| Grosses corrections justes (Mic > 10 mm, règle à 10 mm ou moins) | **10** |
| Mauvaises voies (> 50 mm) | **0** |
| Cuts abîmés | **0** |
| Erreur parmi les actions | **0 sur 14 = 0 %**, borne de Wilson à 95 % : **≤ 21,5 %** |
| Part de cuts abîmés, borne de Wilson | ≤ 1,4 % des cuts mesurables |
| Abstentions | 38 |
| Grosses corrections laissées fausses | 17 |

- Les 14 actions : 10 en ADV (7 justes), 2 en abords (1 juste), 2 sur la liste « À contrôler » (2 justes). Aucune en PN : le seul cut de PN avec une grosse correction (7939, 61 mm) fait partie des abstentions.
- Avec les seuls types qui agissent (PN, ADV, abords) : 12 actions, 8 justes, 0 erreur, borne ≤ 24,2 %.
- Pour mémoire, la règle de la procédure (seuil 3 mm) : 79 actions, 28 à 5 mm, 30 à 10 mm, 10 justes, 0 abîmé, 0 mauvaise voie.
- Si le moteur agissait partout où il pose, sans règle : 236 actions, 15 corrections justes, 1 cut abîmé.

**Porte figée** (0 mauvaise voie, erreur parmi les actions ≤ 9 %) :
- 0 mauvaise voie : **tenue**.
- Erreur 0 % (0 sur 14) : **tenue en valeur**. Mais la borne de Wilson (≤ 21,5 %) est au-dessus de 9 % : 14 actions ne prouvent pas la porte. Il en faudrait au moins 39 sans erreur.

Variante sans lot (même méthode que D-190 : zones reconnues sur tous les cuts visités, sans classe du lot) : 193 cuts mesurables, 18 grosses corrections de Mic, 14 actions, 13 à 10 mm, 10 justes, **1 cut abîmé**, 0 mauvaise voie, erreur 1 sur 14 = 7,1 % (≤ 31,5 %), 26 abstentions, 8 laissées fausses. Elle reste sous 9 % en valeur. La différence avec la mesure principale vient surtout des cuts que le lot a déjà posés ou différés, qui sortent de la règle.

## 3. Zones reconnues contre les notes de Mic

Détecteur d'ADV figé (`regles-metier.cjs echo --adv`, version `adv-rail-de-plus-v1`) lu sur les captures de l'Écho :

| Zone de Mic | Plage reconnue | Cuts de la zone couverts | Aiguille |
|---|---|--:|---|
| ADV 3359–3442 | 3365–3537 | 78 sur 84 (3359–3364 manquent) | — |
| ADV 3478–3535 | 3365–3537 (même plage) | 58 sur 58 | 3505 couverte |
| ADV 3670–3752 | 3640–3760 | 83 sur 83 | 3723 couverte |
| ADV 4423–4477 | 4417–4507 | 55 sur 55 | — |
| ADV 4723–4779 | 4619–4790 | 57 sur 57 | 4756 couverte |
| Aiguille isolée 4650 | 4619–4790 | dans la plage | **vue** (voir ci-dessous) |
| PN 7935–7957 | PN 7936–7956 (cœur 7940–7950) | 21 sur 23 | — |

- **Zones de Mic retrouvées : 5 sur 5. Aiguilles couvertes : 3 sur 3, plus l'aiguille isolée 4650.** 331 cuts sur 337 des zones de Mic sont dans une plage.
- **Fausses plages d'ADV : 0** (aucune plage ne tombe loin des notes). 226 cuts de plages sur 557 sont hors des zones de Mic : ce sont des marges de 30 cuts et la zone autour de 4650.
- **Alertes** (rails de plus) : aucune dans le PN (0 sur 17 cuts). Les 44 alertes hors des trois zones à aiguille tombent dans les deux autres zones de Mic (32 alertes, cuts 3395–3430 et 4447–4477) ou entre 4649 et 4675 (12 alertes, autour de l'aiguille isolée).
- **Aiguille isolée du cut 4650** : le détecteur donne des alertes en 4649 (non confirmée), 4651, 4653, puis 4664–4675. Mic y a bien du travail : les cuts 4653 et 4654 sont des différés d'Orbite corrigés de 66 et 68 mm, le cut 4648 est corrigé de 54 mm et le cut 4675 de 18,6 mm. Le cut 4650 lui-même est posé par Orbite et corrigé de 4,5 mm seulement. La plage 4619–4790 relie cette aiguille à la zone 4723–4779 (48 cuts d'écart, marges de 30 cuts de chaque côté).
- **PN 7935–7957 : vu comme un PN, pas pris pour une ADV.** Zone PN 7936–7956 avec cœur 7940–7950, et 0 alerte d'ADV dans ces cuts. Mic y corrige 5 cuts (le cut 7939 de 61 mm, les autres de 2,8 à 6,2 mm) et le lot en pose 12 sans erreur de plus de 5 mm. 6 cuts de la zone de Mic n'ont pas de pose finale.
- **Une zone de PN que Mic n'a pas notée** : cuts 3927–3941 (cœur 3931–3935). Mic y corrige 5 cuts de 34 à 41 mm en latéral. C'est donc vraisemblablement un PN réel. À lui de confirmer.

Grosses corrections de Mic (> 10 mm, 35 cuts avec pose finale) : **25 dans les zones d'ADV de ses notes**, 1 dans son PN (7939), **9 hors de ses notes** : 3931–3935 (le PN non noté) et 4648, 4653–4654, 4675 (autour de l'aiguille isolée).

Sélection de zones construite sur le lot (PN et ADV reconnus sur les seuls cuts du lot, plus les abords) :
- ADV reconnues : 3367–3433, 3643–3755, 4422–4483, 4619–4788 ; PN 7936–7956. Zones de Mic retrouvées : **4 sur 5**. **La zone 3478–3535 (aiguille 3505) manque** : le lot n'y a que 2 cuts (3480 et 3505, tous deux différés), trop peu pour deux alertes.
- Cuts des zones de Mic couverts : 262 sur 337. Grosses corrections de Mic dans la sélection : 30 sur 35. Hors sélection : les 5 cuts 3931–3935 (34 à 41 mm). Aucun n'est dans le PN noté ou dans une ADV notée.
- Avec la reconnaissance sans lot (cuts visités seulement) : 3 zones sur 5 (manquent 3359–3442 et 3478–3535), PN 3927–3941 et 7936–7956 reconnus, 21 grosses corrections sur 35 dans la sélection. Les captures de première visite, avant le premier geste de Mic, y donnent moins d'alertes que la meilleure capture du détecteur.

## Lecture

- Le lot Orbite est sûr sur ce qu'il pose (0 cut de plus de 10 mm, 3 de plus de 5 mm sur 67) et juste sur ce qu'il diffère (11 sur 11).
- Le détecteur d'ADV retrouve toutes les zones et toutes les aiguilles de Mic sur les captures de l'Écho, sans fausse plage. Dans le lot seul, il manque une zone parce que le lot n'y a presque pas de cut.
- La règle prudente ne se trompe pas ici (0 abîmé, 0 mauvaise voie, 14 actions justes à 10 mm), mais elle n'agit que sur 14 cuts et en laisse 17 de plus de 10 mm. La porte n'est ni infirmée ni démontrée.
- Les PN ne sont pas touchés par la règle (aucune action) alors que la grosse correction du PN noté est à 61 mm.

## Limites

- Une seule partie, un seul opérateur expert ; peu d'actions (14).
- 55 cuts de l'Écho n'ont pas de nuage ; 8 des 35 grosses corrections n'ont pas de pose du moteur et ne sont pas mesurables.
- Mic n'a pas noté d'aiguille dans deux zones (3359–3442 et 4423–4477) : la couverture d'aiguilles ne porte que sur 3 aiguilles.
- La zone de Mic 3359–3442 avait peu de cuts du lot ; l'aiguille isolée 4650 n'est pas une zone : elle est comptée dans la plage qui la contient.
- Les chiffres de la sélection « sans lot » et « avec lot » ne se comparent pas à la lettre : les cuts du lot sont exclus de la règle.

## Compteur GCV2 (source `p2-6`)

Source `p2-6` ajoutée (projet 2, partie 6, état « en-file »). Le manifeste n'est pas modifié : 2:6 reste réservée tant que la décision n'est pas écrite.

| | Partie 2:6 | Total du compteur |
|---|--:|--:|
| Cuts corrigés | 152 | **1 783** (1 631 avant) |
| dont plus de 5 mm | 68 | 1 091 |
| dont plus de 10 mm | 32 | 559 |
| Validés tels quels | 30 | 472 |
| Visités sans action (0,6 s ou plus) | 196 | 1 373 |
| SKIP (non comptés) | 5 | 18 |
| Sans pose finale (non comptés) | 48 | 557 |
| Apprenables | 378 | **3 628** (3 250 avant) |

Appris (GCV2 entraînée) : 0, tout est en file. Le compteur compte les cuts corrigés par l'étiquette de l'Écho, d'où 32 cuts de plus de 10 mm ici contre 35 dans l'examen ci-dessus (le compteur laisse de côté les 4 cuts à étiquette « ambigu »).
Commit poussé : `36458ba` sur `claude/50-compteur-gcv2`. Essais du compteur et du manifeste : 16 réussis sur 16.

## Rejouer

```
python3 -I rm4/jextraire.py "<dossier lot Orbite>" jn
node tools/relecture-autonome.cjs extraire --partie 2:6 --echo "<dossier Écho>" --sortie cas-2-6.jsonl
node tools/relecture-autonome.cjs table --partie 2:6 --echo "<dossier Écho>" --journal jn/<journal> --cas cas-2-6.jsonl --sortie table-lot.json
node tools/jointure-echo-orbite.cjs --echo "<dossier Écho>" --journal jn/<journal> --partie 6 --visite-sans-action-bonne --sortie jointure.json
node tools/relecture-autonome.cjs juger --reglages datasets/relecture-reglages-proposes.json --partie 2:6 --cas cas-2-6.jsonl --table table-lot.json --juger-partie-reservee
node tools/jeu-apprentissage.cjs --jointure jointure.json --avec-hors-journal --sortie jeu.jsonl
node tools/regles-metier.cjs echo --partie 2:6 --echo "<dossier Écho>" --jeu jeu.jsonl --pn 7935-7957 --adv 3478-3535:3505,3670-3752:3723,4723-4779:4756 --juger-partie-reservee
```
