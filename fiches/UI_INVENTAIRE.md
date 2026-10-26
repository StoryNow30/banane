# Inventaire de l'interface d'Ariane (4.9.5 test 9), 19 octobre 2026

Demande de l'opérateur (19/10/2026) : « l'UI/UX est devenue bordélique […] trop de nouveaux boutons inutiles, […] pas dix mille cases à cocher et cocher toujours les mêmes ». Cette fiche est l'état des lieux honnête, avant toute conception (`fiches/UI_5.0_CONCEPTION.md`). Elle a été relevée dans `panel.html`, `panel.js`, `src/carte-relecture.js`, `src/raison-correction.js`, `src/bridge.js` et `background.js`, et recoupée avec `CHANGELOG.md`, `DECISIONS.md` et les consignes de séance 5 à 9.

## 1. En chiffres

| | Nombre |
|---|---:|
| Boutons dans `panel.html` | 43 |
| Champs à cocher, à choisir ou à remplir (cases, boutons radio, numéros) | 15 (dont 10 cases ou boutons radio sur le même écran) |
| Listes de choix | 1 (l'onglet ESV) |
| Volets repliables (`details`) | 8 |
| Lignes de réglages affichées en lecture seule dans Écho | 37 (6 groupes) |
| Choix « pour le prochain lot » qui gardent leur valeur dans le navigateur | 4 (clic, grappe, relecture, raison) |
| Éléments dans la page ESV | 2 (la pastille « ouvrir », le bandeau d'état) |

Le fichier `panel.js` fait 1 706 lignes. Sa fonction `render` en fait 292 (`panel.js:561` à `:852`) et commence par `if(which==='native')` (`:573`) puis `else if(which==='automatic')` (`:603`). Le service worker traite le panneau par 70 tests `if(action===…)` à la suite (`background.js:2513` et suivantes).

**Qui s'en sert.** Trois lecteurs : **l'opérateur** (en séance, dans ESV), **l'orchestrateur** (l'analyse hors ligne, qui lit les exports et ne regarde jamais le panneau) et **personne** (un contrôle qui n'a plus de raison d'être, ou qui double un autre). Pour chaque ligne, la dernière colonne dit ce que la 5.0 en fait : **Visible** (l'écran de séance), **Auto** (le panneau le fait lui-même, plus de bouton), **Réglages** (l'écran séparé, rarement ouvert), **Détails** (une page de lecture, jamais nécessaire en séance) ou **Retiré de l'écran** (le fait reste dans le journal et les exports).

## 2. Le panneau, élément par élément

### 2.1 En-tête et navigation (toutes les vues)

| Élément | À quoi il sert | Qui | Introduit par | 5.0 |
|---|---|---|---|---|
| Bouton « ARIANE » (retour accueil) | revenir au choix Écho ou Orbite | l'opérateur | V4.5.7 (une seule page, vues internes) | Visible (logo) |
| Titre de vue, sous-titre « Orbite · Partie N » | dire où on est | l'opérateur | piste H, 4.7.20 | Visible, en une phrase |
| Bouton thème clair ou sombre | confort | l'opérateur (rarement) | piste H, 4.7.20 | Réglages |
| Bouton « Bandeau dans ESV » | allume une ligne d'état en bas de la page ESV | l'opérateur (essayé, pas d'usage connu) | piste H, 4.7.20 | Réglages (allumé par défaut, voir 4.4) |
| Deux onglets « Écho » et « Orbite » avec une pastille d'état | passer d'un mode à l'autre | l'opérateur | 4.8.0 (D-058) | Visible (un seul choix de départ) |
| Accueil : deux grandes cartes Écho et Orbite | choisir le mode | l'opérateur | V4.5.7 | Auto (le panneau propose le mode, voir conception) |
| Ligne « ESV · partie N · cut M » (`#context`) | rappeler le cut affiché | l'opérateur | V4.7 | Visible (dans l'état) |
| Avis (`#notice`) | la phrase de ce qui se passe | l'opérateur | V4.5 | Visible : devient LA phrase d'état |
| Avis de contrat ESV (`#avis-contrat`) | dit qu'ESV a changé (empreinte, écritures) | orchestrateur | 4.9.5.3 (S6), D-139 | Détails (visible seulement s'il bloque) |
| Pied de page | numéro de version | tous | toujours | Réglages |

