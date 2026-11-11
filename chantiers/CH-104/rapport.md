# CH-104 : rapport (le panneau en Graphite)

Référence : `maquettes/bento/panneau-graphite.html` (D-333, puis D-334 pour la Constellation). Branche `chantier/CH-104`.

## Ce qui est fait (ÉTABLI : photographié et mesuré dans Chromium, états fabriqués)

- Orbite suit la maquette dans ses huit états, Constellation dans ses cinq, à 360 × 480 et 600 × 760. La chaîne de la Constellation tient de 1 à 8 parties.
- Écho, Aurore, menu « ··· », commandes, réglages, onglets ESV, « Ce qui reste », boîte de la Constellation, détails techniques et panneau d'origine (secours) ont reçu le système : mêmes tuiles, boutons, onglets, couleurs, police.
- Thème clair : en marche, sur les mêmes variables. **L'opérateur ne l'a pas vu.**
- Fichiers touchés : `src/signal-rendu.js` (balisage ; modèles inchangés), `src/ui5.js` (fil des cuts, étapes, menu, pouce, sortie de zone), `panel-signal.css` (réécrit), `panel.css` (jetons seulement), `fonts/`, essais, `fiches/UI_SIGNAL.md`. Aucun fichier protégé. Aucun message nouveau vers le service worker.

## Quand le pourcentage s'affiche

