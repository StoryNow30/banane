# CH-115 : inventaire chiffré des messages et des informations du panneau (Vision 15, « Épure »)

Sources : `src/signal-rendu.js` (modèle et rendu), `src/ui5.js` (instantané : `alerte`, `notice`, `avisContrat`), `panel.js` (`note()`). Comptes à l'écran : `chantiers/CH-115/outils/compter.cjs`, vrai panneau, 24 états fabriqués de CH-104, 600 × 760, thème sombre (ÉTABLI, mesuré le 12/11). Fréquences : `NOTES.md` des collections du 11/11 (Vision 14, parties 15 à 20) et du 12/11 (Vision 15, parties 21 à 23 et 0 à 4) de `banane-data` (ÉTABLI pour ce qui y est écrit ; le reste n'est pas mesuré).

## 1. Ce que le panneau montre d'emblée (mesuré)

| État | blocs de texte | mots | nombres | boutons | avis / lignes de note |
|---|---:|---:|---:|---:|---|
| Prêt | 18 | 50 | 3 | 4 | 0 |
| **Lot en cours** | **60** | **105** | **26** | 5 | 2 notes (bornes, allure) |
| Pause | 60 | 109 | 27 | 5 | 2 notes |
| À toi (rail non résolu) | 58 | 119 | 25 | 6 | 1 avis + 1 note |
| ESV ne répond plus | 57 | 116 | 25 | 5 | 1 avis + 1 note |
| Rattrapage (verrouillé) | 55 | 111 | 28 | 3 | **2 avis qui disent la même chose** (+ la phrase : 3 fois « ne touche à rien ») |
| Relecture | 53 | 93 | 29 | 5 | 0 |
| Fin de lot | 62 | 116 | 29 | 6 | 0 |
| Constellation en cours | 58 | 114 | 40 | 4 | 2 notes |
| Constellation finie | 97 | 200 | 87 | 6 | 2 notes |
| Constellation à 8 parties | 104 | 185 | 90 | 4 | 1 note |
| Écho en observation | 30 | 50 | 11 | 5 | 1 note |

En lot, l'écran porte : 4 onglets, la puce ESV (nom d'onglet), le menu ; la tuile d'état (mot, partie, anneau, phrase, ligne des bornes, 3 compteurs) ; le fil des 8 derniers cuts (4 champs chacun : 32 valeurs) et l'allure (2 à 3 chiffres) ; les 3 étapes ; la ligne « à poser » ; 2 à 4 boutons. Ce dont l'opérateur se sert pendant un lot (D-333 : « l'état et l'avancement au premier plan ») tient en 5 éléments : état, avancement, cut en cours, à poser, Pause.

## 2. Messages : 41 sortes, en trois classes

**A. Demande un geste : reste au premier plan (14).** Une seule tuile d'avis, en tête de zone, qui nomme le geste.
- Lot : rail non résolu ; pose peu sûre ; ESV ne répond plus (F5 puis Reprendre) ; cut repris à la main ; résultat incertain (archiver) ; erreur du lot. Fréquence : 1 pause « capture en échec » et 1 ERREUR (« la caméra a changé ») sur 6 parties le 11/11 ; **0 sur 8 parties le 12/11**.
- ESV non connecté (Orbite) ; ESV ne répond plus (Écho) ; avis de contrat ESV ; relecture interrompue (« J'ai contrôlé le cut ») ; alerte de la Constellation (2 arrêts le 11/11, dont l'écriture incertaine du cut 338 ; 0 le 12/11) ; onglet ESV à choisir (4 phrases, 1 raison) ; Aurore interrompue ; Constellation à reprendre (« ESV doit afficher la partie N »).

**B. Utile, pas urgent : une ligne, repliée ou passagère (15).**
- Refus d'une action (`note(…, true)` : **20 appels** dans `panel.js`, tous dits en rouge dans la même tuile que les alertes de la classe A) → une ligne passagère sous le bouton refusé, puis au journal.
- Export incomplet, vidage automatique impossible (rouges aussi) → ligne d'export de l'écran de fin.
- Verrou du rattrapage et du passage : **une** ligne (aujourd'hui trois : phrase, tuile, pied).
- Reconnexion en cours ; Constellation préparée ; attente de la fin d'une activité (Constellation) ; relecture en pause (raison) ; état anormal de la puce en petite taille (redit l'avis) ; ouverture d'un cut en cours ou refusée (« Ce qui reste », Aurore) ; passage vers une autre partie (Aurore).
- Écran de fin : fin hors du lot, résultat du rattrapage, Aurore à revoir, état de l'export → bilan replié sous le chiffre.

**C. Bruit : journal ou aide seulement (12).**
- Notes permanentes de la Constellation (4 variantes : « relecture, toujours, aucun export automatique, seul Arrêter… »), deux paragraphes de la boîte, « Premier essai : 2, l'opérateur présent », « Sautés : le compte skipped d'ESV ».
- Aurore : note permanente (« Chaque visite est enregistrée par Écho… »), « tu corriges et valides dans ESV ; Ariane n'écrit rien » dans la phrase, « Écho démarre avec l'Aurore », paragraphe de l'onglet vide.
- « Elle pose les cuts mis de côté pendant le lot », « ne touche à rien » dans la phrase, « Aucun cut traité pour l'instant », « Calculés à la fin du lot ».

## 3. Informations : d'emblée et à la demande

| Information | Aujourd'hui | Proposé |
|---|---|---|
| Mot d'état, avancement (anneau), cut en cours | d'emblée | d'emblée, en grand |
| À poser (si > 0) | compteur + ligne « à poser » | d'emblée (un seul endroit) |
| Partie | à droite de la tuile | d'emblée, petit |
| Traités, Posés | compteurs | à la demande (détail) |
| Bornes du lot (« du cut X au cut Y ») | ligne sous la phrase | à la demande ; au repos, dans « Nouveau lot » |
| Allure (cuts par minute, médiane, reste) | ligne du fil | à la demande ; le temps restant seul, d'emblée s'il est connu |
| Fil des 8 derniers cuts (32 valeurs) | tuile | à la demande |
| Étapes du lot (pose, rattrapage, relecture) | tuile | une ligne de 3 points sous l'anneau |
| Nom de l'onglet ESV | puce | pastille seule ; nom au survol et dans la liste |
| Constellation : registre et départs (60 à 90 nombres) | d'emblée (décision du 01/11) | chaîne + rang d'emblée ; registre et départs à la demande — **demande l'accord de l'opérateur** (le « visibles d'emblée » du 01/11 est une décision) |

Cible des maquettes en lot : au plus 15 blocs, 25 mots et 6 nombres d'emblée (aujourd'hui 60, 105, 26), sans retirer aucune action ni aucune donnée (tout reste à un clic).