### 2.2 Vue Écho

| Élément | À quoi il sert | Qui | Introduit par | 5.0 |
|---|---|---|---|---|
| « Démarrer l'observation » / « Démarrer une nouvelle session » | ouvre la séance Écho | l'opérateur | Mode Natif, 4.4 | Visible : l'action principale au repos |
| « Pause » / « Reprendre » | suspend, reprend | l'opérateur (rare) | V4.4 | Visible (second plan) |
| « Terminer et télécharger » | clôt la séance et sort les volumes zip | l'opérateur | V4.4, zip en 4.9.0.18 | Visible : devient « Envoyer » |
| « Télécharger à nouveau la session » | rejouer l'export | l'opérateur (après un export raté) | 4.9.0.18 | Auto (« Envoyer » le propose si l'export est incomplet) |
| « Masquer / Afficher les détails » | replie le volet des explications | l'opérateur | V4.4 | Retiré de l'écran |
| Grand chiffre « N visites de cuts », dernière visite, état de collecte | savoir que ça tourne | l'opérateur | piste H, 4.7.20 | Visible |
| Tuiles, « Temps par cut » (40 dernières visites), « Activité » (5 dernières) | regarder son rythme | l'opérateur (curiosité) | piste H | Détails |
| Avertissement « N visites partielles » | dire qu'une visite n'a pas de LiDAR complet | orchestrateur | V4.4 | Détails (visible si le nombre grimpe) |
| Carte « Raison de la correction » : case « Noter ma raison » | allume la lecture des chiffres 1 à 6 et 0 | l'opérateur (coche à chaque Écho depuis la test 9) | RM-11, D-208, test 9 | Réglages (profil), voir 3 |
| Trois boutons radio « Touches lues » (chiffres, Alt + chiffre, pavé) | repli si ESV réagit aux chiffres | l'opérateur (une fois, étape 0) | RM-11, test 9 | Réglages |
| 7 pastilles 1 à 6 et 0 | poser une raison à la souris | personne (l'opérateur tape les touches) | RM-11, test 9 | Retiré de l'écran en séance (la touche suffit) |
| Ligne « raison de ce cut », bande des 24 derniers cuts, couverture, rappel des 40 cuts, aide | suivre les raisons posées | l'opérateur (un peu), orchestrateur (couverture) | RM-11, test 9 | Détails, la couverture dans l'état si le profil l'a |
| Bloc « Santé de la collecte » (6 chiffres) | file, volume, niveau du collecteur | orchestrateur | 4.5.0 | Détails |
| Bloc « Qualité de capture » (4 chiffres) | repères qualifiés, points retirés | orchestrateur | Mode Natif, avant la 4.5.0 (origine exacte non retrouvée) | Détails |
| Volet « Ce qui est observé » | texte d'explication | personne | V4.4 | Retiré de l'écran |
| Volet « Réglages de la collecte » (37 lignes en lecture seule) | montrer les valeurs de `src/settings.js` | orchestrateur | V4.5 (source unique) | Réglages (même contenu) |
| Volet « Abandonner cette session » + bouton rouge + confirmation | jeter une séance | l'opérateur (très rare) | origine non retrouvée (avant la 4.8.0) | Réglages, zone dangereuse |
| Texte « Travaille ensuite normalement dans ESV… » | rassurer | l'opérateur (au début) | V4.4 | Visible, une ligne |

### 2.3 Vue Orbite

| Élément | À quoi il sert | Qui | Introduit par | 5.0 |
|---|---|---|---|---|
| « Démarrer le lot » | lance le lot | l'opérateur | Pilote automatique, avant la 4.7 (origine exacte non retrouvée) | Visible : action principale au repos |
| « Pause » / « Reprendre » | suspend, reprend | l'opérateur | Pilote automatique, avant la 4.7 (origine non retrouvée) | Visible |
| « Arrêter le lot » | termine le lot | l'opérateur (rare) | idem | Visible, second plan (rouge) |
| « Réessayer ce cut » | rejoue la pose après un rail non résolu | l'opérateur (rare) | au plus tard 4.7.13 (« La ligne », D-045) | Visible dans l'incident |
| « Reprise manuelle » / « Repris manuellement » | rend le cut à l'opérateur, puis déclare qu'il l'a traité | l'opérateur (rare) | V4.6.0 (`MANUAL_COMPLETION`) | Visible dans l'incident |
| « SKIP explicite » (confirmation) | passe un cut en SKIP | l'opérateur (très rare) | au plus tard 4.7.13 (« La ligne », D-045) | Visible dans l'incident, sous « Autres options » |
| « Archiver le résultat interrompu · cut N » | clôt un résultat incertain | l'opérateur (rare) | origine non retrouvée (avant la 4.8.0) | Visible dans l'incident |
| « Nouveau lot » | rouvre bornes et « Démarrer » | l'opérateur | 4.7.21 | Auto (« Démarrer un nouveau lot » devient l'action au repos) |
| Bornes « Premier cut » et « Dernier cut » | choisir la plage | l'opérateur (jamais modifiées en séance : remplies par Ariane) | 4.7.21 | Réglages (« Lot borné ») |
| Case « Reprise des différés » | repartir des cuts posés par le lot précédent | l'opérateur (rare) | 4.7.19 | Réglages |
| Héros : état, cut en grand, la voie (graphique cut par cut) | suivre le lot | l'opérateur | piste H, 4.9 | Visible : le cut et un état en une phrase ; la voie en Détails |
| Tuile du lot : plage, pourcentage vert, « N / M invalides », étapes capture-pose-validation | avancement | l'opérateur | 4.9.0.14 à 4.9.0.17 (« le vert ne se remplit pas ») | Visible : une barre et un chiffre |
| Pastille « Politique : … » (si hors défaut) | dit que le lot n'a pas la politique habituelle | orchestrateur | 4.9, D-045 | Détails |
| Carte « Clic du mode rapide » : trois radios + coût + « Dernier lot / Prochain lot » | choisir le clic de pose | l'opérateur (comparaison de la test 6) | D-157, D-164, D-165 | Réglages (profil) |
| Case « Mettre en attente les cuts voisins d'une série de différés » + explication + « Dernier lot / Prochain lot » | règle métier « grappe » | l'opérateur (coupée par défaut, jamais cochée depuis la test 7) | demande de l'opérateur, D-165 | Réglages (profil) |
| Carte « Relecture après le lot » : trois radios Coupée / Ombre / Corriger + « Dernier lot / Prochain lot » + 2 textes + réglages | choix du mode de relecture | **l'opérateur, à chaque lot** (voir 3) | D-170 à D-176, D-180 | Réglages (profil) ; la relecture démarre seule |
| « Arrêter la relecture », « Lancer la relecture », « J'ai contrôlé le cut N » | arrêter, relancer, acquitter une correction interrompue | l'opérateur (rare) | D-170, D-176, W5 | Visible dans l'incident, ou Auto pour « Lancer » |
| Ligne de relecture « Relecture 12 sur 85, 3 corrigés » | avancement de la passe | l'opérateur | D-170 | Visible (phrase d'état) |
| Compteurs « Posés / Différés / Couverture » | résultat du lot | l'opérateur, orchestrateur | 4.7.19 à 4.8.0 (D02, C1) | Visible (une ligne) |
| Fin de partie : « plus aucun cut rouge » | dire pourquoi le lot s'arrête | l'opérateur | test 7 | Visible dans la phrase |
| Carte « À contrôler » (verts à relire) + « Recalculer » | liste des verts qu'Ariane n'a pas visités | l'opérateur | test 5, D-162 | Visible : un chiffre ; liste en Détails |
| « Activité » (dernières lignes) et ligne `#batch` | détail technique du lot | orchestrateur | 4.7.20 | Détails |
| « Départs des parties » (une carte par partie) | valeurs d'ESV au démarrage du lot | l'opérateur (vérifie), orchestrateur | D-092 | Détails |
| « Résumé de la partie » (+ détail, lots de la partie) | tous lots confondus | l'opérateur (parfois) | 4.9 (U1) | Détails |
| Volet « Export, archive et réglages avancés » | contient les exports et les réglages fixes | l'opérateur, orchestrateur | test 7, D-173 | Auto + Réglages |
| « Tout télécharger pour l'analyse » | sort journal, bilan, diagnostic, corpus, liste des verts, en volumes zip | l'opérateur, à chaque lot | 4.8.0 (U03), 4.9.0.18 | Visible : devient « Envoyer » |
| « Télécharger le journal », « …le bilan et les LiDAR », « …le diagnostic GCV1 », « …le corpus GCV1 + LiDAR » | les quatre morceaux de « Tout télécharger », un par un | **personne** : « Tout télécharger » les contient tous, y compris le journal (`exportToutZip`, `panel.js:1558`) | 4.7.19 (KI-059), puis « Tout » en 4.8.0 | Retiré de l'écran (le code reste) |
| « Vider le cache des exports » | vide le cache après confirmation de réception | l'opérateur, seulement quand l'orchestrateur confirme | V2, D-079 | Réglages, zone « après confirmation » |
| Lignes « Réglages avancés » et « Détails » (dernière commande, politique effective) | traçabilité | orchestrateur | 4.7.21, KI-033 | Détails |
| Champ caché `#policy` | reste d'un ancien sélecteur | **personne** | 4.7.21 (« sélecteurs retirés ») | Retiré |

