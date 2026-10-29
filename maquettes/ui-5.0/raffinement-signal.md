# Signal raffiné (CH-022) : notes de raffinement, méthode kubre « design-refinement »

Méthode relue à la source le 29/10 (dépôt kubre/skills cloné anonymement hors dépôt : `design-refinement/SKILL.md`, `references/craft.md`, `references/capture.md`, `council/SKILL.md`, `council/references/rubrics.md`, lus en entier). ÉTABLI.

## 1. Notes (étape 1)
- **But.** Reprendre Signal (`Q-signal.html` et la file de parties `S-file-de-parties.html`, variante A validée par D-261) pour qu'il soit plus simple, plus cohérent et plus premium, sans retirer aucune fonction. Deux niveaux : `Q-signal-2.html` (mesuré : mêmes composants, même structure) et `Q-signal-3.html` (poussé : gestes de la Frise de lumière).
- **Ligne d'arrivée.** Vérificateur (`outils/verifier-signal.cjs`) à 0 écart et 0 erreur de console sur toutes les scènes, deux thèmes, quatre largeurs (360, 420, 480, 600) ; contraste du texte ≥ 4,5:1 partout ; mouvement réduit respecté ; aucune rubrique de `craft.md` en défaut sur les captures clair et sombre ; audit (`outils/audit-signal.cjs`) : une seule valeur par rôle (tailles, rayons, espacements, couleurs).
- **Surfaces (étape 2).** Les 17 scènes de Q et les 5 scènes de la file : écran principal (prêt, en cours, pause, fin), états d'erreur (à toi, interrompu, ESV muet, sans ESV, file arrêtée, relecture après F5), états verrouillés (deuxième passe), Écho (vide, en observation), tiroir « ce qui reste » (V1, V2), couches (palette, réglages, confirmation du cache, sélecteur ESV, boîte de la file, confirmation « passer »), largeurs 360 à 600.
- **Journal des tours.** r0 (captures « avant », Q et S), r1 (système de valeurs et corrections de la grille), r2 (relecture des captures, régressions, auditeur), r3 (après l'auditeur). Captures `r0-`, `r1-`, `r2-`… par page, thème, taille et scène, dans le dossier de travail de la session (jamais dans le dépôt).

## 2. Autocritique r0 (étape 4 : écrite avant toute correction)
Grille `craft.md` passée sur les captures r0 (17 + 5 scènes, sombre et clair, 600 et 360), pires d'abord. Chiffres de l'audit `audit-signal.cjs` entre parenthèses.

1. **Couleur, sens (D-256).** « Colour carries meaning, not decoration » : le vert dit à la fois « en cours » (glyphe, curseur), « connecté » (puce, sélecteur), « terminé » (coche), « corrigé » (relecture, Écho), « examiné » (V2) et « cache vidé » : **six sens pour une couleur**. L'ambre dit « en pause », « pause demandée », « relecture en pause », « différé » et « irréversible ». Le rouge dit « à toi », mais aussi « Arrêter » et « Passer ce cut » à côté d'un lot qui va bien : la couleur annonce une alarme qui n'existe pas. **Défaut.**
2. **Couleur, chiffres.** « Keep numbers neutral and show direction with a small coloured mark » : « 4 différés », « 11 différés », « 20 à examiner » sont tout en ambre. **Défaut.**
3. **Contraste.** `--encre3` sert de couleur de texte (graduations du rail, intitulés de la fin, onglet verrouillé, séparateurs, boutons grisés) : 3,90:1 sur le fond sombre, 3,26:1 sur un bouton grisé (148 textes sous 4,5:1 dans Q, 186 avec la file ; 600 et 748 écarts au vérificateur). **Défaut.**
4. **Symboles (D-256 : « trop génériques »).** 23 dessins distincts : anneau, triangle d'alerte, octogone, coche, carré, cadenas (trois places), cercle barré, ondes radio, barres de pause, plus une icône par bouton (lecture, pause, flèche de retour, liste, téléchargement) et une icône par commande de la palette. L'icône « réglages » est un soleil (elle se lit « luminosité »). Aucun ne vient du métier : le seul objet du métier, le rail, est dessiné à part. **Défaut.**
5. **Tailles.** Six tailles de texte (44, 28, 15, 13, 11, 10) ; 11 et 10 px pour des marques de version, des touches et les nombres du rail, illisibles de loin. **Défaut.**
6. **Forme.** Cinq rayons (4, 6, 10, 50 %, pilule 999) ; douze espacements (2, 3, 5, 6, 10 px hors de la grille de 4) ; trois traits (1 px plein, 2 px plein, 2 px pointillé). **Partiel.**
7. **États.** « Their copy does not repeat the button » : l'incident « à toi » écrit « Réessayer, le reprendre à la main, ou le passer » au-dessus des trois boutons du même nom ; « ESV ne répond plus » est écrit quatre fois sur le même écran (mot d'état, puce, bloc, raison sous le bouton). **Défaut.**
8. **Copie, même nom pour la même chose.** La poignée dit « différés · à reprendre après le lot » en cours, « à examiner · 11 différés, 9 verts » à la fin, « à examiner » en compact ; les sections sont en capitales espacées, la grille demande la casse de phrase. **Défaut.**
9. **Type.** Le compte du cache (« 1 lot, 190 Mo ») est en chasse fixe au milieu d'une phrase ; la chasse fixe n'a pas de rôle unique (grand chiffre, numéros de cut, quantité du cache, touches). **Partiel.**
10. **Habillage.** Barre de six objets (logo, bascule à deux cadenas, puce à point vert, palette, réglages) ; bande du cache bordée de 56 px pour une action rare ; étiquettes encadrées « V2 · à construire » de 11 px. **Partiel.**
11. **Petits écrans.** En 360 × 480 rien ne déborde, mais la page ne s'adapte pas entre 360 et 600 : la fenêtre a deux tailles fixes (54 débordements au vérificateur à 420 et 480). **Partiel.**
12. **Hiérarchie, mouvement réduit, sombre seul.** Mot d'état, grand chiffre, phrase, comptes : hiérarchie claire ; mouvement réduit respecté ; le sombre se lit seul. **Confirmé.**

