# Évaluation hors ligne V4.3.0

Date d'exécution : 10 septembre 2026. Le moteur évalué est le moteur géométrique inchangé de la branche courante (`template-surfaces-v3`). Aucun accès ESV, aucune navigation, aucune commande native, aucun apprentissage et aucun ajustement de seuil n'ont lieu pendant ce rejeu.

## Certificat d'ingestion

Les valeurs sont recalculées depuis les quatre JSON et contrôlées par assertions dans `tools/offline-evaluate.cjs`.

| Indicateur | Recalculé |
|---|---:|
| Corrections humaines | 110 |
| V4.0 / V4.2 | 26 / 84 |
| Nuages / points LiDAR | 110 / 1 314 278 |
| Deux rails / gauche seule / droite seule / sans mouvement | 80 / 13 / 4 / 13 |
| SKIP humain | 0 |
| Geominfo brute / passage à niveau explicite | 0 / 0 |
| Cuts auto/humain communs | 0 |
| Réserve 9031–9047 / triplets continus | 17 / 15 |

Le certificat détaillé, incluant les SHA-256 des quatre entrées, est `audit/ingestion-certificate-v4.3.0.json`.

## Résultat du rejeu

| Groupe | Cuts lus | Cuts comparables | Rails non résolus |
|---|---:|---:|---:|
| Global | 110 | 68 | 47 |
| Humain V4.0 | 26 | 21 | 6 |
| Humain V4.2 | 84 | 47 | 41 |
| Corrigés des deux côtés | 80 | 39 | 46 |
| Gauche seule | 13 | 12 | 1 |
| Droite seule | 4 | 4 | 0 |
| Sans mouvement | 13 | 13 | 0 |
| Réserve 9031–9047 | 17 | 9 | 8 |

| Erreur absolue globale | Gauche médiane / p90 / max | Droite médiane / p90 / max |
|---|---:|---:|
| Latérale | 1,77 / 4,00 / 100,74 mm | 1,40 / 4,00 / 66,35 mm |
| Verticale | 4,02 / 7,86 / 13,00 mm | 4,00 / 7,35 / 12,00 mm |
| Euclidienne | 4,63 / 8,77 / 100,96 mm | 4,64 / 7,79 / 67,12 mm |

Avec un seuil descriptif de 1 mm, aucune des 13 références sans mouvement n'obtient deux propositions immobiles et les 43 rails laissés inchangés par Mic reçoivent tous un déplacement moteur. Ces chiffres ne déclenchent aucun changement automatique. La corrélation de Pearson confiance/erreur euclidienne vaut -0,053 sur 136 rails comparables : la confiance actuelle ne constitue pas une calibration de l'erreur.

Les trois pires divergences sont 9041 gauche (100,96 mm), 6576 gauche (82,11 mm) et 5123 droite (67,12 mm). Le résultat complet par cut, avec état initial, proposition, état final humain, deltas, confiance, label, statut et motif, est `datasets/automatic/offline-evaluation-v4.3.0.json`.

## Limites

- Les 1 314 278 points appartiennent à 110 exemples décisionnels ; ils ne forment pas 1,3 million d'exemples indépendants.
- Aucun cut auto/humain commun n'autorise une comparaison directe des exécutions V4.0/V4.1 avec le moteur courant.
- Geominfo brute, ordre ESV réel, voisins verts et contexte voie/aiguillage/passage à niveau sont absents.
- La classe droite seule ne contient que quatre exemples.
- La réserve 9031–9047 est isolée dans le rapport, mais un véritable protocole comparatif exigera une stratégie figée avant de la consulter.
- Les résultats mesurent l'écart aux corrections humaines, pas une conformité réglementaire ou une aptitude à la production.

## Reproduction

```sh
node tools/offline-evaluate.cjs \
  --auto-v40 /chemin/banane-bilan-v4-1789026759209.json \
  --auto-v41 /chemin/banane-bilan-v4-1789025658138.json \
  --manual-v40 /chemin/banane-corrections-v4-1789033646631.json \
  --manual-v42 /chemin/banane-corrections-v4-1789042324894.json \
  --output datasets/automatic/offline-evaluation-v4.3.0.json \
  --certificate audit/ingestion-certificate-v4.3.0.json
```

## Traçabilité

| Exigence | Implémentation | Test exécuté | Résultat |
|---|---|---|---|
| Rejeu sans ESV/commande | `tools/offline-evaluate.cjs`, appel direct à `Geometry.proposeBoth` | Exécution sur 110 cuts ; drapeaux de sécurité exportés | 0 commande, 0 navigation |
| Ingestion recalculée | `buildCertificate` et assertions | Quatre JSON fournis | Conforme à 13 indicateurs |
| Labels humains | `manualDecision` et `label` | Tests des quatre combinaisons | 80/13/4/13 |
| Comparaison locale par rail | `railResult` | Rejeu complet | 68 cuts comparables |
| Métriques globales/version/label | `aggregate` | Rapport JSON produit | Médiane, p90, max, confiance et divergences exportés |
| Réserve 9031–9047 | Marqueur `reservedFinalEvaluation` | Comptage des cuts et triplets | 17 cuts, 15 triplets |
| Aucun voisinage principal | Champs de support seulement | Inspection et tests d'identité | Aucun calcul voisin ajouté |
| Reproductibilité | Hash moteur, paramètres et SHA des sources | Deux exécutions possibles avec mêmes entrées | Format `banane-offline-evaluation-v1` |
