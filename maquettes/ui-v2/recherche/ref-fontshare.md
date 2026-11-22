# Référence : fontshare.com (fonderie, spécimens et paires)

## Ce que j'ai ouvert exactement (Chromium, navigation ordinaire, 29/10)
- Liste des familles (« Fonts 100 ») : la page défile dans un conteneur interne de 5 901 px ; je l'ai fait défiler en 5 tranches. ÉTABLI.
- Filtres, ouverts à la souris (le clic par sélecteur était intercepté par un calque transparent : « <div class=…> intercepts pointer events », je suis passé par un clic aux coordonnées de l'étiquette, sans rien contourner d'autre) :
  - **Personality** : Informal, Modern, Corporate, Classic, Elegant, Dramatic, Clean, Futuristic, Serious, Dirty, Luxurious, Friendly, Abstract. J'ai coché Serious puis Clean : le compteur de gauche passe de **100 à 55**, et l'étiquette du filtre devient « Serious + 1 ». ÉTABLI.
  - **Categories** : Sans, Serif, Slab, Display, Handwritten, Script. Serif seul : **17** familles, la liste commence par Zodiak. ÉTABLI.
  - **Properties** : curseurs « No. of Styles », « Weight », « Width », « Contrast », « Edges », « x-Height », chacun illustré par des glyphes. ÉTABLI.
  - Barre d'aperçu : taille 8 à 280 px, textes « Cities / Excerpts / Names », bascule clair/sombre. ÉTABLI.
- **Pairs** (59 paires) : chaque paire est une colonne de journal, titre dans une police, chapeau dans l'autre, méta « Amulya Bold + Synonym Regular » en 9 px. ÉTABLI.
- Pages de familles, onglet « Details » lu en entier : Satoshi, Clash Display, Gambetta, Boska, Zodiak, Sentient, Erode, Tanker, Panchang, Tabular, Technor, Supreme, General Sans. Onglets Styles (une ligne par graisse, nom de la graisse en 9 px au-dessus), Glyphs (grille a-z, 0-9), Layouts. ÉTABLI.

## Ce que j'y ai vu (la mise en page)
1. Fond crème uni, texte noir, **filets d'un pixel** qui découpent tout en cases ; l'onglet actif (« Fonts ») est un **bloc noir plein** avec son effectif en petit dedans (« 100 »). Aucune ombre, aucun rayon. ÉTABLI.
2. **Méta minuscule + spécimen géant** : chaque famille = une ligne de méta en 9-10 px (« Satoshi ☆ · 10 styles · Variable · Closed Source ») puis le nom composé à 120 px. Deux tailles seulement, l'écart fait la hiérarchie. ÉTABLI.
3. **Le nombre est l'état** : « 100 → 55 → 17 » en tête de liste quand on filtre. ÉTABLI.

## Ce que disent les fiches « Details » (lu), et ce qui compte pour un panneau qu'on lit de loin
- **Zodiak** : serif à empattements robustes, axe vertical, « rappelle les polices de journaux contemporaines » ; chiffres à hauteur de capitale. Déjà dans le dépôt, utilisée par une autre maquette : je l'écarte comme principale.
- **Sentient** : serif « robuste », lettres un peu larges, « tient même dans de mauvaises conditions d'impression », grands contre-poinçons, « bien à l'écran ». Bon candidat pour du texte courant lu de loin.
- **Erode** : serif à fort contraste, ascendantes longues, pensée pour les **citations et titres** éditoriaux. Candidat pour une manchette.
- **Gambetta** : serif de texte, contraste croissant avec la graisse, chiffres elzéviriens proportionnels par défaut (mauvais pour un compteur qui change).
- **Boska** : Didone à très fort contraste, condensée, pour les titres de grande taille ; chiffres elzéviriens par défaut. Trop fragile en petit et en sombre.
- **Tabular** : monospace, « chaque glyphe a la même chasse », recommandée pour les **rapports financiers** : le chiffre ne bouge pas quand il change. Candidat direct pour les compteurs et tableaux.
- **Satoshi** : grotesque moderniste, chiffres tabulaires disponibles (OpenType), flèches, cercles et coche dans le jeu. Polyvalente.
- **Supreme** : sans « construite », monolinéaire, « favorite des ingénieurs ». Sobre, technique.
- **Technor** : sans construite, très serrée, « pour l'affichage, plus c'est grand mieux c'est ». Candidate pour une affiche.
- **Tanker** : capitales condensées seules, coins arrondis, une seule graisse : affiche, mais pas de minuscules pour les consignes.
- **Panchang** : très large, « presque panoramique » : un mot par ligne à 360 px, inutilisable pour des libellés longs comme « Arrêter ce lot ».
- **Clash Display** : petites ouvertures, pour grandes tailles seulement.
- **General Sans** : déjà dans le dépôt (autre maquette).

## Ce que j'en retiens pour Ariane
- La **grille de spécimen** (méta minuscule, valeur géante, filets d'un pixel, aucun rayon) pour une maquette où le lot se lit comme une planche de fonderie.
- **L'onglet actif en bloc noir plein** comme seul signe d'« ici et maintenant » (activité Orbite/Écho, partie courante).
- **Le compteur qui change en tête** (100 → 55) : le nombre de restants qui décroît en tête de la liste « Ce qui reste ».
- **Choix par raison métier** : pour un compteur qui change toutes les secondes, une police à chasse fixe ou à chiffres tabulaires (Tabular, Satoshi en `tnum`) ; pour une manchette lue à trois mètres, une serif robuste à grands contre-poinçons (Sentient) ou une sans d'affiche serrée (Technor) ; jamais de chiffres elzéviriens.
- Les **Pairs** montrent comment marier deux familles : titre d'une famille, texte de l'autre, et la méta qui dit lesquelles.

## Ce que j'écarte et pourquoi
- Le fond crème comme simple ambiance : je ne le garde que s'il a une raison (papier = page imprimée dans la maquette « journal »).
- Boska, Gambetta, Panchang, Tanker comme polices de travail (raisons ci-dessus).
- Le curseur de taille et les textes d'exemple : outil de fonderie, sans objet ici.

## Erreurs d'accès
- Aucune erreur HTTP. Clics des filtres : « locator.click: Timeout 5000ms exceeded … intercepts pointer events » ; ouverts par clic souris aux coordonnées visibles.
