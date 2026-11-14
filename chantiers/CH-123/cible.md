# CH-123 : cible chiffrée (écrite et poussée avant le premier rejeu, D-222, D-352)

Écrite le 13/11, avant tout rejeu de ce chantier. Toute retouche d'un réglage après son jugement fait un nouveau réglage, jugé à nouveau.

## Définitions (figées)
- **Pool, vérité, rail présent, classes A / A\* / B / C, causes** : celles de CH-120 (`chantiers/CH-120/cible.md` et `outils/` sur la branche `chantier/CH-120`, 7d7dcd1), sans changement : pool effectif de `deciderDiffere` (profil L1-se du banc de CH-116) à l'instant de la décision, vérité = pose finale du corpus de CH-116 hors D-285, rail présent = une hypothèse à 10 mm au plus (3D).
- **Les 128** : les cuts jugés avec nuage de classe effective B ou C au code livré. Je refais la mesure de CH-120 sur ma copie ; si mon compte diffère du sien (128 = 96 B + 32 C), je publie l'écart et la cible porte sur ma liste, figée avant tout levier (`sorties/liste-128.csv`).
- **Mon terrain** : hors ADV toutes causes ; en ADV toutes causes sauf « hors fenêtre » et « hors cadre » (terrain de CH-120) ; la classe B partout pour le rail compagnon soutenu par le nuage. Un générateur de CH-120 qui couvre un cas est mesuré et nommé, pas refait.
- **Leviers** : chacun en clé séparée, coupée par défaut, dans un patch éteint (`chantiers/CH-123/*.patch`).

## Cible
1. **Autopsie** (jalon, envoyée à l'intégrateur avant tout levier) : une ligne par cut et par rail manquant des 128, cause, nuage à la vérité (points de dessus, de flanc, hauteur), ce qui a rejeté ou manqué le rail.
2. **Rappel** (réglage figé, mes leviers seuls, sans les générateurs de CH-120) : **au moins 43 des 128 (un tiers) passent en A** ; **aucun** cut A du livré ne sort de A (sur les 747) ; publié aussi par zone, par cause, et avec les générateurs de CH-120 ajoutés (information, hors cible).
3. **Poses** (banc de CH-116, choix livré, deuxième passe éteinte comme au banc ; validation croisée « un lot dehors » sur les lots hors examen, `banc.cjs croise`, puis examen 05/11 jamais vu) :
   - 0 nouvelle mauvaise voie (> 50 mm) sur aucun lot ;
   - 0 posé juste du livré passé au-delà de 10 mm ;
   - bons bloqués : pas plus qu'au livré ;
   - gain : coût standard du banc strictement plus bas que le livré sur la somme des lots tenus dehors, avec au moins **3** cuts nets en plus (différés reposés justes + mauvaises voies devenues justes ou différées, moins les pertes).
4. **Éteint = livré** : 4 016 cuts sur 4 016 identiques au banc (état, pose, motif).
5. **Garde de pose** d'octobre (`garde-gcv2 --rejouer`, 11 lots) : retour 0, aucun recul ; **parité** banc / service worker (`parite-l1se-sw --passe`) identique sur le réglage final.

Si le rappel monte (2) sans gain de pose (3) : pool enrichi publié pour CH-119 et CH-122, sans allumage, et rapport de ce qui manque au choix. Si le rappel ne monte pas : rapport de la raison mesurée par cause.
