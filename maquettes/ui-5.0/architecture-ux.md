# Ariane 5.0 : architecture UI/UX, reprise à zéro (24 octobre 2026)

Document de conception, pas de pixels finaux, pas de code. Écrit pour l'opérateur. Tout ce qui est affirmé sur le panneau vient de la lecture de `src/ui5.js`, `src/ui5-rendu.js`, `fiches/UI_ETATS_COMPTEURS.md`, `fiches/UI_INVENTAIRE.md` et des décisions D-218, D-230 à D-236. Les chiffres (cuts, compteurs, Mo) sont inventés. Rien n'est construit, rien n'est modifié dans le dépôt en dehors de ce fichier.

---

## 1. Constat honnête : pourquoi les maquettes paraissent génériques

1. **Hiérarchie.** Tout est carte : même rayon, même filet, même ombre. L'œil ne sait pas ce qui compte. Dans O, le grand mot d'état et le grand chiffre ont le même poids et se battent. Dans N, cinq surfaces superposées (fond, ambiance, carte, panneau, bande) pour trois informations.
2. **Typographie.** Une grotesque géométrique en graisse 800, lettres resserrées, chiffres énormes : c'est la recette de toutes les pages de produit depuis 2022. Les tailles (76, 54, 18, 15, 13) sont choisies au coup par coup, sans échelle. Rien n'est réglé finement : pas de chiffres tabulaires partout, pas d'interlignage pensé, pas de taille optique.
3. **Rythme.** Pas de grille. Les marges valent 28, 26, 22, 20, 18, 16, 14 selon l'endroit. Les blocs flottent. Le vide n'est pas composé, il est résiduel.
4. **Matière.** Verre flou + lueur radiale + grain + pastilles + rayons de 20 px : c'est le gabarit « tableau de bord sombre » qu'on trouve partout. P ajoute l'ombre portée du texte, le reflet qui balaye le bouton, le point qui orbite : exactement ce qui se lit « vibe codé », parce que ça décore sans rien dire.
5. **Mouvement.** Les animations sont ornementales (orbite, ondes, compteurs qui montent, brillance). Tout bouge en même temps, en boucle. Rien ne signale un changement précis.
6. **Identité.** Rien n'appartient à Ariane : le logo en dégradé corail → violet, les couleurs par activité, les pictogrammes de bibliothèque. On ne reconnaîtrait pas le panneau sur une vignette. Le métier (rail, voie, mesure) n'est nulle part.
7. **Méthode.** Chaque maquette répond au dernier retour de l'opérateur au lieu de partir d'un système stable. Résultat : un gabarit différent à chaque fois, jamais un produit.
8. **O est ennuyeuse pour une raison précise** : elle est honnête mais sans objet. Il n'y a rien à regarder. Le « haut de gamme » ne vient pas d'en rajouter (P) mais d'un seul objet dessiné avec soin, de proportions exactes et de détails typographiques tenus partout.
9. **Ce qui est bon et à garder** : la table état → phrase → action, les compteurs définis, l'incident corrigé d'après le code, la relecture avec pause, la palette sobre à quatre commandes, le cache avec sa raison écrite.
10. **Ce que je ne peux pas juger d'ici** : le rendu à côté d'ESV, à la taille réelle, sur l'écran de l'opérateur. Tout ce document le suppose et le dit au § 8.

---

## 2. Ce que l'opérateur a à faire, moment par moment

Lecteur : l'opérateur, seul, ESV ouvert à côté, en séance de 1 à 3 heures. La question qu'il pose au panneau est toujours la même : **« dois-je faire quelque chose ? »** La réponse est presque toujours « non ».

| Moment | Ce qu'il regarde | Ce qu'il décide | Geste le plus court (cible) |
|---|---|---|---|
| **Avant le lot** | Ariane est-elle reliée au bon onglet ESV ? Sur quelle partie ? | Démarrer, ou d'abord connecter | 1 clic (un seul onglet prêt : connexion déjà faite) · 2 clics s'il y a plusieurs onglets |
| **Pendant le lot** | Ça tourne ? Où en est-on ? Combien de différés ? | Rien. Parfois : Pause | 0 geste pour savoir (lecture < 2 s) · 1 clic pour Pause · 1 clic pour Reprendre |
| **Incident** (rail non résolu, confiance basse) | Quel cut, quel rail, quelles options | Réessayer / Reprendre à la main / Passer | 1 clic après lecture d'une ligne ; Passer garde sa confirmation (2 clics) |
| **Incident** (ESV ne répond plus) | Y avait-il une écriture en cours ? | Attendre, F5 si figé, puis Reprendre ; ou Archiver si une pose n'est pas confirmée | 1 clic ; jamais de « Reprendre » proposé si une opération est en l'air |
| **Fin de lot** | Combien traités, combien à examiner, export fait ? | Voir ce qui reste ; exporter ; vider le cache après réception | « Voir ce qui reste » 1 clic · Export 1 clic · Cache 2 clics (bouton + confirmation) |
| **Relecture** (après le lot) | Elle avance ? Ne pas toucher à ESV | Rien. Parfois Pause / Reprendre / Arrêter | 1 clic ; après F5 : 1 clic quand ESV répond |
| **Deuxième passe** (provisoire) | Ne rien toucher | Rien | 0 geste ; tout est verrouillé et dit pourquoi |
| **Écho** | Est-ce qu'Écho observe ? Combien de corrections ? | Démarrer, Terminer et télécharger | 1 clic pour démarrer · 1 clic pour terminer · le bandeau dans ESV suffit pendant la séance |
| **Cache** | Combien gardé, est-ce que je peux vider ? | Vider seulement après confirmation de réception | 2 clics ; grisé avec la raison tant que c'est interdit |
| **Changer d'activité** | Orbite ou Écho | Un seul choix, au repos | 1 clic ; verrouillé pendant un lot ou une relecture, avec la raison |

