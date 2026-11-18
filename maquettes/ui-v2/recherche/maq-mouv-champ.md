# Maquette mouv-champ (« Le champ »)

**Logique.** Chaque cut du lot est une marque dans un champ ; chaque marque traitée se pose et une petite vague remonte derrière elle au rythme du travail ; à l'arrêt les marques qui restent se rétractent ; quand Ariane attend l'opérateur, la marque du cut courant tourne en losange et se balance.

**Références.** koipond (code lu : une horloge, traces qui s'éteignent en 1 à 3 s, bascule par ressort sans à-coup, ce qui part disparaît avant ce qui arrive) ; beui.dev Status Bar (une barre par période, légende écrite), Todo List (statut par forme) ; motionin.design Filament (chaque élément est un ressort vers sa forme cible), Amour (mouvement réduit = état final composé) ; 60fps Revolut Coachmark (un seul repère « regarde ici »).

**Sens des signes.** Carré plein = posé ; carré vide = différé ; carré à moitié plein = posé, à examiner ; point = à faire ; case bleue cernée = cut courant ; case en pointillé = la suite quand le total est inconnu ; losange bleu = à vous ; carré rouge + grains = arrêté. Une légende écrit chaque forme (formes mesurées à ≥ 3:1).

**Partition de mouvement.**
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| un cut traité | la marque se pose (0,2 → 1,35 → 1) ; les 7 marques précédentes se soulèvent l'une après l'autre (vague de 40 ms) | 480 ms (.16,1,.3,1) ; vague 420 ms (.77,0,.175,1) | le lot tourne | marque posée |
| pause | la marque du cut suivant se lève et grossit, puis reste | 450 ms, ressort | attend | posée levée |
| arrêt | les points restants se rétractent en grains, de proche en proche (6 ms par marque) ; le cut courant devient rouge | 350 ms + décalage | se tait | grains posés |
| incident / alerte | le cut courant pivote en losange et se balance | 2,4 s en boucle | à vous | losange fixe |
| relecture | une bande balaie le champ de gauche à droite | 2,8 s linéaire, en boucle | relit | bande absente, mot « relecture » |
| fin | une vague unique traverse tout le champ (4 ms par marque), puis tout s'immobilise | ≈ 1,3 s | terminé | champ final |
| Écho : une pose vue | une marque se pose (pleine si Ariane aurait posé pareil, vide sinon) | 480 ms | Ariane observe | posée |
Le champ est conservé ; seules les classes des marques changent ; les animations sont déclenchées par la seule avancée d'un cut.

**Pourquoi sans filiation.** Aucun fichier d'Ariane ni d'une autre maquette ouvert ; surface vivante pensée à partir de la mécanique de koipond, sans eau, sans carpes, sans nénuphars.
**Ni voie ni nuage.** Une grille de marques, une par cut, comme un relevé de statut jour par jour : pas de voie, pas de rail, pas de nuage de points (la première version couchait les marques en traits ; remplacée par des grains pour éviter toute lecture de traverses).

**Autocritique.** Une grille de carrés peut rappeler un graphique « gaufre » générique ; les marques font 12 px (lisibles de près, l'état de loin se lit surtout par la vague et le losange) ; en Écho, l'ordre des poses « d'accord / autrement » est reconstitué (le moteur ne donne que des totaux).

**Vérificateur.** 5 022 textes, contraste minimal 6,44:1, 0 écart, 0 erreur. Raffinement : contraste des points « à faire » relevé (2,9 → plus de 3:1), arrêt en grains au lieu de traits.
