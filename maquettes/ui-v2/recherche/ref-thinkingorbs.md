# Référence : ThinkingOrbs (dépôt haplollc/thinkingorbs, lecture seule)

## Ce que j'ai ouvert (ÉTABLI = lu)
- `README.md` entier (332 lignes), `CONTRIBUTING.md`, début de `docs/demo.html`. ÉTABLI.
- `Sources/ThinkingOrbs/Engine/OrbEngine.swift` (739 lignes) entier : primitives (hash, bruit, Fibonacci, projecteur rotation + inclinaison orthographique, tri en profondeur), et les 9 designs : working (orbits), searching (globe), solving (rubik), listening (wave), connecting (web), weaving (braid), composing (ribbon), breathing (ring = ribbon de face), shaping (morph). ÉTABLI.
- `Engine/OrbPresets.swift` (préréglages 9 × 2 tailles, profils de base, mise à l'échelle des comptes). ÉTABLI.
- `ThinkingOrb.swift` (rendu, horloge partagée, mouvement réduit, visibilité), `ThinkingOrbLabel.swift` (label scintillant), `OrbDesign.swift`. ÉTABLI.
- Tests et scripts vus en liste seulement (PROBABLE : vecteurs de référence et balayage différentiel décrits dans le README).

## Mécanismes retenus
- **Rendu 3D en points** : chaque point vit sur une sphère unité (anneaux de latitude, densité en longitude ∝ cos(lat), ou réseau de Fibonacci) ; projecteur = lacet `t × vitesse` puis inclinaison fixe (0,3–0,4 rad), projection orthographique ; profondeur `(z+1)/2` ; rayon `rBase + rDepth × profondeur`, encre `inkFar − inkSpan × profondeur` (le proche est plus gros et plus foncé) ; points sous 0,02 d'opacité retirés, tri stable du loin au proche ; rayon minimal. Monochrome, encre inversée en sombre pour que le proche lise toujours le plus fort.
- **Chaque design est un verbe** : orbites = travail général ; méridien qui balaie = chercher (le balayage est une *ondulation de taille*, pas un éclat) ; bandes qui se mélangent puis se remettent en place par palindrome = résoudre (la bande qui tourne s'encre plus foncé, « la main ») ; onde à deux tempos = écouter ; constellation et paquets qui courent = se connecter ; trois brins tressés = planifier ; ruban = rédiger ; anneau de face qui respire = attendre ; contour cercle → triangle → carré (tenue 1,4 s, passage 0,9 s, lissé) = mettre en forme, points répartis à pas égaux le long du contour mélangé.
- **Label** : texte à 45–50 % d'opacité + une bande de lumière (masque en dégradé) qui traverse toutes les 2 s ; à pleine force en mouvement réduit ou contraste accru.
- **Mouvement réduit** : une seule image représentative (t = 0,6), qui suit encore le thème. Horloge partagée : toutes les orbes en phase ; pause hors écran et en arrière-plan.
- **Changement d'état** : fondu enchaîné 0,25 s de l'ancienne orbe vers la nouvelle dans le même emplacement.

## Ce que j'en fais pour Ariane
- Une orbe dont la *forme* dit ce que fait Ariane (maquette instr-orbe) : orbites pendant le lot (le design « working », et le nom même de l'activité Orbite), une orbite qui s'éclaire à chaque cut posé, anneau qui respire au repos, onde pour Écho (elle observe), tresse pour la relecture entre deux parties, contour qui se plie en triangle (besoin de vous) ou en carré (terminé). Forme + mot, jamais la couleur seule. Orbites et brins tracés en traits continus : un semis de points épars rappelait trop un nuage.
- Écarté aussi après essai : « solving » (rubik), dont la sphère pleine de points évoque un relevé.
- Le principe « le proche est plus gros et plus foncé » pour la profondeur, et le tri du loin au proche.
- Le scintillement du label, mais sans baisser l'encre du texte (le contraste mesuré doit rester ≥ 4,5:1) : la bande de lumière passe *par-dessus* un texte déjà à pleine encre.

## Ce que j'écarte
- Le globe (searching) : une sphère de points trop proche d'un « nuage de points » ; l'opérateur a rejeté toute figuration du relevé.
- La constellation (connecting) : réseau décoratif sans sens ici.
- L'encre réduite du label (contraste insuffisant).

## Erreurs d'accès
Aucune (dépôt local).
