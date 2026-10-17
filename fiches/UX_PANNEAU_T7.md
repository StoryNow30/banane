# Panneau Orbite : remise en ordre pour la test 7

Demande de Mic : depuis les tests 4 à 6, le panneau est désorganisé (choix du clic, case grappe, carte « À contrôler »,
lignes techniques…). Ce chantier **déplace, regroupe et replie**. Il ne retire aucune information et ne change rien à ce qui
est envoyé à ESV. Fichiers : `panel.html`, `panel.css`, `panel.js`, plus une phrase d'avis dans `background.js` (point 3).

## 1. Inventaire : ce que le panneau montrait avant (4.9.5 test 6)

### Commun à toutes les vues (inchangé)

1. En-tête : `ARIANE` (bouton accueil), sous-titre `#sous-titre` (« Orbite · Partie N »), boutons `#theme-toggle` et
   `#bandeau-toggle`, titre `#vue-titre` et intro `#vue-intro` (accueil seulement).
2. Onglets `#nav` : `#tab-native` (Écho) et `#tab-automatic` (Orbite), avec une pastille d'état.
3. `#context` (caché dans Orbite), avis `#notice`, avis de contrat ESV `#avis-contrat`.
4. En bas : `#export-status`, `<details id="connection">` (Connexion à ESV : `#tabs`, `#tabs-note`, `#connect`), pied de page.

Les vues Accueil et Écho ne changent pas.

### Vue Orbite, dans l'ordre d'affichage

| # | Élément | Identifiants | Remarque |
|---|---------|--------------|----------|
| 1 | Bouton « Détails du lot » **en haut** | `#lot-details-toggle` | ouvre un tiroir fermé par défaut |
| 2 | Tiroir « Détails du lot » | `#lot-details` | exports (`#journal`, `#dataset`, `#gcv1-diagnostic-export`, `#gcv1-corpus-export`, `#export-cache-clear`), phrase « Construits sur ce poste », « Réglages du lot » `#lot-reglages`, politiques effectives `#lot-decision-effective`, `#unresolved-policy-effective`, `#policy-effective`, champ caché `#policy` |
| 3 | Héros : état, cut en grand, la ligne et l'écart à la voie | `#lot-etat`, `#lot-politique-pastille`, `#lot-cut`, `#ligne-bloc`, `#voie-legende`, `#legende-skip`, `#voie` | |
| 4 | Tuiles de commande | `#lot-actions` : `#start-batch`, `#pause`, `#resume`, `#retry`, `#manual-takeover`, `#manual-completion`, `#close-uncertain`, `#explicit-skip`, `#stop`, `#export-tout`, `#new-batch` | un bouton plein, choisi par l'état |
| 5 | Tuile du lot (avancement) | `#lot-tuile`, `#lot-plage`, `#lot-progres`, `#lot-pct`, `#lot-progres-note`, `#lot-traites`, `#lot-etapes` | |
| 6 | Carte des bornes | `#lot-bornes`, `#start`, `#end`, `#bornes-note` | cachée pendant un lot |
| 7 | Carte « Reprise des différés » | `#lot-reprise-row`, `#lot-reprise`, `#lot-reprise-note` | après un lot repris |
| 8 | **Carte** « Clic du mode rapide » (test 6) | `#clic-humain`, `#clic-tel-quel`, `#clic-gauche-recentre`, `#clic-tout-recentre`, `#clic-humain-cout`, `#clic-humain-note` | |
| 9 | **Autre carte** « grappe » (test 6) | `#grappe-row`, `#grappe-differes`, `#grappe-note` | libellé « aiguille, série de rouges » : inexact |
| 10 | Titre « Ce lot » + tuiles Posés, Différés, Couverture | `#lot-compteurs` | |
| 11 | Dernière commande (émise, effet, serveur) | `#lot-commande`, `#lot-cmd-nom`, `#lot-cmd-cut`, `#lot-cmd-etapes` | ligne technique, visible en pleine vue |
| 12 | Carte « À contrôler » (test 5) | `#verts-controle`, `#verts-maj`, `#verts-ligne`, `#verts-plages`, `#verts-note` | en fin de lot |
| 13 | « Départs des parties » | `#departs-liste` | |
| 14 | « Activité » : 3 dernières lignes et ligne d'état du lot | `#lot-activite-bloc`, `#lot-activite`, `#batch` | |
| 15 | « Résumé de la partie » (replié) | `#part-summary` et ses lignes `#part-summary-*` | |

Ce qui gênait : les exports et réglages **en tête** de vue ; deux cartes de choix séparées, posées entre les bornes et les
résultats ; la dernière commande (ligne technique) au milieu des résultats ; aucun titre de groupe ; après un lot, la note
de la case grappe disait « Activée pour le prochain lot » alors que le lot venait de l'utiliser.

## 2. Nouvelle structure

Cinq groupes, chacun sous un titre court, dans l'ordre où on s'en sert.

- **(a) Lot** (`#groupe-lot`) : héros (état, cut, ligne), tuiles de commande (démarrer, pause, reprendre, arrêter,
  tout télécharger, nouveau lot…), tuile d'avancement, bornes, reprise des différés.
- **(b) Règles et choix du prochain lot** (`#groupe-choix`, une seule carte `#carte-choix`) : le clic du mode rapide, puis
  la règle métier. Sous chaque choix, deux lignes :
  - « Dernier lot » (« Lot en cours » pendant un lot) : ce que le lot a figé dans son scope au démarrage (`clicHumain`,
    `regleGrappeDifferes`, consignés par `batch-started`) ; un champ absent vaut le défaut ; « aucun lot » sans lot ;
  - « Prochain lot » : le choix gardé (`choix-lot-etat`).
