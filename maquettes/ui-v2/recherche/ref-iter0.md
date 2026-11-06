# Référence : iter0.com (famille « Éditorial, typographie et récit »)

## Ce que j'ai ouvert exactement (Chromium, navigation ordinaire, 29/10)
- Accueil, 1440×900, 10 tranches de défilement (hauteur 7 949 px) ; puis 12 captures toutes les 2,2 s sur le bloc des six étapes pour suivre la séquence jouée seule (Uncover → Research → Sharpen → Iterate → Edit). Les clics directs sur les onglets ont échoué (« Timeout 4000ms exceeded » : les libellés sont des liens ou des éléments recouverts) ; la séquence automatique a suffi à voir les six états. ÉTABLI.
- Code du titre : `h1.word-flip`, mots en `span style="--i:n"` (apparition décalée mot à mot) ; sous « Sharpen », un SVG `.pencil` : deux `path` superposés (`pathLength="1"`, épaisseur 4 puis 1,6, décalés de 0,8 px), filtre `feTurbulence` + `feDisplacementMap` (le « grain » du crayon) + masque de papier, dégradé d'opacité 0,35 → 1 → 0,5 le long du trait (le crayon qui appuie puis se lève) ; variables `--pencil-delay:1s; --pencil-time:0.75s`. ÉTABLI (lu dans le DOM).
- « Second opinion » (3 892 px), « Pricing » (2 366 px), « Product / Launch CEO » (7 500 px), « Blog », « Learning » (le menu Resources mène à Blog, Learning, Docs, Launch readiness). ÉTABLI.
- Polices mesurées (getComputedStyle) : Fraunces 600 à 64/48/40 px pour les titres, Geist 400/500 de 10 à 16 px pour tout le reste. Fond blanc, texte rgb(29,29,31). ÉTABLI.

## Ce que j'y ai vu
1. **Le récit porte l'état.** Le bloc des six étapes n'est pas un schéma : c'est une conversation (« Founder », « Launch CEO », étiquette de rôle en petit gris au-dessus de chaque bulle), puis une liste de trois chercheurs dont l'état s'écrit en mots (« Reading… » avec cercle tournant, puis « ✓ Done »), puis l'en-tête qui passe de « Your CEO is researching » à « Research finished ». Les anciens messages s'estompent en haut quand de nouveaux arrivent. ÉTABLI.
2. **Le trait de crayon raye ce qui est réglé.** À l'étape Sharpen, le titre fictif « AI-powered customer support. » est barré au crayon, et une annotation manuscrite en italique (« Four rivals say this. ») pointe la rature avec une flèche. Le trait barre = « ceci est écarté, on passe à autre chose », la note marginale = la raison. ÉTABLI.
3. **Onglets-étapes comme fil narratif** : six mots en ligne (Uncover … Launch), l'actif noir souligné, les suivants gris clair. Sur « Launch CEO », la même liste devient verticale, avec un filet noir à gauche de l'étape en cours, et des commandes discrètes « Pause / Replay » sous l'animation. ÉTABLI.
4. **Méta-ligne de progression** : « Read your site · 2s », « Sharpening · 1s », « Writing up what I understood… » : ce que fait l'agent + durée, en 12 px gris, au-dessus du résultat. ÉTABLI.
5. **Le « Launch brief »** : liste de définition en quatre lignes (Who / Lead with / Proof / Drop), libellé gris 14 px au-dessus, valeur noire 16 px, filets fins entre lignes, pied « Sources : … ». Ultra lisible, aucun décor. ÉTABLI.
6. **Notes de recherche sourcées** : trois colonnes (Competitors / Market / Customers), chaque note = constat, puis conclusion en gris, puis la source soulignée. ÉTABLI.
7. Fin de page : « Build a site you can **defend**. » avec le même trait de crayon sous le dernier mot ; fond quadrillé très léger sous le héros. ÉTABLI.
8. Pricing : trois colonnes égales, prix en grand sur une ligne, détails en liste à coches ; FAQ en accordéons « + ». ÉTABLI.

## Ce que j'en retiens pour Ariane
- Un panneau qui **raconte** le lot en phrases courtes (sujet, verbe, nombre) au lieu d'afficher des widgets ; une ligne méta « ce qu'Ariane fait · depuis combien de temps ».
- **Le trait qui rature** comme signe de « fait / écarté » : un cut traité, un différé vu, une partie finie se barrent d'un trait — mouvement qui a un sens (on raye la liste), pas un décor. Je reproduis le mécanisme (trait SVG `pathLength=1` animé par `stroke-dashoffset`), pas le dessin ni le filtre.
- Le **couple serif de titre + grotesque de texte** : la serif pour la manchette (l'état), la grotesque pour les nombres et les consignes.
- La **liste de définition** (libellé gris au-dessus, valeur forte) pour les bilans de fin de lot et de parties.
- L'**étiquette de rôle** au-dessus d'un message (« Ariane », « Opérateur ») pour l'activité Écho, où Ariane observe l'opérateur.
- Les étapes en ligne avec l'actif souligné pour la file de parties (partie 1, 2, 3).

## Ce que j'écarte et pourquoi
- Les personnages dessinés (chercheurs, fondateur) : décor, et le panneau doit se lire à trois mètres.
- Les bulles de chat en cartes ombrées : trop de boîtes imbriquées pour 360 px.
- Le filtre de grain du crayon : coûteux, invisible à 360 px, et le contraste du texte barré doit rester mesurable.
- Le fond quadrillé : il évoquerait un plan, sans rôle ici.

## Erreurs d'accès
- Aucune erreur HTTP (toutes les pages 200). Clics sur les onglets du héros : « locator.click: Timeout 4000ms exceeded » (élément recouvert) ; contourné en laissant la séquence se jouer seule, sans forcer.
