# CH-122 : réglages figés avant le jugement (13/11)

Poussés avant tout rejeu de jugement. Un réglage retouché après le jugement serait un nouveau réglage.

- **Patch** : `puce.patch` (`src/gcv2-l1.js` seul ; clés `puce:null`, `puceJeu:false` dans `LEVIERS_V4` ; coupées = code livré). Logique en fin de `deciderL1e` : candidats (paires d'hypothèses du nuage à un écartement plausible, au plus 40 par probabilité, paire de la test 13, sa correction, paire retenue par les règles livrées, 10 premières paires de la recherche recentrée), 45 traits (`PUCE_TRAITS`), probabilité d'être juste à 10 mm par le modèle figé, meilleur candidat validé si la probabilité atteint le seuil (et s'il est à δ au moins du départ : 8 mm en ADV, 2 en abords, 3 en PN), sinon rien.
- **Jeu d'apprentissage** : rejeu « jeu-livre » (code livré + `puceJeu`, décisions identiques au livré : 561 / 496 / 36 / 29 / 591, ÉTABLI), 847 cuts passés à la GCV2, 435 jugés, 12 821 candidats ; étiquette = candidat à 10 mm au plus de la pose finale (pire rail, 3D).
- **Modèle** : régression logistique L2 (`outils/apprendre.cjs`, `outils/puce-lib.cjs`), chaque cut pesant autant. Par pli, choisis par validation croisée INTERNE (un lot dehors parmi les lots d'apprentissage) : variante (distances en log ou non ; gardes de voie livrées sur les candidats ou non), λ (0,3 à 30) et seuil.
- **Validation croisée** : un modèle par lot réglable, appris sur les 5 autres (`modeles/A/puce-figeA-<lot>.json`, idem B) ; examen 0511 : appris sur les 6 réglables.
- **Deux critères de seuil, figés tous deux, jugés tous deux** (aucun choix après coup) :
  - **A** : le moins de fautes (10·(10–50) + 100·(> 50)) à différés au plus ceux du livré, sur les lots d'apprentissage ;
  - **B** : le plus de posés justes à fautes (10–50, > 50) au plus celles du livré, sur les lots d'apprentissage.
- **Prévision statique** (sans cascade, cuts de la GCV2 seulement, avant le rejeu) : `modeles/A/apprentissage-figeA.md`, `modeles/B/apprentissage-figeB.md`. Variantes essayées avant de figer, sur la même simulation hors pli (pour mémoire) : logistique simple critère coût du banc (presque tout différé), critères A et B, arbres boostés, log, gardes ; la sélection imbriquée a remplacé ce choix à la main.
- **Parité outil / module** : `outils/parite-modele.cjs` : 12 821 candidats, écart de probabilité 0, 0 cut au choix différent (ÉTABLI).
- **Jugement** : banc de CH-116, chaque lot rejoué avec le modèle de son pli (`BANC_LEVIERS={"puce":<modèle>}`).

## Réglage v2 B (figé le 13/11 après le jugement de A et B, avant le sien : nouveau réglage)
- **Patch** : `puce-v2.patch` (`src/gcv2-l1.js` et `tools/banc-differes.cjs`) ; clés coupées : `puce:null`, `puceJeu:false`, `puceChaine:false`.
- **Ce qui change contre v1** : (1) en ADV, la pose de la chaîne est contre-expertisée (levier banc existant `contreChaineZones:['adv']`) : elle devient un candidat de la puce (`chainePose`) parmi ceux de la GCV2 ; elle n'est gardée que si la puce la choisit et la valide (seuil propre `seuils.chaine`), sinon le cut passe à la GCV2 et la puce décide (`puceChaine`) ; une pose de la chaîne choisie est gardée même près du départ (δ ne vaut que pour la GCV2) ; (2) 13 traits ajoutés (contexte chaîne ; cellules du nuage appariées, grappes et concurrents des rails, écart du départ d'ESV à la référence, nombre de pistes) : 58 traits ; (3) seuil contraint sur les différés de TOUS les cuts passés à la puce (jugés ou non), leçon de A sur 0611.
- **Jeu** : rejeu « jeu2 » (livré + journal + contre-expertise sans effet) = livré, 561 / 496 / 36 / 29 / 591 (ÉTABLI) ; 2 015 cuts (dont 1 168 poses de la chaîne en ADV ; 169 jugées : livré 140 justes, bonne paire au pool 160).
- **Modèles** : `modeles/v2B/` (critère B, sélection imbriquée, un par pli). La même simulation en critère A différait trop (290 contre 176 sur les réglables) : non figée.
- **Prévision statique** (réglables) : 264 justes / 30 / 26 / 141 différés contre livré 223 / 34 / 28 / 176 (`modeles/v2B/apprentissage-v2B.md`).
- **Parité outil / module** : 39 520 candidats, écart 0, 0 choix différent (ÉTABLI).
- **Jugement** : `outils/juger-croise.sh v2B chantiers/CH-122/modeles/v2B chantiers/CH-122/puce-v2.patch '{"puceChaine":true,"contreChaineZones":["adv"]}'`.

## Réglage v3 B (figé le 13/11 après la garde d'octobre ROUGE du réglage B v1, avant tout jugement de v3)
- **Constat qui le motive** (ÉTABLI) : garde d'octobre du réglage B v1 (modèle appris sur les 6 réglables) : retour 1, nouvelles mauvaises voies sur reglage-9 (2-17 9556, 9557 ; 2-18 205, 206), 3:0 (794, 869, 870) et terrain du 23/10 (14) : la puce pose en ADV des cuts que le livré diffère, sans voie de voisins pour la soutenir.
- **Patch** : `puce-v3.patch` = v2 plus une **garde obligatoire, non apprise** dans `puceDecider` : un candidat que le livré ne pose pas (ni paire validée par les règles, ni pose de la chaîne) n'est posable que si la voie absolue des voisins validés existe à 6 cuts au plus, cohérente (résidu ≤ 40 mm), et le porte à 100 mm au plus en travers (valeurs de la garde livrée v6).
- **Modèles** : `modeles/v3B/` (un par pli, critère B, sélection imbriquée, garde obligatoire dans l'apprentissage) ; `modeles/v3complet/puce-v3c-complet.json` : appris sur les 7 lots de novembre, pour la garde d'octobre (hors apprentissage par construction) et un éventuel allumage.
- **Prévision statique** (réglables) : 232 justes / 33 / 21 / 175 différés contre livré 223 / 34 / 28 / 176.
- **Parité outil / module** : 39 520 candidats, écart 0, 0 choix différent (ÉTABLI).
- **Ordre des jugements** : garde d'octobre d'abord (modèle complet), puis banc de novembre en validation croisée.

## Réglage B' (figé le 13/11 sur demande de l'intégrateur, après l'autopsie des 4 mauvaises voies nouvelles de B, avant tout jugement de B')
- **Autopsie** (jeu livré, modèle B du pli 1111 ; ÉTABLI) : 11/11 p16 4506, 4507 (ADV), 5848, 5851 (abords) : le livré diffère, la bonne paire est absente du pool ; la puce choisit un candidat à 142–319 mm de la vérité, à 150–256 mm en travers de la droite des voisins validés (voisins à 3–5 cuts, résidu ≤ 1 mm) ; le trait `dvFit` a un poids POSITIF dans le modèle (appris sur des branches d'ADV où la bonne voie s'écarte des voisins) ; 5851 n'a pas de voie de voisins (posé par ricochet au rejeu de B).
- **Contrainte écrite avant de rejuger, modèle inchangé** : la garde obligatoire de v3 (candidat que le livré ne pose pas : voie absolue des voisins validés à 6 cuts au plus, résidu ≤ 40 mm, ≤ 100 mm en travers) ; elle refuse les 4 candidats.
- **Patch** : `puce-bprime.patch` = `puce.patch` + cette garde (`src/gcv2-l1.js` seul). **Modèles** : ceux de B (`modeles/B/`), inchangés. Parité outil / module : 12 821 candidats, 0 choix différent.
- **Ordre (R1, audit 1)** : garde d'octobre d'abord (modèle B de l'examen, appris sur les 6 réglables) ; rouge = écarté ; verte = validation croisée.
