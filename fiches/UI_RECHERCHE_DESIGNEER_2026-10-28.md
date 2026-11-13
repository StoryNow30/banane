# CH-010 : recherche d'inspiration pour Signal (28/10/2026)

Matière pour trois directions de maquettes (pages `Direction A`, `B`, `C` du fichier Figma). Rien n'est copié : ni visuel, ni code. Les ressources sont citées par leur nom.

## Ce qui a pu être lu, et ce qui ne l'a pas été

- **designeer.xyz est illisible depuis les machines cloud.** Toutes ses pages et son API de catalogue renvoient 403 avec un défi Cloudflare (Chromium, récupération directe, API). Le contournement est exclu. Seuls `robots.txt`, `llms.txt` et `sitemap.xml` répondent.
- **Ce que le site a fourni : des noms.** Le plan du site (`chantiers/CH-010/designeer-plan-du-site.txt`) donne le nom exact et la rubrique de chaque ressource. **Aucune description du site n'a été lue.**
- **Ce qui est cité plus bas comme référence a été lu** : la page de chaque ressource a été ouverte le 28/10/2026 sur le site de son auteur (pas sur designeer.xyz). Chaque ligne ne dit que ce que la page dit.
- **Lu sans résultat utile** : la page des jetons de mouvement de Material 3 (le titre seulement) et le guide de dessin d'icônes de Lucide (404). Ils ne sont pas cités comme références.
- **Ce que ces sources ne disent pas** : aucune ne parle du métier d'Ariane (rails posés dans un nuage LiDAR, cuts, lots, différés). Les **couleurs et les symboles des trois directions viennent du métier**, pas de ces références. Les références servent à l'accessibilité, au mouvement, à la palette de commandes et au vocabulaire.
- Rien n'est mesuré à l'écran : les coûts d'implémentation sont des estimations de lecture.

## Références lues (12), par usage

« Sans bibliothèque » : réalisable dans l'extension en CSS et JavaScript simples (Signal n'a aucune dépendance).

### États et progression

| # | Ressource (rubrique du site) | Ce que la page dit | Ce que j'en tire | Sans bibliothèque |
|---|---|---|---|---|
| 1 | **Radix**, composant Progress (Resources) | Deux parties (racine, indicateur) ; l'état est porté par `data-state` : `complete`, `indeterminate`, `loading` ; `data-value` et `data-max` ; suit le rôle `progressbar`. Aucun mouvement décrit. | Le rail lit son état par attribut : le style suit l'attribut, le script ne redessine pas. Rôle `progressbar` pour le lecteur d'écran. | Oui : attributs `data-*` et `role`. |
| 2 | **NumberFlow** (Resources) | Anime le changement d'un nombre ; décrit comme sans dépendance ; respecte la préférence de mouvement réduit par défaut ; composant React. | Le compteur « posés » change une fois, avec le rail. La bibliothèque est React : seule l'idée est reprise. | Idée oui : fondu et décalage court du chiffre (200 à 240 ms). |
| 3 | **Tremor** (Resources) | Composants React (Tailwind, Radix, Recharts) pour tableaux de bord ; micro-visualisations de progression : Data Bars, Spark Charts, Progress Circles ; « fully open-source ». | Référence de densité (un chiffre, un libellé, une barre). **Les Progress Circles sont l'anneau générique que l'opérateur rejette** : aucune direction n'en reprend. | Idée seule. |

### Boutons, feuilles, notifications

