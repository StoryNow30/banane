# CH-155 — Rapport : convention centrée sur la pose et arbitrage du travers par l'axe

**État : code et essais terminés.** Mesures locales **ÉTABLIES**, sans écriture dans ESV et sans lecture de la réserve D-379.

## Implémentation

- `Conv.bandOffsets` suit désormais `(delta[1], delta[2])` pour les poses éloignées (|latéral| ≥ 130 mm, |vertical| ≥ 60 mm, ou `centrerFenetre: true`) : les points de dessus et de flanc restent disponibles lors d'une pose loin du départ d'ESV, au lieu d'un échec `top-under-observed`.
- Sous ces seuils, le chemin historique est **strictement identique au bit près** ; `centrerFenetre: false` force l'ancien chemin.
- `BananeGcv2L1.affinerPoseParAxe` arbitre un recalage latéral du flanc LiDAR uniquement si le milieu de la paire se rapproche strictement de l'axe prédit, si l'écartement reste dans le contrat et à ≤ 10 mm de la référence, et si le déplacement latéral est borné. Toute modification qui éloigne l'axe est refusée.

## Preuves

- `tests/ch155-c3-convention-centree-et-axe.test.cjs` : **2/2**.
  - à +260 mm, sans centrage : refus `top-under-observed` ; avec CH-155 : calage appliqué et erreur résiduelle < 2 mm ; sous 130 mm : identité stricte au bit près.
  - arbitrage flanc accepté quand l'écart à l'axe diminue ; refus lorsque l'écart à l'axe augmente.
- Batterie CH-155 + CH-154 + CH-153 + CH-124 + conventions + GCV2 + CH-146 à CH-151 + empreintes et paquet : **102 réussis, 0 échec, 1 ignoré déclaré**.
- `pose-lot-inchanges-4959`, `noms-modeles`, `package` : **0 échec**.

Le verdict global sur les lots d'octobre et la réserve D-379 n'est **pas** rapporté ici : il sera mesuré séparément avant livraison.
