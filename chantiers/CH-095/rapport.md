# CH-095 — Rapport : deux pannes de Potree dans la maquette

Aucun fichier de `src/` ni `background.js` modifié. Tout est mesuré dans Chromium sur la maquette (forme relevée d'ESV, modèle mémoire de Potree 1.8.2), code de page du tronc, réglage livré ; données synthétiques, aucun chiffre de terrain. Essais : `tests/esv-maquette/ch095-noeud-bloque.test.cjs`, `ch095-hierarchies.test.cjs` (séance `ch095-outils.cjs`) : 4 verts, 1 rouge marqué `todo`.

## Défaut du tronc (ROUGE, ÉTABLI en navigateur et en vm) : après un 502, le préchauffage ne repart jamais
- Mesuré : un 502 sur un de nos `load()` → opération `pause-serveur` (427 ms, 4 `load()`), puis, la pause de 10 s passée, **toutes** les opérations sortent en `reseau-occupe`, 0 `load()` (6 sur 6 au passage exploratoire). `actif` reste vrai, aucun `refus-serveur` : la panne de « Vision 9 » revient, muette.
- Chemin exact : le 502 est vu par l'observateur de ressources quelques millisecondes après le `load()` (`ressources()` → `refuser()`, `src/prechauffage.js:405-408` → `annuler('pause-serveur')`), donc avant `delaiMs` (5 s). Or `bloquer(n)` n'est appelé que dans `relever()` (`:499`) et `releverLoin()` (`:564`), passé `delaiMs` ; l'opération annulée fait un dernier `relever()` (`:542`) trop tôt. Le nœud reste dans `volNous` ; `nosEnVol()` (`:417`) le compte pour la vie de la page ; avec la ligne de base (livrée) le compteur effectif vaut 0 et `reseauLibre()` (`:424`) est faux pour toujours (`:716`).
- La correction de CH-092 ne couvre que l'échec vu par le délai : son essai vm ne passe pas de 502 à `ressources()`. Le même arbre vm avec ce 502 donne `reseau-occupe` trois fois sur trois.
- Témoin, ligne de base coupée : le préchauffage repart (27 et 25 `load()`), une place sur quatre prise par le nœud bloqué.
- Piste (non appliquée) : sortir de `volNous` vers `bloques` tout nœud encore `loading` d'une opération qui finit sur un refus, ou dont la clé vient d'être vue en échec.

## Ce que la maquette reproduit maintenant (éteint par défaut)
1. **Nœud en échec** (`eptEchec {http, fois, cles}`) : une requête refusée ; nœud gardé `loading`, compteur brut à 1 au repos, jamais redemandé (1 requête au serveur) ; le reste de la boîte s'affiche. VERT : la capture des coupes suivantes reste à la règle « signal » (la ligne de base retire l'échec) ; témoin sans ligne de base : repli « stabilité », 2 007 ms contre 717 ms.
2. **Plus de 8 pages de hiérarchie non lues** (`eptPas=1` ou `2`) : Potree seul en lit 18 (une page par nœud) et 10 (deux niveaux) à l'arrivée. VERT : l'opération proche finit avant le changement de coupe (non annulée, 8 pages par cible, 16 pour deux cibles), la deuxième cible est servie (7 → 19 nœuds connus), le passage suivant aussi ; opération lointaine : 8 pages, 24 nœuds chargés, motif `arrivee`.
- Deux écarts de la maquette corrigés, en mode mémoire seulement : un nœud en échec empêchait tout affichage du cut ; le compteur était remis à zéro à chaque changement de coupe.

## Ce que la maquette ne peut pas reproduire
- Le comportement réel de Potree sur un 5xx : repris de la description de CH-062, **non relu dans le code de Potree** (absent du dépôt) ni mesuré ici. Si Potree rend le compteur ou redemande le nœud, la panne 1 est fausse.
- Le trou dans la capture : les points lus par Ariane viennent du corpus, pas de l'arbre EPT ; un nœud bloqué ne retire aucun point.
- Les durées (latence 60 ms, décodage 40 ms factices), le parcours de l'arbre sur le fil d'ESV, une panne de page de hiérarchie (5xx sur `ept-hierarchy`), un `load()` qui ne répond jamais.

## À relever sur le terrain
- Au prochain 502 : `prechauffage` passe-t-il de `pause-serveur` à `reseau-occupe` jusqu'à la fin du lot (le défaut ci-dessus) ? Compteur brut et `lb` après l'échec.
- Nombre de pages de hiérarchie lues par boîte (PROBABLE qu'il dépasse 8 hors page racine unique ; relevé du 09/11 : une seule page).
- Vu en passant, PROBABLE pour ESV : `trouEchec` (`src/adapter-page.js:256-268`) cherche le nœud par `filename()` ou `key.name()`, absents de la forme commune relevée : `touche:null, trouves:0` dans la maquette.

## Maquette complète (`tests/esv-maquette/essais.cjs`)
- 95 essais : 90 verts, 3 sautés, 1 `todo` (le défaut ci-dessus), **1 rouge qui ne vient pas de ce chantier** : `ch088-loin.test.cjs` (« grand saut »), rouge aussi sur le tronc sans mes fichiers (rejoué : « chargés à l'arrivée : 45 contre 56 »). Sans opération lointaine, l'opération proche charge déjà les 56 nœuds de la boîte d'arrivée ; l'essai attend l'inverse. PROBABLE : depuis le passage à 4 chargements à la fois (CH-090). Non corrigé ici.
