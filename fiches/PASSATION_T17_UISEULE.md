# Test 17 (UI) : le paquet « interface seule » (rôle UI-SEULE), 21 octobre 2026

Branche `claude/50-t17-ui-seule`, worktree `wt/T17U`, **depuis `claude/50-test16` (75b47fd)** : les huit commits de `claude/50-t17-uiport` (tête eff912c) rebasés, **sans** d344fe1 (apprentissage de la partie 0 du projet 3 : manifeste des parties, banc des différés, D-224, fiche), qui n'est pas de l'interface. Version **4.9.5.17**, nom « 4.9.5 test 17 (UI) », paquet `ariane-4.9.5-test.17-ui.zip`. À la demande de l'opérateur (21/10) : la nouvelle interface seule, sur le moteur de la test 16 ; l'intégration complète (deuxième passe, gardes de fautes, cuts sans pose, apprentissage de la partie 0) viendra comme 4.9.5.18 « test 18 ».
Marqueurs : **[mesuré]** = lancé ici ; **[lu]** = lu dans le code ; **[non prouvé]** = rien ne l'a exécuté.
Reprendre d'abord `fiches/PASSATION_T17_UIPORT.md` (le port : blocs A, C, D, E, défauts corrigés, essais, fusion avec la deuxième passe) : cette fiche n'en répète pas le contenu.

## 1. Le moteur est celui de la test 16 [mesuré]

`git diff --stat origin/claude/50-test16` : aucun fichier de `src/gcv2*.js`, `src/engine.js`, `src/geometry*.js`, `src/settings.js`, `src/lot-decision.js`, `src/adapter*`, ni de `datasets/`. Fichiers touchés : l'interface (`panel.html`, `panel.js`, `panel-ui5.css`, `src/ui5*.js`, `src/relecture-pause.js`, `src/carte-relecture.js`), `background.js` (**section de la relecture seulement**, pour la pause, et la ligne de version), les chaînes de version (`manifest.json`, `src/core.js`, `src/bridge.js`), des essais et leurs montages, `tools/ui5-navigateur.cjs` et `tools/parite-relecture-sw.cjs`, `CHANGELOG.md`, `DECISIONS.md`, `fiches/`, la consigne.
L'essai `pose-lot-inchanges-4959` (la pose et le lot lisent les mêmes fichiers que la test 8, octet pour octet, et le moteur est celui de la baseline V4.6.0) passe : seule la chaîne de version à remplacer est passée de 4.9.5.16 à 4.9.5.17.

## 2. Ce qui est allumé, éteint

