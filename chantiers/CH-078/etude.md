# CH-078 — Étude : piste 4 (charger moins de détail) et piste 5 (anticiper la navigation)

**Données** : trois collections de novembre de `banane-data` (`2026-11-04_v5_constellation-parties-0-4`, `2026-11-05_v5_reference-avant-apprentissage`, `2026-11-06_v5_constellation-parties-13-16`) : 2 157 cycles de validation, 14 930 lectures. Octobre non utilisé (les relevés de niveau et de budget datent de la 4.9.5.3 ; non vérifié sur octobre). « Vision 2 » (08/11) n'est pas dans le dépôt de données : non relue. Chaque chiffre vient d'un script de `chantiers/CH-078/outils/` (`node chantiers/CH-078/outils/<script>.cjs <dossier de collection>`). Chiffres du 06/11 sauf mention ; les deux autres jours donnent le même ordre de grandeur.

## Piste 4 — charger moins de détail

**Ce qu'ESV charge, ce que le lecteur lit, ce qui lui sert** (`piste4-chargement.cjs`, ÉTABLI) :
- Par lecture : 18 nœuds (p90 22), 467 000 points visibles (p90 639 000). Le budget de points d'ESV est de 2 000 000 : **jamais approché** (0 lecture sur 14 930 à 90 %, maximum 1,4 M). Niveau des nœuds : médian 5 à 6, le plus profond 10 à 12.
- Ce qui est téléchargé par coupe est petit : médiane 3 requêtes de points et 1 Mo (06/11), 1 requête et moins de 0,5 Mo (04/11), 6 requêtes et 2 Mo (05/11). Le cache d'ESV garde ~100 nœuds (3,9 M points) d'une coupe à l'autre. Le frein est donc l'attente de quelques nœuds, pas le volume (PROBABLE ; c'est l'objet de la piste 0).
- Le lecteur inspecte ~480 000 points par vue et **en retient 2 830 par coupe** (0,3 %). **79 % des nœuds lus n'ont aucun point retenu, et 69 % des points inspectés sont dans ces nœuds** (04/11 : 77 % et 64 % ; 05/11 : 79 % et 68 %).
- Lien avec le temps (corrélation, PROBABLE) : du tiers de coupes le plus léger au plus lourd, la fin de lecture passe de 2 503 à 3 059 ms (+22 %) ; 1 156 → 1 727 ms le 04/11 ; 2 105 → 2 272 ms le 05/11. Même les coupes légères prennent 1,2 à 2,5 s : un plancher que le détail ne touche pas.

**Gain** : au mieux 0,2 à 0,6 s sur 2,9 s, soit 7 à 20 % de la fin de lecture (borne haute, SUPPOSÉ : les coupes lourdes diffèrent aussi par le terrain). Le budget de 2 M ne limite rien aujourd'hui ; il faudrait le descendre vers 470 000 points pour toucher la moitié des lectures (SUPPOSÉ : Potree compte peut-être autrement que `numVisiblePoints`).

**Ce qu'on ignore** : à quel niveau vivent les 2 830 points retenus. Les journaux donnent le niveau par lecture (min, médian, max), pas par nœud : on ne sait pas quel détail on peut retirer sans toucher la zone du rail.

**Effet sur les poses** : le lecteur lirait d'autres points, une pose peut bouger ; la parité au bit près est impossible par construction. La preuve : garde GCV2 verte (`tools/garde-gcv2.cjs`) ; jugement contre l'Écho au moins aussi bon que le lot du 06/11 (écart médian 4,35 mm, pas plus de fautes de plus de 50 mm que les 7 de ce lot, D-292) ; jamais de SKIP, aucun cut non résolu validé ; identité de coupe inchangée. La piste règle ESV : accord écrit de l'opérateur au moment de livrer (D-305).

**Recommandation : ouvrir sous condition.** (1) Sans risque : relever en lecture seule, par nœud, niveau et points retenus (à ajouter à la piste 0). (2) Seulement si les points retenus sont tous à des niveaux que l'on peut isoler : essai en maquette puis sur un lot témoin, budget ou taille minimale de nœud réduits par paliers, avec les preuves ci-dessus. Si les points retenus sont à tous les niveaux : ne pas ouvrir (gain ≤ 0,6 s pour un risque sur les poses).

