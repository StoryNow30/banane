# Références de mouvement : 60fps.design, motionin.design, beui.dev (29/10)

## Ce que j'ai ouvert
- 60fps.design : accueil (2 125 « shots », filtres 3D, Blur, Bounce, Card…), et cinq animations (4 instants chacune) : batterie qui se remplit (Duolingo), bordure de recherche qui s'allume (Uber), balayage sombre sur une carte (Revolut « Single Use Pulse Card Sweep »), cadran 3D (Aave), bordure qui pulse sur un repère (Revolut coachmark). ÉTABLI.
- motionin.design : accueil (« Motion that stops the scroll »), la galerie et le **texte de spécification** de chaque section (Aperture, Loupe, Morph, Burst, Lens Bloom, Cutout, Emulsion, Iris, Atlas, Reverie). ÉTABLI.
- beui.dev : accueil, « Motion primitives » (Button, Morphing Modal, Animated Toast Stack, Action Swap, Dock, Tabs, Dynamic Island, Command Palette), graphiques animés. ÉTABLI en liste, PROBABLE pour le détail.

## Principes retenus (cités de leurs spécifications, reformulés)
1. **Une seule chose bouge** (motionin, Cutout : « rien sur la table ne bouge, seul le papier bouge ») : dans chaque maquette, une seule matière porte le mouvement.
2. **Une horloge, une valeur** (Lens Bloom, Reverie : « un seul scalaire de progression » pilote tout) : l'avancement du lot est ce scalaire ; le dessin se rapproche de lui en douceur (lissage), il ne saute jamais.
3. **Arrivée en deux temps** (Burst, Lens Bloom : la scène, puis le texte « comme un second temps ») : à un changement d'état, la matière change d'abord, le titre arrive 120 ms après.
4. **Mouvement réduit = fondu lent, jamais d'éclair noir** (Iris) ; image fixe (blog backgrounds.supply).
5. **Signal ponctuel** (60fps : bordure qui pulse une fois, balayage) : une demande d'attention est un geste bref et unique, pas une boucle.
6. **Pause = arrêt réel** : quand rien ne tourne, rien ne bouge (Atlas « pauses when hidden »).
