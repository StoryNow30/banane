# Référence : libraries.dev (dépôt jakubantalik/libraries.dev + site public)

## Ce que j'ai ouvert
Dépôt (lecture seule), ÉTABLI = lu :
- `README.md` racine, ÉTABLI.
- `packages/border-beam` : README, `src/BorderBeam.tsx`, `src/pulseDriver.ts`, `src/styles.ts` (préréglages, gabarit du faisceau rotatif : `@property --beam-angle`, masque `conic-gradient` composé avec `content-box` pour ne garder que le bord). ÉTABLI. `types.ts` vu en liste (PROBABLE).
- `packages/thinking-orbs` : README (même moteur que le portage Swift lu en entier, voir ref-thinkingorbs). ÉTABLI ; `src/engine/*.ts` vus en liste.
- `packages/bot-avatars` : README entier, `src/engine.ts` (pose, mélange des trois états, ressorts, évènements, transitions de 0,7 à 1,4 s), `src/ticker.ts` (une seule boucle, arrêt onglet caché). ÉTABLI. `plastic.ts` (3 961 lignes, ombrage) vu en liste, non lu (PROBABLE : ombrage par pixel décrit dans le README).
- `packages/liquid-gooey` : README entier, `src/filter.tsx` (flou + matrice alpha + `atop`, passes d'ombre sur la silhouette fusionnée), `src/spring.ts` (ressort simulé puis compilé en `linear()` CSS). ÉTABLI. `observer.ts` (2 223 lignes) non lu.
- `packages/voice-glow` : README (200 premières lignes) et `LOOKS.md` (80 lignes), en-tête de `src/voiceDriver.ts` + suiveur attaque/relâche + respiration au repos. ÉTABLI pour ces parties.
- `packages/metal-fx` : README entier, `src/engine/shaders.ts` (en-tête : matériau « liquidMetal » de Paper Shaders), `src/engine/cursor/light.ts` (en-tête : lumière du pointeur, garde-fous), début de `reflection/paint.ts`. ÉTABLI pour ces parties.
- `packages/img-fx` (le chargeur d'image en mosaïque) : README entier, début de `src/engine/reveal.ts`. ÉTABLI.
- Site : `sites/home/` (liste des pages), `src/beam.tsx` (120 premières lignes), `src/gooey.tsx`, `src/metal.tsx` (80 lignes). ÉTABLI.

Site public, Chromium sans option (captures dans `scratchpad/instr/refs/`) :
- Accueil, Border beam, Thinking orbs, Bot avatars (« bots » et « avatars »), Gooey, Voice, Metal : statut 200, captures, défilement, survol.
- Joué : Gooey, clic sur « + » (menu qui se scinde en gouttes, capturé à 250 ms et ouvert), glisser du curseur « Move » ; Metal, survol du bouton d'envoi ; Bots, clic (saut) ; Orbs, défilement des cartes ; Voice, état au repos.
- **Erreurs exactes** : page « image » : `page.goto: Timeout 45000ms exceeded.` (attente networkidle puis domcontentloaded), puis en `commit` : `page.screenshot: Timeout 30000ms exceeded.` ; page « studio » et « studio.html » : `page.goto: Timeout 45000ms exceeded.` Non contourné. Aucun défi anti-robot vu.

## Mécanismes retenus
- **Border beam** : la lumière n'est qu'une fenêtre angulaire (cône) qui tourne, posée seulement sur le bord ; deux familles qui disent deux choses : *rotation* (quelque chose avance) et *respiration* (présence calme, pas d'avancée), fondu d'entrée 0,6 s / de sortie 0,5 s, respiration à 30 i/s, désactivée en mouvement réduit et hors écran.
- **Bot avatars** : un état = une pose de repos + son mouvement propre ; changer d'état mélange les poids sur une courbe douce (on ne claque jamais d'un état à l'autre) ; s'endormir est lent (1,4 s), se mettre au travail rapide (0,7 s) ; mouvement réduit = la pose fixe de l'état ; étiquette d'accessibilité par état.
- **Gooey** : deux couches, la silhouette (flou + seuil alpha) dessous, le vrai contenu net dessus ; des pièces qui se touchent fusionnent, se séparent en gouttes ; les ressorts sont pré-calculés en courbes `linear()` (0 coût au repos) ; mouvement réduit = sauts instantanés.
- **Voice** : un niveau suivi par une enveloppe attaque rapide / relâche lente ; une respiration de repos pour ne « jamais paraître mort » ; option `idle=0` pour un vrai silence.
- **Metal** : un anneau de matière autour d'un seul élément, des reflets sur les voisins (en sombre seulement), la lumière qui répond au pointeur ; tout s'arrête en mouvement réduit.
- **Mosaïque (img-fx)** : un motif « en train de se faire » qui se dissout cellule par cellule en résultat, à 10 i/s.

## Ce que j'en fais pour Ariane
- Lumière de bord en rotation = Ariane avance seule ; respiration = elle attend un geste ; éteinte = rien ne se passe (maquette métal).
- Gouttes qui se détachent de la masse = cuts qui restent à regarder ; parties de la file qui fusionnent une fois faites (maquette gelée).
- Transitions d'état par mélange de poids, lentes vers le repos, vives vers le travail (toutes les maquettes).
- Enveloppe attaque/relâche pour l'activité d'Écho (un geste vu par Ariane monte vite, retombe lentement).

## Ce que j'écarte
- Les dégradés arc-en-ciel et la dérive de teinte (couleur décorative, et dégradés multicolores proscrits).
- Fourrure, plastique, accessoires des avatars (décor sans sens).
- WebGL (métal liquide, mosaïque) : ici des moyens CSS/SVG suffisent, et la maquette doit rester légère.
