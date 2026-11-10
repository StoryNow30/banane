# CH-093 — Rapport : le préchauffage anticipe le passage à la relecture

Branche `chantier/CH-093`, partie du tronc (40df88a). Étude envoyée à l'intégrateur, plan accepté ; le code a suivi (D-312).

## Étude (lecture du code, ÉTABLI)
- **D'où vient la liste** : `relectureEntree(b)` (cuts du lot, zones PN et ADV du journal, liste « À contrôler », écartement) puis `BananeRelectureOmbre.selection` ; `sel.cuts` est trié par coupe croissante : la première coupe relue est en général loin derrière la fin du lot.
- **Quand elle est connue** : à la clôture du lot seulement, dans le service worker. `departMs` vaut 0. Sans passe des différés en écriture, la relecture calcule sa sélection puis part aussitôt : l'avance possible est la fin de sa préparation. Avec la passe en écriture, la relecture attend la passe : l'avance est toute la passe.
- **Qui la donne** : le service worker. Aucune capture du lot ne peut la porter (commandes du lot identiques à l'octet). Il faut donc une commande neuve, hors capture, et le relais existant des captures de la passe.

## Ce qui est livré
- **Page** (`src/prechauffage.js`) : `anticiper()` met la première coupe relue dans l'opération lointaine de CH-088, source `changement-mode`. Mêmes plafonds (32 nœuds par cible, 2 load() à nous, budget du lot), aucun lancement pendant une capture ni quand Potree charge, règle de pause de CH-089, fin à l'arrivée (`prechauffage-loin`). Un indice de la passe marqué `loin.mode` fait de même, y compris sur la dernière capture de la passe (indice sans `cut`).
- **Service worker** (`background.js`) : sélection provisoire à la clôture du lot si la passe écrit ; `loin` des captures de la passe étendu à la première coupe relue ; envoi de la vraie première coupe dès que la relecture a sa sélection (lancement automatique ou à la main). Journal `relecture-anticipee`, seulement quand la commande part (le journal d'un lot sans la commande reste celui d'avant). Une ligne change dans `relectureLancer` (les options de sélection passent par une fonction commune, même expression) et une dans la boucle de la passe (l'indice seulement).
- **Pont** : `prechauffer` dans la liste du pont. **Patch** `chantiers/CH-093/adapter-page.patch` (à appliquer par l'intégrateur) : commande `prechauffer`, en lecture seule, et capacité annoncée au ping. Sans le patch, le service worker n'envoie rien (un ou deux pings de plus par lot) ; seul le relais de la passe joue.
- **Réglage pour couper** : `lot.chargement.prechauffer.relecture = {actif:true, sautMin:11}` ; éteint dans le module, allumé dans `src/settings.js`. Éteint : pas même un ping.
- **Garde** `tests/pose-lot-inchanges-4959.test.cjs` : retrait `sansCH093` (pont et patch), verte sur le tronc et avec le patch appliqué à une copie. `tools/bilan-lot.cjs` : ligne « Passage à la relecture ».
- Essais : `tests/ch093-anticipation`, `ch093-relais`, `ch093-adaptateur` (lecture seule prouvée : aucune touche, aucun clic, coupe et rails inchangés), `tests/esv-maquette/ch093-relecture`.

## Mesure en maquette (`tools/ch093-banc.cjs`, `banc.json`, ÉTABLI sur la maquette)
10 répétitions alternées, 4 cœurs, charge au départ 0,55, latence 60 ms, décompression 40 ms. Fin du lot au cut 350, première coupe relue au cut 225 ; sa boîte compte 62 nœuds. Les 10 répétitions donnent le même nombre de nœuds.

| Cas | Avance réelle | Chargés à l'arrivée, avant | après | Points affichés, avant | après |
|---|---|---|---|---|---|
| Sans passe, 0,3 s de préparation | 0,31 s | 9 sur 62 (14,5 %) | 13 sur 62 (21,0 %) | 1 676 ms | 986 ms |
| Sans passe, 1 s de préparation | 1,01 s | 9 (14,5 %) | 25 (40,3 %) | 1 669 ms | 1 131 ms |
| Passe de 3 cuts | 8,6 s | 9 (14,5 %) | 41 (66,1 %) | 1 638 ms | 834 ms |

Avec la passe, les 32 load() du plafond sont lancés et chargés. Aucun refus du serveur, aucun nœud libéré.

## Limites et points non résolus
- **La durée de préparation de la relecture sur le terrain n'est pas mesurée** : les valeurs 0,3 s et 1 s sont choisies. Dans le service worker, l'envoi part quand la sélection est connue, juste avant le départ : l'avance réelle sans passe est SUPPOSÉE courte, donc le gain aussi. Le cas utile est celui de la passe en écriture.
- Le temps d'affichage à 1 s d'avance (1 131 ms) est plus long qu'à 0,3 s (986 ms) malgré plus de nœuds chargés : non expliqué.
- Géométrie synthétique, boîte jamais chargée : le gain sur ESV reste SUPPOSÉ. Sur ESV les nœuds de la première coupe relue ont déjà été chargés pendant le lot ; s'ils sont encore en mémoire, il n'y a rien à gagner.
- Non fait : anticiper avant la clôture du lot (sélection provisoire pendant la dernière coupe) ; cela touche le déroulé du lot et demande l'avis de l'intégrateur. Rien en voie fetch. Rien si la première coupe relue est à moins de 11 coupes. Après un redémarrage du service worker pendant la passe, la première coupe relue n'est plus jointe.
- Vu en passant, non corrigé : `OBS_PRECH_MOTIFS_LOIN` de `background.js` n'a pas `pause-serveur`, que l'observateur garde (CH-089) : le motif arrive `null` au journal.
