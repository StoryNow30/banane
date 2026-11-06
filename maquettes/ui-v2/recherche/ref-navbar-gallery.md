# Référence : navbar.gallery (Chromium)

## Ce que j'ai ouvert exactement
- Accueil (redirigé vers www.navbar.gallery, 200), barre latérale des types.
- Les huit pages de type (toutes 200) : `/type/static`, `/type/dropdowns`, `/type/mega-menu`, `/type/side-bar`, `/type/search-bar`, `/type/announcement`, `/type/full-screen`, `/type/breadcrumbs` ; capturées, et défilées pour breadcrumbs, announcement, search-bar.
- Fiches d'exemples (200) : Stripe (Dropdown), Attio (Dropdown), PostHog (Static), Things (Side Bar), Clerk (Dropdown, et sa vignette en Breadcrumbs), Daytona (Static + barre d'annonce), Better Stack (Search Bar), Arc (Static), Twenty (Dropdown), Thonik (Full Screen), Craft (Dropdown). Vues dans les vignettes de type : Chesapeake (Mega Menu numéroté 01–05), Cloudflare (Mega Menu), Aveon et Big Dirty (Side Bar), Clonix (Full Screen), Uniswap, Notion Templates, Dovetail, Attio (Breadcrumbs), Ona et Hex (Announcement).
- Erreur exacte : `/navbar/hex-technologies` → **404 « No Navbars Here »** (l'exemple Hex n'a pas cette adresse). Les fiches d'exemple sont surtout des vidéos et la vue mobile ; le texte se limite à « Navbar Type / Website Type / Mobile view ». Aucun défi.

## Ce que j'en retiens, type par type
- **Static** : une barre fixe sobre (PostHog, Arc) ; le titre de produit à gauche, une action à droite. → Rien de neuf pour un panneau de 360 px, sinon la règle : une seule action visible dans la barre.
- **Dropdown** : menus qui tombent sous l'entrée (Stripe : colonnes titre + description courte). → Les choix secondaires (onglet ESV, bornes) en liste à deux lignes : nom + une ligne d'explication.
- **Mega Menu** : Chesapeake numérote ses entrées 01–05 en colonne. → Numéroter ce qui est une suite (parties d'une file), pas le reste.
- **Side Bar** : panneau qui sort du bord avec la liste des destinations (Aveon, Things). → Écarté : le panneau Ariane est déjà une barre latérale du navigateur ; une seconde barre dedans le rendrait étroit.
- **Search Bar** : champ central avec raccourci « ⌘K » (Better Stack, Apple, Supabase). → Idée de la palette de commandes ouverte au clavier.
- **Announcement** : une bande mince au-dessus de la barre, un seul message daté (Daytona : « Compute Conference … // March 8-9 in SF »), parfois un lien (Ona). → Les **incidents persistants** (ESV non relié, reprise après rechargement) en bande d'annonce tout en haut : ne bouge pas le reste, se lit d'un coup d'œil.
- **Full Screen** : menu plein écran à grands mots (Clonix, Thonik en cercles concentriques). → Écarté pour la navigation ; retenu seulement l'idée d'un **état plein écran** pour l'alerte d'arrêt de file (on ne peut pas la rater).
- **Breadcrumbs** : Clerk montre la forme la plus utile : « Personal account ⌃ / Application [Free] ⌃ / Development ⌃ » — **chaque maillon est un sélecteur**. Stripe : « Customers / Instacart » ; Attio : chemin d'aide. → Maquette `app-fil` : « Lot 140–379 / Partie 2 sur 3 / Cut 252 », chaque maillon ouvre son sélecteur (bornes, file, ce qui reste). C'est de la navigation, pas une voie.

## Ce que j'écarte et pourquoi
- Les effets d'agence (texte géant, cercles concentriques, images plein cadre) : spectaculaires, inutiles pour un opérateur qui regarde de loin un état.
- Les mega menus à vignettes : trop de choix pour un outil à peu d'actions.

## PROBABLE / SUPPOSÉ
- PROBABLE : le comportement animé des menus (vidéos non lues image par image).
- SUPPOSÉ : la vue mobile de chaque exemple (seulement vignette).
