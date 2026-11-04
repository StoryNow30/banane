# CH-049-E — rapport : le temps n'est pas dans le chargement des points

Source : journal Orbite du 04/11 (collection `2026-11-04_v5_lot-orbite-parties-6-15-et-echo`, 4 932 captures, 4 671 changements de cut, 8 changements de partie réussis). Script : `chantiers/CH-049/mesure-points.cjs` (agrégats seulement). Écho (collection manuelle) : non exploité, hors objet de cette mesure.

## ÉTABLI (mesuré)
- **Une requête de points est rapide** : 7 593 fenêtres `ept-data`, médiane 107 ms par requête (P90 189 ms, P99 393 ms), ~295 Ko chacune, 5 échecs 502 sur 10 992 (0,05 %).
- **Le serveur n'est pas saturé** : parallélisme médian 1 par chargement (1,8 dans une fenêtre qui en contient plusieurs, max 3,6) ; ESV enchaîne ses requêtes plus qu'il ne les superpose. Un cut sur trois (1 293 / 4 671) ne demande aucun point (son cache).
- **Un chargement de points est court** : médiane 0,95 s après le changement de cut (P90 4,6 s, cuts à 10 requêtes ou plus).
- **Pendant une capture, des requêtes de points ne sont en vol que 9,6 % du temps** (borne haute : l'empan de chaque fenêtre est compté en entier). 90 % de la capture se passe sans aucune requête de points.
- **Où part le temps d'une capture** (médiane 1,68 s, deux rails) : attente avant la lecture du 1er rail 0,83 s, du 2e 0,72 s ; la lecture elle-même 5 et 2 ms. 46 % des attentes tombent sur la règle de repli « stabilité » (plancher 800 ms, observé ≥ 806 ms), dont 3 515 attentes où le compteur `numNodesLoading` d'ESV reste ≠ 0 alors que seulement 6 % de ce temps a une requête en vol. Quand le signal fonctionne, l'attente médiane est de 0,29 à 0,62 s.
- **Changement de partie (10,4 s en moyenne, 16,2 s au plus, 8 mesures)** : aucune requête de points pendant l'attente (une seule, au tout dernier instant, dans 3 cas sur 8), la liste de la partie répond en 47 à 457 ms. L'attente de 8 à 16 s n'est ni le chargement des points ni celui de la liste.

## PROBABLE
- Le temps de capture est dû à l'attente d'une stabilité du niveau de détail d'ESV (images, compteur, repli de 800 ms), pas au réseau. Le gain à chercher est dans la règle de fin de chargement (CH-049-A/C, `stabiliteMs`, compteur bloqué : 242 relevés), pas dans les points.

## SUPPOSÉ / non mesuré
- Où part l'attente de 8 à 16 s d'un changement de partie (rechargement de page d'ESV, rendu, attente propre d'Ariane : la tentative 2 du mode « suivant-dernier » figure dans le journal) : le journal ne le tranche pas. Il faudrait des jalons dans `file-parties-changement`.
- Si les réponses de points d'ESV sont mises en cache HTTP par le navigateur (en-têtes inconnus) : non relevé.

## Décision
Préchargement des points : **non conçu, non livré** (aucun patch `adapter-page.js`, aucun réglage `actif`). Il viserait au mieux ~10 % du temps de capture et 0 % de l'attente de changement de partie ; en plus, le choix des nœuds du cut suivant serait une déduction fragile. Conformément à la consigne, je m'arrête ici. Piste proposée à l'intégrateur : un ticket pour instrumenter les jalons d'un changement de partie, et examiner pourquoi le compteur d'ESV reste bloqué (46 % de replis).
