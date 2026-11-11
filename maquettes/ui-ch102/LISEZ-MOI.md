# CH-102 : maquettes du panneau construites avec Exact (D-326) — ARRÊTÉ par l'opérateur le 11/11/2026

**Verdict de l'opérateur, dans la conversation du chantier, sur une planche de vignettes des trois propositions : « C'est terrible moche ».** Interrogé : l'allure générale, les couleurs, la composition et les caractères sont tous en cause ; aucune des trois ne mérite d'être poussée ; il arrête Exact pour ce tour et décide de la suite avec la session principale. La page de comparaison n'a donc pas été publiée, et aucun repli en HTML n'a été fait.

Rien n'est intégré dans l'extension. Rien d'Exact n'est dans ce dépôt : seules les sources des trois applications et les outils y sont. Aucune capture ici.

## Ce qui a été fait (ÉTABLI, vu par un outil pendant la session)

- Exact installé sur la machine de travail (`exact setup --check` : « SDK tools ready »), hors dépôt. Deux obstacles levés : le paquet Hermes pris par `curl` et servi par un miroir local (`HERMES_LEAN_SYS_MIRROR`, somme de contrôle épinglée vérifiée), parce que l'outil de téléchargement d'Exact refuse le certificat du proxy ; Bun 1.4.2 installé à côté. `EXACT_FEEDBACK=0` : rien n'est parti vers Expo.
- Trois applications Exact qui tournent sur l'hôte web : `fiche`, `carte`, `bandeau`. Pour chacune : compilation sans erreur ; `bun exact.mjs test web` : 2 passed, 0 failed, dont le parcours des huit états ; `bun exact.mjs verify` : aucun défaut aux tailles normales, clair et sombre (mesuré sur le deuxième jet ; reste un défaut à la plus grande taille de texte d'accessibilité, le mot « Terminé » plus large que l'écran).
- 96 images à deux pixels par point (3 propositions × 8 états × 360/600 × clair/sombre), hors dépôt. Mesure sur le dernier jet : aucun bouton ni champ hors du cadre ou sous le pli, sauf les boutons « Ouvrir » de la liste « à poser » de la fiche, qui défile par construction.
- Colonne « aujourd'hui » : outil de CH-101 (`maquettes/ui-ch101/outils/capturer2.cjs`, branche `chantier/CH-101`, commit 280e2b7), relancé ici : 32 images hors dépôt.
- Version web réelle d'une application servie dans un sous-dossier (`outils/embarquer.cjs`) : essayée en local, l'application s'affiche et répond. Jamais essayée dans une page publiée.
- Une relecture par un agent neuf, sur images seules (deuxième jet) : différentes d'aujourd'hui et entre elles, oui ; sobriété et finition d'un écran système, **non pour les trois**. Le troisième jet, fait d'après ses défauts, n'a pas été relu.

## Fait utile pour la suite

Sur l'hôte web, le seul qui tourne sous Linux, Exact dessine l'allure d'une application web générique : fond blanc, boutons à filet, bleu standard, police du système (Inter sur les machines de travail). Les contrôles d'Apple n'existent que sur ses hôtes macOS et iOS. « Ce que l'auteur ne dit pas appartient à la plateforme » donne donc, dans Chrome, un écran neutre, pas un écran Apple. SUPPOSÉ : c'est une part du rejet ; l'opérateur ne l'a pas dit en ces termes.

## Fichiers

- `modele.contract` : le lot fabriqué (partie 13, cuts 4790 à 4900 ; en cours : 18 cuts traités, 15 posés, 3 à poser ; fin : 93, 87, 6), les huit états, les actions par état, l'écran « Plus » commun.
- `fiche/`, `carte/`, `bandeau/` : `vue.contract` et `app.test.contract`.
- `assembler.cjs` : fabrique `app.contract` (en-tête de la vue, fonctions du modèle, vue, écran « Plus ») dans le dossier de l'application Exact, hors dépôt.
- `outils/photographier.cjs` (images et mesure du cadre), `outils/embarquer.cjs` (application dans un sous-dossier), `outils/page.cjs` (page de comparaison ; écrit, jamais lancé).

## Les trois propositions refusées (pour ne pas les refaire)

1. **La fiche** : une carte d'état à la manière d'une page de réglages (signe d'activité ou d'alerte, mot d'état, compte, barre, boutons), puis la liste des cuts à poser.
2. **La carte** : l'état en très grand titre, une carte avec un grand chiffre et une barre, teintée en orange ou en rouge quand Ariane attend l'opérateur.
3. **Le bandeau** : écran neutre, en-tête d'état en aplat orange ou rouge seulement en alerte ; compte et barre dessous.

Dans les trois : bouton plein réservé à ce qui est attendu de l'opérateur ; le secondaire (Écho, Aurore, Constellation, exports, cache, onglet ESV, réglages) derrière un bouton « Plus » ; aucune action ajoutée ni retirée ; « SKIP explicite » absent (D-320).
