# États et compteurs du panneau : une seule définition pour toutes les vues (20 octobre 2026)

Réponse au point B de l'audit des maquettes (« les compteurs et les couleurs ne racontent pas toujours la même histoire »). Chaque définition ci-dessous est lue dans le code de la test 9 (`src/engine.js`, `background.js`, `panel.js`, `src/verts-a-controler.js`), pas supposée. Toute vue du nouveau panneau (panneau unique, liste, palette, ruban) doit s'y tenir.

## 1. Compteurs du lot

| Mot affiché | Définition exacte | Source |
|---|---|---|
| **Ciblés** | cuts invalides de la partie au départ du lot (fiche de départ, D-092). Connu seulement pour un lot « jusqu'à la fin de la partie » parti du début ; sinon : inconnu, et rien n'est inventé | `travailDuLot` (`panel.js`), `fiches-depart` |
| **Posés** | cuts posés **et validés** par le lot | `batch.processed` (ajout après la validation, `src/engine.js:977`) |
| **Différés** | cuts quittés sans pose ni validation, à reprendre | `batch.deferred` (`src/engine.js:664`) |
| **Traités** | posés + différés + SKIP + repris à la main : les cuts sur lesquels le lot a terminé son travail | somme des quatre listes |
| **Restants** | ciblés − traités, si les ciblés sont connus | calcul |
| **En cours** | le cut que le lot a ouvert et pas encore terminé ; il n'est dans aucun compteur | `batch.activeIdentity` |
| **À contrôler** | cuts **verts** (laissés valides par ESV, jamais visités par le lot) jugés suspects. **Ils ne recouvrent jamais un cut posé ou différé du lot** | `src/verts-a-controler.js` (« hors des cuts du lot ») |
| **Relus / corrigés** (relecture) | cuts visités par la relecture après le lot / corrigés par elle (verts sûrs seulement) | `relecture-etat` (`src/carte-relecture.js`) |

**Écart trouvé dans le panneau actuel** : la tuile du lot calcule son pourcentage avec `posés ÷ ciblés`, alors que son infobulle et un commentaire du code disent « posés et différés » (`panel.js`, autour de la ligne 707). Les différés ne font donc pas avancer la barre. Le nouveau panneau affichera **« traités / ciblés »**, avec traités = posés + différés + SKIP + repris (définition ci-dessus). Le panneau d'origine n'est pas modifié ici ; l'écart est signalé.

**Règle d'affichage** : on écrit « 31 cuts traités sur 120 ciblés » (27 posés, 4 différés), jamais « 31 / 120 invalides » sans dire ce qui est compté.

## 2. Ruban

- **Périmètre** : les cuts **ciblés** par le lot, dans l'ordre où le lot les a ouverts. ESV saute les cuts déjà verts : les numéros ne sont pas consécutifs.
- Les cuts traités sont dessinés un par un. **Les restants ne sont pas dessinés en carrés** (on ne connaît pas leurs numéros à l'avance) : ils forment une seule barre grise « 89 restants ».
- **Une case = l'état actuel du cut**, jamais l'historique. Un cut différé puis repris à la main est « repris », pas les deux.
- **Couleur et forme** : posé (carré plein vert), posé par la voie (carré vert clair à bord), différé (carré ambre avec une barre), SKIP (carré barré), repris (carré à point), en cours (carré blanc à anneau), résultat incertain (carré rouge avec « ! » ; on ne dit jamais « à contrôler » pour lui, ce mot est réservé aux verts suspects). Toujours lisible sans la couleur.
- **Les verts à contrôler ne sont pas dans le ruban** (ils ne sont pas des cuts du lot) : ils ont leur liste.
- Les cases ont une taille fixe ; le ruban passe à la ligne, il ne déborde jamais.

## 3. États

| Ce qu'on montre | Valeurs | Source |
|---|---|---|
| **État du lot** | Prêt · En cours · Pause demandée · En pause · À toi (rail non résolu, reprise manuelle) · Interrompu (résultat à contrôler) · Terminé | `batch.state` ; « pause demandée » : Pause cliqué, le lot finit son cut (il s'arrête au prochain point sûr) |
| **État de la connexion** | ESV répond · ESV ne répond plus · ESV a quitté la partie | `connection.status`, `PAUSED_ADAPTER_UNRESPONSIVE`, `stoppedAtEnd.reason` |
| **Dernière opération confirmée** | « Cut 4811 validé » | dernier élément de `batch.processed` (ou `lastCompletedIdentity`) |
| **Opération interrompue** | « Cut 4812 : pose non confirmée » | `intent`, `deferIntent`, `reconcileRequired`, `stoppedAtEnd.applied` |
| **Prochaine action possible** | une seule, et seulement si ses conditions sont réunies | les boutons que le panneau d'origine rend actifs (aucun n'est inventé) |

« Reprendre » n'est actif que si le panneau d'origine l'est (il exige un adaptateur qui répond, aucun résultat incertain à clôturer). Après une interruption, la ligne « opération interrompue » reste affichée jusqu'à la clôture : une pose commencée n'est jamais montrée comme terminée.

**Fin de lot** : trois lignes distinctes, jamais une coche seule :
1. « Lot automatique terminé : 120 cuts traités sur 120 ciblés » ;
2. « Il te reste : 11 différés, 9 verts à contrôler » (les deux ne se recouvrent jamais, voir § 1) ;
3. « Export : prêt » ou « Export fait, 3 volumes confirmés ».
L'action principale est alors **« Voir ce qui reste »** s'il reste quelque chose ; l'export vient en second.

**Incident pendant une pose** (vérifié dans `src/engine.js`, `apply` et `closeUncertain`, et `panel.js`, autour de la ligne 820) : si ESV ne répond plus pendant la pose d'un cut, Ariane bloque toute nouvelle écriture (`reconcileRequired`). « Reprendre » n'est **pas** proposé ; la sortie est « Archiver le résultat interrompu · cut N » : le lot s'arrête et ce cut est mis de côté. « Aucune validation envoyée » n'est vrai que si l'opération interrompue est la pose (la validation vient après) ; si c'est la validation, on dit « validation non confirmée, vérifie-la dans ESV ». « Reprendre » après F5 ne vaut que si **aucune** opération n'était en cours (lot entre deux cuts). F5 n'est conseillé que si ESV reste figée. La maquette J se trompait sur ce point ; la K le corrige.

**Hiérarchie (deuxième audit)** : ces états sont fiabilisés partout, mais ne sont pas tous affichés en permanence. Lot en cours : une phrase, traités sur ciblés, le cut en cours, l'action. La connexion n'est qu'un point, la dernière validation est dans « Détails ». En cas d'incident, l'opération interrompue passe devant tout. À la fin, connexion et « en cours » disparaissent.

## 4. Compteur GCV2

Le nombre « 2 684 » est le nombre de **cuts corrigés par l’opérateur dans les Échos archivés**, tous projets, au 19 octobre (`fiches/COMPTEUR_GCV2.md`). Ce sont des **exemples d'apprentissage**, pas des cuts « appris » par un modèle en service, et **il ne mesure aucune qualité**. La GCV2 n'est pas dans cette version. Il quitte l'écran de travail pour une vue « Modèle », avec sa définition et sa date.

## 5. Ce qui reste hypothèse

- « Pause demandée » : le panneau d'origine ne montre pas cet état. Le nouveau panneau peut le déduire du clic sur Pause tant que le lot est encore `RUNNING`, sans rien demander de nouveau au service worker.
- Les ciblés sont inconnus pour un lot borné ou parti au milieu de la partie : le panneau dit alors « 31 cuts traités » sans total.
