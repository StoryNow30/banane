# CH-136 : rapport de la recette totale de la 5.0 (fini)

Branche `chantier/CH-136`, partie de `integration/cloture-50` (480928f, avant CH-134 et CH-135). Ce qui est fait : le service worker est corrigé en patch seulement (`chantiers/CH-136/background.patch`, à appliquer avec `git apply` ; `git apply --check` passe sur 480928f). Ce qui n'est pas touché : aucun fichier de décision, aucune pose, aucune écriture nouvelle dans ESV ; jamais de SKIP.

## 1. Le réglage aj5 perdu : cause ÉTABLIE
- Ce que disent les journaux : d'après le champ `machine`, le lot du 16/11 et ceux du 17/11 (le bilan v19 du matin et le journal v19.1 de l'après-midi) ont tourné sur **deux postes différents**. Le navigateur, le processeur, la mémoire et la carte graphique ne sont pas les mêmes, et les sessions d'Ariane diffèrent aussi.
- La preuve que le stockage était neuf : le 17/11 à 14:09 UTC, la télécommande a dû être appairée de nouveau (événement `telecommande-appairee`).
- Pourquoi aj5 était éteint : aj5 est gardé dans `chrome.storage.local`. Ce stockage appartient au profil Chrome d'un poste et à l'identifiant de l'extension. Avec la version 2b07cb1, une clé absente voulait dire « éteint ».
- Conclusion : ce n'est pas un défaut du code. D-367 (clé absente = allumé) est déjà sur la branche d'intégration.
- Les autres réglages perdus de la même façon : tous ceux qui sont gardés en local.
  - Télécommande : l'appairage, et l'adresse du relais, sauf quand le paquet la porte.
  - Choix du lot : clic du mode rapide, raison, relecture, passe des différés, profil du lot.
  - Affichage : thème, palette, interface.
  - Données de travail : file des parties, mémoire de la liste, fiches de départ, fins de lot.
- **Protection ajoutée** : le module `src/stockage-neuf.js` affiche le bandeau « Réglages neufs sur ce poste » quand le stockage ne contient aucun choix de l'opérateur.
  - Le bandeau donne les valeurs par défaut et se ferme par « Compris ».
  - Sur un poste déjà utilisé, le module pose sa marque sans rien afficher. Il n'écrit que sa marque, jamais un réglage.
  - Placement : bandeau fixe posé dans `<body>`, car `<main>` est caché sous Signal. Tant qu'il est affiché, sa hauteur est réservée en bas.
  - Accessibilité : il devient inert sous les couches de Signal. Ses couleurs sont propres aux thèmes clair et sombre.
  - Essai : `tests/ch136-stockage-neuf.test.cjs` (11 essais, chacun rouge puis vert).

## 2. Défauts trouvés et corrigés (essai rouge, correctif, essai vert)
| # | Défaut | Preuve | Correctif |
|---|---|---|---|
| 1 | Une écriture partie sans réponse s'arrêtait sur le texte « aucune écriture de validation vue en 6 s », alors qu'Ariane avait attendu 30 s. | `ch136-ecriture-en-route-message-sw` | Le message dit « écriture de validation partie mais sans réponse en 30 s », dans la relecture et dans la deuxième passe (patch). |
| 2 | Avec des bornes, une relecture arrêtée perdait la mention « ESV a marqué N cuts « vu » » : un `else if` se retrouvait rattaché au `if` des bornes (CH-133). | `ch136-relecture-bornes-vu` | Les deux phrases sont indépendantes (patch). |
| 3 | D-363 : après un redémarrage du service worker, la reprise de la deuxième passe oubliait les refus d'avant et se disait « finie ». | `d363-passe-refus-reprise-sw`, assertion corrigée sur l'accord de l'intégrateur | Les refus d'avant comptent : la passe se dit arrêtée sur le dernier refus, et « Relancer » reste offert (patch). |
| 4 | `ch133-relecture-bornes` durait 26 s, alors que le verify coupe un fichier à 20 s. Il échouait déjà sans CH-136. | verify n°1 | Le fichier est découpé en 4 (de 5 à 8 s chacun). |
| 5 | Bandeau (mon ajout) : il était invisible sous Signal, atteignable par Tab sous une couche, mal placé dans panel.html, et à 320 px il faisait défiler l'écran du lot de 28 px. | essais unitaires, `ch106`, `version-49514`, audit | Bandeau dans `<body>`, inert sous une couche, chargé après `telecommande-panneau.js`, plus court et plus serré sous 480 px. |

