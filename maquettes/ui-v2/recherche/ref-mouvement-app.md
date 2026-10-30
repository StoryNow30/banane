# Références de mouvement, série app- : 60fps.design, beui.dev, motionin.design, KoiPond

(Fiche de la série `app-`. Une autre fiche `ref-mouvement.md` existe dans ce dossier : elle est d'un autre concepteur ; la mienne, d'abord écrite sous ce nom, a été remplacée par la sienne, je la réécris ici sans toucher à la sienne.)

## Ouvert exactement (Chromium, tout en 200, aucun défi)
- **60fps.design** : accueil ; filtres `/shots/filter/bottom-sheet` (358 exemples), `/progress` (323), `/toast` (36), `/tabs` (117). Vidéos regardées image par image (8 images chacune) : « Recollect Pro bottom sheet to page » (« Compact bottom sheet paywall expands into a full-screen feature overview with spring physics »), « Trackables card morph to screen » (carte qui devient l'écran de détail), « X create new folder sheet » (un toast propose une action qui devient une feuille). Description lue : « Methods notifications pop » (cartes en cascade qui poussent le contenu).
- **beui.dev** : accueil ; guide `/docs/motion-patterns` lu en entier ; `/components/blocks/dynamic-island` manipulé (boutons Timer et Call, captures à 120 ms et 900 ms) ; `/components/motion/bottom-sheet` ouvert (API : `snapPoints` défaut `[0.5, 0.92]`, `dismissThreshold` 120 px) ; `/blocks/expandable-tabs`, `/blocks/command-palette`, `/motion/number`.
- **motionin.design** : accueil (galerie « Motion that stops the scroll » : Aperture, Moments, Boutique, Cabinet, Loupe, Morph).
- **KoiPond** (dépôt `haplollc/koipond`) : `README.md`, commentaires de `World/KoiPondWorld.swift` et `World/Haptics.swift`.

## Retenu (ÉTABLI)
- beUI, quatre questions avant de bouger : **fréquence** (« 100× a day: no choreography »), **but** (« If you cannot explain why it moves, remove the movement »), **physique** (ease-out pour entrer, ease-in-out pour ce qui est déjà là, linéaire pour un progrès, ressort pour un geste), **repli** (mouvement réduit : garder opacité et couleur, retirer trajet, échelle, parallaxe).
- beUI, durées : appui 100–160 ms ; info-bulle 125–200 ms ; menu 150–250 ms ; tiroir / feuille 200–500 ms ; « Under 300ms is the default ». Courbes : EASE_OUT `[0.16, 1, 0.3, 1]`, EASE_IN_OUT `[0.77, 0, 0.175, 1]`.
- beUI : « Layout continuity : move the shape first, then introduce its label » ; « Content swap : let the old content leave faster than the new content arrives. Keep travel to a few pixels ».
- beUI, île dynamique : pilule « ● 9:41 » qui s'élargit en « TIMER 2:34 » (petit libellé en capitales + chiffre qui roule) ou en appel entrant avec deux actions.
- 60fps : la feuille compacte qui devient page (même surface qui grandit, ressort) ; le toast qui mène à une feuille.
- KoiPond : « A critically damped spring, so the water starts to turn gently and settles in about a second, rather than lurching off at full speed on the first frame » ; ce que l'on lâche continue à la vitesse du doigt ; un changement de mode en deux temps (les koi s'en vont, puis les flotteurs arrivent).
- motionin : sections de site spectaculaires ; rien pour un panneau d'outil, sinon la retenue par contraste.

## Contrainte technique mesurée (29/10, Chromium, fichier d'essai dans `app/essai/`)
Le moteur réécrit `#panneau` à chaque tic ; un nœud gardé est détaché puis rattaché. Mesure : une transition CSS en cours **saute à sa fin** (largeur 293 px → 1 010 px d'un coup) et une animation CSS **repart de zéro** ; une animation Web (`element.animate`) **continue** (343 px → 393 px → 610 px). Toutes les maquettes `app-` font donc leurs mouvements par `element.animate` sur une racine gardée et mise à jour par différence.

## Écarté
- Tout mouvement en boucle qui ne dit pas « ça tourne » ; effets de curseur, parallaxe ; rebond sur les chiffres.
