# CH-101, troisième tour : une vraie refonte du panneau (demande à la session du chantier, 10/11/2026, D-325)

## Pourquoi ce tour

L'opérateur a regardé ta page du deuxième tour. Sa réponse : « Je trouve que ça ressemble déjà trop à ce qui existe déjà. Quel est l'intérêt de faire un prompt pour me faire des propositions à ceux qui existe déjà. »

La faute est dans ma demande, pas dans ton travail. Je t'avais imposé la même organisation, aucune information retirée et un travail d'apparence seulement : dans ces limites, tu ne pouvais que repeindre l'existant, et c'est ce qu'il a vu. Je lève ces limites.

Je lui ai reposé deux questions. Ses réponses :

- Jusqu'où les propositions peuvent aller : « refonte complète ». Tout peut bouger : la disposition de l'écran, ce qui est grand ou petit, la forme de l'avancement, les textes. L'information secondaire peut être cachée derrière un clic. Les propositions ne doivent plus ressembler au panneau actuel.
- Ce qui doit se voir en premier quand il jette un coup d'œil au panneau pendant un lot : « tout va bien ou non » (Ariane travaille, attend, ou a besoin de lui) et « où en est le lot » (combien de cuts sont faits, combien il en reste). Il n'a pas retenu « ce qui m'attend » ni « le cut en cours » : ces deux informations existent toujours, mais elles ne sont pas le premier plan.

Ce qu'il a dit aux tours précédents tient toujours, et c'est ce qui rend ce tour difficile. Du premier tour, il a rejeté l'allure générale, l'écran trop chargé, les couleurs et les polices, et les dessins « métier » (plus de voie, de rail ni de trait par cut). Le style qui lui plaît reste « sobre et net » (Linear, Notion, Raycast) et « système Apple ou Google ». Il a donc refusé d'un côté des idées trop voyantes, et de l'autre une finition trop sage. Ce qu'il attend est entre les deux : un panneau qu'on ne reconnaît plus, mais dont l'audace vient de la composition et non du décor. Une chose dominante par écran, à une échelle franche ; beaucoup d'espace ; presque rien d'autre au premier plan ; le reste à un clic. Pense à la différence entre une page de réglages et un écran d'accueil de téléphone ou un widget : même sobriété, tout autre parti pris.

## Ce que tu livres

Une nouvelle page de comparaison publiée en privé, dont tu m'envoies le lien, sur le modèle de celle du deuxième tour (le panneau d'aujourd'hui à gauche, les propositions à côté, les boutons de thème et de taille, presque pas de texte).

Trois propositions de refonte. Elles doivent différer du panneau actuel au premier regard, et différer entre elles par leur composition, pas par une teinte ou un arrondi. Dans chacune, l'état (tout va bien, en attente, à toi, en panne) et l'avancement du lot se lisent d'un coup d'œil, de loin, sans lire une phrase. À toi de trouver trois partis pris ; je ne t'en souffle aucun, parce que ceux que j'imaginerais seraient moins bons que ceux que tu tireras des références.

Chaque proposition est montrée sur les huit mêmes états, aux deux tailles, en clair et en sombre. En grande taille, l'espace doit servir à quelque chose : une fenêtre à moitié vide était déjà un défaut du deuxième tour.

Le tour est terminé quand la page est publiée et que, pour chaque proposition : les huit états existent dans les deux thèmes et aux deux tailles ; rien ne déborde ni ne se tronque ; tout texte atteint un contraste de 4,5 pour 1 ; aucune police ni ressource ne vient de l'extérieur ; chaque action du panneau actuel reste atteignable (au premier plan ou à un clic, et tu dis où) ; et un relecteur neuf répond oui aux deux questions de la partie « Vérification ».

## Matériel

Ta branche et son générateur, comme avant. Les mots de l'opérateur sur tous les essais passés sont dans `DECISIONS.md` (D-230 à D-236, D-256, D-257, D-271, D-323, D-324, D-325).

Avant de dessiner, regarde de vraies interfaces du genre qu'il cite, pas le souvenir que tu en as : tu as la recherche et la lecture de pages web, et l'opérateur t'autorise Figma et tout autre connecteur disponible. Cherche en particulier comment des produits sobres montrent un travail long en cours et son avancement (une activité en direct sur téléphone, un widget de bureau, le panneau de téléchargement d'un navigateur, l'écran d'une tâche dans un outil comme ceux qu'il nomme). Note en une ligne par proposition de quelle référence réelle elle s'inspire.

## Périmètre

Toujours des maquettes seulement : aucun fichier de l'extension ne change. Ce qui reste fixe est court. Chaque bouton garde son rôle (Pause met en pause, Arrêter arrête, Lancer lance un lot neuf, Continuer reprend le même lot, Préparer ne lance rien). Aucune action n'est ajoutée ni supprimée. Le bouton « SKIP explicite » reste masqué (D-320). Pas de dessin de voie, de rail ou de cut. Tout le reste est libre : disposition, tailles, hiérarchie, forme de l'avancement, textes, ce qui est au premier plan et ce qui passe derrière un clic. Si tu changes un texte, garde son sens ; liste à part les textes changés. Les autres écrans (Écho, Constellation, Aurore, réglages) ne sont pas dessinés à ce tour.

## Ce que tu décides seul, et ce qui attend un accord

Tout ce qui concerne les maquettes est à toi, y compris de jeter une proposition qui te paraît sage et d'en refaire une autre. Obtiens le choix écrit de l'opérateur, par moi, avant d'intégrer quoi que ce soit dans l'extension. Obtiens mon accord avant de faire tourner plus de deux sous-agents à la fois. Commite et pousse à chaque étape.

Ne t'arrête pas tant que la page n'est pas publiée avec ses trois propositions complètes.

## Vérification

Deux écueils sont connus, et le relecteur neuf sert à vérifier que tu évites les deux. Donne-lui seulement les images et ces deux questions. Première question, avec le panneau d'aujourd'hui à côté et les images réduites à la taille d'une vignette : « ces écrans sont-ils clairement différents de celui d'aujourd'hui, et différents entre eux ? ». Deuxième question, en taille réelle : « cette interface a-t-elle la sobriété et le niveau de finition d'un produit comme Linear ou d'un écran système d'Apple ? cite les cinq défauts les plus visibles, et dis si quelque chose fait décor ou surcharge ». Corrige et refais la relecture après tes dernières corrections : au deuxième tour, les dernières retouches n'avaient pas été relues. Mesure débordements et contrastes par script. N'affirme que ce qu'un outil t'a montré pendant cette session, et dis ce qui n'est pas vérifié.

## Compte rendu

Par `send_message` (`@parent`) : le lien et dix lignes au plus. Pour chaque proposition, son parti pris en une phrase et la référence réelle dont elle s'inspire ; ce qui est passé derrière un clic ; ce que tu as vérifié et ce qui ne l'est pas ; ta recommandation. Des mots simples, des phrases courtes. Un message court aussi à chaque étape importante et avant de finir un tour.
