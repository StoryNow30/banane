# CH-154 — Rapport : choix de voie par l'axe et reprise `N+`

**État : code et essais terminés.** Mesures locales **ÉTABLIES**, sans aucune écriture dans ESV et sans lecture de la réserve D-379.

## Implémentation

- `BananeAncreTrajectoire.jugerConnu` juge une pose de voisin ou d'appui dont le calage est déjà connu ; `fenetres` calcule, rail par rail, l'intervalle admissible en travers autour de l'axe à demi-contrat ± θ.
- C2 : `BananeGcv2L1.probasAncre` annule les hypothèses hors de cette fenêtre et ne choisit jamais une branche divergente en aiguillage lorsque la bonne paire est proche de l'axe. Une solution directe `reprise-axe`, avec preuve forte et unique, est disponible si le pool restreint reste sans réponse.
- C4 : `BananeDecisionLotPartagee.reprendreApresRefusAncre` relance une pose refusée par N sur le pool restreint à l'axe, sans les appuis ou voisins refusés, avec support renforcé (`dessus ≥ 12`, `flanc ≥ 5`), écartement à ≤ 10 mm de la référence et proximité finale à l'axe ≤ 25 mm. Aucun ricochet : la pose refusée reste dans les voisins historiques, la reprise n'entre pas dans le transport suivant.
- Le même chemin est branché dans `background.js` (chaîne, L1-s, GCV2 et deuxième passe) avec la gestion de vue déjà livrée.

## Preuves

- `tests/ch154-c2-c4-choix-axe-et-reprise.test.cjs` : **2/2**.
  - fenêtre et probabilités restreintes à l'axe ; reprise coupée par défaut refusée par N ; reprise active sur la vraie voie à ≤ 10 mm.
- Batterie CH-154 + CH-153 + CH-124 + GCV2 + CH-146 + CH-148 à CH-152 + empreintes et paquet : **115 réussis, 0 échec, 1 ignoré déclaré**.
- `pose-lot-inchanges-4959`, `noms-modeles`, `package` : **0 échec**.
- Fusion manuelle avec `ariane6` après CH-153, sans marqueur de conflit restant ; `node --check` passe.

Le jugement sur les lots d'octobre et sur la réserve D-379 n'est **pas** rapporté ici : il sera mesuré séparément avant la livraison.
