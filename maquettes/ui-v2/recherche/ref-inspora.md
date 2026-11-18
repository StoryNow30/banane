# Référence : inspora.design (famille « matière », 29/10)

## Ce que j'ai ouvert exactement
- Accueil (statut 200) : barre « Explore / Contact », champ d'abonnement, « Updated hourly », filtres All · Web · Branding · Product · Motion · Illustration · 3D · Print, tri « Latest », grille en 4 colonnes de pièces (vidéos ou images), avatar de l'auteur en coin, « Try loading more » en bas. ÉTABLI.
- Les 7 catégories, chacune défilée 14 fois avec clic sur « Try loading more » (captures à 2 et 8 pas). Pièces relevées par catégorie : Web 16, Branding 16, Product 16, Motion 16, Illustration 16, 3D 8, Print 5 (le bouton « Try loading more » n'a pas ajouté de pièces au-delà). ÉTABLI pour la liste.
- **Ouverture des pièces : refusée.** J'ai tenté 26 pièces (shark-ascii-animation, black-hole-mp4, compressing-images, progressive-blur, mesh-gradients, metal-effect, liquid-metal, holographic-card, holo-3d-card-effect, glass-slider-experiment, plasma-app, glass-circle-with-a-gradient, usage-meter-component, quiet-overlapping-clocks, blurry-pioneer-interfaces, soft-fluid-systems, subtle-text-scale-effect, hairlines-v2, elemental-cards, experimental-visual-cards, literal-file-tree, kayaks-on-the-water, enter-the-unknown, paper-fold-animation, scenic-footer-section, 1-26). Toutes ont répondu **HTTP 429 « Failed to verify your browser — Code 21 — Vercel Security Checkpoint »**. Nouvelles tentatives isolées plus tard (progressive-blur, puis kayaks-on-the-water, une page à la fois, plus de vingt minutes après) : même réponse. Conformément au contrat, je n'ai pas contourné. Les pièces ci-dessous sont donc analysées **depuis la grille** (vignette animée vue à 1440 px), niveau PROBABLE.

## Pièces regardées dans la grille (PROBABLE, 22 pièces)
- Motion : un essaim de poissons fait de traits blancs sur bleu nuit, un petit kayak rouge au milieu (kayaks-on-the-water) — la densité des traits dessine le courant ; un nuage de points colorés en perspective qui fuit vers un point (ASCII/particules) ; une figure rouge en trame de points sur noir ; une carte « Holographic » irisée sur noir ; un dossier en arbre de fichiers qui pousse comme une liane (literal-file-tree) ; des orques en trame bleue (pixels) ; un fond bleu ciel « aurore » avec des poignées de dégradé (mesh-gradients).
- Product : trois cartes « Parsing / Planning / Reasoning » dont **le fond coloré est l'avancement** (une barre lumineuse dans la carte, « 97 % » écrit en clair) ; deux cadrans superposés « 04 45 » et « 01 32 » (quiet-overlapping-clocks) : deux heures, deux matières (clair / sombre) ; un tableau de bord sur coucher de soleil avec l'heure en grand « 11:51 » ; une carte d'agent sur ciel crépusculaire (« Creating training job ») ; un compteur « 853 » et « 75 % » dans un halo iridescent (usage-meter) ; un sélecteur en verre dépoli.
- Illustration / 3D : un clavier isométrique en plastique blanc, une macropad grise ; une carte en métal liquide ; un ordinateur en pixel art avec un pigeon ; une figure en trame rouge.
- Print : timbres et collages (la marge dentelée, l'encre qui déborde), une affiche en trame bleue d'un cheval, un plan bleu de bâtiments (cyanotype / blueprint).
- Branding : cartes de visite en bleu-vert imprimé, icônes en relief.

## Ce que j'en retiens pour Ariane
- **Le fond d'une carte peut être sa jauge** (Parsing/Planning/Reasoning) : la lumière occupe la part faite, le pourcentage est écrit à côté. Repris dans l'esprit pour le spectre (la largeur lumineuse = part traitée, nombre écrit).
- **Deux heures superposées** (quiet clocks) : l'heure du lot à côté de l'heure du monde → `matiere-horizon` montre « heure du lot » en mots.
- **Trames, pixels et timbres imprimés** : la matière d'impression monochrome (bleu de Prusse des plans, trame) → `matiere-cyanotype` ; la frappe à l'encre → `matiere-feuille`.
- **Densité de traits = courant** (kayaks) : une texture peut se lire de loin si sa densité varie avec une donnée.

## Ce que j'écarte et pourquoi
- Halos iridescents et cartes holographiques : décor sans sens, et proches du « dégradé violet-bleu » que l'opérateur refuse.
- Objets 3D en plastique (claviers) : jolis, sans rapport avec un lot.
- Toute pièce qui pose du texte sur une image sans voile.

## Erreurs d'accès (exactes)
- Toutes les pages `/posts/<pièce>` : HTTP 429, texte de page « Failed to verify your browser Code 21 Vercel Security Checkpoint | iad1::… ». Non contourné.
