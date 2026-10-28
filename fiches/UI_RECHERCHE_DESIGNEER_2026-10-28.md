# CH-010 : recherche d'inspiration pour Signal (28/10/2026)

Matière pour trois directions de maquettes (`Direction A`, `B`, `C` dans le fichier Figma). Rien ici n'est copié : ni visuel, ni code. Les ressources sont citées par leur nom.

## Ce qui a pu être lu, et ce qui ne l'a pas été

- **designeer.xyz est illisible depuis les machines cloud.** Chaque page, y compris `/api/catalog`, renvoie 403 avec un défi Cloudflare (Chromium, récupération directe, API). Le contournement est exclu. Seuls `robots.txt`, `llms.txt` et `sitemap.xml` répondent.
- **Ce que le site a donc fourni : des noms.** Le plan du site (`chantiers/CH-010/designeer-plan-du-site.txt`, 758 adresses) donne le nom exact de chaque ressource et sa rubrique (Inspiration, Resources, Tools, Portfolios, Finds). **Aucune description du site n'a été lue.** Pas de capture, pas de texte de fiche.
- **Qualification des lignes.**
  - **ÉTABLI** : la page de la ressource (site de son auteur, pas designeer.xyz) a été lue le 28/10/2026 ; ce que la ligne dit vient de cette lecture.
  - **PROBABLE** : le nom est dans le plan du site (ÉTABLI), mais ce que la ressource apporte vient de ma connaissance, page non relue. À vérifier avant de s'y engager.
- Rien n'est mesuré à l'écran : les coûts d'implémentation sont des estimations de lecture, pas des temps.

## Références retenues, par usage (18)

Colonne « Sans bibliothèque » : réalisable dans l'extension Chrome en CSS et JavaScript simples (Signal n'a aucune dépendance).

### États et progression