| # | Ressource (rubrique) | Ce que la page dit | Ce que j'en tire | Sans bibliothèque |
|---|---|---|---|---|
| 4 | **Base UI**, composant Button (Resources) | `focusableWhenDisabled` garde un bouton désactivé focusable ; `data-disabled` ; `aria-labelledby` pour une étiquette qui change ; les liens ne se déguisent pas en boutons. | Un bouton grisé de Signal porte une raison (« Choisis un onglet ESV… ») que le clavier doit pouvoir lire. Le lien « Préparer… » reste un lien. | Oui : `aria-disabled` au lieu de `disabled`. |
| 5 | **Radix**, composant Dialog (Resources) | Focus piégé dans la boîte en mode modal ; Échap ferme ; le focus revient au déclencheur ; le calque rend le reste de la page inerte ; titre et description annoncés. | Règles de la feuille de réglages et de la palette. | Oui : `inert` sur l'instrument, focus géré à la main. |
| 6 | **shadcn/ui**, composant Command, bâti sur cmdk (Resources) | Palette de commandes : groupes avec titre, séparateur, message « aucun résultat », raccourci affiché par commande. La page ne précise pas le raccourci d'ouverture de la palette. | Palette de Ctrl K : groupes titrés, raccourci visible, état vide dit. | Idée oui ; le composant est React. |
| 7 | **Inclusive Components** (Inspiration), article « Notifications » | Ne pas déplacer le focus pour une simple notification ; région live (`role="status"` avec `aria-live="polite"`) créée avant le contenu ; **préfixer les messages (« Erreur : », « Info : ») plutôt que se fier à la couleur ou à l'icône seules** ; disparition automatique, rien de masqué. La page d'accueil du site liste aussi : cartes, tableaux de données, sections repliables, onglets, sélecteur de thème, boutons à bascule. | **Soutient le choix des directions : la couleur ne porte jamais seule le sens.** Chaque état a un mot, une forme (fanion, plan de coupe, heurtoir) et une couleur. L'incident se dit par un préfixe. | Oui. |
| 8 | **The Component Gallery** (Resources) | Recense 60 composants, 95 systèmes de design et 2 671 exemples ; un même composant a plusieurs noms (l'accordéon : « Collapsible sections », « Disclosure », « Expandable »…). | Outil pour arrêter le vocabulaire du tiroir « Ce qui reste » : à consulter avant de renommer. Aucun nom n'est arrêté ici. | Sans objet (lecture). |

### Mouvement

| # | Ressource (rubrique) | Ce que la page dit | Ce que j'en tire | Sans bibliothèque |
|---|---|---|---|---|
| 9 | **Motion** (Resources), page des transitions | Types : tween, spring, inertia ; un ressort se règle par `stiffness`, `damping`, `mass` ou par `duration` et `bounce` ; `bounce` à 0 = sans rebond ; une durée de tween par défaut de 0,3 s. | Direction B : un ressort court, réglé par durée et rebond (380 à 480 ms). La bibliothèque est écartée. | Oui : `linear()` en CSS (déjà écrit dans `fiches/UI_SIGNAL_REVISION.md`). Compatibilité Chrome à vérifier dans l'extension (SUPPOSÉ). |
| 10 | **Easing Wizard** (Resources) | Éditeur de courbes CSS : presets Bézier, Spring, Bounce, Wiggle, Overshoot ; sortie CSS ou Tailwind, par exemple `cubic-bezier(0.66, 0, 0.34, 1)`. La page ne mentionne ni `linear()` ni la compatibilité navigateur. | Pour dessiner la courbe unique des directions A et C. Je ne prétends pas qu'il produise du `linear()`. | Oui (outil de dessin). |

### Contraste

| # | Ressource (rubrique) | Ce que la page dit | Ce que j'en tire | Sans bibliothèque |
|---|---|---|---|---|
| 11 | **APCA** (Resources) | Contraste perceptuel (Lc) ; pour un texte courant de 14 px en graisse 400, Lc 90 préféré ; équivalences indicatives Lc 90 ≈ 7:1, Lc 75 ≈ 4,5:1, Lc 60 ≈ 3:1 ; pas de seuil direct pour 13 px ; « public beta ». | Second avis. **Les maquettes sont vérifiées au rapport WCAG 2 (4,5:1 pour tout texte et tout symbole, sur fond, surface et surface 2, dans les six thèmes).** APCA n'a pas été calculé. | Oui (calcul). |

### Contre-exemple

| # | Ressource | Ce que la page dit | Verdict |
|---|---|---|---|
| 12 | **planes**, composant Shader Flood (Resources) | Composant React d'effet décoratif pour grilles de fonctionnalités de pages marketing, installé par la commande shadcn ; licence payante (Planes Pro) ; ne dit rien de la préférence de mouvement réduit. | **Écarté** : un décor, pas un fait ; licence payante. |

## Pistes non lues (noms vus dans le plan du site, rien de plus)

Rolling Number, Loader Buttons, Evil Buttons, Animations.dev, Rive, Lottie, Departure Mono, Linear, Raycast, Lucide. **Je ne dis rien de leur contenu** : à lire avant de s'y appuyer.

## Ce que chaque direction tire de ces lectures

| Direction | Identité | Références utilisées |
|---|---|---|
| **A, Cadran** | Instrument sobre : la voie vue de côté, filets de 1 px, capitales à chasse fixe. Une courbe, 200 à 320 ms, aucune boucle. | 1 (état par attribut), 4 (bouton grisé lisible), 6 (palette groupée), 10 (courbe) |
| **B, Nuage** | La voie vue dans un nuage de points : fond nuit, cartes arrondies, pilules, ressort court de 380 à 480 ms, aucune boucle ambiante. | 2 (le chiffre qui change), 9 (ressort par durée et rebond), 7 (forme et mot en plus de la couleur) |
| **C, Chantier** | Signalétique de chantier : très grand chiffre, capitales, jaune de signalisation. Passage de témoin entre états, un grand geste de 1,2 s à la fin du lot. | 2 (le chiffre), 7 (le sens ne tient pas à la couleur seule), 10 (courbe) |

## Écartés

- **Progress Circles** (Tremor) et **Shader Flood** (planes) : l'anneau et le décor sont exactement ce que l'opérateur trouve « trop générique ».
- **Rive** et **Lottie** : pistes non lues, écartées par principe (un exécutant externe).

## Limites

- Les douze références sont lues, mais **aucune ne parle du métier** : la justification des couleurs et des symboles vient d'un raisonnement de conception, à valider auprès de l'opérateur (voir `chantiers/CH-010.rapport.md`).
- Le contenu de designeer.xyz (descriptions, étiquettes, captures) n'a pas été lu. Si l'opérateur l'obtient, ce document est à compléter, pas à refaire.
- Les licences ne sont vérifiées que pour planes (page lue) et Tremor (« fully open-source », licence non nommée).
