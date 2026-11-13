# CH-120 : cible chiffrée (écrite et poussée avant le premier rejeu, D-222, D-352)

Écrite le 13/11 avant tout rejeu de ce chantier. Toute retouche après un jugement fait un nouveau réglage, jugé à nouveau.

## Définitions (figées)
- **Pool d'un cut** : les hypothèses par rail `hyp.rails.left/right` de `hypothesesDuCut` (src/gcv2-l1.js), calculées par `deciderDiffere` avec l'état du lot à l'instant de la décision (profil L1-se du banc de CH-116), variantes de hauteur comprises. Mesuré sur **tous** les cuts avec nuage du corpus de CH-116, posés compris (mode mesure du banc, sans effet sur les décisions).
- **Vérité** : `poseFinale` du corpus de CH-116 (cuts jugés, hors D-285 ; `--avec-courtes` en second tableau).
- **Rail présent** : une hypothèse de ce rail à 10 mm au plus de la vérité (distance 3D, comme le juge de CH-113).
- **Classe A** : les deux rails présents ; **A\*** : A et au moins une paire de rails présents dont l'écartement passe le filtre de `meilleurePaire` ; **B** : un seul rail ; **C** : aucun.
- **Rappel du pool** = A / cuts jugés avec nuage ; publié par zone (ADV, abords, PN), par sort (posé juste, 10-50, mauvaise voie, différé corrigé, différé juste) et par étage.
- **Cause d'absence** d'un rail (B, C) : hors de la fenêtre de recherche du moteur (vérité à plus de 80 mm en travers des centres de recherche, ou 40 mm en vertical), cellule au réservoir mais écartée (ni compétitive ni forte), tronquée par `MAX_HYP`, nuage sans soutien à la vérité (points de dessus < 5 ou de flanc < 3), autre (à décrire).

## Cible
1. **Mesure (jalon 1, envoyée à l'intégrateur avant tout générateur)** : rappel A, A\*, B, C sur tout le corpus, par zone, sort et cause.
2. **Rappel en ADV** : parmi les cuts jugés C en ADV au livré (différés, 10-50 et mauvaises voies), **au moins la moitié passent en A** avec le réglage figé des générateurs. **Aucun** cut A du livré ne sort de A (aucune bonne hypothèse chassée par la troncature).
3. **Poses** (banc de CH-116, choix livré, deuxième passe éteinte comme au banc ; validation croisée « un lot dehors » sur les lots hors examen, puis examen 05/11 jamais vu) :
   - 0 nouvelle mauvaise voie (> 50 mm) sur aucun lot ;
   - 0 posé juste du livré passé au-delà de 10 mm ;
   - bons bloqués : pas plus qu'au livré ;
   - gain : au moins **5** cuts nets en plus, comptés en validation croisée (différés reposés justes + mauvaises voies devenues justes ou différées), le coût standard du banc strictement plus bas que le livré sur la somme des lots tenus dehors.
4. **Éteint = livré** : 4 016 cuts sur 4 016 identiques au banc (état, pose, motif).
5. **Garde de pose** d'octobre (`garde-gcv2 --rejouer`, 11 lots) : retour 0, aucun recul ; **parité** banc / service worker (`parite-l1se-sw --passe`) identique sur le réglage final.

Si le rappel monte (2) mais que les poses ne gagnent rien (3), le résultat est un **pool enrichi publié pour CH-119 et CH-122**, sans allumage : rapport de ce qui manque au choix.
