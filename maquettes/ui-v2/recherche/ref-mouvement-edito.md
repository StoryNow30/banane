# Références de mouvement (60fps.design, motionin.design, beui.dev) — lues pour la famille « Éditorial »

## Ouvert (Chromium, 29/10)
- **60fps.design** (accueil, 7 596 px) : « Endless collection of delightful details from best-in-class apps » ; rubriques Shots 2125, Apps 494, Motion 83, Snippets 32, Storyboards 67 ; chaque fiche est une interaction filmée nommée par ce qu'elle fait (« Revolut Select Plan Tab Scroll Interaction », « Revolut Create Delete Pocket Interaction »). ÉTABLI.
- **motionin.design** (accueil, 12 487 px) : titre « Motion that stops the scroll. » écrit lettre à lettre (le texte de la page le découpe en caractères isolés) ; chaque pièce est décrite par une longue partition écrite (« A single raw requestAnimationFrame loop owns the wall… GSAP drives only the entrance bloom… a flat reduced-motion fallback »). ÉTABLI.
- **beui.dev** : accueil, puis « Number Animation » (Digit Swap : chiffres dans des cases fixes, `direction: up|down`, `animationKey` pour rejouer), « Text Animation » (Text Scramble : caractères tirés d'un jeu de glyphes jusqu'au texte final, durée maximale bornée), « Agent Activity » (Streaming Text : « le flux mesuré monte par une seule transformation au lieu de faire sauter le défilement » ; Reasoning Steps : « Thought for 4s » puis étapes cochées, « 3 states »), « Timeline ». ÉTABLI.
- Dépôt swiftpieces (lecture seule), `content/docs/components/text/text-reveal.mdx` : la cascade est calculée **d'après le nombre d'unités pour que le total tienne en ~0,8 s**, chaque unité met ~0,5 s à se poser, l'opacité « ne suit jamais le rebond » ; `feedback/status-morph.mdx` : un seul trait qui tourne pendant le chargement puis se ferme en coche ou en croix ; `controls/hold-to-confirm.mdx` : action destructive par appui maintenu qui se remplit. ÉTABLI (lu, non recopié).

## Ce que j'en retiens
1. **Écrire la partition** comme motionin : qui possède le mouvement, ce qui bouge, la version réduite.
2. **Chiffre à cases fixes qui roule** (Digit Swap) : le seul mouvement autorisé sur ce qui change toutes les 0,9 s, parce qu'il dit « ce nombre vient de bouger » sans déplacer la mise en page (chasse fixe obligatoire).
3. **Le texte qui s'écrit** (Streaming Text) : une phrase d'état nouvelle apparaît mot à mot, total borné (~0,6 s), seulement quand la phrase change de sens (changement de phase), jamais à chaque tic.
4. **Étapes cochées** (Reasoning Steps) : la file de parties et la relecture se racontent comme une liste d'étapes qui se cochent.
5. Le **trait qui se ferme** (status-morph) rejoint le trait de crayon d'iter0 : un trait qui se dessine = une chose finie.

## Ce que j'écarte
- Scramble de caractères sur des nombres de travail : il ferait lire un faux chiffre pendant 300 ms ; interdit sur un compteur.
- Ressorts avec rebond, flous, morphings de modales : décor ou trop lents pour un panneau qu'on consulte cent fois.