**Compte de gestes visé pour une séance type** (un lot complet avec relecture et export, puis une Écho complète) : **7 clics dans Ariane** (connecter si besoin, Démarrer, Voir ce qui reste, Exporter, Écho, Démarrer, Terminer), contre 9 dans le panneau de la test 9 et 11 dans la 4.9.6 (accueil, vignettes, onglets). Pause et reprise : 1 clic chacune, depuis n'importe où (le bouton principal ou Ctrl K). Aucune case à cocher, aucune liste à choisir en séance.

---

## 3. Architecture d'information

### 3.1 Trois candidates

**A · « Une seule scène »** (héritière de O et P). Un écran, un état au centre, tout le reste contextuel ; Revue et Réglages sont des fenêtres par-dessus.
Forces : la plus simple à lire, la plus simple à construire. Faiblesses : rien à regarder quand tout va bien (c'est le reproche à O) ; les listes (différés, verts, visites) n'ont pas de place naturelle et finissent en fenêtres modales qui cachent l'état.

**B · « L'instrument et le tiroir »** (recommandée). La fenêtre est coupée en deux couches qui ne se mélangent jamais : en haut, **l'instrument**, permanent, aéré, qui répond à « dois-je agir ? » ; en bas, **le tiroir**, contextuel, dense, qui s'ouvre d'un geste pour les listes (différés, verts à contrôler, visites Écho, relecture) et se referme sans rien perdre. Réglages est une feuille qui glisse par-dessus l'instrument ; la palette (Ctrl K) commande la même chose au clavier.
Forces : un seul écran, zéro navigation, l'état toujours visible même tiroir ouvert ; l'instrument peut être un bel objet sans surcharge ; la densité a un endroit pour exister. Faiblesses : le tiroir demande une hauteur de fenêtre suffisante (voir 3.5) ; il faut tenir la discipline « aéré en haut, dense en bas ».

**C · « Deux fenêtres »**. Un petit instrument (environ 380 × 200) collé à ESV, et une fenêtre de travail séparée pour la Revue et les réglages.
Forces : la plus discrète pendant le travail. Faiblesses : gestion de deux fenêtres par l'utilisateur, le vidage automatique d'Écho dépend de la page du panneau chargée, la fenêtre d'origine est créée en 560 × 820 : chantier technique propre à cette direction, et deux endroits où regarder.

| Critère | A | B | C |
|---|---|---|---|
| Lecture de l'état sans geste | oui | oui, toujours | oui |
| Place pour les listes | mauvaise (modales) | bonne (tiroir) | bonne (2ᵉ fenêtre) |
| Gestes pour la séance type | 7 | 7 | 7 à 9 |
| Ennui visuel | risque fort | faible si l'instrument est travaillé | faible |
| Chantier | petit | moyen | gros |
| Rupture avec la 4.9.6 | forte | forte | très forte |

**Recommandation : B.** Elle garde ce que l'opérateur a aimé dans O (« on comprend tout »), donne un objet à regarder sans décor, loge les listes sans écran de plus, et supprime l'accueil à vignettes qui coûte un clic à chaque fois (« trop lent »).

### 3.2 La carte

```
FENÊTRE ARIANE (une seule ; dessinée pour 600 × 760, tient à 560 de large)

┌──────────────────────────────────────────────────────────┐
│ ▲ Ariane      ( Orbite | Écho )          ● Onglet 2 ▾   ⌘ ⚙ │  BARRE · permanente
├──────────────────────────────────────────────────────────┤
│                                                          │
│   ◐ En cours                                             │  ÉTAT · un mot, une pastille à forme
│   Pose du cut 4812                                       │  PHRASE · ≤ 60 signes, factuelle
│                                                          │
│   ╞════════════╪═══╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╡       │  OBJET · le rail : traités/ciblés,
│   31 traités sur 120      27 posés · 4 différés          │          repères des différés, curseur
│                                                          │
│   [ ❚❚  Pause ]                                Arrêter   │  ACTION · une principale, une secondaire en texte
│                                                          │
│ ▸ 4 différés · à reprendre après le lot                  │  POIGNÉE DU TIROIR · contextuelle
├──────────────────────────────────────────────────────────┤
│ ░ TIROIR (fermé ici) : différés · verts · visites · relecture │  TIROIR · dense, défilable
├──────────────────────────────────────────────────────────┤
│ Cache des exports · 1 lot, 190 Mo         [ Vider le cache ] │  BANDE CACHE · permanente, grisée + raison
└──────────────────────────────────────────────────────────┘

Par-dessus, seulement quand on les appelle :
  • FEUILLE RÉGLAGES (⚙) : 7 lignes, se ferme par Échap
  • PALETTE (Ctrl K ou ⌘) : une ligne de recherche, 4 commandes du moment
  • CONFIRMATIONS : vider le cache, passer un cut (SKIP), abandonner une séance Écho
Dans la page ESV : le BANDEAU d'une ligne, qui répète la phrase d'état. Aucun bouton dedans.
```

### 3.3 Les états et leurs transitions (Orbite)

```
Hors ligne ──connecter──▶ Prêt ──Démarrer──▶ En cours ──Pause──▶ Pause demandée ──▶ En pause ──Reprendre──▶ En cours
                                                │                                        │
                                                │◀── Réessayer / Reprendre à la main ─── À toi (rail non résolu, confiance basse ; Passer avec confirmation)
                                                │
                                                ├── ESV muet pendant une écriture ──▶ Interrompu ──Archiver le résultat──▶ Lot arrêté
                                                ├── ESV muet entre deux cuts ──▶ ESV ne répond plus ──(F5 si figé)──Reprendre──▶ En cours
                                                │
                                                └── fin de partie / Arrêter ──▶ Terminé ──(automatique)──▶ Relecture ──▶ [Deuxième passe] ──▶ Fin
                                                                                              Pause · Reprendre · Arrêter        verrouillé
                                                                                              (survit à un F5)
Fin : trois lignes (traités / ce qui reste / export) → action « Voir ce qui reste » (ouvre le tiroir) · Exporter · Cache disponible
```

Écho : `Aucune séance ──Démarrer──▶ Observation ──Pause──▶ En pause ──Reprendre──▶ Observation ──Terminer──▶ Volumes prêts (télécharger à nouveau si incomplet)`. Verrouillé tant qu'un lot, une relecture ou une deuxième passe est ouverte, avec la raison écrite à la place du bouton.

Règles tenues dans toutes les transitions :
- l'instrument ne change jamais de forme : seuls son contenu et sa couleur de signal changent ;
- une opération interrompue reste écrite jusqu'à sa clôture ; une pose commencée n'est jamais montrée terminée ;
- « Reprendre » n'apparaît que si le panneau d'origine l'autorise ;
- à la fin, connexion et « en cours » disparaissent de l'instrument.

### 3.4 Permanent, contextuel, caché

| | Éléments |
|---|---|
| **Permanent** (toujours visibles) | logo, bascule Orbite / Écho, puce de l'onglet ESV, ligne d'état, phrase, objet d'avancement, action principale, bande cache |
| **Contextuel** (selon l'état) | action secondaire, poignée et contenu du tiroir, bloc incident (remplace l'objet d'avancement), les trois lignes de fin, le verrou de la deuxième passe, la ligne de relecture |
| **Caché** (un geste pour l'appeler) | réglages (feuille), palette (Ctrl K), confirmations, ancien panneau (lien en bas de la feuille réglages et commande de la palette), détails techniques (ancien panneau) |

### 3.5 Ce que devient chaque élément existant

| Élément | Avant (4.9.6) | Dans B |
|---|---|---|
| **Connexion ESV** | rangée d'onglets sous la barre, une puce par onglet | **une puce dans la barre** : « ● Onglet 2 · partie 13 ». Un clic ouvre la liste des onglets (rang, fenêtre, au premier plan) ; choisir = connecter. Une seule connexion partagée, dite telle quelle. Verrouillée pendant un lot, avec la raison. Rouge quand ESV ne répond plus. Sans onglet : la puce pulse une fois et l'action principale devient « Choisir un onglet » |
| **Vider le cache** | bande en bas d'Orbite et d'Écho | **bande permanente en bas**, même place dans les deux activités. Grisée avec la raison (« disponible après le lot ») tant que le panneau l'interdit ; active : combien gardé, bouton, confirmation d'origine qui dit ce qui sera supprimé et gardé |
| **Revue** | écran à part, deux listes | **le tiroir « Ce qui reste »** : différés puis verts à contrôler, jamais mélangés, avec le compte en poignée. S'ouvre par « Voir ce qui reste » à la fin du lot, ou par la poignée à tout moment. Lecture seule tant que la fonction « ouvrir le cut » et « examiné » n'existent pas (elles n'existent pas aujourd'hui : voir § 8) |
| **Réglages** | écran à part, liste longue | **feuille** par-dessus l'instrument, 7 lignes : après le lot, clic du mode rapide, série de différés, raison (Écho), si ESV est rechargé pendant la relecture, thème, interface. En bas : « Ancien panneau (détails techniques) » et « Abandonner la séance Écho » (zone à part). Jamais ouverte en séance |
| **Palette** | interface alternative choisie dans Réglages | **la même**, telle que décidée (D-233, D-236) : Ctrl K ou l'icône discrète, quatre commandes du moment, le reste en tapant. Elle n'est plus une « interface » séparée mais une couche par-dessus l'instrument ; Ctrl K la ferme. Le réglage « interface » peut rester pour ceux qui veulent démarrer dedans |
| **Relecture** | ligne + boutons du module de pause | **un état d'Orbite** : même instrument, objet en mode relecture (relus / sélection, corrigés), Pause / Reprendre / Arrêter à la place de l'action principale. Après F5 : « en pause, reprise possible quand ESV répond », bouton grisé |
| **Deuxième passe** | zone provisoire | **un état verrouillé** : cadenas en pastille, phrase « travaille dans ESV, ne touche à rien », aucune action, cache grisé. Son nom viendra de la session principale ; l'instrument ne suppose rien d'autre |
| **Accueil à vignettes** | premier écran, 4 cartes | **supprimé**. On arrive directement sur l'activité en cours (ou Orbite au repos). C'était un clic de plus à chaque séance |
| **Parties récentes, grands titres, phrases d'accompagnement** | accueil et têtes d'écran | **supprimés**, conformément aux retours |
| **Compteur GCV2** | pied de page | **hors de l'écran de travail** (feuille réglages, avec sa définition et sa date), comme fixé dans la fiche des compteurs |
| **Bandeau dans ESV** | réglage | **allumé par défaut**, répète la phrase d'état ; aucun bouton |
| **Détails techniques** | ancien panneau | inchangé, atteint depuis la feuille réglages et la palette |

**Fenêtre.** La fenêtre d'origine est créée en 560 × 820 ; la 4.9.6 la pousse à 1180 × 840, ce qui prend la moitié d'un écran. B est dessinée pour **600 × 760** et doit rester lisible à 560 de large : instrument d'environ 320 px de haut, tiroir d'environ 300 px, bande cache 56 px. Hypothèse à vérifier avec l'opérateur (§ 8) : où il pose la fenêtre, et sur combien d'écrans.

---

## 4. Principes de design, et anti-principes

Chaque principe a sa mesure ; un essai automatique peut en vérifier la plupart.

1. **Une question, une réponse.** L'instrument répond à « dois-je agir ? » en moins de deux secondes : un mot d'état, une phrase de 60 signes au plus, exactement un bouton principal. *Mesure : un essai parcourt tous les états et compte un seul bouton principal et une phrase ≤ 60 signes.*
2. **La forme porte l'état, la couleur confirme.** Chaque état a un glyphe propre (anneau tournant, deux barres, triangle, cadenas, coche). *Mesure : capture en niveaux de gris, tous les états restent distincts.*
3. **Rien ne bouge sans raison.** Une animation signale un changement de donnée, jamais un ornement. Une seule animation continue autorisée : la pulsation lente du glyphe « en cours ». *Mesure : zéro animation en boucle hors ce glyphe ; tout à zéro en mouvement réduit.*
4. **Un seul objet héros.** Le rail d'avancement est la seule chose dessinée ; le reste est du texte à trois tailles au plus. *Mesure : trois tailles de texte sur l'instrument, un seul élément graphique.*
5. **Densité à deux vitesses.** Instrument aéré (24 px au moins entre les groupes), tiroir dense (lignes de 36 px). Jamais de mélange. *Mesure : espacements pris dans l'échelle du § 6, rien d'autre.*
6. **Zéro réglage en séance.** Aucune case, aucune liste de choix sur l'instrument ni dans le tiroir. *Mesure : zéro élément de saisie hors de la feuille réglages et des bornes au repos.*
7. **Chaque chiffre dit ce qu'il compte.** « 31 traités sur 120 ciblés », jamais « 31 / 120 ». Les définitions sont celles de la fiche des compteurs. *Mesure : relecture de tous les libellés contre la fiche.*

**Anti-principes** (ce qu'on s'interdit, et qu'on peut vérifier dans la feuille de style) : pas de dégradé de fond, pas de verre sur verre, pas d'ombre portée sur du texte ni de lueur, pas de reflet qui balaye, pas de compteur qui monte, pas plus de deux rayons d'angle, pas de titre qui répète le nom de l'onglet, pas de phrase qui s'adresse à l'opérateur (« tu… ») hors consigne d'incident, pas de couleur par activité étalée sur toute la surface, pas d'icône sans libellé pour une action.

---

## 5. Direction artistique : deux pistes premium, vraiment différentes

Les deux partent de la même architecture B. Elles diffèrent par la matière, la lumière, la typographie et le mouvement. Toutes deux sont réalisables dans une extension Chrome sans réseau : polices libres (licence OFL) embarquées en fichiers locaux sous-ensemble latin (30 à 90 Ko chacune), pictogrammes en SVG inline, tout en CSS ; pas de CDN, pas de police système imposée, pas de bibliothèque. Un canvas n'est nécessaire nulle part.

### Direction 1 · « Signal »

**Sensation.** Un instrument de cabine, une signalisation ferroviaire : sombre, mat, précis, silencieux. On pense à un appareil de mesure bien fini, pas à une application. Le premium vient de la justesse (alignements, filets d'un pixel, chiffres tabulaires) et de la rareté de la couleur.
**Densité.** Instrument très aéré ; tiroir serré comme un relevé.
**Matière.** Graphite chaud presque noir, sans dégradé ni flou. Profondeur par deux tons de surface seulement et des filets d'un pixel à 12 % de blanc, comme gravés. Aucune ombre sauf le bord haut du tiroir.
**Typographie.** *IBM Plex Sans* pour l'interface (trois graisses : 400, 500, 600) et *IBM Plex Mono* pour tous les nombres de cuts et compteurs (OFL, fichiers locaux). Le mot d'état en Plex Sans 500 à 28 px, pas plus gros. Le grand nombre (« 31 ») en Plex Mono 44 px, graisse 500, chiffres tabulaires. Variante possible : *Instrument Sans* (OFL) si Plex paraît trop « informatique ».
**Couleur, par rôle.** Fond graphite ; encre claire ; encre atténuée ; un seul **signal vert** réservé à « en cours » (vivant) et « posé » ; **ambre** pour pause et différés ; **rouge brique** pour « à toi » et « interrompu » ; action principale en encre claire sur graphite (bouton clair, texte sombre), jamais colorée. L'activité (Orbite / Écho) n'a pas de couleur : elle est dite par le mot et la bascule.
**Formes.** Rayons 6 px sur les contrôles, 10 px sur le tiroir et la feuille. La puce d'onglet et le bouton principal sont les deux seules formes pleines.
**L'objet.** Le **rail** : une ligne horizontale fine avec une graduation tous les 10 cuts, un segment plein pour les traités, des repères ambre verticaux aux rangs des différés, un curseur (trait court) au cut en cours, le reste en pointillé gris « 89 restants ». Total inconnu : pas de graduation, la ligne court jusqu'au bord et s'efface. Relecture : la même ligne, repères des corrigés. Écho : pas de rail, un compteur et une ligne de marques par visite.
**Mouvement.** 160 à 240 ms, sortie douce, jamais de rebond. Le curseur du rail glisse d'un cut à l'autre (240 ms). Le changement d'état fond la couleur du glyphe (200 ms). Le tiroir glisse de bas en haut (280 ms). Pulsation lente du glyphe « en cours » (2 s, opacité 100 → 70 %), rien d'autre en boucle.
**Son.** Optionnel et éteint par défaut : un seul son court (un déclic mat) sur l'arrivée d'un incident. Techniquement possible depuis la page de l'extension avec un fichier audio local ; Chrome peut le bloquer tant qu'aucun clic n'a eu lieu dans la fenêtre. À proposer, pas à promettre.
**Risques.** Peut paraître froid ou « outil de développeur » ; proche du « noir, traits fins, un grand chiffre » que l'opérateur aimait dans l'ancien haut d'Orbite, donc risque qu'il y voie l'ancien panneau ; un thème sombre seul ne convient pas à tous les éclairages (prévoir le thème clair en « papier technique », § 5.3).

### Direction 2 · « Carnet technique »

**Sensation.** Une fiche d'atelier sur papier gris, imprimée avec soin : calme, chaud, lisible, autoritaire sans être dure. On pense à une notice d'instrument de précision ou à un relevé de géomètre. Le premium vient du contraste entre un grand chiffre dessiné et des petites capitales espacées, et d'un papier qui n'est pas blanc.
**Densité.** Même partage instrument / tiroir ; le tiroir se lit comme un tableau imprimé, avec des filets horizontaux fins.
**Matière.** Papier gris chaud (jamais blanc pur, pour ne pas éblouir à côté d'ESV qui est sombre), encre noire, un seul **bleu encre** pour l'action principale. Profondeur par superposition de feuilles : le tiroir et la feuille réglages ont un bord d'un pixel et une ombre très courte d'un seul ton ; rien d'autre n'est ombré.
**Typographie.** *Bricolage Grotesque* (OFL, variable avec taille optique) pour le mot d'état et le grand nombre : à grande taille elle a du caractère sans être criarde ; *Hanken Grotesk* (déjà embarquée) pour le texte courant ; *JetBrains Mono* (déjà embarquée) pour les numéros de cuts. Petites capitales espacées (lettrage +6 %) pour les étiquettes de section du tiroir. Option plus audacieuse : le mot d'état en *Instrument Serif* italique (OFL), un seul mot serif dans tout le panneau ; à tester, ça peut paraître affecté pour un outil d'opérateur.
**Couleur, par rôle.** Papier ; encre ; encre atténuée ; filet ; **bleu encre** (action, sélection, focus) ; **vert mousse** (en cours, posé) ; **ocre** (pause, différés) ; **brique** (à toi, interrompu). Les couleurs d'état sont désaturées : elles marquent, elles n'illuminent pas.
**Formes.** Angles presque droits (3 px) sur les contrôles, 8 px sur les feuilles. Le bouton principal est un rectangle plein bleu encre, texte papier.
**L'objet.** La **trame** : une grille de petits carrés, un par cut traité, dans l'ordre du lot (posé : plein ; différé : barré ; SKIP : croix ; repris : point ; en cours : contour épais), suivie d'une seule barre grise pour les restants, comme la fiche des compteurs le prescrit. Lisible sans couleur. Passe à la ligne, ne déborde jamais. Relecture : la trame des cuts relus. Écho : une trame des visites (corrigées pleines, validées vides).
**Mouvement.** 200 à 300 ms, entrée-sortie douce, comme une feuille qu'on glisse. Un carré de la trame apparaît par un bref assombrissement (150 ms), pas par un rebond. Le tiroir glisse. Aucune boucle sauf le glyphe « en cours ».
**Son.** Aucun.
**Risques.** Le « papier chaud » est devenu une mode récente dans les outils d'écriture : il faut la typographie et la trame pour que ce soit nôtre, sinon ça redevient générique. Un panneau clair à côté d'un ESV sombre peut fatiguer : le gris du papier doit être mesuré sur l'écran de l'opérateur, pas deviné. Bricolage Grotesque a une personnalité forte : si l'opérateur ne l'aime pas, toute la direction tombe (repli : *Schibsted Grotesk*, OFL, plus neutre).

### 5.3 Ce qui est commun et non négociable

Un seul objet, trois tailles de texte sur l'instrument, chiffres tabulaires partout, une couleur d'action, trois couleurs de signal, pas de dégradé, pas de flou, le bandeau ESV identique dans les deux. Chaque direction existe en clair et en sombre (Signal a un clair « papier technique » discret ; Carnet a un sombre « ardoise ») pour que le thème ne décide pas la direction.

---

## 6. Système de design minimal

Valeurs données pour Signal (sombre). Carnet suit la même structure avec sa propre palette ; les contrastes indiqués sont vérifiés par calcul, à confirmer sur écran.

### 6.1 Couleurs par rôle

| Rôle | Signal (sombre) | Contraste sur le fond | Emploi |
|---|---|---|---|
| fond | graphite #121314 | — | fenêtre |
| surface | #1A1B1D | — | tiroir, feuille |
| surface-2 | #222427 | — | ligne sélectionnée, champ |
| encre | #ECEDEE | 16 : 1 | texte principal, bouton principal |
| encre-2 | #A6A9AD | 7,9 : 1 | texte secondaire, phrase |
| encre-3 | #6F7378 | 3,9 : 1 | **non textuel ou ≥ 18 px seulement** (filets, graduation) |
| filet | blanc à 12 % | — | séparations d'un pixel |
| vivant (vert signal) | #37C871 | 8,7 : 1 | en cours, posé |
| attention (ambre) | #E8A93B | 9 : 1 | pause, différés, pause demandée |
| alerte (brique) | #F0665A | 5,7 : 1 | à toi, interrompu, ESV muet |
| focus | encre, anneau 2 px | — | clavier |

Pour Carnet (clair) : papier #E9E6DF, encre #16171A, bleu encre #1F4FD8 (4,6 : 1 sur papier, utilisable en texte ≥ 15 px gras et en fond de bouton avec texte papier 8 : 1), vert mousse #2E7D4F, ocre #9A6A12, brique #B2362A ; tous ≥ 4,5 : 1 sur le papier.

### 6.2 Échelle typographique

| Nom | Taille / interligne | Graisse | Emploi |
|---|---|---|---|
| chiffre | 44 / 48 | 500, tabulaire | le grand nombre de l'instrument |
| état | 28 / 32 | 500 | le mot d'état |
| texte | 15 / 22 | 400 | phrase d'état, lignes du tiroir |
| méta | 13 / 18 | 400 ou 500 | étiquettes, raisons, compteurs secondaires |
| mono | 15 / 22 et 13 / 18 | 500 | numéros de cuts, écarts en mm |

Sur l'instrument : chiffre, état, texte seulement. Méta n'apparaît que dans le tiroir, la bande cache et la feuille. Chiffres tabulaires activés partout ; jamais de lettres resserrées en dessous de 28 px.

### 6.3 Espacements, rayons, ombres

- **Espacements** (base 4) : 4, 8, 12, 16, 24, 32, 48. Instrument : 48 de marge, 24 entre groupes. Tiroir : 16 de marge, lignes de 36 px, 12 entre colonnes. Rien en dehors de cette liste.
- **Rayons** : 6 (contrôles), 10 (tiroir, feuille, boîtes). Puce d'onglet : pleine (999). Rien d'autre.
- **Ombres** : aucune sur l'instrument. Tiroir : bord haut d'un pixel en filet. Feuille et boîtes : 0 8 24 à 40 % de noir (Signal) ou 0 1 2 à 8 % d'encre (Carnet). Jamais sur du texte.
- **Épaisseurs** : filets 1 px ; rail 2 px, segment traité 4 px ; glyphes 1,75 px.

### 6.4 Mouvement

| Nom | Durée | Courbe | Emploi |
|---|---|---|---|
| appui | 120 ms | sortie douce | bouton pressé (échelle 0,98) |
| local | 200 ms | sortie douce | couleur du glyphe, texte qui change, carré de trame |
| glisse | 280 ms | sortie douce | tiroir, feuille, palette |
| scène | 400 ms | entrée-sortie | bascule Orbite ↔ Écho (fondu croisé du contenu, instrument fixe) |
| vivant | 2 000 ms | sinusoïde | pulsation du glyphe « en cours », seule boucle |

Courbe de sortie douce : départ rapide, arrivée lente, sans dépassement. Mouvement réduit demandé par le système : toutes les durées à 0, la boucle « vivant » remplacée par un glyphe fixe.

### 6.5 Composants et leurs états

| Composant | États | Règles |
|---|---|---|
| **Bouton principal** | repos · survol · appui · focus · occupé (anneau tournant, libellé « Pause demandée… ») · désactivé avec raison (texte dessous) · danger (Arrêter, Passer : jamais principal) | hauteur 44, pleine largeur du groupe, un seul par écran ; le libellé dit l'effet (« Reprendre au cut 4813 ») |
| **Action secondaire** | repos · survol · focus · désactivé | texte souligné à l'appui seulement, jamais une deuxième pilule |
| **Ligne d'état** | prêt · en cours · pause demandée · en pause · à toi · interrompu · terminé · arrêté · relecture (× pause / F5) · verrouillé (deuxième passe) · hors ligne | glyphe + mot + phrase ; annoncée en « aria-live poli » ; l'incident en « alerte » |
| **Rail / trame** | vide (prêt) · en cours avec curseur · pause (curseur fixe) · incident (repère brique au cut) · total inconnu · terminé · relecture · Écho (marques de visites) | étiquette lisible complète en texte sous l'objet ; jamais le seul porteur d'une information |
| **Bloc incident** | rail non résolu · confiance basse · ESV muet entre deux cuts · opération interrompue · repris à la main | remplace l'objet, pas l'état ; une phrase, une ligne « opération interrompue » si elle existe, les actions ; reste jusqu'à clôture |
| **Trois lignes de fin** | avec reste · sans reste · export fait · export à faire | jamais une coche seule ; « Voir ce qui reste » devant l'export s'il reste quelque chose |
| **Tiroir** | fermé (poignée seule) · ouvert · vide (« Aucun différé pour l'instant ») · défilable | poignée toujours visible avec le compte ; Échap ferme ; l'instrument ne bouge pas |
| **Liste** | ligne · ligne sélectionnée (clavier) · ligne vide · en-tête de colonne | numéro de cut en mono, motif en texte, précision en méta ; différés et verts dans deux sections nommées, jamais mélangés |
| **Puce d'onglet ESV** | connecté · libre (attend, pulse une fois) · pris / verrouillé (cadenas, raison) · ne répond plus (brique) · aucun onglet | un clic ouvre la liste ; connecter = choisir ; verrouillée pendant un lot |
| **Bande cache** | disponible (quantité, bouton) · indisponible (raison en méta, bouton grisé) · confirmation (supprimé / gardé / avertissement) · vidé (ligne de confirmation 3 s) | même place dans Orbite et Écho ; la confirmation est celle du panneau d'origine |
| **Palette** | ouverte vide (4 commandes du moment) · résultats (7 au plus) · aucun résultat · commande grisée avec raison · état en petit à droite | Entrée exécute, ↑ ↓ choisissent, Échap et Ctrl K ferment ; jamais une commande grisée exécutée |
| **Feuille réglages** | ouverte · ligne modifiée (valeur gardée pour le prochain lot, dit en méta) · zone dangereuse | 7 lignes, Échap ferme, aucune en séance |
| **Bandeau ESV** | la phrase d'état · raison collante en Écho | une ligne, aucun bouton, allumé par défaut |

### 6.6 Accessibilité

- Contrastes AA (4,5 : 1 texte, 3 : 1 grands textes et graphiques) tenus par les tableaux ci-dessus ; encre-3 jamais en texte courant.
- Clavier complet : Tab dans l'ordre visuel ; Entrée ou Espace sur l'action principale ; Échap ferme tiroir, feuille, palette, confirmations ; Ctrl K ouvre la palette ; ↑ ↓ dans les listes ; le focus n'est jamais perdu au rafraîchissement (le panneau redessine toutes les deux secondes : le focus et le défilement sont conservés, comme le fait déjà l'habillage actuel).
- Focus visible : anneau de 2 px en encre, décalé de 2 px.
- Cibles : 32 × 32 px au moins, 44 pour le bouton principal.
- Rien par la couleur seule : glyphes par état, formes dans la trame, texte complet sous le rail.
- Mouvement réduit : respecté partout ; aucune information portée par une animation.
- Textes ≥ 13 px ; phrases courtes, français simple, pas d'abréviation hors « mm » et « Mo ».

---

## 7. Plan de test d'utilisabilité : cinq tâches chronométrées

Conditions : une fenêtre Ariane en 600 × 760 à côté d'ESV (une partie d'essai ou une page simulée), écran et siège habituels de l'opérateur, enregistrement d'écran, l'opérateur pense à voix haute. Un observateur ne dit rien tant que l'opérateur n'est pas bloqué 30 s. À refaire une semaine plus tard avec les mêmes tâches pour mesurer l'apprentissage.

| # | Tâche | Point de départ | Réussite | Échec |
|---|---|---|---|---|
| 1 | **Connecter et démarrer** : « lance un lot jusqu'à la fin de la partie » | deux onglets ESV ouverts, aucun connecté | ≤ 3 clics, ≤ 20 s, bon onglet choisi | cherche dans Réglages ; démarre sur le mauvais onglet |
| 2 | **Lire et suspendre** : « sans montrer l'écran, dis où en est le lot ; puis mets en pause et reprends » | lot en cours depuis 2 min | état, traités et différés dits justes en ≤ 5 s ; Pause 1 clic ; Reprendre 1 clic | lit un chiffre faux ; cherche le bouton |
| 3 | **Incident** : « Ariane s'est arrêtée, décide » | rail droit non résolu au cut 4838 | une décision prise en ≤ 20 s après lecture, 1 clic (2 si Passer), aucun clic erroné | clique Arrêter par erreur ; ne comprend pas quel rail |
| 4 | **Fin de lot** : « termine : regarde ce qui reste, exporte, puis vide le cache » | lot terminé, 11 différés, 9 verts, export non fait | ouvre le tiroir en 1 clic, distingue différés et verts sans aide, export 1 clic, cache 2 clics et dit pourquoi il était grisé avant | mélange différés et verts ; tente le cache avant l'export sans comprendre le refus |
| 5 | **Écho et palette** : « passe en Écho, démarre, termine ; puis, au clavier seulement, mets un lot en pause » | lot terminé, Écho disponible | bascule 1 clic, Démarrer 1, Terminer 1 ; palette : Ctrl K, Entrée, ≤ 6 s | ne trouve pas la bascule verrouillée ; ne trouve pas Ctrl K |

**Critères globaux de réussite** : 5 tâches sur 5 dans les temps ; au plus 1 clic erroné sur l'ensemble ; à la question « que fait Ariane en ce moment ? », posée trois fois à des moments différents, trois réponses justes ; et trois questions de ressenti notées de 1 à 5 : « clair », « rapide », « j'aimerais m'en servir tous les jours », chacune ≥ 4. Pour le style, une seule question, posée sur les deux directions à taille réelle : « laquelle montrerais-tu à un collègue, et qu'est-ce qui te plaît ou te gêne dedans ? ». La réponse est notée mot pour mot.

---

## 8. Ce qu'il me faudrait, et ce que je ne peux pas juger

**Pour passer au niveau supérieur (liste courte, justifiée) :**
1. **Une capture d'ESV à taille réelle et la disposition des fenêtres de l'opérateur** (résolution, un ou deux écrans, où est Ariane) : sans ça, la taille 600 × 760, le choix sombre / clair et l'objet d'avancement sont des paris.
2. **Vingt minutes d'enregistrement d'une vraie séance** (écran + voix) : pour savoir où l'opérateur regarde pendant le lot (le panneau, le bandeau, ESV) et ce qu'il lit vraiment.
3. **Trois références « premium » de l'opérateur, avec une phrase sur ce qu'il y regarde** (matière, mouvement, lettres, chiffres), plutôt que des noms de produits : c'est ce qui manque pour trancher entre Signal et Carnet.
4. **Le droit d'embarquer deux polices libres de plus** (IBM Plex ou Bricolage Grotesque, licence OFL, fichiers locaux) et un outil de sous-ensemble pour les alléger : les polices actuelles suffisent pour un essai, pas pour la direction finale.
5. **Une heure de l'opérateur** pour le plan de test du § 7, sur les maquettes à taille réelle dans la vraie fenêtre, pas dans une page de démonstration.
6. **Une décision de la session principale** sur le nom et les états de la deuxième passe, et sur l'existence future de « ouvrir le cut » et « examiné » dans la Revue : le tiroir n'est pas le même selon qu'il est une liste à lire ou une surface de travail.

**Ce que je ne peux pas juger sans les yeux de l'opérateur :** le gris du papier et la luminosité du graphite sur son écran ; si Bricolage Grotesque lui plaît ou l'agace ; si un panneau clair à côté d'ESV sombre le fatigue ; si le rail (ligne) ou la trame (carrés) est plus parlant pour lui après une heure ; si le son d'incident est acceptable dans son environnement ; si « Voir ce qui reste » est le bon mot ; et surtout si, une fois la décoration retirée, il trouve l'objet assez beau pour avoir envie de l'ouvrir. Aucune maquette ne répond à cette dernière question : seule une version à taille réelle, essayée pendant quelques jours, le peut.
