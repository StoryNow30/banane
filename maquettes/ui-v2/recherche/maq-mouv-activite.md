# Maquette mouv-activite (« L'activité »)

**Logique.** Une seule activité en direct, compacte, dont la forme change avec l'état : pleine largeur quand le lot tourne, resserrée au centre en pause, tablette carrée à l'arrêt, feuille dépliée quand Ariane a besoin de l'opérateur, carte de bilan à la fin ; à gauche Ariane pose, à droite elle observe.

**Références.** beui.dev Dynamic Island, Morphing Modal, guide (« move the shape first, then introduce its label », courbe de tiroir [0.32, 0.72, 0, 1]) ; 60fps.design Bottom Sheet Detail Expansion, Trackables Card Morph to Screen, Revolut Number of Transactions ; koipond (code lu : le sélecteur suit l'état réel ; ce qui part disparaît avant que ce qui arrive n'apparaisse).

**Sens des signes.** Largeur, hauteur, rayon et côté de la capsule = état ; remplissage proportionnel = avancement (total connu) ; segment qui va et vient sans remplissage = total inconnu (écrit) ; rond plein = tourne ; deux barres = pause ; carré plein rouge = arrêt ; feuille ocre = à vous ; carré clair angles droits = bilan ; capsule à droite = Écho. Les parties d'une file sont de petites capsules dans la forme de leur état.

**Partition de mouvement.**
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| un cut traité | le remplissage avance d'un cran ; un repère clair bat sur son bord ; le chiffre roule | 900 ms linéaire ; battement 900 ms (.16,1,.3,1) ; chiffre 400 ms | le lot tourne | remplissage posé, sans battement |
| total inconnu | un segment fixe va et vient dans la capsule | 2,4 s aller (.77,0,.175,1) | travaille, fin non connue | segment immobile + « total inconnu » |
| pause | la capsule se resserre au centre (62 %) | 550 ms (.32,.72,0,1) | attend | forme posée |
| arrêt | elle se ferme en tablette carrée rouge à gauche | 550 ms | arrêté | forme posée |
| incident / alerte | elle grandit vers le bas et s'ouvre en feuille ; le texte se déroule dessous (masque qui descend) | 550 ms + 500 ms | à vous | feuille posée |
| relecture | le remplissage repart de droite à gauche, sans fin | 2,6 s linéaire | relit | immobile, mot « relecture » |
| fin | la capsule devient carte de bilan | 550 ms | terminé | posée |
| bascule en Écho | la capsule glisse à droite et se resserre | 550 ms | côté opérateur | posée |
Seule la capsule est conservée (`data-garder`) : ses attributs changent, le CSS anime la forme ; rien n'est rejoué au rendu périodique.

**Pourquoi sans filiation.** Aucun fichier d'Ariane ni d'une autre maquette ouvert ; forme dérivée des îlots et feuilles des références.
**Ni voie ni nuage.** Une capsule et des feuilles d'interface : aucune voie, aucun rail, aucun point.

**Autocritique.** La capsule évoque l'« île dynamique » d'un téléphone, déjà vue ; le texte de la capsule peut être tronqué à 360 px (le titre le répète) ; en sombre, le remplissage clair sur fond clair est moins contrasté qu'en clair.

**Vérificateur.** 4 566 textes, contraste minimal 6,50:1, 0 écart, 0 erreur. Raffinement : total inconnu sans remplissage deviné, pictogramme de pause à deux barres, forme de « à examiner » qui ne ressemble plus à un interrupteur, remplissage sombre renforcé.
