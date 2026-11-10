# CH-095 — Rapport : deux pannes de Potree dans la maquette

Aucun fichier de `src/` ni `background.js` modifié. Tout est mesuré dans Chromium sur la maquette (forme relevée d'ESV, modèle mémoire de Potree 1.8.2), code de page du tronc, réglage livré ; données synthétiques, aucun chiffre de terrain. Essais : `tests/esv-maquette/ch095-noeud-bloque.test.cjs`, `ch095-hierarchies.test.cjs` (séance `ch095-outils.cjs`) : 5 verts, 1 rouge marqué `todo` (défaut 2).

## Défaut 1 (trouvé ici, CORRIGÉ sur le tronc par 278c957, VERT rejoué) : après un 502, le préchauffage ne repartait jamais
- Mesuré avant la correction : un 502 sur un de nos `load()` → opération `pause-serveur` (427 ms, 4 `load()`), puis, la pause de 10 s passée, toutes les opérations en `reseau-occupe`, 0 `load()` (6 sur 6), `actif` vrai, aucun `refus-serveur`.
- Chemin : le 502 est vu par l'observateur de ressources quelques millisecondes après le `load()` (`ressources()` → `refuser()` → `annuler('pause-serveur')`), avant `delaiMs` ; `bloquer(n)` n'était appelé que passé `delaiMs` ; le nœud restait dans `volNous` et `reseauLibre()` était faux pour toujours avec la ligne de base.
- Après fusion du tronc corrigé dans la branche : VERT, 3 passages sur 3 ; après la pause, 25, 25 et 26 `load()` par opération (motif `coupe` : coupées par le changement de coupe).

## Défaut 2 (ROUGE sur le tronc 278c957, ÉTABLI en navigateur, essai `todo`) : ligne de base coupée, le préchauffage ne charge plus après un 502
- Mesuré, réglage `lot.signalEteint.ligneDeBaseEchecs:false` (non livré) : après la pause, chaque opération lance 3 `load()` puis s'arrête en `chargement`, 0 chargé (9 opérations sur 9, 3 passages). Avant 278c957 ce cas repartait (27 et 25 `load()`).
- Chemin exact : `src/prechauffage.js:756`, `n > Math.max(memEnVol(c), nosEnVol())` → `annuler('chargement')`. Sans ligne de base le compteur brut garde le +1 du nœud en échec ; depuis 278c957 ce nœud n'est plus dans `volNous` ; dès que 3 des nôtres volent, 4 > 3 : « Potree repart ». `reseauLibre()` tolère les nœuds bloqués, pas cette ligne.
- Portée : réglage livré non touché tant que la ligne de base retire l'échec. Touché aussi, SUPPOSÉ (non reproduit), quand la ligne de base retombe au compteur brut (motifs `absent`, `sous`, échec non vu par l'observateur).

## Ce que la maquette reproduit maintenant (éteint par défaut)
1. **Nœud en échec** (`eptEchec {http, fois, cles}`) : une requête refusée ; nœud gardé `loading`, compteur brut à 1 au repos, jamais redemandé (1 requête au serveur) ; le reste de la boîte s'affiche. VERT : la capture des coupes suivantes reste à la règle « signal » (la ligne de base retire l'échec) ; témoin sans ligne de base : repli « stabilité », environ 2,0 à 2,1 s contre 0,7 à 0,9 s.
2. **Plus de 8 pages de hiérarchie non lues** (`eptPas=1` ou `2`) : Potree seul en lit 18 (une page par nœud) et 10 (deux niveaux) à l'arrivée. VERT : l'opération proche finit avant le changement de coupe (non annulée, 8 pages par cible, 16 pour deux cibles), la deuxième cible est servie (7 → 19 nœuds connus), le passage suivant aussi ; opération lointaine : 8 pages, 24 nœuds chargés, motif `arrivee`.
- Deux écarts de la maquette corrigés, en mode mémoire seulement : un nœud en échec empêchait tout affichage du cut ; le compteur était remis à zéro à chaque changement de coupe.

## Ce que la maquette ne peut pas reproduire
- Le comportement réel de Potree sur un 5xx : repris de la description de CH-062, **non relu dans le code de Potree** (absent du dépôt) ni mesuré ici. Si Potree rend le compteur ou redemande le nœud, la panne 1 est fausse.
- Le trou dans la capture : les points lus par Ariane viennent du corpus, pas de l'arbre EPT ; un nœud bloqué ne retire aucun point.
- Les durées (latence 60 ms, décodage 40 ms factices), le parcours de l'arbre sur le fil d'ESV, une panne de page de hiérarchie (5xx sur `ept-hierarchy`), un `load()` qui ne répond jamais.

## À relever sur le terrain
- Au prochain 502 : après `pause-serveur`, les opérations suivantes chargent-elles (ni `reseau-occupe` ni `chargement` répétés) ? Compteur brut et `lb` après l'échec.
- Nombre de pages de hiérarchie lues par boîte (PROBABLE qu'il dépasse 8 hors page racine unique ; relevé du 09/11 : une seule page).
- Vu en passant, PROBABLE pour ESV : `trouEchec` (`src/adapter-page.js:256-268`) cherche le nœud par `filename()` ou `key.name()`, absents de la forme commune relevée : `touche:null, trouves:0` dans la maquette.

## Maquette complète (`tests/esv-maquette/essais.cjs`), tronc 278c957 fusionné
- 96 essais : 92 verts, 3 sautés, 1 `todo` (défaut 2), 0 rouge. `ch088-loin.test.cjs`, rouge avant 278c957 (« chargés à l'arrivée : 45 contre 56 », aussi sans mes fichiers), est vert depuis.
