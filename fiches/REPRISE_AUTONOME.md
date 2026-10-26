# Protocole de reprise autonome (nuit du 15 au 16 octobre 2026 et suivantes)

Demande de l'opérateur (D-124) : avancer sur tous les chantiers possibles pendant son absence et relancer automatiquement la session après chaque réinitialisation de sa fenêtre de 5 h. Ce fichier est relu à chaque réveil ; il remplace la mémoire de la conversation.

## À chaque réveil, dans l'ordre

1. **Programmer le réveil suivant d'abord** : `send_later` à maintenant + 5 h 05, avec le même message de réveil. Ainsi, si la limite tombe pendant le travail, la reprise est déjà assurée.
2. **Lire l'état** : `fiches/PLAN_5.0.md` (colonne État), fin de `DECISIONS.md`, `git fetch` et `git log` des branches `origin/claude/50-*` et `origin/claude/495-*` depuis le dernier réveil.
3. **Recueillir** les chantiers livrés : vérifier le rapport (porte de sortie, verify 0 échec, rien sous `src/engine.js`), les fusionner dans `claude/50-base` (fusion simple, essais ciblés), mettre à jour le plan (coût constaté, état), consigner une ligne dans `DECISIONS.md`.
4. **Relancer** un chantier mort à cause de la limite (agent sans rapport) depuis sa branche, avec le même brief.
5. **Lancer** les chantiers suivants du plan dont les entrées sont prêtes : un lourd et un léger au plus, briefs complets, niveau rapide par défaut (éclair pour le mécanique, fort seulement pour une relecture due), base `claude/50-base`.
6. **Ne pas dépasser 60 %** de la fenêtre ; garder 20 % pour un export de l'opérateur s'il arrive.
7. **Écrire à l'opérateur** un compte rendu de cinq lignes au plus en fin de réveil (ce qui est livré, ce qui tourne, ce qui attend de lui).

## Arrêt

- L'opérateur écrit : le protocole s'arrête, on reprend en conversation.
- Deux réveils de suite sans rien à recueillir ni à lancer : ne plus programmer de réveil, le dire à l'opérateur en une ligne.
- Jamais sans l'opérateur : fusion dans `main`, étiquette, publication, activation d'une pose sur le terrain, modification de `src/engine.js`.

## Ce qui attend l'opérateur (ne pas bloquer dessus)

- Numéros de cuts d'un ADV et d'un PN connus (Q3).
- Volumes de l'Écho partie 24 des tests 19/20 (Q5).
- Lot Orbite et Écho d'un second projet ESV (D-123).
- Exports de la séance 4.9.5 test 2.
- Séance 4.9.5 test 3 (paquet envoyé, D-127) et ses exports.

## À intégrer au prochain numéro de test

- Logo retenu par l'opérateur (piste A « La voie ») : commit a426771 sur `claude/ux-variantes`. Prendre `icons/` (`git checkout a426771 -- icons/`), puis déclarer dans `manifest.json` `"icons": {"16":"icons/ariane-16.png","32":"icons/ariane-32.png","48":"icons/ariane-48.png","128":"icons/ariane-128.png"}` et la même liste sous `action.default_icon`. Fait : intégré à la 4.9.5 test 3 (D-127).

## Prochain réveil (après D-129)

- Lourd : **P1 plafond de convention à 8 mm** (`claude/50-p1-convention` depuis `claude/50-base`) : `src/placement-convention.js` seulement (jamais `src/engine.js`), décalage plafonné, reste consigné ; essais ; rejeu des quatre lots au banc (`fiches/P0_MESURES.md`) sans régression ; relecteur indépendant. Rien n'est activé au terrain sans l'opérateur.
- Léger : corriger AUDIT_SUPER_CERVEAU § 1 avec les chiffres de P0 (a).

## Prochain réveil (après D-130)

