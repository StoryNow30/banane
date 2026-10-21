# Séance terrain « 4.9.5 test 17 (UI) » : le nouveau panneau, sur la pose de la test 16

**Ce qui change par rapport à la test 16 : seulement l'interface.**

- **La pose, le lot et la décision sont ceux de la test 16**, au même endroit, avec les mêmes réglages. Un lot lancé avec la test 17 (UI) pose ce que posait la test 16 ; une relecture après le lot, réglages d'interface éteints, fait ce que faisait la test 16.
- Ce qui est nouveau : un **nouveau panneau** que tu peux essayer, une **palette** au clavier, et la **pause de la relecture**. Les trois sont **éteints** au départ. Au départ tu vois le panneau de la test 16, rien d'autre.
- Ce qui n'y est **pas** : la deuxième passe en fin de lot, les gardes contre les poses fausses et le traitement des cuts sans pose. Ils viendront dans la version suivante (test 18), avec cette interface.

**Pas de chiffres de banc dans cette version** : la pose n'a pas changé, ceux de la test 16 restent les bons. La test 17 (UI) ne cherche pas à poser mieux ; elle cherche à te laisser juger l'interface.

## 1. Installer et vérifier

1. Exporte d'abord ce que ta version actuelle garde.
2. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.17-ui.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la test 17 (UI) par-dessus la test 16** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **F5 sur l'onglet ESV**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte, le panneau et le bouton blanc d'ESV disent « 4.9.5 test 17 (UI) ».

Il n'y a rien à régler : tu retrouves le panneau de la test 16, avec en plus, en bas de l'accueil, le lien « Essayer le nouveau panneau ».

## 2. Le nouveau panneau

**Passer au nouveau panneau.** En bas de l'accueil du panneau, clique sur **Essayer le nouveau panneau**. La fenêtre s'agrandit. Le choix est gardé : à la prochaine ouverture, tu retrouves le nouveau panneau.

**Ce que tu y trouves** : un accueil, Orbite, Écho, Revue, Réglages et bilans. Une rangée en haut montre les onglets ESV, avec un clic pour te connecter. Le bouton **Vider le cache** est visible dans Orbite et Écho, grisé tant que le lot n'est pas terminé, avec sa raison. Pas de grand titre, pas de ligne « parcours du lot ». « fin de partie » remplace l'ancien chiffre de borne « 999999 » ; sans onglet ESV connecté, la pastille dit « Aucun onglet ESV » (et non « Prêt »).

**Revenir au panneau d'avant.** Dans le nouveau panneau : **Réglages et bilans**, ligne **Interface**, choisis « Ancien panneau » (ou le bouton « Ouvrir l’ancien panneau » de la ligne « Détails techniques »). Tout ce qui n'est pas dans le nouveau panneau (verts à contrôler, départs des parties, résumé de la partie, journal du lot, réglages du lot) est dans l'ancien : reviens-y pour les consulter.

**La palette.** Dans **Réglages et bilans > Interface**, choisis « Palette (clavier) », ou clique sur l'icône de l'en-tête, ou tape **Ctrl K** dans le nouveau panneau. Une ligne de recherche, l'état en petit à droite, au plus quatre commandes à l'ouverture (celles du moment : pause, arrêt, reprise de la relecture, connexion si aucun onglet n'est choisi). Tape pour chercher une activité, un onglet, le cache, les Réglages. Entrée lance la commande choisie, jamais une commande grisée ; Échap vide la recherche ; Ctrl K revient aux cartes. La palette passe par les boutons du panneau : elle ne fait rien d'autre qu'eux.

**Les boutons du nouveau panneau cliquent les boutons du panneau d'avant** : mêmes actions, mêmes confirmations. Aucun message de plus n'est envoyé à ESV.

## 3. Pause et reprise de la relecture

**Éteinte au départ.** Éteinte, la relecture après le lot se comporte comme dans la test 16.

**L'allumer** (panneau d'avant, Orbite, carte « Relecture après le lot », encadré « Pause de la relecture ») : coche « Pause et reprise de la relecture (même après un F5) ». Le réglage ne se change pas pendant une relecture. Il y a un second réglage, **« Si ESV est rechargé pendant la relecture : mettre en pause / arrêter »** : par défaut « mettre en pause » ; il ne joue que fonction allumée (éteinte, un F5 pendant la relecture se passe comme dans la test 16).

**Allumée** :