### 2.4 Commun

| Élément | À quoi il sert | Qui | Introduit par | 5.0 |
|---|---|---|---|---|
| Volet « Connexion à ESV » : liste des onglets, « Reconnecter ESV » | choisir l'onglet, reconnecter | l'opérateur quand il y a deux onglets ESV, ou après un F5 | origine non retrouvée ; libellés des onglets en 4.9.0.16 (test 15) | Auto (un seul onglet prêt : choisi seul, et déjà le cas) ; la liste ne s'affiche que s'il y en a plusieurs |
| Ligne de statut d'export (`#export-status`) | dit si l'export est complet | l'opérateur, orchestrateur | 4.8.0 (D03) | Visible dans « Envoyer » |
| Vidage automatique d'Écho (sans bouton) | écrit un segment quand le volume dépasse 36 Mo | automatique | V4.5 (`autoExportIfAdvised`) | Auto (inchangé) |

## 3. Ce que l'opérateur coche toujours pareil

D'après les consignes de séance (`consignes/seance-terrain-4.9.5-test-5…9`), à chaque séance l'opérateur doit :

| Séance | Ce qu'on lui demande de régler | Avant quoi | Défaut actuel | Candidat au défaut |
|---|---|---|---|---|
| Test 6 | « Variante » ou « Tout recentré » pour deux lots, « Comme avant » pour comparer | chaque lot | Comme avant | **Non** : c'était un essai de deux méthodes. Reste un profil nommé (« Comparer le clic »). |
| Test 6 | Case « grappe » | un lot | coupée | **Non** : jamais redemandée depuis. Reste en Réglages, coupée. |
| Tests 7 et 8 | Relecture « Ombre » puis « Corriger » (test 7), « Corriger » puis « Ombre si le temps » (test 8) ; « après la séance, remets Coupée » | **avant chaque lot** | Coupée | **Oui : « Corriger »**. L'opérateur l'a demandé (D-170), accepté ses chiffres (D-180), et le premier bilan de terrain est bon (D-211 : « a bien lu »). C'est la case qu'il coche tout le temps. Reste « Ombre » et « Coupée » en profils. |
| Test 9 | Case « Noter ma raison » | **avant chaque Écho** | coupée | **À décider par l'opérateur.** Elle ne vaut que s'il tape les chiffres. Étape 0 (ESV ne réagit pas aux chiffres) pas encore faite. Proposé : coupée tant que l'étape 0 n'est pas passée, puis allumée par défaut en une ligne de réglage. |
| Tests 5 à 9 | Aucun réglage des bornes (« Premier cut » rempli par Ariane, « Dernier cut » vide) | chaque lot | rempli | Déjà un défaut. Les deux cases ne servent pas en séance. |
| Tests 5 à 9 | « Tout télécharger pour l'analyse », attendre 5 secondes, puis envoyer tous les volumes avec leur SHA-256 | après chaque lot et chaque Écho | manuel | **Un seul geste « Envoyer »**, qui attend lui-même la fin de la relecture et calcule les empreintes (voir conception). |

