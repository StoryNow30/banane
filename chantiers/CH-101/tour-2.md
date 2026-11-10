# CH-101, deuxième tour : de nouvelles propositions pour le panneau (demande à la session du chantier, 10/11/2026, D-324)

## Pourquoi ce tour

L'opérateur a le panneau latéral de l'extension « Vision » sous les yeux toute la journée, à côté d'ESV, pendant qu'Ariane pose des rails. Il a demandé une interface plus belle. Tes trois propositions du premier tour (A « Plan de voie », B « La coupe », C « Main courante ») sont rejetées. Ses mots : « Je trouve les maquettes proposées horribles, pire que tout ce qui a été proposé. » C'est la quatrième série de maquettes qu'il refuse sur l'allure (D-257, D-271, puis celle-ci). Le but de ce tour est qu'il voie enfin une proposition qu'il a envie d'installer.

Voici ce qu'il a répondu quand je lui ai demandé de préciser.

- Ce qui lui déplaît dans A, B et C : tout à la fois. L'allure générale, l'écran trop chargé, les couleurs et les polices, et les dessins « métier » (rails en coupe, plan de voie, traits par cut).
- Le style qui lui plaît : « sobre et net » (très peu de couleur, beaucoup d'espace, un texte bien hiérarchisé, comme Linear, Notion ou Raycast) et « système Apple ou Google » (l'allure des réglages de macOS, d'iOS ou de Chrome : familier, discret, qui se fond dans le navigateur).
- Ce qui le gêne à l'usage dans le panneau actuel : « rien, c'est surtout laid ». Le panneau fait son travail.
- Le point de départ : les deux. Une proposition qui améliore le panneau actuel sans le bouleverser, et une ou deux en rupture.

Ma lecture, que tu peux contester si tes images disent autre chose : le premier tour a cherché une idée (une métaphore ferroviaire, un langage de signes, une règle de couleur expliquée par un texte) là où il attend de la finition. Il ne veut pas qu'on lui réorganise son outil ni qu'on le lui explique. Il veut ouvrir le panneau et trouver qu'il a l'air d'un produit fini, du niveau des outils qu'il cite. Sa demande d'octobre de « symboles propres au métier » (D-256) est remplacée par sa réponse d'aujourd'hui : plus de dessin de voie ni de rail. Ses reproches d'octobre sur les couleurs (« les couleurs elles-mêmes », « le sens ne va pas ») et sur les symboles (« trop génériques, trop vibe codé ») tiennent toujours.

Dans le style qu'il cite, la qualité tient à peu de choses, toutes de l'ordre du réglage : une seule famille de caractères, celle du système ; une hiérarchie faite par la taille et la graisse plutôt que par des cadres ; des gris neutres et une seule couleur d'accent, rare ; des espacements réguliers sur une grille ; peu de traits et peu de bordures ; des chiffres alignés ; des boutons qui ressemblent à ceux du système ; le thème clair ou sombre suivi automatiquement. C'est sur ce terrain que ce tour se joue, et c'est là que je te demande d'être exigeant avec toi-même : une maquette « correcte » ne suffit pas, il en a déjà refusé une dizaine.

## Ce que tu livres

Une nouvelle page de comparaison, publiée en privé avec l'outil Artifact, dont tu m'envoies le lien. L'opérateur n'est pas designer : la page doit se comprendre en regardant les images, avec une phrase par proposition et pas de critique rédigée. Le panneau actuel y figure à côté de chaque proposition, pour comparer.

Trois propositions :

- la première part du panneau actuel (celui du tronc, qu'il a choisi de garder le 29/10) et le finit : même organisation, mêmes éléments aux mêmes endroits, tout le reste soigné ;
- les deux autres sont en rupture, chacune dans l'un des deux styles qu'il cite : l'une proche des panneaux et des réglages du système (elle doit sembler faire partie de Chrome), l'autre proche des outils sobres qu'il nomme.

Chaque proposition est montrée sur les huit mêmes états que le premier tour (prêt, lot en cours, pause, rail non résolu, ESV muet, rattrapage, relecture, fin de lot), aux deux tailles déjà utilisées, en thème clair et en thème sombre. Les libellés sont ceux du vrai panneau et les chiffres sont cohérents d'un état à l'autre.

Le tour est terminé quand la page est publiée et que, pour chaque proposition : les huit états existent dans les deux thèmes et aux deux tailles ; rien ne déborde ni ne se tronque ; tout texte atteint un contraste de 4,5 pour 1 ; aucune police ni ressource ne vient de l'extérieur ; et un relecteur neuf (voir « Vérification ») ne trouve plus de défaut majeur d'allure.

## Matériel

Ta branche `chantier/CH-101` et son dossier `maquettes/ui-ch101/` (générateur, états, photographies de l'existant) restent ta base de travail : le montage est bon, c'est le dessin qui est à refaire. Les fichiers du panneau actuel sont `panel.html`, `panel.css`, `panel-signal.css`, `panel-ui5.css`. Ce qui a déjà été refusé, et les mots de l'opérateur à chaque fois, sont dans `DECISIONS.md` (D-230 à D-236, D-256, D-257, D-271, D-323, D-324) et dans les dossiers `design/` et `maquettes/` ; la version qu'il a préféré garder est `maquettes/ui-5.0/Q-signal.html`. Regarde aussi à quoi ressemblent les panneaux latéraux de Chrome lui-même (liste de lecture, favoris, historique) : c'est le voisinage immédiat de ce panneau.

Une contrainte technique pèse sur les caractères. L'extension ne charge rien de l'extérieur, et ta machine n'a pas les polices des systèmes de l'opérateur : une capture faite chez toi ne montre pas le texte tel qu'il le verra. Choisis en connaissance de cause (la police du système, ou une police neutre embarquée dans l'extension) et écris sur la page, en une ligne, quelle police montrent réellement les images. Les deux polices du premier tour ne lui ont pas plu.

## Périmètre

Ce tour ne produit que des maquettes (HTML et CSS dans `maquettes/ui-ch101/`, sur ta branche) et la page publiée. Aucun fichier de l'extension ne change. Aucune action nouvelle, aucun bouton qui change de rôle, aucune information retirée dont l'opérateur se sert : c'est un travail d'apparence. Si un libellé actuel est tronqué ou trompeur, propose son remplacement dans une courte liste à part, sans l'imposer dans les images. Le bouton « SKIP explicite » reste masqué (D-320). Les autres écrans (Écho, Constellation, Aurore, réglages) ne sont pas redessinés à ce tour ; dis seulement en une phrase par proposition comment elle s'y étendrait. Les règles de `CLAUDE.md` s'appliquent en entier, dont celle-ci : aucune capture d'écran dans le dépôt.

## Ce que tu décides seul, et ce qui attend un accord

Tout ce qui concerne les maquettes est à toi : avance sans me consulter, tranche les détails, recommence une proposition si elle ne te convainc pas. Obtiens le choix écrit de l'opérateur, par moi, avant d'intégrer quoi que ce soit dans l'extension. Obtiens mon accord avant de faire tourner plus de deux sous-agents à la fois : la limite d'usage du compte a coupé les sessions deux fois aujourd'hui. Pour la même raison, commite et pousse à chaque étape.

Ne t'arrête pas tant que la page n'est pas publiée avec ses trois propositions complètes. Si un vrai blocage se présente, dis-moi ce que tu as trouvé et continue sur ce qui n'en dépend pas.

## Vérification

Regarde tes propres images avant de les montrer : photographie chaque état de chaque proposition et relis-les comme le ferait quelqu'un qui en a déjà refusé dix. Quand une proposition te paraît prête, confie-la à un sous-agent neuf, qui ne reçoit que les images, les réponses de l'opérateur citées plus haut et cette question : « cette interface a-t-elle le niveau de finition des réglages de macOS ou de Linear ? cite les cinq défauts les plus visibles ». Corrige, et recommence jusqu'à ce qu'il ne reste que des détails. Mesure les débordements et les contrastes par un script, comme au premier tour. Dans ton compte rendu, n'affirme que ce qu'un outil t'a montré pendant cette session, et dis ce qui n'est pas vérifié (au minimum : le rendu réel des caractères sur le poste de l'opérateur).

## Compte rendu

Quand la page est publiée, envoie-moi par `send_message` (`@parent`) le lien et dix lignes au plus : les trois propositions en une phrase chacune, ce que tu as vérifié et comment, ce qui ne l'est pas, et ta recommandation si tu en as une. Écris pour quelqu'un qui n'a pas suivi ton travail : des mots simples, des phrases courtes, aucun terme inventé en cours de route. Envoie aussi un message court à chaque étape importante, et avant de finir un tour : le texte de fin de tour ne m'arrive pas.
