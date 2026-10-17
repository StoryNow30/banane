# Protocole de reprise autonome (nuit du 15 au 16 octobre 2026 et suivantes)

Demande de Mic (D-124) : avancer sur tous les chantiers possibles pendant son absence et relancer automatiquement la session après chaque réinitialisation de sa fenêtre de 5 h. Ce fichier est relu à chaque réveil ; il remplace la mémoire de la conversation.

## À chaque réveil, dans l'ordre

1. **Programmer le réveil suivant d'abord** : `send_later` à maintenant + 5 h 05, avec le même message de réveil. Ainsi, si la limite tombe pendant le travail, la reprise est déjà assurée.
2. **Lire l'état** : `fiches/PLAN_5.0.md` (colonne État), fin de `DECISIONS.md`, `git fetch` et `git log` des branches `origin/claude/50-*` et `origin/claude/495-*` depuis le dernier réveil.
3. **Recueillir** les chantiers livrés : vérifier le rapport (porte de sortie, verify 0 échec, rien sous `src/engine.js`), les fusionner dans `claude/50-base` (fusion simple, essais ciblés), mettre à jour le plan (coût constaté, état), consigner une ligne dans `DECISIONS.md`.
4. **Relancer** un chantier mort à cause de la limite (agent sans rapport) depuis sa branche, avec le même brief.
5. **Lancer** les chantiers suivants du plan dont les entrées sont prêtes : un lourd et un léger au plus, briefs complets, niveau rapide par défaut (éclair pour le mécanique, fort seulement pour une relecture due), base `claude/50-base`.
6. **Ne pas dépasser 60 %** de la fenêtre ; garder 20 % pour un export de Mic s'il arrive.
7. **Écrire à Mic** un compte rendu de cinq lignes au plus en fin de réveil (ce qui est livré, ce qui tourne, ce qui attend de lui).

## Arrêt

- Mic écrit : le protocole s'arrête, on reprend en conversation.
- Deux réveils de suite sans rien à recueillir ni à lancer : ne plus programmer de réveil, le dire à Mic en une ligne.
- Jamais sans Mic : fusion dans `main`, étiquette, publication, activation d'une pose sur le terrain, modification de `src/engine.js`.

## Ce qui attend Mic (ne pas bloquer dessus)

- Numéros de cuts d'un ADV et d'un PN connus (Q3).
- Volumes de l'Écho partie 24 des tests 19/20 (Q5).
- Lot Orbite et Écho d'un second projet ESV (D-123).
- Exports de la séance 4.9.5 test 2.
- Séance 4.9.5 test 3 (paquet envoyé, D-127) et ses exports.

## À intégrer au prochain numéro de test

- Logo retenu par Mic (piste A « La voie ») : commit a426771 sur `claude/ux-variantes`. Prendre `icons/` (`git checkout a426771 -- icons/`), puis déclarer dans `manifest.json` `"icons": {"16":"icons/ariane-16.png","32":"icons/ariane-32.png","48":"icons/ariane-48.png","128":"icons/ariane-128.png"}` et la même liste sous `action.default_icon`. Fait : intégré à la 4.9.5 test 3 (D-127).

## Prochain réveil (après D-129)

- Lourd : **P1 plafond de convention à 8 mm** (`claude/50-p1-convention` depuis `claude/50-base`) : `src/placement-convention.js` seulement (jamais `src/engine.js`), décalage plafonné, reste consigné ; essais ; rejeu des quatre lots au banc (`fiches/P0_MESURES.md`) sans régression ; relecteur indépendant. Rien n'est activé au terrain sans Mic.
- Léger : corriger AUDIT_SUPER_CERVEAU § 1 avec les chiffres de P0 (a).

## Prochain réveil (après D-130)

