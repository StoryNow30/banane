# CH-103 : ce qui fait l'allure de Linear et de Cursor, et ce qu'Ariane en prend

Relevé le 11/11/2026 dans Chromium (styles calculés, variables CSS, polices chargées, captures hors dépôt), sur les pages citées. Tout ce qui suit est ÉTABLI par ce relevé, sauf mention. Limite : ce sont leurs sites, leur documentation et les maquettes d'interface qu'ils y montrent, pas leurs applications ouvertes avec un compte.

Sources : [L1] linear.app · [L2] linear.app/changelog · [L3] linear.app/docs · [L4] linear.app/now/how-we-redesigned-the-linear-ui (28/03/2024) · [L5] linear.app/now/behind-the-latest-design-refresh (12/03/2026) · [L6] linear.app/plan · [L7] linear.app/docs/project-graph · [C1] cursor.com · [C2] cursor.com/changelog · [C3] cursor.com/docs · [C4] cursor.com/brand · [I] rsms.me/inter et github.com/rsms/inter (LICENSE.txt).

## Ce qu'on observe

| | Linear | Cursor |
|---|---|---|
| Caractères | `Inter Variable` partout, `Berkeley Mono` pour le code [L1]. Inter : libre (SIL OFL 1.1) [I]. Berkeley Mono : police commerciale (licence non lue, SUPPOSÉ). | `CursorGothic` (fichiers maison, aucune licence publiée trouvée) et `Berkeley Mono` sur le site ; dans la maquette de l'application, la police du système (`system-ui`) [C1][C3]. |
| Tailles | Interface à 13 px (navigation, boutons), texte courant 14 à 15 px, micro 11 à 12 px ; interlettrage légèrement négatif (−0,13 px à 13 px) [L1][L3]. | Interface de l'application à 12 px, détails à 11 px, en-têtes de section 11 px en capitales [C1]. |
| Graisses | Trois : 400, 510, 590. Pas de gras : `--font-weight-medium: 510`, `semibold: 590` [L1]. Le titre le plus fort d'une liste est en 590, pas plus. | Presque tout en 400 ; 500 pour le titre de la ligne active ; les titres du site sont en 400 [C1][C2]. La hiérarchie vient de la taille et de l'opacité, pas de la graisse. |
| Gris | Quatre niveaux de texte nommés (`#f7f8f8`, `#d0d6e0`, `#8a8f98`, `#62666d`), quatre niveaux de fond très proches (`#08090a` à `#191a1b`) [L1]. Depuis 2026 : gris moins bleus, « plus chauds, moins saturés » [L5]. | Une seule couleur de texte (`#edecec`, clair `#26251e`), déclinée à 60 % et 40 % d'opacité ; fond chaud (`#14120b`, clair `#f7f7f4`) ; bordures = le texte à 10 % [C1]. |
| Couleur | Un accent (indigo `#5e6ad2` / `#7170ff`), absent de presque tout l'écran. Bouton principal = inversé (clair sur sombre), pas coloré [L1]. La couleur sert aux statuts : un petit pictogramme rond jaune « In Progress » [L6]. | Un accent orange (`#f54e00`), rare (lien actif, alerte). Bouton principal inversé lui aussi. Vert et rouge réservés aux ajouts et retraits de lignes [C1][C3]. |
| Traits, surfaces | Traits d'un pixel peu contrastés ; ombres à zéro en sombre (`--shadow-*: none`) [L1]. Principes écrits : « la structure se sent, elle ne se voit pas », moins de séparateurs ; « ne pas disputer une attention qu'on n'a pas méritée », la navigation s'efface [L5]. | Même logique : cartes à peine plus claires que le fond (`#1b1913` sur `#14120b`), bordure à 10 % [C1]. |
| Rayons | Échelle 4, 6, 8, 12, 16 ; pastilles pour les boutons du site ; contrôles de 32 px de haut [L1][L3]. | 4 et 8 px dans l'application, pastilles pour les boutons du site [C1][C3]. |
| Pictogrammes | Petits (14 à 16 px), au trait, gris ; la refonte de 2026 en retire et les réduit [L5]. | 16 px, trait d'un pixel [C1]. |
| Mouvement | Court : 0,1 s (survol) à 0,25 s, courbes « ease-out » [L1]. | 0,2 s sur l'opacité ; une roue qui tourne pour « en cours » [C1]. |
| Travail en cours | Un statut = un petit rond coloré et un mot (« In Progress ») dans une ligne de propriétés [L6] ; l'avancement d'un projet = un graphique sobre et un pourcentage, dans un panneau de côté [L7]. | La liste des agents : section « IN PROGRESS 1 », puis une ligne à deux étages (roue de 16 px, titre 12 px, « Generating plan » en 11 px à 40 %) ; section « READY FOR REVIEW 4 » avec une coche cerclée, sans couleur [C1]. L'état est une phrase courte au présent. |

## Trois conclusions

1. **Leur allure tient à la retenue, pas à un motif.** Une seule famille de caractères, trois graisses au plus, une interface à 12 ou 13 px, des gris très proches, presque aucune couleur. Les quatre essais refusés faisaient l'inverse : un grand chiffre, un anneau, des tuiles, une couleur par état.
2. **L'état s'écrit : un petit signe et une phrase.** Ni Linear ni Cursor ne dessinent l'avancement en grand. « Generating plan » sous un titre, un rond jaune devant « In Progress » : c'est lisible d'un coup d'œil parce que tout le reste se tait.
3. **La couleur est un événement.** Chez les deux, le bouton principal est blanc sur noir et l'accent n'apparaît qu'à un ou deux endroits. Pour Ariane : aucune couleur tant que tout va bien ; l'orange quand c'est à l'opérateur ; le rouge pour la panne seulement.

## Ce qu'Ariane prend

- **Inter** (variable, OFL 1.1), embarquée dans l'extension : l'opérateur verra exactement ce que nous voyons, ce qui a manqué aux essais précédents. Chiffres à chasse fixe d'Inter pour les numéros de cut ; pas de seconde police.
- L'échelle de Linear : 11, 12, 13, 15 px, graisses 400, 510, 590, contrôles de 32 px, rayons 6 et 8, traits d'un pixel à faible contraste, aucune ombre.
- Le texte secondaire à la manière de Cursor : la même teinte, atténuée, avec un fond gris neutre à peine chaud.
- La ligne à deux étages de Cursor pour l'état (signe, mot, phrase au présent), ses en-têtes de section en petites capitales avec un compte (« À POSER 3 »), et la ligne de propriétés de Linear pour les chiffres du lot.
- Le bouton principal inversé ; un seul par écran.

## Ce qu'Ariane laisse

- Leurs logos, pictogrammes, polices maison (`CursorGothic`, `Berkeley Mono`) et captures : rien n'est repris.
- L'indigo de Linear et l'orange exact de Cursor : ce sont leurs marques. L'orange d'Ariane est le sien, et il a un sens.
- Les pastilles (boutons entièrement arrondis) : c'est leur site, pas leur application.
- Le 12 px de Cursor comme taille de base : trop petit pour un panneau regardé de côté pendant qu'on travaille dans ESV ; base à 13 px.
- La barre de commandes, les raccourcis affichés, les dégradés et les illustrations de leurs pages d'accueil : hors sujet pour un panneau de 360 px.
