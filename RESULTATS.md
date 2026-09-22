# Résultats — Banane V4 TEST 4.7.0

## Résultats 4.7.0

```
550 tests · 548 réussis · 0 échec · 2 ignorés
Node v22.22.2 · checkpoint 6ead46f
```

Les 2 ignorés sont les deux essais qui exigent le corpus Natif privé, absent du
clone ; ils s'ignorent en énonçant leur motif. **Un test ignoré n'est pas un
test réussi.**

Placement, transformations de coordonnées et lecteur LiDAR partagé inchangés
depuis 4.4.0 (SHA-256). `src/engine.js` conforme à la baseline déclarée V4.6.0.

Paquet installable reproductible bit à bit depuis `git archive 6ead46f` :
**595 704 octets**, **95 entrées**, toutes identiques octet pour octet aux blobs
Git du checkpoint, `manifest.json` une seule fois à la racine, aucun dossier
parent.

Ce qui est démontré par ces essais : le moteur, le protocole de report, le garde
d'écartement, l'export et la reprise, contre une doublure ESV. Ce qui ne l'est
pas : les effets réels dans Edge. L'équivalence `Maj+Z` est établie par
inspection du JavaScript ESV chargé, pas par ces tests.

Preuve terrain distincte : le garde d'écartement s'est déclenché en Edge réel
sur le lot du 21 septembre, les cuts rejetés recevant 0 apply, 0 `VALIDATE`,
0 `SKIP`, puis une navigation sans décision. Petit échantillon, pas une preuve
de généralisation.

## Historique V4.4 — conservé comme preuve

Les sections ci-dessous décrivent l'état de leur époque. Elles ne décrivent pas
la 4.7.0.

La V4.4.2 enregistre et acquitte des instantanés qualifiés par rail avant l'intention opérateur, indépendamment du résumé de capture tardif ; une contradiction explicite les révoque. **Dans ESV, le bouton flottant est resté visible malgré une fenêtre ouverte : le masquage V4.4.2 a échoué sur le terrain.** La V4.4.3 suit les fenêtres et pages ouvertes, retire physiquement le bouton et empêche une réponse de statut tardive de le réafficher. Cette correction est vérifiée localement, pas encore dans Edge. Ni placement, ni pilote, ni lecteur LiDAR partagé ne changent : leurs empreintes SHA-256 restent figées.

## Vérifications réellement exécutées

Exécution finale : 2026-09-13T18:34:08.559Z. Node v24.19.0, plateforme linux.

| Contrôle | Résultat |
|---|---|
| Tests Node | 188/188 réussis ; 0 échoué, 0 ignoré, 0 annulé |
| Syntaxe des scripts exécutables | 24 fichiers contrôlés |
| Observation passive simulée | 0 blocage, 0 réémission, 0 commande native Banane |
| Sauvegarde progressive | Chunks par rail et visite récupérés après redémarrage simulé |
| Corpus hors ligne conservé | 110 cuts, 1 314 278 points |
| Edge et ESV réels | Non exécutés |

## Retour terrain et correctif d'interface

Mic a fourni une capture montrant « Banane V4 · ouvrir » encore visible après ouverture d'une fenêtre. L'essai V4.4.2 invalide le masquage annoncé par nos tests précédents ; la cause technique exacte dans son navigateur reste à déterminer. Des tests V4.4.3 contrôlent la fenêtre suivie malgré un filtre URL d'extension vide, deux fenêtres ouvertes, une réponse tardive, l'absence physique du bouton dans le DOM et la reconnexion d'une page après interruption du service worker. Seul un nouvel essai dans Edge confirmera le résultat.

## Audit reproductible du JSON réel V4.4.1

L'export banane-native-v4-1789294517253(1).json (SHA-256 86700e4d29ff0406614c901aae6ed52b1b3a1f2d3dbb59b724f69b16884d33f6) contient 76 visites, 2283 événements, 226 captures et 316 portions, soit 539 309 points exportés : 195 781 gauche et 343 528 droite. Parmi eux, 297 185 sont visibles dans le clipping déclaré et 242 124 hors zone visible. Les terminaisons sont 148 VIEW_CHANGED, 38 TARGET_CHANGED, 35 RAIL_STATE_CHANGED, 4 RESOURCE_LIMIT et 1 NONE.

Le format 4.4.1 ne prouve pas la sauvegarde d'un instantané utilisable **avant** l'intention : 0 rail comparable. Le filtre exploratoire « visible et pose initiale » trouve 23 rails-visites sur 4 visites à deux rails ; leurs captures finissent toutes interrompues. Ces nombres ne sont **pas** des références promues, ni une mesure de précision. Les anciens fichiers restent en lecture seule. Recalcul : node tools/audit-native-v441.cjs --input /chemin/export.json --output audit/nouveau-resultat.json.

## Cause reproduite sur trois exports Natif V4.4

Les 426 visites et 115 captures auditées annoncent des dizaines de millions de points en buffers ; le parcours séquentiel sous contrainte de temps n'en a conservé et exporté que **4**. Le rapport audit/native-geometry-loss-v4.4.0.md sépare les points présents, lus, transformés, retenus, sauvegardés et exportés et montre la priorité insuffisante donnée aux zones utiles. Un nouveau lecteur Natif priorise ces zones, enregistre par portions et qualifie séparément chaque rail. Aucune session post-correctif n'est encore disponible pour confirmer l'efficacité terrain.

## Fluidité hors ESV

Sur 1 000 événements cadencés, le p95 du gestionnaire est de 1,26 ms, son maximum de 2,99 ms, la file atteint 10 et aucune entrée n'est perdue. Une rafale artificielle de 5 000 événements remplit la file de test à 256, abandonne explicitement 4 744 observations et passe à `METADATA_ONLY`. Cette mesure Node ne prouve pas la fluidité du rendu Edge/Potree.

## Rejeu des 110 corrections humaines conservé

| Mesure | Gauche | Droite |
|---|---:|---:|
| Erreur latérale médiane / p90 / max | 1,77 / 4,00 / 100,74 mm | 1,40 / 4,00 / 66,35 mm |
| Erreur verticale médiane / p90 / max | 4,02 / 7,86 / 13,00 mm | 4,00 / 7,35 / 12,00 mm |
| Erreur euclidienne médiane / p90 / max | 4,63 / 8,77 / 100,96 mm | 4,64 / 7,79 / 67,12 mm |

68 cuts sur 110 reçoivent deux propositions comparables ; 47 rails restent non résolus. Aucune amélioration de précision n'est revendiquée.

## Rejeu des anciens exports Natif

Le banc Natif qualifie 0 rail gauche, 0 rail droit et 0 paire sur 76 visites V4.4.1 anciennes. Il ne produit aucune preuve visuelle réelle ni score de précision : ces exports documentent le défaut antérieur. Les tests synthétiques vérifient que le moteur reçoit les points réellement visibles et l'état initial **sans** la référence humaine finale.

## Limites

Le statut vert/rouge, le projet, la geominfo brute, l'ordre spatial, l'écartement frais et la confirmation serveur n'ont pas de source ESV vérifiée. Ils restent absents ou `not-observed`. Les matrices sont cohérentes numériquement mais les unités ne sont pas calibrées indépendamment. Le test terrain V4.4.3, les superpositions visuelles sur de nouveaux exemples et la comparaison de fluidité avec/sans Natif sont obligatoires avant toute conclusion d'usage. Voir `NATIVE_GEOMETRY_ACCEPTANCE.md` et `TEST_REPORT.md`.