## Piste 5 — anticiper la navigation

**Signal fiable de changement de coupe ? Oui pour « la coupe a changé », non pour « la coupe est complète »** (`piste5-signal.cjs`, `piste5-parties.cjs`, ÉTABLI sur ces journaux) :
- Après chaque validation, la cible observée (`cut-target-changed`) et la première capture portent la coupe annoncée par la validation : **2 157 cycles sur 2 157, aucun faux positif**. Idem après un différé (26/26, 34/34, 45/45) et après un changement de partie (4/4, 5/5, 4/4 ; les autres changements de partie n'ont pas de capture dans la fenêtre). L'annonce d'ESV (`railPairSelected`) est présente sur 1 040/1 044 cycles (06/11), 801/807 (05/11), 306/306 (04/11), médiane 172 ms après la validation, p90 212 ms (04/11 : 47 et 214 ms). Marge de ± 0,3 s : ces événements arrivent ~0,2 s après coup.
- Elle ne dit pas « complète » : `railPairSeen` arrive **avant** la fin du chargement dans 951 cycles sur 1 044 (91 % ; 75 % le 04/11, 60 % le 05/11).
- Le seul signal « complet » est la règle actuelle (compteur de Potree à zéro, 2 images stables) : vivant dans 72 % des lectures le 04/11, 70 % le 05/11, **24 % le 06/11** (compteur bloqué, D-293 : repli sur 800 ms de silence). Écart mesuré entre la dernière réponse de points et la fin de lecture : 585 ms (04/11), 509 ms (05/11), **1 932 ms (06/11)** (PROBABLE : jours différents). Le correctif existe (ligne de base par les échecs, D-293) ; je n'ai pas de journal postérieur à son allumage.
- Raccourcir le repli (`piste5-silence.cjs`, 06/11, 4 479 lectures) : silence de 600 ms, 0,4 % des lectures voient encore un nœud changer (gain ≤ 200 ms) ; 400 ms, 9,9 % ; 300 ms, 23 %. Un faux positif est ici « nœuds encore en mouvement », pas « pose fausse » (non mesuré).
- 1 000 à 1 600 changements de cible par jour ne suivent ni une validation ni un différé (SUPPOSÉ : relecture et passes) : non qualifiés, non utilisés.

**Gain** : la coupe suivante ne charge qu'après la navigation, et la navigation n'a lieu qu'après la pose et la validation de la coupe courante, sur la coupe affichée. Cycle médian 4 657 ms : calcul 263 ms, pose et validation 862 ms, annonce d'ESV à 172 ms, début de la lecture suivante à 362 ms, fin à 2 866 ms. **Rien de la lecture suivante ne peut commencer avant la validation** sans quitter la coupe courante. Seul gain mesuré : démarrer la lecture à l'annonce d'ESV plutôt qu'à la navigation observée, 0,12 à 0,19 s par coupe (4 à 5 % du cycle), au plus ~0,4 s avec la marge (PROBABLE). Précharger les nœuds de la suivante est la piste 3 (CH-077), pas la navigation.

**Règle de sûreté (4.2)** : toute lecture porte (partie, coupe, identifiant d'opération) et n'est appliquée que si ESV affiche encore cette coupe ; l'annonce d'ESV est une garde, jamais une preuve de complétude. À prouver : rejet des résultats périmés (essais rouges d'abord) et rejeu des lots disponibles sans une seule identité erronée.

**Recommandation : ne pas ouvrir comme anticipation.** D-299 tient : le signal de changement existe, mais il n'y a rien à anticiper (≤ 0,4 s). Ce qui vaut un chantier est ailleurs : garder vivant le signal « complet » (D-293, à vérifier sur le prochain lot) et, en option, lire dès l'annonce d'ESV (0,12 à 0,19 s), sous accord écrit sur `src/adapter-page.js`.

PRÊT CH-078 SHA