- Lourd : **P1 bis, plafond vertical seulement** (`claude/50-p1-vertical` depuis `claude/50-base`) : même réglage coupé par défaut, plafond appliqué à l'axe vertical seulement, latéral refusé comme avant ; rejeu `tools/p1-plafond.cjs` identique ; vérifier le cut de passage à niveau de la partie 27 et le ricochet ; reprendre `capped`/`rest*` dans le journal compact si c'est hors `src/engine.js`.
- Léger : S4 maquette ESV dans verify, étape 1 (inventaire de `claude/esv-locale-audit`, plan d'intégration court).

## Nuit du 16 au 17 octobre 2026 (D-155) : gros moyens

Mic : « profite de la nuit pour lancer des gros programmes », niveaux forts quand c'est utile, relance après chaque réinitialisation comme la nuit d'avant. Beaucoup de crédits restent avant la réinitialisation hebdomadaire du dimanche. Les règles 5 et 6 ci-dessus sont donc assouplies cette nuit :
- jusqu'à **4 chantiers lourds** en même temps, au niveau fort par défaut pour la conception et le code, et au niveau maximal pour les relectures avant livraison ;
- pas de plafond de 60 % de la fenêtre ;
- garder le verrou `wt/lourd.lock` et `nice` : la machine sature au-delà de 4 rejeux.

**Cap fixé par Mic** : l'autonomie d'Ariane en appliquant les règles métier. On ne dépend pas des corrections de Mic pendant le lot (D-155).

**Vague 1** (lancée le 16 au soir) :
1. `claude/50-deplacer-vue` (fort) : relevés sur la maquette ESV (`claude/esv-locale-audit`), pièce `amenerDansLaVue` coupée par défaut, et dans l'Écho le relevé des glissers de Mic (longueur, durée, caméra).
2. `claude/50-regles-metier` (fort) : règles métier de Mic en ombre puis prêtes à activer (PN : contrôler chaque cut ; écartement proche de 1 435 ; marges PN et ADV), rejouées sur toutes les parties, avec chiffres.
3. `claude/50-faux-verts` (fort) : détecteur des faux verts près des rouges, des PN et des aiguilles (M1 et M5), avec chiffres par partie, et ce qu'Ariane ferait de différent.
4. `claude/50-bruit-reference` (rapide) : bruit de la référence de Mic, mesuré sur les données existantes (validations doubles, recoupements avec le débutant).

**Vague 2** (au réveil suivant, quand la vague 1 est rentrée) :
- **4.9.5 test 5** : base 5.0, ombres, relevé des glissers, règles métier **en ombre**, avec paquet et consigne ;
- **relecture au niveau maximal** du diff de la test 5 avant de l'envoyer à Mic ;
- **cahier v1.1** : proposition de porte pour Mic (« jamais la mauvaise voie et pas plus de faux qu'Orbite aujourd'hui, en ombre sur parties neuves ») et autres amendements de l'audit (I7).

**État au 17 octobre, 0 h** : la vague 1 est rentrée et fusionnée (D-156 à D-160), verify complet vert (2 006). Également faits : la mesure du clic hors vue (D-157, décision à Mic) et le bruit de la référence (D-158).

**Vague 2 lancée** :
- `claude/50-hauteur-apprise` (fort) : correction de hauteur en ombre ; 70 des 85 faux verts viennent de la hauteur ;
- `claude/50-verts-a-controler` (fort) : liste des verts à contrôler, dans le panneau et l'export, sans aucune action dans ESV ;
- cahier v1.1 (fort) : brouillon hors dépôt, `cahier11/CAHIER_5.0_v1.1.md`, à soumettre à Mic.

**Vague 3** (quand la vague 2 est rentrée) :
- **test 5** depuis `claude/50-base` : version 4.9.5.5, consigne, paquet ;
- relecture au niveau maximal avant de l'envoyer à Mic.

**État au 17 octobre, vers 2 h** :
- vagues 2 et 3 rentrées : D-161 (hauteur apprise), D-162 (liste des verts), D-163 (test 5 relue et envoyée à Mic) ;
- le cahier v1.1 est envoyé à Mic, hors dépôt, dans `cahier11/` ; à verser au dépôt après son accord.

**Vague 4 lancée** :
- `claude/50-rapide-humain` (fort) : réglage `rapide.clicHumain`, `'tel-quel'` par défaut, plus le relevé `clic-hors-vue`, mesuré au banc ;
- `claude/50-detection-adv` (fort) : étude de détection des ADV, puis ombre et branchement sur la liste des verts si elle tient ;
- `claude/50-utiles-t6` (rapide) : les points utiles de la relecture de la test 5.

**Au prochain réveil** :
- recueillir la vague 4 et la fusionner dans `claude/50-base` ;
- rien ne part au terrain avant le retour de Mic sur la test 5 et ses décisions : D-157 et cahier v1.1.

**État au 17 octobre, vers 9 h** :
- le conteneur a redémarré dans la nuit ;
- la vague 4 est récupérée et intégrée (D-164) ;
- 65 anciens worktrees sont supprimés : le disque était presque plein ;
- Mic veut essayer les deux méthodes du clic : la **test 6** est lancée (`claude/495-test-6`), avec le choix du clic dans le panneau.

**Ensuite** : relecture de la test 6 au niveau maximal, puis envoi à Mic avec son empreinte.

**État au 17 octobre, vers 10 h 30** (avant compactage) :
- test 6 au terrain : parties 8 et 9 archivées (D-166, D-167) ;
- lot des parties 2 à 7 analysé, prédictions scellées (D-169) ;
- recadrage de Mic (D-170) : la 5.0 doit faire elle-même la relecture qu'il fait en Écho ;
- accord pour visiter les verts sans modifier (D-171).

**En cours** :
- `claude/50-zones-autonomes` : étude élargie à toute la relecture, fiche `RELECTURE_AUTONOME.md`. Chiffre central : la part des corrections de Mic reproduite seule, face aux cuts abîmés ;
- `claude/50-relecture-ombre` : passe de relecture en ombre de fin de lot (visite, calcul, note, aucune modification), case coupée par défaut.

**Ensuite** :
- relire et fusionner les deux chantiers ;
- **test 7**, avec : la relecture en ombre ; le libellé de la case grappe corrigé (« série de différés », pas « aiguille ») ; l'état du dernier lot affiché clairement ; un message quand il ne reste rien à faire dans la partie ;
- relecture au niveau maximal, puis envoi.

**Réponse de Mic (D-172)** : SKIP seulement si aucun point ne s'affiche ou si un seul scanner s'affiche ; sinon visiter et corriger, cuts 0 à 3 compris. À faire : détection SKIP en ombre, mesurée contre les SKIP de Mic.

**17 octobre, 10 h 40 (D-173)** : la test 7 attend une avancée réelle : règles métier qui agissent, chiffrées et jugées sur parties réservées, plus un panneau réorganisé (`claude/50-panneau-t7`, élargi). Ne pas fabriquer la test 7 avant.

**17 octobre, 13 h 05 UTC** : 83 % de la fenêtre est consommée ; elle se réinitialise vers 16 h 40 UTC.
- **Atelier P-7 arrêté exprès** pour économiser. Son diagnostic est fini : `scratchpad/p7/CATALOGUE.md`.
- **À la reprise**, relancer :
  ```
  Workflow({scriptPath: "/root/.claude/projects/-home-user/cc0e4631-960e-5f55-b126-e7123e84b5ca/workflows/scripts/p7-pose-adv-grappes-wf_56d882aa-e4e.js", resumeFromRunId: "wf_7d519878-737"})
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
   - validation par Maj+Espace (geste de Mic), sinon « corriger » reste verrouillé ;
   - réglages sûrs en cas d'échec ;
   - essai de `validateInPlaceEcriture` ;
   - plafond par zone, PN d'abord ;
   - chaîne vide, comme l'étude ;
   - « vu » dit clairement, avec un compteur ;
   - pas de pauses ; départ automatique avec un compte à rebours visible et un bouton pour annuler (D-176) ;
   - lectures de nuage mesurées.

   Ensuite, une contre-revue courte, puis la fusion.
2. **Atelier P-7** : reprendre avec `Workflow({scriptPath: ".../p7-pose-adv-grappes-wf_56d882aa-e4e.js", resumeFromRunId: "wf_7d519878-737"})`. Le diagnostic est fait (`scratchpad/p7/CATALOGUE.md`). Si la reprise depuis le cache échoue, relancer le script : le diagnostic relira `p7/`.
3. **Verify complet au calme** sur 50-base, puis **test 7** si la relecture est fusionnée.

**Après la test 7 (D-176)** : chantier « relecture au fil du lot ». La même logique s'applique pendant le lot, en visitant les cuts voisins d'un PN, d'une ADV ou d'un rouge isolé. On la compare à la passe de fin de lot.