- pendant la relecture, un bouton **Pause** : la relecture finit le cut en cours (jamais entre la pose et la validation d'une correction) et s'arrête ;
- en pause, **Reprendre la relecture au cut N** (elle repart de là, sans repasser sur les cuts relus) et **Arrêter la relecture** ;
- pendant la pause, le panneau refuse de lancer un lot, un Écho, un retour à un cut, ou de vider le cache : il dit « Relecture en pause : clique sur Reprendre… » ;
- la pause est gardée jusqu'à 24 heures, même si tu fais un F5 sur ESV ou si Ariane redémarre ; au redémarrage, la relecture revient **en pause**, jamais relancée seule ;
- si ESV ne répond pas, « Reprendre » est grisé avec sa raison.

Dans le **nouveau panneau**, la ligne de pause et ses boutons sont à l'accueil et dans Orbite ; le **réglage** n'y est pas : il est dans le panneau d'avant.

## 4. L'essai à faire

Le but : dire si le nouveau panneau te convient, et si la pause de la relecture fait ce qu'on attend.

1. **Lance un lot comme d'habitude** avec le panneau d'avant. Ne touche à aucun cut pendant le lot. Exporte le lot.
2. **Essaie le nouveau panneau** (§ 2) : accueil, Orbite pendant un lot, Écho, Revue, Réglages. Note ce qui te gêne : texte, place d'un bouton, état faux ou en retard.
3. **Essaie la palette** (§ 2) : ouvre-la dans Orbite en lot, dans Écho, après le lot.
4. **Essaie la pause** : allume-la (§ 3), laisse la relecture après le lot démarrer, clique sur **Pause**, fais un **F5** sur ESV, puis **Reprendre**. Note le cut où elle repart, et si la pose de la relecture dit « validation non prouvée » après la reprise (voir § 6).
5. Reviens au panneau d'avant (§ 2) et vérifie que tout y est comme avant.

## 5. Pendant et après le lot

Rien ne change côté pose. **Chaque pose est définitive dans ESV** : pour ce qui concerne les verts et les cuts douteux, garde les habitudes de la test 16. Le nouveau panneau et la palette ne posent rien eux-mêmes.

**Pendant la relecture qui suit le lot**, le nouveau panneau dit « Relecture en cours » (accueil : « Suivre la relecture » et « Arrêter la relecture » ; Orbite : la ligne de la relecture et « Arrêter la relecture ») ; Écho et « Vider le cache » y sont indisponibles tant qu'elle travaille ou qu'elle est en pause.

## 6. Si quelque chose ne va pas

1. Arrête le lot (ou la relecture).
2. Note l'heure, le message et l'écran (nouveau panneau, palette ou panneau d'avant).
3. Exporte et envoie les zips.

**Ne désinstalle pas Ariane.**

Si le nouveau panneau se comporte mal, reviens au panneau d'avant (§ 2) : rien d'autre ne change.

Retour arrière vers la test 16 :

1. Exporte.
2. **Désactive** la test 17 (UI) dans `chrome://extensions`, sans la supprimer.
3. Décompresse le zip de la **4.9.5 test 16** (`ariane-4.9.5-test.16.zip`) dans le même dossier.
4. **Réactive** la carte, puis clique sur **Recharger**.
5. F5 sur ESV.

Les poses déjà validées dans ESV restent : le retour arrière ne les défait pas. Le choix du panneau et la pause sont gardés par Chrome et sans effet dans la test 16.

## 7. Ce qui n'est pas vérifié

- **Une seule connexion à ESV** est partagée par Orbite et Écho : la rangée d'onglets montre le même onglet, colorée selon l'écran. Orbite sur un onglet et Écho sur un autre en même temps ne se peut pas.
- **Accessibilité du nouveau panneau et de la palette** : le focus clavier est perdu quand le panneau se redessine (chaque seconde), et les lignes de la palette n'ont ni rôle ni `tabindex` : la palette se pilote au clavier (flèches, Entrée), pas avec un lecteur d'écran. Non corrigé.
- Le panneau d'avant lit l'état de la relecture par deux modules en parallèle (toutes les 1 à 5 secondes) : lectures du stockage, sans effet sur ESV, non simplifiées.
- **Après un F5 pendant la pause, le délai de réinstallation de l'observateur dans la page ESV n'est pas mesuré sur ESV.** Si la première correction d'une relecture « corriger » repartait trop tôt, on verrait « validation non prouvée » et la relecture s'arrêterait en gardant la pose : note-le.
- La pause de la relecture n'a jamais tourné sur ESV ; elle est éteinte tant que tu ne l'allumes pas.
- Les écrans ont été vus dans Chromium sur des états fabriqués (accueil, Orbite au repos, en lot, en pause, incident et fin de lot, Écho, Revue, Réglages, palette, relecture en cours et en pause), pas sur ESV. Edge n'a pas été vu.
- Comparaison avec la test 16, réglages d'interface éteints : voir la fiche (relecture jouée dans le vrai service worker des deux versions, comparée champ par champ).