Seulement si un total est réellement connu : cuts ciblés du lot (`ar.cibles` : fiche de départ d'un lot parti du début jusqu'à la fin de la partie, ou bornes recoupées avec la liste d'ESV) ; cuts décidés du rattrapage ; cuts à relire de la relecture. Sinon l'anneau porte le nombre de cuts traités et tourne tant qu'Ariane travaille ; lot terminé sans total : anneau plein et coche.

## Écarts à la maquette, et pourquoi

- Fil des cuts : le rail n'est dit que pour un cut à poser (le lot ne garde pas cette donnée pour un posé) ; l'étiquette dit « à poser », pas « à toi ».
- L'allure et les bornes du lot restent à l'écran (note de la tuile du fil ; ligne sous la phrase).
- Les phrases d'état sont celles du panneau actuel (modèle inchangé), sans « Partie N » qui est dite à droite.
- Fin de lot : le bouton plein reste « Voir ce qui reste » quand il reste quelque chose (règle de `fiches/UI_ETATS_COMPTEURS.md`) ; la maquette met « Exporter le dossier ».
- Les boutons qui ne tiennent pas sur une demi-largeur passent à la ligne entière (la maquette les coupait en 360).
- L'anneau ne s'anime pas en se remplissant ; l'écran de fin entre par un changement d'échelle (pas de tracé animé) : déplacements et opacités seulement.
- Constellation : le nombre de parties offert est celui du panneau (1, 2, 3, 4, 5, 8) ; pas de bouton « Préparer la Constellation » dans l'onglet (il n'y existe pas aujourd'hui) ; les départs gardent tous leurs chiffres, aux deux tailles.

## Chaque action, et où elle se trouve maintenant

| Action (nom inchangé) | Où |
|---|---|
| Démarrer le lot, Pause, Reprendre, Réessayer ce cut, Reprise manuelle, déclarer repris à la main, archiver le résultat interrompu, Arrêter le lot, Nouveau lot, Exporter le dossier, lancer la relecture, lancer le rattrapage, J'ai contrôlé le cut, Arrêter la relecture, Pause et Reprendre la relecture | pied d'Orbite (mêmes boutons d'origine, `legacy:<id>`) ; aussi dans Commandes |
| SKIP explicite | toujours masqué (D-320) : rien n'a changé |
| Premier cut, Dernier cut, Reprise des cuts à poser | tuile « Nouveau lot » de la zone, au repos |
| Voir ce qui reste ; Ouvrir, Examiner (↑ ↓, E) | ligne « à poser », bouton de fin de lot, Commandes ; dans la feuille « Ce qui reste » |
| Lancer, Préparer, Reprendre, Nouvelle Constellation, nombre de parties, Arrêter la Constellation (deux clics), Suivre dans Orbite | pied et tuile « Nouvelle Constellation » de l'onglet ; boîte « Constellation » ; pied d'Orbite pendant la Constellation, y compris écran verrouillé |
| Commencer, Suivant, Passer à la partie, Ouvrir, Terminer, Fermer l'Aurore, Télécharger la séance Écho, Ouvrir l'Aurore | pied et liste de l'onglet Aurore ; pied d'Orbite en fin de lot |
| Démarrer l'observation, Pause, Reprendre, Terminer et télécharger, Télécharger à nouveau | pied d'Écho |
| Abandonner la séance Écho | réglages, zone dangereuse (inchangé) |
| Onglets Orbite, Écho, Constellation, Aurore | barre, pouce glissant |
| Choisir l'onglet ESV, Connecter, Reconnecter | puce « ESV » |
| Commandes (Ctrl K), Réglages, Vider le cache | menu « ··· » (Ctrl K et Échap inchangés) |
| Réglages (après le lot, clic, passage Aurore, série, rattrapage, raison, F5, bandeau, thème), Détails techniques | feuille de réglages (inchangée) |

## Ce qui a quitté l'écran, et où le retrouver

| Avant | Maintenant |
|---|---|
| Anneau du temps passé sur le cut, comparé à la médiane | nulle part (la médiane reste dans l'allure, la durée de chaque cut dans le fil) |
| Rail gradué : place de chaque cut à poser le long du lot, graduations, curseur | nulle part en dessin ; les cuts à poser sont dans le fil et dans « Ce qui reste » |
| « N traités sur M ciblés » et « traités · total inconnu » écrits en toutes lettres | le pourcentage et les compteurs ; le texte complet seulement dans le libellé accessible de l'anneau ; « sur M ciblés » reste écrit en fin de lot |
| « N cuts ciblés · aucun traité », au repos | nulle part à l'écran (anneau à 0 %) |
| Nom de l'onglet ESV dans la puce, et son cadenas pendant le lot | infobulle de la puce et liste des onglets |
| Forme du glyphe d'état (triangle, octogone, carré, cadenas) | le mot d'état et la couleur ; le cadenas reste dans l'avis et le pied verrouillés |
| Icônes dans les boutons (pause, lecture, export) | nulle part |
| Bande « Cache des exports » toujours visible, boutons Commandes et Réglages dans la barre | menu « ··· » |
| Logo « Ariane » dans la barre | nulle part |
| Rappel de l'état dans la poignée du tiroir | la tuile d'état ; nulle part tant que la feuille « Ce qui reste » est ouverte |
| Constellation : anneau à segments, « Faites / Restantes », numéros 01 à 04 des temps, tableau des départs | chaîne des parties, rang (« 2 faites sur 5 »), temps sans numéro, départs en lignes (mêmes chiffres) |
| Aurore : pointe au bout de l'anneau | nulle part |

## Essais mis à jour (même vérification, nouveau balisage)

`signal-rendu`, `signal-revue-t21`, `signal-vocabulaire-orbite`, `ciblage-t22`, `ciblage-t22-navigateur`, `ciblage-mouvement-t23`, `ciblage-mouvement-t23b`, `t16-panneau`, `ui5-constellation-aurore`, `ui5-correction`, `ui5-file-parties`, `ui5-navigateur-signal-` (`normal`, `compact`, `mouvement`, `revue-t21`, `file`, `file-etats`, `onglet-file`, `constellation-aurore`, `correction-etats`, `correction-actions`, `correction-balayage`, `actions`), `helpers/signal-file`, et dans `esv-maquette/` : `connexion-t21`, `file-signal-clics`, `correction-signal`, `correction-parties`, `file-changement-gestes`.
Deux assertions portent sur une chose supprimée (l'anneau du temps du cut) : elles vérifient maintenant que l'anneau et le fil ne sont pas recréés d'un rendu à l'autre. Un vrai défaut trouvé par les essais et corrigé : « Arrêter la Constellation » avait disparu de l'écran verrouillé.

## Fichiers à ajouter au paquet

`fonts/Inter-latin-wght.woff2`, `fonts/OFL-Inter.txt`. Le panneau n'appelle plus IBM Plex, Hanken Grotesk ni JetBrains Mono (retrait du paquet à ta main).

## Vérification

VERIFICATION_A_REMPLIR

## Non vérifié

Rien n'a tourné sur le vrai ESV. Le thème clair n'a pas été vu par l'opérateur. Le coût réel du mouvement à côté du nuage de points n'est pas mesuré. Les états sont fabriqués : une combinaison rare (plusieurs avis à la fois, libellés très longs) peut demander de défiler dans la zone en 360.
