# Chantier UX — variantes du panneau (13 octobre 2026)

Commande de l'opérateur (direction, opérateur de terrain). Session dédiée à l'interface.
Branche de travail : `claude/ux-variantes` (partie de `claude/49-test-10`).

## Le problème

L'opérateur dit que la **moitié basse de la vue Orbite** est « illisible, sans aucune
conformité avec ma philosophie de design, juste horrible ».
Image : `design/references/ux-2026-10/panneau-orbite-bas-actuel.jpg`
(rendu réel du panneau 4.9.0 test 10, données fictives ; ouvrir l'image).

Ce qu'on voit, du haut vers le bas : titre ACTIVITÉ vide, boutons Pause /
Arrêter le lot, deux liens (« Tout télécharger… », « Masquer les détails »),
RÉSUMÉ DE LA PARTIE (une phrase + un détail replié), une ligne de comptes,
un grand vide, une phrase d'explication, EXPORTS DU LOT (quatre liens en
texte gris + « Vider le cache »), DÉPARTS DES PARTIES, RÉGLAGES DU LOT (trois
lignes de texte), CONNEXION À ESV (liste déroulante, bouton, phrase), pied.
Défauts probables : tout a le même poids ; des liens en gris sur noir presque
invisibles ; texte minuscule et dense ; un vide sans raison ; des actions
(exports, vidage) mêlées à de l'information ; aucune hiérarchie ; l'opérateur
ne sait pas quoi regarder ni quoi faire.

## Les pistes visuelles : l'application Porsche (captures jointes)

`porsche-accueil.jpg`, `porsche-recharge.jpg` (dans `design/references/ux-2026-10/`).
Ce qu'on peut en tirer (à toi de juger, ne copie pas, ne reprends ni logo
ni marque) :
- fond sombre à dégradé vert très profond, jamais un aplat noir ;
- de **grandes tuiles arrondies** à fond translucide un peu plus clair, bien
  espacées ; une tuile = une idée ;
- **gros chiffres** avec unité petite et atténuée (« 45 % | 143 km », « 90.7 kW ») ;
- **un seul vert vif** réservé à l'énergie / au progrès (la jauge) ;
- libellés de section en majuscules fines, courts ;
- lignes d'action larges : icône, libellé, chevron (« Minuterie », « Profils ») ;
- un seul objet héros par écran (la voiture, la jauge de recharge) ;
- très peu de texte, aucun paragraphe d'explication.

## La philosophie de design de l'opérateur (déjà actée dans le dépôt)

À relire : `design/ui-next/REFERENCE.md`, `design/ui-next-claude/README.md`
(« La ligne »), `design/pistes-retenues/README.md`, et D-045 dans `DECISIONS.md`.
En bref : opérateur, compact, discret dans ESV ; hiérarchie par la typographie ;
un seul accent ; couleur d'alerte douce et rare ; une donnée absente se dit
« non rapportée » (jamais confondue avec zéro) ; la forme porte l'état, la
couleur ne fait que renforcer ; pas de décoration. Français simple et court.
L'opérateur aime le design « sans le skill » (noir, traits fins, un grand chiffre) pour
le haut de la vue Orbite : **le haut ne change pas**, on retravaille le bas.

## Ce qu'il faut produire

1. **Quatre variantes** de la moitié basse d'Orbite (de « Activité » jusqu'au
   pied), de caractères vraiment différents, dont au moins une inspirée de
   Porsche (tuiles, grands chiffres, jauge) et une plus sobre dans la ligne
   « H ». Chaque variante : une maquette HTML autonome (données fictives, aucun
   identifiant de projet ESV), thème sombre et clair, rendue en PNG 480 px de
   large ×2 avec Playwright/Chromium (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`,
   ne pas lancer `playwright install`). Mettre le tout dans
   `design/ux-2026-10/variantes/` avec un `README.md` d'une page : l'idée de
   chaque variante, ses points forts et faibles, et ta recommandation.
2. Une **planche comparative** (un PNG côte à côte) avec l'état actuel pour que
   l'opérateur compare d'un coup d'œil.
3. Pousser sur `claude/ux-variantes` et envoyer les PNG à l'opérateur. **L'opérateur choisit.**
   Ne pas intégrer au panneau avant son choix.
4. Après son choix : intégrer la variante retenue dans `panel.html`, `panel.css`,
   `panel.js` en **gardant tous les identifiants** (`id=`) que `panel.js` et les
   essais lisent. Mettre à jour les essais seulement pour le texte ou la
   structure qui change, jamais pour masquer un défaut. Lancer `node tools/verify.cjs`
   sous `flock scratchpad/lourd.lock` (ou équivalent) et corriger jusqu'au vert.

## Règles intangibles

- Invariants de D-045 (test H) : la politique effective est affichée ;
  « Différés : N » est fidèle ; une incertitude se voit avec son cut ; aucun
  bouton ne se présente comme réussi sur un simple accusé de réception.
- Ne jamais toucher : `src/engine.js`, `src/geometry.js`, `vendor/*`, ni
  `background.js` (sauf nécessité absolue et dite à l'opérateur).
- Jamais d'identifiant de projet ESV (forme `\d{6}_\d{6}_[A-Z]_`) dans le dépôt,
  les captures ou les messages ; données fictives seulement.
- Aucune fusion dans `main`, aucun tag, aucune publication, aucune pull request
  sans demande explicite de l'opérateur.
- Pas de nouvelle version livrée : la version suivante (4.9.0.11) est préparée
  par la session de pilotage ; ce chantier fournit les fichiers du panneau.
- L'opérateur parle un français simple et veut des réponses courtes.
- Économie : travaille seul, des agents seulement si c'est vraiment utile.
