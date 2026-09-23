# Banane UI Next — proposition « La ligne »

Proposition indépendante pour le chantier B (cahier 4.8, §5.4), faite sans
consulter les maquettes corrigées de Luna, pour que la direction compare deux
approches. Maquette statique : `index.html` (ouvrir dans un navigateur), et
les six écrans en image (`ecran-*.png`). **Données fictives.**

## L'idée : le lot est une ligne, pas une liste

L'opérateur raisonne en voie : il pose un cut en regardant ceux d'avant
(amendement n°7). La décision sur le lot fait la même chose (n°9). L'interface
actuelle ne montre pourtant qu'un compteur de cuts et le cut en cours.

« La ligne » dessine le lot comme un **schéma linéaire de ligne ferroviaire**,
à la manière d'un référencement linéaire en SIG : un repère par cut, comme un
point kilométrique, et au-dessus un **profil en long du déplacement posé**.

- **L'état se lit à la forme**, la couleur ne fait que la renforcer (lisible en
  niveaux de gris) : carré plein = posé par le moteur ; carré évidé pointé =
  posé par la voie ; carré évidé ocre = différé ; carré barré = refusé par
  l'écartement ; pointillé = sans entrée moteur ; triangle = navigation
  incertaine ; noir = cut affiché.
- **Le profil** relie les cuts posés et dessine la bande de la garde de
  continuité (±30 mm autour de la droite des voisins). Une proposition retenue
  par la garde apparaît hors de la bande, avec son écart : le « pourquoi » d'un
  différé se voit au lieu de se lire dans un journal.
- **Le curseur** porte toujours le numéro du cut affiché. En cas
  d'incertitude, il devient « 409 ? » : l'incertitude reste visible avec son
  cut (§5.4).

## Les écrans

| # | Écran | Ce qu'il montre |
|---|---|---|
| 1 | Pilote, lot en cours | ruban, cut en cours avec ses deux rails, écartement en plage d'admissibilité, commandes et preuves |
| 2 | Pilote, navigation incertaine | un seul état d'alerte, écritures fermées, marche à suivre, un seul bouton nommant le cut |
| 3 | Pilote, fin de lot | bilan sur les cuts distincts, tout le lot sur une ligne, différés par tronçon, reprise des différés (future) |
| 4 | Natif, collecte | ton parcours (validé, revisité, SKIP), points lus par cut, santé en une ligne, continuité observée |
| 5 | Assisté | coupe du cut : pose ESV en pointillés, proposition pleine, déplacements écrits |
| 6 | Pilote, thème sombre | l'écran 1 posé sur ESV |

## Les règles conservées du §5.4, et où elles sont

- **Politique effective affichée** : ligne d'état de chaque écran Pilote, en
  permanence, pas dans un réglage replié.
- **« Différés : N » fidèle** : chiffre clé ; à l'écran 2, le cut incertain
  n'y est pas ajouté et le texte le dit.
- **Incertitude de navigation visible avec son cut** : curseur « 409 ? »,
  triangle sur le ruban, titre de l'alerte, libellé du bouton.
- **Aucun bouton présenté comme réussi sur un simple accusé** : le tableau
  « Commandes et preuves » sépare trois colonnes — *émise*, *effet observé*,
  *serveur* (toujours « non disponible ») — et seul un effet observé prend la
  couleur de la réussite.

Et des règles du contrat, rendues visibles :

- **Écartement** : une plage 1405–1470 sans valeur centrale ni repère à 1435,
  avec la phrase « Banane n'y vise aucune valeur ».
- **Pas d'application partielle** : « Appliquer — les deux rails, ou aucun ».
- **Couverture jamais seule** : le bilan de fin de lot dit que la justesse n'est
  pas mesurée tant que la relecture Natif n'est pas faite.
- **Natif** : « Banane n'envoie aucune commande dans ce mode » reste affiché
  pendant toute la collecte.

## Ce que cette proposition ajoute, et ce qu'elle demande

- La **reprise des différés** (écran 3) est montrée désactivée : elle dépend de
  la décision D2 et du chantier 1 (retour à un cut). La ligne en est le support
  naturel : chaque tronçon différé est une cible de navigation.
- Le profil demande, par cut, le déplacement latéral posé et l'écart à la voie :
  la 4.7.8 les calcule déjà (`lotObservation`) ; rien de nouveau côté moteur.
- Sur une fenêtre de 560 px, le ruban montre 41 cuts ; le lot entier tient sur
  la ligne de l'écran 3.

## Hors de cette proposition

Le diagnostic complet (motifs, candidats, journal GCV1) reste replié ; son
contenu n'est pas redessiné ici. Le style suit la référence retenue
(`design/ui-next/REFERENCE.md`) — fond clair, un seul accent vert, alerte douce
et rare — sans en reprendre la mise en page par cartes de chiffres.
