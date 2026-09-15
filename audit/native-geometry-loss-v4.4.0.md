# Audit de la perte géométrique du Mode Natif V4.4

Généré le 2026-09-12T18:04:36.434Z. Les trois exports sont lus sans modification.

## Résultat démontré

Le défaut principal est un épuisement du budget de lecture, pas une absence générale de points dans ESV. Sur 115 captures sauvegardées, 114 ont été interrompues par la limite. Les sondes légères trouvent des points dans la ROI sur 103 captures, alors que 1595 nœuds sur 2275 n’ont jamais été balayés complètement.

Le second défaut est un statut trompeur : une lecture incomplète sans point retenu finit en `no-points`, ce qui masque la limite de ressources.

## Traçage cumulé

| Étape | Nombre |
|---|---:|
| Points déclarés disponibles dans les buffers | 67206881 |
| Sondes diagnostiques lues | 38675 |
| Points balayés | 685558 |
| Points transformés finis | 685558 |
| Points retenus dans les ROI | 4 |
| Points sauvegardés | 4 |
| Points présents dans les exports | 4 |

## Échecs avant sauvegarde d’un nuage

| Cause | Nombre |
|---|---:|
| Les nœuds LiDAR visibles ont changé pendant l'export. Attends la fin du chargement puis réessaie. | 226 |
| Cible différente : cut | 51 |
| La caméra a changé pendant l'export. Garde la vue immobile et réessaie. | 27 |
| capture-not-started-reader-busy | 7 |

## Limites

- Les buffers bruts ne sont plus disponibles dans les JSON : le correctif doit être validé par une nouvelle session ESV.
- Les sondes prouvent que des points utiles existaient dans les buffers chargés ; elles ne reconstituent pas une ROI complète.
- Une distance entre rails observés ne constitue pas une mesure ESV certifiée de l’écartement du champignon.
