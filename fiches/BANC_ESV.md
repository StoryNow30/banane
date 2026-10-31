# Banc ESV léger : ce que la maquette reproduit, ce qu'elle simule, ce que seul un export dit (CH-029)

Maquette : `tests/esv-maquette/`. Faits réels : `tests/fixtures/esv-releves-reels.json` (comptes, formes, délais ; extraits des journaux de trois séances sur un vrai ESV, 4.9.5.26, .27 et .28, 30 et 31/10). Essai de contrat : `tests/esv-maquette/contrat-releves.test.cjs`. Le rejeu de séances complètes n'est pas fait ici (Ariane 6).

## Reproduit fidèlement (ÉTABLI par relevé, vérifié par l'essai de contrat)
- **Sélecteur de parties** : liens aux libellés nus « 0 » à « n − 1 », numéros consécutifs depuis 0, une seule entrée courante ; n réel de 15 à 28 (option `partiesAffichees`, défaut 25). Forme de l'absence : `current` nul, 0 entrée.
- **Absence intermittente** : 9 relevés, 4 présents et 5 absents. 3 absents tombent pendant le rechargement de la page au changement de partie, 2 à la connexion alors que les six boutons sont là (option `selecteurRetard`).
- **Contrat de la page** : six boutons (ids et titres), classes des deux rails, cinq écouteurs jQuery ; pendant le rechargement : aucun bouton, aucun rail, aucun écouteur.
- **Compteur** « N on M treated » : entiers, N ≤ M ; le dernier cut est M − 1.
- **Changement de partie** (5 observés) : 9,7 à 12,2 s jusqu'à la partie ouverte (option `delaiPartie=reel`, 10,5 s) ; page vide environ 0,4 à 0,6 s après le geste (maquette : 0,45 s) ; la partie s'ouvre à son **premier cut** ; ni validation ni SKIP. « Next non validated cut » ouvre la partie suivante quand N = M ; « dernier cut puis Next cut » l'ouvre quand il reste des cuts.
- **Refus** de « Next non validated cut » tant qu'il reste des cuts à valider (2 observés) : c'est le refus d'**Ariane** (`reste-a-valider`), rien n'est cliqué.

## Simulé sans preuve
- Le défaut `delaiPartie=0` (instantané) : choisi pour ne pas ralentir les autres essais, il ne colle pas au réel ; l'essai de contrat utilise `reel`.
- La page vide est simulée en retirant les boutons du DOM ; le vrai ESV recharge la page et Ariane se reconnecte (la maquette garde l'adaptateur en place).
- Ce que fait le bouton « Next non validated cut » quand il reste des cuts (naviguer au cut non validé suivant, même partie) : jamais cliqué dans ces séances, déduit du titre.
- Le statut « traité » = validé ou passé, la liste d'une ligne par indice, les points et rails (corpus du dépôt), les durées des écritures.
- Le délai d'apparition du sélecteur après la connexion : au plus 73 s au réel (un relevé), la maquette prend ce qu'on lui demande.

## Seul un export réel peut le dire
- Si le sélecteur est absent à tel instant précis, et pourquoi à la connexion.
- Si le geste d'Ariane aboutit toujours en 10 à 12 s (5 mesures seulement) ; si un geste échoue sur d'autres parties ou un autre ESV.
- Le comportement d'ESV à la dernière partie, hors file, hors lot, et les parties à cuts non numérotés de 0 à M − 1.
- L'effet d'un changement de contrat d'ESV : la maquette ne se met jamais à jour toute seule ; `avis-contrat-esv` et `tools/esv-contrat-comparer.cjs` le disent.
