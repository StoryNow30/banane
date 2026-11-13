# CH-119 : passation (13/11, arrêt pour relance sur ordre de l'opérateur)

## État exact
- Cible écrite avant tout rejeu : `cible.md` (29 → ≤ 10 mauvaises voies en validation croisée). Rapport partiel : `rapport.md` (§ 1 borne, § 3 jugement et garde de D, § 4 verdict).
- Patchs éteints : `voie-globale.patch` (`src/gcv2-l1.js` : `voieGlobale`, `vgDp`, clé `voieGlobale:null` dans LEVIERS_V4, option `passeMax` ; `tools/banc-differes.cjs` ; essais `ch119-voie-globale.test.cjs`, `gcv2-l1-cap5.test.cjs`) et `sw-voie-globale.patch` (`background.js`, essai VM). Éteint = livré : 4 016 / 4 016 cuts (mesuré avant l'ajout de `passeMax`, qui ne touche que le chemin allumé).
- Outils : `outils/` (zones, borne-pool, residus, proto, viterbi, explore*, banc-pool.patch). Sorties : `sorties/` (borne, résidus, validation croisée, changements, gardes).

## Réglages figés et verdict
- Grille A-D (`grille.json`), validation croisée un lot dehors : D retenu. Somme des 6 lots tenus à l'écart : > 50 mm 29 → 16, bons bloqués 4 → 11, 0 nouvelle, aucun juste > 10 mm ; examen 0511 identique.
- **D (`reglage-fige.json`) : ÉCARTÉ** : garde d'octobre rouge, 13 reculs, dont 7 verts changés (probables nouvelles mauvaises voies). Patch éteint : garde verte (retour 0).
- **E (`reglage-E.json`) = D + `passeMax` 5**, figé avant tout rejeu. Seuil tiré de D : refus utiles de novembre à passe ≤ 4,7, reculs d'octobre à 5,8-8. Octobre est donc VU pour E.
  - Rejeu complet de E fini (24 lots, tous vus) : > 50 mm 29 → 14, bons bloqués 4 → 11 (`juger --nom vgE --ref pool`).
  - **Pas encore fait** pour E : validation croisée par plis (`croise --noms vgD,vgE` ou E seul contre « pool ») et garde d'octobre. La garde de E a été tuée par le redémarrage : 10 lots sur 12 rejoués (manquent 0-2310-lot1 et lot2), à relancer en entier.

## Ce qui tournait et n'a pas fini
- Garde de E (relancer : `copie.sh garde-E '<voieGlobale de reglage-E.json>'`, puis depuis la copie `BANANE_LOTS=… node tools/garde-gcv2.cjs --base datasets/garde-gcv2/base-test18.json --rejouer --lots tous --sortie …`). Environ 45 min.
- Parité banc / SW, passe comprise :
  - 06/11 p15, réglage D : 161 / 161 identiques.
  - 08/11 p6 lot 2 : ÉTEINT déjà 27 lignes différentes sur 150, D 19 sur 150 (passe 11 contre 12). L'écart existe sans le levier : divergence banc / SW de ce lot à comprendre avant de juger une parité dessus (SUPPOSÉ : étages gcv2 « consensus », « recherche-adv »). Sorties dans `CH116_TRAVAIL/parite-*.jsonl`.

## Prochaine étape
1. Plis de E, puis garde complète de E. Si la garde est verte, parité de E sur 06/11 p15 et 12/11 p23.
2. Rapport final : E reste PROBABLE ; seul l'examen vierge (12/11 p3-p4, réservé, jamais lu ici) le juge.
3. Piste, à figer comme nouveau réglage : 23/3747 et 16/4508. Après un refus, la GCV2 rechoisit H1+H2 sur la mauvaise voie, alors que la bonne paire est dans le pool effectif. Choisir dans le pool effectif la paire qui prolonge le chemin, sur les cuts refusés seulement.

## Pièges
- Données hors dépôt, à refaire (disque limité, environ 16 Go libres au pic) :
  - `CH116_TRAVAIL=/home/user/ch116` (captures réduites 3,1 Go) : `extraire.sh` + `preparer.cjs`, lot par lot.
  - Lots d'octobre de la garde dans `/home/user/banane-lots` (4,8 Go), extraits des zips des collections nommées dans `base-test18.json`. Ils sont dans des sous-dossiers, pas `raw/`.
  - Corpus : `banane-data/outils/analyse-lots/CH-116/sorties/corpus.jsonl`.
- Durées : rejeu complet environ 21 min à 2 tâches, sur 4 cœurs. Les parties 16 (06/11, 11/11) font à elles seules 8-14 min. Ne pas dépasser 4 processus.
- `croise --ref` plante (la référence doit être dans `--noms`) : juger la référence à part.
- Le rejeu « pool » (`CH119_POOL=1`) porte la géométrie de départ de chaque cut, dont se servent `zones.cjs` et les outils de diagnostic.
- Le « pool » de mes premières mesures = H0-H6 seul (5/29) ; le pool effectif (avec la recherche recentrée, outil de CH-120 sur mes captures) = 14/30.
