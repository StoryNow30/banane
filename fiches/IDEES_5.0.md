# Idées et angles morts pour la 5.0 — première récolte (15 octobre 2026)

Statut : **notes pour le cahier 5.0**, pas une spécification. Deux angles de recherche sur six ont été menés à terme (« cerveau et géométrie », « surface d'ESV ») ; les quatre autres (données et apprentissage, métier, fiabilité, regard extérieur) ont été arrêtés pour économiser le budget de jetons et pourront être relancés. Chaque constat ci-dessous s'appuie sur le code 4.9.5.1 (fichier:ligne) ou sur les quatre exports de terrain des tests 15 à 17 (parties 24, 25, 26, 27 ; 399 différés joints au diagnostic GCV1). Aucune donnée de partie ni identifiant de projet ici.

Priorités de Mic (D-112) : (A) poser juste plus souvent ; (B) traiter seul les zones difficiles ; (D) apprendre des corrections Écho.

## 1. D'où viennent les différés aujourd'hui (4 lots 4.9, 399 différés)

| Cause | Part | Preuve |
|---|---:|---|
| Un rail sans point de flanc, dessus riche (37 à 44 lignes) | 114 (29 %) | porte `src/geometry-candidate-v1.js:219` (`!face||faceCount<minFace`), flanc partiel ≥ 3 points (l. 203), `lot-decision.js:510 minFace:3` ; dans 212 des 235 rails abstenus pour flanc, le rail opposé est candidat |
| Pente du flanc « hors domaine » estimée librement sur 7 à 11 points | 70 (18 %) | `robustLine` (`geometry-candidate-v1.js:12-21`) ; le delta publié est la graine du gabarit (l. 231), la pente ne sert qu'à refuser ; D-035 : 6/7 jugés justes |
| Garde de paire (D-044) : décalage de convention entre 8 et 12 mm | 79 (20 %) | `lot-decision.js:619-626`, `placement-convention.js:417 maxShiftMm:8` ; 107 décalages relevés : médiane 9,2 mm, max 12,1 mm ; garde justifiée à l'origine par 2 cuts |
| Paire hors contrat avec deux candidats, ambiguïté | 19 + 22 | `gcv1-shadow.js:467-499` : rails résolus séparément, paire seulement contrôlée ; KI-032, KI-037 (ADV, contre-rail) |
| Sans appui (`no-anchor`) | 326 sur 470 | B1 en ombre aurait décidé sur 239 (51 %), justesse non mesurée |

Densité : 78 à 94 points par tête de rail quelle que soit l'issue (≈ 40 sur le dessus, 0 à 10 sur le flanc). Le lecteur ne lit que les nœuds déjà chargés pour la vue (`vendor/lidar.js:178`) ; profondeur LOD et `viewer.getPointBudget()` jamais consignés : famine du nuage ou du niveau de détail, on ne sait pas.

## 2. Idées à mettre en avant

### Pour A (poser juste plus souvent)

1. **Rail « dessus seul »** (5 j, nouveau). Poser le rail sans flanc par le bord intérieur de la bande du dessus (largeur du gabarit connue, 64 mm), vertical au 90e centile ; trois preuves obligatoires : dévers cohérent avec le rail opposé résolu (|Δz| ≤ 15 mm), écartement admissible 1420–1470, écart à la voie ≤ 30 mm s'il y a des appuis ; statut publié distinct (`dessus-seul`). Jamais au passage à niveau. Jusqu'à −29 % de différés. D'abord hors ligne sur l'Écho 17 (66 rails différés, D-098) et les 4 lots au banc.
2. **Pente du flanc fixée au gabarit** (3 j, nouveau). Ne plus ajuster une pente libre : pente U50 connue, on n'estime que l'ordonnée ; la porte `slopeLimited` devient une pénalité de confiance quand le dessus a ≥ 30 points. Jusqu'à −18 % de différés ; garder la porte au PN. Par l'enveloppe GCV1, pas par `geometry.js` (gelé).
3. **Garde de paire tranchée par la mesure** (1,5 j, nouveau). Joindre les cuts `pair-guard` à la pose humaine Écho : si la correction humaine est < 10 mm, porter le domaine du calage à 12 mm et ne faire porter la garde que sur le rail repêché ; sinon la garde est bonne et on le sait. Jusqu'à −20 % de différés, ou une preuve qu'on n'a pas.
4. **Première passe amorcée par la voie** (2 j). Avec ≥ 2 appuis cohérents, lancer le moteur deux fois (pose ESV, prédiction de la voie) ; accord ≤ 15 mm → pose ; désaccord → différé avec les deux. Vise les faux à décalage commun (KI-042) que la garde d'écartement ne voit pas. +0,15 s par cut.
5. **Calibrer T (monde ↔ scène) dès le premier cut** (1 j, nouveau). Fait mesuré : la ligne N de la liste porte exactement la pose de départ du cut N (0,0 mm sur 2 268 cuts, 4 parties). T se mesure donc sans attendre une écriture ; B1 et l'interpolation deviennent disponibles sur 100 % des cuts, y compris les ~20 premiers d'un lot de reprise après F5 (aujourd'hui aveugles).
6. **Budget de points Potree pendant la capture** (2 j, nouveau). Consigner profondeur LOD et budget ; au banc B, doubler le budget pendant la seule capture et compter les points de flanc gagnés. Si net : pièce du mode rapide, réversible. Jamais en Écho.

### Pour B (zones difficiles)

7. **Carte de la partie avant le lot** (2,5 à 3 j). La liste GET déjà interceptée porte pour chaque ligne `RailSpacing`, `TrajAzimuth`, `RailType`, `Success*` ; l'observateur les jette (`src/esv-observer.js:130-141`). Un passage en mémoire de page : dérive d'écartement (ADV candidat ≥ 1 460), séries de rouges avec marge ±2, courbure, profil hors U50 annoncé, verts « suspects » (écart à l'interpolation de leurs voisins ±3). Sortie : des drapeaux par numéro de cut, rien d'autre. Fait mesuré : les voisins ±5 des cuts traités sont invalides à 26 % contre 5,5 % dans la partie (un rouge est 5 fois plus souvent près d'un rouge) ; sur la partie 24, 25 verts d'extraction sont rejetés par la garde de cohérence dans toutes leurs fenêtres.
8. **Recherche de couple pour les ADV et contre-rails** (4 j, nouveau). Quand la paire est hors contrat ou un rail ambigu : énumérer les couples (minimum local gauche × droit), ne garder que les couples STRONG, écartement admissible, ≤ 30 mm de la voie ; un seul → pose ; plusieurs → différé avec les couples consignés. « ADV probable » quand un rail a ≥ 2 cellules STRONG distinctes.
9. **Provenance des appuis** (1,5 à 2 j, nouveau). B1 prend tout `valid` pour appui (`src/appuis-liste.js:34-40`). Mesuré : 77 à 87 % des appuis sont des verts d'extraction jamais vus par un humain ; le reste, des poses d'Ariane de la séance ; voisins validés par un humain : 0 à 72 lignes sur 5 000. Trois classes : extraction / Ariane (séance ou antérieur) / humain. Jamais chaîner sur ses propres poses non vérifiées ; en zone à risque, appuis humains seulement ; verts d'extraction voisins d'un rouge = cuts à revérifier (règle de Mic).
10. **Seconde passe = autre algorithme** (3 j). D-109 : la reprise des différés en a re-différé 66 sur 68, car la mémoire des appuis meurt avec le lot et `sameTrack` exige le même `frameId` (perdu au F5). Mémoire par partie des cuts posés en coordonnées monde ; voie encadrée des deux côtés (±3 cuts, D-099) ; relancer le moteur depuis la prédiction, interpolation seulement s'il s'abstient encore.
11. **Plan de lot depuis la liste** (2 j). La page rend les indices invalides de la partie (≈ 500 nombres) : dernier invalide certain (plus d'arithmétique de compteur, KI-069), progression exacte, séries connues, seconde passe automatique proposée en fin de lot.

### Pour D (apprendre)

12. **GCV2 = classeur de cellules du pool** (10 j, déjà prévu, forme précisée). 111 des 235 rails abstenus pour flanc ont une cellule STRONG écartée seulement par la porte `RATIO=1.5` (`gcv1-shadow.js:30`) ; 33 % des rails appliqués ont une confiance < 55 (KI-033). Score de justesse appris sur l'Écho à partir des traits déjà exportés ; remplace la porte RATIO et la confiance ; abstention calibrée sur la courbe faux verts / différés ; partition par partie.
13. **Relevé de la liste après la correction humaine** (2 j, nouveau). ESV réécrit la ligne à chaque validation ; la liste relue après le passage de Mic porte la pose finale de tous les cuts posés. Jointure avec l'export Orbite → écart humain par rail pour 100 % des cuts, sans dépendre des angles morts d'Écho (corpus 3 à 4 fois plus grand, dénominateur des faux verts enfin connu). Exige l'accord de Mic (bords monde dans un export) et un protocole de relecture complète.
14. **Écouter `railPairUpdated` d'ESV** (2 j, nouveau). ESV émet `railPairUpdated('valid'|'skipped')`, `railPairSeen`, `railPairSelected`, `loading`, `newPart` sur `#globalcontainer` (relevé B) ; personne ne les écoute. Écho n'a plus à deviner la décision aux touches (AM-01, 02, 15, 18 réglés à la source) ; Orbite reçoit une preuve de décision indépendante de la navigation.

### Socle et sécurité

15. **`newPart` et `loading` comme signaux** (1,5 j, nouveau) : fin de partie immédiate et sûre ; `loading` comme troisième règle du signal de fin de chargement, d'abord en ombre à côté de D-109.
16. **Potree : compter les nœuds en échec** (2 j, nouveau). Hypothèse pour D-109 : un nœud dont le chargement échoue reste `loading` pour toujours, `numNodesLoading` ne redescend plus, et au-delà de `maxNodesLoading` (4) Potree ne charge plus rien. Vérifiable en une ligne (`responseStatus` des ressources ept-data, `esv-observer.js:310`) ; puis prédicat par nœud (bloqué depuis > 60 s → avis « F5 au prochain différé »).
17. **Empreinte du contrat ESV à la connexion** (0,5 j, nouveau) : boutons, classes, écouteurs, champs de liste, versions jQuery/Potree ; différence → avis avant tout lot.

## 3. Angles morts du côté d'ESV (faits)

- **Appariement cut ↔ ligne** : établi (0,0 mm sur 2 268 cuts). À clore dans FICHE_B1.
- **Deux écritures refusées ont déjà eu lieu sur le terrain** : partie 25 (test 16), deux validations en HTTP 502 (cuts 760 et 770) ; ESV a relancé seul à +415 et +468 ms et obtenu 204 ; Ariane a accepté les deux sans rien voir. **D-110 (« jamais vu sur 924 écritures ») est à corriger : 2 refus sur 3 530 écritures observées.** La fenêtre de 2 s du correctif D3 (4.9.5.1) tolère cette relance.
- **ESV écrit `SeenByOperator:true` à chaque cut chargé** (515/515, 824/824, 370/370 ; rowIndex = cut) : les cuts différés par Ariane sont marqués « vus par un opérateur » dans la base ; et cette écriture est une preuve serveur de navigation que les différés n'exploitent pas (`serverConfirmed:false` sur 100 % des différés).
- **Ariane écrit `TreatedByOperator:true`** dans ses validations : dans ESV, une pose d'Ariane est indiscernable d'une pose humaine. À dire à Mic et à ses collègues ; décision à prendre sur une marque.
- **ESV demande après chaque validation « reste-t-il des invalides ? » avec un projet `undefined`** (410/410 réponses vides) : il ne le sait pas lui-même ; cause plausible du saut à la partie suivante au dernier cut (KI-069). Ne rien attendre de ce contrôle.
- **Champs de liste jetés** : `RailSpacing`, `TrajAzimuth`, `RailType`, `Success*`, `PK` ; `Success*` n'a jamais été relevé (2 minutes de relevé de Mic).
- **Événements jQuery jamais écoutés** (voir idées 14 et 15).
- **Potree** : ~3 nœuds et 1,1 Mo par cut ; statut HTTP et durée des chargements non relevés ; `fetch` non enveloppé (`esv-observer.js:15`) : une mise à jour d'ESV passant par fetch rendrait D3 et B1 muets sans erreur visible (le compteur `fetch-rails` doit lever un avis s'il devient non nul).
- Le compteur « N on M treated » a été lisible 515/515 fois, « M cuts » jamais vu : la regex `TOTAL_CUTS` et le cas « plusieurs compteurs » n'ont jamais servi ; M = nombre de cuts de la partie confirmé sur quatre parties.

## 4. Questions à Mic (qui changent une décision)

1. Relevé de 2 minutes sur le vrai ESV (outil existant, lecture seule) : valeurs de `Success*`, `RailSpacing` et `RailType` sur quelques lignes valides et invalides.
2. Trace dans ESV : accepter que les cuts différés soient marqués « vus » et les poses d'Ariane « traitées par l'opérateur », ou vouloir une marque distincte ?
3. Export d'un relevé de liste (bords monde par cut) pour la vérité terrain hors Écho (idée 13) : oui / non ?

## 5. Socle 4.9.5 nécessaire avant la 5.0

Écho parfait (quatre étapes de l'audit, D-112), banc ESV locale (maquette dans `banane`, banc B privé sauvé), diagnostic du signal (4.9.5.1), D3, jointure Écho ↔ Orbite par cut, exports Orbite conservés par Mic (D-097), B1 consignant sa pose proposée (D-102 point 3), calibration T dès le premier cut (idée 5, petite et sûre).
