# `juger-lot` : juger un lot contre l'Écho en une commande

Outil : `tools/juger-lot.cjs` (lecture seule). Essais : `tests/juger-lot.test.cjs` (données fictives). Il remplace les quatre analyses écrites à la main (`p15`, `p1617`, `p182019`, `p01` de `banane-data`, `outils/analyse-lots`) et ne duplique pas `tools/precision-poses.cjs` (CH-009) : il en reprend les compteurs et les intervalles.

## Commande
```
node tools/juger-lot.cjs <dossier-d-export> [--echo <dossier>]... [--partie N]... [--json fichier.json]
```
- `<dossier-d-export>` : les archives du lot (le journal `ariane-journal-v4-*.json` est lu dans les zips, volumes recollés en mémoire). Rien n'est extrait sur le disque.
- `--echo` : dossier d'export de l'Écho, répétable ; on peut donner la collection entière, l'outil descend jusqu'aux archives. Sans `--echo`, tout posé est « sans Écho » et rien n'est jugé.
- `--partie` : limite à ces parties ; sans lui, toutes les parties qui ont un lot dans le journal (la dernière exécution de chaque partie).
- `--json` : écrit la sortie complète (comptes, millimètres, intervalles ; ni numéro de cut ni coordonnée).

## Le tableau, une partie puis le total
Chaque chiffre est écrit avec sa population (« sur 352 posés », « sur 24 jugés »).

| Ligne | Définition |
|---|---|
| cibles | cuts qui ont reçu une décision du lot ; le cut de départ déjà vert n'est pas une cible |
| posés | cibles avec une écriture de validation 2xx pendant le lot (du départ à 5 s après l'arrêt) |
| différés | cibles sans cette écriture |
| sans Écho | posés que l'Écho n'a pas visités |
| non jugés | posés vus par l'Écho sans validation et sans visite assez longue ou immobile, ou dont le repère de scène n'est pas calibré |
| jugés | posés vus par l'Écho dont l'écart est connu : **corrigés** + **contrôlé, bon** |
| corrigés | l'opérateur a validé une pose : écart = pire rail, 3D, pose d'Ariane contre cette validation |
| contrôlé, bon | visite d'au moins 0,8 s, aucun rail déplacé de 0,5 mm ou plus, aucune validation : écart nul |
| > 20 mm, > 50 mm | parmi les jugés, pire rail, 3D (strictement supérieur) |
| mauvaise voie | parmi les jugés, pire écart latéral de plus de 100 mm (lecture des analyses `p01` et suivantes) |
| passe en ombre | à part, jamais additionnée au lot : passe 1 seule ; « poserait » jugés contre la validation de l'opérateur (médiane, max, > 20, > 50), « rien », refus de la garde |

## Les gestes et le budget D-223 (CH-030, D-269, D-270)
Ajoutés sous chaque tableau ; la sortie historique ci-dessus n'est pas modifiée. Cadrage : `fiches/CADRAGE_QUALITE_POSE.md`.

| Geste | Définition (sur les jugés) |
|---|---|
| acceptation | regardé et non touché : « contrôlé, bon » |
| fine | validation, écart d'au plus 10 mm (10,0 inclus) |
| moyenne | plus de 10 mm, au plus 50 mm (50,0 inclus) |
| faute | plus de 50 mm |

- Trois répartitions, chacune avec son effectif et ses intervalles de Wilson à 95 % : **pire rail 3D**, **latéral** et **vertical** (pire des deux rails sur l'axe). L'écart est arrondi au micromètre avant le classement (bruit de calcul). « Sous 5 mm » (pire rail 3D, jugés) est un indicateur ; « sous 3 mm » est abandonné (sous le plafond de la mesure).
- **Budget D-223 : fautes (plus de 50 mm) au plus 3 % des POSÉS.** Les posés non jugés (sans Écho ou non jugés) ne sont ni bons ni mauvais. L'outil donne : la **couverture** (jugés sur posés), le **plancher** (fautes connues sur tous les posés, non jugés supposés sans faute), le **pire cas** (tous les non jugés fautifs), et « **si les non jugés ressemblent aux jugés** » (taux des jugés, SUPPOSÉ). Verdict : « tenu au pire cas », « dépassé même au plancher » ou « ne tranche pas ».
- `--json` : blocs `gestes` et `budgetD223` par partie et dans `total` ; comptes, parts et bornes, ni numéro de cut ni coordonnée.
- Un dossier d'export en `.7z` n'est pas lu par l'outil (les archives `.7z` sont ignorées) : extraire d'abord le zip interne dans un dossier de travail hors du dépôt. La lecture d'un Écho de plus de 200 Mo demande `NODE_OPTIONS=--max-old-space-size=12000` (mesuré : 2 min 36 s sur la partie 20).

## Pourquoi « contrôlé, bon » est borné
Un posé que l'opérateur a regardé sans le corriger ne prouve rien si l'Écho ne tournait pas sur ce cut. La règle ne s'applique donc qu'aux cuts **visités par l'Écho** (règle `--visite-sans-action-bonne` de `tools/jointure-echo-orbite.cjs`, qui écarte aussi les visites ouvertes moins de 60 s après un rechargement de page et celles aux captures vides). Un posé jamais visité reste « sans Écho » : il n'est pas supposé bon. Pour juger des cuts posés par le lot pendant une séance Écho, il faut que l'Écho tourne sur eux ; sinon la colonne « sans Écho » grossit et les jugés restent rares.

## Limites
- Les rôles « réglage » et « examen » (CH-009) ne sont pas classés ici : l'opérateur ou l'intégrateur le dit, l'outil ne le devine pas.
- Aucun seuil n'est réglé par l'outil ; 20, 50 et 100 mm sont des lectures de comptage, pas des décisions.
- Le jugement porte sur la **dernière exécution** de chaque partie : ses lots consécutifs (une reprise de file sur la même partie en fait partie ; une autre partie intercalée sépare deux exécutions). Cibles et posés sont l'union des lots de l'exécution. Le cut de départ déjà vert d'un lot (`depart-sur-vert`, signalé par la capture abandonnée ou par l'arrêt du lot) n'est pas une cible.
- Pas de détail par cut : les listes par cut se produisent avec `precision-poses.cjs --detail` et vont dans `banane-data`.
