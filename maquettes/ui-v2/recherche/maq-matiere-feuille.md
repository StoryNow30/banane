# Maquette matiere-feuille

**Logique (une phrase).** Ariane tape le lot à la machine : une frappe par cut, les différés restent à l'encre rouge là où ils ont eu lieu, et la feuille se remplit sous vos yeux.

**Ni voie ni nuage.** Une feuille tapée, des caractères ; aucune voie, aucun point de relevé (la trame de caractères est une page de texte, pas un nuage).

## Références et ce qui en est pris
- heydamir.design, « Typewriter » (« Typos stay on paper », compteur « 7/16 », la faute reste où elle a été faite).
- backgrounds.supply, collection ASCII : une image faite de caractères qui se lit de loin par sa densité.
- inspora.design (vu en grille) : pièces imprimées (timbres, trames) : la matière de l'encre.
- Le ruban bicolore noir et rouge des machines à écrire.

## Sens des signes
Une ligne = 20 cuts, son premier numéro en marge. « / » = posé ; « X » rouge gras = différé ; « + » souligné = vert à examiner ; « . » gris = pas encore tapé. Curseur plein : clignote quand Ariane tape, fixe en pause ou à l'arrêt ; note de marge « — pause », « — arrêt ». « . . . fin de page inconnue » = total inconnu. Pied tapé « Posés · Différés · À examiner — fin du lot — ». Feuilles empilées derrière = parties faites ; barre grise qui descend dans la marge = relecture. Écho = dictée en bleu (« o » accord, « x » écart, regroupés : ce sont des comptes, pas des positions). Rouleau vide + feuille en pointillé = ESV non relié. Encadré « NOTE : » = incident ou alerte.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Nouveau cut | le caractère tombe de 4 px et prend l'encre | 0,12 s, attaque sèche | une frappe | caractère posé |
| Lot qui tourne | curseur | clignote 1 Hz, en marches | la machine attend la frappe suivante | curseur fixe |
| Pause / arrêt | curseur se fige, note de marge | net | la machine est arrêtée | idem |
| Changement d'état | le titre se tape lettre à lettre | 0,42 s, 12 marches | un nouvel état est écrit | titre posé |
| Relecture | barre grise qui descend la marge | boucle 3,2 s, linéaire | on relit la page | barre fixe |
| Valeur qui change | chiffre reprend son encre | 0,25 s, 3 marches | nouveau compte | aucun |

## Pourquoi sans filiation
Feuille blanche, aucun fichier d'Ariane ni d'autre maquette ouvert.

## Autocritique
- La page fait 12 lignes pour 240 cuts : au-delà (lots plus longs) il faudra faire défiler la feuille, comme un vrai rouleau.
- Courier partout donne un caractère fort ; les libellés longs (« Préparer un autre lot ») prennent de la largeur à 360 px.
- Le rouge porte seul le « différé » dans la page… mais il est doublé par la forme « X » en gras : à vérifier en impression noir et blanc.

## Chiffres du vérificateur
27 936 textes mesurés (chaque caractère tapé est un élément), contraste minimal 5,42:1, 0 écart, 0 erreur de console. Mouvement réel : 0 erreur.
