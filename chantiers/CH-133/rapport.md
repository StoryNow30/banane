# CH-133 : rapport (bornes de la relecture, D-366, D-367)

Branche `chantier/CH-133`, partie du tronc `claude/50-test17` (c6dbc1f). `background.js` n'est pas modifié dans la branche : son changement est dans `chantiers/CH-133/background.patch` (à appliquer par l'intégrateur, `git apply`). Aucun fichier protégé touché ; aucune écriture nouvelle dans ESV ; jamais SKIP.

## Ce qui change
- **Service worker (patch)** : `relecture-reprendre` et `relecture-lancer` acceptent `{debut, fin}`. Refus en clair, rien ne change : non entiers ; départ après la fin ; hors de la partie (0 à total − 1, total de l'entrée de la relecture, sinon celui que la passe a lu au compteur d'ESV) ; aucun cut de la relecture entre les deux. Toutes les gardes d'avant restent (même chemin). Sans bornes : comportement d'avant.
  - Reprise bornée : les cuts restants du point de reprise hors des bornes sortent de la liste ; les cuts déjà relus restent comptés. Relance bornée (arrêtée, en erreur, finie) : nouvelle passe, sélection recalculée puis filtrée.
  - Un cut écarté n'est ni visité pour être relu ni écrit ; il est compté `horsBornes` (« non relu »), dit dans le message de fin et listé au journal `relecture-bornes` `{quand, debut, fin, ecartes, cuts, horsBornes}` ; `relecture-fin` porte `horsBornes` et `bornes`.
  - `relecture-etat` rend `bornesProposees` : en pause, le premier cut après une série sans point (sinon le cut gardé) ; après un arrêt, le premier cut après la série, sinon le cut qui suit le dernier relu (correction incertaine acquittée : le cut suivant) ; après une fin, le premier cut ; fin = dernier cut de la liste.
  - Message de la pause sur série vide : « … relecture gardée en pause au cut N. Recharge ESV (F5) puis reprends, ou reprends après la série (cut M) ».
- **Panneau** : `panel.html` (champs `#relecture-du`, `#relecture-au`, bouton `#relecture-bornes`), `src/relecture-pause.js` (vue et envoi), `src/signal-rendu.js` (tuile « Reprendre entre deux cuts » / « Relancer la relecture » et bouton), `src/ui5.js` (la saisie va au panneau d'origine). Pause sur série vide : « Reprendre du cut M au cut B » passe devant, « Reprendre la relecture au cut N » et « Arrêter » restent. Arrêt : « Relancer du cut A au cut B » passe devant. Fin : il suit le bouton principal. Rien tant qu'une correction interrompue attend « J'ai contrôlé le cut N », ni relecture coupée, ni autre lot, ni lot ouvert.
- **Téléphone (CH-130)** : rien de nouveau (essai : aucun ordre de bornes ; l'ordre est exécuté sans argument).

## Preuves (ÉTABLI, mesuré dans ce conteneur)
- `tests/ch133-relecture-bornes.test.cjs` (SW réel en vm) : rouge (5 échecs sur 6), puis vert 6/6. Vraie série vide (113 à 115, persistante) → pause à 113 → reprise 116 à 116 → la passe finit, aucun événement de relecture ni écriture sur 113 à 115 ; bornes refusées (inversées, hors partie, non entières, sans cut) ; arrêt sur série (pause éteinte) → relance 116 à 116 finie ; relance bornée après une fin.
- `tests/ch133-relecture-bornes-panneau.test.cjs` : rouge (5 échecs sur 6), puis vert 6/6.
- Essais voisins : relecture SW + CH-107 + CH-109 : 96/96 (le seul écart était le message de CH-107, mis à jour au texte du ticket) ; signal, ui5, panneau, relecture-pause, télécommande : 302/302 ; navigateur (ch104, ch129, ui5-navigateur) : 33/34, l'essai en échec passe seul, sur la branche comme sur le tronc (échec sous charge, PROBABLE).
- Parité `tools/parite-relecture-sw.cjs` contre le tronc : commandes, allées, écritures, journal, passe, stockage identiques dans les cinq relectures ; seul l'état au panneau diffère, par trois clés nouvelles (`horsBornes`, `bornes`, `bornesProposees`).
- Page de démonstration (vrai panneau, 600 px, six scènes) : fabriquée par `chantiers/CH-133/outils/page.cjs`, publiée en privé. Saisie mesurée dans Chromium : le champ caché suit, le bouton suit, départ après la fin → grisé et dit.

## Limite connue
En « corriger », un vert corrigeable est atteint par les boutons d'ESV : la passe passe par le cut d'avant (ex. 115 avant 116) sans le relire (aucune capture, aucun événement, rien d'écrit). C'est le chemin d'avant (revue, correction 3), inchangé.
