# Référence : backgrounds.supply (famille « matière », 29/10)

## Ce que j'ai ouvert exactement
- Accueil (statut 200, 10 617 px, 8 captures en défilant) : héros magenta sur noir (rendu par un outil de shader tiers cité en lien), « Problems », « Usecases » (Presentations, Wallpapers, Social Media, Banners, Websites and Apps), prix, « Peek into the vault » : 29 collections avec leur nombre, FAQ, pied. Une fine barre rose en haut suit le défilement ; des tirets verticaux à gauche marquent la section. ÉTABLI.
- Discover (`/wallpapers`) : liste des 31 collections (avec Viridian, Bloomhaze, Surrealis 1-3). ÉTABLI. Première visite : capture refusée par délai (« page.screenshot: Timeout 30000ms exceeded », page trop lourde) ; deuxième visite avec délai allongé : correcte.
- Collections ouvertes une par une (3 captures chacune) : Chromatica, ASCII, Portals, Horizon, Nocturne, Smudge, High-exposure Gradients, Animated Backgrounds, Prismal, Iridescence, Aurorix. ÉTABLI. Chaque page : fil d'Ariane, titre, compte, grille 4 colonnes ; 2 à 5 vignettes « Free » nettes, toutes les autres **floutées** et marquées « Locked ».
- Freebies (16 118 px) : la grille de vignettes reste vide en défilant vite (chargement paresseux) ; textes lus. ÉTABLI pour le texte, PROBABLE pour les images.
- Blog : liste de 7 articles ; lus en entier : « How to Use Gradient Backgrounds in UI and Presentations », « How to Make an Animated Background (No-Code + CSS) », « Video Backgrounds for Websites ». ÉTABLI.
- Gradient Lab : fenêtre « New in Gradient Lab » fermée par « Got it », puis essai des modes Light Beam, Edge Glow, Curtains, Spectral, Contour, Prism, Smoke, Aurora, Rays (captures + liste des réglages). Eclipse, Halftone, Bands, Concentric, Caustics, Voronoi, Bokeh : le bouton n'a pas répondu au clic en 8 s (« locator.click: Timeout 8000ms exceeded »), vus seulement en liste. ÉTABLI / PROBABLE.

## Comment un fond porte une information (analyse)
1. **Le flou dit l'accès** : dans chaque collection, la même grille montre net = disponible, flou + « Locked » = pas encore à vous. Le fond n'est pas décoratif : sa netteté est un état, doublé d'un mot.
2. **Un fond est un paramètre, pas une image** : dans le Gradient Lab, chaque mode n'a que quelques réglages nommés (Light Beam : angle, softness, edge, hot spot, hot spot size ; Edge Glow : height, falloff ; Prism : position, width, intensity ; Contour : scale, light angle, relief ; Smoke : density, swirl). Brancher une donnée sur UN réglage (hauteur de la lueur = avancement, largeur du prisme = part traitée) transforme le fond en jauge.
3. **Règles écrites par le site lui-même** : deux ou trois teintes voisines, jamais plus ; « contrast is non-negotiable » : mettre le texte sur la zone la plus sombre ou sous un voile uni, mesurer contre le point le plus clair ; mouvement lent (18 s ou plus) pour rester ambiant ; respecter « reduce motion » en revenant à l'image fixe ; ne pas mettre de fond animé quand le message doit se lire tout de suite.
4. Collections utiles par leur logique : **Horizon** (une ligne de lumière basse, planètes, aube) ; **Nocturne** (figures faites de points blancs sur noir) ; **ASCII** (silhouettes en caractères) ; **High Exposure** (lumière surexposée qui brûle le blanc) ; **Smudge** (matière peinte, frottis) ; **Prismal / Iridescence** (verre et irisation).

## Ce que j'en retiens pour Ariane
- Netteté = état (flou = rien à faire pour vous, net = vous êtes attendu) → `matiere-detour`.
- Un seul paramètre de lumière branché sur une donnée : Edge Glow « height » → hauteur du jour dans `matiere-horizon` ; Prism « width » → largeur du spectre dans `matiere-spectre`.
- Mouvement ambiant très lent, figé quand rien ne tourne ; image fixe en mouvement réduit.
- Peu de teintes, voisines.

## Ce que j'écarte et pourquoi
- Le magenta de marque et les fonds « wow » plein écran : ils couvrent le texte, et un panneau de 360 px n'a pas la place d'un héros.
- Les vidéos MP4 : poids, et une maquette autonome sans réseau.
- Les dégradés multicolores sans donnée derrière.

## Erreurs d'accès
- Discover, première visite : « page.screenshot: Timeout 30000ms exceeded » (page lourde), réussie à la deuxième.
- Gradient Lab : 7 modes n'ont pas réagi au clic (« locator.click: Timeout 8000ms exceeded »).