- **(c) Résultats du dernier lot** (`#groupe-resultats` ; titre « Résultats du lot en cours » pendant un lot) : message de
  fin de partie `#lot-fin-partie`, tuiles Posés, Différés, Couverture, carte « À contrôler », Activité, Départs des
  parties, Résumé de la partie.
- **(d) Relecture** : emplacement réservé, marqué par un commentaire HTML entre (c) et (e). Le chantier
  `claude/50-relecture-ombre` y pose `<section id="carte-relecture" class="carte">` (choix coupée, ombre ou corriger,
  avancement, bouton d'arrêt). Rien n'est codé ici.
- **(e) Export, archive et réglages avancés** (`#groupe-avance`), **replié** : le bouton `#lot-details-toggle` passe en bas
  de vue et ouvre `#lot-details` (exports, vidage du cache, « Réglages avancés » `#lot-reglages`). Dedans, une section
  **« Détails »** (`<details id="lot-details-techniques">`, repliée par défaut) porte les lignes techniques : la
  dernière commande `#lot-commande` et les politiques effectives du lot.

Tous les identifiants d'avant sont gardés. Nouveaux : `#groupe-lot`, `#groupe-choix`, `#carte-choix`,
`#groupe-resultats`, `#resultats-titre`, `#lot-fin-partie`, `#groupe-avance`, `#lot-details-techniques`,
`#clic-dernier-l`, `#clic-dernier`, `#clic-prochain`, `#grappe-dernier-l`, `#grappe-dernier`, `#grappe-prochain`,
`#grappe-explication`. Le bouton « Tout télécharger pour l'analyse » reste dans les tuiles de commande : c'est l'action
principale en fin de lot (audit 4.8.0, U03).

Largeur : vérifié à 400 px et à 340 px de large (panneau étroit). Sous 340 px, les lignes « Dernier lot / Prochain lot »
passent sur une colonne.

## 3. Les trois corrections demandées par Mic

### Libellé de la case grappe

La règle `grappe-differes` (`src/regles-metier.js`, `grappeDe`) se déclenche sur un cut que le lot allait **valider**,
quand **au moins 2 cuts différés par le lot** tombent dans les **6 cuts d'avant**, dont un à **2 cuts au plus** ; les
cuts différés par la règle elle-même ne comptent pas. Elle ne pose rien, ne choisit aucune position et ne lit aucun rail
de plus : elle ne détecte pas les aiguilles (`background.js`, `reglesDuLot`, n'ouvre que cette règle).

Nouveau libellé : « Mettre en attente les cuts voisins d'une série de différés », et dessous : « Ne pose rien, ne détecte
pas les aiguilles. Un cut qu'Ariane allait valider est mis en attente si le lot vient de différer au moins 2 cuts parmi
les 6 d'avant, dont un à 2 cuts au plus. » Un essai vérifie que ces chiffres sont ceux de la règle.

### Dernier lot ou prochain lot

Avant : sans lot ouvert, la note ne regardait que le choix gardé (« Activée pour le prochain lot »), même juste après un
lot qui l'avait utilisée. Maintenant, chaque choix montre « Dernier lot » (scope du lot) et « Prochain lot » (choix
gardé), pour le clic comme pour la case grappe. Pendant un lot, si le choix coché diffère du sien, la note le dit.

### Partie terminée

Comportement vérifié au banc (service worker réel en VM, ESV simulé, données synthétiques) : un lot « jusqu'à la fin de
la partie » lancé sur une partie dont le compteur d'ESV « N on M treated » est complet (N = M) pose et valide le cut
affiché ; ESV charge la partie suivante ; le lot se clôt (`STOPPED`, `navigation-other-part`) sur l'avis « Fin du lot :
après la validation du cut X, ESV est passé dans la partie P+1 ». Rien ne disait que la partie n'avait plus de rouge.

Correction, en lecture seule :

- `background.js`, `clore()` : si le dernier relevé du compteur pendant le lot (`batch.totalReleve`, même partie, source
  « compteur ») a N ≥ M, l'avis de fin de lot commence par « Partie N : plus aucun cut rouge à traiter. Le lot s'arrête
  ici. ». La clôture, la navigation et les commandes envoyées à ESV sont les mêmes (un essai compare les commandes).
- `panel.js` : pour un lot clos, la même phrase s'affiche en tête des résultats (`#lot-fin-partie`) si ce relevé est
  complet, ou si la fiche de départ de **ce** lot (D-092, même `batchId`) compte 0 invalide.

## 4. Essais

- Adaptés : `tests/choix-lot-panel.test.cjs` (libellé, carte unique, dernier et prochain lot, cas d'après un lot),
  `tests/ux-49-orbite.test.cjs` et `tests/panel-ligne-suite.test.cjs` (nom du tiroir, « Détails » replié).
- Nouveau : `tests/partie-sans-rouge-t7.test.cjs` (avis du service worker, commandes identiques, message du panneau et
  cas où il ne doit rien dire).

## 5. Limites

- La fin de partie n'est dite que si ESV a donné un compteur lisible pendant le lot, ou si la fiche de départ du lot est
  connue. Sans l'un ni l'autre, le lot se clôt comme avant, avec l'avis d'avant.
- Le lot valide toujours le cut affiché avant qu'ESV ne quitte la partie : c'est la navigation d'ESV, volontairement
  inchangée.
- Les captures sont faites avec les API Chrome simulées et des données synthétiques ; ce n'est pas l'extension installée.
- La carte de relecture n'est pas codée : seule sa place est réservée.
