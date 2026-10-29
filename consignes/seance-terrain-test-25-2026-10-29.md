# Séance terrain de la test 25 (4.9.5.25)

Trois nouveautés sont **allumées** (file de parties, déplacement de la vue au clic droit, garde « après un différé »). Aucune n'a été vue sur un vrai ESV. Tu es présent pendant le premier lot.

## Avant
1. « Exporter tout » du cache, puis installe `ariane-v4.9.5.25.zip` par-dessus, recharge ESV, vérifie « 4.9.5 test 25 (F-V-G) ».

## 1. Un lot ordinaire, une partie
1. Lance un lot comme d'habitude. Garde l'œil sur trois choses :
   - **La vue** : quand un rail tombe hors de la vue, Ariane glisse la vue au clic droit puis la remet. Note si la vue bouge vraiment, et si un menu du navigateur s'ouvre.
   - **La garde** : certains cuts qui suivent un différé restent différés au lieu d'être posés. C'est voulu (le détail sera au journal).
   - Rien d'autre ne change.
2. À la fin, **exporte** (« Exporter tout »).

## 2. L'Écho sur ce lot (le plus utile)
Passe en Écho sur la même partie, dans cet ordre de priorité :
1. Les cuts **posés après avoir déplacé la vue** (ils sont marqués au journal) ;
2. Les **3 cuts qui suivent chaque différé** ;
3. Les cuts que la deuxième passe a posés ;
4. Ensuite, autant de cuts posés que tu peux, tirés dans toute la partie.
Corrige seulement ce qui est faux, ne touche pas ce qui est bon. Exporte après la séance. Pas de séance Écho complète demandée : ce que tu peux faire sert.

## 3. La file de parties (premier essai, avec toi présent)
1. Règle le nombre de parties à **2** dans la carte « File de parties », lance.
2. Regarde le changement de partie : ESV charge-t-il la partie suivante ? Ariane reprend-elle seule ? La relecture et la correction passent-elles après la première partie ?
3. Si la file s'arrête avec une alerte, note le message et exporte : c'est le résultat attendu d'un cas inconnu.
4. Exporte à la fin.

## À noter en une ligne
- Si le clic droit a déplacé la vue, ou non.
- Ce que fait ESV au changement de partie.

## Règles
- Aucun SKIP, aucune validation à l'aveugle.
- Pour couper une nouveauté : réglages d'Ariane (file, déplacement de la vue, garde) ; dis-moi laquelle.

## Ce que je fais ensuite
`tools/juger-lot.cjs` et les scripts de `banane-data` jugent le lot (fautes à plus de 50 mm contre le budget de 3 %, acceptation, effet de la garde sur le cut suivant) et lisent `journalGestes` pour dire quel geste de vue marche.

## Ce qui n'est pas vérifié
- Le changement de partie dans le vrai ESV (le clic sur l'entrée « p=N » est une hypothèse).
- Le clic droit : la molette ne marche pas (45 coups sur 45 sans effet), le clic droit est l'hypothèse.
- La garde n'est validée sur aucun lot hors du lot de la partie 20.
