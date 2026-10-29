# Maquette instr-orbe (« Orbe »)

**Logique en une phrase.** Un seul objet en points dont la forme dit ce que fait Ariane, lisible de loin sans lire un mot : orbites quand elle pose, tresse quand elle relit, onde quand elle observe, anneau qui respire quand elle attend, triangle quand elle a besoin de vous, carré quand c'est fini.

## Références et ce qui en est pris
- ThinkingOrbs, `OrbEngine.swift` : projecteur lacet + inclinaison orthographique, tri du loin au proche, rayon et encre selon la profondeur (le proche plus gros et plus foncé) ; designs « orbits » (orbites inclinées et leurs particules), « braid » (trois brins tressés), « ring » (anneau de face, ondulation radiale à deux tempos), « morph » (contour à pas égaux, cercle → triangle → carré, passage lissé 0,9 s). Réécrit en canvas 2D, sans copie ; orbites et brins tracés en trait continu (plus lisibles qu'en points épars).
- ThinkingOrbs, `ThinkingOrbLabel.swift` : bande de lumière qui traverse le label tant que ça agit — posée par-dessus une encre pleine (le contraste reste mesurable ≥ 4,5:1).
- ThinkingOrbs, `ThinkingOrb.swift` : une image fixe représentative en mouvement réduit.
- libraries.dev, bot-avatars (`engine.ts`) : un état = une pose et son mouvement ; changement d'état par mélange de poids, 0,7 s vers le travail, 1,2 s vers le repos.
- Écartés : le globe (« searching ») et la sphère pleine, trop proches d'un nuage de points.

## Sens des signes
- Orbites = Orbite, Ariane pose ; une orbite s'éclaire à chaque cut posé. Orbites figées et pâles = pause.
- Tresse = relecture et correction entre deux parties.
- Onde sur un anneau = Écho ; elle gonfle à chaque geste vu.
- Anneau qui respire = prêt, rien ne tourne.
- Triangle en ambre + mot = besoin de vous (arrêt, alerte, ESV absent, onglet à choisir). Carré = terminé.
- Chapelet de 40 grains : pleins = fait, creux = reste, triangles = différés ; total inconnu = seulement les grains faits + les mots.
- File : carré = partie faite, orbite = en cours, triangle = arrêtée, anneau = à venir ou en relecture.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Arrivée d'un cut | une orbite s'éclaire puis s'éteint ; dernier grain du chapelet gonfle ; chiffre monte | relâche 0,5 s ; grain 0,45 s (×1,9 → 1) ; chiffre 0,3 s | un cut posé | image fixe, grain posé |
| Prêt → en cours | l'anneau cède aux orbites par mélange de poids | 0,7 s linéaire sur les poids | au travail | forme finale |
| → pause | orbites figées, pâlies à 45 % | 1,2 s | suspendu | forme finale |
| → arrêté / alerte | le contour se plie de cercle en triangle ambre | 1,2 s de mélange + 0,9 s de pliage lissé | à vous | triangle fixe |
| → fin | contour en carré | idem | terminé | carré fixe |
| Relecture | tresse qui tourne | 0,7 s pour entrer | relit | tresse fixe |
| Écho, geste vu | l'onde gonfle (×1,3) puis revient | attaque immédiate, relâche 0,6 s | vu | anneau fixe |
| Label | bande de lumière | 2 s, phase tenue entre rendus | Ariane agit | absente |
| Liste / blocs | mise à l'échelle 0,97 → 1 + fondu, au changement de vue | 0,32–0,4 s | | aucun |

## Pourquoi sans filiation
Feuille blanche ; l'objet vient du vocabulaire de ThinkingOrbs (verbes d'un agent), rien d'une interface existante.

## Pourquoi ni voie ni nuage
L'orbe est fait d'orbites, de brins et de contours tracés, pas d'un semis de points : il ne figure ni le relevé LiDAR ni la voie ; la seule coupe est la vue fonctionnelle « Examiner ».

## Autocritique
- Une orbe animée reste un « loader d'IA » reconnaissable : le risque « vibe codé » est réel si le sens des formes n'est pas appris ; il est donc écrit sous l'orbe à chaque état (« Orbites · Ariane pose »).
- Le chapelet double un peu l'information du chiffre « restent ».
- La forme change de nature entre états : de très loin, orbites et tresse peuvent se confondre.

## Vérificateur
`instr-orbe : 7518 textes mesurés, contraste minimal 5.68:1, 0 écarts, 0 erreurs de console`. Jeu complet : 0 erreur.
