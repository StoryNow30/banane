# Rapport de sortie 4.8 — brouillon

**25 septembre 2026.** Produit par `tools/sortie-report.cjs` à partir des rapports d'acceptation : aucun chiffre n'est recalculé ici. C1 à C5 sont rapportés ensemble ; C1 seul n'est pas un résultat (§14 G).

Rôle « validation » : partie jamais utilisée pour régler, relue. Toutes les parties relues à ce jour ont servi au bilan des curseurs (D-047, D-050) : elles sont « réglage ». Les preuves de sortie viendront des prochains lots, sur des parties neuves.

## Lots

| Lot | Partie | Version | Rôle | Relecture | État | C1 | C4 faux / jugés | C3 hors contrat appliqués |
|---|---|---|---|---|---|---|---|---|
| pilote-p19-4.7.6 — 4.7.6, décision sur le lot absente | 19 | 4.7.6 | réglage | complète | STOPPED | 14/28 (50 %) | 0/1 (non évaluable) | 0 |
| pilote-p31-4.7.8 | 31 | 4.7.8 | réglage | complète | STOPPED | 35/51 (68,6 %) | 0/34 | 0 |
| pilote-p31-fin-4.7.9 — décision sur le lot observée seulement | 31 | 4.7.9 | réglage | complète | STOPPED | 47/78 (60,3 %) | 0/45 | 0 |
| pilote-p34-4.7.11 — arrêté par l'opérateur | 34 | 4.7.11 | réglage | complète | STOPPED | 73/96 (76 %) | 1/71 | 0 |
| pilote-p2-4.7.14 — pose ESV décalée, KI-054 | 2 | 4.7.14 | réglage | ciblée (110–138) | PAUSED | 25/42 (59,5 %) | 2/11 (non évaluable) | 0 |
| pilote-p33-4.7.10 — 4.7.10, arrêt KI-051 | 33 | 4.7.10 | couverture | aucune | ERROR | 65/83 (78,3 %) | non jugé | 0 |
| pilote-p35-4.7.12 — relecture non enregistrée (D-048) | 35 | 4.7.12 | couverture | aucune | STOPPED | 203/233 (87,1 %) | non jugé | 0 |
| p2-4.7.18 — 4.7.18, reliquat de cuts non validés, passage à niveau 768–778 | 2 | 4.7.18 | réglage | complète | STOPPED | 16/30 (53,3 %) | 2/12 (non évaluable) | 0 |
| pilote-p3-4.7.18 — 4.7.18, reliquat « long », arrêt KI-059 ; diagnostic réduit au lot (batchId) ; banc D-053 | — | 4.7.18 | réglage | complète | — | 49/82 (59,8 %) | 0/48 | 0 |
| pilote-p9-4.7.18 — 4.7.18, lot long 0–8539 ; relecture Natif 25/09 (audit/relecture-p9-2026-09-26.md) ; 8066–8502 et 5151–5192 non relus ; fin 8504–8539 hors vue (KI-051) | — | 4.7.18 | validation | ciblée de fait (151/346 cuts relus, 66/262 appliqués jugés) | — | 262/346 (75,7 %) | 2/66 (non évaluable) | 0 |
| pilote-p9-differes-4.7.19 — 4.7.19, lot ordinaire sur les différés du précédent ; 12 cuts de passage à niveau appliqués, 9 jugés, 0 faux | 9 | 4.7.19 | validation | ciblée de fait (76/85 cuts relus, 11/14 appliqués jugés) | STOPPED | 14/85 (16,5 %) | 0/11 (non évaluable) | 0 |
| pilote-p6-4.7.19 — 4.7.19, reliquat pur (1,1 cut par suite) ; arrêt KI-061 | 6 | 4.7.19 | couverture | aucune | STOPPED | 73/125 (58,4 %) | non jugé | 0 |

## Critères

| Critère | Statut | Détail |
|---|---|---|
| C1 | **non démontré** | aucun lot de validation complet ; lots arrêtés : pilote-p9-4.7.18 75,7 % ; pilote-p9-differes-4.7.19 16,5 % |
| C2 | **non publiable** | P2 non mesuré : aucune cible d'erreur publiée (§15) |
| C3 | **tenu** | sur tous les lots : 0 paire(s) hors contrat appliquée(s), 103 refus d'écartement |
| C4 | **seuil à trancher** | 2 faux sur 77 cuts jugés des lots de validation relus : 4903 (12,3 mm, pilote-p9-4.7.18), 7523 (19,9 mm, pilote-p9-4.7.18) |
| C5 | **bilans tenus** | décision sur le lot : audit/curseurs-lot-2026-09-24.md (D-047, D-050) ; garde d'écartement voisin : audit/ecartement-voisin-2026-09-24.md (D-050) ; garde de paire : audit/garde-paire-verification-2026-09-24.md (D-044) ; curseurs du moteur : D-035 (minTop du moteur sans bilan de desserrage) ; règle d'appui : audit/appui-pose-2026-09-24.md (D-052, un appui est un cut posé) ; faux de premier passage sans appui : audit/chantiers/faux-sans-appui.md (D-051, observer) ; voisins validés (§14 I amendé) : audit/appuis-valides-2026-09-24.md (D-054) ; garde d'écartement voisin et lecteur passage à niveau, variation de gaugeGap, gaugeCount, crossingVoieMm : audit/curseurs-c5-4720-2026-09-25.md (D-055) |

## Ce qui manque pour la version candidate

- Lots de validation : au moins deux lots 4.7.18 ou plus récents sur des parties jamais utilisées, relus (relecture ciblée admise, D-048) ; les lots 4.7.16 et 4.7.17 gardent l'ancienne règle d'appui (D-052). Aucun lot n'a encore atteint sa borne : tous ont été arrêtés par l'opérateur ; la direction doit dire si un lot arrêté compte (par exemple à partir d'un nombre de cuts consécutifs) ou s'il faut le mener à sa borne. La partie 9 (jamais réglée) est relue le 25/09 : premier lot de validation jugé (2 faux sur 66 appliqués jugés, relecture ciblée de fait : 8066–8502 non relus) ; une seconde partie neuve reste à mener.
- P2 : 30 cuts replacés à l'aveugle par l'opérateur, pour le plancher humain ; sans lui, aucun chiffre d'erreur n'est publié. Outil prêt en 4.7.20 (tools/p2-plancher.cjs, lu par --p2) : il manque la session terrain.
- Seuil C4 de sortie : zéro faux strict, ou faux isolés expliqués tolérés (amendement n°10, point 5).
- Cahier consolidé, contrôle Edge de la version candidate, paquet reproductible ; merge, tag et release sur autorisation explicite seulement.
- Fait le 24/09 : matrice d'acceptation (44 exigences, contrôlée au banc), relecture indépendante 4.7.13–4.7.16 (B1 corrigé en 4.7.18) ; reste le contrôle visuel du §14 H dans Edge.
- Les neuf choix minTop 5 non jugés (relecture 4.7.16, I2) : à juger sur le terrain, en priorité en zone de faible densité et d'appareils de voie.
- Voisins validés comme appuis (§14 I amendé, D-054, validé le 25/09) : garde en place dans src/lot-decision.js, source terrain à trouver (navigation d'ESV vers un cut donné). Seul levier notable des reliquats (partie 6 : 58 %).
- Fin de partie hors vue (KI-051, D-043) : 36 cuts sur 346 en partie 9 (10 points) ; décision de la direction à revoir si le cas se répète.
