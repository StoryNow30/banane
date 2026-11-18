# Référence : Scrubbers (dépôt haplollc/scrubbers, lecture seule)

## Ce que j'ai ouvert (ÉTABLI = lu en entier)
- `README.md` (320 lignes), ÉTABLI.
- Cœur : `Sources/Scrubbers/Scrubber.swift` (geste, session, vitesse, fin de geste, marionnette), `ScrubberStyle.swift` (Spec de chaque style : correspondance, relâche, ressorts), `Core/ScrubberMotion.swift` (trois correspondances, bande élastique d'Apple, projection de l'inertie), `Core/ScrubberScale.swift` (crans, fraction, cran le plus proche, dernier intervalle court), `Core/ScrubberFace.swift` (vecteur animable fraction/prise/étirement/vitesse, retour haptique au cran et au butoir), `Core/LiveClock.swift`, `Core/ScrubberOptions.swift`, `Core/ScrubberTime.swift`, début de `Core/ScrubberPuppet.swift`. ÉTABLI.
- Les 12 faces, code lu en entier, ÉTABLI : Ruler, Glass, Jelly (+ JellySim), Elastic, Fluid, Squiggle, Thermostat, Swing, Mood, Tape, Effort, Emoji.
- Non ouvert : `Demo/` (application de galerie), `Tests/`, GIF (vus seulement en liste : PROBABLE qu'ils montrent ce que le code décrit).

## Mécanismes retenus (pas le code)
- **Une seule source du geste, des faces par-dessus.** Le geste devient une fraction 0–1 par trois correspondances : *absolue* (le doigt est la valeur), *relative* (le trajet déplace la valeur ; inversée pour une échelle qu'on tire sous une aiguille fixe), *angulaire* (l'angle autour d'un centre, déroulé tour après tour, pour le cadran du thermostat).
- **Quatre grandeurs animées ensemble** : position, prise (0 au repos, 1 sous le doigt), étirement (dépassement en bout, amorti par la bande élastique `(1 − 1/(x·0,55/d + 1))·d`), vitesse lissée (0,7 ancienne + 0,3 nouvelle, retombe à 0 si le doigt s'arrête 70 ms).
- **Relâche** : soit ressort vers le cran le plus proche (réponse 0,34 s, amortissement 0,82), soit *glisse* (la bande coule de vitesse × 0,32 s puis se pose sur un cran, ressort 0,62 s à peine rebondissant). Un doigt arrêté avant de lever ne lance rien.
- **Crans** : un pas qui ne divise pas la plage laisse un dernier intervalle court, la borne haute est toujours un cran. Un tic haptique à chaque cran franchi, un coup plus ferme au butoir.
- **Mouvement réduit** : relâche en fondu court (0,2 s) au lieu du ressort, pas de glisse, la gelée reste à plat, rien ne bouge seul ; les horloges vivantes s'arrêtent aussi hors écran et en arrière-plan.
- **Accessibilité** : chaque style se présente comme un curseur standard, pas par pas, et lit le même texte que celui affiché.
- Par face : **Ruler** (traits qui gonflent en cloche gaussienne σ = 15 % de la piste autour de l'aiguille, étiquette courante en gras, voisines qui s'écartent) ; **Tape** (échelle sous aiguille fixe, grands traits tous les ≥ 54 px, bords en fondu, lecture en gros qui roule chiffre par chiffre, aiguille qui grandit à la prise) ; **Thermostat** (300° de graduations, celles jusqu'à la valeur allumées, un long trait pour la valeur, le cadran se remplit d'une couleur seulement hors du tiers central, en partant du centre pour éviter la teinte boueuse) ; **Jelly** (chaîne de Verlet de 17 points, arche proportionnelle à la compression, longueur qui se détend vers la poignée : à plat au repos) ; **Fluid** (flou + seuil alpha = col gluant qui relie la goutte à la barre) ; **Squiggle** (onde qui roule tant que ça « joue », se couche à plat quand on tient ou quand c'est en pause) ; **Swing** (étiquette qui penche contre le mouvement, revient sur ressort sous-amorti) ; **Elastic** (piste qui s'épaissit à la prise, s'amincit en s'étirant : volume conservé) ; **Mood** (une forme qui passe d'épineuse à ronde à florale, un mot nomme la zone) ; **Effort** (barres montantes, seule celle qu'on atteint saute : 1,16 → 0,93 → 1) ; **Glass** (pastille qui devient lentille en grossissant ce qu'elle couvre) ; **Emoji** (pouce qui grossit avec la valeur, éclats au lâcher).

## Ce que j'en fais pour Ariane
- Cadran à 300° pour l'avancement du lot, remplissage seulement quand l'opérateur doit agir (le sens « hors de la zone calme » du thermostat), réglage des bornes par rotation avec crans de 10 cuts.
- Ruban sous aiguille fixe qui glisse d'un cut à l'autre (ressort, pas de saut), cloche de traits autour du cut courant.
- Onde qui roule tant qu'Ariane pose, couchée à plat en pause (squiggle) : « à plat = rien ne bouge » se lit de loin.
- Barre qui saute seulement quand elle est atteinte (effort) pour la partie en cours d'une file.
- Toujours : réglage au clavier par crans, lecture identique à l'affichage, et le mouvement réduit remplace chaque ressort par un fondu court.

## Ce que j'écarte et pourquoi
- Emoji et Mood (affect, couleurs de l'humeur) : sans rapport avec un lot de cuts.
- Glass (lentille) : coûteux, décoratif ici.
- La palette vert→rouge d'Effort : couleur seule porteuse de sens, interdit par le cahier.

## Erreurs d'accès
Aucune (dépôt local).