| Chose | Au départ |
|---|---|
| Panneau d'avant | **défaut** |
| Nouveau panneau (v2) | éteint ; lien « Essayer le nouveau panneau » (pied de l'accueil) ; retour par Réglages > Interface ou « Ouvrir l'ancien panneau » |
| Palette sobre | éteinte ; Réglages > Interface du nouveau panneau, icône d'en-tête, Ctrl K |
| Pause et reprise de la relecture | **éteinte** (réglage de la carte Relecture du panneau d'avant) ; F5 pendant la relecture : « mettre en pause / arrêter », seulement fonction allumée |
| Zone « la deuxième passe travaille » du nouveau panneau | **inerte** (voir § 4) |

## 3. Version, essais d'empreinte, décisions

- Chaînes de version : `manifest.json`, `src/core.js`, repli de `background.js`, `src/bridge.js`, `panel.js`, `panel.html` (titre, marque, pied). `tests/version-49514.test.cjs` : constantes, nom, liste des exports lus (4.9.5.16 ajouté explicitement, 4.9.5.17 par la constante) ; **aucun essai affaibli** : l'empreinte du manifeste (version, nom et titre ramenés à « X »), les permissions, la liste des fichiers de pose et les chaînes interdites sont inchangées. `pose-lot-inchanges-4959` : deux remplacements de chaîne de version.
- `DECISIONS.md` : D-232 à D-236 reprises **verbatim** de `claude/50-ui-5.0`, puis D-237 (livraison de l'interface seule sur le moteur test 16, à la demande de l'opérateur le 21/10 ; la v2 et la palette sobre sont validées ; la double connexion Orbite + Écho est abandonnée). D-224 (apprentissage, autre branche) n'est pas reportée : la numérotation saute de D-110 à D-232 dans ce fichier, comme sur la branche UI.
- `CHANGELOG.md` : entrée 4.9.5.17.

## 4. Code qui dépend d'une fonction absente de la test 16

Une seule chose : la zone « la deuxième passe travaille, ne touche à rien dans ESV » du nouveau panneau lisait `view.passeDifferes`, que seule la branche de la deuxième passe produit. Après la relecture indépendante : **retirée de ce paquet** (état `p2` de `src/ui5.js`, ses textes dans `src/ui5-rendu.js`, ses essais). Elle est dans `claude/50-t17-uiport` (eff912c et la rebase de cette branche jusqu'à 359eaff) : la test 18 la reprend avec la deuxième passe. À sa place, le nouveau panneau a un état « Relecture en cours » (correctif 2, § 5). L'autre dépendance de l'intégration (une ligne à corriger dans `passeDiffEcrire`) est au § 3 de la fiche du port. Dit dans le CHANGELOG, D-237 et ce § ; plus aucun code mort lié à elle dans le paquet.

## 5. Correctifs de la relecture indépendante (commits séparés, à cherry-picker pour la test 18)

Chaque correctif a un essai rouge sans lui et vert avec [mesuré : essai lancé sans la correction, puis avec].

| Commit | Correctif | Essai |
|---|---|---|
| `a4feac9` | 1 : `'relecture-reprendre'` dans `RELECTURE_INTENTION_BLOQUE` (après un redémarrage entre la pose et Maj+Espace d'une correction, la reprise est refusée par la garde d'intention, pas seulement par `relectureRefus`) | `relecture-pause-intention` (scénario du script de la relecture) |
| `7d42a8a` | 2 : état « Relecture en cours » du nouveau panneau, prioritaire sur « Lot terminé » (accueil : Suivre / Arrêter la relecture ; Orbite : ligne de la relecture et commande principale « Arrêter » ; Écho et cache indisponibles) ; 3 : « Vider le cache » grisé pendant la relecture ou sa pause, dans Orbite et Écho ; retire l'état `p2` | `ui5-panneau` (état), `ui5-rendu` (rendu, cache) |
| `275b0fb` | 4 : la fenêtre n'est redimensionnée qu'au changement de présentation (le panneau d'avant garde la taille de l'opérateur à l'ouverture ; une présentation habillée demande sa taille à l'ouverture) | `ui5-panneau` |
| `2b14ebc` | 6 : « Une autre Ariane » au passage d'un cut arrête la relecture en erreur avec son message, sans pause | `relecture-pause-autre-ariane` |
| `419c489` | 5 : un point de reprise jeté au réveil (plus de 24 h, autre lot, réglage éteint) écrit un `relecture-fin` « interrompue » | `relecture-pause-redemarrage-expire` |
| `9c645d5` | 7 : code mort retiré (erreur « en pause » inatteignable de `relectureLancer`, `ArianePanel.which`, règle CSS et classe `ar-vole`, action `relecture-pause-reglage-etat` : les essais lisent `repriseReglage` dans `relecture-etat`) ; consigne : limites 8 (focus clavier perdu au redessin, lignes de palette sans rôle ni `tabindex`, deux lectures de `relecture-etat` en parallèle) | essais existants |
| `a01322e` | « Arrêter la relecture » en commande principale : pastille blanche, texte rouge foncé (vu à l'écran : rose pâle illisible sur blanc) | captures |

Un essai existant modifié : `relecture-pause-corriger-f5` (le refus de « Reprendre » après un F5 pendant une correction vient maintenant de la garde d'intention, message « J'ai contrôlé le cut 109 », au lieu de « Aucune relecture en pause » ; il refuse toujours).
Constat sans correction : dans le nouveau panneau, l'onglet Écho reste cliquable pendant la relecture (la vignette de l'accueil est grisée) ; les boutons d'Écho y sont ceux du panneau d'avant, que le service worker refuse pendant la relecture avec son message.

## 6. Contrôle visuel [mesuré]

`node tools/ui5-navigateur.cjs <dossier>` (Chromium 1194 de l'environnement, états fabriqués, aucune écriture vers ESV) : 52 captures PNG, **0 erreur de page** : panneau d'avant (accueil, lot, pause, incident, fin, Écho, relecture en cours, relecture en pause, page entière) ; v2 (accueil, Orbite, Écho, Revue, Réglages pour chacun de ces états) ; palette (ouverte et en recherche, en lot et pendant une pause de la relecture). Chemin : `/tmp/claude-0/-home-user/cc0e4631-960e-5f55-b126-e7123e84b5ca/scratchpad/t17/ui/captures/`. Regardées une par une (accueil, Orbite en lot, en pause, incident, fin, Écho, Réglages, relecture en pause, palette) : **aucun défaut visuel trouvé** (pas de chevauchement, texte coupé ni bouton hors de la fenêtre), puis refaites pour les états « relecture en cours » et « en pause » après les correctifs (§ 5). Constats sans correction :
- la zone de pause du panneau d'avant (boutons « Reprendre la relecture au cut N », « Arrêter la relecture ») est dans le style des deux autres boutons de la carte déjà présents en test 16 (« J'ai contrôlé le cut ») : plus sobre que le reste de la page ;
- la ligne et les boutons de la pause n'apparaissent qu'à la lecture suivante de l'état (≤ 1 s) ;
Essais navigateur ajoutés (ignorés sans Chromium, ils le disent) : `ui5-navigateur-defaut` (défaut = panneau d'avant, pause visible, lien → v2 et choix gardé), `ui5-navigateur-ariane2` (cinq écrans, en lot et après le lot, onglets, cache grisé, pas de grand titre ; « Pause » du nouveau panneau = mêmes messages que le bouton d'origine), `ui5-navigateur-palette` (champ actif, frappe gardée, Entrée, Réglages, Ctrl K, reprise de la relecture). Pas repris : les essais navigateur des trois présentations retirées, ni `ui5-navigateur-ariane*` d'origine (variantes qui n'existent plus ici) ; leur contenu utile est dans les trois essais ci-dessus.

## 7. Parité avec la test 16, réglages d'interface éteints [mesuré]

`node tools/parite-relecture-sw.cjs <wt/T16> <wt/T17U>` : cinq relectures dans le **vrai service worker** de chaque dépôt (ombre, ombre avec le réglage de pause écrit éteint, corriger, arrêt demandé au cut 109, F5 au cut 110) : commandes envoyées à ESV, appels de l'adaptateur, journal, états, stockage : **45 comparaisons sur 45 identiques**. Un premier passage montrait des écarts sur les commandes et le journal : **uniquement** le champ `extensionVersion` des commandes de lot (4.9.5.16 contre 4.9.5.17) ; l'outil neutralise maintenant le numéro de version (une expression régulière sur les chaînes, rien d'autre). Contrôle de l'outil : avec `AB_ACTIF=1` (pause allumée), 9 comparaisons sur 45 diffèrent (clés de stockage, états, F5). La pose du lot elle-même n'est pas rejouée : ses fichiers sont ceux de la test 16 (§ 1). SHA-256 du relevé (avant les correctifs de la relecture indépendante, qui touchent `background.js` : voir plus bas pour le passage refait) : 277aee58b1ba01a4d982ce8a2ed1eada9679342d067809cd0d880bd88cf24ec0.

## 8. Verify [mesuré]

`node tools/verify.cjs` (officiel, tel qu'il est, délai de 20 s par fichier non touché), sur l'arbre final (`a01322e`), **à 12:00 UTC, machine calme** (rejeux des autres agents en pause) : **2511 essais, 2509 réussis, 0 échec, 0 annulé, 2 ignorés** (corpus privé absent : « skipped is not passed »), 62 fichiers d'exécution contrôlés (syntaxe), géométrie inchangée, moteur conforme à la baseline V4.6.0 ; durée 8 minutes. Enregistrement : `audit/verification.txt` et `audit/verification.json` (commités). La test 16 : 2448 essais, 2 ignorés.
Un passage précédent du même verify sur le même arbre, **sous charge 9** (deux verify et quatre rejeux simultanés), a donné 2308 réussis, 0 échec, **96 fichiers annulés par le délai de 20 s** (« test timed out after 20000ms », aucune assertion rouge) : je n'ai rien allongé, j'ai remis les rejeux des autres agents en pause et refait le verify en entier (relevé du passage annulé, hors dépôt : `scratchpad/t17/ui/verification-run3-cancelled96.txt`). Un tout premier verify (11:13, charge 6) s'était arrêté net avec une sortie tronquée à 82 Ko et le code 1, sans cause trouvée (pas de signal, pas de « not ok » enregistré) ; la même liste de fichiers lancée à la main en TAP est passée sans échec jusqu'aux essais « v » ; je n'ai pas pu le reproduire.
Pause des rejeux d'autres agents (autorisée par la session principale) : du 11:10 UTC à 12:08 UTC (re-pause de quatre rejeux relancés entre-temps à 12:00), au-delà des 40 minutes prévues, pour le verify officiel seulement ; reprise à 12:08.
Essais ajoutés ou changés depuis la test 16 : voir `git diff --stat origin/claude/50-test16 -- tests` ; les essais navigateur durent de 2 à 13 s chacun (calme).


## 9. Paquet

Construit après le dernier commit de contenu : `python3 tools/package.py --output <dossier>/ariane-4.9.5-test.17-ui.zip`. Le SHA-256, la taille, le CRC, le manifeste, le scan d'identité et la comparaison du zip avec l'arbre commité sont dans le commit qui suit (le zip contient cette fiche : elle ne peut pas porter son propre SHA).

## 10. Risques et non prouvé

- **Aucun essai sur ESV réel** : le nouveau panneau, la palette et la pause n'ont été vus que sur des états fabriqués. Le délai de réinstallation de l'observateur dans la page ESV après un F5 pendant la pause (D-234) n'est pas mesuré ; un F5 pendant la relecture peut, dans le pire cas, donner « validation non prouvée » à la première correction : la pose est gardée, la passe s'arrête.
- Une seule connexion ESV partagée par Orbite et Écho (la double connexion est abandonnée).
- Accessibilité du nouveau panneau et de la palette non traitée (focus clavier perdu au redessin, lignes de palette sans rôle ni `tabindex`).
- La pause est éteinte et se règle seulement dans le panneau d'avant.
- Essais navigateur : sous forte charge, `ui5-navigateur-ariane2` dure jusqu'à 13 s (délai de verify : 20 s, non allongé).
- À l'intégration (test 18) : la ligne de `passeDiffEcrire` (fiche du port § 3), la liste `HABILLAGE`/`RELECTURE_PAUSE` de `pose-lot-inchanges-4959` (conflit de contexte probable avec les autres branches), l'essai « au départ » si le nouveau panneau devient le défaut.