## 3. Système de valeurs (posé avant r1, appliqué aux deux pages)
- **Espacements** : 4, 8, 12, 16, 24, 32, 48. Rien d'autre.
- **Rayons** : trois pas, du plus petit au plus grand : intérieur (segments, touches), contrôle (boutons, puce, lignes, champs), surface (palette, boîtes, sélecteur, carte). Q2 : 4 · 8 · 12. Q3 : 8 · 12 · 20 (la Frise).
- **Texte** : quatre tailles (grand chiffre, mot d'état, texte, méta), deux graisses (400, 500), casse de phrase partout. Sans pour les mots et les quantités ; chasse fixe pour une seule chose, les numéros de cut et le grand compte (Q2 ; Q3 met le grand compte en Zodiak, comme la Frise).
- **Couleurs à rôle unique** :
  | Rôle | Sert à | Ne sert jamais à |
  |---|---|---|
  | encre, encre 2 | tout le texte (≥ 4,5:1), traits | — |
  | encre 3 | marques non textuelles (graduations, reste du rail), ≥ 3:1 | texte |
  | **marche** (lumière ambrée) | Ariane avance : curseur, cut en cours, mot d'état en marche (Q3), faisceau (Q3) | pause, différé, avertissement |
  | **à toi** (brique) | l'opérateur doit agir : mot d'état et cadre d'incident, puce ESV perdue | boutons d'action, confirmation |
  | **à contrôler** (eau) | la marque ◆ des verts à contrôler | texte courant, chiffres |
  Pause, fin, arrêt, différé, corrigé, connecté : **neutres** (encre), dits par la forme et le mot.
- **Symboles du métier** (un seul trait, celui du rail) :
  - le **rail** lui-même : fait = trait plein, reste = pointillé, **curseur** = trait vertical à tête (marche) ;
  - **○** différé (cercle creux sur une tige), **◆** vert à contrôler (losange plein, eau), **•** corrigé (point plein), **×** passé par l'opérateur (SKIP compté) ;
  - **glyphe d'état** (Q2) = un bout de rail : repos (pointillé seul), marche (fait + curseur + cut en cours qui se remplit), arrêt demandé (une butée après le cut en cours), pause (‖ sur le rail), rupture (rail coupé : à toi, interrompu, ESV muet, file arrêtée), heurtoir (fin de voie : terminé), arrêté (butée, reste en pointillé), verrouillé (marche sans curseur) ; Q3 retire le glyphe : le mot suffit, la lumière dit la marche ;
  - plus aucune icône dans les boutons ni dans la palette ; restent le logo, le chevron du tiroir, « fermer », « ouvrir dans ESV » et « examiner » en compact (sans place pour le mot), et l'icône réglages (curseurs, plus le soleil).

## 4. Tour r1 : ce qui a été corrigé (autocritique r0, points 1 à 11)
Système de valeurs posé (§ 3) et appliqué aux deux pages par un seul socle ; symboles du rail ; couleurs à rôle unique ; copie des incidents sans redite ; casse de phrase ; fenêtre fluide de 360 à 600 (paramètre `largeur`). Vérificateur après r1 : 0 écart, 0 erreur sur 216 vues par page.

## 5. Autocritique r1 (captures r1, clair et sombre, 360 à 600, couches ; écrite avant r2)
1. **Q3, compact (défaut, mise en page).** En 360 × 480, la carte de l'instrument (marges + retraits) prend la place du tiroir : la poignée « Ce qui reste » passe sous la carte.
2. **Q3, boîte de la file (défaut).** Le bouton plein prend toute la largeur dans la boîte (règle de l'instrument appliquée aux boîtes) : « Fermer » se retrouve seul au-dessus.
3. **Raison d'un bouton grisé mal placée (états).** « Possible dès qu'ESV répond » vient après « Arrêter la relecture » : la raison doit suivre le bouton qu'elle explique.
4. **Puce à 480 px (petits écrans).** « Ongle… » : l'étiquette est coupée avant d'être raccourcie. « Labels in full before you truncate ».
5. **Poignée en Revue V2 (copie, petits écrans).** « Ce qui reste · ○ 11 différés, ◆ 9 verts à cont… » plus « reste à examiner 20 sur 20 » : deux comptes du même ensemble, et une coupure.
6. **Réglage grisé de la file (forme).** Nombre de parties grisé : chiffres barrés et pointillé autour du choix ; trop de signes pour « indisponible ».
7. **Forme, résidus.** Rayon de 1 px (point « sans réponse »), 2 px (trace du rail Q3), liseré de 1,5 px (faisceau) : hors de l'échelle.
8. **Q3, ombres.** Six ombres distinctes (carte, tiroir, bouton, incident, couches, compact) : « few shadows ».

## 6. Tour r2 : corrections (autocritique r1, points 1 à 8, tous corrigés)
Carte de Q3 resserrée en compact ; bouton plein à sa taille dans les boîtes ; la raison suit le bouton grisé ; puce et logo courts dès 480 px ; poignée V2 à un seul compte (« 20 sur 20 à examiner ») ; réglage grisé = un pointillé autour du groupe ; rayons 1 et 2 px retirés ; ombres de Q3 ramenées de 6 à 4. Recapture r2 clair, sombre, 360 à 600 : pas de régression ; vérificateur 0 écart.

## 7. Note (étape 6) : un auditeur indépendant, grille `rubrics.md`
`council` demande deux auditeurs indépendants. **Un seul a pu être lancé** (un sous-agent indépendant, par l'outil de délégation de la session) ; le second (un modèle d'un autre fournisseur, par un outil d'orchestration) n'existe pas ici. Brief neutre : planches r2 des deux niveaux (sombre, clair, compact) et de l'original, grille design, contraintes fixes avec leur raison, barre 8/10, ce que les captures ne montrent pas (mouvement, survol, clavier, contraste déjà mesuré).

| Ensemble | Note de l'auditeur (r2) | Passe |
|---|---|---|
| Q2 sombre 600 | 8 | oui |
| Q2 clair 600 | 8 | oui |
| Q2 compact | 7 | non |
| Q3 sombre 600 | 7 | non |
| Q3 clair 600 | 7 | non |
| Q3 compact | 6 | non |

Chaque constat vérifié sur la capture (méthode `council`) :
| # | Constat | Verdict | Suite |
|---|---|---|---|
| 1 | En 360, les lignes du tiroir montrent l'heure et pas « Ouvrir / Examiner » | **faux** (artefact) : la capture était en Revue V1, qui n'a pas ces actions ; en V2 à 360 les deux icônes sont là | rien |
| 2 | Q3 compact : la carte « File arrêtée » recouvre la poignée du tiroir | **confirmé** (la règle de S « l'instrument défile en compact » avait été perdue en r1) | corrigé : l'instrument défile, le tiroir garde sa place |
| 3 | Q3 : halo ambré sous le bouton et lumière de fond en Prêt, Terminé, À toi | **confirmé** (rôle de la lumière) | corrigé : lumière de fond et liseré chaud seulement quand Ariane avance |
| 4 | Q3 : actions centrées à 600, en ligne à 360 | **confirmé** | corrigé : bouton pleine largeur et textes centrés à toutes les largeurs |
| 5 | Voile des couches trop faible | **partiel** (lisible, mais le fond reste net) | voile renforcé (0,45 → 0,6 en sombre) |
| 6 | Glyphe d'état trop petit (niveau 2) | **confirmé** | 24 → 28 px (20 → 24 en compact), trait 2,5 |
| 7 | Sélecteurs natifs à côté des segments | **confirmé** | sélecteur dessiné (rayon, chevron, retraits de l'échelle) |
| 8 | Deux verbes, « contrôler » et « examiner » | **décliné** : « verts à contrôler » est le nom d'une catégorie ; « examiner » est le geste V2 sur différés et verts ; renommer toucherait le vocabulaire établi du panneau. À l'opérateur | — |
| 9 | Note « Revue V2, à construire » dans l'interface | **décliné** : règle de la maquette d'origine (dire ce qui n'existe pas encore) | — |
| 10 | Confirmation du cache : « Vider » plus fort qu'« Annuler » | **confirmé** (la suppression n'est jamais le bouton principal) | « Annuler » plein, suppression en contour (cache et « passer ») |
| 11 | Q3 clair : carte peu détachée du fond | **confirmé** | anneau de la carte un cran plus foncé |

Après r3 : vérificateur 0 écart, 0 erreur (216 vues par page) ; `jouer-signal.cjs` : tous les gestes jouables. **Pas de second passage de l'auditeur** sur r3 (budget d'une ronde de délégation tenu volontairement court) : les notes r3 ne sont pas mesurées.

## 8. Ronde 2 de l'auditeur (version r3) et tour r4
| Ensemble | Note r2 | Note r3 | Passe |
|---|---|---|---|
| Q2 sombre 600 | 8 | 9 | oui |
| Q2 clair 600 | 8 | 9 | oui |
| Q2 compact | 7 | 8 | oui |
| Q3 sombre 600 | 7 | 8 | oui |
| Q3 clair 600 | 7 | 8 | oui |
| Q3 compact | 6 | 7 | non |

Constats de la ronde 2, vérifiés : (1) Q3 compact, « Arrêter » coupé par le bas de la carte : **confirmé**, corrigé en r4 (bouton et action secondaire sur une ligne en compact, comme au niveau 2) ; (2) icônes seules dans le tiroir compact : **partiel**, `title` et `aria-label` existaient déjà, la coupure du motif reste (choix : garder les deux actions sur la ligne) ; (3) titre de la carte visible au ras de la palette en Q3 : **confirmé**, palette collée sous la barre et à la largeur de la carte ; (4) glyphes « Prêt » et « Hors ligne » trop proches : **confirmé**, « Hors ligne » = rail en deux tronçons disjoints. Après r4 : vérificateur 0 écart, jeu complet passé. **Ronde 3 non faite** (budget de `council` : 3 rondes, deux tenues) : la note du compact de Q3 après r4 n'est pas mesurée.

## 9. CH-024 : le mix (Q4, Q5), même méthode
- **But.** Les dessins et le fond de l'actuelle, la couleur et les valeurs de Q2 (décision de l'opérateur, `chantiers/CH-024.md`). **Ligne d'arrivée** : vérificateur 0 écart, jeu complet, empreintes des dessins égales à celles de `S-file-de-parties.html`, couleurs égales aux rôles de Q2. **Surfaces** : les 22 scènes et les tiroirs, deux thèmes, 360 à 600.
- **Construction (r1).** Un seul code : `signal.js` porte un drapeau `data-mix` (dessins de l'actuelle, icônes rendues aux boutons pleins, à la palette, à la bascule et à la puce, traits du rail) ; `mix.css` pose le fond de l'actuelle et ses règles. Vérificateur après r1 : 0 écart.
- **Autocritique r1** (captures r1, écrite avant correction) : (1) le liseré du fond autour des traits « différé » découpe le trait « fait » en tronçons, le rail se lit en pointillé ; (2) la marque en ligne (petit trait) devant « 4 différés » se lit comme une barre typographique ; (3) l'anneau « en cours » vide, à 30 % d'ambre, tire au brun et se lit éteint.
- **Tour r2.** (1) liseré retiré : les traits dépassent du rail de 6 px, comme dans l'actuelle ; (2) plus de marque en ligne (l'actuelle n'en avait pas) : le mot et le nombre suffisent ; (3) fond d'anneau à 45 %. Recapture r2 clair, sombre, 360 : un défaut mineur (cadenas centré sur deux lignes en compact), corrigé (aligné sur la première ligne). Pas de régression ; Q2 et Q3 réassemblées, mêmes mesures qu'avant.
- **Auditeur indépendant** : non lancé (budget ; le ticket ne le demande pas). Les notes de Q4 et Q5 ne sont pas mesurées.