Ce que l'opérateur ne touche jamais : thème, bandeau dans ESV, les 37 réglages, les touches de repli, la case « reprise des différés », les quatre boutons d'export séparés, l'archivage du résultat interrompu, le détail du résumé de partie.

## 4. Constats honnêtes

1. **Dix cases ou boutons radio sur un même écran, pour quatre décisions.** Clic (3 radios), grappe (1 case), relecture (3 radios), raison (1 case + 3 radios). Chacune a son « Dernier lot » et son « Prochain lot » : quatre fois le même mécanisme (choix gardé dans le navigateur, lu au démarrage, figé dans le lot, affiché avant et après). Il n'y a qu'une idée, écrite quatre fois dans `panel.html` et `panel.js` (`majChoixLot`, `changerChoixLot`, `changerChoixRaison`, et `src/carte-relecture.js` avec son propre minuteur de 1 à 4 secondes).
2. **Les quatre boutons d'export à part sont morts.** « Tout télécharger » appelle `exporterJournal`, `exporterDiagnostic`, `exporterCorpus` et `exporterBilan` lui-même. Les quatre boutons de détail ne servent plus que dans un cas : relancer un morceau raté (le texte du statut le suggère). « Envoyer » peut le faire seul.
3. **Les consignes de séance sont devenues des listes de gestes de préparation** (cocher, vérifier la version à trois endroits, noter l'heure du F5, calculer des empreintes). C'est ce qui rend l'interface lourde à vivre autant que les boutons eux-mêmes.
4. **Des blocs d'analyse sont affichés à l'opérateur.** « Santé de la collecte », « Qualité de capture », les 37 réglages, les lignes techniques et la politique effective sont utiles à l'analyse, jamais à la séance. Ils restent lisibles dans une page « Détails ».
5. **Le panneau mélange deux métiers.** Écho (l'opérateur travaille, Ariane regarde) et Orbite (Ariane travaille, l'opérateur regarde) n'ont pas les mêmes besoins. En Écho, l'opérateur ne lit presque jamais le panneau ; en Orbite, il attend et veut savoir si quelque chose lui est demandé.
6. **Treize états d'incident du lot** (`PAUSED_UNRESOLVED_RAIL`, `MANUAL_TAKEOVER`, `reconcileRequired`, etc.) se traduisent chacun par un jeu de boutons différent, décidé par du code dispersé dans `render` (`panel.js:740` à `:815`). C'est ce qui doit devenir une table « état → phrase → action principale ».
7. **Rien n'est à retirer des exports ni du journal.** Tout ce qui sort de l'écran reste enregistré : l'analyse hors ligne en dépend (D-218).

## 5. Les éléments dans la page ESV (`src/bridge.js`)

| Élément | À quoi il sert | Qui | 5.0 |
|---|---|---|---|
| Pastille blanche « Ariane 4.9.5 test 9 · ouvrir », en bas à droite | rouvrir le panneau s'il est fermé (disparaît dès qu'une fenêtre est ouverte) | l'opérateur (rarement) | Inchangée |
| Bandeau noir d'une ligne, en bas à gauche (ne capte aucun clic) | « ARIANE · ORBITE · En cours · cut 4812 · 31 posés · 4 différés » ; en Écho, la raison collante | l'opérateur (si allumé) | **Allumé par défaut** : c'est le seul endroit que l'opérateur regarde quand il travaille dans ESV. Il reprend LA phrase d'état du panneau. Il n'ajoute aucun bouton (un bouton dans la page gênerait les clics du lot). |
