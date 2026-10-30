# Maquette mouv-fil (« Le fil »)

**Logique.** Le lot s'écrit comme un fil d'événements : la ligne du cut qui vient d'être traité s'écrit lettre à lettre sous une lentille de focus et les lignes passées rapetissent ; tant que des lignes s'écrivent, le lot tourne.

**Références.** beui.dev Streaming Response (code lu : curseur à vitesse fixe, texte complet en mouvement réduit), Agent Activity (un journal unique), Todo List (statut par forme) ; motionin.design Benchmark (lentille de focus : taille et couleur seulement, sans flou, pas « expo in-out »), Pixels (une ligne pleine largeur sépare l'ancien et le nouvel état) ; 60fps List Fade Up from Down ; guide beui « linear for progress ».

**Sens des signes.** Carré plein = posé ; carré vide = différé ; carré à moitié plein = posé, à examiner ; tiret = ligne d'état ; ligne ocre « À vous : … » = attente de l'opérateur ; trait rouge en travers = arrêt ; barre de progression pleine = total connu, pointillée = total inconnu (écrit).

**Partition de mouvement.**
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| un cut traité | une nouvelle ligne s'écrit (≈ 55 signes/s) ; la précédente rapetisse et pâlit, les autres reculent d'un cran | écriture ≈ 0,6 s ; lentille 500 ms (.77,0,.175,1) | le lot tourne | ligne entière, tailles posées |
| progression | la barre avance | 900 ms, linéaire | avancement mesuré | barre posée |
| pause | ligne « En pause, reprend au cut N » ; le curseur clignote seul | clignement 1,1 s, en marches | rien ne s'écrit, on attend | curseur fixe |
| arrêt | un trait rouge se trace sur toute la largeur, puis « Arrêté au cut N » s'écrit dessous ; plus de curseur | 600 ms (.77,0,.175,1) | le fil est coupé | trait déjà tracé |
| incident / alerte | la question devient la ligne en focus, en ocre ; curseur rapide | clignement 0,7 s | Ariane attend l'opérateur | curseur fixe |
| relecture | ligne « Relecture de la partie N », sans curseur | — | relit | idem |
| fin | ligne de bilan en focus ; les autres se resserrent | 500 ms | terminé | posé |
| Écho : une pose vue | « Vous avez posé le cut N » s'écrit, avec « Ariane aurait posé pareil / autrement » | ≈ 0,6 s | Ariane observe | ligne entière |
| entrée d'un incident, d'une ligne de reste | apparition 5 px + opacité | 350–400 ms (.16,1,.3,1) | nouveau contenu | sans déplacement |
Le fil est conservé ; on n'y ajoute que ce qui vient d'arriver (un cut, un changement d'état).

**Pourquoi sans filiation.** Aucun fichier d'Ariane ni d'une autre maquette ouvert ; structure issue des composants d'agents de beui.dev et de Benchmark.
**Ni voie ni nuage.** Un journal de texte : aucun dessin de voie, de rail ni de points.

**Autocritique.** Le curseur clignotant est un code d'interface très connu (terminal) ; les lignes de cuts déjà traités au chargement d'une scène sont reconstituées à partir de l'état (pas d'historique réel) ; de loin, une ligne qui s'écrit est moins visible qu'un grand mouvement.

**Vérificateur.** 4 440 textes, contraste minimal 6,69:1, 0 écart, 0 erreur. Raffinement : séparateur « · » entre cut et motif, plus de curseur à l'arrêt et à la fin, hauteur minimale du fil réduite (plus de vide en Prêt), bascule soulignée.
