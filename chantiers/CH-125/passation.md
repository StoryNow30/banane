# CH-125 : passation (14/11, fin de session)

Branche `chantier/CH-125`, tronc fusionné jusqu'à `a756988`. Aucun fichier du tronc changé : tout est en patchs éteints dans ce dossier. **Aucun réglage n'a passé la garde d'octobre ; la cible du ticket (≥ 96 % en validation croisée) n'est pas atteinte, et aucun pli de novembre n'a été rejoué avec une variante (R1).**

## 1. Ce qui est établi (mesuré)
- **Mesure d'abord** (`mesure.md`, `sorties/`) : rejeu du livré identique à CH-116 (561 posés jugés, 496 / 36 / 29). Les 35 posés de 10 à 50 mm des lots réglables : 14 « hauteur d'un rail refusé posé brut », 9 environ « travers d'une pose de la GCV2 », 12 « autre élément ». Plusieurs coupes : 415 des 464 rails à moins de 6 points de flanc en ont 6 avec les points déjà chargés hors de la découpe ; les coupes voisines n'en ajoutent que 11.
- **Cause du travers** : un rail que la décision L1-e ramène à l'écartement de la LISTE est à 7,7 mm (médiane) de la pose de l'opérateur ; le flanc relu à cette pose en est à 1,8 mm.
- **Hauteur à la source** (`mesure-source.patch`, médiane du dessus + c pour un rail refusé en hauteur, dans `calibrate`, donc à ses cinq appels) : garde à l'éteint verte (retour 0), garde du réglage ROUGE (`sorties/garde-niveau1.md`). La mesure est bonne sur les poses de la chaîne jugées (24 rapprochées de la vérité d'octobre, 6 éloignées, 8 passent sous 10 mm, 1 juste passe à 10,8 mm : 2-20-fd7067f7 275). C'est sa propagation (cellules de la GCV2, appuis de la chaîne) qui change des décisions : 5 états au profil de base, 11 au profil L1-se, une mauvaise voie nouvelle à 216 mm. **À la source, la mesure propage par construction ; aj5 de CH-121 fait le même gain sans rien propager.**
- **Travers, statique, novembre** (`sorties/travers-gcv2-novembre.md`) : flanc relu à la pose de la paire validée, suivi dès 5 mm d'écart : 118 cuts GCV2 jugés, 19 déplacés, 18 rapprochés, 0 éloigné, 8 passent sous 10 mm.
- **Travers, garde d'octobre** (`sorties/garde-travers.md`) : ROUGE. 51 cuts touchés, 48 jugés : 35 rapprochés, 5 éloignés, 6 gagnés, **2 justes perdus** (0-2310-lot1 4 et 193) ; les trois cuts dégradés par le latéral de CH-121 le sont aussi (2-17 9803, 2-20-fd7067f7 288, 0-2310-lot1 4). 3 justes perdus de plus par ricochet (voisins). Les fautes sont des poses justes où une autre face dense est à 5 à 13 mm : aucun critère local essayé ne les sépare des vraies corrections (ni le seuil, ni le flanc propre, ni la restriction au rail corrigé, ni une borne sur l'écartement de la liste).

## 2. Ce qui est figé (et son sort)
| fichier | contenu | sort |
|---|---|---|
| `cible.md` | cible et critères, points 1 à 13 | à jour |
| `reglages/niveau1.json`, `mesure-source.patch` | hauteur à la source, c par pli (5,1 ; 5,2 ; 4,2), final 5,1 | écarté (garde rouge) |
| `reglages/travers.json`, `flanc-source.patch` | flanc de la paire validée, seuil par pli (5 ; 3 pour le pli sans le 12/11), borne 20 mm, propagation « A » | écarté (garde rouge) |
| `flanc-source-b.patch` | même mesure, mode `ecrite` : la décision garde sa paire, le banc écrit la paire mesurée, voisins et transport inchangés | NON figé, aucun rejeu allumé ; éteint = livré sur le 08/11b (225 lignes) |
Essais : `tests/ch125-mesure-source.test.cjs` (6), `tests/ch125-flanc-source.test.cjs` (4), rouges avant le code, verts avec les voisins (40 sur 40).

## 3. Ce qui n'a pas été fait
- Validation croisée de novembre et examen 05/11 : aucun réglage n'y avait droit. Le 05/11 n'a été ni extrait ni lu ; les examens vierges réservés non plus.
- Éteint = livré sur les 4 016 cuts du banc pour les patchs du travers (fait : garde d'octobre à l'éteint pour `mesure-source.patch`, 08/11b pour `flanc-source-b.patch`).
- Parité du service worker ; patch du service worker pour le mode `ecrite` (endroit : `background.js`, là où `G.commander({positions:g.positions…})` suit `G.deciderDiffere`, et dans la passe).
- Mesure de la distance à l'axe de CH-124 sur les cuts touchés.

