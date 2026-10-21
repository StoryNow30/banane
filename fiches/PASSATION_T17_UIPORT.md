# Test 17 : reprise du code d'interface de la branche UI (rôle « UI-PORT »), 21 octobre 2026

Branche `claude/50-t17-uiport`, depuis `claude/50-apprentissage-3-0` (d344fe1). Worktree `wt/T17D`. Source : `claude/50-ui-5.0` (tête a48012b), **non fusionnée** (elle porte ~200 commits de la lignée pilote) : les fichiers utiles ont été repris à la main, relus ligne à ligne, et corrigés quand ils avaient un défaut. Étude préalable : `fiches/PASSATION_T17_UI.md` (branche `claude/50-t17-ui`).
Marqueurs : **[mesuré]** = lancé ici ; **[lu]** = lu dans le code ; **[non prouvé]** = rien ne l'a exécuté.

## 1. Ce qui est repris, et d'où

| Bloc | Commit source | Dans cette branche |
|---|---|---|
| Habillage « Ariane » | ce778ac (+ les commits d'habillage qui le précèdent, repris dans leur état final) | `src/ui5.js`, `src/ui5-rendu.js`, `src/ui5-variante.js`, `panel-ui5.css`, crochets de `panel.js` (`ArianePanel`, `apres`) et de `panel.html` (feuille de style, scripts, lien « Essayer le nouveau panneau »), `fiches/UI_ETATS_COMPTEURS.md` (définitions que le code applique) |
| Bloc A | c97780c | « 999999 » jamais affiché (`finVisible`) ; pastille « Aucun onglet ESV » au lieu de « Prêt » sans cut affiché |
| Bloc C | a48012b | `background.js` (section relecture), `src/relecture-pause.js`, zone `#relecture-pause-zone` de `panel.html`, ligne et boutons dans le nouveau panneau, 12 essais `tests/relecture-pause-*`, `tests/helpers/relecture-pause.cjs`, fixture, essai d'empreinte `pose-lot-inchanges` |
| Bloc D (maquette v2) | a22ea1d (reçu après coup, commit séparé) | variante `ariane2` (§ 10) |
| Zone « deuxième passe » | 77b2a70 | **Ce commit ne change que la maquette** (`N-ariane-v2.html`), pas de code. Réalisée ici au nouveau panneau (§ 4, défaut 5) |

**Pas repris** : maquettes, `DECISIONS.md` de la branche UI (le texte de D-232 à D-234 est à reporter par l'intégration, § 9), `fiches/PLAN_RELECTURE_PAUSE.md` (plan périmé, « rien construit »), versions 4.9.6 (`tools/ui5-paquets.cjs`, `tests/version-4961`, `tests/consigne-4961`, `tests/consigne-49510`, consigne 4.9.6, `CHANGELOG`), `tools/ui5-navigateur.cjs` et les trois essais `ui5-navigateur-ariane*` (ils exigent Chromium + Playwright, **absents de cette machine** : rien n'y a été vu à l'écran ; voir § 8). Les présentations Linear, Raycast, Figma (D-230, rejetées), l'ancienne Raycast comprise, et la variante `ariane` (4.9.6.1, § 10) sont retirées (§ 5).

Commits : `ea832f1` (service worker + essais de la pause), `27189e4` (panneau : pause, habillage), `974c144` (commentaires), le commit du bloc D, puis cette fiche. Aucun conflit de fusion : le port est manuel ; seules les chaînes de version de la branche UI étaient en jeu et n'ont **pas** été reprises. La version reste 4.9.5.16 ; aucun essai de version de la test 16 n'est touché ; mes essais ne contiennent aucune chaîne de version.

## 2. Règles de port respectées

1. **Le panneau d'avant est le défaut** [mesuré : `tests/ui5-panneau.test.cjs`]. `src/ui5-variante.js` : `defaut: 'ancienne'`. Au départ, l'habillage ne dessine rien, n'écrit rien dans le stockage, n'envoie aucun message, ne redimensionne pas la fenêtre. « Essayer le nouveau panneau » (pied du panneau) ouvre la **maquette v2** (`ariane2`), garde le choix (`banane51Interface`) et agrandit la fenêtre (1180 × 840) ; « Ancien panneau » (Réglages) revient. Un choix gardé inconnu (par exemple `linear` ou `ariane`, de la 4.9.6 test 1) laisse le départ. Pour livrer le nouveau panneau par défaut : une ligne (`defaut: 'ariane2'`), et l'essai « au départ » à inverser.
2. **Version non touchée** : 4.9.5.16 partout.
3. **Réglage éteint = test 16** [mesuré]. `node tools/parite-relecture-sw.cjs <racine test 16> <cette racine>` joue cinq relectures (ombre, ombre avec le réglage écrit éteint, corriger, arrêt demandé au cut 109, F5 au cut 110) dans le **vrai service worker** de chaque dépôt (`wt/T16`, 75b47fd, contre `wt/T17D`) : commandes envoyées à ESV, appels de l'adaptateur, journal, états de la relecture, clés du stockage, neutralisés (identifiants, heures, durées). Résultat : 45 comparaisons (5 relectures × 9 champs) **identiques**, SHA-256 du relevé 9fdd1a8a79d9d402b436903c25250f3deadecdc1272b7d0d766d5b5c38694e67. Contrôle de l'outil : avec `AB_ACTIF=1` (réglage allumé) les relevés diffèrent (clés de stockage, F5, états). Le montage d'essai joue le profil « actuel » du lot ; le profil L1-se du lot n'est pas rejoué ici (la relecture lit le lot terminé, pas son profil). Essais existants : `pose-lot-inchanges-4959` (6 sur 6), les 61 essais `relecture-*` de la test 16 (§ 7). Un état de la relecture porte des clés de plus quand le réglage est allumé seulement (`pauseDemandee`, `pauseRaison`, `reprise`, `expire` ; `repriseReglage` au niveau de `relecture-etat`) : l'outil les écarte, la vue du lot (`view.relecture`) est identique.
4. **Service worker : localisation** (§ 3).
5. **Garde partagée** (§ 3, § 6).
6. **Relecture de chaque ligne portée** : § 4 (défauts corrigés) et § 5 (code retiré).
7. Essais lancés : § 7.

## 3. `background.js` : lignes touchées (pour la fusion avec la deuxième passe)

Tout est dans la section relecture, sauf la ligne 2276-2277 (clés) et les deux lignes de `dispatch`. Numéros de la branche après port (127 lignes ajoutées, 27 retirées) :

- 2276 : `CLE_RELECTURE_REPRISE`, `CLE_RELECTURE_REGLAGE_PAUSE` ; 2277 : `'relecture-reprendre'` ajouté à `RELECTURE_BLOQUE`.
- 2291-2295 : `passeVivante` (ancien sens de `passeActive`), `passeActive` (= vivante **ou en pause**), `REPRISE_DUREE_MS`.
- 2321-2325 : `relectureEtat` (clés de pause, `repriseReglage`), `relectureVue` ; 2329 : champs de `relectureNouvelle`.
- 2445-2448, 2486, 2495 : `relectureLancer` (relance refusée en pause, lecture du réglage, point effacé au départ, effacement à l'échec).
- 2500-2531 : bloc neuf (réglage, point de reprise, `relectureDepuisPoint`) ; 2535-2541 : `relectureApresRedemarrage` ; 2543-2573 : `relectureArreter` (pause), `relectureMettreEnPause`, `relectureReprendre`.
- 2680-2784 : `relecturePasse` (paramètre `reprise`, `stopEsv`, `reprisePoser`, sortie en pause) ; sorties de navigation qui regardent `pauseDemandee`.
- 2866-2868 et 2877-2880 : `dispatch` (garde « en pause », quatre actions neuves : `relecture-pause`, `relecture-reprendre`, `relecture-pause-reglage-etat`, `relecture-pause-reglage`).

**Fusion à blanc avec `claude/50-t17-passe2` (14822b3)** [mesuré, worktree jetable] : **un seul conflit**, dans `dispatch` (le bloc `if(passeDiff.ecriture){…}` de la deuxième passe et ma garde `passeActive()` sont voisins). Résolution : garder le bloc `passeDiff.ecriture` **puis** ma garde de trois lignes (la sienne a été reprise telle quelle). `tests/pose-lot-inchanges-4959.test.cjs` se fusionne seul. Syntaxe vérifiée.

**À corriger à la fusion (un défaut d'interaction réel, reproduit)** : dans `passeDiffEcrire` (`background.js` de passe2, ligne ~1622), `relecture.passe?.etat==='en-cours'` ne couvre pas la pause. Une relecture mise en pause, puis « relance » de la deuxième passe (`passe-differes-ecrire`, ou le départ par la fin d'un lot), **écrit dans ESV pendant que la relecture est en pause**. Reproduit dans le worktree de fusion (essai `passe-differes-relecture-pause`, rouge : `issue 'fin'` au lieu de `'refus-depart'`) ; corrigé par :

```js
['en-cours','en-pause'].includes(relecture.passe?.etat)?'une relecture est en cours ou en pause':await lotCloRefus(b,true,null)
```
Essai vert après correction. **Cette correction porte sur du code que cette branche ne contient pas** (`passeDiffEcrire` n'existe que sur passe2) : elle n'est donc pas appliquée ici, la ligne ci-dessus est à appliquer telle quelle à l'intégration. Le texte de l'essai de fusion est dans `/tmp/claude-0/-home-user/cc0e4631-960e-5f55-b126-e7123e84b5ca/scratchpad/t17/uiport/gardes/passe-differes-relecture-pause.test.cjs` (il utilise `tests/helpers/passe-differes.cjs` de passe2 : il ne peut pas vivre dans cette branche). L'autre sens (« Reprendre » pendant que la deuxième passe écrit) est couvert sans rien changer chez passe2 : `'relecture-reprendre'` est dans `RELECTURE_BLOQUE` (exemptée seulement pour une passe en pause), donc son bloc `if(passeDiff.ecriture){… RELECTURE_BLOQUE.has(action) …}` la refuse. Les deux autres endroits de passe2 qui testent `etat==='en-cours'` (séance de l'observateur, mémoire de la liste) sont à laisser : en pause, rien ne s'écrit et l'observateur n'a rien à ranger.

## 4. Défauts trouvés dans la branche UI, corrigés ici (chacun avec un essai qui rougit sans la correction)

Mutations vérifiées sur une copie : l'essai passe au rouge quand la correction est retirée.

1. **Texte de l'accueil non échappé** (`accueilAr`, état « À toi ») : le texte d'alerte venait du panneau et entrait tel quel dans le HTML (injection de balises). Corrigé (`esc`). Essai : `ui5-rendu` « tout texte du panneau est échappé » (rougissait sur l'accueil seulement).
2. **Pause « pose peu sûre » affichée « En pause »** : le lot s'arrête en `PAUSED` avec `pauseReason: 'low-confidence'` et attend un choix (réessayer, reprendre à la main, passer) ; la pastille disait « En pause » et la phrase « Le lot reprendra au cut suivant », la phrase d'alerte déjà écrite n'était jamais montrée. Corrigé : état « À toi ». Essai : `ui5-panneau` « état du lot ».
3. **Position de défilement perdue à chaque dessin** : le conteneur qui défile (`.ecr`) n'était pas dans la liste des zones dont on garde le défilement ; chaque changement d'état (un par cut en lot) le ramenait en haut. Corrigé. Essai : `ui5-panneau` « un nouveau dessin garde la position ».
4. **« Lancer la relecture » proposé pendant une pause** (carte Relecture, et donc nouveau panneau) : un clic repartirait de zéro, la garde le refuse mais le bouton ne devait pas être là. Corrigé dans `src/carte-relecture.js` (une condition ; `pose-lot-inchanges` déclare le fichier comme module de panneau). Essai : `relecture-panneau`.
5. **Zone « la deuxième passe travaille, ne touche à rien dans ESV »** : demandée (77b2a70) mais absente du code. Ajoutée au nouveau panneau à partir de l'état `view.passeDifferes` de la deuxième passe (`etat === 'ecriture'`), qui n'existe que sur la branche passe2 : pastille « Deuxième passe en cours », phrase, ligne « cut N · k posé sur m », commande verrouillée « Ne touche à rien dans ESV », Écho indisponible ; un résultat incertain passe devant. Essais sur des états fabriqués (la forme est celle de la fiche passe2 § 5, lue). **Pas de zone équivalente dans le panneau d'avant (défaut)** : ni la fiche passe2 ni ce port n'y touchent ; tant qu'elle n'y est pas, le panneau d'avant ne dit pas à l'opérateur de ne rien toucher pendant que la deuxième passe écrit (risque § 8).
6. **Reprise : la page ESV rechargée ne savait pas qu'une séance d'observation était ouverte** : l'observateur de la page ne relit son état qu'au chargement et toutes les 15 s. Après un F5 pendant la pause, la première correction d'une relecture « corriger » pouvait donc partir sans que l'écriture « valid » soit vue (validation « non prouvée », passe arrêtée, pose gardée, « J'ai contrôlé le cut N »). `relectureReprendre` appelle maintenant `syncLauncher()` (poussée existante vers la page, qui relit tout de suite). Essai : `relecture-pause-gardes`. **Le gain réel est à mesurer sur ESV** (D-234 le demandait déjà : « délai de réinstallation de l'observateur après F5 »).
7. **Code mort de la branche UI** (§ 5) : champ `part` du point de reprise jamais lu, garde `if(!p.reprise)return` jamais atteinte, surcharge `total:` sans effet à la reprise, bloc `if` vide dans `aller`, `ui.pauseLot` calculé par une expression qui vaut toujours `null`, format de compteur `{total,date}` qui n'existe pas, double échappement, etc.

## 5. Code retiré (aucune ligne inutile)

| Fichier | Branche UI | Ici |
|---|---|---|
| `src/ui5-rendu.js` | 376 | 222 |
| `src/ui5.js` | 321 | 264 |
| `panel-ui5.css` | 403 | 186 |

Retiré : les trois présentations rejetées par D-230 (Linear, Raycast, Figma et Arc) avec la palette de commandes, leurs clés de clavier, leurs 251 règles de style et animations ; les champs de l'instantané qu'aucun écran ne lit (compteurs de tuiles, pourcentage, lignes de cuts, `aPoser`, `session` du compteur…) ; le « modèle » réduit à ce que l'écran lit ; les variables de style jamais utilisées. Les règles de style qui restent sont celles dont chaque classe est écrite par le rendu ou par `panel.html` (contrôle mécanique sur les classes ; **non vu à l'écran**). Les tailles de fenêtre `linear`, `raycast`, `figma` et les essais navigateur de ces trois présentations (déjà supprimés par la branche UI) sont donc sans objet.

## 6. La garde partagée (`passeActive`, `RELECTURE_BLOQUE`)

[mesuré : `relecture-pause-gardes`, `relecture-pause-sw`, `relecture-pause-arret`, `relecture-pause-redemarrage`] Une passe `en-pause` est « active » : le service worker refuse **toutes** les actions de `RELECTURE_BLOQUE` (départ de lot `start`, `resume`, `retry`, Écho, retour à un cut `goto-cut`, vidage du cache, `settings`, `reject`, `references`, relance à zéro `relecture-lancer`…), avec le message « Relecture en pause : clique sur Reprendre… ». L'essai énumère le jeu `RELECTURE_BLOQUE` lui-même (si une action y entre un jour, elle est contrôlée sans toucher l'essai). Passent : `connect` (nécessaire après un F5), `relecture-reprendre`, `relecture-arreter`, `stop` (« Arrêter » du lot arrête la pause). `relecture-reprendre` pendant une passe qui travaille : refusée. Au redémarrage du service worker la passe revient **en pause**, jamais relancée seule, et son lot est noté planifié (aucun départ automatique après « Arrêter »). **Deuxième passe** : § 3.

## 7. Essais lancés (machine partagée, charge 5 à 8, `taskset`)

Ajoutés : `ui5-rendu` (12), `ui5-panneau` (12, DOM de l'habillage en vm : `tests/helpers/ui5-page.cjs`), `relecture-pause-panneau` (3), `relecture-pause-gardes` (1), 12 `relecture-pause-*` repris (le seul `-sw` augmenté), `relecture-panneau` (+1), `pose-lot-inchanges-4959` (liste des fichiers nouveaux de `src/` et module de panneau déclaré).

Lancés avec `taskset -c 0-1`, un fichier à la fois, par un lanceur qui note la durée (hors dépôt) :
- **Lot complet ciblé après le port de A et C, délai de 60 s** : 126 fichiers (`ui5`, `relecture` (55 fichiers), `panel`, `pose-lot`, `version`, `consigne`, `fiabilite`, `package`, `choix-lot`, `cohabit`, `u1-49`, `phase-pli`, `d092`, `gcv1-export`, `t16-panneau`, `revue-globale`, `background`, `carte`, `raison`) : **0 échec** ; `package` : 1 essai ignoré (corpus privé absent, comme sur la base).
- Après le bloc D (seul le panneau change, pas le service worker) : 61 fichiers de la famille panneau, `pose-lot`, `version`, `consigne`, `package`, `gcv1-export`, relecture du panneau : **0 échec**, `ui5-rendu` 16, `ui5-panneau` 13, `relecture-pause-panneau` 3, `pose-lot-inchanges-4959` 6.
- `tools/parite-relecture-sw.cjs` (test 16 contre ce dépôt) : relevés identiques (même SHA-256) sur 3 jeux sur 4 ; le quatrième montrait un écart sur le scénario F5 (états de la relecture). L'outil est bruité sous charge : deux copies de la **test 16** comparées entre elles ont aussi différé une fois sur trois (nombre de cuts marqués « vu », délai de 120 ms de l'essai). Aucun écart de commande à ESV ni de pose n'a jamais été vu. Le premier jeu comparait aussi avec le réglage allumé (`AB_ACTIF=1`) : écarts attendus de stockage et de F5.
- Avec le délai de 20 s de `tools/verify.cjs` (premier lot, charge 5 à 8) : 5 essais `relecture-sw-*` de la test 16 (non modifiés) l'ont dépassé (20,2 à 20,3 s, annulés) ; au second lot, avec 60 s, ils ont duré 29 à 33 s sous charge 7 et passent. Les `relecture-pause-*` ont duré 7 à 10 s au calme, 14 à 20 s sous charge 7. Je n'ai pas allongé de délai.
- **Mutations** (copie du dépôt, une correction retirée à la fois, l'essai doit rougir) : `syncLauncher` retiré, `passeActive` sans la pause, `relecture-reprendre` hors du jeu bloqué, `connect` refusée en pause, état « peu sûr » = pause simple, échappement de l'accueil, `.ecr` hors des zones de défilement, « Lancer » de la carte pendant la pause, départ `ariane`, état de la deuxième passe, verrou de connexion de la rangée d'onglets, cache toujours actif, taille de fenêtre `ariane2` : tous rouges.
- Fusion à blanc avec passe2 : § 3 (un essai de fusion, rouge sans la correction, vert avec). Les essais de passe2 eux-mêmes n'ont pas été relancés sur la fusion.

## 8. Risques et non prouvé

- **Rien n'a été vu à l'écran** (ni Chromium ni Playwright ici). Le CSS a été allégé mécaniquement ; les essais en vm vérifient la logique (états, clics, échappement, défilement) mais pas l'aspect ni les animations. **À faire à l'intégration** : ouvrir le panneau, cliquer « Essayer le nouveau panneau », parcourir accueil, Orbite, Écho, Revue, Réglages, revenir par « Ancien panneau ».
- **La relecture en cours n'est pas montrée par le nouveau panneau** : tant qu'elle travaille (y compris en « corriger », qui écrit dans ESV), la pastille dit « Lot terminé » ; seule la commande « Arrêter la relecture » et, en pause, la zone de pause apparaissent. La maquette v2 prévoit « Relecture en cours » : pas repris (hors de la liste).
- **La deuxième passe n'a aucune consigne visible dans le panneau d'avant** (défaut) : voir § 4, défaut 5. À ajouter par l'agent passe2 ou à l'intégration (une ligne dans `panel.js` lisant `view.passeDifferes`).
- La pause/reprise est **éteinte par défaut** et ne se règle que dans le panneau d'avant (Réglages, carte Relecture) : le nouveau panneau n'a pas la case.
- Deux interrogations `relecture-etat` en parallèle depuis le panneau (la carte Relecture toutes les 1 à 4 s, le module de pause toutes les 1,5 à 5 s) : lectures de stockage, sans effet sur ESV ; une piste de simplification si l'on retouche la carte.
- Duplication cosmétique dans le panneau d'avant pendant une pause : la carte affiche le message de la passe, le module de pause sa propre ligne.
- Le compteur « 2 684 » du nouveau panneau (Réglages) vient de `datasets/compteur-gcv2.json` (19/10), non régénéré.
- Écriture du point de reprise après **chaque** cut relu (réglage allumé seulement) : la sélection entière est réécrite dans `chrome.storage.local` (`unlimitedStorage`). Non mesuré en durée ni en volume sur un grand lot.
- Délais : `relecture-sw-*` (15 à 20 s sous charge) et les essais `relecture-pause-*` (7 à 10 s seuls, jusqu'à 17 s sous charge) sont dans la zone du délai de 20 s de `tools/verify.cjs` ; `relecture-sw-statut-relu` l'a dépassé une fois sous charge 8 (non lié au port, passé seul). Je n'ai pas allongé de délai.

## 9. Pour l'intégration

- Reporter dans `DECISIONS.md` le texte de D-232, D-233, D-234 de la branche UI (D-234 : pause et reprise construites, éteintes ; il dit à tort que la pause bloque la deuxième passe « comme la relecture vivante » : c'est vrai ici pour le lot et, après la correction du § 3, pour la deuxième passe).
- Numéro de version : 4.9.5.17 (une seule modification de chaînes, par l'agent qui fixe la version) ; ajouter `src/ui5-rendu.js`, `src/ui5.js`, `src/ui5-variante.js`, `src/relecture-pause.js` à la liste des fichiers du paquet si elle existe (`tools/package.py` empaquette tout `src/` et `panel-ui5.css`).
- `tests/pose-lot-inchanges-4959.test.cjs` : listes `HABILLAGE`, `RELECTURE_PAUSE`, `PANNEAU` ajoutées ; conflit probable de contexte avec l'autre branche.
- Pour livrer le nouveau panneau par défaut : `src/ui5-variante.js` et l'essai « au départ » de `tests/ui5-panneau.test.cjs`.
- Rejouer `node tools/parite-relecture-sw.cjs <racine test 16>` sur le résultat de la fusion : doit rester « identiques » (hors ce que la deuxième passe change à la relecture, à juger).

## 10. Bloc D (a22ea1d) : présentation `ariane2` (maquette v2), éteinte par défaut

Reprise en commit séparé (`10f75c9`), puis rendue **seule présentation** (ci-dessous). Le défaut reste le panneau d'avant ; le lien « Essayer le nouveau panneau » et Réglages > Interface (« Nouveau panneau Ariane ») ouvrent `ariane2`.
Contenu : sans grand titre ni phrase d'accompagnement ni ligne « parcours du lot » ; rangée des onglets ESV (une puce par onglet de la liste du panneau, un clic = choisir l'onglet puis cliquer « Reconnecter ESV », l'onglet pas prêt ou verrouillé pendant un lot n'est pas cliquable) ; « Vider le cache » en vue dans Orbite et Écho (le bouton d'origine, la même confirmation, grisé avec sa raison) ; nouveau logo ; fenêtre 1180 × 840. Écart avec a22ea1d : le drapeau « v2 » n'est plus une variable globale posée le temps d'un rendu, la classe de l'hôte est posée une fois.
**Variante `ariane` (4.9.6.1) retirée** : une fois le lien ouvrant `ariane2`, plus rien ne l'atteignait (ni le lien, ni la liste de Réglages). Retirés avec elle : grands titres et phrases, ligne « parcours du lot » (fonction, champ `parcours`, ~20 lignes de style), logo d'origine, doubles branches `v2`. Un choix `ariane` déjà gardé retombe sur le départ (essai). `ariane2` et le panneau d'avant restent couverts : `ui5-rendu` (16), `ui5-panneau` (13).
**Palette : non reprise, preuve.** Le bloc D n'apporte **pas** la palette sobre de D-233. Dans a22ea1d, `src/ui5-rendu.js` n'ajoute qu'une commande « Interface Ariane » (`variante:ariane2`) à `commandes()` ; l'écran de la palette reste `rendreRaycast` / `palette()` d'avant : groupes « Suggestions » et « Vues et réglages », colonne de type (`.ty`), fond imitant ESV (`.esv-fond`), **toutes** les commandes listées à l'ouverture (pas quatre). Le commit 2d284da (« palette alternative refaite ») ne touche que `DECISIONS.md`, `PLAN_RELECTURE_PAUSE.md` et `maquettes/ui-5.0/N-ariane-v2.html` : la palette sobre (une ligne de recherche, quatre commandes à l'ouverture, le reste en tapant) **n'existe que dans la maquette**. D-235 le dit à sa façon (« la palette (variante `raycast`) a une commande de retour »). Le bouton d'accès (icône, lien d'accueil, Ctrl K) n'ouvre donc que l'ancienne présentation Raycast, celle que D-233 juge « trop fouillie » : non reprise. **Ce que Mic a validé (la palette sobre) n'est pas construit** : c'est du code neuf à écrire d'après la maquette, pas un port ; à décider par la session principale.
**Limite connue** : une seule connexion ESV est partagée par Orbite et Écho (la maquette en montrait deux) ; la rangée montre le même onglet connecté, coloré selon l'écran. Le moteur de connexion n'est pas touché.
Ni `DECISIONS.md` (D-235), ni `tools/ui5-navigateur.cjs`, ni l'essai navigateur `ui5-navigateur-ariane2` ne sont repris (pas de Chromium ici).