## 3. Essais (mesurés)
- **verify n°2** (machine au repos, branche avec le patch appliqué) : 3 709 essais, 3 701 réussis, 0 échec, 0 annulé, 8 sautés (corpus Natif absent).
  - Le verify n°1 avait 5 échecs. Je faisais alors tourner d'autres essais à côté. Trois venaient du bandeau, un de ch133 (défaut 4), un d'un clone superficiel (`typage-ch075` : environnement).
  - Les ch104 rejoués seuls sont verts. Les 34 fichiers d'essais en navigateur passent aussi quand ils tournent ensemble (63 sur 63). Cause PROBABLE de leur échec : la charge.
- **Maquette ESV, 2 passages** (patch appliqué) : à chaque passage, 87 réussis sur 90, 0 échec, 3 sautés (le n° 14 parce que le patch CH-080 est intégré ; les n° 80 et 81 parce que l'export réel est absent), puis 15 sur 15 dans la suite complémentaire.
  - Les fragiles CH-028 et CH-110 passent les deux fois. Leur cause n'est pas établie, faute d'échec reproduit.
  - La télécommande de bout en bout (ch111, ch130) passe les deux fois.
- **Audit visuel** (`chantiers/CH-136/outils/audit.cjs`) : audit de CH-129, auquel j'ai ajouté les deux thèmes, le bandeau affiché ou non, et un contrôle de recouvrement (le centre de chaque bouton visible doit tomber sur le bouton lui-même).
  - Après correctifs, avec le bandeau, à 320 et 400 px : 156 vues, 0 défaut.
  - Sans le bandeau, à 320 et 600 px : 78 vues, 0 défaut.
  - Audit complet avec le bandeau : 546 vues, 0 défaut (§ 6).
- **Scénarios de terrain** : couverts par la maquette (vraie extension).
  - Lot complet, Constellation de 2 et 3 parties.
  - Arrêt et reprise de la file.
  - Pause et reprise, avec signal éteint, pendant le lot (CH-062) et pendant la relecture (CH-060).
  - F5 pendant la relecture (CH-109).
  - Série de captures vides.
  - Aurore sur 3 parties.
  - Télécommande.
  - Ajouté : `tests/esv-maquette/ch136-relecture-bornee.test.cjs`, relecture en pause puis reprise bornée (**poussé, pas encore lancé**).
  - Couverts seulement par les essais du service worker (vm), pas par la maquette : la correction incertaine suivie de l'acquittement (`ch133-*`, `relecture-sw-*`) et le refus avant écriture D-363 (les essais `passe-differes-*`, tous verts). Les essais de la passe sur la maquette sont sautés, faute d'export réel.

## 4. Ce qui n'est pas fait
- La cause des fragiles CH-028, CH-110 et ch104 n'est pas trouvée : aucun échec reproduit, ni seul, ni sous charge (jusqu'à 12 cœurs occupés), ni sur 2 passages de la maquette.
- Le scénario maquette « relecture bornée » n'a pas tourné.
- La relecture adverse du rendu de `src/signal-rendu.js` et de `telecommande/telephone.html` ligne à ligne n'est pas faite : je me suis appuyé sur l'audit visuel et sur les essais de bout en bout.
- L'audit est fait sur le panneau d'avant CH-134 : il est à refaire sur le panneau A (l'intégrateur l'a annoncé).

## 5. Propositions (décision de l'opérateur, rien n'est fait)
- Garder les réglages d'un poste à l'autre : `chrome.storage.sync` pour les seuls choix de l'opérateur, ou un export/import des réglages depuis le panneau.

## 6. Pour l'intégrateur
- Patch : `git apply chantiers/CH-136/background.patch`.
- Point d'insertion : dans `panel.html`, `<script src="src/stockage-neuf.js"></script>` juste après `src/telecommande-panneau.js`, en gardant l'ordre `raison-correction.js` puis `panel.js`.
- Si le panneau A change les sélecteurs des couches ou la position fixe de `#ui5`, seuls `COUCHES` et `STYLE` sont à ajuster, dans `src/stockage-neuf.js`.
- Audit complet AVEC le bandeau (7 largeurs × 2 thèmes × 3 palettes × 13 scènes, recouvrement compris) : **546 vues, 0 défaut**. Audit complet SANS le bandeau : arrêté à l’échéance de l’intégrateur (seul l’échantillon de 78 vues, 320 et 600 px, sombre, est fait : 0 défaut).