## 4. Pistes (SUPPOSÉ, à juger sur des lots neufs : octobre est « vu » pour le travers)
1. **Garde par l'axe de CH-124** : mesurer, sur les 51 cuts touchés d'octobre (`sorties/garde-travers-par-cut.csv`), si la distance du milieu de la paire à l'axe sépare les 4 fautes des 35 corrections. C'est la seule preuve indépendante du nuage local qui reste.
2. **Rail corrigé seulement, mode `ecrite`** : a posteriori en octobre, 29 cuts, 22 rapprochés, 2 éloignés, mais 1 juste perdu (193). Insuffisant seul ; à combiner avec 1.
3. **Hauteur** : rien de plus à la source ; suivre aj5. Le cut 2-20-fd7067f7 275 (0,3 → 10,8 mm) est à regarder dans ses « verts changés ».

## 5. Refaire l'environnement (rien n'est gardé d'une session à l'autre ; tout est hors dépôt)
```
# données : clone partiel de banane-data (branche claude/execute-prompt-00-18ra5a), collections de novembre du corpus de CH-116 et collections
# d'octobre nommées dans datasets/garde-gcv2/base-test18.json. NE PAS extraire : Échos du 12/11 p3 et p4, lot du 12/11 au soir p6 à 18,
# Écho du 13/11, ni outils/analyse-lots/CH-116/examen-vierge-*-RESERVE.
# banc de CH-116 : captures réduites et corpus, voir chantiers/CH-116/outils/LISEZMOI.md (CH116_TRAVAIL)
python3 -I chantiers/CH-125/outils/ranger-oct.py CLONE_BANANE_DATA $BANANE_LOTS          # lots d'octobre de la garde
# cache de rails pour les outils statiques (lots réglables seulement)
node chantiers/CH-125/outils/extraire-rails.cjs        # options en tête du fichier ; sortie hors dépôt
```
## 6. Commandes exactes des jugements faits
```
export CH116_TRAVAIL=…  BANANE_LOTS=…
# garde à l'éteint (référence d'octobre, doit rendre 0) puis garde d'un réglage ; une commande à la fois, --jobs 2 ; environ 25 min chacune
node chantiers/CH-116/outils/banc.cjs garde --nom ch125-eteint  --patch chantiers/CH-125/mesure-source.patch --jobs 2
node chantiers/CH-116/outils/banc.cjs garde --nom ch125-n1      --patch chantiers/CH-125/mesure-source.patch --env 'BANC_CONVENTION_SOURCE={"cMm":5.1,"epMaxMm":15,"dzMaxMm":13}' --jobs 2
node chantiers/CH-116/outils/banc.cjs garde --nom ch125-travers --patch chantiers/CH-125/flanc-source.patch  --env 'BANC_LEVIERS={"flancSource":{"seuilMm":5,"maxMm":20}}' --jobs 2
# mode « pose écrite » (jamais rejoué allumé) : --patch chantiers/CH-125/flanc-source-b.patch --env 'BANC_LEVIERS={"flancSource":{"seuilMm":5,"maxMm":20,"ecrite":true}}'
# jugement contre la vérité d'octobre (R6) : poses de la chaîne, puis toutes les poses L1-se (touché ou ricochet, cuts nommés)
node chantiers/CH-125/outils/oct-chaine.cjs --a $CH116_TRAVAIL/garde/ch125-eteint --b $CH116_TRAVAIL/garde/ch125-n1
node chantiers/CH-125/outils/oct-poses.cjs  --a $CH116_TRAVAIL/garde/ch125-eteint --b $CH116_TRAVAIL/garde/ch125-travers --nommes "2-17 9803,2-20-fd7067f7 288,0-2310-lot1 4"
# statique de novembre : constante c et seuil par pli
node chantiers/CH-125/outils/c-par-pli.cjs     --rails RAILS --gabarit G.json --octobre RAILS_1410
node chantiers/CH-125/outils/travers-gcv2.cjs  --rails RAILS --gabarit G.json --rejeu $CH116_TRAVAIL/rejeux/livre
# plis (si un réglage passe un jour la garde) : BANC_ZONES=journal, référence « livré » rejouée avec le même réglage
node chantiers/CH-116/outils/banc.cjs rejouer --nom livre-zj --env BANC_ZONES=journal --jobs 2
```
