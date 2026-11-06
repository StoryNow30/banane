# CH-014 : recherche UX/UI v2, propositions neuves

Trente-quatre maquettes jouables du panneau d'Ariane, en sept familles de conception. Toutes partent d'une feuille blanche : ni l'interface actuelle, ni l'historique git, ni d'anciennes maquettes n'ont été ouverts. Ouvrir `index.html` pour les comparer (scène, thème, largeur et mouvement communs), ou chaque page seule avec sa régie.

Le détail est dans `recherche/` : une fiche par référence (`ref-*.md` : ce qui a été ouvert exactement, ce qui est retenu et écarté, erreurs d'accès) et une fiche par maquette (`maq-*.md` : logique, références, sens des signes, partition de mouvement, autocritique, chiffres).

## Méthode
1. **Lecture des références**, par des chemins ordinaires (Chromium préinstallé, lecture anonyme des dépôts publics clonés). Les cinq dépôts GitHub ont été lus jusqu'au code (styles de Scrubbers, designs de ThinkingOrbs, Swift et Metal de KoiPond, pièces et guides de SwiftPieces, paquets de libraries.dev). Aucun défi ni contrôle d'accès n'a été contourné.
2. **Sept familles de conception**, une logique chacune, cinq maquettes par famille (quatre pour la première). Six concepteurs ont travaillé en parallèle, chacun sur ses références ; aucun n'a vu les maquettes des autres.
3. **Contrat commun** : même moteur de démo (`sources/commun.js`, états fictifs et simulation), donc même sens partout (Lancer = lot neuf, Continuer = même lot, Préparer = ne lance rien). Seule la forme change.
4. **Skill de raffinement de l'opérateur** (kubre, design-refinement, lue avec `references/craft.md` et `capture.md`) appliquée à chaque maquette : captures clair et sombre, autocritique écrite, corrections, nouvelles captures. La skill renvoie à une notation par deux auditeurs (« council ») qui n'a pas pu être lancée : la grille a été appliquée par chaque concepteur sur ses captures.
5. **Motion design** pensé dans chaque maquette, avec une partition (événement → ce qui bouge → durée et courbe → sens → équivalent en mouvement réduit).
6. **Mesures** : `sources/verifier.cjs` joue chaque maquette dans Chromium, 20 scènes × clair/sombre × 360/420/600 px, et mesure les erreurs de console, le débordement horizontal et le contraste de chaque texte sur son fond calculé.

## Les 34 propositions

| Famille | Maquette | Logique en une phrase |
|---|---|---|
| Feuille blanche (intégrateur) | vivant | La lumière chaude ne paraît que là où Ariane agit ; l'orbe en points change de forme selon ce qu'elle fait. |
| | faisceau | Un faisceau fait le tour de la carte du lot tant qu'il tourne ; figé en pause, absent à l'arrêt. |
| | bassin | Une surface d'eau : chaque cut posé fait une onde, ce qui reste flotte jusqu'à ce qu'on le regarde. |
| | mosaique | Le lot est une image abstraite qui se forme tuile par tuile, nette quand le cut est posé. |
| Instruments et matière | instr-cadran | Un thermostat : l'arc allumé est fait, le centre dit ce qui reste, la face ne s'ambre que si Ariane a besoin de vous. |
| | instr-ruban | Une règle graduée sous une aiguille fixe ; une onde roule sur la partie faite et se couche en pause. |
| | instr-gelee | Une masse qui s'allonge à chaque cut ; différés et verts tombent en gouttes dans un bac qui sert de bouton. |
| | instr-metal | Un pupitre : la lumière dit qui doit agir ; drapeau mécanique, rouleaux, molette à crans. |
| | instr-orbe | Un objet dont la forme dit ce que fait Ariane ; triangle quand elle a besoin de vous, carré quand c'est fini. |
| Le mouvement porte l'état | mouv-donne | Une donne de cartes : la pioche reste à traiter, les différés restent en main, une carte est tendue quand Ariane attend. |
| | mouv-compteur | Des tambours mécaniques comme seule signalétique : cran par cut, cliquet en pause, barre à l'arrêt. |
| | mouv-fil | Un journal qui s'écrit lettre à lettre ; curseur seul en pause, trait qui coupe le fil à l'arrêt. |
| | mouv-activite | Une capsule dont la largeur, le rayon et le côté sont l'état ; elle se déplie en feuille quand c'est à vous. |
| | mouv-champ | Une marque par cut, posée avec une courte vague ; un losange qui se balance signale « à vous ». |
| Motifs d'application | app-feuille | Une feuille du bas à trois crans posée sur un état lisible de loin. |
| | app-onglets | Un bandeau du lot en direct au-dessus des onglets Lot / À regarder / File, avec la seule commande utile. |
| | app-ilot | Un îlot qui s'ouvre de lui-même quand l'opérateur doit agir ; dessous, un fil d'activité replié. Les commandes de marche sont dans l'îlot (un toucher). |
| | app-pile | Un portefeuille de cartes (Lot, À regarder, File, Écho) ; le paquet À regarder se balaie. |
| | app-fil | Un fil de navigation Lot › Partie › Cut dont chaque maillon s'ouvre, et une palette de commandes. |
| Éditorial et typographie | edito-manchette | La une d'un journal : la manchette dit l'état, le filet épais l'avancement. |
| | edito-rature | Le lot s'écrit en phrases et chaque cut traité se raye d'un trait de crayon. |
| | edito-specimen | Une planche de fonderie sans couleur ; le bloc noir plein désigne ce qui est actif ou vous attend. |
| | edito-affiche | Un mot et un nombre géants lisibles à trois mètres ; le fond porte l'état, toujours redit par un mot. |
| | edito-sommaire | Une table des matières à points de conduite ; un signet glisse jusqu'au chapitre en cours. |
| Lumière et atmosphère | matiere-spectre | Le lot est une lumière décomposée : chaque cut élargit le spectre, chaque différé y laisse une raie sombre. |
| | matiere-horizon | Le lot a ses heures, du lever au coucher ; la météo dit s'il a besoin de l'opérateur. |
| | matiere-detour | Figure et fond : ce qui demande l'opérateur est détouré devant lui, le reste est à plat. |
| | matiere-feuille | Ariane tape le lot à la machine ; les différés restent en X là où ils ont eu lieu. |
| | matiere-carotte | Une carotte de glace sur table lumineuse : la profondeur est l'avancement, les différés sont des grains pris dans la glace. |
| Signalétique et information | info-gravite | Une seule échelle (rien / à regarder / à agir) organise tout ; disque, triangle, octogone. |
| | info-constantes | Une colonne de cinq chiffres lisibles de loin, façon moniteur de constantes. |
| | info-pictos | Des pictogrammes dessinés pour le métier, quantités en signes répétés, lisibles en noir et blanc. |
| | info-allure | Le panneau répond d'abord à « le lot ralentit-il ? » : phrase, cadence et médiane, axe des événements. |
| | info-minuteur | Un cadran de 60 minutes dont le secteur vaut les minutes restantes ; hachuré quand le temps est figé. |

## Sans filiation, et sans voie ni nuage
Aucune maquette ne reprend une palette, un symbole, une police, une structure ou un mouvement de l'interface actuelle, qui n'a jamais été ouverte. Sur avertissement de l'intégrateur (métaphores déjà vues et rejetées), aucune ne repose sur une voie, un rail, un quai, une signalisation ferroviaire ou un nuage de points ; la vue « Examiner un cut » montre la coupe du cut de façon fonctionnelle, comme contenu à examiner. Chaque fiche maquette le justifie en une ligne. La première série (carnet, nuage, poste, lecture, orbes, fil), jugée décevante par l'opérateur, a été abandonnée avant toute poussée.

## Références de l'opérateur
ÉTABLI = lu ; PROBABLE = vu en liste ou en grille sans ouverture ; refus = noté, jamais contourné.

| Référence | Statut | Fiche |
|---|---|---|
| insposite | ÉTABLI (5 pages, sites recensés ouverts ; designspells et siteinspire : HTTP 429 « Vercel Security Checkpoint », janina.works : HTTP 403) | ref-insposite |
| inspora.design | Catégories ÉTABLI ; pages de pièces refusées (HTTP 429, « Vercel Security Checkpoint », Code 21) : pièces PROBABLE | ref-inspora |
| iter0 | ÉTABLI | ref-iter0 |
| backgrounds.supply | ÉTABLI | ref-backgrounds-supply |
| v0 templates | ÉTABLI (liste et miniatures) ; certains aperçus restent blancs, code derrière connexion | ref-v0-templates |
| beui.dev | ÉTABLI (composants et code public ; « /blocks » et « /agents » : 404) | ref-beui |
| mobbin | ÉTABLI pour les pages publiques ; parcours complets derrière un compte | ref-mobbin |
| navbar.gallery | ÉTABLI (huit types) | ref-navbar-gallery |
| 60fps.design | ÉTABLI (fiches publiques ; filtres et code complet réservés aux abonnés) | ref-60fps |
| motionin.design | ÉTABLI (descriptions ; code payant) | ref-motionin |
| land-book | **Refus** : HTTP 403, « Just a moment… / Performing security verification » (Cloudflare), deux essais ; non lu | ref-land-book |
| landdding | ÉTABLI | ref-landdding |
| fontshare | ÉTABLI (familles, filtres, paires ; API des polices) | ref-fontshare |
| remove.bg | ÉTABLI (parcours de détourage) | ref-remove-bg |
| wedoflow | ÉTABLI | ref-wedoflow |
| heydamir | ÉTABLI (douze projets dans la visionneuse) | ref-heydamir |
| Skill kubre design-refinement | ÉTABLI (SKILL.md, craft.md, capture.md) | ref-kubre-skill |
| ThinkingOrbs (dépôt) | ÉTABLI, code compris | ref-thinkingorbs |
| SwiftPieces (dépôt) | ÉTABLI, code de nombreuses pièces et guides | ref-swiftpieces |
| KoiPond (dépôt) | ÉTABLI, code entier (aucun traitement du mouvement réduit dans le dépôt) | ref-koipond |
| Scrubbers (dépôt) | ÉTABLI, code des douze styles | ref-scrubbers |
| Libraries.dev (dépôt et site) | ÉTABLI ; pages « image » et « studio » non chargées (délai de 45 s dépassé) | ref-libraries-dev |

Synthèses du mouvement par famille : ref-mouvement-app, ref-mouvement-edito, ref-mouvement-info, ref-mouvement-matiere.

## Ce qui manquait à la liste (et a été lu)
Ces ressources servent directement un panneau surveillé de loin, qui doit tenir sans couleur et respecter le mouvement réduit :
- **Carbon Design System, « Status indicators »** (ÉTABLI) : gravité portée par la forme et la couleur ensemble. Fiche ref-carbon.
- **Radix Colors** (ÉTABLI, page publique ; le paquet npm a été refusé par les permissions de la session) : échelles à douze pas, texte accessible. Fiche ref-radix.
- **Laws of UX** (ÉTABLI) : Hick, Fitts, Jakob, charge cognitive, etc. Fiche ref-laws-of-ux.
- **Atkinson Hyperlegible** (ÉTABLI) : chiffres qu'on ne confond pas, lecture en basse vision. Fiche ref-atkinson.
- **WCAG 2.2** 1.4.1, 1.4.3, 1.4.11, 2.3.3, **calculateur APCA**, **web.dev prefers-reduced-motion** (ÉTABLI). Fiche ref-wcag.
- Composants de données (beUI Charts, SwiftPieces data and charts, gabarits Dashboards de v0) et signalétique publique (ÉTABLI). Fiches ref-donnees, ref-signaletique.
- Refactoring UI : seule la page publique a été lue (le livre n'a pas été lu).

Manques encore utiles, **non lus** : un guide de mouvement d'un grand système de design (durées et courbes normées) ; les recommandations d'un éditeur de système mobile sur les activités en direct ; une étude de lisibilité à distance sur écran (taille minimale de chiffre par mètre).

## Mesures (ÉTABLI, sources/verifier.cjs)
Les 34 maquettes : 0 erreur de console, 0 débordement horizontal, contraste minimal du texte compris entre 4,68:1 et 6,73:1 (seuil 4,5:1), en clair et en sombre, à 360, 420 et 600 px, sur les 20 scènes du cahier. Chacune a aussi été jouée en mouvement actif (lancer, pause, continuer, scènes) sans erreur.

## Limites
- Le vérificateur ne voit que les fonds CSS : un texte posé sur un canvas ou un dégradé est mesuré sur le fond de base. Les concepteurs ont posé ces textes sur des fonds opaques ou presque.
- Le vérificateur tourne en mouvement réduit ; le mouvement actif a été joué et regardé, pas mesuré.
- Le rendu du moteur toutes les 0,9 s recrée le panneau ; chaque famille a protégé ses animations (éléments conservés, phase calée sur l'horloge, animations Web). Un rendu par différences dans le moteur serait plus sûr pour une implantation.
- Données toutes fictives ; aucune mesure d'usage réel.
- Polices intégrées en base64 (Fontshare, licence ITF ; Google Fonts, licence OFL) : pages lourdes (100 à 250 Kio).
