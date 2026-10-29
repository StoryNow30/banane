# Référence : mouvement (60fps.design, motionin.design, beui Motion Guides, swiftpieces) — famille « info- »

## Ouvert exactement
- 60fps.design, page d'accueil (Chromium, 200) : catalogue de 2 125 interactions d'applications ; titres lus, par exemple « Battery Fill Up Interaction », « Coachmark Border Pulse Interaction », « Create / Delete Pocket Interaction ». Les vidéos ne sont pas lues dans une capture fixe : leur contenu est **SUPPOSÉ** d'après les titres.
- motionin.design, page d'accueil (200) : galerie de sections web « premium » (Aperture, Moments, Boutique, Loupe, Morph…), toutes de type vitrine plein écran — ÉTABLI (descriptions lues).
- beui.dev Docs « Motion Guides » — lu en entier, ÉTABLI (détail dans ref-donnees.md).
- swiftpieces : Odometer, LiveStat, ActivityHeatmap (notes de mouvement réduit) — ÉTABLI.

## Ce que j'en retiens
- 60fps : la « pulsation de bordure » sert à désigner une chose nouvelle sans la déplacer ; le « remplissage » (batterie) dit une quantité qui monte. Deux gestes utiles, à condition d'être uniques et non bouclés.
- motionin : des mouvements de vitrine (parallaxe, gravité au curseur, défilement infini) — **à l'opposé** de ce qu'il faut à un panneau surveillé 100 fois par heure (beui : « 100 fois par jour : aucune chorégraphie »). Je n'en prends rien, et je le dis.
- beui : but nommé, courbe selon ce que fait l'objet (sortie/entrée ease-out, déplacement ease-in-out, **progression linéaire**), < 300 ms, l'ancien part plus vite que le nouveau n'arrive, mouvement réduit dessiné (opacité et couleur gardées, course et échelle retirées).
- swiftpieces : seuls les chiffres qui changent bougent ; pas de rebond sur un chiffre ; en réduit, le chiffre change sur place et un trait fin signale le changement.

## Contraintes techniques du moteur (lues dans commun.js)
- Le panneau est **re-rendu entièrement toutes les ≈ 0,9 s** en cours de lot : une transition CSS sur un élément recréé ne joue jamais. Donc : animations `@keyframes` déclenchées par la classe `change` (posée par le moteur seulement au rendu où le texte d'un `data-valeur` change, jamais en mouvement réduit) ou par `#panneau[data-etat-change="1"]` (rendu qui suit un changement de phase, vue ou activité) ; tout mouvement continu vit dans un élément `data-garder`, mis à jour dans `apres()`.
- Toute durée ≤ 0,8 s pour qu'une animation déclenchée finisse avant le rendu suivant (qui la supprime en recréant l'élément sans la classe).
