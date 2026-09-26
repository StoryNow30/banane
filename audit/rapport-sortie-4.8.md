# Rapport de sortie 4.8 — brouillon

**26 septembre 2026.** Produit par `tools/sortie-report.cjs` à partir des rapports d'acceptation : aucun chiffre n'est recalculé ici. C1 à C5 sont rapportés ensemble ; C1 seul n'est pas un résultat (§14 G).

Rôle « validation » : partie jamais utilisée pour régler, relue ; sa mesure est consignée avant tout réglage, puis elle entre au banc de réglage (rotation, D-057). Parties de validation de la 4.8 : 9 et 12.

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
| pilote-p9-differes-4.7.19 — 4.7.19, lot ordinaire sur les différés du précédent ; 12 cuts de passage à niveau appliqués, 9 jugés, 0 faux ; reliquat du lot 4.7.18 : C1 compté par partie (276/348 = 79,3 %), pas par lot | 9 | 4.7.19 | validation | ciblée de fait (76/85 cuts relus, 11/14 appliqués jugés) | STOPPED | 14/85 (16,5 %) | 0/11 (non évaluable) | 0 |
| pilote-p6-4.7.19 — 4.7.19, reliquat pur (1,1 cut par suite) ; arrêt KI-061 | 6 | 4.7.19 | couverture | aucune | STOPPED | 73/125 (58,4 %) | non jugé | 0 |
| pilote-p12-4.7.20 — 4.7.20, partie neuve 1–8144, premier lot mené à sa borne (arrêté sur 8144) ; relecture Natif 4.7.21 du 26/09 (audit/relecture-p12-2026-09-26.md) | 12 | 4.7.20 | validation | complète (84/84 appliqués jugés) | STOPPED (complet) | 84/106 (79,2 %) | 2/84 | 0 |

## Critères

| Critère | Statut | Détail |
|---|---|---|
| C1 | **non tenu** | pilote-p9-4.7.18 : 75,7 % ; pilote-p12-4.7.20 : 79,2 % |
| C2 | **publié sans plancher** | écart à la relecture de l'opérateur, rails des cuts validés (retouchés) des lots de validation relus (pilote-p9-4.7.18 : 48 rails, p90 latéral 4,2 mm, vertical 7,6 mm ; pilote-p9-differes-4.7.19 : 18 rails, p90 latéral 3,6 mm, vertical 6,6 mm ; pilote-p12-4.7.20 : 10 rails, p90 latéral 8,3 mm, vertical 9,2 mm) ; plancher humain P2 reporté en 4.9 (D-057) |
| C3 | **tenu** | sur tous les lots : 0 paire(s) hors contrat appliquée(s), 111 refus d'écartement |
| C4 | **tenu (faux isolés expliqués)** | 4 faux sur 161 cuts jugés des lots de validation relus : 4903 (12,3 mm, pilote-p9-4.7.18, premier passage, vertical (rail trop bas), passage à niveau 4890–4903), 7523 (19,9 mm, pilote-p9-4.7.18, premier passage, vertical (rail trop bas)), 7738 (13,5 mm, pilote-p12-4.7.20, choix à un appui, vertical (rail trop bas) ; 2e du type après 7026 (partie 31) : correctif à étudier (D-042), 4.8.5), 7743 (22,2 mm, pilote-p12-4.7.20, premier passage, rail à faible confiance (37) à 27,7 mm de la voie, sous la garde de 30 mm ; même cas que 1834 (partie 34) : garde à étudier, 4.8.5) |
| C5 | **bilans tenus** | décision sur le lot : audit/curseurs-lot-2026-09-24.md (D-047, D-050) ; garde d'écartement voisin : audit/ecartement-voisin-2026-09-24.md (D-050) ; garde de paire : audit/garde-paire-verification-2026-09-24.md (D-044) ; curseurs du moteur : D-035 (minTop du moteur sans bilan de desserrage) ; règle d'appui : audit/appui-pose-2026-09-24.md (D-052, un appui est un cut posé) ; faux de premier passage sans appui : audit/chantiers/faux-sans-appui.md (D-051, observer) ; voisins validés (§14 I amendé) : audit/appuis-valides-2026-09-24.md (D-054) ; garde d'écartement voisin et lecteur passage à niveau, variation de gaugeGap, gaugeCount, crossingVoieMm : audit/curseurs-c5-4720-2026-09-25.md (D-055) |

## Ce qui manque pour la version candidate

- C1 : partie 12 à 79,2 % (84/106, lot complet), partie 9 à 79,3 % par partie (276/348, deux lots) ; objectif intermédiaire 80 % (n°9) manqué d'un cut sur la partie 12, cible du §6 (90 %) non atteinte. À accepter explicitement par la direction pour la sortie.
- Arrêts du Pilote 4.7.21 en cours de session et passage à la partie suivante (KI-063) : lots attendus de l'opérateur ; correctif dans la 4.8.0 si la cause est confirmée.
- Contrôle visuel du §14 H dans Edge : fait par la direction le 26/09 (bouton d'ouverture d'ESV redessiné en blanc, discret) ; banc vert sur le commit candidat ; paquet reproductible ; merge, tag et release sur autorisation explicite seulement.
- Fait : matrice d'acceptation (44 exigences), relecture indépendante 4.7.13–4.7.16, seuil C4 (D-057), lot arrêté compté (D-057), P2 reporté en 4.9 (D-057), rotation réglage / validation (D-057).
- Reporté en 4.8.5 (D-057) : voisins validés comme appuis en dernier recours (D-054), garde de premier passage à 20 mm et choix à un appui (faux 7743 et 7738), biais vertical aux passages à niveau (banc, aucun calage).
- Les neuf choix minTop 5 de la relecture 4.7.16 (I2) restent non jugés ; la partie 12 en juge sept nouveaux sur le terrain : 6 justes, 1 faux (7738, choix à un appui).
