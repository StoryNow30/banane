# CH-124 : cible chiffrée (écrite et poussée avant toute mesure de signal et tout rejeu, D-222, D-352, audit 1)

Écrite le 13/11/2026. À ce moment : rien n'est mesuré, aucun rejeu n'est lancé ; seuls le format des captures, de la liste et du journal ont été lus pour savoir quels signaux existent. Rien de ce qui suit n'est retouché après la première mesure ; un réglage retouché après jugement est un nouveau réglage, jugé à part.

## Référence
Banc de CH-116 (`chantiers/CH-116/outils/banc.cjs`), profil livré L1-se, deuxième passe éteinte, juge de CH-113 (pire rail, 3D ; juste ≤ 10 mm ; mauvaise voie > 50 mm). Rejeu du code livré : 561 posés jugés, 496 ≤ 10 mm, 36 de 10 à 50, **29 > 50** (toutes en ADV), 591 différés, 4 bons bloqués. Corpus (sort réel du lot) : 30 mauvaises voies, toutes en ADV. Le rejeu « livre » est refait sur ma copie des captures et comparé à ces chiffres avant toute autre chose.

## Étape 1 : mesurer les signaux (avant tout levier)
Un signal n'utilise que ce qui est connu au moment de la décision du cut (capture du cut et des cuts déjà vus, liste d'ESV du départ de partie, champs du cut), jamais une pose d'Ariane ni une pose humaine. Pour chaque signal, sur les cuts ADV jugés du corpus :
- sur les mauvaises voies (30 au lot réel, 29 au rejeu) : bonne désignation (la voie de la pose finale de l'opérateur est préférée à la voie posée à tort), mauvaise désignation, muet ;
- sur les posés justes en ADV : le signal contredit-il la pose juste (préfère une autre voie à plus de 50 mm) ? ;
- la part de cas où il ne dit rien.

**Seuil écrit d'avance pour dire « un signal existe »** (mesure descriptive sur tout le corpus, examen 0511 compris pour la contradiction seulement) :
1. bonne désignation sur **au moins 15 des 30** mauvaises voies ;
2. mauvaise désignation sur **2 au plus** de ces 30 ;
3. contradiction d'une pose juste en ADV : **1 % au plus** des justes ADV où il parle (borne de D-223).
En dessous : résultat « pas d'ancre », rapport chiffré, pas de levier.

## Étape 2 : le levier, seulement si l'étape 1 passe
Patch éteint (clé à `null`), à l'éteint rejeu identique au livré (4 016 / 4 016). Réglage figé et poussé avant jugement. Ordre de l'audit (R1) : garde d'octobre d'abord, puis validation croisée, puis examen vierge chez CH-116.

Validation croisée « un lot dehors » : lots réglables 0411, 0611, 0811a, 0811b, 1111, 1211 ; examen 0511 (jamais regardé pour régler). La cible porte sur la somme des six lots tenus à l'écart.
1. Mauvaises voies (posés jugés > 50 mm) : **29 → ≤ 15**.
2. **0 nouvelle** : aucun cut posé ≤ 50 mm ou différé par le livré ne passe au-delà de 50 mm.
3. **Aucun juste dégradé au-delà de 10 mm.**
4. Coût en différés chiffré : bons bloqués nouveaux **≤ 2 par mauvaise voie retirée**, tous listés.
5. Examen 0511 : aucun recul (critères 2 et 3 ; bons bloqués nouveaux ≤ 2).
6. **Garde d'octobre verte** (`node tools/garde-gcv2.cjs --rejouer`, 11 lots, retour 0), passée AVANT la validation croisée complète ; une garde rouge écarte le réglage sans autre rejeu.
7. R3 : poses de la chaîne déplacées ou remplacées, et décisions changées par ricochet (hors cuts touchés), comptées à part et listées. Cible : aucune pose de la chaîne déplacée ou remplacée à plus de 10 mm sur un cut jugé juste, et aucun ricochet qui dégrade un cut jugé.
8. Parité banc / service worker (`tools/parite-l1se-sw.cjs --passe`) à l'éteint et au réglage figé.
9. R4 : la puissance de chaque examen est dite (nombre de mauvaises voies et leur zone). R5 : les zones sont celles du banc (`tools/banc-differes.cjs`), dites comme telles.

Si l'étape 2 n'atteint pas 1 avec 2 à 8 tenus : rapporté comme non concluant, avec la raison mesurée.

## Ordre de travail
1. Rejeu « livre » de contrôle (identique à CH-116 attendu).
2. Inventaire de ce qui est indépendant des poses dans la capture, la liste et le journal ; mesure de chaque signal (étape 1).
3. Levier, garde, validation croisée, parité, rapport d'une page.
