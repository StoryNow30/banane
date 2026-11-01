# Référence : 60fps.design (famille « Le mouvement porte l'état »)

Lu le 29/10 dans Chromium (playwright, `chromium.launch()` sans option). Aucun défi, aucun refus : toutes les pages ont répondu 200. Fichiers de travail : `scratchpad/mouv/r60/` (textes, liens, captures, images extraites des vidéos).

## Ce que j'ai ouvert exactement
- **Catégories** (ÉTABLI, texte et liens relevés) : accueil/Shots (2 125 fiches annoncées, 32 visibles sans compte, « Load More » ne charge qu'une page), Apps (index iOS, 494 apps), Motion (bento de marques : Wise, Lyft, Rivian…), Snippets (32 extraits SwiftUI), Glossary (lu en entier, ~100 définitions), Storyboards (67 annoncés, 5 visibles sans compte).
- **Filtres** (ÉTABLI) : progress, counter, ticker, timer, loading, success-state, toast, card-stack, stagger, spring-physics, morph, widget, stats, idle-animation. Chaque filtre ne montre que 6 fiches sans compte (« Access all shot filters with PRO subscription ») ; j'ai lu la phrase de définition de chaque filtre.
- **20 snippets ouverts** (description + début du code SwiftUI public + 4 images de la vidéo) : Circle Progress Fill, Number Flip with Reflection, Cancel Button Expand to Confirm, Delete to Confirm Button, Hold to Commit Button, List Fade Up from Down, Button Border Stroke Pulse, Continue Button to Tick, Comma Jump Number Input, Plus to Tick Button, List Item Accordion Expand, Line Graph Morph, Spin to Circle, Forward Toast Icon, Bottom Sheet Detail Expansion, Tap to Hold Button Pulse Morph, Subscribe Button Change, Free Trial Switch Amount Change, Tactile Button, Graph Scrub Highlight Glow, Hide Sensitive Number. Le code n'est montré que sur ses 20 à 50 premières lignes (« N more lines in the full snippet, with PRO »).
- **38 shots ouverts** (description + 4 images de la vidéo) : Circle Wallet Claim Balance, CRED Ticket Pop on Slider, CRED Printing Tickets Shuffle, CRED Autopay Bills Stack, CRED Swipe to Pay, Revolut Create/Close Pocket (×2), Revolut Number of Transactions, Revolut Feature Buttons Coachmark Border Pulse, Uber Loading, Uber Search Border Highlight, Platen Typewriter, Run Receipt Signature, Dtd Sounds Focus End Print Receipt, Dtd Sounds Sun Morph, Opal Hold to Leave, Opal Code Copied Text Pop, Avec Email Clean Stack Up Timeline, Wabi Soothing Loading, Monogram Pulse Calendar Connect, Methods Notifications Pop, Duolingo Copy Link Toast Bounce, Duolingo Battery Fill Up, X Money Intro Sequence, Swiggy Calendar Tear, Trackables Card Morph, LEGO Timelapse Slider, Swypn Card Swipe, X Create New Folder Sheet, Okuri Run Dots, Circle Menu Dropdown Morph, Microsoft Teams Catch-up Sheet, Picky Card Scan Sort, Spark Elements Shuffle, Sudoku Complete Confetti, Recollect Bottom Sheet to Page, Binge Buddy Swipe to Bucket, ChatGPT Year Stats Flip ; une fiche Motion (Wise par Ragged Edge) et une fiche App (Revolut).
- **Vidéos** : elles jouent dans Chromium (mp4 décodé, `readyState 4`) ; j'ai fixé `currentTime` à 15, 40, 65 et 90 % et capturé l'élément vidéo. Planches regardées : `r60/pl1.png` à `pl4.png`.

## Ce que j'en retiens pour Ariane (ÉTABLI = lu ou vu)
1. **Le compteur qui roule** (Number Flip, Circle Wallet, Revolut Transactions) : chaque chiffre glisse verticalement avec un léger flou ; seul le chiffre qui change bouge. Pour « N traités sur M », c'est le signe « ça avance » le plus lisible de loin, et il est neutre en couleur.
2. **La pile qui se déplie en liste** (CRED Autopay Bills Stack, ÉTABLI sur les 4 images) : des cartes empilées en profondeur défilent une à une, puis la pile se déploie en liste complète. Exactement le passage « ce qui reste » compact → « ce qui reste » détaillé.
3. **Les cartes écartées une à une puis l'état de fin** (Microsoft Teams Catch-up) : la pile se vide, puis une coche apparaît. Fin de lot = la pile est vide.
4. **Bouton qui s'étire pour confirmer** (Cancel Expand to Confirm, Delete to Confirm) : l'arrêt en deux appuis du moteur (« Arrêter ce lot » → « Confirmer l'arrêt ») trouve ici sa forme : le bouton s'élargit sur toute la rangée et les autres actions s'effacent, le libellé change ; un appui ailleurs le replie.
5. **Points qui se regroupent puis coche** (Continue Button to Tick) et **plus → point → coche** (Plus to Tick) : une forme qui change de nature pour dire « fait ».
6. **Tenir pour engager** (Hold to Commit, Opal Hold to Leave) : à écarter pour l'arrêt (ESV demande un geste simple, le moteur gère déjà la confirmation par 2 appuis).
7. **Bordure qui fait le tour** (Uber Search Border, Revolut Coachmark) : un seul signe « regarde ici » qui ne déplace pas la mise en page. Utilisable avec parcimonie pour « Ariane attend l'opérateur », mais c'est un halo : seulement si le sens est écrit.
8. **Deux formes qui se croisent en boucle + sous-titre qui change en fondu** (Uber Loading) : un signe d'attente sans fin, monochrome, distinct d'une progression.
9. **Liste qui entre de bas en haut, puis un contour s'élargit autour d'une ligne** (List Fade Up) : une file temporelle et le « maintenant » désigné par un contour.
10. **Feuille dont la taille change avec son contenu** (Bottom Sheet Detail Expansion, Revolut Transactions) : le conteneur garde son identité, il grandit, l'ancien contenu sort plus vite que le nouveau n'entre.
11. **Calendrier dont la page se détache et tombe** (Swiggy) : un décompte qui « perd » une unité visiblement. Pour les parties d'une file : la partie finie se détache.
12. **Glossaire** : « Ticker = scrolls numbers continuously to display live data », « Stagger », « Morph », « Pulse » ; les définitions confirment qu'un même effet doit avoir un rôle unique.
13. **Mouvement réduit dans le code public des snippets** (ÉTABLI) : chaque snippet lit `accessibilityReduceMotion` ; Circle Progress Fill saute directement à l'état final (`time = reduceMotion ? 10 : elapsed`), Button Border Pulse met la boucle en pause (`paused: … || reduceMotion`), Comma Jump remplace le décalage par une simple opacité. Leçon : en mouvement réduit on montre l'état final, pas l'animation ralentie.
14. **Une horloge pilote les formes, rien ne les interpole** (commentaire du code de Circle Progress Fill : « The clock drives the shapes directly; nothing should interpolate them ») : utile pour mon problème de rendu toutes les 0,9 s (je pilote l'animation par une horloge locale conservée, pas par des transitions CSS rejouées).

## Ce que j'écarte et pourquoi
- Confettis, particules, mascotte, rebonds gamifiés (Duolingo, Sudoku) : un lot fini n'est pas une récompense ; l'opérateur veut un bilan, pas une fête.
- Désintégration en particules (Revolut Close Pocket) : spectaculaire, illisible de loin, et confond « supprimé » et « fini ».
- Halo, lueurs, bordures lumineuses en boucle (Revolut, Uber) : seulement si le sens est écrit ; jamais en décor.
- Tenir pour valider : contraire au geste simple attendu.
- Bentos de marque (Motion) : identité visuelle, pas micro-interaction ; hors sujet.

## Limites d'accès (exactes)
- Filtres : 6 fiches visibles chacun, texte « Access all shot filters with PRO subscription. Unlock with PRO ».
- Snippets : code tronqué, texte « // N more lines in the full snippet, with PRO ».
- Storyboards : 5 visibles, texte « Access all hand crafted storyboards with PRO subscription ».
- Accueil : « Load More » n'ajoute qu'une page (32 fiches), puis le bouton disparaît.
Aucun défi Cloudflare, aucune erreur HTTP.
