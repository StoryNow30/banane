# CH-124 : parité banc / service worker du levier N, lot d'octobre 0-2310-lot2

Outil : `tools/parite-l1se-sw.cjs --leviers '{"ancre":true}' --passe` (vrai `background.js` en vm, nuages réels, ESV simulé, deuxième passe en ombre).
Code : tronc fusionné (4d9a77d) + `ancre.patch` (55c63f31…) + `sw-ancre.patch` (5c7c1fef…). Liste : celle du départ du lot, reconstituée (`outils/liste-depart.cjs` : 10 006 lignes, 1 ligne remise), la même pour le banc et le service worker.
Lot : 91 cuts, 3 refus d'ancre au banc (282 : pose de la chaîne ; 1325 et 1333 : poses de la GCV2). Durées : banc 284 s, service worker 1 916 s.

## Verdict (ÉTABLI)
| référence du banc | lignes identiques | écarts |
|---|---|---|
| rejeu N, zones du banc (celui de la garde d'octobre) | **91 / 91** | aucun |
| rejeu N, `BANC_ZONES=journal` (sortie brute de l'outil) | 87 / 91 | 907, 909, 910, 911 |

Critère de l'outil : même état (posé ou différé) ; si posé des deux côtés : même source, pose à 0,05 mm près, même passe.
- Les 3 refus : différés des deux côtés.
- Deuxième passe : 5 poses à la première, 3 à la seconde, des deux côtés.

## Les 4 écarts de la sortie brute, ligne à ligne
Ils ne viennent ni de l'ancre ni du service worker, mais de la référence : avec `BANC_ZONES=journal`, le banc prend la zone écrite au journal par le lot d'octobre. Ce journal dit « pn » sur 907 et 910 ; le service worker d'aujourd'hui, rejoué sur les mêmes cuts, et le banc avec ses propres zones disent « adv ».
- 907 et 910 : en « pn » le banc ne pose pas (`sans-approche`) ; en « adv » il pose, et sa pose est celle du service worker (0,05 mm).
- 909 et 911 : posés des deux côtés ; l'écart (2,90 et 0,61 mm) vient des voisins 907 et 910, posés ou non. Avec les zones du banc : identiques.

À retenir : pour une parité, la référence du banc ne prend pas les zones du journal d'un lot rejoué avec un autre code que celui du lot.
