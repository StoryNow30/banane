# Protocole de séance Écho (une page) — CH-053-S

But : fermer la boucle sur les posés d'Ariane (6 jugés sur 957 le 04/11) et reconstituer une partie d'examen. Rien n'est réglé d'après la partie d'examen (le manifeste l'interdit) : elle ne sert qu'à juger.

## 1. Quelle partie nommer
Parties réservées du lot du 04/11 et leurs posés par Ariane (comptés par `src/correction-liste.js` sur le journal) : 6 → 135, 7 → 49, 8 → 139, 9 → 145 (21 différés : zone difficile), 11 → 142 (3 différés), 12 → 1.
**Proposition : partie 11** (142 posés, presque sans différé : l'échantillon ressemble au lot courant) ; **partie 8** (139) en complément si une faute oblige à continuer. Décision de l'opérateur. Condition : le moteur n'a pas changé depuis ce lot ; sinon, nouvelle partie.

## 2. Taille nécessaire (D-223 : plus de 50 mm au plus 3 %, borne haute de Wilson à 95 %)
| fautes de plus de 50 mm | posés jugés nécessaires |
|---|---|
| 0 | 125 |
| 1 | 185 |
| 2 | 239 |
Procédure par tranches, annoncée avant : tranche A = 125 premiers du tirage ; si 0 faute, c'est fini ; si 1, tranche B = 60 de plus ; si 2, tranche C = 54 de plus ; au-delà de 2, D-223 n'est pas démontré, on s'arrête. 239 posés exigent deux parties (11 + 8).

## 3. Tirage au sort
L'intégrateur annonce une graine (entier) AVANT d'ouvrir le tirage, puis : `node tools/file-prioritaire.cjs echantillon --table T.json --partie 11 --taille 239 --graine G --json tirage.json` (T = table de jointure de la partie ; `tirage` = ordre du tirage, `cuts` = même liste dans l'ordre des cuts). Le tirage exclut les posés déjà jugés. Il reste hors dépôt (numéros de cut).

## 4. Séance (opérateur)
1. Écho **allumé** pendant toute la séance ; version du moteur notée.
2. Parcourir `cuts` dans l'ordre des cuts (plages), A d'abord. Pour chaque cut : regarder la pose d'Ariane, **corriger seulement si elle est fausse** ; sinon laisser la visite immobile **au moins 0,8 s** (c'est la définition de « contrôlé bon », tools/juger-lot.cjs). Ne rien valider d'office, ne pas survoler.
3. Aucun SKIP. Un cut douteux se corrige ou se note, il ne se saute pas.
4. Durée : 125 cuts ≈ 5 min à 2,4 s par cut (moyenne mesurée le 04/11) et jusqu'à 9 min à 4,5 s (estimation de CH-051).
5. Exporter l'Écho (tous les segments) et le déposer dans `banane-data`.

## 5. Jugement (intégrateur)
`tools/juger-lot.cjs` sur la partie : fautes de plus de 50 mm, plus de 10 mm, médiane. Le résultat est écrit AVANT toute modification de réglage ; aucune partie nommée examen n'alimente ensuite un réapprentissage.
