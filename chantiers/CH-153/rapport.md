# CH-153 — Rapport : graine d'axe `gA`, `v4BS-sd`, `voieListe`, signal `garde-voie`

**État : terminé.** Toutes les mesures ci-dessous sont **ÉTABLIES** sur des rejeux locaux, sans aucune écriture dans ESV et sans lecture des examens vierges réservés D-379.

## Implémentation

- `BananeAncreTrajectoire.graineAxe` projette l'axe cinématique établi dans le repère profil de chaque rail ; l'ancre reste muette si l'axe ou le calage du lot n'est pas établi.
- `BananeGcv2L1` (`LEVIERS_V8`) ne reprend que les cuts laissés `rien` par Vision 18 : enrichissement du pool avec graines d'axe et `v4BS-sd` limité à `abords` / `pn`, `voieListe` encadrée, et recherche recentrée `gA` exigeant preuve forte, unicité, écartement de référence et proximité à l'axe.
- `c1SeulementDifferes` : toute pose déjà décidée par la chaîne ou GCV2 reste intacte au bit près. `c1SansRicochet` : les poses nouvellement permises ne nourrissent pas le transport des cuts suivants (`voisinLivre: rien`), dans le lot comme dans la deuxième passe.
- `serrageLotOmbre.actif = false`. `garde-voie-ombre` reste actif et alimente maintenant la liste Aurore (`signaux: ['garde-voie']`).
- Le partage banc / service worker passe `etatAncre` dans `deciderCutL1se`, `deciderRestePasse` et `background.js`, avec rejet du balayage en ADV et filtrage strict des paires ambiguës ou de hauteur incompatible.

## Preuves

### Essais

- `tests/ch153-c1-c0-axe-et-garde.test.cjs` : **3/3**.
- Batterie CH-153 + CH-124 + GCV2 + CH-079 + correction + CH-146 à CH-152 + empreintes et paquet : **172 réussis, 0 échec, 5 ignorés déclarés**.
- Garde d'empreintes `pose-lot-inchanges-4959`, `noms-modeles`, `package` : **0 échec**.

### Garde d'octobre (`base-vision18.json`, 12 lots)

- **Retour 0 : VERTE**.
- 0 juste perdu, 0 juste dégradé > 2 mm, 0 pose nouvelle > 50 mm, 0 mauvaise voie nouvelle.
- Deux signalements historiques de pertes acceptées sans objet (non bloquants).

### Corpus CH-116 (4 016 cuts, zones du journal, passe fidèle plafond 10)

- Éteint : **0 changement** contre Vision 18.
- Version C1 mesurée : **65 différés reposés justes, 3 reposés entre 10 et 50 mm, 0 mauvaise voie, 2 bons bloqués**.
- 38 changements contre Vision 18 ; aucune pose existante > 50 mm.

### Validation croisée « un lot dehors » (6 lots réglables)

`ch153-c1-v2-zjp` est choisi sur les 6 lots tenus à l'écart :

| Métrique | Vision 18 | CH-153 |
|---|---:|---:|
| Différés (jugés) | 588 (240) | **551 (203)** |
| Poses justes ≤ 10 mm (hors-lot) | 303 | **338** |
| Différés reposés justes | 12 | **46** |
| Reposés entre 10 et 50 mm | 1 | **3** |
| Mauvaises voies > 50 mm | 0 | **0** |
| Bons bloqués | 3 | **2** |

- **0 juste du tronc perdu ou dégradé au-delà de 10 mm**, **0 pose nouvelle > 50 mm**.
- Examen de 0511 : résultat **strictement identique** à Vision 18.

Le résultat de la réserve D-379 n'est **pas** mesuré ici : elle n'a pas été lue.
