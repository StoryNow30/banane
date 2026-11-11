# CH-107 : rapport (la relecture ne court plus sur des captures vides)

Branche `chantier/CH-107`, partie de `claude/50-test17` à `4812cf1`. Aucun fichier de décision touché (diff vide sur `src/engine.js`, `src/adapter-page.js`, `src/geometry*.js`, `src/gcv2*.js`, `src/lot-decision.js`, `src/relecture-critere.js`, `src/relecture-ombre.js`, `manifest.json`).

## 1. Constat : une capture vide a-t-elle pu mener à une correction ?
**Non, sur une capture à zéro point.** ÉTABLI par le code et par un essai (moteur et décision réels en VM, fixture du corpus) ; PROBABLE au-delà de cette fixture.
Chemin : capture vide → seconde capture → calcul sur la PREMIÈRE capture → `decideCut`. Sans point, la science rend `ok:false` aux deux rails ; la décision diffère (« no-anchor » sans appui ; « left:frame right:frame » avec 5 appuis : l'étage window refait la science sur la capture ensemencée, avec les mêmes points vides). Pas de positions → pas de commande « lot » → critère `{corriger:false, regle:'commande'}` → « visite ». Deux captures vides : la règle « skip » ferme aussi le chemin.
Restait ouvert : (a) une capture PEU dense mais non vide est jugée normalement (SUPPOSÉ : ce que montreront les exports ; l'outil donne les points de chaque cut corrigé) ; (b) première capture vide, seconde pleine : le calcul se faisait sur la vide.

## 2. La garde (`background.js`)
- `relecturePointsVides` (nouvelle, avant `relecturePasse`) : série de cuts vides, avec le seuil et les rechargements par série de `lot.serieCapturesVides` (réglage du lot, lu par `src/serie-captures-vides.js`). Aucun réglage neuf.
- Dans la boucle : au seuil (3), la passe se met en pause « points » au PREMIER cut vide de la série (`indexPause`), les cuts de la série ne sont pas comptés comme relus et sont relus après la reprise ; rechargement par `relectureSignalRecharger(p,'points')` (chemin de CH-060, journal `relecture-points-vides` : detecte, recharge, repris, echec, abandon). Un rechargement par série ; si la série recommence, la passe reste en pause : « ESV n’affiche plus les points (…, même après le rechargement) : relecture gardée en pause au cut N. Recharge ESV (F5) puis reprends la relecture ». Une capture pleine ferme la série.
- Pause et reprise éteintes (défaut du réglage du panneau) : la relecture s'ARRÊTE au premier cut vide de la série (choix confirmé par l'intégrateur). Le message dit le cut d'arrêt et le nombre de cuts non relus (« Relecture arrêtée au cut 113 : … 4 cuts non relus, du cut 113 au cut 116 ; rien n’a été écrit sur ces cuts… ») ; les cuts de la série ne comptent pas comme relus. En Constellation, la file continue (motif `relecture-arretee`) et le bilan de la partie garde ce message.
- Toute capture vide (même suivie d'une pleine) interdit la correction du cut (`garde` : « capture sans point… : jamais de correction ») ; le calcul se fait sur la capture pleine quand la seconde l'est.
- `src/relecture-pause.js` : la ligne « ESV n’affiche plus les points : relecture gardée en pause au cut N · … ».

## 3. Preuves
- Essais neufs (rouges sur `4812cf1`, verts ici) : `tests/ch107-relecture-points-vides.test.cjs` (3), `tests/ch107-relecture-capture-vide-seule.test.cjs` (1), `tests/ch107-relecture-pause-points-panneau.test.cjs` (1), `tests/ch107-outils.test.cjs` (2, outil, écrit avec lui). `tests/ch107-file-relecture-arretee-sw.test.cjs` (1, Constellation : la file réelle passe à la partie suivante et le bilan dit « relecture arrêtée » ; la relecture y est un état posé, celui que la garde laisse ; vert du premier coup, puisque la file traitait déjà ce cas).
- Essais de la relecture, de la pause, du signal, des séries vides, de la deuxième passe et du panneau de pause : 160 sur 160 verts ; après l'ajout du message d'arrêt, relecture, file de parties et séries vides : 207 sur 207 verts. Maquette `tests/esv-maquette/relecture-signal-eteint.test.cjs` (chemin de rechargement partagé, vrai Chromium) : verte.
- Parité de la relecture (`tools/parite-relecture-sw.cjs`, contre `4812cf1`) : relevés identiques (SHA-256 9984fe77…), donc une relecture sans cut vide est identique à l'octet.
- Garde de pose (`tools/garde-gcv2.cjs`) : non rendue ici (lots archivés absents, `BANANE_LOTS`) ; aucun fichier de décision touché.

## 4. Outil
`node chantiers/CH-107/outils/relecture-cuts-vides.cjs <export> [--min 3] [--peu 100] [--cuts] [--json]` : par partie, cuts relus, vides, première vide, peu denses (1 à 99 points à la première capture, seuil `minPoints` de `lot.recaptureVide`), corrigés, corrigés sur un cut vide, corrigés peu denses, points minimum d'un cut corrigé, refus, séries (cuts, durée, cadence), pauses ; le tableau des cuts peu denses (points par rail, action, règle) et celui des cuts (colonne « sous 100 points », points par rail, action). Aucun comportement de jugement n'a changé pour les captures peu denses (décision de l'opérateur).

## Non vérifié
Le vrai ESV (que le rechargement relance le chargeur de points ; même SUPPOSÉ que CH-051) ; une maquette où Potree cesse d'afficher les points pendant la relecture ; l'état de la série après un redémarrage du service worker (il repart à zéro : au plus un rechargement de plus).
