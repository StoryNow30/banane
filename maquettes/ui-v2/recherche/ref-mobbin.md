# Référence : mobbin.com (pages publiques, Chromium)

## Ce que j'ai ouvert exactement (toutes en statut 200)
- Accueil ; `/explore` (redirigé vers `/explore/mobile`, sélecteur Mobile / Web / Sites, « Browse by category » : Categories, Screens, UI Elements, Flows ; « What's trending ») ; `/explore/mobile/screens` ; `/explore/mobile/flows` (liste des parcours : adding-creating, logging-tracking, importing-exporting, etc.).
- `/colors` (« Explore Colors », Brand Colors et Color Meanings).
- `/glossary` (liste entière, 50 entrées lues) puis les fiches : `bottom-sheet`, `tab-bar`, `progress-indicator`, `command-palette`, `status-dot`, `toast`, `segmented-control`, `empty-state` (lues en entier jusqu'aux exemples).
- Catégories d'exemples : `/explore/mobile/ui-elements/bottom-sheet` (deux écrans défilés), `/explore/mobile/screens/progress`, `/explore/mobile/flows/logging-tracking`, `/explore/mobile/screens/pause-screen`, `/explore/mobile/ui-elements/tab-bar`.
- Une fiche d'écran isolée, publique : `/explore/screens/<id>` (Saturn Calendar, écran « Scheduled Events » avec ses étiquettes Bottom Sheet, Tab Bar, Card).

## Ce qui est derrière une connexion (noté, non contourné)
- Le bouton « Join for free » / « Log in » est sur chaque page ; les parcours d'une app (suite d'écrans d'un flow), les pages d'app complètes et l'ouverture des collections demandent un compte. Je ne me suis pas connecté. Les fiches d'écran isolées et le glossaire sont publics.
- Aucun défi ni refus rencontré.

## Ce que j'en retiens (ÉTABLI = lu dans le glossaire)
- **Feuille du bas** : « Users can interact with the sheet by expanding, collapsing, or dismissing it. A drag handle may allow resizing to different heights or snap points. » ; deux variantes, **modale** (voile, bloque) et **non modale** (on agit encore derrière). À ne pas utiliser pour une tâche principale ni quand on bascule souvent. → Chez nous la feuille est **non modale** et porte le détail ; le résumé de loin reste derrière, jamais masqué. Variante « flottante » (détachée des bords) observée dans les exemples (PROBABLE, vu en image).
- **Barre d'onglets** : 2 à 6 onglets, pas plus de 5 conseillé ; libellés recommandés quand l'icône n'est pas universelle ; tendance « flottante ». → Onglets à libellé seul (nos pictos ne seraient pas universels), 4 au plus.
- **Indicateur de progrès** : distinction **déterminé** (« Ideal when the duration of the task is known ») / **indéterminé** (« when the duration or end of the task is uncertain ») ; « progress tracker » discret pour les étapes, à pas égaux si les étapes se valent. → Total inconnu = indéterminé ; file de parties = tracker discret à pas égaux.
- **Palette de commandes** : utile s'il y a beaucoup d'actions ; « Avoid if there are only a few commands ». → Pour Ariane (peu d'actions) la palette n'a de sens que si elle **range** les actions et montre les raccourcis, pas comme recherche. Je la garde pour une maquette, avec cette réserve écrite.
- **Point d'état** : binaire, compact, « Avoid for urgent issues … use alerts or modals instead » et « status labels are optional … useful to add context ». → Jamais un point seul : toujours un mot ; l'alerte d'arrêt est un bandeau, pas un point.
- **Toast** : messages brefs, qui disparaissent seuls, pas pour l'urgent (« use a Dialog … or Banners »). → `m.message` (confirmation d'export, « Marqué comme vu ») = toast ; ESV non relié = bandeau persistant.
- **État vide** : expliquer pourquoi c'est vide et proposer la suite ; « Post completion empty state » pour récompenser la fin. → « Rien à examiner » après un lot propre, une phrase, pas d'illustration.
- **Segmented control** : options d'égale importance, changement immédiat. → Bascule Orbite / Écho.
- **Colors** : pages de couleurs de marques (Apple `#0066CC`…), utiles pour la méthode (une couleur de marque + neutres), rien à reprendre.

## Ce que j'écarte
- Les illustrations d'état vide et de permission (Gemini, GitHub, Turo vus en exemple) : décor, contraire au « pas d'icône décorative ».
- Le bouton d'action central dans la barre d'onglets (« Key action button at the center ») : Ariane n'a pas d'action de création fréquente ; l'action principale change avec l'état.

## PROBABLE / SUPPOSÉ
- PROBABLE (vu en vignette) : feuilles à crans Uber/Shake Shack (« Delivery Time », pourboire), écrans de progrès « 1/4 » en anneau (Origin), suivi de commande en frise verticale (Order details).
- SUPPOSÉ : la séquence complète des flows, non visible sans compte.