- Lourd : **P1 bis, plafond vertical seulement** (`claude/50-p1-vertical` depuis `claude/50-base`) : même réglage coupé par défaut, plafond appliqué à l'axe vertical seulement, latéral refusé comme avant ; rejeu `tools/p1-plafond.cjs` identique ; vérifier le cut de passage à niveau de la partie 27 et le ricochet ; reprendre `capped`/`rest*` dans le journal compact si c'est hors `src/engine.js`.
- Léger : S4 maquette ESV dans verify, étape 1 (inventaire de `claude/esv-locale-audit`, plan d'intégration court).

## Nuit du 16 au 17 octobre 2026 (D-155) : gros moyens

L'opérateur : « profite de la nuit pour lancer des gros programmes », niveaux forts quand c'est utile, relance après chaque réinitialisation comme la nuit d'avant. Beaucoup de crédits restent avant la réinitialisation hebdomadaire du dimanche. Les règles 5 et 6 ci-dessus sont donc assouplies cette nuit :
- jusqu'à **4 chantiers lourds** en même temps, au niveau fort par défaut pour la conception et le code, et au niveau maximal pour les relectures avant livraison ;
- pas de plafond de 60 % de la fenêtre ;
- garder le verrou `wt/lourd.lock` et `nice` : la machine sature au-delà de 4 rejeux.

**Cap fixé par l'opérateur** : l'autonomie d'Ariane en appliquant les règles métier. On ne dépend pas des corrections de l'opérateur pendant le lot (D-155).

**Vague 1** (lancée le 16 au soir) :
1. `claude/50-deplacer-vue` (fort) : relevés sur la maquette ESV (`claude/esv-locale-audit`), pièce `amenerDansLaVue` coupée par défaut, et dans l'Écho le relevé des glissers de l'opérateur (longueur, durée, caméra).
2. `claude/50-regles-metier` (fort) : règles métier de l'opérateur en ombre puis prêtes à activer (PN : contrôler chaque cut ; écartement proche de 1 435 ; marges PN et ADV), rejouées sur toutes les parties, avec chiffres.
3. `claude/50-faux-verts` (fort) : détecteur des faux verts près des rouges, des PN et des aiguilles (M1 et M5), avec chiffres par partie, et ce qu'Ariane ferait de différent.
4. `claude/50-bruit-reference` (rapide) : bruit de la référence de l'opérateur, mesuré sur les données existantes (validations doubles, recoupements avec le débutant).

**Vague 2** (au réveil suivant, quand la vague 1 est rentrée) :
- **4.9.5 test 5** : base 5.0, ombres, relevé des glissers, règles métier **en ombre**, avec paquet et consigne ;
- **relecture au niveau maximal** du diff de la test 5 avant de l'envoyer à l'opérateur ;
- **cahier v1.1** : proposition de porte pour l'opérateur (« jamais la mauvaise voie et pas plus de faux qu'Orbite aujourd'hui, en ombre sur parties neuves ») et autres amendements de l'audit (I7).

**État au 17 octobre, 0 h** : la vague 1 est rentrée et fusionnée (D-156 à D-160), verify complet vert (2 006). Également faits : la mesure du clic hors vue (D-157, décision à l'opérateur) et le bruit de la référence (D-158).

**Vague 2 lancée** :
- `claude/50-hauteur-apprise` (fort) : correction de hauteur en ombre ; 70 des 85 faux verts viennent de la hauteur ;
- `claude/50-verts-a-controler` (fort) : liste des verts à contrôler, dans le panneau et l'export, sans aucune action dans ESV ;
- cahier v1.1 (fort) : brouillon hors dépôt, `cahier11/CAHIER_5.0_v1.1.md`, à soumettre à l'opérateur.

**Vague 3** (quand la vague 2 est rentrée) :
- **test 5** depuis `claude/50-base` : version 4.9.5.5, consigne, paquet ;
- relecture au niveau maximal avant de l'envoyer à l'opérateur.

**État au 17 octobre, vers 2 h** :
- vagues 2 et 3 rentrées : D-161 (hauteur apprise), D-162 (liste des verts), D-163 (test 5 relue et envoyée à l'opérateur) ;
- le cahier v1.1 est envoyé à l'opérateur, hors dépôt, dans `cahier11/` ; à verser au dépôt après son accord.

**Vague 4 lancée** :
- `claude/50-rapide-humain` (fort) : réglage `rapide.clicHumain`, `'tel-quel'` par défaut, plus le relevé `clic-hors-vue`, mesuré au banc ;
- `claude/50-detection-adv` (fort) : étude de détection des ADV, puis ombre et branchement sur la liste des verts si elle tient ;
- `claude/50-utiles-t6` (rapide) : les points utiles de la relecture de la test 5.

**Au prochain réveil** :
- recueillir la vague 4 et la fusionner dans `claude/50-base` ;
- rien ne part au terrain avant le retour de l'opérateur sur la test 5 et ses décisions : D-157 et cahier v1.1.

**État au 17 octobre, vers 9 h** :
- le conteneur a redémarré dans la nuit ;
- la vague 4 est récupérée et intégrée (D-164) ;
- 65 anciens worktrees sont supprimés : le disque était presque plein ;
- L'opérateur veut essayer les deux méthodes du clic : la **test 6** est lancée (`claude/495-test-6`), avec le choix du clic dans le panneau.

**Ensuite** : relecture de la test 6 au niveau maximal, puis envoi à l'opérateur avec son empreinte.

**État au 17 octobre, vers 10 h 30** (avant compactage) :
- test 6 au terrain : parties 8 et 9 archivées (D-166, D-167) ;
- lot des parties 2 à 7 analysé, prédictions scellées (D-169) ;
- recadrage de l'opérateur (D-170) : la 5.0 doit faire elle-même la relecture qu'il fait en Écho ;
- accord pour visiter les verts sans modifier (D-171).

**En cours** :
- `claude/50-zones-autonomes` : étude élargie à toute la relecture, fiche `RELECTURE_AUTONOME.md`. Chiffre central : la part des corrections de l'opérateur reproduite seule, face aux cuts abîmés ;
- `claude/50-relecture-ombre` : passe de relecture en ombre de fin de lot (visite, calcul, note, aucune modification), case coupée par défaut.

**Ensuite** :
- relire et fusionner les deux chantiers ;
- **test 7**, avec : la relecture en ombre ; le libellé de la case grappe corrigé (« série de différés », pas « aiguille ») ; l'état du dernier lot affiché clairement ; un message quand il ne reste rien à faire dans la partie ;
- relecture au niveau maximal, puis envoi.

**Réponse de l'opérateur (D-172)** : SKIP seulement si aucun point ne s'affiche ou si un seul scanner s'affiche ; sinon visiter et corriger, cuts 0 à 3 compris. À faire : détection SKIP en ombre, mesurée contre les SKIP de l'opérateur.

**17 octobre, 10 h 40 (D-173)** : la test 7 attend une avancée réelle : règles métier qui agissent, chiffrées et jugées sur parties réservées, plus un panneau réorganisé (`claude/50-panneau-t7`, élargi). Ne pas fabriquer la test 7 avant.

**17 octobre, 13 h 05 UTC** : 83 % de la fenêtre est consommée ; elle se réinitialise vers 16 h 40 UTC.
- **Atelier P-7 arrêté exprès** pour économiser. Son diagnostic est fini : `scratchpad/p7/CATALOGUE.md`.
- **À la reprise**, relancer :
  ```
  Workflow({scriptPath: "<scratchpad>/workflows/scripts/p7-pose-adv-grappes-wf_56d882aa-e4e.js", resumeFromRunId: "wf_7d519878-737"})
  ```
  Le diagnostic reviendra du cache, si c'est la même session.
- **Tournent encore** : la revue de la relecture, le départ sur un vert et le PN robuste.

**17 octobre, 13 h 30 UTC (D-175)** : la fenêtre est presque épuisée. On attend la réinitialisation, vers 16 h 40 UTC, avant de lancer le reste.

**Fusionnés dans 50-base (d8a7bcd)** :
- panneau réorganisé ;
- partie complète ;
- départ sur un cut vert ;
- fiabilité du lot ;
- PN robuste (H6).

**Au réveil suivant, dans l'ordre** :
1. **Chantier de correction de la relecture** sur `claude/50-relecture-ombre`. Fusionner d'abord `origin/claude/50-base`, puis appliquer les 11 corrections exigées de `scratchpad/revrelo/SYNTHESE_REVUE.md` § 2 :
   - rôle vert prouvé par le statut `valid` ;
   - une seule passe à la fois ;
   - pose seulement après un pas par les boutons ;
   - validation par Maj+Espace (geste de l'opérateur), sinon « corriger » reste verrouillé ;
   - réglages sûrs en cas d'échec ;
   - essai de `validateInPlaceEcriture` ;
   - plafond par zone, PN d'abord ;
   - chaîne vide, comme l'étude ;
   - « vu » dit clairement, avec un compteur ;
   - pas de pauses, départ automatique juste après le lot sans compte à rebours, seul le bouton d'arrêt reste (D-176) ;
   - lectures de nuage mesurées.

   Ensuite, une contre-revue courte, puis la fusion.
2. **Atelier P-7** : reprendre avec `Workflow({scriptPath: ".../p7-pose-adv-grappes-wf_56d882aa-e4e.js", resumeFromRunId: "wf_7d519878-737"})`. Le diagnostic est fait (`scratchpad/p7/CATALOGUE.md`). Si la reprise depuis le cache échoue, relancer le script : le diagnostic relira `p7/`.
3. **Verify complet au calme** sur 50-base, puis **test 7** si la relecture est fusionnée.

**Après la test 7 (D-176)** : chantier « relecture au fil du lot ». La même logique s'applique pendant le lot, en visitant les cuts voisins d'un PN, d'une ADV ou d'un rouge isolé. On la compare à la passe de fin de lot.

**D-178** : le niveau le plus fort est interdit jusqu'à la dernière session de 5 h qui précède la réinitialisation hebdomadaire, le dimanche 18 octobre à 22 h. Ne jamais passer un agent du niveau le plus fort avant cette session.

## Matin du 18 octobre 2026 (D-179 à D-183) : test 7 construite, relecture finale en cours

**Fait** :
- Maj+Espace valide un vert sur place (l'opérateur, D-179) ; la passe est corrigée.
- L'ADV et les abords agissent en mode « corriger », défaut coupé (D-180).
- Quota presque épuisé, le niveau rapide, travail resserré (D-181).
- P-7 terminée, la combinaison reste en ombre (D-182).
- Contre-revue de la relecture : 3 défauts démontrés et corrigés (statut du cut relu avant la pose, table de la liste incomplète refusée, vert hors zone jamais corrigé), `claude/50-relecture-ombre` à da1d9bd.
- Fusion dans `claude/50-base` (803fb76) ; version 4.9.5.7 ; verify complet : 2 221 essais, 2 219 réussis, 0 échec, 2 ignorés.
- Paquet `ariane-4.9.5-test.7.zip` (2 266 750 octets) dans `scratchpad/livraison/`.

**Au réveil suivant, dans l'ordre** :
1. Lire le rapport de la relecture finale de la test 7 (agent lancé au plus haut effort, sans le niveau le plus fort). Corriger ce qui est démontré, refaire le verify une seule fois, reconstruire le paquet, recalculer le SHA-256.
2. Envoyer le zip à l'opérateur avec son SHA-256 et sa taille (jamais avant la fin de la relecture finale).
3. Archiver tout export reçu de l'opérateur dans banane-data (zips bruts, SHA256SUMS, NOTES.md, INDEX.md avant « ## Benchmarks »), après vérification qu'aucune identité d'opérateur n'y figure.
4. Chantier suivant : « relecture au fil du lot » (D-176). Le jugement unique de P-7 sur les parties réservées reste en attente (réglages figés `datasets/relecture-reglages-p7-combinaison.json`).
5. Aucune fusion dans main, aucune étiquette, aucune publication sans l'opérateur.

## Après la relecture finale de la test 7 (18 octobre 2026, D-183)

- La relecture finale du paquet a rendu son rapport : code bon, deux défauts de texte bloquants (consigne fausse après mise à jour, code de projet dans `DECISIONS.md`), corrigés dans 50-base (5ca5e49).
- **Fait** : verify vert sur 5ca5e49 (2 221 essais, 2 219 réussis, 0 échec, 2 ignorés), rapports commités (da9debf) et poussés sur `claude/50-base`. Sur demande expresse de l'opérateur (zip d'abord, le reste après), le zip lui a été remis AVANT ce verify : `ariane-4.9.5-test.7.zip`, construit sur 5ca5e49, SHA-256 `30ecab7220b711d913f0471a92c939eacdca4062ed996df3153617221797c67a`, 2 267 022 octets. Les rapports d'audit à l'intérieur du zip sont ceux de l'exécution précédente (mêmes chiffres, trois empreintes de fichiers d'avant les corrections) ; sans effet à l'exécution, l'extension ne les lit pas. Ancien zip (avant la relecture finale, à ne plus utiliser) : `livraison-ancien/`.
- Rien n'est envoyé à l'opérateur avant ce verify vert. Jamais sans l'opérateur : fusion dans main, étiquette, publication, activation d'une pose sur le terrain.
- À décider avec l'opérateur : ordre du panneau (choix de la relecture sous les résultats), hygiène héritée de banane (liste dans D-183), effacement du code de projet dans l'historique git.


## Après les premiers lots de la test 7 (18 octobre 2026, vers 10 h, D-184)

- **Fait** : deux exports de l'opérateur (parties 10 et 11, mode « corriger », règle grappe coupée) lus et archivés dans banane-data (fe7299d, baad843). Relecture automatique saine : 18 corrections sur 156 cuts relus, 0 mauvaise voie, 437 écritures en 204, aucune pause. Statistiques par partie remises à l'opérateur (fichier hors dépôt).
- **Retiré** : le remplacement de Ctrl+Entrée par Maj+Espace au dernier cut du lot (D-065 : demande de l'opérateur, risque de quitter la partie). Rien n'est modifié dans 50-base (da9debf).
- **Réveil suivant (13 h 41 UTC)** : rien à fusionner (relecture déjà dans 50-base, P-7 en ombre). Attendre les retours de l'opérateur : Écho sur les cuts corrigés (4130 partie 10 ; 17 cuts de la partie 11), lot en « Ombre » sur une partie neuve. Ne rien lancer de lourd (quota, D-181).
- **À instruire plus tard** : volume 1 d'export qui contient une copie du volume 2 ; ordre du panneau ; « Arrêté » en haut pendant une passe ; hygiène héritée (D-183).
- **Chantier suivant** : « relecture au fil du lot » (D-176), puis l'idée P-12 si l'opérateur la retient.
- Jamais sans l'opérateur : fusion dans main, étiquette, publication, activation d'une pose sur le terrain. Pas de PR sans demande.

## Test 8 construite et remise à l'opérateur (18 octobre 2026, nuit, D-187)

- **Fait** : branche `claude/50-relecture-couverture` (d58a6f1, poussée), version 4.9.5.8. verify complet : 2 226 essais, 2 224 réussis, 0 échec, 2 ignorés. Paquet `ariane-4.9.5-test.8.zip`, 2 271 656 octets, SHA-256 `20bb3847ad6071bb7aba76d509ae6bb32821f2bc99e3955076c9627d843d1e06`, remis à l'opérateur avec sa consigne. La partie 11 passe en apprentissage (accord de l'opérateur, D-187).
- **Rien fusionné** dans `claude/50-base` ni `main` (jamais sans l'opérateur). La relecture reste coupée par défaut.
- **Attendre l'opérateur** : exports de la test 8 (lot « Corriger » et « Ombre » sur parties neuves, puis Écho) et les corrections qu'il doit fournir dans l'après-midi. Les archiver dans banane-data (zips d'origine, SHA256SUMS, NOTES.md, ligne INDEX.md avant « ## Benchmarks »), après avoir vérifié qu'aucune identité d'opérateur n'y figure, puis les lire (D-184, D-185 donnent le modèle).
- **À étudier ensuite** : première zone d'ADV de la partie 11 non détectée (cuts 6362 à 6424) ; marge de fin d'ADV ; « relecture au fil du lot » (D-176) ; défaut d'export (volume 1 contenant le volume 2) ; ordre du panneau.
- Le déclencheur `trig_013CLrwFHFamJTuTq5pkhqcG` (niveau fort, 22 h 05) a tourné ; son prompt est dépassé par cette section. Rien de lourd (quota, D-181).

## Nuit du 18 au 19 octobre 2026 (D-188, D-189) : l'opérateur dort, autorisations de travail accordées

- **Autorisation de l'opérateur** : tout le travail, les outils, les branches, les archives. Reste réservé : fusion dans `main`, étiquette, publication, activation d'une pose sur le terrain, PR sans demande.
- **Fait cette nuit** : Échos des parties 10, 14, 15, 16 archivés dans banane-data (2df4abb à c2fbc97) ; compteur des cuts appris par la GCV2 (`tools/compteur-gcv2.cjs`, branche `claude/50-compteur-gcv2`, commit poussé, verify : 2 227 essais, 2 225 réussis, 0 échec, 2 ignorés ; `fiches/COMPTEUR_GCV2.md`) : 1 631 cuts corrigés ; mesure du moteur contre l'opérateur sur les parties 14 à 16 (D-189). La test 8 est remise à l'opérateur (D-187).
- **Session niveau fort de 22 h 05** : elle n'a pas pu pousser (le dépôt banane n'est pas dans ses sources) ; tout le travail est fait ici. Ses commits locaux ne sont nulle part ailleurs : ne rien en attendre. Le déclencheur `trig_013CLrwFHFamJTuTq5pkhqcG` a tourné et ne doit plus servir.
- **Réveil suivant** : `send_later` à 03 h 26 UTC (`trig_01Y5LVv1ixMsJKDeA5tjHkWs`) ; à chaque réveil, reprogrammer +305 min d'abord.
- **À faire ensuite (dans l'ordre)** : (1) juger la règle prudente figée de D-180 sur les parties 14 à 16, avec une table de zones faite des notes de l'opérateur (`relecture-autonome.cjs juger … --juger-partie-reservee`, après lecture du manifeste) ; (2) détection de la première zone d'ADV de la partie 11 (6362–6424) et marges de fin ; (3) fusionner `claude/50-compteur-gcv2` dans `claude/50-base` seulement si l'opérateur le dit (l'outil ne touche pas l'extension) ; (4) archiver tout nouvel export de l'opérateur (jamais le code de projet ESV).
- **Questions à poser à l'opérateur, une à la fois** (voir D-188) : quand un cut est « appris » ; compter les retouches de 5 mm ou moins ; réserver des parties pour juger la GCV2 ; projet des parties 14 à 16 ; final de la partie 15.
- **Disque** : l'allocation est de 38 Go ; j'ai supprimé les extractions déjà archivées (scratchpad). Les Échos se lisent directement dans leurs zips (pas besoin d'extraire).
- **4 h (D-190)** : règle prudente jugée sur les parties 14 à 16 (29 grosses corrections sur 35 ramenées à 10 mm ou moins, 0 mauvaise voie, 2 abîmés) ; `relecture-autonome.cjs table --sans-lot` ajouté (branche `claude/50-compteur-gcv2`, bd7d33e, verify 2 228 essais, 0 échec) ; zones reconnues contre les notes de l'opérateur. Il reste : attendre le final de la partie 15 et les réponses de l'opérateur (D-188, D-190) ; **rien d'autre n'est à faire sans lui** (fusion, activation, étiquette lui restent réservées).

## Passation à la session GCV2 (19 octobre 2026, matin, D-192)

- **Lire d'abord, dans l'ordre** : `fiches/PLAN_SUITE_5.0.md` (le plan et les niveaux), `fiches/G0_GCV2_CONCEPTION.md` (la conception), D-188 à D-192, `fiches/ORGANISATION_DEV_5.0.md` (rôles, économie de jetons), `fiches/RELECTURE_AUTONOME.md` § 1 et § 5 (la référence à battre), `fiches/COMPTEUR_GCV2.md`.
- **Code** : base `claude/50-base` (da9debf) ; outils du compteur et `table --sans-lot` sur `claude/50-compteur-gcv2` (6645a0e) ; test 8 sur `claude/50-relecture-couverture` (d58a6f1). Rien de tout cela n'est fusionné : l'opérateur décide.
- **Données** : banane-data, `collections/` (10 Échos ; `INDEX.md`) ; les cas extraits et les tables de la nuit sont dans le scratchpad de cette session (`res/cas14.jsonl`, `cas15`, `cas16`, `table14.json`, `table15`, `table16`, `jugement-14-16.json`) : à refaire par les outils si le scratchpad a disparu (commandes dans D-189 et D-190).
- **Règles absolues** : jamais le code de projet ESV ni une coordonnée dans un dépôt ; aucun identifiant de modèle dans un dépôt ; `src/engine.js` intact ; une partie réservée ne règle rien ; un chantier = une branche = un worktree ; verify une fois par commit ; aucune lecture d'export par un modèle.
- **Première semaine** : G1-a (rappel atteignable), RM-1, RM-4, RM-10 ; RM-5 à chaque export de la test 8 ; cycle quotidien du § 2 du plan.
- **Réveil nocturne** : supprimé (D-192). Si l'opérateur veut une veille de nuit, réarmer `send_later` avec un message qui renvoie au plan, pas à la nuit du 18 au 19.