| # | Ressource (rubrique) | Statut | Ce qu'elle apporte | Pour Signal | Sans bibliothèque |
|---|---|---|---|---|---|
| 1 | **Radix** (Resources), composant Progress | ÉTABLI | Deux parties (racine, indicateur), l'état porté par `data-state` : `complete`, `indeterminate`, `loading` ; `data-value` et `data-max` ; rôle `progressbar`. La page ne décrit aucun mouvement. | Convient : le rail est une barre de progression. Retenir l'idée de l'état en attribut (le CSS lit l'état, le script ne dessine pas) et le rôle ARIA. | Oui : attributs `data-*` et `role="progressbar"`. |
| 2 | **NumberFlow** (Resources) | ÉTABLI | Anime le changement d'un nombre ; décrit comme sans dépendance ; respecte la préférence de mouvement réduit par défaut. Composant React. | Convient pour l'idée : le compteur « traités » change une fois, avec le rail. La bibliothèque est React, donc non reprise. | Idée oui : fondu et décalage de 6 px du chiffre, 200 à 240 ms. |
| 3 | **Rolling Number** (Resources) | PROBABLE | Chiffres qui défilent colonne par colonne. | Convient en Direction C pour le gros chiffre ; trop voyant ailleurs. | Oui en CSS (colonne de chiffres décalée), avec un coût de mise en page à mesurer. |
| 4 | **Loader Buttons** (Inspiration) | PROBABLE | Boutons dont l'étiquette devient un état d'attente. | Convient pour « Pause demandée… » : le bouton garde sa place et sa taille. | Oui. |
| 5 | **Tremor** (Resources) | PROBABLE | Blocs de tableau de bord (cartes de chiffres, barres de progression). | Convient comme référence de densité : un chiffre, un libellé, une barre. Ne convient pas pour les graphiques (Signal n'en a pas). | Idée seule (la bibliothèque est React). |

### Boutons

| # | Ressource (rubrique) | Statut | Ce qu'elle apporte | Pour Signal | Sans bibliothèque |
|---|---|---|---|---|---|
| 6 | **Base UI** (Resources), composant Button | ÉTABLI | Un bouton désactivé peut rester focusable (`focusableWhenDisabled`), avec `data-disabled` ; pour une étiquette qui change, `aria-labelledby` fixe le nom accessible. Les liens ne se déguisent pas en boutons. | Convient : un bouton grisé de Signal porte une raison (« Choisis un onglet ESV… ») que le clavier doit pouvoir lire. | Oui : `aria-disabled` au lieu de `disabled`. |
| 7 | **Inclusive Components** (Inspiration) | ÉTABLI (liste des sujets seulement) | Une série d'articles sur des composants : notifications, sections repliables, onglets, boutons à bascule, sélecteur de thème. La lecture n'a livré que les titres, pas le contenu. | À lire avant de fixer le tiroir (« sections repliables ») et l'incident (« notifications »). Le contenu reste à vérifier. | Oui. |
| 8 | **Evil Buttons** (Resources) | PROBABLE | Collection de boutons très travaillés (effets, relief). | À écarter pour le fond : un bouton qui se remarque pour lui-même gêne la lecture en plein travail. Retenir seulement que le relief du bouton plein peut être une direction (B). | Oui, mais non souhaitable. |

### Tiroirs, feuilles, palette de commandes

| # | Ressource (rubrique) | Statut | Ce qu'elle apporte | Pour Signal | Sans bibliothèque |
|---|---|---|---|---|---|
| 9 | **Radix** (Resources), composant Dialog | PROBABLE | Dialogue modal : piège du focus, retour du focus à la fermeture, fermeture à Échap. | Convient pour la feuille de réglages et la palette. | Oui : `inert` sur l'instrument, focus géré à la main. |
| 10 | **shadcn/ui** (Resources) | PROBABLE | Modèle « le code est copié dans le projet » ; composants Sheet, Drawer, Command bâtis sur Radix. | Convient comme vocabulaire (feuille, tiroir, commande). Le code lui-même est React. | Idée seule. |
| 11 | **Component Gallery** (Resources) | PROBABLE | Catalogue qui compare le nom donné au même composant par des systèmes de design différents. | Convient pour trancher le vocabulaire (tiroir, feuille, bascule). | Sans objet (lecture). |
| 12 | **Linear** et **Raycast** (Tools) | PROBABLE | Deux outils dont la palette de commandes est la pièce centrale : commandes groupées, raccourci affiché à droite, commande grisée qui dit pourquoi. | Convient pour la palette de Ctrl K : mêmes mots que l'écran, groupes, raccourci visible. | Oui. |

### Mouvement

| # | Ressource (rubrique) | Statut | Ce qu'elle apporte | Pour Signal | Sans bibliothèque |
|---|---|---|---|---|---|
| 13 | **Motion** (Resources) | PROBABLE | Bibliothèque d'animation à ressorts (durée et rebond réglables). | Convient pour l'idée du ressort en Direction B. La bibliothèque est écartée. | Oui : `linear()` en CSS pour le ressort (déjà écrit dans `fiches/UI_SIGNAL_REVISION.md`). |
| 14 | **Easing Wizard** (Resources) | PROBABLE | Outil qui génère une courbe `cubic-bezier` ou un ressort en CSS. | Convient pour fixer les courbes sans bibliothèque. | Oui (outil de dessin). |
| 15 | **Animations.dev** (Inspiration) | PROBABLE | Cours sur le mouvement d'interface : durée, courbe, retenue. | Convient comme discipline : une animation par fait. | Sans objet. |
| 16 | **Rive** et **Lottie** (Resources) | PROBABLE | Animations vectorielles jouées par un exécutant dédié. | À écarter pour Signal : poids, exécutant externe, rien qui porte un fait. Leur place serait le sceau de fin de la Direction C, et le même geste se fait en CSS. | Non. |
| 17 | **Planes**, composant Shader Flood (hors annuaire, fourni par l'opérateur) | ÉTABLI | Composant React d'effet décoratif pour grilles de fonctionnalités de pages marketing, installé par la commande shadcn. Licence payante (Planes Pro). La page ne dit rien de la préférence de mouvement réduit. | **Écarté** : décor, pas un fait ; licence payante ; effet de page marketing. | Non. |

### Contraste

| # | Ressource (rubrique) | Statut | Ce qu'elle apporte | Pour Signal | Sans bibliothèque |
|---|---|---|---|---|---|
| 18 | **APCA** (Resources) | ÉTABLI | Contraste perceptuel (valeur Lc) pour remplacer le rapport de WCAG 2 ; équivalences indicatives : Lc 90 ≈ 7:1, Lc 75 ≈ 4,5:1, Lc 60 ≈ 3:1 ; la page n'a pas de seuil direct pour 13 px et se dit en bêta publique. | Convient comme second avis. Les maquettes sont vérifiées au rapport WCAG 2 (4,5:1 pour tout texte, y compris les 13 px de `encre3`) ; APCA n'a pas été calculé. | Oui (calcul). |

**Icônes.** Pas de ressource retenue : les icônes de Signal sont dessinées à la main (trait 1,75). **Lucide**, **Phosphor** et **Material Symbols** (Resources) servent de repère pour le trait et la grille (PROBABLE), pas de source de dessin.

## Ce que j'en tire pour chaque direction

| Direction | Identité en une ligne | Références mobilisées | Ce que je retiens |
|---|---|---|---|
| **A, Cadran** | Instrument sobre : filets, graduations, capitales à chasse fixe, angles quasi droits. | 1, 6, 9, 12, 14 | Le rail lit l'état par attribut (1). Le bouton grisé reste lisible au clavier (6). Palette groupée, raccourci visible (12). Courbe unique, aucun ressort (14). |
| **B, Galet** | Relief doux : surfaces bombées, pilules, glyphe large, un halo qui respire. | 2, 4, 8, 13 | Le chiffre qui change (2) et le bouton qui garde sa place en attente (4) sont repris. Le relief de bouton (8) ne l'est que pour le bouton plein. Ressort court (13) là où le fait compte. |
| **C, Affiche** | Éditorial : grand chiffre, mot d'état en empattement, sceau de fin. | 3, 5, 15, 16 | Un gros chiffre porte l'avancement (3, 5). Un seul grand geste, la fin de lot (15). Le sceau est dessiné en CSS (16 écarté). |

## Écartés, avec raison

- **Shader Flood** (17) et **Evil Buttons** (8) : décor ; Signal n'anime que ce qui signale un changement.
- **Rive**, **Lottie** (16) : exécutant externe.
- **GSAP**, **Framer** : bibliothèques d'animation ; l'extension n'en charge aucune.

## Limites

- Les lignes PROBABLE reposent sur le nom et sur ma connaissance de la ressource ; aucune n'a été relue sur designeer.xyz.
- Le contenu de designeer.xyz (descriptions, étiquettes, captures) n'a pas été lu. Si l'opérateur l'obtient, ce document est à compléter, pas à refaire.
- Aucune ressource n'est vérifiée en licence, sauf Planes (page lue).
