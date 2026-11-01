# Référence : heydamir.design (famille « matière », 29/10)

## Ce que j'ai ouvert exactement
- Accueil dans Chromium 1440×900, statut 200, titre « Damir ». La page ne défile pas : colonne fixe à gauche (identité, titre « I make websites and apps that feel alive », deux boutons, pied « Asleep, I'll reply in the morning / Local time 4:38 AM (GMT+4) »), et à droite un **mur de tuiles vidéo** posé en absolu qu'on déplace à la molette (aucun conteneur à défilement ; 29 `<video>` « tile.mp4 » avec affiches `/concepts/<nom>/poster.webp`, 1 canvas, 41 animations CSS actives). ÉTABLI.
- Survol du bouton principal (lueur chaude sous le bouton « Start a project ») et de l'araignée suspendue à sa toile en haut de la colonne. ÉTABLI.
- Clic sur une tuile → visionneuse plein cadre « 04 / 12 » avec flèches et son ; j'ai parcouru **les 12 concepts** au clavier, 3 instants chacun (1 s, 4 s, 8 s), plus un survol et un clic au centre (60 captures). ÉTABLI :
  01 Beacon (phare gravé bleu, faisceau qui balaie ; titre « Catch every incident before your users do ») ; 02 Soft Static (platine vinyle, partition en notation de notes qui défile et s'allume note par note) ; 03 Landing book (carnet relié posé sur une table, ombre de feuillage, qu'on ouvre et feuillette : la landing page est le livre) ; 04 Step out of the feed (porte dans une prairie la nuit ; « keeps its own hours : Day · Dusk · Night · Dawn » avec un petit cadran ; ouvrir la porte montre une autre heure ; annotations numérotées « 01 — ENTER », « 02 — BEYOND THE DOOR / Golden hour », « 03 — KEEPS ITS OWN HOURS ») ; 05 Touch grass (téléphone, cartes de prairies qui ondulent au toucher) ; 06 A 404 that sank (chiffres « 404 » qui flottent dans une eau animée, on les repêche) ; 07 Typewriter (« Typos stay on paper » : chaque frappe s'imprime sur la feuille, compteur « 7/16 », la faute reste où on l'a faite) ; 08 Snow globe (« A landing page you can shake » : la page est noire, la boule s'éclaire au survol ; réglage « Light flurries / Proper snowfall ») ; 09 Shredder (on glisse un document dans une broyeuse, compteur à 7 segments, confettis de papier) ; 10 Folder funeral (dossier qu'on enterre : la terre s'ouvre) ; 11 Meadow footer (le mot « meadow » planté dans une colline, les fleurs poussent au survol, la nuit tombe) ; 12 One light, every color (« lumen. » : un rayon blanc entre dans un bloc de verre et sort en spectre ; « Split the light » éteint puis rallume le rayon ; au survol du spectre, une lecture « λ 588 nm » ; annotations « 01 · SOURCE White light, 6500 K », « 02 · WAVELENGTH Hover the spectrum », « 03 · SPECTRUM 380 to 750 nm »).

## Ce qui les rend « vivants » (analyse)
1. **Une seule métaphore physique par page, et l'interface est l'objet** (le livre EST la landing, la boule EST la page) : jamais de décor ajouté à côté du contenu.
2. **La lumière a une cause** : le phare éclaire parce qu'il surveille ; le spectre existe parce qu'un rayon traverse le verre ; la boule s'allume quand on s'approche. Éteindre la source éteint tout ce qui en dépend.
3. **Un état lisible en mots à côté de l'image** : « Golden hour », « Light flurries », « 588 nm », « 7/16 » ; petites légendes numérotées « 01 — / 02 — / 03 — » en capitales espacées, posées dans les coins sur du noir ou du ciel uni.
4. **L'heure comme état** : « Asleep, I'll reply in the morning » + heure locale ; la porte « garde ses propres heures ». Un statut se dit par la lumière ET une phrase.
5. **Mouvement continu lent + réponse franche à l'action** : dérive lente au repos (herbe, eau, neige), puis un geste net (la porte s'ouvre, le rayon se rallume) ; la page entière ne bouge jamais d'un coup.
6. **Les fautes restent visibles** (Typewriter) : l'erreur n'est pas effacée, elle est marquée là où elle a eu lieu.

## Ce que j'en retiens pour Ariane
- Le rayon et le spectre (12) : une source qui ne brille que quand le lot tourne ; une lecture « λ » au survol devient « cut 233 » ; les légendes numérotées. → maquette `matiere-spectre`.
- « Keeps its own hours » (04) + statut horaire de l'accueil : le lot a ses heures, de l'aube au soir. → `matiere-horizon`.
- Typewriter (07) : chaque cut est une frappe ; un différé reste en rouge là où il a eu lieu. → `matiere-feuille`.
- Les légendes « 01 — » en petites capitales sur fond uni : bonne façon de garder le texte sur fond opaque au-dessus d'une image.

## Ce que j'écarte et pourquoi
- Les objets photoréalistes (porte, boule, broyeuse) : lourds, non lisibles à 360 px, et sans lien avec le métier.
- Le mur de tuiles mobile : c'est la vitrine du portfolio, pas un modèle de panneau.
- Le texte posé directement sur l'image (titres sur la prairie) : contraire à la règle du fond opaque.
- Le son.

## Erreurs d'accès
- Aucune sur l'accueil. Les tuiles ne sont pas cliquables par leur nom (positionnement absolu hors de la fenêtre : « Element is outside of the viewport ») : j'ai cliqué une tuile visible puis navigué dans la visionneuse.
