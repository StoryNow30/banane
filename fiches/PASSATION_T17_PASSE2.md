# Test 17 : deuxième passe des différés dans l'extension (rôle « PASSE2 »)

Branche `claude/50-t17-passe2`, depuis `claude/50-apprentissage-3-0` (d344fe1). Worktree `wt/T17C`. Plan d'origine : `fiches/PASSATION_CAP5_B.md` § 15.

## 1. État de départ (constaté)

- Le banc (`tools/banc-differes.cjs`, `deuxiemePasse`) redécide en fin de lot chaque différé de L1-se avec les poses d'avant ET d'après.
- La test 16 contenait déjà un premier bloc dans `background.js` (commit 1a13119) : la passe **en ombre** commandée par le levier GCV2 `deuxiemePasse` (réglé en code, pas un réglage de l'extension), jamais mesurée contre le banc (les sorties `b/par2-*` sont vides), sans écriture.

## 2. Ce qui est fait

- **Réglage** `lot.passeDifferes` (`src/settings.js`), coupé : `ombre` et `ecriture` sont deux booléens distincts, toute valeur autre que `true` laisse coupé ; `ecriture` n'a d'effet qu'avec `ombre` et l'observateur passif ; `ecritureMax` (1 par défaut, 1 si illisible) borne les cuts écrits ; `passes` (2) et `leviers` (`sansVoieRien`) sont la recette du banc (`deuxiemePasse` 2, `passe2Leviers`). Le levier GCV2 `deuxiemePasse` reste pour le banc seulement.
- **Ombre** (`passeDiffOmbre`, `background.js`) : même calcul qu'avant ; les leviers de la passe ne valent plus que le temps de chaque appel de décision (avant : pendant toute la passe, donc aussi pour un lot démarré entre-temps) ; elle garde les poses décidées (`r`, `positions`).
- **Écriture** (`passeDiffEcrire`, `passeDiffPoser`) : voir § 4.
- **Parité** : `tools/parite-l1se-sw.cjs --passe` (recette livrée, en-tête du rejeu de référence contrôlé, passe de chaque pose comparée).

## 3. Où la passe s'insère dans le cycle de lot

1. Pendant le lot : `l1Commande` note, pour chaque cut que la GCV2 laisse différé, `{identité, zone, plages ADV}` (`l1Restes`). Inchangé si le réglage est coupé.
2. Fin naturelle du lot (`batch-state` COMPLETED, ou STOPPED au dernier cut) : `passeDiffPlanifier`, une fois par lot, profil L1-se seulement, à côté de `relecturePlanifier`.
3. Ombre : nuage relu du magasin, `deciderDiffere` avec voisins de fin de lot, transport complet, appuis de fin de lot, jusqu'à `passes` passes. Aucune navigation, aucune écriture.
4. Écriture (second réglage) : après l'ombre, dans l'ordre des décisions. La relecture attend la fin de l'écriture avant de partir ; le panneau ne lance rien d'autre tant qu'elle écrit ; « Arrêter » l'arrête avant le cut suivant.

## 4. Écriture : protocole et sécurité

Au départ : `lotCloRefus` (extrait de `relectureRefus`, mêmes refus : lot clos naturellement, ESV propre, partie du lot, pose d'Ariane non validée qui attend, intention interrompue, relecture en cours). Cas courant : lot borné qui s'arrête sur une pose non validée au dernier cut. La passe ne part pas ; une fois ce cut validé à la main, l'action `passe-differes-ecrire` relance l'écriture des poses qui restent.

Pour chaque pose, dans l'ordre où elle a été décidée (chacune repose sur les précédentes : voisins, transport) :
1. `goToCut` confirmé ; ESV affiche ce cut ; capture ;
2. la pose d'ESV du cut est celle de la visite du lot (1 mm : même repère, rien changé depuis) ;
3. la liste d'ESV dit le cut **rouge** (`invalid`, pas traité par un opérateur) : sinon refus, jamais d'écrasement d'un vert ;
4. la commande du lot (`commander`, cible dans la vue, écartement dans le contrat) ; hors de la vue : refus (la passe ne déplace pas la vue) ;
5. pose par `poserPuisVerifier` (extrait de `relectureCorriger`, même code : intention notée, clic « tout-recentre », relue à 1 mm, rails relus, `restore` sinon) ;
6. Ctrl+Entrée (`validateInPlace`, réglages `lot.validationDernierCut` / `boutonValiderSansSuivant`), prouvé par le compteur « N on M treated » (`enPlaceProuvee`, aussi employée par `validerSurPlace`), le même cut affiché ET l'écriture « valid » de la ligne vue par l'observateur passif ;
7. `validation-accepted` (`action: 'VALIDATE'`, `passeDifferes: true`) : le résumé de la partie compte le cut posé, l'audit du serveur compte la validation.

Un refus ou une anomalie **arrête la passe** (les poses suivantes ont été décidées en comptant sur celle-ci). Validation envoyée mais non prouvée : la pose reste, l'intention reste (même garde que la relecture : « J'ai contrôlé le cut N »), la passe s'arrête.

## 5. États et journal ajoutés

- Événements : `passe-differes-ombre` (existait), `passe-differes-ombre-fin` (+ `ecritureDemandee`), `passe-differes-ecriture` (par cut : `ecrit` / `refuse` / `incertain`, décalage, compteur, ms), `passe-differes-ecriture-fin` (issue : `fin`, `arret`, `refus`, `incertain`, `refus-depart`, `lot-change`), `passe-differes-erreur`, et `validation-accepted` avec `passeDifferes`.
- Vue du panneau : `passeDifferes` `{lotId, mode, etat (calcul, ecriture, finie, arretee, erreur), differes, posees, demandees, ecrites, cut, message}`, seulement si la passe a eu lieu.
- Action : `passe-differes-ecrire`.
- Séance de l'observateur passif `passe-differes:<lot>` pendant l'écriture ; les bords écrits sont mémorisés comme ceux de la relecture (`listeNoterEcriture`).

## 6. Essais (service worker réel en VM, ESV simulé)

- `tests/passe-differes-reglage.test.cjs` : livré coupé, recette du banc ; toute valeur inconnue laisse coupé (`'true'`, `1`, `null`, `[true]`…), l'écriture seule ne s'allume pas, l'écriture exige l'observateur passif, `ecritureMax` illisible vaut 1.
- `tests/lot-profil-passe-differes-sw.test.cjs` (ombre) : coupée par défaut (mêmes commandes à ESV avec et sans), voisins de fin de lot avant ET après, leviers de la passe réglés le temps de l'appel seulement, rien sous L1-s.
- `tests/lot-profil-passe-differes-ecriture-sw.test.cjs` : lot arrêté sur une pose non validée → la passe ne part pas, rien n'est envoyé ; après validation à la main, `passe-differes-ecrire` : `goToCut`, `capture`, `apply` (clic « tout-recentre »), `validateInPlace`, rien d'autre ; pose écrite = pose décidée à 0,01 mm ; un seul cut sur deux décidés (`ecritureMax` 1) ; le résumé de la partie compte le cut posé et l'autre reste différé ; intention effacée ; vue du panneau.
- `tests/lot-profil-passe-differes-ecriture-refus-sw.test.cjs` : un cut que la liste dit vert n'est jamais écrasé (lectures seulement, arrêt à la première pose non écrite) ; « Arrêter » arrête avant le cut suivant.
- `tests/lot-profil-passe-differes-ecriture-preuve-sw.test.cjs` : validation refusée avant l'envoi → pose d'avant remise ; validation envoyée sans écriture vue → pose gardée, intention notée (un nouveau lot est refusé), passe arrêtée, rien compté.
- Mutations vérifiées (le test devient rouge) : statut rouge non contrôlé ; séance de l'observateur retirée (l'écriture « valid » n'est plus vue) ; arrêt demandé ignoré.
- Reprise du code de la relecture sans changement de comportement (`relectureCorriger` → `poserPuisVerifier`, `remettrePose` ; `relectureRefus` → `lotCloRefus` ; `ecritureAttendue` ; `validerSurPlace` → `enPlaceProuvee`) : les essais de la relecture et du dernier cut sont inchangés.
- Passe coupée = test 16 : un lot L1-se joué dans le service worker de la test 16 (`75b47fd`) et dans celui de cette branche, commandes et journal neutralisés (identifiants, heures, durées) : fichiers identiques (3 753 749 octets, deux scénarios).

## 7. Parité extension / banc

Mesurée par l'intégration (`fiches/PASSATION_T17_INTEGRATION.md` § 6) : 2:17 (139 cuts) et 2:19 avec la passe en ombre et la chaîne livrée.

## 8. À prouver au terrain (l'opérateur présent, un seul différé)

Voir la consigne `consignes/seance-terrain-4.9.5-test-18-2026-10-21.md` § 3 : premier lot court, l'opérateur présent, arrêt au premier refus.

## 9. Limites connues

Voir `fiches/PASSATION_T17_INTEGRATION.md` § 6 (limites après la relecture adversariale).
